import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import {
  diagnosticar,
  esTipoImagenValido,
  detectarTipoImagen,
  MAX_BYTES_IMAGEN,
  type TipoImagen,
} from "@/lib/diagnostico";
import {
  calcularEstimado,
  calcularVisita,
  esFueraDeHorario,
  textoEstimado,
  textoVisita,
  type Tarifa,
  type Trabajo,
} from "@/lib/precios";

/* Diagnóstico por foto.

   Esta ruta existe por una razón concreta: la clave de Anthropic no puede
   estar en el navegador. Si estuviera, cualquiera la saca del código de la
   app y gasta el saldo de la cuenta. Acá la clave vive en el servidor y el
   navegador sólo manda la foto.

   Tres puertas antes de gastar un centavo:
     1. ¿Hay sesión? Sin cuenta, no se diagnostica.
     2. ¿La imagen es de un tipo y tamaño razonable?
     3. ¿Esta persona no está pidiendo más de la cuenta? */

export const runtime = "nodejs";
export const maxDuration = 60;

/* Límite por persona. En memoria: se pierde al reiniciar y no se comparte
   entre instancias — alcanza para frenar un descuido, no un ataque. Antes
   de abrir al público hay que moverlo a la base o a un servicio dedicado.

   Se cuenta sólo lo que llega a costar plata, es decir las llamadas al
   modelo. Un pedido mal formado (foto gigante, archivo que no es imagen)
   se rechaza antes y no gasta cupo: la primera versión lo descontaba
   igual, así que tres intentos fallidos con una foto pesada te dejaban
   sin diagnósticos sin haber diagnosticado nada. */
const LIMITE_POR_HORA = 10;
const UNA_HORA = 3_600_000;
const usos = new Map<string, number[]>();

function estaEnElLimite(usuarioId: string): boolean {
  const ahora = Date.now();
  const recientes = (usos.get(usuarioId) ?? []).filter((t) => ahora - t < UNA_HORA);
  usos.set(usuarioId, recientes);
  return recientes.length >= LIMITE_POR_HORA;
}

/** Sin cotización mostramos sólo pesos — no es motivo para romper el estimado. */
async function obtenerDolar(request: NextRequest): Promise<number | null> {
  try {
    const r = await fetch(new URL("/api/dolar", request.url));
    if (!r.ok) return null;
    return ((await r.json()) as { venta: number }).venta ?? null;
  } catch {
    return null;
  }
}

function registrarUso(usuarioId: string): void {
  usos.set(usuarioId, [...(usos.get(usuarioId) ?? []), Date.now()]);
}

