import { supabaseServidor } from "@/lib/supabase/servidor";

/** Compatibilidad con el wizard: confirma que el aviso quedó en cola.
 * No envía Telegram; cerrar la pestaña no cancela el trabajo del servidor. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "Id de pedido inválido." }, { status: 400 });
  }
  const db = await supabaseServidor();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "No encontramos tu sesión." }, { status: 401 });
  const { data: servicio, error } = await db.from("servicios").select("id").eq("id", id).eq("cliente_id", user.id).maybeSingle();
  if (error || !servicio) return Response.json({ error: "No encontramos ese pedido." }, { status: 404 });
  const aviso = await db.from("servicio_avisos").select("estado").eq("servicio_id", id).maybeSingle();
  if (aviso.error || !aviso.data || aviso.data.estado === "fallido") {
    return Response.json({ ok: false, error: "El pedido está guardado, pero el aviso requiere revisión de ENJINIA." }, { status: 503 });
  }
  return Response.json({ ok: true, estado: aviso.data.estado }, { headers: { "Cache-Control": "no-store" } });
}
