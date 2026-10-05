const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const SQL = (n) => fs.readFileSync(path.resolve(__dirname, '../../db/', n), 'utf8');

/* Esquema mínimo que reproduce lo que importa: el enum de estados, la tabla
   de servicios, la bitácora y el trigger de lista positiva de db/46. No es
   el proyecto entero: es la frontera que la migración 50 toca. */
async function preparar(db) {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema if not exists auth;
    create table auth.actual(uid uuid);
    insert into auth.actual values (null);
    create function auth.uid() returns uuid language sql stable as $$ select uid from auth.actual $$;
    create type estado_servicio as enum ('solicitado','presupuestado','aceptado','en_camino','en_curso','finalizado','pagado','calificado','cancelado');
    create table public.perfiles(id uuid primary key, rol text not null default 'cliente');
    create table public.servicios(
      id uuid primary key default gen_random_uuid(),
      cliente_id uuid,
      estado estado_servicio not null default 'solicitado',
      monto_ars numeric,
      metodo_pago text,
      pago_confirmado_el timestamptz,
      actualizado_el timestamptz not null default now());
    create table public.servicio_eventos(
      id bigserial primary key, servicio_id uuid not null references public.servicios(id) on delete cascade,
      estado_nuevo estado_servicio not null, estado_previo estado_servicio,
      actor_id uuid, nota text, ocurrio_el timestamptz not null default now());
    create function public.es_operaciones() returns boolean language sql stable as $$
      select exists(select 1 from public.perfiles where id = auth.uid() and rol = 'operaciones') $$;
    create function public.registrar_evento_servicio() returns trigger language plpgsql security definer
    set search_path = public as $$
    begin
      if tg_op = 'INSERT' or new.estado is distinct from old.estado then
        insert into servicio_eventos (servicio_id, estado_nuevo, estado_previo, actor_id)
        values (new.id, new.estado, case when tg_op='UPDATE' then old.estado else null end, auth.uid());
      end if;
      return null;
    end $$;
    create trigger trg_registrar_evento after insert or update on public.servicios
      for each row execute function public.registrar_evento_servicio();
  `);
  // El trigger de lista positiva, tal como quedó aplicado en db/46.
  const m46 = SQL('46_permisos_piloto.sql');
  const i = m46.indexOf('create or replace function public.solo_permitir_cancelar()');
  await db.exec(m46.slice(i, m46.indexOf('$$;', i) + 3));
  await db.exec(`create trigger trg_solo_cancelar before update on public.servicios
    for each row execute function public.solo_permitir_cancelar();`);
  await db.exec(SQL('50_situacion_servicio.sql'));
}

const comoUid = (db, uid) => db.exec(`update auth.actual set uid = ${uid ? `'${uid}'::uuid` : 'null'}`);
const RESIDENTE = '20000000-0000-4000-8000-000000000001';
const OPERADOR = '20000000-0000-4000-8000-000000000002';

test('la situación es un eje aparte: no mueve el estado, la escribe sólo operaciones y queda en la bitácora', async () => {
  const db = new PGlite();
  try {
    await preparar(db);
    await db.exec(`insert into public.perfiles(id,rol) values ('${RESIDENTE}','cliente'), ('${OPERADOR}','operaciones');
      insert into public.servicios(id, cliente_id, estado) values ('30000000-0000-4000-8000-000000000001','${RESIDENTE}','en_curso');`);
    const ID = '30000000-0000-4000-8000-000000000001';

    // --- El residente NO puede escribirla. Y esto funciona SIN haber tocado
    //     solo_permitir_cancelar: su lista positiva congela columnas nuevas.
    await comoUid(db, RESIDENTE);
    await assert.rejects(
      db.exec(`update public.servicios set situacion='materiales' where id='${ID}'`),
      /sin cambiar otros datos|no está permitido/i,
      'un residente no puede declarar por qué está frenado su propio pedido',
    );

    // --- Operaciones sí.
    await comoUid(db, OPERADOR);
    await db.exec(`update public.servicios set situacion='materiales', situacion_nota='Falta la membrana' where id='${ID}'`);
    const fila = (await db.query(`select estado, situacion, situacion_nota from public.servicios where id='${ID}'`)).rows[0];
    assert.equal(fila.situacion, 'materiales');
    assert.equal(fila.estado, 'en_curso', 'marcar el motivo NO puede mover el pedido en el ciclo');
    assert.equal(fila.situacion_nota, 'Falta la membrana');

    // --- Queda en la bitácora, sin falsear una transición que no ocurrió.
    const ev = (await db.query(`select estado_nuevo, estado_previo, nota from public.servicio_eventos
      where servicio_id='${ID}' order by id desc limit 1`)).rows[0];
    assert.equal(ev.estado_nuevo, 'en_curso');
    assert.equal(ev.estado_previo, 'en_curso', 'no se inventa un cambio de estado');
    assert.match(ev.nota, /Esperando materiales\. Falta la membrana/);

    // --- Destrabar también queda registrado.
    await db.exec(`update public.servicios set situacion=null, situacion_nota=null where id='${ID}'`);
    const ev2 = (await db.query(`select nota from public.servicio_eventos where servicio_id='${ID}' order by id desc limit 1`)).rows[0];
    assert.match(ev2.nota, /se destrabó/i);

    // --- Un valor fuera de los tres acordados se rechaza.
    await assert.rejects(
      db.exec(`update public.servicios set situacion='lo_que_sea' where id='${ID}'`),
      /servicios_situacion_valida/,
    );
    // --- Una nota sin situación es ruido.
    await assert.rejects(
      db.exec(`update public.servicios set situacion=null, situacion_nota='algo' where id='${ID}'`),
      /servicios_situacion_nota_requiere_situacion/,
    );

    // --- Un pedido cerrado no puede quedar marcado como frenado: sería
    //     mentirle al residente en su pantalla de seguimiento.
    await db.exec(`update public.servicios set situacion='segunda_visita' where id='${ID}'`);
    await db.exec(`update public.servicios set estado='finalizado' where id='${ID}'`);
    const cerrado = (await db.query(`select situacion, situacion_nota from public.servicios where id='${ID}'`)).rows[0];
    assert.equal(cerrado.situacion, null, 'al cerrar se limpia sola');
    assert.equal(cerrado.situacion_nota, null);
  } finally {
    await db.close();
  }
});

test('la rama de estado de la bitácora sigue viva después de agregarle la de situación', async () => {
  const db = new PGlite();
  try {
    await preparar(db);
    await db.exec(`insert into public.perfiles(id,rol) values ('${OPERADOR}','operaciones');`);
    await comoUid(db, OPERADOR);
    await db.exec(`insert into public.servicios(id, estado) values ('30000000-0000-4000-8000-000000000009','solicitado');`);
    const ID = '30000000-0000-4000-8000-000000000009';
    await db.exec(`update public.servicios set estado='aceptado' where id='${ID}'`);
    const ev = (await db.query(`select estado_nuevo, estado_previo, nota from public.servicio_eventos
      where servicio_id='${ID}' order by id desc limit 1`)).rows[0];
    assert.equal(ev.estado_nuevo, 'aceptado');
    assert.equal(ev.estado_previo, 'solicitado');
    assert.equal(ev.nota, null, 'un cambio de estado se registra como antes, sin nota de situación');
    assert.equal(
      (await db.query(`select count(*)::int as n from public.servicio_eventos where servicio_id='${ID}'`)).rows[0].n,
      2,
      'alta + transición: ni se duplica ni se pierde ningún evento',
    );
  } finally {
    await db.close();
  }
});
