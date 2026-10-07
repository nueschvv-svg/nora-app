# Piloto confiable ENJINIA

Diseño aprobado en conversación: residentes sin registro; todos los pedidos a ENJINIA por Telegram; datos del edificio pendientes para el martes.

## Avisos durables
Una fila de cola se crea mediante trigger en la misma transacción de cada pedido nuevo. Un consumidor Next del servidor toma filas con lease y token de exclusión, carga datos persistidos, envía Telegram y registra resultado. Reintentos con espera creciente hasta 8 intentos; después queda visible para intervención. Un cron de Supabase llama al endpoint autenticado cada minuto; no depender de la pestaña ni del plan de Vercel. Acceso elevado sólo en servidor con variable privada. Operaciones puede ver y reactivar fallos; residentes no pueden forjar entregas ni disparar reenvíos de enviados. No reenviar automáticamente pedidos históricos al instalar: revisión explícita desde operaciones. Fotos con breve demora inicial; el pedido/aviso tiene prioridad sobre adjuntos.

Telegram no ofrece idempotencia de envío: si acepta un mensaje y se pierde su respuesta puede existir un aviso duplicado. Mismo ID permite reconocerlo; nunca se crea otro pedido. No prometer exactamente una entrega.

## Edificio y unidad
Configuración de edificio mediante registro de base y enlace /pedir?edificio=slug. Dirección predefinida validada en base, piso/unidad obligatorios para pedidos del piloto, snapshot en propiedad. No crear un edificio ficticio habilitado ni exigir cuentas. Mantener pedidos generales existentes.

## Validación
Tests de comportamiento de SQL con Postgres embebido, permisos entre dos identidades anónimas, cola, reintentos y tokens; tests de endpoints; lint/build. Preparar prueba real aislada que no mande mensajes sin autorización adicional explícita. No credenciales reales disponibles actualmente; no declarar recepción o políticas instaladas verificadas.
