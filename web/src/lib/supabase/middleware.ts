import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HAY_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/* Rutas que se pueden ver sin haber iniciado sesión. */
const PUBLICAS = ["/entrar", "/auth"];

/* Refresca la sesión en cada pedido y decide si la persona puede pasar.

   Por qué hace falta: la sesión vive en una cookie con vencimiento corto.
   Si no se renueva en el servidor, al usuario se le cierra sola la sesión
   mientras usa la app. */
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  // Sin Supabase configurado, la app sigue andando con los datos del
  // navegador. Útil para ver el diseño sin tener que crear una cuenta.
  if (!HAY_SUPABASE) return respuesta;

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nuevas) {
        nuevas.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        nuevas.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  /* getUser() y no getSession(): getSession lee la cookie y confía en ella.
     getUser() valida el token contra Supabase. En el middleware, que es
     donde se decide quién pasa, hay que validar. */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esPublica = PUBLICAS.some((p) => ruta.startsWith(p));

  // Sin sesión y en una ruta privada: al login, recordando a dónde iba.
  if (!user && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    if (ruta !== "/") url.searchParams.set("volver", ruta);
    return NextResponse.redirect(url);
  }

  // Con sesión y entrando al login: derecho al inicio.
  if (user && ruta.startsWith("/entrar")) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return respuesta;
}
