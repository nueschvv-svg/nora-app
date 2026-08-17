/* ============================================================
   NOTIFICACIONES — bandeja de la campanita.

   Sólo las de tipo "servicio" (progreso de un pedido) viven en la
   base — las llena sola un trigger en cada avance real (ver
   db/28_notificaciones.sql). Los recordatorios de mantenimiento
   ("se te vence el termotanque") NO están acá: se calculan al vuelo
   en HojaNotificaciones.tsx a partir de equiposDe(), que ya sabe
   distinguir vencido/por_vencer (lib/score.ts). Son 100% derivables
   de datos que ya existen, así que guardarlos sería una segunda
   fuente de verdad que se puede desincronizar de la primera.
   ============================================================ */

import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { supabaseNavegador } from "./supabase/cliente";

function fallar(contexto: string, error: { message: string }): never {
  console.error(`[notificaciones] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

export type Notificacion = {
  id: string;
  titulo: string;
  cuerpo: string;
  servicioId: string | null;
  leida: boolean;
  creadoEl: string;
};

type FilaNotificacion = {
  id: string;
  titulo: string;
  cuerpo: string;
  servicio_id: string | null;
  leida: boolean;
  creado_el: string;
};

function aNotificacion(f: FilaNotificacion): Notificacion {
  return {
    id: f.id,
    titulo: f.titulo,
    cuerpo: f.cuerpo,
    servicioId: f.servicio_id,
    leida: f.leida,
    creadoEl: f.creado_el,
  };
}

const SELECT = "id, titulo, cuerpo, servicio_id, leida, creado_el";
/** Alcanza para una bandeja: esto no es un historial infinito. */
const LIMITE = 40;

export async function listarNotificaciones(): Promise<Notificacion[]> {
  const { data, error } = await supabaseNavegador()
    .from("notificaciones")
    .select(SELECT)
    .order("creado_el", { ascending: false })
    .limit(LIMITE);
  if (error) fallar("cargar tus notificaciones", error);
  return (data as FilaNotificacion[]).map(aNotificacion);
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  const { error } = await supabaseNavegador().from("notificaciones").update({ leida: true }).eq("id", id);
  if (error) fallar("marcar la notificación como leída", error);
}

export async function marcarTodasLeidas(): Promise<void> {
  const { error } = await supabaseNavegador()
    .from("notificaciones")
    .update({ leida: true })
    .eq("leida", false);
  if (error) fallar("marcar tus notificaciones como leídas", error);
}

/** Avisa en vivo cuando llega una notificación nueva, sin recargar. */
export function suscribirseANotificaciones(usuarioId: string, alLlegar: (n: Notificacion) => void): () => void {
  const supabase = supabaseNavegador();
  const canal = supabase
    .channel(`notificaciones-${usuarioId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notificaciones", filter: `usuario_id=eq.${usuarioId}` },
      (payload: RealtimePostgresInsertPayload<FilaNotificacion>) => alLlegar(aNotificacion(payload.new)),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
