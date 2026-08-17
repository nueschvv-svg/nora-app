-- ============================================================
-- NORA — La bolsa del técnico, ordenada por distancia real
--
-- Del análisis de flujos de Rappi: el matching por proximidad ya
-- existía en este proyecto (tecnicos_cercanos(), db/07_trabajadores.sql)
-- pero nada lo usaba — la bolsa (pedidos_abiertos_para_tecnico(),
-- db/20_zona_bolsa_tecnico.sql) ordenaba sólo por fecha de creación.
-- La ubicación del TÉCNICO ya se guarda (geolocalización al cargar su
-- ficha, FormularioTrabajador.tsx) — lo que faltaba era la del
-- CLIENTE (propiedades.latitud/longitud, columnas que ya existían en
-- el esquema pero nunca se completaban: ver db/29 en adelante y el
-- cambio en lib/datos.ts que ahora geocodifica al cargar un domicilio).
--
-- Esta función reemplaza a la de db/20: mismo criterio de
-- autorización (técnico verificado, disponible, del rubro del
-- pedido), pero ahora calcula la distancia real cuando puede (técnico
-- y propiedad con lat/lng cargados) y ordena por eso. Si a alguno de
-- los dos le falta la ubicación, ese pedido se muestra igual — al
-- final de la lista, ordenado por fecha como antes — nunca desaparece
-- de la bolsa por no tener coordenadas.
--
-- Postgres no deja cambiarle el tipo de retorno a una función con
-- `create or replace` — hay que borrarla primero. Esta versión suma
-- una columna nueva (distancia_km) a la de db/20, así que rompe con
-- `create or replace` igual que ya había pasado con
-- tecnico_de_mi_servicio() en db/24_calificaciones.sql.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

drop function if exists pedidos_abiertos_para_tecnico();

create function pedidos_abiertos_para_tecnico()
returns table (
  id uuid,
  categoria_slug text,
  categoria_nombre text,
  propiedad_localidad text,
  descripcion text,
  creado_el timestamptz,
  distancia_km numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select t.latitud, t.longitud
    from tecnicos t
    where t.id = auth.uid() and t.estado = 'verificado' and t.disponible
  ),
  -- Postgres no deja usar un alias del SELECT adentro de una expresión
  -- en ORDER BY (funciona solo, suelto — "order by distancia_km" sí,
  -- "order by (distancia_km is null)" no). Envolviendo todo en una
  -- subconsulta, distancia_km pasa a ser una columna real de acá
  -- adentro, y ahí sí se puede usar en cualquier expresión.
  candidatos as (
    select
      s.id,
      s.categoria_slug,
      c.nombre as categoria_nombre,
      p.localidad as propiedad_localidad,
      s.descripcion,
      s.creado_el,
      case
        when yo.latitud is null or yo.longitud is null or p.latitud is null or p.longitud is null then null
        else round(
          (6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(yo.latitud)) * cos(radians(p.latitud)) *
                cos(radians(p.longitud) - radians(yo.longitud)) +
              sin(radians(yo.latitud)) * sin(radians(p.latitud))
            ))
          ))::numeric,
          2
        )
      end as distancia_km
    from servicios s
    join categorias c on c.slug = s.categoria_slug
    join propiedades p on p.id = s.propiedad_id
    cross join yo
    where s.tecnico_id is null
      and s.estado = 'buscando_tecnico'
      -- Si `yo` no trae ninguna fila (no verificado o no disponible), el
      -- cross join ya vacía todo el resultado solo — no hace falta
      -- repetir la condición acá.
      and exists (
        select 1 from tecnico_categorias tc
        where tc.tecnico_id = auth.uid() and tc.categoria_slug = s.categoria_slug
      )
  )
  select id, categoria_slug, categoria_nombre, propiedad_localidad, descripcion, creado_el, distancia_km
  from candidatos
  -- Con distancia conocida, la más cercana primero. Sin distancia (a
  -- alguno de los dos le falta ubicación), al final, por fecha —
  -- nunca se pierde un pedido de la lista por esto.
  order by (distancia_km is null), distancia_km asc, creado_el desc;
$$;

comment on function pedidos_abiertos_para_tecnico is
  'Misma autorización que antes (db/20): técnico verificado, disponible, del rubro del pedido. Ahora también calcula distancia real cuando técnico y propiedad tienen lat/lng, y ordena por eso — el resto sigue por fecha, al final de la lista.';
