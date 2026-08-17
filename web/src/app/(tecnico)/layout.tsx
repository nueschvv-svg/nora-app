import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";

/* El "marco" del técnico. Mismo patrón que (operaciones)/layout.tsx.

   El gate acá NO chequea perfiles.rol: es_tecnico() lee esa columna,
   pero nada en el alta propia (FormularioTrabajador) la toca — todo
   técnico sigue siendo rol='cliente'. Lo que importa es
   tecnicos.estado, que es donde vive de verdad la verificación. Usar
   esa columna directo no necesita ninguna plomería nueva: la política
   "el técnico ve su ficha" (02_permisos.sql) ya lo permite. */
export default async function LayoutTecnico({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const { data: tecnico } = await supabase.from("tecnicos").select("estado").eq("id", user.id).maybeSingle();

  if (tecnico?.estado !== "verificado") redirect("/perfil");

  return <div className="min-h-dvh bg-sand">{children}</div>;
}
