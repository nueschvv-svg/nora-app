"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { ChatNora } from "@/componentes/ChatNora";
import { EscenaCinema } from "@/componentes/cinema/EscenaCinema";
import { useModoBienvenida } from "@/componentes/cinema/useModoBienvenida";
import { EsqueletoInicio, ErrorCarga } from "@/componentes/Esqueleto";
import { useApp } from "@/componentes/ContextoApp";
import { saludo } from "@/lib/formato";

export default function PaginaInicio() {
  const { cargando, error, recargar } = useApp();
  const modo = useModoBienvenida();
  const [introTerminada, setIntroTerminada] = useState(false);
  const [expandido, setExpandido] = useState(false);

  // El teclado móvil reduce el área visible sin cambiar siempre 100dvh.
  useEffect(() => {
    const viewport = window.visualViewport;
    const actualizar = () => {
      document.documentElement.style.setProperty("--chat-visible-height", `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty("--chat-visible-top", `${viewport?.offsetTop ?? 0}px`);
    };
    actualizar();
    viewport?.addEventListener("resize", actualizar);
    viewport?.addEventListener("scroll", actualizar);
    return () => {
      viewport?.removeEventListener("resize", actualizar);
      viewport?.removeEventListener("scroll", actualizar);
      document.documentElement.style.removeProperty("--chat-visible-height");
      document.documentElement.style.removeProperty("--chat-visible-top");
    };
  }, []);

  if (modo === "cargando") return <main className="nora-intro-loading" aria-label="Cargando bienvenida" />;
  if (!introTerminada && modo !== "oculto") {
    return <main className="nora-intro-viewport"><EscenaCinema modo={modo} alTerminar={() => setIntroTerminada(true)} /></main>;
  }

  return <main className="nora-conversation-screen" data-expanded={expandido}>
    <AuroraBackground className="nora-conversation-surface">
      <header className="nora-conversation-greeting" hidden={expandido}>
        <p className="nora-eyebrow">ESTAMOS PARA AYUDARTE</p>
        <h1>{saludo()}, contame qué pasa en tu casa.</h1>
      </header>
      <div className="nora-conversation-panel">
        {cargando ? <EsqueletoInicio /> : error ? <ErrorCarga mensaje={error} alReintentar={recargar} /> : <>
          {expandido && <button type="button" className="nora-chat-back" onClick={() => setExpandido(false)} aria-label="Salir de pantalla completa"><ArrowLeft size={20} /></button>}
          <ChatNora alEnviarPrimerMensaje={() => setExpandido(true)} siempreTarjeta={!expandido} />
        </>}
      </div>
    </AuroraBackground>
  </main>;
}
