// Sólo cluster temporal local. Nunca conecta a una URL remota.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const bin=process.env.NORA_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin';
const dump=process.argv[2];
if(!dump || !fs.readFileSync(dump,'utf8').includes('PostgreSQL database dump complete')) throw Error('Se necesita export completo');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nora-esquema-real-'));
const run=(cmd,args)=>execFileSync(path.join(bin,cmd),args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
run('initdb',['-D',dir,'-U','postgres','-A','trust','--no-locale','-E','UTF8']);
run('pg_ctl',['-D',dir,'-l',path.join(dir,'server.log'),'-o',`-h '' -k ${dir} -p 55439`,'-w','start']);
const args=['-h',dir,'-p','55439','-U','postgres','-d','postgres','-X','-v','ON_ERROR_STOP=1','-At'];
const sql=s=>run('psql',[...args,'-c',s]);
try {
 sql(`create role anon; create role authenticated; create role service_role bypassrls; create role supabase_admin; drop schema public; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon,service_role;`);
 run('psql',[...args,'-f',path.resolve(dump)]);
 console.log('Export producción restaurado en PostgreSQL local');
 for(const f of ['44_cola_telegram.sql','45_edificio_piloto.sql','46_permisos_piloto.sql','47_agenda_fija.sql']) {
  run('psql',[...args,'-f',path.join(__dirname,'../db',f)]); console.log('Aplicada: '+f);
 }
 const assert=require('node:assert/strict');
 const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
 sql(`insert into auth.users values('${A}'),('${B}'); insert into perfiles(id,nombre) values('${A}','QA A'),('${B}','QA B'); insert into categorias(slug,nombre,icono) values('plomeria','QA Plomería','droplet');`);
 const as=(id,q)=>sql(`set role authenticated; set request.jwt.claim.sub='${id}'; ${q}`);
 const property=id=>as(id,`insert into propiedades(dueno_id,nombre,calle,localidad) values('${id}','QA','Prueba','CABA') returning id`).trim().split('\n').find(x=>/^[a-f0-9-]{36}$/.test(x));
 const pa=property(A),pb=property(B);
 const date=sql("select d::date from generate_series(current_date+3,current_date+9,interval '1 day') d where extract(isodow from d)=1 limit 1").trim();
 const insert=(id,p,slot)=>as(id,`insert into servicios(cliente_id,propiedad_id,categoria_slug,descripcion,fecha_preferida,franja_preferida) values('${id}','${p}','plomeria','Pedido QA de prueba','${date}','${slot}')`);
 insert(A,pa,'09:30–11:30'); insert(B,pb,'09:30–11:30');
 for(const [self,other] of [[A,B],[B,A]]) assert.equal(as(self,`select count(*) from servicios where cliente_id='${other}'`).trim().split('\n').at(-1),'0');
 assert.equal(as(A,`select count(*) from propiedades where id='${pb}'`).trim().split('\n').at(-1),'0');
 assert.match(as(A,`update servicios set descripcion='Intento ajeno' where cliente_id='${B}'`),/UPDATE 0/);
 assert.throws(()=>as(A,`update perfiles set rol='operaciones' where id='${A}'`));
 assert.throws(()=>insert(A,pb,'11:30–13:30'));
 assert.throws(()=>insert(A,pa,'09:30–11:30'));
 assert.equal(sql('select count(*) from servicio_avisos').trim(),'2');
 console.log('PASS: sesiones SQL aisladas, propiedad ajena/escalada bloqueadas, capacidad 2 y cola atómica. JWT/Storage remotos NO verificados.');
 console.log(sql("select 'tablas='||count(*) from pg_tables where schemaname='public'; select 'políticas='||count(*) from pg_policies where schemaname='public';"));
} catch(e){ console.error(e.stderr?.toString() || e.message);process.exitCode=1; }
finally {run('pg_ctl',['-D',dir,'-m','fast','-w','stop']);}
