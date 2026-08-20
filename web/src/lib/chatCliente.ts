/* Cliente del chat conversacional de Nora, desde el navegador.
   Envuelve /api/chat (ver esa ruta y lib/chatNora.ts para la charla en sí). */

export type TurnoChat = { rol: "cliente" | "nora"; texto: string };

export type RespuestaChatNora = {
  respuesta: string;
  listo: boolean;
  categoriaSlug: string | null;
  resumen: string;
};

export async function chatearConNora(historial: TurnoChat[]): Promise<RespuestaChatNora> {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ historial }),
  });
  const datos = await r.json().catch(() => null);

  if (!r.ok) {
    throw new Error(
      (datos && typeof datos.error === "string" && datos.error) ||
        "No pudimos responder ahora. Probá de nuevo en un momento.",
    );
  }

  return datos as RespuestaChatNora;
}
