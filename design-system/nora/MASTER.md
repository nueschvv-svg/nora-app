# NORA · Casa serena

Fuente de verdad de diseño, ajustada al producto tras consultar UI UX Pro Max. Implementación: web/src/app/nora-design.css y globals.css. Reemplaza recomendaciones genéricas del generador (archivadas en docs/diseno/GENERADOR-REFERENCIA.md), no el historial de DESIGN.md.

## Identidad
Casa y corazón preservados; casa de trazo sólido integra una n, corazón rosa sin latido infinito. Wordmark Sora, nora minúscula con punto verde. Versión oscura con verde claro. SVG escala sin pérdida; sin filtros complejos, texto o números inventados.

## Tokens
Primitivos: pino #0e5c54, tinta #16211f, arena #f2f0ea, perla #f5f5ee, borde #d6ded7, corazón #d75f83.
Semánticos: brand-600 acción; ink contenido; mute #5b6b68 secundario; urgent #b94030 error, warn #936013 atención, good #187747 éxito.
Componentes: nora-panel-shadow, nora-glass rgba(255,255,252,.86), nora-fast 160ms, nora-ease cubic-bezier(.22,1,.36,1). Radios 14 controles, 24 paneles, 28 hojas, 32 acceso. Espaciado 4/8/12/16/24/32/48. Body Inter; títulos Sora 26–40px; hero 44–94px; párrafos 14–18px. No añadir otra familia.

## Superficies
Vidrio sólo en navegación y hojas; blur 12–16px con respaldo opaco. Listas, cifras y formularios blancos y opacos. No anidar múltiples capas blur. No vidrio idéntico para todo. Foco 3px pino, acciones >=44px, errores con texto, controles nativos y semántica disabled.

## Flujos
Intro nativa sticky, perspectiva transform vinculada al scroll, acceso directo al chat con foco en input. Sin interceptar rueda/touch ni scroll artificial. Reduced-motion ofrece encabezado estático; visitas repetidas abren chat. Aurora conserva fondo del chat. Formularios siguen pasos y validaciones existentes. Operaciones divide Pedidos/Agenda/Avisos sin inventar integraciones. Historial mantiene badges y detalle. Score no presenta 100 si no hay equipos.

## Responsive y estados
Mobile 390, tablet 768, desktop 1440; min-width 0, texto largo refluye. Contenido de residentes máximo 1120px; formularios 672px; detalle 720px. Vacíos explican acción siguiente, cargas sin datos ficticios, errores con reintento. No oscurecer el sistema completo sin diseñar contraste específico.

## Referencias consultadas
- https://ui.aceternity.com/components/container-scroll-animation — perspectiva por scroll; referencia conceptual, sin copiar código.
- https://magicui.design/docs/components/scroll-based-velocity — respuesta al scroll; biblioteca MIT verificada en https://github.com/magicuidesign/magicui/blob/main/LICENSE.md. No se importó el marquee: no aporta a la reserva.
- https://github.com/DavidHDev/react-bits — evaluado; licencia MIT + Commons Clause, no MIT puro. No se incorporó código.
- UI UX Pro Max 2.15.0: generador service management glassmorphism, búsquedas glassmorphism readable surfaces y focus keyboard modal. Recomendaciones filtradas por producto; no se adoptaron secciones de marketing ni colores genéricos.
