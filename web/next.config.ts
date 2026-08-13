import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Oculta el botoncito de herramientas de Next en desarrollo:
     tapaba la barra de navegación al revisar las pantallas.
     No afecta a producción. */
  devIndicators: false,
  /* config options here */
};

export default nextConfig;
