"use client";

import { createBrowserClient } from "@supabase/ssr";
import { exigirConfig } from "./config";

/* Cliente de Supabase para el navegador.

   Usa la clave pública (anon). Esa clave viaja al celular del usuario a
   propósito: está diseñada para eso. Lo único que impide que alguien lea
   datos ajenos con ella son las políticas de db/02_permisos.sql.

   Se crea una sola vez y se reutiliza: si se creara en cada render,
   cada componente tendría su propia conexión y su propia sesión. */

let instancia: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseNavegador() {
  if (!instancia) {
    const { url, anonKey } = exigirConfig();
    instancia = createBrowserClient(url, anonKey);
  }
  return instancia;
}
