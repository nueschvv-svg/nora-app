# Activación del piloto ENJINIA

El código no activa un edificio ni instala SQL en Supabase por sí solo. Residentes sin registro: Supabase mantiene una identidad anónima interna para aislar los pedidos. ENJINIA conserva su acceso de operaciones.

## Orden de instalación

1. Inventariar esquema y políticas vigentes de Supabase, respaldar y probar primero en staging. No ejecutar INSTALAR-TODO ni volver a correr migraciones históricas destructivas. Las migraciones nuevas esperan el esquema vigente 39–43, incluidas las columnas de propiedades/servicios y el trigger `trg_solo_cancelar`.
2. Aplicar, en orden, `db/44_cola_telegram.sql`, `45_edificio_piloto.sql`, `46_permisos_piloto.sql` y `47_agenda_fija.sql`. La 47 también se aplica una vez y debe estar instalada antes de publicar la interfaz de agenda. Cada archivo usa transacción; 44 y 45 se aplican una vez. Registrar fecha y resultado. La 46 es repetible.
3. Configurar secretos **del servidor del hosting**: `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET` (aleatorio, al menos 32 caracteres). La URL pública y clave publishable de Supabase deben corresponder a la misma base. Ningún secreto lleva prefijo NEXT_PUBLIC ni se pega en Git/chat/documentación. `NORA_APP_URL` debe ser la URL HTTPS canónica del entorno para el enlace de operaciones en Telegram.
4. Desplegar el código de esta rama. Verificar que /pedir, /pedidos y /operaciones carguen y que el panel Telegram no muestre error de migración. El endpoint /api/cron/avisos sin autorización debe devolver 401 (503 si falta configurar el secreto).
5. Habilitar pg_cron, pg_net y Vault en el proyecto Supabase. Guardar en Vault `nora_app_url` (URL HTTPS canónica, sin path) y `nora_cron_secret` (idéntico a CRON_SECRET). Ejecutar `db/operacion/activar_cron_avisos.sql`. Usa POST cada minuto; no depende del cron de Vercel ni de una pestaña abierta.
6. Verificar tanto el job como la respuesta HTTP: éxito SQL de pg_cron sólo confirma que lanzó HTTP. `net._http_response` debe mostrar 200, sin timeout, 401, 503 ni redirección al login. Revisar pendientes en operaciones. Un preview protegido por login no sirve como destino del cron sin configurar el acceso correspondiente.

La clave service_role sólo se usa en el consumidor: valida el secreto antes de crear el cliente privilegiado. Los residentes no pueden ejecutar las RPC de claim/finalización ni escribir resultados de entrega. Operaciones reactiva avisos mediante su sesión y una RPC que verifica el rol en la base.

## Alta del edificio — datos pendientes para el martes

Solicitar nombre, calle/altura, localidad/provincia y referencia de acceso. Crear el registro `edificios` con un slug estable y `activo=false`; verificar los datos antes de habilitarlo. No se incluyó un edificio real ni un registro activo de ejemplo. El único edificio ficticio existe en el fixture local de QA, no en la migración.

Al habilitarlo, el enlace es `/pedir?edificio=SLUG_REAL` sobre la URL canónica. Ese enlace puede convertirse en QR. El formulario muestra la dirección del edificio y exige piso/unidad; la base copia la dirección canónica, aunque se manipule el navegador. Los domicilios ya usados conservan su dirección/unidad. Un enlace inválido o edificio inactivo bloquea ese flujo; los pedidos generales anteriores siguen disponibles. Desactivar un edificio impide nuevos pedidos asociados sin borrar historial.

## Aceptación controlada en staging

Usar un grupo de Telegram de pruebas o una ventana de pruebas acordada con ENJINIA. Identificar todos los pedidos como QA. No confundir resultados del fixture local con recepción real.

- Navegador A y navegador B: sesiones anónimas distintas, sin registro. Crear un pedido propio desde cada uno. Intentar leer/modificar ID, fotos y propiedades del otro mediante REST con cada token: debe devolver cero filas/denegar. Intentar cambiar perfil a operaciones: debe denegarse.
- Con A: pedido del edificio con piso/unidad y foto. Comprobar fila de servicio + aviso pendiente; cerrar la pestaña antes del envío. En un ciclo del cron debe llegar a Telegram y registrarse enviado. Confirmar dirección, unidad, teléfono, ID y enlace de operaciones.
- Repetir la confirmación/doble clic y simular respuesta perdida: debe seguir existiendo un único pedido con el mismo ID. Dos residentes simultáneos deben producir dos pedidos diferentes.
- Provocar fallo de Telegram sólo en staging: el pedido debe conservarse; aumentar intentos y próxima fecha. Restablecer configuración y comprobar recuperación. Tras agotar 8 intentos, el panel muestra intervención y permite programar reintento. Nunca recrear el pedido.
- Interrumpir un consumidor de prueba: tras vencer la reserva de 5 minutos, otro consumidor puede tomarlo. Un token anterior no puede sobrescribir la confirmación del nuevo proceso.
- Operaciones oferta presupuesto: residente acepta/rechaza o cancela; no puede cambiar precio, propiedad, identidad ni demás campos. Operaciones avanza hasta finalizado; residente confirma efectivo según flujo existente. Verificar estado actualizado desde el residente.
- Verificar Storage privado con dos sesiones. Las nuevas pruebas SQL no certifican los buckets ni la firma/verificación de JWT del proyecto remoto.

Registrar por pedido ID, horario de creación, recepción Telegram, resultado y estado final. No copiar tokens ni datos personales al informe público.

## Recuperación y límites

La cola demora inicialmente 30 segundos para dar margen a fotos. Cada minuto se toman hasta 3 avisos concurrentes, con reserva de 5 minutos. Fallos tienen espera creciente (hasta una hora) y un máximo de 8 intentos por ciclo. El panel lista también pedidos históricos sin aviso, pero **no los reenvía automáticamente al instalar**: operaciones revisa y los incorpora explícitamente.

Telegram no brinda idempotencia para sendMessage/sendPhoto: puede aceptar un aviso y perderse la respuesta antes de registrarla. Un reintento puede duplicar el mensaje; el ID permite reconocerlo. Esto no duplica el pedido. Revisar Telegram antes del reintento manual. El envío principal tiene prioridad: fotos que lleguen después o fallen se consultan en operaciones. El correo opcional sigue dependiendo de su flujo anterior y no forma parte de esta cola.

Si el cron se detiene, los avisos permanecen pendientes; la cola sola no ejecuta trabajos. ENJINIA debe revisar el panel al inicio y durante el horario de atención. El monitoreo externo y un canal alternativo de alarma no están implementados. Definir responsable, horario, urgencias y atención de pedidos sin respuesta antes de invitar residentes.

## Pausa / reversión segura

Para pausar entrega: `select cron.unschedule('nora-avisos-telegram');`. Para cerrar el piloto: desactivar el edificio. Conservar servicios y cola para conciliación. No borrar tablas ni avisos para ocultar errores. Revertir aplicación y SQL requiere coordinación: el endpoint anterior enviaba desde el navegador y no es compatible con revocar INSERT de servicio_enrutamientos. Preferir corregir hacia adelante; mantener pedidos en cola mientras se resuelve.

Referencias: [Supabase Cron y Vault](https://supabase.com/docs/guides/functions/schedule-functions), [PGlite para pruebas PostgreSQL locales](https://pglite.dev/docs/). Las extensiones del scheduler se validan al activar el proyecto; PGlite sólo ejecuta el SQL de tablas, funciones y permisos.
