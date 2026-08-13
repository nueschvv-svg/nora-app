# Nora — Auditoría del prototipo y plan de lanzamiento

Fecha: 13 de agosto de 2026
Alcance auditado: `index.html` (1193 líneas, 111 KB), `nora-app/index.html`, assets de imagen.

---

## 1. Qué es Nora hoy, sin vueltas

Es **una maqueta de una sola pantalla HTML**. Muy bien hecha estéticamente, pero no es una app: no guarda nada, no se conecta a nada, no tiene usuarios y no tiene servidor.

Dato duro de la auditoría: el archivo tiene **0 llamadas de red, 0 `localStorage`, 0 `fetch`**. Todo lo que ves está escrito a mano en el HTML. Si refrescás la página, todo vuelve al estado inicial. Si dos personas la abren, ven exactamente lo mismo.

Eso no está mal — un prototipo sirve para eso. Pero significa que **para lanzar no hay que "terminar" esto: hay que construir el sistema desde cero, usando esto como especificación de diseño.** Es tu mejor activo: define exactamente cómo se tiene que ver y sentir el producto. Ese trabajo ya está hecho y es bueno.

---

## 2. Auditoría técnica

### 2.1 Lo que es simulado (y hoy parece real)

| Qué parece | Qué es en realidad | Dónde |
|---|---|---|
| Chat con IA "Nora" | `setTimeout` de 850 ms que responde siempre lo mismo. **Ignora por completo lo que escribís.** | `index.html:1072-1080` |
| Chat con Marcos / Sofía | Buscador de palabras clave con `includes()`. 6 respuestas fijas cada uno. | `index.html:1113-1132` |
| Mapa con el técnico en vivo | SVG dibujado a mano con calles inventadas + `<animateMotion>` de 6 s en loop infinito. Sin GPS. | `index.html:521-552` |
| Presupuesto "USD 48" | Texto literal escrito en el HTML. No hay motor de precios. | `index.html:459` |
| Pago con Visa ···· 4821 | Un botón que se pone verde. No cobra nada. | `index.html:495` |
| Score de salud 73/88/64 | Tres números inventados en un array. Sin fórmula. | `index.html:841-874` |
| Historial (28 servicios, USD 940) | HTML estático. No viene de ninguna base de datos. | `index.html:250-290` |
| "Llega en ~18 min" | Texto fijo. Nunca cambia. | `index.html:221` |

### 2.2 Problemas técnicos concretos

**Bloqueantes para producción:**

1. **Tailwind por CDN** (`cdn.tailwindcss.com`, línea 12). La propia documentación de Tailwind dice explícitamente que esto no es para producción: descarga ~3 MB de JavaScript y compila el CSS en el navegador del usuario cada vez que abre la app. En un celular con 4G en Argentina, eso es una eternidad. Hay que pasar a un build real.

2. **Lucide sin versión fijada** (`unpkg.com/lucide@latest`, línea 11). Estás apuntando a "la última versión, la que sea". El día que Lucide publique un cambio incompatible, tu app se rompe sola sin que toques nada. Y si unpkg.com se cae, se caen todos los íconos.

3. **Sin control de versiones.** La carpeta no es un repositorio git. No hay historial, no hay forma de volver atrás, no hay backup. Si borrás el archivo, perdiste todo. Esto se arregla en 2 minutos y es lo primero que hay que hacer.

4. **Dato personal expuesto:** el email `matiasvaldivia81@gmail.com` está escrito en el HTML (línea 339), junto con fotos reales de personas (`mati.jpg`, `tecnico.jpg`, `arquitecta.jpg`). Si eso es una persona real, sacalo antes de publicar en cualquier lado.

5. **Zoom bloqueado** (línea 5: `maximum-scale=1.0, user-scalable=no`). Impide que alguien con problemas de visión agrande el texto. Es una falla de accesibilidad (WCAG 1.4.4) y en algunas jurisdicciones es exigible. Hay que sacarlo.

