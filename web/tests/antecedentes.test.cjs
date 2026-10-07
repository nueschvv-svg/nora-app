const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { load } = require('./load.cjs');

const A = () => load('src/lib/antecedentes.ts');
const SQL49 = path.resolve(__dirname, '../../db/49_catalogo_eba.sql');
const CSV = path.resolve(__dirname, '../../docs/piloto/sector15/catalogo_nora_sector15.csv');

function casos() {
  const { mapearCatalogo } = A();
  return mapearCatalogo([
    { id: 'humedad_filtracion-01', familia: 'humedad_filtracion', frecuencia: 41, desperfecto_tipo: 'humedad en muro dormitorio', diagnostico_mas_comun: 'posible filtración por carpintería', diagnosticos_alternativos: 'mancha seca', tarea_tipica: 'se retiró pintura y se colocó enduido' },
    { id: 'humedad_filtracion-02', familia: 'humedad_filtracion', frecuencia: 23, desperfecto_tipo: 'humedad en cielorraso baño', diagnostico_mas_comun: 'filtración desde unidad superior', diagnosticos_alternativos: '', tarea_tipica: 'se reemplazó placa de yeso' },
    { id: 'electricidad-01', familia: 'electricidad', frecuencia: 35, desperfecto_tipo: 'anular tomacorrientes atrás de cocina', diagnostico_mas_comun: 'riesgo por calor del horno', diagnosticos_alternativos: '', tarea_tipica: 'se anuló la boca' },
  ]);
}

test('familia inventada, vacía o sin antecedentes cargados se descarta', () => {
  const { validarFamilia } = A();
  const c = casos();
  assert.equal(validarFamilia('humedad_filtracion', c), 'humedad_filtracion');
  assert.equal(validarFamilia('ninguna', c), null, 'el centinela no es una familia');
  assert.equal(validarFamilia('plomeria_inventada', c), null);
  assert.equal(validarFamilia('plomeria_desagues', c), null, 'familia válida pero sin casos cargados');
  assert.equal(validarFamilia(null, c), null);
  assert.equal(validarFamilia(42, c), null);
});

test('el modelo no puede devolver antecedentes inventados, ajenos ni repetidos', () => {
  const { validarAntecedentes } = A();
  const c = casos();

  const ok = validarAntecedentes(['humedad_filtracion-02', 'humedad_filtracion-01'], c, 'humedad_filtracion');
  assert.deepEqual(ok.map((x) => x.id), ['humedad_filtracion-02', 'humedad_filtracion-01'], 'respeta el orden que eligió el modelo');

  assert.deepEqual(validarAntecedentes(['humedad_filtracion-99'], c, 'humedad_filtracion'), [], 'id inexistente');
  assert.deepEqual(validarAntecedentes(['electricidad-01'], c, 'humedad_filtracion'), [], 'id de otra familia');
  assert.deepEqual(validarAntecedentes(['humedad_filtracion-01'], c, null), [], 'sin familia válida no hay antecedentes');
  assert.deepEqual(validarAntecedentes('humedad_filtracion-01', c, 'humedad_filtracion'), [], 'no es lista');
  assert.deepEqual(validarAntecedentes([1, null, {}], c, 'humedad_filtracion'), [], 'basura tipada');

  const repes = validarAntecedentes(['humedad_filtracion-01', 'humedad_filtracion-01'], c, 'humedad_filtracion');
  assert.equal(repes.length, 1, 'no repite el mismo antecedente');

  const mezcla = validarAntecedentes(['humedad_filtracion-99', 'humedad_filtracion-01', 'electricidad-01'], c, 'humedad_filtracion');
  assert.deepEqual(mezcla.map((x) => x.id), ['humedad_filtracion-01'], 'descarta lo inválido y conserva lo válido');

  const tope = validarAntecedentes(['humedad_filtracion-01', 'humedad_filtracion-02'], c, 'humedad_filtracion', 1);
  assert.equal(tope.length, 1, 'respeta el máximo');
});

test('el prompt lleva los antecedentes agrupados por familia y con sus ids exactos', () => {
  const { seccionPromptAntecedentes, familiasConCasos } = A();
  const c = casos();
  const texto = seccionPromptAntecedentes(c);

  assert.match(texto, /humedad_filtracion — Humedad y filtraciones/);
  assert.match(texto, /\[humedad_filtracion-01\]/);
  assert.match(texto, /\[electricidad-01\]/);
  assert.ok(texto.indexOf('[humedad_filtracion-01]') < texto.indexOf('[humedad_filtracion-02]'), 'ordena por frecuencia');
  assert.deepEqual(familiasConCasos(c), ['humedad_filtracion', 'electricidad']);
  assert.equal(seccionPromptAntecedentes([]), '', 'sin casos no se inyecta nada');
});

