import { timingSafeEqual } from "node:crypto";
import { procesarUnAviso } from "@/lib/enrutamiento/cola";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Consumidor no configurado." }, { status: 503 });
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  // Tres avisos concurrentes por minuto. Cada claim es atómico en Postgres.
  const resultados = await Promise.allSettled(Array.from({ length: 3 }, () => procesarUnAviso()));
  const fallos = resultados.filter((r) => r.status === "rejected").length;
  return Response.json({ ok: fallos === 0, fallos, resultados: resultados.map((r) => r.status === "fulfilled" ? r.value : "error") },
    { status: fallos ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
