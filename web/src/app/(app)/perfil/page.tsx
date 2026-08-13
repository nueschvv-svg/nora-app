"use client";

import { useState } from "react";
import { ChevronRight, LogOut, Plus, Settings } from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { FormularioPropiedad } from "@/componentes/FormularioPropiedad";
import { calcularScore } from "@/lib/score";

export default function PaginaPerfil() {
  const { propiedades, equiposDe } = useApp();
  const [formAbierto, setFormAbierto] = useState(false);

  return (
    <main className="h-dvh overflow-y-auto no-scrollbar pb-28">
      <div className="px-5 pt-12 pb-2 flex items-center justify-between">
        <h1 className="text-[24px] font-bold font-display text-ink">Perfil</h1>
        <button
          type="button"
          className="press w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
          aria-label="Ajustes"
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>

      <div className="px-5 mt-2 space-y-3.5">
        <section className="flex items-center gap-4 bg-surface rounded-xl2 border border-line shadow-card p-4">
          <span className="w-16 h-16 grid place-items-center rounded-2xl bg-brand-600 text-white text-[24px] font-bold font-display">
            M
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold font-display text-ink">Mati Valdivia</p>
            <p className="text-[12.5px] text-mute mt-0.5 truncate">mati@nora.app</p>
          </div>
        </section>

        <p className="text-[11px] font-bold tracking-wide uppercase text-faint px-0.5">Mis domicilios</p>
        <div className="bg-surface rounded-xl2 border border-line shadow-card divide-y divide-line overflow-hidden">
          {propiedades.map((p) => {
            const score = calcularScore(equiposDe(p.id));
            const color =
              score.valor >= 80
                ? "text-good bg-good/10"
                : score.valor >= 60
                  ? "text-brand-600 bg-brand-50"
                  : "text-urgent bg-urgent/10";
            return (
              <div key={p.id} className="flex items-center gap-3.5 p-3.5">
                <span className="shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <IconoEquipo nombre={p.icono} className="w-[18px] h-[18px]" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink leading-tight">{p.nombre}</p>
                  <p className="text-[12px] text-faint truncate">
                    {p.direccion} · {p.localidad}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 num ${color}`}>
                  {score.valor}
                </span>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setFormAbierto(true)}
            className="w-full flex items-center gap-3.5 p-3.5 press text-brand-600"
          >
            <span className="shrink-0 w-10 h-10 grid place-items-center rounded-xl border border-dashed border-brand-200">
              <Plus className="w-[18px] h-[18px]" />
            </span>
            <span className="text-[14px] font-semibold">Agregar domicilio</span>
          </button>
        </div>

        <p className="text-[11px] font-bold tracking-wide uppercase text-faint px-0.5">Cuenta</p>
        <div className="bg-surface rounded-xl2 border border-line shadow-card divide-y divide-line overflow-hidden">
          {["Datos personales", "Notificaciones", "Ayuda", "Términos y privacidad"].map((t) => (
            <button key={t} type="button" className="w-full flex items-center gap-3.5 p-3.5 press text-left">
              <span className="flex-1 text-[14px] font-semibold text-ink">{t}</span>
              <ChevronRight className="w-[18px] h-[18px] text-faint" />
            </button>
          ))}
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 text-[14px] font-semibold text-urgent py-3"
        >
          <LogOut className="w-[17px] h-[17px]" /> Cerrar sesión
        </button>
      </div>

      <FormularioPropiedad abierto={formAbierto} alCerrar={() => setFormAbierto(false)} />
    </main>
  );
}
