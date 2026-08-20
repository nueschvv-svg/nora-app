"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { LogotipoNora } from "./LogoNora";

/* Barra de arriba, mínima: la app es un solo flujo (pedir un
   servicio) — no hay más secciones entre las que navegar. Sólo queda
   la marca (lleva a Inicio, es "empezar de nuevo" en los hechos) y el
   acceso a soporte. */
export function NavSuperior() {
  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-xl border-b border-line">
      <div className="flex items-center justify-between gap-3 px-5 h-16">
        <Link href="/inicio" className="shrink-0" aria-label="Ir a inicio">
          <LogotipoNora className="scale-90 origin-left" />
        </Link>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("nora:abrir-ayuda"))}
          className="press w-10 h-10 grid place-items-center rounded-full bg-sand border border-line text-ink"
          aria-label="Ayuda"
        >
          <MoreHorizontal className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}
