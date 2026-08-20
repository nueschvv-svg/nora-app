"use client";

import { useEffect, useState } from "react";
import { Banknote, CalendarClock, Check, Loader2, QrCode, Star, X, XCircle } from "lucide-react";
import { IconoEquipo } from "./IconoEquipo";
import { useApp } from "./ContextoApp";
import {
  aceptarPresupuesto,
  calificarServicio,
  confirmarPagoEfectivo,
  listarFotosServicio,
  miCalificacion,
  rechazarPresupuesto,
  type FotoServicio,
  type MiCalificacion,
} from "@/lib/datos";
import { suscribirseAServicio } from "@/lib/tiempoReal";
import { ETIQUETA_ESTADO, ETIQUETA_FRANJA, type EstadoServicio, type Servicio } from "@/lib/tipos";
import { fecha, pesos } from "@/lib/formato";
import type { CategoriaBD } from "@/lib/datos";

/* Stepper de progreso — arranca desde que el pedido SALE, no desde que
   está confirmado. Antes el primer paso era "Confirmado" y hasta ahí
   no llegar no mostraba nada: un pedido recién enviado se veía igual
   que antes de tocar nada. El paso 0 ("Pedido enviado") está cumplido
   apenas existe el servicio. Sólo se oculta en "cancelado". */
const PASOS_PROGRESO = ["Pedido enviado", "Confirmado", "En camino", "Trabajando", "Terminado"];
const ESTADOS_SIN_PROGRESO = new Set<EstadoServicio>(["cancelado"]);

function pasoDeEstado(estado: EstadoServicio): number {
  if (estado === "en_camino") return 2;
  if (estado === "en_curso") return 3;
  if (estado === "finalizado" || estado === "pagado" || estado === "calificado") return 4;
  if (estado === "aceptado") return 1;
  return 0; // solicitado, presupuestado
}

/* `oscuro`: el hero de arriba tiene fondo degradado, así que el
   stepper necesita su propia paleta clara sobre ese fondo. */