**Importantes:**

6. **Sin navegación real.** La función `go()` (línea 927) solo esconde y muestra divs. No hay URLs, no hay historial del navegador, no hay links compartibles. En Android, el botón "atrás" del sistema **cierra la app** en vez de volver a la pantalla anterior. Es de las cosas que más molestan a un usuario.

7. **`100vh` / `h-screen`** (3 usos). En Safari de iPhone la barra de direcciones tapa el contenido de abajo — la barra de navegación inferior queda parcialmente oculta. Se resuelve con `dvh`.

8. **Riesgo de XSS.** Hay 15 usos de `innerHTML`. El chat escapa solo el carácter `<` (línea 1084) y nada más. Hoy no importa porque el texto es tuyo; el día que un técnico te mande un mensaje, es una puerta abierta para inyectar código en la sesión del cliente.

9. **Assets sin optimizar.** `mati.jpg` pesa 671 KB para mostrarse en un círculo de 40×40 píxeles. Hay `nora-app.zip` (776 KB) y dos `.jpeg` duplicados en la carpeta. La app arranca descargando ~1,7 MB de más.

10. **No hay nada de PWA:** sin `manifest.json`, sin service worker, sin favicon, sin íconos, sin meta tags para compartir en WhatsApp (Open Graph). Si alguien manda el link, aparece en blanco.

11. **Sin monitoreo.** Cero analytics, cero reporte de errores. El día que salga, no vas a tener forma de saber si algo se rompió ni cuánta gente lo usó.

### 2.3 Lo que está bien y hay que conservar

- El sistema de diseño está definido y es coherente: paleta, tipografías (Sora / Inter / DM Serif), sombras, radios de borde (líneas 14-29). Eso se traduce directo a un `tailwind.config` real.
- Los flujos están pensados de punta a punta, con validaciones por paso (`stepValid`, línea 1005). Alguien pensó el producto, no solo las pantallas.
- Los estados vacíos, urgentes y "todo al día" ya están contemplados por propiedad. Eso normalmente falta.
- El logo animado y el splash le dan personalidad. Se reusan tal cual.

---

## 3. Auditoría de producto: lo que falta para que sea un negocio

Este es el punto más importante de toda la auditoría, y no es técnico.

**Nora es un marketplace de dos lados.** El prototipo muestra **un solo lado** (el cliente) y **un solo camino** (todo sale bien). Falta la mitad del producto y todos los casos donde algo se complica.

### 3.1 No existe el lado de la oferta

No hay ninguna pantalla para el técnico. Y sin técnicos, la app del cliente no vale nada. Falta por completo:

- App/panel del técnico: recibir pedidos, aceptar o rechazar, ver la dirección, marcar "llegué", "terminé", cargar el reporte y las fotos, cobrar.
- Alta y verificación de técnicos: DNI, matrícula (para gas y electricidad **es obligatoria por ley**), seguro de responsabilidad civil, antecedentes, cuenta bancaria/CBU para cobrar.
- Panel de operaciones tuyo: ver todos los pedidos en vivo, asignar a mano, intervenir cuando algo falla, resolver disputas, cargar reembolsos.

**Sin panel de operaciones no podés lanzar.** No es opcional ni "fase 2". Es donde vas a vivir el primer año.

### 3.2 Casos que el prototipo no contempla

El flujo de "Pedir" tiene 7 pasos y todos salen bien. En la realidad:

- Ningún técnico acepta el pedido (¿qué le mostrás al cliente? ¿cuánto espera?)
- El técnico acepta y después cancela
- El técnico no aparece
- El cliente no está en la casa cuando llega el técnico
- El trabajo era más grande de lo presupuestado (**esto rompe el "precio fijo"**)
- Hace falta un material que no estaba previsto
- El cliente dice que quedó mal hecho → disputa
- El cliente quiere cancelar 10 minutos antes
- La dirección está fuera de tu zona de cobertura
- Es domingo a las 3 AM
- El pago rebota o el cliente hace un contracargo
- La garantía de 30 días se activa: ¿quién vuelve, y quién paga?

