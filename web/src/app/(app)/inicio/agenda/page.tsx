"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, Plus } from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { equiposDePropiedad } from "@/lib/datos-demo";
import { calcularScore, ordenarPorUrgencia } from "@/lib/score";
import { mesAnio, textoVencimiento } from "@/lib/formato";

export default function PaginaAgenda() {
  const { propiedad } = useApp();
  const score = useMemo(() => calcularScore(equiposDePropiedad(propiedad.id)), [propiedad.id]);
  const equipos = useMemo(() => ordenarPorUrgencia(score.equipos), [score.equipos]);

  return (
    <main className="h-dvh overflow-y-auto no-scrollbar pb-28">
      <header className="px-5 pt-12 pb-3 flex items-center gap-3">
        <Link
          href="/inicio"
          className="press w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
          aria-label="Volver"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </Link>
        <div>
          <h1 className="text-[20px] font-bold font-display text-ink leading-tight">Tus equipos</h1>
          <p className="text-[12.5px] text-mute">
            {propiedad.nombre} · {propiedad.localidad}
          </p>
        </div>
      </header>

      <div className="px-5 space-y-3.5">
        <div className="rounded-xl2 bg-surface border border-line shadow-card divide-y divide-line overflow-hidden">
          {equipos.map((e) => {
            const urgente = e.estado === "vencido";
            return (
              <div key={e.equipo.id} className="flex items-center gap-3.5 p-3.5">
                <span
                  className={`shrink-0 w-11 h-11 grid place-items-center rounded-2xl ${
                    urgente ? "bg-urgent/10 text-urgent" : "bg-brand-50 text-brand-600"
                  }`}
                >
                  <IconoEquipo nombre={e.icono} className="w-[19px] h-[19px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink leading-tight">{e.etiqueta}</p>
                  <p className="text-[12.5px] text-faint mt-0.5">
                    {e.equipo.marca ? `${e.equipo.marca} ` : ""}
                    {e.equipo.anioInstalacion ? `· desde ${e.equipo.anioInstalacion}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`num text-[13px] font-semibold ${urgente ? "text-urgent" : "text-ink"}`}>
                    {e.proximaRevision ? mesAnio(e.proximaRevision) : "—"}
                  </p>
                  <p className={`text-[11.5px] ${urgente ? "text-urgent/80 font-medium" : "text-faint"}`}>
                    {textoVencimiento(e.diasVencido)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="press w-full flex items-center justify-center gap-2 rounded-xl2 border border-dashed border-brand-200 text-brand-600 py-3.5 text-[14px] font-semibold"
        >
          <Plus className="w-[17px] h-[17px]" /> Agregar un equipo
        </button>

        <Link
          href="/pedir"
          className="press w-full flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white py-3.5 text-[14.5px] font-semibold shadow-fab"
        >
          Agendar una revisión
        </Link>
      </div>
    </main>
  );
}
