"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardList, LogOut, PackageOpen, Radio } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { listarTodosLosServicios, type ServicioLista } from "@/lib/operaciones";
import { type EstadoServicio } from "@/lib/tipos";
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
    return () => {
      vivo = false;
    };
  }, [intento]);

  if (error) return <ErrorCarga mensaje={error} alReintentar={traer} />;

  const enCurso = servicios.filter((s) => EN_CURSO.has(s.estado));
  const resueltos = servicios.filter((s) => !EN_CURSO.has(s.estado) && s.estado !== "cancelado");
  const filtrados = pestana === "en_curso" ? enCurso : pestana === "resueltos" ? resueltos : servicios;
  const montoEnCurso = enCurso.reduce((suma, s) => suma + (s.montoArs ?? 0), 0);

  return (
    <main className="h-dvh overflow-y-auto no-scrollbar pb-28">
      <div className="px-5 pt-12 pb-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold font-display text-ink leading-tight">Panel de operaciones</h1>
          <p className="text-[13px] text-mute mt-0.5">Todos los pedidos, de todos los clientes.</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await supabaseNavegador().auth.signOut();
            router.replace("/entrar");
            router.refresh();
          }}
          className="press flex items-center gap-1.5 text-[12.5px] font-semibold text-urgent shrink-0 mt-1.5"
        >
          <LogOut className="w-3.5 h-3.5" /> Salir
        </button>
      </div>

      {!cargando && (
        <div className="px-5 mt-2">
          <section
            className="relative overflow-hidden rounded-xl3 bg-brand-700 text-white shadow-hero p-5"
            style={{
              backgroundImage: "radial-gradient(120% 80% at 100% 0%, #14857A 0%, #0E5C54 38%, #0B3B38 100%)",
            }}
          >
            <div className="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full bg-brand-400/20 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur px-2.5 py-1 text-[11.5px] font-medium text-brand-50">
                  <ClipboardList className="w-[13px] h-[13px]" /> Pedidos activos
                </span>
                <p className="mt-2.5 text-[30px] font-extrabold font-display leading-none num">{enCurso.length}</p>
                <p className="text-[13px] text-brand-100 mt-1.5">
                  {enCurso.length === 1 ? "pedido en curso" : "pedidos en curso"}
                </p>
              </div>
              <span className="shrink-0 w-14 h-14 grid place-items-center rounded-2xl bg-white/10">
                <ClipboardList className="w-6 h-6" />
              </span>
            </div>

            <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/[.08] border border-white/10 px-3.5 py-3">
              <span className="shrink-0 w-9 h-9 grid place-items-center rounded-xl bg-good/20 text-emerald-200">
                <Radio className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-white leading-snug">
                  {resueltos.length} {resueltos.length === 1 ? "resuelto" : "resueltos"}
                </p>
                <p className="text-[11px] text-brand-100 mt-0.5">Del total histórico</p>
              </div>
              <div className="text-right shrink-0">
                <p className="num text-[14px] font-bold text-white leading-tight">{pesos(montoEnCurso)}</p>
                <p className="text-[10px] text-brand-100 mt-0.5">en pedidos activos</p>
              </div>
            </div>
          </section>
        </div>
      )}

      <div className="px-5 flex gap-2 mt-5">
        {(
          [
            ["en_curso", "En curso", enCurso.length],
            ["resueltos", "Resueltos", resueltos.length],
            ["todos", "Todos", servicios.length],
          ] as [Pestana, string, number][]
        ).map(([valor, etiqueta, cantidad]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setPestana(valor)}
            aria-pressed={pestana === valor}
            className={`press flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold border ${
              pestana === valor
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-surface text-mute border-line"
            }`}
          >
            {etiqueta}
            {cantidad > 0 && (
              <span
                className={`text-[11px] font-bold rounded-full w-5 h-5 grid place-items-center ${
                  pestana === valor ? "bg-white/20 text-white" : "bg-brand-50 text-brand-600"
                }`}
              >
                {cantidad}
              </span>
            )}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="px-5 mt-5 space-y-2.5">
          <Bloque className="h-[76px] w-full rounded-xl2" />
          <Bloque className="h-[76px] w-full rounded-xl2" />
          <Bloque className="h-[76px] w-full rounded-xl2" />
        </div>
      ) : filtrados.length === 0 ? (
        <EstadoVacio icono={PackageOpen} titulo="No hay pedidos acá" texto="Los pedidos que entren van a aparecer en esta lista." />
      ) : (
        <div className="px-5 mt-5 space-y-2.5">
          {filtrados.map((s) => (
            <Link
              key={s.id}
              href={`/operaciones/${s.id}`}
              className="press flex items-center gap-3.5 p-3.5 rounded-xl2 bg-surface border border-line shadow-card"
            >
              <span className="shrink-0 w-11 h-11 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
                {s.categoriaNombre.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink leading-tight truncate">
                  {s.clienteNombre} · {s.categoriaNombre}
                </p>
                <p className="text-[12px] text-faint mt-0.5 truncate">
                  {s.propiedadNombre} · {s.propiedadLocalidad}
                </p>
                <BadgeEstado estado={s.estado} className="mt-1.5" />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <p className="text-[12px] font-semibold text-ink num">
                  {s.montoArs != null ? pesos(s.montoArs) : fechaCorta(s.creadoEl.slice(0, 10))}
                </p>
                <ChevronRight className="w-4 h-4 text-faint" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
