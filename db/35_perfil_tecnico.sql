-- ============================================================
-- NORA — Llamar al técnico + ver su perfil público
--
-- Pedido explícito: poder llamarlo por cualquier cosa, y poder ver su
-- perfil (trabajos hechos con Nora, cantidad de calificaciones,
-- promedio de estrellas).
--
-- Dos cosas separadas a propósito, con distinto alcance de privacidad:
--
-- 1. Teléfono: sólo lo ve el cliente que TIENE a ese técnico asignado
--    en un pedido activo — se agrega a tecnico_de_mi_servicio(), que
--    ya tiene exactamente esa autorización (db/24_calificaciones.sql).
--    No es dato para cualquiera que mire un perfil.
--
-- 2. Perfil público (nombre, foto, promedio, cantidad de trabajos,
--    cantidad de calificaciones, rubros): esto sí lo puede ver
--    cualquier usuario logueado, sin necesitar tener un pedido con
--    ese técnico — es la misma idea que "ver perfil" en cualquier
--    marketplace. Nueva función, perfil_publico_tecnico().
--
-- Postgres no deja cambiarle el tipo de retorno a una función con
-- `create or replace` — tecnico_de_mi_servicio() hay que borrarla
-- primero (ya pasó antes con esta misma función, db/24).
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

drop function if exists tecnico_de_mi_servicio(uuid);

create function tecnico_de_mi_servicio(p_servicio_id uuid)
returns table (nombre text, foto_perfil_path text, telefono text, promedio numeric, trabajos bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.nombre,
    t.foto_perfil_path,
    p.telefono,
    (select round(avg(c.estrellas)::numeric, 1) from calificaciones c where c.tecnico_id = t.id and c.calificador = 'cliente'),
    (select count(*) from servicios s2 where s2.tecnico_id = t.id and s2.estado in ('pagado', 'calificado'))
  from servicios s
  join perfiles p on p.id = s.tecnico_id
  join tecnicos t on t.id = s.tecnico_id
  where s.id = p_servicio_id
    and s.cliente_id = auth.uid()
    and s.tecnico_id is not null;
$$;

-- ---------- Perfil público (sin teléfono) ----------

create or replace function perfil_publico_tecnico(p_tecnico_id uuid)
returns table (
  nombre text,
  foto_perfil_path text,
  promedio numeric,
  trabajos bigint,
  calificaciones bigint,
  rubros text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.nombre,
    t.foto_perfil_path,
    (select round(avg(c.estrellas)::numeric, 1) from calificaciones c where c.tecnico_id = t.id and c.calificador = 'cliente'),
    (select count(*) from servicios s2 where s2.tecnico_id = t.id and s2.estado in ('pagado', 'calificado')),
    (select count(*) from calificaciones c where c.tecnico_id = t.id and c.calificador = 'cliente'),
    (select array_agg(cat.nombre order by cat.nombre)
       from tecnico_categorias tc join categorias cat on cat.slug = tc.categoria_slug
       where tc.tecnico_id = t.id)
  from tecnicos t
  join perfiles p on p.id = t.id
  where t.id = p_tecnico_id and t.estado = 'verificado';
$$;

comment on function perfil_publico_tecnico is
  'Ficha pública de un técnico verificado — cualquier usuario logueado la puede ver, no hace falta tener un pedido con él. Sin teléfono ni ubicación ni datos comerciales: eso sigue siendo sólo para quien lo tiene asignado (tecnico_de_mi_servicio).';
