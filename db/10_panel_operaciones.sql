-- ============================================================
-- NORA — Panel de operaciones: permisos de escritura
--
-- Hasta acá, ningún cliente ni técnico podía hacer UPDATE sobre
-- `servicios` (salvo cancelar el propio pedido) — a propósito, para
-- que nadie se pusiera su propio precio o se asignara un técnico.
-- Pero el trigger que impone esa regla (solo_permitir_cancelar,
-- 02_permisos.sql) YA deja pasar cualquier cambio cuando
-- es_operaciones() es verdadero — sólo faltaba la política de RLS
-- que dejara llegar el UPDATE hasta ahí. Con esto, el panel de
-- operaciones escribe con la sesión normal de quien esté logueado
-- como operaciones: no hace falta service_role ni ningún secreto
-- nuevo.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar, después de
-- haber corrido 01 a 09.
-- ============================================================

create policy "operaciones actualiza servicios"
  on servicios for update
  using (es_operaciones())
  with check (es_operaciones());

-- ---------- Bitácora con nota ----------
--
-- servicio_eventos ya existe con una columna `nota`, pero hasta acá
-- sólo la llena el trigger automático (y siempre vacía: registra el
-- cambio de estado, no el motivo). Esto deja que operaciones agregue
-- una fila a mano — por ejemplo al reprogramar un pedido porque el
-- técnico no puede ir en el horario que había elegido el cliente — sin
-- necesidad de que eso implique cambiar el estado.

create policy "operaciones registra un evento con nota"
  on servicio_eventos for insert
  with check (es_operaciones());

-- ============================================================
-- QUÉ FALTA
--
-- 1. Verificar técnicos (pasar tecnico_documentos y tecnicos.estado de
--    'pendiente' a 'verificado') sigue siendo manual, hoy no forma
--    parte de este panel — es una función de operaciones relacionada
--    pero distinta, que se puede sumar después con el mismo criterio
--    (ya tiene RLS de lectura para operaciones, sólo faltaría UI).
-- 2. Asignar técnico sigue siendo manual (por categoría), no por
--    cercanía — tecnicos_cercanos() está lista pero las propiedades
--    todavía no tienen latitud/longitud cargada.
-- ============================================================
