/* ============================================================
   OBRAS — construcciones propias del cliente, sin relación con un
   pedido de servicio puntual. Cualquier cliente puede cargar la
   suya: nombre, ubicación, presupuesto, etapas, contacto de quien la
   dirige. Ver db/25_obras.sql.
   ============================================================ */

import { supabaseNavegador } from "./supabase/cliente";

function fallar(contexto: string, error: { message: string }): never {
  console.error(`[obras] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

export type EstadoEtapa = "pendiente" | "en_curso" | "completo";
export type Etapa = { nombre: string; estado: EstadoEtapa };

export type Obra = {
  id: string;
  /** Para saber si quien mira es el dueño (puede invitar) o un colaborador. */
  clienteId: string;
  nombre: string;
  ubicacion: string | null;
  presupuestoArs: number | null;
  ejecutadoArs: number | null;
  etapas: Etapa[];
  contactoNombre: string | null;
  contactoRol: string | null;
  contactoTelefono: string | null;
  creadoEl: string;
};

type FilaObra = {
  id: string;
  cliente_id: string;
  nombre: string;
  ubicacion: string | null;
  presupuesto_ars: number | null;
  ejecutado_ars: number | null;
  etapas: Etapa[] | null;
  contacto_nombre: string | null;
  contacto_rol: string | null;
  contacto_telefono: string | null;
  creado_el: string;
};

function aObra(f: FilaObra): Obra {
  return {
    id: f.id,
    clienteId: f.cliente_id,
    nombre: f.nombre,
    ubicacion: f.ubicacion,
    presupuestoArs: f.presupuesto_ars,
    ejecutadoArs: f.ejecutado_ars,
    etapas: f.etapas ?? [],
    contactoNombre: f.contacto_nombre,
    contactoRol: f.contacto_rol,
    contactoTelefono: f.contacto_telefono,
    creadoEl: f.creado_el,
  };
}

const SELECT =
  "id, cliente_id, nombre, ubicacion, presupuesto_ars, ejecutado_ars, etapas, contacto_nombre, contacto_rol, contacto_telefono, creado_el";

export async function listarObras(): Promise<Obra[]> {
  const { data, error } = await supabaseNavegador()
    .from("obras")
    .select(SELECT)
    .order("creado_el", { ascending: false });
  if (error) fallar("cargar tus obras", error);
  return (data as FilaObra[]).map(aObra);
}

export type DatosObra = {
  nombre: string;
  ubicacion: string;
  presupuestoArs: number | null;
  etapas: Etapa[];
  contactoNombre: string;
  contactoRol: string;
  contactoTelefono: string;
};

export async function crearObra(datos: DatosObra): Promise<Obra> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { data, error } = await supabase
    .from("obras")
    .insert({
      cliente_id: user.id,
      nombre: datos.nombre.trim(),
      ubicacion: datos.ubicacion.trim() || null,
      presupuesto_ars: datos.presupuestoArs,
      etapas: datos.etapas,
      contacto_nombre: datos.contactoNombre.trim() || null,
      contacto_rol: datos.contactoRol.trim() || null,
      contacto_telefono: datos.contactoTelefono.trim() || null,
    })
    .select(SELECT)
    .single();

  if (error) fallar("guardar la obra", error);
  return aObra(data as FilaObra);
}

/* Tocar una etapa avanza su estado en el mismo orden en que se
   completa una obra de verdad: pendiente → en curso → completo →
   vuelve a pendiente (para corregir un toque accidental). */
export function siguienteEstadoEtapa(actual: EstadoEtapa): EstadoEtapa {
  if (actual === "pendiente") return "en_curso";
  if (actual === "en_curso") return "completo";
  return "pendiente";
}

export async function actualizarEtapas(obraId: string, etapas: Etapa[]): Promise<void> {
  const { error } = await supabaseNavegador().from("obras").update({ etapas }).eq("id", obraId);
  if (error) fallar("actualizar la etapa", error);
}

export async function actualizarEjecutado(obraId: string, ejecutadoArs: number | null): Promise<void> {
  const { error } = await supabaseNavegador().from("obras").update({ ejecutado_ars: ejecutadoArs }).eq("id", obraId);
  if (error) fallar("actualizar lo ejecutado", error);
}

export async function borrarObra(obraId: string): Promise<void> {
  const { error } = await supabaseNavegador().from("obras").delete().eq("id", obraId);
  if (error) fallar("borrar la obra", error);
}

/* ---------- Invitar gente a la obra ----------
   Un link DISTINTO por rol, no uno solo por obra: el dueño elige de
   antemano si el link es para la arquitecta, un socio, etc. — quien
   lo abre no elige nada, el rol ya viene decidido. Ver
   db/31_roles_invitacion_obra.sql. */

export type RolInvitacion = "arquitecto" | "socio" | "contratista" | "otro";

export const ETIQUETA_ROL: Record<RolInvitacion, string> = {
  arquitecto: "Arquitecto/a",
  socio: "Socio/a",
  contratista: "Contratista",
  otro: "Otro",
};

export function linkInvitacionObra(codigo: string): string {
  return `${window.location.origin}/obras/unirse/${codigo}`;
}

/** Sólo el dueño puede llamar esto — lo valida la propia función en la base. */
export async function invitacionParaRol(
  obraId: string,
  rol: RolInvitacion,
  etiqueta?: string,
): Promise<string> {
  const { data, error } = await supabaseNavegador().rpc("invitacion_para_rol", {
    p_obra_id: obraId,
    p_rol: rol,
    p_etiqueta: etiqueta?.trim() || null,
  });
  if (error) fallar("generar el link de invitación", error);
  return data as string;
}

export async function unirseAObra(codigo: string): Promise<{ obraId: string; nombre: string }> {
  const { data, error } = await supabaseNavegador().rpc("unirse_a_obra", { p_codigo: codigo }).maybeSingle();
  if (error) {
    console.error("[obras] unirse a la obra:", error.message);
    // El mensaje de "código inválido" lo redacta la propia función de la
    // base para mostrarlo tal cual — cualquier otro error se generaliza.
    throw new Error(error.message.includes("no es válido") ? error.message : "No pudimos unirte a la obra. Probá de nuevo en un momento.");
  }
  if (!data) throw new Error("Ese link de invitación no es válido.");
  return { obraId: data.id_obra, nombre: data.nombre_obra };
}

/* ---------- Quién está en la obra ----------
   Nombre y rol de cada persona (dueño + colaboradores) — ver
   participantes_de_obra() en db/31_roles_invitacion_obra.sql.
   Se usa para firmar el chat y para mostrar la lista de colaboradores. */

export type ParticipanteObra = {
  usuarioId: string;
  nombre: string;
  esDueno: boolean;
  rol: RolInvitacion | null;
  etiqueta: string | null;
};

export async function participantesDeObra(obraId: string): Promise<ParticipanteObra[]> {
  const { data, error } = await supabaseNavegador().rpc("participantes_de_obra", { p_obra_id: obraId });
  if (error) fallar("cargar quién está en la obra", error);
  return (data ?? []).map(
    (f: { usuario_id: string; nombre: string; es_dueno: boolean; rol: string | null; etiqueta: string | null }) => ({
      usuarioId: f.usuario_id,
      nombre: f.nombre,
      esDueno: f.es_dueno,
      rol: f.rol as RolInvitacion | null,
      etiqueta: f.etiqueta,
    }),
  );
}

/** Etiqueta lista para mostrar junto al nombre: "Arquitecto/a", o el texto libre si rol es "otro". */
export function etiquetaParticipante(p: ParticipanteObra): string | null {
  if (p.esDueno) return "dueño/a";
  if (!p.rol) return null;
  if (p.rol === "otro" && p.etiqueta) return p.etiqueta;
  return ETIQUETA_ROL[p.rol];
}
