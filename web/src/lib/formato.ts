/* Formateo para Argentina: pesos, fechas y textos relativos.
   Centralizado acá para que el día que cambie algo (otra moneda,
   otro país) se toque en un solo lugar. */

const PESOS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** 48000 → "$ 48.000" */
export function pesos(monto: number | null | undefined): string {
  if (monto == null) return "—";
  return PESOS.format(monto);
}

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** "2026-06-04" → "4 Jun 2026" */
export function fecha(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-06-04" → "4 Jun" */
export function fechaCorta(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

/** "2026-09-15" → "Sep 2026" */
export function mesAnio(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Texto humano del vencimiento. `dias` positivo = ya venció. */
export function textoVencimiento(dias: number | null): string {
  if (dias == null) return "Sin datos";
  if (dias > 365) return `Vencido hace más de un año`;
  if (dias > 30) return `Vencido hace ${Math.round(dias / 30)} meses`;
  if (dias > 0) return `Vencido hace ${dias} ${dias === 1 ? "día" : "días"}`;
  if (dias === 0) return "Vence hoy";
  const faltan = -dias;
  if (faltan <= 30) return `En ${faltan} ${faltan === 1 ? "día" : "días"}`;
  if (faltan <= 365) return `En ${Math.round(faltan / 30)} meses`;
  return `En más de un año`;
}

/** Saludo según la hora. */
export function saludo(hora: number = new Date().getHours()): string {
  if (hora < 6) return "Buenas noches";
  if (hora < 13) return "Buen día";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}
