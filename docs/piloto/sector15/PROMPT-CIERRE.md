# Prompt de cierre — para pegar en ChatGPT

**Antes de pegarlo, hacé estas dos cosas. No las puede hacer la IA.**

1. **Clave de Anthropic.** La actual devuelve `HTTP 401 invalid x-api-key`.
   Sacá una nueva en console.anthropic.com → API Keys, y ponela en
   `web/.env.local` y en las variables de entorno del preview en Vercel.
2. **Token de bypass de Vercel.** Vercel → proyecto `nora-app` → Settings →
   Deployment Protection → Protection Bypass for Automation → generar y
   copiar. Guardalo donde lo tengas a mano; el agente lo va a necesitar.

Si alguna de las dos no está, decíselo al agente al principio: va a trabajar
igual, pero sin poder cerrar la verificación que falta.

---

Seguís trabajando sobre NORA, rama `codex/auditoria-piloto`, en
`/Users/valentinnuesch/Documents/ChatGPT/enji/nora-app`.

El bloque de matcheo histórico, situaciones y limpieza del recorrido **ya está
implementado y pusheado** (commits `e78d420` a `2a841b0`). No lo rehagas.
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
  cada minuto y dispara solo, pero Vercel lo rechaza con 401 por Deployment
  Protection.
- Precios **pospuestos** por decisión del usuario. No implementes tarifas ni
  bloquees ningún pedido por falta de precio.

## Tarea 1 — Verificar el matcheo contra el modelo real

Esto es lo único que falta para poder decir READY, y nunca se pudo probar
porque la clave estaba caída. **No lo des por bueno con mocks.**

Con la clave nueva, probá de punta a punta y mostrame la evidencia:

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
`web/src/lib/diagnostico.ts` y `chatNora.ts`, no la validación.

Confirmá que los antecedentes elegidos **llegan a Telegram y al detalle de
operaciones** dentro de la descripción persistida.

## Tarea 2 — Cerrar el cron

Guardá el token de bypass en Vault como `nora_vercel_bypass` (el script
`db/operacion/activar_cron_avisos.sql` ya lo soporta y agrega el header solo).
Después verificá en `net._http_response` que la respuesta sea **200**, no 401.

Ojo con esto: un 401 con cuerpo `"Protected deployment"` es de Vercel; un 401
sin ese cuerpo es de la ruta y significa que el secreto no coincide.

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

Recién ahí desplegá el código y configurá el cron contra la URL de producción,
que no tiene Deployment Protection y por lo tanto no necesita el bypass.

## Cómo trabajar

Bloque por bloque, publicando cada uno verificado. Después de cada bloque
decime qué cambió, qué probaste y cómo.

No reportes algo como funcionando si sólo compila. Si algo queda bloqueado por
afuera, decime exactamente qué falta y quién lo tiene que hacer. Cerrá READY
sólo si el circuito está realmente validado; si no, NOT READY con el motivo
concreto. Los precios pospuestos no cuentan como pendiente.

Una advertencia del historial de este proyecto: hubo un caso en que se
reescribió un trigger de autorización desde una versión vieja y se perdieron
ramas. Si tocás `solo_permitir_cancelar` o `registrar_evento_servicio`, partí
siempre de la versión **realmente aplicada** en la base, no del archivo que
parezca más nuevo.
