-- ============================================================
-- CORRECCIÓN — bitácora de servicios
--
-- El disparador original era `before insert`: intentaba anotar el
-- evento antes de que la fila del servicio existiera, y la clave
-- foránea lo rechazaba. Efecto práctico: NINGÚN pedido se podía crear.
--
-- Se parte en dos porque son dos momentos distintos:
--   · Actualizar la fecha modifica la fila -> tiene que ser BEFORE.
--   · Anotar en la bitácora apunta a la fila -> tiene que ser AFTER.
-- ============================================================

drop trigger if exists trg_eventos_servicio on servicios;

create or replace function public.tocar_servicio()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_el := now();
  return new;
end;
$$;

create or replace function public.registrar_evento_servicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    insert into servicio_eventos (servicio_id, estado_nuevo, estado_previo, actor_id)
    values (new.id, new.estado,
            case when tg_op = 'UPDATE' then old.estado else null end,
            auth.uid());
  end if;
  return null; -- en un AFTER el valor de retorno se ignora
end;
$$;

create trigger trg_tocar_servicio
  before insert or update on servicios
  for each row execute function public.tocar_servicio();

create trigger trg_eventos_servicio
  after insert or update on servicios
  for each row execute function public.registrar_evento_servicio();
