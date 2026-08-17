/* Prueba del matching por cercanía — algoritmo, en aislamiento.
 *
 * Esto NO pega contra Supabase: reproduce en JS la misma fórmula que
 * corre en la base (db/07_trabajadores.sql → tecnicos_cercanos()) sobre
 * un dataset de 18 trabajadores simulados en distintos puntos del país.
 *
 * Por qué así y no contra la base real: `tecnicos.id` depende de un
 * usuario real en auth.users (clave foránea), y sembrar 18 cuentas de
 * prueba en el Supabase del proyecto ensuciaría datos de producción sin
 * forma fácil de limpiarlos después. El álgebra de la distancia no
 * depende de Postgres — se puede probar sola. La política de acceso
 * (quién puede llamar a la función, qué columnas devuelve) se revisa a
 * mano en db/07_trabajadores.sql y con pruebas/matching.sql una vez
 * aplicada la migración.
 *
 * Correr con:  node pruebas/matching.mjs
 */

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

/* Réplica exacta de la fórmula del semiverseno de tecnicos_cercanos()
   en db/07_trabajadores.sql. Devuelve kilómetros. */
function distanciaKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const arg = Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(lng2 * rad - lng1 * rad) +
    Math.sin(lat1 * rad) * Math.sin(lat2 * rad);
  const clamp = Math.min(1, Math.max(-1, arg));
  return 6371 * Math.acos(clamp);
}

/* Réplica de la caja delimitadora que usa el índice antes de calcular
   la distancia real. */
function dentroDeLaCaja(cliente, trabajador, radioKm) {
  const rad = Math.PI / 180;
  const deltaLat = radioKm / 111.0;
  const deltaLng = radioKm / (111.0 * Math.cos(cliente.lat * rad));
  return (
    trabajador.lat >= cliente.lat - deltaLat &&
    trabajador.lat <= cliente.lat + deltaLat &&
    trabajador.lng >= cliente.lng - deltaLng &&
    trabajador.lng <= cliente.lng + deltaLng
  );
}

/* Réplica completa del predicado + orden de tecnicos_cercanos(). */
function tecnicosCercanos(candidatos, { categoriaSlug, lat, lng, radioKm = 30, limite = 20 }) {
  return candidatos
    .filter((t) => t.estado === "verificado")
    .filter((t) => t.disponible)
    .filter((t) => t.categorias.includes(categoriaSlug))
    .filter((t) => t.lat != null && t.lng != null)
    .filter((t) => dentroDeLaCaja({ lat, lng }, t, radioKm))
    .map((t) => ({ ...t, distanciaKm: distanciaKm(lat, lng, t.lat, t.lng) }))
    .filter((t) => t.distanciaKm <= Math.min(radioKm, t.radioKm ?? radioKm))
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
    .slice(0, limite);
}

console.log("=".repeat(66));
console.log("MATCHING POR CERCANÍA — algoritmo, con dataset simulado");
console.log("=".repeat(66));

// ---------- El dataset: 18 trabajadores, no 3 ----------
// Coordenadas reales aproximadas. Mezcla a propósito: cerca y lejos del
// cliente, plomeros y electricistas, verificados y pendientes,
// disponibles y no, con y sin ubicación cargada.
const CLIENTE = { lat: -34.6037, lng: -58.3816 }; // Obelisco, CABA

const trabajadores = [
  // --- Plomeros verificados y disponibles, cerca (deberían aparecer) ---
  t("Plomero Once",        -34.6083, -58.4055, "plomeria",     "verificado", true, 15),
  t("Plomero Palermo",     -34.5875, -58.4306, "plomeria",     "verificado", true, 15),
  t("Plomero Caballito",   -34.6187, -58.4406, "plomeria",     "verificado", true, 15),
  t("Plomero Belgrano",    -34.5627, -58.4576, "plomeria",     "verificado", true, 20),
  t("Plomero San Telmo",   -34.6212, -58.3733, "plomeria",     "verificado", true, 15),
  t("Plomero Avellaneda",  -34.6626, -58.3654, "plomeria",     "verificado", true, 25),
  t("Plomero Vicente López",-34.5267, -58.4728, "plomeria",    "verificado", true, 25),
  // --- Debería quedar afuera: mismo rubro y cerca, pero no disponible ---
  t("Plomero Flores (no disp.)", -34.6291, -58.4633, "plomeria", "verificado", false, 15),
  // --- Debería quedar afuera: mismo rubro y cerca, pero sin verificar ---
  t("Plomero Recién Alta", -34.6100, -58.3900, "plomeria",     "pendiente",  true, 15),
  // --- Debería quedar afuera: mismo rubro y disponible, pero sin ubicación ---
  t("Plomero Sin Ubicación", null, null, "plomeria",           "verificado", true, 15),
  // --- Debería quedar afuera: plomero verificado y disponible, pero MUY lejos ---
  t("Plomero Córdoba",     -31.4201, -64.1888, "plomeria",     "verificado", true, 15),
  t("Plomero Mendoza",     -32.8895, -68.8458, "plomeria",     "verificado", true, 15),
  t("Plomero Bariloche",   -41.1335, -71.3103, "plomeria",     "verificado", true, 15),
  // --- Debería quedar afuera: cerca y disponible, pero otro rubro ---
  t("Electricista Once",   -34.6083, -58.4055, "electricidad", "verificado", true, 15),
  t("Cerrajero Caballito", -34.6187, -58.4406, "cerrajeria",   "verificado", true, 15),
  // --- Cerca pero justo afuera del radio propio del trabajador ---
  t("Plomero Radio Corto", -34.5300, -58.3200, "plomeria",     "verificado", true, 3),
  // --- Otro rubro, para el segundo caso de prueba ---
  t("Electricista La Plata", -34.9214, -57.9544, "electricidad", "verificado", true, 40),
  t("Electricista Tigre",  -34.4260, -58.5800, "electricidad", "verificado", true, 30),
];

