# Prompt de cierre — para pegar en ChatGPT

Seguís trabajando sobre NORA, rama `codex/auditoria-piloto`, en
`/Users/valentinnuesch/Documents/ChatGPT/enji/nora-app`.

El bloque de matcheo histórico, situaciones y limpieza del recorrido **ya está
implementado y pusheado** (commits `e78d420` a `e0deab6`). No lo rehagas.
Leé primero, en este orden:

1. `~/.claude/projects/-Users-valentinnuesch-Claude-Projects-Nora-APP/memory/MEMORY.md`
   y los archivos que indexa, en especial la sección Piloto EBA / ENJINIA.
2. `docs/piloto/sector15/MATCHEO-Y-ESTADOS-2026-10-05.md` — qué se hizo, qué
   se verificó y con qué evidencia.
3. `docs/piloto/sector15/UNIDAD-Y-TELEGRAM-2026-10-05.md` y
   `LECTURA-Y-PRECONDICIONES.md`.

Contame brevemente qué entendiste y seguí. No vuelvas a auditar lo que ya
está documentado como verificado.

## Estado real

- Migraciones 44–50 aplicadas **sólo en staging Nora EBA**
  (`ccccntecmouklhdvbqjp`). Producción (`copgcabmvndbgbxqvdjw`) **sigue en ~43**
  y no recibió nada.
- `catalogo_eba` con 132 antecedentes reales, `humedad` como categoría activa,
  columnas `situacion`/`situacion_nota` en `servicios`.
- CI en verde. 60 tests, lint y build correctos.
- pg_cron y pg_net instalados en staging; el job `nora-avisos-telegram` corre
  cada minuto y dispara solo.
- Precios **pospuestos** por decisión del usuario. No implementes tarifas ni
  bloquees ningún pedido por falta de precio.

---

# Dónde me frené, y qué observé exactamente

Son dos cosas. En las dos describo **sólo lo que medí**. No asumas que mi
lectura de la causa es correcta: puede haber configuración, credenciales o
entornos que yo no veo desde donde estaba trabajando. Averiguá vos qué está
pasando antes de cambiar nada.

## 1. El modelo de Anthropic no respondió nunca

**Lo que hice:** leí `ANTHROPIC_API_KEY` de `web/.env.local` (64 caracteres) y
mandé una llamada mínima:

```
POST https://api.anthropic.com/v1/messages
model claude-opus-5, max_tokens 16
```

**Lo que recibí, textual:**

```
HTTP 401
{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CfjHntKqtMy2uwuh2AvxB"}
```

Lo mismo se ve desde la app: al pedir el análisis, la ruta devuelve 502 y la
pantalla muestra el error (correctamente, como error y no como diagnóstico).

**Lo que NO sé:** si esa clave está revocada, si es de otra cuenta, si está mal
copiada en ese archivo, si quedó con algún carácter de más, o si la que
realmente sirve está configurada en otro lugar —Vercel, otro `.env`, un gestor
de secretos, tu propia sesión— y `web/.env.local` simplemente quedó
desactualizado. No toqué ese archivo ni busqué credenciales fuera de él.

**Lo que te toca:** averiguar de dónde tiene que salir la clave buena para este
entorno y dejar el camino andando. Reportá qué era, porque conviene que quede
escrito.

## 2. El cron llega a Vercel pero Vercel lo rechaza

**Lo que verifiqué que SÍ funciona:**

- `cron.job_run_details` → `succeeded`. El scheduler dispara solo cada minuto,
  **sin ninguna pestaña abierta**.
- `net._http_response` → la base sale a internet y alcanza el host de Vercel.

**Lo que recibí al llegar:**

```
status_code 401
{"error":{"code":"401","message":"Protected deployment"},
 "access":"vercel curl <deployment-url>", ...}
```

Y con `curl` sobre el mismo preview, `GET /inicio` devuelve `302
Protected by Vercel Authentication`.

Es decir: el pedido **no llega a la app**. Lo corta la protección del
despliegue antes.

**Ojo con esto, que me confundió a mí:** hay dos 401 distintos. Uno con cuerpo
`"Protected deployment"` es de Vercel. Uno sin ese cuerpo es de nuestra propia
ruta `/api/cron/avisos` y significaría que el secreto no coincide. En una
medición anterior leí mal el primero y lo tomé por el segundo.

