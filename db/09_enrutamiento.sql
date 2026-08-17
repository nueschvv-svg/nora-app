-- ============================================================
-- NORA — Registro de enrutamiento de pedidos
--
-- Hasta acá, un pedido se guardaba (servicios) y ahí se cortaba: nada
-- avisaba a nadie. Este archivo agrega la tabla donde queda registrado
-- cada intento de avisar — hoy por Telegram, mañana quizás por
-- matching automático — sea que haya salido bien o mal.
--
-- Por qué existe esta tabla y no alcanza con mirar `servicios`: un
-- pedido sin fila acá es exactamente la pregunta que operaciones
-- necesita poder hacerse — "¿a este lo vio alguien?" — sin tener que
-- confiar en que el navegador de un cliente haya llegado a avisar.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar, después de
-- haber corrido 01 a 08.
-- ============================================================

create type estado_enrutamiento as enum ('enviado', 'fallido');

create table servicio_enrutamientos (
  id            uuid primary key default gen_random_uuid(),
  servicio_id   uuid not null references servicios(id) on delete cascade,
  -- 'telegram' hoy; el día que exista una estrategia de matching
  -- automático, este mismo campo la identifica sin agregar columnas.
  estrategia    text not null,
  estado        estado_enrutamiento not null,
  -- Motivo si falló, o un detalle corto si salió bien (ej: id del
  -- mensaje de Telegram). Nunca un secreto: esto lo puede leer el
  -- propio cliente dueño del pedido.
  detalle       text,
  intentos      smallint not null default 1,
  creado_el     timestamptz not null default now()
);

create index on servicio_enrutamientos (servicio_id);

-- Para la pregunta operativa "¿qué pedidos quedaron sin avisar?":
-- todo lo que esté en 'fallido', o todo lo que no tenga ninguna fila
-- acá (ver comentario de arriba). Este índice acelera el primer caso.
create index on servicio_enrutamientos (estado) where estado = 'fallido';

alter table servicio_enrutamientos enable row level security;

-- Mismo criterio exacto que "ver/subir fotos del propio servicio" en
-- servicio_fotos (02_permisos.sql): cliente dueño, técnico asignado,
-- u operaciones.

create policy "ver el enrutamiento del propio servicio"
  on servicio_enrutamientos for select
  using (
    exists (
      select 1 from servicios s
      where s.id = servicio_enrutamientos.servicio_id
        and (s.cliente_id = auth.uid() or s.tecnico_id = auth.uid())
    )
    or es_operaciones()
  );

-- La inserta el servidor (app/api/pedidos/[id]/enrutar), actuando con
-- la sesión del propio cliente que hizo el pedido — no con
-- service_role. Por eso necesita esta política igual que cualquier
-- otra escritura de esta app.
create policy "registrar el enrutamiento del propio servicio"
  on servicio_enrutamientos for insert
  with check (
    exists (
      select 1 from servicios s
      where s.id = servicio_id
        and s.cliente_id = auth.uid()
    )
  );

-- ============================================================
-- QUÉ FALTA
--
-- 1. Un lugar donde operaciones vea "pedidos sin avisar" de un
--    vistazo (hoy hay que consultarlo a mano en Supabase). Es parte
--    del panel de operaciones pendiente, no de este cambio.
-- 2. Si algún día esto necesita reintentos automáticos más allá del
--    que ya hace la estrategia de Telegram en el momento, hace falta
--    una cola de verdad (pg_cron, un job externo). Hoy alcanza con
--    que quede registrado para que alguien lo reintente a mano.
-- ============================================================
