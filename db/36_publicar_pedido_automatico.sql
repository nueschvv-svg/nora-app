-- ============================================================
-- NORA — El pedido nace visible para los técnicos, no atascado
--
-- BUG CRÍTICO encontrado probando el flujo completo con dos cuentas
-- (cliente y técnico) a corta distancia: el pedido del cliente NUNCA
-- apareció en la bolsa del técnico. No era un tema de geolocalización
-- ni de radio — pedidos_abiertos_para_tecnico() (db/31_bolsa_por_distancia.sql)
-- sólo devuelve servicios con estado = 'buscando_tecnico', pero
-- crearServicio() (lib/datos.ts) siempre insertaba con estado =
-- 'solicitado'. NADA transicionaba automáticamente de uno a otro —
-- sólo un humano a mano desde /operaciones/[id]. El propio código lo
-- decía (lib/tipos.ts): "El panel de operaciones los mueve a mano en
-- el MVP; después se automatizan." Sin alguien mirando el panel en
-- paralelo, todo pedido quedaba invisible para siempre.
--
-- Fix: el pedido nace directo en 'buscando_tecnico'. Mismo modelo de
-- seguridad de siempre (02_permisos.sql: el cliente NUNCA puede fijar
-- técnico, monto, comisión ni referencia de pago al crear) — sólo se
-- amplía la lista blanca de estados iniciales aceptados, de uno a dos.
-- 'solicitado' se deja en el enum y en la política por si en el futuro
-- hace falta un estado "pendiente de revisión" antes de publicarlo
-- (ej. moderación de contenido) — hoy no se usa, pero no cuesta nada
-- dejarlo disponible.
--
-- El camino de operaciones (Telegram/Enjinia, asignar técnico a mano)
-- sigue existiendo exactamente igual: esto no le saca nada, sólo deja
-- de ser la ÚNICA forma de que un pedido sea visible.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

drop policy if exists "el cliente crea su pedido" on servicios;

create policy "el cliente crea su pedido"
  on servicios for insert
  with check (
    cliente_id = auth.uid()
    and estado in ('solicitado', 'buscando_tecnico')
    and tecnico_id is null
    and monto_ars is null
    and comision_ars is null
    and pago_referencia is null
    and exists (
      select 1 from propiedades p
      where p.id = propiedad_id and p.dueno_id = auth.uid()
    )
  );

comment on policy "el cliente crea su pedido" on servicios is
  'Mismas restricciones de siempre (sin técnico, sin monto, sin comisión, sin pago, propiedad propia) — ahora acepta nacer directo en buscando_tecnico para que el pedido sea visible en la bolsa del técnico sin depender de que operaciones lo mueva a mano.';
