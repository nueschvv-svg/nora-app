"use client";

import { useState } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import { linkInvitacionObra } from "@/lib/obras";

/* Un solo link por obra — se lo pasás a la arquitecta, a un socio, a
   quien tenga que estar. Cualquiera que lo abra y tenga cuenta en Nora
   se suma como colaborador (unirse_a_obra(), ver
   db/29_obras_colaboracion.sql). Mismo patrón de hoja que el resto de
   la app. */
export function HojaInvitarObra({
  abierto,
  alCerrar,
  nombreObra,
  codigo,
}: {
  abierto: boolean;
  alCerrar: () => void;
  nombreObra: string;
  codigo: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const link = codigo ? linkInvitacionObra(codigo) : "";

  // Mismo criterio que el reset de FormularioPropiedad/FormularioObra:
  // durante el render, no en un efecto — evita el parpadeo de un
  // segundo render y el problema de setState síncrono en un efecto.
  const [estabaAbierto, setEstabaAbierto] = useState(abierto);
  if (abierto !== estabaAbierto) {
    setEstabaAbierto(abierto);
    if (!abierto) setCopiado(false);
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      /* Sin permiso de portapapeles: el link sigue seleccionable a mano. */
    }
  };

  const compartir = async () => {
    if (!navigator.share) return copiar();
    try {
      await navigator.share({ title: `Sumate a "${nombreObra}" en Nora`, url: link });
    } catch {
      /* Cancelado por la persona — no es un error. */
    }
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
        aria-label="Invitar a la obra"
        className={`absolute bottom-0 inset-x-0 z-[56] bg-sand rounded-t-[26px] shadow-sheet max-h-[70%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <div className="px-5 pt-3 pb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-bold font-display text-ink">Invitar a la obra</h2>
              <p className="text-[12.5px] text-mute mt-0.5 truncate max-w-[260px]">{nombreObra}</p>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              className="press w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[13px] text-mute mt-4 leading-relaxed">
            Cualquiera que abra este link y tenga cuenta en Nora se suma a la obra — la arquitecta,
            un socio, quien haga falta. Vas a poder verlos en el chat de abajo.
          </p>

          <div className="mt-4 rounded-xl2 bg-surface border border-line shadow-card px-4 py-3.5">
            <p className="text-[13px] text-ink break-all font-mono">{link}</p>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={copiar}
              className="press flex items-center justify-center gap-1.5 rounded-xl2 border border-line bg-surface text-ink py-3 text-[13.5px] font-semibold"
            >
              {copiado ? <Check className="w-4 h-4 text-good" /> : <Copy className="w-4 h-4" />}
              {copiado ? "Copiado" : "Copiar link"}
            </button>
            <button
              type="button"
              onClick={compartir}
              className="press flex items-center justify-center gap-1.5 rounded-xl2 bg-brand-600 text-white py-3 text-[13.5px] font-semibold"
            >
              <Share2 className="w-4 h-4" />
              Compartir
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
