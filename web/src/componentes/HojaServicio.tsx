"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CalendarClock, UserRound, X } from "lucide-react";
import { IconoEquipo } from "./IconoEquipo";
import { HiloChat } from "./HiloChat";
import { listarFotosServicio, type FotoServicio } from "@/lib/datos";
import { suscribirseAServicio } from "@/lib/tiempoReal";
import { tecnicoDeServicio, type TecnicoDeServicio } from "@/lib/trabajadores";
import { ETIQUETA_ESTADO, ETIQUETA_FRANJA, type EstadoServicio, type Servicio } from "@/lib/tipos";
import { fecha, pesos } from "@/lib/formato";
import type { CategoriaBD } from "@/lib/datos";

/* Leaflet toca `window` al importar — rompe si se carga en el
   servidor. ssr:false lo difiere al navegador. */
const MapaSeguimiento = dynamic(
  () => import("./MapaSeguimiento").then((m) => m.MapaSeguimiento),
  { ssr: false },
);

/* Detalle de un servicio. Antes no existía: los pedidos se veían en
   Historial pero no se podían abrir — ni para leer el diagnóstico
   completo, ni para ver la foto que se mandó. Esta hoja es esa
   memoria: la descripción entera (con lo que Nora vio en la foto,
   si hubo), el estado, y las fotos que se guardaron. */
