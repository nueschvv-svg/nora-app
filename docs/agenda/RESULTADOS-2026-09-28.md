# Agenda fija y Aurora — implementación verificada localmente

## Antes
El wizard y la reprogramación usaban franjas generales y fechas calculadas en el navegador. No había capacidad global atómica por franja ni agenda diaria agrupada. La información del turno ya vivía en servicios; se reutilizó esa estructura.

## Resultado
- Lunes a sábado; cuatro franjas 09:30–11:30, 11:30–13:30, 14:30–16:00, 16:00–17:30.
- Dos trabajos por franja, ocho por día para todo ENJINIA.
- Anticipación mínima de 24 horas reales al inicio del turno, zona America/Argentina/Buenos_Aires. No significa simplemente mañana. Configurable en agenda_config.
- Disponibilidad agregada desde PostgreSQL, actualización cada 30 segundos y al recuperar foco; la base decide al confirmar.
- Lock transaccional por día, asignación interna de cupos e índice único parcial. El reloj se valida después de adquirir el lock. Tampoco operaciones puede exceder el cupo.
- Todos los estados excepto cancelado consumen cupo. Cancelación libera; reprogramación conserva el anterior si la nueva reserva falla. Aviso interno al reprogramar; Telegram inicial conserva cola existente.
- Registros anteriores sin cupo se preservan. Si hay pedidos anteriores en una fecha, se bloquea esa fecha hasta revisión explícita por operaciones; no se inventa conversión de franjas históricas.
- Operaciones muestra agenda diaria por franja, navegación por fecha y orden por creado_el/id.

## Base y archivos
Migración db/47_agenda_fija.sql: agenda_config, agenda_franjas, servicios.agenda_cupo, índice único parcial, trigger de capacidad, RPC agregada y aviso interno de reprogramación. Configuración privada; RPC sin datos personales.

Frontend: lib/agenda.ts, SelectorAgenda.tsx, operaciones/AgendaDia.tsx, pedir/page.tsx, operaciones/DetalleServicio.tsx y ListaPedidos.tsx. Adaptadores datos.ts/operaciones.ts muestran errores legibles; tipos.ts mantiene etiquetas históricas; telegram.ts usa fecha/horario persistidos.

## Aurora
Componente reutilizable web/src/components/ui/aurora-background.tsx, utilitario lib/utils.ts y estilos en globals.css. Se crea components/ui para componentes visuales reutilizables compatibles con la ruta solicitada; los componentes de dominio siguen en componentes. Proyecto ya tenía TypeScript y Tailwind 4; no requiere iniciar shadcn ni reemplazar configuración. Variables modernas de Tailwind, sin import privado flattenColorPalette de Tailwind 3. Framer Motion instalado. Integrado en inicio/page.tsx debajo de la introducción y en visitas posteriores; mantiene contenido, landmarks, clics y altura del chat. CSS desactiva animación con prefers-reduced-motion.

## Verificaciones
- 54 tests Node pasaron, cero fallos y cero omitidos, con NORA_PG_BIN=/opt/homebrew/opt/postgresql@17/bin.
- PostgreSQL 17 aislado: 12 clientes simultáneos en READ COMMITTED y REPEATABLE READ, cupos manipulados, máximo dos reservas. Se agregó y pasó caso que vence anticipación durante espera del lock.
- PGlite: lunes/sábado/domingo, cuatro franjas, primer/segundo/tercer cupo, cancelación/reactivación, pasado/fecha inválida, 24 horas, zona de sesión diferente, históricos, privacidad de RPC y configuración, integración RLS/cola/avisos.
- ESLint, build producción y npm audit: sin errores; audit cero vulnerabilidades al instalar Framer Motion.
- Navegador real local: desktop 1440x900 y móvil 390x844, selección completa/último lugar/disponible, domingo deshabilitado, creación/confirmación y persistencia previa tras navegar. Repetir clic y cambiar entre horarios disponibles conserva Continuar habilitado después de la corrección de revisión.
- Agenda de operaciones agrupada, Aurora después del scroll de introducción, expansión al primer mensaje, chat móvil sin overflow horizontal (390/390). Sin APIs externas de IA configuradas, se ve el estado real de error del chat/análisis; no se simularon respuestas exitosas.
- Revisión independiente de código: tres hallazgos corregidos (validez al cambiar selección, recuperación tras reserva rechazada y anticipación luego del lock); segunda revisión sin regresiones importantes.

## Pendiente / límite real
No se aplicó SQL remoto ni se desplegó este código. Faltan migraciones 44–47, configuración y prueba real de Supabase/Telegram/cron según docs/piloto/ACTIVACION.md, y datos reales del edificio. La prueba local de disponibilidad usa SQL real en PGlite, pero autenticación y transporte REST del fixture no certifican la infraestructura remota. Movimiento reducido está cubierto por CSS; falta prueba visual con preferencia del sistema activada. No declarar piloto READY por compilar.
