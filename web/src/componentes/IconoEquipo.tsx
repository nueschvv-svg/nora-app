import {
  AirVent,
  Broom,
  Building2,
  CircleHelp,
  Droplet,
  Droplets,
  FireExtinguisher,
  Flame,
  Hammer,
  HardHat,
  Heater,
  Home,
  House,
  KeyRound,
  type LucideIcon,
  Paintbrush,
  Thermometer,
  Waves,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";

/* Mapa de nombre → ícono.
   El prototipo cargaba Lucide desde un CDN con la versión "@latest",
   lo que significa que un cambio de la librería podía romper la app
   sin que tocáramos nada. Acá los íconos vienen del paquete instalado,
   con versión fija, y sólo viaja al navegador el que se usa. */
/* "brick-wall", "paint-roller" y "sparkles" son los slugs guardados en
   la base (columna `icono` de categorías) — no se tocan para no
   requerir una migración. Lo que cambió es a qué ícono apuntan:
   - BrickWall/PaintRoller traían cada uno un <rect> grande de fondo,
     así que entre íconos de puro trazo se leían más "en caja"/pesados
     que el resto.
   - Sparkles medía lo mismo en el contenedor (24x24) que cualquier
     otro, pero su propio dibujo ocupa una fracción mucho más chica de
     ese cuadro que el resto — se veía visiblemente más chico/liviano.
   HardHat, Paintbrush y Broom son 100% trazo, sin relleno de fondo.

   Con eso corregido, seguía habiendo una diferencia real entre wrench
   (Plomería) y key-round (Cerrajería): medí ambos a fondo (bounding
   box, densidad real de píxeles pintados, tamaño y posición del <svg>
   dentro de la tarjeta) y los dos salieron técnicamente idénticos al
   resto — mismo contenedor 24x24, mismo `fill:none`, mismo
   `strokeWidth:2` de Lucide, misma posición. La diferencia no es un
   bug: es la forma de cada trazo. Wrench dibuja curvas anchas que con
   punta y unión redondeadas (default de Lucide) se leen macizas; el
   cuerpo de key-round es un vástago fino con mucho espacio vacío
   alrededor. Se corrige con un `strokeWidth` por ícono, no reemplazando
   ninguno de los dos — wrench y key-round son los términos correctos y
   no traen relleno de fondo, no hay razón real para sacarlos. */
const ICONOS: Record<string, { Componente: LucideIcon; strokeWidth?: number }> = {
  "air-vent": { Componente: AirVent },
  "brick-wall": { Componente: HardHat },
  "building-2": { Componente: Building2 },
  droplet: { Componente: Droplet },
  droplets: { Componente: Droplets },
  flame: { Componente: Flame },
  "fire-extinguisher": { Componente: FireExtinguisher },
  hammer: { Componente: Hammer },
  heater: { Componente: Heater },
  thermometer: { Componente: Thermometer },
  waves: { Componente: Waves },
  home: { Componente: Home },
  house: { Componente: House },
  "key-round": { Componente: KeyRound, strokeWidth: 2.5 },
  "paint-roller": { Componente: Paintbrush },
  sparkles: { Componente: Broom },
  wind: { Componente: Wind },
  wrench: { Componente: Wrench, strokeWidth: 1.75 },
  zap: { Componente: Zap },
};

export type NombreIcono = keyof typeof ICONOS;

export function IconoEquipo({
  nombre,
  className = "w-5 h-5",
}: {
  nombre: string;
  className?: string;
}) {
  const entrada = ICONOS[nombre];
  const Componente = entrada?.Componente ?? CircleHelp;
  return <Componente className={className} strokeWidth={entrada?.strokeWidth} />;
}
