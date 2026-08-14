import { type NextRequest, NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";

/* Vuelta desde un proveedor externo (Google, cuando lo agreguemos).

   El proveedor devuelve un código de un solo uso; acá se canjea por la
   sesión. Ya queda escrito para que sumar Google después sea configurar
   credenciales, no escribir código. */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const destino = searchParams.get("next") ?? "/inicio";

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?error=sin_codigo`);
  }

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?error=no_pudimos_entrar`);
  }

  return NextResponse.redirect(`${origin}${destino}`);
}
