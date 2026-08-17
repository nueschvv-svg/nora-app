/* ============================================================
   NOTIFICACIONES PUSH — lado del navegador

   Activar notificaciones es: registrar el service worker, pedirle
   permiso a la persona, suscribirse con la clave pública de Nora
   (VAPID), y guardar esa suscripción en la base para que el servidor
   sepa a dónde mandar. Todo gratis — no es un servicio externo, es
   Web Push estándar del navegador.

   iPhone: sólo funciona si Nora está agregada a la pantalla de
   inicio (Compartir → Agregar a inicio) y con iOS 16.4 en adelante.
   Si no, el navegador no tiene de dónde sacar el permiso — no es
   algo que este código pueda forzar.
   ============================================================ */

import { supabaseNavegador } from "./supabase/cliente";

function fallar(contexto: string, error: { message: string }): never {
  console.error(`[push] ${contexto}:`, error.message);
  throw new Error(`No pudimos ${contexto}. Probá de nuevo en un momento.`);
}

export function notificacionesSoportadas(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** null si nunca se pidió permiso, boolean si ya se sabe la respuesta. */
export async function notificacionesActivas(): Promise<boolean> {
  if (!notificacionesSoportadas()) return false;
  const registro = await navigator.serviceWorker.getRegistration();
  const suscripcion = await registro?.pushManager.getSubscription();
  return !!suscripcion;
}

function base64UrlAUint8Array(base64Url: string): Uint8Array {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function activarNotificaciones(): Promise<void> {
  if (!notificacionesSoportadas()) {
    throw new Error("Tu navegador no puede recibir notificaciones.");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error("Falta configurar las notificaciones del servidor.");

  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") {
    throw new Error("No diste permiso de notificaciones.");
  }

  const registro = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const suscripcion =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlAUint8Array(vapidPublicKey) as BufferSource,
    }));

  const claves = suscripcion.toJSON().keys;
  if (!claves?.p256dh || !claves?.auth) throw new Error("La suscripción no trajo las claves esperadas.");

  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      usuario_id: user.id,
      endpoint: suscripcion.endpoint,
      p256dh: claves.p256dh,
      auth: claves.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) fallar("activar las notificaciones", error);
}

export async function desactivarNotificaciones(): Promise<void> {
  const registro = await navigator.serviceWorker.getRegistration();
  const suscripcion = await registro?.pushManager.getSubscription();
  if (!suscripcion) return;

  const endpoint = suscripcion.endpoint;
  await suscripcion.unsubscribe();

  const { error } = await supabaseNavegador().from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) fallar("desactivar las notificaciones", error);
}
