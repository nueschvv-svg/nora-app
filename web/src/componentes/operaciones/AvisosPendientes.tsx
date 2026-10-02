"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, RefreshCw } from "lucide-react";
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
  return <section className="nora-panel mx-5 mt-5 p-4" aria-label="Avisos de Telegram">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Bell aria-hidden="true" className="h-5 w-5 text-brand-700" /><h2 className="font-display font-semibold text-base text-ink">Avisos a Telegram</h2></div>
      <button aria-label="Actualizar avisos" className="nora-button-secondary min-h-11 min-w-11 grid place-items-center" onClick={() => void cargar()}><RefreshCw aria-hidden="true" className="h-4 w-4" /></button>
    </div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-urgent/10 p-3 text-sm text-urgent">{error}</p>}
    {cargando ? <p className="mt-3 text-sm text-mute" aria-live="polite">Consultando avisos…</p> : <p className="mt-3 text-sm text-mute" aria-live="polite">{avisos.length ? `${avisos.length} pedidos sin entrega confirmada.` : !error ? "Sin avisos pendientes." : "Estado no disponible."}</p>}
    {avisos.length > 0 && <details className="mt-2">
      <summary className="cursor-pointer min-h-11 text-sm py-3 font-semibold text-brand-700">Ver pendientes y recuperar</summary>
      <p className="text-xs text-mute mb-3">Antes de reintentar, revisá el ID en Telegram: una respuesta perdida puede haber dejado un aviso entregado.</p>
      <ul className="space-y-3">{avisos.map((a) => <li key={a.servicio_id} className="rounded-xl border border-line bg-sand p-3 text-sm break-words">
        <Link className="font-semibold text-brand-700 min-h-11 inline-flex items-center" href={`/operaciones/${a.servicio_id}`}>Pedido {a.servicio_id.slice(0, 8)}</Link>
        <p>{a.estado === "sin_cola" ? "Anterior a la cola: requiere revisión" : a.estado === "fallido" ? "Requiere intervención" : a.estado === "procesando" ? "Enviando" : "Pendiente de envío"} · {a.intentos} intentos</p>
        {a.detalle && <p className="text-xs text-mute">{a.detalle}</p>}
        {a.estado === "pendiente" && a.proximo_intento_el && <p className="text-xs text-mute">Próximo intento: {new Date(a.proximo_intento_el).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>}
        {(a.estado === "fallido" || a.estado === "sin_cola") && <button disabled={reintentando !== null} className="nora-button-secondary mt-3 min-h-11 px-3 disabled:opacity-50" onClick={async () => {
          setReintentando(a.servicio_id);
          try { await reintentarAviso(a.servicio_id); await cargar(); }
          catch (e) { setError(e instanceof Error ? e.message : "No pudimos reintentar."); }
          finally { setReintentando(null); }
        }}>{reintentando === a.servicio_id ? "Programando…" : "Programar reintento"}</button>}
      </li>)}</ul>
    </details>}
  </section>;
}
