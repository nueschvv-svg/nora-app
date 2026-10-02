import { NextResponse, type NextRequest } from "next/server";

/* Convierte una dirección en lat/lng — necesario para poder ordenar la
   bolsa del técnico por distancia real (ver db/31_bolsa_por_distancia.sql).
   Nominatim (OpenStreetMap) porque ya es lo que usa el mapa de
   seguimiento en toda la app: gratis, sin tarjeta, a diferencia de la
   API de geocodificación de Google.

   Server-only a propósito, no porque haya un secreto (Nominatim no
   pide API key) sino porque su política de uso pide un User-Agent que
   identifique la app — más prolijo mandarlo siempre igual desde acá
   que confiar en que cada navegador lo mande bien.

   Si Nominatim no encuentra nada o falla, la propiedad se guarda
   igual sin lat/lng: nunca bloquea el alta de un domicilio por esto —
   sólo hace que ese domicilio no entre todavía en el orden por
   distancia hasta que se pueda geocodificar. */

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  let cuerpo: { calle?: string; numero?: string; localidad?: string; provincia?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ lat: null, lng: null }, { status: 400 });
  }

  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo) ||
      [cuerpo.calle, cuerpo.numero, cuerpo.localidad, cuerpo.provincia].some(
        (valor) => valor !== undefined && (typeof valor !== "string" || valor.length > 200),
      )) {
    return NextResponse.json({ lat: null, lng: null }, { status: 400 });
  }

  const calle = (cuerpo.calle ?? "").trim();
  const localidad = (cuerpo.localidad ?? "").trim();
  if (!calle || !localidad) {
    return NextResponse.json({ lat: null, lng: null });
  }

  const consulta = [
    cuerpo.numero ? `${calle} ${cuerpo.numero}`.trim() : calle,
    localidad,
    (cuerpo.provincia ?? "").trim(),
    "Argentina",
  ]
    .filter(Boolean)
    .join(", ");

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", consulta);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ar");

  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "NoraApp/1.0 (nora-app-849.netlify.app; geocodificacion de domicilios de clientes)",
      },
    });
    if (!r.ok) return NextResponse.json({ lat: null, lng: null });

    const resultados = (await r.json()) as Array<{ lat: string; lon: string }>;
    const primero = resultados[0];
    if (!primero) return NextResponse.json({ lat: null, lng: null });

    const lat = Number(primero.lat);
    const lng = Number(primero.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ lat: null, lng: null });

    return NextResponse.json({ lat, lng });
  } catch (e) {
    console.error("[api/geocodificar]", e);
    return NextResponse.json({ lat: null, lng: null });
  }
}
