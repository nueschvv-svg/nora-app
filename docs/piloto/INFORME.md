# Auditoría del piloto ENJINIA — avance verificado

Fecha: 14/09/2026. Base revisada: `ee4fad2`. Rama: `codex/auditoria-piloto`.

## Estado de este corte

**NOT READY FOR PILOT.** Las correcciones de este corte pasan 21 tests, lint y build con configuración local de prueba. Falta cerrar la validación contra un Supabase de pruebas real, permisos entre usuarios, operaciones y entrega real al Telegram de ENJINIA. No se modificó producción ni se enviaron pedidos ficticios al Telegram real.

## Qué había

Nora es una app Next.js/React con Supabase. El residente entra con sesión anónima, conversa con una IA o abre un formulario de seis pasos: categoría, problema, análisis, horario, contacto y confirmación. Los pedidos se guardan en Supabase y el navegador pide al servidor que avise por Telegram. ENJINIA confirmó que recibe y gestiona todos los pedidos; el piloto corresponde a un edificio.

Había panel de operaciones y componentes para presupuesto, seguimiento, pago y calificación. Sin embargo, el detalle del residente estaba desconectado de las rutas visibles. La documentación describía también funciones de técnicos eliminadas del código. No es sólo una landing: hay un producto funcional importante, pero con huecos en continuidad del flujo y garantías de entrega.

## Correcciones verificadas hasta ahora

- Acceso al login de operaciones desde una sesión anónima, sin cambiar roles ni permisos SQL.
- Rechazo de JSON nulo o inválido en chat y geocodificación; límite de longitud en diagnóstico.
- Redirecciones de autenticación restringidas a rutas internas.
- Reintentos de creación con UUID estable y recuperación de pedido existente, usando la clave primaria actual de Postgres; sin migración.
- Acceso a Mis pedidos, detalle y recuperación tras recarga en el mismo navegador.
- Datos del detalle asociados al domicilio del pedido y estado de pantalla aislado por sesión.
- Validación de teléfono y fotos, fechas del calendario argentino y revalidación del horario al enviar.
- Bloqueo síncrono de doble envío y prevención de alta repetida de domicilio al retroceder normalmente.
- Aviso de emergencias, identificación de asistente virtual y eliminación de la promesa no verificada de respuesta en dos horas.
- Telegram: detección de `ok: false`, límites de texto/caption, foto separada para pedidos largos, alternativa de texto si falla la imagen y tiempos máximos de espera.
- El formulario espera el intento de aviso a ENJINIA e informa fallos parciales sin crear otro pedido. La espera de fotos está limitada.
- Ayuda cerrada fuera del árbol accesible y foco/teclado del detalle.
- Next.js actualizado a 16.3.5 y dependencias vulnerables corregidas; npm audit reporta cero vulnerabilidades en este corte.
- Workflow de GitHub para tests, lint, auditoría de dependencias y build.

## Evidencia

- [21 tests de regresión](tests.log), [lint](lint.log), [build](build.log), [auditoría de dependencias](dependencias.json).
- [Inventario de 103 declaraciones de controles](INVENTARIO.md). Inventario estático: no equivale a 103 controles probados manualmente.
- Navegador local con backend ficticio: seis pasos, campos vacíos, teléfono/mail inválidos, fallo de IA con continuación, caracteres HTML/emoji mostrados como texto, doble clic con un solo registro, confirmación con fallo de Telegram visible, historial, detalle y recarga.
- Ocho anchos de 320 a 1440 px en error de categorías de la web publicada; historial local en esos anchos y 844×390. Sin desborde horizontal en esos estados. No equivale a pruebas físicas en iPhone/Android.
- La web publicada falló al resolver Supabase desde el entorno de prueba. DNS externo sí resolvió el dominio y el endpoint respondió HTTP 401 sin API key: **no está confirmada una caída de producción**.

## Pendientes de la auditoría

- Completar el diagnóstico detallado por funcionalidad y checklist go-live.
- Verificar configuración de staging y usuarios de prueba para RLS, Storage, operaciones y ciclo completo.
- Validar una recepción controlada real por ENJINIA y el procedimiento de recuperación de avisos fallidos.
- Definir dirección/unidad del edificio, horarios operativos y comunicación al residente.
- Revisar límites de la entrega desde navegador: todavía no existe una cola durable que garantice aviso aunque el usuario cierre la pestaña entre guardar y notificar.
- El formulario aún no recupera un borrador completo tras recarga; un identificador de reintento no equivale a persistir todo el formulario.
- Cerrar revisión de privacidad, datos de contacto legales y mediciones reales de performance.

Los tests usan dobles de servicios externos. El fixture de UI no implementa SQL, RLS, Storage ni Realtime real y no certifica esas capas. El build usa valores locales ficticios, no credenciales de producción.
