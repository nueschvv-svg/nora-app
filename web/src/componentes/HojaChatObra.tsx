"use client";

import { X } from "lucide-react";
import { HiloChat } from "./HiloChat";
import { enviarMensajeObra, listarMensajesObra, suscribirseAMensajesObra } from "@/lib/obraChat";

/* Chat de la obra — dueño y colaboradores (arquitecta, socios). Mismo
   <HiloChat/> que usa el servicio, apuntado a las funciones de
   lib/obraChat.ts en vez de lib/chat.ts. */
export function HojaChatObra({
  abierto,
  alCerrar,
  obraId,
  nombreObra,
}: {
  abierto: boolean;
  alCerrar: () => void;
  obraId: string | null;
  nombreObra: string;
}) {
  return (
    <>
      <div
        onClick={alCerrar}
        className={`absolute inset-0 z-[55] bg-black/40 transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chat de la obra"
        className={`absolute bottom-0 inset-x-0 z-[56] bg-sand rounded-t-[26px] shadow-sheet max-h-[80%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <div className="px-5 pt-3 pb-8">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold font-display text-ink">Chat de la obra</h2>
              <p className="text-[12.5px] text-mute mt-0.5 truncate max-w-[260px]">{nombreObra}</p>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              className="press shrink-0 w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {obraId && (
            <HiloChat
              idAncla={obraId}
              listar={() => listarMensajesObra(obraId)}
              enviar={(cuerpo) => enviarMensajeObra(obraId, cuerpo)}
              suscribirse={(alLlegar) => suscribirseAMensajesObra(obraId, alLlegar)}
            />
          )}
        </div>
      </div>
    </>
  );
}
