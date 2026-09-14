/** Limita la espera; la operación subyacente puede terminar más tarde. */
export async function conTiempoLimite<T>(operacion: Promise<T>, ms: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operacion,
      new Promise<never>((_, reject) => { temporizador = setTimeout(() => reject(new Error("Se agotó el tiempo de espera.")), ms); }),
    ]);
  } finally { clearTimeout(temporizador); }
}
