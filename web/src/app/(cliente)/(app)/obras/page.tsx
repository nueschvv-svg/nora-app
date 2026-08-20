"use client";

import { useCallback, useEffect, useState } from "react";
import { Hammer, Link2, MessageCircle, Phone, Plus, User } from "lucide-react";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { FormularioObra } from "@/componentes/FormularioObra";
import { HojaInvitarObra } from "@/componentes/HojaInvitarObra";
import { HojaChatObra } from "@/componentes/HojaChatObra";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { useApp } from "@/componentes/ContextoApp";
import {
  actualizarEtapas,
  listarObras,
  siguienteEstadoEtapa,
  type Etapa,
  type Obra,
} from "@/lib/obras";
import { pesos } from "@/lib/formato";

/* Sección para clientes con una construcción grande en curso — no un
   servicio puntual de Nora. Cualquier obra, no sólo las de Enjinia
   (esa integración con datos reales queda para cuando llegue su
   base): el cliente la carga a mano, con sus etapas y quien la
   dirige, y va marcando el avance tocando cada etapa. */
export default function PaginaObras() {
  const { sesion } = useApp();
  const [obras, setObras] = useState<Obra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [formAbierto, setFormAbierto] = useState(false);
  const [obraInvitar, setObraInvitar] = useState<Obra | null>(null);
  const [obraChat, setObraChat] = useState<Obra | null>(null);

  const traer = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    listarObras()
      .then((o) => {
        if (vivo) setObras(o);
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : "No pudimos cargar tus obras.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  const tocarEtapa = async (obra: Obra, indice: number) => {
    const etapas: Etapa[] = obra.etapas.map((e, i) =>
      i === indice ? { ...e, estado: siguienteEstadoEtapa(e.estado) } : e,
    );
    // Optimista: se ve el cambio al toque, sin esperar la vuelta del servidor.
    setObras((prev) => prev.map((o) => (o.id === obra.id ? { ...o, etapas } : o)));
    try {
      await actualizarEtapas(obra.id, etapas);
    } catch {
      traer();
    }
  };

  if (error) return <ErrorCarga mensaje={error} alReintentar={traer} />;

  return (
    <main className="h-full overflow-y-auto no-scrollbar px-5 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold font-display text-ink">Obras</h1>
          <p className="text-[13px] text-mute mt-0.5">Tus proyectos grandes, bajo control.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormAbierto(true)}
          className="press shrink-0 w-11 h-11 grid place-items-center rounded-2xl bg-brand-600 text-white shadow-fab"
          aria-label="Agregar obra"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {cargando ? (
        <div className="mt-5 space-y-3">
          <Bloque className="h-[220px] w-full rounded-xl3" />
        </div>
      ) : obras.length === 0 ? (
        <EstadoVacio
          icono={Hammer}
          titulo="Todavía no cargaste ninguna obra"
          texto="Tocá el + para sumar tu construcción — con Enjinia o con cualquier otro equipo dirigiendo la obra."
        />
      ) : (
        <div className="mt-5 space-y-4">
          {obras.map((obra) => (
            <TarjetaObra
              key={obra.id}
              obra={obra}
              esDueno={obra.clienteId === sesion?.id}
              alTocarEtapa={(i) => tocarEtapa(obra, i)}
              alInvitar={() => setObraInvitar(obra)}
              alAbrirChat={() => setObraChat(obra)}
            />
          ))}
        </div>
      )}

      <FormularioObra
        abierto={formAbierto}
        alCerrar={() => setFormAbierto(false)}
        alGuardar={(obra) => {
          setObras((prev) => [obra, ...prev]);
          setFormAbierto(false);
        }}
      />

      <HojaInvitarObra
        abierto={!!obraInvitar}
        alCerrar={() => setObraInvitar(null)}
        nombreObra={obraInvitar?.nombre ?? ""}
        obraId={obraInvitar?.id ?? ""}
      />

      <HojaChatObra
        abierto={!!obraChat}
        alCerrar={() => setObraChat(null)}
        obraId={obraChat?.id ?? null}
        nombreObra={obraChat?.nombre ?? ""}
      />
    </main>
  );
}

