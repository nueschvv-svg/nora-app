-- ============================================================
-- NORA — Obras: invitar gente (arquitecta, socios) + chat por obra
--
-- Pedido explícito, en vivo: "cuando uno añade una obra, se genere un
-- link para invitar a la obra... que se lo mandas a la arquitecta,
-- que se lo mandas a los socios". Hasta ahora una obra sólo la podía
-- ver y tocar el cliente que la cargó — nadie más tenía forma de
-- entrar, aunque fuera la persona que dirige la construcción.
--
-- Diseño: UN link por obra (no uno por persona), como el link de un
-- grupo — cualquiera que lo tenga y tenga cuenta en Nora se suma como
-- colaborador. Más simple de compartir y de razonar que invitaciones
-- individuales, y alcanza para el caso real: arquitecta + socios,
-- gente de confianza del dueño de la obra.
--
-- Corrección sobre el intento anterior: `es_participante_de_obra()`
-- leía la tabla `obra_participantes` ANTES de que este mismo archivo
-- la creara. Con `language sql` (a diferencia de `plpgsql`), Postgres
-- valida que las tablas referenciadas existan en el momento de crear
-- la función, no recién al usarla — el CREATE FUNCTION fallaba con
-- "relation obra_participantes does not exist". Se corrige solo
-- reordenando: la tabla ahora se crea antes que la función.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar. Es seguro
-- volver a correrlo aunque ya hayas corrido el intento anterior a
-- medias (create table usa "if not exists" donde puede fallar por eso).
-- ============================================================

-- ---------- Código de invitación ----------

alter table obras add column if not exists codigo_invitacion text unique default encode(gen_random_bytes(8), 'hex');
alter table obras alter column codigo_invitacion set not null;

comment on column obras.codigo_invitacion is
  'Código del link /obras/unirse/<codigo>. Cualquiera con el link se suma como colaborador — no hace falta que el dueño apruebe uno por uno.';

-- ---------- Participantes ----------
-- Se crea ANTES que las funciones security definer de abajo: una de
-- ellas lee esta tabla, y con `language sql` Postgres valida que
-- exista ya al momento de crear la función, no recién al usarla.

create table if not exists obra_participantes (
  obra_id     uuid not null references obras(id) on delete cascade,
  usuario_id  uuid not null references perfiles(id) on delete cascade,
  rol         text not null default 'colaborador',
  unido_el    timestamptz not null default now(),
  primary key (obra_id, usuario_id)
);

comment on table obra_participantes is
  'Quién se sumó a una obra por invitación (arquitecta, socios, etc). El dueño (obras.cliente_id) no necesita fila acá — ya tiene acceso total por ser el dueño.';

alter table obra_participantes enable row level security;

drop policy if exists "el dueño y los participantes ven quién está en la obra" on obra_participantes;

-- ---------- Funciones security definer ----------
-- Mismo motivo que en 17/18_arreglo_recursion_propiedades.sql: una
-- política de obra_participantes que se consulta a sí misma en una
-- subquery entra en loop. Estas funciones corren "por afuera" de RLS
-- (son dueñas de las tablas, están exentas), así que se pueden usar
-- adentro de cualquier política sin ese riesgo.

create or replace function es_dueno_de_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from obras where id = p_obra_id and cliente_id = auth.uid());
$$;

create or replace function es_participante_de_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from obra_participantes
    where obra_id = p_obra_id and usuario_id = auth.uid()
  );
$$;

create policy "el dueño y los participantes ven quién está en la obra"
  on obra_participantes for select
  using (usuario_id = auth.uid() or es_dueno_de_obra(obra_id));

-- Sin política de insert/update/delete directa a propósito: sumarse
-- pasa por unirse_a_obra() de abajo (security definer), que valida el
-- código antes de dejar entrar a nadie — no por un insert libre.

-- ---------- Extender el acceso a `obras` para participantes ----------
-- Aditivo: NO se toca la política del dueño (25_obras.sql). RLS
-- combina las políticas del mismo comando con "o", así que alcanza con
-- sumar una nueva — reescribir la del dueño desde cero es exactamente
-- el error que ya pasó con solo_permitir_cancelar() en
-- 22_confirmar_pago.sql.

drop policy if exists "los participantes ven la obra" on obras;
create policy "los participantes ven la obra"
  on obras for select
  using (es_participante_de_obra(id));

drop policy if exists "los participantes actualizan etapas y ejecutado" on obras;
create policy "los participantes actualizan etapas y ejecutado"
  on obras for update
  using (es_participante_de_obra(id))
  with check (es_participante_de_obra(id));

-- ---------- Unirse con el link ----------

create or replace function unirse_a_obra(p_codigo text)
returns table (obra_id uuid, nombre text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nombre text;
  v_cliente_id uuid;
begin
  select o.id, o.nombre, o.cliente_id into v_id, v_nombre, v_cliente_id
  from obras o where o.codigo_invitacion = p_codigo;

  if v_id is null then
    raise exception 'Ese link de invitación no es válido.';
  end if;

  -- El dueño ya tiene acceso total; no hace falta sumarlo como participante.
  if v_cliente_id is distinct from auth.uid() then
    insert into obra_participantes (obra_id, usuario_id)
    values (v_id, auth.uid())
    on conflict (obra_id, usuario_id) do nothing;
  end if;

  return query select v_id, v_nombre;
end;
$$;

-- ---------- Chat de la obra ----------
-- Mismo criterio que servicio_mensajes (db/12): sin edición ni
-- borrado, es registro.

create table if not exists obra_mensajes (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references obras(id) on delete cascade,
  autor_id   uuid not null references perfiles(id),
  cuerpo     text not null check (length(trim(cuerpo)) between 1 and 2000),
  creado_el  timestamptz not null default now()
);

create index if not exists obra_mensajes_obra_id_creado_el_idx on obra_mensajes (obra_id, creado_el);

alter table obra_mensajes enable row level security;

drop policy if exists "el dueño y los participantes leen el chat de la obra" on obra_mensajes;
create policy "el dueño y los participantes leen el chat de la obra"
  on obra_mensajes for select
  using (es_dueno_de_obra(obra_id) or es_participante_de_obra(obra_id));

drop policy if exists "el dueño y los participantes escriben en el chat de la obra" on obra_mensajes;
create policy "el dueño y los participantes escriben en el chat de la obra"
  on obra_mensajes for insert
  with check (autor_id = auth.uid() and (es_dueno_de_obra(obra_id) or es_participante_de_obra(obra_id)));

-- ---------- Tiempo real ----------
-- Si da "already member of publication", el proyecto ya tiene la
-- publicación ancha — ignorar el error y seguir.

alter publication supabase_realtime add table obra_mensajes;
