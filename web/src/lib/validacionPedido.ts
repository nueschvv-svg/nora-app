export function telefonoContactoValido(valor: string): boolean {
  return /^[+\d\s().-]+$/.test(valor) && valor.replace(/\D/g, "").length >= 8 && valor.replace(/\D/g, "").length <= 15;
}

export function errorFotoPedido(archivo: Pick<File, "type" | "size">): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) return "Usá una foto JPG, PNG o WEBP.";
  if (!archivo.size || archivo.size > 5 * 1024 * 1024) return "Usá una foto de hasta 5 MB.";
  return null;
}

export function fechaArgentina(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
}
