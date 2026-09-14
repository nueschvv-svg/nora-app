"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/componentes/ContextoApp";
import { HojaServicio } from "@/componentes/HojaServicio";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import { listarServicios, listarCategorias, type CategoriaBD } from "@/lib/datos";
import type { Servicio } from "@/lib/tipos";

export default function PaginaPedidos() {
  const { sesion, cargando } = useApp();
  if (cargando) return <p role="status" className="p-5">Cargando tus pedidos…</p>;
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
      <main inert={!!seleccionado} className="h-full overflow-y-auto px-5 py-6">
        <div className="max-w-xl mx-auto space-y-4">
          <h1 className="text-2xl font-bold">Mis pedidos</h1>
          <p className="text-sm text-mute">Acá podés consultar el estado y responder al presupuesto. Volvé desde este mismo navegador; si borrás sus datos, podés perder el acceso.</p>
          <button type="button" disabled={cargando} onClick={() => { setCargando(true); void cargar(); }} className="min-h-11 px-4 rounded-xl border border-line">{cargando ? "Cargando…" : "Actualizar pedidos"}</button>
          {error && <p role="alert" className="text-danger">{error}</p>}
          {!cargando && !error && servicios.length === 0 && <p>Todavía no tenés pedidos. <Link className="underline" href="/pedir">Pedir un servicio</Link></p>}
          {!error && servicios.map((servicio) => (
            <button key={servicio.id} type="button" onClick={() => setSeleccionado(servicio)} className="w-full rounded-2xl bg-surface border border-line p-4 text-left space-y-2">
              <span className="block font-semibold">#{servicio.numeroOrden} · {categorias.find((c) => c.slug === servicio.categoriaSlug)?.nombre ?? servicio.categoriaSlug}</span>
              <BadgeEstado estado={servicio.estado} />
              <span className="block text-sm text-mute break-words line-clamp-2">{servicio.descripcion}</span>
              <span className="block text-sm underline">Ver pedido</span>
            </button>
          ))}
        </div>
      </main>
      {seleccionado && <HojaServicio key={seleccionado.id} abierto servicio={seleccionado} categoria={categorias.find((c) => c.slug === seleccionado.categoriaSlug)} alCerrar={cerrar} />}
    </>
  );
}
