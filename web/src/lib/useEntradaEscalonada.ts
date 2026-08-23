"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/** Ref para un contenedor cuyos hijos directos entran escalonados con
 *  GSAP la primera vez que `listo` pasa a true (p.ej. cuando terminó
 *  de cargar la lista que muestra) — no en cada re-render mientras la
 *  lista ya está montada. Respeta prefers-reduced-motion (además del
 *  bloque global de globals.css, que mata cualquier animación CSS,
 *  esto evita directamente lanzar la animación de GSAP). */
export function useEntradaEscalonada<T extends HTMLElement>(listo: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !listo || el.children.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from(el.children, { opacity: 0, y: 12, duration: 0.35, stagger: 0.045, ease: "power2.out" });
  }, [listo]);

  return ref;
}
