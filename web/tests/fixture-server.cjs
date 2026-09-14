// UI-only fixture. This is NOT Supabase and does NOT validate SQL/RLS.
// Binds to loopback, uses fictional data and never calls external services.
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const resident = '00000000-0000-4000-8000-000000000001';
const user = { id: resident, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const access_token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({ sub: resident, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600, is_anonymous: true }), 'local-ui-fixture'].join('.');
const rows = {
  perfiles: [{ id: resident, nombre: 'Residente QA', telefono: '1155551234', mail_contacto: '', rol: 'cliente' }],
  categorias: ['Plomería', 'Electricidad', 'Cerrajería'].map((nombre, i) => ({ slug: ['plomeria', 'electricidad', 'cerrajeria'][i], nombre, icono: 'wrench', activa: true, orden: i, requiere_matricula: false })),
  propiedades: [], equipos: [], servicios: [], servicio_fotos: [], calificaciones: [], servicio_enrutamientos: [],
};
http.createServer(async (req, res) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Content-Type': 'application/json' };
  const send = (status, body) => { res.writeHead(status, headers); res.end(JSON.stringify(body)); };
  if (req.method === 'OPTIONS') return send(200, {});
  const url = new URL(req.url, 'http://127.0.0.1:54321');
  if (url.pathname === '/auth/v1/user') return send(200, user);
  if (url.pathname === '/auth/v1/signup' || url.pathname === '/auth/v1/token') return send(200, { access_token, token_type: 'bearer', expires_in: 3600, refresh_token: 'local-ui-fixture-refresh', user });
  const table = url.pathname.split('/rest/v1/')[1];
  if (!table) return send(404, {});
  let data = rows[table] ?? [];
  const matches = (row) => [...url.searchParams].every(([key, val]) => !val.startsWith('eq.') || String(row[key]) === val.slice(3));
  if (['POST', 'PATCH'].includes(req.method)) {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const payload = JSON.parse(raw || '{}');
    if (req.method === 'POST') {
      const record = { id: randomUUID(), numero_orden: data.length + 1, creado_el: new Date().toISOString(), ...payload };
      if (data.some((r) => r.id === record.id)) return send(409, { code: '23505', message: 'duplicate' });
      data.push(record); rows[table] = data; data = [record];
    } else { data = data.filter(matches); data.forEach((row) => Object.assign(row, payload)); }
  } else data = data.filter(matches);
  if (req.headers.accept?.includes('vnd.pgrst.object')) return send(200, data[0] ?? null);
  return send(200, data);
}).listen(54321, '127.0.0.1', () => console.log('UI fixture on 127.0.0.1:54321; no SQL/RLS, no real records'));
