import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { destinoInterno } from "@/lib/destinoInterno";

/* Acá aterrizan los links que Nora manda por mail.

   Dos casos:
   · Confirmar la cuenta al registrarse  → type=signup / email
   · Recuperar la contraseña             → type=recovery

   Sin esta ruta, el link del mail da 404 y la persona queda sin poder
   entrar. Es la contracara obligatoria de tener confirmación por mail.

   Va como route handler y no como página porque hay que escribir la
   cookie de sesión: eso sólo se puede hacer en el servidor. */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const destino = destinoInterno(searchParams.get("next"));

  if (!tokenHash || !tipo) {
    return NextResponse.redirect(`${origin}/entrar?error=link_invalido`);
  }

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });

  if (error) {
    // Los links vencen. No decimos por qué falló con detalle: que un
    // atacante sepa si un token existe pero venció ya es información.
    return NextResponse.redirect(`${origin}/entrar?error=link_vencido`);
  }

  // Recuperar contraseña: ya hay sesión, pero hay que elegir una nueva.
  if (tipo === "recovery") {
    return NextResponse.redirect(`${origin}/cambiar-clave`);
  }

  return NextResponse.redirect(`${origin}${destino}`);
}
