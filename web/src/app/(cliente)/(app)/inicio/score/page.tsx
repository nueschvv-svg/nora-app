"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, Info } from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { EsqueletoInicio } from "@/componentes/Esqueleto";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { calcularScore, ordenarPorUrgencia } from "@/lib/score";
import { textoVencimiento } from "@/lib/formato";
import { useEntradaEscalonada } from "@/lib/useEntradaEscalonada";

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
  const desgloseRef = useEntradaEscalonada<HTMLUListElement>(!cargando && !!propiedad);
  const equiposRef = useEntradaEscalonada<HTMLDivElement>(!cargando && !!propiedad && equipos.length > 0);

  if (cargando) return <EsqueletoInicio />;
  if (!propiedad) return (
    <main className="nora-page h-full overflow-y-auto py-10 sm:py-14">
      <p className="nora-eyebrow mb-3">El cuidado de tu casa</p>
      <h1 className="nora-heading">Tu score, explicado</h1>
      <section className="nora-panel mt-8 p-7 sm:p-10">
        <h2 className="font-display text-xl font-semibold">Todavía no hay una propiedad asociada</h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-mute">Cuando tengas una propiedad asociada, vas a encontrar acá sus equipos y mantenimientos. Mientras tanto, podés pedir el servicio que necesitás.</p>
        <Link href="/pedir" className="nora-button mt-6">Pedir un servicio</Link>
      </section>
    </main>
  );

  return (
    <main className="nora-page h-full overflow-y-auto pb-12">
      <header className="flex items-center gap-4 pb-8 pt-8 sm:pt-12">
        <Link
          href="/inicio"
          className="press w-11 h-11 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
          aria-label="Volver"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </Link>
        <div>
          <h1 className="nora-heading">Tu score, explicado</h1>
          <p className="mt-2 text-sm text-mute">{propiedad.nombre}</p>
        </div>
      </header>

      <div className="entra-suave space-y-6">
        {/* --- Cómo se llega al número --- */}
        {equipos.length > 0 && <section className="nora-panel overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line bg-brand-50/50 p-6 sm:p-8">
            <span className="text-[13px] text-mute">Score actual</span>
            <span className="num text-5xl font-extrabold font-display text-ink leading-none">
              {score.valor}
              <span className="text-[15px] font-semibold text-faint"> / 100</span>
            </span>
          </div>
          <ul ref={desgloseRef} className="divide-y divide-line">
            {score.desglose.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-5 px-6 py-4">
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
        </section>}

        <div className="flex items-start gap-2.5 rounded-xl2 bg-brand-50 border border-brand-100 px-3.5 py-3">
          <Info className="w-[18px] h-[18px] text-brand-600 shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-ink leading-snug">
            El score baja cuando un mantenimiento se vence y sube cuando lo ponés al día. Los equipos
            de gas y los matafuegos pesan más porque su vencimiento es un riesgo real, no una
            formalidad.
          </p>
        </div>

        {/* --- Equipo por equipo --- */}
        <p className="nora-eyebrow">
          Equipo por equipo
        </p>

        {equipos.length === 0 && <div className="nora-panel p-6"><h2 className="font-semibold">Sumá equipos para conocer su estado</h2><p className="mt-2 text-sm leading-relaxed text-mute">El score todavía no refleja mantenimientos de tu casa porque no hay equipos registrados.</p><Link href="/inicio/agenda" className="nora-button-secondary mt-5">Agregar mis equipos</Link></div>}
        <div ref={equiposRef} className="nora-panel divide-y divide-line overflow-hidden">
          {equipos.map((e) => {
            const estilo = {
              vencido: { chip: "bg-urgent/10 text-urgent", texto: "text-urgent", etiqueta: "Vencido" },
              por_vencer: { chip: "bg-warn/10 text-ink", texto: "text-ink", etiqueta: "Por vencer" },
              sin_datos: { chip: "bg-line text-mute", texto: "text-mute", etiqueta: "Sin datos" },
              al_dia: { chip: "bg-good/10 text-brand-700", texto: "text-brand-700", etiqueta: "Al día" },
            }[e.estado];

            return (
              <div key={e.equipo.id} className="p-5 sm:p-6">
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
          className="nora-button w-full sm:w-auto"
        >
          Resolver lo pendiente
        </Link>
      </div>
    </main>
  );
}
