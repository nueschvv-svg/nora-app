/* Prueba del estimador de precios.
 *
 * Usa el catálogo REAL de la base: si mañana cambian las tarifas o se
 * agrega un trabajo, esta prueba sigue midiendo lo que hay de verdad.
 *
 * Correr con:  node pruebas/estimador.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
  identificarTrabajo,
  calcularEstimado,
  textoEstimado,
  TEXTO_URGENCIA,
} from "../src/lib/precios.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});

const pesos = (n) => "$ " + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

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

// ---------- Cargar catálogo y tarifas ----------
const { data: filas, error } = await sb
  .from("catalogo_trabajos")
  .select(
    "slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia, horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas",
  );

if (error) {
  console.log("❌ No se pudo leer el catálogo:", error.message);
  console.log("   ¿Corriste db/04_catalogo_precios.sql en Supabase?");
  process.exit(1);
}

const catalogo = filas.map((f) => ({
  slug: f.slug,
  categoriaSlug: f.categoria_slug,
  nombre: f.nombre,
  sintomas: f.sintomas ?? [],
  diagnostico: f.diagnostico,
  riesgoSiEspera: f.riesgo_si_espera,
  urgencia: f.urgencia,
  horasMin: Number(f.horas_min),
  horasMax: Number(f.horas_max),
  materialesMin: Number(f.materiales_min),
  materialesMax: Number(f.materiales_max),
  requiereMatricula: f.requiere_matricula,
  preguntas: f.preguntas ?? [],
}));

const { data: tf } = await sb
  .from("tarifas")
  .select("categoria_slug, visita_ars, visita_max_ars, hora_ars, hora_max_ars, recargo_urgencia")
  .order("vigente_desde", { ascending: false });

const tarifas = new Map();
for (const f of tf ?? []) {
  if (tarifas.has(f.categoria_slug)) continue;
  tarifas.set(f.categoria_slug, {
    categoriaSlug: f.categoria_slug,
    visitaArs: Number(f.visita_ars),
    visitaMaxArs: f.visita_max_ars == null ? null : Number(f.visita_max_ars),
    horaArs: f.hora_ars == null ? null : Number(f.hora_ars),
    horaMaxArs: f.hora_max_ars == null ? null : Number(f.hora_max_ars),
    recargoUrgencia: Number(f.recargo_urgencia ?? 0.4),
  });
}

// Cotización real
let dolar = null;
try {
  const r = await fetch("https://dolarapi.com/v1/dolares/blue");
  dolar = (await r.json()).venta;
} catch {}

console.log("=".repeat(66));
console.log(`ESTIMADOR — ${catalogo.length} trabajos, ${tarifas.size} tarifas, dólar ${dolar ?? "s/d"}`);
console.log("=".repeat(66));

// ---------- 1. ¿Identifica bien el problema? ----------
console.log("\n[1] Identificación a partir de lo que escribe la persona\n");

const casos = [
  ["Se rompió el caño de la cocina y sale agua por todos lados", "cano-roto-vista"],
  ["gotea abajo de la bacha, hay humedad en el mueble", "perdida-flexible-bacha"],
  ["la pileta del baño no baja, está tapada", "destapacion-artefacto"],
  ["salta la térmica cada vez que prendo el horno", "salta-termica"],
  ["quedé afuera de casa, perdí las llaves", "apertura-simple"],
  ["no tengo agua caliente, el calefón no prende", "termotanque-no-calienta"],
  ["quiero cambiar la cerradura, me robaron las llaves", "cambio-cerradura"],
  ["el inodoro pierde agua todo el tiempo", "inodoro-mochila"],
  ["hay una mancha de humedad en el techo del baño", "perdida-techo-humedad"],
  ["se rompio un cano adentro de la pared", "cano-roto-pared"],
  ["vuelve el agua por la rejilla del baño", "destapacion-principal"],
  ["sale poca agua solo en la canilla de la cocina", "presion-aireador"],
];

for (const [texto, esperado] of casos) {
  const r = identificarTrabajo(texto, catalogo);
  const acerto = r[0]?.trabajo.slug === esperado;
  chequear(
    `"${texto.slice(0, 44)}…" → ${esperado}`,
    acerto,
    acerto ? "" : `dijo "${r[0]?.trabajo.slug ?? "nada"}" (confianza ${r[0]?.confianza.toFixed(2) ?? 0})`,
  );
}

// ---------- 2. ¿Admite que no sabe? ----------
console.log("\n[2] Cuando la descripción no alcanza, ¿lo admite?\n");

const vagos = ["hola", "tengo un problema", "necesito ayuda en casa", "vengan por favor"];
for (const texto of vagos) {
  const r = identificarTrabajo(texto, catalogo);
  const confianza = r[0]?.confianza ?? 0;
  chequear(`"${texto}" → no arriesga diagnóstico`, confianza < 0.5, `confianza ${confianza.toFixed(2)}`);
}

// ---------- 3. ¿La cuenta cierra? ----------
console.log("\n[3] La aritmética del estimado\n");

const flexible = catalogo.find((t) => t.slug === "perdida-flexible-bacha");
const tPlom = tarifas.get("plomeria");
const e1 = calcularEstimado(flexible, tPlom, { dolar });

const sumaDesde = e1.detalle.reduce((t, d) => t + d.desde, 0);
const sumaHasta = e1.detalle.reduce((t, d) => t + d.hasta, 0);
chequear("el total es la suma del desglose", e1.desdeArs === sumaDesde && e1.hastaArs === sumaHasta);
chequear("el mínimo no supera al máximo", e1.desdeArs <= e1.hastaArs);
chequear(
  "los dólares salen de dividir por la cotización",
  dolar ? e1.desdeUsd === Math.round(e1.desdeArs / dolar) : e1.desdeUsd === null,
);

const e2 = calcularEstimado(flexible, tPlom, { dolar, fueraDeHorario: true });
chequear(
  `fuera de horario sale más caro (${pesos(e1.desdeArs)} → ${pesos(e2.desdeArs)})`,
  e2.desdeArs > e1.desdeArs,
);

const caño = catalogo.find((t) => t.slug === "cano-roto-pared");
const e3 = calcularEstimado(caño, tPlom, { dolar });
chequear(
  `un caño roto sale más que un flexible (${pesos(e3.hastaArs)} vs ${pesos(e1.hastaArs)})`,
  e3.hastaArs > e1.hastaArs,
);

chequear(
  "un trabajo de 1 hora no cobra horas adicionales",
  calcularEstimado({ ...flexible, horasMin: 1, horasMax: 1 }, tPlom).detalle.every(
    (d) => !d.concepto.includes("adicional"),
  ),
);

// ---------- 3b. Rangos honestos ----------
console.log("\n[3b] ¿Se calla cuando el rango es inútil?\n");

chequear(
  `un flexible da un rango usable (${pesos(e1.desdeArs)}–${pesos(e1.hastaArs)}, ${(e1.hastaArs / e1.desdeArs).toFixed(1)}x)`,
  e1.rangoUtil,
);
chequear(
  `un caño roto en pared todavía da rango (${(e3.hastaArs / e3.desdeArs).toFixed(1)}x)`,
  e3.rangoUtil,
);

// Una filtración de techo sí es incotizable sin verla: puede ser una junta
// o puede ser la losa, y entre esas dos hay un orden de magnitud.
const humedad = catalogo.find((t) => t.slug === "perdida-techo-humedad");
const e4 = calcularEstimado(humedad, tPlom, { dolar });
chequear(
  `una filtración de techo NO da rango (${(e4.hastaArs / e4.desdeArs).toFixed(1)}x)`,
  !e4.rangoUtil,
);
chequear(
  "cuando no lo da, ofrece el precio de la visita",
  textoEstimado(e4).titulo.startsWith("Visita desde"),
  textoEstimado(e4).titulo,
);

const anchos = [];
for (const t of catalogo) {
  const tf2 = tarifas.get(t.categoriaSlug);
  const e = calcularEstimado(t, tf2);
  if (!e.rangoUtil) anchos.push(`${t.slug} (${(e.hastaArs / e.desdeArs).toFixed(1)}x)`);
}
console.log(`  ℹ  ${anchos.length} de ${catalogo.length} trabajos necesitan visita para cotizar:`);
for (const a of anchos) console.log(`       ${a}`);

// ---------- 4. Cómo se ve para el cliente ----------
console.log("\n[4] Así lo vería la persona\n");

for (const texto of [
  "Se rompió el caño de la cocina y sale agua por todos lados",
  "salta la térmica cuando prendo el horno",
]) {
  const [mejor] = identificarTrabajo(texto, catalogo);
  const t = tarifas.get(mejor.trabajo.categoriaSlug);
  const est = calcularEstimado(mejor.trabajo, t, { dolar, confianza: mejor.confianza });
  const u = TEXTO_URGENCIA[mejor.trabajo.urgencia];

  console.log(`  ─────────────────────────────────────────────────────────`);
  console.log(`  Vos: "${texto}"`);
  console.log(`  `);
  console.log(`  ${mejor.trabajo.nombre.toUpperCase()}   [${u.etiqueta} · ${u.plazo}]`);
  console.log(`  ${mejor.trabajo.diagnostico.slice(0, 150)}…`);
  console.log(`  `);
  console.log(`  Si esperás: ${mejor.trabajo.riesgoSiEspera.slice(0, 130)}…`);
  console.log(`  `);
  const txt = textoEstimado(est);
  if (est.rangoUtil) {
    for (const d of est.detalle) {
      console.log(`    ${d.concepto.padEnd(42)} ${pesos(d.desde).padStart(12)} – ${pesos(d.hasta)}`);
    }
  }
  console.log(`    ${"→ " + txt.titulo}`);
  if (txt.usd) console.log(`      ${txt.usd}`);
  console.log(`    ${txt.aclaracion}`);
  if (mejor.trabajo.requiereMatricula) console.log(`  ⚠ Requiere matriculado.`);
  console.log("");
}

console.log("=".repeat(66));
console.log(`RESULTADO:  ${ok} pasadas   ${mal} fallidas`);
console.log("=".repeat(66));
if (mal > 0) process.exit(1);
