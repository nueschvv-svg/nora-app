-- ============================================================
-- NORA — Permite a operaciones verificar técnicos
--
-- El trigger bloquear_autoverificacion_tecnico() (07_trabajadores.sql)
-- ya deja pasar el cambio de estado cuando es_operaciones() es
-- verdadero — pero nunca existió la política de RLS que le permita a
-- operaciones hacer ese UPDATE en la fila de OTRA persona. La única
-- política de UPDATE en `tecnicos` es "el técnico edita su ficha"
-- (id = auth.uid()), que solo alcanza la fila propia. Resultado: la
-- verificación de técnicos era imposible incluso para operaciones,
-- salvo entrando directo a Supabase con permisos de administrador.
--
-- Mismo patrón que "operaciones actualiza servicios" (10) y
-- "sólo operaciones verifica documentos" (02): la sesión normal de
-- operaciones alcanza, sin service_role.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create policy "operaciones verifica tecnicos"
  on tecnicos for update
  using (es_operaciones())
  with check (es_operaciones());