function t(nombre, lat, lng, categoria, estado, disponible, radioKm) {
  return { nombre, lat, lng, categorias: [categoria], estado, disponible, radioKm };
}

chequear("el dataset tiene al menos 15 trabajadores simulados", trabajadores.length >= 15, `tiene ${trabajadores.length}`);

// ---------- Caso 1: plomería cerca del Obelisco ----------
console.log("\n[1] Plomería, 30 km desde el Obelisco\n");
const resultado1 = tecnicosCercanos(trabajadores, { categoriaSlug: "plomeria", ...CLIENTE, radioKm: 30 });

chequear(
  "devuelve exactamente los 7 plomeros verificados+disponibles+cercanos",
  resultado1.length === 7,
  `devolvió ${resultado1.length}: ${resultado1.map((r) => r.nombre).join(", ")}`,
);
chequear(
  "viene ordenado de más cerca a más lejos",
  resultado1.every((r, i) => i === 0 || resultado1[i - 1].distanciaKm <= r.distanciaKm),
  resultado1.map((r) => `${r.nombre} (${r.distanciaKm.toFixed(1)}km)`).join(" → "),
);
chequear(
  "el más cercano es Plomero San Telmo",
  resultado1[0]?.nombre === "Plomero San Telmo",
  `dio ${resultado1[0]?.nombre}`,
);
chequear(
  "no aparece el que no está disponible",
  !resultado1.some((r) => r.nombre.includes("no disp")),
);
chequear(
  "no aparece el que todavía no está verificado",
  !resultado1.some((r) => r.nombre === "Plomero Recién Alta"),
);
chequear(
  "no aparece el que no cargó ubicación",
  !resultado1.some((r) => r.nombre === "Plomero Sin Ubicación"),
);
chequear(
  "no aparecen los de otro rubro (electricista, cerrajero)",
  !resultado1.some((r) => r.nombre.includes("Electricista") || r.nombre.includes("Cerrajero")),
);
chequear(
  "no aparecen los que están a cientos de km (Córdoba, Mendoza, Bariloche)",
  !resultado1.some((r) => ["Plomero Córdoba", "Plomero Mendoza", "Plomero Bariloche"].includes(r.nombre)),
);
chequear(
  "no aparece el que está cerca pero fuera de SU propio radio de 3km",
  !resultado1.some((r) => r.nombre === "Plomero Radio Corto"),
  `distancia real: ${distanciaKm(CLIENTE.lat, CLIENTE.lng, -34.53, -58.32).toFixed(1)}km, su radio: 3km`,
);

// ---------- Caso 2: electricidad, radio más chico ----------
console.log("\n[2] Electricidad, 15 km desde el Obelisco\n");
const resultado2 = tecnicosCercanos(trabajadores, { categoriaSlug: "electricidad", ...CLIENTE, radioKm: 15 });
chequear(
  "sólo el electricista de Once entra en 15km (La Plata y Tigre quedan afuera)",
  resultado2.length === 1 && resultado2[0].nombre === "Electricista Once",
  `devolvió: ${resultado2.map((r) => r.nombre).join(", ") || "(nada)"}`,
);

// ---------- Caso 3: límite ----------
console.log("\n[3] Respeta el límite de resultados\n");
const resultado3 = tecnicosCercanos(trabajadores, { categoriaSlug: "plomeria", ...CLIENTE, radioKm: 30, limite: 3 });
chequear("con límite 3, devuelve 3", resultado3.length === 3, `devolvió ${resultado3.length}`);

console.log("\n" + "=".repeat(66));
console.log(`RESULTADO:  ${ok} pasadas   ${mal} fallidas`);
console.log("=".repeat(66));
if (mal > 0) process.exit(1);
