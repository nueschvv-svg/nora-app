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
  numero_orden: number;
  propiedad_id: string;
  categoria_slug: string;
  descripcion: string;
  estado: string;
  creado_el: string;
  fecha_preferida: string | null;
  franja_preferida: string | null;
  monto_ars: number | null;
  metodo_pago: string | null;
  pago_confirmado_el: string | null;
  reporte: string | null;
  estimado_desde_ars: number | null;
  estimado_hasta_ars: number | null;
};

/** Columnas de `servicios` que necesita el lado cliente — sin técnico. */
const COLUMNAS_SERVICIO =
  "id, numero_orden, propiedad_id, categoria_slug, descripcion, estado, creado_el, fecha_preferida, franja_preferida, monto_ars, metodo_pago, pago_confirmado_el, reporte, estimado_desde_ars, estimado_hasta_ars";

function aServicio(f: FilaServicio): Servicio {
  return {
    id: f.id,
    numeroOrden: f.numero_orden,
    propiedadId: f.propiedad_id,
    categoriaSlug: f.categoria_slug,
    descripcion: f.descripcion,
    estado: f.estado as Servicio["estado"],
    creadoEl: f.creado_el.slice(0, 10),
    fechaPreferida: f.fecha_preferida,
    franjaPreferida: f.franja_preferida,
    montoArs: f.monto_ars,
    metodoPago: f.metodo_pago as Servicio["metodoPago"],
    pagoConfirmadoEl: f.pago_confirmado_el,
    reporte: f.reporte ?? undefined,
    estimadoDesdeArs: f.estimado_desde_ars ?? undefined,
    estimadoHastaArs: f.estimado_hasta_ars ?? undefined,
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
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { data, error } = await supabase
    .from("propiedades")
    .select("id, nombre, calle, numero, localidad, provincia, icono")
    .eq("dueno_id", user.id)
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

/* Zona de cobertura actual — única fuente de verdad, usada tanto por el
   selector del wizard (/pedir) como acá abajo para validar antes de
   guardar. Si sólo viviera en el selector, un DevTools, un futuro
   segundo formulario de domicilio, o un llamado directo a
   crearPropiedad aceptarían en silencio una dirección fuera de la zona
   que hoy atendemos. */
export const PROVINCIAS_CUBIERTAS = ["CABA", "Buenos Aires"] as const;

/* Best-effort: si Nominatim no responde o no encuentra nada, seguimos
   sin lat/lng — nunca por esto se frena el alta de un domicilio. Ver
   api/geocodificar/route.ts. */
async function geocodificar(datos: NuevaPropiedad): Promise<{ lat: number | null; lng: number | null }> {
  try {
    const r = await fetch("/api/geocodificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calle: datos.calle,
        numero: datos.numero,
        localidad: datos.localidad,
        provincia: datos.provincia,
      }),
    });
    if (!r.ok) return { lat: null, lng: null };
    const { lat, lng } = (await r.json()) as { lat: number | null; lng: number | null };
    return { lat, lng };
  } catch {
    return { lat: null, lng: null };
  }
}

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

  if (!PROVINCIAS_CUBIERTAS.includes(datos.provincia.trim() as (typeof PROVINCIAS_CUBIERTAS)[number])) {
    throw new Error("Por ahora sólo cubrimos CABA y Buenos Aires.");
  }

  const { lat, lng } = await geocodificar(datos);

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
      latitud: lat,
      longitud: lng,
    })
    .select("id, nombre, calle, numero, localidad, provincia, icono")
    .single();

  if (error) fallar("guardar el domicilio", error);
  return aPropiedad(data as FilaPropiedad);
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
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { data, error } = await supabase
    .from("servicios")
    .select(COLUMNAS_SERVICIO)
    .eq("cliente_id", user.id)
    .order("creado_el", { ascending: false });

  if (error) fallar("cargar tus pedidos", error);
  return (data as FilaServicio[]).map(aServicio);
}

