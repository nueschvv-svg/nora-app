/* ============================================================
   ACCESO A DATOS — Datos personales

   Nombre y teléfono de la propia cuenta. El teléfono importa aunque
   la persona nunca se dé de alta como técnico: es lo que usa
   operaciones para contactarla por cualquier tema del pedido — hoy
   sólo se pedía en el alta de trabajador, y un cliente común nunca
   tenía dónde cargarlo.

   El email se muestra pero no se edita acá: cambiarlo requiere el
   flujo de confirmación de Supabase (dos mails, uno a la vieja
   dirección y otro a la nueva) y no es parte de este alcance.
   ============================================================ */

import { supabaseNavegador } from "./supabase/cliente";

function fallar(contexto: string, error: { message: string }): never {
  console.error(`[perfil] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

export type MisDatosPersonales = {
  nombre: string;
  telefono: string;
  email: string;
};

export async function misDatosPersonales(): Promise<MisDatosPersonales> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { data, error } = await supabase
    .from("perfiles")
    .select("nombre, telefono")
    .eq("id", user.id)
    .maybeSingle();
  if (error) fallar("cargar tus datos", error);

  return {
    nombre: data?.nombre ?? "",
    telefono: data?.telefono ?? "",
    email: user.email ?? "",
  };
}

export async function actualizarMisDatosPersonales(datos: {
  nombre: string;
  telefono: string;
}): Promise<void> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const nombre = datos.nombre.trim();
  if (nombre.length < 2) throw new Error("Poné tu nombre completo.");

  const { error } = await supabase
    .from("perfiles")
    .update({ nombre, telefono: datos.telefono.trim() || null })
    .eq("id", user.id);
  if (error) fallar("guardar tus datos", error);
}
