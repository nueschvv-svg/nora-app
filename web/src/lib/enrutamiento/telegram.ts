import "server-only";

import type { EstrategiaEnrutamiento, PedidoParaEnrutar, ResultadoEnrutamiento } from "./tipos";

/* Avisa por Telegram al grupo de Enjinia. Server-only: el token del
   bot es un secreto, igual que la clave de Anthropic en
   lib/diagnostico.ts — no puede llegar al navegador. */

const FRANJA_TEXTO: Record<string, string> = {
  manana: "Mañana (8 a 12 h)",
  "tarde-1": "Tarde (13 a 17 h)",
  "tarde-2": "Tarde (17 a 20 h)",
  urgente: "Lo antes posible",
};

function armarMensaje(pedido: PedidoParaEnrutar): string {
  const lineas: string[] = [];

  lineas.push(`🔧 NUEVO PEDIDO — ${pedido.categoriaNombre}`);

  if (pedido.diagnostico?.riesgoInmediato) {
    lineas.push("⚠️ RIESGO INMEDIATO — atención prioritaria");
  }

  lineas.push("");
  lineas.push(`Problema:\n${pedido.descripcion}`);

  if (pedido.estimado) {
    lineas.push("");
    lineas.push(`Estimado: ${pedido.estimado.titulo}`);
    lineas.push(pedido.estimado.aclaracion);
  }

  lineas.push("");
  lineas.push(`Cliente: ${pedido.cliente.nombre}`);
  lineas.push(`Teléfono: ${pedido.cliente.telefono ?? "no cargado"}`);

  const direccion = [pedido.propiedad.direccion, pedido.propiedad.localidad, pedido.propiedad.provincia]
    .filter(Boolean)
    .join(", ");
  lineas.push(`Dirección: ${direccion}`);
  if (pedido.propiedad.notasAcceso) {
    lineas.push(`Notas de acceso: ${pedido.propiedad.notasAcceso}`);
  }

  const franja = pedido.franjaPreferida ? (FRANJA_TEXTO[pedido.franjaPreferida] ?? pedido.franjaPreferida) : null;
  if (pedido.fechaPreferida || franja) {
    lineas.push("");
    lineas.push(`Prefiere: ${[pedido.fechaPreferida, franja].filter(Boolean).join(" · ")}`);
  }

  lineas.push("");
  lineas.push(`ID interno: ${pedido.servicioId}`);

  return lineas.join("\n");
}

/* Un solo reintento inmediato. Si Telegram está caído más que eso, no
   tiene sentido seguir insistiendo desde acá — para eso está la fila
   en servicio_enrutamientos que deja armar el reintento manual. */
async function enviarConReintento(
  hacerPedido: () => Promise<Response>,
): Promise<{ ok: boolean; detalle: string; intentos: number }> {
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const r = await hacerPedido();
      if (r.ok) return { ok: true, detalle: `Telegram respondió ${r.status}`, intentos: intento };
      const cuerpo = await r.text().catch(() => "");
      if (intento === 2) return { ok: false, detalle: `Telegram respondió ${r.status}: ${cuerpo}`, intentos: intento };
    } catch (e) {
      if (intento === 2) {
        const mensaje = e instanceof Error ? e.message : "error de red desconocido";
        return { ok: false, detalle: mensaje, intentos: intento };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  // Inalcanzable — el for siempre retorna en intento === 2 — pero TypeScript no lo sabe.
  return { ok: false, detalle: "no se pudo enviar", intentos: 2 };
}

export const estrategiaTelegram: EstrategiaEnrutamiento = {
  nombre: "telegram",

  async enrutar(pedido: PedidoParaEnrutar): Promise<ResultadoEnrutamiento> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return {
        ok: false,
        detalle: "Falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en el entorno del servidor.",
      };
    }

    const mensaje = armarMensaje(pedido);
    const base = `https://api.telegram.org/bot${token}`;

    const resultado = await enviarConReintento(async () => {
      if (pedido.fotoUrl) {
        return fetch(`${base}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, photo: pedido.fotoUrl, caption: mensaje }),
        });
      }
      return fetch(`${base}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: mensaje }),
      });
    });

    return { ok: resultado.ok, detalle: resultado.detalle, intentos: resultado.intentos };
  },
};