Cada uno de estos necesita una pantalla, una regla de negocio y una política. Hoy no existe ninguno.

### 3.3 Tres promesas del prototipo que hay que resolver antes de construir

**a) "Precio fijo · todo incluido · sin sorpresas al terminar"**

Es tu mejor argumento de venta y el más difícil de cumplir. Para dar precio fijo necesitás saber cuánto cuesta cada tipo de trabajo, y eso solo se sabe con historial. Con 0 técnicos y 0 trabajos hechos, no lo tenés.

Si das precio fijo sin datos, cada trabajo que se complica lo pagás vos. Recomendación: arrancá con **"presupuesto confirmado antes de empezar"** (el técnico ve el problema, cotiza, el cliente aprueba) y pasá a precio fijo cuando tengas 100-200 trabajos de historial por categoría.

**b) El "Score de salud de la propiedad"**

Esto es lo más original que tiene Nora y lo que la diferencia de un simple "Uber de plomeros". Pero hoy son tres números inventados.

Para que sea real necesitás registrar los **equipos** de cada propiedad (calefón marca/modelo/año, aire acondicionado, tanque, tablero, matafuegos) y calcular el score a partir de: mantenimientos vencidos, antigüedad de los equipos, urgencias sin resolver. Esa base de datos de equipos es tu activo más valioso a largo plazo — es lo que te permite avisarle al cliente antes de que se le rompa algo, que es el negocio real.

**c) Los precios en pesos con inflación**

Definiste Argentina en pesos. Eso significa que **nada de precios hardcodeados**: los precios tienen que estar en base de datos y ser actualizables sin tocar código, idealmente indexados. El prototipo tiene "USD 48" escrito a mano; eso se convierte en una tabla de tarifas versionada.

---

## 4. Legal y regulatorio (Argentina)

Esto no es opcional y varias cosas tardan semanas, así que se arrancan en paralelo con el desarrollo, no al final.

| Tema | Qué hay que hacer | Urgencia |
|---|---|---|
| **Términos y condiciones + Política de privacidad** | Redactados por abogado. Sin esto no podés publicar. | Antes de lanzar |
| **Ley 25.326 (Datos Personales)** | Inscripción de la base de datos, consentimiento explícito, derecho de acceso y borrado. | Antes de lanzar |
| **Ley 24.240 (Defensa del Consumidor)** | Botón de arrepentimiento obligatorio, información clara de precio y condiciones. | Antes de lanzar |
| **Matrículas de gas y electricidad** | Trabajos de gas requieren gasista matriculado. Si mandás a alguien sin matrícula y pasa algo, la responsabilidad es tuya. | Crítico |
| **Seguro de responsabilidad civil** | Un plomero que inunda un departamento genera un reclamo de millones. Necesitás cobertura propia y exigirla a los técnicos. | Crítico |
| **Relación laboral vs. contratista** | **El riesgo más grande del modelo.** Si controlás horarios, precios y forma de trabajo, un juez laboral argentino puede considerar a los técnicos empleados en relación de dependencia. Consultá con un laboralista **antes** de definir cómo funciona el matching. | Antes de diseñar el sistema |
| **Facturación (ARCA/AFIP)** | Facturación electrónica, IVA, retenciones. Definir si facturás vos el servicio completo o solo la comisión. | Antes de cobrar |
| **Marca "Nora"** | Registro en INPI. Verificá antes que esté libre en clase 37 y 42. | Cuanto antes |
| **Sociedad** | SAS o SRL. Necesaria para abrir cuenta de Mercado Pago comercial. | Antes de cobrar |

---

## 5. La decisión más importante: recortar el alcance

