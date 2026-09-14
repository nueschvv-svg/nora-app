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

  lineas.push(`🔧 NUEVO PEDIDO — ${pedido.categoriaNombre.slice(0, 80)}`);

  if (pedido.diagnostico?.riesgoInmediato) {
    lineas.push("⚠️ RIESGO INMEDIATO — atención prioritaria");
  }

  lineas.push("");
  lineas.push(`Problema:\n${pedido.descripcion.slice(0, 1200)}${pedido.descripcion.length > 1200 ? "… (ver detalle completo en operaciones)" : ""}`);

  if (pedido.estimado) {
    lineas.push("");
    lineas.push(`Estimado: ${pedido.estimado.titulo.slice(0, 200)}`);
    lineas.push(pedido.estimado.aclaracion.slice(0, 200));
  }

  lineas.push("");
  lineas.push(`Cliente: ${pedido.cliente.nombre.slice(0, 120)}`);
  lineas.push(`Teléfono: ${(pedido.cliente.telefono ?? "no cargado").slice(0, 30)}`);

  const direccion = [pedido.propiedad.direccion, pedido.propiedad.localidad, pedido.propiedad.provincia]
    .filter(Boolean)
    .join(", ");
  lineas.push(`Dirección: ${direccion.slice(0, 300)}`);
  if (pedido.propiedad.notasAcceso) {
    lineas.push(`Notas de acceso: ${pedido.propiedad.notasAcceso.slice(0, 300)}`);
  }

  const franja = pedido.franjaPreferida ? (FRANJA_TEXTO[pedido.franjaPreferida] ?? pedido.franjaPreferida) : null;
  if (pedido.fechaPreferida || franja) {
    lineas.push("");
    lineas.push(`Prefiere: ${[pedido.fechaPreferida, franja].filter(Boolean).join(" · ")}`);
  }

  lineas.push("");
  lineas.push(`ID interno: ${pedido.servicioId}`);
  lineas.push(`Ver pedido: https://nora-app-kappa.vercel.app/operaciones/${pedido.servicioId}`);

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
      if (pedido.fotoUrl && mensaje.length <= 1024) {
        return fetch(`${base}/sendPhoto`, {
          signal: AbortSignal.timeout(5000),
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, photo: pedido.fotoUrl, caption: mensaje }),
        });
      }
      return fetch(`${base}/sendMessage`, {
        signal: AbortSignal.timeout(5000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: mensaje }),
      });
    });

    if (!resultado.ok && pedido.fotoUrl && mensaje.length <= 1024) {
      // Una imagen inaccesible no debe impedir avisar a ENJINIA.
      const sinFoto = await enviarConReintento(() => fetch(`${base}/sendMessage`, {
        method: "POST", signal: AbortSignal.timeout(5000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: mensaje }),
      }));
      return { ...sinFoto, detalle: `Aviso sin foto. ${sinFoto.detalle}`, intentos: resultado.intentos + sinFoto.intentos };
    }
    if (resultado.ok && pedido.fotoUrl && mensaje.length > 1024) {
      // El texto ya llegó. Mandar la evidencia aparte con caption breve.
      try {
        const foto = await fetch(`${base}/sendPhoto`, {
          method: "POST", signal: AbortSignal.timeout(5000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, photo: pedido.fotoUrl, caption: `Foto del pedido ${pedido.servicioId}` }),
        });
        if (!foto.ok) return { ...resultado, detalle: `Aviso enviado; foto no entregada (HTTP ${foto.status}). Ver fotos en operaciones.`, intentos: resultado.intentos + 1 };
      } catch {
        return { ...resultado, detalle: "Aviso enviado; foto no confirmada. Ver fotos en operaciones.", intentos: resultado.intentos + 1 };
      }
      return { ...resultado, intentos: resultado.intentos + 1 };
    }
    return { ok: resultado.ok, detalle: resultado.detalle, intentos: resultado.intentos };
  },
};
