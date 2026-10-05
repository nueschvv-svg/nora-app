import "server-only";

import { mapearCatalogo, type CasoEba, type FilaCatalogoEba } from "./antecedentes";

type ClienteConFrom = {
  from: (tabla: string) => {
    select: (columnas: string) => PromiseLike<{ data: unknown; error: unknown }>;
  };
};

/* Lee el archivo histórico de ENJINIA con la sesión de quien consulta: la
   tabla es de lectura pública y no tiene datos personales, pero usamos el
   mismo camino de permisos que el resto de la app.

   Si la tabla todavía no existe (entorno sin la migración 49), devolvemos
   lista vacía en vez de romper: sin antecedentes Nora sigue funcionando,
   simplemente no muestra historial. Es la diferencia entre un entorno
   incompleto y una app caída. */
export async function cargarCatalogoEba(cliente: ClienteConFrom): Promise<CasoEba[]> {
  const { data, error } = await cliente
    .from("catalogo_eba")
    .select(
      "id, familia, frecuencia, desperfecto_tipo, diagnostico_mas_comun, diagnosticos_alternativos, tarea_tipica",
    );

  if (error) {
    console.warn("[antecedentes] no se pudo leer catalogo_eba:", error);
    return [];
  }

  return mapearCatalogo((data ?? []) as FilaCatalogoEba[]);
}
