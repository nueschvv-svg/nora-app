-- ============================================================
-- NORA — Guardar el estimado de precio como dato, no sólo como texto
--
-- Bug real, encontrado en vivo: el cliente ve un estimado al pedir
-- (lib/precios.ts, ya arreglado hoy para que siempre aparezca algo),
-- pero ese número sólo quedaba escrito como texto suelto adentro de
-- "El problema" (la línea "[Estimado de Nora] ..."). El campo "Total"
-- del detalle del pedido seguía diciendo "A confirmar" sin ninguna
-- referencia al estimado que la persona ACABA de ver — quedaba como
-- si nunca hubiera pasado nada.
--
-- Esta migración le da al estimado un lugar propio en la fila del
-- servicio, para que el Total lo pueda mostrar de verdad en vez de
-- quedar vacío hasta que haya un precio confirmado.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

alter table servicios add column if not exists estimado_desde_ars numeric(12,2);
alter table servicios add column if not exists estimado_hasta_ars numeric(12,2);

comment on column servicios.estimado_desde_ars is
  'Piso del estimado que vio el cliente al pedir (lib/precios.ts). Null si el pedido es de antes de este cambio, o si nunca hubo tarifa cargada para la categoría. Se reemplaza por monto_ars en cuanto hay un precio confirmado de verdad.';
comment on column servicios.estimado_hasta_ars is
  'Techo del mismo estimado — ver estimado_desde_ars.';
