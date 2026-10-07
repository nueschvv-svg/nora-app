// Local UI fixture: real agenda SQL in PGlite; auth/REST simulated, NOT hosted Supabase/RLS.
// Binds to loopback, uses fictional data and never calls external services.
const http = require('node:http');
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const path=require('node:path');
const db=new PGlite();
const ready=(async()=>{
 await db.exec(`create role anon; create role authenticated; create role service_role; create table servicios(id uuid primary key,cliente_id uuid,fecha_preferida date,franja_preferida text,estado text default 'solicitado',creado_el timestamptz default now()); create table notificaciones(usuario_id uuid,titulo text,cuerpo text,servicio_id uuid);`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../../db/47_agenda_fija.sql'),'utf8'));
 const slots=(await db.query('select * from agenda_disponibilidad(null,30)')).rows.filter(f=>f.estado==='AVAILABLE');
 const day=slots.find(f=>f.franja==='09:30–11:30').fecha;
 for(const slot of ['09:30–11:30','09:30–11:30','11:30–13:30']) await db.query('insert into servicios(id,fecha_preferida,franja_preferida) values(gen_random_uuid(),$1,$2)',[day,slot]);
 const seeded=(await db.query('select * from servicios')).rows;
 rows.servicios.push(...seeded.map((r,i)=>({...r,fecha_preferida:new Date(r.fecha_preferida).toISOString().slice(0,10),creado_el:new Date(r.creado_el).toISOString(),numero_orden:1000+i,descripcion:'Trabajo ficticio QA '+(i+1),categoria_slug:'plomeria',cliente_id:resident})));
 console.log('QA seeded full/last/available day:',day);
})();
const { randomUUID } = require('node:crypto');
const resident = '00000000-0000-4000-8000-000000000001';
const user = { id: resident, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const access_token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({ sub: resident, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600, is_anonymous: true }), 'local-ui-fixture'].join('.');
const rows = {
  edificios: [{ id: '30000000-0000-4000-8000-000000000001', slug: 'edificio-qa', nombre: 'Edificio ficticio QA', calle: 'Calle ficticia', numero: '123', localidad: 'CABA', provincia: 'CABA', activo: true }],
  servicio_avisos: [],
  perfiles: [{ id: resident, nombre: 'Residente QA', telefono: '1155551234', mail_contacto: '', rol: 'cliente' }],
  categorias: ['Plomería', 'Electricidad', 'Cerrajería'].map((nombre, i) => ({ slug: ['plomeria', 'electricidad', 'cerrajeria'][i], nombre, icono: 'wrench', activa: true, orden: i, requiere_matricula: false })),
  propiedades: [], equipos: [], servicios: [], servicio_fotos: [], calificaciones: [], servicio_enrutamientos: [],
};
http.createServer(async (req, res) => {
  await ready;
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Content-Type': 'application/json' };
  const send = (status, body) => { res.writeHead(status, headers); res.end(JSON.stringify(body)); };
  if (req.method === 'OPTIONS') return send(200, {});
  const url = new URL(req.url, 'http://127.0.0.1:54321');
  if (url.pathname === '/__qa/role' && req.method==='POST') {user.is_anonymous=false;rows.perfiles[0].rol='operaciones';return send(200,{ok:true});}
  if (url.pathname === '/rest/v1/rpc/agenda_disponibilidad') {let raw='';for await(const b of req)raw+=b;const p=JSON.parse(raw||'{}');return send(200,(await db.query('select * from agenda_disponibilidad($1,$2)',[p.p_desde??null,p.p_dias??30])).rows.map(f=>({...f,fecha:new Date(f.fecha).toISOString().slice(0,10)})));}
  if (url.pathname === '/rest/v1/rpc/listar_avisos_pendientes') return send(200,rows.servicio_avisos);
  if (url.pathname.startsWith('/rest/v1/rpc/')) return send(404,{message:'RPC no simulada'});
  if (url.pathname === '/auth/v1/user') return send(200, user);
  if (url.pathname === '/auth/v1/signup' || url.pathname === '/auth/v1/token') return send(200, { access_token, token_type: 'bearer', expires_in: 3600, refresh_token: 'local-ui-fixture-refresh', user });
  const table = url.pathname.split('/rest/v1/')[1];
  if (!table) return send(404, {});
  let data = rows[table] ?? [];
  const matches = (row) => [...url.searchParams].every(([key, val]) => val.startsWith('eq.') ? String(row[key]) === val.slice(3) : val.startsWith('neq.') ? String(row[key]) !== val.slice(4) : true);
  if (['POST', 'PATCH'].includes(req.method)) {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const payload = JSON.parse(raw || '{}');
    if (req.method === 'POST') {
      const record = { id: randomUUID(), numero_orden: data.length + 1, creado_el: new Date().toISOString(), ...payload };
      if (data.some((r) => r.id === record.id)) return send(409, { code: '23505', message: 'duplicate' });
      if(table==='servicios') {try {const result=await db.query('insert into servicios(id,cliente_id,fecha_preferida,franja_preferida) values($1,$2,$3,$4) returning agenda_cupo',[record.id,record.cliente_id,record.fecha_preferida,record.franja_preferida]);record.agenda_cupo=result.rows[0].agenda_cupo;}catch(e){return send(400,{message:e.message});}}
      data.push(record); rows[table] = data; data = [record];
      // UI simulation only; the SQL trigger is tested separately in PGlite.
      if (table === 'servicios') rows.servicio_avisos.push({ servicio_id: record.id, estado: 'pendiente', intentos: 0, proximo_intento_el: new Date().toISOString() });
    } else { data = data.filter(matches); data.forEach((row) => Object.assign(row, payload)); }
  } else data = data.filter(matches);
  if (req.headers.accept?.includes('vnd.pgrst.object')) return send(200, data[0] ?? null);
  return send(200, data);
}).listen(54321, '127.0.0.1', () => console.log('UI fixture on 127.0.0.1:54321; agenda SQL in PGlite; simulated auth/REST; no real records'));
