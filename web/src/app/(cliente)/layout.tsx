import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { ProveedorApp } from "@/componentes/ContextoApp";

/* Layout compartido entre (app) y (flujo) — antes cada uno tenía su
   propio <ProveedorApp>. Como son grupos de rutas hermanos, cruzar de
   uno al otro (ej. Inicio → Pedir) desmontaba el árbol entero y volvía
   a montar uno nuevo: sesión, propiedades y equipos se recargaban desde
   cero cada vez, con varias idas y vueltas a la base antes de poder
   mostrar nada. Fue el principal sospechoso de "la navegación es
   lenta" — no una sola pantalla pesada, sino este remount repetido
   cada vez que se cruza ese límite. Anidándolos acá abajo, el Provider
   sobrevive a la navegación entre los dos: se lee una sola vez por
   sesión, no una vez por pantalla.

   El chequeo de operaciones también sube a este nivel (antes vivía
   sólo en (app)/layout.tsx): de paso cierra un agujero que existía —
   una cuenta de operaciones podía entrar a /pedir sin que nada la
   redirigiera, porque (flujo)/layout.tsx nunca tuvo este chequeo. */
export default async function LayoutCliente({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
    if (perfil?.rol === "operaciones") redirect("/operaciones");
  }

  return <ProveedorApp>{children}</ProveedorApp>;
}
