-- ============================================================
-- NORA — Eliminar por completo el esquema de Obras
--
-- Pivot: "Eliminá la sección obras... solo va a ser para pedir
-- servicios la aplicacion". Obras (seguimiento de construcciones
-- propias, invitaciones a colaboradores, chat por obra) queda fuera
-- del alcance — la app es un solo flujo: pedir un servicio. Todo el
-- código de pantalla ya se borró (HojaChatObra, FormularioObra,
-- HojaInvitarObra, HiloChat, lib/obras.ts, lib/obraChat.ts, la ruta
-- /obras). Esto borra lo que queda del lado de la base: las tablas de
-- 25_obras.sql, 29_obras_colaboracion.sql, 30_arreglos_obras_
-- colaboracion.sql y 31_roles_invitacion_obra.sql, y las funciones que
-- las acompañaban.
--
-- Nada de esto lo usa el catálogo de precios ni categorías: los
-- "obra" que aparecen en 04_catalogo_precios.sql y
-- 27_precios_faltantes.sql son "mano de obra" / "obra chica" — texto
-- de rubros de albañilería, sin relación con esta tabla.
--
-- Orden: tablas primero (hijas antes que la tabla obras, por las
-- foreign keys — las políticas y triggers de cada una se van solos
-- con el `drop table`), funciones al final. Todo con `if exists`:
-- es seguro volver a correrlo.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

-- ---------- Tablas (hijas primero) ----------

drop table if exists obra_mensajes;
drop table if exists obra_invitaciones;
drop table if exists obra_participantes;
drop table if exists obras;

-- ---------- Funciones ----------

drop function if exists tocar_obra();
drop function if exists restringir_update_colaborador_obra();
drop function if exists participantes_de_obra(uuid);
drop function if exists invitacion_para_rol(uuid, text, text);
drop function if exists unirse_a_obra(text);
drop function if exists es_participante_de_obra(uuid);
drop function if exists es_dueno_de_obra(uuid);
