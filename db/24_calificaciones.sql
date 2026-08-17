-- ============================================================
-- NORA — Conectar el sistema de calificaciones ya existente
--
-- `calificaciones`, sus permisos y hasta una vista con el promedio
-- (tecnicos_publico) ya estaban en 01/02_permisos.sql desde el
-- principio — nunca se conectaron del lado de ninguna pantalla. El
-- cliente no tenía forma de calificar, y nadie veía el promedio de
-- nadie. No hace falta tocar la tabla ni sus políticas, ya estaban
-- bien: sólo faltaba poder leer el promedio del técnico asignado.
--
-- `tecnicos_publico` no sirve para esto en particular: es
-- security_invoker, así que corre con el RLS de quien pregunta — y
-- `perfiles`/`tecnicos` sólo se pueden leer a uno mismo (02_permisos.sql,
-- a propósito). Un cliente consultando la ficha de OTRO técnico
-- (el que le asignaron) se queda sin nombre. Mismo problema, mismo
-- patrón de solución que ya se usó para nombre y foto de perfil
-- (db/21): se extiende la función security definer que ya existe
-- para que además traiga promedio y cantidad de trabajos.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create or replace function tecnico_de_mi_servicio(p_servicio_id uuid)
returns table (nombre text, foto_perfil_path text, promedio numeric, trabajos bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.nombre,
    t.foto_perfil_path,
    (select round(avg(c.estrellas)::numeric, 1) from calificaciones c where c.tecnico_id = t.id),
    (select count(*) from servicios s2 where s2.tecnico_id = t.id and s2.estado in ('pagado', 'calificado'))
  from servicios s
  join perfiles p on p.id = s.tecnico_id
  join tecnicos t on t.id = s.tecnico_id
  where s.id = p_servicio_id
    and s.cliente_id = auth.uid()
    and s.tecnico_id is not null;
$$;