function TarjetaObra({
  obra,
  esDueno,
  alTocarEtapa,
  alInvitar,
  alAbrirChat,
}: {
  obra: Obra;
  esDueno: boolean;
  alTocarEtapa: (indice: number) => void;
  alInvitar: () => void;
  alAbrirChat: () => void;
}) {
  const total = obra.etapas.length;
  const completas = obra.etapas.filter((e) => e.estado === "completo").length;
  const porcentaje = total > 0 ? Math.round((completas / total) * 100) : null;

  return (
    <div className="rounded-xl3 overflow-hidden border border-line shadow-card">
      <div
        className="relative p-5 text-white"
        style={{
          backgroundImage: "radial-gradient(120% 80% at 100% 0%, #14857A 0%, #0E5C54 38%, #0B3B38 100%)",
        }}
      >
        <div className="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full bg-brand-400/20 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-block text-[10.5px] font-bold uppercase tracking-wide bg-white/15 rounded-full px-2.5 py-1">
              En ejecución
            </span>
            <h2 className="text-[19px] font-bold font-display leading-tight mt-2 truncate">{obra.nombre}</h2>
            {obra.ubicacion && <p className="text-[12.5px] text-brand-100 mt-0.5 truncate">{obra.ubicacion}</p>}
          </div>
          {porcentaje != null && (
            <span className="shrink-0 text-[13px] font-bold bg-white/15 rounded-full px-2.5 py-1">
              {porcentaje}%
            </span>
          )}
        </div>

        {porcentaje != null && (
          <div className="relative mt-4">
            <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white" style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="text-[11.5px] text-brand-100 mt-1.5">Avance de obra · {porcentaje}% completado</p>
          </div>
        )}

        {(obra.presupuestoArs != null || obra.ejecutadoArs != null) && (
          <div className="relative mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="text-[10.5px] text-brand-100">Presupuesto</p>
              <p className="num text-[14.5px] font-bold mt-0.5">
                {obra.presupuestoArs != null ? pesos(obra.presupuestoArs) : "—"}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="text-[10.5px] text-brand-100">Ejecutado</p>
              <p className="num text-[14.5px] font-bold mt-0.5">
                {obra.ejecutadoArs != null ? pesos(obra.ejecutadoArs) : "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      {obra.etapas.length > 0 && (
        <div className="bg-surface p-4">
          <p className="text-[11px] font-bold tracking-wide uppercase text-faint mb-2">Etapas</p>
          <div className="space-y-1">
            {obra.etapas.map((etapa, i) => (
              <button
                key={i}
                type="button"
                onClick={() => alTocarEtapa(i)}
                className="press w-full flex items-center justify-between gap-3 py-2 text-left"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`shrink-0 w-5 h-5 rounded-full grid place-items-center ${
                      etapa.estado === "completo"
                        ? "bg-good/15 text-good"
                        : etapa.estado === "en_curso"
                          ? "bg-warn/15 text-warn"
                          : "bg-line text-faint"
                    }`}
                  >
                    {etapa.estado === "completo" ? "✓" : etapa.estado === "en_curso" ? "•" : ""}
                  </span>
                  <span className="text-[13.5px] font-medium text-ink truncate">{etapa.nombre}</span>
                </span>
                <span
                  className={`shrink-0 text-[11px] font-semibold ${
                    etapa.estado === "completo"
                      ? "text-good"
                      : etapa.estado === "en_curso"
                        ? "text-warn"
                        : "text-faint"
                  }`}
                >
                  {etapa.estado === "completo" ? "Completo" : etapa.estado === "en_curso" ? "En curso" : "Pendiente"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(obra.contactoNombre || obra.contactoTelefono) && (
        <div className="bg-surface border-t border-line p-4 flex items-center gap-3">
          <span className="shrink-0 w-10 h-10 grid place-items-center rounded-full bg-brand-50 text-brand-600">
            <User className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink truncate">
              {obra.contactoNombre ?? "Contacto de la obra"}
            </p>
            {obra.contactoRol && <p className="text-[11.5px] text-faint truncate">{obra.contactoRol}</p>}
          </div>
          {obra.contactoTelefono && (
            <a
              href={`tel:${obra.contactoTelefono.replace(/[^\d+]/g, "")}`}
              className="press shrink-0 w-9 h-9 grid place-items-center rounded-full bg-brand-50 text-brand-600"
              aria-label={`Llamar a ${obra.contactoNombre ?? "contacto"}`}
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      <div className="bg-surface border-t border-line p-4 flex items-center gap-2.5">
        {esDueno && (
          <button
            type="button"
            onClick={alInvitar}
            className="press flex-1 flex items-center justify-center gap-1.5 rounded-xl2 border border-line text-ink py-2.5 text-[13px] font-semibold"
          >
            <Link2 className="w-4 h-4" />
            Invitar
          </button>
        )}
        <button
          type="button"
          onClick={alAbrirChat}
          className="press flex-1 flex items-center justify-center gap-1.5 rounded-xl2 border border-line text-ink py-2.5 text-[13px] font-semibold"
        >
          <MessageCircle className="w-4 h-4" />
          Chat
        </button>
      </div>
    </div>
  );
}
