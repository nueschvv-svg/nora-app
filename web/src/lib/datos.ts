/* ============================================================
   ACCESO A DATOS

   Todo lo que la app lee y escribe pasa por acá. Las pantallas llaman
   a estas funciones y no saben nada de Supabase, de SQL ni de nombres
   de columnas. Si mañana cambia la base, se toca este archivo y nada más.

   Un detalle que no es casual: ninguna de estas funciones filtra por
   usuario. No hace falta. Las políticas de la base (db/02_permisos.sql)
   ya devuelven únicamente lo que le corresponde a quien está pidiendo.
   Si el filtro estuviera acá, un error de programación lo saltearía;
   estando en la base, no hay forma de esquivarlo.
   ============================================================ */

import { supabaseNavegador } from "./supabase/cliente";
import { Equipo, Propiedad, Servicio, TipoEquipo } from "./tipos";

/* ---------- Traducción entre la base y la app ----------
   La base usa nombres_con_guion_bajo, el código usa nombresEnCamello.
   La conversión vive acá y en ningún otro lado. */

type FilaPropiedad = {
  id: string;
  nombre: string;
  calle: string;
  numero: string | null;
  localidad: string;
  provincia: string;
  icono: string;
};

function aPropiedad(f: FilaPropiedad): Propiedad {
  return {
    id: f.id,
    nombre: f.nombre,
    direccion: [f.calle, f.numero].filter(Boolean).join(" "),
    localidad: f.localidad,
    provincia: f.provincia,
    icono: (f.icono as Propiedad["icono"]) ?? "home",
  };
}

type FilaEquipo = {
  id: string;
  propiedad_id: string;
  tipo: string;
  apodo: string | null;
  marca: string | null;
  modelo: string | null;
  anio_instalacion: number | null;
  ultima_revision: string | null;
};

function aEquipo(f: FilaEquipo): Equipo {
  return {
    id: f.id,
    propiedadId: f.propiedad_id,
    tipo: f.tipo as TipoEquipo,
    apodo: f.apodo ?? undefined,
    marca: f.marca ?? undefined,
    modelo: f.modelo ?? undefined,
    anioInstalacion: f.anio_instalacion ?? undefined,
    ultimaRevision: f.ultima_revision ?? undefined,
  };
}

type FilaServicio = {
  id: string;
  propiedad_id: string;
  categoria_slug: string;
  descripcion: string;
  estado: string;
  creado_el: string;
  monto_ars: number | null;
  reporte: string | null;
};

function aServicio(f: FilaServicio): Servicio {
  return {
    id: f.id,
    propiedadId: f.propiedad_id,
    categoriaSlug: f.categoria_slug,
    descripcion: f.descripcion,
    estado: f.estado as Servicio["estado"],
    creadoEl: f.creado_el.slice(0, 10),
    montoArs: f.monto_ars,
    reporte: f.reporte ?? undefined,
  };
}

/* Un error de base no le sirve a nadie en pantalla ("duplicate key value
   violates unique constraint..."). Lo registramos para poder depurarlo y
   devolvemos algo legible. */
