"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  AirVent,
  BrickWall,
  Flame,
  Hammer,
  KeyRound,
  PaintRoller,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { IsotipoNora } from "@/componentes/LogoNora";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/* Las 9 categorías reales de /pedir (mismo set e íconos que
   IconoEquipo.tsx) orbitando el logo — no una tarjeta inventada de
   "técnico en camino": ese seguimiento en vivo no está en uso, se
   coordina por WhatsApp después del pedido. Acá sólo va el logo. */
const CATEGORIAS: { Icono: LucideIcon; angulo: number }[] = [
  { Icono: Wrench, angulo: 0 }, // Plomería
  { Icono: Zap, angulo: 40 }, // Electricidad
  { Icono: KeyRound, angulo: 80 }, // Cerrajería
  { Icono: Flame, angulo: 120 }, // Gas
  { Icono: AirVent, angulo: 160 }, // Aire acondicionado
  { Icono: PaintRoller, angulo: 200 }, // Pintura
  { Icono: Hammer, angulo: 240 }, // Carpintería
  { Icono: BrickWall, angulo: 280 }, // Albañilería
  { Icono: Sparkles, angulo: 320 }, // Limpieza
];

const RADIO_MAX = 128; // px, antes de aplicar la escala del contenedor

/* Curva sobre el progreso 0→1 del scroll:
   0.00–0.18  bienvenida: el saludo está en pantalla, el logo en su
              tamaño base, nada orbitando todavía.
   0.18–0.80  crecimiento: el logo crece, las categorías emergen y
              giran en órbita a su alrededor.
   0.80–1.00  sostenido — EscenaCinema disuelve TODA la capa hacia el
              final (ver capaRef), no este componente. */
function faseOrbita(progreso: number) {
  if (progreso <= 0.18) return 0;
  if (progreso >= 0.8) return 1;
  return (progreso - 0.18) / (0.8 - 0.18);
}

function contenedorScrolleable(el: HTMLElement | null): HTMLElement | null {
  let nodo = el?.parentElement ?? null;
  while (nodo) {
    if (/(auto|scroll)/.test(getComputedStyle(nodo).overflowY)) return nodo;
    nodo = nodo.parentElement;
  }
  return null; // null = window
}

export function HeroLlaveCasa({
  driverRef,
  capaRef,
}: {
  driverRef?: React.RefObject<HTMLDivElement | null>;
  capaRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const raizRef = useRef<HTMLDivElement>(null);
  const saludoRef = useRef<HTMLDivElement>(null);
  const satelitesRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const driver = driverRef?.current;
    if (!driver) return;

    const scroller = contenedorScrolleable(driver);

    const st = ScrollTrigger.create({
      trigger: driver,
      scroller: scroller ?? undefined,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.35,
      onUpdate: (self) => {
        const p = self.progress;
        const orbita = faseOrbita(p);
        const giro = p * 150;
        const escala = 0.85 + orbita * 0.75;

        gsap.set(raizRef.current, { scale: escala });
        gsap.set(saludoRef.current, { opacity: 1 - Math.min(1, p / 0.22), y: -orbita * 14 });

        satelitesRef.current.forEach((nodo, i) => {
          if (!nodo) return;
          const rad = ((CATEGORIAS[i].angulo + giro) * Math.PI) / 180;
          gsap.set(nodo, {
            x: Math.cos(rad) * orbita * RADIO_MAX,
            y: Math.sin(rad) * orbita * RADIO_MAX,
            opacity: orbita,
          });
        });

        if (capaRef?.current) {
          /* Difuminación real hacia el chat, no un simple fundido de
             opacidad: el blur crece junto con la transparencia en el
             último tramo del scroll, así se lee como una disolución,
             no como un corte. */
          const t = p <= 0.75 ? 0 : (p - 0.75) / 0.25;
          gsap.set(capaRef.current, { opacity: 1 - t, filter: `blur(${t * 22}px)` });
        }
      },
    });

    return () => st.kill();
  }, [driverRef, capaRef]);

  return (
    <div className="relative flex flex-col items-center gap-10 px-6" aria-hidden="true">
      <div ref={saludoRef} className="text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-brand-100/80">
          Bienvenido a
        </p>
        <h2 className="mt-1.5 text-[34px] sm:text-[42px] font-bold font-display text-white leading-none">
          nora
        </h2>
        <p className="mt-2.5 text-[14.5px] text-brand-50/90 max-w-[260px] mx-auto leading-snug">
          Un solo lugar para resolver lo que necesite tu casa.
        </p>
      </div>

      <div ref={raizRef} className="relative w-[220px] h-[220px] sm:w-[260px] sm:h-[260px]">
        <div
          className="absolute inset-0 m-auto w-[46%] h-[46%]"
          style={{ filter: "drop-shadow(0 0 24px rgba(20,133,122,.55))" }}
        >
          <IsotipoNora className="w-full h-full" variante="oscuro" />
        </div>

        {CATEGORIAS.map(({ Icono }, i) => (
          <div
            key={i}
            ref={(nodo) => {
              satelitesRef.current[i] = nodo;
            }}
            className="absolute left-1/2 top-1/2 grid place-items-center w-10 h-10 -ml-5 -mt-5 rounded-full opacity-0"
            style={{
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 8px 20px -6px rgba(0,0,0,0.35)",
            }}
          >
            <Icono className="w-[18px] h-[18px] text-white" strokeWidth={1.75} />
          </div>
        ))}
      </div>
    </div>
  );
}
