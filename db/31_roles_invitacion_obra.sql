-- ============================================================
-- NORA — Invitación a obras con rol elegido por el dueño
--
-- Pedido explícito: cuando el dueño comparte el link, ya tiene que
-- saberse qué rol tiene esa persona (arquitecta, socio, etc.) — no
-- preguntárselo a quien se une. Antes había UN link genérico por obra
-- (codigo_invitacion en `obras`) y todos los que entraban quedaban
-- idénticos, sin forma de distinguirlos más que por su nombre de
-- cuenta.
--
-- Ahora hay un link DISTINTO por rol: el dueño elige "Arquitecto/a",
-- "Socio/a", "Contratista" u "Otro" (con una etiqueta libre, ej.
-- "Contratista de pintura") ANTES de generar el link, y ese rol queda
-- grabado en el link mismo — quien lo abre no elige nada, ya está
-- decidido. `invitacion_para_rol()` reutiliza el link si el dueño ya
-- había generado uno para ese mismo rol (evita links huérfanos
-- acumulándose cada vez que se abre la hoja de invitar).
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

-- ---------- 1. Un link por rol, no uno por obra ----------

create table if not exists obra_invitaciones (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references obras(id) on delete cascade,
  rol        text not null check (rol in ('arquitecto', 'socio', 'contratista', 'otro')),
  -- Sólo tiene sentido (y sólo se usa para buscar duplicados) cuando rol = 'otro'.
  etiqueta   text,
  codigo     text not null unique default encode(gen_random_bytes(8), 'hex'),
  creado_el  timestamptz not null default now()
);

create index if not exists obra_invitaciones_obra_id_idx on obra_invitaciones (obra_id);

comment on table obra_invitaciones is
  'Un link de invitación por rol (no uno solo por obra). Sin política de RLS a propósito: sólo se toca desde invitacion_para_rol() y unirse_a_obra(), ambas security definer con su propio chequeo de permisos.';

alter table obra_invitaciones enable row level security;

-- El link genérico anterior queda reemplazado por esta tabla.
alter table obras drop column if exists codigo_invitacion;

-- ---------- 2. El rol (y la etiqueta libre) viajan hasta el colaborador ----------

alter table obra_participantes add column if not exists etiqueta text;

comment on column obra_participantes.rol is
  'Lo fija unirse_a_obra() a partir del link usado (obra_invitaciones.rol) — nunca lo elige quien se une.';

-- ---------- 3. Generar (o reusar) el link para un rol ----------

create or replace function invitacion_para_rol(p_obra_id uuid, p_rol text, p_etiqueta text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_etiqueta text := nullif(trim(coalesce(p_etiqueta, '')), '');
begin
  if not es_dueno_de_obra(p_obra_id) then
    raise exception 'Sólo el dueño de la obra puede generar links de invitación.';
  end if;

  if p_rol not in ('arquitecto', 'socio', 'contratista', 'otro') then
    raise exception 'Ese rol no existe.';
  end if;

  select codigo into v_codigo
  from obra_invitaciones
  where obra_id = p_obra_id
    and rol = p_rol
    and etiqueta is not distinct from v_etiqueta
  limit 1;

  if v_codigo is not null then
    return v_codigo;
  end if;

  insert into obra_invitaciones (obra_id, rol, etiqueta)
  values (p_obra_id, p_rol, v_etiqueta)
  returning codigo into v_codigo;

  return v_codigo;
end;
$$;

-- ---------- 4. Unirse: ahora resuelve el rol desde el link, no un default ----------

drop function if exists unirse_a_obra(text);

create function unirse_a_obra(p_codigo text)
returns table (id_obra uuid, nombre_obra text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nombre text;
  v_cliente_id uuid;
  v_rol text;
  v_etiqueta text;
begin
  select o.id, o.nombre, o.cliente_id, i.rol, i.etiqueta
  into v_id, v_nombre, v_cliente_id, v_rol, v_etiqueta
  from obra_invitaciones i
  join obras o on o.id = i.obra_id
  where i.codigo = p_codigo;

  if v_id is null then
    raise exception 'Ese link de invitación no es válido.';
  end if;

  if v_cliente_id is distinct from auth.uid() then
    insert into obra_participantes (obra_id, usuario_id, rol, etiqueta)
    values (v_id, auth.uid(), v_rol, v_etiqueta)
    on conflict (obra_id, usuario_id) do update set rol = excluded.rol, etiqueta = excluded.etiqueta;
  end if;

  return query select v_id, v_nombre;
end;
$$;

-- ---------- 5. El rol se ve en el chat y en la lista de colaboradores ----------

drop function if exists participantes_de_obra(uuid);

create function participantes_de_obra(p_obra_id uuid)
returns table (usuario_id uuid, nombre text, es_dueno boolean, rol text, etiqueta text)
language sql
stable
security definer
set search_path = public
as $$
  with gente as (
    select o.cliente_id as usuario_id, p.nombre, true as es_dueno, null::text as rol, null::text as etiqueta
    from obras o
    join perfiles p on p.id = o.cliente_id
    where o.id = p_obra_id
    union all
    select op.usuario_id, p.nombre, false as es_dueno, op.rol, op.etiqueta
    from obra_participantes op
    join perfiles p on p.id = op.usuario_id
    where op.obra_id = p_obra_id
  )
  select usuario_id, nombre, es_dueno, rol, etiqueta
  from gente
  where es_dueno_de_obra(p_obra_id) or es_participante_de_obra(p_obra_id)
  order by es_dueno desc, nombre;
$$;
