/** Persiste lo que operaciones necesita aunque el navegador se cierre. */
export function descripcionDelPedido(descripcion: string, riesgo: boolean, observaciones?: string | null, estimado?: string | null): string {
  return [riesgo ? '[RIESGO INMEDIATO]' : null, descripcion.trim(), observaciones ? `[Foto analizada por Nora] ${observaciones}` : null, estimado].filter(Boolean).join('\n\n');
}
