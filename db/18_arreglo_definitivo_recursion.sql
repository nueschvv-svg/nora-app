-- ============================================================
-- NORA — Arreglo definitivo de la recursión: había DOS políticas
--
-- 17_arreglo_recursion_propiedades.sql no alcanzó porque el DROP POLICY
-- IF EXISTS de ese archivo escribía el nombre "el técnico asignado ve
-- la dirección" con una codificación de tildes que no coincidía, byte
-- a byte, con el nombre real ya guardado en la base (quedó de alguna
-- ejecución anterior con otra codificación). Postgres los trató como
-- dos nombres distintos: el DROP no encontró nada para borrar, y el
-- CREATE de al lado agregó una política nueva — dejando la vieja,
-- rota, todavía activa en paralelo. Como RLS combina todas las
-- políticas de un mismo comando con "o", la vieja seguía disparando la
-- recursión sin importar que la nueva ya estuviera bien.
--
-- Esta vez no se vuelve a tipear el nombre con tildes: se busca y se
-- borra por catálogo (pg_policies), así no importa cómo esté
-- codificado el que ya existe. Y la política nueva queda con un
-- nombre sin tildes, a propósito, para que esto no se repita.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'propiedades'
      and cmd = 'SELECT'
      and qual ilike '%servicios%'
  loop
    execute format('drop policy %I on public.propiedades', pol.policyname);
  end loop;
end $$;

create policy "tecnico ve propiedad con trabajo activo"
  on propiedades for select
  using (tecnico_tiene_trabajo_activo_en(id));
