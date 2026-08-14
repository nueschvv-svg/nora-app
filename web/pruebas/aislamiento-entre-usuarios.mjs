/* Prueba de aislamiento entre usuarios.
 *
 * La pregunta que responde: ¿puede un usuario registrado, con sesión
 * válida, leer o tocar los datos de otro?
 *
 * No prueba la app: le habla a la base directo, igual que lo haría
 * alguien con la consola del navegador abierta. */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/Users/valentinnuesch/Claude/Projects/Nora APP/web/.env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const nuevoCliente = () => createClient(URL_SB, KEY, { auth: { persistSession: false } });

let pasadas = 0;
let fallidas = 0;

function chequear(descripcion, ok, detalle = "") {
  if (ok) {
    pasadas++;
    console.log(`  ✅ ${descripcion}`);
  } else {
    fallidas++;
    console.log(`  🚨 FALLA: ${descripcion}`);
    if (detalle) console.log(`     → ${detalle}`);
  }
}

async function entrar(email, password) {
  const sb = nuevoCliente();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`No pude entrar como ${email}: ${error.message}`);
  return { sb, userId: data.user.id };
}

const CLAVE_1 = "Nora2026";
const CLAVE_2 = "nora2026";

console.log("=".repeat(64));
console.log("PRUEBA DE AISLAMIENTO ENTRE USUARIOS");
console.log("=".repeat(64));

// ---------- Preparación ----------
console.log("\n[1] Entrando con las dos cuentas");
const uno = await entrar("noraprueba1@gmail.com", CLAVE_1);
const dos = await entrar("noraprueba2@gmail.com", CLAVE_2);
console.log(`  usuario 1: ${uno.userId}`);
console.log(`  usuario 2: ${dos.userId}`);

console.log("\n[2] El usuario 1 carga un domicilio y un equipo");
const { data: prop, error: errProp } = await uno.sb
  .from("propiedades")
  .insert({
    dueno_id: uno.userId,
    nombre: "Casa secreta de prueba",
    calle: "Calle Privada",
    numero: "1234",
    localidad: "Tigre",
    provincia: "Buenos Aires",
    icono: "home",
  })
  .select()
  .single();

if (errProp) {
  console.log(`  🚨 No pudo crear la propiedad: ${errProp.message}`);
  process.exit(1);
}
console.log(`  domicilio creado: ${prop.id} (${prop.calle} ${prop.numero})`);

const { data: equipo } = await uno.sb
  .from("equipos")
  .insert({ propiedad_id: prop.id, tipo: "calefon", marca: "Secreta", ultima_revision: "2025-01-15" })
  .select()
  .single();
console.log(`  equipo creado: ${equipo?.id}`);

const { data: servicio } = await uno.sb
  .from("servicios")
  .insert({
    cliente_id: uno.userId,
    propiedad_id: prop.id,
    categoria_slug: "plomeria",
    descripcion: "Pierde agua en la cocina, dato confidencial de prueba",
    estado: "solicitado",
  })
  .select()
  .single();
console.log(`  pedido creado: ${servicio?.id}`);

// ---------- Lo que importa ----------
console.log("\n[3] El usuario 2 intenta LEER los datos del usuario 1");

const r1 = await dos.sb.from("propiedades").select("*");
chequear(
  "listar propiedades no devuelve las ajenas",
  !r1.data?.some((p) => p.id === prop.id),
  `devolvió ${r1.data?.length ?? 0} filas`,
);

const r2 = await dos.sb.from("propiedades").select("*").eq("id", prop.id);
chequear(
  "pedir la propiedad por su id exacto devuelve vacío",
  (r2.data?.length ?? 0) === 0,
  r2.data?.length ? `¡LEYÓ LA DIRECCIÓN! ${JSON.stringify(r2.data[0])}` : "",
);

const r3 = await dos.sb.from("equipos").select("*").eq("propiedad_id", prop.id);
chequear("no puede ver los equipos ajenos", (r3.data?.length ?? 0) === 0);

const r4 = await dos.sb.from("servicios").select("*").eq("id", servicio?.id);
chequear("no puede ver los pedidos ajenos", (r4.data?.length ?? 0) === 0);

const r5 = await dos.sb.from("perfiles").select("*").eq("id", uno.userId);
chequear("no puede ver el perfil ajeno", (r5.data?.length ?? 0) === 0);

