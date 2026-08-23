"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { HeroLlaveCasa } from "./HeroLlaveCasa";

const CLAVE_SESION = "nora:cinema-visto";

/* Primera vez en la sesión (mismo patrón que SplashBienvenida.tsx —
   sessionStorage, no localStorage): la escena completa reacciona al
   scroll — crece, gira, se disuelve. En visitas siguientes de la
   misma sesión, y siempre que el sistema pida "reducir movimiento",
   se muestra el ícono ya armado con una animación de reposo, sin
   pedir scroll.

   La escena arranca como una capa `position: fixed` a pantalla
   completa — tapa TODO, incluida la barra superior y el botón "Pedir
   servicio" (ambos viven fuera de acá, en el layout y en la página),
   no sólo el espacio que ocupa en el documento. El driver de abajo
   (`driverRef`) sigue viviendo en el flujo normal de `main` para que
   scrollearlo avance el progreso; la capa fija sólo lee ese progreso,
   no se mueve ella misma.

   La capa se monta con un portal (`createPortal`) directo a
   `document.body`, no como hijo normal de `main` — probado en vivo:
   `position: fixed` sigue recortada al tamaño de cualquier ancestro
   con `overflow: hidden`/`auto` en el medio (acá hay varios, en el
   layout de la app), aunque su POSICIÓN se calcule respecto al
   viewport. El portal la saca de esa cadena por completo.

   `pointer-events-none` en la capa es OBLIGATORIO, no un detalle: al
   sacarla con el portal, deja de ser descendiente de `main` en el DOM
   real — y como tapa toda la pantalla, cualquier gesto de rueda o
   touch caía sobre ELLA, no sobre `main`, así que el scroll real (no
   el que yo simulaba por código en las pruebas) no hacía nada. Sin
   contenido interactivo adentro, `pointer-events-none` es seguro y
   deja pasar el gesto directo a `main`, que es quien de verdad tiene
   que scrollear. */
export function EscenaCinema() {
  const driverRef = useRef<HTMLDivElement>(null);
  const capaRef = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(false);
  const [modoReposo, setModoReposo] = useState(true);
  const decidido = useRef(false);

  useEffect(() => {
    if (decidido.current) return;
    decidido.current = true;
    if (typeof window === "undefined") return;
    const yaVista = window.sessionStorage.getItem(CLAVE_SESION);
    if (!yaVista) window.sessionStorage.setItem(CLAVE_SESION, "1");
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    Promise.resolve().then(() => {
      setModoReposo(!!yaVista || reducido);
      setListo(true);
    });
  }, []);

  if (!listo) return <div className="h-[46vh] min-h-[320px] escena-fondo" aria-hidden="true" />;

  if (modoReposo) {
    return (
      <div className="relative h-[46vh] min-h-[320px] escena-fondo overflow-hidden grid place-items-center">
        <div className="cinema-reposo">
          <HeroLlaveCasa />
        </div>
      </div>
    );
  }

  return (
    <div ref={driverRef} style={{ height: "165vh" }} aria-hidden="true">
      {createPortal(
        <div
          ref={capaRef}
          className="fixed inset-0 z-[90] pointer-events-none escena-fondo overflow-hidden flex items-center justify-center"
        >
          <div className="grano-escena" />
          <HeroLlaveCasa driverRef={driverRef} capaRef={capaRef} />
          <ChevronDown className="absolute bottom-8 left-1/2 -translate-x-1/2 w-5 h-5 text-brand-200/50 animate-bounce" />
        </div>,
        document.body,
      )}
    </div>
  );
}
