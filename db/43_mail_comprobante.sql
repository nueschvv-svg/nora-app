-- ============================================================
-- NORA — Mail de contacto para mandar el comprobante del pedido
--
-- Sin cuentas, el mail de Supabase Auth de una sesión anónima está
-- vacío — no hay dónde mandar nada. Este es un campo aparte, que la
-- persona carga (opcional) junto con nombre y teléfono en el último
-- paso de /pedir, sólo para recibir el comprobante por mail. No es
-- una cuenta ni un login: es un dato de contacto más, como el
-- teléfono.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

alter table perfiles
  add column if not exists mail_contacto text;

comment on column perfiles.mail_contacto is
  'Mail de contacto cargado voluntariamente para recibir el comprobante del pedido — no es el mail de auth.users (vacío en sesiones anónimas) ni implica ningún login.';
