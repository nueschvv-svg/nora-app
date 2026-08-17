"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { crearObra, type Obra } from "@/lib/obras";

/* Alta de una obra propia. Mismo patrón que FormularioPropiedad /
   FormularioTrabajador: hoja que sube desde abajo, se resetea al
   abrir (durante el render, no en un efecto, para no parpadear). */

const VACIO = {
  nombre: "",
  ubicacion: "",
  presupuesto: "",
  etapasTexto: "",
  contactoNombre: "",
  contactoRol: "",
  contactoTelefono: "",
};

export function FormularioObra({
  abierto,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: (obra: Obra) => void;
}) {
  const [datos, setDatos] = useState(VACIO);
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  const [estabaAbierto, setEstabaAbierto] = useState(abierto);
  if (abierto !== estabaAbierto) {
    setEstabaAbierto(abierto);
    if (abierto) {
      setDatos(VACIO);
      setTocados({});
      setErrorGuardar(null);
    }
  }

  const errores: Partial<Record<"nombre", string>> = {};
  if (datos.nombre.trim().length < 2) errores.nombre = "Contanos cómo se llama la obra";
  const valido = Object.keys(errores).length === 0;
  const mostrarError = (clave: "nombre") => tocados[clave] && errores[clave];

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    if (!valido) {
      setTocados({ nombre: true });
      return;
    }
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const etapas = datos.etapasTexto
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter(Boolean)
        .map((nombre) => ({ nombre, estado: "pendiente" as const }));

      const obra = await crearObra({
        nombre: datos.nombre,
        ubicacion: datos.ubicacion,
        presupuestoArs: datos.presupuesto.trim() ? Number(datos.presupuesto) : null,
        etapas,
        contactoNombre: datos.contactoNombre,
        contactoRol: datos.contactoRol,
        contactoTelefono: datos.contactoTelefono,
      });
      alGuardar(obra);
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : "No pudimos guardar la obra.");
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
        aria-label="Agregar obra"
        className={`absolute bottom-0 inset-x-0 z-[56] bg-sand rounded-t-[26px] shadow-sheet max-h-[92%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <form onSubmit={enviar} className="px-5 pt-3 pb-7" noValidate>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-bold font-display text-ink">Agregar obra</h2>
              <p className="text-[12.5px] text-mute">Tu construcción, con o sin Enjinia</p>
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

          <Campo
            id="obra-nombre"
            etiqueta="Nombre de la obra"
            error={mostrarError("nombre")}
            placeholder="Ej: Casa nueva, Ampliación del fondo"
            value={datos.nombre}
            onChange={(e) => setDatos((d) => ({ ...d, nombre: e.target.value }))}
            onBlur={() => setTocados((t) => ({ ...t, nombre: true }))}
          />

          <Campo
            id="obra-ubicacion"
            etiqueta="Ubicación"
            placeholder="Ej: Tigre, Buenos Aires"
            value={datos.ubicacion}
            onChange={(e) => setDatos((d) => ({ ...d, ubicacion: e.target.value }))}
          />

          <Campo
            id="obra-presupuesto"
            etiqueta="Presupuesto total (ARS, opcional)"
            type="number"
            inputMode="numeric"
            placeholder="Ej: 48000000"
            value={datos.presupuesto}
            onChange={(e) => setDatos((d) => ({ ...d, presupuesto: e.target.value }))}
          />

          <div className="mt-3">
            <label className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
              Etapas (opcional)
            </label>
            <textarea
              value={datos.etapasTexto}
              onChange={(e) => setDatos((d) => ({ ...d, etapasTexto: e.target.value }))}
              placeholder={"Una por línea o separadas por coma, ej:\nFundaciones y estructura\nMampostería\nInstalaciones\nTerminaciones"}
              rows={4}
              className="w-full rounded-2xl bg-surface border border-line shadow-card px-4 py-2.5 text-[13.5px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
            />
            <p className="text-[11.5px] text-faint mt-1.5 px-1">
              Después vas a poder tocarlas para ir marcando el avance.
            </p>
          </div>

          <p className="text-[11px] font-bold tracking-wide uppercase text-faint mt-4 mb-1.5 px-0.5">
            Quién la dirige (opcional)
          </p>
          <Campo
            id="obra-contacto-nombre"
            etiqueta="Nombre"
            placeholder="Ej: Arq. Sofía Méndez"
            value={datos.contactoNombre}
            onChange={(e) => setDatos((d) => ({ ...d, contactoNombre: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <Campo
              id="obra-contacto-rol"
              etiqueta="Rol"
              placeholder="Arquitecta, maestro..."
              value={datos.contactoRol}
              onChange={(e) => setDatos((d) => ({ ...d, contactoRol: e.target.value }))}
            />
            <Campo
              id="obra-contacto-telefono"
              etiqueta="Teléfono"
              type="tel"
              inputMode="tel"
              placeholder="11 5555 5555"
              value={datos.contactoTelefono}
              onChange={(e) => setDatos((d) => ({ ...d, contactoTelefono: e.target.value }))}
            />
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
            {guardando ? "Guardando…" : "Agregar obra"}
          </button>
        </form>
      </div>
    </>
  );
}

function Campo({
  id,
  etiqueta,
  error,
  ...props
}: {
  id: string;
  etiqueta: string;
  error?: string | false;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mt-3">
      <label htmlFor={id} className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
        {etiqueta}
      </label>
      <input
        id={id}
        type="text"
        aria-invalid={!!error}
        className={`w-full rounded-2xl bg-surface border shadow-card px-4 py-3.5 text-[14px] text-ink placeholder:text-faint outline-none ${
          error ? "border-urgent" : "border-line focus:border-brand-300"
        }`}
        {...props}
      />
      {error && (
        <p role="alert" className="text-[12px] text-urgent mt-1 px-1">
          {error}
        </p>
      )}
    </div>
  );
}
