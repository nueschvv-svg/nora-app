"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, PackageOpen } from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { EsqueletoInicio } from "@/componentes/Esqueleto";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { FormularioEquipo } from "@/componentes/FormularioEquipo";
import { calcularScore, ordenarPorUrgencia } from "@/lib/score";
import { mesAnio, textoVencimiento } from "@/lib/formato";
import { useEntradaEscalonada } from "@/lib/useEntradaEscalonada";

export default function PaginaAgenda() {
  const { propiedad, equiposDe, cargando } = useApp();
  const [formAbierto, setFormAbierto] = useState(false);
  const score = useMemo(
    () => calcularScore(propiedad ? equiposDe(propiedad.id) : []),
    [equiposDe, propiedad],
  );
  const equipos = useMemo(() => ordenarPorUrgencia(score.equipos), [score.equipos]);
  const listaRef = useEntradaEscalonada<HTMLDivElement>(equipos.length > 0);

  if (cargando) return <EsqueletoInicio />;
  if (!propiedad) return (
    <main className="nora-page h-full overflow-y-auto py-10 sm:py-14">
      <p className="nora-eyebrow mb-3">El cuidado de tu casa</p>
      <h1 className="nora-heading">Tus equipos</h1>
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
          <h1 className="nora-heading">Tus equipos</h1>
          <p className="mt-2 text-sm text-mute">
            {propiedad.nombre} · {propiedad.localidad}
          </p>
        </div>
      </header>

      <div className="entra-suave space-y-6">
        {equipos.length === 0 && (
          <div className="nora-panel p-6 text-center">
            <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-brand-50 text-brand-600">
              <PackageOpen className="w-6 h-6" />
            </span>
            <p className="text-[15px] font-semibold text-ink mt-3">
              Todavía no cargaste ningún equipo
            </p>
            <p className="text-[13px] text-mute mt-1.5 leading-snug">
              Cargá el calefón, el aire, el tanque. Con eso Nora calcula el score de la propiedad y
              te avisa antes de que algo se venza.
            </p>
          </div>
        )}

        <div
          ref={listaRef}
          className={`nora-panel divide-y divide-line overflow-hidden ${
            equipos.length === 0 ? "hidden" : ""
          }`}
        >
          {equipos.map((e) => {
            const urgente = e.estado === "vencido";
            return (
              <div key={e.equipo.id} className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
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
                <div className="ml-auto text-right">
                  <p className={`num text-[13px] font-semibold ${urgente ? "text-urgent" : "text-ink"}`}>
                    {e.proximaRevision ? mesAnio(e.proximaRevision) : "—"}
                  </p>
                  <p className={`text-[11.5px] ${urgente ? "text-urgent font-medium" : "text-faint"}`}>
                    {textoVencimiento(e.diasVencido)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setFormAbierto(true)}
          className="nora-button-secondary w-full gap-2 sm:w-auto"
        >
          <Plus className="w-[17px] h-[17px]" /> Agregar un equipo
        </button>

        {equipos.length > 0 && (
          <Link
            href="/pedir"
            className="nora-button w-full sm:w-auto"
          >
            Agendar una revisión
          </Link>
        )}
      </div>

      <FormularioEquipo abierto={formAbierto} alCerrar={() => setFormAbierto(false)} />
    </main>
  );
}
