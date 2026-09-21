import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Sólo el consumidor de la cola usa este cliente. Nunca aceptar datos
 * de un residente para consultas arbitrarias con estos permisos. */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta configurar el consumidor de avisos.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
  });
}
