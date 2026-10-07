-- 51: validar la acción del residente ANTES de limpiar la situación al cerrar.
-- PostgreSQL ejecuta BEFORE triggers por nombre. El de db/50 corría antes
-- de trg_solo_cancelar: una cancelación legítima parecía modificar columnas
-- protegidas. No se redefine ninguna función de autorización ni bitácora.
-- Repetible. Aplicar después de 50; si se repite 50, repetir también 51.
begin;
drop trigger if exists trg_limpiar_situacion_al_cerrar on public.servicios;
drop trigger if exists trg_y_limpiar_situacion_al_cerrar on public.servicios;
create trigger trg_y_limpiar_situacion_al_cerrar
  before insert or update on public.servicios
  for each row execute function public.limpiar_situacion_al_cerrar();
commit;
