-- ============================================================
-- NORA — Modelo Rappi: el técnico ve y toma pedidos abiertos
--
-- Hasta acá, sólo operaciones podía asignar un técnico a un pedido —
-- el técnico no tenía forma de ver la bolsa de pedidos sin asignar ni
-- de tomar uno por su cuenta. Este archivo abre eso: cualquier técnico
-- verificado y disponible puede ver los pedidos "buscando_tecnico" de
-- los rubros que ofrece, y tomar uno — lo que en el mismo movimiento
-- cuenta como asignárselo Y aceptarlo (no son dos pasos separados acá,
-- a diferencia de cuando lo asigna operaciones).
--
-- El camino de operaciones asignando a mano sigue existiendo tal cual
-- estaba: esto es un camino ADICIONAL, no un reemplazo. Un pedido
-- puede resolverse por cualquiera de los dos.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar, después de
-- haber corrido 01 a 14.
-- ============================================================

-- ---------- Ver la bolsa ----------

create policy "el técnico ve pedidos abiertos de su rubro"
  on servicios for select
  using (
    tecnico_id is null
    and estado = 'buscando_tecnico'
    and exists (
      select 1 from tecnicos t
      where t.id = auth.uid() and t.estado = 'verificado' and t.disponible
    )
    and exists (
      select 1 from tecnico_categorias tc
      where tc.tecnico_id = auth.uid() and tc.categoria_slug = servicios.categoria_slug
    )
  );

-- ---------- Tomar un pedido ----------
--
-- La condición de "puede tocar esta fila" (USING) es la misma que la
-- de ver la bolsa: sólo pedidos sin técnico, del rubro que ofrece,
-- estando verificado y disponible. Qué cambia exactamente al tomarlo
-- lo valida el trigger de más abajo, no esta política.

create policy "el técnico reclama un pedido abierto de su rubro"
  on servicios for update
  using (
    tecnico_id is null
    and estado = 'buscando_tecnico'
    and exists (
      select 1 from tecnicos t
      where t.id = auth.uid() and t.estado = 'verificado' and t.disponible
    )
    and exists (
      select 1 from tecnico_categorias tc
      where tc.tecnico_id = auth.uid() and tc.categoria_slug = servicios.categoria_slug
    )
  )
  with check (tecnico_id = auth.uid());

-- ---------- Qué implica "tomar" un pedido, exactamente ----------
--
-- Un solo movimiento válido: tecnico_id pasa a ser el propio, estado
-- pasa directo a "asignado", y tecnico_confirmado_el se pone en el
-- momento — tomarlo YA es aceptarlo, no hace falta un segundo paso.
-- Nada más puede cambiar: ni precio, ni cliente, ni descripción.

create or replace function validar_reclamo_tecnico(anterior servicios, nueva servicios)
returns servicios
language plpgsql
as $$
begin
  if anterior.estado <> 'buscando_tecnico' or anterior.tecnico_id is not null then
    raise exception 'Este pedido ya no está disponible';
  end if;
  if nueva.estado <> 'asignado' then
    raise exception 'Al tomar un pedido pasa directo a "asignado"';
  end if;
  if nueva.tecnico_confirmado_el is null then
    raise exception 'Tomar un pedido ya cuenta como aceptarlo';
  end if;
  if nueva.monto_ars         is distinct from anterior.monto_ars
     or nueva.comision_ars   is distinct from anterior.comision_ars
     or nueva.cliente_id     is distinct from anterior.cliente_id
     or nueva.propiedad_id   is distinct from anterior.propiedad_id
     or nueva.pago_referencia is distinct from anterior.pago_referencia
     or nueva.categoria_slug  is distinct from anterior.categoria_slug
     or nueva.descripcion     is distinct from anterior.descripcion
     or nueva.fecha_preferida is distinct from anterior.fecha_preferida
     or nueva.franja_preferida is distinct from anterior.franja_preferida
     or nueva.reporte         is distinct from anterior.reporte
     or nueva.ubicacion_lat   is distinct from anterior.ubicacion_lat
     or nueva.ubicacion_lng   is distinct from anterior.ubicacion_lng then
    raise exception 'El técnico no puede modificar esos datos al tomar el pedido';
  end if;
  return nueva;
end;
$$;

-- solo_permitir_cancelar() (02_permisos.sql, ya extendido en
-- 12_tecnico_en_terreno.sql) suma esta tercera rama: el reclamo pasa
-- ANTES que la rama "resto: cliente", porque acá old.tecnico_id es
-- null — si no se distingue, caería en esa rama y se rechazaría por
-- intentar cambiar tecnico_id.

create or replace function solo_permitir_cancelar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or es_operaciones() then
    return new;
  end if;

  if old.tecnico_id is not null and old.tecnico_id = auth.uid() then
    return validar_cambio_tecnico(old, new);
  end if;

  if old.tecnico_id is null and new.tecnico_id = auth.uid() then
    return validar_reclamo_tecnico(old, new);
  end if;

  if new.monto_ars       is distinct from old.monto_ars
     or new.comision_ars is distinct from old.comision_ars
     or new.tecnico_id   is distinct from old.tecnico_id
     or new.cliente_id   is distinct from old.cliente_id
     or new.propiedad_id is distinct from old.propiedad_id
     or new.pago_referencia is distinct from old.pago_referencia
     or new.reporte      is distinct from old.reporte
     or new.tecnico_confirmado_el is distinct from old.tecnico_confirmado_el
     or new.ubicacion_lat is distinct from old.ubicacion_lat
     or new.ubicacion_lng is distinct from old.ubicacion_lng
     or new.ubicacion_actualizada_el is distinct from old.ubicacion_actualizada_el then
    raise exception 'Sólo el equipo de Nora puede modificar estos datos del servicio';
  end if;
  return new;
end;
$$;
