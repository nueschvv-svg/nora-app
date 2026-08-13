/* ============================================================
   DATOS DE DEMOSTRACIÓN

   ⚠️  TEMPORAL. Esto existe sólo para poder ver y probar las pantallas
   mientras no está conectada la base de datos. Cuando enchufemos
   Supabase, este archivo se borra y las mismas funciones pasan a
   leer de Postgres. Las pantallas no se tocan.

   Los montos son inventados y están para ver el formato, NO son
   precios de referencia.
   ============================================================ */

import { Categoria, Equipo, Propiedad, Servicio } from "./tipos";

export const propiedades: Propiedad[] = [
  {
    id: "prop-1",
    nombre: "Mi hogar",
    direccion: "Bancalari 3901",
    localidad: "Tigre",
    provincia: "Buenos Aires",
    icono: "home",
  },
  {
    id: "prop-2",
    nombre: "Casa Padres",
    direccion: "Vega 678",
    localidad: "Merlo",
    provincia: "Buenos Aires",
    icono: "house",
  },
];

/* Los equipos son lo que alimenta el score y la agenda.
   Fechas pensadas para que se vea cada estado posible. */
export const equipos: Equipo[] = [
  {
    id: "eq-1",
    propiedadId: "prop-1",
    tipo: "calefon",
    marca: "Orbis",
    modelo: "4125",
    anioInstalacion: 2013,
    ultimaRevision: "2025-03-10", // vencido y además tiene más de 10 años
  },
  {
    id: "eq-2",
    propiedadId: "prop-1",
    tipo: "aire_acondicionado",
    apodo: "Aire del living",
    marca: "BGH",
    anioInstalacion: 2021,
    ultimaRevision: "2026-03-01", // por vencer
  },
  {
    id: "eq-3",
    propiedadId: "prop-1",
    tipo: "tanque_agua",
    anioInstalacion: 2018,
    ultimaRevision: "2026-06-20", // al día
  },
  {
    id: "eq-4",
    propiedadId: "prop-1",
    tipo: "tablero_electrico",
    anioInstalacion: 2018,
    // sin última revisión: no sabemos
  },
  {
    id: "eq-5",
    propiedadId: "prop-2",
    tipo: "aire_acondicionado",
    marca: "Surrey",
    anioInstalacion: 2022,
    ultimaRevision: "2026-05-15",
  },
  {
    id: "eq-6",
    propiedadId: "prop-2",
    tipo: "termotanque",
    marca: "Rheem",
    anioInstalacion: 2020,
    ultimaRevision: "2026-01-20",
  },
];

/* Categorías. En el MVP arrancamos con pocas y bien cubiertas:
   es preferible resolver 3 cosas siempre que 15 a veces.
   Las inactivas se muestran igual, marcadas como "próximamente",
   y sirven para medir qué pide la gente. */
export const categorias: Categoria[] = [
  { slug: "plomeria", nombre: "Plomería", icono: "wrench", requiereMatricula: false, activa: true },
  { slug: "electricidad", nombre: "Electricidad", icono: "zap", requiereMatricula: true, activa: true },
  { slug: "cerrajeria", nombre: "Cerrajería", icono: "key-round", requiereMatricula: false, activa: true },
  { slug: "gas", nombre: "Gas", icono: "flame", requiereMatricula: true, activa: false },
  { slug: "aire", nombre: "Aire acond.", icono: "air-vent", requiereMatricula: false, activa: false },
  { slug: "pintura", nombre: "Pintura", icono: "paint-roller", requiereMatricula: false, activa: false },
  { slug: "carpinteria", nombre: "Carpintería", icono: "hammer", requiereMatricula: false, activa: false },
  { slug: "albanileria", nombre: "Albañilería", icono: "brick-wall", requiereMatricula: false, activa: false },
  { slug: "limpieza", nombre: "Limpieza", icono: "sparkles", requiereMatricula: false, activa: false },
];

export const servicios: Servicio[] = [
  {
    id: "srv-1",
    propiedadId: "prop-1",
    categoriaSlug: "plomeria",
    descripcion: "Pérdida en la conexión de abajo de la bacha de la cocina.",
    estado: "calificado",
    creadoEl: "2026-06-04",
    montoArs: 48000,
    tecnicoNombre: "Marcos Rodríguez",
    tecnicoCalificacion: 4.9,
    reporte: "Cambio de flexible y sellado de la conexión bajo bacha. Sin pérdidas.",
    calificacion: 5,
  },
  {
    id: "srv-2",
    propiedadId: "prop-1",
    categoriaSlug: "electricidad",
    descripcion: "Salta la térmica cuando enciendo el horno eléctrico.",
    estado: "calificado",
    creadoEl: "2026-06-01",
    montoArs: 82000,
    tecnicoNombre: "Laura Giménez",
    tecnicoCalificacion: 4.8,
    reporte: "Revisión de tablero, recambio de térmica y disyuntor.",
    calificacion: 5,
  },
  {
    id: "srv-3",
    propiedadId: "prop-1",
    categoriaSlug: "cerrajeria",
    descripcion: "Cambio de cerradura de la puerta principal.",
    estado: "calificado",
    creadoEl: "2026-05-09",
    montoArs: 61000,
    tecnicoNombre: "Diego Ferrari",
    tecnicoCalificacion: 4.9,
    reporte: "Cerradura de seguridad instalada. 3 juegos de llaves entregados.",
    calificacion: 4,
  },
];

/* --- Accesores. Cuando venga Supabase, sólo cambia el interior. --- */

export function equiposDePropiedad(propiedadId: string): Equipo[] {
  return equipos.filter((e) => e.propiedadId === propiedadId);
}

export function serviciosDePropiedad(propiedadId: string): Servicio[] {
  return servicios
    .filter((s) => s.propiedadId === propiedadId)
    .sort((a, b) => b.creadoEl.localeCompare(a.creadoEl));
}

export function categoriaPorSlug(slug: string): Categoria | undefined {
  return categorias.find((c) => c.slug === slug);
}
