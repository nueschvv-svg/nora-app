# Sector 15 — lectura y precondiciones, 29/09/2026

Fuente prioritaria: MEMORY.md y sus 19 archivos indexados en la memoria de Nora, leídos antes de modificar código. Leídos también INFORME, ACTUALIZACION-2026-09-20 y ACTIVACION. Los CSV faltaban en este checkout; se copiaron sin modificaciones desde /Users/valentinnuesch/Claude/Projects/Nora APP/docs/piloto/sector15/.

## Datos verificados

- 175 UF únicas, 2222–2396: núcleo 15-1 = 58, 15-2 = 58, 15-3 = 59.
- Primer piso: 15-1 A/B/C/D; 15-2 B/C/D/E; 15-3 A/B/C/D/E. No generar opciones por fórmula.
- 132 antecedentes: 15 por familia excepto limpieza_otros (12); nueve familias. Se leyó el catálogo completo.
- La clasificación usa familia y después antecedentes, sin RAG. Los antecedentes contienen reparaciones profesionales, no instrucciones de bricolaje para residentes.
- Precio derivado histórico, no tarifa vigente: febrero 2025, supuestos pendientes de validar/actualizar según memoria. ENJINIA confirma el precio final.
- 42% humedad corresponde a muestra de 416 casos; 21% al análisis ampliado. No son el mismo denominador.

## Reproducción remota de sólo lectura

Proyecto comprobado por hostname: copgcabmvndbgbxqvdjw. Se utilizó sólo su clave pública, sin imprimirla ni guardarla en este documento.

- GET propiedades?select=id,edificio_id: HTTP 400, PostgreSQL 42703, column propiedades.edificio_id does not exist.
- GET edificios: HTTP 404, PGRST205, tabla ausente del schema cache.
- GET servicio_avisos: HTTP 404, PGRST205, tabla ausente del schema cache.
- GET categorias: HTTP 200, nueve categorías activas, ninguna de humedad.
- GET servicios y perfiles sin sesión: HTTP 200, cero filas visibles. Esto NO prueba aislamiento entre dos residentes autenticados ni permisos de escritura.

Es un inventario REST parcial: no expone todos los triggers, cuerpos de funciones ni políticas. Falta inventario SQL administrativo del esquema realmente instalado y respaldo antes de migrar. No se aplicaron migraciones ni se hicieron escrituras remotas.

## Orden y bloqueo de activación

1. Identificar staging y obtener acceso administrativo de ese entorno; confirmar respaldo e inventario SQL de origen.
2. Revisar funciones/políticas actuales antes de reemplazarlas. Aplicar 44, 45, 46 en staging y también 47 si se conserva la agenda actual; 44/45 no son scripts repetibles.
3. Probar sesiones reales A/B, operaciones y Storage, y el ciclo de avisos con Telegram de pruebas.
4. Sólo después publicar el bloque contra ese entorno compatible. El preview protegido actual no sirve directamente como destino de cron.

No se encontró configuración de staging en los dos checkouts revisados. El archivo local disponible identifica producción y no contiene acceso administrativo SQL/service_role. No se utilizará un proyecto ajeno ni se considerará el fixture local equivalente a staging.

El bloque de activación NO está terminado. No se publica este cambio documental todavía porque el push de la rama dispara un despliegue conectado a la base incompatible.

## 30/09 — export real y compatibilidad local

El usuario exportó /tmp/nora-produccion-esquema.sql con pg_dump 17.11 desde producción (PostgreSQL 17.6). Export completo, 57.629 bytes, esquema public con grants; no incluye datos, triggers sobre auth.users, políticas de storage ni configuración de Auth.

`node scripts/verificar-export-produccion.cjs /tmp/nora-produccion-esquema.sql` restauró ese export en un cluster local temporal aislado de PostgreSQL 17.11, aplicó 44/45/46/47 sin errores y comprobó:
- dos conexiones SQL con identidades A/B no ven pedidos ajenos;
- no permiten modificar servicios ajenos ni insertar con propiedad ajena;
- no permiten ascender el perfil a operaciones;
- dos reservas ocupan la franja, la tercera falla;
- los pedidos válidos tienen fila de aviso atómica.

Se simula únicamente auth.uid() y auth.users para la infraestructura local. No constituye prueba de JWT, Auth, Storage, Telegram ni Supabase remoto. No se importó ni migró staging todavía. El proyecto creado por el usuario para staging es ccccntecmouklhdvbqjp (Nora EBA), separado de producción copgcabmvndbgbxqvdjw.

