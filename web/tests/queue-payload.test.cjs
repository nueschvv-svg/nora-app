const {test}=require('node:test');const assert=require('node:assert/strict');const {load}=require('./load.cjs');
const ID='10000000-0000-4000-8000-000000000001';
function database(path,failProfile=false){
 const rows={servicios:{id:ID,propiedad_id:'property',cliente_id:'resident',categoria_slug:'plomeria',descripcion:'[RIESGO INMEDIATO]\nPrueba',fecha_preferida:'2026-09-22',franja_preferida:'manana'},propiedades:{calle:'Calle QA',numero:'123',piso:'PB',unidad:'A',localidad:'CABA',provincia:'CABA',notas_acceso:null},perfiles:{nombre:'QA',telefono:'1155551234'},categorias:{nombre:'Plomería'},servicio_fotos:[{archivo_path:path}]};
 const signed=[];
 const db={from(table){return{select(){return this},eq(){return this},order(){return this},limit:async()=>({data:rows[table]}),single:async()=>({data:rows[table],error:failProfile&&table==='perfiles'?{message:'not available'}:null})}},storage:{from:()=>({createSignedUrl:async p=>{signed.push(p);return{data:{signedUrl:'https://signed.invalid/photo'}};}})}};
 return{db,signed};
}
test('privileged payload loader never signs another order image or traversal path',async()=>{
 const {cargarPedido}=load('src/lib/enrutamiento/cargarPedido.ts',{'server-only':{}});
 for(const path of ['other-order/photo.jpg',`${ID}/../other/photo.jpg`,`${ID}/%2e%2e%2fsecret.jpg`,`${ID}\\other.jpg`]){
  const {db,signed}=database(path);const pedido=await cargarPedido(db,ID);
  assert.equal(signed.length,0);assert.equal(pedido.fotoUrl,null);
 }
});
test('persisted payload retains unit, contact, emergency and a valid own signed image',async()=>{
 const {cargarPedido}=load('src/lib/enrutamiento/cargarPedido.ts',{'server-only':{}});
 const {db,signed}=database(`${ID}/00000000-0000-4000-8000-000000000009.jpg`);
 const pedido=await cargarPedido(db,ID);
 assert.equal(signed.length,1);assert.equal(pedido.fotoUrl,'https://signed.invalid/photo');
 assert.equal(pedido.propiedad.direccion,'Calle QA 123 · Piso PB · Unidad A');
 assert.equal(pedido.cliente.telefono,'1155551234');assert.equal(pedido.diagnostico.riesgoInmediato,true);
});
test('missing required profile data causes retry rather than an incomplete notification',async()=>{
 const {cargarPedido}=load('src/lib/enrutamiento/cargarPedido.ts',{'server-only':{}});
 await assert.rejects(cargarPedido(database('image',true).db,ID),/datos/);
});
