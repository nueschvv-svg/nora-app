/* ============================================================
   CHAT DEL SERVICIO — cliente y técnico, acotado a un pedido.

   Compartido entre las dos puntas: mismas funciones para
   HojaServicio.tsx (cliente) y tecnico/[id]/page.tsx (técnico), ambos
   a través de <HiloChat/>. La base decide quién puede leer o escribir
   (db/12_tecnico_en_terreno.sql) — acá no hace falta repetirlo.
   ============================================================ */

import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { supabaseNavegador } from "./supabase/cliente";

function fallar(contexto: string, error: { message: string }): never {
  console.error(`[chat] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

export type MensajeServicio = {
  id: string;
  servicioId: string;
  autorId: string;
  cuerpo: string;
  creadoEl: string;
};

type FilaMensaje = {
  id: string;
  servicio_id: string;
  autor_id: string;
  cuerpo: string;
  creado_el: string;
};

function aMensaje(f: FilaMensaje): MensajeServicio {
  return { id: f.id, servicioId: f.servicio_id, autorId: f.autor_id, cuerpo: f.cuerpo, creadoEl: f.creado_el };
}

export async function listarMensajesServicio(servicioId: string): Promise<MensajeServicio[]> {
  const { data, error } = await supabaseNavegador()
    .from("servicio_mensajes")
    .select("id, servicio_id, autor_id, cuerpo, creado_el")
    .eq("servicio_id", servicioId)
    .order("creado_el");

  if (error) fallar("cargar el chat", error);
  return ((data ?? []) as FilaMensaje[]).map(aMensaje);
}

export async function enviarMensajeServicio(servicioId: string, cuerpo: string): Promise<void> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { error } = await supabase
    .from("servicio_mensajes")
    .insert({ servicio_id: servicioId, autor_id: user.id, cuerpo: cuerpo.trim() });
  if (error) fallar("mandar el mensaje", error);
}

/** Devuelve una función para cancelar la suscripción. */
export function suscribirseAMensajesServicio(
  servicioId: string,
  alLlegarMensaje: (m: MensajeServicio) => void,
): () => void {
  const supabase = supabaseNavegador();
  const canal = supabase
    .channel(`mensajes-servicio-${servicioId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "servicio_mensajes", filter: `servicio_id=eq.${servicioId}` },
      (payload: RealtimePostgresInsertPayload<FilaMensaje>) => alLlegarMensaje(aMensaje(payload.new)),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
