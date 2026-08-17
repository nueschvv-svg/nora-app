-- ============================================================
-- NORA — Código de confirmación al finalizar el trabajo
--
-- Adaptación del análisis de Rappi: el repartidor pide un código de
-- seguridad al cliente para confirmar la entrega — prueba de que la
-- persona correcta lo recibió, no sólo que el repartidor "dice" que
-- entregó. Acá el equivalente: el técnico no puede marcar el trabajo
-- como terminado sin que el cliente le dicte un código de 4 dígitos
-- que la propia app ya le mostró desde que el técnico quedó asignado.
--
-- Se guarda en texto plano a propósito: no es una contraseña, es un
-- código corto de un solo uso por servicio, pensado para dictarse de
-- viva voz — no hay nada que proteger con hash acá.
--
-- Limitación conocida y aceptada: el técnico asignado ya puede leer
-- el resto de su propio servicio (igual que el resto de esta app), así
-- que técnicamente podría leer el código sin que el cliente se lo
-- diga. El valor real de este código no es contra el técnico asignado
-- —es contra decir "terminé" sin que el cliente esté ahí confirmando
-- en el momento. Restringir esa lectura pediría RLS a nivel de columna,
-- que Postgres no da nativo sin vistas separadas — desproporcionado
-- para lo que resuelve acá.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

alter table servicios add column if not exists codigo_confirmacion text;

comment on column servicios.codigo_confirmacion is
  'Código de 4 dígitos que ve el cliente desde que hay técnico asignado, y que el técnico tiene que pedirle para poder finalizar el trabajo. Se genera solo al asignar — ver generar_codigo_confirmacion().';

-- ---------- Generarlo al asignar técnico ----------
-- BEFORE UPDATE, trigger nuevo e independiente — no se toca
-- tocar_servicio() ni ningún trigger compartido ya existente.

create or replace function generar_codigo_confirmacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tecnico_id is not null
     and new.tecnico_id is distinct from old.tecnico_id
     and new.codigo_confirmacion is null then
    new.codigo_confirmacion := lpad(floor(random() * 10000)::int::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_generar_codigo_confirmacion
  before update on servicios
  for each row execute function generar_codigo_confirmacion();

-- ---------- Cómo se valida ----------
-- No hace falta más SQL: el técnico lo ingresa en la app, y el propio
-- código de la app arma el UPDATE con
-- `.eq("codigo_confirmacion", codigoIngresado)` además del `.eq("id", ...)`
-- de siempre. Si el código está mal, el WHERE no matchea ninguna fila,
-- el UPDATE afecta 0 filas, y la app lo interpreta como "código
-- incorrecto" — sin necesitar una función ni un trigger nuevo para
-- comparar. El resto de las reglas (quién puede finalizar, con qué
-- reporte) siguen siendo las de validar_cambio_tecnico(), sin tocar.
