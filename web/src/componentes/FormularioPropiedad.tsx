"use client";

import { useEffect, useState } from "react";
import { Building2, Home, House, X } from "lucide-react";
import { DatosNuevaPropiedad, useApp } from "./ContextoApp";
import { Propiedad } from "@/lib/tipos";

/* Alta de un domicilio nuevo.

   Validamos en el momento pero mostramos el error recién cuando el
   campo se tocó: marcar todo en rojo apenas se abre el formulario
   es agresivo y no ayuda a nadie. */

const ICONOS: { valor: Propiedad["icono"]; etiqueta: string; Icono: typeof Home }[] = [
  { valor: "home", etiqueta: "Casa", Icono: Home },
  { valor: "house", etiqueta: "Depto", Icono: House },
  { valor: "building-2", etiqueta: "Local", Icono: Building2 },
];

const PROVINCIAS = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

const VACIO: DatosNuevaPropiedad = {
  nombre: "",
  calle: "",
  numero: "",
  localidad: "",
  provincia: "Buenos Aires",
  icono: "home",
};

export function FormularioPropiedad({
  abierto,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar?: () => void;
}) {
  const { agregarPropiedad } = useApp();
  const [datos, setDatos] = useState<DatosNuevaPropiedad>(VACIO);
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  /* Al abrir, empezamos de cero: si el usuario canceló antes, no queremos
     que reaparezca lo que había escrito.

     Se hace durante el render y no en un efecto. Con efecto, React pinta
     una vez con los datos viejos y recién después los limpia: se ve un
     parpadeo del formulario anterior. Este es el patrón que recomienda
     React para ajustar estado cuando cambia una prop. */
  const [estabaAbierto, setEstabaAbierto] = useState(abierto);
  if (abierto !== estabaAbierto) {
    setEstabaAbierto(abierto);
    if (abierto) {
      setDatos(VACIO);
      setTocados({});
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

  const errores: Partial<Record<keyof DatosNuevaPropiedad, string>> = {};
  if (!datos.nombre.trim()) errores.nombre = "Ponele un nombre para reconocerlo";
  if (!datos.calle.trim()) errores.calle = "Falta la calle";
  if (!datos.numero.trim()) errores.numero = "Falta la altura";
  if (!datos.localidad.trim()) errores.localidad = "Falta la localidad";

  const valido = Object.keys(errores).length === 0;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    if (!valido) {
      setTocados({ nombre: true, calle: true, numero: true, localidad: true });
      return;
    }
    setGuardando(true);
    setErrorGuardar(null);
    try {
      await agregarPropiedad(datos);
      alGuardar?.();
      alCerrar();
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : "No pudimos guardar el domicilio.");
    } finally {
      setGuardando(false);
    }
  };

  const campo = (clave: keyof DatosNuevaPropiedad) => ({
    value: datos[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDatos({ ...datos, [clave]: e.target.value }),
    onBlur: () => setTocados((t) => ({ ...t, [clave]: true })),
  });

  const mostrarError = (clave: keyof DatosNuevaPropiedad) => tocados[clave] && errores[clave];

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
        aria-label="Agregar un domicilio"
        className={`absolute bottom-0 inset-x-0 z-[56] bg-sand rounded-t-[26px] shadow-sheet max-h-[92%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <form onSubmit={enviar} className="px-5 pt-3 pb-7" noValidate>
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold font-display text-ink">Agregar domicilio</h2>
            <button
              type="button"
              onClick={alCerrar}
              className="press w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* --- Tipo --- */}
          <fieldset className="mt-4">
            <legend className="text-[11px] font-bold tracking-wide uppercase text-faint mb-2">
              Qué es
            </legend>
            <div className="grid grid-cols-3 gap-2.5">
              {ICONOS.map(({ valor, etiqueta, Icono }) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setDatos({ ...datos, icono: valor })}
                  aria-pressed={datos.icono === valor}
                  className={`press flex flex-col items-center gap-1.5 rounded-2xl border bg-surface shadow-card py-3 ${
                    datos.icono === valor ? "border-brand-500 ring-2 ring-brand-500" : "border-line"
                  }`}
                >
                  <Icono
                    className={`w-5 h-5 ${datos.icono === valor ? "text-brand-600" : "text-faint"}`}
                  />
                  <span className="text-[12px] font-medium text-mute">{etiqueta}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <Campo
            id="nombre"
            etiqueta="Cómo lo llamás"
            ayuda="Ej: Mi hogar, Casa de mis viejos, El local"
            error={mostrarError("nombre")}
            {...campo("nombre")}
          />

          <div className="grid grid-cols-[1fr_92px] gap-2.5">
            <Campo id="calle" etiqueta="Calle" error={mostrarError("calle")} {...campo("calle")} />
            <Campo
              id="numero"
              etiqueta="Altura"
              inputMode="numeric"
              error={mostrarError("numero")}
              {...campo("numero")}
            />
          </div>

          <Campo
            id="localidad"
            etiqueta="Localidad"
            error={mostrarError("localidad")}
            {...campo("localidad")}
          />

          <div className="mt-3">
            <label
              htmlFor="provincia"
              className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
            >
              Provincia
            </label>
            <select
              id="provincia"
              {...campo("provincia")}
              className="w-full rounded-2xl bg-surface border border-line shadow-card px-4 py-3.5 text-[14px] text-ink outline-none focus:border-brand-300"
            >
              {PROVINCIAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {errorGuardar && (
            <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
              {errorGuardar}
            </p>
          )}

          <button
            type="submit"
            className="press mt-5 w-full rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab disabled:opacity-40"
            disabled={!valido || guardando}
          >
            {guardando ? "Guardando…" : "Guardar domicilio"}
          </button>

          <p className="text-[11.5px] text-faint text-center mt-3 leading-snug">
            Después vas a poder cargar los equipos de esta propiedad para que Nora calcule su score.
          </p>
        </form>
      </div>
    </>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  ...props
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string | false;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mt-3">
      <label
        htmlFor={id}
        className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
      >
        {etiqueta}
      </label>
      <input
        id={id}
        type="text"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined}
        className={`w-full rounded-2xl bg-surface border shadow-card px-4 py-3.5 text-[14px] text-ink placeholder:text-faint outline-none ${
          error ? "border-urgent" : "border-line focus:border-brand-300"
        }`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-urgent mt-1 px-1">
          {error}
        </p>
      ) : ayuda ? (
        <p id={`${id}-ayuda`} className="text-[12px] text-faint mt-1 px-1">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
