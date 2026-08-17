"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { listarSolicitudesTecnico, type SolicitudTecnico } from "@/lib/operaciones";
import { fechaCorta } from "@/lib/formato";

export default function PaginaSolicitudesTecnico() {
  const [solicitudes, setSolicitudes] = useState<SolicitudTecnico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  const traer = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    listarSolicitudesTecnico()
      .then((s) => {
        if (vivo) setSolicitudes(s);
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : "No pudimos cargar las solicitudes.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  if (error) return <ErrorCarga mensaje={error} alReintentar={traer} />;

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <Link href="/operaciones" className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute">
        <ArrowLeft className="w-4 h-4" /> Todos los pedidos
      </Link>

      <div className="mt-3">
        <h1 className="text-[22px] font-bold font-display text-ink">Solicitudes para ser técnico</h1>
        <p className="text-[13px] text-mute mt-0.5">Pendientes de verificación.</p>
      </div>

      {cargando ? (
        <div className="mt-5 space-y-2.5">
          <Bloque className="h-[70px] w-full rounded-xl2" />
          <Bloque className="h-[70px] w-full rounded-xl2" />
        </div>
      ) : solicitudes.length === 0 ? (
        <p className="text-[13.5px] text-faint mt-8 text-center">No hay solicitudes pendientes.</p>
      ) : (
        <div className="mt-5 bg-surface rounded-xl2 border border-line shadow-card divide-y divide-line overflow-hidden">
          {solicitudes.map((s) => (
            <Link
              key={s.id}
              href={`/operaciones/tecnicos/${s.id}`}
              className="press flex items-center gap-3.5 p-3.5"
            >
              <span className="shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
                {s.nombre.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink leading-tight truncate">{s.nombre}</p>
                <p className="text-[12px] text-faint mt-0.5 truncate">
                  {s.categorias.join(", ") || "Sin rubros"} · {s.zonaCobertura.join(", ") || "sin zona"}
                </p>
              </div>
              <p className="text-[11px] text-faint shrink-0">{fechaCorta(s.creadoEl.slice(0, 10))}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
