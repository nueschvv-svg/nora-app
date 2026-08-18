"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { actualizarMisDatosPersonales, misDatosPersonales } from "@/lib/perfil";

/* Nombre y teléfono de la propia cuenta. El teléfono es el dato que
   más importa acá: operaciones necesita poder contactar a cualquier
   cliente por cualquier tema del pedido, y hasta ahora sólo se pedía
   al darse de alta como técnico — un cliente común no tenía dónde
   cargarlo. El email se muestra pero no se edita (cambiarlo es un
   flujo aparte de Supabase, con confirmación por mail). */
export function HojaDatosPersonales({
  abierto,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  /** Para que Perfil actualice el nombre mostrado sin recargar. */
  alGuardar?: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  /* Reinicia al pasar de cerrado a abierto — ajustado durante el
     render, no en un efecto (patrón ya usado en FormularioPropiedad):
     con un efecto, React pinta una vez con los datos de la apertura
     anterior y recién después los limpia. */
  const [estabaAbierto, setEstabaAbierto] = useState(abierto);
  if (abierto !== estabaAbierto) {
    setEstabaAbierto(abierto);
    if (abierto) {
      setCargado(false);
      setErrorCarga(null);
      setGuardado(false);
      setErrorGuardar(null);
    }
  }

  useEffect(() => {
    if (!abierto || cargado) return;
    let vivo = true;
    misDatosPersonales()
      .then((d) => {
        if (!vivo) return;
        setNombre(d.nombre);
        setTelefono(d.telefono);
        setEmail(d.email);
        setCargado(true);
      })
      .catch((e) => {
        if (!vivo) return;
        setErrorCarga(e instanceof Error ? e.message : "No pudimos cargar tus datos.");
        setCargado(true);
      });
    return () => {
      vivo = false;
    };
  }, [abierto, cargado]);

  const cargando = abierto && !cargado;

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto, alCerrar]);

  const valido = nombre.trim().length >= 2;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido || guardando) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      await actualizarMisDatosPersonales({ nombre, telefono });
      alGuardar?.(nombre.trim());
      setGuardado(true);
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : "No pudimos guardar tus datos.");
    } finally {
      setGuardando(false);
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
        role="dialog"
        aria-modal="true"
        aria-label="Datos personales"
        className={`absolute bottom-0 inset-x-0 z-[56] bg-sand rounded-t-[26px] shadow-sheet max-h-[85%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <form onSubmit={guardar} className="px-5 pt-3 pb-7" noValidate>
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold font-display text-ink">Datos personales</h2>
            <button
              type="button"
              onClick={alCerrar}
              className="press w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {cargando ? (
            <div className="mt-4 space-y-3 animate-pulse">
              <div className="h-14 w-full bg-line/70 rounded-2xl" />
              <div className="h-14 w-full bg-line/70 rounded-2xl" />
              <div className="h-14 w-full bg-line/70 rounded-2xl" />
            </div>
          ) : errorCarga ? (
            <p className="text-[13.5px] text-urgent text-center mt-6">{errorCarga}</p>
          ) : (
            <>
              <Campo
                id="nombre"
                etiqueta="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoComplete="name"
              />

              <Campo
                id="telefono"
                etiqueta="Teléfono"
                ayuda="Para que el equipo de Nora te pueda contactar por tu pedido si hace falta."
                type="tel"
                inputMode="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                autoComplete="tel"
                placeholder="11 1234 5678"
              />

              <div className="mt-3">
                <label className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
                  Email
                </label>
                <p className="w-full rounded-2xl bg-line/30 border border-line px-4 py-3.5 text-[14px] text-mute">
                  {email}
                </p>
                <p className="text-[12px] text-faint mt-1 px-1">
                  Para cambiar tu email, escribinos por Ayuda.
                </p>
              </div>

              {errorGuardar && (
                <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
                  {errorGuardar}
                </p>
              )}
              {guardado && !errorGuardar && (
                <p className="text-[13px] text-good bg-good/10 rounded-xl2 px-3.5 py-3 mt-4">
                  Listo, tus datos quedaron guardados.
                </p>
              )}

              <button
                type="submit"
                className="press mt-5 w-full rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab disabled:opacity-40"
                disabled={!valido || guardando}
              >
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </>
          )}
        </form>
      </div>
    </>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  ...props
}: { id: string; etiqueta: string; ayuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mt-3">
      <label htmlFor={id} className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
        {etiqueta}
      </label>
      <input
        id={id}
        type="text"
        className="w-full rounded-2xl bg-surface border border-line shadow-card px-4 py-3.5 text-[14px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
        {...props}
      />
      {ayuda && <p className="text-[12px] text-faint mt-1 px-1">{ayuda}</p>}
    </div>
  );
}