const r6 = await dos.sb.from("servicio_eventos").select("*").eq("servicio_id", servicio?.id);
chequear("no puede ver la bitácora del pedido ajeno", (r6.data?.length ?? 0) === 0);

console.log("\n[4] El usuario 2 intenta MODIFICAR los datos del usuario 1");

await dos.sb.from("propiedades").update({ nombre: "Hackeada" }).eq("id", prop.id);
const { data: verif1 } = await uno.sb.from("propiedades").select("nombre").eq("id", prop.id).single();
chequear(
  "no puede renombrar la propiedad ajena",
  verif1?.nombre === "Casa secreta de prueba",
  `quedó como "${verif1?.nombre}"`,
);

await dos.sb.from("propiedades").delete().eq("id", prop.id);
const { data: verif2 } = await uno.sb.from("propiedades").select("id").eq("id", prop.id);
chequear("no puede borrar la propiedad ajena", (verif2?.length ?? 0) === 1);

console.log("\n[5] El usuario 2 intenta hacer trampa con sus propios datos");

const r7 = await dos.sb.from("propiedades").insert({
  dueno_id: uno.userId, // se la asigna a OTRO
  nombre: "Colada",
  calle: "X",
  localidad: "Y",
  provincia: "Buenos Aires",
});
chequear("no puede crear una propiedad a nombre de otro", !!r7.error, r7.error?.message ?? "la creó");

const r8 = await dos.sb.from("servicios").insert({
  cliente_id: dos.userId,
  propiedad_id: prop.id, // propiedad ajena
  categoria_slug: "plomeria",
  descripcion: "Pedido sobre una casa que no es mia",
  estado: "solicitado",
});
chequear("no puede pedir un servicio sobre una casa ajena", !!r8.error);

const { data: propPropia } = await dos.sb
  .from("propiedades")
  .insert({
    dueno_id: dos.userId,
    nombre: "Mi casa",
    calle: "Propia",
    numero: "1",
    localidad: "Tigre",
    provincia: "Buenos Aires",
  })
  .select()
  .single();

const r9 = await dos.sb.from("servicios").insert({
  cliente_id: dos.userId,
  propiedad_id: propPropia.id,
  categoria_slug: "plomeria",
  descripcion: "Pedido con precio puesto por mi",
  estado: "solicitado",
  monto_ars: 1, // se pone el precio
});
chequear("no puede fijarse el precio al crear el pedido", !!r9.error);

const r10 = await dos.sb.from("servicios").insert({
  cliente_id: dos.userId,
  propiedad_id: propPropia.id,
  categoria_slug: "plomeria",
  descripcion: "Pedido que se marca como pagado solo",
  estado: "pagado", // se marca pagado
});
chequear("no puede marcar un pedido como pagado", !!r10.error);

const r11 = await dos.sb.from("perfiles").update({ rol: "operaciones" }).eq("id", dos.userId);
const { data: perfil2 } = await dos.sb.from("perfiles").select("rol").eq("id", dos.userId).single();
chequear(
  "no puede ascenderse a operaciones",
  perfil2?.rol === "cliente",
  `quedó con rol "${perfil2?.rol}" — error: ${r11.error?.message ?? "ninguno"}`,
);

console.log("\n[6] Lo que SÍ tiene que poder hacer");

const r12 = await dos.sb.from("propiedades").select("*");
chequear("ve sus propias propiedades", (r12.data?.length ?? 0) >= 1);

const r13 = await dos.sb.from("categorias").select("*");
chequear("ve las categorías (son públicas)", (r13.data?.length ?? 0) === 9);

// ---------- Limpieza ----------
console.log("\n[7] Limpiando los datos de prueba");
await uno.sb.from("propiedades").delete().eq("id", prop.id);
await dos.sb.from("propiedades").delete().eq("id", propPropia.id);
console.log("  listo");

console.log("\n" + "=".repeat(64));
console.log(`RESULTADO:  ${pasadas} pasadas   ${fallidas} fallidas`);
console.log("=".repeat(64));
if (fallidas > 0) {
  console.log("\n🚨 HAY FILTRACIONES. No se puede seguir hasta arreglarlas.");
  process.exit(1);
}
console.log("\n✅ Ningún usuario puede ver ni tocar los datos de otro.");
