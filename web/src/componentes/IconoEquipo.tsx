import {
  AirVent,
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
  Sparkles,
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
/* "brick-wall" y "paint-roller" son los slugs guardados en la base
   (columna `icono` de categorías) — no se tocan para no requerir una
   migración. Lo que cambió es a qué ícono apuntan: BrickWall y
   PaintRoller traen cada uno un <rect> grande de fondo (ver Lucide),
   así que entre íconos de puro trazo se leían más "en caja"/pesados
   que el resto — se notaba de verdad, un usuario probando la grilla
   de rubros lo marcó. HardHat y Paintbrush son 100% trazo, sin relleno
   de fondo, y quedan parejos con Wrench/Zap/Flame/etc. */
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
  sparkles: Sparkles,
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
