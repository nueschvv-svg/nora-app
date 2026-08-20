"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hammer, History, House, MoreHorizontal, Plus, UserRound } from "lucide-react";
import { LogotipoNora } from "./LogoNora";
import { useApp } from "./ContextoApp";

/* Barra de navegación de arriba — sitio web, no app: los tabs de abajo
   flotando encima del contenido eran el último resabio claro de "esto
   es una app mobile". Una barra fija arriba, con la marca y los
   destinos como links normales, es como se navega un sitio de
   verdad — y de paso queda igual en el celular y en escritorio, sin
   necesitar un layout aparte para cada ancho. */
const DESTINOS = [
  { href: "/inicio", etiqueta: "Inicio", Icono: House },
  { href: "/historial", etiqueta: "Historial", Icono: History },
  { href: "/obras", etiqueta: "Obras", Icono: Hammer },
  { href: "/perfil", etiqueta: "Perfil", Icono: UserRound },
];

export function NavSuperior() {
  const ruta = usePathname();
  const { sesion } = useApp();

  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-xl border-b border-line">
      <div className="flex items-center justify-between gap-3 px-5 h-16">
        <Link href="/inicio" className="shrink-0" aria-label="Ir a inicio">
          <LogotipoNora className="scale-90 origin-left" />
        </Link>

        <nav className="flex items-center gap-1" aria-label="Navegación principal">
          {DESTINOS.map(({ href, etiqueta, Icono }) => {
            const activa = ruta.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={activa ? "page" : undefined}
                className={`press flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold ${
                  activa ? "bg-brand-50 text-brand-600" : "text-mute"
                }`}
              >
                <Icono className="w-[17px] h-[17px]" />
                <span className="hidden sm:inline">{etiqueta}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/pedir"
            className="press hidden sm:flex items-center gap-1.5 rounded-full bg-brand-600 text-white px-4 py-2 text-[13px] font-semibold shadow-fab"
          >
            <Plus className="w-4 h-4" /> Pedir
          </Link>
          <Link
            href="/pedir"
            aria-label="Pedir un servicio"
            className="press sm:hidden w-10 h-10 grid place-items-center rounded-full bg-brand-600 text-white shadow-fab"
          >
            <Plus className="w-[18px] h-[18px]" />
          </Link>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("nora:abrir-ayuda"))}
            className="press w-10 h-10 grid place-items-center rounded-full bg-sand border border-line text-ink"
            aria-label="Más opciones — soporte"
          >
            <MoreHorizontal className="w-[18px] h-[18px]" />
          </button>
          <Link href="/perfil" aria-label="Ir a mi perfil">
            <span className="w-10 h-10 grid place-items-center rounded-full bg-brand-600 text-white font-semibold text-[15px]">
              {sesion?.inicial ?? ""}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
