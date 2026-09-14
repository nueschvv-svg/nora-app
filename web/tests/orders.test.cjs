const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
const input = { idIntento: '10000000-0000-4000-8000-000000000001', propiedadId: 'home', categoriaSlug: 'plomeria', descripcion: 'Pierde agua la canilla', fechaPreferida: null, franjaPreferida: null };
test('retry after lost response and concurrent submissions return the same order', async () => {
  const rows = new Map();
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'resident' } } }) },
    from() {
      let payload, filter;
      const query = {
        insert(data) { payload = data; return query; },
        select() { return query; },
        eq(column, value) { if (column === 'id') filter = value; return query; },
        maybeSingle: async () => ({ data: rows.get(filter) ?? null, error: null }),
        single: async () => {
          if (payload) {
            const id = payload.id ?? crypto.randomUUID();
            if (rows.has(id)) return { data: null, error: { code: '23505', message: 'duplicate primary key' } };
            rows.set(id, { ...payload, id, numero_orden: rows.size + 1, creado_el: '2026-09-14T00:00:00Z' });
            return { data: rows.get(id), error: null };
          }
          return { data: rows.get(filter), error: null };
        },
      };
      return query;
    },
  };
  const { crearServicio } = load('src/lib/datos.ts', { './supabase/cliente': { supabaseNavegador: () => client } });
  const first = await crearServicio(input); // imagine its HTTP response was lost
  const results = await Promise.all([crearServicio(input), crearServicio(input)]);
  assert.equal(rows.size, 1);
  assert.ok(results.every((result) => result.id === first.id));
});
