import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { exigirConfig } from "./config";

/* Cliente de Supabase para el servidor (páginas y acciones del servidor).

   Por qué existe además del del navegador: la sesión del usuario viaja en
   una cookie, y el servidor necesita leerla para saber quién está entrando
   ANTES de dibujar la página. Si no, cada pantalla parpadearía mostrando
   "no hay sesión" y recién después los datos.

   La sesión se guarda en cookies httpOnly, no en localStorage: una cookie
   httpOnly no la puede leer ningún JavaScript de la página, así que un
   script inyectado no puede robarse la sesión. */

export async function supabaseServidor() {
  const { url, anonKey } = exigirConfig();
  const almacen = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(nuevas) {
        try {
          nuevas.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          /* Desde un Server Component no se pueden escribir cookies.
             No es un problema: el middleware ya refrescó la sesión antes
             de llegar acá. */
        }
      },
    },
  });
}
