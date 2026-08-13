"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, Clock, X } from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { categorias } from "@/lib/datos-demo";

/* FLUJO DE PEDIDO — versión MVP honesta.

   Diferencias a propósito con el prototipo:
   · No hay chat con IA. El prototipo simulaba una IA que en realidad
     respondía siempre lo mismo. Acá el usuario describe el problema
     en un campo de texto y listo.
   · No hay presupuesto instantáneo. No podemos dar precio fijo sin
     historial de trabajos. Prometemos presupuesto antes de empezar.
   · No hay pago acá. Se cobra al terminar, con link de Mercado Pago.

   Todo eso vuelve en fase 3, cuando haya datos que lo sostengan. */

const FRANJAS = [
  { id: "manana", texto: "Mañana · 8 a 12 h" },
  { id: "tarde-1", texto: "Tarde · 13 a 17 h" },
  { id: "tarde-2", texto: "Tarde · 17 a 20 h" },
  { id: "urgente", texto: "Lo antes posible" },
];

const PASOS = ["Categoría", "El problema", "Cuándo", "Confirmar"];

export default function PaginaPedir() {
  const router = useRouter();
  const { propiedad } = useApp();

  const [paso, setPaso] = useState(0);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [dia, setDia] = useState<string | null>(null);
  const [franja, setFranja] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const proximosDias = obtenerProximosDias();
  const catElegida = categorias.find((c) => c.slug === categoria);

  const puedeAvanzar =
    (paso === 0 && !!categoria) ||
    (paso === 1 && descripcion.trim().length >= 10) ||
    (paso === 2 && !!dia && !!franja) ||
    paso === 3;

  const avanzar = () => {
    if (!puedeAvanzar) return;
    if (paso === 3) {
      setEnviado(true);
      return;
    }
    setPaso(paso + 1);
  };

  if (enviado) return <Confirmacion propiedad={propiedad.nombre} />;

  return (
    <div className="absolute inset-0 z-40 bg-sand flex flex-col">
      {/* --- Encabezado con progreso --- */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => (paso === 0 ? router.push("/inicio") : setPaso(paso - 1))}
          className="press w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
          aria-label={paso === 0 ? "Salir" : "Paso anterior"}
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <div className="flex-1">
          <div
            className="h-1.5 w-full rounded-full bg-line overflow-hidden"
            role="progressbar"
            aria-valuenow={paso + 1}
            aria-valuemin={1}
            aria-valuemax={PASOS.length}
            aria-label={`Paso ${paso + 1} de ${PASOS.length}: ${PASOS[paso]}`}
          >
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
              style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }}
            />
          </div>
        </div>
        <Link
          href="/inicio"
          className="press w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
          aria-label="Cerrar"
        >
          <X className="w-[18px] h-[18px]" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6">
        {/* ---------- PASO 0: categoría ---------- */}
        {paso === 0 && (
          <section>
            <h1 className="text-[22px] font-bold font-display text-ink leading-tight">
              ¿Qué necesitás
              <br />
              resolver?
            </h1>
            <p className="text-[13px] text-mute mt-1.5">
              Arrancamos con estos rubros en {propiedad.localidad}. Vamos sumando más.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-5">
              {categorias.map((c) => {
                const elegida = categoria === c.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    disabled={!c.activa}
                    onClick={() => setCategoria(c.slug)}
                    aria-pressed={elegida}
                    aria-label={c.activa ? c.nombre : `${c.nombre} — todavía no disponible`}
                    className={`press relative flex flex-col items-center gap-2 rounded-2xl border shadow-card py-4 px-1 ${
                      !c.activa
                        ? "bg-surface/50 border-line opacity-55 cursor-not-allowed"
                        : elegida
                          ? "bg-surface border-brand-500 ring-2 ring-brand-500"
                          : "bg-surface border-line"
                    }`}
                  >
                    <span className={c.activa ? "text-brand-600" : "text-faint"}>
                      <IconoEquipo nombre={c.icono} className="w-6 h-6" />
                    </span>
                    <span className="text-[12px] font-medium text-mute text-center leading-tight">
                      {c.nombre}
                    </span>
                    {!c.activa && (
                      <span className="text-[9.5px] font-semibold uppercase tracking-wide text-faint">
                        Pronto
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------- PASO 1: el problema ---------- */}
        {paso === 1 && (
          <section>
            <h1 className="text-[22px] font-bold font-display text-ink leading-tight">
              Contanos qué
              <br />
              está pasando
            </h1>
            <p className="text-[13px] text-mute mt-1.5">
              Cuanto más detalle nos des, mejor preparado llega el técnico.
            </p>

            <div className="mt-4 rounded-2xl bg-surface border border-line shadow-card p-3 flex items-center gap-3">
              <span className="w-8 h-8 grid place-items-center rounded-lg bg-brand-50 text-brand-600">
                <IconoEquipo nombre={propiedad.icono} className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink truncate">
                  {propiedad.nombre} · {propiedad.direccion}
                </p>
                <p className="text-[11px] text-faint">{catElegida?.nombre}</p>
              </div>
            </div>

            <label htmlFor="descripcion" className="sr-only">
              Descripción del problema
            </label>
            <textarea
              id="descripcion"
              rows={5}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: pierde agua la conexión de abajo de la bacha de la cocina, gotea desde ayer."
              className="mt-3 w-full rounded-2xl bg-surface border border-line shadow-card p-4 text-[14px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
            />
            <p className="text-[11.5px] text-faint mt-1.5 px-1">
              {descripcion.trim().length < 10
                ? "Escribí al menos unas palabras para poder ayudarte."
                : "Perfecto, con eso alcanza."}
            </p>

            {/* Las fotos son lo que más ayuda al técnico a venir preparado. */}
            <button
              type="button"
              onClick={() => setFotos([...fotos, `foto-${fotos.length + 1}`])}
              className="press mt-3 w-full flex items-center justify-center gap-2 rounded-xl2 border border-dashed border-brand-200 text-brand-600 py-3.5 text-[14px] font-semibold"
            >
              <Camera className="w-[17px] h-[17px]" />
              {fotos.length === 0 ? "Sumar una foto (opcional)" : `${fotos.length} foto(s) agregada(s)`}
            </button>
          </section>
        )}

        {/* ---------- PASO 2: cuándo ---------- */}
        {paso === 2 && (
          <section>
            <h1 className="text-[22px] font-bold font-display text-ink leading-tight">
              ¿Cuándo te
              <br />
              viene bien?
            </h1>
            <p className="text-[13px] text-mute mt-1.5">
              Elegí día y franja. Te confirmamos el horario exacto con el técnico.
            </p>

            <div className="mt-5 flex gap-2.5 overflow-x-auto no-scrollbar -mx-5 px-5">
              {proximosDias.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => setDia(d.iso)}
                  aria-pressed={dia === d.iso}
                  className={`press shrink-0 w-[64px] rounded-2xl border bg-surface shadow-card py-3 flex flex-col items-center gap-0.5 ${
                    dia === d.iso ? "border-brand-500 ring-2 ring-brand-500" : "border-line"
                  }`}
                >
                  <span className="text-[11px] text-faint uppercase">{d.diaSemana}</span>
                  <span className="num text-[18px] font-bold text-ink">{d.numero}</span>
                  <span className="text-[11px] text-faint">{d.mes}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {FRANJAS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFranja(f.id)}
                  aria-pressed={franja === f.id}
                  className={`press rounded-2xl border bg-surface shadow-card py-3.5 px-2 text-[13.5px] font-semibold text-ink ${
                    franja === f.id ? "border-brand-500 ring-2 ring-brand-500" : "border-line"
                  }`}
                >
                  {f.texto}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------- PASO 3: confirmar ---------- */}
        {paso === 3 && (
          <section>
            <h1 className="text-[22px] font-bold font-display text-ink leading-tight">
              Revisá y
              <br />
              enviá el pedido
            </h1>

            <div className="mt-5 rounded-xl2 bg-surface border border-line shadow-card divide-y divide-line overflow-hidden">
              <Fila etiqueta="Servicio" valor={catElegida?.nombre ?? "—"} />
              <Fila etiqueta="Domicilio" valor={`${propiedad.nombre} · ${propiedad.direccion}`} />
              <Fila
                etiqueta="Cuándo"
                valor={`${proximosDias.find((d) => d.iso === dia)?.etiquetaLarga ?? "—"} · ${
                  FRANJAS.find((f) => f.id === franja)?.texto.split(" · ")[1] ?? ""
                }`}
              />
              {fotos.length > 0 && <Fila etiqueta="Fotos" valor={`${fotos.length} adjunta(s)`} />}
            </div>

            <div className="mt-3 rounded-xl2 bg-surface border border-line shadow-card p-4">
              <p className="text-[11px] font-bold tracking-wide uppercase text-faint">El problema</p>
              <p className="text-[13.5px] text-ink leading-relaxed mt-1.5">{descripcion}</p>
            </div>

            {/* Ser claro con el precio evita el 90% de los problemas después. */}
            <div className="mt-3 flex items-start gap-2.5 rounded-xl2 bg-brand-50 border border-brand-100 px-3.5 py-3">
              <Clock className="w-[18px] h-[18px] text-brand-600 shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink leading-snug">
                Te contactamos por WhatsApp en menos de <span className="font-semibold">2 horas</span>{" "}
                con el técnico asignado. El presupuesto lo confirmás vos{" "}
                <span className="font-semibold">antes</span> de que arranque el trabajo: no se cobra
                nada hasta entonces.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* --- Pie con el botón de avance --- */}
      <div className="px-5 pb-7 pt-2 bg-gradient-to-t from-sand via-sand to-transparent">
        <button
          type="button"
          onClick={avanzar}
          disabled={!puedeAvanzar}
          className="press w-full flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white px-5 py-4 shadow-fab text-[15.5px] font-semibold disabled:opacity-40 disabled:pointer-events-none"
        >
          {paso === 3 ? "Enviar pedido" : "Continuar"}
          <ArrowRight className="w-[19px] h-[19px]" />
        </button>
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-[13px] text-mute shrink-0">{etiqueta}</span>
      <span className="text-[13px] font-semibold text-ink text-right">{valor}</span>
    </div>
  );
}

function Confirmacion({ propiedad }: { propiedad: string }) {
  return (
    <div className="absolute inset-0 z-40 bg-sand flex flex-col items-center justify-center text-center px-8">
      <div className="w-24 h-24 grid place-items-center rounded-full bg-good/15 text-good">
        <Check className="w-11 h-11" />
      </div>
      <h1 className="text-[24px] font-bold font-display text-ink mt-6">¡Pedido enviado!</h1>
      <p className="text-[13.5px] text-mute mt-2.5 max-w-[290px] leading-relaxed">
        Ya lo estamos viendo. Te escribimos por WhatsApp en menos de 2 horas con el técnico asignado
        para {propiedad}.
      </p>
      <Link
        href="/inicio"
        className="press mt-8 w-full max-w-[290px] flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

/** Los próximos 7 días, listos para mostrar. */
function obtenerProximosDias() {
  const DIAS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const hoy = new Date();

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    return {
      iso: d.toISOString().slice(0, 10),
      diaSemana: i === 0 ? "HOY" : i === 1 ? "MAÑ" : DIAS[d.getDay()],
      numero: d.getDate(),
      mes: MESES[d.getMonth()],
      etiquetaLarga: i === 0 ? "Hoy" : `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`,
    };
  });
}
