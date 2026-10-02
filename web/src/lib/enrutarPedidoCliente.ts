/** Comprueba que el pedido guardado tiene aviso en cola. La entrega y
 * los reintentos pertenecen al servidor, aunque se cierre esta pestaña. */
export async function enrutarPedido(servicioId: string): Promise<void> {
  const r = await fetch(`/api/pedidos/${servicioId}/enrutar`, {
    signal: AbortSignal.timeout(5000), method: "POST",
  });
  const datos = await r.json().catch(() => null);
  if (!r.ok || datos?.ok !== true) {
    throw new Error((datos && typeof datos.error === "string" && datos.error) || "No pudimos confirmar el aviso del pedido.");
  }
}
