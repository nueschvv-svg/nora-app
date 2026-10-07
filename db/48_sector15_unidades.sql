-- 48: aplicar después de 44–47. Catálogo literal del CSV, sin fórmulas.
-- La dirección se identifica por predio/sector; no se inventa una altura postal.
begin;
insert into public.edificios(slug,nombre,calle,numero,localidad,provincia,activo)
values('sector-15','Estación Buenos Aires · Sector 15','Predio Estación Buenos Aires','Sector 15','Barracas','CABA',true);
create table public.sector15_unidades (
 uf integer primary key,
 edificio_id uuid not null references public.edificios(id),
 nucleo text not null,
 piso integer not null check(piso between 1 and 10),
 unidad text not null check(unidad in ('A','B','C','D','E','F')),
 unique(edificio_id,nucleo,piso,unidad)
);
insert into public.sector15_unidades(uf,nucleo,piso,unidad,edificio_id)
select v.*,e.id from (values
(2222,'15-1',1,'B'),
(2223,'15-1',1,'A'),
(2224,'15-1',1,'D'),
(2225,'15-2',1,'C'),
(2226,'15-2',1,'B'),
(2227,'15-3',1,'A'),
(2228,'15-3',1,'B'),
(2229,'15-3',1,'C'),
(2230,'15-1',1,'C'),
(2231,'15-2',1,'D'),
(2232,'15-2',1,'E'),
(2233,'15-3',1,'E'),
(2234,'15-3',1,'D'),
(2235,'15-1',2,'C'),
(2236,'15-1',2,'B'),
(2237,'15-1',2,'A'),
(2238,'15-1',2,'F'),
(2239,'15-2',2,'C'),
(2240,'15-2',2,'B'),
(2241,'15-2',2,'A'),
(2242,'15-3',2,'A'),
(2243,'15-3',2,'B'),
(2244,'15-3',2,'C'),
(2245,'15-1',2,'D'),
(2246,'15-1',2,'E'),
(2247,'15-2',2,'D'),
(2248,'15-2',2,'E'),
(2249,'15-2',2,'F'),
(2250,'15-3',2,'F'),
(2251,'15-3',2,'E'),
(2252,'15-3',2,'D'),
(2253,'15-1',3,'C'),
(2254,'15-1',3,'B'),
(2255,'15-1',3,'A'),
(2256,'15-1',3,'F'),
(2257,'15-2',3,'C'),
(2258,'15-2',3,'B'),
(2259,'15-2',3,'A'),
(2260,'15-3',3,'A'),
(2261,'15-3',3,'B'),
(2262,'15-3',3,'C'),
(2263,'15-1',3,'D'),
(2264,'15-1',3,'E'),
(2265,'15-2',3,'D'),
(2266,'15-2',3,'E'),
(2267,'15-2',3,'F'),
(2268,'15-3',3,'F'),
(2269,'15-3',3,'E'),
(2270,'15-3',3,'D'),
(2271,'15-1',4,'C'),
(2272,'15-1',4,'B'),
(2273,'15-1',4,'A'),
(2274,'15-1',4,'F'),
(2275,'15-2',4,'C'),
(2276,'15-2',4,'B'),
(2277,'15-2',4,'A'),
(2278,'15-3',4,'A'),
(2279,'15-3',4,'B'),
(2280,'15-3',4,'C'),
(2281,'15-1',4,'D'),
(2282,'15-1',4,'E'),
(2283,'15-2',4,'D'),
(2284,'15-2',4,'E'),
(2285,'15-2',4,'F'),
(2286,'15-3',4,'F'),
(2287,'15-3',4,'E'),
(2288,'15-3',4,'D'),
(2289,'15-1',5,'C'),
(2290,'15-1',5,'B'),
(2291,'15-1',5,'A'),
(2292,'15-1',5,'F'),
(2293,'15-2',5,'C'),
(2294,'15-2',5,'B'),
(2295,'15-2',5,'A'),
(2296,'15-3',5,'A'),
(2297,'15-3',5,'B'),
(2298,'15-3',5,'C'),
(2299,'15-1',5,'D'),
(2300,'15-1',5,'E'),
(2301,'15-2',5,'D'),
(2302,'15-2',5,'E'),
(2303,'15-2',5,'F'),
(2304,'15-3',5,'F'),
(2305,'15-3',5,'E'),
(2306,'15-3',5,'D'),
(2307,'15-1',6,'C'),
(2308,'15-1',6,'B'),
(2309,'15-1',6,'A'),
(2310,'15-1',6,'F'),
(2311,'15-2',6,'C'),
(2312,'15-2',6,'B'),
(2313,'15-2',6,'A'),
(2314,'15-3',6,'A'),
(2315,'15-3',6,'B'),
(2316,'15-3',6,'C'),
(2317,'15-1',6,'D'),
(2318,'15-1',6,'E'),
(2319,'15-2',6,'D'),
(2320,'15-2',6,'E'),
(2321,'15-2',6,'F'),
(2322,'15-3',6,'F'),
(2323,'15-3',6,'E'),
(2324,'15-3',6,'D'),
(2325,'15-1',7,'C'),
(2326,'15-1',7,'B'),
(2327,'15-1',7,'A'),
(2328,'15-1',7,'F'),
(2329,'15-2',7,'C'),
(2330,'15-2',7,'B'),
(2331,'15-2',7,'A'),
(2332,'15-3',7,'A'),
(2333,'15-3',7,'B'),
(2334,'15-3',7,'C'),
(2335,'15-1',7,'D'),
(2336,'15-1',7,'E'),
(2337,'15-2',7,'D'),
(2338,'15-2',7,'E'),
(2339,'15-2',7,'F'),
(2340,'15-3',7,'F'),
(2341,'15-3',7,'E'),
(2342,'15-3',7,'D'),
(2343,'15-1',8,'C'),
(2344,'15-1',8,'B'),
(2345,'15-1',8,'A'),
(2346,'15-1',8,'F'),
(2347,'15-2',8,'C'),
(2348,'15-2',8,'B'),
(2349,'15-2',8,'A'),
(2350,'15-3',8,'A'),
(2351,'15-3',8,'B'),
(2352,'15-3',8,'C'),
(2353,'15-1',8,'D'),
(2354,'15-1',8,'E'),
(2355,'15-2',8,'D'),
(2356,'15-2',8,'E'),
(2357,'15-2',8,'F'),
(2358,'15-3',8,'F'),
(2359,'15-3',8,'E'),
(2360,'15-3',8,'D'),
(2361,'15-1',9,'C'),
(2362,'15-1',9,'B'),
(2363,'15-1',9,'A'),
(2364,'15-1',9,'F'),
(2365,'15-2',9,'C'),
(2366,'15-2',9,'B'),
(2367,'15-2',9,'A'),
(2368,'15-3',9,'A'),
(2369,'15-3',9,'B'),
(2370,'15-3',9,'C'),
(2371,'15-1',9,'D'),
(2372,'15-1',9,'E'),
(2373,'15-2',9,'D'),
(2374,'15-2',9,'E'),
(2375,'15-2',9,'F'),
(2376,'15-3',9,'F'),
(2377,'15-3',9,'E'),
(2378,'15-3',9,'D'),
(2379,'15-1',10,'C'),
(2380,'15-1',10,'B'),
(2381,'15-1',10,'A'),
(2382,'15-1',10,'F'),
(2383,'15-2',10,'C'),
(2384,'15-2',10,'B'),
(2385,'15-2',10,'A'),
(2386,'15-3',10,'A'),
(2387,'15-3',10,'B'),
(2388,'15-3',10,'C'),
(2389,'15-1',10,'D'),
(2390,'15-1',10,'E'),
(2391,'15-2',10,'D'),
(2392,'15-2',10,'E'),
(2393,'15-2',10,'F'),
(2394,'15-3',10,'F'),
(2395,'15-3',10,'E'),
(2396,'15-3',10,'D')
) as v(uf,nucleo,piso,unidad) cross join public.edificios e where e.slug='sector-15';
alter table public.sector15_unidades enable row level security;
revoke all on public.sector15_unidades from public,anon,authenticated;
grant select on public.sector15_unidades to anon,authenticated,service_role;
create policy unidades_habilitadas on public.sector15_unidades for select to anon,authenticated
using(exists(select 1 from public.edificios e where e.id=edificio_id and e.activo));
alter table public.propiedades add column sector15_uf integer references public.sector15_unidades(uf);
-- Corre antes del trigger de dirección existente: valida la FK, deriva piso/letra
-- y conserva todas las protecciones de 45. Los domicilios históricos se preservan.
create function public.validar_unidad_sector15() returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
declare u public.sector15_unidades%rowtype;
begin
 if TG_OP='UPDATE' then
  if new.sector15_uf is distinct from old.sector15_uf then
   raise exception 'No se puede modificar la unidad de un domicilio. Creá otro domicilio.';
  end if;
  return new;
 end if;
 if new.sector15_uf is null then
  if exists(select 1 from public.edificios where id=new.edificio_id and slug='sector-15') then
   raise exception 'Seleccioná una unidad válida del Sector 15.';
  end if;
  return new;
 end if;
 select * into u from public.sector15_unidades where uf=new.sector15_uf;
 if not found or new.edificio_id is distinct from u.edificio_id then
  raise exception 'La unidad no corresponde al edificio.';
 end if;
 new.piso:=u.piso::text;new.unidad:=u.unidad;
 return new;
end $$;
revoke all on function public.validar_unidad_sector15() from public;
create trigger a_validar_unidad_sector15 before insert or update on public.propiedades
for each row execute function public.validar_unidad_sector15();
create function public.validar_servicio_unidad_sector15() returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.propiedades p join public.edificios e on e.id=p.edificio_id
 where p.id=new.propiedad_id and e.slug='sector-15' and p.sector15_uf is null) then
  raise exception 'Seleccioná una unidad válida del Sector 15 antes de enviar el pedido.';
 end if;
 return new;
end $$;
revoke all on function public.validar_servicio_unidad_sector15() from public;
create trigger validar_servicio_unidad_sector15 before insert on public.servicios
for each row execute function public.validar_servicio_unidad_sector15();
commit;
