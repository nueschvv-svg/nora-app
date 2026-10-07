# Sector 15: archivo histórico conectado, situaciones y limpieza del recorrido

Continuación del bloque de unidad/Telegram del 05/10. Base: `5136529`.
Precios pospuestos por decisión del usuario; no se implementaron tarifas y
ningún pedido se bloquea por no tener precio.

## 1. El archivo de ENJINIA alimenta el análisis

**Migración `49_catalogo_eba.sql`**, generada por script desde
`catalogo_nora_sector15.csv`: 132 filas literales, sin casos inventados.
Crea `catalogo_eba` con RLS, lectura pública (no tiene datos personales ni
unidad identificable) y sin escritura para `anon`/`authenticated`. La
columna `familia` tiene CHECK contra las nueve familias y la migración
verifica el conteo antes de confirmar. Es repetible.

Agrega además **`humedad` como fila real de `categorias`**, no como
hardcode de interfaz. Era el rubro más frecuente del trabajo real y no
existía en el producto.

### Por qué el matcheo es por familia y no por caso exacto

Sobre el archivo completo hay **2.512 desperfectos distintos** y los **250
más frecuentes cubren el 39%**. Buscar el caso idéntico falla la mayoría de
las veces. Las nueve familias, en cambio, cubren el 100%. Por eso la
clasificación es en dos pasos: familia primero, antecedentes de esa familia
después.

**Sin base vectorial ni RAG:** 132 filas entran en el prompt. Una base
vectorial acá sería infraestructura para un problema que no existe.

### Validación del lado servidor

`web/src/lib/antecedentes.ts` es puro (sin `server-only`) para poder
probarlo con el runner de Node. Lo que devuelve el modelo pasa por la misma
puerta que cualquier entrada de usuario:

- la familia se valida contra el enum y se descarta si no tiene
  antecedentes cargados;
- cada antecedente se busca por id en las filas reales; un id inventado,
  repetido o de otra familia se descarta en el servidor, con aviso en el
  log, y **no llega nunca a la pantalla**;
- una familia que exista en la base pero no en el código se ignora en vez
  de propagarse.

El prompt le dice explícitamente al modelo que los antecedentes son
orientación y no diagnóstico, que Nora no hace inspecciones ni entra al
departamento, y que las tareas del archivo son reparaciones profesionales
de ENJINIA, no instrucciones de bricolaje.

### Los cuatro puntos de entrada

Chat de inicio (`/api/chat` → `chatNora.ts`), `/pedir`, análisis de texto y
análisis de fotos (`/api/diagnosticar` → `diagnostico.ts`). Los cuatro usan
el mismo catálogo y la misma validación; ninguno conserva la lógica previa.
El traspaso del chat al pedido ya reanalizaba con el texto completo del
residente, así que los antecedentes se recalculan ahí con todo el contexto.

Si el modelo falla, el pedido sigue: el error se muestra como error y nunca
como diagnóstico.

### Bug corregido

`descripcionPedido.ts` escribía `[Foto analizada por Nora]` siempre que
había observaciones, **también cuando el pedido había sido sólo texto**: le
afirmaba a ENJINIA que alguien miró una imagen que no existía. Ahora el
encabezado depende de si hubo fotos de verdad. La descripción persistida
lleva además los antecedentes elegidos, marcados como orientación.

## 2. Por qué está frenado un trabajo

**Migración `50_situacion_servicio.sql`.** Columnas `situacion` y
`situacion_nota` en `servicios`, con CHECK sobre tres valores:
`segunda_visita`, `administracion`, `materiales`.

**No son estados nuevos del enum, a propósito.** No son puntos del ciclo de
vida: son motivos por los que el trabajo está frenado y pueden ocurrir
desde varios estados. Si fueran estados, al marcarlos se perdería dónde
estaba el pedido, que es justo el dato que después hace falta para
retomarlo. En el archivo de ENJINIA el **28%** de los casos queda
«PENDIENTE TERMINACION», con el trabajo ya empezado.

**No se redefinió `solo_permitir_cancelar()`.** Su lista positiva congela
por defecto toda columna nueva, así que el residente no puede escribir
`situacion` sin tocar nada. Reescribir ese trigger era el riesgo, no la
solución. Hay un test que comprueba que el residente recibe el rechazo.

