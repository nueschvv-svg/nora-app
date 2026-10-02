const {test}=require('node:test'); const assert=require('node:assert/strict'); const {load}=require('./load.cjs');
function worker(db,send){return load('src/lib/enrutamiento/cola.ts',{'server-only':{},'@/lib/supabase/admin':{supabaseAdmin:()=>db},'./cargarPedido':{cargarPedido:async()=>({servicioId:'order'})},'./telegram':{estrategiaTelegram:{enrutar:send}}});}
test('worker persists failure for retry, without propagating secrets from transport exceptions',async()=>{
 const writes=[]; const db={rpc:async(name,args)=>{if(name==='tomar_aviso_telegram')return{data:[{servicio_id:'order',token:'lease'}]};writes.push(args);return{data:true};}};
 const result=await worker(db,async()=>{throw Error('https://api.telegram.org/botSECRET');}).procesarUnAviso();
 assert.equal(result,'pendiente');assert.equal(writes[0].p_ok,false);assert.ok(!writes[0].p_detalle.includes('SECRET'));
});
test('worker does not report sent if recording confirmation fails',async()=>{
 const db={rpc:async name=>name==='tomar_aviso_telegram'?{data:[{servicio_id:'order',token:'lease'}]}:{error:{message:'DB offline'}}};
 await assert.rejects(worker(db,async()=>({ok:true})).procesarUnAviso(),/registrar/);
});
test('empty queue does not contact Telegram',async()=>{
 const db={rpc:async()=>({data:[]})};
 assert.equal(await worker(db,async()=>assert.fail('must not send')).procesarUnAviso(),'vacio');
});
test('obsolete lease cannot report success',async()=>{
 const db={rpc:async name=>name==='tomar_aviso_telegram'?{data:[{servicio_id:'order',token:'lease'}]}:{data:false}};
 assert.equal(await worker(db,async()=>({ok:true})).procesarUnAviso(),'lease_perdido');
});
test('cron without secret or with wrong credential rejects before constructing privileged client',async()=>{
 const old=process.env.CRON_SECRET;
 try{
 const route=load('src/app/api/cron/avisos/route.ts',{'@/lib/enrutamiento/cola':{procesarUnAviso:()=>assert.fail('unauthorized')}});
 delete process.env.CRON_SECRET;
 assert.equal((await route.POST(new Request('https://test/api/cron/avisos',{method:'POST'}))).status,503);
 process.env.CRON_SECRET='fixture-secret';
 assert.equal((await route.POST(new Request('https://test/api/cron/avisos',{method:'POST',headers:{Authorization:'Bearer wrong'}}))).status,401);
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});
