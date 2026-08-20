"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, Info } from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { EsqueletoInicio } from "@/componentes/Esqueleto";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { calcularScore, ordenarPorUrgencia } from "@/lib/score";
import { textoVencimiento } from "@/lib/formato";

/* Esta pantalla es la que vuelve creíble al score.
   Un número solo ("73") no significa nada; acá se muestra
   exactamente de dónde sale y qué hacer para subirlo. */
export default function PaginaScore() {
  const { propiedad, equiposDe, cargando } = useApp();
  const score = useMemo(
    () => calcularScore(propiedad ? equiposDe(propiedad.id) : []),
    [equiposDe, propiedad],
  );
  const equipos = useMemo(() => ordenarPorUrgencia(score.equipos), [score.equipos]);

  if (cargando || !propiedad) return <EsqueletoInicio />;

  return (
    <main className="h-full overflow-y-auto no-scrollbar pb-8">
      <header className="px-5 pt-6 pb-3 flex items-center gap-3">
        <Link
          href="/inicio"
          className="press w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
          aria-label="Volver"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </Link>
        <div>
          <h1 className="text-[20px] font-bold font-display text-ink leading-tight">Tu score, explicado</h1>
          <p className="text-[12.5px] text-mute">{propiedad.nombre}</p>
        </div>
      </header>

      <div className="px-5 space-y-3.5">
        {/* --- Cómo se llega al número --- */}
        <section className="rounded-xl2 bg-surface border border-line shadow-card overflow-hidden">
          <div className="px-4 py-4 flex items-baseline justify-between border-b border-line">
            <span className="text-[13px] text-mute">Score actual</span>
            <span className="num text-[32px] font-extrabold font-display text-ink leading-none">
              {score.valor}
              <span className="text-[15px] font-semibold text-faint"> / 100</span>
            </span>
          </div>
          <ul className="divide-y divide-line">
            {score.desglose.map((d, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px] text-ink">{d.concepto}</span>
                <span
                  className={`num text-[13.5px] font-semibold ${
                    d.puntos < 0 ? "text-urgent" : d.puntos > 0 && i > 0 ? "text-good" : "text-ink"
                  }`}
                >
                  {d.puntos > 0 && i > 0 ? "+" : ""}
                  {d.puntos}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex items-start gap-2.5 rounded-xl2 bg-brand-50 border border-brand-100 px-3.5 py-3">
          <Info className="w-[18px] h-[18px] text-brand-600 shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-ink leading-snug">
            El score baja cuando un mantenimiento se vence y sube cuando lo ponés al día. Los equipos
            de gas y los matafuegos pesan más porque su vencimiento es un riesgo real, no una
            formalidad.
          </p>
        </div>

        {/* --- Equipo por equipo --- */}
        <p className="text-[11px] font-bold tracking-wide uppercase text-faint px-0.5 pt-1">
          Equipo por equipo
        </p>

        <div className="rounded-xl2 bg-surface border border-line shadow-card divide-y divide-line overflow-hidden">
          {equipos.map((e) => {
            const estilo = {
              vencido: { chip: "bg-urgent/10 text-urgent", texto: "text-urgent", etiqueta: "Vencido" },
              por_vencer: { chip: "bg-warn/10 text-warn", texto: "text-warn", etiqueta: "Por vencer" },
              sin_datos: { chip: "bg-line text-mute", texto: "text-mute", etiqueta: "Sin datos" },
              al_dia: { chip: "bg-good/10 text-good", texto: "text-good", etiqueta: "Al día" },
            }[e.estado];

            return (
              <div key={e.equipo.id} className="p-3.5">
                <div className="flex items-center gap-3.5">
                  <span className={`shrink-0 w-11 h-11 grid place-items-center rounded-2xl ${estilo.chip}`}>
                    <IconoEquipo nombre={e.icono} className="w-[19px] h-[19px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink leading-tight">
                      {e.etiqueta}
                      {e.equipo.marca && (
                        <span className="font-normal text-mute"> · {e.equipo.marca}</span>
                      )}
                    </p>
                    <p className={`text-[12.5px] mt-0.5 ${estilo.texto}`}>
                      {/* Para lo vencido, el texto de vencimiento ya dice "Vencido hace X".
                          Repetir la etiqueta sería redundante. */}
                      {e.estado === "sin_datos"
                        ? "Nunca nos dijiste cuándo se revisó"
                        : e.estado === "vencido"
                          ? textoVencimiento(e.diasVencido)
                          : `${estilo.etiqueta} · ${textoVencimiento(e.diasVencido)}`}
                    </p>
                  </div>
                  {e.penalidad > 0 && (
                    <span className="num text-[13px] font-semibold text-urgent shrink-0">
                      −{e.penalidad}
                    </span>
                  )}
                </div>

                {e.estado !== "al_dia" && (
                  <p className="text-[12px] text-mute leading-snug mt-2 pl-[3.6rem]">{e.motivo}</p>
                )}
              </div>
            );
          })}
        </div>

        <Link
          href="/pedir"
          className="press w-full flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white py-3.5 text-[14.5px] font-semibold shadow-fab"
        >
          Resolver lo pendiente
        </Link>
      </div>
    </main>
  );
}
