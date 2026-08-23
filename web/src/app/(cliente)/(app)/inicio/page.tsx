"use client";

import { useLayoutEffect, useRef } from "react";
import { ChatNora } from "@/componentes/ChatNora";
import { EscenaCinema } from "@/componentes/cinema/EscenaCinema";
import { EsqueletoInicio, ErrorCarga } from "@/componentes/Esqueleto";
import { useApp } from "@/componentes/ContextoApp";
import { saludo } from "@/lib/formato";

export default function PaginaInicio() {
  const { cargando, error, recargar } = useApp();
  const mainRef = useRef<HTMLElement>(null);

  /* Safari (a diferencia de Chrome) restaura la posición de scroll de
     contenedores internos —no sólo de la ventana— al recargar la
     misma pestaña (Cmd/Ctrl+R). Como EscenaCinema decide qué mostrar
     según en qué posición de scroll está `main`, si arranca en una
     posición vieja en vez de cero, la escena queda a mitad de camino
     en vez de mostrar el estado inicial. Forzamos scroll cero acá
     apenas `main` existe, pisando lo que haya restaurado el navegador.
     Depende de `cargando` (no []) porque `main` recién se monta cuando
     termina de cargar — antes de eso la ref todavía es null. */
  useLayoutEffect(() => {
    if (cargando) return;
    mainRef.current?.scrollTo(0, 0);
  }, [cargando]);

  if (cargando) return <EsqueletoInicio />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;

  return (
    <main ref={mainRef} className="h-full overflow-y-auto no-scrollbar pb-8">
      <EscenaCinema />

      {/* pt-[18vh] fijo, no centrado con flex: `justify-center`
          recalculaba la posición cada vez que el chat crecía en alto
          (cada mensaje nuevo, hasta llegar a su tope de 360px) — el
          bloque entero saltaba de lugar mientras alguien escribía. Un
          padding fijo pone el saludo a una altura razonable UNA sola
          vez y ya no se mueve nunca más, sin importar cuánto crezca
          la conversación. */}
      <div className="pt-[18vh]">
        <header className="px-5 pb-2">
          <h1 className="text-[23px] font-bold font-display text-ink leading-tight">
            {saludo()}, será un placer ayudarte
          </h1>
        </header>

        <div className="px-5 space-y-3.5">
          {/* --- El chat: puerta de entrada para pedir un servicio --- */}
          <ChatNora />
        </div>
      </div>
    </main>
  );
}
