import type { Edificio, Propiedad } from './tipos';

export function propiedadDelContexto(slug: string | null, edificio: Edificio | null, propiedad: Propiedad | null): Propiedad | null {
  if (slug === null) return propiedad;
  return edificio && propiedad?.edificioId === edificio.id && propiedad.piso && propiedad.unidad ? propiedad : null;
}

export function direccionConUnidad(calle: string, numero?: string | null, piso?: string | null, unidad?: string | null, nucleo?: string | null, uf?: number | null): string {
  return [[calle, numero].filter(Boolean).join(' '), nucleo ? `Núcleo ${nucleo}` : null, piso ? `Piso ${piso}` : null, unidad ? `Unidad ${unidad}` : null, uf ? `UF ${uf}` : null].filter(Boolean).join(' · ');
}
