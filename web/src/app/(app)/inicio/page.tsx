"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  ChevronsUpDown,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { LogotipoNora } from "@/componentes/LogoNora";
import { AnilloScore } from "@/componentes/AnilloScore";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { HojaPropiedades } from "@/componentes/HojaPropiedades";
import { useApp } from "@/componentes/ContextoApp";
import { calcularScore, ordenarPorUrgencia } from "@/lib/score";
import { mesAnio, saludo, textoVencimiento } from "@/lib/formato";

export default function PaginaInicio() {
  const { propiedad, indice, propiedades, equiposDe, sesion } = useApp();
  const [hojaAbierta, setHojaAbierta] = useState(false);

  // El score se recalcula solo cuando cambia la propiedad.
  const score = useMemo(() => calcularScore(equiposDe(propiedad.id)), [equiposDe, propiedad.id]);
  const urgentes = useMemo(() => ordenarPorUrgencia(score.equipos), [score.equipos]);

  const critico = score.nivel === "critico";
  const proximo = urgentes[0];

  return (
    <main className="h-dvh overflow-y-auto no-scrollbar pb-28">
      <header className="px-5 pt-12 pb-2">
        <div className="flex items-center justify-between">
          <LogotipoNora />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="press relative w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
              aria-label="Notificaciones"
            >
              <Bell className="w-[18px] h-[18px]" />
            </button>
            <Link href="/perfil" aria-label="Ir a mi perfil">
              <span className="w-10 h-10 grid place-items-center rounded-full bg-brand-600 text-white font-semibold text-[15px] ring-2 ring-white shadow-sm">
                {sesion?.inicial ?? ""}
              </span>
            </Link>
          </div>
        </div>

        <h1 className="mt-4 text-[23px] font-bold font-display text-ink leading-tight">
          {saludo()}{sesion ? `, ${sesion.nombre.split(" ")[0]}` : ""}
        </h1>
      </header>

      <div className="px-5 space-y-3.5">
        {/* --- Selector de domicilio --- */}
        <button
          type="button"
          onClick={() => setHojaAbierta(true)}
          className="press w-full flex items-center justify-between bg-surface border border-line rounded-2xl px-4 py-3 shadow-card"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 grid place-items-center rounded-xl bg-brand-50 text-brand-600">
              <IconoEquipo nombre={propiedad.icono} className="w-[18px] h-[18px]" />
            </span>
            <span className="text-left min-w-0">
              <span className="block text-[15px] font-semibold text-ink truncate">{propiedad.nombre}</span>
              <span className="block text-[12.5px] text-faint truncate">
                {propiedad.direccion} · {propiedad.localidad}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-medium text-faint">
              {indice + 1}/{propiedades.length}
            </span>
            <ChevronsUpDown className="w-[18px] h-[18px] text-faint" />
          </span>
        </button>

        {/* --- Hero: score --- */}
        <section
          className="relative overflow-hidden rounded-xl3 bg-brand-700 text-white shadow-hero p-5"
          style={{
            backgroundImage:
              "radial-gradient(120% 80% at 100% 0%, #14857A 0%, #0E5C54 38%, #0B3B38 100%)",
          }}
        >
          <div className="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full bg-brand-400/20 blur-2xl" />
          <div className="relative flex items-center gap-5">
            <AnilloScore valor={score.valor} />
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur px-2.5 py-1 text-[11.5px] font-medium text-brand-50">
                <ShieldCheck className="w-[13px] h-[13px]" /> Salud de la propiedad
              </span>
              <p
                className="mt-2.5 text-[19px] font-semibold font-display leading-snug"
                dangerouslySetInnerHTML={{ __html: score.titulo }}
              />
              <Link
                href="/inicio/score"
                className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-brand-100 underline underline-offset-2 decoration-brand-100/40"
              >
                <TrendingUp className="w-[15px] h-[15px] text-emerald-300" />
                Ver por qué
              </Link>
            </div>
          </div>

          {/* Alerta principal: lo más urgente que tenga esta propiedad */}
          {proximo && (
            <Link
              href="/inicio/agenda"
              className="press relative mt-4 w-full flex items-center gap-3 rounded-2xl bg-white/[.08] border border-white/10 px-3.5 py-3 text-left"
            >
              <span
                className={`shrink-0 w-9 h-9 grid place-items-center rounded-xl ${
                  critico ? "bg-urgent/20 text-orange-200" : "bg-good/20 text-emerald-200"
                }`}
              >
                <IconoEquipo nombre={proximo.icono} className="w-[18px] h-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-white leading-snug">
                  {proximo.estado === "al_dia"
                    ? "Todo al día en esta propiedad"
                    : `${proximo.etiqueta}: ${textoVencimiento(proximo.diasVencido).toLowerCase()}`}
                </span>
                <span className="block text-[11.5px] text-brand-100 mt-0.5">
                  {resumenAgenda(score.equipos)}
                </span>
              </span>
              <ArrowRight className="w-[18px] h-[18px] text-white/70 shrink-0" />
            </Link>
          )}
        </section>

        {/* --- Pedir un servicio --- */}
        <Link
          href="/pedir"
          className="press w-full flex items-center justify-between rounded-xl2 bg-brand-600 text-white px-5 py-4 shadow-fab"
        >
          <span className="flex items-center gap-3">
            <span className="w-10 h-10 grid place-items-center rounded-full bg-white/15">
              <MessageCircle className="w-5 h-5" />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[15.5px] font-semibold">Pedir un servicio</span>
              <span className="block text-[12px] text-brand-100">
                Contanos qué pasa y te conseguimos técnico
              </span>
            </span>
          </span>
          <ArrowRight className="w-5 h-5" />
        </Link>

        {/* --- Próximo mantenimiento --- */}
        {proximo && proximo.estado !== "al_dia" && (
          <Link
            href="/inicio/agenda"
            className="lift w-full flex items-center gap-3.5 bg-surface rounded-xl2 border border-line shadow-card p-3.5 text-left"
          >
            <span
              className={`shrink-0 w-11 h-11 grid place-items-center rounded-2xl ${
                proximo.estado === "vencido" ? "bg-urgent/10 text-urgent" : "bg-brand-50 text-brand-600"
              }`}
            >
              <IconoEquipo nombre={proximo.icono} className="w-[19px] h-[19px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold tracking-wide uppercase text-faint truncate">
                Próxima revisión
              </p>
              <p className="text-[14px] font-semibold text-ink leading-tight mt-0.5 truncate">
                {proximo.etiqueta}
                {proximo.equipo.marca ? ` · ${proximo.equipo.marca}` : ""}
              </p>
            </div>
            <div className="text-right shrink-0 max-w-[38%]">
              <p
                className={`num text-[13px] font-semibold leading-tight ${
                  proximo.estado === "vencido" ? "text-urgent" : "text-ink"
                }`}
              >
                {proximo.proximaRevision ? mesAnio(proximo.proximaRevision) : "Sin datos"}
              </p>
              <p
                className={`text-[11.5px] leading-tight mt-0.5 ${
                  proximo.estado === "vencido" ? "text-urgent/80 font-medium" : "text-faint"
                }`}
              >
                {proximo.estado === "vencido"
                  ? "Vencido"
                  : proximo.estado === "por_vencer"
                    ? "Por vencer"
                    : "Programado"}
              </p>
            </div>
          </Link>
        )}

        {/* --- Agendar mantenimiento --- */}
        <Link
          href="/inicio/agenda"
          className="lift w-full flex items-center gap-3 bg-surface rounded-xl2 border border-line shadow-card p-3.5 text-left"
        >
          <span className="shrink-0 w-11 h-11 grid place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <CalendarCheck className="w-[19px] h-[19px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink leading-tight">Tus equipos</p>
            <p className="text-[12.5px] text-faint mt-0.5">
              {score.equipos.length} cargados · ver estado de cada uno
            </p>
          </div>
          <ArrowRight className="w-[18px] h-[18px] text-faint shrink-0" />
        </Link>
      </div>

      <HojaPropiedades abierta={hojaAbierta} alCerrar={() => setHojaAbierta(false)} />
    </main>
  );
}

function resumenAgenda(equipos: ReturnType<typeof calcularScore>["equipos"]): string {
  const vencidos = equipos.filter((e) => e.estado === "vencido").length;
  const porVencer = equipos.filter((e) => e.estado === "por_vencer").length;
  const sinDatos = equipos.filter((e) => e.estado === "sin_datos").length;

  const partes: string[] = [];
  if (vencidos) partes.push(`${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"}`);
  if (porVencer) partes.push(`${porVencer} por vencer`);
  if (sinDatos) partes.push(`${sinDatos} sin datos`);
  return partes.length ? partes.join(" · ") : "Todos los mantenimientos al día";
}
