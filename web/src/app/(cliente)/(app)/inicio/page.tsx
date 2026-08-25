"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatNora } from "@/componentes/ChatNora";
import { EscenaCinema } from "@/componentes/cinema/EscenaCinema";
import { useModoBienvenida } from "@/componentes/cinema/useModoBienvenida";
import { EsqueletoInicio, ErrorCarga } from "@/componentes/Esqueleto";
import { useApp } from "@/componentes/ContextoApp";
import { saludo } from "@/lib/formato";

export default function PaginaInicio() {
  const { cargando, error, recargar } = useApp();
  const mainRef = useRef<HTMLElement>(null);
  const chatWrapRef = useRef<HTMLDivElement>(null);
  const modoBienvenida = useModoBienvenida();

  /* Primera visita: el chat arranca como la tarjeta chica de siempre,
     con el saludo arriba — recién cuando la persona manda su propio
     primer mensaje (no antes, no automático) la tarjeta se agranda
     hasta ocupar toda la pantalla y el saludo se pliega. Pedido
     explícito: no arrancar ya expandido, que sea una reacción a
     empezar a usarlo de verdad. */
  const [expandido, setExpandido] = useState(false);

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

  /* Al expandirse, el saludo se pliega y la tarjeta crece — eso mueve
     todo el contenido de lugar. Sin este scroll, la persona se queda
     mirando la mitad de la conversación mientras la tarjeta terminó
     de crecer más abajo. Espera a que termine la transición CSS
     (500ms, ver más abajo) antes de medir dónde quedó el final real.

     Apunta al offsetTop real de la tarjeta, no a `main.scrollHeight`
     (el máximo posible) — probado en vivo: con el `pb-8` de `main`
     sumando aire de sobra al final, scrollear al máximo se pasaba un
     poco y el encabezado del chat quedaba tapado arriba, cortado. */
  useEffect(() => {
    if (!expandido) return;
    const id = setTimeout(() => {
      const main = mainRef.current;
      const wrap = chatWrapRef.current;
      if (main && wrap) main.scrollTo({ top: wrap.offsetTop, behavior: "smooth" });
    }, 520);
    return () => clearTimeout(id);
  }, [expandido]);

  if (cargando) return <EsqueletoInicio />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;

  /* "cinema" (primera visita real, sin reducir movimiento) es el único
     modo que todavía necesita que `main` scrollee de verdad — es el
     mecanismo que mueve la escena (ver EscenaCinema). Ahí el chat
     arranca como tarjeta chica y se agranda al primer mensaje (ver
     `expandido` arriba).

     "reposo" y "oculto" no dependen de ese scroll para nada. Ahí el
     chat pasa a ocupar TODA la pantalla desde que se entra, como una
     app de mensajería: antes vivía en una tarjeta acotada (alto
     máximo de 360px para los mensajes) con un saludo aparte arriba —
     en el celular eso dejaba un montón de aire vacío abajo, y en
     desktop se veía como una tira angosta perdida en medio de una
     pantalla enorme. Acá `main` deja de scrollear la PÁGINA
     (`overflow-hidden flex flex-col`) y el chat se lleva todo el alto
     disponible (`flex-1 min-h-0` dentro de ChatNora) con su propio
     scroll interno. El saludo aparte ya no hace falta — el chat mismo
     saluda apenas abre, y WhatsApp tampoco pone un cartel de
     bienvenida arriba de la conversación. */
  if (modoBienvenida === "cinema") {
    return (
      <main ref={mainRef} className="h-full overflow-y-auto no-scrollbar pb-8">
        <EscenaCinema modo={modoBienvenida} />

        <div className={`transition-[padding-top] duration-500 ease-out ${expandido ? "pt-0" : "pt-[18vh]"}`}>
          <header
            className={`max-w-xl mx-auto w-full px-5 overflow-hidden transition-[max-height,opacity,padding] duration-500 ease-out ${
              expandido ? "max-h-0 opacity-0 pb-0" : "max-h-24 opacity-100 pb-2"
            }`}
          >
            <h1 className="text-[23px] font-bold font-display text-ink leading-tight">
              {saludo()}, será un placer ayudarte
            </h1>
          </header>
          {/* Antes de expandirse, la tarjeta va adentro de la misma
              columna angosta que el saludo (px-5, alineada con el
              título). Al expandirse en el celular, sale de esa
              columna y pasa a ocupar el ancho entero (sin padding) —
              recién desde `sm:` mantiene la columna, porque ahí sí
              hay lugar de sobra alrededor. */}
          <div
            ref={chatWrapRef}
            className={`transition-[height,padding] duration-500 ease-out ${
              expandido
                ? "h-[calc(100dvh-4rem)] px-0 sm:max-w-xl sm:mx-auto sm:px-5"
                : "h-[480px] max-w-xl mx-auto px-5"
            }`}
          >
            <ChatNora alEnviarPrimerMensaje={() => setExpandido(true)} siempreTarjeta={!expandido} />
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
