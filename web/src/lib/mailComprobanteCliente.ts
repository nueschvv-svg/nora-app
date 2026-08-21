/* Cliente para pedir el comprobante por mail de un pedido — ver
   lib/mail.ts (servidor) y app/api/pedidos/[id]/mail/route.ts.

   No bloquea nada si falla: el pedido ya se guardó antes de llamar
   acá (ver pedir/page.tsx). Si la persona no cargó mail de contacto,
   la ruta responde ok igual — no hay nada que mandar, y eso no es un
   error que valga la pena mostrar. */

export async function mandarComprobantePorMail(servicioId: string): Promise<void> {
  const r = await fetch(`/api/pedidos/${servicioId}/mail`, { method: "POST" });
  if (!r.ok) {
    const datos = await r.json().catch(() => null);
    throw new Error(
      (datos && typeof datos.error === "string" && datos.error) || "No pudimos mandar el comprobante.",
    );
  }
}
