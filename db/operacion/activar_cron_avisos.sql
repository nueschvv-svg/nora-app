-- Activación explícita, DESPUÉS de desplegar y verificar db/44 + consumidor.
-- Habilitar pg_cron, pg_net y Vault en Supabase Dashboard.
-- Guardar en Vault (UI, nunca Git) nora_app_url: URL HTTPS canónica de la app;
-- nora_cron_secret: mismo valor privado que CRON_SECRET del servidor.
-- No usar la URL de un preview protegido con login.
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
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='nora_cron_secret')),
  body:='{}'::jsonb, timeout_milliseconds:=55000
 );
$job$);
commit;
-- Pausar sin borrar pedidos ni avisos:
-- select cron.unschedule('nora-avisos-telegram');
-- Ver estado del job (éxito SQL sólo confirma que se programó HTTP):
-- select jobid, status, start_time, return_message from cron.job_run_details order by start_time desc limit 10;
-- Ver HTTP (debe ser 200, no 401/503 ni redirect al login):
-- select id,status_code,timed_out,created from net._http_response order by created desc limit 10;
