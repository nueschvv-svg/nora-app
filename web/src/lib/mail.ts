import "server-only";

import { Resend } from "resend";

/* ============================================================
   COMPROBANTE DE PEDIDO POR MAIL

   Sin cuentas, el mail de auth.users de una sesión anónima está
   vacío — esto manda a un mail de CONTACTO que la persona carga a
   mano en el último paso de /pedir (ver lib/perfil.ts,
   perfiles.mail_contacto). Es opcional: si no lo cargó, no hay nada
   que mandar, y eso no es un error.

   Mismo criterio que enrutarPedido: esto corre DESPUÉS de que el
   pedido ya está guardado. Si falla, el pedido no se pierde — sólo
   queda sin comprobante. Nunca debe poder tumbar el flujo de pedir.
   ============================================================ */

const REMITENTE = process.env.RESEND_FROM_EMAIL ?? "Nora <onboarding@resend.dev>";

export type DatosComprobante = {
  numeroOrden: number;
  categoriaNombre: string;
  domicilio: string;
  diaTexto: string;
  franjaTexto: string;
  nombreCliente: string;
};

/** Nunca confiar en texto que vino de un formulario para meterlo
 *  directo en HTML — nombre, domicilio y categoría pasan por acá
 *  antes de entrar al cuerpo del mail. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function enviarComprobantePedido(mailDestino: string, datos: DatosComprobante): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[mail] falta RESEND_API_KEY — no se manda el comprobante (no bloquea el pedido).");
    return;
  }

  const resend = new Resend(apiKey);
  const nombre = escaparHtml(datos.nombreCliente);
  const categoria = escaparHtml(datos.categoriaNombre);
  const domicilio = escaparHtml(datos.domicilio);
  const dia = escaparHtml(datos.diaTexto);
  const franja = escaparHtml(datos.franjaTexto);

  const { error } = await resend.emails.send({
    from: REMITENTE,
    to: mailDestino,
    subject: `Pedido #${datos.numeroOrden} recibido — ${datos.categoriaNombre}`,
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #16211f;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">¡Hola${nombre ? `, ${nombre}` : ""}!</h1>
        <p style="font-size: 14px; line-height: 1.5;">
          Ya estamos viendo tu pedido de <strong>${categoria}</strong>. Este es tu comprobante — guardalo como referencia.
        </p>
        <div style="background: #f2f0ea; border-radius: 16px; padding: 20px; margin: 20px 0;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #5b6b68; margin: 0;">
            Número de orden
          </p>
          <p style="font-size: 32px; font-weight: bold; margin: 4px 0 16px; color: #0e5c54;">
            #${datos.numeroOrden}
          </p>
          <p style="font-size: 13px; margin: 0 0 4px; color: #5b6b68;">¿A qué hora vamos a venir?</p>
          <p style="font-size: 14px; font-weight: 600; margin: 0 0 12px;">${dia} · ${franja}</p>
          <p style="font-size: 13px; margin: 0 0 4px; color: #5b6b68;">A dónde vamos</p>
          <p style="font-size: 14px; font-weight: 600; margin: 0;">${domicilio}</p>
        </div>
        <p style="font-size: 12.5px; color: #5b6b68; line-height: 1.5;">
          Ante cualquier consulta con soporte, este número de orden es tu referencia.
          ENJINIA gestiona tu pedido y te confirma la atención y el precio antes de comenzar el trabajo.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message ?? "Resend no pudo mandar el mail.");
  }
}
