"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { IconoEquipo } from "./IconoEquipo";
import { useApp } from "./ContextoApp";
import { REGLAS_EQUIPO, TipoEquipo } from "@/lib/tipos";

/* Alta de un equipo (calefón, aire, tanque...).

   Es el formulario más importante de la app: de acá sale el score y
   la agenda de mantenimientos. Por eso el paso clave no es la marca,
   es la FECHA DE ÚLTIMA REVISIÓN. Sin ella no podemos decir nada. */

const TIPOS = Object.keys(REGLAS_EQUIPO) as TipoEquipo[];

export function FormularioEquipo({
  abierto,
  alCerrar,
}: {
  abierto: boolean;
  alCerrar: () => void;
}) {
  const { propiedad, agregarEquipo } = useApp();

  const [tipo, setTipo] = useState<TipoEquipo | null>(null);
  const [marca, setMarca] = useState("");
  const [anio, setAnio] = useState("");
  const [ultimaRevision, setUltimaRevision] = useState("");
  const [nuncaRevisado, setNuncaRevisado] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  /* Limpieza al abrir, durante el render y no en un efecto: así no se
     ve un parpadeo con los datos de la vez anterior. */
  const [estabaAbierto, setEstabaAbierto] = useState(abierto);
  if (abierto !== estabaAbierto) {
    setEstabaAbierto(abierto);
    if (abierto) {
      setTipo(null);
      setMarca("");
      setAnio("");
      setUltimaRevision("");
      setNuncaRevisado(false);
      setErrorGuardar(null);
    }
  }

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto, alCerrar]);

  const hoy = new Date().toISOString().slice(0, 10);
  const anioNum = anio ? Number(anio) : undefined;
  const anioValido =
    !anio || (Number.isInteger(anioNum) && anioNum! >= 1950 && anioNum! <= new Date().getFullYear());

  const valido = !!tipo && anioValido && (nuncaRevisado || !!ultimaRevision);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido || !tipo || !propiedad || guardando) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      await agregarEquipo({
        propiedadId: propiedad.id,
        tipo,
        marca: marca.trim() || undefined,
        anioInstalacion: anioValido && anioNum ? anioNum : undefined,
        ultimaRevision: nuncaRevisado ? undefined : ultimaRevision,
      });
      alCerrar();
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : "No pudimos guardar el equipo.");
    } finally {
      setGuardando(false);
    }
  };

  const regla = tipo ? REGLAS_EQUIPO[tipo] : null;

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
        aria-label="Agregar un equipo"
        className={`absolute bottom-0 inset-x-0 z-[56] glass-sheet rounded-t-[26px] max-h-[92%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <form onSubmit={guardar} className="px-5 pt-3 pb-7" noValidate>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-bold font-display text-ink">Agregar equipo</h2>
              <p className="text-[12.5px] text-mute">{propiedad?.nombre ?? ""}</p>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              className="press w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* --- Qué equipo --- */}
          <fieldset className="mt-4">
            <legend className="text-[11px] font-bold tracking-wide uppercase text-faint mb-2">
              Qué equipo es
            </legend>
            <div className="grid grid-cols-3 gap-2.5">
              {TIPOS.map((t) => {
                const r = REGLAS_EQUIPO[t];
                const elegido = tipo === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    aria-pressed={elegido}
                    aria-label={r.etiqueta}
                    className={`press flex flex-col items-center gap-1.5 rounded-2xl border bg-surface shadow-card py-3 px-1 ${
                      elegido ? "border-brand-500 ring-2 ring-brand-500" : "border-line"
                    }`}
                  >
                    <span className={elegido ? "text-brand-600" : "text-faint"}>
                      <IconoEquipo nombre={r.icono} className="w-5 h-5" />
                    </span>
                    <span className="text-[11.5px] font-medium text-mute text-center leading-tight">
                      {r.etiqueta}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Explicamos por qué le pedimos esto, apenas elige. */}
          {regla && (
            <div className="mt-3 rounded-xl2 bg-brand-50 border border-brand-100 px-3.5 py-3">
              <p className="text-[12.5px] text-ink leading-snug">
                {regla.motivo}{" "}
                <span className="font-semibold">
                  Corresponde revisarlo cada{" "}
                  {regla.frecuenciaMeses === 12 ? "año" : `${regla.frecuenciaMeses} meses`}.
                </span>
              </p>
            </div>
          )}

          {/* --- Última revisión: el dato que hace funcionar todo --- */}
          <div className="mt-4">
            <label
              htmlFor="ultima-revision"
              className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
            >
              Última revisión
            </label>
            <input
              id="ultima-revision"
              type="date"
              max={hoy}
              value={ultimaRevision}
              disabled={nuncaRevisado}
              onChange={(e) => setUltimaRevision(e.target.value)}
              className="w-full rounded-2xl bg-surface border border-line shadow-card px-4 py-3.5 text-[14px] text-ink outline-none focus:border-brand-300 disabled:opacity-45"
            />
            <label className="mt-2 flex items-center gap-2.5 px-1 cursor-pointer">
              <input
                type="checkbox"
                checked={nuncaRevisado}
                onChange={(e) => {
                  setNuncaRevisado(e.target.checked);
                  if (e.target.checked) setUltimaRevision("");
                }}
                className="w-4 h-4 accent-[#0E5C54]"
              />
              <span className="text-[13px] text-mute">No sé / nunca se revisó</span>
            </label>
          </div>

          {/* --- Datos opcionales --- */}
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <div>
              <label
                htmlFor="marca"
                className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
              >
                Marca
              </label>
              <input
                id="marca"
                type="text"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Orbis"
                className="w-full rounded-2xl bg-surface border border-line shadow-card px-4 py-3.5 text-[14px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
              />
            </div>
            <div>
              <label
                htmlFor="anio"
                className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
              >
                Año
              </label>
              <input
                id="anio"
                type="text"
                inputMode="numeric"
                value={anio}
                onChange={(e) => setAnio(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="2018"
                aria-invalid={!anioValido}
                className={`w-full rounded-2xl bg-surface border shadow-card px-4 py-3.5 text-[14px] text-ink placeholder:text-faint outline-none ${
                  anioValido ? "border-line focus:border-brand-300" : "border-urgent"
                }`}
              />
            </div>
          </div>
          {!anioValido && (
            <p role="alert" className="text-[12px] text-urgent mt-1 px-1">
              Poné un año entre 1950 y {new Date().getFullYear()}
            </p>
          )}

          {errorGuardar && (
            <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
              {errorGuardar}
            </p>
          )}

          <button
            type="submit"
            disabled={!valido || guardando}
            className="press mt-5 w-full rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar equipo"}
          </button>
        </form>
      </div>
    </>
  );
}
