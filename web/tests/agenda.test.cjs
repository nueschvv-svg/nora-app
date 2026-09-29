const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
async function setup() {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create table servicios(id uuid primary key default gen_random_uuid(), cliente_id uuid, fecha_preferida date,franja_preferida text,estado text default 'solicitado',creado_el timestamptz default now());
 create table notificaciones(usuario_id uuid,titulo text,cuerpo text,servicio_id uuid);
 insert into servicios(fecha_preferida,franja_preferida) values('2000-01-01','manana');`);
 const sql = '../../db/47_agenda_fija.sql';
 assert.ok(fs.existsSync(require('node:path').join(__dirname, sql)), 'Falta migración de agenda con protección de cupos');
 await db.exec(fs.readFileSync(require('node:path').join(__dirname,sql),'utf8'));
 return db;
}
async function day(db, weekday=1) {
 return (await db.query(`select d::date::text d from generate_series(current_date+3,current_date+10,interval '1 day') d where extract(isodow from d)=$1 limit 1`,[weekday])).rows[0].d;
}
const add=(db,d,slot='09:30–11:30')=>db.query('insert into servicios(fecha_preferida,franja_preferida) values($1,$2) returning *',[d,slot]);
test('Monday and Saturday accept two seats in each slot, third rejected, cancellation releases only its seat',async()=>{
 const db=await setup();try{
 for(const weekday of [1,6]){
  const d=await day(db,weekday);
  for(const slot of ['09:30–11:30','11:30–13:30','14:30–16:00','16:00–17:30']){
   const a=(await add(db,d,slot)).rows[0];await add(db,d,slot);
   await assert.rejects(add(db,d,slot),/AGENDA_COMPLETO/);
   await db.query("update servicios set estado='cancelado' where id=$1",[a.id]);
   await add(db,d,slot);
   await assert.rejects(db.query("update servicios set estado='solicitado' where id=$1",[a.id]),/AGENDA_COMPLETO/);
  }
  assert.equal((await db.query("select count(*)::int n from servicios where fecha_preferida=$1 and estado<>'cancelado'",[d])).rows[0].n,8);
 }
 }finally{await db.close();}
});
test('reject Sunday, past, immediate, null and forged slot, preserve historical rows',async()=>{
 const db=await setup();try{
 await assert.rejects(add(db,await day(db,7)),/AGENDA_DOMINGO/);
 await assert.rejects(add(db,'2000-01-03'),/AGENDA_ANTICIPACION/);
 await assert.rejects(add(db,null),/AGENDA_FECHA/);
 await assert.rejects(add(db,await day(db),'urgente'),/AGENDA_FRANJA/);
 assert.equal((await db.query("select franja_preferida,agenda_cupo from servicios where fecha_preferida='2000-01-01'")).rows[0].agenda_cupo,null);
 }finally{await db.close();}
});
test('availability exposes only aggregates and matches occupied seats; reschedule is atomic and keeps original on failure',async()=>{
 const db=await setup();try{
 const d=await day(db); const a=(await add(db,d)).rows[0];
 let rows=(await db.query('select * from agenda_disponibilidad($1,1)',[d])).rows;
 assert.equal(rows.length,4);assert.equal(rows[0].disponibles,1);assert.equal(rows[0].estado,'LAST_SPOT');
 assert.ok(!JSON.stringify(rows).includes(a.id));
 await add(db,d,'11:30–13:30');await add(db,d,'11:30–13:30');
 await assert.rejects(db.query("update servicios set franja_preferida='11:30–13:30' where id=$1",[a.id]),/AGENDA_COMPLETO/);
 assert.equal((await db.query('select franja_preferida from servicios where id=$1',[a.id])).rows[0].franja_preferida,'09:30–11:30');
 await db.query("update servicios set franja_preferida='14:30–16:00' where id=$1",[a.id]);
 assert.equal((await db.query('select * from agenda_disponibilidad($1,1)',[d])).rows[0].disponibles,2);
 }finally{await db.close();}
});
test('notice uses configured timezone and exact 24h boundary, server clock; forbidden configuration writes',async()=>{
 const db=await setup();try{
 assert.equal((await db.query("select agenda_fecha_habilitada('2030-01-07','09:30–11:30','2030-01-06 12:30:00+00') ok")).rows[0].ok,true);
 assert.equal((await db.query("select agenda_fecha_habilitada('2030-01-07','09:30–11:30','2030-01-06 12:30:01+00') ok")).rows[0].ok,false);
 await db.exec("set timezone='Asia/Tokyo'");
 assert.equal((await db.query("select agenda_fecha_habilitada('2030-01-07','09:30–11:30','2030-01-06 12:30:00+00') ok")).rows[0].ok,true);
 await db.exec('set role authenticated');
 await assert.rejects(db.exec('update agenda_config set minimum_booking_notice=interval \'0 hours\''),/permission denied/);
 await db.query('select * from agenda_disponibilidad(null,14)');
 }finally{await db.close();}
});
test('legacy future appointments block their entire date without being changed',async()=>{
 const db=await setup();try{
 const d=await day(db);
 // Seed a pre-migration row by moving the old row while trigger is disabled, only in fixture.
 await db.exec('alter table servicios disable trigger trg_z_agenda');
 await db.query("update servicios set fecha_preferida=$1 where franja_preferida='manana'",[d]);
 await db.exec('alter table servicios enable trigger trg_z_agenda');
 assert.ok((await db.query('select * from agenda_disponibilidad($1,1)',[d])).rows.every(f=>f.estado==='UNAVAILABLE'));
 await assert.rejects(add(db,d),/AGENDA_HISTORICO/);
 assert.equal((await db.query("select franja_preferida from servicios where fecha_preferida=$1",[d])).rows[0].franja_preferida,'manana');
 }finally{await db.close();}
});
