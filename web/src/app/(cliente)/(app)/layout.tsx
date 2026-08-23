"use client";

import { usePathname } from "next/navigation";
import { NavSuperior } from "@/componentes/NavSuperior";
import { BotNora } from "@/componentes/BotNora";
import { SplashBienvenida } from "@/componentes/SplashBienvenida";
import { useApp } from "@/componentes/ContextoApp";

/* Sitio web, no mockup de app: ocupa TODO el ancho de la pantalla, sin
   columna angosta centrada ni sombra de "dispositivo flotando", y la
   navegación es una barra fija ARRIBA (NavSuperior) — no una fila de
   iconos flotando abajo, que era el último resabio de "app mobile".

   La barra mide una altura fija (h-16, ver NavSuperior); el resto del
   alto disponible se lo lleva el contenido. Por eso {children} vive
   adentro de un contenedor con su propio overflow-hidden: cada
   pantalla adentro ya no puede usar h-dvh para su propio scroll (se
   pasaría del alto real disponible) — usan h-full en cambio.
   Uso dvh y no vh en el contenedor de afuera: en Safari de iPhone, vh
   queda tapado por la barra de direcciones.

   La sesión, el chequeo de operaciones y <ProveedorApp> ya los resuelve
   el layout padre (cliente)/layout.tsx, compartido con (flujo) — acá
   sólo queda el marco visual propio de este grupo. */
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  const { sesion } = useApp();
  /* /inicio ya tiene su propio momento de bienvenida — la escena
     cinema del hero, con su propio "Bienvenido a Nora" en pantalla
     completa. Mostrar ADEMÁS este splash ahí encimaría dos pantallas
     de bienvenida compitiendo entre sí la primera vez que alguien
     entra en la sesión. En el resto de las pantallas (alguien que
     entra directo a /inicio/agenda por un link, por ejemplo) el splash
     sigue cumpliendo su rol de siempre. */
  const enInicio = usePathname() === "/inicio";

  return (
    <div className="relative w-full h-dvh bg-sand overflow-hidden flex flex-col">
      <NavSuperior />
      <div className="relative flex-1 overflow-hidden">{children}</div>
      <BotNora />
      {!enInicio && <SplashBienvenida nombre={sesion?.nombre?.split(" ")[0]} />}
    </div>
  );
}
