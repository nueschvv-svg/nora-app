-- ============================================================
-- NORA — Centro de notificaciones
--
-- La campanita de Inicio no hacía nada: no tenía onClick, y aunque lo
-- tuviera no había nada que mostrar. El único aviso que existía era
-- un push del navegador para UN solo evento ("salió en camino",
-- db/19_push_subscriptions.sql) — y un push depende de que la persona
-- haya dado permiso al navegador, cosa que en la práctica casi nadie
-- hace en una primera prueba. Sin eso, no había ningún rastro de cómo
-- va el pedido ni de nada más.
--
-- Esta migración agrega una bandeja PERSISTIDA, independiente del
-- permiso del navegador: se llena sola con cada avance real del
-- pedido (mismo criterio que servicio_eventos, pero pensada para la
-- persona, no para la bitácora) y la persona la puede ver cuando
-- quiera, aunque nunca haya activado los push.
--
-- Los recordatorios de mantenimiento ("se te vence el termotanque")
-- NO viven acá: se calculan al vuelo del lado del cliente a partir de
-- equiposDe() (lib/score.ts ya tiene toda esa lógica, evaluarEquipo
-- ya distingue vencido/por_vencer). No hace falta guardarlos porque
-- son 100% derivables de datos que ya existen — guardarlos sería
-- duplicar una fuente de verdad y desincronizarse con la próxima
-- vez que se recalcule el score.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create table notificaciones (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references perfiles(id) on delete cascade,
  tipo         text not null default 'servicio' check (tipo in ('servicio')),
  titulo       text not null,
  cuerpo       text not null,
  servicio_id  uuid references servicios(id) on delete cascade,
  leida        boolean not null default false,
  creado_el    timestamptz not null default now()
);

create index on notificaciones (usuario_id, creado_el desc);

comment on table notificaciones is
  'Bandeja de la campanita. Se llena sola vía trigger en cada avance real de un servicio — nadie inserta acá a mano, por eso no hay política de INSERT para el cliente.';

alter table notificaciones enable row level security;

create policy "cada quien ve sus propias notificaciones"
  on notificaciones for select
  using (usuario_id = auth.uid());

create policy "cada quien marca leídas sus propias notificaciones"
  on notificaciones for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- ---------- Trigger: avisar en cada avance real del pedido ----------
-- AFTER UPDATE en servicios, aparte de tocar_servicio() y
-- registrar_evento_servicio() (01_esquema.sql) — no se tocan esas dos
-- funciones, ver la lección aprendida en 22_confirmar_pago.sql sobre
-- reescribir triggers compartidos partiendo de una versión vieja. Esta
-- es una función nueva e independiente.

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

  -- Le asignaron técnico: avisarle a ÉL, no al cliente (el cliente ya lo ve solo al entrar).
  if new.tecnico_id is not null and new.tecnico_id is distinct from old.tecnico_id then
    insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
    values (new.tecnico_id, 'Nuevo pedido asignado',
            'Te asignaron un pedido de ' || v_categoria || '. Revisalo en tus pendientes.', new.id);
  end if;

  -- El técnico confirmó que va: avisarle al cliente.
  if new.tecnico_confirmado_el is not null and new.tecnico_confirmado_el is distinct from old.tecnico_confirmado_el then
    insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
    values (new.cliente_id, 'Tu técnico confirmó el pedido',
            'Ya confirmó que va a hacer el trabajo de ' || v_categoria || '.', new.id);
  end if;

  if new.estado is distinct from old.estado then
    if new.estado = 'presupuestado' then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.cliente_id, 'Te llegó un presupuesto',
              'Tu técnico te envió un precio para ' || v_categoria || '. Aceptalo o rechazalo desde tu pedido.', new.id);

    elsif new.estado = 'aceptado' and new.tecnico_id is not null then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.tecnico_id, 'Te aceptaron el presupuesto',
              'El cliente aceptó tu oferta para ' || v_categoria || '. Ya podés salir en camino.', new.id);

    elsif new.estado = 'buscando_tecnico' and old.estado = 'presupuestado' and old.tecnico_id is not null then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (old.tecnico_id, 'Te rechazaron el presupuesto',
              'El cliente no aceptó tu oferta para ' || v_categoria || '. El pedido volvió a la bolsa.', new.id);

    elsif new.estado = 'en_camino' then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.cliente_id, 'Tu técnico está en camino',
              'Ya salió para tu domicilio por ' || v_categoria || '.', new.id);

    elsif new.estado = 'en_curso' then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.cliente_id, 'Tu técnico empezó a trabajar',
              'Arrancó el trabajo de ' || v_categoria || '.', new.id);

    elsif new.estado = 'finalizado' then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.cliente_id, 'Tu técnico terminó',
              'Confirmá el pago de ' || v_categoria || ' desde tu pedido.', new.id);

    elsif new.estado = 'pagado' and new.tecnico_id is not null then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.tecnico_id, 'Te confirmaron el pago',
              'El cliente confirmó el pago de ' || v_categoria || '.', new.id);

    elsif new.estado = 'cancelado' and new.tecnico_id is not null then
      insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
      values (new.tecnico_id, 'Pedido cancelado',
              'El cliente canceló el pedido de ' || v_categoria || '.', new.id);
    end if;
  end if;

  return null;
end;
$$;

create trigger trg_notificar_servicio
  after update on servicios
  for each row execute function notificar_servicio();

-- ---------- Trigger: avisar al técnico cuando lo califican ----------

create or replace function notificar_calificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notificaciones (usuario_id, titulo, cuerpo, servicio_id)
  values (
    new.tecnico_id,
    'Te calificaron',
    'Te dejaron ' || new.estrellas || ' estrella' || (case when new.estrellas = 1 then '' else 's' end) ||
      (case when new.comentario is not null and length(trim(new.comentario)) > 0
            then ': "' || left(trim(new.comentario), 140) || '"'
            else '.' end),
    new.servicio_id
  );
  return null;
end;
$$;

create trigger trg_notificar_calificacion
  after insert on calificaciones
  for each row execute function notificar_calificacion();

-- ---------- Tiempo real ----------
-- Para que la campanita se actualice sola sin recargar la página. Si
-- esta línea da "already member of publication", es porque el
-- proyecto ya tiene la publicación ancha (todas las tablas) — no pasa
-- nada, ignorar el error y seguir.

alter publication supabase_realtime add table notificaciones;
