/* ============================================================
   TIPOS DEL DOMINIO
   Estas formas espejan las tablas de la base de datos (db/schema.sql).
   Cuando conectemos Supabase, cambia de dónde vienen los datos,
   no cómo se ven las pantallas.
   ============================================================ */

export type TipoEquipo =
  | "calefon"
  | "termotanque"
  | "aire_acondicionado"
  | "tanque_agua"
  | "tablero_electrico"
  | "matafuegos"
  | "bomba_agua"
  | "caldera";

/** Cada cuántos meses corresponde revisar cada equipo, y por qué.
 *  Las frecuencias siguen las recomendaciones habituales en Argentina.
 *  `obligatorio` marca lo que además es exigencia legal o de seguro. */
export const REGLAS_EQUIPO: Record<
  TipoEquipo,
  { etiqueta: string; icono: string; frecuenciaMeses: number; obligatorio: boolean; motivo: string }
> = {
  calefon: {
    etiqueta: "Calefón",
    icono: "flame",
    frecuenciaMeses: 12,
    obligatorio: true,
    motivo: "Riesgo de monóxido de carbono. Revisión anual por gasista matriculado.",
  },
  termotanque: {
    etiqueta: "Termotanque",
    icono: "thermometer",
    frecuenciaMeses: 12,
    obligatorio: true,
    motivo: "Riesgo de monóxido de carbono. Revisión anual por gasista matriculado.",
  },
  caldera: {
    etiqueta: "Caldera",
    icono: "heater",
    frecuenciaMeses: 12,
    obligatorio: true,
    motivo: "Revisión anual obligatoria por gasista matriculado.",
  },
  aire_acondicionado: {
    etiqueta: "Aire acondicionado",
    icono: "wind",
    frecuenciaMeses: 6,
    obligatorio: false,
    motivo: "Limpieza de filtros antes de cada temporada. Mejora el consumo.",
  },
  tanque_agua: {
    etiqueta: "Tanque de agua",
    icono: "droplet",
    frecuenciaMeses: 6,
    obligatorio: false,
    motivo: "Limpieza y desinfección semestral recomendada por normativa sanitaria.",
  },
  tablero_electrico: {
    etiqueta: "Tablero eléctrico",
    icono: "zap",
    frecuenciaMeses: 12,
    obligatorio: false,
    motivo: "Verificación de térmicas y disyuntor. Previene incendios.",
  },
  matafuegos: {
    etiqueta: "Matafuegos",
    icono: "fire-extinguisher",
    frecuenciaMeses: 12,
    obligatorio: true,
    motivo: "Recarga anual obligatoria. Su vencimiento invalida la cobertura del seguro.",
  },
  bomba_agua: {
    etiqueta: "Bomba de agua",
    icono: "waves",
    frecuenciaMeses: 12,
    obligatorio: false,
    motivo: "Revisión anual de presión y automático.",
  },
};

export type Equipo = {
  id: string;
  propiedadId: string;
  tipo: TipoEquipo;
  /** Nombre que le puso el usuario, ej: "Calefón del baño". Opcional. */
  apodo?: string;
  marca?: string;
  modelo?: string;
  anioInstalacion?: number;
  /** Fecha ISO (YYYY-MM-DD) de la última revisión hecha. Sin dato = nunca se revisó. */
  ultimaRevision?: string;
};

export type Propiedad = {
  id: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  icono: "home" | "house" | "building-2";
};

/* Espeja exactamente el tipo `estado_servicio` de la base (db/01_esquema.sql).
   Si se agrega un estado allá, hay que agregarlo acá: TypeScript avisa
   apenas falte uno en ETIQUETA_ESTADO. */
export type EstadoServicio =
  | "solicitado"
  | "buscando_tecnico"
  | "asignado"
  | "presupuestado"
  | "aceptado"
  | "en_camino"
  | "en_curso"
  | "finalizado"
  | "pagado"
  | "calificado"
  | "cancelado";

/** Los estados que ve el cliente, con su texto. El panel de operaciones
 *  los mueve a mano en el MVP; después se automatizan. */
