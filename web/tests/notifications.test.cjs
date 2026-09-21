const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
test('notification failure returned as HTTP 200 is not silently accepted', async () => {
  const original = global.fetch;
  global.fetch = async () => Response.json({ ok: false });
  try {
    const { enrutarPedido } = load('src/lib/enrutarPedidoCliente.ts');
    await assert.rejects(enrutarPedido('test'), /aviso/);
  } finally { global.fetch = original; }
});
test('long order with image stays within Telegram limits and retains contact', async () => {
  const original = global.fetch;
  const oldToken = process.env.TELEGRAM_BOT_TOKEN, oldChat = process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN = 'fixture'; process.env.TELEGRAM_CHAT_ID = 'fixture';
  const sent = [];
  global.fetch = async (_, options) => { sent.push(JSON.parse(options.body)); return Response.json({ ok: true }); };
  try {
    const { estrategiaTelegram } = load('src/lib/enrutamiento/telegram.ts', { 'server-only': {} });
    await estrategiaTelegram.enrutar({ servicioId: 'test', categoriaNombre: 'Plomería', descripcion: 'a'.repeat(4000), cliente: { nombre: 'Residente QA', telefono: '1155551234' }, propiedad: { direccion: 'Domicilio de prueba', localidad: 'QA', provincia: 'QA' }, fotoUrl: 'https://example.invalid/photo' });
    assert.ok(sent.every((m) => (!m.text || m.text.length <= 4096) && (!m.caption || m.caption.length <= 1024)));
    assert.ok(sent.some((m) => (m.text ?? m.caption ?? '').includes('1155551234')));
    assert.ok(sent.some((m) => m.photo === 'https://example.invalid/photo'));
  } finally {
    global.fetch = original;
    if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = oldToken;
    if (oldChat === undefined) delete process.env.TELEGRAM_CHAT_ID; else process.env.TELEGRAM_CHAT_ID = oldChat;
  }
});
test('Telegram HTTP 200 with ok false is a failure and raw transport secrets are never returned', async()=>{
 const oldFetch=global.fetch, token=process.env.TELEGRAM_BOT_TOKEN, chat=process.env.TELEGRAM_CHAT_ID;
 process.env.TELEGRAM_BOT_TOKEN='secret-token';process.env.TELEGRAM_CHAT_ID='fake-chat';
 const pedido={servicioId:'test',categoriaNombre:'Plomería',descripcion:'Pérdida',cliente:{nombre:'QA',telefono:'1155551234'},propiedad:{direccion:'QA',localidad:'QA',provincia:'QA'},fotoUrl:null};
 try{
  const {estrategiaTelegram}=load('src/lib/enrutamiento/telegram.ts',{'server-only':{}});
  global.fetch=async()=>Response.json({ok:false,description:'secret-token'});
  const failed=await estrategiaTelegram.enrutar(pedido);assert.equal(failed.ok,false);assert.ok(!failed.detalle.includes('secret-token'));
  global.fetch=async()=>{throw Error('https://api.telegram.org/botsecret-token/sendMessage');};
  const network=await estrategiaTelegram.enrutar(pedido);assert.equal(network.ok,false);assert.ok(!network.detalle.includes('secret-token'));
 }finally{global.fetch=oldFetch;if(token===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=token;if(chat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=chat;}
});
