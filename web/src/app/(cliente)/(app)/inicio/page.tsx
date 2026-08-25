"use client";

import { useLayoutEffect, useRef } from "react";
import { ChatNora } from "@/componentes/ChatNora";
import { EscenaCinema } from "@/componentes/cinema/EscenaCinema";
import { useModoBienvenida } from "@/componentes/cinema/useModoBienvenida";
import { EsqueletoInicio, ErrorCarga } from "@/componentes/Esqueleto";
import { useApp } from "@/componentes/ContextoApp";
import { saludo } from "@/lib/formato";

export default function PaginaInicio() {
  const { cargando, error, recargar } = useApp();
  const mainRef = useRef<HTMLElement>(null);
  const modoBienvenida = useModoBienvenida();

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

  /* "cinema" (primera visita real, sin reducir movimiento) es el único
     modo que todavía necesita que `main` scrollee de verdad — es el
     mecanismo que mueve la escena (ver EscenaCinema). Ahí el chat
     sigue viviendo en una tarjeta de alto fijo debajo del saludo,
     como antes.

     "reposo" y "oculto" no dependen de ese scroll para nada. Ahí el
     chat pasa a ocupar TODA la pantalla, como una app de mensajería:
     antes vivía en una tarjeta acotada (alto máximo de 360px para los
     mensajes) con un saludo aparte arriba — en el celular eso dejaba
     un montón de aire vacío abajo, y en desktop se veía como una tira
     angosta perdida en medio de una pantalla enorme. Acá `main` deja
     de scrollear la PÁGINA (`overflow-hidden flex flex-col`) y el
     chat se lleva todo el alto disponible (`flex-1 min-h-0` dentro de
     ChatNora) con su propio scroll interno. El saludo aparte ya no
     hace falta — el chat mismo saluda apenas abre, y WhatsApp tampoco
     pone un cartel de bienvenida arriba de la conversación. */
  if (modoBienvenida === "cinema") {
    return (
      <main ref={mainRef} className="h-full overflow-y-auto no-scrollbar pb-8">
        <EscenaCinema modo={modoBienvenida} />

        <div className="pt-[18vh]">
          <div className="max-w-xl mx-auto w-full px-5">
            <header className="pb-2">
              <h1 className="text-[23px] font-bold font-display text-ink leading-tight">
                {saludo()}, será un placer ayudarte
              </h1>
            </header>
            <div className="h-[480px]">
              <ChatNora />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main ref={mainRef} className="h-full overflow-hidden flex flex-col">
      {modoBienvenida === "reposo" && (
        <div className="shrink-0">
          <EscenaCinema modo={modoBienvenida} />
        </div>
      )}
      <div className="flex-1 min-h-0 sm:max-w-xl sm:mx-auto sm:w-full sm:py-4 sm:px-5">
        <ChatNora />
      </div>
    </main>
  );
}