Estás solo, con Claude Code, sin técnicos todavía. Si intentás construir todo lo que muestra el prototipo, son entre 8 y 12 meses y hay altísima probabilidad de que abandones antes de tener el primer cliente.

**Recomendación fuerte: no construyas la app completa. Construí lo mínimo para que un servicio real ocurra de punta a punta, y hacé el resto a mano.**

### Sacar del MVP (queda para después, no se tira)

| Función | Por qué se saca |
|---|---|
| **Obras** (proyectos grandes, arquitecta, avance %) | Es un producto distinto, con otro ciclo de venta. Solo lo pediría el 2% de tus usuarios. |
| **Nora Seguro Hogar** | Es un producto de seguros. Requiere aliado asegurador y regulación propia. |
| **Beneficios / partners (Pinturas Rex, drones)** | No tenés tráfico para negociar con nadie todavía. |
| **Referidos / código NORATEAYUDA** | Sirve cuando ya tenés usuarios contentos. Antes es ruido. |
| **Múltiples domicilios** | Arrancá con uno por usuario. Se agrega en 2 días cuando alguien lo pida. |
| **Chat con IA para triage** | En el MVP, el "chat con Nora" sos vos por WhatsApp. |
| **Tracking en vivo en mapa** | Reemplazalo por estados ("confirmado / en camino / llegó / trabajando / listo") + notificación. El 90% del valor, el 5% del trabajo. |
| **Pago dentro de la app** | Fase 2. Al principio, link de pago de Mercado Pago enviado al terminar. |

### Queda en el MVP

- Registro / login
- Alta de **una** propiedad con sus equipos (calefón, A/A, tanque, tablero)
- Pedido de servicio: categoría + descripción + fotos + cuándo
- Estados del pedido visibles para el cliente, con notificación en cada cambio
- Reporte del trabajo + calificación
- Historial
- Score de salud con **fórmula real** sobre los equipos cargados
- Próximos mantenimientos calculados de verdad
- **Panel de operaciones** (tuyo): ver pedidos, asignar técnico a mano, cambiar estados, cargar el reporte

El matching lo hacés vos, desde el panel, con WhatsApp. Eso se llama "MVP concierge" y es como arrancaron casi todos los marketplaces que hoy funcionan. Te permite validar el negocio en **6-8 semanas** en vez de 8 meses, y aprender los precios reales antes de automatizar nada.

---

## 6. Arquitectura recomendada

Elegiste **web primero, app nativa después**, en pesos argentinos, construyendo solo. Esto es lo que recomiendo:

```
Cliente (web, mobile-first)
   Next.js 15 + React + TypeScript + Tailwind (build real, no CDN)
   → PWA instalable desde el navegador
   → después se empaqueta a iOS/Android con Capacitor, reusando el mismo código

Panel de operaciones (vos)
   Next.js, misma base de código, ruta /admin protegida por rol

Backend
   Supabase: PostgreSQL + Auth + Storage (fotos) + Realtime + RLS
   → te ahorra 2-3 meses de backend a mano
   → RLS (Row Level Security) hace que un cliente no pueda ver datos de otro

Pagos
   Mercado Pago (Checkout Pro al principio, Marketplace/split después)
   → split te permite cobrar tu comisión automáticamente y pagarle al técnico

Notificaciones
   Email (Resend) + WhatsApp Business API (en Argentina es EL canal)
   → Push cuando pases a app nativa

Errores y analítica
   Sentry (errores) + PostHog (comportamiento). Gratis en el tier de arranque.

Hosting
   Vercel (deploy automático desde git, dominio propio, HTTPS)
```

**Por qué Next.js y no seguir con HTML plano:** necesitás URLs reales, autenticación, datos del servidor y componentes reutilizables. Con HTML plano cada pantalla nueva es copiar y pegar 200 líneas.

**Por qué Supabase:** es la única forma realista de que una sola persona tenga base de datos, login, permisos, subida de fotos y tiempo real funcionando en semanas y no en meses.

