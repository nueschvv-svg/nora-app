"use client";

import { useEffect, useRef, useState } from "react";

const CIRCUNFERENCIA = 326.7; // 2πr con r=52, igual que el prototipo

/** El anillo del score, con el número contando desde 0.
 *  Respeta prefers-reduced-motion: si el usuario pidió menos movimiento,
 *  muestra el valor final directamente en vez de animarlo. */
export function AnilloScore({ valor }: { valor: number }) {
  const [mostrado, setMostrado] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DURACION = reduce ? 0 : 1400;
    const inicio = performance.now();
    const suavizar = (t: number) => 1 - Math.pow(1 - t, 3);

    /* Si el sistema pide menos movimiento, la duración es cero y el primer
       cuadro ya muestra el número final. Sale por el mismo camino en vez de
       tener una rama aparte que asigne el valor de golpe. */
    const paso = (ahora: number) => {
      const p = DURACION === 0 ? 1 : Math.min((ahora - inicio) / DURACION, 1);
      setMostrado(Math.round(suavizar(p) * valor));
      if (p < 1) rafRef.current = requestAnimationFrame(paso);
    };
    rafRef.current = requestAnimationFrame(paso);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [valor]);

  return (
    <div className="relative shrink-0 w-[118px] h-[118px]">
      <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9BE7DA" />
            <stop offset="100%" stopColor="#34A091" />
          </linearGradient>
        </defs>
        <circle cx="62" cy="62" r="52" fill="none" strokeWidth="11" className="ring-track" />
        <circle
          cx="62"
          cy="62"
          r="52"
          fill="none"
          strokeWidth="11"
          className="ring-fill"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - valor / 100)}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center leading-none">
        <span className="num text-[38px] font-extrabold font-display tracking-tight">{mostrado}</span>
        <span className="text-[11px] font-medium text-white/70 mt-1">de 100</span>
      </div>
      <span className="sr-only">Score de salud de la propiedad: {valor} de 100</span>
    </div>
  );
}
