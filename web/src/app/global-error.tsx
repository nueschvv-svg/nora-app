"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/* Red de contención final: si algo revienta tan fuerte que ni el
   layout normal puede renderizar, esto es lo único que queda en pie.
   Reporta a Sentry y ofrece recargar — nunca una pantalla en blanco. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es-AR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 32px",
            background: "#f2f0ea",
            color: "#16211f",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, color: "#5b6b68", marginTop: 8, maxWidth: 280 }}>
            Ya nos enteramos y lo estamos mirando. Probá de nuevo en un momento.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#0e5c54",
              color: "#fff",
              border: "none",
              borderRadius: 14,
              padding: "14px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
