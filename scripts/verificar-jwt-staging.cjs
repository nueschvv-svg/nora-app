// Exclusivo Nora EBA. Crea dos residentes y pedidos QA persistentes para auditoría.
// No envía Telegram. Credenciales/tokens nunca se imprimen.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const config=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/nora-staging/api.json'),'utf8'));
assert.equal(config.url,'https://ccccntecmouklhdvbqjp.supabase.co');
const sql=q=>execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',['service=nora_staging','-X','-w','-v','ON_ERROR_STOP=1','-At','-c',q],{env:{...process.env,PGSERVICEFILE:path.join(os.homedir(),'.config/nora-staging/service.conf')},encoding:'utf8'}).trim();
async function req(endpoint,token,method='GET',body){
 const r=await fetch(config.url+endpoint,{method,headers:{apikey:config.publishableKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const text=await r.text(); let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:r.status,ok:r.ok,data};
}
(async()=>{
 const sessions=[];
 for(let i=0;i<2;i++){
  const r=await req('/auth/v1/signup',null,'POST',{});
  if(!r.ok) throw Error('Auth '+r.status+': '+r.data.error_code);
  assert.ok(r.data.access_token); sessions.push({token:r.data.access_token,id:r.data.user.id});
 }
 const category='qa-rls-staging';
 sql(`insert into public.categorias(slug,nombre,icono,activa) values('${category}','QA aislamiento staging','droplet',false) on conflict(slug) do nothing;`);
 const avail=await req('/rest/v1/rpc/agenda_disponibilidad',sessions[0].token,'POST',{p_dias:14});
 assert.equal(avail.status,200);
 const slot=avail.data.find(x=>x.estado==='AVAILABLE'&&x.disponibles===2);
 assert.ok(slot,'Debe existir franja con dos lugares');
 for(const s of sessions){
  const profile=await req('/rest/v1/perfiles?id=eq.'+s.id,s.token);assert.equal(profile.status,200);assert.equal(profile.data.length,1,'Trigger crea perfil');
  const p=await req('/rest/v1/propiedades',s.token,'POST',{dueno_id:s.id,nombre:'QA JWT staging',calle:'QA sin dirección real',localidad:'CABA'});
  assert.equal(p.status,201,'Crear propiedad');s.property=p.data[0].id;
  const order=await req('/rest/v1/servicios',s.token,'POST',{cliente_id:s.id,propiedad_id:s.property,categoria_slug:category,descripcion:'QA JWT staging — no ejecutar trabajo',fecha_preferida:slot.fecha,franja_preferida:slot.franja});
  assert.equal(order.status,201,'Crear pedido');s.order=order.data[0].id;
 }
 for(const [self,other] of [[sessions[0],sessions[1]],[sessions[1],sessions[0]]]){
  for(const [table,id] of [['servicios',other.order],['propiedades',other.property],['perfiles',other.id]]){
   const read=await req('/rest/v1/'+table+'?id=eq.'+id,self.token);assert.equal(read.status,200);assert.deepEqual(read.data,[],'Lectura ajena '+table);
  }
  const write=await req('/rest/v1/servicios?id=eq.'+other.order,self.token,'PATCH',{descripcion:'QA intento ajeno'});assert.equal(write.status,200);assert.deepEqual(write.data,[]);
  const escalate=await req('/rest/v1/perfiles?id=eq.'+self.id,self.token,'PATCH',{rol:'operaciones'});assert.ok(!escalate.ok,'Escalada rechazada');
  const own=await req('/rest/v1/servicios?id=eq.'+self.order,self.token);assert.equal(own.data.length,1);assert.equal(own.data[0].descripcion,'QA JWT staging — no ejecutar trabajo');
 }
 // Archivo PNG mínimo sintético; queda privado como evidencia QA.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 for(const [self,other] of [[sessions[0],sessions[1]],[sessions[1],sessions[0]]]){
  const name=self.order+'/qa-privacidad.png';
  const upload=await fetch(config.url+'/storage/v1/object/fotos-servicios/'+name,{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+self.token,'Content-Type':'image/png'},body:png});
  assert.ok(upload.ok,'Subida propia de foto');
  const ownSign=await req('/storage/v1/object/sign/fotos-servicios/'+name,self.token,'POST',{expiresIn:60});
  assert.ok(ownSign.ok,'Firma propia de foto');
  const foreignSign=await req('/storage/v1/object/sign/fotos-servicios/'+name,other.token,'POST',{expiresIn:60});
  assert.ok(!foreignSign.ok,'Firma ajena denegada');
  const foreignUpload=await fetch(config.url+'/storage/v1/object/fotos-servicios/'+self.order+'/qa-ajena.png',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+other.token,'Content-Type':'image/png'},body:png});
  assert.ok(!foreignUpload.ok,'Subida ajena denegada');
  const publicRead=await fetch(config.url+'/storage/v1/object/public/fotos-servicios/'+name);
  assert.ok(!publicRead.ok,'Bucket privado');
 }
 const third=await req('/rest/v1/servicios',sessions[0].token,'POST',{cliente_id:sessions[0].id,propiedad_id:sessions[0].property,categoria_slug:category,descripcion:'QA tercero',fecha_preferida:slot.fecha,franja_preferida:slot.franja});
 assert.ok(!third.ok);assert.match(third.data.message,/AGENDA_COMPLETO/);
 for(const s of sessions){
  const cancel=await req('/rest/v1/servicios?id=eq.'+s.order,s.token,'PATCH',{estado:'cancelado'});assert.ok(cancel.ok,'Cancelación propia');
 }
 // Cola QA retenida para que un futuro consumidor no mande trabajos de prueba.
 sql(`update public.servicio_avisos set estado='fallido',detalle='QA JWT finalizado; no enviar',intentos=8 where servicio_id in ('${sessions[0].order}','${sessions[1].order}');`);
 console.log('PASS JWT Supabase: dos sesiones anónimas, perfiles automáticos, pedidos propios, aislamiento bilateral, escalada rechazada, capacidad 2, cancelación y Storage privado bilateral.');
 console.log('Pedidos QA cancelados:',sessions.map(s=>s.order).join(', '));
})().catch(e=>{console.error(e.message);process.exitCode=1});