El helper scripts/conectar-staging.py valida la URI del proyecto de staging, solicita contraseña oculta, comprueba conexión de sólo lectura y guarda credenciales únicamente en ~/.config/nora-staging con permisos privados. Nunca versionar esa carpeta. Aún falta ejecutar ese paso con la contraseña del usuario.

## 30/09 — staging conectado y migrado

Conexión `nora_staging` verificada contra el proyecto ccccntecmouklhdvbqjp. Inventario previo: cero tablas públicas, función `rls_auto_enable` y evento `ensure_rls` preexistentes, sin triggers propios sobre auth.users.

Se restauró en una transacción el export de estructura real de producción, sin filas de residentes. Ajustes exclusivos del restore a proyecto nuevo: `CREATE SCHEMA IF NOT EXISTS public`; conservar la función/evento de RLS automático de staging; omitir grants sobre esa función y defaults del rol administrado `supabase_admin`. No se ejecutó INSTALAR-TODO ni ninguna migración histórica. Logs locales: /tmp/nora-staging-restauracion.log y /tmp/nora-staging-44…47*.log.

Luego se aplicaron, en orden y con ON_ERROR_STOP, 44_cola_telegram, 45_edificio_piloto, 46_permisos_piloto y 47_agenda_fija. Verificación remota: 17 tablas, todas con RLS habilitado; 31 políticas; RPC agenda_disponibilidad devuelve las cuatro franjas, capacidad 2, seis días habilitados y domingo UNAVAILABLE en una semana futura.

`scripts/verificar-staging.sql` se ejecutó sobre Supabase staging: crea datos temporales dentro de transacción, alterna identidades bajo el rol authenticated, verifica aislamiento bilateral de pedidos, propiedad ajena invisible, UPDATE ajeno sin filas, escalada de rol rechazada, tercera reserva rechazada con AGENDA_COMPLETO y dos filas de cola para dos pedidos. Finaliza en ROLLBACK. Resultado PASS; no quedaron pedidos QA. La primera ejecución tuvo un error de sintaxis en el fixture y revirtió; se corrigió y se corrió completo nuevamente.

**Límite:** las identidades se simulan a nivel SQL; todavía NO prueba sesiones JWT, Auth anónimo, Storage ni entrega Telegram. La función crear_perfil_al_registrarse se restauró, pero el dump public no incluye el trigger auth.users. Faltan completar y validar Auth/Storage, claves públicas y de servidor de staging, catálogos, hosting y cron antes de publicar. Se solicitó al usuario la publishable key de Nora EBA. Producción no fue modificada. El bloque 1 sigue abierto y no hay un despliegue nuevo que pueda presentarse como validado.

### Clave pública recibida; Auth aún bloqueado

Clave publishable de Nora EBA guardada sólo en ~/.config/nora-staging/api.json (0600). POST /auth/v1/signup devuelve HTTP 422 anonymous_provider_disabled; no es una prueba RLS fallida: todavía no permite crear las sesiones.

Se inventarió Storage vacío y ausencia de trigger auth.users. Se aplicó db/operacion/preparar_staging_nuevo.sql, guardado específicamente para proyectos nuevos: reutiliza la función de perfiles restaurada, crea su trigger sobre auth.users, bucket privado fotos-servicios de 5 MB limitado a JPEG/PNG/WebP y políticas de lectura/subida por titular (lectura también operaciones). Guarda previa rechaza usuarios, buckets, triggers Auth o políticas Storage ya presentes; no se ejecutaron scripts históricos. La prueba SQL remota se repitió satisfactoriamente con el trigger nuevo.

Preparado scripts/verificar-jwt-staging.cjs para dos sesiones anónimas reales, pedidos propios/ajenos, escalada, capacidad y cancelación. Su ejecución se detuvo al comienzo con anonymous_provider_disabled, sin crear usuarios/pedidos. Pendiente activar anonymous sign-ins desde Authentication del proyecto de staging. Las políticas Storage aún requieren prueba HTTP con tokens reales.

### JWT y fotos verificados contra Supabase real

Luego de habilitar Anonymous sign-ins, scripts/verificar-jwt-staging.cjs pasó contra Nora EBA con dos JWT emitidos por Auth. Verificó perfiles automáticos, creación/lectura propia de pedidos, lectura ajena vacía de servicios/propiedades/perfiles, modificación ajena sin filas, escalada a operaciones rechazada, tercer cupo rechazado por AGENDA_COMPLETO y cancelación propia.

