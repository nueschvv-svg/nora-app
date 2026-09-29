import { supabaseNavegador } from './supabase/cliente';

export type FranjaAgenda = {
  fecha: string; franja: string; disponibles: number; capacidad: number;
  estado: 'AVAILABLE' | 'LAST_SPOT' | 'FULL' | 'UNAVAILABLE';
  motivo: string | null; timezone: string; anticipacion_horas: number;
};
export async function consultarAgenda(desde: string | null = null, dias = 30): Promise<FranjaAgenda[]> {
  const { data, error } = await supabaseNavegador().rpc('agenda_disponibilidad', { p_desde: desde, p_dias: dias });
  if (error) throw new Error('No pudimos consultar los turnos. Reintentá antes de reservar.');
  return (data ?? []) as FranjaAgenda[];
}
export function mensajeErrorAgenda(error: {message: string; code?: string}): string | null {
  if (error.message.includes('AGENDA_COMPLETO') || (error.code === '23505' && error.message.includes('agenda_cupo_unico'))) return 'Ese horario acaba de completarse. Elegí otro turno.';
  if (error.message.includes('AGENDA_')) return error.message.split(': ').slice(1).join(': ') || 'Revisá la fecha y el horario del turno.';
  return null;
}
export function etiquetaFechaAgenda(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}
export function puedeReservar(f: FranjaAgenda): boolean {
  return f.disponibles > 0 && (f.estado === 'AVAILABLE' || f.estado === 'LAST_SPOT');
}
