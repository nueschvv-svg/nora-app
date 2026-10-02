import { supabaseNavegador } from "./supabase/cliente";

export type AvisoPendiente = {
  servicio_id: string; estado: string; intentos: number; detalle: string | null;
  proximo_intento_el: string | null; creado_el: string;
};

export async function listarAvisosPendientes(): Promise<AvisoPendiente[]> {
  const db = supabaseNavegador();
  const avisos: AvisoPendiente[] = [];
  // Filtrar ANTES de paginar: los enviados no pueden ocultar fallos antiguos.
  // PostgREST limita las respuestas; recorrer páginas pequeñas explícitas.
  for (let desde = 0; ; desde += 100) {
    const { data, error } = await db.rpc("listar_avisos_pendientes").range(desde, desde + 99);
    if (error) throw new Error("No pudimos cargar los avisos. Verificá que la migración de la cola esté instalada.");
    const pagina = (data ?? []) as AvisoPendiente[];
    avisos.push(...pagina);
    if (pagina.length < 100) return avisos;
  }
}

export async function reintentarAviso(id: string): Promise<void> {
  const { data, error } = await supabaseNavegador().rpc("reintentar_aviso_telegram", { p_servicio_id: id });
  if (error) throw new Error("No pudimos programar el reintento. Sólo operaciones puede hacerlo.");
  if (!data) throw new Error("El aviso ya fue enviado o está en proceso. Actualizá la lista.");
}