function fallar(contexto: string, error: { message: string }): never {
  console.error(`[datos] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

/* ---------- Propiedades ---------- */

export async function listarPropiedades(): Promise<Propiedad[]> {
  const { data, error } = await supabaseNavegador()
    .from("propiedades")
    .select("id, nombre, calle, numero, localidad, provincia, icono")
    .order("creado_el");

  if (error) fallar("cargar tus domicilios", error);
  return (data as FilaPropiedad[]).map(aPropiedad);
}

export type NuevaPropiedad = {
  nombre: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  icono: Propiedad["icono"];
};

export async function crearPropiedad(datos: NuevaPropiedad): Promise<Propiedad> {
  const supabase = supabaseNavegador();

  /* dueno_id lo ponemos explícito porque la política de la base exige que
     coincida con quien está logueado. Es la misma comprobación de los dos
     lados: acá para que la operación tenga sentido, en la base para que no
     se pueda saltear. */
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { data, error } = await supabase
    .from("propiedades")
    .insert({
      dueno_id: user.id,
      nombre: datos.nombre.trim(),
      calle: datos.calle.trim(),
      numero: datos.numero.trim() || null,
      localidad: datos.localidad.trim(),
      provincia: datos.provincia.trim(),
      icono: datos.icono,
    })
    .select("id, nombre, calle, numero, localidad, provincia, icono")
    .single();

  if (error) fallar("guardar el domicilio", error);
  return aPropiedad(data as FilaPropiedad);
}

export async function borrarPropiedad(id: string): Promise<void> {
  const { error } = await supabaseNavegador().from("propiedades").delete().eq("id", id);
  if (error) fallar("borrar el domicilio", error);
}

/* ---------- Equipos ---------- */

export async function listarEquipos(): Promise<Equipo[]> {
  const { data, error } = await supabaseNavegador()
    .from("equipos")
    .select("id, propiedad_id, tipo, apodo, marca, modelo, anio_instalacion, ultima_revision")
    .order("creado_el");

  if (error) fallar("cargar tus equipos", error);
  return (data as FilaEquipo[]).map(aEquipo);
}

export async function crearEquipo(equipo: Omit<Equipo, "id">): Promise<Equipo> {
  const { data, error } = await supabaseNavegador()
    .from("equipos")
    .insert({
      propiedad_id: equipo.propiedadId,
      tipo: equipo.tipo,
      apodo: equipo.apodo ?? null,
      marca: equipo.marca ?? null,
      modelo: equipo.modelo ?? null,
      anio_instalacion: equipo.anioInstalacion ?? null,
      ultima_revision: equipo.ultimaRevision ?? null,
    })
    .select("id, propiedad_id, tipo, apodo, marca, modelo, anio_instalacion, ultima_revision")
    .single();

  if (error) fallar("guardar el equipo", error);
  return aEquipo(data as FilaEquipo);
}

export async function borrarEquipo(id: string): Promise<void> {
  const { error } = await supabaseNavegador().from("equipos").delete().eq("id", id);
  if (error) fallar("borrar el equipo", error);
}

/* ---------- Servicios ---------- */

export async function listarServicios(): Promise<Servicio[]> {
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .select("id, propiedad_id, categoria_slug, descripcion, estado, creado_el, monto_ars, reporte")
    .order("creado_el", { ascending: false });

  if (error) fallar("cargar tu historial", error);
  return (data as FilaServicio[]).map(aServicio);
}

export type NuevoServicio = {
  propiedadId: string;
  categoriaSlug: string;
  descripcion: string;
  fechaPreferida: string | null;
  franjaPreferida: string | null;
};

export async function crearServicio(datos: NuevoServicio): Promise<Servicio> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  /* Mandamos sólo el problema y la preferencia horaria. El estado arranca
     en 'solicitado' y los montos van vacíos: la política de la base rechaza
     el alta si viniera un precio o un técnico ya puesto desde el navegador. */
  const { data, error } = await supabase
    .from("servicios")
    .insert({
      cliente_id: user.id,
      propiedad_id: datos.propiedadId,
      categoria_slug: datos.categoriaSlug,
      descripcion: datos.descripcion.trim(),
      estado: "solicitado",
      fecha_preferida: datos.fechaPreferida,
      franja_preferida: datos.franjaPreferida,
    })
    .select("id, propiedad_id, categoria_slug, descripcion, estado, creado_el, monto_ars, reporte")
    .single();

  if (error) fallar("enviar el pedido", error);
  return aServicio(data as FilaServicio);
}

/* ---------- Categorías ---------- */

export type CategoriaBD = {
  slug: string;
  nombre: string;
  icono: string;
  requiereMatricula: boolean;
  activa: boolean;
};

export async function listarCategorias(): Promise<CategoriaBD[]> {
  const { data, error } = await supabaseNavegador()
    .from("categorias")
    .select("slug, nombre, icono, requiere_matricula, activa")
    .order("orden");

  if (error) fallar("cargar los rubros", error);
  return (data as Array<{
    slug: string;
    nombre: string;
    icono: string;
    requiere_matricula: boolean;
    activa: boolean;
  }>).map((c) => ({
    slug: c.slug,
    nombre: c.nombre,
    icono: c.icono,
    requiereMatricula: c.requiere_matricula,
    activa: c.activa,
  }));
}
