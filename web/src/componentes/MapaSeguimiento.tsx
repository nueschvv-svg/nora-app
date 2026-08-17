"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Radio } from "lucide-react";

/* Mapa de seguimiento en vivo: se ve mientras el técnico está
   "en_camino" y compartiendo ubicación. OpenStreetMap + Leaflet a
   propósito: gratis, sin API key, sin tarjeta — a diferencia de Google
   Maps. Se importa siempre con next/dynamic y ssr:false desde donde se
   usa: Leaflet toca `window` al importar y rompe en el servidor. */

const iconoTecnico = L.divIcon({
  className: "",
  html: `
    <div class="relative w-11 h-11 grid place-items-center">
      <span class="absolute inset-0 rounded-full bg-brand-500/40 animate-ping"></span>
      <span class="relative w-9 h-9 rounded-full bg-brand-600 border-[3px] border-white shadow-fab grid place-items-center text-white text-[16px]">🔧</span>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

function Recentrar({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { duration: 0.8 });
  }, [lat, lng, map]);
  return null;
}

/** "hace un momento" / "hace 4 min" — nada de segundos exactos, no aporta. */
function haceCuanto(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 1) return "justo ahora";
  if (minutos === 1) return "hace 1 min";
  return `hace ${minutos} min`;
}

export function MapaSeguimiento({
  lat,
  lng,
  actualizadoEl,
}: {
  lat: number;
  lng: number;
  /** ISO de la última vez que se supo la posición — para el chip de abajo. Opcional. */
  actualizadoEl?: string | null;
}) {
  return (
    <div className="relative mt-3 rounded-xl3 overflow-hidden border border-line shadow-hero" style={{ height: 300 }}>
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        zoomControl={false}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={[lat, lng]} icon={iconoTecnico} />
        <Recentrar lat={lat} lng={lng} />
      </MapContainer>

      <span className="pointer-events-none absolute top-3 left-3 z-[400] inline-flex items-center gap-1.5 rounded-full bg-ink/80 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-white">
        <span className="w-[7px] h-[7px] rounded-full bg-good live-dot" />
        En vivo
      </span>

      {actualizadoEl && (
        <span className="pointer-events-none absolute bottom-3 left-3 z-[400] inline-flex items-center gap-1.5 rounded-full bg-ink/80 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-white">
          <Radio className="w-3 h-3" />
          Actualizado {haceCuanto(actualizadoEl)}
        </span>
      )}
    </div>
  );
}
