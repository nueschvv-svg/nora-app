import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { enviarComprobantePedido } from "@/lib/mail";
import { ETIQUETA_FRANJA } from "@/lib/tipos";
import { fecha } from "@/lib/formato";

/* Comprobante del pedido por mail — mismo patrón que /api/pedidos/[id]/enrutar:
   una ruta aparte porque mandar mail necesita un secreto de servidor
   (la API key de Resend), y el navegador nunca puede tocar eso
   directo. El pedido ya está guardado en la base ANTES de llegar acá;
   si esto falla, no se pierde nada — sólo queda sin comprobante. */

export const runtime = "nodejs";
export const maxDuration = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  /* RLS ("el cliente ve sus propios servicios") ya garantiza que esta
     consulta sólo trae un pedido propio — mismo criterio que la ruta
     de enrutar. */
  const { data: servicio, error: errServicio } = await supabase
    .from("servicios")
    .select("id, numero_orden, propiedad_id, categoria_slug, fecha_preferida, franja_preferida, cliente_id")
    .eq("id", id)
    .maybeSingle();

  if (errServicio || !servicio) {
    return NextResponse.json({ error: "No encontramos ese pedido." }, { status: 404 });
  }

  const [{ data: propiedad }, { data: categoria }, { data: perfil }] = await Promise.all([
    supabase
      .from("propiedades")
      .select("nombre, calle, numero, localidad, provincia")
      .eq("id", servicio.propiedad_id)
      .maybeSingle(),
    supabase.from("categorias").select("nombre").eq("slug", servicio.categoria_slug).maybeSingle(),
    supabase.from("perfiles").select("nombre, mail_contacto").eq("id", servicio.cliente_id).maybeSingle(),
  ]);

  // Sin mail de contacto cargado no hay nada que mandar — no es un error.
  const mailDestino = perfil?.mail_contacto?.trim();
  if (!mailDestino) {
    return NextResponse.json({ ok: true, enviado: false });
  }

  const domicilio = propiedad
    ? `${propiedad.nombre} · ${[propiedad.calle, propiedad.numero].filter(Boolean).join(" ")}, ${propiedad.localidad}`
    : "—";

  try {
    await enviarComprobantePedido(mailDestino, {
      numeroOrden: servicio.numero_orden,
      categoriaNombre: categoria?.nombre ?? servicio.categoria_slug,
      domicilio,
      diaTexto: servicio.fecha_preferida ? fecha(servicio.fecha_preferida) : "A coordinar",
      franjaTexto: servicio.franja_preferida
        ? (ETIQUETA_FRANJA[servicio.franja_preferida] ?? servicio.franja_preferida)
        : "A coordinar",
      nombreCliente: perfil?.nombre ?? "",
    });
  } catch (e) {
    console.error("[api/pedidos/mail]", e);
    return NextResponse.json({ ok: false, enviado: false });
  }

  return NextResponse.json({ ok: true, enviado: true });
}
