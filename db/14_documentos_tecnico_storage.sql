-- ============================================================
-- NORA — Documentos de verificación del técnico: DNI, selfie, título
--
-- La tabla `tecnico_documentos` (01_esquema.sql) y sus permisos
-- (02_permisos.sql) ya existían, pensados para esto — pero nada subía
-- un archivo real todavía, y el enum de tipos no distinguía frente de
-- dorso ni tenía "selfie". Sin esto, operaciones no tenía con qué
-- verificar a nadie salvo llamarlo por teléfono y confiar.
--
-- Mismo criterio de privacidad que fotos-servicios (08): bucket
-- privado, siempre con URL firmada de corta duración. Acá el dato es
-- más sensible todavía (DNI, cara de la persona), así que el bucket es
-- exclusivamente del propio técnico y de operaciones — ningún cliente
-- lo ve nunca, ni siquiera si ese técnico terminó atendiéndolo.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar, después de
-- haber corrido 01 a 13.
-- ============================================================

-- ---------- Tipos de documento nuevos ----------
--
-- 'dni' seguía sirviendo para un documento genérico; se agregan estos
-- tres porque el alta ahora pide, puntualmente, frente y dorso del DNI
-- más una selfie — no se puede volver a correr en la misma
-- transacción que los usa (regla de Postgres para enums), así que va
-- solo, antes de cualquier otra cosa de este archivo.

alter type tipo_documento add value if not exists 'dni_frente';
alter type tipo_documento add value if not exists 'dni_dorso';
alter type tipo_documento add value if not exists 'selfie';

-- ---------- El bucket ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-tecnicos',
  'documentos-tecnicos',
  false,
  5242880, -- 5 MB, mismo límite que fotos-servicios
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Convención de nombres ----------
--
-- "{tecnico_id}/{uuid}.{ext}" — el primer tramo del path ES el
-- permiso, mismo patrón que fotos-servicios.

create policy "el técnico sube su documento"
  on storage.objects for insert
  with check (
    bucket_id = 'documentos-tecnicos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ver el propio documento de verificación"
  on storage.objects for select
  using (
    bucket_id = 'documentos-tecnicos'
    and ((storage.foldername(name))[1] = auth.uid()::text or es_operaciones())
  );

-- ============================================================
-- QUÉ FALTA
--
-- 1. Encriptar en reposo (ya anotado en 02_permisos.sql) — este bucket
--    hereda esa misma pendiente, es el más sensible de los dos.
-- 2. Borrar el documento si el técnico da de baja la cuenta — hoy
--    queda huérfano en Storage (la fila de tecnico_documentos sí se
--    borra en cascada, el archivo no). No urgente al tamaño actual.
-- ============================================================
