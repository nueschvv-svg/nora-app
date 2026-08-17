-- Prueba del matching por cercanía, en Postgres — misma fórmula que
-- tecnicos_cercanos() (db/07_trabajadores.sql), sobre una tabla
-- temporal con 18 trabajadores simulados. No toca la tabla `tecnicos`
-- real ni depende de haber aplicado la migración.
--
-- Cómo correrla: Supabase → SQL Editor → pegar y ejecutar entero.
-- Al final quedan dos SELECT: el resultado del matching y un chequeo
-- de que dio lo esperado.

begin;

create temporary table trabajadores_prueba (
  nombre      text,
  lat         double precision,
  lng         double precision,
  categoria   text,
  estado      text,
  disponible  boolean,
  radio_km    double precision
) on commit drop;

insert into trabajadores_prueba (nombre, lat, lng, categoria, estado, disponible, radio_km) values
  ('Plomero Once',             -34.6083, -58.4055, 'plomeria',     'verificado', true,  15),
  ('Plomero Palermo',          -34.5875, -58.4306, 'plomeria',     'verificado', true,  15),
  ('Plomero Caballito',        -34.6187, -58.4406, 'plomeria',     'verificado', true,  15),
  ('Plomero Belgrano',         -34.5627, -58.4576, 'plomeria',     'verificado', true,  20),
  ('Plomero San Telmo',        -34.6212, -58.3733, 'plomeria',     'verificado', true,  15),
  ('Plomero Avellaneda',       -34.6626, -58.3654, 'plomeria',     'verificado', true,  25),
  ('Plomero Vicente López',    -34.5267, -58.4728, 'plomeria',     'verificado', true,  25),
  ('Plomero Flores (no disp.)',-34.6291, -58.4633, 'plomeria',     'verificado', false, 15),
  ('Plomero Recién Alta',      -34.6100, -58.3900, 'plomeria',     'pendiente',  true,  15),
  ('Plomero Sin Ubicación',    null,     null,     'plomeria',     'verificado', true,  15),
  ('Plomero Córdoba',          -31.4201, -64.1888, 'plomeria',     'verificado', true,  15),
  ('Plomero Mendoza',          -32.8895, -68.8458, 'plomeria',     'verificado', true,  15),
  ('Plomero Bariloche',        -41.1335, -71.3103, 'plomeria',     'verificado', true,  15),
  ('Electricista Once',        -34.6083, -58.4055, 'electricidad', 'verificado', true,  15),
  ('Cerrajero Caballito',      -34.6187, -58.4406, 'cerrajeria',   'verificado', true,  15),
  ('Plomero Radio Corto',      -34.5300, -58.3200, 'plomeria',     'verificado', true,  3),
  ('Electricista La Plata',    -34.9214, -57.9544, 'electricidad', 'verificado', true,  40),
  ('Electricista Tigre',       -34.4260, -58.5800, 'electricidad', 'verificado', true,  30);

-- Cliente: Obelisco, CABA. Misma fórmula (semiverseno) y misma caja
-- delimitadora que tecnicos_cercanos() en db/07_trabajadores.sql.
with parametros as (
  select -34.6037::double precision as lat, -58.3816::double precision as lng,
         'plomeria'::text as categoria, 30::double precision as radio_km
),
caja as (
  select p.lat, p.lng, p.categoria, p.radio_km,
         p.radio_km / 111.0 as delta_lat,
         p.radio_km / (111.0 * cos(radians(p.lat))) as delta_lng
  from parametros p
),
candidatos as (
  select
    tp.nombre,
    least(caja.radio_km, coalesce(tp.radio_km, caja.radio_km)) as radio_efectivo,
    6371 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(caja.lat)) * cos(radians(tp.lat)) *
          cos(radians(tp.lng) - radians(caja.lng)) +
        sin(radians(caja.lat)) * sin(radians(tp.lat))
      ))
    ) as distancia_km
  from trabajadores_prueba tp
  cross join caja
  where tp.estado = 'verificado'
    and tp.disponible
    and tp.categoria = caja.categoria
    and tp.lat is not null
    and tp.lng is not null
    and tp.lat between caja.lat - caja.delta_lat and caja.lat + caja.delta_lat
    and tp.lng between caja.lng - caja.delta_lng and caja.lng + caja.delta_lng
)
select nombre, round(distancia_km::numeric, 2) as distancia_km
from candidatos
where distancia_km <= radio_efectivo
order by distancia_km asc;

-- Chequeo automático: 7 resultados, el más cercano es San Telmo.
do $$
declare
  cantidad int;
  mas_cercano text;
begin
  select count(*), (array_agg(nombre order by distancia_km))[1]
    into cantidad, mas_cercano
  from (
    with parametros as (
      select -34.6037::double precision as lat, -58.3816::double precision as lng,
             'plomeria'::text as categoria, 30::double precision as radio_km
    ),
    caja as (
      select p.lat, p.lng, p.categoria, p.radio_km,
             p.radio_km / 111.0 as delta_lat,
             p.radio_km / (111.0 * cos(radians(p.lat))) as delta_lng
      from parametros p
    )
    select tp.nombre,
      least(caja.radio_km, coalesce(tp.radio_km, caja.radio_km)) as radio_efectivo,
      6371 * acos(least(1.0, greatest(-1.0,
        cos(radians(caja.lat)) * cos(radians(tp.lat)) * cos(radians(tp.lng) - radians(caja.lng)) +
        sin(radians(caja.lat)) * sin(radians(tp.lat))
      ))) as distancia_km
    from trabajadores_prueba tp
    cross join caja
    where tp.estado = 'verificado' and tp.disponible and tp.categoria = caja.categoria
      and tp.lat is not null and tp.lng is not null
      and tp.lat between caja.lat - caja.delta_lat and caja.lat + caja.delta_lat
      and tp.lng between caja.lng - caja.delta_lng and caja.lng + caja.delta_lng
  ) c
  where c.distancia_km <= c.radio_efectivo;

  if cantidad = 7 and mas_cercano = 'Plomero San Telmo' then
    raise notice '✅ OK: 7 resultados, el más cercano es Plomero San Telmo';
  else
    raise exception '❌ FALLÓ: esperaba 7 resultados con San Telmo primero, dio % resultados con % primero', cantidad, mas_cercano;
  end if;
end $$;

rollback;
