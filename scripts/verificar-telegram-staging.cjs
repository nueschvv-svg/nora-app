// Ejecuta el consumidor real en staging; envía UN aviso QA al Telegram configurado.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {parseEnv}=require('node:util');
const {load}=require('../web/tests/load.cjs');
const dir=path.join(os.homedir(),'.config/nora-staging');
const api=JSON.parse(fs.readFileSync(path.join(dir,'api.json'),'utf8'));
assert.equal(api.url,'https://ccccntecmouklhdvbqjp.supabase.co');
const secret=JSON.parse(fs.readFileSync(path.join(dir,'server.json'),'utf8'));
const env=parseEnv(fs.readFileSync('/Users/valentinnuesch/Claude/Projects/Nora APP/web/.env.local','utf8'));
assert.ok(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID,'Falta Telegram');
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:api.url,SUPABASE_SERVICE_ROLE_KEY:secret.SUPABASE_SERVICE_ROLE_KEY,TELEGRAM_CHAT_ID:env.TELEGRAM_CHAT_ID,NORA_APP_URL:'https://nora-app-git-codex-auditoria-piloto-nueschvv-svgs-projects.vercel.app'});
const db=load('src/lib/supabase/admin.ts',{'server-only':{}}).supabaseAdmin();
const {procesarUnAviso}=load('src/lib/enrutamiento/cola.ts',{'server-only':{}});
async function check(result){if(result.error)throw Error(result.error.message);return result.data;}
(async()=>{
 const pending=await check(await db.from('servicio_avisos').select('servicio_id').in('estado',['pendiente','procesando']));
 assert.equal(pending.length,0,'No consumir avisos ajenos a esta prueba');
 const previous=await check(await db.from('servicios').select('cliente_id,propiedad_id,categoria_slug').eq('categoria_slug','qa-rls-staging').limit(1).single());
 const slots=await check(await db.rpc('agenda_disponibilidad',{p_dias:14}));
 const slot=slots.find(s=>s.estado==='AVAILABLE');assert.ok(slot);
 const created=await check(await db.from('servicios').insert({...previous,descripcion:'QA STAGING — PRUEBA TÉCNICA, NO REALIZAR TRABAJO. Se comprueba recuperación de avisos. El enlace de operaciones todavía NO apunta a esta base. No corresponde a una unidad real.',fecha_preferida:slot.fecha,franja_preferida:slot.franja}).select('id').single());
 const id=created.id;
 await check(await db.from('servicio_avisos').update({proximo_intento_el:new Date().toISOString()}).eq('servicio_id',id));
 delete process.env.TELEGRAM_BOT_TOKEN;
 assert.equal(await procesarUnAviso(),'pendiente');
 const failed=await check(await db.from('servicio_avisos').select('estado,intentos,proximo_intento_el').eq('servicio_id',id).single());
 assert.equal(failed.estado,'pendiente');assert.equal(failed.intentos,1);
 assert.ok(new Date(failed.proximo_intento_el)>new Date(),'Reintento diferido');
 process.env.TELEGRAM_BOT_TOKEN=env.TELEGRAM_BOT_TOKEN;
 await check(await db.from('servicio_avisos').update({proximo_intento_el:new Date().toISOString()}).eq('servicio_id',id));
 const result=await procesarUnAviso();assert.equal(result,'enviado');
 const sent=await check(await db.from('servicio_avisos').select('estado,intentos,detalle').eq('servicio_id',id).single());
 assert.equal(sent.estado,'enviado');assert.equal(sent.intentos,2);
 assert.equal(await procesarUnAviso(),'vacio');
 await check(await db.from('servicios').update({estado:'cancelado'}).eq('id',id));
 console.log(JSON.stringify({resultado:'PASS consumidor real: fallo persistido, reintento recuperado, Telegram confirmó, cola vacía, QA cancelado',pedido:id,aviso:sent}));
})().catch(()=>{console.error('Prueba no completada. Revisar estado QA antes de reejecutar; no se imprimen secretos.');process.exitCode=1});
