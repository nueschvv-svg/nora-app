import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { direccionConUnidad } from "@/lib/edificio";
import type { PedidoParaEnrutar } from "./tipos";

/** Datos persistidos: no depender de un body enviado por la pestaña. */
export async function cargarPedido(db: SupabaseClient, id: string): Promise<PedidoParaEnrutar> {
  const { data: servicio, error } = await db.from("servicios")
    .select("id, propiedad_id, cliente_id, categoria_slug, descripcion, fecha_preferida, franja_preferida")
    .eq("id", id).single();
  if (error || !servicio) throw new Error("No se pudo cargar el pedido.");
  const [propiedad, perfil, categoria, fotos] = await Promise.all([
    db.from("propiedades").select("calle, numero, localidad, provincia, notas_acceso, piso, unidad, sector15_uf, sector15_unidades(nucleo)").eq("id", servicio.propiedad_id).single(),
    db.from("perfiles").select("nombre, telefono").eq("id", servicio.cliente_id).single(),
    db.from("categorias").select("nombre").eq("slug", servicio.categoria_slug).single(),
    db.from("servicio_fotos").select("archivo_path").eq("servicio_id", id).order("creado_el", { ascending: false }).limit(1),
  ]);
  // No entregar un aviso sin dirección/contacto por un fallo de lectura.
  if (propiedad.error || perfil.error || categoria.error || fotos.error || !propiedad.data || !perfil.data) {
    throw new Error("No se pudieron cargar los datos del pedido.");
  }
  let fotoUrl: string | null = null;
  const rutaFoto = fotos.data?.[0]?.archivo_path;
  // La metadata fue escrita por el residente: no basta con que su fila
  // pertenezca al pedido. El cliente admin nunca debe firmar un path ajeno.
  const nombreFoto = typeof rutaFoto === "string" && rutaFoto.startsWith(`${id}/`) ? rutaFoto.slice(id.length + 1) : "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i.test(nombreFoto)) {
    const firma = await db.storage.from("fotos-servicios").createSignedUrl(rutaFoto, 3600);
    fotoUrl = firma.data?.signedUrl ?? null;
  }
  return {
    servicioId: servicio.id, categoriaNombre: categoria.data?.nombre ?? servicio.categoria_slug,
    descripcion: servicio.descripcion,
    diagnostico: { observaciones: "", riesgoInmediato: servicio.descripcion.includes("[RIESGO INMEDIATO]") },
    cliente: { nombre: perfil.data.nombre, telefono: perfil.data.telefono },
    propiedad: {
      direccion: direccionConUnidad(propiedad.data.calle, propiedad.data.numero, propiedad.data.piso, propiedad.data.unidad, (propiedad.data.sector15_unidades as unknown as {nucleo: string} | null)?.nucleo, propiedad.data.sector15_uf),
      localidad: propiedad.data.localidad, provincia: propiedad.data.provincia,
      notasAcceso: propiedad.data.notas_acceso,
    },
    fechaPreferida: servicio.fecha_preferida, franjaPreferida: servicio.franja_preferida, fotoUrl,
  };
}
