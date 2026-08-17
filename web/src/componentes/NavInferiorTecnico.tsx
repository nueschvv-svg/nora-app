"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, UserRound, Wrench } from "lucide-react";

/* Mismo patrón que NavInferior.tsx (cliente): cada pestaña es una URL
   real, no un tab de estado — así el botón "atrás" del celular
   funciona y el navegador recuerda dónde estabas. El técnico sigue
   siendo cliente de su propia cuenta (ver (tecnico)/layout.tsx), así
   que "Inicio" y "Perfil" lo llevan de vuelta a esas pantallas
   normales; "Trabajos" es la única pantalla nueva de este modo. */
const PESTANAS = [
  { href: "/tecnico", etiqueta: "Trabajos", Icono: Wrench },
  { href: "/inicio", etiqueta: "Inicio", Icono: House },
  { href: "/perfil", etiqueta: "Perfil", Icono: UserRound },
];

export function NavInferiorTecnico() {
  const ruta = usePathname();

  return (
    <nav className="absolute bottom-0 inset-x-0 z-30" aria-label="Navegación de técnico">
      <div className="relative mx-auto max-w-[440px] bg-surface/90 backdrop-blur-xl border-t border-line shadow-nav px-8 pb-6 pt-3">
        <div className="flex items-center justify-between">
          {PESTANAS.map((p) => (
            <Pestana key={p.href} {...p} activa={ruta.startsWith(p.href)} />
          ))}
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
      className={`flex flex-col items-center gap-1 w-16 ${activa ? "text-brand-600" : "text-faint"}`}
    >
      <Icono className="w-[22px] h-[22px]" />
      <span className={`text-[10.5px] ${activa ? "font-semibold" : "font-medium"}`}>{etiqueta}</span>
    </Link>
  );
}
