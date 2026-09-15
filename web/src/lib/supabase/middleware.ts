import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HAY_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/* Rutas que se pueden ver sin haber iniciado sesión. */
const PUBLICAS = ["/entrar", "/auth"];

/* Rutas que siguen exigiendo una cuenta real (operaciones no tiene
   sesión anónima — es el equipo interno, con su email y contraseña
   de siempre). Todo lo demás es "lado cliente": ahí, sin sesión, se
   crea una anónima sola en vez de mandar a /entrar — ver más abajo. */
const REQUIERE_CUENTA_REAL = ["/operaciones", "/cambiar-clave"];

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
  const esApi = ruta.startsWith("/api/");
  const requiereCuentaReal = REQUIERE_CUENTA_REAL.some((p) => ruta.startsWith(p));

  /* Lado cliente sin cuentas: sin sesión y sin pedir una cuenta real acá,
     se crea una anónima sola — la persona nunca ve un login. Es una
     sesión de Supabase de verdad (auth.uid() real), así que todo el
     resto de la app (RLS, propiedades, pedidos) sigue funcionando
     exactamente igual que con una cuenta con email. Sólo pasa la
     primera vez: las visitas siguientes ya traen la cookie. */
  if (!user && !esPublica && !esApi && !requiereCuentaReal) {
    const { data, error: errorAnonimo } = await supabase.auth.signInAnonymously();
    if (!errorAnonimo && data.user) {
      return respuesta;
    }
    /* Si signInAnonymously() falla (ej. rate limit de Supabase en el
       endpoint de alta anónima — pasó de verdad en desarrollo con
       tráfico automatizado pesado, error_code "over_request_rate_limit"),
       ANTES esto caía al chequeo de "sin sesión → /entrar" de más abajo.
       Eso manda a un cliente real, sin cuenta ni credenciales, a la
       pantalla de login del EQUIPO — un cliente en un pico de tráfico
       real quedaría con la app completamente inaccesible, sin ninguna
       salida. Se deja pasar el pedido en vez de eso: bastante de la app
       sigue andando sin sesión (el catálogo y las tarifas son de
       lectura pública), y lo que sí necesita `auth.uid()` falla más
       adelante con su propio manejo de error, no con un login ajeno. */
    return respuesta;
  }

  /* Sin sesión, una API responde 401; una pantalla redirige al login.

     Mandar a /entrar una llamada de la API rompe de una forma confusa: el
     navegador sigue el redirect, hace un POST contra una página que no
     acepta POST, y el cliente recibe un 404 sin ninguna pista de que lo
     que faltaba era la sesión. */
  if ((!user || (user.is_anonymous && requiereCuentaReal)) && !esPublica) {
    if (esApi) {
      return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    if (ruta !== "/") url.searchParams.set("volver", ruta);
    return NextResponse.redirect(url);
  }

  // Con sesión y entrando al login: derecho al inicio.
  if (user && !user.is_anonymous && ruta.startsWith("/entrar")) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return respuesta;
}
