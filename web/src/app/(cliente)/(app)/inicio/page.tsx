"use client";

import { ChatNora } from "@/componentes/ChatNora";
import { EscenaCinema } from "@/componentes/cinema/EscenaCinema";
import { EsqueletoInicio, ErrorCarga } from "@/componentes/Esqueleto";
import { useApp } from "@/componentes/ContextoApp";
import { saludo } from "@/lib/formato";

export default function PaginaInicio() {
  const { cargando, error, recargar } = useApp();

  if (cargando) return <EsqueletoInicio />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;

  return (
    <main className="h-full overflow-y-auto no-scrollbar pb-8">
      <EscenaCinema />

      {/* min-h-[65vh] + centrado vertical: la escena se disuelve hacia
          acá, y el pedido concreto era "que el chat quede a mitad de
          pantalla, no abajo del todo". Con el 100dvh completo (probado
          en vivo) quedaba demasiado espacio vacío antes de llegar al
          contenido — 65vh es el punto donde aparece pronto Y centrado,
          sin exigir una pantalla entera de scroll de más. */}
      <div className="min-h-[65vh] flex flex-col justify-center">
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
