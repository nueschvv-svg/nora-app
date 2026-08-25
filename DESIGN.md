---
name: Nora
description: App de servicios técnicos para el hogar en Argentina — pedí, seguí en vivo, calificá, todo en un solo lugar.
colors:
  brand-50: "#e9f4f2"
  brand-100: "#d2eae6"
  brand-200: "#a6d6cd"
  brand-300: "#6fbdb1"
  brand-400: "#34a091"
  brand-500: "#14857a"
  brand-600: "#0e5c54"
  brand-700: "#0b3b38"
  brand-800: "#082d2b"
  brand-900: "#06201e"
  sand: "#f2f0ea"
  shell: "#ddd8ce"
  surface: "#ffffff"
  ink: "#16211f"
  mute: "#5b6b68"
  faint: "#6b7975"
  faint-deco: "#8a9794"
  line: "#e6e3db"
  urgent: "#c9503a"
  warn: "#c8841c"
  good: "#1f9d63"
typography:
  logo:
    fontFamily: "DM Serif Display, serif"
  display:
    fontFamily: "Sora, Inter, sans-serif"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
rounded:
  xl2: "20px"
  xl3: "26px"
spacing:
  card-padding: "14px"
components:
  button-primary:
    backgroundColor: "{colors.brand-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.xl2}"
    padding: "16px 20px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl2}"
---

# Design System: Nora

## Overview

**Creative North Star: "El plomero de confianza del barrio, con la prolijidad de un banco."**

Nora no vende tecnología, vende confianza: alguien va a entrar a tu casa.
El sistema visual evita deliberadamente el vocabulario frío de "app de
tech" (blanco puro, grises fríos, azules corporativos) y en su lugar usa
un verde azulado profundo sobre un fondo cálido tipo arena — algo que se
siente más cercano a una libreta de un oficio serio que a un dashboard
SaaS. La superficie por defecto es tranquila y casi editorial; el color
fuerte (`brand-600`/`brand-700`) se reserva para los momentos donde
hace falta autoridad real: el héroe de un pedido en curso, los botones
de acción primaria, el marco del técnico en camino.