También verificó mediante Storage HTTP, en ambas direcciones: subida propia y firma propia permitidas, firma ajena y subida en pedido ajeno denegadas; acceso público denegado. Se usaron PNG sintéticos de un píxel, sin imágenes personales. Última ejecución: pedidos QA 290137ed-8a81-4323-a0ea-852c5e164003 y 753272e9-f1ec-4e09-a9a6-8e17092b19bb. Quedaron cancelados y sus avisos retenidos (fallido, 8 intentos) para no enviarlos al operador. Inventario después de las ejecuciones: 6 pedidos QA cancelados, 6 avisos retenidos, 4 imágenes privadas. No hay datos de residentes reales.

Pendiente: prueba de consumidor/recepción Telegram, cron, recorrido visual y hosting configurado a staging. No se encontró sesión CLI Vercel en las rutas habituales. scripts/configurar-servidor-staging.py permite ingresar la clave de servidor con getpass, valida lectura privilegiada contra el proyecto correcto y la guarda fuera del repositorio; aún no ejecutado con secreto real.

## 01/10 — consumidor y Telegram reales

Clave de servidor de Nora EBA validada y guardada por el usuario en ~/.config/nora-staging/server.json, fuera de Git. scripts/verificar-telegram-staging.cjs ejecutó los módulos TypeScript reales de admin, cargarPedido, cola y Telegram contra Supabase staging; sólo se omite el marcador server-only para ejecutarlos desde Node.

Pedido QA 7b9e8d84-ccb2-4d27-8eaa-f092e425b0b4: primer intento sin token Telegram quedó pendiente con próxima fecha futura; se restableció token y adelantó explícitamente el próximo intento para probar recuperación. Segundo intento enviado, HTTP 200 confirmado por Telegram, cola luego vacía. Se conservó el mismo pedido y se canceló al terminar. Mensaje claramente marcado QA/no realizar trabajo y advertencia de que el enlace del preview aún no apunta a staging. No se usaron datos reales de residentes ni se afirmó una UF. La recepción fue confirmada por la API; lectura humana por ENJINIA no comprobada.

Esto valida el consumidor invocado desde Node y la persistencia de reintento; NO valida cron periódico, endpoint desplegado ni selección UF. Falta configurar hosting contra Nora EBA antes de proporcionar una URL funcional. Producción sigue intacta.

### Arranque local y acceso al hosting

Creado web/.env.local privado/ignorado apuntando exclusivamente a Nora EBA; claves reutilizadas sólo para los proveedores previstos, sin imprimirlas. Servidor local en http://localhost:3101. Se abrió realmente /inicio y /pedir en navegador: cargan; /pedir muestra las nueve categorías copiadas mediante lectura pública de producción y escritura en staging, sin copiar tarifas ni información personal. La categoría inactiva QA aparece deshabilitada porque el flujo existente lista también rubros inactivos: pendiente retirar ese elemento del recorrido, no presentar esta pantalla como piloto Sector 15 terminado. UF/familias/precios siguen pendientes.

Vercel CLI autenticó al usuario maxibue-4045; listado de equipos sólo permite maxibue-4045s-projects, donde NORA no existe. No se creó ni modificó ningún proyecto de ese equipo. Se cerró esa sesión CLI recién creada y se inició otra autorización para la cuenta nueschvv-svg. Pendiente autorización correcta; no hay deploy nuevo ni push que dispare el preview contra producción incompatible.

## 02/10 — acceso Vercel corregido y preview aislado

Autenticación CLI confirmada como nueschvv-svg y acceso al proyecto nora-app, prj_l7artZhQSPBgQq34saskFfRvMXjp, root directory web. Configuradas exclusivamente para preview de rama codex/auditoria-piloto: URL y clave pública de Nora EBA, clave servidor, CRON_SECRET y NORA_APP_URL. Variables de producción sin cambios. Las claves permanecen en Vercel/local, nunca en Git.

Regresión: npm test, 53 aprobados y prueba opcional de concurrencia omitida por defecto; esa prueba se ejecuta aparte con PostgreSQL 17. La publicación de este bloque se considera entorno de prueba de infraestructura; aún no piloto funcional Sector 15. No hay tarifas activadas en staging ni cron habilitado. Pendiente mapear UF/familias/rangos/estados y retirar recorrido nacional.
