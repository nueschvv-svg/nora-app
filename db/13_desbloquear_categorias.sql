-- ============================================================
-- NORA — Desbloquear todos los rubros
--
-- Sólo Plomería, Electricidad y Cerrajería estaban activos; el resto
-- (Gas, Aire acond., Pintura, Carpintería, Albañilería, Limpieza)
-- aparecía "Pronto" y no se podía elegir. El diagnóstico por foto para
-- esos rubros todavía no tiene catálogo de síntomas cargado
-- (catalogo_trabajos), así que Nora va a decir honestamente "no
-- identificado" en vez de inventar un estimado — el precio para esos
-- casos lo confirma el equipo desde el panel de operaciones, como
-- siempre que no hay diagnóstico automático. Pero el pedido ya se
-- puede hacer hoy, no hay que esperar a que el catálogo esté completo.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

update categorias set activa = true where activa = false;
