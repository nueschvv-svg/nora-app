import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";

/* El "marco" de operaciones. A propósito NO reusa (cliente)/layout.tsx:
   ese layout carga propiedades y equipos de quien entra (ProveedorApp)
   y tiene la barra de navegación del cliente — nada de eso aplica acá.
   Es una pantalla distinta, para una persona distinta.

   Sin marco de teléfono ni ancho máximo: es una herramienta de trabajo
   para el equipo, pensada para usarse en escritorio — el dashboard de
   lista + detalle (ListaPedidos/DetalleServicio) necesita todo el
   ancho disponible para mostrar las dos columnas lado a lado.

   El control de acceso vive acá y no en middleware.ts a propósito:
   middleware.ts protege TODA la app (sólo pide sesión), tocarlo para
   agregar una regla de rol que sólo aplica a esta única sección sería
   más riesgo del que vale la pena. Este layout corre antes que
   cualquier página de acá adentro, así que ninguna llega a pintar nada
   si la cuenta no es de operaciones — no hace falta repetir el chequeo
   en cada página. */
export default async function LayoutOperaciones({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();

  if (perfil?.rol !== "operaciones") redirect("/inicio");

  return <div className="relative w-full h-dvh bg-sand overflow-hidden">{children}</div>;
}
