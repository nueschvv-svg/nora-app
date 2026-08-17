-- ============================================================
-- NORA — Foto de perfil del técnico + nombre visible para el cliente
--
-- Hasta acá el cliente no veía absolutamente nada de quién era su
-- técnico: ni nombre, ni cara. Un pedido con técnico asignado se
-- sentía tan vacío de información como uno recién enviado — nada que
-- generara confianza, a diferencia de Rappi/Uber, donde ves la cara y
-- el nombre del repartidor/conductor apenas te lo asignan.
--
-- La fuente de esta foto es la MISMA selfie que ya se sube en la
-- verificación (14_documentos_tecnico_storage.sql) — no se le pide al
-- técnico una segunda foto. Pero el destino es otro: la selfie de
-- verificación queda en su bucket privado de siempre (sólo la ve
-- operaciones, nunca ningún cliente); acá se guarda una COPIA aparte,
-- en un bucket público, pensada específicamente para mostrarse. Nunca
-- se expone la foto del DNI — ésa tiene impreso el número de
-- documento, fecha de nacimiento y domicilio, y no corresponde
-- mostrarla a nadie fuera de operaciones.
--
-- Bucket público a propósito (a diferencia de fotos-servicios y
-- documentos-tecnicos, que son privados con URL firmada): una cara de
-- perfil, ya elegida por la propia persona para su selfie de
-- verificación, no es un dato sensible del mismo nivel que un DNI — y
-- evita tener que negociar una URL firmada cada vez que se quiere
-- mostrar. Sigue habiendo un límite de tamaño y de tipo de archivo, y
-- sólo el propio técnico puede subir o reemplazar la suya.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

alter table tecnicos add column if not exists foto_perfil_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-perfil-tecnico',
  'fotos-perfil-tecnico',
  true,
  3145728, -- 3 MB, alcanza de sobra para un avatar
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "el técnico sube su foto de perfil"
  on storage.objects for insert
  with check (
    bucket_id = 'fotos-perfil-tecnico'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "el técnico reemplaza o borra su foto de perfil"
  on storage.objects for update
  using (bucket_id = 'fotos-perfil-tecnico' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fotos-perfil-tecnico' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "el técnico borra su foto de perfil"
  on storage.objects for delete
  using (bucket_id = 'fotos-perfil-tecnico' and (storage.foldername(name))[1] = auth.uid()::text);

-- Lectura abierta dentro del bucket: es exactamente lo que "pública"
-- significa acá — cualquiera con el link ve el avatar, nadie ve nada
-- más (no hay forma de listar ni de llegar a otros buckets desde acá).
create policy "cualquiera ve las fotos de perfil de técnico"
  on storage.objects for select
  using (bucket_id = 'fotos-perfil-tecnico');

-- ---------- Nombre y foto del técnico asignado, para el cliente ----------
--
-- `perfiles` sólo se puede leer a uno mismo (o siendo operaciones) —
-- 02_permisos.sql, a propósito, para que un cliente no pueda navegar
-- el nombre de cualquier otra persona de la app. Mismo patrón ya usado
-- varias veces en este proyecto (tecnico_tiene_trabajo_activo_en,
-- suscripciones_para_notificar_en_camino): una función security
-- definer que sólo devuelve algo cuando quien llama es efectivamente
-- el CLIENTE de ESE pedido puntual, y sólo si ya tiene técnico
-- asignado.

create or replace function tecnico_de_mi_servicio(p_servicio_id uuid)
returns table (nombre text, foto_perfil_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.nombre, t.foto_perfil_path
  from servicios s
  join perfiles p on p.id = s.tecnico_id
  join tecnicos t on t.id = s.tecnico_id
  where s.id = p_servicio_id
    and s.cliente_id = auth.uid()
    and s.tecnico_id is not null;
$$;

comment on function tecnico_de_mi_servicio is
  'Sólo para el cliente dueño de ese pedido puntual, y sólo cuando ya tiene técnico asignado. Expone nombre y ruta de foto de perfil (bucket público) — nunca teléfono, DNI ni nada de tecnico_documentos.';
