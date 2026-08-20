-- ============================================================
-- NORA — Pivot: se elimina el rol de técnico externo
--
-- Decisión de negocio (no un bug): Nora deja de tener técnicos
-- externos con cuenta propia. A partir de ahora todo pedido lo
-- gestiona directo el equipo de operaciones de Enjinia — acepta,
-- rechaza u oferta un precio, y avanza el trabajo él mismo. Sin datos
-- reales de técnicos que migrar (nunca hubo operación real con
-- ellos), así que esto es una eliminación limpia, no una migración.
--
-- Nueva máquina de estados (reemplaza a la vieja):
--   solicitado    → el cliente lo mandó, operaciones todavía no respondió
--   presupuestado → operaciones ofertó un precio, falta que el cliente responda
--   aceptado      → precio confirmado (directo por operaciones, o el
--                   cliente aceptó el presupuesto)
--   en_camino / en_curso / finalizado / pagado / calificado — igual que antes
--   cancelado
-- Se van 'buscando_tecnico' y 'asignado' (conceptos de técnico).
--
-- Concurrencia en el panel de operaciones (cuenta única, compartida
-- por varias personas a la vez): no se resuelve acá con SQL nuevo —
-- la política "operaciones actualiza servicios" (db/10) ya es
-- incondicional (`using (es_operaciones())`), así que cualquier sesión
-- de operaciones ya podía escribir cualquier fila. Lo que faltaba es
-- que la propia APP condicione cada UPDATE al estado que esperaba
-- encontrar (`.eq("estado", estadoEsperado)`) — mismo patrón "primer
-- click gana" que ya se usaba para que un técnico reclamara un pedido
-- de la bolsa (tomarTrabajo(), ahora eliminado). Eso se resuelve en
-- lib/operaciones.ts, no acá.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar. Es un
-- archivo largo pero es UNA sola transacción — si algo falla a mitad
-- de camino, no queda nada a medio aplicar.
-- ============================================================

-- ============================================================
-- 1. Políticas de RLS que referencian al técnico — todas fuera,
--    encontradas por CONTENIDO (qual/with_check), no por nombre
--    escrito a mano. Motivo: una de ellas tiene la "é" corrompida en
--    la base real ("t√©cnico" en vez de "técnico", visto con
--    `select policyname from pg_policies where ...`) — un
--    `drop policy "el técnico ve los servicios que le asignaron"`
--    bien escrito no la encuentra, porque el texto no coincide byte a
--    byte. Buscando por lo que la política DICE (que sí está bien
--    codificado) en vez de por su nombre, esto no depende de cómo
--    haya quedado guardado ningún nombre.
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname in ('public', 'storage')
      and (
        coalesce(qual, '') ilike '%tecnico%'
        or coalesce(with_check, '') ilike '%tecnico%'
      )
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Estas tres ya las agarró el bloque de arriba (mencionan
-- 'tecnico_id' o 'buscando_tecnico' en su texto) — quedan acá también,
-- explícitas, sólo como red de seguridad (drop...if exists no rompe
-- nada si ya no existen). Se recrean, ya sin técnico, en la sección 8.
drop policy if exists "el cliente cancela su pedido si todavía no arrancó" on servicios;
drop policy if exists "el cliente responde al presupuesto del técnico" on servicios;
drop policy if exists "el cliente crea su pedido" on servicios;

-- Esta NO menciona "tecnico" en ningún lado (ni nombre ni contenido:
-- sólo depende de `estado` y `metodo_pago`), así que el bloque
-- dinámico de arriba no la agarra — pero igual bloquea el ALTER TYPE
-- de la sección 6 (que cambia el tipo de la columna `estado`).
-- Confirmado con `select * from pg_policies where tablename='servicios'`
-- después de que esto rompiera dos veces seguidas. Se recrea en la
-- sección 8, idéntica (los valores 'finalizado'/'pagado' siguen
-- existiendo en el enum nuevo).
drop policy if exists "el cliente confirma el pago cuando el trabajo terminó" on servicios;

-- ============================================================
-- 2. Tablas exclusivas de técnico — todas fuera (cascada se lleva
--    puesto lo que colgaba: tecnico_categorias, tecnico_documentos,
--    la vista tecnicos_publico, y el trigger de bloquear_autoverificacion_tecnico)
-- ============================================================

