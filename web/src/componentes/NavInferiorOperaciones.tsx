"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ClipboardList, UserCheck } from "lucide-react";
import { listarSolicitudesTecnico } from "@/lib/operaciones";

/* Mismo patrón que NavInferior.tsx / NavInferiorTecnico.tsx. Vive en
   el layout (persiste entre navegaciones), así que el conteo de
   solicitudes pendientes se pide una sola vez acá — la pantalla de
   pedidos ya no necesita el suyo propio para el banner que tenía. */
export function NavInferiorOperaciones() {
  const ruta = usePathname();
  const [solicitudes, setSolicitudes] = useState(0);

  useEffect(() => {
    let vivo = true;
    listarSolicitudesTecnico()
      .then((s) => {
        if (vivo) setSolicitudes(s.length);
      })
      .catch(() => {
        /* No es crítico: el tab sigue andando sin el contador. */
      });
    return () => {
      vivo = false;
    };
  }, [ruta]);

  return (
    <nav className="absolute bottom-0 inset-x-0 z-30" aria-label="Navegación de operaciones">
      <div className="relative mx-auto max-w-[440px] bg-surface/90 backdrop-blur-xl border-t border-line shadow-nav px-8 pb-6 pt-3">
        <div className="flex items-center justify-around">
          <Pestana
            href="/operaciones"
            etiqueta="Pedidos"
            Icono={ClipboardList}
            activa={ruta === "/operaciones" || /^\/operaciones\/[^/]+$/.test(ruta)}
          />
          <Pestana
            href="/operaciones/tecnicos"
            etiqueta="Verificaciones"
            Icono={UserCheck}
            activa={ruta.startsWith("/operaciones/tecnicos")}
            contador={solicitudes}
          />
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
  contador,
}: {
  href: string;
  etiqueta: string;
  Icono: React.ComponentType<{ className?: string }>;
  activa: boolean;
  contador?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={activa ? "page" : undefined}
      aria-label={contador ? `${etiqueta}, ${contador} pendientes` : etiqueta}
      className={`relative flex flex-col items-center gap-1 w-20 ${activa ? "text-brand-600" : "text-faint"}`}
    >
      <span className="relative">
        <Icono className="w-[22px] h-[22px]" />
        {!!contador && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-urgent text-white text-[9.5px] font-bold">
            {contador}
          </span>
        )}
      </span>
      <span className={`text-[10.5px] ${activa ? "font-semibold" : "font-medium"}`}>{etiqueta}</span>
    </Link>
  );
}
