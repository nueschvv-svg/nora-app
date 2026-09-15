const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
test('schedule uses Argentina calendar date across UTC midnight', () => {
  const { fechaArgentina } = load('src/lib/validacionPedido.ts');
  assert.equal(fechaArgentina(new Date('2026-09-14T01:00:00Z')), '2026-09-13');
});
test('telephone accepts formatting but rejects letters and oversized values', () => {
  const { telefonoContactoValido } = load('src/lib/validacionPedido.ts');
  assert.equal(telefonoContactoValido('+54 (11) 5555-1234'), true);
  for (const value of ['123', 'abc12345678', '1'.repeat(100), ' ']) assert.equal(telefonoContactoValido(value), false);
});
test('invalid and oversized attachments are rejected before analysis or upload', () => {
  const { errorFotoPedido } = load('src/lib/validacionPedido.ts');
  assert.equal(errorFotoPedido({ type: 'image/jpeg', size: 1024 }), null);
  assert.ok(errorFotoPedido({ type: 'text/html', size: 100 }));
  assert.ok(errorFotoPedido({ type: 'image/jpeg', size: 6 * 1024 * 1024 }));
});
