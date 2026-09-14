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
      <div className="flex items-center justify-between gap-2 px-3 h-16">
        <Link
          href="/pedir"
          className="press min-h-11 flex items-center rounded-full bg-brand-600 text-white px-3 text-[12.5px] font-semibold shadow-fab"
        >
          Pedir
        </Link>

        <Link href="/pedidos" className="min-h-11 flex items-center px-2 text-[13px] font-semibold text-brand-600">Mis pedidos</Link>

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
