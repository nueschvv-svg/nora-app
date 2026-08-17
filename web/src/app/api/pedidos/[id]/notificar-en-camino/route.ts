import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { supabaseServidor } from "@/lib/supabase/servidor";

/* Avisa por notificación push que el técnico salió en camino.

   Por qué es una ruta aparte: mandar un push necesita la clave
   privada de VAPID, un secreto de servidor — el navegador del técnico
   no puede tocarla. La autorización real (¿sos vos el técnico de este
   pedido?) la hace la función de la base
   (suscripciones_para_notificar_en_camino, db/19_push_subscriptions.sql),
   no este archivo: si alguien llama a esta ruta con un pedido que no
   es suyo, la función no le devuelve ninguna suscripción.

   Que no llegue el push nunca bloquea marcar "en camino": el estado ya
   se guardó antes de que el navegador del técnico llame a esto (ver
   tecnico/[id]/page.tsx) — un error acá se registra y se ignora. */

export const runtime = "nodejs";
export const maxDuration = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let vapidConfigurado = false;

function configurarVapid() {
  if (vapidConfigurado) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("Faltan las claves VAPID.");
  webpush.setVapidDetails("mailto:soporte@nora.app", publicKey, privateKey);
  vapidConfigurado = true;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Id de pedido inválido." }, { status: 400 });
  }

  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }

  const { data: suscripciones, error: errRpc } = await supabase.rpc(
    "suscripciones_para_notificar_en_camino",
    { p_servicio_id: id },
  );

  if (errRpc) {
    console.error("[api/notificar-en-camino] no autorizado o sin suscripciones:", errRpc.message);
    return NextResponse.json({ ok: false, enviados: 0 });
  }

  const lista = (suscripciones ?? []) as Array<{ endpoint: string; p256dh: string; auth: string }>;
  if (lista.length === 0) return NextResponse.json({ ok: true, enviados: 0 });

  try {
    configurarVapid();
  } catch (e) {
    console.error("[api/notificar-en-camino]", e);
    return NextResponse.json({ ok: false, enviados: 0 });
  }

  const payload = JSON.stringify({
    titulo: "Tu técnico está en camino",
    cuerpo: "Ya salió para tu domicilio. Podés seguirlo en vivo desde tu Historial.",
    url: "/historial",
  });

  let enviados = 0;
  await Promise.all(
    lista.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        enviados++;
      } catch (e) {
        // Una suscripción vencida o inválida no debe cortar el resto.
        console.error("[api/notificar-en-camino] fallo un envío:", e instanceof Error ? e.message : e);
      }
    }),
  );

  return NextResponse.json({ ok: true, enviados });
}
