"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* Mapa de seguimiento en vivo: se ve mientras el técnico está
   "en_camino" y compartiendo ubicación. OpenStreetMap + Leaflet a
   propósito: gratis, sin API key, sin tarjeta — a diferencia de Google
   Maps. Se importa siempre con next/dynamic y ssr:false desde donde se
   usa: Leaflet toca `window` al importar y rompe en el servidor. */

const iconoTecnico = L.divIcon({
  className: "",
  html: `<div class="w-8 h-8 rounded-full bg-brand-600 border-2 border-white shadow-fab grid place-items-center text-white text-[15px]">🔧</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function Recentrar({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { duration: 0.8 });
  }, [lat, lng, map]);
  return null;
}

export function MapaSeguimiento({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="mt-3 rounded-xl2 overflow-hidden border border-line shadow-card" style={{ height: 220 }}>
      <MapContainer
        center={[lat, lng]}
        zoom={15}
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
    </div>
  );
}
