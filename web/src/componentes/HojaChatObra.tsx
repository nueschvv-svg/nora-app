"use client";

import { useEffect, useState } from "react";
import { Users, X } from "lucide-react";
import { HiloChat } from "./HiloChat";
import { enviarMensajeObra, listarMensajesObra, suscribirseAMensajesObra } from "@/lib/obraChat";
import { etiquetaParticipante, participantesDeObra, type ParticipanteObra } from "@/lib/obras";

/* Chat de la obra — dueño y colaboradores (arquitecta, socios). Mismo
   <HiloChat/> que usa el servicio, apuntado a las funciones de
   lib/obraChat.ts en vez de lib/chat.ts — con una diferencia real: acá
   puede haber más de dos personas, así que cada mensaje ajeno necesita
   su firma (nombreDeAutor) y conviene mostrar quién está adentro. */
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
  const [participantes, setParticipantes] = useState<ParticipanteObra[]>([]);

  useEffect(() => {
    if (!abierto || !obraId) return;
    let vivo = true;
    participantesDeObra(obraId)
      .then((p) => {
        if (vivo) setParticipantes(p);
      })
      .catch(() => {
        /* No es crítico: el chat sigue funcionando sin firma si esto falla. */
      });
    return () => {
      vivo = false;
    };
  }, [abierto, obraId]);

  const nombreDeAutor = (autorId: string) => {
    const p = participantes.find((x) => x.usuarioId === autorId);
    if (!p) return undefined;
    const etiqueta = etiquetaParticipante(p);
    return etiqueta ? `${p.nombre} · ${etiqueta}` : p.nombre;
  };

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

          {participantes.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <Users className="w-3.5 h-3.5 text-faint shrink-0" />
              <p className="text-[11.5px] text-faint">
                {participantes
                  .map((p) => {
                    const etiqueta = etiquetaParticipante(p);
                    return etiqueta ? `${p.nombre} (${etiqueta})` : p.nombre;
                  })
                  .join(" · ")}
              </p>
            </div>
          )}

          {obraId && (
            <HiloChat
              idAncla={obraId}
              listar={() => listarMensajesObra(obraId)}
              enviar={(cuerpo) => enviarMensajeObra(obraId, cuerpo)}
              suscribirse={(alLlegar) => suscribirseAMensajesObra(obraId, alLlegar)}
              nombreDeAutor={nombreDeAutor}
            />
          )}
        </div>
      </div>
    </>
  );
}
