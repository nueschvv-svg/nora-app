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
  fecha_preferida: string | null;
  franja_preferida: string | null;
  monto_ars: number | null;
  metodo_pago: string | null;
  pago_confirmado_el: string | null;
  reporte: string | null;
  tecnico_id: string | null;
  tecnico_confirmado_el: string | null;
  ubicacion_lat: number | null;
  ubicacion_lng: number | null;
  ubicacion_actualizada_el: string | null;
  codigo_confirmacion: string | null;
};

function aServicio(f: FilaServicio): Servicio {
  return {
    id: f.id,
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
    tecnicoId: f.tecnico_id ?? undefined,
    tecnicoConfirmadoEl: f.tecnico_confirmado_el ?? undefined,
    ubicacionLat: f.ubicacion_lat ?? undefined,
    ubicacionLng: f.ubicacion_lng ?? undefined,
    codigoConfirmacion: f.codigo_confirmacion ?? undefined,
    ubicacionActualizadaEl: f.ubicacion_actualizada_el ?? undefined,
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

  /* Excepción deliberada a "nunca filtrar a mano" (ver encabezado del
     archivo): `propiedades` tiene una política extra que además le
     deja ver la dirección al técnico con un trabajo activo ahí. Sin
     este filtro, "Tus domicilios" le mezclaría a un técnico la
     dirección ajena de un pedido que tiene asignado — no es suya, y
     un pedido nuevo con esa dirección la base lo rechaza (RLS bien
     hecho, pero un error confuso en pantalla). Encontrado en vivo. */
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

/* TODAVÍA NO SE USA — ninguna pantalla la llama.
   La dejo escrita pero sin botón a propósito: borrar un domicilio que
   tiene servicios hechos no es obvio. ¿Se borra el historial también?
   ¿Y la factura de un trabajo que el cliente pagó? Lo más probable es que
   convenga ocultarlo en vez de borrarlo. Es una decisión de producto,
   no técnica, y prefiero no resolverla por mi cuenta. */
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
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  /* Excepción deliberada a la regla de este archivo (nunca filtrar a
     mano): `servicios` tiene DOS políticas de SELECT que se combinan
     con OR (cliente_id = auth.uid(), tecnico_id = auth.uid()). Sin este
     filtro, una cuenta que también es técnico vería acá los trabajos
     que le asignaron, no sólo los que ella pidió como cliente — bug
     real, encontrado y corregido en esta misma sesión. Esos trabajos
     van en /tecnico, no en este Historial personal. */
  const { data, error } = await supabase
    .from("servicios")
    .select(
      "id, propiedad_id, categoria_slug, descripcion, estado, creado_el, fecha_preferida, franja_preferida, monto_ars, metodo_pago, pago_confirmado_el, reporte, tecnico_id, tecnico_confirmado_el, ubicacion_lat, ubicacion_lng, ubicacion_actualizada_el, codigo_confirmacion",
    )
    .eq("cliente_id", user.id)
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
    .select(
      "id, propiedad_id, categoria_slug, descripcion, estado, creado_el, fecha_preferida, franja_preferida, monto_ars, metodo_pago, pago_confirmado_el, reporte, tecnico_id, tecnico_confirmado_el, ubicacion_lat, ubicacion_lng, ubicacion_actualizada_el, codigo_confirmacion",
    )
    .single();

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
    .select(
      "id, propiedad_id, categoria_slug, descripcion, estado, creado_el, fecha_preferida, franja_preferida, monto_ars, metodo_pago, pago_confirmado_el, reporte, tecnico_id, tecnico_confirmado_el, ubicacion_lat, ubicacion_lng, ubicacion_actualizada_el, codigo_confirmacion",
    )
    .single();

  if (error) fallar("confirmar el pago", error);
  return aServicio(data as FilaServicio);
}

/* Responder al presupuesto que ofertó el técnico (ver
   db/23_ofertar_precio.sql). Aceptar deja el pedido listo para que el
   técnico salga; rechazar lo devuelve a la bolsa tal cual estaba antes
   de que este técnico lo tomara — cualquier otro lo puede tomar u
   ofertar de nuevo. */
export async function aceptarPresupuesto(servicioId: string): Promise<Servicio> {
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .update({ estado: "aceptado" })
    .eq("id", servicioId)
    .select(
      "id, propiedad_id, categoria_slug, descripcion, estado, creado_el, fecha_preferida, franja_preferida, monto_ars, metodo_pago, pago_confirmado_el, reporte, tecnico_id, tecnico_confirmado_el, ubicacion_lat, ubicacion_lng, ubicacion_actualizada_el, codigo_confirmacion",
    )
    .single();

  if (error) fallar("aceptar el presupuesto", error);
  return aServicio(data as FilaServicio);
}

export async function rechazarPresupuesto(servicioId: string): Promise<Servicio> {
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .update({ estado: "buscando_tecnico", tecnico_id: null, monto_ars: null })
    .eq("id", servicioId)
    .select(
      "id, propiedad_id, categoria_slug, descripcion, estado, creado_el, fecha_preferida, franja_preferida, monto_ars, metodo_pago, pago_confirmado_el, reporte, tecnico_id, tecnico_confirmado_el, ubicacion_lat, ubicacion_lng, ubicacion_actualizada_el, codigo_confirmacion",
    )
    .single();

  if (error) fallar("rechazar el presupuesto", error);
  return aServicio(data as FilaServicio);
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
