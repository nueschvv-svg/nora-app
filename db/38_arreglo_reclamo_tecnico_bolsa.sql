-- ============================================================
-- NORA — Arreglo: el técnico no podía tomar ningún pedido de la bolsa
--
-- BUG CRÍTICO encontrado probando en vivo, inmediatamente después de
-- arreglar db/36 (el pedido ahora SÍ aparece en la bolsa): tocar
-- "Tomar" tiraba "Sólo el equipo de Nora puede modificar estos datos
-- del servicio" — el técnico podía VER el pedido pero no podía
-- aceptarlo. La bolsa entera (el "modelo Rappi" de db/15_pool_tecnico.sql)
-- estaba rota de punta a punta, no sólo la visibilidad.
--
-- Causa raíz: solo_permitir_cancelar() es un único trigger que cubre
-- varios caminos distintos (cliente cancela, cliente responde a un
-- presupuesto, cliente confirma pago en efectivo, técnico avanza un
-- trabajo YA asignado, técnico RECLAMA uno sin asignar). Cada vez que
-- una migración nueva necesitaba agregar un camino, volvía a escribir
-- la función entera con `create or replace function` (no hay forma de
-- "agregar una rama" a una función ya creada). db/22_confirmar_pago.sql
-- agregó el camino del pago en efectivo — pero al reescribir la
-- función se olvidó de traer la rama
-- `old.tecnico_id is null and new.tecnico_id = auth.uid()` (el técnico
-- reclamando un pedido abierto, agregada en db/15_pool_tecnico.sql).
-- db/23_ofertar_precio.sql volvió a extender la función partiendo de
-- la de db/22 — pensando que "la delegación al técnico" seguía
-- intacta (así lo dice su propio comentario), pero sólo sobrevivió la
-- rama de un técnico YA asignado (`old.tecnico_id is not null`), no la
-- de reclamar uno nuevo. Sin ninguna rama que lo cubra, un reclamo cae
-- en la rama "resto: cliente" del final, que rechaza cualquier cambio
-- a tecnico_id — de ahí el mensaje de error.
--
-- Este archivo repite EXACTAMENTE la versión de db/23 (la que está
-- aplicada hoy) y le vuelve a sumar la rama que falta, sin tocar
-- ninguna otra. Nada de lo que agregó db/22/db/23 (presupuesto, pago
-- en efectivo) cambia.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create or replace function solo_permitir_cancelar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or es_operaciones() then
    return new;
  end if;

  if old.tecnico_id is not null and old.tecnico_id = auth.uid() then
    return validar_cambio_tecnico(old, new);
  end if;

  -- El técnico, reclamando un pedido abierto de la bolsa (modelo Rappi,
  -- db/15_pool_tecnico.sql) — esta rama es la que se había perdido.
  if old.tecnico_id is null and new.tecnico_id = auth.uid() then
    return validar_reclamo_tecnico(old, new);
  end if;

  -- El cliente, respondiendo a un presupuesto del técnico.
  if old.estado = 'presupuestado' then
    if new.estado = 'aceptado' then
      if new.monto_ars       is distinct from old.monto_ars
         or new.tecnico_id      is distinct from old.tecnico_id
         or new.comision_ars    is distinct from old.comision_ars
         or new.pago_referencia is distinct from old.pago_referencia
         or new.reporte         is distinct from old.reporte then
        raise exception 'Sólo se puede aceptar el presupuesto, nada más';
      end if;
      return new;
    elsif new.estado = 'buscando_tecnico' then
      if new.tecnico_id is not null
         or new.monto_ars is not null
         or new.comision_ars    is distinct from old.comision_ars
         or new.pago_referencia is distinct from old.pago_referencia
         or new.reporte         is distinct from old.reporte then
        raise exception 'Sólo se puede rechazar el presupuesto y volver a la bolsa';
      end if;
      return new;
    else
      raise exception 'Desde un presupuesto sólo se puede aceptar o rechazar';
    end if;
  end if;

  -- El cliente, confirmando el pago en efectivo.
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
