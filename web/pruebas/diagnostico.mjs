/* Prueba del diagnóstico por foto, contra el endpoint real.
 *
 * Va por HTTP a /api/diagnosticar, así que ejerce todo el camino:
 * la puerta de sesión, la validación de la imagen, la llamada a Claude,
 * la validación de la respuesta y el cálculo del precio.
 *
 * Requiere el servidor levantado (npm run dev) y ANTHROPIC_API_KEY
 * en .env.local.
 *
 * Correr con:  node pruebas/diagnostico.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const REF = new URL(URL_SB).hostname.split(".")[0];

let ok = 0;
let mal = 0;
const chequear = (desc, cond, detalle = "") => {
  if (cond) {
    ok++;
    console.log(`  ✅ ${desc}`);
  } else {
    mal++;
    console.log(`  ❌ ${desc}${detalle ? "\n     → " + detalle : ""}`);
  }
};

/* @supabase/ssr guarda la sesión en una cookie con este nombre y formato.
   Replicarla acá es lo que nos deja probar el endpoint como si fuéramos
   el navegador de una persona con sesión iniciada. */
function cookieDeSesion(session) {
  const valor = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
  return `sb-${REF}-auth-token=${valor}`;
}

async function pedir({ cookie, descripcion, categoria, foto, nombreFoto, tipoFoto }) {
  const form = new FormData();
  if (descripcion != null) form.set("descripcion", descripcion);
  if (categoria) form.set("categoria", categoria);
  if (foto) form.set("foto", new Blob([foto], { type: tipoFoto }), nombreFoto);

  const r = await fetch(`${BASE}/api/diagnosticar`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
    body: form,
  });
  let cuerpo = null;
  try {
    cuerpo = await r.json();
  } catch {}
  return { status: r.status, cuerpo };
}

console.log("=".repeat(66));
console.log("DIAGNÓSTICO POR FOTO — contra el endpoint real");
console.log("=".repeat(66));

// ---------- Sesión ----------
const sb = createClient(URL_SB, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
const { data: auth, error: errAuth } = await sb.auth.signInWithPassword({
  email: "noraprueba1@gmail.com",
  password: "Nora2026",
});
if (errAuth) {
  console.log("❌ No pude iniciar sesión:", errAuth.message);
  process.exit(1);
}
const cookie = cookieDeSesion(auth.session);

// ---------- 1. Sin sesión ----------
console.log("\n[1] Las puertas de entrada\n");

const sinSesion = await pedir({ descripcion: "se rompió un caño" });
chequear(
  "sin sesión responde 401 y no gasta un token",
  sinSesion.status === 401,
  `respondió ${sinSesion.status}`,
);

const vacio = await pedir({ cookie, descripcion: "hm" });
chequear("sin descripción ni foto responde 400", vacio.status === 400);

const tipoMalo = await pedir({
  cookie,
  descripcion: "mirá este archivo",
  foto: Buffer.from("no soy una imagen"),
  nombreFoto: "cosa.pdf",
  tipoFoto: "application/pdf",
});
chequear("rechaza un archivo que no es imagen", tipoMalo.status === 400, tipoMalo.cuerpo?.error);

const grande = await pedir({
  cookie,
  descripcion: "foto enorme",
  foto: Buffer.alloc(6 * 1024 * 1024),
  nombreFoto: "gigante.jpg",
  tipoFoto: "image/jpeg",
});
chequear("rechaza una foto de más de 5 MB", grande.status === 400, grande.cuerpo?.error);

// ---------- 2. Clasificación por texto ----------
console.log("\n[2] Clasificación (sólo texto)\n");

const casos = [
  // "abajo de la bacha" es literalmente el flexible: la primera versión de
  // esta prueba esperaba "caño roto" y la equivocada era la prueba.
  ["Gotea la conexión de abajo de la bacha de la cocina", "perdida-flexible-bacha"],
  ["Se partió un caño del lavadero, se ve la rajadura y sale agua a chorros", "cano-roto-vista"],
  ["Salta la térmica cada vez que enciendo el horno eléctrico", "salta-termica"],
  ["Quedé afuera de casa, me dejé las llaves adentro", "apertura-simple"],
];

for (const [texto, esperado] of casos) {
  const r = await pedir({ cookie, descripcion: texto });
  if (r.status === 429) {
    console.log("  ⏸  límite por hora alcanzado — esperá un rato o reiniciá el server");
    break;
  }
  const slug = r.cuerpo?.trabajo?.slug;
  chequear(
    `"${texto.slice(0, 42)}…" → ${esperado}`,
    slug === esperado,
    `dijo ${slug ?? "(no identificó)"} · ${r.cuerpo?.observaciones?.slice(0, 70) ?? ""}`,
  );
}

// ---------- 3. La prueba que más importa ----------
console.log("\n[3] ¿Inventa un diagnóstico cuando la foto no corresponde?\n");

const retrato = readFileSync(new URL("../../_archivo/mati.jpg", import.meta.url));
const irrelevante = await pedir({
  cookie,
  descripcion: "mirá esto",
  foto: retrato,
  nombreFoto: "retrato.jpg",
  tipoFoto: "image/jpeg",
});

chequear(
  "con una foto que no muestra ningún problema, NO inventa un trabajo",
  irrelevante.cuerpo?.identificado === false,
  `identificó "${irrelevante.cuerpo?.trabajo?.slug}" con confianza ${irrelevante.cuerpo?.confianza}`,
);
chequear(
  "y tampoco devuelve un precio",
  irrelevante.cuerpo?.estimado == null,
  JSON.stringify(irrelevante.cuerpo?.estimado),
);
console.log(`     dijo: "${irrelevante.cuerpo?.observaciones}"`);

// ---------- 4. Cómo lo vería la persona ----------
console.log("\n[4] Así lo vería la persona\n");

const demo = await pedir({
  cookie,
  descripcion: "Hay una mancha de humedad grande en el techo del baño y crece cuando llueve",
});
const c = demo.cuerpo;
if (c?.identificado) {
  console.log(`  ${c.trabajo.nombre.toUpperCase()}`);
  console.log(`  confianza ${(c.confianza * 100).toFixed(0)}%${c.riesgoInmediato ? "  ⚠ RIESGO INMEDIATO" : ""}`);
  console.log(`  `);
  console.log(`  ${c.observaciones}`);
  console.log(`  `);
  console.log(`  Si esperás: ${c.trabajo.riesgoSiEspera.slice(0, 120)}…`);
  if (c.preguntas?.length) {
    console.log(`  `);
    for (const p of c.preguntas) console.log(`    · ${p}`);
  }
  console.log(`  `);
  console.log(`  → ${c.estimado?.titulo}`);
  if (c.estimado?.usd) console.log(`    ${c.estimado.usd}`);
  console.log(`    ${c.estimado?.aclaracion}`);
} else {
  console.log(`  (no identificado) ${c?.observaciones}`);
}

console.log("\n" + "=".repeat(66));
console.log(`RESULTADO:  ${ok} pasadas   ${mal} fallidas`);
console.log("=".repeat(66));
if (mal > 0) process.exit(1);
