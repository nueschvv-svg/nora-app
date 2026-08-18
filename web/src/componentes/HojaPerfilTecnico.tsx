"use client";

import { useEffect, useState } from "react";
import { Star, UserRound, X } from "lucide-react";
import {
  listarResenasTecnico,
  perfilPublicoTecnico,
  type PerfilPublicoTecnico,
  type ReseñaTecnico,
} from "@/lib/trabajadores";
import { fecha } from "@/lib/formato";

/* Ficha pública del técnico — trabajos hechos con Nora, cantidad de
   calificaciones, promedio de estrellas y las últimas reseñas. No
   hace falta tener un pedido con él para verla (perfil_publico_tecnico,
   db/35_perfil_tecnico.sql) — a diferencia de la ficha corta que ya
   se ve en la hoja del servicio, que sí requiere eso. */
export function HojaPerfilTecnico({
  abierto,
  alCerrar,
  tecnicoId,
}: {
  abierto: boolean;
  alCerrar: () => void;
  tecnicoId: string | null;
}) {
  const [perfil, setPerfil] = useState<PerfilPublicoTecnico | null>(null);
  const [perfilDeId, setPerfilDeId] = useState<string | null>(null);
  const [resenas, setResenas] = useState<ReseñaTecnico[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || !tecnicoId) return;
    Promise.all([perfilPublicoTecnico(tecnicoId), listarResenasTecnico(tecnicoId)])
      .then(([p, r]) => {
        setPerfil(p);
        setResenas(r);
        setPerfilDeId(tecnicoId);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "No pudimos cargar el perfil.");
        setPerfilDeId(tecnicoId);
      });
  }, [abierto, tecnicoId]);

  const cargando = tecnicoId !== null && perfilDeId !== tecnicoId;

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
        aria-label="Perfil del técnico"
        className={`absolute bottom-0 inset-x-0 z-[56] bg-sand rounded-t-[26px] shadow-sheet max-h-[85%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <div className="px-5 pt-3 pb-8">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={alCerrar}
              className="press w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {cargando ? (
            <div className="mt-1 space-y-3 animate-pulse">
              <div className="w-20 h-20 rounded-full bg-line mx-auto" />
              <div className="h-5 w-40 bg-line rounded mx-auto" />
              <div className="h-16 w-full bg-line rounded-xl2" />
            </div>
          ) : error || !perfil ? (
            <p className="text-[13.5px] text-urgent text-center mt-4">
              {error ?? "No encontramos este perfil."}
            </p>
          ) : (
            <>
              <div className="flex flex-col items-center -mt-2">
                <span className="w-20 h-20 rounded-full overflow-hidden bg-brand-50 grid place-items-center ring-4 ring-brand-100">
                  {perfil.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL pública, no vale next/image acá
                    <img src={perfil.fotoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserRound className="w-10 h-10 text-brand-300" />
                  )}
                </span>
                <h2 className="text-[19px] font-bold font-display text-ink mt-3">{perfil.nombre}</h2>
                {perfil.rubros.length > 0 && (
                  <p className="text-[12.5px] text-faint mt-0.5">{perfil.rubros.join(" · ")}</p>
                )}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2.5">
                <div className="rounded-xl2 bg-surface border border-line shadow-card py-3 text-center">
                  <p className="flex items-center justify-center gap-1 text-[16px] font-bold text-ink num">
                    <Star className="w-[15px] h-[15px] fill-warn text-warn" />
                    {perfil.promedio ?? "—"}
                  </p>
                  <p className="text-[10.5px] text-faint mt-0.5">Promedio</p>
                </div>
                <div className="rounded-xl2 bg-surface border border-line shadow-card py-3 text-center">
                  <p className="text-[16px] font-bold text-ink num">{perfil.calificaciones}</p>
                  <p className="text-[10.5px] text-faint mt-0.5">
                    {perfil.calificaciones === 1 ? "Calificación" : "Calificaciones"}
                  </p>
                </div>
                <div className="rounded-xl2 bg-surface border border-line shadow-card py-3 text-center">
                  <p className="text-[16px] font-bold text-ink num">{perfil.trabajos}</p>
                  <p className="text-[10.5px] text-faint mt-0.5">
                    {perfil.trabajos === 1 ? "Trabajo" : "Trabajos"}
                  </p>
                </div>
              </div>

              <p className="text-[11px] font-bold tracking-wide uppercase text-faint mt-6 mb-2 px-0.5">
                Reseñas de clientes
              </p>
              {resenas.length === 0 ? (
                <p className="text-[12.5px] text-faint">Todavía no tiene reseñas con comentario.</p>
              ) : (
                <div className="space-y-2.5">
                  {resenas.map((r, i) => (
                    <div key={i} className="rounded-xl2 bg-surface border border-line shadow-card p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`w-3.5 h-3.5 ${n <= r.estrellas ? "fill-warn text-warn" : "text-line"}`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-faint">{fecha(r.creadoEl.slice(0, 10))}</span>
                      </div>
                      {r.comentario && (
                        <p className="text-[13px] text-ink leading-relaxed mt-1.5">{r.comentario}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
