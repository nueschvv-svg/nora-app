-- ============================================================
-- NORA — Trabajadores: alta propia y matching por cercanía
--
-- Hasta acá, la fila de `tecnicos` sólo la podía crear operaciones a
-- mano. Este archivo abre el alta propia (self-service) y agrega el
-- matching por cercanía que necesita el resto de la app.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar, después de
-- haber corrido 01 a 06.
-- ============================================================

-- ---------- Columnas nuevas en tecnicos ----------
--
-- latitud/longitud: la base del trabajador, para el matching por
-- cercanía. Misma idea que propiedades.latitud/longitud: ninguna de
-- las dos se completa sola. Acá se carga cuando el trabajador se da
-- de alta (geolocalización del navegador, opcional).
--
-- disponible: "¿tomo pedidos ahora mismo?". Es DISTINTO de `estado`.
-- `estado` es el ciclo de vida de la verificación y sólo lo cambia
-- operaciones (ver más abajo). `disponible` lo prende y apaga el
-- propio trabajador, como el cartel de libre de un taxi. Un técnico
-- verificado con disponible = false no tiene que aparecer en ninguna
-- búsqueda.

alter table tecnicos add column if not exists latitud double precision;
alter table tecnicos add column if not exists longitud double precision;
alter table tecnicos add column if not exists disponible boolean not null default false;

comment on column tecnicos.disponible is
  'Si el trabajador está tomando pedidos ahora. Lo cambia él mismo. No confundir con `estado`, que es la verificación y sólo la cambia operaciones.';

-- ---------- Índice para el matching ----------
--
-- Parcial: sólo indexa las filas que el matching puede llegar a usar
-- (verificado + disponible + con ubicación cargada). Así el filtro por
-- caja delimitadora de tecnicos_cercanos() usa el índice en vez de
-- recorrer toda la tabla, incluidos los técnicos pendientes, dados de
-- baja o que hoy no están tomando pedidos.

create index if not exists idx_tecnicos_ubicacion
  on tecnicos (latitud, longitud)
  where disponible and estado = 'verificado';

-- ---------- Impedir que el trabajador se autoverifique ----------
--
-- La política "el técnico edita su ficha" (02_permisos.sql) no
-- restringe columnas: Postgres no permite políticas de UPDATE por
-- columna. Sin este trigger, un trabajador recién dado de alta podría
-- poner estado = 'verificado' o subirse la comisión desde la consola
-- del navegador. Mismo patrón que bloquear_cambio_de_rol() en perfiles.

create or replace function bloquear_autoverificacion_tecnico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_operaciones() then
    if new.estado is distinct from old.estado then
      raise exception 'Sólo operaciones puede cambiar el estado de verificación';
    end if;
    if new.comision_pct is distinct from old.comision_pct then
      raise exception 'Sólo operaciones puede cambiar la comisión';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_autoverificacion on tecnicos;
create trigger trg_bloquear_autoverificacion
  before update on tecnicos
  for each row execute function bloquear_autoverificacion_tecnico();

-- ---------- Alta propia ----------
--
-- Faltaba a propósito en 02_permisos.sql: hasta ahora sólo operaciones
-- podía crear una fila en `tecnicos`. Esto abre el alta propia, pero
-- SIEMPRE en estado 'pendiente' — nadie se verifica a sí mismo dando de
-- alta su ficha; eso lo hace operaciones después, con tecnico_documentos.

create policy "cualquiera se da de alta como trabajador"
  on tecnicos for insert
  with check (id = auth.uid() and estado = 'pendiente');

create policy "el trabajador elige sus rubros"
  on tecnico_categorias for insert
  with check (tecnico_id = auth.uid());

create policy "el trabajador saca un rubro que ya no ofrece"
  on tecnico_categorias for delete
  using (tecnico_id = auth.uid());

