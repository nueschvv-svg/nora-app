"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ChevronRight, LogOut, Plus, Settings, Wrench } from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { FormularioPropiedad } from "@/componentes/FormularioPropiedad";
import { FormularioTrabajador } from "@/componentes/FormularioTrabajador";
import { calcularScore } from "@/lib/score";
import { miFichaTrabajador, type EstadoTrabajador, type MiFichaTrabajador } from "@/lib/trabajadores";

const ETIQUETA_ESTADO_TRABAJADOR: Record<EstadoTrabajador, string> = {
  pendiente: "Pendiente de verificación",
  verificado: "Activo",
  suspendido: "Suspendido",
  baja: "De baja",
};

export default function PaginaPerfil() {
  const { propiedades, equiposDe, sesion, cerrarSesion } = useApp();
  const [formAbierto, setFormAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  // Discreto a propósito: se consulta una sola vez, sin mostrar
  // esqueleto de carga — si tarda, el botón simplemente muestra
  // "Trabajá con Nora" hasta que la respuesta llegue.
  //
  // Se guarda la ficha completa (no sólo el estado) para poder pasarla
  // como valor inicial al formulario: así, al abrirlo, no hace falta
  // pedirla de nuevo.
  const [formTrabajadorAbierto, setFormTrabajadorAbierto] = useState(false);
  const [fichaTrabajador, setFichaTrabajador] = useState<MiFichaTrabajador | null>(null);

  useEffect(() => {
    if (!sesion) return;
    miFichaTrabajador()
      .then(setFichaTrabajador)
      .catch(() => {
        /* No es crítico: si falla, el botón se queda ofreciendo el alta. */
      });
  }, [sesion]);

  const estadoTrabajador: EstadoTrabajador | null = fichaTrabajador?.estado ?? null;

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
            {sesion?.inicial ?? "·"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold font-display text-ink">
              {sesion?.nombre ?? "Cargando…"}
            </p>
            <p className="text-[12.5px] text-mute mt-0.5 truncate">{sesion?.email ?? ""}</p>
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

        {/* Grande y arriba a propósito: antes era un link chiquito al
            final de la pantalla y casi nadie lo encontraba. Es su
            propia sección, no una opción más de "Cuenta". */}
        {estadoTrabajador === "verificado" ? (
          <Link
            href="/tecnico"
            className="press w-full flex items-center gap-4 rounded-xl2 bg-brand-600 p-5 shadow-fab"
          >
            <span className="shrink-0 w-14 h-14 grid place-items-center rounded-2xl bg-white/15 text-white">
              <Wrench className="w-6 h-6" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-bold font-display text-white leading-tight">Sección técnico</p>
              <p className="text-[12.5px] text-white/80 mt-0.5">Ver pedidos disponibles y tus trabajos</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white shrink-0" />
          </Link>
        ) : null}
        {estadoTrabajador === "verificado" && (
          <button
            type="button"
            onClick={() => setFormTrabajadorAbierto(true)}
            className="press w-full text-center text-[12.5px] font-medium text-mute underline underline-offset-2 -mt-1"
          >
            Editar mi ficha de trabajador
          </button>
        )}
        {estadoTrabajador !== "verificado" && (
          <button
            type="button"
            onClick={() => setFormTrabajadorAbierto(true)}
            className="press w-full flex items-center gap-4 rounded-xl2 bg-brand-600 p-5 shadow-fab text-left"
          >
            <span className="shrink-0 w-14 h-14 grid place-items-center rounded-2xl bg-white/15 text-white">
              <Briefcase className="w-6 h-6" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-bold font-display text-white leading-tight">Trabajá con Nora</p>
              <p className="text-[12.5px] text-white/80 mt-0.5">
                {estadoTrabajador
                  ? ETIQUETA_ESTADO_TRABAJADOR[estadoTrabajador]
                  : "Sumate como plomero, electricista y más"}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-white shrink-0" />
          </button>
        )}

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
          disabled={saliendo}
          onClick={async () => {
            setSaliendo(true);
            await cerrarSesion();
          }}
          className="w-full flex items-center justify-center gap-2 text-[14px] font-semibold text-urgent py-3 disabled:opacity-50"
        >
          <LogOut className="w-[17px] h-[17px]" />
          {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>

      <FormularioPropiedad abierto={formAbierto} alCerrar={() => setFormAbierto(false)} />
      <FormularioTrabajador
        abierto={formTrabajadorAbierto}
        alCerrar={() => setFormTrabajadorAbierto(false)}
        alGuardar={setFichaTrabajador}
        fichaInicial={fichaTrabajador}
      />
    </main>
  );
}