La bitácora **sí** se extendió, partiendo de la versión realmente aplicada
(`db/39`, que ya había sacado la rama de técnico de `db/12`) y sumando una
rama. Un test verifica que la rama de estado siguió viva y que no se
duplican ni se pierden eventos. Un cambio de situación registra el mismo
estado en ambas columnas para **no falsear una transición que no ocurrió**.

Un pedido cerrado se destraba solo: quedar marcado como frenado después de
terminado sería mentirle al residente en su pantalla de seguimiento.

## 3. Recorrido nacional retirado

- **Nominatim/geocodificación eliminada.** La ruta `/api/geocodificar` ya no
  existe y `crearPropiedad` no la llama. En el Sector 15 la dirección es
  fija y canónica, la pone la base desde el edificio. Nominatim servía a la
  bolsa de técnicos por distancia, que ya no existe: mandarle la dirección
  de un residente a un servicio externo sin que nadie use el resultado era
  un dato personal viajando para nada.
- **Manifest corregido.** Decía «Técnicos verificados y presupuesto claro»:
  dos promesas de otro producto, porque no hay técnicos externos y el precio
  lo confirma ENJINIA después.
- La rama genérica del wizard (calle/altura/localidad) ya era inalcanzable:
  `/pedir` abre Sector 15 por defecto. Se dejó en su lugar en vez de
  reescribir un archivo de 1.600 líneas sin necesidad.

## 4. Entorno y evidencia

**Migraciones aplicadas en staging Nora EBA (`ccccntecmouklhdvbqjp`)**,
nunca en producción. Respaldo previo del esquema en
`/tmp/nora-staging-before-49.sql`.

Verificado contra Supabase real después de migrar: 132 filas, 9 familias,
`humedad` activa, dos columnas de situación, RLS habilitada en
`catalogo_eba`, los 8 pedidos QA previos intactos, `anon` lee el catálogo y
**no** puede escribirlo.

**Suite:** 60 tests, 59 pasan, 1 opcional de PostgreSQL omitido. Lint y
build correctos. Se retiraron 4 tests de la ruta de geocodificación junto
con la ruta.

## 5. Bloqueos externos, con su causa real

1. **Anthropic devuelve `HTTP 401 invalid x-api-key`.** No es saldo
   insuficiente, como decía el reporte anterior: la clave de
   `web/.env.local` es inválida o fue revocada. Comprobado con una llamada
   mínima a `/v1/messages`. **Nada del matcheo se probó contra el modelo
   real.** La validación de servidor sí está probada, con casos de ids
   inventados, de otra familia y repetidos; eso es lógica propia, no el
   modelo.
2. **GHSA de braces: no existe parche.** `braces@3.0.3` es la última
   publicada y `micromatch@4.0.8` y `fast-glob@3.3.3` —ambas últimas— siguen
   dependiendo de ella. Lo único que ofrece npm es bajar
   `eslint-config-next` de 16.3.5 a 14.2.35, un downgrade mayor incompatible
   con Next 16. No se hizo ni se silenció. Es dependencia sólo de
   desarrollo; `npm audit --omit=dev` da cero.

## 6. Cron periódico: dónde quedó exactamente

`pg_net` y `pg_cron` **instalados** en staging (antes no estaban: sólo
figuraban como disponibles). Secretos `nora_app_url` y `nora_cron_secret`
cargados en Vault desde la configuración local, sin imprimirlos. Job
`nora-avisos-telegram` programado cada minuto y **activo**.

Verificado contra el entorno real:

- `cron.job_run_details`: `succeeded`. El scheduler dispara solo, **sin
  ninguna pestaña abierta**.
- `net._http_response`: la base sale a internet y alcanza Vercel.
- **Pero la respuesta es `401` con cuerpo `{"error":{"message":"Protected
  deployment"}}`.** Ese 401 lo devuelve **Vercel**, no la ruta: el preview
  tiene Deployment Protection y el pedido no llega a la app.

Esto es fácil de confundir —una llamada previa con `curl` devolvió 302 y
otra 401— así que conviene fijarlo: **un 401 con ese cuerpo es de Vercel; un
401 sin ese cuerpo sí es de la ruta y significa que el secreto no coincide.**

`db/operacion/activar_cron_avisos.sql` ahora soporta un tercer secreto
opcional, `nora_vercel_bypass`. Si está presente, el job agrega el header
`x-vercel-protection-bypass` y atraviesa la protección sin desactivarla.

