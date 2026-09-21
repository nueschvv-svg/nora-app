const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const read = (name) => fs.readFileSync(path.join(__dirname, '../../db', name), 'utf8');
const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002', OPS = '00000000-0000-4000-8000-000000000003';
const PA = '10000000-0000-4000-8000-000000000001', PB = '10000000-0000-4000-8000-000000000002', ORDER = '20000000-0000-4000-8000-000000000001';
function fn(sql, name) {
 const match = sql.match(new RegExp(`create or replace function ${name}\\(\\)[\\s\\S]*?\\$\\$;`, 'i'));
 assert.ok(match, `missing production function ${name}`); return match[0];
}
function policy(sql, name) {
 const match = sql.match(new RegExp(`create policy "${name}"[\\s\\S]*?;`, 'i'));
 assert.ok(match, `missing production policy ${name}`); return match[0];
}
// Executes production RLS/functions and db46 on a minimal post-db43 schema.
// Does not emulate Supabase JWT verification, anonymous account creation,
// REST/Storage, every historical migration, or deployed policy drift.
async function database() {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; grant usage on schema auth,public to anon,authenticated,service_role;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table perfiles(id uuid primary key, rol text not null default 'cliente', nombre text);
 create table propiedades(id uuid primary key, dueno_id uuid references perfiles);
 create table equipos(id uuid primary key, propiedad_id uuid references propiedades);
 create table servicios(id uuid primary key default gen_random_uuid(), cliente_id uuid not null references perfiles,
 propiedad_id uuid not null references propiedades, categoria_slug text not null default 'plomeria', equipo_id uuid references equipos,
 descripcion text not null default 'Una perdida de agua', estado text not null default 'solicitado', fecha_preferida date, franja_preferida text,
 monto_ars numeric, pago_referencia text, reporte text, garantia_hasta date, creado_el timestamptz not null default now(),
 actualizado_el timestamptz not null default now(), metodo_pago text, pago_confirmado_el timestamptz,
 estimado_desde_ars numeric, estimado_hasta_ars numeric, numero_orden serial);
 alter table perfiles enable row level security; alter table propiedades enable row level security;
 alter table equipos enable row level security; alter table servicios enable row level security;
 grant select,insert,update,delete on all tables in schema public to authenticated,anon,service_role;
 grant usage on all sequences in schema public to authenticated,anon,service_role;
 insert into perfiles(id,rol) values('${A}','cliente'),('${B}','cliente'),('${OPS}','operaciones');
 insert into propiedades values('${PA}','${A}'),('${PB}','${B}'); insert into equipos values('${PB}','${PB}');
 insert into servicios(id,cliente_id,propiedad_id,estado,monto_ars) values('${ORDER}','${A}','${PA}','presupuestado',50000);`);
 const base = read('02_permisos.sql'), pivot = read('39_eliminar_rol_tecnico.sql');
 for(const name of ['es_operaciones','bloquear_cambio_de_rol']) await db.exec(fn(base,name));
 for(const name of ['cada uno ve su perfil','cada uno edita su perfil','el dueño ve sus propiedades','el dueño ve sus equipos','el cliente ve sus servicios']) await db.exec(policy(base,name));
 for(const name of ['solo_permitir_cancelar','tocar_servicio']) await db.exec(fn(pivot,name));
 for(const name of ['el cliente crea su pedido','el cliente cancela su pedido si todavía no arrancó','el cliente responde al presupuesto','el cliente confirma el pago cuando el trabajo terminó']) await db.exec(policy(pivot,name));
 await db.exec(policy(read('10_panel_operaciones.sql'),'operaciones actualiza servicios'));
 await db.exec(`create trigger trg_solo_cancelar before update on servicios for each row execute function solo_permitir_cancelar();
 create trigger trg_tocar_servicio before update on servicios for each row execute function tocar_servicio();
 create trigger trg_bloquear_rol before update on perfiles for each row execute function bloquear_cambio_de_rol();`);
 if(process.env.PERMISSIONS_BASELINE !== '1') await db.exec(read('46_permisos_piloto.sql'));
 await as(db,A); return db;
}
async function as(db,id,role='authenticated') {
 await db.exec(`reset role; set role ${role};`); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id || '']);
}
async function resetOrder(db,estado='presupuestado') {
 await as(db,OPS); await db.query(`update servicios set estado=$1,monto_ars=50000,metodo_pago=null,pago_confirmado_el=null where id=$2`,[estado,ORDER]); await as(db,A);
}
const update = (db, changes) => db.query(`update servicios set ${changes} where id=$1 returning *`,[ORDER]);
test('resident cannot alter immutable fields while accepting, rejecting, cancelling or paying',async()=>{
 const db=await database(); try {
 for(const [state,transition] of [['presupuestado',"estado='aceptado'"],['presupuestado',"estado='solicitado',monto_ars=null"],['solicitado',"estado='cancelado'"],['finalizado',"estado='pagado',metodo_pago='efectivo',pago_confirmado_el=now()"]]) {
  await resetOrder(db,state);
  for(const mutation of [`propiedad_id='${PB}'`,`cliente_id='${B}'`,"descripcion='Otra descripcion'","categoria_slug='electricidad'","garantia_hasta='2099-01-01'","creado_el='2000-01-01'","estimado_desde_ars=1","numero_orden=999",`equipo_id='${PB}'`,"pago_referencia='falso'","reporte='falso'"]) {
   await assert.rejects(update(db,`${transition},${mutation}`),undefined,`${state}: ${mutation}`);
  }
 }
 await resetOrder(db); await assert.rejects(update(db,"estado='aceptado',monto_ars=1"));
 } finally {await db.close();}
});
test('valid quote acceptance, rejection, all early cancellations and cash payment work',async()=>{
 const db=await database(); try {
 let result=await update(db,"estado='aceptado'"); assert.equal(result.rows[0].monto_ars,'50000');
 await resetOrder(db); result=await update(db,"estado='solicitado',monto_ars=null"); assert.equal(result.rows[0].monto_ars,null);
 for(const state of ['solicitado','presupuestado','aceptado']) {await resetOrder(db,state); assert.equal((await update(db,"estado='cancelado'")).rows[0].estado,'cancelado');}
 await resetOrder(db,'finalizado'); result=await update(db,"estado='pagado',metodo_pago='efectivo',pago_confirmado_el=now()"); assert.equal(result.rows[0].estado,'pagado');
 await resetOrder(db,'finalizado'); await assert.rejects(update(db,"estado='pagado',metodo_pago='mercado_pago',pago_confirmado_el=now()"));
 await resetOrder(db,'solicitado'); await assert.rejects(update(db,"estado='aceptado'"));
 }finally {await db.close();}
});
test('anonymous identities isolate orders and cannot promote their own profile',async()=>{
 const db=await database(); try {
 await as(db,B); assert.equal((await db.query('select * from servicios')).rows.length,0); assert.equal((await update(db,"estado='cancelado'")).rows.length,0);
 assert.equal((await db.query('select * from propiedades')).rows.length,1);
 await assert.rejects(db.query("update perfiles set rol='operaciones' where id=$1",[B]),/rol/);
 await as(db,null,'anon'); assert.equal((await db.query('select * from servicios')).rows.length,0); assert.equal((await update(db,"estado='cancelado'")).rows.length,0);
 await as(db,OPS); assert.equal((await update(db,"estado='en_camino',monto_ars=60000")).rows[0].estado,'en_camino');
 }finally {await db.close();}
});
test('insert only allows an own-property unpaid request without fabricated operational fields',async()=>{
 const db=await database(); try {
 for(const [column,value] of [['propiedad_id',`'${PB}'`],['cliente_id',`'${B}'`],['monto_ars','0'],['estado',"'pagado'"],['metodo_pago',"'efectivo'"],['pago_confirmado_el','now()'],['reporte',"'ya terminado'"],['garantia_hasta',"'2099-01-01'"],['equipo_id',`'${PB}'`]]) {
  const fields={cliente_id:`'${A}'`,propiedad_id:`'${PA}'`,[column]:value};
  await assert.rejects(db.query(`insert into servicios(${Object.keys(fields)}) values(${Object.values(fields)})`),undefined,column);
 }
 const result=await db.query('insert into servicios(cliente_id,propiedad_id) values($1,$2) returning estado',[A,PA]); assert.equal(result.rows[0].estado,'solicitado');
 }finally {await db.close();}
});
test('restrictive ownership survives an accidentally broad permissive policy and migration is repeatable',async()=>{
 const db=await database(); try {
 await db.exec('reset role');
 await db.exec(read('46_permisos_piloto.sql'));
 // Deliberate policy drift: the new AND guard must still isolate rows.
 await db.exec('create policy legacy_too_broad on servicios for all using(true) with check(true)');
 await as(db,B); assert.equal((await db.query('select * from servicios')).rows.length,0);
 assert.equal((await update(db,"estado='cancelado'")).rows.length,0);
 await as(db,null,'anon'); assert.equal((await db.query('select * from servicios')).rows.length,0);
 await assert.rejects(db.query('insert into servicios(cliente_id,propiedad_id) values($1,$2)',[A,PA]));
 await as(db,A);
 await assert.rejects(db.query("insert into servicios(cliente_id,propiedad_id,metodo_pago) values($1,$2,'efectivo')",[A,PA]));
 await as(db,null,'service_role'); assert.equal((await update(db,"estado='en_curso'")).rows[0].estado,'en_curso');
 }finally {await db.close();}
});
