# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos audiencias reales, la misma app:

- **Dueños de propiedad en Argentina** que necesitan un técnico de
  confianza para su casa o departamento (plomería, electricidad,
  cerrajería, gas, aire acondicionado, y el resto del catálogo de
  categorías) — hoy resuelven esto preguntando en el grupo de WhatsApp
  del barrio o llamando a "el plomero de siempre" si tienen uno. Entran
  con desconfianza: van a dejar entrar a un desconocido a su casa.
- **Técnicos verificados** que buscan trabajo — se dan de alta, cargan
  documentación, y reciben pedidos de su rubro y su zona una vez
  verificados por el equipo de operaciones.

## Product Purpose

Nora conecta a alguien con un problema en su casa con un técnico
verificado, y hace todo el ciclo — pedir, matching por proximidad,
presupuesto, seguimiento en vivo, pago, calificación — adentro de una
sola app, sin salir a WhatsApp ni a llamadas sueltas. Éxito es que el
cliente pida un servicio, vea a un técnico real confirmar y llegar, y
quede tan tranquilo con el proceso que la próxima vez que tenga un
problema en la casa piense en Nora primero — y se lo cuente a alguien.

## Positioning

La confianza y el seguimiento en vivo son el producto, no un extra: el
cliente ve quién es el técnico (nombre, foto, calificación, cantidad de
trabajos hechos con Nora) antes de que llegue, lo sigue en el mapa
mientras viene, y cierra el trabajo con un código que sólo el cliente le
dicta al técnico — nadie puede marcar "terminado" sin que el cliente lo
haya confirmado en persona. Ningún competidor informal (el grupo de
WhatsApp del barrio, el técnico de un aviso suelto) ofrece esa cadena de
custodia. El matching es por distancia real del técnico a la propiedad,
no por orden de llegada ni por quién paga más.

## Operating Context

- Mobile web, pensado para usarse desde el celular en el momento en que
  algo se rompe — no hay versión de escritorio dedicada.
- El ciclo completo de un pedido: cliente describe el problema (texto o
  foto, con diagnóstico automático que estima precio y riesgo) → pedido
  se enruta a técnicos verificados del rubro y la zona por proximidad
  real → técnico acepta o rechaza → cliente ve el estado avanzar en
  vivo (confirmado → en camino con mapa en tiempo real → trabajando →
  terminado) → cliente dicta un código de 4 dígitos para cerrar el
  trabajo → pago → calificación cruzada (cliente califica al técnico,
  técnico también califica al cliente).
- Un panel de operaciones interno (personal de Nora, no público) fija
  precios, asigna técnicos cuando el matching automático no alcanza, y
  verifica la documentación de técnicos nuevos.
- Chat en tiempo real entre cliente y técnico vive adentro del pedido.
  Un bot de FAQ separado escala a WhatsApp sólo como salida a soporte
  humano — WhatsApp nunca se usa para coordinar el trabajo en sí.
- El técnico tiene su propia sección de la app (pedidos disponibles de
  su rubro/zona, aceptar/rechazar, avanzar el estado, compartir
  ubicación en vivo mientras está "en camino").

## Capabilities and Constraints

- Backend: Supabase (Postgres + RLS en cada tabla, sin `service_role` en
  ningún punto de la app — cada consulta respeta permisos reales de
  fila). Tiempo real vía Supabase Realtime (estado del pedido, ubicación
  del técnico, mensajes de chat).
- Geolocalización del técnico vía Geolocation API del navegador; sólo
  funciona con la pestaña abierta y el teléfono desbloqueado (no hay
  tracking en segundo plano — eso requeriría una app nativa, fuera de
  alcance).
- Geocodificación de domicilios vía Nominatim/OpenStreetMap (gratis, sin
  tarjeta ni API key) — igual que los mapas, que usan Leaflet +
  OpenStreetMap, no Google Maps.
- Privacidad por diseño: el teléfono del técnico sólo lo ve el cliente
  que lo tiene asignado en un pedido activo; el DNI de verificación del
  técnico nunca se muestra al cliente (se usa una selfie en su lugar);
  el perfil público de un técnico (promedio, cantidad de trabajos,
  reseñas) no incluye teléfono ni ubicación.
- Español (Argentina) únicamente — sin soporte multi-idioma.
- Notificaciones push web (sin app nativa) para avisos de progreso del
  pedido.

## Brand Commitments

- Nombre: **Nora**. Isotipo de casa con techo a dos aguas.
- Wordmark del logo en DM Serif (con peso editorial/cálido); el resto de
  la interfaz usa Sora para títulos e Inter para texto de cuerpo.
- Paleta ancla: verde azulado profundo (`#0e5c54` / `#14857a`) sobre un
  fondo cálido tipo arena (`#f2f0ea`), nunca blanco puro ni gris frío —
  transmite algo más cercano a "de confianza y prolijo" que a "tech
  frío".
- Navegación por hojas inferiores (bottom sheets) sobre un marco de
  teléfono, no páginas de pantalla completa para acciones secundarias.

## Evidence on Hand

- Catálogo real de categorías de servicio y tarifas ya cargado en la
  base (`db/`), sin datos de ejemplo inventados.
- **Cliente: sin cuentas.** El middleware (`web/src/lib/supabase/middleware.ts`)
  crea una sesión anónima real de Supabase (`auth.uid()` real, RLS
  funciona igual) apenas alguien entra a cualquier pantalla de cliente
  — nunca ve un login ni se registra. `/entrar` (email/contraseña)
  existe en el código pero sólo es alcanzable desde rutas que exigen
  cuenta real (`/operaciones`, `/cambiar-clave`); no es parte del
  camino de un cliente. Las credenciales de prueba que estaban acá
  antes (`noraprueba1@gmail.com`, etc.) quedaron de una versión previa
  del producto y ya no sirven para nada del lado cliente — verificar
  de nuevo antes de asumir que alguna cuenta de operaciones/técnico
  sigue viva.
- Sin testimonios, casos de estudio ni prensa todavía — la app no
  lanzó. No inventar ninguno.

## Product Principles

1. **La confianza se demuestra, no se declara.** Cada pantalla que
   involucra al técnico (perfil, seguimiento, código de cierre) existe
   para que el cliente sienta que sabe con quién está tratando, no para
   decorar.
2. **Todo pasa adentro de Nora.** Si una decisión de diseño empuja al
   usuario a WhatsApp o a una llamada para resolver algo que la app
   debería resolver, es un defecto, no un atajo aceptable.
3. **El primer pedido es el producto entero.** La mayoría de las
   decisiones de priorización de esta recta final se juzgan por si
   mejoran el camino entrar → pedir → ver al técnico llegar → cerrar
   con código, porque ese es el momento que un usuario nuevo recuerda y
   cuenta.
4. **Mobile real, no mobile-friendly.** Se diseña para el celular en la
   mano con el problema ya pasando, no para una ventana angosta de
   escritorio.
5. **Lo interno no compite con lo público, pero tampoco puede
   avergonzar.** Los paneles de técnico y operaciones no reciben el
   mismo nivel de pulido que las pantallas de cliente, pero deben
   funcionar sin fricción — ahí también hay personas reales trabajando.

## Accessibility & Inclusion

Sin requisito de accesibilidad específico confirmado por el usuario más
allá del estándar WCAG AA general (contraste, navegación por teclado,
lectores de pantalla) que ya aplica a cualquier producto de cara al
público.
