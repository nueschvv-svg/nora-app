const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
test('retry identifier survives reload without storing personal data', async () => {
  let saved;
  const storage = { getItem: () => saved ?? null, setItem: (_, value) => { saved = value; }, removeItem: () => { saved = undefined; } };
  const first = load('src/lib/intentoPedido.ts');
  const id = await first.idIntentoPedido({ descripcion: 'Dato privado' }, storage);
  const reloaded = load('src/lib/intentoPedido.ts');
  assert.equal(await reloaded.idIntentoPedido({ descripcion: 'Dato privado' }, storage), id);
  assert.ok(!saved.includes('Dato privado'));
  assert.notEqual(await reloaded.idIntentoPedido({ descripcion: 'Otra solicitud' }, storage), id);
});
