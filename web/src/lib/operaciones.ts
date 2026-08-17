/* ============================================================
   PANEL DE OPERACIONES — acceso a datos

   Mismo criterio que lib/datos.ts: las pantallas llaman a estas
   funciones, no saben nada de Supabase ni de nombres de columnas.
   Tampoco filtran por usuario a mano — acá menos que nunca hace
   falta: las políticas de db/02_permisos.sql y db/10_panel_operaciones.sql
   son las que deciden qué puede ver y tocar la cuenta de operaciones.
   Si alguien sin ese rol llama a estas funciones, la base devuelve
   cero filas (lectura) o rechaza el UPDATE (escritura) — no hay nada
   que este archivo tenga que reforzar.
   ============================================================ */

import { supabaseNavegador } from "./supabase/cliente";
import type { EstadoServicio } from "./tipos";

function fallar(contexto: string, error: { message: string }): never {
  console.error(`[operaciones] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

/* ---------- Lista ---------- */

export type ServicioLista = {
  id: string;
  categoriaSlug: string;
  categoriaNombre: string;
  clienteNombre: string;
  propiedadNombre: string;
  propiedadLocalidad: string;
  estado: EstadoServicio;
  creadoEl: string;
  montoArs: number | null;
};

type FilaServicioLista = {
  id: string;
  categoria_slug: string;
  estado: EstadoServicio;
  creado_el: string;
  monto_ars: number | null;
  categorias: { nombre: string } | null;
  propiedades: { nombre: string; localidad: string; perfiles: { nombre: string } | null } | null;
};

export async function listarTodosLosServicios(): Promise<ServicioLista[]> {
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .select(
      "id, categoria_slug, estado, creado_el, monto_ars, categorias(nombre), propiedades(nombre, localidad, perfiles(nombre))",
    )
    .order("creado_el", { ascending: false });

  if (error) fallar("cargar los pedidos", error);

  return ((data ?? []) as FilaServicioLista[]).map((f) => ({
    id: f.id,
    categoriaSlug: f.categoria_slug,
    categoriaNombre: f.categorias?.nombre ?? f.categoria_slug,
    clienteNombre: f.propiedades?.perfiles?.nombre ?? "—",
    propiedadNombre: f.propiedades?.nombre ?? "—",
    propiedadLocalidad: f.propiedades?.localidad ?? "",
    estado: f.estado,
    creadoEl: f.creado_el,
    montoArs: f.monto_ars,
  }));
}

/* ---------- Detalle ---------- */

export type FotoServicioOp = { id: string; url: string; momento: "antes" | "despues" };

export type EventoServicio = {
  id: string;
  estadoNuevo: EstadoServicio;
  estadoPrevio: EstadoServicio | null;
  nota: string | null;
  ocurrioEl: string;
};

export type EnrutamientoServicio = {
  estrategia: string;
  estado: "enviado" | "fallido";
  detalle: string | null;
  creadoEl: string;
};

export type ServicioDetalle = {
  id: string;
  categoriaSlug: string;
  categoriaNombre: string;
  descripcion: string;
  estado: EstadoServicio;
  montoArs: number | null;
  fechaPreferida: string | null;
  franjaPreferida: string | null;
  tecnicoId: string | null;
  creadoEl: string;
  cliente: { nombre: string; telefono: string | null };
  propiedad: {
    nombre: string;
    direccion: string;
    localidad: string;
    provincia: string;
    notasAcceso: string | null;
  };
  fotos: FotoServicioOp[];
  eventos: EventoServicio[];
  enrutamientos: EnrutamientoServicio[];
};

const BUCKET_FOTOS = "fotos-servicios";

export async function obtenerServicioOperaciones(id: string): Promise<ServicioDetalle | null> {
  const supabase = supabaseNavegador();

  const { data: servicio, error: errServicio } = await supabase
    .from("servicios")
    .select(
      "id, categoria_slug, descripcion, estado, monto_ars, fecha_preferida, franja_preferida, tecnico_id, creado_el, propiedad_id, cliente_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (errServicio) fallar("cargar el pedido", errServicio);
  if (!servicio) return null;

  const [{ data: categoria }, { data: propiedad }, { data: perfil }, { data: fotos }, { data: eventos }, { data: enrutamientos }] =
    await Promise.all([
      supabase.from("categorias").select("nombre").eq("slug", servicio.categoria_slug).maybeSingle(),
      supabase
        .from("propiedades")
        .select("nombre, calle, numero, localidad, provincia, notas_acceso")
        .eq("id", servicio.propiedad_id)
        .maybeSingle(),
      supabase.from("perfiles").select("nombre, telefono").eq("id", servicio.cliente_id).maybeSingle(),
      supabase
        .from("servicio_fotos")
        .select("id, archivo_path, momento")
        .eq("servicio_id", id)
        .order("creado_el"),
      supabase
        .from("servicio_eventos")
        .select("id, estado_nuevo, estado_previo, nota, ocurrio_el")
        .eq("servicio_id", id)
        .order("ocurrio_el", { ascending: false }),
      supabase
        .from("servicio_enrutamientos")
        .select("estrategia, estado, detalle, creado_el")
        .eq("servicio_id", id)
        .order("creado_el", { ascending: false }),
    ]);

  const fotosConUrl = await Promise.all(
    (fotos ?? []).map(async (f: { id: string; archivo_path: string; momento: string }) => {
      const { data: firmada } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(f.archivo_path, 3600);
      return { id: f.id, url: firmada?.signedUrl ?? "", momento: f.momento as "antes" | "despues" };
    }),
  );

  return {
    id: servicio.id,
    categoriaSlug: servicio.categoria_slug,
    categoriaNombre: categoria?.nombre ?? servicio.categoria_slug,
    descripcion: servicio.descripcion,
    estado: servicio.estado,
    montoArs: servicio.monto_ars,
    fechaPreferida: servicio.fecha_preferida,
    franjaPreferida: servicio.franja_preferida,
    tecnicoId: servicio.tecnico_id,
    creadoEl: servicio.creado_el,
    cliente: { nombre: perfil?.nombre ?? "—", telefono: perfil?.telefono ?? null },
    propiedad: {
      nombre: propiedad?.nombre ?? "—",
      direccion: [propiedad?.calle, propiedad?.numero].filter(Boolean).join(" "),
      localidad: propiedad?.localidad ?? "",
      provincia: propiedad?.provincia ?? "",
      notasAcceso: propiedad?.notas_acceso ?? null,
    },
    fotos: fotosConUrl.filter((f) => f.url),
    eventos: (
      (eventos ?? []) as Array<{
        id: string;
        estado_nuevo: EstadoServicio;
        estado_previo: EstadoServicio | null;
        nota: string | null;
        ocurrio_el: string;
      }>
    ).map((e) => ({
      id: e.id,
      estadoNuevo: e.estado_nuevo,
      estadoPrevio: e.estado_previo,
      nota: e.nota,
      ocurrioEl: e.ocurrio_el,
    })),
    enrutamientos: (
      (enrutamientos ?? []) as Array<{
        estrategia: string;
        estado: "enviado" | "fallido";
        detalle: string | null;
        creado_el: string;
      }>
    ).map((r) => ({ estrategia: r.estrategia, estado: r.estado, detalle: r.detalle, creadoEl: r.creado_el })),
  };
}

/* ---------- Técnicos para asignar ---------- */

export type TecnicoParaAsignar = {
  id: string;
  nombre: string;
  zonaCobertura: string[];
  promedio: number | null;
  trabajos: number;
};

type FilaTecnicoPublico = {
  id: string;
  nombre: string;
  zona_cobertura: string[] | null;
  promedio: number | null;
  trabajos: number;
};

/* Dos consultas y no un embed (tecnico_categorias → tecnicos_publico):
   tecnicos_publico es una VISTA, no tiene una relación de foreign key
   que PostgREST pueda inferir para hacer el join en una sola consulta.
   tecnicos_publico (02_permisos.sql) ya filtra por estado='verificado'
   y ya esconde CUIT/comisión — reusarla acá evita repetir ese filtro. */
export async function listarTecnicosParaCategoria(categoriaSlug: string): Promise<TecnicoParaAsignar[]> {
  const supabase = supabaseNavegador();

  const { data: filas, error: errFilas } = await supabase
    .from("tecnico_categorias")
    .select("tecnico_id")
    .eq("categoria_slug", categoriaSlug);
  if (errFilas) fallar("cargar los técnicos disponibles", errFilas);

  const ids = (filas ?? []).map((f: { tecnico_id: string }) => f.tecnico_id);
  if (ids.length === 0) return [];

  const { data: tecnicos, error: errTecnicos } = await supabase
    .from("tecnicos_publico")
    .select("id, nombre, zona_cobertura, promedio, trabajos")
    .in("id", ids);
  if (errTecnicos) fallar("cargar los técnicos disponibles", errTecnicos);

  return ((tecnicos ?? []) as FilaTecnicoPublico[])
    .map((t) => ({
      id: t.id,
      nombre: t.nombre,
      zonaCobertura: t.zona_cobertura ?? [],
      promedio: t.promedio,
      trabajos: t.trabajos,
    }))
    .sort((a, b) => b.trabajos - a.trabajos);
}

/* ---------- Escritura ---------- */

export type CambiosServicio = {
  estado?: EstadoServicio;
  tecnicoId?: string | null;
  montoArs?: number | null;
  fechaPreferida?: string | null;
  franjaPreferida?: string | null;
};

export async function actualizarServicioOperaciones(id: string, cambios: CambiosServicio): Promise<void> {
  const filas: Record<string, unknown> = {};
  if (cambios.estado !== undefined) filas.estado = cambios.estado;
  if (cambios.tecnicoId !== undefined) filas.tecnico_id = cambios.tecnicoId;
  if (cambios.montoArs !== undefined) filas.monto_ars = cambios.montoArs;
  if (cambios.fechaPreferida !== undefined) filas.fecha_preferida = cambios.fechaPreferida;
  if (cambios.franjaPreferida !== undefined) filas.franja_preferida = cambios.franjaPreferida;

  const { error } = await supabaseNavegador().from("servicios").update(filas).eq("id", id);
  if (error) fallar("actualizar el pedido", error);
}

/* ---------- Verificación de técnicos ---------- */
/* Hasta acá, una postulación para ser técnico (FormularioTrabajador)
   no llegaba a ningún lado visible — había que entrar a Supabase a
   mano para verla. La política de RLS ya dejaba leer todo esto
   (es_operaciones() en tecnicos/tecnico_documentos, 02_permisos.sql);
   sólo faltaba esta capa y la pantalla. */

export type SolicitudTecnico = {
  id: string;
  nombre: string;
  telefono: string | null;
  estado: "pendiente" | "verificado" | "suspendido" | "baja";
  categorias: string[];
  zonaCobertura: string[];
  creadoEl: string;
};

type FilaSolicitudTecnico = {
  id: string;
  estado: SolicitudTecnico["estado"];
  zona_cobertura: string[] | null;
  creado_el: string;
  perfiles: { nombre: string; telefono: string | null } | null;
};

export async function listarSolicitudesTecnico(): Promise<SolicitudTecnico[]> {
  const supabase = supabaseNavegador();
  const [{ data: tecnicos, error: errTecnicos }, { data: cats, error: errCats }] = await Promise.all([
    supabase
      .from("tecnicos")
      .select("id, estado, zona_cobertura, creado_el, perfiles(nombre, telefono)")
      .eq("estado", "pendiente")
      .order("creado_el", { ascending: false }),
    supabase.from("tecnico_categorias").select("tecnico_id, categoria_slug"),
  ]);
  if (errTecnicos) fallar("cargar las solicitudes de técnicos", errTecnicos);
  if (errCats) fallar("cargar los rubros de los técnicos", errCats);

  const categoriasPorTecnico = new Map<string, string[]>();
  for (const c of (cats ?? []) as Array<{ tecnico_id: string; categoria_slug: string }>) {
    const lista = categoriasPorTecnico.get(c.tecnico_id) ?? [];
    lista.push(c.categoria_slug);
    categoriasPorTecnico.set(c.tecnico_id, lista);
  }

  return ((tecnicos ?? []) as FilaSolicitudTecnico[]).map((f) => ({
    id: f.id,
    nombre: f.perfiles?.nombre ?? "—",
    telefono: f.perfiles?.telefono ?? null,
    estado: f.estado,
    categorias: categoriasPorTecnico.get(f.id) ?? [],
    zonaCobertura: f.zona_cobertura ?? [],
    creadoEl: f.creado_el,
  }));
}

export type DocumentoTecnico = { id: string; tipo: string; url: string; creadoEl: string };

export type SolicitudTecnicoDetalle = SolicitudTecnico & { documentos: DocumentoTecnico[] };

const BUCKET_DOCUMENTOS = "documentos-tecnicos";

export async function obtenerSolicitudTecnico(id: string): Promise<SolicitudTecnicoDetalle | null> {
  const supabase = supabaseNavegador();

  const { data: tecnico, error: errTecnico } = await supabase
    .from("tecnicos")
    .select("id, estado, zona_cobertura, creado_el, perfiles(nombre, telefono)")
    .eq("id", id)
    .maybeSingle();
  if (errTecnico) fallar("cargar la solicitud", errTecnico);
  if (!tecnico) return null;

  const [{ data: cats }, { data: documentos }] = await Promise.all([
    supabase.from("tecnico_categorias").select("categoria_slug").eq("tecnico_id", id),
    supabase
      .from("tecnico_documentos")
      .select("id, tipo, archivo_path, creado_el")
      .eq("tecnico_id", id)
      .order("creado_el"),
  ]);

  const documentosConUrl = await Promise.all(
    ((documentos ?? []) as Array<{ id: string; tipo: string; archivo_path: string | null; creado_el: string }>).map(
      async (d) => {
        if (!d.archivo_path) return { id: d.id, tipo: d.tipo, url: "", creadoEl: d.creado_el };
        const { data: firmada } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(d.archivo_path, 3600);
        return { id: d.id, tipo: d.tipo, url: firmada?.signedUrl ?? "", creadoEl: d.creado_el };
      },
    ),
  );

  const f = tecnico as unknown as FilaSolicitudTecnico;
  return {
    id: f.id,
    nombre: f.perfiles?.nombre ?? "—",
    telefono: f.perfiles?.telefono ?? null,
    estado: f.estado,
    categorias: ((cats ?? []) as Array<{ categoria_slug: string }>).map((c) => c.categoria_slug),
    zonaCobertura: f.zona_cobertura ?? [],
    creadoEl: f.creado_el,
    documentos: documentosConUrl.filter((d) => d.url),
  };
}

export async function verificarTecnico(id: string): Promise<void> {
  const { error } = await supabaseNavegador().from("tecnicos").update({ estado: "verificado" }).eq("id", id);
  if (error) fallar("verificar al técnico", error);
}

export async function rechazarTecnico(id: string): Promise<void> {
  const { error } = await supabaseNavegador().from("tecnicos").update({ estado: "baja" }).eq("id", id);
  if (error) fallar("rechazar al técnico", error);
}

/* Fila manual en la bitácora: no cambia el estado (estado_nuevo queda
   igual al actual), sólo dejauna nota. Para dejar registrado un motivo
   —por ejemplo, al reprogramar— sin que eso se confunda con un cambio
   real de estado. */
export async function agregarNotaServicio(
  id: string,
  nota: string,
  estadoActual: EstadoServicio,
): Promise<void> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { error } = await supabase.from("servicio_eventos").insert({
    servicio_id: id,
    estado_nuevo: estadoActual,
    estado_previo: estadoActual,
    actor_id: user.id,
    nota: nota.trim(),
  });
  if (error) fallar("guardar la nota", error);
}
