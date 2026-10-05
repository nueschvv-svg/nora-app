/* ============================================================
   Cliente del diagnóstico por foto, desde el navegador.

   Envuelve la llamada a /api/diagnosticar (ver esa ruta y
   lib/diagnostico.ts para las reglas de negocio y de seguridad —
   acá sólo empaqueta el pedido y traduce la respuesta).
   ============================================================ */

import type { NivelUrgencia } from "./precios";
import type { AntecedenteParaCliente, Familia } from "./antecedentes";

export type ResultadoDiagnostico = {
  identificado: boolean;
  confianza?: number;
  observaciones: string;
  preguntas: string[];
  riesgoInmediato: boolean;
  /** Familia del archivo de ENJINIA. El servidor ya la validó. */
  familia?: Familia | null;
  /** Antecedentes reales. El servidor descartó cualquier id inventado. */
  antecedentes?: AntecedenteParaCliente[];
  /** Si el análisis miró fotos de verdad. La pantalla no debe decir
   *  "foto analizada" cuando esto es false. */
  conFotos?: boolean;
  trabajo?: {
    slug: string;
    nombre: string;
    categoriaSlug: string;
    diagnostico: string;
    riesgoSiEspera: string;
    urgencia: NivelUrgencia;
    requiereMatricula: boolean;
  };
  estimado?: {
    titulo: string;
    aclaracion: string;
    usd: string | null;
    desdeArs: number;
    hastaArs: number;
    rangoUtil: boolean;
    conRecargo: boolean;
  } | null;
};

export async function diagnosticarFoto(params: {
  /** Opcional y hasta 3: el endpoint ya acepta sólo descripción, sin
   *  fotos — así se puede pedir el mismo análisis cuando la persona
   *  escribió pero no mandó ninguna imagen. */
  fotos?: File[];
  descripcion: string;
  categoriaSlug?: string | null;
}): Promise<ResultadoDiagnostico> {
  const form = new FormData();
  // `append` (no `set`) a propósito: permite varias fotos bajo la
  // misma clave — el servidor las lee todas con `formData.getAll`.
  for (const foto of params.fotos ?? []) form.append("foto", foto);
  if (params.descripcion.trim()) form.set("descripcion", params.descripcion.trim());
  if (params.categoriaSlug) form.set("categoria", params.categoriaSlug);

  const r = await fetch("/api/diagnosticar", { method: "POST", body: form, signal: AbortSignal.timeout(65000) });
  const datos = await r.json().catch(() => null);

  if (!r.ok) {
    throw new Error(
      (datos && typeof datos.error === "string" && datos.error) ||
        "No pudimos analizar la foto. Probá de nuevo en un momento.",
    );
  }

  return datos as ResultadoDiagnostico;
}
