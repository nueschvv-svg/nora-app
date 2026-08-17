"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Camera,
  Check,
  Clock,
  Loader2,
  type LucideIcon,
  MapPin,
  Navigation,
  User,
  X as IconoX,
} from "lucide-react";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { HiloChat } from "@/componentes/HiloChat";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import {
  aceptarTrabajo,
  actualizarUbicacionTecnico,
  marcarEnCamino,
  marcarEnCurso,
  marcarFinalizado,
  obtenerTrabajoTecnico,
  ofertarPrecio,
  rechazarTrabajo,
  type TrabajoDetalle,
} from "@/lib/tecnico";
import { fecha, pesos } from "@/lib/formato";

/* Distancia en metros entre dos puntos (haversine) — mismo espíritu que
   tecnicos_cercanos() del lado de la base, sólo que acá es para decidir
   si vale la pena mandar un nuevo punto de GPS o todavía no cambió lo
   suficiente. */
function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/* El código de GeolocationPositionError distingue tres causas bien
   distintas — el mensaje genérico de antes ("no pudimos acceder")
   las mezclaba todas, y las tres primeras dos NO son un bug de la
   app: son el navegador o el celular negando el permiso, o el GPS
   sin señal. Sólo se puede pedir de nuevo, no forzar. */
function mensajeErrorUbicacion(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "No diste permiso de ubicación. Activalo en Ajustes del celular → Nora (o el navegador) → Ubicación, y volvé a intentar.";
    case err.POSITION_UNAVAILABLE:
      return "El celular no pudo obtener tu ubicación ahora — probá salir a un lugar más despejado.";
    case err.TIMEOUT:
      return "Tardó demasiado en encontrar tu ubicación. Probá de nuevo.";
    default:
      return "No pudimos acceder a tu ubicación.";
  }
}

