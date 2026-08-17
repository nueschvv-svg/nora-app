-- ============================================================
-- NORA — El técnico en terreno: aceptar/rechazar, avanzar estado,
-- ubicación en vivo mientras está "en camino", y chat con el cliente.
--
-- Hasta acá, una vez que operaciones asignaba un técnico, no había
-- ningún camino de vuelta: el técnico no tenía forma de enterarse
-- adentro de la app, ni de aceptar, ni de avisar que está en camino.
-- Este archivo abre esa puerta, tan angosta como se pueda: el técnico
-- gana un UPDATE sobre `servicios`, pero sólo puede mover unas pocas
-- columnas, en unas pocas combinaciones válidas — todo lo demás (plata,
-- a quién pertenece el pedido, quién es el cliente) sigue siendo
-- exclusivo de operaciones, igual que antes.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar, después de
-- haber corrido 01 a 11. Después, confirmar en Database → Replication
-- que `servicios` y `servicio_mensajes` quedaron habilitadas para
-- Realtime (el ALTER PUBLICATION de más abajo puede no-opear si el
-- proyecto ya la tiene ancha — es inofensivo).
-- ============================================================

-- ---------- Columnas nuevas en servicios ----------

alter table servicios add column if not exists tecnico_confirmado_el timestamptz;
alter table servicios add column if not exists ubicacion_lat double precision;
alter table servicios add column if not exists ubicacion_lng double precision;
alter table servicios add column if not exists ubicacion_actualizada_el timestamptz;

comment on column servicios.tecnico_confirmado_el is
  'Cuándo el técnico aceptó este trabajo puntual. Null = todavía no respondió. No usa el enum estado_servicio a propósito: "aceptado" en ese enum ya significa otra cosa (el cliente aceptando un presupuesto). Mezclar los dos conceptos en la misma columna habría sido confuso y ambiguo para las políticas de acceso.';
comment on column servicios.ubicacion_lat is
  'Última posición GPS que compartió el técnico mientras estaba "en_camino". Sólo se escribe con el navegador abierto: no hay tracking en segundo plano. Se limpia sola si operaciones reasigna el técnico (ver tocar_servicio()).';
comment on column servicios.ubicacion_lng is 'Ver ubicacion_lat.';
comment on column servicios.ubicacion_actualizada_el is
  'Cuándo se guardó el último punto. Sirve para mostrar "hace 2 minutos" y para notar si el técnico cerró la pestaña.';

-- ---------- RLS: el técnico puede actualizar SU servicio asignado ----------
--
-- Hasta acá no existía ningún UPDATE para el técnico (02_permisos.sql lo
-- deja explícito en su comentario). Qué puede cambiar exactamente no lo
-- decide esta política — Postgres no filtra UPDATE por columna — lo
-- decide el trigger de más abajo.

create policy "el técnico actualiza el servicio que tiene asignado"
  on servicios for update
  using (tecnico_id = auth.uid())
  with check (tecnico_id = auth.uid() or tecnico_id is null);

-- ---------- Limpieza automática al reasignar ----------
--
-- Si operaciones cambia tecnico_id (reasigna a otra persona), la
-- confirmación y la ubicación en vivo del técnico ANTERIOR no tienen
-- ningún sentido para el nuevo. Sin esto, el técnico B podría abrir el
-- trabajo y verlo ya "aceptado" (por A) sin haber tocado nada, o
-- heredar una posición de GPS que no es la suya.
--
-- tocar_servicio() ya existe (01_esquema.sql) y ya corre BEFORE en cada
-- UPDATE de servicios — se extiende, no se reemplaza su propósito.

create or replace function tocar_servicio()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_el := now();

  if tg_op = 'UPDATE' and new.tecnico_id is distinct from old.tecnico_id then
    new.tecnico_confirmado_el := null;
    new.ubicacion_lat := null;
    new.ubicacion_lng := null;
    new.ubicacion_actualizada_el := null;
  end if;

  return new;
end;
$$;

-- ---------- Qué puede cambiar el técnico, exactamente ----------
--
-- Cuatro movimientos, ninguno más:
--   1. Aceptar: tecnico_confirmado_el de null a ahora. Estado no se
--      toca — el técnico decide después cuándo salir.
--   2. Rechazar: sólo si todavía no aceptó. Suelta el pedido
--      (tecnico_id → null, estado → buscando_tecnico) para que
--      operaciones lo reasigne.
--   3. Avanzar de estado: asignado→en_camino→en_curso→finalizado, sólo
--      si ya había aceptado. Al llegar a "finalizado" puede (y tiene
--      que) cargar el reporte.
--   4. Actualizar su posición, sólo mientras el estado es "en_camino".
--
-- Cualquier otra combinación de columnas — plata, cliente, propiedad,
-- categoría, descripción, fechas — está prohibida sin importar el
-- estado. Eso lo sigue garantizando solo_permitir_cancelar() de más
-- abajo, que ahora delega acá cuando el actor es el técnico asignado.

