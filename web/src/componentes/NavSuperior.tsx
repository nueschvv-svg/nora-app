"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { LogotipoNora } from "./LogoNora";

/* Barra de arriba: la marca (lleva a Inicio), el acceso directo a
   pedir un servicio, y soporte. "Pedir servicio" vive ACÁ, en la
   misma línea del logo, no como pastilla flotante aparte — así queda
   disponible en todas las pantallas de (app) (Inicio, Agenda, Score),
   no sólo en Inicio, y no compite por su propio espacio en cada una. */
export function NavSuperior() {
  return (
    <header className="glass-nav sticky top-0 z-30">
      <div className="grid grid-cols-3 items-center gap-3 px-5 h-16">
        <Link
          href="/pedir"
          className="press justify-self-start w-fit flex items-center gap-1 rounded-full bg-brand-600 text-white pl-3 pr-2.5 py-2 text-[12.5px] font-semibold shadow-fab"
        >
          Pedir
        </Link>

        <Link href="/inicio" className="justify-self-center" aria-label="Ir a inicio">
          <LogotipoNora className="scale-90" />
        </Link>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("nora:abrir-ayuda"))}
          className="press justify-self-end w-10 h-10 grid place-items-center rounded-full bg-sand border border-line text-ink"
          aria-label="Ayuda"
        >
          <MoreHorizontal className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}
