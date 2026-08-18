-- ============================================================
-- NORA — Arreglos encontrados probando la invitación a obras a fondo
-- (dueña + arquitecta/socio invitados, con dos cuentas reales)
--
-- 1. BUG CRÍTICO: unirse_a_obra() rompía SIEMPRE que alguien
--    distinto del dueño tocaba el link — "column reference obra_id
--    is ambiguous". La función devolvía una columna de salida
--    llamada `obra_id` (RETURNS TABLE), y Postgres/plpgsql declara
--    esa salida como una variable más adentro de la función — que
--    choca de nombre con la columna real `obra_id` de
--    `obra_participantes` que la misma función usa para insertar al
--    nuevo colaborador. Se corrige renombrando las columnas de
--    salida para que no choquen con ninguna columna real
--    (`id_obra`/`nombre_obra`).
--
-- 2. Hueco de permisos: la política de UPDATE que dejaba a un
--    colaborador tocar "etapas y ejecutado" en realidad lo dejaba
--    reescribir la fila ENTERA de `obras` — Postgres no filtra UPDATE
--    por columna. Un colaborador invitado podía, con una llamada
--    directa (no hace falta ni la consola del navegador, alcanza con
--    el cliente de Supabase), cambiarse a sí mismo el `cliente_id` y
--    quedarse con la obra, o reescribir presupuesto/contacto. Se
--    corrige con un trigger — mismo criterio ya usado para
--    `perfiles.rol` (02_permisos.sql) y para la cancelación de
--    servicios (22_confirmar_pago.sql).
--
-- 3. El chat y el listado de colaboradores no tenían forma de saber
--    el NOMBRE de cada participante: `perfiles` sólo se puede leer
--    la propia fila (o operaciones), así que un colaborador no podía
--    ver el nombre de otro aunque compartieran una obra — el chat de
--    más de dos personas mostraba todos los mensajes ajenos igual,
--    sin firma. Se agrega una función acotada, mismo criterio que
--    perfil_publico_tecnico() (db/35): sólo nombre, sólo para quien
--    ya es dueño o colaborador de esa obra puntual.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

-- ---------- 1. Arreglar unirse_a_obra() ----------

drop function if exists unirse_a_obra(text);

create function unirse_a_obra(p_codigo text)
returns table (id_obra uuid, nombre_obra text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nombre text;
  v_cliente_id uuid;
begin
  select o.id, o.nombre, o.cliente_id into v_id, v_nombre, v_cliente_id
  from obras o where o.codigo_invitacion = p_codigo;

  if v_id is null then
    raise exception 'Ese link de invitación no es válido.';
  end if;

  if v_cliente_id is distinct from auth.uid() then
    insert into obra_participantes (obra_id, usuario_id)
    values (v_id, auth.uid())
    on conflict (obra_id, usuario_id) do nothing;
  end if;

  return query select v_id, v_nombre;
end;
$$;

-- ---------- 2. Un colaborador sólo puede tocar etapas/ejecutado ----------

create or replace function restringir_update_colaborador_obra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sólo el dueño ACTUAL (old.cliente_id) puede tocar cualquier campo.
  -- A propósito NUNCA se compara contra new.cliente_id: ese valor lo
  -- pone quien manda el update, así que un colaborador que se quisiera
  -- robar la obra sólo tendría que mandar cliente_id = auth.uid() para
  -- que esa comparación le diera "true" — exactamente el agujero que
  -- este trigger existe para cerrar. (Se encontró probando el exploit
  -- de verdad con dos cuentas reales, no en el papel.)
  if old.cliente_id = auth.uid() then
    return new;
  end if;

  -- Cualquier otra persona que llegue hasta acá es un colaborador
  -- (la política de UPDATE ya exige es_participante_de_obra) — sólo
  -- puede cambiar etapas y ejecutado_ars, nada más.
  if new.cliente_id is distinct from old.cliente_id
    or new.nombre is distinct from old.nombre
    or new.ubicacion is distinct from old.ubicacion
    or new.presupuesto_ars is distinct from old.presupuesto_ars
    or new.contacto_nombre is distinct from old.contacto_nombre
    or new.contacto_rol is distinct from old.contacto_rol
    or new.contacto_telefono is distinct from old.contacto_telefono
    or new.codigo_invitacion is distinct from old.codigo_invitacion
  then
    raise exception 'Un colaborador sólo puede actualizar las etapas y lo ejecutado de la obra.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restringir_update_colaborador_obra on obras;
create trigger trg_restringir_update_colaborador_obra
  before update on obras
  for each row execute function restringir_update_colaborador_obra();

-- ---------- 3. Nombres de quién está en la obra (dueño + colaboradores) ----------

create or replace function participantes_de_obra(p_obra_id uuid)
returns table (usuario_id uuid, nombre text, es_dueno boolean)
language sql
stable
security definer
set search_path = public
as $$
  -- CTE con columnas explícitamente nombradas: el ORDER BY de abajo
  -- necesita referenciarlas por nombre, y un literal (true/false) sin
  -- alias no cuenta como columna con nombre para eso — mismo motivo
  -- que en tecnicos_cercanos()/pedidos_abiertos_para_tecnico() (db/31).
  with gente as (
    select o.cliente_id as usuario_id, p.nombre, true as es_dueno
    from obras o
    join perfiles p on p.id = o.cliente_id
    where o.id = p_obra_id
    union all
    select op.usuario_id, p.nombre, false as es_dueno
    from obra_participantes op
    join perfiles p on p.id = op.usuario_id
    where op.obra_id = p_obra_id
  )
  select usuario_id, nombre, es_dueno
  from gente
  where es_dueno_de_obra(p_obra_id) or es_participante_de_obra(p_obra_id)
  order by es_dueno desc, nombre;
$$;

comment on function participantes_de_obra is
  'Nombre de cada persona en una obra (dueño + colaboradores) — sólo visible para quien ya es dueño o colaborador de esa obra puntual. Existe porque perfiles sólo se puede leer la fila propia; esto es la excepción acotada, mismo criterio que perfil_publico_tecnico().';
