const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { load } = require('./load.cjs');
for (const target of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'https://evil.test']) {
  test(`auth callback keeps destination on site: ${target}`, async () => {
    const { GET } = load('src/app/auth/callback/route.ts', {
      '@/lib/supabase/servidor': { supabaseServidor: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: null }) } }) },
    });
    const response = await GET(new NextRequest('https://nora.test/auth/callback?code=test&next=' + encodeURIComponent(target)));
    const destination = new URL(response.headers.get('location'));
    assert.equal(destination.origin, 'https://nora.test');
    assert.equal(destination.pathname, '/inicio');
  });
}
test('navigation exposes existing order tracking to the resident', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { NavSuperior } = load('src/componentes/NavSuperior.tsx', {
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    './LogoNora': { LogotipoNora: () => null },
  });
  assert.match(renderToStaticMarkup(React.createElement(NavSuperior)), /href="\/pedidos"/);
});
