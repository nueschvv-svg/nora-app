-- ============================================================
-- NORA — El cliente confirma el pago cuando el técnico termina
--
-- Hoy, cuando el técnico marca "Terminé el trabajo" (estado
-- finalizado), no pasa nada más: alguien de operaciones tiene que
-- entrar a mano y avanzar el estado a "pagado". El cliente nunca
-- confirma nada — ni siquiera que el trabajo está hecho.
--
-- Esto agrega la primera mitad de un sistema de pagos real: el
-- cliente, al ver "Terminado", elige cómo pagó. Por ahora sólo
-- "efectivo" queda operativo (confirma en el momento, sin
-- intermediarios). "Mercado Pago" queda para una segunda etapa — ver
-- ESTADO.md — necesita una Aplicación de Mercado Pago Developers con
-- credenciales reales para el OAuth de cada técnico y el webhook de
-- confirmación; no tiene sentido escribir ese código sin nada contra
-- qué probarlo.
--
-- Por qué esto no es una política de RLS común: `servicios` HOY no le
-- da a ningún cliente ningún UPDATE salvo cancelar (02_permisos.sql,
-- a propósito — "un cliente que pudiera hacer UPDATE podría ponerse
-- el precio o marcarse el trabajo como pagado"). Mismo criterio que ya
-- usa el técnico para sus propios cambios (db/12): una política nueva,
-- bien acotada a un solo estado de origen y un solo estado de
-- destino, más un trigger que valida que no se toque nada más.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create type metodo_pago as enum ('efectivo', 'mercado_pago');

alter table servicios add column if not exists metodo_pago metodo_pago;
alter table servicios add column if not exists pago_confirmado_el timestamptz;

create policy "el cliente confirma el pago cuando el trabajo terminó"
  on servicios for update
  using (cliente_id = auth.uid() and estado = 'finalizado' and metodo_pago is null)
  with check (cliente_id = auth.uid() and estado = 'pagado');

-- ⚠️ Esta función YA había sido extendida en db/12_tecnico_en_terreno.sql
-- para delegarle al técnico sus propios cambios (validar_cambio_tecnico).
-- Un primer intento de este archivo la reescribió partiendo de la
-- versión vieja de 02_permisos.sql y esa delegación se perdía — bug
-- real, encontrado en vivo (el técnico no podía cerrar ningún trabajo
-- después de correr esto). La versión de abajo parte de la de db/12 y
-- le agrega, sin sacarle nada, el caso de "cliente confirma efectivo".
create or replace function solo_permitir_cancelar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El servidor y operaciones pasan de largo.
  if auth.uid() is null or es_operaciones() then
    return new;
  end if;

  -- El técnico asignado: reglas propias, sin tocar (db/12).
  if old.tecnico_id is not null and old.tecnico_id = auth.uid() then
    return validar_cambio_tecnico(old, new);
  end if;

  -- El cliente, confirmando el pago en efectivo: sólo esas tres
  -- columnas, sólo en ese sentido exacto. new.estado ya lo validó el
  -- with check de la política de arriba (tiene que ser 'pagado').
  if old.estado = 'finalizado' and new.estado = 'pagado' then
    if new.metodo_pago is distinct from 'efectivo'
       or new.pago_confirmado_el is null
       or new.monto_ars       is distinct from old.monto_ars
       or new.comision_ars    is distinct from old.comision_ars
       or new.tecnico_id      is distinct from old.tecnico_id
       or new.cliente_id      is distinct from old.cliente_id
       or new.propiedad_id    is distinct from old.propiedad_id
       or new.pago_referencia is distinct from old.pago_referencia
       or new.reporte         is distinct from old.reporte then
      raise exception 'Sólo se puede confirmar el pago en efectivo, nada más';
    end if;
    return new;
  end if;

  -- El cliente, para el resto (cancelar): igual que en db/12.
  if new.monto_ars       is distinct from old.monto_ars
     or new.comision_ars is distinct from old.comision_ars
     or new.tecnico_id   is distinct from old.tecnico_id
     or new.cliente_id   is distinct from old.cliente_id
     or new.propiedad_id is distinct from old.propiedad_id
     or new.pago_referencia is distinct from old.pago_referencia
     or new.reporte      is distinct from old.reporte
     or new.tecnico_confirmado_el is distinct from old.tecnico_confirmado_el
     or new.ubicacion_lat is distinct from old.ubicacion_lat
     or new.ubicacion_lng is distinct from old.ubicacion_lng
     or new.ubicacion_actualizada_el is distinct from old.ubicacion_actualizada_el then
    raise exception 'Sólo el equipo de Nora puede modificar estos datos del servicio';
  end if;
  return new;
end;
$$;

-- ============================================================
-- QUÉ FALTA PARA MERCADO PAGO (segunda etapa, necesita credenciales
-- reales de una Aplicación de Mercado Pago Developers primero):
--
-- 1. tecnicos.mp_access_token / mp_refresh_token / mp_user_id — se
--    completan cuando el técnico vincula su cuenta vía OAuth.
-- 2. Endpoint de servidor que crea la "preferencia" de pago contra la
--    cuenta del técnico, con marketplace_fee = monto * comision_pct.
-- 3. Webhook de Mercado Pago (servidor) que, al confirmarse el pago,
--    escribe pago_referencia + comision_ars + metodo_pago='mercado_pago'
--    + estado='pagado'. Este único paso SÍ necesita bypassear RLS
--    (no hay sesión de usuario en un webhook servidor-a-servidor) —
--    la excepción justificada al resto del proyecto, validando la
--    firma de Mercado Pago antes de tocar la base.
-- ============================================================