**Lo único que falta** es crear ese token en Vercel → Project → Settings →
Deployment Protection → Protection Bypass for Automation, y guardarlo en
Vault con ese nombre. El job ya está programado: cuando el secreto exista,
empieza a funcionar sin tocar nada más. No se desactivó la protección ni se
cambió ninguna configuración del hosting, y no había CLI de Vercel ni token
en este entorno para hacerlo.

En producción, que no tiene Deployment Protection, ese secreto no hace falta.

**No se envió ningún mensaje real de Telegram en este bloque** y no se
reintentaron avisos de pedidos viejos.

## 7. Recorrido real en navegador, y dos bugs que sólo aparecieron ahí

Servidor local contra **staging Nora EBA**, a 375×812 y en escritorio.

**Bug 1 — el rubro nuevo rompía el análisis.** `humedad` no tiene filas en
`catalogo_trabajos`, así que `diagnosticar()` cortaba antes de llamar al
modelo y la persona veía «Todavía no tenemos trabajos cargados para ese
rubro» **en el lugar del diagnóstico**: un mensaje interno presentado como
análisis, y además ignorando los 15 antecedentes reales que sí tenemos para
humedad. Ahora sólo se rinde si no hay ni trabajos ni antecedentes, y el
prompt le dice al modelo que se concentre en familia y antecedentes cuando
no hay catálogo tarifado.

**Bug 2 — un rubro interno visible para el residente.** El wizard listaba
también los rubros inactivos, en gris con un cartel «PRONTO», y así
aparecía «QA aislamiento staging» en la pantalla del vecino. Ese patrón
tenía sentido en una app nacional con una hoja de ruta de rubros por abrir;
acá no hay tal hoja de ruta. `listarCategorias` ahora filtra por activa.

**Recorrido completo verificado**, pedido QA `#1017`
(`7799ef62-89a8-4ec4-a217-f94c480a096a`):

- Categoría «Humedad y filtraciones» disponible como rubro real.
- El análisis falla por la clave de Anthropic y **se muestra como error, en
  rojo, no como diagnóstico**; «Continuar» queda habilitado y el pedido se
  completa igual.
- Contacto sin calle ni altura; dirección canónica del predio.
- Núcleo 15-2 / piso 1 ofrece **sólo B, C, D, E** — la excepción del primer
  piso sale del catálogo, no de una fórmula.
- Unidad B → **UF 2226**, el valor correcto según el CSV.
- En la base: `sector15_uf=2226`, `piso=1`, `unidad=B`,
  **`latitud` y `longitud` en NULL** (geocodificación retirada), y el aviso
  quedó encolado `pendiente`.
- Migración 50 probada **contra Supabase real**, no sólo en PGlite: marcar
  `materiales` dejó el estado en `solicitado` y registró
  «Esperando materiales. QA - no realizar trabajo» sin inventar una
  transición. Al cancelar, la situación se limpió sola.
- Pedido QA cancelado y su aviso retenido como `fallido` para que no llegue
  al operador.

Escritorio y 375×812 sin desborde horizontal.

**Lo que esto NO prueba:** que el matcheo funcione. La clasificación en
familia y la elección de antecedentes la hace el modelo, y el modelo no
respondió ni una vez en todo el bloque. Lo probado es la validación de
servidor, el recorrido y la persistencia.

## 8. CI

Fallaba —ya antes de este bloque— en un único paso: `npm audit
--audit-level=high`, por el GHSA de braces. Como ese paso corría antes del
build, **el build nunca llegaba a ejecutarse en CI**.

Se separó en dos pasos, sin silenciar nada:

- **bloqueante:** `npm audit --omit=dev --audit-level=high`. Lo que se
  despliega tiene que estar limpio, sin excepciones. Hoy da cero.
- **informativo:** la auditoría completa, que se sigue imprimiendo en cada
  corrida pero no frena el release.

El criterio: no tiene sentido bloquear indefinidamente por una
vulnerabilidad **sin parche disponible**, en una dependencia de desarrollo,
que no viaja al navegador de ningún residente. Un CI permanentemente rojo
por algo que nadie puede arreglar enseña a ignorar el CI. La alerta sigue
visible en cada corrida y en Dependabot. **Volver a hacerlo bloqueante en
cuanto exista versión parcheada de braces.**
