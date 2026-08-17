"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, LogOut, UserCheck } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { listarSolicitudesTecnico, listarTodosLosServicios, type ServicioLista } from "@/lib/operaciones";
import { ETIQUETA_ESTADO, type EstadoServicio } from "@/lib/tipos";
import { fechaCorta, pesos } from "@/lib/formato";

/* Mismo criterio que historial/page.tsx: qué está "en curso" y qué ya
   se cerró. Está duplicado a propósito y no importado desde ahí — esa
   página es del cliente, filtrada a un solo domicilio; esta es de
   operaciones, sobre todos los pedidos de todos los clientes. Son
   pantallas distintas que conviene no acoplar. */
const EN_CURSO = new Set<EstadoServicio>([
  "solicitado",
  "buscando_tecnico",
  "asignado",
  "presupuestado",
  "aceptado",
  "en_camino",
  "en_curso",
]);

type Pestana = "en_curso" | "resueltos" | "todos";

export default function PaginaOperaciones() {
  const router = useRouter();
  const [servicios, setServicios] = useState<ServicioLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("en_curso");
  const [intento, setIntento] = useState(0);
  const [solicitudesTecnico, setSolicitudesTecnico] = useState(0);

  const traer = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    listarTodosLosServicios()
      .then((s) => {
        if (vivo) setServicios(s);
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : "No pudimos cargar los pedidos.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    listarSolicitudesTecnico()
      .then((s) => {
        if (vivo) setSolicitudesTecnico(s.length);
      })
      .catch(() => {
        /* No es crítico: el link a la lista sigue andando sin el contador. */
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  if (error) return <ErrorCarga mensaje={error} alReintentar={traer} />;

  const filtrados = servicios.filter((s) => {
    if (pestana === "en_curso") return EN_CURSO.has(s.estado);
    if (pestana === "resueltos") return !EN_CURSO.has(s.estado) && s.estado !== "cancelado";
    return true;
  });

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold font-display text-ink">Panel de operaciones</h1>
          <p className="text-[13px] text-mute mt-0.5">Todos los pedidos, de todos los clientes.</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await supabaseNavegador().auth.signOut();
            router.replace("/entrar");
            router.refresh();
          }}
          className="press flex items-center gap-1.5 text-[13px] font-semibold text-urgent"
        >
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </div>

      <Link
        href="/operaciones/tecnicos"
        className="press mt-4 flex items-center gap-3 rounded-xl2 bg-brand-50 border border-brand-100 px-4 py-3"
      >
        <span className="shrink-0 w-9 h-9 grid place-items-center rounded-full bg-brand-600 text-white">
          <UserCheck className="w-[18px] h-[18px]" />
        </span>
        <span className="flex-1 text-[13.5px] font-semibold text-brand-600">Solicitudes para ser técnico</span>
        {solicitudesTecnico > 0 && (
          <span className="shrink-0 text-[11.5px] font-bold text-white bg-brand-600 rounded-full w-6 h-6 grid place-items-center">
            {solicitudesTecnico}
          </span>
        )}
      </Link>

      <div className="flex gap-2 mt-5">
        {(
          [
            ["en_curso", "En curso"],
            ["resueltos", "Resueltos"],
            ["todos", "Todos"],
          ] as [Pestana, string][]
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setPestana(valor)}
            aria-pressed={pestana === valor}
            className={`press rounded-full px-4 py-2 text-[13px] font-semibold border ${
              pestana === valor
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-surface text-mute border-line"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="mt-5 space-y-2.5">
          <Bloque className="h-[70px] w-full rounded-xl2" />
          <Bloque className="h-[70px] w-full rounded-xl2" />
          <Bloque className="h-[70px] w-full rounded-xl2" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-[13.5px] text-faint mt-8 text-center">No hay pedidos acá.</p>
      ) : (
        <div className="mt-5 bg-surface rounded-xl2 border border-line shadow-card divide-y divide-line overflow-hidden">
          {filtrados.map((s) => (
            <Link
              key={s.id}
              href={`/operaciones/${s.id}`}
              className="press flex items-center gap-3.5 p-3.5"
            >
              <span className="shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
                {s.categoriaNombre.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink leading-tight truncate">
                  {s.clienteNombre} · {s.categoriaNombre}
                </p>
                <p className="text-[12px] text-faint mt-0.5 truncate">
                  {s.propiedadNombre} · {s.propiedadLocalidad}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 text-[11.5px] text-brand-600 font-semibold">
                  <Clock className="w-3 h-3" /> {ETIQUETA_ESTADO[s.estado]}
                </span>
                <p className="text-[11px] text-faint mt-0.5">
                  {s.montoArs != null ? pesos(s.montoArs) : fechaCorta(s.creadoEl.slice(0, 10))}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
