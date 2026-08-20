import "server-only";

import type { EstrategiaEnrutamiento } from "./tipos";
import { estrategiaTelegram } from "./telegram";

export type { EstrategiaEnrutamiento, PedidoParaEnrutar, ResultadoEnrutamiento } from "./tipos";

/* El registro de destinos posibles. Agregar uno nuevo es escribir el
   archivo (misma interfaz que telegram.ts) y sumarlo acá — nada más
   de este archivo cambia. */
const ESTRATEGIAS: Record<string, EstrategiaEnrutamiento> = {
  telegram: estrategiaTelegram,
};

const ESTRATEGIA_DEFAULT = "telegram";

/** Cuál está activa hoy. Se cambia con una variable de entorno, no
 *  con un despliegue de código nuevo. */
export function obtenerEstrategiaActiva(): EstrategiaEnrutamiento {
  const nombre = process.env.ESTRATEGIA_ENRUTAMIENTO?.trim() || ESTRATEGIA_DEFAULT;
  const estrategia = ESTRATEGIAS[nombre];
  if (!estrategia) {
    throw new Error(
      `ESTRATEGIA_ENRUTAMIENTO="${nombre}" no existe. Opciones: ${Object.keys(ESTRATEGIAS).join(", ")}.`,
    );
  }
  return estrategia;
}
