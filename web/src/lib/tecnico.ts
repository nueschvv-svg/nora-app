/* ============================================================
   TÉCNICO EN TERRENO — acceso a datos

   Mismo criterio que lib/datos.ts y lib/operaciones.ts: las pantallas
   llaman a estas funciones, no saben nada de Supabase.

   Con UNA excepción deliberada a la regla de lib/datos.ts de "nunca
   filtrar por usuario a mano": acá SÍ hace falta. `servicios` tiene dos
   políticas de SELECT que se combinan con OR (cliente_id = auth.uid(),
   tecnico_id = auth.uid()) — sin filtrar acá por tecnico_id, una cuenta
   que además pidió servicios como cliente vería esos mezclados con sus
   trabajos asignados. Mismo bug, mismo motivo, que el que se corrigió
   en listarServicios() esta misma sesión — documentado ahí también.
   ============================================================ */

import { supabaseNavegador } from "./supabase/cliente";
import type { EstadoServicio } from "./tipos";

function fallar(contexto: string, error: { message: string }): never {
  console.error(`[tecnico] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

async function idPropio(): Promise<string> {
  const {
    data: { user },
  } = await supabaseNavegador().auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");
  return user.id;
}

/* ---------- Lista ---------- */

export type TrabajoAsignado = {
  id: string;
  categoriaSlug: string;
  categoriaNombre: string;
  clienteNombre: string;
  propiedadNombre: string;
  propiedadLocalidad: string;
  estado: EstadoServicio;
  tecnicoConfirmadoEl: string | null;
  montoArs: number | null;
  creadoEl: string;
};

type FilaTrabajoAsignado = {
  id: string;
  categoria_slug: string;
  estado: EstadoServicio;
  tecnico_confirmado_el: string | null;
  monto_ars: number | null;
  creado_el: string;
  categorias: { nombre: string } | null;
  propiedades: { nombre: string; localidad: string; perfiles: { nombre: string } | null } | null;
};

export async function listarTrabajosAsignados(): Promise<TrabajoAsignado[]> {
  const uid = await idPropio();
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .select(
      "id, categoria_slug, estado, tecnico_confirmado_el, monto_ars, creado_el, categorias(nombre), propiedades(nombre, localidad, perfiles(nombre))",
    )
    .eq("tecnico_id", uid)
    .order("creado_el", { ascending: false });

  if (error) fallar("cargar tus trabajos", error);

  return ((data ?? []) as FilaTrabajoAsignado[]).map((f) => ({
    id: f.id,
    categoriaSlug: f.categoria_slug,
    categoriaNombre: f.categorias?.nombre ?? f.categoria_slug,
    clienteNombre: f.propiedades?.perfiles?.nombre ?? "—",
    propiedadNombre: f.propiedades?.nombre ?? "—",
    propiedadLocalidad: f.propiedades?.localidad ?? "",
    estado: f.estado,
    tecnicoConfirmadoEl: f.tecnico_confirmado_el,
    montoArs: f.monto_ars,
    creadoEl: f.creado_el,
  }));
}

/* ---------- Detalle ---------- */

export type FotoTrabajo = { id: string; url: string };

export type TrabajoDetalle = {
  id: string;
  categoriaSlug: string;
  categoriaNombre: string;
  descripcion: string;
  estado: EstadoServicio;
  montoArs: number | null;
  tecnicoConfirmadoEl: string | null;
  reporte: string | null;
  ubicacionLat: number | null;
  ubicacionLng: number | null;
  ubicacionActualizadaEl: string | null;
  creadoEl: string;
  clienteId: string;
  cliente: { nombre: string; telefono: string | null };
  /* null cuando el trabajo ya está "finalizado": la política de la base
     deja de mostrar la dirección en cuanto termina, a propósito (ver
     02_permisos.sql) — no es un error de esta función. */
  propiedad: { nombre: string; direccion: string; localidad: string; provincia: string } | null;
  fotos: FotoTrabajo[];
};

const BUCKET_FOTOS = "fotos-servicios";

export async function obtenerTrabajoTecnico(id: string): Promise<TrabajoDetalle | null> {
  const uid = await idPropio();
  const supabase = supabaseNavegador();

  const { data: servicio, error: errServicio } = await supabase
    .from("servicios")
    .select(
      "id, categoria_slug, descripcion, estado, monto_ars, tecnico_confirmado_el, reporte, ubicacion_lat, ubicacion_lng, ubicacion_actualizada_el, creado_el, propiedad_id, cliente_id",
    )
    .eq("id", id)
    .eq("tecnico_id", uid)
    .maybeSingle();

  if (errServicio) fallar("cargar el trabajo", errServicio);
  if (!servicio) return null;

  const [{ data: categoria }, { data: propiedad }, { data: perfil }, { data: fotos }] = await Promise.all([
    supabase.from("categorias").select("nombre").eq("slug", servicio.categoria_slug).maybeSingle(),
    supabase
      .from("propiedades")
      .select("nombre, calle, numero, localidad, provincia")
      .eq("id", servicio.propiedad_id)
      .maybeSingle(),
    supabase.from("perfiles").select("nombre, telefono").eq("id", servicio.cliente_id).maybeSingle(),
    supabase.from("servicio_fotos").select("id, archivo_path").eq("servicio_id", id).order("creado_el"),
  ]);

  const fotosConUrl = await Promise.all(
    ((fotos ?? []) as Array<{ id: string; archivo_path: string }>).map(async (f) => {
      const { data: firmada } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(f.archivo_path, 3600);
      return { id: f.id, url: firmada?.signedUrl ?? "" };
    }),
  );

  return {
    id: servicio.id,
    categoriaSlug: servicio.categoria_slug,
    categoriaNombre: categoria?.nombre ?? servicio.categoria_slug,
    descripcion: servicio.descripcion,
    estado: servicio.estado,
    montoArs: servicio.monto_ars,
    tecnicoConfirmadoEl: servicio.tecnico_confirmado_el,
    reporte: servicio.reporte,
    ubicacionLat: servicio.ubicacion_lat,
    ubicacionLng: servicio.ubicacion_lng,
    ubicacionActualizadaEl: servicio.ubicacion_actualizada_el,
    creadoEl: servicio.creado_el,
    clienteId: servicio.cliente_id,
    cliente: { nombre: perfil?.nombre ?? "—", telefono: perfil?.telefono ?? null },
    propiedad: propiedad
      ? {
          nombre: propiedad.nombre,
          direccion: [propiedad.calle, propiedad.numero].filter(Boolean).join(" "),
          localidad: propiedad.localidad,
          provincia: propiedad.provincia,
        }
      : null,
    fotos: fotosConUrl.filter((f) => f.url),
  };
}

/* ---------- Acciones ----------
   Funciones explícitas, una por movimiento — no un avanzarEstado()
   genérico. El técnico tiene sólo tres transiciones fijas; explícitas
   son más difíciles de usar mal que un walker genérico (ese patrón sí
   tiene sentido en operaciones, que cubre diez estados posibles). */

export async function aceptarTrabajo(id: string): Promise<void> {
  const { error } = await supabaseNavegador()
    .from("servicios")
    .update({ tecnico_confirmado_el: new Date().toISOString() })
    .eq("id", id);
  if (error) fallar("aceptar el trabajo", error);
}

/** Tercer camino además de aceptar/rechazar: ofertar un precio propio.
 *  El pedido pasa a "presupuestado" — el cliente lo tiene que aceptar
 *  antes de que el técnico pueda salir (ver db/23_ofertar_precio.sql).
 *  Sólo se puede desde "asignado", antes de aceptar. */
export async function ofertarPrecio(id: string, montoArs: number): Promise<void> {
  const { error } = await supabaseNavegador()
    .from("servicios")
    .update({ estado: "presupuestado", monto_ars: montoArs })
    .eq("id", id);
  if (error) fallar("enviar tu oferta", error);
}

export async function rechazarTrabajo(id: string): Promise<void> {
  const { error } = await supabaseNavegador()
    .from("servicios")
    .update({ tecnico_id: null, tecnico_confirmado_el: null, estado: "buscando_tecnico" })
    .eq("id", id);
  if (error) fallar("rechazar el trabajo", error);
}

export async function marcarEnCamino(id: string): Promise<void> {
  const { error } = await supabaseNavegador().from("servicios").update({ estado: "en_camino" }).eq("id", id);
  if (error) fallar("marcar que salís en camino", error);
}

export async function marcarEnCurso(id: string): Promise<void> {
  const { error } = await supabaseNavegador().from("servicios").update({ estado: "en_curso" }).eq("id", id);
  if (error) fallar("marcar que empezaste el trabajo", error);
}

/* El código lo dicta el cliente (lo tiene en su pantalla desde que hay
   técnico asignado, ver db/32_codigo_confirmacion.sql) — es la forma
   de que finalizar el trabajo no dependa sólo de que el técnico "diga"
   que terminó. Se valida acá mismo, sin trigger ni función aparte:
   sumamos el código al WHERE del UPDATE — si no coincide, no hay fila
   que matchee, la actualización afecta 0 filas y lo tratamos como
   código incorrecto. */
export async function marcarFinalizado(id: string, reporte: string, codigoConfirmacion: string): Promise<void> {
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .update({ estado: "finalizado", reporte: reporte.trim() })
    .eq("id", id)
    .eq("codigo_confirmacion", codigoConfirmacion.trim())
    .select("id");
  if (error) fallar("cerrar el trabajo", error);
  if (!data || data.length === 0) {
    throw new Error("Ese código no coincide. Pedíselo de nuevo al cliente.");
  }
}

export async function actualizarUbicacionTecnico(id: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabaseNavegador()
    .from("servicios")
    .update({ ubicacion_lat: lat, ubicacion_lng: lng, ubicacion_actualizada_el: new Date().toISOString() })
    .eq("id", id);
  if (error) fallar("compartir tu ubicación", error);
}

/* ---------- La bolsa: pedidos abiertos de tu rubro ----------
   Modelo Rappi (db/15_pool_tecnico.sql): cualquier técnico verificado
   y disponible puede ver y tomar un pedido "buscando_tecnico" de un
   rubro que ofrece — no hace falta que operaciones se lo asigne.

   Filtro explícito abajo, aunque parezca redundante con la política
   nueva de SELECT: hay OTRA política activa a la vez para el mismo
   técnico ("el técnico ve los servicios que le asignaron",
   tecnico_id = auth.uid()), y RLS combina políticas de SELECT con OR.
   Sin este filtro, un pedido que YA es tuyo (en cualquier estado)
   también aparecería mezclado acá, en "Disponibles" — lo encontré
   probando esto mismo en vivo. Mismo motivo, mismo patrón, que ya
   está documentado en listarServicios() y arriba en este archivo. */

export type PedidoAbierto = {
  id: string;
  categoriaSlug: string;
  categoriaNombre: string;
  propiedadLocalidad: string;
  descripcion: string;
  creadoEl: string;
  /** null si a vos o al pedido les falta ubicación cargada — igual se muestra, al final de la lista. */
  distanciaKm: number | null;
};

type FilaPedidoAbierto = {
  id: string;
  categoria_slug: string;
  categoria_nombre: string | null;
  propiedad_localidad: string | null;
  descripcion: string;
  creado_el: string;
  distancia_km: number | null;
};

/* Antes esto era un select directo a `servicios` con join a
   `propiedades(localidad)` — pero la política de RLS que deja ver la
   dirección sólo se activa DESPUÉS de tomar el pedido (tecnico_id =
   auth.uid()), así que el join siempre volvía null acá y la app
   mostraba "Zona sin cargar" para todo. Se usa un RPC en su lugar
   (db/20_zona_bolsa_tecnico.sql): misma autorización que la política
   de la bolsa, pero expone sólo localidad — nunca calle ni número —
   antes de aceptar el trabajo. */
export async function listarPedidosAbiertos(): Promise<PedidoAbierto[]> {
  const { data, error } = await supabaseNavegador().rpc("pedidos_abiertos_para_tecnico");

  if (error) fallar("cargar los pedidos disponibles", error);

  return ((data ?? []) as FilaPedidoAbierto[]).map((f) => ({
    id: f.id,
    categoriaSlug: f.categoria_slug,
    categoriaNombre: f.categoria_nombre ?? f.categoria_slug,
    propiedadLocalidad: f.propiedad_localidad ?? "",
    descripcion: f.descripcion,
    creadoEl: f.creado_el,
    distanciaKm: f.distancia_km,
  }));
}

/** Tomar un pedido de la bolsa: lo asigna Y lo acepta en el mismo
 *  movimiento (ver validar_reclamo_tecnico en la base). Si otro técnico
 *  lo tomó un instante antes, la fila ya no cumple la condición de la
 *  política y el UPDATE no afecta ninguna fila — sin error, pero sin
 *  efecto; por eso se chequea explícitamente. */
export async function tomarTrabajo(id: string): Promise<void> {
  const uid = await idPropio();
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .update({ tecnico_id: uid, tecnico_confirmado_el: new Date().toISOString(), estado: "asignado" })
    .eq("id", id)
    .eq("estado", "buscando_tecnico")
    .is("tecnico_id", null)
    .select("id");

  if (error) fallar("tomar el pedido", error);
  if (!data || data.length === 0) throw new Error("Alguien más ya tomó este pedido.");
}

/** Devuelve una función para cancelar la suscripción. RLS ya limita lo
 *  que llega: sólo pedidos "buscando_tecnico" que este técnico puede
 *  ver (rubro propio, verificado, disponible). */
export function suscribirseAPedidosAbiertos(alCambio: () => void): () => void {
  const supabase = supabaseNavegador();
  const canal = supabase
    .channel("pool-tecnico")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "servicios", filter: "estado=eq.buscando_tecnico" },
      alCambio,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
