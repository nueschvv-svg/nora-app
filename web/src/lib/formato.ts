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

/** timestamptz ISO → "hace 5 min", "hace 3 h", "hace 2 d". Para bandejas
 *  cortas (notificaciones); pasado una semana muestra la fecha, no un
 *  número de días cada vez menos útil. */
export function haceTiempo(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 7) return `Hace ${dias} d`;
  return fechaCorta(iso.slice(0, 10));
}

/** Saludo según la hora. */
export function saludo(hora: number = new Date().getHours()): string {
  if (hora < 6) return "Buenas noches";
  if (hora < 13) return "Buen día";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}
