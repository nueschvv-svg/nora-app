"use client";

import { NavInferior } from "@/componentes/NavInferior";
import { BotNora } from "@/componentes/BotNora";
import { SplashBienvenida } from "@/componentes/SplashBienvenida";
import { useApp } from "@/componentes/ContextoApp";

/* Sitio web, no mockup de app: en el celular ocupa todo el ancho; en
   pantallas grandes queda una columna centrada de lectura cómoda, sin
   sombra de "dispositivo flotando" ni fondo distinto detrás.
   Uso dvh y no vh: en Safari de iPhone, vh queda tapado por la
   barra de direcciones y se come la navegación de abajo.

   La sesión, el chequeo de operaciones y <ProveedorApp> ya los resuelve
   el layout padre (cliente)/layout.tsx, compartido con (flujo) — acá
   sólo queda el marco visual propio de este grupo: nav inferior, bot,
   y la pantalla de bienvenida (que necesita el nombre de la sesión,
   por eso este layout ahora es client component). */
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  const { sesion } = useApp();

  return (
    <div className="relative w-full max-w-[440px] mx-auto h-dvh bg-sand overflow-hidden">
      {children}
      <BotNora />
      <NavInferior />
      <SplashBienvenida nombre={sesion?.nombre?.split(" ")[0]} />
    </div>
  );
}
