"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hammer, History, House, Plus, UserRound } from "lucide-react";

/* A diferencia del prototipo, cada pestaña es una URL real.
   Eso arregla el botón "atrás" del celular, permite compartir links
   y hace que el navegador recuerde dónde estabas. */
const PESTANAS = [
  { href: "/inicio", etiqueta: "Inicio", Icono: House },
  { href: "/historial", etiqueta: "Historial", Icono: History },
  { href: "/obras", etiqueta: "Obras", Icono: Hammer },
  { href: "/perfil", etiqueta: "Perfil", Icono: UserRound },
];

export function NavInferior() {
  const ruta = usePathname();

  return (
    <nav
      className="absolute bottom-0 inset-x-0 z-30"
      aria-label="Navegación principal"
    >
      <div className="relative mx-auto max-w-[440px] bg-surface/90 backdrop-blur-xl border-t border-line shadow-nav px-6 pb-6 pt-2.5">
        <div className="flex items-end justify-between">
          <Pestana {...PESTANAS[0]} activa={ruta.startsWith("/inicio")} />
          <Pestana {...PESTANAS[1]} activa={ruta.startsWith("/historial")} />

          <div className="w-14 flex justify-center">
            <Link
              href="/pedir"
              className="press -mt-8 w-16 h-16 grid place-items-center rounded-full bg-brand-600 text-white shadow-fab ring-4 ring-sand"
              aria-label="Pedir un servicio"
            >
              <Plus className="w-7 h-7" strokeWidth={2.2} />
            </Link>
          </div>

          <Pestana {...PESTANAS[2]} activa={ruta.startsWith("/obras")} />
          <Pestana {...PESTANAS[3]} activa={ruta.startsWith("/perfil")} />
        </div>
      </div>
    </nav>
  );
}

function Pestana({
  href,
  etiqueta,
  Icono,
  activa,
}: {
  href: string;
  etiqueta: string;
  Icono: React.ComponentType<{ className?: string }>;
  activa: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={activa ? "page" : undefined}
      aria-label={etiqueta}
      className={`flex flex-col items-center gap-1 w-14 ${activa ? "text-brand-600" : "text-faint"}`}
    >
      <Icono className="w-[22px] h-[22px]" />
      <span className={`text-[10.5px] ${activa ? "font-semibold" : "font-medium"}`}>{etiqueta}</span>
    </Link>
  );
}
