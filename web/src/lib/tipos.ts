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
    icono: "flame",
    frecuenciaMeses: 12,
    obligatorio: true,
    motivo: "Riesgo de monóxido de carbono. Revisión anual por gasista matriculado.",
  },
  caldera: {
    etiqueta: "Caldera",
    icono: "flame",
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
    icono: "droplets",
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

export type EstadoServicio =
  | "borrador"
  | "solicitado"
  | "buscando_tecnico"
  | "asignado"
  | "en_camino"
  | "en_curso"
  | "finalizado"
  | "calificado"
  | "cancelado";

/** Los estados que ve el cliente, con su texto. El panel de operaciones
 *  los mueve a mano en el MVP; después se automatizan. */
export const ETIQUETA_ESTADO: Record<EstadoServicio, string> = {
  borrador: "Sin enviar",
  solicitado: "Pedido enviado",
  buscando_tecnico: "Buscando técnico",
  asignado: "Técnico asignado",
  en_camino: "En camino",
  en_curso: "Trabajando",
  finalizado: "Terminado",
  calificado: "Calificado",
  cancelado: "Cancelado",
};

export type Categoria = {
  slug: string;
  nombre: string;
  icono: string;
  /** Si requiere matrícula habilitante, no cualquier técnico puede tomarlo. */
  requiereMatricula: boolean;
  /** Categorías activas en el MVP. El resto se muestra como "próximamente". */
  activa: boolean;
};

export type Servicio = {
  id: string;
  propiedadId: string;
  categoriaSlug: string;
  descripcion: string;
  estado: EstadoServicio;
  creadoEl: string;
  /** Monto en pesos argentinos. Null mientras no haya presupuesto aceptado. */
  montoArs: number | null;
  tecnicoNombre?: string;
  tecnicoCalificacion?: number;
  /** Qué se hizo, cargado por el técnico al terminar. */
  reporte?: string;
  calificacion?: number;
};
