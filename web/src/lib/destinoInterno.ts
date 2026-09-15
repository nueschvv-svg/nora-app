/** Sólo rutas del sitio: nunca ejecutar esquemas ni salir a otro dominio. */
export function destinoInterno(valor: string | null): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || /[\\\u0000-\u0020]/.test(valor)) return "/inicio";
  return valor;
}
