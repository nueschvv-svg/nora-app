const CLAVE = "nora:intento-pedido";
let memoria: { firma: string; id: string } | null = null;
type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Persistir sólo hash + UUID; no guardar teléfono, domicilio ni descripción. */
export async function idIntentoPedido(datos: unknown, almacen?: Almacen): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(datos)));
  const firma = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    almacen ??= sessionStorage;
    const previo = JSON.parse(almacen.getItem(CLAVE) ?? "null");
    if (previo?.firma === firma && typeof previo.id === "string" && /^[0-9a-f-]{36}$/i.test(previo.id)) memoria = previo;
  } catch { /* Storage restringido: los reintentos en esta página siguen protegidos. */ }
  if (memoria?.firma !== firma) memoria = { firma, id: crypto.randomUUID() };
  try { almacen?.setItem(CLAVE, JSON.stringify(memoria)); } catch {}
  return memoria!.id;
}

export function completarIntentoPedido(): void {
  memoria = null;
  try { sessionStorage.removeItem(CLAVE); } catch {}
}
