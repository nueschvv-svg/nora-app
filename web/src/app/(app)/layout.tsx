import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { NavInferior } from "@/componentes/NavInferior";
import { ProveedorApp } from "@/componentes/ContextoApp";
import { BotNora } from "@/componentes/BotNora";

/* El "marco de teléfono". En el celular ocupa toda la pantalla;
   en escritorio queda centrado con el fondo arena alrededor.
   Uso dvh y no vh: en Safari de iPhone, vh queda tapado por la
   barra de direcciones y se come la navegación de abajo.

   Antes de pintar nada: si quien entra es de operaciones, afuera.
   Estas pantallas (Inicio, Pedir, Historial) leen "propiedades" y
   "servicios" sin filtrar por dueño — para un cliente alcanza,
   porque su propio RLS ya lo limita a lo suyo. Para operaciones, cuyo
   RLS es ancho a propósito (ve TODO, para el panel), ese mismo patrón
   mezcla datos de cualquier cliente en lo que parece "tu" cuenta. La
   solución de fondo no es filtrar acá: es que operaciones ni entre. */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
    if (perfil?.rol === "operaciones") redirect("/operaciones");
  }

  return (
    <ProveedorApp>
      <div className="relative w-full max-w-[440px] h-dvh bg-sand overflow-hidden shadow-2xl">
        {children}
        <BotNora />
        <NavInferior />
      </div>
    </ProveedorApp>
  );
}