drop table if exists tecnico_documentos cascade;
drop table if exists tecnico_categorias cascade;
drop table if exists tecnicos cascade;

-- El chat cliente↔técnico (db/12_tecnico_en_terreno.sql). Sin técnico
-- no hay con quién chatear del otro lado — nada de la app lo usa más
-- (HojaServicio.tsx ya no lo referencia). Cascada se lleva sus dos
-- políticas.
drop table if exists servicio_mensajes cascade;

-- ============================================================
-- 3. Funciones exclusivas de técnico — recién ACÁ, después de las
--    tablas: bloquear_autoverificacion_tecnico() tenía un trigger en
--    `tecnicos` (ya se fue con la cascada de arriba) y es_tecnico() lo
--    llamaban políticas de `tecnicos`/`tecnico_categorias`/`tecnico_documentos`
--    (también ya se fueron) — intentar borrar estas funciones ANTES
--    de las tablas tira "cannot drop function ... because other
--    objects depend on it". Encontrado en vivo al correr esto.
-- ============================================================

drop view if exists tecnicos_publico;

drop function if exists es_tecnico();
drop function if exists tecnico_habilitado(uuid, text);
drop function if exists bloquear_autoverificacion_tecnico();
drop function if exists tecnicos_cercanos(text, double precision, double precision, integer, integer);
drop function if exists validar_cambio_tecnico(servicios, servicios);
drop function if exists validar_reclamo_tecnico(servicios, servicios);
drop function if exists tecnico_tiene_trabajo_activo_en(uuid);
drop function if exists pedidos_abiertos_para_tecnico();
drop function if exists tecnico_de_mi_servicio(uuid);
drop function if exists perfil_publico_tecnico(uuid);

-- Generaba el código que el cliente le dictaba al técnico para poder
-- finalizar. Ya no hace falta: operaciones es un actor de confianza
-- (mismo criterio que ya se usa en todo es_operaciones()), marca
-- "finalizado" directo, igual que cualquier otro avance de estado.
drop trigger if exists trg_generar_codigo_confirmacion on servicios;
drop function if exists generar_codigo_confirmacion();

-- ============================================================
-- 4. `servicios`: se van las columnas que sólo tenían sentido con
--    un técnico con cuenta propia y dispositivo mandando ubicación.
-- ============================================================

alter table servicios
  drop column if exists tecnico_id,
  drop column if exists tecnico_confirmado_el,
  drop column if exists ubicacion_lat,
  drop column if exists ubicacion_lng,
  drop column if exists ubicacion_actualizada_el,
  drop column if exists codigo_confirmacion,
  drop column if exists comision_ars;

comment on table servicios is
  'El pedido de principio a fin. Sin técnico con cuenta propia: lo gestiona operaciones directo (acepta/rechaza/oferta un precio, avanza el estado). Ver db/39_eliminar_rol_tecnico.sql.';

-- tocar_servicio() y registrar_evento_servicio() son triggers de
-- servicios (BEFORE/AFTER en cada INSERT/UPDATE) cuyo CUERPO
-- referencia tecnico_id/tecnico_confirmado_el — eso NO lo bloquea un
-- DROP COLUMN (a diferencia de una política, el cuerpo de una función
-- plpgsql no genera una dependencia dura), así que las columnas de
-- arriba se pudieron borrar sin quejarse, pero el trigger explota en
-- tiempo de ejecución apenas alguien hace un UPDATE a servicios:
-- "record old has no field tecnico_id". Se reescriben acá, quitando
-- sólo la rama de técnico — comparadas contra sus versiones
-- originales (db/01_esquema.sql, db/03_correccion_bitacora.sql) para
-- no perder ninguna rama legítima, sólo lo que agregó
-- db/12_tecnico_en_terreno.sql para técnico.

create or replace function tocar_servicio()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_el := now();
  return new;
end;
$$;

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
  end if;
  return null;
end;
$$;

