"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { IconoEquipo } from "./IconoEquipo";
import { useApp } from "./ContextoApp";
import { FormularioPropiedad } from "./FormularioPropiedad";
import { calcularScore } from "@/lib/score";

/* Panel que sube desde abajo para cambiar de domicilio.
   Accesible: se cierra con Escape, atrapa el foco y el fondo
   se marca como inerte para lectores de pantalla. */
export function HojaPropiedades({
  abierta,
  alCerrar,
}: {
  abierta: boolean;
  alCerrar: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierta) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", alPresionar);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierta, alCerrar]);

  const { propiedades, propiedad, elegirPropiedad, equiposDe } = useApp();
  const [formAbierto, setFormAbierto] = useState(false);

  return (
    <>
      {/* Fondo oscuro */}
      <div
        onClick={alCerrar}
        className={`absolute inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          abierta ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Elegir domicilio"
        tabIndex={-1}
        className={`absolute bottom-0 inset-x-0 z-50 bg-sand rounded-t-[26px] shadow-sheet max-h-[80%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierta ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <div className="px-5 pt-3 pb-7">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold font-display text-ink">Tus domicilios</h2>
            <button
              type="button"
              onClick={alCerrar}
              className="press w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {propiedades.map((p) => {
              const activa = p.id === propiedad.id;
              const score = calcularScore(equiposDe(p.id));
              const colorScore =
                score.valor >= 80
                  ? "text-good bg-good/10"
                  : score.valor >= 60
                    ? "text-brand-600 bg-brand-50"
                    : "text-urgent bg-urgent/10";

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    elegirPropiedad(p.id);
                    alCerrar();
                  }}
                  aria-current={activa ? "true" : undefined}
                  className={`press w-full flex items-center gap-3.5 rounded-xl2 border shadow-card p-3.5 text-left ${
                    activa ? "border-brand-300 bg-brand-50" : "border-line bg-surface"
                  }`}
                >
                  <span
                    className={`w-10 h-10 grid place-items-center rounded-xl ${
                      activa ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600"
                    }`}
                  >
                    <IconoEquipo nombre={p.icono} className="w-[18px] h-[18px]" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14.5px] font-semibold text-ink leading-tight">
                      {p.nombre}
                    </span>
                    <span className="block text-[12px] text-faint truncate">
                      {p.direccion} · {p.localidad}
                    </span>
                  </span>
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 num ${colorScore}`}>
                    {score.valor}
                  </span>
                  {activa && <Check className="w-[18px] h-[18px] text-brand-600" />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setFormAbierto(true)}
            className="press mt-3 w-full flex items-center justify-center gap-2 rounded-xl2 border border-dashed border-brand-200 text-brand-600 py-3.5 text-[14px] font-semibold"
          >
            <Plus className="w-[17px] h-[17px]" /> Agregar domicilio
          </button>
        </div>
      </div>

      {/* Al guardar, el formulario deja activa la propiedad nueva y cerramos
          también la hoja de abajo: el usuario vuelve al inicio viéndola. */}
      <FormularioPropiedad
        abierto={formAbierto}
        alCerrar={() => setFormAbierto(false)}
        alGuardar={alCerrar}
      />
    </>
  );
}
