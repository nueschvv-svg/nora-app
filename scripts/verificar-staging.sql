-- Sólo staging. Prueba SQL con identidades simuladas, NO reemplaza prueba JWT.
-- Todos los datos QA desaparecen por ROLLBACK, incluso si falla una aserción.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.perfiles(id,nombre) values ('11111111-1111-4111-8111-111111111111','QA A'),('22222222-2222-4222-8222-222222222222','QA B')
on conflict (id) do nothing;
insert into public.categorias(slug,nombre,icono) values ('qa-staging','QA temporal','droplet');
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
insert into public.propiedades(id,dueno_id,nombre,calle,localidad) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth.uid(),'QA A','Prueba','CABA');
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
insert into public.propiedades(id,dueno_id,nombre,calle,localidad) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',auth.uid(),'QA B','Prueba','CABA');
insert into public.servicios(cliente_id,propiedad_id,categoria_slug,descripcion,fecha_preferida,franja_preferida)
select auth.uid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','qa-staging','QA temporal',d::date,'09:30–11:30'
from generate_series(current_date+3,current_date+9,interval '1 day') d where extract(isodow from d)=1;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$ begin
 if exists(select 1 from public.servicios where cliente_id<>'11111111-1111-4111-8111-111111111111') then raise exception 'RLS pedidos ajenos'; end if;
 if exists(select 1 from public.propiedades where dueno_id<>'11111111-1111-4111-8111-111111111111') then raise exception 'RLS propiedades ajenas'; end if;
 update public.servicios set descripcion='Ataque QA' where cliente_id='22222222-2222-4222-8222-222222222222';
 if found then raise exception 'UPDATE ajeno permitido'; end if;
 begin
 update public.perfiles set rol='operaciones' where id=auth.uid();
 raise exception 'QA_ESCALADA_PERMITIDA';
 exception when others then if sqlerrm='QA_ESCALADA_PERMITIDA' then raise; end if; end;
end $$;
insert into public.servicios(cliente_id,propiedad_id,categoria_slug,descripcion,fecha_preferida,franja_preferida)
select auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-staging','QA temporal',d::date,'09:30–11:30'
from generate_series(current_date+3,current_date+9,interval '1 day') d where extract(isodow from d)=1;
do $$ begin
 begin
 insert into public.servicios(cliente_id,propiedad_id,categoria_slug,descripcion,fecha_preferida,franja_preferida)
 select auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-staging','QA tercero',d::date,'09:30–11:30'
 from generate_series(current_date+3,current_date+9,interval '1 day') d where extract(isodow from d)=1;
 raise exception 'QA_SOBRERESERVA_PERMITIDA';
 exception when others then if sqlerrm not like 'AGENDA_COMPLETO:%' then raise; end if; end;
end $$;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$ begin
 if exists(select 1 from public.servicios where cliente_id<>'22222222-2222-4222-8222-222222222222') then raise exception 'RLS inversa'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.servicios where categoria_slug='qa-staging')<>2 then raise exception 'Cantidad incorrecta'; end if;
 if (select count(*) from public.servicio_avisos a join public.servicios s on s.id=a.servicio_id where s.categoria_slug='qa-staging')<>2 then raise exception 'Cola incompleta'; end if;
end $$;
rollback;
select 'PASS: RLS SQL bilateral, escalada, capacidad y cola. Datos QA revertidos. JWT pendiente.' as resultado;
