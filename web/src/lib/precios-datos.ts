/* Lectura del catálogo y las tarifas desde la base.

   Está separado de precios.ts a propósito: ese archivo tiene la lógica
   de cálculo y no importa nada, así se puede probar sola, sin base de
   datos ni navegador. Ver pruebas/estimador.mjs */

import { supabaseNavegador } from "./supabase/cliente";
import type { NivelUrgencia, Tarifa, Trabajo } from "./precios";

type FilaTrabajo = {
  slug: string;
  categoria_slug: string;
  nombre: string;
  sintomas: string[];
  diagnostico: string;
  riesgo_si_espera: string;
  urgencia: NivelUrgencia;
  horas_min: number;
  horas_max: number;
  materiales_min: number;
  materiales_max: number;
  requiere_matricula: boolean;
  preguntas: string[];
};

export async function listarCatalogo(): Promise<Trabajo[]> {
  const { data, error } = await supabaseNavegador()
    .from("catalogo_trabajos")
    .select(
      "slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia, horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas",
    );

  if (error) throw new Error("No pudimos cargar el catálogo de trabajos.");

  return (data as FilaTrabajo[]).map((f) => ({
    slug: f.slug,
    categoriaSlug: f.categoria_slug,
    nombre: f.nombre,
    sintomas: f.sintomas ?? [],
    diagnostico: f.diagnostico,
    riesgoSiEspera: f.riesgo_si_espera,
    urgencia: f.urgencia,
    horasMin: Number(f.horas_min),
    horasMax: Number(f.horas_max),
    materialesMin: Number(f.materiales_min),
    materialesMax: Number(f.materiales_max),
    requiereMatricula: f.requiere_matricula,
    preguntas: f.preguntas ?? [],
  }));
}

export async function listarTarifas(): Promise<Tarifa[]> {
  const { data, error } = await supabaseNavegador()
    .from("tarifas")
    .select("categoria_slug, visita_ars, visita_max_ars, hora_ars, hora_max_ars, recargo_urgencia")
    .order("vigente_desde", { ascending: false });

  if (error) throw new Error("No pudimos cargar las tarifas.");

  /* Nos quedamos con la más reciente de cada categoría. Las viejas se
     conservan en la tabla para poder saber a qué precio se cotizó un
     trabajo del mes pasado. */
  const porCategoria = new Map<string, Tarifa>();
  for (const f of data as Array<Record<string, unknown>>) {
    const slug = f.categoria_slug as string;
    if (porCategoria.has(slug)) continue;
    porCategoria.set(slug, {
      categoriaSlug: slug,
      visitaArs: Number(f.visita_ars),
      visitaMaxArs: f.visita_max_ars == null ? null : Number(f.visita_max_ars),
      horaArs: f.hora_ars == null ? null : Number(f.hora_ars),
      horaMaxArs: f.hora_max_ars == null ? null : Number(f.hora_max_ars),
      recargoUrgencia: Number(f.recargo_urgencia ?? 0.4),
    });
  }
  return [...porCategoria.values()];
}

export async function obtenerDolar(): Promise<number | null> {
  try {
    const r = await fetch("/api/dolar");
    if (!r.ok) return null;
    const d = (await r.json()) as { venta: number };
    return d.venta ?? null;
  } catch {
    // Sin cotización mostramos sólo pesos. No es motivo para romper nada.
    return null;
  }
}
