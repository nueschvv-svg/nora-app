import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* Oculta el botoncito de herramientas de Next en desarrollo:
     tapaba la barra de navegación al revisar las pantallas.
     No afecta a producción. */
  devIndicators: false,
  /* config options here */
};

/* Sin org/project/authToken todavía: sin eso, Sentry igual recibe
   los errores (lo que importa para enterarnos si algo se rompe), sólo
   que los stack traces del build minificado no se traducen al código
   fuente. Se puede sumar después sin tocar nada de esto. */
export default withSentryConfig(nextConfig, {
  silent: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
