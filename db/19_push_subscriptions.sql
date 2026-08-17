-- ============================================================
-- NORA — Notificaciones push: suscripciones y envío autorizado
--
-- Tabla nueva para guardar la suscripción de Web Push de cada
-- persona (el navegador la genera cuando activa notificaciones — no
-- es un token de ningún servicio externo, es un endpoint propio del
-- navegador/SO). Cada fila es de una sola persona; RLS estándar.
--
-- El caso interesante es el envío: cuando el técnico marca "salgo en
-- camino", el servidor tiene que mandarle una notificación al
-- CLIENTE — es decir, leer la suscripción de OTRA persona. Con RLS
-- normal eso da cero filas (con razón: nadie debería poder leer la
-- suscripción push de cualquiera). La función de abajo es el mismo
-- patrón que ya usa este proyecto para casos así (ver
-- tecnico_tiene_trabajo_activo_en, es_operaciones): security definer,
-- pero con la autorización real escrita adentro — sólo devuelve algo
-- si quien llama es efectivamente el técnico asignado a ESE pedido.
-- No hace falta service_role para esto.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  creado_el  timestamptz not null default now()
);

create index on push_subscriptions (usuario_id);

comment on table push_subscriptions is
  'Suscripciones de Web Push por persona. El endpoint lo genera el navegador al activar notificaciones; no es un secreto de Nora, pero tampoco algo que otra persona deba poder leer.';

alter table push_subscriptions enable row level security;

create policy "cada uno administra sus propias suscripciones"
  on push_subscriptions for all
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- ---------- Envío autorizado ----------

create or replace function suscripciones_para_notificar_en_camino(p_servicio_id uuid)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from servicios s
    where s.id = p_servicio_id and s.tecnico_id = auth.uid()
  ) then
    raise exception 'No autorizado';
  end if;

  return query
    select ps.endpoint, ps.p256dh, ps.auth
    from push_subscriptions ps
    join servicios s on s.cliente_id = ps.usuario_id
    where s.id = p_servicio_id;
end;
$$;

comment on function suscripciones_para_notificar_en_camino is
  'Sólo para el endpoint /api/pedidos/[id]/notificar-en-camino. Verifica adentro que quien llama sea el técnico asignado a ese pedido antes de devolver nada — sin esa autorización, cualquiera podría leer la suscripción push de cualquier cliente.';
