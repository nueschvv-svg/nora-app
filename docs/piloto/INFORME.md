# Diagnóstico y preparación del piloto ENJINIA

Fecha: 14/09/2026. Base original: `ee4fad2`. Primer corte de correcciones: `877746c`, rama `codex/auditoria-piloto`.

**Conclusión: NOT READY FOR PILOT.** Se corrigieron fallas importantes y los controles automatizados pasan. Todavía falta probar la base real, aislamiento entre residentes, gestión de operaciones y recepción controlada en Telegram. No corresponde confundir un build correcto o una simulación con un piloto validado.

Este informe distingue **observado en navegador**, **probado con servicios simulados**, **revisado en código** y **pendiente de verificación real**. No se probaron manualmente todas las combinaciones posibles ni se hizo un test físico en cada modelo de teléfono. No se hicieron escrituras, borrados, stress tests ni envíos de mensajes de prueba en producción.

## 1. Qué entendí del producto y cómo estaba

Nora es una aplicación operativa, no solamente una landing. Tiene frontend Next.js/React, Supabase Auth/Postgres/Storage/Realtime, conversación y diagnóstico con IA, pedidos, presupuestos, seguimiento, gestión interna y avisos por Telegram. También conserva funciones secundarias de equipos, agenda y score de mantenimiento.

ENJINIA confirmó que **recibe y gestiona todos los pedidos por Telegram**. El edificio es la audiencia de una prueba controlada, no el administrador autónomo de un marketplace. No hace falta reconstruir un sistema de técnicos externos: ese rol fue eliminado en las migraciones recientes.

**Estado original:** había una base de producto considerable y varias protecciones correctas —RLS declarada, separación de claves del servidor, uploads privados, actualizaciones administrativas condicionadas al estado—, pero el ciclo no era confiable de punta a punta. El residente podía terminar sin seguimiento accesible; un reintento podía duplicar el pedido; el aviso a ENJINIA podía fallar sin feedback; la confirmación prometía atención en dos horas sin una capacidad operativa verificada. No había scripts de tests automatizados en package.json.

PRODUCT.md y ESTADO.md mezclaban estados históricos incompatibles con el código actual. Se agregaron referencias al diagnóstico vigente, conservando el historial.

## 2. Mapa de funcionalidades

El [inventario técnico](INVENTARIO.md) enumera **103 declaraciones de controles** con archivo, línea, identidad y acción declarada. No son 103 pruebas manuales: las listas dinámicas generan muchas instancias desde una misma declaración.

