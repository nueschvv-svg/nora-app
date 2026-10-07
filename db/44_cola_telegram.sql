-- Aplicar una vez sobre el esquema vigente (39–43), primero en staging.
-- No instala cron ni reenvía pedidos históricos. Cada alta futura encola
-- atómicamente; no hay un pedido confirmado sin fila pendiente.
begin;
create table public.servicio_avisos (
 servicio_id uuid primary key references public.servicios(id) on delete cascade,
 estado text not null default 'pendiente' check (estado in ('pendiente','procesando','enviado','fallido')),
 intentos integer not null default 0 check (intentos >= 0),
 proximo_intento_el timestamptz not null default (now() + interval '30 seconds'),
 token uuid,
 lease_hasta timestamptz,
 detalle text,
 creado_el timestamptz not null default now(),
 actualizado_el timestamptz not null default now()
);
create index servicio_avisos_pendientes on public.servicio_avisos(proximo_intento_el) where estado in ('pendiente','procesando');
alter table public.servicio_avisos enable row level security;
revoke all on public.servicio_avisos from anon, authenticated;
grant select on public.servicio_avisos to authenticated;
grant all on public.servicio_avisos to service_role;
create policy "ver aviso propio u operaciones" on public.servicio_avisos for select to authenticated
 using (public.es_operaciones() or exists(select 1 from public.servicios s where s.id=servicio_id and s.cliente_id=auth.uid()));

create function public.encolar_aviso_telegram() returns trigger
language plpgsql security definer set search_path = public as $$
begin
 insert into public.servicio_avisos(servicio_id) values(new.id);
 return new;
end $$;
revoke all on function public.encolar_aviso_telegram() from public, anon, authenticated;
create trigger trg_encolar_aviso_telegram after insert on public.servicios
 for each row execute function public.encolar_aviso_telegram();

-- Nunca permitir que un residente falsifique el registro de entrega.
drop policy if exists "registrar el enrutamiento del propio servicio" on public.servicio_enrutamientos;
revoke insert, update, delete on public.servicio_enrutamientos from anon, authenticated;
grant all on public.servicio_enrutamientos to service_role;

create function public.tomar_aviso_telegram() returns setof public.servicio_avisos
language plpgsql security definer set search_path = public as $$
begin
 -- Un proceso que murió en su último intento no debe quedar invisible.
 update public.servicio_avisos set estado='fallido', token=null, lease_hasta=null,
  detalle='Proceso interrumpido tras agotar los intentos. Revisar Telegram antes de reintentar.', actualizado_el=now()
 where estado='procesando' and lease_hasta<now() and intentos>=8;
 return query
 with elegido as (
  select servicio_id from public.servicio_avisos
  where intentos<8 and ((estado='pendiente' and proximo_intento_el<=now()) or (estado='procesando' and lease_hasta<now()))
  order by proximo_intento_el for update skip locked limit 1
 )
 update public.servicio_avisos a set estado='procesando', intentos=a.intentos+1,
  token=gen_random_uuid(), lease_hasta=now()+interval '5 minutes', actualizado_el=now()
 from elegido e where a.servicio_id=e.servicio_id returning a.*;
end $$;
revoke all on function public.tomar_aviso_telegram() from public, anon, authenticated;
grant execute on function public.tomar_aviso_telegram() to service_role;

create function public.finalizar_aviso_telegram(p_servicio_id uuid, p_token uuid, p_ok boolean, p_detalle text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_intentos integer;
begin
 update public.servicio_avisos set
  estado=case when p_ok then 'enviado' when intentos>=8 then 'fallido' else 'pendiente' end,
  proximo_intento_el=now()+make_interval(secs=>least(3600, 30*power(2,intentos)::integer)),
  detalle=left(p_detalle,500), token=null, lease_hasta=null, actualizado_el=now()
 where servicio_id=p_servicio_id and token=p_token and estado='procesando'
 returning intentos into v_intentos;
 if not found then return false; end if;
 insert into public.servicio_enrutamientos(servicio_id,estrategia,estado,detalle,intentos)
 values(p_servicio_id,'telegram',case when p_ok then 'enviado'::public.estado_enrutamiento else 'fallido'::public.estado_enrutamiento end,left(p_detalle,500),1);
 return true;
end $$;
revoke all on function public.finalizar_aviso_telegram(uuid,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.finalizar_aviso_telegram(uuid,uuid,boolean,text) to service_role;

create function public.reintentar_aviso_telegram(p_servicio_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if not public.es_operaciones() then raise exception 'Sólo operaciones puede reintentar'; end if;
 -- También permite incorporar un pedido histórico explícitamente, sin
 -- enviar de nuevo un pedido que tenga un envío registrado previamente.
 insert into public.servicio_avisos(servicio_id,proximo_intento_el)
 select s.id,now() from public.servicios s where s.id=p_servicio_id
 and not exists(select 1 from public.servicio_enrutamientos e where e.servicio_id=s.id and e.estado='enviado')
 on conflict(servicio_id) do update set estado='pendiente',intentos=0,proximo_intento_el=now(),
  token=null,lease_hasta=null,detalle='Reintento solicitado por operaciones',actualizado_el=now()
 where servicio_avisos.estado in ('pendiente','fallido');
 return found;
end $$;
revoke all on function public.reintentar_aviso_telegram(uuid) from public, anon;
grant execute on function public.reintentar_aviso_telegram(uuid) to authenticated;
-- SECURITY INVOKER: conserva RLS y sólo operaciones recibe filas.
create function public.listar_avisos_pendientes()
returns table(servicio_id uuid,estado text,intentos integer,detalle text,proximo_intento_el timestamptz,creado_el timestamptz)
language sql stable security invoker set search_path=public as $$
 select s.id, coalesce(a.estado,'sin_cola'), coalesce(a.intentos,0), a.detalle, a.proximo_intento_el, s.creado_el
 from public.servicios s left join public.servicio_avisos a on a.servicio_id=s.id
 where public.es_operaciones() and (a.estado in ('pendiente','procesando','fallido')
  or (a.servicio_id is null and not exists(select 1 from public.servicio_enrutamientos e where e.servicio_id=s.id and e.estado='enviado')))
 order by s.creado_el, s.id;
$$;
revoke all on function public.listar_avisos_pendientes() from public, anon;
grant execute on function public.listar_avisos_pendientes() to authenticated;
commit;
