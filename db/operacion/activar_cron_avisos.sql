-- Activación explícita, DESPUÉS de desplegar y verificar db/44 + consumidor.
-- Habilitar pg_cron, pg_net y Vault en Supabase Dashboard.
-- Guardar en Vault (UI, nunca Git) nora_app_url: URL HTTPS canónica de la app;
-- nora_cron_secret: mismo valor privado que CRON_SECRET del servidor.
-- Si el destino es un preview con Deployment Protection de Vercel, guardar
-- ademas en Vault 'nora_vercel_bypass' con el token de Protection Bypass for
-- Automation (Vercel > Project > Settings > Deployment Protection). Sin eso
-- Vercel responde 401 "Protected deployment" ANTES de llegar a la app, y el
-- 401 se confunde facilmente con el que devuelve la propia ruta sin secreto.
-- En produccion, sin proteccion, ese secreto no hace falta.
begin;
do $$
begin
 if not exists(select 1 from vault.decrypted_secrets where name='nora_app_url' and decrypted_secret ~ '^https://[^/]+/?$') then
  raise exception 'Falta nora_app_url HTTPS sin path en Vault';
 end if;
 if not exists(select 1 from vault.decrypted_secrets where name='nora_cron_secret' and length(decrypted_secret)>=32) then
  raise exception 'Falta nora_cron_secret de al menos 32 caracteres en Vault';
 end if;
end $$;
-- El nombre estable actualiza el job existente, sin crear consumidores duplicados.
select cron.schedule('nora-avisos-telegram', '* * * * *', $job$
 select net.http_post(
  url:=rtrim((select decrypted_secret from vault.decrypted_secrets where name='nora_app_url'),'/') || '/api/cron/avisos',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='nora_cron_secret'))
   || coalesce((select jsonb_build_object('x-vercel-protection-bypass', decrypted_secret)
                from vault.decrypted_secrets where name='nora_vercel_bypass'), '{}'::jsonb),
  body:='{}'::jsonb, timeout_milliseconds:=55000
 );
$job$);
commit;
-- Pausar sin borrar pedidos ni avisos:
-- select cron.unschedule('nora-avisos-telegram');
-- Ver estado del job (éxito SQL sólo confirma que se programó HTTP):
-- select jobid, status, start_time, return_message from cron.job_run_details order by start_time desc limit 10;
-- Ver HTTP (debe ser 200). Un 401 con cuerpo "Protected deployment" es de
-- Vercel, no de la app: falta el token de bypass. Un 401 sin ese cuerpo si es
-- de la ruta y significa que el secreto no coincide.
-- select id,status_code,timed_out,created from net._http_response order by created desc limit 10;