| Superficie | Función real | Estado original / evidencia | Estado de este corte |
|---|---|---|---|
| `/` | Redirige a `/inicio` | HTTP 307 observado | Conservado |
| `/inicio` | Bienvenida visual y chat con IA | Navegación y saludo observados; no es landing de edificio | Asistente identificado como virtual; aviso de emergencias |
| Navegación superior | Pedir, inicio y ayuda | No ofrecía historial | Agregado Mis pedidos |
| Ayuda / BotNora | FAQ por categorías y derivación a WhatsApp | Control oculto seguía expuesto a accesibilidad | Panel cerrado usa inert y aria-hidden |
| `/pedir` | Wizard de seis pasos | Flujo existente; categorías de Supabase | Flujo local completo probado y endurecido |
| Categoría | Catálogo activo/inactivo, iconos y selección | Fuente real en DB; fixtures no representan catálogo productivo | No se agregaron categorías; selección activa validada |
| Problema / fotos | Texto y hasta tres imágenes | Validación de archivo insuficiente al elegir | Validación de tipo/tamaño antes de analizar |
| Análisis | IA, preguntas, riesgo y estimado | Endpoint puede fallar sin impedir continuar | Timeout y longitud máxima; continuidad ante fallo probada |
| Cuándo | Próximos 30 días y cuatro franjas | Mezcla de UTC y calendario local | Calendario argentino y revalidación al enviar |
| Contacto | Nombre, teléfono, mail opcional y domicilio | Sin piso/departamento específico; varias escrituras | Teléfono validado; orden de guardado y regreso corregidos |
| Confirmación | Número de orden y horario | Promesa de dos horas; regreso a inicio | Recepción diferenciada de atención; acceso al pedido y aviso parcial |
| `/pedidos` | Historial y detalle del residente | No existía ruta accesible aunque había componentes | Reconectado con datos existentes; recarga y detalle probados localmente |
| HojaServicio | Estado, fotos, presupuesto, pago efectivo y calificación | Código existente sin entrada desde UI | Reutilizado; domicilio correcto y foco del modal |
| `/inicio/agenda`, `/inicio/score` | Mantenimiento derivado de equipos | Rutas existentes, secundarias y poco accesibles | Revisadas estáticamente; no requisito central del piloto |
| FormularioEquipo | Alta de equipos | Componente existente | No agregado al flujo principal |
| `/entrar` | Login, registro, recuperación | Sesión anónima impedía llegar al login | Corregido; roles SQL conservados |
| `/cambiar-clave`, `/auth/*` | Recuperación y confirmación | Código existente, requiere servicio real de auth | Redirecciones internas validadas; email real pendiente |
| `/operaciones` | Lista, estados, contador y selección de pedidos | Existe y exige rol operaciones | Código revisado; operación real pendiente de cuenta de prueba |
| `/operaciones/[id]` | Aceptar/ofertar/rechazar, avanzar estado, precio, horario, notas, fotos e historial | Control de concurrencia en UPDATE | Pendiente E2E con base real |
| `/api/chat`, `/api/diagnosticar` | Acceso server-side a IA | Sesión exigida; rate limit en memoria | Entradas inválidas y límites corregidos; rate limit durable pendiente |
| `/api/geocodificar`, `/api/dolar` | Geocodificación y cotización | Servicios externos auxiliares | JSON/geocodificación robustecidos; cotización no es garantía de precio |
| `/api/pedidos/[id]/enrutar` | Aviso a Telegram y registro del intento | Activado después del INSERT desde navegador | Feedback de fallo, tiempos máximos y mensajes/fotos corregidos |
| `/api/pedidos/[id]/mail` | Comprobante opcional por Resend | Requiere remitente real configurado | No se probó envío real; texto de compromiso corregido |
| Notificaciones/push | Componentes, suscripciones y SQL | No hay circuito visible completo conectado en la UI actual | No se presentan como canal operativo validado |
| Legal | Términos y privacidad | Borrador con campos COMPLETAR y acceso no integrado | Pendiente identidad/contacto y revisión de contenido |
| Estados globales | Loading, error, vacío, error global | Existen parcialmente | Estados críticos probados; no hay modo offline completo |

## 3. Flujo principal

Entrada por QR/link → Pedir → categoría → problema/fotos → análisis → horario → contacto/domicilio → confirmar → INSERT de servicio → fotos → intento de aviso a ENJINIA por Telegram → número de orden → Mis pedidos.

Son **seis pantallas** y aproximadamente nueve acciones de selección/continuación/envío, sin contar escritura, foco ni scroll, entrando directo a `/pedir`. Entrar por el chat añade una cantidad variable de intercambios; puede transferir categoría y contexto al wizard. El chat no crea el pedido por sí mismo.

Para el QR del piloto, recomiendo enlazar `/pedir`: es la acción directa existente. No se cambió la homepage ni el modelo de negocio. El horario seleccionado es una preferencia que ENJINIA debe confirmar.

El ciclo existente es: `solicitado → presupuestado → aceptado → en_camino → en_curso → finalizado → pagado → calificado`, con cancelación y caminos alternativos. Operaciones puede aceptar directamente con precio o pedir aceptación del presupuesto. No se inventó un ciclo nuevo.

## 4. Bugs encontrados