-- notificar_servicio() también es trigger de servicios y también
-- referenciaba tecnico_id — mismo motivo que las dos de arriba, se
-- reescribe acá (no más abajo) para que ya esté lista antes del
-- UPDATE de la sección 6.
create or replace function notificar_servicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categoria text;
begin
  select nombre into v_categoria from categorias where slug = new.categoria_slug;
  v_categoria := coalesce(v_categoria, 'tu pedido');

  if new.estado is distinct from old.estado then
    if new.estado = 'presupuestado' then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.cliente_id, 'Te llegó un presupuesto',
              'Nora te envió un precio para ' || v_categoria || '. Aceptalo o rechazalo desde tu pedido.', new.id);
    elsif new.estado = 'aceptado' then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.cliente_id, 'Confirmamos tu pedido',
              'Ya confirmamos el trabajo de ' || v_categoria || '.', new.id);
    elsif new.estado = 'en_camino' then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.cliente_id, 'Ya salimos para tu domicilio',
              'Vamos en camino por ' || v_categoria || '.', new.id);
    elsif new.estado = 'en_curso' then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.cliente_id, 'Arrancamos el trabajo',
              'Empezamos con ' || v_categoria || '.', new.id);
    elsif new.estado = 'finalizado' then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.cliente_id, 'Terminamos el trabajo',
              'Confirmá el pago de ' || v_categoria || ' desde tu pedido.', new.id);
    elsif new.estado = 'cancelado' then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.cliente_id, 'Pedido cancelado',
              'El pedido de ' || v_categoria || ' quedó cancelado.', new.id);
    end if;
  end if;

  return null;
end;
$$;

-- Las seis políticas que dejaban pasar también "o sos el técnico
-- asignado" (dropeadas en la sección 1) se recrean acá, ya sin esa
-- rama — sólo dueño del servicio (cliente) u operaciones.

create policy "ver la historia del propio servicio"
  on servicio_eventos for select
  using (
    exists (
      select 1 from servicios s
      where s.id = servicio_eventos.servicio_id
        and s.cliente_id = auth.uid()
    )
    or es_operaciones()
  );

create policy "ver fotos del propio servicio"
  on servicio_fotos for select
  using (
    exists (
      select 1 from servicios s
      where s.id = servicio_fotos.servicio_id
        and s.cliente_id = auth.uid()
    )
    or es_operaciones()
  );

create policy "subir fotos al propio servicio"
  on servicio_fotos for insert
  with check (
    subida_por = auth.uid()
    and exists (
      select 1 from servicios s
      where s.id = servicio_id
        and s.cliente_id = auth.uid()
    )
  );

create policy "subir foto al propio servicio"
  on storage.objects for insert
  with check (
    bucket_id = 'fotos-servicios'
    and exists (
      select 1 from servicios s
      where s.id::text = (storage.foldername(name))[1]
        and s.cliente_id = auth.uid()
    )
  );

create policy "ver foto del propio servicio"
  on storage.objects for select
  using (
    bucket_id = 'fotos-servicios'
    and (
      exists (
        select 1 from servicios s
        where s.id::text = (storage.foldername(name))[1]
          and s.cliente_id = auth.uid()
      )
      or es_operaciones()
    )
  );

create policy "ver el enrutamiento del propio servicio"
  on servicio_enrutamientos for select
  using (
    exists (
      select 1 from servicios s
      where s.id = servicio_enrutamientos.servicio_id
        and s.cliente_id = auth.uid()
    )
    or es_operaciones()
  );

-- ============================================================
-- 5. `calificaciones`: vuelve a ser de un solo sentido (cliente
--    califica el servicio) — no hay técnico al que calificar, ni
--    técnico que califique al cliente.
-- ============================================================

-- Esta política depende de la columna `calificador` (with check
-- calificador = 'cliente') — hay que sacarla ANTES del DROP COLUMN de
-- abajo, si no el ALTER TABLE falla igual que pasó con tecnico_id.
-- OJO: se recrea recién en la sección 8, NO acá — su with check tiene
-- `s.estado in (...)` contra `servicios`, así que si se recrea antes
-- de la sección 6 (que cambia el TIPO de servicios.estado), esa misma
-- política nueva vuelve a bloquear el ALTER TYPE. Encontrado en vivo:
-- "cannot alter type of a column used in a policy definition" con la
-- versión que la recreaba en esta sección.
drop policy if exists "el cliente califica su servicio terminado" on calificaciones;

