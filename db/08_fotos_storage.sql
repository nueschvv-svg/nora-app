-- ============================================================
-- NORA — Storage para fotos de servicios
--
-- La tabla `servicio_fotos` (01_esquema.sql) y sus permisos
-- (02_permisos.sql) ya existían, esperando esto: el bucket real donde
-- viven los archivos. Sin este archivo, la foto se analizaba y se
-- perdía — el diagnóstico quedaba en el texto, pero la imagen no.
--
-- Privado a propósito: la foto de adentro de la casa de alguien es
-- el mismo tipo de dato sensible que su dirección (ver el comentario
-- de la tabla `propiedades`). Se sirve siempre con URL firmada de
-- corta duración, nunca con un link público fijo.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar, después de
-- haber corrido 01 a 07.
-- ============================================================

-- ---------- El bucket ----------
--
-- file_size_limit y allowed_mime_types repiten, del lado de la base,
-- los mismos límites que ya valida app/api/diagnosticar/route.ts
-- (MAX_BYTES_IMAGEN, esTipoImagenValido). No es redundante: la
-- validación del servidor se puede saltear llamando a Storage
-- directo con la clave anon; esto lo bloquea también ahí.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-servicios',
  'fotos-servicios',
  false,
  5242880, -- 5 MB, igual que MAX_BYTES_IMAGEN
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Convención de nombres ----------
--
-- Cada archivo se guarda como "{servicio_id}/{uuid}.{ext}". El primer
-- tramo del path ES el permiso: storage.foldername(name) devuelve
-- ["{servicio_id}"], y las políticas de abajo lo usan para preguntar
-- "¿esta persona puede tocar este servicio?" — la misma pregunta que
-- ya resuelve la política de `servicios`, aplicada acá al archivo.

-- ---------- Políticas ----------
--
-- Mismo criterio que "ver/subir fotos del propio servicio" en
-- servicio_fotos (02_permisos.sql): cliente dueño, técnico asignado,
-- u operaciones. No hay política de UPDATE ni DELETE — una foto
-- subida queda, es parte del registro del servicio.

create policy "subir foto al propio servicio"
  on storage.objects for insert
  with check (
    bucket_id = 'fotos-servicios'
    and exists (
      select 1 from servicios s
      where s.id::text = (storage.foldername(name))[1]
        and (s.cliente_id = auth.uid() or s.tecnico_id = auth.uid())
    )
  );

create policy "ver foto del propio servicio"
  on storage.objects for select
  using (
    bucket_id = 'fotos-servicios'
    and (
      exists (
        select 1 from servicios s
        where s.id::text = (storage.foldername(name))[1]
          and (s.cliente_id = auth.uid() or s.tecnico_id = auth.uid())
      )
      or es_operaciones()
    )
  );

-- ============================================================
-- QUÉ FALTA
--
-- 1. Un job (o política de ciclo de vida del bucket) que borre fotos
--    de servicios muy viejos, si en algún momento importa por costo
--    de almacenamiento. Hoy no hace falta.
-- 2. Encriptar en reposo sigue pendiente para tecnico_documentos
--    (DNI, CBU) — no aplica a estas fotos, que son de menor
--    sensibilidad, pero queda anotado en 02_permisos.sql.
-- ============================================================
