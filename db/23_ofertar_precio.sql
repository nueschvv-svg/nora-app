-- ============================================================
-- NORA — El técnico puede ofertar un precio propio; el cliente decide
--
-- Hasta acá, en un pedido recién asignado, el técnico sólo tenía dos
-- caminos: Aceptar (tal cual, sin precio) o Rechazar. Pedido explícito:
-- una tercera opción — "te lo hago por esta plata" — con el cliente
-- decidiendo si le sirve antes de que el técnico salga.
--
-- La base ya tenía todo listo para esto desde el principio: el enum
-- estado_servicio incluye 'presupuestado' ("Tenés un presupuesto") y
-- 'aceptado' ("Presupuesto aceptado") — nunca se habían conectado del
-- lado del técnico ni del cliente. Este archivo los conecta:
--
-- 1. El técnico, en un pedido "asignado" sin confirmar todavía, puede
--    poner un monto_ars y pasar a "presupuestado" — en vez de aceptar
--    directo. Es la única excepción a "el técnico nunca toca plata"
--    (db/12): se valida que sea justo esa transición puntual, nada más.
-- 2. El cliente, viendo "presupuestado", acepta (pasa a "aceptado", el
--    técnico ya puede salir) o rechaza (el pedido vuelve a la bolsa —
--    mismo destino que si el técnico lo hubiera rechazado él mismo:
--    tecnico_id y monto_ars a null, buscando_tecnico — para que
--    cualquier otro técnico verificado del rubro lo pueda tomar u
--    ofertar de nuevo).
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create or replace function validar_cambio_tecnico(anterior servicios, nueva servicios)
returns servicios
language plpgsql
as $$
begin
  -- Movimiento 0: ofertar un precio propio, en vez de aceptar tal cual.
  -- Única excepción al "nada de plata, nunca" de más abajo — y sólo
  -- para esta transición puntual, con todo lo demás sin tocar.
  if anterior.estado = 'asignado' and anterior.tecnico_confirmado_el is null
     and anterior.monto_ars is null
     and nueva.estado = 'presupuestado'
     and nueva.monto_ars is not null and nueva.monto_ars > 0
     and nueva.tecnico_id is not distinct from anterior.tecnico_id
     and nueva.tecnico_confirmado_el is null
     and nueva.comision_ars is not distinct from anterior.comision_ars
     and nueva.pago_referencia is not distinct from anterior.pago_referencia
     and nueva.cliente_id is not distinct from anterior.cliente_id
     and nueva.propiedad_id is not distinct from anterior.propiedad_id
     and nueva.categoria_slug is not distinct from anterior.categoria_slug
     and nueva.descripcion is not distinct from anterior.descripcion
     and nueva.fecha_preferida is not distinct from anterior.fecha_preferida
     and nueva.franja_preferida is not distinct from anterior.franja_preferida
     and nueva.reporte is not distinct from anterior.reporte
     and nueva.ubicacion_lat is not distinct from anterior.ubicacion_lat
     and nueva.ubicacion_lng is not distinct from anterior.ubicacion_lng then
    return nueva;
  end if;

  -- Nada de plata ni de a quién pertenece el pedido, nunca (salvo el
  -- movimiento 0 de arriba, ya resuelto).
  if nueva.monto_ars         is distinct from anterior.monto_ars
     or nueva.comision_ars   is distinct from anterior.comision_ars
     or nueva.cliente_id     is distinct from anterior.cliente_id
     or nueva.propiedad_id   is distinct from anterior.propiedad_id
     or nueva.pago_referencia is distinct from anterior.pago_referencia
     or nueva.categoria_slug  is distinct from anterior.categoria_slug
     or nueva.descripcion     is distinct from anterior.descripcion
     or nueva.fecha_preferida is distinct from anterior.fecha_preferida
     or nueva.franja_preferida is distinct from anterior.franja_preferida then
    raise exception 'El técnico no puede modificar esos datos del pedido';
  end if;

  -- Movimiento 2: rechazar. Sólo antes de aceptar y desde "asignado".
  if anterior.estado = 'asignado' and anterior.tecnico_confirmado_el is null
     and nueva.tecnico_id is null and nueva.tecnico_confirmado_el is null
     and nueva.estado = 'buscando_tecnico'
     and nueva.reporte is not distinct from anterior.reporte
     and nueva.ubicacion_lat is not distinct from anterior.ubicacion_lat
     and nueva.ubicacion_lng is not distinct from anterior.ubicacion_lng then
    return nueva;
  end if;

  -- A partir de acá, el técnico sigue siendo el mismo en todos los casos.
  if nueva.tecnico_id is distinct from anterior.tecnico_id then
    raise exception 'El técnico no puede reasignar ni soltar el pedido, salvo al rechazarlo';
  end if;

  -- Movimiento 1: aceptar.
  if nueva.tecnico_confirmado_el is distinct from anterior.tecnico_confirmado_el then
    if anterior.tecnico_confirmado_el is not null then
      raise exception 'Este pedido ya estaba aceptado';
    end if;
    if anterior.estado is distinct from 'asignado' or nueva.estado is distinct from 'asignado' then
      raise exception 'Sólo se puede aceptar un pedido recién asignado';
    end if;
    if nueva.tecnico_confirmado_el is null then
      raise exception 'La confirmación no puede volver a null';
    end if;
    return nueva;
  end if;

  -- Movimiento 3: avanzar de estado. Exige haber aceptado antes —
  -- "aceptado" cuenta como aceptado también cuando viene de un
  -- presupuesto que el cliente ya aprobó.
  if nueva.estado is distinct from anterior.estado then
    if anterior.tecnico_confirmado_el is null and anterior.estado is distinct from 'aceptado' then
      raise exception 'Todavía no aceptaste este trabajo';
    end if;
    if not (
      (anterior.estado, nueva.estado) in (
        ('asignado', 'en_camino'), ('aceptado', 'en_camino'),
        ('en_camino', 'en_curso'), ('en_curso', 'finalizado')
      )
    ) then
      raise exception 'Ese cambio de estado no está permitido para el técnico';
    end if;

    if nueva.estado = 'finalizado' then
      if nueva.reporte is null or length(trim(nueva.reporte)) < 10 then
        raise exception 'Contanos qué hiciste antes de cerrar el trabajo';
      end if;
    elsif nueva.reporte is distinct from anterior.reporte then
      raise exception 'El reporte sólo se carga al finalizar';
    end if;

    -- Al salir de "en_camino" no hace falta conservar la última posición.
    if anterior.estado = 'en_camino' and nueva.estado <> 'en_camino'
       and nueva.ubicacion_lat is not null then
      raise exception 'La ubicación se limpia sola al salir de "en camino"';
    end if;

    return nueva;
  end if;

  -- Movimiento 4: actualizar la posición en vivo. Estado no cambia.
  if nueva.ubicacion_lat is distinct from anterior.ubicacion_lat
     or nueva.ubicacion_lng is distinct from anterior.ubicacion_lng then
    if anterior.estado <> 'en_camino' then
      raise exception 'Sólo se puede compartir ubicación mientras estás "en camino"';
    end if;
    if nueva.ubicacion_lat is null or nueva.ubicacion_lng is null then
      raise exception 'Falta latitud o longitud';
    end if;
    return nueva;
  end if;

  raise exception 'Ese cambio no está permitido para el técnico';
end;
$$;

-- ---------- El cliente responde al presupuesto ----------

create policy "el cliente responde al presupuesto del técnico"
  on servicios for update
  using (cliente_id = auth.uid() and estado = 'presupuestado')
  with check (cliente_id = auth.uid() and estado in ('aceptado', 'buscando_tecnico'));

-- Se extiende, otra vez, la misma función de siempre — partiendo de la
-- versión ya corregida en db/22 (con la delegación al técnico intacta),
-- no de una vieja. Ver el comentario de ahí sobre qué pasó la vez
-- pasada por no hacerlo así.
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