alter table calificaciones drop constraint if exists calificaciones_servicio_id_calificador_key;
alter table calificaciones
  drop column if exists tecnico_id,
  drop column if exists calificador;
alter table calificaciones add constraint calificaciones_servicio_id_key unique (servicio_id);

-- Ya no hay a quién avisarle una calificación (no hay técnico). Se
-- podría avisar a operaciones, pero eso es una feature nueva, no
-- parte de este pivot — se saca sin reemplazo, MVP simple.
drop trigger if exists trg_notificar_calificacion on calificaciones;
drop function if exists notificar_calificacion();

-- ============================================================
-- 6. `estado_servicio`: enum nuevo, sin 'buscando_tecnico' ni
--    'asignado'. El comentario original acá decía que servicios y
--    servicio_eventos ya estaban vacíos (limpiados en db/37) — en la
--    práctica todavía quedaba data de prueba vieja con
--    'buscando_tecnico', y el cast de más abajo rompía con
--    "invalid input value for enum estado_servicio: buscando_tecnico".
--    Se mapean esos valores a 'solicitado' (su equivalente más
--    cercano: "todavía nadie de operaciones lo resolvió") antes de
--    castear, para no perder ninguna fila ni depender de que db/37 se
--    haya corrido antes.
-- ============================================================

update servicios set estado = 'solicitado' where estado in ('buscando_tecnico', 'asignado');
update servicio_eventos set estado_nuevo = 'solicitado' where estado_nuevo in ('buscando_tecnico', 'asignado');
update servicio_eventos set estado_previo = 'solicitado' where estado_previo in ('buscando_tecnico', 'asignado');

alter type estado_servicio rename to estado_servicio_old;

create type estado_servicio as enum (
  'solicitado',      -- el cliente lo envió, operaciones todavía no respondió
  'presupuestado',   -- operaciones ofertó un precio, falta que el cliente responda
  'aceptado',        -- precio confirmado
  'en_camino',
  'en_curso',
  'finalizado',
  'pagado',
  'calificado',
  'cancelado'
);

alter table servicios
  alter column estado drop default,
  alter column estado type estado_servicio using estado::text::estado_servicio,
  alter column estado set default 'solicitado';

alter table servicio_eventos
  alter column estado_nuevo type estado_servicio using estado_nuevo::text::estado_servicio,
  alter column estado_previo type estado_servicio using estado_previo::text::estado_servicio;

drop type estado_servicio_old;

-- ============================================================
-- 7. `rol_usuario`: 'tecnico' nunca se llegó a usar (ningún
--    perfiles.rol lo tenía puesto — el alta de técnico nunca tocaba
--    esa columna) pero queda mejor sin el vestigio.
-- ============================================================

alter type rol_usuario rename to rol_usuario_old;
create type rol_usuario as enum ('cliente', 'operaciones');
alter table perfiles
  alter column rol drop default,
  alter column rol type rol_usuario using rol::text::rol_usuario,
  alter column rol set default 'cliente';
drop type rol_usuario_old;

-- ============================================================
-- 8. `solo_permitir_cancelar()`: se reescribe sin las ramas de
--    técnico. Cliente responde al presupuesto de OPERACIONES ahora
--    (mismo mecanismo, distinto actor) — rechazar vuelve a
--    'solicitado' (operaciones lo puede volver a ofertar o rechazar
--    del todo), no "a la bolsa" (ya no existe).
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

  -- El cliente, respondiendo al presupuesto de operaciones.
  if old.estado = 'presupuestado' then
    if new.estado = 'aceptado' then
      if new.monto_ars       is distinct from old.monto_ars
         or new.pago_referencia is distinct from old.pago_referencia
         or new.reporte         is distinct from old.reporte then
        raise exception 'Sólo se puede aceptar el presupuesto, nada más';
      end if;
      return new;
    elsif new.estado = 'solicitado' then
      if new.monto_ars is not null
         or new.pago_referencia is distinct from old.pago_referencia
         or new.reporte         is distinct from old.reporte then
        raise exception 'Sólo se puede rechazar el presupuesto';
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
       or new.cliente_id      is distinct from old.cliente_id
       or new.propiedad_id    is distinct from old.propiedad_id
       or new.pago_referencia is distinct from old.pago_referencia
       or new.reporte         is distinct from old.reporte then
      raise exception 'Sólo se puede confirmar el pago en efectivo, nada más';
    end if;
    return new;
  end if;

  -- El cliente, para el resto (cancelar).
  if new.monto_ars       is distinct from old.monto_ars
     or new.cliente_id   is distinct from old.cliente_id
     or new.propiedad_id is distinct from old.propiedad_id
     or new.pago_referencia is distinct from old.pago_referencia
     or new.reporte      is distinct from old.reporte then
    raise exception 'Sólo el equipo de Nora puede modificar estos datos del servicio';
  end if;
  return new;
