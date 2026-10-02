"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Plus } from "lucide-react";
import { LogotipoNora } from "./LogoNora";

export function NavSuperior() {
  const pathname = usePathname();
  return (
    <header className="glass-nav sticky top-0 z-30">
      <nav aria-label="Navegación principal" className="mx-auto flex min-h-20 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-8">
        <Link href="/inicio" className="flex min-h-11 shrink-0 items-center" aria-label="Nora · Inicio" aria-current={pathname === "/inicio" ? "page" : undefined}>
          <LogotipoNora />
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link href="/pedidos" aria-current={pathname === "/pedidos" ? "page" : undefined} className={`flex min-h-11 items-center rounded-xl2 px-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${pathname === "/pedidos" ? "bg-brand-50 text-brand-700" : "text-mute hover:bg-white/60 hover:text-ink"}`}>
            Mis pedidos
          </Link>
          <Link href="/pedir" className="nora-button gap-1.5 px-3 text-xs sm:px-5 sm:text-sm">
            <Plus aria-hidden="true" className="hidden h-4 w-4 sm:block" />
            Pedir<span className="hidden sm:inline"> servicio</span>
          </Link>
          <button type="button" onClick={() => window.dispatchEvent(new Event("nora:abrir-ayuda"))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-white/70 hover:text-brand-600" aria-label="Abrir ayuda">
            <CircleHelp aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </nav>
    </header>
  );
}
