import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { obtenerEstrategiaActiva, type PedidoParaEnrutar } from "@/lib/enrutamiento";

/* Avisa que un pedido ya analizado por Nora existe — hoy a Telegram,
   mañana quizás a matching automático (ver lib/enrutamiento/index.ts).

   Por qué es una ruta aparte y no parte de crearServicio (lib/datos.ts):
   avisar necesita un secreto de servidor (el token del bot), y
   crearServicio inserta directo desde el navegador con la clave
   pública, protegido por RLS — no puede tocar ningún secreto. Mismo
   motivo por el que existe /api/diagnosticar para la clave de
   Anthropic.

   El pedido ya está guardado en la base ANTES de llegar acá (lo crea
   crearServicio). Si esta ruta falla, el pedido no se pierde — sólo
   queda sin avisar, y eso mismo se registra en servicio_enrutamientos
   para poder encontrarlo después. */

export const runtime = "nodejs";
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CuerpoPedido = {
  diagnostico?: PedidoParaEnrutar["diagnostico"];
  estimado?: PedidoParaEnrutar["estimado"];
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Id de pedido inválido." }, { status: 400 });
  }

  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }

  let cuerpo: CuerpoPedido = {};
  try {
    cuerpo = await request.json();
  } catch {
    // Sin diagnóstico de foto el cuerpo viene vacío — es válido.
  }

  /* RLS ("el cliente ve sus servicios" / "el técnico ve los servicios
     que le asignaron", 02_permisos.sql) ya garantiza que esta consulta
     sólo puede traer un pedido propio. Si no aparece nada, no
     distinguimos "no existe" de "no es tuyo" — la misma respuesta
     para los dos evita filtrar cuáles ids son válidos. */
  const { data: servicio, error: errServicio } = await supabase
    .from("servicios")
    .select("id, propiedad_id, categoria_slug, descripcion, fecha_preferida, franja_preferida, cliente_id")
    .eq("id", id)
    .maybeSingle();

  if (errServicio || !servicio) {
    return NextResponse.json({ error: "No encontramos ese pedido." }, { status: 404 });
  }

  const [{ data: propiedad }, { data: categoria }, { data: perfil }, { data: fotos }] = await Promise.all([
    supabase
      .from("propiedades")
      .select("calle, numero, localidad, provincia, notas_acceso")
      .eq("id", servicio.propiedad_id)
      .maybeSingle(),
    supabase.from("categorias").select("nombre").eq("slug", servicio.categoria_slug).maybeSingle(),
    supabase.from("perfiles").select("nombre, telefono").eq("id", servicio.cliente_id).maybeSingle(),
    supabase
      .from("servicio_fotos")
      .select("archivo_path")
      .eq("servicio_id", id)
      .order("creado_el", { ascending: false })
      .limit(1),
  ]);

  let fotoUrl: string | null = null;
  const primeraFoto = fotos?.[0];
  if (primeraFoto) {
    const { data: firmada } = await supabase.storage
      .from("fotos-servicios")
      .createSignedUrl(primeraFoto.archivo_path, 3600);
    fotoUrl = firmada?.signedUrl ?? null;
  }

  const pedido: PedidoParaEnrutar = {
    servicioId: servicio.id,
    categoriaNombre: categoria?.nombre ?? servicio.categoria_slug,
    descripcion: servicio.descripcion,
    diagnostico: cuerpo.diagnostico,
    estimado: cuerpo.estimado ?? null,
    cliente: {
      nombre: perfil?.nombre ?? "—",
      telefono: perfil?.telefono ?? null,
    },
    propiedad: {
      direccion: [propiedad?.calle, propiedad?.numero].filter(Boolean).join(" "),
      localidad: propiedad?.localidad ?? "",
      provincia: propiedad?.provincia ?? "",
      notasAcceso: propiedad?.notas_acceso ?? null,
    },
    fechaPreferida: servicio.fecha_preferida,
    franjaPreferida: servicio.franja_preferida,
    fotoUrl,
  };

  const estrategia = obtenerEstrategiaActiva();

  let resultado;
  try {
    resultado = await estrategia.enrutar(pedido);
  } catch (e) {
    console.error("[api/pedidos/enrutar]", e);
    resultado = { ok: false, detalle: e instanceof Error ? e.message : "Error desconocido al enrutar." };
  }

  // Se registra siempre, salga bien o mal: es la única forma de que
  // "¿a este pedido lo vio alguien?" tenga una respuesta confiable.
  const { error: errRegistro } = await supabase.from("servicio_enrutamientos").insert({
    servicio_id: id,
    estrategia: estrategia.nombre,
    estado: resultado.ok ? "enviado" : "fallido",
    detalle: resultado.detalle ?? null,
    intentos: resultado.intentos ?? 1,
  });

  if (errRegistro) {
    console.error("[api/pedidos/enrutar] no se pudo registrar el intento:", errRegistro.message);
  }

  return NextResponse.json({ ok: resultado.ok });
}
