// Una entrega QA real a Telegram; crea dos sesiones anónimas y conserva evidencia.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {parseEnv}=require('node:util');const {createClient}=require('../web/node_modules/@supabase/supabase-js');
const {load}=require('../web/tests/load.cjs');
const env=parseEnv(fs.readFileSync(path.resolve(__dirname,'../web/.env.local'),'utf8'));
Object.assign(process.env,env);
const api=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/nora-staging/api.json'),'utf8'));
assert.equal(api.url,'https://ccccntecmouklhdvbqjp.supabase.co');assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,api.url);
const admin=load('src/lib/supabase/admin.ts',{'server-only':{}}).supabaseAdmin();
const {cargarPedido}=load('src/lib/enrutamiento/cargarPedido.ts',{'server-only':{}});
const {procesarUnAviso}=load('src/lib/enrutamiento/cola.ts',{'server-only':{}});
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
(async()=>{
 assert.equal(ok(await admin.from('servicio_avisos').select('servicio_id').in('estado',['pendiente','procesando'])).length,0,'No consumir cola ajena');
 const sessions=[];
 for(let i=0;i<2;i++){
  const db=createClient(api.url,api.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=ok(await db.auth.signInAnonymously());sessions.push({db,id:auth.user.id});
 }
 const a=sessions[0],b=sessions[1];
 const building=ok(await a.db.from('edificios').select('id').eq('slug','sector-15').single());
 const units=ok(await a.db.from('sector15_unidades').select('uf,nucleo,piso,unidad').order('uf'));assert.equal(units.length,175);
 assert.deepEqual(units.find(x=>x.uf===2222),{uf:2222,nucleo:'15-1',piso:1,unidad:'B'});
 const bad=await a.db.from('propiedades').insert({dueno_id:a.id,nombre:'QA',calle:'NO',localidad:'NO',edificio_id:building.id,sector15_uf:9999});assert.ok(bad.error);
 ok(await a.db.from('perfiles').update({nombre:'QA SECTOR15 — NO REALIZAR TRABAJO',telefono:'1100000000'}).eq('id',a.id));
 const prop=ok(await a.db.from('propiedades').insert({dueno_id:a.id,nombre:'QA Sector 15',calle:'FALSA',numero:'999',localidad:'FALSA',edificio_id:building.id,sector15_uf:2222,piso:'99',unidad:'Z'}).select('id,calle,piso,unidad,sector15_uf,sector15_unidades(nucleo)').single());
 assert.equal(prop.calle,'Predio Estación Buenos Aires');assert.equal(prop.piso,'1');assert.equal(prop.unidad,'B');assert.equal(prop.sector15_unidades.nucleo,'15-1');
 assert.deepEqual(ok(await b.db.from('propiedades').select('id').eq('id',prop.id)),[]);
 const changed=await a.db.from('propiedades').update({sector15_uf:2223}).eq('id',prop.id);assert.ok(changed.error);
 const slot=ok(await a.db.rpc('agenda_disponibilidad',{p_dias:14})).find(x=>x.estado==='AVAILABLE');assert.ok(slot);
 const order=ok(await a.db.from('servicios').insert({cliente_id:a.id,propiedad_id:prop.id,categoria_slug:'qa-rls-staging',descripcion:'QA SECTOR 15 — NO REALIZAR TRABAJO. Prueba de ubicación con mancha en techo del baño. UF usada sólo para verificar el catálogo; no es un reclamo real.',fecha_preferida:slot.fecha,franja_preferida:slot.franja}).select('id').single());
 // Retener hasta terminar validaciones.
 ok(await admin.from('servicio_avisos').update({proximo_intento_el:new Date(Date.now()+3600000).toISOString()}).eq('servicio_id',order.id));
 assert.deepEqual(ok(await b.db.from('servicios').select('id').eq('id',order.id)),[]);
 assert.deepEqual(ok(await b.db.from('servicios').update({descripcion:'ajena'}).eq('id',order.id).select('id')),[]);
 const payload=await cargarPedido(admin,order.id);assert.match(payload.propiedad.direccion,/Sector 15 · Núcleo 15-1 · Piso 1 · Unidad B · UF 2222/);
 assert.match(payload.descripcion,/mancha en techo del baño/);assert.equal(payload.cliente.telefono,'1100000000');
 const fetchReal=global.fetch;let validated=false;
 global.fetch=async(input,options)=>{
  if(String(input).startsWith('https://api.telegram.org/')){
   const body=JSON.parse(options.body);assert.match(body.text??body.caption,/UF 2222/);assert.match(body.text??body.caption,/NO REALIZAR TRABAJO/);validated=true;
  }
  return fetchReal(input,options);
 };
 ok(await admin.from('servicio_avisos').update({proximo_intento_el:new Date().toISOString()}).eq('servicio_id',order.id));
 assert.equal(await procesarUnAviso(),'enviado');assert.ok(validated);
 global.fetch=fetchReal;
 ok(await a.db.from('servicios').update({estado:'cancelado'}).eq('id',order.id));
 console.log(JSON.stringify({resultado:'PASS: catálogo 175, FK, dirección canónica, unidad inmutable, aislamiento JWT, mensaje completo confirmado por Telegram; pedido QA cancelado',pedido:order.id,uf:2222}));
})().catch(e=>{console.error('QA Sector15 no completado:',e.message);process.exitCode=1});
