"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCheck, Clock, X } from "lucide-react";

import { IconoEquipo } from "./IconoEquipo";
import { useApp } from "./ContextoApp";
import { recordatoriosDeMantenimiento } from "@/lib/score";
import { haceTiempo, textoVencimiento } from "@/lib/formato";
import type { Notificacion } from "@/lib/notificaciones";

/* Campanita de Inicio. Dos secciones, a propósito no interleadas:
   "Tus pedidos" son hechos que pasaron (persistidos, con hora exacta)
   y "Mantenimiento" son recordatorios que existen mientras el equipo
   siga vencido — mezclarlos por fecha les daría a los recordatorios
   una antigüedad que no tienen. */
export function HojaNotificaciones({
  abierto,
  alCerrar,
  notificaciones,
  alMarcarLeida,
  alMarcarTodas,
  alAbrirServicio,
}: {
  abierto: boolean;
  alCerrar: () => void;
  notificaciones: Notificacion[];
  alMarcarLeida: (id: string) => void;
  alMarcarTodas: () => void;
  alAbrirServicio: (servicioId: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { propiedades, equiposDe } = useApp();

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", alPresionar);
    /* preventScroll: true — sin esto, el foco dispara un scroll-into-view
       automático del navegador sobre el `<main>` scrolleable de atrás,
       justo en el primer frame de la transición (todavía con el panel
       fuera de pantalla). Bug real, encontrado en vivo: ese scroll deja
       a otra hoja (que vive en el mismo `<main>`, con su propio
       position:absolute) mal ubicada visualmente hasta el próximo
       reflow — se veían dos hojas superpuestas al mismo tiempo. */
    panelRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto, alCerrar]);

  const recordatorios = recordatoriosDeMantenimiento(propiedades, equiposDe);
  const hayNoLeidas = notificaciones.some((n) => !n.leida);

  const tocarNotificacion = (n: Notificacion) => {
    if (!n.leida) alMarcarLeida(n.id);
    if (n.servicioId) {
      alAbrirServicio(n.servicioId);
      alCerrar();
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notificaciones"
        tabIndex={-1}
        className={`absolute bottom-0 inset-x-0 z-[56] glass-sheet rounded-t-[26px] max-h-[85%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <div className="px-5 pt-3 pb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold font-display text-ink">Notificaciones</h2>
            <button
              type="button"
              onClick={alCerrar}
              className="press w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {hayNoLeidas && (
            <button
              type="button"
              onClick={alMarcarTodas}
              className="press mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-600"
            >
              <CheckCheck className="w-[15px] h-[15px]" />
              Marcar todas como leídas
            </button>
          )}

          {notificaciones.length === 0 && recordatorios.length === 0 ? (
            <div className="mt-10 flex flex-col items-center text-center px-6">
              <span className="w-14 h-14 grid place-items-center rounded-full bg-brand-50 text-brand-600">
                <Bell className="w-6 h-6" />
              </span>
              <p className="mt-3 text-[14px] font-semibold text-ink">Todavía no hay nada por acá</p>
              <p className="mt-1 text-[12.5px] text-faint">
                Vas a ver acá el avance de tus pedidos y los recordatorios de mantenimiento.
              </p>
            </div>
          ) : (
            <>
              {notificaciones.length > 0 && (
                <section className="mt-4">
                  <p className="text-[11px] font-bold tracking-wide uppercase text-faint px-0.5 mb-1.5">
                    Tus pedidos
                  </p>
                  <div className="space-y-2">
                    {notificaciones.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => tocarNotificacion(n)}
                        className={`press w-full flex items-start gap-3 rounded-xl2 border shadow-card p-3.5 text-left ${
                          n.leida ? "bg-surface border-line" : "bg-brand-50 border-brand-100"
                        }`}
                      >
                        <span
                          className={`shrink-0 mt-1 w-2 h-2 rounded-full ${
                            n.leida ? "bg-transparent" : "bg-brand-600"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[13.5px] font-semibold text-ink leading-tight">
                              {n.titulo}
                            </span>
                            <span className="shrink-0 text-[11px] text-faint">{haceTiempo(n.creadoEl)}</span>
                          </span>
                          <span className="block text-[12.5px] text-mute leading-snug mt-0.5">{n.cuerpo}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {recordatorios.length > 0 && (
                <section className="mt-5">
                  <p className="text-[11px] font-bold tracking-wide uppercase text-faint px-0.5 mb-1.5">
                    Mantenimiento
                  </p>
                  <div className="space-y-2">
                    {recordatorios.map((r) => (
                      <div
                        key={r.id}
                        className={`flex items-start gap-3 rounded-xl2 border shadow-card p-3.5 ${
                          r.estado === "vencido" ? "bg-urgent/5 border-urgent/20" : "bg-surface border-line"
                        }`}
                      >
                        <span
                          className={`shrink-0 w-9 h-9 grid place-items-center rounded-xl ${
                            r.estado === "vencido" ? "bg-urgent/10 text-urgent" : "bg-brand-50 text-brand-600"
                          }`}
                        >
                          <IconoEquipo nombre={r.icono} className="w-[17px] h-[17px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold text-ink leading-tight">
                            {r.etiqueta}
                          </span>
                          <span className="block text-[12px] text-faint mt-0.5">
                            {r.propiedadNombre} ·{" "}
                            <span className={r.estado === "vencido" ? "text-urgent font-medium" : ""}>
                              {textoVencimiento(r.diasVencido).toLowerCase()}
                            </span>
                          </span>
                        </span>
                        {r.estado === "vencido" ? (
                          <AlertTriangle className="w-4 h-4 text-urgent shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-faint shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/pedir"
                    onClick={alCerrar}
                    className="press mt-2.5 block w-full text-center rounded-xl2 border border-dashed border-brand-200 text-brand-600 py-3 text-[13.5px] font-semibold"
                  >
                    Pedir una revisión
                  </Link>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