| Prioridad | Problema original y causa | Resultado |
|---|---|---|
| P1 | Seguimiento inaccesible: HojaServicio/listarServicios no tenían pantalla de entrada | Corregido con `/pedidos` y navegación |
| P1 | Reintento podía crear otro UUID/registro después de respuesta perdida | UUID estable y recuperación por PK; tests con frontera DB simulada |
| P1 | Telegram devolvía HTTP 200 con `{ok:false}` y el cliente lo aceptaba | Corregido y reproducido con test |
| P1 | Caption de una foto podía exceder el límite al incluir pedido completo | Texto acotado, foto separada para pedidos largos y fallback si falla imagen |
| P1 | Confirmación aparecía antes de iniciar/completar el aviso, alentando cerrar la pestaña | Se espera el intento y se muestran fallos parciales; no garantiza entrega durable |
| P1 | Sesión anónima redirigía el login de operaciones al inicio | Corregido con tests del middleware |
| P1 | Volver/next admitían destinos inesperados o URLs inválidas | Validación compartida de destinos internos |
| P2 | JSON null/tipos incorrectos provocaban excepciones en chat/geocodificación | Respuesta 400 y tests |
| P2 | Promesa no sustentada de atención en dos horas | Eliminada de formulario, confirmación y mail |
| P2 | Día visible/guardado podía diferir por UTC; franja podía vencer durante el wizard | Calendario argentino y revalidación final |
| P2 | Teléfono con letras o longitud absurda; fotos incompatibles | Validación compartida y tests |
| P2 | Regresar a contacto podía repetir alta de domicilio ya guardado | Resumen de datos guardados y escritura secuencial |
| P2 | Detalle podía mostrar domicilio activo en lugar del domicilio del pedido | Se busca por propiedadId del servicio |
| P2 | Estado de historial podía sobrevivir a cambio de identidad | Contenido remonta al cambiar la sesión |
| P2 | Ayuda invisible conservaba controles accesibles; detalle sin manejo de foco | inert/aria-hidden y teclado/foco en detalle |
| P2 | Esperar fotos sin límite podía bloquear confirmación y Telegram | Espera acotada; operación puede terminar más tarde y se avisa |

## 5. UX y copy

La acción principal existe pero convive con una bienvenida visual extensa, chat y funciones de mantenimiento. Para alguien apurado, la ruta directa es más clara. El formulario exige dirección completa y no identifica de manera explícita piso/departamento/espacio común: ENJINIA necesitaría completar esa información por contacto. Falta acordar cómo identificar la unidad antes de imprimir el QR.

La confirmación ahora distingue pedido guardado, notificación y atención pendiente. Los errores del contacto son específicos. Falta completar la recuperación de borrador tras recarga y revisar todos los textos secundarios de FAQ/legal. No se implementó tracking ni un nuevo canal de comunicación.

## 6. Mobile y accesibilidad

Se revisó el estado de error de categorías publicado a 320, 375, 390, 430, 768, 1024, 1280 y 1440 px: CTA visible y sin desborde horizontal. En local se recorrió el wizard a 390×844 y el historial a esos ocho anchos más 844×390, también sin desborde en los estados observados.

En el detalle se verificó Tab mediante control de navegador, Escape y recarga posterior. Se corrigió el foco y se evita que el contenido principal quede interactivo detrás de la hoja. No se certifican contraste completo, zoom a 200%, teclado virtual de cada teléfono, VoiceOver/TalkBack ni Safari real: siguen en la matriz de aceptación.

## 7. Problemas técnicos

- El repositorio carecía de runner de tests propio; ahora usa Node test runner y TypeScript ya presente, sin agregar un framework pesado.
- Build sin variables de Supabase falla. Con valores locales ficticios compila: es una dependencia de configuración, no evidencia de una DB operativa.
- Next advierte que middleware está deprecado a favor de proxy; es deuda no bloqueante, no se migró por estética.
- APIs de IA usan límites en memoria: se reinician y no se comparten entre instancias. El límite de sesión anónima tampoco equivale a control por residente.
- Crear pedido y avisar por Telegram son dos operaciones separadas. Cerrar la pestaña/crashear entre ambas aún puede dejar pedido sin aviso. Antes del piloto hace falta un procedimiento comprobable de conciliación o, previa decisión técnica, una cola/reintento del servidor.
- Mail sigue siendo auxiliar, disparado desde el navegador. No debe usarse como prueba de entrega garantizada.
- Estado en vivo y refresco manual no sustituyen probar cambios de precio/horario mientras el detalle está abierto.
- Persistencia del identificador de reintento no equivale a recuperación de todos los campos, fotos o sesión en otro dispositivo.