export const ETIQUETA_ESTADO: Record<EstadoServicio, string> = {
  solicitado: "Pedido enviado",
  buscando_tecnico: "Buscando técnico",
  asignado: "Técnico asignado",
  presupuestado: "Tenés un presupuesto",
  aceptado: "Presupuesto aceptado",
  en_camino: "En camino",
  en_curso: "Trabajando",
  finalizado: "Terminado",
  pagado: "Pagado",
  calificado: "Calificado",
  cancelado: "Cancelado",
};

/** Mismas cuatro franjas que ofrece /pedir al elegir día y hora — acá
 *  sólo para mostrar de vuelta lo que el cliente ya eligió (no una
 *  hora de llegada calculada, ver Servicio.franjaPreferida). */
export const ETIQUETA_FRANJA: Record<string, string> = {
  manana: "Mañana · 8 a 12 h",
  "tarde-1": "Tarde · 13 a 17 h",
  "tarde-2": "Tarde · 17 a 20 h",
  urgente: "Lo antes posible",
};

/** Un grupo por estado, no un color por estado: hay diez estados y sólo
 *  cuatro situaciones que de verdad importa distinguir de un vistazo —
 *  cancelado, resuelto, pasando ahora mismo, o esperando algo. Usa los
 *  tokens de estado que ya existía en globals.css (warn/good/urgent),
 *  ninguno inventado para esto. */
export type GrupoEstado = "cancelado" | "resuelto" | "en_vivo" | "esperando";

const GRUPO_ESTADO: Record<EstadoServicio, GrupoEstado> = {
  solicitado: "esperando",
  buscando_tecnico: "esperando",
  asignado: "esperando",
  presupuestado: "esperando",
  aceptado: "esperando",
  en_camino: "en_vivo",
  en_curso: "en_vivo",
  finalizado: "resuelto",
  pagado: "resuelto",
  calificado: "resuelto",
  cancelado: "cancelado",
};

export type EstiloEstado = { badge: string; punto: string; vivo: boolean };

const ESTILO_GRUPO: Record<GrupoEstado, EstiloEstado> = {
  esperando: { badge: "bg-warn/10 text-warn", punto: "bg-warn", vivo: false },
  en_vivo: { badge: "bg-brand-50 text-brand-600", punto: "bg-brand-600", vivo: true },
  resuelto: { badge: "bg-good/10 text-good", punto: "bg-good", vivo: false },
  cancelado: { badge: "bg-urgent/10 text-urgent", punto: "bg-urgent", vivo: false },
};

export function estiloEstado(estado: EstadoServicio): EstiloEstado {
  return ESTILO_GRUPO[GRUPO_ESTADO[estado]];
}

export type Categoria = {
  slug: string;
  nombre: string;
  icono: string;
  /** Si requiere matrícula habilitante, no cualquier técnico puede tomarlo. */
  requiereMatricula: boolean;
  /** Categorías activas en el MVP. El resto se muestra como "próximamente". */
  activa: boolean;
};

export type MetodoPago = "efectivo" | "mercado_pago";

export type Servicio = {
  id: string;
  propiedadId: string;
  categoriaSlug: string;
  descripcion: string;
  estado: EstadoServicio;
  creadoEl: string;
  /** Día y franja que eligió el cliente al pedir — no una hora de llegada
   *  calculada (no hay con qué: los domicilios no tienen coordenadas). */
  fechaPreferida: string | null;
  franjaPreferida: string | null;
  /** Monto en pesos argentinos. Null mientras no haya presupuesto aceptado. */
  montoArs: number | null;
  /** Null hasta que el cliente confirma cómo pagó (sólo posible una vez
   *  "finalizado"). "mercado_pago" todavía no es seleccionable — ver
   *  db/22_confirmar_pago.sql. */
  metodoPago: MetodoPago | null;
  pagoConfirmadoEl: string | null;
  tecnicoNombre?: string;
  tecnicoCalificacion?: number;
  /** Qué se hizo, cargado por el técnico al terminar. */
  reporte?: string;
  calificacion?: number;
  /** Id del técnico asignado, si hay. Determina si mostrar chat/ubicación. */
  tecnicoId?: string;
  /** Cuándo el técnico aceptó el trabajo. Null/undefined = todavía no. */
  tecnicoConfirmadoEl?: string;
  /** Última posición que compartió el técnico mientras estaba "en_camino". */
  ubicacionLat?: number;
  ubicacionLng?: number;
  ubicacionActualizadaEl?: string;
};
