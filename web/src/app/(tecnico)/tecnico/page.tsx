"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Loader2, LogOut, MapPin } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import {
  listarPedidosAbiertos,
  listarTrabajosAsignados,
  suscribirseAPedidosAbiertos,
  tomarTrabajo,
  type PedidoAbierto,
  type TrabajoAsignado,
} from "@/lib/tecnico";
import { ETIQUETA_ESTADO } from "@/lib/tipos";
import { fechaCorta, pesos } from "@/lib/formato";

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

  const filtrados = trabajos.filter((t) => {
    if (pestana === "pendientes") return t.estado === "asignado" && !t.tecnicoConfirmadoEl;
    if (pestana === "en_curso") return !!t.tecnicoConfirmadoEl && !TERMINADOS.has(t.estado);
    return TERMINADOS.has(t.estado);
  });

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold font-display text-ink">Tus trabajos</h1>
          <p className="text-[13px] text-mute mt-0.5">Pedidos disponibles y los que ya tomaste.</p>
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

      <div className="flex gap-2 mt-5 overflow-x-auto no-scrollbar">
        {(
          [
            ["disponibles", `Disponibles${abiertos.length ? ` (${abiertos.length})` : ""}`],
            ["pendientes", "Pendientes"],
            ["en_curso", "En curso"],
            ["historial", "Historial"],
          ] as [Pestana, string][]
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setPestana(valor)}
            aria-pressed={pestana === valor}
            className={`press shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold border ${
              pestana === valor
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-surface text-mute border-line"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {avisoTomar && (
        <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
          {avisoTomar}
        </p>
      )}

      {cargando ? (
        <div className="mt-5 space-y-2.5">
          <Bloque className="h-[70px] w-full rounded-xl2" />
          <Bloque className="h-[70px] w-full rounded-xl2" />
        </div>
      ) : pestana === "disponibles" ? (
        abiertos.length === 0 ? (
          <p className="text-[13.5px] text-faint mt-8 text-center">
            No hay pedidos disponibles de tu rubro por ahora.
          </p>
        ) : (
          <div className="mt-5 bg-surface rounded-xl2 border border-line shadow-card divide-y divide-line overflow-hidden">
            {abiertos.map((p) => (
              <div key={p.id} className="flex items-center gap-3.5 p-3.5">
                <span className="shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
                  {p.categoriaNombre.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink leading-tight truncate">
                    {p.categoriaNombre}
                  </p>
                  <p className="text-[12px] text-faint mt-0.5 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" /> {p.propiedadLocalidad || "Zona sin cargar"}
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
        <p className="text-[13.5px] text-faint mt-8 text-center">No hay nada acá.</p>
      ) : (
        <div className="mt-5 bg-surface rounded-xl2 border border-line shadow-card divide-y divide-line overflow-hidden">
          {filtrados.map((t) => (
            <Link
              key={t.id}
              href={`/tecnico/${t.id}`}
              className="press flex items-center gap-3.5 p-3.5"
            >
              <span className="shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
                {t.categoriaNombre.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink leading-tight truncate">
                  {t.clienteNombre} · {t.categoriaNombre}
                </p>
                <p className="text-[12px] text-faint mt-0.5 truncate">
                  {t.propiedadNombre} · {t.propiedadLocalidad}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 text-[11.5px] text-brand-600 font-semibold">
                  <Clock className="w-3 h-3" /> {ETIQUETA_ESTADO[t.estado]}
                </span>
                <p className="text-[11px] text-faint mt-0.5">
                  {t.montoArs != null ? pesos(t.montoArs) : fechaCorta(t.creadoEl.slice(0, 10))}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
