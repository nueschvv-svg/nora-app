"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { HeroLlaveCasa } from "./HeroLlaveCasa";
import type { ModoBienvenida } from "./useModoBienvenida";

/* `modo` llega por prop, decidido una sola vez en PaginaInicio con
   useModoBienvenida — no se vuelve a leer sessionStorage acá. Dos
   instancias del hook (una por componente) pisarían el resultado de
   la otra: la primera en correr marca la sesión como "ya vista" antes
   de que la segunda lea el flag, así que la segunda vería siempre
   "oculto", incluso en la primera visita real. Con un único dueño del
   estado (PaginaInicio) y esta pasándolo por prop, no hay carrera.

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
export function EscenaCinema({ modo }: { modo: ModoBienvenida }) {
  const driverRef = useRef<HTMLDivElement>(null);
  const capaRef = useRef<HTMLDivElement>(null);

  /* El placeholder y el modo reposo NO fijan una altura (antes era
     `h-[46vh] min-h-[320px]` con `overflow-hidden` + centrado) —
     probado en vivo en producción: en pantallas anchas el saludo + el
     logo (que crecen de tamaño en el corte "sm:") miden más que esa
     caja, y con overflow-hidden + place-items-center el contenido se
     recorta arriba Y abajo por igual — el "BIENVENIDO A" quedaba
     literalmente comido, no tapado por la barra de arriba como
     parecía. Con py-16 en vez de una altura fija, la caja se ajusta
     sola al contenido — nunca se recorta, sin importar el tamaño de
     pantalla ni el idioma/tamaño de fuente. */
  if (modo === "cargando") return <div className="min-h-[320px] escena-fondo" aria-hidden="true" />;

  if (modo === "oculto") return null;

  if (modo === "reposo") {
    return (
      <div className="escena-fondo py-16 grid place-items-center">
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
