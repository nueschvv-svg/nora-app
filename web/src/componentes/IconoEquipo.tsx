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
     ese cuadro que el resto (comprobado renderizando los 9 íconos uno
     al lado del otro a 96px con el mismo cuadro delimitador) — se veía
     visiblemente más chico/liviano, no una percepción, una diferencia
     real de cuánto "tinta" tiene cada uno.
   HardHat, Paintbrush y Broom son 100% trazo, sin relleno de fondo, y
   ocupan un porcentaje del cuadro mucho más parecido al resto
   (Wrench/Zap/Flame/etc). */
const ICONOS = {
  "air-vent": AirVent,
  "brick-wall": HardHat,
  "building-2": Building2,
  droplet: Droplet,
  droplets: Droplets,
  flame: Flame,
  "fire-extinguisher": FireExtinguisher,
  hammer: Hammer,
  heater: Heater,
  thermometer: Thermometer,
  waves: Waves,
  home: Home,
  house: House,
  "key-round": KeyRound,
  "paint-roller": Paintbrush,
  sparkles: Broom,
  wind: Wind,
  wrench: Wrench,
  zap: Zap,
} as const;

export type NombreIcono = keyof typeof ICONOS;

export function IconoEquipo({
  nombre,
  className = "w-5 h-5",
}: {
  nombre: string;
  className?: string;
}) {
  const Componente = ICONOS[nombre as NombreIcono] ?? CircleHelp;
  return <Componente className={className} />;
}
