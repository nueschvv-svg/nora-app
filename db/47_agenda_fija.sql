-- Agenda global ENJINIA. Aplicar una vez después de 44–46.
-- No modifica pedidos existentes. Los días con históricos ambiguos se bloquean.
begin;
create table public.agenda_config (
 id boolean primary key default true check(id),
 timezone text not null default 'America/Argentina/Buenos_Aires',
 minimum_booking_notice interval not null default interval '24 hours' check(minimum_booking_notice > interval '0 hours'),
 dias integer[] not null default array[1,2,3,4,5,6] check(dias = array[1,2,3,4,5,6])
);
insert into public.agenda_config default values;
create table public.agenda_franjas (
 id text primary key,
 inicio time not null,
 fin time not null check(fin>inicio),
 capacidad smallint not null default 2 check(capacidad between 1 and 2),
 check(id=to_char(inicio,'HH24:MI')||'–'||to_char(fin,'HH24:MI'))
);
insert into public.agenda_franjas(id,inicio,fin) values
 ('09:30–11:30','09:30','11:30'),('11:30–13:30','11:30','13:30'),
 ('14:30–16:00','14:30','16:00'),('16:00–17:30','16:00','17:30');
alter table public.agenda_config enable row level security;
alter table public.agenda_franjas enable row level security;
revoke all on public.agenda_config,public.agenda_franjas from public,anon,authenticated;
-- Configuración sólo mediante SQL de administración. RPC devuelve lo necesario.
alter table public.servicios add column agenda_cupo smallint check(agenda_cupo between 1 and 2);
create unique index agenda_cupo_unico on public.servicios(fecha_preferida,franja_preferida,agenda_cupo)
 where estado <> 'cancelado' and agenda_cupo is not null;

create function public.agenda_fecha_habilitada(p_fecha date,p_franja text,p_ahora timestamptz)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select extract(isodow from p_fecha)::int = any(c.dias)
 and (p_fecha+f.inicio) at time zone c.timezone >= p_ahora+c.minimum_booking_notice
 from agenda_config c cross join agenda_franjas f where f.id=p_franja),false);
$$;
revoke all on function public.agenda_fecha_habilitada(date,text,timestamptz) from public,anon,authenticated;

create function public.validar_cupo_agenda() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare capacidad integer; cupo integer;
begin
 if TG_OP='UPDATE' then
  -- No aceptar alteración manual del cupo. Sólo este trigger lo asigna.
  new.agenda_cupo := old.agenda_cupo;
  if new.fecha_preferida is not distinct from old.fecha_preferida
   and new.franja_preferida is not distinct from old.franja_preferida
   and not (old.estado='cancelado' and new.estado<>'cancelado') then return new; end if;
 end if;
 if new.fecha_preferida is null then raise exception 'AGENDA_FECHA: Elegí una fecha.'; end if;
 select f.capacidad into capacidad from agenda_franjas f where f.id=new.franja_preferida;
 if not found then raise exception 'AGENDA_FRANJA: Elegí uno de los horarios de la agenda.'; end if;
 if extract(isodow from new.fecha_preferida)=7 then raise exception 'AGENDA_DOMINGO: Los domingos no hay turnos.'; end if;
 -- Serializa la asignación por día. El índice único es la garantía adicional
 -- incluso ante snapshots anteriores (REPEATABLE READ) o escrituras simultáneas.
 perform pg_advisory_xact_lock(470001, new.fecha_preferida-date '2000-01-01');
 if not agenda_fecha_habilitada(new.fecha_preferida,new.franja_preferida,clock_timestamp()) then
  raise exception 'AGENDA_ANTICIPACION: El turno no cumple la anticipación mínima de % horas.', (select extract(epoch from minimum_booking_notice)/3600 from agenda_config);
 end if;
 if exists(select 1 from servicios s where s.fecha_preferida=new.fecha_preferida and s.estado<>'cancelado'
  and s.agenda_cupo is null and s.id<>new.id) then
  raise exception 'AGENDA_HISTORICO: Este día tiene pedidos anteriores pendientes de revisar.';
 end if;
 select n into cupo from generate_series(1,capacidad) n where not exists(
  select 1 from servicios s where s.fecha_preferida=new.fecha_preferida and s.franja_preferida=new.franja_preferida
   and s.agenda_cupo=n and s.estado<>'cancelado' and s.id<>new.id) order by n limit 1;
 if cupo is null then raise exception 'AGENDA_COMPLETO: Ese horario acaba de completarse. Elegí otro.'; end if;
 new.agenda_cupo:=cupo;
 return new;
end $$;
revoke all on function public.validar_cupo_agenda() from public,anon,authenticated;
create trigger trg_z_agenda before insert or update on public.servicios for each row execute function public.validar_cupo_agenda();

create function public.agenda_disponibilidad(p_desde date default null,p_dias integer default 14)
returns table(fecha date,franja text,disponibles integer,capacidad integer,estado text,motivo text,timezone text,anticipacion_horas numeric)
language sql stable security definer set search_path=public,pg_temp as $$
 with fechas as (
 select (coalesce(p_desde,(now() at time zone c.timezone)::date)+n)::date fecha,c.*
 from agenda_config c cross join generate_series(0,least(greatest(coalesce(p_dias,14),1),31)-1) n
 ), conteos as (
 select d.fecha,f.id franja,f.capacidad::int capacidad,d.timezone,
 extract(epoch from d.minimum_booking_notice)/3600 anticipacion_horas,
 greatest(0,f.capacidad-(select count(*)::int from servicios s where s.fecha_preferida=d.fecha
 and s.franja_preferida=f.id and s.agenda_cupo is not null and s.estado<>'cancelado')) libres,
 case when extract(isodow from d.fecha)::int <> all(d.dias) then 'Domingo sin turnos'
 when not agenda_fecha_habilitada(d.fecha,f.id,now()) then 'Fuera de la anticipación mínima'
 when exists(select 1 from servicios s where s.fecha_preferida=d.fecha and s.estado<>'cancelado' and s.agenda_cupo is null)
 then 'Día con pedidos anteriores pendientes de revisar' else null end motivo
 from fechas d cross join agenda_franjas f
 ) select fecha,franja,case when motivo is null then libres else 0 end,capacidad,
 case when motivo is not null then 'UNAVAILABLE' when libres=0 then 'FULL' when libres=1 then 'LAST_SPOT' else 'AVAILABLE' end,
 motivo,timezone,anticipacion_horas from conteos order by fecha,franja;
$$;
revoke all on function public.agenda_disponibilidad(date,integer) from public;
grant execute on function public.agenda_disponibilidad(date,integer) to anon,authenticated,service_role;

create function public.notificar_reprogramacion_agenda() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.cliente_id is not null and (new.fecha_preferida,new.franja_preferida) is distinct from (old.fecha_preferida,old.franja_preferida) then
 insert into notificaciones(usuario_id,titulo,cuerpo,servicio_id) values(new.cliente_id,'Turno reprogramado',
 'Tu turno es el '||to_char(new.fecha_preferida,'DD/MM/YYYY')||' de '||new.franja_preferida||'.',new.id);
 end if;
 return new;
end $$;
revoke all on function public.notificar_reprogramacion_agenda() from public,anon,authenticated;
create trigger trg_notificar_reprogramacion after update on public.servicios for each row execute function public.notificar_reprogramacion_agenda();
commit;
