-- Sólo proyecto NUEVO de staging, después del restore public y 44–47.
-- No ejecutar en producción ni sustituir inventario del esquema origen.
-- Complementa objetos fuera de public que pg_dump --schema=public no incluye.
-- Requiere Auth anonymous habilitado separadamente en el dashboard.
begin;
do $$ begin
 if exists(select 1 from auth.users) or exists(select 1 from storage.buckets)
 or exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal)
 or exists(select 1 from pg_policies where schemaname='storage' and tablename='objects') then
  raise exception 'STAGING_NO_VACIO: revisar inventario; no se modificó nada';
 end if;
end $$;
create trigger nora_crear_perfil after insert on auth.users
for each row execute function public.crear_perfil_al_registrarse();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('fotos-servicios','fotos-servicios',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy "subir foto al propio servicio" on storage.objects for insert to authenticated
with check(bucket_id='fotos-servicios' and exists(
 select 1 from public.servicios s where s.id::text=(storage.foldername(name))[1] and s.cliente_id=auth.uid()
));
create policy "ver foto del propio servicio" on storage.objects for select to authenticated
using(bucket_id='fotos-servicios' and (public.es_operaciones() or exists(
 select 1 from public.servicios s where s.id::text=(storage.foldername(name))[1] and s.cliente_id=auth.uid()
)));
commit;
