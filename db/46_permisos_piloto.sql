-- NORA — Permisos del residente sin pantalla de login.
-- Aplicar después de 39–45 como propietario de las tablas.
-- Supabase signInAnonymously entrega rol authenticated + auth.uid() único;
-- no equivale al rol anon sin sesión. La identidad viene del JWT.
-- Conserva los permisos de operaciones y service_role existentes.
-- Prueba local: cd web && node --test tests/permissions.test.cjs
-- PGlite ejecuta este SQL sobre fixture post-43 con funciones/políticas
-- reales de 02/10/39; no sustituye verificar JWT, Storage y políticas desplegadas.
begin;

-- RESTRICTIVE se combina con AND con las políticas existentes; una política
-- permisiva adicional no puede ampliar el acceso a otro pedido.
-- service_role conserva BYPASSRLS.
drop policy if exists "piloto limita servicios a su titular" on public.servicios;
create policy "piloto limita servicios a su titular"
  on public.servicios as restrictive for all
  using (public.es_operaciones() or (auth.uid() is not null and cliente_id = auth.uid()))
  with check (public.es_operaciones() or (auth.uid() is not null and cliente_id = auth.uid()));

drop policy if exists "piloto valida pedido inicial" on public.servicios;
create policy "piloto valida pedido inicial"
  on public.servicios as restrictive for insert
  with check (
    public.es_operaciones() or (
      auth.uid() is not null and cliente_id = auth.uid()
      and estado = 'solicitado'
      and monto_ars is null and pago_referencia is null
      and metodo_pago is null and pago_confirmado_el is null
      and reporte is null and garantia_hasta is null
      and exists (
        select 1 from public.propiedades p
        where p.id = servicios.propiedad_id and p.dueno_id = auth.uid()
      )
      and (equipo_id is null or exists (
        select 1 from public.equipos e
        where e.id = servicios.equipo_id and e.propiedad_id = servicios.propiedad_id
      ))
    )
  );

-- Lista positiva: futuras columnas quedan congeladas por defecto.
-- Reemplaza sólo la función del trigger existente trg_solo_cancelar (02/39).
create or replace function public.solo_permitir_cancelar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  permitidas text[] := array['estado', 'actualizado_el'];
begin
  -- RLS deniega anon sin JWT; sólo BYPASSRLS/owner llega sin identidad.
  if auth.uid() is null or public.es_operaciones() then
    return new;
  end if;
  if old.cliente_id is distinct from auth.uid() then
    raise exception 'Sólo podés modificar tu propio pedido';
  end if;

  if old.estado in ('solicitado', 'presupuestado', 'aceptado') and new.estado = 'cancelado' then
    null; -- Cancelar conserva todos los datos, incluido el monto.
  elsif old.estado = 'presupuestado' and new.estado = 'aceptado' then
    null; -- Aceptar conserva el importe ofertado por operaciones.
  elsif old.estado = 'presupuestado' and new.estado = 'solicitado' and new.monto_ars is null then
    permitidas := permitidas || array['monto_ars'];
  elsif old.estado = 'finalizado' and new.estado = 'pagado'
        and old.metodo_pago is null and new.metodo_pago = 'efectivo'
        and new.pago_confirmado_el is not null then
    permitidas := permitidas || array['metodo_pago', 'pago_confirmado_el'];
    new.pago_confirmado_el := now();
  else
    raise exception 'Ese cambio de estado no está permitido para el residente';
  end if;

  if (to_jsonb(new) - permitidas) is distinct from (to_jsonb(old) - permitidas) then
    raise exception 'Sólo podés responder al presupuesto, cancelar o confirmar efectivo sin cambiar otros datos';
  end if;
  -- No confiar en el timestamp recibido ni en el orden de BEFORE triggers.
  new.actualizado_el := now();
  return new;
end;
$$;
commit;