test('una familia de la base que el código no conoce se ignora en vez de propagarse', () => {
  const { mapearCatalogo } = A();
  const filas = [{ id: 'x-01', familia: 'familia_que_no_existe', frecuencia: 1, desperfecto_tipo: 'a', diagnostico_mas_comun: 'b', diagnosticos_alternativos: null, tarea_tipica: null }];
  assert.deepEqual(mapearCatalogo(filas), []);
});

test('la migración 49 carga el CSV completo, agrega humedad y no deja escribir el catálogo', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.categorias(slug text primary key, nombre text not null, icono text not null,
        requiere_matricula boolean not null default false, activa boolean not null default false,
        orden smallint not null default 100);`);
    await db.exec(fs.readFileSync(SQL49, 'utf8'));

    const filasCsv = fs.readFileSync(CSV, 'utf8').trim().split('\n').length - 1;
    const { rows } = await db.query('select count(*)::int as n from public.catalogo_eba');
    assert.equal(rows[0].n, filasCsv, 'la migración tiene que traer todas las filas del CSV');

    const hum = await db.query("select activa, nombre from public.categorias where slug='humedad'");
    assert.equal(hum.rows.length, 1, 'humedad tiene que existir como fila real de categorias');
    assert.equal(hum.rows[0].activa, true);

    // Toda familia almacenada tiene que ser una de las nueve que conoce el código.
    const { FAMILIAS } = A();
    const fams = (await db.query('select distinct familia from public.catalogo_eba')).rows.map((r) => r.familia);
    for (const f of fams) assert.ok(FAMILIAS.includes(f), `familia desconocida en la migración: ${f}`);

    await assert.rejects(
      db.exec("insert into public.catalogo_eba(id,familia,frecuencia,desperfecto_tipo,diagnostico_mas_comun) values ('z','familia_falsa',1,'a','b')"),
      /violates check constraint/i,
      'el CHECK tiene que rechazar una familia fuera del enum',
    );

    await db.exec('set role anon');
    assert.ok((await db.query('select count(*)::int as n from public.catalogo_eba')).rows[0].n > 0, 'lectura pública');
    await assert.rejects(
      db.exec("insert into public.catalogo_eba(id,familia,frecuencia,desperfecto_tipo,diagnostico_mas_comun) values ('z','otros',1,'a','b')"),
      /permission denied/i,
      'un residente no puede escribir el archivo histórico',
    );
    await db.exec('reset role');

    // Es repetible: volver a correrla no duplica ni rompe.
    await db.exec(fs.readFileSync(SQL49, 'utf8'));
    assert.equal((await db.query('select count(*)::int as n from public.catalogo_eba')).rows[0].n, filasCsv);
  } finally {
    await db.close();
  }
});

test('la descripción no dice "foto analizada" cuando sólo hubo texto, y lleva los antecedentes a operaciones', () => {
  const { descripcionDelPedido } = load('src/lib/descripcionPedido.ts');

  const soloTexto = descripcionDelPedido('Mancha en el techo', false, 'Parece una filtración desde arriba', null, { conFotos: false });
  assert.match(soloTexto, /\[Lectura de Nora sobre lo que contó la persona\]/);
  assert.doesNotMatch(soloTexto, /[Ff]oto/, 'sin fotos no se puede afirmar que se miró una');

  const conFotos = descripcionDelPedido('Mancha en el techo', false, 'Se ve humedad en la esquina', null, { conFotos: true });
  assert.match(conFotos, /\[Fotos analizadas por Nora\]/);

  const completo = descripcionDelPedido('Mancha en el techo del baño', false, 'Se ve humedad', null, {
    conFotos: true,
    familiaNombre: 'Humedad y filtraciones',
    antecedentes: [{ desperfecto: 'humedad en cielorraso baño', sueleSer: 'filtración desde unidad superior' }],
  });
  assert.match(completo, /\[Antecedentes de ENJINIA · Humedad y filtraciones\]/);
  assert.match(completo, /humedad en cielorraso baño/);
  assert.match(completo, /no un diagnóstico confirmado/, 'operaciones tiene que leer que es orientación');

  // Sin antecedentes no se inventa el bloque.
  assert.doesNotMatch(descripcionDelPedido('Algo', false, null, null, { conFotos: false }), /Antecedentes de ENJINIA/);
  // Compatibilidad: sin opciones sigue funcionando como antes.
  assert.equal(descripcionDelPedido('Canilla rota', false, null, null), 'Canilla rota');
});