Se navega con hojas que suben desde abajo, no con páginas de pantalla
completa — el efecto es el de una libreta de bolsillo. El producto es
mobile-first estricto (ver PRODUCT.md: "no hay versión de escritorio
dedicada"); en pantallas anchas el sitio ocupa TODO el ancho, sin marco
de teléfono ni columna angosta centrada — decisión explícita, ver
`web/src/app/(cliente)/(app)/layout.tsx`: "sitio web, no mockup de app".

**Key Characteristics:**
- Cálido, no corporativo: arena en vez de blanco, verde azulado en vez de azul.
- Contraste alto donde importa (héroes, CTA primaria), silencioso en el resto.
- Todo interactivo secundario vive en una hoja inferior, no en una página nueva.
- Nunca thin-border + shadow difusa al mismo tiempo en el mismo elemento — se elige uno.

## Colors

Paleta de un solo acento (verde azulado) con neutros cálidos — no hay
secundario ni terciario, y así se mantiene: agregar un segundo acento de
color diluiría la señal de "esto es serio" en un producto donde la
seriedad es literalmente el producto.

### Primary
- **Verde Confianza** (`#0e5c54`, `brand-600`): CTA primaria, héroes de pedido en curso, fondo del marco de técnico/operaciones. Es el color que carga la autoridad de la marca.
- **Verde Confianza Claro** (`#14857a`, `brand-500`): acentos vivos sobre fondos oscuros del mismo héroe (degradé, iconografía activa).

### Neutral
- **Arena** (`#f2f0ea`, `sand`): fondo de página por defecto. Nunca blanco puro.
- **Superficie** (`#ffffff`, `surface`): tarjetas y hojas, para que destaquen sobre el fondo arena.
- **Tinta** (`#16211f`, `ink`): texto principal.
- **Apagado** (`#5b6b68`, `mute`): texto secundario con jerarquía media — 5.59:1 sobre blanco, cumple WCAG AA.
- **Tenue** (`#6b7975`, `faint`): texto terciario/metadata — ajustado a propósito desde un tono anterior que no cumplía AA (3.03:1).
- **Tenue decorativo** (`#8a9794`, `faint-deco`): SOLO para bordes o íconos decorativos, nunca para texto — no cumple AA como texto.
- **Línea** (`#e6e3db`, `line`): bordes y divisores.

### Semantic
- **Urgente** (`#c9503a`): errores, cancelaciones, estados que requieren atención inmediata.
- **Alerta** (`#c8841c`): estados "en progreso"/pendientes, warnings suaves.
- **Bien** (`#1f9d63`): confirmaciones, éxito.

### Named Rules
**La Regla del Fondo Arena.** Ninguna pantalla usa blanco puro (`#fff`) como fondo de página — el blanco es sólo para tarjetas/superficies que necesitan destacarse sobre el arena.

**La Regla de los Dos Tenues.** `faint` es para texto (cumple AA); `faint-deco` es para decoración (no cumple AA como texto). No intercambiarlos.

## Liquid Glass (2026)

Rediseño pedido explícitamente por el cliente: llevar el sistema a un
material traslúcido tipo "Liquid Glass" (Apple, WWDC 2025) en la CAPA
DE CONTROLES/SUPERFICIES — barra superior, hojas inferiores, tarjetas
de categoría, el card del chat — no en el fondo de página en sí, igual
que en el sistema real de Apple: el vidrio flota sobre el contenido,
no es el contenido.

- **Fondo de página:** `body` (`globals.css`) ya no es `sand` plano —
  tiene tres manchas radiales muy grandes y difusas en los dos colores
  que YA son de la marca (`brand-500` verde y el rosa `#FF6B9D` del
  corazón del logo, ver `LogoNora.tsx`) para que el vidrio tenga algo
  de color debajo. Sigue siendo mono-marca: no se inventó una paleta
  nueva, sólo se usó lo que ya existía en otro tono de opacidad.
- **Clases de utilidad** (`globals.css`): `.glass` (tarjetas y
  botones secundarios — fondo blanco al 40%, `backdrop-filter: blur(20px)
  saturate(2)`, borde con brillo especular vía `box-shadow: inset`),
  `.glass-nav` (barra superior) y `.glass-sheet` (hojas inferiores,
  más opaca que `.glass` porque ahí hay texto largo que tiene que
  seguir siendo legible).
- **Dónde SÍ va vidrio:** `NavSuperior`, las hojas (`HojaServicio`,
  `HojaNotificaciones`, `HojaLegal`, `FormularioEquipo`), el card de
  `ChatNora`, la grilla de categorías de `/pedir`.
- **Dónde NO va vidrio, a propósito:** el botón primario (`bg-brand-600`
  sólido) — el vidrio baja contraste, y ahí es justo donde más importa
  no bajarlo. Tampoco en `/pedir` sobre la alerta de riesgo real
  (gas/agua+electricidad) ni en `/operaciones` (panel interno, fuera
  de este rediseño).
- **`--color-stage`** (el hero de scroll de `/inicio`) sigue siendo la
  única ruptura total de estilo — ver la sección "Escena Cinema" más
  abajo si existe, o `globals.css` directamente.

## Typography

**Display Font:** Sora (con Inter de respaldo)
**Body Font:** Inter (con system-ui de respaldo)
**Logo Font:** DM Serif Display

**Character:** Sora aporta geometría cálida a los títulos sin sentirse genérica (evita el default de Inter-para-todo); DM Serif en el wordmark es la única nota editorial/artesanal de todo el sistema, reservada estrictamente al logo.

### Hierarchy
- **Display** (Sora, bold, 19–24px): títulos de pantalla y de héroe.
- **Title** (Sora, semibold, 14.5–16px): títulos de tarjeta, nombres de técnico/servicio.
- **Body** (Inter, regular, 13–14px): texto de contenido, descripciones.
- **Label** (Inter, semibold, 10–12px, uppercase con tracking cuando es un eyebrow): etiquetas de estado, categorías de sección.

### Named Rules
**La Regla del Logo Solo.** DM Serif aparece únicamente en el wordmark "nora" — ningún título ni copy de producto la usa, para que siga leyéndose como firma, no como recurso tipográfico reusable.

## Layout

Mobile-first — sin versión de escritorio dedicada como producto (ver
PRODUCT.md), pero sí responsive: la app tiene que verse prolija en
teléfono, tablet y desktop, no sólo funcionar en los tres.

El fondo (`bg-sand`, la barra superior, la escena cinema de /inicio)
ocupa todo el ancho de la pantalla siempre. El CONTENIDO adentro
(saludo, chat, los pasos de /pedir) va en una columna `max-w-xl
mx-auto` — en el celular no se nota (ya es angosto), pero evita que en
tablet/desktop el texto y las tarjetas se estiren a un ancho absurdo
con aire vacío a los costados. Esto NO es el "marco de teléfono con
sombra" que describía antes esta sección — `(cliente)/(app)/layout.tsx`
sigue rechazando eso explícitamente ("sitio web, no mockup de app").
Es sólo un ancho de lectura razonable, el mismo patrón que usa casi
cualquier sitio responsive. El token `shell` (`#ddd8ce`) sigue sin
usarlo ningún componente — era del enfoque de marco-de-teléfono
abandonado, no de este.

Padding de tarjeta estándar 14px; los héroes usan más aire (20–24px).
El scroll vertical dentro de una hoja inferior nunca hace scroll
horizontal en el body — cada tabla o contenido ancho tiene su propio
contenedor con overflow controlado.

## Elevation & Depth

Sistema híbrido: tarjetas usan un borde fino (`line`) MÁS una sombra
difusa de dos capas (`shadow-card`) — una capa ambiente muy sutil (1px,
4% opacidad) y una capa de elevación real (24px de blur, 18% opacidad).
Esto está corriendo contra el detector de la propia skill (marca
"hairline border + wide shadow" como señal de UI generada por IA) — acá
es a propósito y está en cientos de componentes: es el lenguaje visual
completo del sistema, no un descuido puntual. No cambiarlo salvo pedido
explícito de rediseño.

### Shadow Vocabulary
- **`shadow-card`** (`0 1px 2px rgba(11,59,56,.04), 0 8px 24px -12px rgba(11,59,56,.18)`): tarjetas y hojas, uso por defecto.
- **`shadow-hero`** (`0 12px 40px -16px rgba(8,45,43,.55)`): héroes con degradé oscuro.
- **`shadow-fab`** (`0 10px 24px -6px rgba(14,92,84,.55)`): botones de acción primaria flotantes.
- **`shadow-nav`** (`0 -8px 30px -18px rgba(11,59,56,.25)`): navegación inferior.
- **`shadow-sheet`** (`0 -12px 40px -10px rgba(8,45,43,.35)`): hojas que suben desde abajo.

### Named Rules
**La Regla del Borde-Más-Sombra Intencional.** `border border-line` + `shadow-card` van juntos siempre que se use — no se separan para "modernizar" un componente puntual. Es el idioma visual del sistema entero.

## Shapes

Dos radios only: `xl2` (20px) para tarjetas, botones e inputs; `xl3`
(26px) exclusivamente para el borde superior de las hojas que suben
desde abajo. No hay esquinas cuadradas en superficies interactivas ni
radios intermedios inventados por componente.

## Components

### Buttons
- **Shape:** `rounded-xl2` (20px).
- **Primary:** fondo `brand-600`, texto blanco, `shadow-fab`, deshabilitado a `opacity-40` (los controles deshabilitados quedan exentos del requisito de contraste AA — no es un bug si el detector lo marca).
- **Secondary/Ghost:** fondo `surface`, borde `line`, texto `ink`, `shadow-card`.
- **Estados de carga:** ícono `Loader2` girando al lado del texto del botón, nunca reemplaza el texto — el usuario siempre ve qué acción está en curso.

### Cards / Containers
- **Corner Style:** `rounded-xl2` (20px).
- **Background:** `surface` sobre fondo `sand`.
- **Shadow Strategy:** `shadow-card` (ver Elevation).
- **Border:** `border border-line`, siempre acompañando a la sombra.
- **Internal Padding:** 14px estándar.

### Inputs / Fields
- **Style:** `rounded-2xl`, fondo `surface`, `border border-line`, `shadow-card`.
- **Focus:** el borde pasa a `brand-300`.
- **Error:** mensaje en `urgent` con fondo `urgent/10`, debajo del campo.

### Hojas inferiores (Sheet) — componente de firma
El patrón de navegación secundaria de toda la app: fondo `sand`,
esquina superior `rounded-t-[26px]` (`xl3`), `shadow-sheet`, backdrop
`bg-black/40` con fade, entrada por `translate-y` con
`cubic-bezier(.22,1,.36,1)` en 400ms. Se pueden apilar (una hoja abre
otra encima, mismo z-index, el orden del DOM decide quién queda arriba)
— usado para "Ver perfil del técnico" sobre el detalle del pedido.

### Héroe de pedido en curso
Degradé oscuro (`radial-gradient(120% 80% at 100% 0%, #14857a 0%,
#0e5c54 38%, #0b3b38 100%)`) con texto blanco — el único lugar donde el
sistema abandona el fondo arena a propósito, reservado para el estado
que más importa comunicar (el pedido activo).

### Navigation
Barra inferior fija con 5 accesos (Inicio, Historial, Pedir, Obras,
Perfil) — el botón central de "Pedir" es un FAB circular elevado sobre
la barra, no un ícono más en la fila.

## Do's and Don'ts

### Do:
- **Do** usar `sand` como fondo de página por defecto, nunca blanco puro.
- **Do** mantener borde + sombra juntos en cada tarjeta (`border-line` + `shadow-card`) — es el idioma del sistema, no un anti-patrón a corregir.
- **Do** usar `faint` (no `faint-deco`) para cualquier texto secundario, porque `faint-deco` no cumple contraste AA.
- **Do** reservar DM Serif exclusivamente al wordmark del logo.
- **Do** mantener el ícono de carga al lado del texto del botón, nunca reemplazarlo.

### Don't:
- **Don't** introducir un segundo color de acento — el sistema es deliberadamente mono-acento.
- **Don't** usar radios distintos a `xl2`/`xl3`, ni esquinas cuadradas en elementos interactivos.
- **Don't** reemplazar el patrón de hoja inferior por páginas de pantalla completa para acciones secundarias.
- **Don't** "corregir" el combo borde+sombra basándose en el detector genérico de anti-patrones — acá es intencional.
- **Don't** usar `faint-deco` para texto legible, sólo para bordes/íconos puramente decorativos.
