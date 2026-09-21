const {test}=require('node:test');const assert=require('node:assert/strict');const {NextRequest}=require('next/server');const {load}=require('./load.cjs');
const ID='10000000-0000-4000-8000-000000000001';
test('cron reaches its own authentication without creating or requiring a resident session',async()=>{
 const {actualizarSesion}=load('src/lib/supabase/middleware.ts',{'./config':{HAY_SUPABASE:true},'@supabase/ssr':{createServerClient:()=>assert.fail('cron must not use resident auth')}});
 const response=await actualizarSesion(new NextRequest('https://example.test/api/cron/avisos',{method:'POST'}));
 assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);
});
function route(user,service,queue){
 const db={auth:{getUser:async()=>({data:{user}})},from(table){const filters={};return{select(){return this},eq(k,v){filters[k]=v;return this},maybeSingle:async()=>table==='servicios'?{data:service&&filters.cliente_id===user.id?service:null}:{data:queue}};}};
 return load('src/app/api/pedidos/[id]/enrutar/route.ts',{'@/lib/supabase/servidor':{supabaseServidor:async()=>db}}).POST;
}
test('queue status rejects absent session and hides other resident orders',async()=>{
 const req=new Request('https://test',{method:'POST'}), params={params:Promise.resolve({id:ID})};
 assert.equal((await route(null,null,null)(req,params)).status,401);
 assert.equal((await route({id:'A'},null,null)(req,params)).status,404);
});
test('queue acknowledgment distinguishes queued from absent or exhausted delivery',async()=>{
 const req=new Request('https://test',{method:'POST'}),params={params:Promise.resolve({id:ID})};
 const queued=await route({id:'A'},{id:ID},{estado:'pendiente'})(req,params);
 assert.deepEqual(await queued.json(),{ok:true,estado:'pendiente'});
 assert.equal((await route({id:'A'},{id:ID},null)(req,params)).status,503);
 assert.equal((await route({id:'A'},{id:ID},{estado:'fallido'})(req,params)).status,503);
});
test('operations loads every pending page even when newer delivered orders fill the default query limit',async()=>{
 const pendientes=Array.from({length:101},(_,i)=>({servicio_id:`pending-${i}`,estado:'fallido',intentos:8,creado_el:'2026-01-01',detalle:null,proximo_intento_el:null}));
 const db={
  from:()=>({select(){return this},order:async()=>({data:Array.from({length:1000},(_,i)=>({id:`sent-${i}`,servicio_avisos:{estado:'enviado'},servicio_enrutamientos:[]}))})}),
  rpc:()=>({range:async(a,b)=>({data:pendientes.slice(a,b+1)})})
 };
 const {listarAvisosPendientes}=load('src/lib/avisosOperaciones.ts',{'./supabase/cliente':{supabaseNavegador:()=>db}});
 const result=await listarAvisosPendientes();
 assert.equal(result.length,101);assert.equal(result[100].servicio_id,'pending-100');
});
