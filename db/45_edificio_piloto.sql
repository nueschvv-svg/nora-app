-- Configuración real pendiente. No se crea ningún edificio activo de ejemplo.
-- Aplicar después de 44; alta/edición de edificios sólo desde administración SQL.
begin;
create table public.edificios (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 nombre text not null check (length(btrim(nombre)) > 0),
 calle text not null check (length(btrim(calle)) > 0),
 numero text not null check (length(btrim(numero)) > 0),
 localidad text not null check (length(btrim(localidad)) > 0),
 provincia text not null check (provincia in ('CABA','Buenos Aires')),
 latitud double precision,
 longitud double precision,
 activo boolean not null default false,
 creado_el timestamptz not null default now()
);
alter table public.edificios enable row level security;
revoke all on public.edificios from public, anon, authenticated;
grant select on public.edificios to anon, authenticated;
create policy edificios_activos on public.edificios for select to anon, authenticated using (activo);
alter table public.propiedades
 add column edificio_id uuid references public.edificios(id),
 add column piso text,
 add column unidad text;
create index propiedades_edificio_idx on public.propiedades(edificio_id);

-- Copia canónica: nunca confiar la dirección del edificio al navegador.
-- El domicilio guardado es un snapshot; para otra unidad se crea otro domicilio.
create function public.validar_propiedad_edificio() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare edificio public.edificios%rowtype;
begin
 if TG_OP = 'UPDATE' and old.edificio_id is not null then
  if row(new.edificio_id,new.piso,new.unidad,new.calle,new.numero,new.localidad,new.provincia,new.piso_depto,new.latitud,new.longitud)
   is distinct from row(old.edificio_id,old.piso,old.unidad,old.calle,old.numero,old.localidad,old.provincia,old.piso_depto,old.latitud,old.longitud) then
   raise exception 'No se puede modificar el domicilio de un edificio. Creá otro domicilio.';
  end if;
  return new;
 end if;
 if new.edificio_id is null then return new; end if;
 select * into edificio from public.edificios where id=new.edificio_id and activo;
 if not found then raise exception 'Edificio no habilitado.'; end if;
 new.piso := btrim(coalesce(new.piso,''));
 new.unidad := btrim(coalesce(new.unidad,''));
 if length(new.piso) not between 1 and 30 or length(new.unidad) not between 1 and 30 then
  raise exception 'Ingresá piso y unidad (hasta 30 caracteres cada uno).';
 end if;
 new.calle := edificio.calle;
 new.numero := edificio.numero;
 new.localidad := edificio.localidad;
 new.provincia := edificio.provincia;
 new.latitud := edificio.latitud;
 new.longitud := edificio.longitud;
 new.piso_depto := 'Piso ' || new.piso || ' · Unidad ' || new.unidad;
 return new;
end $$;
revoke all on function public.validar_propiedad_edificio() from public;
create trigger validar_propiedad_edificio before insert or update on public.propiedades
 for each row execute function public.validar_propiedad_edificio();

create function public.validar_servicio_edificio() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if exists (select 1 from public.propiedades p join public.edificios e on e.id=p.edificio_id
  where p.id=new.propiedad_id and not e.activo) then
  raise exception 'Edificio no habilitado para nuevos pedidos.';
 end if;
 return new;
end $$;
revoke all on function public.validar_servicio_edificio() from public;
create trigger validar_servicio_edificio before insert on public.servicios
 for each row execute function public.validar_servicio_edificio();
commit;
