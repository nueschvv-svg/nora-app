-- 50: por qué un trabajo está frenado. Aplicar después de 44-49.
--
-- POR QUÉ UNA COLUMNA NUEVA Y NO TRES ESTADOS MÁS EN EL ENUM:
-- "falta una segunda visita", "lo tiene que resolver la administración" y
-- "esperando materiales" no son puntos del ciclo de vida: son motivos por
-- los que el trabajo está frenado, y pueden pasar desde varios estados.
-- Si fueran estados, al marcar "esperando materiales" se perdería dónde
-- estaba el pedido, que es justo el dato que después hace falta para
-- retomarlo. Son dos ejes distintos y se guardan como dos columnas.
--
-- Esto no es una hipótesis: en el archivo histórico de ENJINIA el 28% de
-- los casos queda "PENDIENTE TERMINACION", y eso ocurre con el trabajo ya
-- empezado. El ciclo actual no sabía representarlo y le mostraba al
-- residente un pedido "en curso" que en realidad estaba esperando algo.
--
-- NO SE TOCA solo_permitir_cancelar(): su lista positiva congela por
-- defecto toda columna nueva, así que el residente ya no puede escribir
-- `situacion` ni `situacion_nota` sin que haya que redefinir nada. Volver
-- a escribir ese trigger sería el riesgo, no la solución.
begin;

alter table public.servicios
  add column if not exists situacion text,
  add column if not exists situacion_nota text;

do $$ begin
  alter table public.servicios add constraint servicios_situacion_valida
    check (situacion is null or situacion in ('segunda_visita', 'administracion', 'materiales'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.servicios add constraint servicios_situacion_nota_acotada
    check (situacion_nota is null or length(situacion_nota) <= 300);
exception when duplicate_object then null; end $$;

-- Una nota sin situación es ruido que nadie va a leer en el lugar correcto.
do $$ begin
  alter table public.servicios add constraint servicios_situacion_nota_requiere_situacion
    check (situacion_nota is null or situacion is not null);
exception when duplicate_object then null; end $$;

comment on column public.servicios.situacion is
  'Por qué está frenado el trabajo, en paralelo al estado. NULL = no está frenado.';

-- Un pedido cerrado no puede quedar marcado como frenado: sería mentirle al
-- residente en su propia pantalla de seguimiento.
create or replace function public.limpiar_situacion_al_cerrar()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.estado in ('finalizado', 'pagado', 'calificado', 'cancelado') then
    new.situacion := null;
    new.situacion_nota := null;
  end if;
  return new;
end;
$$;
revoke all on function public.limpiar_situacion_al_cerrar() from public;

drop trigger if exists trg_limpiar_situacion_al_cerrar on public.servicios;
create trigger trg_limpiar_situacion_al_cerrar
  before insert or update on public.servicios
  for each row execute function public.limpiar_situacion_al_cerrar();

-- Bitácora. Se parte de la versión REALMENTE aplicada (db/39, que ya había
-- sacado la rama de técnico de db/12) y se le suma una rama: la del estado
-- queda intacta. Reescribir esto desde una versión vieja perdería ramas.
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
  elsif new.situacion is distinct from old.situacion
        or new.situacion_nota is distinct from old.situacion_nota then
    /* El estado no cambió: se registra el mismo en ambas columnas para no
       falsear una transición que no ocurrió, y el motivo va en la nota. */
    insert into servicio_eventos (servicio_id, estado_nuevo, estado_previo, actor_id, nota)
    values (new.id, new.estado, old.estado, auth.uid(),
            case
              when new.situacion is null then 'El trabajo se destrabó y sigue.'
              when new.situacion = 'segunda_visita' then 'Falta una segunda visita para terminar.'
              when new.situacion = 'administracion' then 'Derivado a la administración del edificio.'
              when new.situacion = 'materiales' then 'Esperando materiales.'
              else 'Cambió el motivo por el que está frenado.'
            end
            || coalesce(' ' || nullif(btrim(new.situacion_nota), ''), ''));
  end if;
  return null;
end;
$$;

commit;
