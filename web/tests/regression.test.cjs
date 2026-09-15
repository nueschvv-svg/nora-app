const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { load } = require('./load.cjs');

function middleware(user) {
  return load('src/lib/supabase/middleware.ts', {
    './config': { HAY_SUPABASE: true, SUPABASE_URL: 'http://localhost:54321', SUPABASE_ANON_KEY: 'test' },
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
  }).actualizarSesion;
}
test('anonymous visitor can reach operations login', async () => {
  const response = await middleware({ id: 'resident', is_anonymous: true })(new NextRequest('https://nora.test/entrar?volver=/operaciones'));
  assert.equal(response.headers.get('location'), null);
});
test('anonymous visitor to operations is directed to login', async () => {
  const response = await middleware({ id: 'resident', is_anonymous: true })(new NextRequest('https://nora.test/operaciones'));
  assert.equal(new URL(response.headers.get('location')).pathname, '/entrar');
});
test('authenticated account keeps existing login redirect', async () => {
  const response = await middleware({ id: 'operator', is_anonymous: false })(new NextRequest('https://nora.test/entrar'));
  assert.equal(new URL(response.headers.get('location')).pathname, '/inicio');
});
for (const body of [null, [], { calle: 123, localidad: 'CABA' }, { calle: 'a', localidad: {} }]) {
  test(`geocoding handles invalid body ${JSON.stringify(body)} without throwing`, async () => {
    const { POST } = load('src/app/api/geocodificar/route.ts');
    const response = await POST(new NextRequest('https://nora.test/api/geocodificar', { method: 'POST', body: JSON.stringify(body) }));
    assert.equal(response.status, 400);
  });
}
test('chat rejects null JSON before calling paid model', async () => {
  const { POST } = load('src/app/api/chat/route.ts', {
    '@/lib/supabase/servidor': { supabaseServidor: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'test' } } }) } }) },
    '@/lib/chatNora': { chatearConNora: () => { throw Error('must not call model'); } },
  });
  const response = await POST(new NextRequest('https://nora.test/api/chat', { method: 'POST', body: 'null' }));
  assert.equal(response.status, 400);
});
