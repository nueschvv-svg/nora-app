# NORA — rediseño integral 2026-09-29

Autorizado por el usuario sin aprobaciones entre módulos. No publicar, desplegar ni tocar datos remotos. Base: commit 05a9605. Usar estructura existente, sin agregar módulos ni métricas ficticias.

## Diagnóstico
Next 16, React 19, TypeScript, Tailwind 4, GSAP y Framer Motion. Rutas: inicio/chat, pedir (6 pasos + confirmación), pedidos/detalle en hoja, equipos/formulario, score/desglose, entrar/recuperación, cambiar-clave, operaciones/listado/agenda/avisos/detalle. Modales: servicio, notificaciones, legal, ayuda. PROJECT_STATUS.md no existe; se consultan PRODUCT.md, DESIGN.md, AUDITORIA.md y docs/piloto.

## Dirección elegida
Vidrio cálido: verde profundo, arena perlada, reflejos suaves; conservar casa y corazón del logo. Navegación traslúcida, datos opacos, tipografía Inter/Sora existente. Logo vectorial más sólido y reconocible a tamaño pequeño. Intro editorial con pieza de marca en perspectiva que se aproxima al hacer scroll; botón para saltar, teclado y movimiento reducido. Sin órbita de rubros no habilitados.

## Implementación
1. Sistema y marca: tokens CSS semánticos, controles/estados, superficies y logo. Root mantiene esta parte y el nuevo scroll.
2. Residentes: navegación, pedidos, equipos, score, acceso y recuperación. Reutilizar backend y componentes. Agente independiente con propiedad exclusiva de esos archivos.
3. Operaciones: lista, agenda, avisos, detalle y sus estados. Agente independiente con propiedad exclusiva de operaciones.
4. Root: wizard, chat, hojas, estados compartidos; integración y revisión global.
5. QA: lint/build/tests existentes; navegador 390/768/1440; intro scroll/salto/chat, agenda/reserva, pedidos/detalle, operaciones, accesibilidad. Documentar límites reales. Commit local sin push que dispare deployments.

## Criterios
Contraste de texto 4.5:1, foco visible, acciones táctiles 44px, contenido largo refluye, fallback opaco sin backdrop-filter, movimiento reducido. Motion transform/opacity, nada de blur animado a pantalla completa. No agregar gráficos sin datos. Mantener Aurora solicitado en chat.

## Ajustes finales pedidos por Valentín
Se elimina la navegación durante la intro y el CTA comercial. Tarjeta de marca con arco de entrada, casa/n y firma Nora; sin asterisco. Título en tres líneas, salida por scroll con profundidad y navegación revelada al terminar. Saludo MP3 local de 0,62 s (voz Paulina, síntesis macOS), volumen 55%; autoplay sujeto al navegador, primer gesto como respaldo y control de audio. No se consumió servicio de TTS pago.

La prohibición anterior de despliegue fue revocada explícitamente por el usuario: subir a GitHub y entregar URL online. Publicar preview verificada; activación del piloto real sigue pendiente según docs/agenda/RESULTADOS-2026-09-28.md.
