"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, UserCheck } from "lucide-react";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { EstadoVacio } from "@/componentes/EstadoVacio";
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
    <main className="h-dvh overflow-y-auto no-scrollbar px-5 pt-12 pb-28">
      <Link href="/operaciones" className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute">
        <ArrowLeft className="w-4 h-4" /> Todos los pedidos
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="shrink-0 w-11 h-11 grid place-items-center rounded-2xl bg-brand-600 text-white shadow-fab">
          <UserCheck className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-[20px] font-bold font-display text-ink leading-tight">Solicitudes para ser técnico</h1>
          <p className="text-[12.5px] text-mute mt-0.5">Pendientes de verificación.</p>
        </div>
      </div>

      {cargando ? (
        <div className="mt-5 space-y-2.5">
          <Bloque className="h-[76px] w-full rounded-xl2" />
          <Bloque className="h-[76px] w-full rounded-xl2" />
        </div>
      ) : solicitudes.length === 0 ? (
        <EstadoVacio
          icono={UserCheck}
          titulo="No hay solicitudes pendientes"
          texto="Cuando alguien cargue su ficha de técnico, va a aparecer acá para que la revises."
        />
      ) : (
        <div className="mt-5 space-y-2.5">
          {solicitudes.map((s) => (
            <Link
              key={s.id}
              href={`/operaciones/tecnicos/${s.id}`}
              className="press flex items-center gap-3.5 p-3.5 rounded-xl2 bg-surface border border-line shadow-card"
            >
              <span className="shrink-0 w-11 h-11 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
                {s.nombre.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink leading-tight truncate">{s.nombre}</p>
                <p className="text-[12px] text-faint mt-0.5 truncate">
                  {s.categorias.join(", ") || "Sin rubros"} · {s.zonaCobertura.join(", ") || "sin zona"}
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mt-1.5 text-[11.5px] font-semibold bg-warn/10 text-warn">
                  <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-warn" /> Pendiente de verificación
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <p className="text-[11px] text-faint">{fechaCorta(s.creadoEl.slice(0, 10))}</p>
                <ChevronRight className="w-4 h-4 text-faint" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