end;
$$;

-- "el cliente cancela su pedido si todavía no arrancó" (02_permisos.sql):
-- misma política, estados nuevos.
drop policy if exists "el cliente cancela su pedido si todavía no arrancó" on servicios;
create policy "el cliente cancela su pedido si todavía no arrancó"
  on servicios for update
  using (
    cliente_id = auth.uid()
    and estado in ('solicitado', 'presupuestado', 'aceptado')
  )
  with check (cliente_id = auth.uid() and estado = 'cancelado');

-- "el cliente responde al presupuesto del técnico" (db/23): mismo
-- nombre lógico, ahora "de operaciones".
drop policy if exists "el cliente responde al presupuesto del técnico" on servicios;
create policy "el cliente responde al presupuesto"
  on servicios for update
  using (cliente_id = auth.uid() and estado = 'presupuestado')
  with check (cliente_id = auth.uid() and estado in ('aceptado', 'solicitado'));

-- "el cliente crea su pedido" (02_permisos.sql, extendida en db/36):
-- vuelve a un solo estado inicial posible — ya no hay bolsa a la que
-- publicarse, así que 'solicitado' alcanza. tecnico_id/comision_ars
-- ya no existen como columnas, se sacan del chequeo.
drop policy if exists "el cliente crea su pedido" on servicios;
create policy "el cliente crea su pedido"
  on servicios for insert
  with check (
    cliente_id = auth.uid()
    and estado = 'solicitado'
    and monto_ars is null
    and pago_referencia is null
    and exists (
      select 1 from propiedades p
      where p.id = propiedad_id and p.dueno_id = auth.uid()
    )
  );

-- "el cliente confirma el pago cuando el trabajo terminó" (dropeada
-- en la sección 1): idéntica, no tenía nada de técnico — sólo había
-- que sacarla de en medio mientras se cambiaba el tipo de `estado`.
drop policy if exists "el cliente confirma el pago cuando el trabajo terminó" on servicios;
create policy "el cliente confirma el pago cuando el trabajo terminó"
  on servicios for update
  using (cliente_id = auth.uid() and estado = 'finalizado' and metodo_pago is null)
  with check (cliente_id = auth.uid() and estado = 'pagado');

-- "el cliente califica su servicio terminado" (dropeada en la sección
-- 5, NO recreada ahí a propósito): su with check compara contra
-- servicios.estado, así que recién puede volver a existir DESPUÉS del
-- ALTER TYPE de la sección 6.
create policy "el cliente califica su servicio terminado"
  on calificaciones for insert
  with check (
    cliente_id = auth.uid()
    and exists (
      select 1 from servicios s
      where s.id = servicio_id
        and s.cliente_id = auth.uid()
        and s.estado in ('finalizado', 'pagado')
    )
  );

-- ============================================================
-- 10. Push "en camino": lo sigue mandando el mismo mecanismo
--     (suscripciones_para_notificar_en_camino, db/19), pero ahora
--     autoriza a operaciones, no a "el técnico asignado" (esa
--     columna ya no existe).
-- ============================================================

create or replace function suscripciones_para_notificar_en_camino(p_servicio_id uuid)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_operaciones() then
    raise exception 'No autorizado';
  end if;

  return query
    select ps.endpoint, ps.p256dh, ps.auth
    from push_subscriptions ps
    join servicios s on s.cliente_id = ps.usuario_id
    where s.id = p_servicio_id;
end;
$$;
