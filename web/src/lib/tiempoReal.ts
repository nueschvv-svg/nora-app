/* ============================================================
   TIEMPO REAL — cambios en vivo de un servicio.

   Sólo lo usa el lado cliente (HojaServicio.tsx): quiere ver, sin
   recargar, cuándo el técnico avanza el estado o comparte su
   ubicación. El técnico no lo necesita — es quien escribe los cambios,
   su propia pantalla se actualiza apenas la acción que hizo vuelve con
   éxito, no hace falta que se entere de sí mismo por Realtime.
   ============================================================ */

import type { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";
import { supabaseNavegador } from "./supabase/cliente";

/** Fila cruda de `servicios` tal como llega del payload de Realtime
 *  (snake_case, sin mapear) — quien se suscribe lee sólo los campos
 *  que le interesan. */
export type FilaServicioEnVivo = Record<string, unknown>;

/** Devuelve una función para cancelar la suscripción. */
export function suscribirseAServicio(
  servicioId: string,
  alCambio: (fila: FilaServicioEnVivo) => void,
): () => void {
  const supabase = supabaseNavegador();
  const canal = supabase
    .channel(`servicio-${servicioId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "servicios", filter: `id=eq.${servicioId}` },
      (payload: RealtimePostgresUpdatePayload<FilaServicioEnVivo>) => alCambio(payload.new),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
