const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');const {PGlite}=require('@electric-sql/pglite');
const {load}=require('./load.cjs');
const csv=fs.readFileSync(path.resolve(__dirname,'../../docs/piloto/sector15/sector15_uf.csv'),'utf8').trim().split('\n').slice(1).map(l=>{const [uf,nucleo,piso,unidad]=l.split(',');return {uf:+uf,nucleo,piso:+piso,unidad}});
test('Sector15 preserves all CSV mappings and enforces canonical, immutable UF in database',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table propiedades(id uuid primary key default gen_random_uuid(),calle text,numero text,localidad text,provincia text,piso_depto text,latitud double precision,longitud double precision);
 create table servicios(id uuid primary key default gen_random_uuid(),propiedad_id uuid references propiedades(id));`);
 for(const file of ['45_edificio_piloto.sql','48_sector15_unidades.sql']) await db.exec(fs.readFileSync(path.resolve(__dirname,'../../db',file),'utf8'));
 assert.deepEqual((await db.query('select uf,nucleo,piso,unidad from sector15_unidades order by uf')).rows,csv);
 const b=(await db.query("select id from edificios where slug='sector-15'")).rows[0].id;
 await assert.rejects(db.query('insert into propiedades(edificio_id,piso,unidad) values($1,$2,$3)',[b,'1','Z']),/unidad/i);
 await assert.rejects(db.query('insert into propiedades(edificio_id,sector15_uf) values($1,9999)',[b]),/unidad/i);
 const p=(await db.query("insert into propiedades(edificio_id,sector15_uf,piso,unidad,calle) values($1,2222,'99','Z','Falsa') returning *",[b])).rows[0];
 assert.equal(p.piso,'1');assert.equal(p.unidad,'B');assert.equal(p.calle,'Predio Estación Buenos Aires');
 await assert.rejects(db.query('update propiedades set sector15_uf=2223 where id=$1',[p.id]),/modificar/i);
 await assert.rejects(db.query('update propiedades set sector15_uf=null where id=$1',[p.id]),/modificar/i);
 await db.exec('set role anon');assert.equal((await db.query('select count(*)::int n from sector15_unidades')).rows[0].n,175);
 await assert.rejects(db.exec('delete from sector15_unidades'),/permission denied/);
 }finally{await db.close();}
});
test('dependent lists use CSV rows including irregular first floor, never a formula',()=>{
 const {opcionesUnidad,seleccionarUnidad}=load('src/lib/sector15.ts');
 assert.deepEqual(opcionesUnidad(csv,'15-2',1).letras,['B','C','D','E']);
 assert.equal(seleccionarUnidad(csv,'15-2',1,'A'),null);
 for(const u of csv) assert.equal(seleccionarUnidad(csv,u.nucleo,u.piso,u.unidad).uf,u.uf);
 const {direccionConUnidad}=load('src/lib/edificio.ts');
 assert.equal(direccionConUnidad('Predio Estación Buenos Aires','Sector 15','1','B','15-1',2222),'Predio Estación Buenos Aires Sector 15 · Núcleo 15-1 · Piso 1 · Unidad B · UF 2222');
});