## 8. Seguridad y privacidad

Se revisaron rutas, separación cliente/servidor y SQL de permisos. Las consultas del navegador dependen de RLS; no deben considerarse seguras sólo porque la UI o el layout oculten una acción. Hay políticas de propietario/operaciones y protección del rol; falta ejecutarlas con dos residentes y un operador en staging.

Pendientes concretos: validar campos modificables al aceptar/rechazar presupuesto en `solo_permitir_cancelar`, restricciones de INSERT directo, manipulación de propiedad/categoría/precio/pago, acceso a fotos ajenas y posibilidad de falsear registros de enrutamiento desde cliente. No se cambiaron permisos SQL sin verificar el estado real de la base.

La búsqueda heurística de patrones comunes de claves privadas/tokens en archivos versionados actuales no encontró coincidencias. **No es un certificado de ausencia de secretos**: no cubre todo el historial ni las variables del despliegue. La clave pública de Supabase no es un secreto por sí misma.

Npm audit inicialmente reportó cuatro dependencias afectadas: Next (crítica), sharp, fast-uri y js-yaml. Después de actualizaciones compatibles reporta cero. Eso no sustituye revisar lógica de autorización.

Se recopilan nombre, teléfono, domicilio, mail opcional, descripción y fotos. ENJINIA los recibe vía Telegram; la IA puede procesar texto/fotos; la geocodificación comunica la dirección al proveedor externo. El aviso de privacidad debe reflejar estos destinos, conservación y canal de consulta. El borrador legal tiene datos sin completar. No se añadieron analytics invasivos.

## 9. Cambios realizados y riesgos

Las correcciones mantienen Supabase, el modelo de servicios y los roles actuales. No hay migraciones nuevas ni eliminación de datos. La idempotencia usa la PK existente: requiere que RLS permita leer el propio pedido, condición a validar realmente. El hash/UUID se guarda en sessionStorage, sin el texto del pedido; si storage está bloqueado, queda protección en memoria durante esa página.

Esperar fotos/Telegram aumenta el tiempo de confirmación en conexiones lentas, pero con esperas acotadas y feedback. La operación de foto subyacente no se cancela al vencer el límite: puede terminar después; por eso el mensaje dice que no pudo confirmarse la carga. La entrega a Telegram puede ser parcial y queda detallada en el registro del intento. No se promete exactamente una notificación ante fallas de red.

## 10. Archivos modificados

- `web/src/app/(cliente)/(flujo)/pedir/page.tsx`: validación, concurrencia, confirmación, fechas y entrega.
- `web/src/app/(cliente)/(app)/pedidos/page.tsx`: historial y conexión con detalle.
- `web/src/componentes/{NavSuperior,HojaServicio,BotNora,ChatNora}.tsx`: navegación, datos, accesibilidad y copy.
- `web/src/lib/{datos,perfil,intentoPedido,validacionPedido,tiempoLimite,destinoInterno}.ts`: integridad, reintentos y validaciones.
- `web/src/lib/{enrutarPedidoCliente,chatCliente,diagnosticarCliente,mail}.ts`, `web/src/lib/enrutamiento/telegram.ts`: fallos de red, entrega y copy.
- Middleware Supabase, rutas de auth, entrar y API chat/diagnóstico/geocodificación.
- package.json/lock, ESLint, ejemplo de variables, `.github/workflows/qa.yml`.
- `web/tests/`, `docs/piloto/`, referencias en PRODUCT.md y ESTADO.md.

El diff de la rama es la lista exacta. El workspace ajeno `amc-landing` no se modificó.

## 11. Tests realizados