function Progreso({ pasoActual, oscuro }: { pasoActual: number; oscuro?: boolean }) {
  const completo = pasoActual >= PASOS_PROGRESO.length - 1;

  return (
    <div className="mt-4 flex items-center">
      {PASOS_PROGRESO.map((etiqueta, i) => {
        const hecho = i < pasoActual || (completo && i === pasoActual);
        const actual = !completo && i === pasoActual;
        return (
          <div key={etiqueta} className="flex-1 flex items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold ${
                  hecho
                    ? oscuro
                      ? "bg-white text-brand-700"
                      : "bg-good text-white"
                    : actual
                      ? oscuro
                        ? "bg-white text-brand-700 live-dot"
                        : "bg-brand-600 text-white live-dot"
                      : oscuro
                        ? "bg-white/15 text-white/60"
                        : "bg-line text-faint"
                }`}
              >
                {hecho ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span
                className={`text-[9.5px] font-medium text-center leading-tight ${
                  oscuro
                    ? i <= pasoActual
                      ? "text-white"
                      : "text-white/50"
                    : i <= pasoActual
                      ? "text-ink"
                      : "text-faint"
                }`}
              >
                {etiqueta}
              </span>
            </div>
            {i < PASOS_PROGRESO.length - 1 && (
              <span
                className={`flex-1 h-[2px] mb-4 ${
                  i < pasoActual ? (oscuro ? "bg-white" : "bg-good") : oscuro ? "bg-white/20" : "bg-line"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FilaResumen({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-[13px] text-mute">{etiqueta}</span>
      <span
        className={
          destacado ? "num text-[15px] font-bold text-ink" : "text-[13px] font-semibold text-ink text-right"
        }
      >
        {valor}
      </span>
    </div>
  );
}

/* Detalle de un servicio — el estado y la respuesta de operaciones
   (aceptó, ofertó un precio, avanzó el trabajo), sin nada de técnico:
   Nora lo gestiona directo, no hay perfil ni ubicación en vivo de
   nadie que mostrar. */
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
  const { propiedad } = useApp();

  const [fotos, setFotos] = useState<FotoServicio[]>([]);
  const [fotosDeServicio, setFotosDeServicio] = useState<string | null>(null);
  const cargandoFotos = !!servicio && fotosDeServicio !== servicio.id;

  /* Estado "en vivo": sólo lo alimenta el callback de Realtime, nunca
     un setState síncrono al arrancar el efecto. overrideServicioId
     evita mostrar el estado en vivo de un servicio anterior mientras
     carga el nuevo. */
  const [overrideServicioId, setOverrideServicioId] = useState<string | null>(null);
  const [estadoEnVivo, setEstadoEnVivo] = useState<EstadoServicio | null>(null);
  const overrideVigente = !!servicio && overrideServicioId === servicio.id;
  const estadoMostrado = (overrideVigente ? estadoEnVivo : null) ?? servicio?.estado;
  const pasoActual = servicio ? pasoDeEstado(estadoMostrado ?? servicio.estado) : 0;

  /* Confirmar pago en efectivo. Al confirmar, se reusa el mismo
     mecanismo de "estado en vivo" de arriba en vez de esperar a que el
     padre vuelva a pedir la lista. */
  const [confirmandoPago, setConfirmandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);

  const confirmarEfectivo = async () => {
    if (!servicio || confirmandoPago) return;
    setConfirmandoPago(true);
    setErrorPago(null);
    try {
      await confirmarPagoEfectivo(servicio.id);
      setOverrideServicioId(servicio.id);
      setEstadoEnVivo("pagado");
    } catch (e) {
      setErrorPago(e instanceof Error ? e.message : "No pudimos confirmar el pago.");
    } finally {
      setConfirmandoPago(false);
    }
  };

  /* Responder a un presupuesto de operaciones. Mismo mecanismo que el
     pago: al resolver, se pisa el estado en vivo para que la tarjeta
     desaparezca al toque. */
  const [respondiendoOferta, setRespondiendoOferta] = useState<"aceptar" | "rechazar" | null>(null);
  const [errorOferta, setErrorOferta] = useState<string | null>(null);

  const responderOferta = async (accion: "aceptar" | "rechazar") => {
    if (!servicio || respondiendoOferta) return;
    setRespondiendoOferta(accion);
    setErrorOferta(null);
    try {
      const actualizado =
        accion === "aceptar" ? await aceptarPresupuesto(servicio.id) : await rechazarPresupuesto(servicio.id);
      setOverrideServicioId(servicio.id);
      setEstadoEnVivo(actualizado.estado);
    } catch (e) {
      setErrorOferta(e instanceof Error ? e.message : "No pudimos responder la oferta.");
    } finally {
      setRespondiendoOferta(null);
    }
  };

  /* Calificar el servicio. Sólo se puede una vez por servicio (la base
     lo exige con un unique en servicio_id). */
  const [calificacion, setCalificacion] = useState<MiCalificacion | null>(null);
  const [calificacionDeServicio, setCalificacionDeServicio] = useState<string | null>(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentarioCalificacion, setComentarioCalificacion] = useState("");
  const [guardandoCalificacion, setGuardandoCalificacion] = useState(false);
  const [errorCalificacion, setErrorCalificacion] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || !servicio) return;
    miCalificacion(servicio.id)
      .then((c) => {
        setCalificacion(c);
        setCalificacionDeServicio(servicio.id);
      })
      .catch(() => {
        setCalificacion(null);
        setCalificacionDeServicio(servicio.id);
      });
  }, [abierto, servicio]);

  const enviarCalificacion = async () => {
    if (!servicio || estrellas === 0 || guardandoCalificacion) return;
    setGuardandoCalificacion(true);
    setErrorCalificacion(null);
    try {
      await calificarServicio(servicio.id, estrellas, comentarioCalificacion);
      setCalificacion({ estrellas, comentario: comentarioCalificacion.trim() || null });
    } catch (e) {
      setErrorCalificacion(e instanceof Error ? e.message : "No pudimos guardar tu calificación.");
    } finally {
      setGuardandoCalificacion(false);
    }
  };

  useEffect(() => {
    if (!abierto || !servicio) return;
    listarFotosServicio(servicio.id)
      .then((f) => {
        setFotos(f);
        setFotosDeServicio(servicio.id);
      })
      .catch(() => {
        setFotos([]);
        setFotosDeServicio(servicio.id);
      });
  }, [abierto, servicio]);

  useEffect(() => {
    if (!abierto || !servicio) return;
    return suscribirseAServicio(servicio.id, (fila) => {
      setOverrideServicioId(servicio.id);
      if (typeof fila.estado === "string") setEstadoEnVivo(fila.estado as EstadoServicio);
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
            <div
              className="relative overflow-hidden rounded-xl3 text-white shadow-hero p-5"
              style={{
                backgroundImage: "radial-gradient(120% 80% at 100% 0%, #14857A 0%, #0E5C54 38%, #0B3B38 100%)",
              }}
            >
              <div className="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full bg-brand-400/20 blur-2xl" />

              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <span className="shrink-0 w-11 h-11 grid place-items-center rounded-2xl bg-white/15">
                    <IconoEquipo nombre={categoria?.icono ?? "wrench"} className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide bg-white/15 rounded-full px-2.5 py-1">
                      {!ESTADOS_SIN_PROGRESO.has(estadoMostrado ?? servicio.estado) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
                      )}
                      {ETIQUETA_ESTADO[estadoMostrado ?? servicio.estado]}
                    </span>
                    <h2 className="text-[18px] font-bold font-display leading-tight mt-1.5 truncate">
                      {categoria?.nombre ?? "Servicio"}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={alCerrar}
                  className="press shrink-0 w-9 h-9 grid place-items-center rounded-full bg-white/15 text-white"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {servicio.fechaPreferida && (
                <p className="relative flex items-center gap-1.5 text-[12.5px] text-brand-100 mt-3">
                  <CalendarClock className="w-[15px] h-[15px] shrink-0" />
                  {fecha(servicio.fechaPreferida)}
                  {servicio.franjaPreferida && ` · ${ETIQUETA_FRANJA[servicio.franjaPreferida] ?? servicio.franjaPreferida}`}
                </p>
              )}

              {!ESTADOS_SIN_PROGRESO.has(estadoMostrado ?? servicio.estado) && (
                <Progreso pasoActual={pasoActual} oscuro />
              )}
            </div>

            <div className="mt-3 rounded-xl2 bg-surface border border-line shadow-card divide-y divide-line overflow-hidden">
              <FilaResumen etiqueta="Servicio" valor={categoria?.nombre ?? "Servicio"} />
              {propiedad && (
                <FilaResumen etiqueta="Domicilio" valor={`${propiedad.nombre} · ${propiedad.direccion}`} />
              )}
              <FilaResumen
                etiqueta="Total"
                valor={
                  servicio.montoArs != null
                    ? pesos(servicio.montoArs)
                    : servicio.estimadoDesdeArs != null && servicio.estimadoHastaArs != null
                      ? servicio.estimadoDesdeArs === servicio.estimadoHastaArs
                        ? `${pesos(servicio.estimadoDesdeArs)} (estimado)`
                        : `${pesos(servicio.estimadoDesdeArs)} – ${pesos(servicio.estimadoHastaArs)} (estimado)`
                      : "A confirmar"
                }
                destacado
              />
            </div>

            {/* Operaciones ofertó un precio en vez de confirmar directo:
                no puede avanzar hasta que el cliente responda. */}
            {estadoMostrado === "presupuestado" && (
              <div className="mt-3 rounded-xl2 bg-brand-50 border border-brand-100 p-4">
                <p className="text-[11px] font-bold tracking-wide uppercase text-brand-600">
                  Te ofrecemos hacer el trabajo por
                </p>
                {servicio.montoArs != null && (
                  <p className="num text-[22px] font-bold text-ink mt-1">{pesos(servicio.montoArs)}</p>
                )}
                {errorOferta && (
                  <p role="alert" className="text-[12.5px] text-urgent mt-1.5">
                    {errorOferta}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => responderOferta("aceptar")}
                    disabled={!!respondiendoOferta}
                    className="press flex items-center justify-center gap-1.5 rounded-xl2 bg-brand-600 text-white py-3 text-[13px] font-semibold disabled:opacity-60"
                  >
                    {respondiendoOferta === "aceptar" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Aceptar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm("¿Rechazar esta oferta? Te vamos a contactar de nuevo.")) return;
                      responderOferta("rechazar");
                    }}
                    disabled={!!respondiendoOferta}
                    className="flex items-center justify-center gap-1.5 rounded-xl2 bg-urgent/10 text-urgent py-3 text-[13px] font-semibold disabled:opacity-60"
                  >
                    {respondiendoOferta === "rechazar" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Rechazar
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 rounded-xl2 bg-surface border border-line shadow-card p-4">
              <p className="text-[11px] font-bold tracking-wide uppercase text-faint">El problema</p>
              <p className="text-[13.5px] text-ink leading-relaxed mt-1.5 whitespace-pre-line">
                {servicio.descripcion}
              </p>
            </div>

            {servicio.reporte && (
              <div className="mt-3 rounded-xl2 bg-surface border border-line shadow-card p-4">
                <p className="text-[11px] font-bold tracking-wide uppercase text-faint">Reporte</p>
                <p className="text-[13.5px] text-ink leading-relaxed mt-1.5">{servicio.reporte}</p>
              </div>
            )}

            {/* Pago: sólo aparece cuando el trabajo ya terminó y todavía
                nadie confirmó cómo se pagó. Efectivo cierra el pedido en
                el momento; Mercado Pago está a la vista pero apagado
                hasta tener credenciales reales — ver db/22_confirmar_pago.sql. */}
            {estadoMostrado === "finalizado" && !servicio.metodoPago && (
              <div className="mt-3 rounded-xl2 bg-surface border border-line shadow-card p-4">
                <p className="text-[11px] font-bold tracking-wide uppercase text-faint">
                  ¿Cómo pagás?
                </p>
                {servicio.montoArs != null && (
                  <p className="num text-[19px] font-bold text-ink mt-1">{pesos(servicio.montoArs)}</p>
                )}
                {errorPago && (
                  <p role="alert" className="text-[12.5px] text-urgent mt-1.5">
                    {errorPago}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={confirmarEfectivo}
                    disabled={confirmandoPago}
                    className="press flex flex-col items-center gap-1.5 rounded-xl2 bg-brand-600 text-white py-3.5 text-[13px] font-semibold disabled:opacity-60"
                  >
                    {confirmandoPago ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Banknote className="w-5 h-5" />
                    )}
                    Efectivo
                  </button>
                  <button
                    type="button"
                    disabled
                    className="relative flex flex-col items-center gap-1.5 rounded-xl2 border border-dashed border-line text-faint py-3.5 text-[13px] font-semibold opacity-70 cursor-not-allowed"
                  >
                    <QrCode className="w-5 h-5" />
                    Mercado Pago
                    <span className="absolute -top-2 right-2 text-[9px] font-bold uppercase tracking-wide bg-warn/15 text-warn rounded-full px-1.5 py-0.5">
                      Próximamente
                    </span>
                  </button>
                </div>
              </div>
            )}

            {servicio.metodoPago && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl2 bg-good/10 px-3.5 py-3">
                <span className="shrink-0 w-8 h-8 grid place-items-center rounded-full bg-good/15 text-good">
                  <Check className="w-4 h-4" />
                </span>
                <p className="text-[12.5px] text-ink leading-snug">
                  Pagado {servicio.metodoPago === "efectivo" ? "en efectivo" : "con Mercado Pago"}
                  {servicio.montoArs != null ? ` · ${pesos(servicio.montoArs)}` : ""}
                </p>
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

            {/* Calificar: sólo cuando el trabajo ya terminó y todavía no
                hay calificación para este servicio puntual. */}
            {calificacionDeServicio === servicio.id &&
              ["finalizado", "pagado", "calificado"].includes(estadoMostrado ?? servicio.estado) &&
              (calificacion ? (
                <div className="mt-4 rounded-xl2 bg-surface border border-line shadow-card p-4">
                  <p className="text-[11px] font-bold tracking-wide uppercase text-faint">Tu calificación</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-4 h-4 ${n <= calificacion.estrellas ? "fill-warn text-warn" : "text-line"}`}
                      />
                    ))}
                  </div>
                  {calificacion.comentario && (
                    <p className="text-[13px] text-ink leading-relaxed mt-2">{calificacion.comentario}</p>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-xl2 bg-surface border border-line shadow-card p-4">
                  <p className="text-[11px] font-bold tracking-wide uppercase text-faint">¿Cómo te fue?</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setEstrellas(n)}
                        aria-label={`${n} estrellas`}
                        className="press"
                      >
                        <Star className={`w-7 h-7 ${n <= estrellas ? "fill-warn text-warn" : "text-line"}`} />
                      </button>
                    ))}
                  </div>
                  {estrellas > 0 && (
                    <>
                      <textarea
                        value={comentarioCalificacion}
                        onChange={(e) => setComentarioCalificacion(e.target.value)}
                        placeholder="Contanos cómo te fue (opcional)"
                        rows={2}
                        className="mt-3 w-full rounded-2xl bg-sand border border-line px-4 py-2.5 text-[13.5px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
                      />
                      {errorCalificacion && (
                        <p role="alert" className="text-[12.5px] text-urgent mt-1.5">
                          {errorCalificacion}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={enviarCalificacion}
                        disabled={guardandoCalificacion}
                        className="press mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-xl2 bg-brand-600 text-white py-3 text-[13px] font-semibold disabled:opacity-60"
                      >
                        {guardandoCalificacion && <Loader2 className="w-4 h-4 animate-spin" />}
                        Enviar calificación
                      </button>
                    </>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