-- ---------- Matching por cercanía ----------
--
-- SECURITY DEFINER a propósito: para ordenar por distancia hay que leer
-- la ubicación de TODOS los técnicos verificados, no sólo la propia fila
-- que permite la política de SELECT de tecnicos. La función hace ese
-- salto de forma controlada y devuelve nada más que lo que un cliente
-- ya puede ver de un técnico (mismo criterio que la vista
-- tecnicos_publico): ni latitud, ni longitud, ni CUIT, ni comisión
-- salen de acá.
--
-- Por qué es eficiente con muchos trabajadores: el WHERE de abajo
-- filtra primero por una caja delimitadora (un rango de latitud y de
-- longitud), que sí puede usar idx_tecnicos_ubicacion. La fórmula del
-- semiverseno —la que da la distancia real en kilómetros— se calcula
-- sólo sobre ese recorte, ya chico. No se calcula contra cada fila de
-- la tabla.

create or replace function tecnicos_cercanos(
  p_categoria_slug text,
  p_lat            double precision,
  p_lng            double precision,
  p_radio_km       double precision default 30,
  p_limite         int default 20
)
returns table (
  tecnico_id   uuid,
  nombre       text,
  distancia_km numeric,
  promedio     numeric,
  trabajos     bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with caja as (
    -- ~111 km por grado de latitud. La longitud se ajusta por el
    -- coseno de la latitud del cliente: un grado de longitud vale
    -- menos distancia cuanto más lejos del ecuador.
    select
      p_radio_km / 111.0 as delta_lat,
      p_radio_km / (111.0 * cos(radians(p_lat))) as delta_lng
  ),
  candidatos as (
    select
      t.id,
      p.nombre,
      least(p_radio_km, coalesce(t.radio_km, p_radio_km)) as radio_efectivo,
      6371 * acos(
        -- clamp a [-1, 1]: el redondeo de punto flotante puede dar
        -- 1.0000000002 cuando el trabajador está justo en (p_lat, p_lng),
        -- y acos de un valor fuera de rango devuelve NaN.
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(t.latitud)) *
            cos(radians(t.longitud) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(t.latitud))
        ))
      ) as distancia_km
    from tecnicos t
    join perfiles p on p.id = t.id
    join tecnico_categorias tc on tc.tecnico_id = t.id
    cross join caja
    where t.estado = 'verificado'
      and t.disponible
      and tc.categoria_slug = p_categoria_slug
      and t.latitud is not null
      and t.longitud is not null
      -- Caja delimitadora primero: usa el índice, descarta la mayoría
      -- de las filas antes de calcular ninguna trigonometría.
      and t.latitud  between p_lat - caja.delta_lat and p_lat + caja.delta_lat
      and t.longitud between p_lng - caja.delta_lng and p_lng + caja.delta_lng
  )
  select
    c.id,
    c.nombre,
    round(c.distancia_km::numeric, 2),
    (select round(avg(cal.estrellas)::numeric, 1)
       from calificaciones cal where cal.tecnico_id = c.id),
    (select count(*) from servicios s
      where s.tecnico_id = c.id and s.estado in ('pagado', 'calificado'))
  from candidatos c
  -- La caja es un cuadrado; sus esquinas quedan más lejos que el radio
  -- real. Este filtro saca a quien haya entrado por la caja pero esté
  -- fuera del círculo, y también respeta el radio propio del técnico.
  where c.distancia_km <= c.radio_efectivo
  order by c.distancia_km asc
  limit p_limite;
$$;

comment on function tecnicos_cercanos is
  'Técnicos verificados y disponibles de una categoría, ordenados por cercanía real a (p_lat, p_lng). No expone ubicación exacta ni datos comerciales del técnico: sólo lo que ya es público en tecnicos_publico, más la distancia.';

grant execute on function tecnicos_cercanos(text, double precision, double precision, double precision, int)
  to authenticated;

-- ============================================================
-- QUÉ FALTA
--
-- 1. Un panel de operaciones que llame a tecnicos_cercanos() al asignar
--    un pedido — hoy la función existe y está probada (ver
--    pruebas/matching.mjs y pruebas/matching.sql) pero nada la llama
--    todavía desde el flujo de pedir un servicio, porque ese flujo
--    asigna el técnico a mano del lado de operaciones (ver ESTADO.md).
-- 2. La ubicación del cliente (propiedades.latitud/longitud) tampoco se
--    completa todavía en ningún lado: falta decidir cómo se obtiene
--    (geolocalización al cargar el domicilio, geocodificación de la
--    dirección, o ambas).
-- 3. Encriptar en reposo los documentos del técnico sigue pendiente
--    (ver 02_permisos.sql).
-- ============================================================