create or replace function validar_cambio_tecnico(anterior servicios, nueva servicios)
returns servicios
language plpgsql
as $$
begin
  -- Nada de plata ni de a quién pertenece el pedido, nunca.
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

  -- Movimiento 3: avanzar de estado. Exige haber aceptado antes.
  if nueva.estado is distinct from anterior.estado then
    if anterior.tecnico_confirmado_el is null then
      raise exception 'Todavía no aceptaste este trabajo';
    end if;
    if not (
      (anterior.estado, nueva.estado) in (
        ('asignado', 'en_camino'), ('en_camino', 'en_curso'), ('en_curso', 'finalizado')
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

  -- El técnico asignado: reglas propias, en la función de arriba.
  if old.tecnico_id is not null and old.tecnico_id = auth.uid() then
    return validar_cambio_tecnico(old, new);
  end if;

  -- El resto: el cliente. Sin cambios respecto de antes, más las
  -- columnas nuevas de esta migración (tampoco las puede tocar).
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

-- ---------- Bitácora: dejar registrada la aceptación ----------
--
-- Aceptar no cambia `estado` (sigue en "asignado"), así que el
-- disparador de siempre no lo anotaría solo. Vale la pena que quede: es
-- el único rastro de "a tal hora, el técnico confirmó que iba a ir".
--
-- registrar_evento_servicio() ya existe (01_esquema.sql) y ya corre
-- AFTER en cada INSERT/UPDATE de servicios — se extiende, no se
-- reemplaza su propósito.

create or replace function registrar_evento_servicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    insert into servicio_eventos (servicio_id, estado_nuevo, estado_previo, actor_id)
    values (new.id, new.estado,
            case when tg_op = 'UPDATE' then old.estado else null end,
            auth.uid());
  elsif new.tecnico_confirmado_el is distinct from old.tecnico_confirmado_el
        and new.tecnico_confirmado_el is not null then
    insert into servicio_eventos (servicio_id, estado_nuevo, estado_previo, actor_id, nota)
    values (new.id, new.estado, old.estado, auth.uid(), 'El técnico aceptó el trabajo.');
  end if;
  return null;
end;
$$;

-- ---------- Chat del servicio ----------

create table servicio_mensajes (
  id           uuid primary key default gen_random_uuid(),
  servicio_id  uuid not null references servicios(id) on delete cascade,
  autor_id     uuid not null references perfiles(id),
  cuerpo       text not null check (length(trim(cuerpo)) between 1 and 2000),
  creado_el    timestamptz not null default now()
);

create index on servicio_mensajes (servicio_id, creado_el);

comment on table servicio_mensajes is
  'Chat entre cliente y técnico, acotado a UN servicio. Sin edición ni borrado a propósito: mismo criterio que servicio_eventos, es registro.';

alter table servicio_mensajes enable row level security;

create policy "ver los mensajes del propio servicio"
  on servicio_mensajes for select
  using (
    exists (
      select 1 from servicios s
      where s.id = servicio_mensajes.servicio_id
        and (s.cliente_id = auth.uid() or s.tecnico_id = auth.uid())
    )
    or es_operaciones()
  );

create policy "escribir en el chat del propio servicio"
  on servicio_mensajes for insert
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from servicios s
      where s.id = servicio_id
        and s.tecnico_id is not null
        and s.estado <> 'cancelado'
        and (s.cliente_id = auth.uid() or s.tecnico_id = auth.uid())
    )
  );

-- ---------- Realtime ----------
--
-- ⚠️ Paso a confirmar a mano: en algunos proyectos de Supabase la
-- publicación `supabase_realtime` ya viene con todas las tablas. Si
-- alguna de estas dos líneas da "already member of publication", es
-- inofensivo — revisalo en Database → Replication.

alter publication supabase_realtime add table servicios;
alter publication supabase_realtime add table servicio_mensajes;

-- ============================================================
-- QUÉ FALTA
--
-- 1. UI en el panel de operaciones para verificar técnicos (ya anotado
--    en 10_panel_operaciones.sql) — sin eso, verificar un técnico de
--    prueba sigue siendo a mano por SQL Editor.
-- 2. El técnico pierde acceso a la dirección de la propiedad apenas el
--    servicio pasa a "finalizado" (política ya existente en
--    02_permisos.sql, no se toca acá) — es deliberado, hay que
--    manejarlo en la UI (la propiedad puede llegar null en el detalle).
-- 3. No se agregó edición/borrado de mensajes ni "visto" — no hacía
--    falta para el alcance pedido.
-- ============================================================
