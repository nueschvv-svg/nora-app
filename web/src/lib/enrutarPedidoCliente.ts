/* Cliente para avisar que un pedido ya está listo para que alguien lo
   vea — hoy Telegram, mañana quizás matching automático (ver
   lib/enrutamiento/index.ts, del lado del servidor).

   No bloquea nada si falla: el pedido ya se guardó antes de llamar
   acá (ver pedir/page.tsx). Un fallo de este lado no es culpa de
   quien está pidiendo el servicio. */

import type { ResultadoDiagnostico } from "./diagnosticarCliente";

export async function enrutarPedido(
  servicioId: string,
  diagnostico?: ResultadoDiagnostico | null,
): Promise<void> {
  const r = await fetch(`/api/pedidos/${servicioId}/enrutar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // El riesgo inmediato importa tanto o más cuando Nora NO pudo
      // identificar el trabajo con precisión — por eso esto va sin
      // condicionar a `identificado`, a diferencia de `estimado` más
      // abajo (que sólo existe cuando sí lo identificó).
      diagnostico: diagnostico
        ? {
            observaciones: diagnostico.observaciones,
            riesgoInmediato: diagnostico.riesgoInmediato,
            confianza: diagnostico.confianza,
          }
        : undefined,
      estimado: diagnostico?.estimado
        ? { titulo: diagnostico.estimado.titulo, aclaracion: diagnostico.estimado.aclaracion }
        : null,
    }),
  });

  if (!r.ok) {
    const datos = await r.json().catch(() => null);
    throw new Error((datos && typeof datos.error === "string" && datos.error) || "No pudimos avisar del pedido.");
  }
}
