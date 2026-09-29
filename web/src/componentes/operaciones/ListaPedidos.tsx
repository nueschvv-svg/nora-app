"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardList, CalendarDays, Bell, LogOut, PackageOpen } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { listarTodosLosServicios, suscribirseATodosLosServicios, type ServicioLista } from "@/lib/operaciones";
import { LogotipoNora } from "@/componentes/LogoNora";
import { AgendaDia } from "./AgendaDia";
import { AvisosPendientes } from "./AvisosPendientes";
import { type EstadoServicio } from "@/lib/tipos";
import { fechaCorta, pesos } from "@/lib/formato";

/* Estados en los que el pedido todavía está en curso. */
const EN_CURSO = new Set<EstadoServicio>([
  "solicitado",
  "presupuestado",
  "aceptado",
  "en_camino",
  "en_curso",
]);

type Pestana = "en_curso" | "resueltos" | "todos";

/* La lista de pedidos, compartida entre /operaciones (sin nada
   elegido) y /operaciones/[id] (con un pedido abierto al lado). En
   escritorio las dos rutas la muestran en la misma columna izquierda
   — sólo cambia qué hay a la derecha — así que vivir acá evita
   duplicar la carga y la suscripción en tiempo real en dos lugares. */
export function ListaPedidos({ idSeleccionado }: { idSeleccionado?: string }) {
  const router = useRouter();
  const [vista, setVista] = useState<"pedidos" | "agenda" | "avisos">("pedidos");
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
        if (vivo) { setServicios(s); setError(null); }
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

  /* Cuenta única y compartida: puede haber otra sesión (u otro
     dispositivo) tocando estos mismos pedidos ahora mismo. Sin esto,
     esta lista se quedaría desactualizada hasta recargar a mano. */
  useEffect(() => suscribirseATodosLosServicios(traer), [traer]);

  if (error) return <ErrorCarga mensaje={error} alReintentar={traer} />;

  const enCurso = servicios.filter((s) => EN_CURSO.has(s.estado));
  const resueltos = servicios.filter((s) => !EN_CURSO.has(s.estado) && s.estado !== "cancelado");
  const filtrados = pestana === "en_curso" ? enCurso : pestana === "resueltos" ? resueltos : servicios;
  const montoEnCurso = enCurso.reduce((suma, s) => suma + (s.montoArs ?? 0), 0);

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-10 border-b border-line bg-sand/95 supports-[backdrop-filter]:bg-sand/85 supports-[backdrop-filter]:backdrop-blur-xl px-5 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <LogotipoNora className="h-8 w-auto text-brand-700" />
          <button type="button" onClick={async () => {
            await supabaseNavegador().auth.signOut();
            router.replace("/entrar"); router.refresh();
          }} className="min-h-11 inline-flex items-center gap-2 rounded-xl px-3 text-xs font-semibold text-mute hover:bg-surface">
            <LogOut aria-hidden="true" className="h-4 w-4" /> Salir
          </button>
        </div>
        <p className="nora-eyebrow mt-6">Espacio de trabajo</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink mt-1">Operaciones</h1>
        <p className="text-sm text-mute mt-1">Cada pedido, de principio a fin.</p>
        <nav aria-label="Vistas de operaciones" className="mt-5 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface/70 p-1">
          {([{ id: "pedidos", nombre: "Pedidos", icono: ClipboardList }, { id: "agenda", nombre: "Agenda", icono: CalendarDays }, { id: "avisos", nombre: "Avisos", icono: Bell }] as const).map(({ id, nombre, icono: Icono }) => (
            <button key={id} type="button" aria-pressed={vista === id} onClick={() => setVista(id)} className={`min-h-11 flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-colors ${vista === id ? "bg-brand-700 text-white shadow-sm" : "text-mute hover:bg-sand"}`}>
              <Icono aria-hidden="true" className="h-4 w-4" />{nombre}
            </button>
          ))}
        </nav>
      </header>
      {vista === "avisos" && <AvisosPendientes />}
      {vista === "agenda" && <AgendaDia revision={intento} />}
      {vista === "pedidos" && <>
      {!cargando && (
        <section aria-label="Resumen de pedidos" className="mx-5 mt-5 rounded-2xl bg-brand-700 p-5 text-white">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-white/75">En curso</p><p className="mt-1 font-display text-3xl font-semibold num">{enCurso.length}</p></div>
            <div className="border-l border-white/20 pl-4"><p className="text-xs text-white/75">Resueltos</p><p className="mt-1 font-display text-3xl font-semibold num">{resueltos.length}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-white/20 pt-3 text-xs"><span className="text-white/75">Monto en pedidos activos</span><span className="font-semibold num">{pesos(montoEnCurso)}</span></div>
        </section>
      )}

      <div className="px-5 flex flex-wrap gap-2 mt-5">
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
            className={`press min-h-11 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border ${
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
              aria-current={s.id === idSeleccionado ? "page" : undefined}
              className={`press group flex items-start gap-3 p-4 rounded-2xl bg-surface border transition-colors hover:border-brand-300 ${
                s.id === idSeleccionado ? "border-brand-600 ring-1 ring-brand-600" : "border-line"
              }`}
            >
              <span className="shrink-0 w-11 h-11 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
                {s.categoriaNombre.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink leading-snug break-words">
                  {s.clienteNombre} · {s.categoriaNombre}
                </p>
                <p className="text-xs text-mute mt-1 break-words">
                  {s.propiedadNombre} · {s.propiedadLocalidad}
                </p>
                <BadgeEstado estado={s.estado} className="mt-1.5" />
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0 max-w-[95px]">
                <p className="text-xs font-semibold text-ink num text-right break-words">
                  {s.montoArs != null ? pesos(s.montoArs) : fechaCorta(s.creadoEl.slice(0, 10))}
                </p>
                <ChevronRight className="w-4 h-4 text-faint" />
              </div>
            </Link>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}
