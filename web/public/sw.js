/* Service worker de Nora — sólo para notificaciones push.
   Nada de caché de páginas ni modo offline acá: eso es un problema
   aparte, más grande, que no se pidió resolver ahora. Este archivo
   hace sólo dos cosas: mostrar la notificación que llega del
   servidor, y llevar a la persona a la pantalla correcta si la toca. */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let datos;
  try {
    datos = event.data.json();
  } catch {
    datos = { titulo: "Nora", cuerpo: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(datos.titulo || "Nora", {
      body: datos.cuerpo || "",
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url: datos.url || "/historial" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/historial";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        if (cliente.url.includes(url) && "focus" in cliente) return cliente.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
