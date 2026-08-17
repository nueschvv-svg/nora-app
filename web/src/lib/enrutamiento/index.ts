import "server-only";

import type { EstrategiaEnrutamiento } from "./tipos";
import { estrategiaTelegram } from "./telegram";

export type { EstrategiaEnrutamiento, PedidoParaEnrutar, ResultadoEnrutamiento } from "./tipos";

/* El registro de destinos posibles. Agregar uno nuevo es escribir el
   archivo (misma interfaz que telegram.ts) y sumarlo acá — nada más
   de este archivo cambia.

   Cuando haya masa crítica de técnicos registrados (ver
   lib/trabajadores.ts y db/07_trabajadores.sql), el destino
   "matching" llamaría a buscarTrabajadoresCercanos() con la
   ubicación de la propiedad en vez de avisar por Telegram. Hoy no
   existe: activarlo sin técnicos reales no serviría de nada, y no es
   lo que se pidió en esta iteración. */
const ESTRATEGIAS: Record<string, EstrategiaEnrutamiento> = {
  telegram: estrategiaTelegram,
  // matching: estrategiaMatchingCercania,  // ← el día de mañana
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