export type NuevoServicio = {
  /** UUID estable durante los reintentos; la PK de Postgres evita duplicados. */
  idIntento?: string;
  propiedadId: string;
  categoriaSlug: string;
  descripcion: string;
  fechaPreferida: string | null;
  franjaPreferida: string | null;
  /** El rango que Nora le mostró al cliente al pedir (lib/precios.ts) —
   *  para que el "Total" del detalle lo siga mostrando después, en vez
   *  de quedar en "A confirmar" hasta que haya un precio cerrado. */
  estimadoDesdeArs?: number | null;
  estimadoHastaArs?: number | null;
};

export async function crearServicio(datos: NuevoServicio): Promise<Servicio> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  /* Mandamos sólo el problema y la preferencia horaria. Los montos van
     vacíos: la política de la base rechaza el alta si viniera un precio
     ya puesto desde el navegador. (estimado_desde/hasta_ars no son "el
     precio" — son la referencia que ya vio el cliente, la política no
     los restringe.) El estado arranca en 'solicitado': operaciones lo ve
     al instante en su panel (suscribirseATodosLosServicios(),
     lib/operaciones.ts) y responde desde ahí — no hay bolsa a la que
     publicarse, no hay paso intermedio. */
  const { data, error } = await supabase
    .from("servicios")
    .insert({
      ...(datos.idIntento ? { id: datos.idIntento } : {}),
      cliente_id: user.id,
      propiedad_id: datos.propiedadId,
      categoria_slug: datos.categoriaSlug,
      descripcion: datos.descripcion.trim(),
      estado: "solicitado",
      fecha_preferida: datos.fechaPreferida,
      franja_preferida: datos.franjaPreferida,
      estimado_desde_ars: datos.estimadoDesdeArs ?? null,
      estimado_hasta_ars: datos.estimadoHastaArs ?? null,
    })
    .select(COLUMNAS_SERVICIO)
    .single();

  if (error && datos.idIntento) {
    // El INSERT pudo confirmarse aunque se perdiera la respuesta. Nunca
    // usar upsert: un reintento no debe modificar un pedido ya recibido.
    const { data: existente, error: errorLectura } = await supabase
      .from("servicios").select(COLUMNAS_SERVICIO)
      .eq("id", datos.idIntento).eq("cliente_id", user.id).maybeSingle();
    if (!errorLectura && existente) return aServicio(existente as FilaServicio);
  }
  if (error) fallar("enviar el pedido", error);
  return aServicio(data as FilaServicio);
}

/* Confirmar que se pagó en efectivo. Sólo esta transición puntual —
   "finalizado" con metodo_pago vacío pasa a "pagado" con
   metodo_pago='efectivo' — tiene permiso desde el navegador (ver
   db/22_confirmar_pago.sql); cualquier otro cambio a estos campos lo
   sigue rechazando la base, cliente no puede tocar precio ni marcarse
   pagado por otra vía. Mercado Pago todavía no llama a esta función:
   ese pago lo confirma un webhook de servidor, no el cliente. */
export async function confirmarPagoEfectivo(servicioId: string): Promise<Servicio> {
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .update({
      estado: "pagado",
      metodo_pago: "efectivo",
      pago_confirmado_el: new Date().toISOString(),
    })
    .eq("id", servicioId)
    .select(COLUMNAS_SERVICIO)
    .single();

  if (error) fallar("confirmar el pago", error);
  return aServicio(data as FilaServicio);
}

/* Responder al presupuesto que ofertó operaciones (ver
   db/39_eliminar_rol_tecnico.sql). Aceptar confirma el trabajo;
   rechazar vuelve a 'solicitado' — operaciones lo ve de nuevo en su
   panel y puede ofertar otro precio o rechazarlo del todo. */
export async function aceptarPresupuesto(servicioId: string): Promise<Servicio> {
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .update({ estado: "aceptado" })
    .eq("id", servicioId)
    .select(COLUMNAS_SERVICIO)
    .single();

  if (error) fallar("aceptar el presupuesto", error);
  return aServicio(data as FilaServicio);
}

