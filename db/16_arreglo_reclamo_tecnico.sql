-- ============================================================
-- NORA — Arreglo: tomar un pedido de la bolsa quedaba "sin aceptar"
--
-- Bug real, encontrado probando en vivo: tocar_servicio() (extendido
-- en 12_tecnico_en_terreno.sql) resetea tecnico_confirmado_el cada vez
-- que tecnico_id cambia — pensado para cuando OPERACIONES reasigna de
-- un técnico a otro, para que el nuevo no herede la confirmación del
-- anterior. Pero ese mismo reset también se disparaba cuando un
-- técnico TOMABA un pedido de la bolsa (tecnico_id pasa de null a su
-- propio id): validar_reclamo_tecnico() ya había puesto
-- tecnico_confirmado_el = ahora, y el trigger de abajo —que corre
-- después, por orden alfabético de nombre— lo volvía a pisar con null.
-- El pedido quedaba "asignado" pero sin la aceptación puesta, y la
-- pantalla del técnico mostraba de nuevo Aceptar/Rechazar sobre un
-- pedido que ya era suyo.
--
-- La distinción correcta: el reset sólo tiene sentido cuando HABÍA un
-- técnico antes (reasignación de A a B). Si antes no había nadie
-- (tecnico_id era null), no hay ninguna confirmación vieja que limpiar
-- — y si esta misma actualización la está poniendo a propósito (el
-- reclamo), no hay que pisarla.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create or replace function tocar_servicio()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_el := now();

  if tg_op = 'UPDATE' and old.tecnico_id is not null and new.tecnico_id is distinct from old.tecnico_id then
    new.tecnico_confirmado_el := null;
    new.ubicacion_lat := null;
    new.ubicacion_lng := null;
    new.ubicacion_actualizada_el := null;
  end if;

  return new;
end;
$$;
