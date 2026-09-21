const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const ORDER = '10000000-0000-4000-8000-000000000001';
const migration = () => fs.readFileSync('../db/44_cola_telegram.sql', 'utf8');
async function database() {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; grant usage on schema auth, public to authenticated, service_role;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 create function public.es_operaciones() returns boolean language sql as $$ select coalesce(current_setting('test.operaciones',true),'false') = 'true' $$;
 create table servicios(id uuid primary key, cliente_id uuid not null, creado_el timestamptz not null default now());
 create type estado_enrutamiento as enum ('enviado','fallido');
 create table servicio_enrutamientos(id uuid default gen_random_uuid(), servicio_id uuid references servicios, estrategia text, estado estado_enrutamiento, detalle text, intentos int);
 alter table servicios enable row level security;
 create policy lectura on servicios for select using(cliente_id=auth.uid() or es_operaciones());
 grant select on servicios,servicio_enrutamientos to authenticated; grant all on servicios,servicio_enrutamientos to service_role;
 `);
 return db;
}
test('order and notification are atomic, isolated, leased and retryable in PostgreSQL', async () => {
 const db = await database();
 try {
  await db.exec(migration());
  await db.exec(`insert into servicios(id,cliente_id) values ('${ORDER}','${A}')`);
  assert.equal((await db.query('select estado from servicio_avisos')).rows[0].estado,'pendiente');
  await db.exec(`begin; insert into servicios(id,cliente_id) values ('10000000-0000-4000-8000-000000000009','${A}'); rollback;`);
  assert.equal((await db.query('select count(*)::int n from servicio_avisos')).rows[0].n,1);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${B}';`);
  assert.equal((await db.query('select * from servicio_avisos')).rows.length,0);
  await assert.rejects(db.query('select * from tomar_aviso_telegram()'), /permission denied/);
  await assert.rejects(db.query(`insert into servicio_avisos(servicio_id) values('${ORDER}')`), /permission denied/);
  await assert.rejects(db.query(`select reintentar_aviso_telegram('${ORDER}')`), /operaciones/);
  await db.exec(`set request.jwt.claim.sub='${A}';`);
  assert.equal((await db.query('select * from servicio_avisos')).rows.length,1);
  await db.exec('reset role; update servicio_avisos set proximo_intento_el=now(); set role service_role;');
  const first=(await db.query('select * from tomar_aviso_telegram()')).rows[0];
  assert.equal(first.servicio_id,ORDER);
  assert.equal(first.intentos,1);
  assert.equal((await db.query('select * from tomar_aviso_telegram()')).rows.length,0);
  await db.exec('reset role; update servicio_avisos set lease_hasta=now()-interval \'1 second\'; set role service_role;');
  const second=(await db.query('select * from tomar_aviso_telegram()')).rows[0];
  assert.notEqual(second.token,first.token);
  assert.equal((await db.query('select finalizar_aviso_telegram($1,$2,true,$3) ok',[ORDER,first.token,'viejo'])).rows[0].ok,false);
  assert.equal((await db.query('select finalizar_aviso_telegram($1,$2,false,$3) ok',[ORDER,second.token,'Red no disponible'])).rows[0].ok,true);
  const pending=(await db.query('select *, proximo_intento_el>now() demora from servicio_avisos')).rows[0];
  assert.equal(pending.estado,'pendiente'); assert.equal(pending.demora,true);
  assert.equal((await db.query('select * from tomar_aviso_telegram()')).rows.length,0);
  await db.exec('reset role; update servicio_avisos set proximo_intento_el=now(); set role service_role;');
  const third=(await db.query('select * from tomar_aviso_telegram()')).rows[0];
  await db.query('select finalizar_aviso_telegram($1,$2,true,$3)',[ORDER,third.token,'Entregado']);
  assert.equal((await db.query('select estado from servicio_avisos')).rows[0].estado,'enviado');
  assert.equal((await db.query('select count(*)::int n from servicio_enrutamientos')).rows[0].n,2);
  assert.equal((await db.query('select * from tomar_aviso_telegram()')).rows.length,0);
  await db.exec("reset role; set role authenticated; set test.operaciones='true';");
  assert.equal((await db.query('select reintentar_aviso_telegram($1) ok',[ORDER])).rows[0].ok,false);
 } finally { await db.close(); }
});
test('exhausted crashed delivery remains visible and operations can recover without a new order', async()=>{
 const db=await database();
 try {
  await db.exec(migration());
  await db.exec(`insert into servicios(id,cliente_id) values('${ORDER}','${A}'); update servicio_avisos set estado='procesando',intentos=8,token=gen_random_uuid(),lease_hasta=now()-interval '1 minute'; set role service_role;`);
  assert.equal((await db.query('select * from tomar_aviso_telegram()')).rows.length,0);
  assert.equal((await db.query('select estado from servicio_avisos')).rows[0].estado,'fallido');
  await db.exec("reset role; set role authenticated; set test.operaciones='true';");
  assert.equal((await db.query('select reintentar_aviso_telegram($1) ok',[ORDER])).rows[0].ok,true);
  await db.exec('reset role; set role service_role;');
  assert.equal((await db.query('select * from tomar_aviso_telegram()')).rows.length,1);
  assert.equal((await db.query('select count(*)::int n from servicios')).rows[0].n,1);
 }finally{await db.close();}
});
test('operations reconciliation filters delivered history in SQL before pagination',async()=>{
 const db=await database(); try{
 await db.exec(`insert into servicios(id,cliente_id) values ('${ORDER}','${A}'),('10000000-0000-4000-8000-000000000002','${A}');
 insert into servicio_enrutamientos(servicio_id,estrategia,estado) values('10000000-0000-4000-8000-000000000002','telegram','enviado');`);
 await db.exec(migration());
 await db.exec(`insert into servicios(id,cliente_id) values ('10000000-0000-4000-8000-000000000003','${A}');
 set role authenticated; set request.jwt.claim.sub='${A}';`);
 assert.equal((await db.query('select * from listar_avisos_pendientes()')).rows.length,0);
 await db.exec("set test.operaciones='true';");
 assert.deepEqual((await db.query('select servicio_id,estado from listar_avisos_pendientes()')).rows,[{servicio_id:ORDER,estado:'sin_cola'},{servicio_id:'10000000-0000-4000-8000-000000000003',estado:'pendiente'}]);
 }finally{await db.close();}
});
