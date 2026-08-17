"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { HiloChat } from "@/componentes/HiloChat";
import {
  aceptarTrabajo,
  actualizarUbicacionTecnico,
  marcarEnCamino,
  marcarEnCurso,
  marcarFinalizado,
  obtenerTrabajoTecnico,
  rechazarTrabajo,
  type TrabajoDetalle,
} from "@/lib/tecnico";
import { ETIQUETA_ESTADO } from "@/lib/tipos";
import { fecha } from "@/lib/formato";

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
      () => {
        setErrorUbicacion("No pudimos acceder a tu ubicación.");
        setCompartiendoUbicacion(false);
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [compartiendoUbicacion, trabajo?.estado, id]);

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
      <main className="max-w-2xl mx-auto px-5 py-8 space-y-3">
        <Bloque className="h-8 w-40" />
        <Bloque className="h-[120px] w-full rounded-xl2" />
        <Bloque className="h-[200px] w-full rounded-xl2" />
      </main>
    );
  }

  const pendienteDeAceptar = trabajo.estado === "asignado" && !trabajo.tecnicoConfirmadoEl;

  return (
    <main className="max-w-2xl mx-auto px-5 py-8 pb-20">
      <Link href="/tecnico" className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute">
        <ArrowLeft className="w-4 h-4" /> Tus trabajos
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold font-display text-ink leading-tight">{trabajo.categoriaNombre}</h1>
          <p className="text-[13px] text-mute mt-0.5">{fecha(trabajo.creadoEl.slice(0, 10))}</p>
        </div>
        <span className="text-[11.5px] font-semibold text-brand-600 bg-brand-50 rounded-full px-3 py-1 shrink-0">
          {ETIQUETA_ESTADO[trabajo.estado]}
        </span>
      </div>

      {avisoAccion && (
        <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
          {avisoAccion}
        </p>
      )}

      <Seccion titulo="Cliente y ubicación">
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

      <Seccion titulo="El problema">
        <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-line">{trabajo.descripcion}</p>
      </Seccion>

      {trabajo.fotos.length > 0 && (
        <Seccion titulo="Fotos">
          <div className="grid grid-cols-3 gap-2">
            {trabajo.fotos.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal
              <img key={f.id} src={f.url} alt="Foto del servicio" className="w-full aspect-square object-cover rounded-xl2 border border-line" />
            ))}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Acciones">
        {pendienteDeAceptar && (
          <div className="flex gap-2.5">
            <BotonAccion
              texto="Aceptar"
              cargando={guardando === "aceptar"}
              onClick={() => conGuardado("aceptar", () => aceptarTrabajo(id))}
            />
            <BotonAccion
              texto="Rechazar"
              variante="peligro"
              cargando={guardando === "rechazar"}
              onClick={() => {
                if (!window.confirm("¿Rechazar este trabajo? Vuelve a la bolsa para que operaciones lo reasigne.")) return;
                conGuardado("rechazar", () => rechazarTrabajo(id));
              }}
            />
          </div>
        )}

        {trabajo.tecnicoConfirmadoEl && trabajo.estado === "asignado" && (
          <BotonAccion
            texto="Salgo en camino"
            cargando={guardando === "en_camino"}
            onClick={() => conGuardado("en_camino", () => marcarEnCamino(id))}
          />
        )}

        {trabajo.estado === "en_camino" && (
          <div className="space-y-3">
            <BotonAccion
              texto="Llegué, empiezo el trabajo"
              cargando={guardando === "en_curso"}
              onClick={() => conGuardado("en_curso", () => marcarEnCurso(id))}
            />
            <label className="flex items-center gap-2.5 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={compartiendoUbicacion}
                onChange={(e) => {
                  if (e.target.checked && !("geolocation" in navigator)) {
                    setErrorUbicacion("Tu navegador no puede compartir tu ubicación.");
                    return;
                  }
                  setErrorUbicacion(null);
                  setCompartiendoUbicacion(e.target.checked);
                }}
                className="w-[18px] h-[18px]"
              />
              <MapPin className="w-4 h-4 text-brand-600" />
              Compartir mi ubicación con el cliente
            </label>
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

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold tracking-wide uppercase text-faint px-0.5 mb-1.5">{titulo}</p>
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
  variante = "normal",
}: {
  texto: string;
  onClick: () => void;
  cargando?: boolean;
  variante?: "normal" | "peligro";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      className={`press flex items-center gap-2 rounded-xl2 px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50 ${
        variante === "peligro" ? "bg-urgent/10 text-urgent" : "bg-brand-600 text-white"
      }`}
    >
      {cargando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {texto}
    </button>
  );
}
