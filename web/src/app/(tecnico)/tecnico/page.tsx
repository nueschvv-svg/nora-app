"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Inbox, ListChecks, Loader2, LogOut, MapPin, PackageSearch, Wrench } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import {
  listarPedidosAbiertos,
  listarTrabajosAsignados,
  suscribirseAPedidosAbiertos,
  tomarTrabajo,
  type PedidoAbierto,
  type TrabajoAsignado,
} from "@/lib/tecnico";
import { fechaCorta, pesos } from "@/lib/formato";

const COMPLETADOS = new Set(["finalizado", "pagado", "calificado"]);

type Pestana = "disponibles" | "pendientes" | "en_curso" | "historial";

const TERMINADOS = new Set(["finalizado", "pagado", "calificado", "cancelado"]);

export default function PaginaTecnico() {
  const router = useRouter();
  const [trabajos, setTrabajos] = useState<TrabajoAsignado[]>([]);
  const [abiertos, setAbiertos] = useState<PedidoAbierto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("disponibles");
  const [intento, setIntento] = useState(0);
  const [tomando, setTomando] = useState<string | null>(null);
  const [avisoTomar, setAvisoTomar] = useState<string | null>(null);

  const traer = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarTrabajosAsignados(), listarPedidosAbiertos()])
      .then(([t, a]) => {
        if (!vivo) return;
        setTrabajos(t);
        setAbiertos(a);
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

  // Feed en vivo: mientras la pantalla está abierta, cualquier cambio
  // en la bolsa (pedido nuevo, o alguien más lo tomó) refresca la
  // lista sola — sin recargar, sin que el técnico tenga que salir y
  // volver a entrar para enterarse.
  useEffect(() => suscribirseAPedidosAbiertos(traer), [traer]);

  const tomar = async (id: string) => {
    setTomando(id);
    setAvisoTomar(null);
    try {
      await tomarTrabajo(id);
      router.push(`/tecnico/${id}`);
    } catch (e) {
      setAvisoTomar(e instanceof Error ? e.message : "No pudimos tomar el pedido.");
      traer();
    } finally {
      setTomando(null);
    }
  };

  if (error) return <ErrorCarga mensaje={error} alReintentar={traer} />;

  const pendientes = trabajos.filter(
    (t) => (t.estado === "asignado" && !t.tecnicoConfirmadoEl) || t.estado === "presupuestado",
  );
  const enCurso = trabajos.filter(
    (t) => (!!t.tecnicoConfirmadoEl || t.estado === "aceptado") && !TERMINADOS.has(t.estado),
  );
  const historial = trabajos.filter((t) => TERMINADOS.has(t.estado));
  const totalCobrado = trabajos
    .filter((t) => COMPLETADOS.has(t.estado))
    .reduce((suma, t) => suma + (t.montoArs ?? 0), 0);

  const filtrados = pestana === "pendientes" ? pendientes : pestana === "en_curso" ? enCurso : historial;

  return (
    <main className="h-dvh overflow-y-auto no-scrollbar pb-28">
      <div className="px-5 pt-12 pb-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold font-display text-ink leading-tight">Tus trabajos</h1>
          <p className="text-[13px] text-mute mt-0.5">Pedidos disponibles y los que ya tomaste.</p>
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
                  <Wrench className="w-[13px] h-[13px]" /> Tu actividad
                </span>
                <p className="mt-2.5 text-[30px] font-extrabold font-display leading-none num">{enCurso.length}</p>
                <p className="text-[13px] text-brand-100 mt-1.5">
                  {enCurso.length === 1 ? "trabajo en curso" : "trabajos en curso"}
                </p>
              </div>
              <span className="shrink-0 w-14 h-14 grid place-items-center rounded-2xl bg-white/10">
                <Wrench className="w-6 h-6" />
              </span>
            </div>

            {(pendientes.length > 0 || totalCobrado > 0) && (
              <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/[.08] border border-white/10 px-3.5 py-3">
                <span className="shrink-0 w-9 h-9 grid place-items-center rounded-xl bg-warn/20 text-orange-200">
                  <Inbox className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white leading-snug">
                    {pendientes.length > 0
                      ? `${pendientes.length} ${pendientes.length === 1 ? "pedido" : "pedidos"} por aceptar`
                      : "Todo aceptado"}
                  </p>
                  <p className="text-[11px] text-brand-100 mt-0.5">Revisalos antes de que se reasignen</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="num text-[14px] font-bold text-white leading-tight">{pesos(totalCobrado)}</p>
                  <p className="text-[10px] text-brand-100 mt-0.5">cobrado en total</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <div className="px-5 flex gap-2 mt-5 overflow-x-auto no-scrollbar">
        {(
          [
            ["disponibles", "Disponibles", abiertos.length],
            ["pendientes", "Pendientes", pendientes.length],
            ["en_curso", "En curso", enCurso.length],
            ["historial", "Historial", historial.length],
          ] as [Pestana, string, number][]
        ).map(([valor, etiqueta, cantidad]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setPestana(valor)}
            aria-pressed={pestana === valor}
            className={`press shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold border ${
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

      {avisoTomar && (
        <p role="alert" className="mx-5 text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
          {avisoTomar}
        </p>
      )}

      {cargando ? (
        <div className="px-5 mt-5 space-y-2.5">
          <Bloque className="h-[86px] w-full rounded-xl2" />
          <Bloque className="h-[86px] w-full rounded-xl2" />
        </div>
      ) : pestana === "disponibles" ? (
        abiertos.length === 0 ? (
          <EstadoVacio
            icono={PackageSearch}
            titulo="No hay pedidos disponibles"
            texto="En cuanto aparezca uno de tu rubro y tu zona, lo vas a ver acá al instante."
          />
        ) : (
          <div className="px-5 mt-5 space-y-2.5">
            {abiertos.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3.5 p-3.5 rounded-xl2 bg-surface border border-line shadow-card border-l-4 border-l-warn"
              >
                <span className="shrink-0 w-11 h-11 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
                  {p.categoriaNombre.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold text-ink leading-tight truncate">
                      {p.categoriaNombre}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-warn shrink-0">
                      <span className="w-[6px] h-[6px] rounded-full bg-warn live-dot" /> Disponible
                    </span>
                  </div>
                  <p className="text-[12px] text-faint mt-0.5 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" /> {p.propiedadLocalidad || "Zona sin cargar"}
                    {p.distanciaKm != null && (
                      <span className="text-brand-600 font-semibold shrink-0">· {p.distanciaKm} km</span>
                    )}
                  </p>
                  <p className="text-[11.5px] text-mute mt-1 line-clamp-2">{p.descripcion}</p>
                </div>
                <button
                  type="button"
                  onClick={() => tomar(p.id)}
                  disabled={tomando === p.id}
                  className="press shrink-0 flex items-center gap-1.5 rounded-xl2 bg-brand-600 text-white px-3.5 py-2.5 text-[13px] font-semibold disabled:opacity-50"
                >
                  {tomando === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Tomar
                </button>
              </div>
            ))}
          </div>
        )
      ) : filtrados.length === 0 ? (
        <EstadoVacio
          icono={pestana === "pendientes" ? Inbox : pestana === "en_curso" ? Wrench : ListChecks}
          titulo={
            pestana === "pendientes"
              ? "Nada pendiente de aceptar"
              : pestana === "en_curso"
                ? "No tenés trabajos en curso"
                : "Todavía no cerraste ningún trabajo"
          }
          texto={
            pestana === "pendientes"
              ? "Cuando operaciones te asigne un pedido, aparece acá para que lo aceptes o lo rechaces."
              : pestana === "en_curso"
                ? "Los que aceptaste y todavía no terminaste van a estar acá."
                : "Los trabajos que termines quedan guardados acá."
          }
        />
      ) : (
        <div className="px-5 mt-5 space-y-2.5">
          {filtrados.map((t) => (
            <Link
              key={t.id}
              href={`/tecnico/${t.id}`}
              className="press flex items-center gap-3.5 p-3.5 rounded-xl2 bg-surface border border-line shadow-card"
            >
              <span className="shrink-0 w-11 h-11 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
                {t.categoriaNombre.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink leading-tight truncate">
                  {t.clienteNombre} · {t.categoriaNombre}
                </p>
                <p className="text-[12px] text-faint mt-0.5 truncate">
                  {t.propiedadNombre} · {t.propiedadLocalidad}
                </p>
                <BadgeEstado estado={t.estado} className="mt-1.5" />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <p className="text-[12px] font-semibold text-ink num">
                  {t.montoArs != null ? pesos(t.montoArs) : fechaCorta(t.creadoEl.slice(0, 10))}
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