- Baseline: lint pasó; build sin configuración falló; npm audit detectó cuatro dependencias afectadas.
- Navegador publicado: entrada, navegación, FAQ visible en árbol accesible, pedir/error de categorías, login y responsive limitado.
- El fallo publicado de Supabase apareció como Failed to fetch/DNS local. DNS externo resolvió el dominio y una petición TLS al endpoint devolvió 401 sin API key. **No se confirmó caída de producción**.
- Navegador local con fixture: seis pasos; vacío; mail/teléfono inválidos; IA no disponible; HTML y emoji como texto; doble clic; un solo registro solicitado; fallo de Telegram visible; historial; detalle; Escape; recarga; anchos indicados.
- Revisión independiente de cambios: se corrigieron estado entre sesiones, caducidad de horario, fechas fuera del huso argentino, espera de fotos y conservación de foto en Telegram.

## 12. Tests automatizados agregados

21 tests cubren acceso anónimo/login, cuerpos JSON inválidos, redirecciones internas, enlace a historial, reintento con respuesta perdida y concurrencia simulada, identificador persistente sin PII, teléfonos, fechas, archivos, Telegram `ok:false`, límites y foto en mensajes largos, y subida estancada.

Se ejecutan con `cd web && npm ci && npm test`. El fixture de UI se inicia con `node tests/fixture-server.cjs`, sólo en loopback; luego se inicia Next con URL/clave ficticias indicadas en el workflow. **El fixture no implementa SQL, RLS, Storage ni Realtime real.**

## 13. Build y verificación automática

[21 tests: 21 pasan, 0 fallan](tests.log). [Lint sin errores](lint.log). [Build Next 16.3.5 correcto](build.log). [Npm audit: 0 vulnerabilidades reportadas](dependencias.json).

