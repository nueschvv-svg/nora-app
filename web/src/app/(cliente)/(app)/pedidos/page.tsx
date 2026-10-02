"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ClipboardList, RefreshCw } from "lucide-react";
import { useApp } from "@/componentes/ContextoApp";
import { HojaServicio } from "@/componentes/HojaServicio";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { listarServicios, listarCategorias, type CategoriaBD } from "@/lib/datos";
import type { Servicio } from "@/lib/tipos";

export default function PaginaPedidos() {
  const { sesion, cargando } = useApp();
  if (cargando) return <p role="status" className="nora-page py-10 text-mute">Cargando tus pedidos…</p>;
  return <ContenidoPedidos key={sesion?.id ?? "sin-sesion"} />;
}

function ContenidoPedidos() {
  const { sesion, cargando: cargandoSesion } = useApp();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [categorias, setCategorias] = useState<CategoriaBD[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<Servicio | null>(null);
  const cargar = useCallback(async () => {
    try {
      const [pedidos, rubros] = await Promise.all([listarServicios(), listarCategorias()]);
      setServicios(pedidos);
      setCategorias(rubros);
      setError(null);
    } catch {
      setError("No pudimos cargar tus pedidos. Revisá tu conexión y probá de nuevo.");
    } finally { setCargando(false); }
  }, []);
  useEffect(() => {
    let vigente = true;
    if (!cargandoSesion) void Promise.resolve().then(() => { if (vigente) return cargar(); });
    return () => { vigente = false; };
  }, [sesion?.id, cargandoSesion, cargar]);
  const cerrar = useCallback(() => { setSeleccionado(null); void cargar(); }, [cargar]);
  return (
    <>
      <main inert={!!seleccionado} className="h-full overflow-y-auto">
        <div className="nora-page py-8 sm:py-12">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-xl">
              <p className="nora-eyebrow mb-3">Tu casa, en buenas manos</p>
              <h1 className="nora-heading">Mis pedidos</h1>
              <p className="mt-3 text-sm leading-relaxed text-mute">Seguí cada servicio, consultá su estado y respondé al presupuesto desde acá.</p>
            </div>
            <button type="button" disabled={cargando} onClick={() => { setCargando(true); void cargar(); }} className="nora-button-secondary gap-2">
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
              {cargando ? "Actualizando…" : "Actualizar"}
            </button>
          </header>
          {error && <div role="alert" className="mb-5 rounded-xl2 bg-urgent/10 p-5 text-sm text-urgent">{error}</div>}
          {cargando && servicios.length === 0 && <p role="status" className="nora-panel p-8 text-mute">Estamos buscando tus pedidos…</p>}
          {!cargando && !error && servicios.length === 0 && (
            <section className="nora-empty nora-panel py-14 text-center">
              <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-xl2 bg-brand-50 text-brand-600"><ClipboardList aria-hidden="true" className="h-7 w-7" /></span>
              <h2 className="font-display text-xl font-semibold">Tu próximo servicio empieza acá</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-mute">Todavía no tenés pedidos. Cuando solicites uno, vas a poder seguir todos sus pasos en este espacio.</p>
              <Link className="nora-button mt-6" href="/pedir">Pedir un servicio</Link>
            </section>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {!error && servicios.map((servicio) => (
              <button key={servicio.id} type="button" onClick={() => setSeleccionado(servicio)} className="nora-panel group w-full p-6 text-left transition-colors hover:bg-brand-50/60">
                <span className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-medium text-mute">Pedido #{servicio.numeroOrden}</span>
                  <BadgeEstado estado={servicio.estado} />
                </span>
                <span className="block font-display text-lg font-semibold">{categorias.find((c) => c.slug === servicio.categoriaSlug)?.nombre ?? servicio.categoriaSlug}</span>
                <span className="mt-2 block line-clamp-2 break-words text-sm leading-relaxed text-mute">{servicio.descripcion}</span>
                <span className="mt-6 flex items-center gap-2 text-sm font-semibold text-brand-600">Ver pedido <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></span>
              </button>
            ))}
          </div>
          <p className="mt-6 max-w-xl text-xs leading-relaxed text-mute">Volvé desde este mismo navegador. Si borrás sus datos, podés perder el acceso a tus pedidos.</p>
        </div>
      </main>
      {seleccionado && <HojaServicio key={seleccionado.id} abierto servicio={seleccionado} categoria={categorias.find((c) => c.slug === seleccionado.categoriaSlug)} alCerrar={cerrar} />}
    </>
  );
}
