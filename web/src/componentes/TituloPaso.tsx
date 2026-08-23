"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/* Título de cada paso del wizard de /pedir (y de la confirmación).
   Reveal simple con GSAP (fade + deslizamiento vertical corto) — mismo
   espíritu que `.entra-suave` en globals.css, puntual para el título,
   que es lo primero que lee la persona en cada paso.

   Probé primero con SplitText partiendo por líneas, pero estos títulos
   traen <br /> a mano (dos líneas fijas) y SplitText reflowa esas
   líneas en divs propios — el resultado se superponía con el párrafo
   de abajo. Animar el bloque completo evita ese problema por completo
   y para dos líneas cortas se ve prácticamente igual.

   Se reanima cada vez que cambia `children` porque en este wizard cada
   paso desmonta la sección anterior y monta una nueva (ver PaginaPedir)
   — no hay reconciliación parcial de texto que confundir. */
export function TituloPaso({
  children,
  className = "text-[22px] font-bold font-display text-ink leading-tight",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" });
  }, [children]);

  return (
    <h1 ref={ref} className={className}>
      {children}
    </h1>
  );
}
