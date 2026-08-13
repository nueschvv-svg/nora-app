"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Check, Wrench } from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { categoriaPorSlug, serviciosDePropiedad } from "@/lib/datos-demo";
import { fechaCorta, pesos } from "@/lib/formato";

export default function PaginaHistorial() {
  const { propiedad } = useApp();
  const servicios = useMemo(() => serviciosDePropiedad(propiedad.id), [propiedad.id]);

  const total = servicios.reduce((t, s) => t + (s.montoArs ?? 0), 0);
  const resueltos = servicios.filter((s) => s.estado === "calificado" || s.estado === "finalizado");

  return (
    <main className="h-dvh overflow-y-auto no-scrollbar pb-28">
      <div className="px-5 pt-12 pb-2">
        <h1 className="text-[24px] font-bold font-display text-ink">Historial</h1>
        <p className="text-[13px] text-mute mt-0.5">
          {propiedad.nombre} · todo lo que Nora resolvió
        </p>
      </div>

      {servicios.length === 0 ? (
        <EstadoVacio />
      ) : (
        <>
          <div className="px-5 grid grid-cols-3 gap-2.5">
            <Tarjeta valor={String(servicios.length)} etiqueta="servicios" />
            <Tarjeta valor={pesos(total)} etiqueta="invertido" />
            <Tarjeta
              valor={`${Math.round((resueltos.length / servicios.length) * 100)}%`}
              etiqueta="resuelto"
              color="text-good"
            />
          </div>

          <div className="px-5 mt-5 space-y-3">
            <div className="bg-surface rounded-xl2 border border-line shadow-card divide-y divide-line overflow-hidden">
              {servicios.map((s) => {
                const cat = categoriaPorSlug(s.categoriaSlug);
                return (
                  <div key={s.id} className="w-full flex items-center gap-3.5 p-3.5 text-left">
                    <span className="shrink-0 w-11 h-11 grid place-items-center rounded-2xl bg-brand-50 text-brand-600">
                      <IconoEquipo nombre={cat?.icono ?? "wrench"} className="w-[19px] h-[19px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-ink leading-tight">
                        {cat?.nombre ?? "Servicio"}
                      </p>
                      <p className="text-[12.5px] text-faint mt-0.5 truncate">
                        {s.tecnicoNombre} · {fechaCorta(s.creadoEl)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="num text-[13px] font-semibold text-ink">{pesos(s.montoArs)}</p>
                      <span className="inline-flex items-center gap-1 text-[11px] text-good font-medium">
                        <Check className="w-3 h-3" /> Resuelto
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function Tarjeta({
  valor,
  etiqueta,
  color = "text-ink",
}: {
  valor: string;
  etiqueta: string;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-2xl shadow-card p-3 text-center">
      <p className={`num text-[17px] font-extrabold font-display leading-tight ${color}`}>{valor}</p>
      <p className="text-[11px] text-faint mt-0.5">{etiqueta}</p>
    </div>
  );
}

/* Los estados vacíos importan: es lo primero que ve un usuario nuevo. */
function EstadoVacio() {
  return (
    <div className="px-5 mt-10 flex flex-col items-center text-center">
      <span className="w-16 h-16 grid place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Wrench className="w-7 h-7" />
      </span>
      <h2 className="text-[17px] font-bold font-display text-ink mt-4">Todavía no hay nada acá</h2>
      <p className="text-[13px] text-mute mt-1.5 max-w-[260px]">
        Cuando pidas tu primer servicio, vas a ver acá el detalle, el reporte del técnico y la
        factura.
      </p>
      <Link
        href="/pedir"
        className="press mt-5 inline-flex items-center gap-2 rounded-xl2 bg-brand-600 text-white px-5 py-3.5 text-[14.5px] font-semibold shadow-fab"
      >
        Pedir un servicio <ArrowRight className="w-[18px] h-[18px]" />
      </Link>
    </div>
  );
}
