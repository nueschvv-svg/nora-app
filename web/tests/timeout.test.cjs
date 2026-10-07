const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
test('stalled attachment releases the confirmation flow', async () => {
  const { conTiempoLimite } = load('src/lib/tiempoLimite.ts');
  await assert.rejects(conTiempoLimite(new Promise(() => {}), 5), /tiempo/);
  assert.equal(await conTiempoLimite(Promise.resolve('uploaded'), 100), 'uploaded');
});
