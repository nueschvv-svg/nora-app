import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { chatearConNora, type TurnoChat } from "@/lib/chatNora";

/* Chat conversacional de Inicio. Misma razón de ser que /api/diagnosticar:
   la clave de Anthropic no puede llegar al navegador, así que la charla
   pasa por acá — el cliente sólo manda el historial de la conversación. */

export const runtime = "nodejs";
export const maxDuration = 30;

const LIMITE_POR_HORA = 30;
const UNA_HORA = 3_600_000;
const usos = new Map<string, number[]>();

function estaEnElLimite(usuarioId: string): boolean {
  const ahora = Date.now();
  const recientes = (usos.get(usuarioId) ?? []).filter((t) => ahora - t < UNA_HORA);
  usos.set(usuarioId, recientes);
  return recientes.length >= LIMITE_POR_HORA;
}

function registrarUso(usuarioId: string): void {
  usos.set(usuarioId, [...(usos.get(usuarioId) ?? []), Date.now()]);
}

/* El historial viaja completo en cada request (la API no guarda estado) —
   se valida forma y se acota longitud, tanto por mensaje como en total,
   antes de que le llegue un solo byte al modelo. */
function validarHistorial(valor: unknown): TurnoChat[] | null {
  if (!Array.isArray(valor)) return null;

  const limpio: TurnoChat[] = [];
  for (const item of valor) {
    if (typeof item !== "object" || item === null) continue;
    const { rol, texto } = item as Record<string, unknown>;
    if (rol !== "cliente" && rol !== "nora") continue;
    if (typeof texto !== "string") continue;
    const textoLimpio = texto.trim().slice(0, 2000);
    if (textoLimpio) limpio.push({ rol, texto: textoLimpio });
  }

  return limpio.slice(-20);
}

export async function POST(request: NextRequest) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }

  if (estaEnElLimite(user.id)) {
    return NextResponse.json(
      { error: "Muchos mensajes seguidos. Probá de nuevo en un rato." },
      { status: 429 },
    );
  }

  let cuerpo: { historial?: unknown };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el mensaje." }, { status: 400 });
  }

  const historial = validarHistorial(cuerpo.historial);
  if (!historial || historial.length === 0) {
    return NextResponse.json({ error: "Falta el mensaje." }, { status: 400 });
  }

  const { data: filasCategorias, error: errorCategorias } = await supabase
    .from("categorias")
    .select("slug, nombre")
    .eq("activa", true)
    .order("orden");

  if (errorCategorias) {
    return NextResponse.json({ error: "No pudimos cargar los rubros." }, { status: 502 });
  }

  registrarUso(user.id);

  try {
    const resultado = await chatearConNora(historial, filasCategorias ?? []);
    return NextResponse.json(resultado);
  } catch (e) {
    console.error("[api/chat]", e);
    return NextResponse.json(
      { error: "No pudimos responder ahora. Probá de nuevo en un momento." },
      { status: 502 },
    );
  }
}
