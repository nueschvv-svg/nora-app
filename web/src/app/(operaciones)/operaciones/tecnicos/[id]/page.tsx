"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Check, FileText, Loader2, Phone, type LucideIcon } from "lucide-react";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import {
  obtenerSolicitudTecnico,
  rechazarTecnico,
  verificarTecnico,
  type SolicitudTecnicoDetalle,
} from "@/lib/operaciones";
import { fecha } from "@/lib/formato";

const ESTILO_ESTADO_TECNICO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente de verificación", clase: "bg-warn/10 text-warn" },
  verificado: { texto: "Verificado", clase: "bg-good/10 text-good" },
  rechazado: { texto: "Rechazado", clase: "bg-urgent/10 text-urgent" },
};

const ETIQUETA_DOCUMENTO: Record<string, string> = {
  dni_frente: "DNI (frente)",
  dni_dorso: "DNI (dorso)",
  selfie: "Selfie",
  matricula: "Título / matrícula",
  dni: "DNI",
  seguro_rc: "Seguro",
  cbu: "CBU",
  antecedentes: "Antecedentes",
};

export default function PaginaDetalleSolicitudTecnico({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [solicitud, setSolicitud] = useState<SolicitudTecnicoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [avisoAccion, setAvisoAccion] = useState<string | null>(null);

  const traer = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    obtenerSolicitudTecnico(id)
      .then((s) => {
        if (vivo) setSolicitud(s);
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : "No pudimos cargar la solicitud.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [id, intento]);

  const conGuardado = async (etiqueta: string, accion: () => Promise<void>) => {
    setGuardando(etiqueta);
    setAvisoAccion(null);
    try {
      await accion();
      traer();
    } catch (e) {
      setAvisoAccion(e instanceof Error ? e.message : "No pudimos guardar el cambio.");
    } finally {
      setGuardando(null);
    }
  };

  if (error) return <ErrorCarga mensaje={error} alReintentar={traer} />;

  if (cargando || !solicitud) {
    return (
      <main className="max-w-2xl mx-auto px-5 py-8 space-y-3">
        <Bloque className="h-8 w-40" />
        <Bloque className="h-[160px] w-full rounded-xl2" />
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-5 py-8 pb-20">
      <Link
        href="/operaciones/tecnicos"
        className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute"
      >
        <ArrowLeft className="w-4 h-4" /> Solicitudes
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <span className="shrink-0 w-11 h-11 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
          {solicitud.nombre.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-bold font-display text-ink leading-tight truncate">{solicitud.nombre}</h1>
          <p className="text-[12.5px] text-mute mt-0.5">Postuló el {fecha(solicitud.creadoEl.slice(0, 10))}</p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mt-1.5 text-[11.5px] font-semibold ${
              (ESTILO_ESTADO_TECNICO[solicitud.estado] ?? ESTILO_ESTADO_TECNICO.pendiente).clase
            }`}
          >
            <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-current" />
            {(ESTILO_ESTADO_TECNICO[solicitud.estado] ?? ESTILO_ESTADO_TECNICO.pendiente).texto}
          </span>
        </div>
      </div>

      {avisoAccion && (
        <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
          {avisoAccion}
        </p>
      )}

      <Seccion titulo="Contacto" icono={Phone}>
        <Fila etiqueta="Teléfono" valor={solicitud.telefono ?? "no cargado"} />
        <Fila etiqueta="Rubros" valor={solicitud.categorias.join(", ") || "—"} />
        <Fila etiqueta="Zona de cobertura" valor={solicitud.zonaCobertura.join(", ") || "—"} />
      </Seccion>

      <Seccion titulo="Documentos" icono={FileText}>
        {solicitud.documentos.length === 0 ? (
          <p className="text-[12.5px] text-faint">No subió ningún documento todavía.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {solicitud.documentos.map((d) => (
              <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
                <img
                  src={d.url}
                  alt={ETIQUETA_DOCUMENTO[d.tipo] ?? d.tipo}
                  className="w-full aspect-square object-cover rounded-xl2 border border-line"
                />
                <p className="text-[11.5px] text-mute mt-1 text-center">
                  {ETIQUETA_DOCUMENTO[d.tipo] ?? d.tipo}
                </p>
              </a>
            ))}
          </div>
        )}
      </Seccion>

      {solicitud.estado === "pendiente" && (
        <Seccion titulo="Acciones" icono={Check}>
          <div className="flex gap-2.5">
            <BotonAccion
              texto="Verificar"
              icono={Check}
              cargando={guardando === "verificar"}
              onClick={() => conGuardado("verificar", () => verificarTecnico(id))}
            />
            <BotonAccion
              texto="Rechazar"
              icono={Ban}
              variante="peligro"
              cargando={guardando === "rechazar"}
              onClick={() => {
                if (!window.confirm("¿Rechazar esta solicitud?")) return;
                conGuardado("rechazar", () => rechazarTecnico(id));
              }}
            />
          </div>
        </Seccion>
      )}
    </main>
  );
}

function Seccion({
  titulo,
  icono: Icono,
  children,
}: {
  titulo: string;
  icono: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-faint px-0.5 mb-1.5">
        <Icono className="w-3.5 h-3.5" /> {titulo}
      </p>
      <div className="bg-surface rounded-xl2 border border-line shadow-card p-4 space-y-3">{children}</div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[13px] text-mute shrink-0">{etiqueta}</span>
      <span className="text-[13px] font-semibold text-ink text-right">{valor}</span>
    </div>
  );
}

function BotonAccion({
  texto,
  onClick,
  cargando,
  variante = "normal",
  icono: Icono,
}: {
  texto: string;
  onClick: () => void;
  cargando?: boolean;
  variante?: "normal" | "peligro";
  icono?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      className={`press flex items-center gap-2 rounded-xl2 px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50 ${
        variante === "peligro" ? "bg-urgent/10 text-urgent" : "bg-brand-600 text-white"
      }`}
    >
      {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icono && <Icono className="w-3.5 h-3.5" />}
      {texto}
    </button>
  );
}