**Por qué Capacitor y no rehacer en React Native:** al elegir "web primero, app después", Capacitor te deja empaquetar la misma web como app nativa sin reescribir nada. Lo único que perdés es la ubicación en segundo plano — que ya sacamos del MVP.

---

## 7. Modelo de datos mínimo

Estas son las tablas que hay que crear. Es el esqueleto del sistema:

```
profiles              usuario (extiende auth de Supabase)
properties            domicilio: nombre, dirección, geo, tipo
assets                EQUIPO de una propiedad: calefón/AA/tanque/tablero,
                      marca, modelo, fecha_instalación, última_revisión
                      ← esta tabla es el corazón del Score y de la agenda

providers             técnico: datos, zona, estado (pendiente/verificado/suspendido)
provider_skills       categorías que atiende
provider_documents    DNI, matrícula, seguro, CBU + fecha de vencimiento
                      ← si vence la matrícula, no puede recibir trabajos de gas

service_requests      pedido: propiedad, categoría, descripción, fotos, urgencia,
                      ventana horaria preferida, estado
quotes                presupuesto: monto, desglose, vigencia, aprobado_por_cliente
jobs                  trabajo asignado: pedido + técnico + fechas reales
job_events            timeline auditable: cada cambio de estado, quién y cuándo
                      ← sin esto no podés resolver ninguna disputa
job_reports           qué se hizo, fotos antes/después, materiales

payments              cobro al cliente (ref. Mercado Pago)
payouts               pago al técnico + comisión retenida
reviews               calificación y comentario
warranties            garantía activa: job, fecha_vencimiento, reclamos
maintenance_plans     próximo mantenimiento por asset, calculado
notifications         qué se le mandó a quién y por qué canal
price_book            tarifas por categoría y zona, versionadas por fecha
                      ← indispensable con inflación
```

**Fórmula del Score** (propuesta inicial, se calibra con datos reales):

```
score = 100
      − 15 × (mantenimientos vencidos)
      −  8 × (urgencias sin resolver)
      −  5 × (equipos sin fecha de última revisión)
      −  3 × (equipos con más de 10 años sin recambio)
      +  5   si todos los mantenimientos están al día
  acotado entre 0 y 100
```

Lo importante no es la fórmula exacta, es que sea **explicable**: el usuario tiene que poder tocar el score y ver por qué le da 73.

---

## 8. Plan por fases

### Fase 0 — Fundaciones (semana 1)
Sin código de producto todavía.
- [ ] `git init` + repositorio en GitHub. **Hoy mismo.**
- [ ] Sacar el email real del HTML, borrar `nora-app.zip` y las imágenes duplicadas
- [ ] Cuentas: Supabase, Vercel, Sentry, Mercado Pago (cuenta de prueba)
- [ ] Dominio + verificar la marca "Nora" en INPI
- [ ] Primera consulta con abogado (laboralista + defensa del consumidor)
- **Listo cuando:** el prototipo está versionado y hay cuentas creadas.

### Fase 1 — Conseguir 10 técnicos (semanas 1-4, EN PARALELO)
Esta es la fase que decide si el negocio existe. Va en paralelo con todo lo demás.
- [ ] Definir zona única de arranque (ej: solo Tigre, o solo un partido)
- [ ] Definir 3-4 categorías, no 15. Sugerencia: plomería, electricidad, cerrajería
- [ ] Conseguir y verificar 10 técnicos: matrícula, seguro, referencias
- [ ] Acordar comisión y forma de pago con ellos
- [ ] Grupo de WhatsApp para despachar pedidos a mano
- **Listo cuando:** 10 técnicos verificados responden un mensaje tuyo en menos de 30 minutos.