[GitHub Actions del primer corte](https://github.com/nueschvv-svg/nora-app/actions/runs/34865496855) terminó correctamente. Los valores de Supabase usados por CI son ficticios y sirven para compilar, no para una aceptación E2E.

Verificación posterior: [QA del commit e1c19e8](https://github.com/nueschvv-svg/nora-app/actions/runs/34918837872) también pasó todos los pasos. La vista previa de Vercel pasó, pero [Netlify nora-app-849](https://app.netlify.com/projects/nora-app-849/deploys/6aa8a45d8abe53000898b23f) terminó en error. Los tres checks auxiliares de Netlify sólo remiten al mismo despliegue fallido; no demuestran tres bugs distintos. La API pública confirma el estado, sin exponer la causa. Falta consultar el log de compilación con acceso a ese proyecto antes de proponer una corrección. Por lo tanto, QA verde no significa que todas las integraciones de despliegue estén aprobadas.

## 14. E2E y simulación de piloto

Se completó el recorrido del residente con backend simulado. **No se completó residente → Supabase real → Telegram real → operador → cambio de estado → residente**. No se probaron 50 personas ni se generó carga productiva. El test de dos envíos concurrentes usa una frontera de DB simulada; no prueba concurrencia real en Postgres.

| Escenario | Evidencia | Falta |
|---|---|---|
| Usuario familiarizado con tecnología | Pedido local completo | Tiempo real de un usuario externo |
| Persona de 60+ años | Revisión de claridad/tamaño, sin persona real reclutada | Prueba moderada, zoom y lector |
| Persona apurada con pérdida de agua | Ruta directa y aviso de emergencias | Validar comprensión y protocolo ENJINIA |
| Mala conexión | Fallos de IA/Telegram y timeout de adjuntos en tests | Red móvil real, offline durante INSERT |
| Persona que completa mal | Errores locales de contacto comprobados | Variantes de navegador/teclado |
| Persona que vuelve | Historial tras recarga en mismo navegador | Recuperación si borra cookies/cambia dispositivo |

## 15. Estado actual

Hay una rama corregida, publicada y con CI verde. El flujo de UI es más completo y los errores importantes son visibles. La operación real de ENJINIA y el aislamiento de datos todavía no están certificados. Main/producción no se actualizaron automáticamente con este trabajo.

## 16. Riesgos pendientes y requisitos de cierre

1. **P1:** disponer de staging/base local real y cuenta de operaciones para probar aislamiento, SQL vigente y el ciclo completo. No se recibieron esas credenciales/configuración.
2. **P1:** un pedido guardado no asegura aviso durable por Telegram si se cierra la pestaña. ENJINIA necesita conciliación de pedidos sin aviso y un procedimiento real de reintento; acordar si se implementa una entrega desde servidor.
3. **P1 operativo:** identificar edificio y unidad sin ambigüedad, acordar horarios y quién cubre pedidos no atendidos/urgencias. No inventar dirección ni teléfono de emergencias.
4. **P1:** probar Storage privado y acciones de presupuesto/pago contra cuentas distintas; confirmar restricciones del esquema instalado.
5. **P2:** recuperación del borrador, manejo de pérdida de sesión, validación de acciones y precios en tiempo real, límites durables de endpoints pagos y envío de comprobante opcional.
6. **P2:** completar aviso de privacidad/datos de ENJINIA y probar accesibilidad/performance en dispositivos reales.

No ejecutar `db/INSTALAR-TODO.sql` ni migraciones históricas indiscriminadamente: hay scripts que eliminan datos/tablas de versiones anteriores. Primero inventariar qué migraciones están realmente aplicadas.

## 17. Mejoras no necesarias y KPIs propuestos

No hace falta agregar marketplace nacional, roles de técnicos, nuevas categorías automáticamente, pagos nuevos, push/SMS nuevos, animaciones, app nativa o analítica individual invasiva.

Para aprender del piloto, usar agregados de servicios y eventos existentes: residentes participantes (diferenciar personas de sesiones anónimas), pedidos por categoría, porcentaje gestionado, primera respuesta, resolución, cancelaciones y avisos Telegram fallidos/no registrados. Un inicio de formulario no equivale a pedido creado. Abandono y tiempo de completado requerirían instrumentación mínima consentida o pruebas moderadas; no se implementaron eventos nuevos.

Comparar tiempo de gestión con el mecanismo previo del edificio y anotar motivos de contacto adicional. Objetivos de aceptación propuestos: todo pedido creado localizable por ENJINIA, ningún dato ajeno accesible, ningún reintento involuntario convertido en otro pedido, ningún éxito falso y protocolo claro para cada fallo. Son criterios, no métricas alcanzadas todavía.

## 18. Checklist go-live

| Control | Resultado |
|---|---|
| Homepage clara para el edificio | Parcial; QR directo recomendado |
| Mobile/responsive | Parcial; estados y tamaños enumerados, sin dispositivos físicos |
| Formularios y validación | UI local y tests pasan; DB real pendiente |
| Creación, no doble submit y confirmación | Simulación pasa; Postgres real pendiente |
| Estados de error | Mejorados y probados en escenarios enumerados |
| Links/botones | Inventariados; recorrido crítico local probado, no cobertura manual total |
| Administración y ciclo completo | Pendiente con cuenta de pruebas |
| Permisos, datos y Storage | Revisión estática; validación cruzada pendiente |
| Secrets públicos | Sin coincidencias heurísticas actuales; no certificación total |
| Performance | Sin LCP/CLS/INP medidos en dispositivo real |
| Tests/lint/build/dependencias | Pasan |
| Consola | Fallos inducidos de servicios registrados; no se certifica producción sin errores |
| Telegram ENJINIA | Código y simulaciones corregidos; recepción real pendiente |
| Piloto puede comenzar | **No todavía** |

## 19. Recomendación final

**NOT READY FOR PILOT.** El sistema original tenía piezas suficientes para un MVP, pero el flujo de seguimiento y la confiabilidad de los envíos tenían huecos reales. Este corte mejora esas piezas y agrega verificación repetible. La siguiente validación decisiva es cinco pedidos controlados en staging —dos simultáneos, uno mal completado y uno con pérdida de red—, recepción por ENJINIA, gestión desde operaciones y consulta posterior por el residente, además de aislamiento entre dos usuarios.

Con esa evidencia y el protocolo operativo del edificio se puede decidir el go-live. Sin ella, decir READY sería atribuir a producción resultados que sólo se obtuvieron en código y simulación.

Referencia técnica usada para los límites de mensajes y fotos: [Telegram Bot API](https://core.telegram.org/bots/api#sendphoto).
