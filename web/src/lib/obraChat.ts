/* ============================================================
   CHAT DE LA OBRA — dueño y colaboradores (arquitecta, socios).

   Mismo patrón que lib/chat.ts (el chat de un servicio), archivo
   aparte porque son tablas y permisos distintos — ver
   db/29_obras_colaboracion.sql. <HiloChat/> es el mismo componente
   para las dos puntas: recibe estas funciones por props.
   ============================================================ */

import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { supabaseNavegador } from "./supabase/cliente";

function fallar(contexto: string, error: { message: string }): never {
  console.error(`[obraChat] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

export type MensajeObra = {
  id: string;
  obraId: string;
  autorId: string;
  cuerpo: string;
  creadoEl: string;
};

type FilaMensaje = {
  id: string;
  obra_id: string;
  autor_id: string;
  cuerpo: string;
  creado_el: string;
};

function aMensaje(f: FilaMensaje): MensajeObra {
  return { id: f.id, obraId: f.obra_id, autorId: f.autor_id, cuerpo: f.cuerpo, creadoEl: f.creado_el };
}

export async function listarMensajesObra(obraId: string): Promise<MensajeObra[]> {
  const { data, error } = await supabaseNavegador()
    .from("obra_mensajes")
    .select("id, obra_id, autor_id, cuerpo, creado_el")
    .eq("obra_id", obraId)
    .order("creado_el");

  if (error) fallar("cargar el chat", error);
  return ((data ?? []) as FilaMensaje[]).map(aMensaje);
}

export async function enviarMensajeObra(obraId: string, cuerpo: string): Promise<void> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { error } = await supabase
    .from("obra_mensajes")
    .insert({ obra_id: obraId, autor_id: user.id, cuerpo: cuerpo.trim() });
  if (error) fallar("mandar el mensaje", error);
}

/** Devuelve una función para cancelar la suscripción. */
export function suscribirseAMensajesObra(obraId: string, alLlegarMensaje: (m: MensajeObra) => void): () => void {
  const supabase = supabaseNavegador();
  const canal = supabase
    .channel(`mensajes-obra-${obraId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "obra_mensajes", filter: `obra_id=eq.${obraId}` },
      (payload: RealtimePostgresInsertPayload<FilaMensaje>) => alLlegarMensaje(aMensaje(payload.new)),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
