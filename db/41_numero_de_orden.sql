-- ============================================================
-- NORA — Número de orden legible para cada pedido
--
-- Sin cuentas ni "Mi historial", la referencia que un cliente le da a
-- soporte por teléfono tiene que ser corta y memorable — el UUID de
-- `servicios.id` no sirve para eso. Se agrega un entero secuencial
-- (arranca en 1000, no en 1: un "pedido #1004" se ve como una empresa
-- con volumen real, un "pedido #4" no).
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create sequence if not exists numero_orden_seq start with 1000;

alter table servicios
  add column if not exists numero_orden integer not null default nextval('numero_orden_seq');

comment on column servicios.numero_orden is
  'Número corto y secuencial para que el cliente lo use como referencia con soporte — no expone cuántos pedidos hubo en total de forma sensible, arranca en 1000.';

-- Por si esto corre una segunda vez sobre filas que ya tenían NULL
-- (no debería pasar, la columna nace con default) — deja todo
-- consistente igual.
update servicios set numero_orden = nextval('numero_orden_seq') where numero_orden is null;
