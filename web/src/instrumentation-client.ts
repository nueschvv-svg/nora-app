/* Sentry — captura de errores del navegador (cliente). Corre antes
   de la hidratación de React. Ver src/instrumentation.ts para el
   lado del servidor. */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  /* Grabación de sesión sólo cuando hay un error — no graba todo el
     tráfico, así no se come la cuota gratuita de un saque. */
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
  integrations: [Sentry.replayIntegration()],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
