"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listarAvisosPendientes, reintentarAviso, type AvisoPendiente } from "@/lib/avisosOperaciones";

export function AvisosPendientes() {
  const [avisos, setAvisos] = useState<AvisoPendiente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [reintentando, setReintentando] = useState<string | null>(null);
  const cargar = useCallback(() => listarAvisosPendientes()
    .then((datos) => { setAvisos(datos); setError(null); })
    .catch((e) => setError(e instanceof Error ? e.message : "No pudimos consultar Telegram."))
    .finally(() => setCargando(false)), []);
  useEffect(() => {
    void cargar();
    const timer = setInterval(() => void cargar(), 30000);
    return () => clearInterval(timer);
  }, [cargar]);
  return <section className="mx-5 mt-4 p-4 rounded-xl border border-line bg-surface" aria-label="Avisos de Telegram">
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-semibold text-sm">Telegram · ENJINIA</h2>
      <button className="min-h-11 px-2 text-sm underline" onClick={() => void cargar()}>Actualizar avisos</button>
    </div>
    {error && <p role="alert" className="text-sm text-urgent">{error}</p>}
    {cargando ? <p className="text-sm">Consultando avisos…</p> : <p className="text-sm">{avisos.length ? `${avisos.length} pedidos sin entrega confirmada.` : !error ? "Sin avisos pendientes." : "Estado no disponible."}</p>}
    {avisos.length > 0 && <details className="mt-2">
      <summary className="cursor-pointer min-h-11 text-sm py-2">Ver pendientes y recuperar</summary>
      <p className="text-xs text-mute mb-3">Antes de reintentar, revisá el ID en Telegram: una respuesta perdida puede haber dejado un aviso entregado.</p>
      <ul className="space-y-3">{avisos.map((a) => <li key={a.servicio_id} className="border-t border-line pt-2 text-sm break-words">
        <Link className="underline min-h-11 inline-flex items-center" href={`/operaciones/${a.servicio_id}`}>Pedido {a.servicio_id.slice(0, 8)}</Link>
        <p>{a.estado === "sin_cola" ? "Anterior a la cola: requiere revisión" : a.estado === "fallido" ? "Requiere intervención" : a.estado === "procesando" ? "Enviando" : "Pendiente de envío"} · {a.intentos} intentos</p>
        {a.detalle && <p className="text-xs text-mute">{a.detalle}</p>}
        {a.estado === "pendiente" && a.proximo_intento_el && <p className="text-xs text-mute">Próximo intento: {new Date(a.proximo_intento_el).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>}
        {(a.estado === "fallido" || a.estado === "sin_cola") && <button disabled={reintentando !== null} className="min-h-11 underline disabled:opacity-50" onClick={async () => {
          setReintentando(a.servicio_id);
          try { await reintentarAviso(a.servicio_id); await cargar(); }
          catch (e) { setError(e instanceof Error ? e.message : "No pudimos reintentar."); }
          finally { setReintentando(null); }
        }}>{reintentando === a.servicio_id ? "Programando…" : "Programar reintento"}</button>}
      </li>)}</ul>
    </details>}
  </section>;
}
