/* ============================================================
   ACCESO A DATOS — Trabajadores

   Alta propia como prestador de servicios y matching por cercanía.
   Mismas reglas que lib/datos.ts: las pantallas llaman a estas
   funciones, no saben nada de Supabase ni de nombres de columnas, y
   ninguna filtra por usuario a mano — eso ya lo hacen las políticas de
   db/07_trabajadores.sql.
   ============================================================ */

import { supabaseNavegador } from "./supabase/cliente";

function fallar(contexto: string, error: { message: string }): never {
  console.error(`[trabajadores] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

/* ---------- Mi ficha de trabajador ---------- */

export type EstadoTrabajador = "pendiente" | "verificado" | "suspendido" | "baja";

export type DatosTrabajador = {
  telefono: string;
  categorias: string[];
  zonaCobertura: string[];
  radioKm: number;
  disponible: boolean;
  latitud: number | null;
  longitud: number | null;
};

export type MiFichaTrabajador = DatosTrabajador & {
  estado: EstadoTrabajador;
  /** URL pública (bucket fotos-perfil-tecnico) o null si todavía no cargó una. */
  fotoPerfilUrl: string | null;
};

type FilaTecnico = {
  estado: EstadoTrabajador;
  zona_cobertura: string[] | null;
  radio_km: number | null;
  disponible: boolean;
  latitud: number | null;
  longitud: number | null;
  foto_perfil_path: string | null;
};

/** null si la persona todavía no se dio de alta como trabajador. */
export async function miFichaTrabajador(): Promise<MiFichaTrabajador | null> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: tecnico, error: errTecnico }, { data: cats, error: errCats }, { data: perfil }] =
    await Promise.all([
      supabase
        .from("tecnicos")
        .select("estado, zona_cobertura, radio_km, disponible, latitud, longitud, foto_perfil_path")
        .maybeSingle(),
      supabase.from("tecnico_categorias").select("categoria_slug"),
      supabase.from("perfiles").select("telefono").eq("id", user.id).maybeSingle(),
    ]);

  if (errTecnico) fallar("cargar tu ficha de trabajador", errTecnico);
  if (!tecnico) return null;
  if (errCats) fallar("cargar tus rubros", errCats);

  const f = tecnico as FilaTecnico;
  return {
    estado: f.estado,
    telefono: perfil?.telefono ?? "",
    categorias: (cats ?? []).map((c: { categoria_slug: string }) => c.categoria_slug),
    zonaCobertura: f.zona_cobertura ?? [],
    radioKm: f.radio_km ?? 15,
    disponible: f.disponible,
    latitud: f.latitud,
    longitud: f.longitud,
    fotoPerfilUrl: f.foto_perfil_path
      ? supabase.storage.from(BUCKET_FOTO_PERFIL).getPublicUrl(f.foto_perfil_path).data.publicUrl
      : null,
  };
}

/* Alta o edición. Usa upsert en `tecnicos` para que sea seguro
   reintentar: si el paso anterior se cortó a mitad de camino (por
   ejemplo, se guardó la ficha pero falló el guardado de los rubros),
   volver a enviar el formulario no choca con una fila que ya existe. */
export async function guardarTrabajador(datos: DatosTrabajador): Promise<void> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { error: errPerfil } = await supabase
    .from("perfiles")
    .update({ telefono: datos.telefono.trim() })
    .eq("id", user.id);
  if (errPerfil) fallar("guardar tu teléfono", errPerfil);

  const { error: errTecnico } = await supabase.from("tecnicos").upsert({
    id: user.id,
    zona_cobertura: datos.zonaCobertura,
    radio_km: datos.radioKm,
    disponible: datos.disponible,
    latitud: datos.latitud,
    longitud: datos.longitud,
  });
  if (errTecnico) fallar("guardar tu ficha de trabajador", errTecnico);

  // Reemplazo completo de los rubros: se borran los que había y se
  // cargan los elegidos ahora. Más simple que calcular la diferencia,
  // y acá el volumen (unos pocos rubros) no lo justifica.
  const { error: errBorrar } = await supabase.from("tecnico_categorias").delete().eq("tecnico_id", user.id);
  if (errBorrar) fallar("actualizar tus rubros", errBorrar);

  if (datos.categorias.length > 0) {
    const filas = datos.categorias.map((slug) => ({ tecnico_id: user.id, categoria_slug: slug }));
    const { error: errCats } = await supabase.from("tecnico_categorias").insert(filas);
    if (errCats) fallar("guardar tus rubros", errCats);
  }
}

/* ---------- Documentos de verificación ---------- */
/* DNI (frente y dorso), una selfie, y opcionalmente algo que muestre
   matrícula o título — lo que operaciones necesita para verificar a
   alguien sin depender sólo de una llamada telefónica. Bucket privado,
   ver db/14_documentos_tecnico_storage.sql: sólo el propio técnico y
   operaciones pueden llegar a estos archivos. */

export type TipoDocumentoTecnico = "dni_frente" | "dni_dorso" | "selfie" | "matricula";

const BUCKET_DOCUMENTOS = "documentos-tecnicos";

/* ---------- Foto de perfil (pública) ----------
   Distinta de la selfie de arriba: esa es privada, sólo para que
   operaciones verifique identidad. Esta es la que el cliente ve en su
   pedido cuando le asignan técnico — bucket público, ver
   db/21_foto_perfil_tecnico.sql. */

const BUCKET_FOTO_PERFIL = "fotos-perfil-tecnico";

/** Siempre el mismo nombre de archivo por técnico ({id}/perfil.ext):
 *  subir una foto nueva reemplaza la anterior, no acumula huérfanas. */
export async function subirFotoPerfilTecnico(archivo: File): Promise<string> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
  const ruta = `${user.id}/perfil.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_FOTO_PERFIL)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: true });
  if (errorSubida) fallar("subir tu foto de perfil", errorSubida);

  const { error: errorFila } = await supabase
    .from("tecnicos")
    .update({ foto_perfil_path: ruta })
    .eq("id", user.id);
  if (errorFila) fallar("guardar tu foto de perfil", errorFila);

  return supabase.storage.from(BUCKET_FOTO_PERFIL).getPublicUrl(ruta).data.publicUrl;
}