**Lo que NO sé:** cómo está configurada la protección de ese proyecto, si ya
existe algún mecanismo de acceso para automatizaciones, o si directamente el
destino correcto del cron debería ser otro entorno. No tenía CLI de Vercel ni
token en la máquina donde trabajé, así que no pude mirar la configuración del
proyecto ni cambiar nada ahí.

**Lo que dejé preparado:** `db/operacion/activar_cron_avisos.sql` acepta un
tercer secreto opcional en Vault, `nora_vercel_bypass`. Si existe, el job
agrega el header `x-vercel-protection-bypass` y atraviesa la protección sin
desactivarla. El job ya está programado y activo: si esa es la solución, con
cargar el secreto empieza a andar sin tocar nada más.

Pero elegí vos el camino. Si hay una forma mejor para este proyecto —otro
entorno, otra configuración— tomala y decime por qué.

---

# Lo que falta hacer

## Tarea 1 — Verificar el matcheo contra el modelo real

Es lo único que impide decir READY. Nunca se pudo probar. **No lo des por
bueno con mocks ni porque compile.**

Probá de punta a punta y mostrame la evidencia:

- «Tengo una mancha en el techo del baño y gotea cuando el de arriba se ducha»
  → tiene que caer en `humedad_filtracion` y mostrar antecedentes reales de
  ENJINIA, con sus textos del archivo.
- Algo de otra familia, por ejemplo «la puerta de entrada no cierra bien» →
  `aberturas_carpinteria`.
- Algo que no encaje en ninguna → sin antecedentes, sin forzar un parecido.
- Lo mismo desde el **chat de inicio**, no sólo desde `/pedir`.
- Una foto, para confirmar que el encabezado dice «Fotos analizadas» y que con
  sólo texto **no** lo dice.

Comprobá que Nora no afirme un diagnóstico como certeza ni diga que revisó
algo. Si en los textos reales aparece ese tono, corregí el prompt de
`web/src/lib/diagnostico.ts` y `chatNora.ts`, **no la validación**: esa
validación es la única barrera contra antecedentes inventados.

Confirmá que los antecedentes elegidos **llegan a Telegram y al detalle de
operaciones** dentro de la descripción persistida.

## Tarea 2 — Cerrar el cron

Una vez resuelto el acceso, verificá en `net._http_response` que la respuesta
sea **200**.

Probá el ciclo completo: creá un pedido QA, cerrá la pestaña antes de que
salga el aviso, y comprobá que el cron lo entrega solo. Marcá el mensaje
«QA — NO REALIZAR TRABAJO» y cancelá el pedido al terminar. No reintentes
avisos de pedidos viejos.

## Tarea 3 — Operaciones con una cuenta real

Entrá al panel con una cuenta de operaciones y recorré:

- marcar «esperando materiales» y comprobar que el pedido **no se mueve de
  estado** y que el residente ve el aviso en su seguimiento;
- destrabarlo;
- derivar a administración;
- que el historial registre cada cambio sin inventar transiciones.

La lógica ya está probada en PostgreSQL y contra Supabase real; lo que falta
es el recorrido de una persona por la pantalla.

## Tarea 4 — Producción

Sólo después de que 1, 2 y 3 estén verdes.

Inventariá el esquema real de producción antes de escribir nada, respaldá, y
aplicá **44 a 50 en orden**. No ejecutes `db/INSTALAR-TODO.sql` ni migraciones
históricas: hay scripts destructivos. 44, 45 y 48 no son repetibles; 46, 49 y
50 sí.

Recién ahí desplegá el código y configurá el cron contra producción.

## Cómo trabajar

Bloque por bloque, publicando cada uno verificado. Después de cada bloque
decime qué cambió, qué probaste y cómo.

No reportes algo como funcionando si sólo compila. Si algo queda bloqueado por
afuera, decime exactamente qué observaste —el error textual, no tu
interpretación— y qué hace falta. Cerrá READY sólo si el circuito está
realmente validado; si no, NOT READY con el motivo concreto. Los precios
pospuestos no cuentan como pendiente.

Una advertencia del historial de este proyecto: hubo un caso en que se
reescribió un trigger de autorización desde una versión vieja y se perdieron
ramas. Si tocás `solo_permitir_cancelar` o `registrar_evento_servicio`, partí
siempre de la versión **realmente aplicada** en la base, no del archivo que
parezca más nuevo.