### Fase 2 — Base técnica (semanas 2-4)
- [ ] Proyecto Next.js + TypeScript + Tailwind con el diseño del prototipo migrado
- [ ] `tailwind.config` con la paleta y tipografías ya definidas (líneas 14-29 del prototipo)
- [ ] Supabase: esquema de tablas + políticas RLS
- [ ] Login (email + Google)
- [ ] Deploy en Vercel con dominio propio
- **Listo cuando:** podés registrarte, entrar, y ver la pantalla de inicio con tus datos reales.

### Fase 3 — MVP concierge (semanas 5-8)
- [ ] Alta de propiedad + carga de equipos
- [ ] Score de salud calculado de verdad, explicable
- [ ] Pedido de servicio con fotos
- [ ] Panel de operaciones: lista de pedidos, asignación manual, cambio de estados
- [ ] Notificaciones por email + WhatsApp en cada cambio de estado
- [ ] Reporte del trabajo + calificación
- [ ] Historial
- [ ] Cobro con link de Mercado Pago generado desde el panel
- **Listo cuando:** un vecino que no conocés pide un servicio, se lo resolvés, paga, y califica — sin que vos toques la base de datos a mano.

### Fase 4 — Primeros 50 servicios (semanas 9-16)
No agregues funciones. Vendé. Aprendé precios reales, tiempos reales, qué se rompe.
- [ ] 50 servicios completados
- [ ] Tabla de precios real por categoría con datos propios
- [ ] Los 5 problemas operativos más frecuentes, documentados y resueltos
- **Listo cuando:** sabés cuánto sale en promedio cada categoría y cuánto tardás en conseguir técnico.

### Fase 5 — Automatizar y escalar (mes 5+)
Recién acá:
- [ ] App del técnico
- [ ] Matching automático
- [ ] Pago dentro de la app con split de comisión
- [ ] Precio fijo (ya con datos que lo respalden)
- [ ] Empaquetado a iOS/Android con Capacitor
- [ ] Chat con IA para triage (Claude API)
- [ ] Después: Obras, seguros, beneficios

---

## 9. Riesgos principales

| Riesgo | Impacto | Cómo se mitiga |
|---|---|---|
| **Construir la app antes de tener técnicos** | Fatal. App perfecta, cero servicios. | Fase 1 en paralelo desde el día 1. Es la fase que manda. |
| **Reclamo laboral de un técnico** | Puede terminar el negocio. | Laboralista antes de diseñar el matching. Contratos claros. No controlar horarios ni exclusividad. |
| **Un trabajo mal hecho con daño material** | Reputacional y económico grave. | Seguro propio + seguro exigido al técnico + matrícula verificada + garantía con fondo previsto. |
| **Precio fijo que no cubre el costo** | Pérdida en cada trabajo complicado. | Presupuesto confirmado hasta tener 100+ trabajos por categoría. |
| **Inflación desactualiza los precios** | Márgenes en negativo sin darte cuenta. | Tabla de precios en base de datos, versionada, revisada mensualmente. |
| **Alcance infinito (el prototipo promete mucho)** | Nunca lanzás. | El recorte de la sección 5. Obras y seguros son año 2. |
| **Estás solo** | Bloqueo o abandono. | Fases cortas con un resultado usable al final de cada una. |

---

## 10. Qué hacemos ahora

En orden, y lo primero se hace hoy:

1. **`git init` + GitHub.** Ahora mismo. Sin esto, cualquier error borra meses de trabajo.
2. **Limpiar el prototipo:** sacar el email real, borrar el zip y los duplicados, comprimir las imágenes.
3. **Definir la zona y las 3 categorías de arranque.** Una decisión tuya, de negocio, no técnica.
4. **Empezar a buscar técnicos.** Es lo que más tarda y no depende de código.
5. **Arrancar el proyecto Next.js + Supabase** con el diseño ya migrado.

Los pasos 1, 2 y 5 los puedo hacer con vos ahora. El 3 y el 4 son decisiones y trabajo tuyo, y son los que definen si esto sale.
