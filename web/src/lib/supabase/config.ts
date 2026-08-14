/* Lee la configuración de Supabase desde las variables de entorno.

   Nunca hay claves escritas acá. Los valores viven en `web/.env.local`,
   un archivo que está excluido del repositorio y no sale de tu computadora.

   Si falta algo, preferimos un error claro y temprano antes que una app
   que arranca y falla más tarde con un mensaje incomprensible. */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/* Supabase renombró esta clave: antes era "anon key", ahora "publishable key"
   (empieza con sb_publishable_). Son equivalentes y las dos son públicas.
   Aceptamos los dos nombres para que se pueda pegar tal cual lo que da el
   panel de Supabase, sea cual sea la versión que muestre. */
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** ¿Está configurado? Mientras no lo esté, la app sigue andando con los
 *  datos guardados en el navegador. Así podés seguir viéndola sin cuenta. */
export const HAY_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function exigirConfig(): { url: string; anonKey: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Falta configurar Supabase. En web/.env.local tienen que estar " +
        "NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(o NEXT_PUBLIC_SUPABASE_ANON_KEY, el nombre viejo). " +
        "Después reiniciá el servidor: Ctrl+C y npm run dev.",
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}
