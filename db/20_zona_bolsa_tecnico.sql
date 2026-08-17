-- ============================================================
-- NORA — El técnico ve la localidad de los pedidos en su bolsa
--
-- Bug encontrado probando en vivo: "el técnico ve pedidos abiertos de
-- su rubro" (db/15_pool_tecnico.sql) permite ver la fila de servicios,
-- pero la política de propiedades ("el técnico asignado ve la
-- dirección", 02_permisos.sql) sólo se activa DESPUÉS de tomar el
-- pedido (tecnico_id = auth.uid()). Antes de tomarlo, el join a
-- propiedades no devuelve nada y la app mostraba "Zona sin cargar" —
-- el técnico no tenía forma de saber ni el barrio antes de decidir.
--
-- No se puede resolver ampliando la política de SELECT de propiedades
-- para la bolsa: esa tabla tiene calle y número, y daría la dirección
-- completa antes de aceptar el trabajo — más de lo que corresponde.
-- En vez de eso, la misma lógica de autorización de la política de la
-- bolsa (verificado, disponible, rubro que ofrece) se repite acá
-- adentro de una función security definer que sólo devuelve localidad,
-- nunca calle ni número — mismo patrón ya usado en este proyecto para
-- casos así (ver suscripciones_para_notificar_en_camino,
-- tecnico_tiene_trabajo_activo_en).
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create or replace function pedidos_abiertos_para_tecnico()
returns table (
  id uuid,
  categoria_slug text,
  categoria_nombre text,
  propiedad_localidad text,
  descripcion text,
  creado_el timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.categoria_slug, c.nombre, p.localidad, s.descripcion, s.creado_el
  from servicios s
  join categorias c on c.slug = s.categoria_slug
  join propiedades p on p.id = s.propiedad_id
  where s.tecnico_id is null
    and s.estado = 'buscando_tecnico'
    and exists (
      select 1 from tecnicos t
      where t.id = auth.uid() and t.estado = 'verificado' and t.disponible
    )
    and exists (
      select 1 from tecnico_categorias tc
      where tc.tecnico_id = auth.uid() and tc.categoria_slug = s.categoria_slug
    )
  order by s.creado_el desc;
$$;

comment on function pedidos_abiertos_para_tecnico is
  'Misma autorización que la política de RLS "el técnico ve pedidos abiertos de su rubro", pero sólo expone localidad — nunca calle ni número — antes de que el técnico acepte el trabajo.';
