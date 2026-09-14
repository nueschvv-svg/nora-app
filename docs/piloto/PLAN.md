# Auditoría y correcciones del piloto

Base: ee4fad2. Alcance autorizado: reproducir, corregir bugs y volver a probar; sin cambiar el negocio, roles, esquema ni producción.

- [x] Leer pedido, instrucciones Superpowers, rutas, flujo principal y esquema.
- [x] Abrir producción y reproducir fallo de carga de categorías; verificar DNS.
- [x] Ejecutar baseline: lint, build, auditoría de dependencias.
- [ ] Corregir acceso al login desde sesión anónima con tests de middleware.
- [ ] Corregir entradas JSON inválidas en chat y geocodificación con tests sin llamadas externas.
- [ ] Revisar redirecciones, confirmación, seguimiento, duplicados, fotos, errores y seguridad SQL.
- [ ] Aplicar actualizaciones compatibles de seguridad y verificar build/lint/tests.
- [ ] Revisar UI local, resoluciones y escenarios adversos sin escribir en producción.
- [ ] Entregar inventario, evidencia, pendientes, KPIs y decisión explícita de go-live.

Las decisiones de edificio, operación y credenciales de staging se consultaron agrupadas. Ningún test simulado sustituye verificar RLS y ciclo completo contra una base de pruebas real.