export default function PaginaDetalleTecnico({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [trabajo, setTrabajo] = useState<TrabajoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [avisoAccion, setAvisoAccion] = useState<string | null>(null);
  const [compartiendoUbicacion, setCompartiendoUbicacion] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [reporte, setReporte] = useState("");
  const [ofertando, setOfertando] = useState(false);
  const [montoOferta, setMontoOferta] = useState("");

  const traer = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    obtenerTrabajoTecnico(id)
      .then((t) => {
        if (vivo) setTrabajo(t);
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : "No pudimos cargar el trabajo.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [id, intento]);

  /* Compartir ubicación: sólo mientras el toggle está prendido Y el
     estado es "en_camino". El efecto depende de ambos — al salir de
     "en_camino" (o apagar el toggle) el cleanup de React corta el
     watch solo, sin necesidad de un segundo efecto. */
  useEffect(() => {
    if (!compartiendoUbicacion || trabajo?.estado !== "en_camino" || !("geolocation" in navigator)) return;

    let ultimoEnvio = 0;
    let ultimaPos: { lat: number; lng: number } | null = null;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const ahora = Date.now();
        const actual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (ahora - ultimoEnvio < 8_000 && ultimaPos && distanciaMetros(ultimaPos, actual) < 25) return;
        ultimoEnvio = ahora;
        ultimaPos = actual;
        actualizarUbicacionTecnico(id, actual.lat, actual.lng).catch(() => {
          /* Un envío perdido no corta el seguimiento; el próximo tick lo reintenta. */
        });
      },
      (err) => {
        setErrorUbicacion(mensajeErrorUbicacion(err));
        setCompartiendoUbicacion(false);
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [compartiendoUbicacion, trabajo?.estado, id]);

  /* Avisar por push nunca puede frenar ni deshacer el cambio de
     estado: el técnico ya salió, eso ya pasó. Si el aviso falla
     (suscripción vencida, claves mal configuradas), se ignora acá —
     la ruta ya lo registra en su propio log del lado del servidor. */
  const salirEnCamino = async () => {
    await marcarEnCamino(id);
    fetch(`/api/pedidos/${id}/notificar-en-camino`, { method: "POST" }).catch(() => {});
  };

  const conGuardado = async (etiqueta: string, accion: () => Promise<void>) => {
    setGuardando(etiqueta);
    setAvisoAccion(null);
    try {
      await accion();
      traer();
    } catch (e) {
      setAvisoAccion(e instanceof Error ? e.message : "No pudimos guardar el cambio.");
    } finally {
      setGuardando(null);
    }
  };

  if (error) return <ErrorCarga mensaje={error} alReintentar={traer} />;

  if (cargando || !trabajo) {
    return (
      <main className="px-5 pt-12 space-y-3">
        <Bloque className="h-8 w-40" />
        <Bloque className="h-[120px] w-full rounded-xl2" />
        <Bloque className="h-[200px] w-full rounded-xl2" />
      </main>
    );
  }

  const pendienteDeAceptar = trabajo.estado === "asignado" && !trabajo.tecnicoConfirmadoEl;

  return (
    <main className="h-dvh overflow-y-auto no-scrollbar px-5 pt-12 pb-28">
      <Link href="/tecnico" className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute">
        <ArrowLeft className="w-4 h-4" /> Tus trabajos
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold font-display text-ink leading-tight">{trabajo.categoriaNombre}</h1>
          <p className="text-[13px] text-mute mt-0.5">{fecha(trabajo.creadoEl.slice(0, 10))}</p>
        </div>
        <BadgeEstado estado={trabajo.estado} className="shrink-0" />
      </div>

      {avisoAccion && (
        <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
          {avisoAccion}
        </p>
      )}

      <Seccion titulo="Cliente y ubicación" icono={User}>
        <Fila etiqueta="Cliente" valor={trabajo.cliente.nombre} />
        <Fila etiqueta="Teléfono" valor={trabajo.cliente.telefono ?? "no cargado"} />
        {trabajo.propiedad ? (
          <>
            <Fila etiqueta="Domicilio" valor={`${trabajo.propiedad.nombre} · ${trabajo.propiedad.direccion}`} />
            <Fila etiqueta="Localidad" valor={`${trabajo.propiedad.localidad}, ${trabajo.propiedad.provincia}`} />
          </>
        ) : (
          <p className="text-[12.5px] text-faint">La dirección ya no está disponible: este trabajo terminó.</p>
        )}
      </Seccion>

      <Seccion titulo="El problema" icono={AlertCircle}>
        <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-line">{trabajo.descripcion}</p>
      </Seccion>

      {trabajo.fotos.length > 0 && (
        <Seccion titulo="Fotos" icono={Camera}>
          <div className="grid grid-cols-3 gap-2">
            {trabajo.fotos.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal
              <img key={f.id} src={f.url} alt="Foto del servicio" className="w-full aspect-square object-cover rounded-xl2 border border-line" />
            ))}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Acciones" icono={Navigation}>
        {pendienteDeAceptar && (
          <>
            <div className="flex gap-2.5">
              <BotonAccion
                texto="Aceptar"
                icono={Check}
                ancho="compartido"
                cargando={guardando === "aceptar"}
                onClick={() => conGuardado("aceptar", () => aceptarTrabajo(id))}
              />
              <BotonAccion
                texto="Rechazar"
                icono={IconoX}
                ancho="compartido"
                variante="peligro"
                cargando={guardando === "rechazar"}
                onClick={() => {
                  if (!window.confirm("¿Rechazar este trabajo? Vuelve a la bolsa para que operaciones lo reasigne.")) return;
                  conGuardado("rechazar", () => rechazarTrabajo(id));
                }}
              />
            </div>

            {!ofertando ? (
              <button
                type="button"
                onClick={() => setOfertando(true)}
                className="press mt-2.5 w-full flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-brand-600"
              >
                <Banknote className="w-3.5 h-3.5" />
                O hacé tu propia oferta de precio
              </button>
            ) : (
              <div className="mt-3 pt-3 border-t border-line">
                <label className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
                  Tu precio para este trabajo (ARS)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={montoOferta}
                    onChange={(e) => setMontoOferta(e.target.value)}
                    placeholder="Ej: 45000"
                    className="flex-1 rounded-2xl bg-sand border border-line px-4 py-2.5 text-[13.5px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
                  />
                  <BotonAccion
                    texto="Ofertar"
                    icono={Banknote}
                    cargando={guardando === "ofertar"}
                    onClick={() => {
                      const monto = Number(montoOferta);
                      if (!monto || monto <= 0) {
                        setAvisoAccion("Poné un precio válido para tu oferta.");
                        return;
                      }
                      conGuardado("ofertar", () => ofertarPrecio(id, monto));
                    }}
                  />
                </div>
                <p className="text-[11px] text-faint mt-1.5 px-1">
                  El cliente tiene que aceptarlo antes de que puedas salir.
                </p>
              </div>
            )}
          </>
        )}

        {trabajo.estado === "presupuestado" && (
          <div className="flex items-start gap-2.5 rounded-xl2 bg-warn/10 px-3.5 py-3">
            <Clock className="w-4 h-4 text-warn shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-ink leading-snug">
              Ofertaste{" "}
              <span className="font-semibold">{trabajo.montoArs != null ? pesos(trabajo.montoArs) : "—"}</span>.
              Esperando que el cliente lo acepte para poder salir.
            </p>
          </div>
        )}

        {((trabajo.tecnicoConfirmadoEl && trabajo.estado === "asignado") || trabajo.estado === "aceptado") && (
          <BotonAccion
            texto="Salgo en camino"
            icono={Navigation}
            ancho="completo"
            cargando={guardando === "en_camino"}
            onClick={() => conGuardado("en_camino", salirEnCamino)}
          />
        )}

        {trabajo.estado === "en_camino" && (
          <div className="space-y-3">
            <BotonAccion
              texto="Llegué, empiezo el trabajo"
              icono={Check}
              ancho="completo"
              cargando={guardando === "en_curso"}
              onClick={() => conGuardado("en_curso", () => marcarEnCurso(id))}
            />
            <button
              type="button"
              onClick={() => {
                const activar = !compartiendoUbicacion;
                if (activar && !("geolocation" in navigator)) {
                  setErrorUbicacion("Tu navegador no puede compartir tu ubicación.");
                  return;
                }
                setErrorUbicacion(null);
                setCompartiendoUbicacion(activar);
              }}
              className={`w-full flex items-center gap-2.5 rounded-xl2 border px-3.5 py-3 text-left ${
                compartiendoUbicacion ? "bg-brand-50 border-brand-100" : "bg-sand border-line"
              }`}
            >
              <MapPin className={`w-4 h-4 shrink-0 ${compartiendoUbicacion ? "text-brand-600" : "text-faint"}`} />
              <span className="flex-1 text-[13px] font-medium text-ink">
                Compartir mi ubicación con el cliente
              </span>
              <span
                className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors ${
                  compartiendoUbicacion ? "bg-brand-600" : "bg-line"
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    compartiendoUbicacion ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
            {errorUbicacion && <p className="text-[12px] text-urgent">{errorUbicacion}</p>}
          </div>
        )}

        {trabajo.estado === "en_curso" && (
          <div>
            <label className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
              Reporte del trabajo
            </label>
            <textarea
              value={reporte}
              onChange={(e) => setReporte(e.target.value)}
              placeholder="¿Qué hiciste? Mínimo unas palabras."
              rows={3}
              className="w-full rounded-2xl bg-sand border border-line px-4 py-2.5 text-[13.5px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
            />
            <div className="mt-2">
              <BotonAccion
                texto="Terminar trabajo"
                icono={Check}
                ancho="completo"
                cargando={guardando === "finalizar"}
                onClick={() => {
                  if (reporte.trim().length < 10) {
                    setAvisoAccion("Contanos qué hiciste antes de cerrar el trabajo.");
                    return;
                  }
                  conGuardado("finalizar", () => marcarFinalizado(id, reporte));
                }}
              />
            </div>
          </div>
        )}

        {trabajo.reporte && (
          <div className="pt-3 border-t border-line mt-3">
            <p className="text-[11px] font-bold tracking-wide uppercase text-faint mb-1">Tu reporte</p>
            <p className="text-[13px] text-ink leading-relaxed">{trabajo.reporte}</p>
          </div>
        )}
      </Seccion>

      <HiloChat servicioId={id} />
    </main>
  );
}

/* ---------- Piezas chicas ---------- */

function Seccion({
  titulo,
  icono: Icono,
  children,
}: {
  titulo: string;
  icono: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-faint px-0.5 mb-1.5">
        <Icono className="w-3.5 h-3.5" /> {titulo}
      </p>
      <div className="bg-surface rounded-xl2 border border-line shadow-card p-4 space-y-3">{children}</div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[13px] text-mute shrink-0">{etiqueta}</span>
      <span className="text-[13px] font-semibold text-ink text-right">{valor}</span>
    </div>
  );
}

function BotonAccion({
  texto,
  onClick,
  cargando,
  icono: Icono,
  ancho = "auto",
  variante = "normal",
}: {
  texto: string;
  onClick: () => void;
  cargando?: boolean;
  icono?: LucideIcon;
  ancho?: "auto" | "completo" | "compartido";
  variante?: "normal" | "peligro";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      className={`press flex items-center justify-center gap-2 rounded-xl2 px-4 py-3 text-[13.5px] font-semibold disabled:opacity-50 ${
        ancho === "completo" ? "w-full" : ancho === "compartido" ? "flex-1" : ""
      } ${variante === "peligro" ? "bg-urgent/10 text-urgent" : "bg-brand-600 text-white shadow-fab"}`}
    >
      {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : Icono ? <Icono className="w-4 h-4" /> : null}
      {texto}
    </button>
  );
}
