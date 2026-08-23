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