export async function rechazarPresupuesto(servicioId: string): Promise<Servicio> {
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .update({ estado: "solicitado", monto_ars: null })
    .eq("id", servicioId)
    .select(COLUMNAS_SERVICIO)
    .single();

  if (error) fallar("rechazar el presupuesto", error);
  return aServicio(data as FilaServicio);
}

/* ---------- Calificación ---------- */
/* Un solo sentido (el cliente califica el servicio) desde el pivot
   sin técnico externo — ver db/39_eliminar_rol_tecnico.sql. Antes
   calificaba a "el técnico"; ahora califica el trabajo en general. */

export type MiCalificacion = { estrellas: number; comentario: string | null };

/** null si el cliente todavía no calificó este servicio. */
export async function miCalificacion(servicioId: string): Promise<MiCalificacion | null> {
  const { data, error } = await supabaseNavegador()
    .from("calificaciones")
    .select("estrellas, comentario")
    .eq("servicio_id", servicioId)
    .maybeSingle();
  if (error) fallar("cargar tu calificación", error);
  return data;
}

export async function calificarServicio(servicioId: string, estrellas: number, comentario: string): Promise<void> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { error } = await supabase.from("calificaciones").insert({
    servicio_id: servicioId,
    cliente_id: user.id,
    estrellas,
    comentario: comentario.trim() || null,
  });
  if (error) fallar("guardar tu calificación", error);
}

/* ---------- Fotos de servicio ---------- */
/* La tabla y sus permisos ya existían (01/02); lo que faltaba era el
   bucket real — ver db/08_fotos_storage.sql. Bucket privado: nunca se
   arma una URL fija, siempre se pide una firmada de corta duración. */

const BUCKET_FOTOS = "fotos-servicios";

export async function subirFotoServicio(servicioId: string, archivo: File): Promise<void> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  /* El primer tramo del path ES el permiso: las políticas de Storage
     (08_fotos_servicios.sql) leen storage.foldername(name)[1] como el
     id del servicio para decidir quién puede subir y ver el archivo. */
  const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
  const ruta = `${servicioId}/${crypto.randomUUID()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(ruta, archivo, { contentType: archivo.type });
  if (errorSubida) fallar("subir la foto", errorSubida);

  const { error: errorFila } = await supabase.from("servicio_fotos").insert({
    servicio_id: servicioId,
    archivo_path: ruta,
    subida_por: user.id,
    momento: "antes",
  });
  if (errorFila) fallar("guardar la foto en el servicio", errorFila);
}

export type FotoServicio = {
  id: string;
  url: string;
  momento: "antes" | "despues";
};

type FilaFotoServicio = {
  id: string;
  archivo_path: string;
  momento: string;
};

/* Una hora de vigencia: alcanza para que la persona abra el detalle y
   la mire, y no queda un link picoteable dando vueltas para siempre. */
const VIGENCIA_URL_FOTO = 3600;

export async function listarFotosServicio(servicioId: string): Promise<FotoServicio[]> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase
    .from("servicio_fotos")
    .select("id, archivo_path, momento")
    .eq("servicio_id", servicioId)
    .order("creado_el");

  if (error) fallar("cargar las fotos del servicio", error);
  const filas = (data ?? []) as FilaFotoServicio[];
  if (filas.length === 0) return [];

  const { data: firmadas, error: errorFirma } = await supabase.storage
    .from(BUCKET_FOTOS)
    .createSignedUrls(
      filas.map((f) => f.archivo_path),
      VIGENCIA_URL_FOTO,
    );
  if (errorFirma) fallar("preparar las fotos del servicio", errorFirma);

  return filas
    .map((f, i) => ({
      id: f.id,
      url: firmadas?.[i]?.signedUrl ?? "",
      momento: f.momento as "antes" | "despues",
    }))
    .filter((f) => f.url);
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
