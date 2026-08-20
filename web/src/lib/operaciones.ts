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

   Sin técnico externo (ver db/39_eliminar_rol_tecnico.sql): cada
   pedido lo gestiona directo operaciones — acepta, rechaza u oferta
   un precio, y avanza el trabajo él mismo.

   CONCURRENCIA: la cuenta de operaciones es única y compartida —
   puede haber más de una persona logueada al mismo tiempo, mirando y
   actuando sobre los mismos pedidos. Cada función de escritura de acá
   abajo condiciona su UPDATE al estado que esperaba encontrar
   (`.eq("estado", estadoEsperado)`) — si otra sesión ya movió el
   pedido, el UPDATE no afecta ninguna fila (0 rows) y se lanza
   ConflictoConcurrencia en vez de fingir que funcionó. "Primer click
   gana": la persona que actuó primero ve su cambio confirmado: la
   segunda ve un aviso claro y el estado real, no un error genérico.
   Mismo patrón que ya se usaba para que un técnico reclamara un
   pedido de la bolsa (tomarTrabajo(), ahora eliminado). */

import { supabaseNavegador } from "./supabase/cliente";
import type { EstadoServicio } from "./tipos";

function fallar(contexto: string, error: { message: string }): never {
  console.error(`[operaciones] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

/** Alguien más (otra sesión de la misma cuenta de operaciones) ya
 *  actuó sobre este pedido antes de que llegara este UPDATE — el
 *  0 filas afectadas es la señal. Distinto de un error de red o de
 *  base: acá lo único que hace falta es refrescar y mostrar el estado
 *  real, no reintentar el mismo cambio. */
export class ConflictoConcurrencia extends Error {
  constructor() {
    super("Alguien más ya actualizó este pedido. Mirá el estado actual antes de seguir.");
    this.name = "ConflictoConcurrencia";
  }
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

/** Todas las sesiones de operaciones mirando la lista se enteran al
 *  instante de cualquier pedido nuevo o cambio de estado — de
 *  cualquier otra sesión, incluida la propia cuenta compartida desde
 *  otro dispositivo. */
export function suscribirseATodosLosServicios(alCambio: () => void): () => void {
  const supabase = supabaseNavegador();
  const canal = supabase
    .channel("operaciones-servicios")
    .on("postgres_changes", { event: "*", schema: "public", table: "servicios" }, () => alCambio())
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
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
  metodoPago: "efectivo" | "mercado_pago" | null;
  fechaPreferida: string | null;
  franjaPreferida: string | null;
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
      "id, categoria_slug, descripcion, estado, monto_ars, metodo_pago, fecha_preferida, franja_preferida, creado_el, propiedad_id, cliente_id",
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
    metodoPago: servicio.metodo_pago,
    fechaPreferida: servicio.fecha_preferida,
    franjaPreferida: servicio.franja_preferida,
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

/* ---------- Acciones sobre un pedido — todas condicionadas al estado
   esperado, para que dos sesiones de operaciones actuando a la vez no
   se pisen (ver ConflictoConcurrencia arriba). ---------- */

/** UPDATE genérico interno: condiciona al estado esperado y traduce
 *  "0 filas afectadas" a ConflictoConcurrencia. Ninguna función
 *  pública de acá abajo expone esto directo — cada una arma su propio
 *  objeto de cambios, explícito, para que sea imposible mandar un
 *  campo de más por error. */
async function actualizarCondicionado(
  id: string,
  estadoEsperado: EstadoServicio,
  cambios: Record<string, unknown>,
  contexto: string,
): Promise<void> {
  const { data, error } = await supabaseNavegador()
    .from("servicios")
    .update(cambios)
    .eq("id", id)
    .eq("estado", estadoEsperado)
    .select("id");

  if (error) fallar(contexto, error);
  if (!data || data.length === 0) throw new ConflictoConcurrencia();
}

/** Aceptar un pedido "solicitado" directo, con precio confirmado —
 *  sin pasar por un presupuesto que el cliente tenga que aprobar. */
export async function aceptarPedidoDirecto(id: string, montoArs: number): Promise<void> {
  await actualizarCondicionado(id, "solicitado", { estado: "aceptado", monto_ars: montoArs }, "aceptar el pedido");
}

/** Ofertar un precio: el pedido pasa a "presupuestado", y el cliente
 *  decide si lo acepta o lo rechaza desde su propio pedido. */
export async function ofertarPrecio(id: string, montoArs: number): Promise<void> {
  await actualizarCondicionado(
    id,
    "solicitado",
    { estado: "presupuestado", monto_ars: montoArs },
    "enviar el presupuesto",
  );
}

/** Rechazar un pedido recién solicitado — no se puede resolver. */
export async function rechazarPedido(id: string, motivo: string): Promise<void> {
  await actualizarCondicionado(id, "solicitado", { estado: "cancelado" }, "rechazar el pedido");
  await agregarNotaServicio(id, motivo, "cancelado");
}

/** Avanzar la secuencia normal (aceptado → en_camino → en_curso →
 *  finalizado) un paso por vez — mismo criterio de antes: nada de
 *  saltos raros de estado. */
export async function avanzarEstado(id: string, estadoActual: EstadoServicio, proximoEstado: EstadoServicio): Promise<void> {
  await actualizarCondicionado(id, estadoActual, { estado: proximoEstado }, "actualizar el pedido");
}

/** Cancelar desde cualquier punto anterior a "en_curso" — misma regla
 *  que ya regía para el cliente, disponible también para operaciones. */
export async function cancelarPedido(id: string, estadoActual: EstadoServicio): Promise<void> {
  await actualizarCondicionado(id, estadoActual, { estado: "cancelado" }, "cancelar el pedido");
}

export async function editarPrecio(id: string, estadoActual: EstadoServicio, montoArs: number | null): Promise<void> {
  await actualizarCondicionado(id, estadoActual, { monto_ars: montoArs }, "actualizar el precio");
}

export async function reprogramarPedido(
  id: string,
  estadoActual: EstadoServicio,
  fechaPreferida: string | null,
  franjaPreferida: string | null,
): Promise<void> {
  await actualizarCondicionado(
    id,
    estadoActual,
    { fecha_preferida: fechaPreferida, franja_preferida: franjaPreferida },
    "reprogramar el pedido",
  );
}

/* Fila manual en la bitácora: no cambia el estado (estado_nuevo queda
   igual al actual), sólo deja una nota. Para dejar registrado un
   motivo —por ejemplo al reprogramar, o al rechazar un pedido— sin
   que eso se confunda con el cambio de estado en sí. */
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
