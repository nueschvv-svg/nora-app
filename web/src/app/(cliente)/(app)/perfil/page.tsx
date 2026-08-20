"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, ChevronRight, LogOut, Plus, Settings } from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { FormularioPropiedad } from "@/componentes/FormularioPropiedad";
import { HojaDatosPersonales } from "@/componentes/HojaDatosPersonales";
import { HojaLegal } from "@/componentes/HojaLegal";
import { calcularScore } from "@/lib/score";
import {
  activarNotificaciones,
  desactivarNotificaciones,
  notificacionesActivas,
  notificacionesSoportadas,
} from "@/lib/push";

export default function PaginaPerfil() {
  const { propiedades, equiposDe, sesion, cerrarSesion } = useApp();
  const [formAbierto, setFormAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [datosAbierto, setDatosAbierto] = useState(false);
  const [legalAbierto, setLegalAbierto] = useState(false);
  /* Sobreescribe el nombre de sesion sólo en esta pantalla: recargar()
     no vuelve a leer perfiles.nombre (sólo propiedades/equipos), así
     que sin esto el cambio recién se vería después de recargar la
     página entera o volver a entrar. */
  const [nombreLocal, setNombreLocal] = useState<string | null>(null);

  /* notifOn arranca en null tanto en el servidor como en el primer render
     del cliente (SSR no tiene `window`/`navigator` para saber si hay
     soporte) — recién se resuelve en el efecto, dentro del .then(). Antes
     el botón se mostraba u ocultaba llamando notificacionesSoportadas()
     directo en el JSX: eso lee `window` y da una respuesta distinta en
     el servidor (false) que en el primer render del cliente (true),
     rompiendo la hidratación. Usar "todavía no sabemos" (null) como
     único estado inicial, sin importar dónde corre, evita el mismatch:
     el botón sólo aparece cuando notifOn deja de ser null, y eso pasa
     siempre después de montar. */
  const [notifOn, setNotifOn] = useState<boolean | null>(null);
  const [notifCargando, setNotifCargando] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  useEffect(() => {
    if (!notificacionesSoportadas()) return;
    notificacionesActivas()
      .then(setNotifOn)
      .catch(() => setNotifOn(false));
  }, []);

  const alternarNotificaciones = async () => {
    if (notifCargando) return;
    setNotifCargando(true);
    setNotifError(null);
    try {
      if (notifOn) {
        await desactivarNotificaciones();
        setNotifOn(false);
      } else {
        await activarNotificaciones();
        setNotifOn(true);
      }
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : "No pudimos cambiar las notificaciones.");
    } finally {
      setNotifCargando(false);
    }
  };

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
              {nombreLocal ?? sesion?.nombre ?? "Cargando…"}
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

        <p className="text-[11px] font-bold tracking-wide uppercase text-faint px-0.5">Cuenta</p>
        <div className="bg-surface rounded-xl2 border border-line shadow-card divide-y divide-line overflow-hidden">
          {["Datos personales", "Ayuda", "Términos y privacidad"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={
                t === "Datos personales"
                  ? () => setDatosAbierto(true)
                  : t === "Ayuda"
                    ? () => window.dispatchEvent(new Event("nora:abrir-ayuda"))
                    : t === "Términos y privacidad"
                      ? () => setLegalAbierto(true)
                      : undefined
              }
              className="w-full flex items-center gap-3.5 p-3.5 press text-left"
            >
              <span className="flex-1 text-[14px] font-semibold text-ink">{t}</span>
              <ChevronRight className="w-[18px] h-[18px] text-faint" />
            </button>
          ))}
          {notifOn !== null && (
            <button
              type="button"
              onClick={alternarNotificaciones}
              disabled={notifCargando}
              className="w-full flex items-center gap-3.5 p-3.5 press text-left disabled:opacity-60"
            >
              {notifOn ? (
                <Bell className="w-[18px] h-[18px] text-brand-600" />
              ) : (
                <BellOff className="w-[18px] h-[18px] text-faint" />
              )}
              <span className="flex-1 text-[14px] font-semibold text-ink">Notificaciones</span>
              <span
                className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors ${
                  notifOn ? "bg-brand-600" : "bg-line"
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    notifOn ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          )}
        </div>
        {notifError && <p className="text-[12px] text-urgent px-1 -mt-1">{notifError}</p>}

        <button
          type="button"
          disabled={saliendo}
          onClick={async () => {
            if (!window.confirm("¿Empezar de nuevo? Vas a perder tus domicilios y pedidos guardados en este navegador."))
              return;
            setSaliendo(true);
            await cerrarSesion();
          }}
          className="w-full flex items-center justify-center gap-2 text-[14px] font-semibold text-urgent py-3 disabled:opacity-50"
        >
          <LogOut className="w-[17px] h-[17px]" />
          {saliendo ? "Empezando de nuevo…" : "Empezar de nuevo"}
        </button>
      </div>

      <FormularioPropiedad abierto={formAbierto} alCerrar={() => setFormAbierto(false)} />
      <HojaDatosPersonales
        abierto={datosAbierto}
        alCerrar={() => setDatosAbierto(false)}
        alGuardar={setNombreLocal}
      />
      <HojaLegal abierto={legalAbierto} alCerrar={() => setLegalAbierto(false)} />
    </main>
  );
}
