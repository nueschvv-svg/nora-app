# Sector 15: unidad al finalizar el pedido

Prioridad confirmada por Valentín el 05/10: identificar el departamento mediante listas al terminar el pedido y entregar ubicación/problema a ENJINIA. Precios pospuestos. El material histórico de EBA se conserva para integrar el matcheo; no se afirma que ya esté conectado al modelo.

## Implementación

`/pedir` abre Sector 15 por defecto. En Contacto, inmediatamente antes de Confirmar, se elige núcleo → piso → departamento. Cada opción proviene de filas de la base importadas literalmente de `sector15_uf.csv`; cambiar núcleo o piso borra selecciones dependientes. No se piden calle/altura ni se geocodifica este flujo. Núcleo es indispensable: una misma letra/piso existe en distintos núcleos.

Migración 48 aplicada y verificada sólo en Nora EBA staging (`ccccntecmouklhdvbqjp`), después de las 44–47 ya existentes. Antes se exportó el esquema a `/tmp/nora-staging-before-48.sql`. Crea catálogo de 175 UF (58/58/59 por núcleo), de lectura pública sin datos personales, y una FK `propiedades.sector15_uf`. Trigger valida pertenencia al edificio, copia piso/letra canónicos e impide cambiar la UF de un domicilio existente. Mantiene validaciones anteriores, relaciones, RLS e historial. Rechaza pedidos nuevos del Sector 15 sin UF.

Se utiliza la ubicación verificada «Predio Estación Buenos Aires · Sector 15 · Barracas, CABA». No se inventó calle ni altura postal: los campos de dirección existentes conservan predio/sector como referencia operativa. El resumen, domicilio, detalle de operaciones y Telegram incorporan núcleo, piso, letra y UF. Telegram obtiene datos persistidos desde el servidor, nunca un texto de ubicación enviado libremente por el navegador.

## Evidencia

- Test compara las 175 filas de la migración contra CSV, incluidas excepciones del piso 1; recorrido de selección devuelve la UF exacta para cada fila.
- PostgreSQL aislado: UF inexistente rechazada, datos falsificados reemplazados por canónicos, cambio/eliminación de UF rechazados, catálogo legible pero no editable por anónimo.
- Staging con JWT reales: propiedad canónica guardada; segunda sesión no lee propiedad/pedido ni modifica pedido ajeno.
- Consumidor y Telegram reales: aviso QA `cb487692-f264-4a71-9c5a-4e854fc1dfe6` con `15-1 · Piso 1 · Unidad B · UF 2222`, contacto y problema; API Telegram confirmó enviado. Pedido cancelado después de la prueba. Marcado expresamente «NO REALIZAR TRABAJO». No se afirma lectura humana del mensaje.
- Navegador local: recorrido hasta Contacto, 15-2/piso 1 muestra sólo B/C/D/E; B deriva UF 2226. Selector revisado a 390×844 y escritorio.
- Suite: 55 aprobados, 1 opcional PostgreSQL omitido; lint y build correctos. La alerta ya documentada de braces sigue impidiendo CI completamente verde.

## Alcance pendiente

Producción histórica no modificada. Publicar este código únicamente contra una base con 48 instalada. Precios fuera de este bloque por indicación del usuario. Matcheo histórico, cron periódico y resto del piloto siguen pendientes; esto certifica identificación y entrega de un pedido QA, no todo el piloto.
