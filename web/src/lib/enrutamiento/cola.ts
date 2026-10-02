import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cargarPedido } from "./cargarPedido";
import { estrategiaTelegram } from "./telegram";

export async function procesarUnAviso(): Promise<"vacio" | "enviado" | "pendiente" | "lease_perdido"> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("tomar_aviso_telegram");
  if (error) throw new Error("No se pudo tomar un aviso de la cola.");
  const aviso = data?.[0];
  if (!aviso) return "vacio";
  let resultado;
  try {
    const pedido = await cargarPedido(db, aviso.servicio_id);
    resultado = await estrategiaTelegram.enrutar(pedido);
  } catch {
    // Excepciones de fetch pueden contener URLs con token: nunca persistirlas.
    resultado = { ok: false, detalle: "No se pudo completar el aviso. Se reintentará desde el servidor." };
  }
  const registro = await db.rpc("finalizar_aviso_telegram", {
    p_servicio_id: aviso.servicio_id, p_token: aviso.token,
    p_ok: resultado.ok, p_detalle: resultado.detalle ?? (resultado.ok ? "Telegram confirmó el aviso." : "Telegram no confirmó el aviso."),
  });
  if (registro.error) throw new Error("No se pudo registrar el resultado. El aviso conserva su reserva temporal.");
  if (!registro.data) return "lease_perdido";
  return resultado.ok ? "enviado" : "pendiente";
}
