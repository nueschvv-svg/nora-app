# Avance del piloto — 20 de septiembre de 2026

## Resultado

Las soluciones propuestas quedaron implementadas en la rama de auditoría. **Implementación preparada; activación real pendiente.** No se instalaron migraciones en el proyecto remoto, no se creó ningún edificio real y no se enviaron mensajes reales de Telegram. Los residentes siguen sin registro ni login.

## Cambios

- **Avisos durables:** trigger de PostgreSQL guarda una fila pendiente en la misma transacción del pedido. El servidor consume con reserva temporal y token exclusivo, registra entregas/fallos y reintenta con espera creciente. Cerrar la pestaña ya no elimina la tarea de aviso una vez instalada y activada esta arquitectura.
- **Recuperación ENJINIA:** panel de avisos pendientes/fallidos y pedidos históricos sin aviso. Reintento autorizado en la base sólo para operaciones. No vuelve a enviar avisos confirmados ni crea otro pedido. El filtrado se hace en SQL antes de paginar para que pedidos recientes entregados no oculten fallos antiguos.
- **Edificio/unidad:** enlace asociado a un edificio habilitado; dirección predefinida, piso/unidad obligatorios. La base copia la dirección canónica y evita cambiar luego el domicilio del piloto. Se muestra unidad en confirmación, detalle del residente, operaciones y Telegram. No se sembraron datos reales: pendiente martes.
- **Permisos sin cuentas:** se conserva la identidad anónima de Supabase; se restringen pedidos al titular/operaciones y se validan altas sin datos de pago inventados. El residente puede responder presupuesto, cancelar o confirmar efectivo, pero no cambiar identidad, propiedad, precio u otros datos inmutables.
- **Fotos y secretos:** el consumidor privilegiado sólo firma una foto con path correspondiente al ID del pedido y formato de archivo esperado. No acepta paths ajenos ni traversal. Excepciones de transporte no se guardan con URLs que pudieran contener el token del bot. Telegram HTTP 200 con `ok:false` ya se considera fallo.

## Bugs reproducidos y corregidos en este corte

1. La aceptación de presupuesto permitía modificar campos ajenos a esa acción, como propiedad; la nueva lista positiva lo impide.
2. Cancelar desde presupuestado estaba permitido en la política pero fallaba en el trigger; ambas reglas ahora coinciden.
3. El alta permitía declarar ciertos campos operativos, como método de pago; se rechazan.
4. La primera versión del panel ocultaba pendientes antiguos cuando la consulta alcanzaba el límite de resultados; prueba de regresión y paginación corregidas.
5. La primera versión del consumidor privilegiado confiaba en el path de metadata de foto; prueba de regresión demostró que podía firmar una ruta ajena y se agregó validación estricta.

## Evidencia y alcance

- **47 pruebas aprobadas, 0 fallos.** [Pruebas automatizadas](2026-09-20/tests.log): SQL real en PostgreSQL embebido (PGlite) para cola/edificio/permisos, más tests de límites externos y endpoints. Se ejecutan las migraciones nuevas y funciones/políticas relevantes sobre un esquema reducido. No equivale a inventariar/verificar todo el proyecto Supabase remoto.
- [Lint](2026-09-20/lint.log), [build](2026-09-20/build.log) y [dependencias](2026-09-20/dependencias.json). La compilación usa configuración pública ficticia de Supabase, sin acceso a una base real. Persiste el aviso de deprecación de middleware de Next; no impide compilar.
- Navegador local con datos ficticios: seis pasos, IA no disponible con continuación, piso/unidad vacíos rechazados, dirección predefinida sin edición, pedido confirmado, historial y detalle con “Piso PB · Unidad A”. Revisión visual del detalle a 390×844. Enlace de edificio no habilitado muestra error y bloquea el formulario. El fixture fue reiniciado al retomar la sesión; no contiene datos persistentes.
- Revisión independiente de cola, SQL, edificio, wizard y operaciones: sin hallazgos pendientes tras corregir paginación. Pruebas independientes del revisor: 22 casos específicos aprobados; luego se añadieron los casos de path de foto.

## Qué todavía falta

1. Acceso/configuración de staging: URL y clave pública, secretos de servidor, sesión de operaciones. No están disponibles en este entorno.
2. Instalar 44–46, desplegar app y activar el cron siguiendo [ACTIVACION.md](ACTIVACION.md). Comprobar respuesta HTTP del cron y recepción real de un pedido de pruebas; que CI pase no confirma esto.
3. Aislamiento real entre dos sesiones mediante REST y Storage privado; recorrido completo de presupuesto/gestión/consulta.
4. Datos del edificio del martes y acuerdo de responsable, atención y urgencias.
5. El fallo de integración Netlify detectado en el primer corte no se considera resuelto por estas pruebas locales; requiere sus logs. No se modificó main ni se activó producción.

## Límites operativos explícitos

Telegram puede recibir un mensaje y perderse la respuesta: los reintentos pueden duplicar **el aviso**, nunca el pedido por ese motivo. Operaciones debe conciliar por ID antes de un reintento manual. Las fotos tardías pueden quedar sólo en el detalle del pedido. No se creó monitoreo externo del cron; un scheduler detenido conserva pendientes pero no los procesa. Correo opcional, recuperación de sesión borrada, performance en dispositivos físicos y el resto de pendientes del informe inicial no se certifican por este corte.
