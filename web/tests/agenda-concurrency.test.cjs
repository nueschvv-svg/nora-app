// Optional real PostgreSQL verification. Each run creates an isolated local cluster.
// NORA_PG_BIN=/opt/homebrew/opt/postgresql@17/bin node --test tests/agenda-concurrency.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const {mkdtempSync,readFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const bin=process.env.NORA_PG_BIN;
test('independent PostgreSQL sessions cannot oversubscribe, including repeatable-read snapshots and forged cupos',{skip:!bin},async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'nora-agenda-pg-'));
 const run=(exe,args)=>execFileSync(path.join(bin,exe),args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 run('initdb',['-D',dir,'-A','trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',dir,'-l',path.join(dir,'server.log'),'-o',`-h '' -k ${dir} -p 55438`,'-w','start']);
 const args=['-h',dir,'-p','55438','-d','postgres','-X','-v','ON_ERROR_STOP=1','-At'];
 const sql=s=>run('psql',[...args,'-c',s]);
 const asyncSql=s=>new Promise(resolve=>{const p=spawn(path.join(bin,'psql'),[...args,'-c',s]);let err='';p.stderr.on('data',b=>err+=b);p.on('exit',code=>resolve({code,err}));});
 try{
 sql(`create role anon; create role authenticated; create role service_role; create table servicios(id uuid primary key default gen_random_uuid(),cliente_id uuid,fecha_preferida date,franja_preferida text,estado text not null default 'solicitado',creado_el timestamptz default now()); create table notificaciones(usuario_id uuid,titulo text,cuerpo text,servicio_id uuid);`);
 sql(readFileSync(path.join(__dirname,'../../db/47_agenda_fija.sql'),'utf8'));
 const day=sql("select d::date from generate_series(current_date+3,current_date+10,interval '1 day') d where extract(isodow from d)=1 limit 1").trim();
 for(const level of ['READ COMMITTED','REPEATABLE READ']){
  const slot=level==='READ COMMITTED'?'09:30–11:30':'11:30–13:30';
  const result=await Promise.all(Array.from({length:12},()=>asyncSql(`begin isolation level ${level}; select count(*) from servicios; select pg_sleep(0.15); insert into servicios(fecha_preferida,franja_preferida,agenda_cupo) values('${day}','${slot}',1); commit;`)));
  const count=Number(sql(`select count(*) from servicios where fecha_preferida='${day}' and franja_preferida='${slot}'`).trim());
  assert.ok(count>=1 && count<=2);
  if(level==='READ COMMITTED') assert.equal(count,2);
  assert.equal(result.filter(r=>r.code===0).length,count);
  if(count===1) sql(`insert into servicios(fecha_preferida,franja_preferida) values('${day}','${slot}')`);
  assert.equal(sql(`select count(*) from servicios where fecha_preferida='${day}' and franja_preferida='${slot}'`).trim(),'2');
  assert.ok(result.filter(r=>r.code!==0).every(r=>/AGENDA_COMPLETO|agenda_cupo_unico/.test(r.err)));
 }
 // A request that was valid before waiting must fail if notice expires in the lock queue.
 sql(`update agenda_config set minimum_booking_notice = ('${day} 14:30'::timestamp at time zone 'America/Argentina/Buenos_Aires') - (clock_timestamp()+interval '2 seconds')`);
 const holder=asyncSql(`begin; select pg_advisory_xact_lock(470001,date '${day}'-date '2000-01-01'); select pg_sleep(3); commit;`);
 for(let attempt=0;attempt<100;attempt++) {
  if(sql("select count(*) from pg_locks where locktype='advisory' and granted").trim()!=='0') break;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 const waiting=await asyncSql(`insert into servicios(fecha_preferida,franja_preferida) values('${day}','14:30–16:00')`);
 await holder;
 assert.notEqual(waiting.code,0);
 assert.match(waiting.err,/AGENDA_ANTICIPACION/);
 }finally{run('pg_ctl',['-D',dir,'-m','fast','-w','stop']);}
});