export async function subirDocumentoTecnico(tipo: TipoDocumentoTecnico, archivo: File): Promise<void> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
  const ruta = `${user.id}/${tipo}-${crypto.randomUUID()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(ruta, archivo, { contentType: archivo.type });
  if (errorSubida) fallar("subir el documento", errorSubida);

  const { error: errorFila } = await supabase
    .from("tecnico_documentos")
    .insert({ tecnico_id: user.id, tipo, archivo_path: ruta });
  if (errorFila) fallar("guardar el documento", errorFila);
}

/* ---------- Quién es mi técnico (lado cliente) ---------- */
/* `perfiles` no se puede leer de nadie más que uno mismo (02_permisos.sql,
   a propósito) — este RPC es la excepción autorizada: sólo devuelve
   algo si quien llama es el cliente dueño de ESE pedido, y sólo si ya
   tiene técnico asignado. Ver db/21_foto_perfil_tecnico.sql. */

export type TecnicoDeServicio = {
  nombre: string;
  fotoUrl: string | null;
  /** null hasta que tenga al menos una calificación. */
  promedio: number | null;
  trabajos: number;
};

export async function tecnicoDeServicio(servicioId: string): Promise<TecnicoDeServicio | null> {
  const supabase = supabaseNavegador();
  const { data, error } = await supabase.rpc("tecnico_de_mi_servicio", { p_servicio_id: servicioId });
  if (error) fallar("cargar los datos del técnico", error);

  const fila = (
    data as
      | { nombre: string; foto_perfil_path: string | null; promedio: number | null; trabajos: number }[]
      | null
  )?.[0];
  if (!fila) return null;

  return {
    nombre: fila.nombre,
    fotoUrl: fila.foto_perfil_path
      ? supabase.storage.from(BUCKET_FOTO_PERFIL).getPublicUrl(fila.foto_perfil_path).data.publicUrl
      : null,
    promedio: fila.promedio,
    trabajos: fila.trabajos,
  };
}

/* ---------- Calificaciones ----------
   La tabla y sus permisos ya existían desde el principio
   (01_esquema.sql, 02_permisos.sql): sólo el cliente, sólo sobre un
   servicio propio, sólo cuando terminó de verdad. Nunca se había
   conectado del lado de ninguna pantalla — ver db/24_calificaciones.sql. */

export type MiCalificacion = { estrellas: number; comentario: string | null };

/** null si todavía no calificó este servicio. */
export async function miCalificacion(servicioId: string): Promise<MiCalificacion | null> {
  const { data, error } = await supabaseNavegador()
    .from("calificaciones")
    .select("estrellas, comentario")
    .eq("servicio_id", servicioId)
    .maybeSingle();
  if (error) fallar("cargar tu calificación", error);
  return data;
}

export async function calificarServicio(
  servicioId: string,
  tecnicoId: string,
  estrellas: number,
  comentario: string,
): Promise<void> {
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { error } = await supabase.from("calificaciones").insert({
    servicio_id: servicioId,
    cliente_id: user.id,
    tecnico_id: tecnicoId,
    estrellas,
    comentario: comentario.trim() || null,
  });
  if (error) fallar("guardar tu calificación", error);
}

/* ---------- Matching por cercanía ---------- */
/* Consumido hoy por pruebas/matching.mjs y, más adelante, por el panel
   de operaciones al asignar un técnico a un pedido (ver ESTADO.md). */

export type TrabajadorCercano = {
  id: string;
  nombre: string;
  distanciaKm: number;
  promedio: number | null;
  trabajos: number;
};

type FilaTrabajadorCercano = {
  tecnico_id: string;
  nombre: string;
  distancia_km: number;
  promedio: number | null;
  trabajos: number;
};

export async function buscarTrabajadoresCercanos(params: {
  categoriaSlug: string;
  lat: number;
  lng: number;
  radioKm?: number;
  limite?: number;
}): Promise<TrabajadorCercano[]> {
  const { data, error } = await supabaseNavegador().rpc("tecnicos_cercanos", {
    p_categoria_slug: params.categoriaSlug,
    p_lat: params.lat,
    p_lng: params.lng,
    p_radio_km: params.radioKm ?? 30,
    p_limite: params.limite ?? 20,
  });
  if (error) fallar("buscar trabajadores cercanos", error);

  return (data as FilaTrabajadorCercano[]).map((f) => ({
    id: f.tecnico_id,
    nombre: f.nombre,
    distanciaKm: Number(f.distancia_km),
    promedio: f.promedio,
    trabajos: f.trabajos,
  }));
}
