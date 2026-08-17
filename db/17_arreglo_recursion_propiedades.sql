-- ============================================================
-- NORA — Arreglo: recursión infinita al crear un pedido
--
-- Bug real, encontrado en producción: crear un servicio fallaba con
-- "infinite recursion detected in policy for relation servicios".
--
-- La causa: la política de INSERT en `servicios` ("el cliente crea su
-- pedido") verifica que la propiedad sea del cliente consultando
-- `propiedades`. Pero `propiedades` tiene otra política ("el técnico
-- asignado ve la dirección") que a su vez consulta `servicios` para
-- saber si quien pregunta es el técnico de algún pedido activo ahí.
-- Postgres, al evaluar el INSERT en `servicios`, termina teniendo que
-- volver a evaluar políticas de `servicios` desde adentro de esa
-- consulta anidada — y eso es exactamente lo que la detección de
-- recursión de Postgres corta de raíz, sin importar si en los hechos
-- terminaría o no.
--
-- Esta cadena (servicios → propiedades → servicios) existe desde
-- 02_permisos.sql; quedó latente hasta que el plan que arma el
-- optimizador empezó a pisarla.
--
-- El arreglo: mismo patrón que ya usan es_operaciones() y
-- tecnico_habilitado() en este proyecto — una función security
-- definer. Adentro de una función así, la consulta a `servicios` NO
-- vuelve a disparar las políticas de RLS de `servicios` (corre con los
-- permisos de quien es dueño de la función, no los de quien llama), así
-- que el círculo se corta ahí.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create or replace function tecnico_tiene_trabajo_activo_en(p_propiedad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from servicios s
    where s.propiedad_id = p_propiedad_id
      and s.tecnico_id = auth.uid()
      and s.estado in ('asignado', 'presupuestado', 'aceptado', 'en_camino', 'en_curso')
  );
$$;

comment on function tecnico_tiene_trabajo_activo_en is
  'Sólo para la política de propiedades de abajo. security definer a propósito: evita que consultar servicios desde una política de propiedades dispare de nuevo las políticas de servicios (esa era la recursión).';

drop policy if exists "el técnico asignado ve la dirección" on propiedades;

create policy "el técnico asignado ve la dirección"
  on propiedades for select
  using (tecnico_tiene_trabajo_activo_en(propiedades.id));
