/* ============================================================
   ENRUTAMIENTO DE PEDIDOS — la interfaz

   Qué pasa con un pedido después de que Nora lo analizó: hoy avisa
   por Telegram al equipo de Enjinia, que decide a mano. El día que
   haya masa crítica de técnicos registrados, esto cambia a matching
   automático — sin tocar el análisis de Nora ni el alta de técnicos.

   Por eso es una interfaz y no un if/else: agregar un destino nuevo
   es escribir una función que la cumpla y sumarla al registro de
   lib/enrutamiento/index.ts. Cambiar cuál está activa es una
   variable de entorno, no un redeploy de lógica.
   ============================================================ */

/** Todo lo que un destino podría necesitar para avisar de un pedido.
 *  Se arma una sola vez, en app/api/pedidos/[id]/enrutar/route.ts,
 *  leyendo de la base con la sesión del propio cliente — nunca datos
 *  que el navegador podría falsear. */
export type PedidoParaEnrutar = {
  servicioId: string;
  categoriaNombre: string;
  /** Ya incluye lo que Nora vio en la foto, si hubo — ver pedir/page.tsx. */
  descripcion: string;
  diagnostico?: {
    observaciones: string;
    riesgoInmediato: boolean;
    confianza?: number;
  };
  estimado?: {
    titulo: string;
    aclaracion: string;
  } | null;
  cliente: {
    nombre: string;
    telefono: string | null;
  };
  propiedad: {
    direccion: string;
    localidad: string;
    provincia: string;
    notasAcceso: string | null;
  };
  fechaPreferida: string | null;
  franjaPreferida: string | null;
  /** URL firmada de corta duración, o null si no se mandó foto o
   *  todavía no se pudo confirmar que se subió. */
  fotoUrl: string | null;
};

export type ResultadoEnrutamiento = {
  ok: boolean;
  /** Motivo si falló, o un detalle corto si salió bien (ej: id del
   *  mensaje). Se guarda en servicio_enrutamientos.detalle — nunca un
   *  secreto, lo puede leer el propio cliente. */
  detalle?: string;
  /** Cuántas veces se intentó en total. 1 si salió a la primera. */
  intentos?: number;
};

export interface EstrategiaEnrutamiento {
  /** Coincide con servicio_enrutamientos.estrategia. */
  nombre: string;
  enrutar(pedido: PedidoParaEnrutar): Promise<ResultadoEnrutamiento>;
}
