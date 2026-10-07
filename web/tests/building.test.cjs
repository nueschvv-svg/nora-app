const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { load } = require('./load.cjs');
test('pilot validates unit, active building, canonical address and immutable snapshot; generic homes still work', async () => {
 const db = new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated;
 create table propiedades(id uuid primary key default gen_random_uuid(), calle text, numero text, localidad text, provincia text, piso_depto text, latitud double precision, longitud double precision);
 create table servicios(id uuid primary key default gen_random_uuid(), propiedad_id uuid references propiedades(id));`);
 const file = path.resolve(__dirname,'../../db/45_edificio_piloto.sql');
 if(fs.existsSync(file)) await db.exec(fs.readFileSync(file,'utf8'));
 assert.ok((await db.query("select column_name from information_schema.columns where table_name='propiedades'")).rows.some(r=>r.column_name==='edificio_id'),'pilot context must persist');
 await db.exec(`insert into edificios(id,slug,nombre,calle,numero,localidad,provincia,activo) values ('10000000-0000-4000-8000-000000000001','prueba','Prueba','Real','123','CABA','CABA',true), ('10000000-0000-4000-8000-000000000002','inactivo','Inactivo','Real','456','CABA','CABA',false); set role anon;`);
 assert.deepEqual((await db.query('select slug from edificios')).rows,[{slug:'prueba'}]);
 await assert.rejects(db.exec('update edificios set activo=false'),/permission denied/);
 await db.exec('reset role');
 await assert.rejects(db.exec(`insert into propiedades(edificio_id,piso,unidad) values ('10000000-0000-4000-8000-000000000001',' ','A')`),/piso.*unidad/i);
 await assert.rejects(db.exec(`insert into propiedades(edificio_id,piso,unidad) values ('10000000-0000-4000-8000-000000000002','2','A')`),/habilitado/i);
 await db.exec(`insert into propiedades(id,edificio_id,piso,unidad,calle,numero,localidad,provincia,latitud) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',' PB ',' A ','Falsa','999','Falsa','Falsa',-1)`);
 assert.deepEqual((await db.query('select calle,numero,localidad,provincia,piso,unidad,piso_depto,latitud from propiedades')).rows[0],{calle:'Real',numero:'123',localidad:'CABA',provincia:'CABA',piso:'PB',unidad:'A',piso_depto:'Piso PB · Unidad A',latitud:null});
 await assert.rejects(db.exec('update propiedades set edificio_id=null'),/modificar/i);
 await db.exec("insert into servicios(propiedad_id) values ('20000000-0000-4000-8000-000000000001'); update edificios set activo=false;");
 await assert.rejects(db.exec("insert into servicios(propiedad_id) values ('20000000-0000-4000-8000-000000000001')"),/habilitado/i);
 await db.exec("insert into propiedades(calle) values ('Casa general')");
 } finally {await db.close();}
});
test('pilot ignores another saved home and displays floor and unit',()=>{
 const {propiedadDelContexto,direccionConUnidad}=load('src/lib/edificio.ts');
 const home={id:'home'};
 assert.equal(propiedadDelContexto('piloto',{id:'b'},home),null);
 assert.equal(propiedadDelContexto('',null,home),null);
 assert.equal(propiedadDelContexto(null,null,home),home);
 const unit={id:'unit',edificioId:'b',piso:'2',unidad:'C'};
 assert.equal(propiedadDelContexto('piloto',{id:'b'},unit),unit);
 assert.equal(direccionConUnidad('Real','123','2','C'),'Real 123 · Piso 2 · Unidad C');
});
test('saved pilot property includes floor and unit in customer-facing address', async () => {
 const client={auth:{getUser:async()=>({data:{user:{id:'resident'}}})},from(){const q={select(){return q},eq(){return q},order:async()=>({data:[{id:'home',nombre:'Edificio',calle:'Real',numero:'123',localidad:'CABA',provincia:'CABA',icono:'building-2',edificio_id:'b',piso:'PB',unidad:'A'}],error:null})};return q}};
 const {listarPropiedades}=load('src/lib/datos.ts',{'./supabase/cliente':{supabaseNavegador:()=>client}});
 const [home]=await listarPropiedades();
 assert.equal(home.direccion,'Real 123 · Piso PB · Unidad A');
 assert.equal(home.edificioId,'b');
});
test('emergency and estimate survive even without diagnostic observations',()=>{
 const {descripcionDelPedido}=load('src/lib/descripcionPedido.ts');
 assert.equal(descripcionDelPedido('Pierde gas',true,null,'Visita a confirmar'),'[RIESGO INMEDIATO]\n\nPierde gas\n\nVisita a confirmar');
 assert.equal(descripcionDelPedido('Canilla rota',false,null,null),'Canilla rota');
});
test('pilot property creation requires unit before storage or geocoding', async()=>{
 const client={auth:{getUser:async()=>({data:{user:{id:'resident'}}})},from(){throw new Error('must not reach storage')}};
 const {crearPropiedad}=load('src/lib/datos.ts',{'./supabase/cliente':{supabaseNavegador:()=>client}});
 await assert.rejects(crearPropiedad({nombre:'Edificio',calle:'Real',numero:'123',localidad:'CABA',provincia:'CABA',icono:'building-2',edificioId:'b',piso:'PB',unidad:' '}),/piso y unidad/);
});
