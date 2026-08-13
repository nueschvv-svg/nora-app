import {
  AirVent,
  BrickWall,
  Building2,
  CircleHelp,
  Droplet,
  Droplets,
  FireExtinguisher,
  Flame,
  Hammer,
  Heater,
  Home,
  House,
  KeyRound,
  PaintRoller,
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
const ICONOS = {
  "air-vent": AirVent,
  "brick-wall": BrickWall,
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
  "paint-roller": PaintRoller,
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