export function HojaServicio({
  servicio,
  categoria,
  abierto,
  alCerrar,
}: {
  servicio: Servicio | null;
  categoria?: CategoriaBD;
  abierto: boolean;
  alCerrar: () => void;
}) {
  const [fotos, setFotos] = useState<FotoServicio[]>([]);
  /* id del servicio cuyas fotos ya están en `fotos`. Mientras no
     coincida con el servicio abierto, se está cargando — derivado en
     vez de un booleano aparte, para no tocar estado de forma síncrona
     apenas arranca el efecto (eso dispara renders en cascada). */
  const [fotosDeServicio, setFotosDeServicio] = useState<string | null>(null);
  const cargandoFotos = !!servicio && fotosDeServicio !== servicio.id;

  /* Estado y ubicación "en vivo": sólo los alimenta el callback de
     Realtime, nunca un setState síncrono al arrancar el efecto — mismo
     criterio que fotosDeServicio de arriba. overrideServicioId evita
     mostrar el estado en vivo de un servicio anterior mientras carga
     el nuevo. */
  const [overrideServicioId, setOverrideServicioId] = useState<string | null>(null);
  const [estadoEnVivo, setEstadoEnVivo] = useState<EstadoServicio | null>(null);
  const [ubicacionEnVivo, setUbicacionEnVivo] = useState<{
    lat: number;
    lng: number;
    actualizadoEl: string | null;
  } | null>(null);
  const overrideVigente = !!servicio && overrideServicioId === servicio.id;
  const estadoMostrado = (overrideVigente ? estadoEnVivo : null) ?? servicio?.estado;
  const ubicacionMostrada = overrideVigente
    ? ubicacionEnVivo
    : servicio?.ubicacionLat != null && servicio?.ubicacionLng != null
      ? { lat: servicio.ubicacionLat, lng: servicio.ubicacionLng, actualizadoEl: servicio.ubicacionActualizadaEl ?? null }
      : null;

  /* Quién es mi técnico: nombre y foto, para que el pedido deje de
     sentirse vacío apenas hay alguien asignado — antes esto no se
     mostraba en ningún lado del lado cliente. */
  const [tecnico, setTecnico] = useState<TecnicoDeServicio | null>(null);
  const [tecnicoDeServicioId, setTecnicoDeServicioId] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || !servicio?.tecnicoId) return;
    tecnicoDeServicio(servicio.id)
      .then((t) => {
        setTecnico(t);
        setTecnicoDeServicioId(servicio.id);
      })
      .catch(() => {
        setTecnico(null);
        setTecnicoDeServicioId(servicio.id);
      });
  }, [abierto, servicio]);

  useEffect(() => {
    if (!abierto || !servicio) return;
    listarFotosServicio(servicio.id)
      .then((f) => {
        setFotos(f);
        setFotosDeServicio(servicio.id);
      })
      .catch(() => {
        /* Sin fotos no se rompe el detalle: el resto de la info sigue siendo útil. */
        setFotos([]);
        setFotosDeServicio(servicio.id);
      });
  }, [abierto, servicio]);

  useEffect(() => {
    if (!abierto || !servicio) return;
    return suscribirseAServicio(servicio.id, (fila) => {
      setOverrideServicioId(servicio.id);
      if (typeof fila.estado === "string") setEstadoEnVivo(fila.estado as EstadoServicio);
      setUbicacionEnVivo(
        typeof fila.ubicacion_lat === "number" && typeof fila.ubicacion_lng === "number"
          ? {
              lat: fila.ubicacion_lat,
              lng: fila.ubicacion_lng,
              actualizadoEl: typeof fila.ubicacion_actualizada_el === "string" ? fila.ubicacion_actualizada_el : null,
            }
          : null,
      );
    });
  }, [abierto, servicio]);

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto, alCerrar]);

  return (
    <>
      <div
        onClick={alCerrar}
        className={`absolute inset-0 z-[55] bg-black/40 transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle del servicio"
        className={`absolute bottom-0 inset-x-0 z-[56] bg-sand rounded-t-[26px] shadow-sheet max-h-[88%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        {servicio && (
          <div className="px-5 pt-3 pb-8">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 shrink-0 grid place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <IconoEquipo nombre={categoria?.icono ?? "wrench"} className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-[17px] font-bold font-display text-ink leading-tight">
                    {categoria?.nombre ?? "Servicio"}
                  </h2>
                  <p className="text-[12px] text-faint mt-0.5">{fecha(servicio.creadoEl)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={alCerrar}
                className="press shrink-0 w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <span className="inline-block mt-4 text-[11.5px] font-semibold text-brand-600 bg-brand-50 rounded-full px-3 py-1">
              {ETIQUETA_ESTADO[estadoMostrado ?? servicio.estado]}
            </span>

            {servicio.fechaPreferida && (
              <p className="flex items-center gap-1.5 text-[13px] text-mute mt-2.5">
                <CalendarClock className="w-[15px] h-[15px] text-faint shrink-0" />
                {fecha(servicio.fechaPreferida)}
                {servicio.franjaPreferida && ` · ${ETIQUETA_FRANJA[servicio.franjaPreferida] ?? servicio.franjaPreferida}`}
              </p>
            )}

            <div className="mt-3 rounded-xl2 bg-surface border border-line shadow-card p-4">
              <p className="text-[11px] font-bold tracking-wide uppercase text-faint">El problema</p>
              <p className="text-[13.5px] text-ink leading-relaxed mt-1.5 whitespace-pre-line">
                {servicio.descripcion}
              </p>
            </div>

            {servicio.montoArs != null && (
              <div className="mt-3 rounded-xl2 bg-surface border border-line shadow-card p-4 flex items-center justify-between">
                <p className="text-[11px] font-bold tracking-wide uppercase text-faint">Monto</p>
                <p className="num text-[15px] font-bold text-ink">{pesos(servicio.montoArs)}</p>
              </div>
            )}

            {servicio.reporte && (
              <div className="mt-3 rounded-xl2 bg-surface border border-line shadow-card p-4">
                <p className="text-[11px] font-bold tracking-wide uppercase text-faint">
                  Reporte del técnico
                </p>
                <p className="text-[13.5px] text-ink leading-relaxed mt-1.5">{servicio.reporte}</p>
              </div>
            )}

            <p className="text-[11px] font-bold tracking-wide uppercase text-faint mt-4 px-0.5">Fotos</p>
            {cargandoFotos ? (
              <p className="text-[12.5px] text-faint mt-1.5">Cargando…</p>
            ) : fotos.length === 0 ? (
              <p className="text-[12.5px] text-faint mt-1.5">Este pedido no tiene fotos.</p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {fotos.map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no vale la pena el pipeline de next/image para esto
                  <img
                    key={f.id}
                    src={f.url}
                    alt="Foto del servicio"
                    className="w-full aspect-square object-cover rounded-xl2 border border-line"
                  />
                ))}
              </div>
            )}

            {servicio.tecnicoId && (
              <>
                {tecnicoDeServicioId === servicio.id && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl2 bg-surface border border-line shadow-card p-3.5">
                    <span className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-brand-50 grid place-items-center">
                      {tecnico?.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL pública, no vale next/image acá
                        <img src={tecnico.fotoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserRound className="w-6 h-6 text-brand-300" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold tracking-wide uppercase text-faint">
                        Tu técnico
                      </p>
                      <p className="text-[14.5px] font-semibold text-ink truncate mt-0.5">
                        {tecnico?.nombre ?? "Asignado"}
                      </p>
                    </div>
                  </div>
                )}

                {estadoMostrado === "en_camino" && ubicacionMostrada && (
                  <>
                    <p className="text-[11px] font-bold tracking-wide uppercase text-faint mt-4 px-0.5">
                      El técnico está en camino
                    </p>
                    <MapaSeguimiento
                      lat={ubicacionMostrada.lat}
                      lng={ubicacionMostrada.lng}
                      actualizadoEl={ubicacionMostrada.actualizadoEl}
                    />
                  </>
                )}
                <HiloChat servicioId={servicio.id} />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
