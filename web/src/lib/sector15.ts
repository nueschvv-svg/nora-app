export const SECTOR15_SLUG = 'sector-15';
export type UnidadSector15 = { uf: number; nucleo: string; piso: number; unidad: string };
export function opcionesUnidad(filas: UnidadSector15[], nucleo: string, piso: number) {
  return {
    nucleos: [...new Set(filas.map(u => u.nucleo))].sort(),
    pisos: [...new Set(filas.filter(u => u.nucleo === nucleo).map(u => u.piso))].sort((a,b) => a-b),
    letras: filas.filter(u => u.nucleo === nucleo && u.piso === piso).map(u => u.unidad).sort(),
  };
}
export function seleccionarUnidad(filas: UnidadSector15[], nucleo: string, piso: number, letra: string) {
  return filas.find(u => u.nucleo === nucleo && u.piso === piso && u.unidad === letra) ?? null;
}