export async function POST(request: NextRequest) {
  // --- Puerta 1: sesión ---
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }

  // --- Puerta 2: límite de uso (sólo se consulta; se descuenta más abajo) ---
  if (estaEnElLimite(user.id)) {
    return NextResponse.json(
      { error: "Muchos diagnósticos seguidos. Probá de nuevo en un rato." },
      { status: 429 },
    );
  }

  // --- Puerta 3: la entrada ---
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el pedido." }, { status: 400 });
  }

  const descripcion = String(form.get("descripcion") ?? "").trim();
  const categoriaSlug = form.get("categoria") ? String(form.get("categoria")) : undefined;
  const archivo = form.get("foto");

  if (descripcion.length < 5 && !(archivo instanceof File)) {
    return NextResponse.json(
      { error: "Contanos qué pasa o mandanos una foto." },
      { status: 400 },
    );
  }

  let imagen: { base64: string; tipo: TipoImagen } | undefined;

  if (archivo instanceof File) {
    /* El tamaño se mira primero: no tiene sentido cargar 40 MB en memoria
       para después descubrir que no eran una foto. */
    if (archivo.size > MAX_BYTES_IMAGEN) {
      return NextResponse.json(
        { error: "La foto pesa demasiado. Probá con una de menos de 5 MB." },
        { status: 400 },
      );
    }
    if (!esTipoImagenValido(archivo.type)) {
      return NextResponse.json(
        { error: "Esa foto tiene que ser JPG, PNG o WEBP." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await archivo.arrayBuffer());

    /* Y ahora el tipo REAL, leyendo los primeros bytes. Lo que declara el
       navegador sale de la extensión del archivo y miente seguido: un PNG
       renombrado a .jpg llega anunciado como JPEG. */
    const tipoReal = detectarTipoImagen(bytes);
    if (!tipoReal) {
      return NextResponse.json(
        { error: "Ese archivo no parece una imagen. Mandá una foto en JPG, PNG o WEBP." },
        { status: 400 },
      );
    }

    imagen = { base64: bytes.toString("base64"), tipo: tipoReal };
  }

  /* Catálogo y tarifas se leen con la sesión de quien pide: ambos son
     públicos, pero mantenemos el mismo camino de permisos que el resto. */
  const [{ data: filasCatalogo }, { data: filasTarifas }] = await Promise.all([
    supabase
      .from("catalogo_trabajos")
      .select(
        "slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia, horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas",
      ),
    supabase
      .from("tarifas")
      .select("categoria_slug, visita_ars, visita_max_ars, hora_ars, hora_max_ars, recargo_urgencia")
      .order("vigente_desde", { ascending: false }),
  ]);

  const catalogo: Trabajo[] = (filasCatalogo ?? []).map((f) => ({
    slug: f.slug,
    categoriaSlug: f.categoria_slug,
    nombre: f.nombre,
    sintomas: f.sintomas ?? [],
    diagnostico: f.diagnostico,
    riesgoSiEspera: f.riesgo_si_espera,
    urgencia: f.urgencia,
    horasMin: Number(f.horas_min),
    horasMax: Number(f.horas_max),
    materialesMin: Number(f.materiales_min),
    materialesMax: Number(f.materiales_max),
    requiereMatricula: f.requiere_matricula,
    preguntas: f.preguntas ?? [],
  }));

  const tarifas = new Map<string, Tarifa>();
  for (const f of filasTarifas ?? []) {
    if (tarifas.has(f.categoria_slug)) continue;
    tarifas.set(f.categoria_slug, {
      categoriaSlug: f.categoria_slug,
      visitaArs: Number(f.visita_ars),
      visitaMaxArs: f.visita_max_ars == null ? null : Number(f.visita_max_ars),
      horaArs: f.hora_ars == null ? null : Number(f.hora_ars),
      horaMaxArs: f.hora_max_ars == null ? null : Number(f.hora_max_ars),
      recargoUrgencia: Number(f.recargo_urgencia ?? 0.4),
    });
  }

  // --- El diagnóstico ---
  // El cupo se descuenta acá: es la línea a partir de la cual cuesta plata.
  registrarUso(user.id);

  let resultado;
  try {
    resultado = await diagnosticar({ descripcion, imagen, categoriaSlug }, catalogo);
  } catch (e) {
    console.error("[api/diagnosticar]", e);
    return NextResponse.json(
      { error: "No pudimos analizar el problema ahora. Probá de nuevo en un momento." },
      { status: 502 },
    );
  }

  const trabajo = resultado.slug ? catalogo.find((t) => t.slug === resultado.slug) : undefined;

  /* Sin trabajo identificado no hay un precio cerrado por rubro — pero
     eso no significa mostrar la pantalla vacía. Si conocemos la
     categoría y tenemos tarifa cargada, el cliente igual se merece un
     número: cuánto sale, como mínimo, que el técnico vaya a verlo.
     Antes de esto, cualquier descripción que el modelo no pudiera
     clasificar (foto ambigua, texto raro, o categorías que todavía no
     tenían catálogo de IA) se iba sin ningún estimado — bug real,
     encontrado en vivo más de una vez. */
  if (!trabajo) {
    const tarifaCategoria = categoriaSlug ? tarifas.get(categoriaSlug) : undefined;
    const estimadoVisita = tarifaCategoria
      ? calcularVisita(tarifaCategoria, { fueraDeHorario: esFueraDeHorario(), dolar: await obtenerDolar(request) })
      : null;

    return NextResponse.json({
      identificado: false,
      observaciones: resultado.observaciones,
      preguntas: resultado.preguntas,
      riesgoInmediato: resultado.riesgoInmediato,
      estimado: estimadoVisita
        ? {
            ...textoVisita(estimadoVisita),
            desdeArs: estimadoVisita.desdeArs,
            hastaArs: estimadoVisita.hastaArs,
            rangoUtil: true,
            detalle: [],
            conRecargo: estimadoVisita.conRecargo,
          }
        : null,
    });
  }

  /* El precio se calcula ACÁ, con las tarifas de la base. El modelo no
     participó de este número: sólo dijo de qué trabajo se trata. */
  const tarifa = tarifas.get(trabajo.categoriaSlug);
  const dolar = await obtenerDolar(request);

  const estimado = tarifa
    ? calcularEstimado(trabajo, tarifa, {
        confianza: resultado.confianza,
        fueraDeHorario: esFueraDeHorario(),
        dolar,
      })
    : null;

  return NextResponse.json({
    identificado: true,
    confianza: resultado.confianza,
    observaciones: resultado.observaciones,
    preguntas: resultado.preguntas.length ? resultado.preguntas : trabajo.preguntas,
    riesgoInmediato: resultado.riesgoInmediato,
    trabajo: {
      slug: trabajo.slug,
      nombre: trabajo.nombre,
      categoriaSlug: trabajo.categoriaSlug,
      diagnostico: trabajo.diagnostico,
      riesgoSiEspera: trabajo.riesgoSiEspera,
      urgencia: trabajo.urgencia,
      requiereMatricula: trabajo.requiereMatricula,
    },
    estimado: estimado
      ? {
          ...textoEstimado(estimado),
          desdeArs: estimado.desdeArs,
          hastaArs: estimado.hastaArs,
          rangoUtil: estimado.rangoUtil,
          detalle: estimado.detalle,
          conRecargo: estimado.conRecargo,
        }
      : null,
  });
}
