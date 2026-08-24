"use client";

import { useEffect, useRef, useState } from "react";

const CLAVE_SESION = "nora:cinema-visto";

export type ModoBienvenida = "cargando" | "cinema" | "reposo" | "oculto";

/* Primera vez en la sesión (mismo patrón que SplashBienvenida.tsx —
   sessionStorage, no localStorage): se ve la escena completa
   (scroll-cinema) o, con "reducir movimiento" activado, el logo ya
   armado en reposo, sin pedir scroll.

   En cualquier visita siguiente a /inicio dentro de la misma sesión
   —incluido volver atrás desde /pedir a mitad de un pedido— la
   bienvenida no se repite: se oculta del todo ("oculto") y se va
   directo al saludo y al chat. Repetirla en cada vuelta atrás se
   sentía como quedarse "trabado" en la intro en vez de retomar donde
   uno estaba. */
export function useModoBienvenida(): ModoBienvenida {
  const [modo, setModo] = useState<ModoBienvenida>("cargando");
  const decidido = useRef(false);

  useEffect(() => {
    if (decidido.current) return;
    decidido.current = true;
    if (typeof window === "undefined") return;
    const yaVista = window.sessionStorage.getItem(CLAVE_SESION);
    if (!yaVista) window.sessionStorage.setItem(CLAVE_SESION, "1");
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    Promise.resolve().then(() => {
      if (yaVista) {
        setModo("oculto");
        return;
      }
      setModo(reducido ? "reposo" : "cinema");
    });
  }, []);

  return modo;
}
