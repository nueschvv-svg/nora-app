import { NextResponse } from "next/server";

/* Cotización del dólar, para mostrar los estimados también en dólares.

   Por qué existe esta ruta en vez de pedirlo desde el navegador:
   · Se cachea una sola vez para todos los usuarios, no una por persona.
   · Si la fuente se cae, respondemos con el último valor conocido en vez
     de romper la pantalla.
   · Evita problemas de CORS con el proveedor.

   Fuente: dolarapi.com, gratuita y sin credenciales. */

const FUENTE = "https://dolarapi.com/v1/dolares";
const UNA_HORA = 3600;

/* Si la fuente falla y todavía no tenemos nada cacheado, usamos esto para
   no romper. Queda claramente marcado como desactualizado. */
const RESPALDO = { compra: 1520, venta: 1540, actualizado: "2026-08-14" };

export const revalidate = 3600;

type Cotizacion = { casa: string; compra: number; venta: number; fechaActualizacion?: string };

export async function GET() {
  try {
    const r = await fetch(FUENTE, { next: { revalidate: UNA_HORA } });
    if (!r.ok) throw new Error(`la fuente respondió ${r.status}`);

    const datos = (await r.json()) as Cotizacion[];

    /* Usamos el "blue" porque es el número con el que la gente piensa en
       Argentina. Si algún día conviene el oficial o el MEP, se cambia acá
       y en ningún otro lado. */
    const blue = datos.find((d) => d.casa === "blue");
    const oficial = datos.find((d) => d.casa === "oficial");
    const elegido = blue ?? oficial;

    if (!elegido) throw new Error("la fuente no trajo ninguna cotización conocida");

    return NextResponse.json({
      compra: elegido.compra,
      venta: elegido.venta,
      casa: elegido.casa,
      actualizado: elegido.fechaActualizacion ?? new Date().toISOString(),
      confiable: true,
    });
  } catch (e) {
    console.error("[dolar] no se pudo obtener la cotización:", e);
    // Devolvemos 200 con el respaldo marcado: una pantalla que muestra un
    // número viejo y lo aclara es mejor que una pantalla rota.
    return NextResponse.json({ ...RESPALDO, casa: "respaldo", confiable: false });
  }
}
