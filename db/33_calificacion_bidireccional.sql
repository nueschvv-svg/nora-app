-- ============================================================
-- NORA — El técnico también puede calificar al cliente
--
-- Del análisis de Rappi: la calificación es de ida y vuelta — el
-- repartidor también califica al pasajero/pedido. Acá sólo existía en
-- un sentido (cliente → técnico). La tabla `calificaciones` tenía un
-- unique en servicio_id solo, así que una fila por servicio, punto —
-- no alcanzaba ni para agregar la segunda calificación sin chocar con
-- la primera.
--
-- No hay pantalla pública de "reputación del cliente" (no se pidió, y
-- announcing eso sería un cambio de producto aparte) — esto queda
-- como señal interna. Igual sigue siendo legible por cualquiera
-- (política "calificaciones visibles" ya existía así desde el
-- principio, sin distinguir sentido) — no se restringe acá porque no
-- es parte de este cambio.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

alter table calificaciones
  add column if not exists calificador text not null default 'cliente' check (calificador in ('cliente', 'tecnico'));

comment on column calificaciones.calificador is
  'Quién calificó a quién en este servicio: "cliente" (califica al técnico, como siempre) o "tecnico" (califica al cliente, nuevo).';

-- El unique original era sobre servicio_id solo (una fila por
-- servicio, sin importar quién calificaba) — se reemplaza por
-- (servicio_id, calificador): ahora cliente y técnico pueden calificar
-- cada uno una vez, sin chocar entre sí.
alter table calificaciones drop constraint if exists calificaciones_servicio_id_key;
alter table calificaciones add constraint calificaciones_servicio_id_calificador_key unique (servicio_id, calificador);

-- La política de INSERT del cliente (02_permisos.sql) no chequeaba
-- `calificador` porque esa columna no existía — el default 'cliente'
-- la deja funcionando igual que antes sin tocar el código ya andando,
-- pero se la deja explícita acá para que no dependa del default si el
-- día de mañana alguien la quita.
drop policy if exists "el cliente califica su servicio terminado" on calificaciones;
create policy "el cliente califica su servicio terminado"
  on calificaciones for insert
  with check (
    calificador = 'cliente'
    and cliente_id = auth.uid()
    and exists (
      select 1 from servicios s
      where s.id = servicio_id
        and s.cliente_id = auth.uid()
        and s.estado in ('finalizado', 'pagado')
    )
  );

create policy "el técnico califica al cliente de su servicio terminado"
  on calificaciones for insert
  with check (
    calificador = 'tecnico'
    and tecnico_id = auth.uid()
    and exists (
      select 1 from servicios s
      where s.id = servicio_id
        and s.tecnico_id = auth.uid()
        and s.estado in ('finalizado', 'pagado', 'calificado')
    )
  );
