"use client";

import { SelectorAgenda } from "@/componentes/SelectorAgenda";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Banknote,
  Calendar,
  Camera,
  Check,
  ClipboardList,
  History,
  Loader2,
  MapPin,
  Radio,
  StickyNote,
  Wrench,
  X,
  type LucideIcon,
  PauseCircle,
} from "lucide-react";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import {
  ConflictoConcurrencia,
  aceptarPedidoDirecto,
  agregarNotaServicio,
  avanzarEstado,
  marcarSituacion,
  cancelarPedido,
  editarPrecio,
  obtenerServicioOperaciones,
  ofertarPrecio,
  rechazarPedido,
  reprogramarPedido,
  type ServicioDetalle,
} from "@/lib/operaciones";
import { suscribirseAServicio } from "@/lib/tiempoReal";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_SITUACION,
  type EstadoServicio,
  type SituacionServicio,
} from "@/lib/tipos";

/** El orden en que operaciones las ve. No se deriva del Record para que el
 *  orden en pantalla sea una decisión y no un detalle de implementación. */
const SITUACIONES: SituacionServicio[] = ["segunda_visita", "materiales", "administracion"];
import { fecha } from "@/lib/formato";

/* La secuencia normal, una vez que el pedido ya tiene precio
   confirmado. "solicitado" y "presupuestado" no están acá — esos dos
   tienen su propia sección de Acciones (responder al pedido nuevo),
   más abajo. Cancelar sigue aparte porque es la única salida que no
   sigue la secuencia. */
const SECUENCIA: EstadoServicio[] = ["aceptado", "en_camino", "en_curso", "finalizado", "pagado", "calificado"];



/* El detalle de un pedido, compartido entre /operaciones/[id] (sola,
   a pantalla completa en el celular) y la vista de escritorio de
   ambas rutas (al lado de la lista). El link "Todos los pedidos" sólo
   tiene sentido cuando no hay lista visible al lado — se oculta con
   md:hidden en vez de sacarlo, así el volver del celular sigue
   andando igual. */
export function DetalleServicio({ id }: { id: string }) {
  const [servicio, setServicio] = useState<ServicioDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [avisoAccion, setAvisoAccion] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);

  const traer = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    obtenerServicioOperaciones(id)
      .then((s) => {
        if (vivo) { setServicio(s); setError(null); }
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : "No pudimos cargar el pedido.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [id, intento]);

  /* Otra sesión de la misma cuenta de operaciones (u otro dispositivo)
     puede cambiar este mismo pedido mientras lo estoy mirando — sin
     esto, seguiría viendo un estado viejo hasta recargar a mano. */
  useEffect(() => {
    return suscribirseAServicio(id, () => traer());
  }, [id, traer]);

  const conGuardado = async (etiqueta: string, accion: () => Promise<void>) => {
    setGuardando(etiqueta);
    setAvisoAccion(null);
    setConflicto(false);
    try {
      await accion();
      traer();
    } catch (e) {
      if (e instanceof ConflictoConcurrencia) {
        setConflicto(true);
        traer();
      } else {
        setAvisoAccion(e instanceof Error ? e.message : "No pudimos guardar el cambio.");
      }
    } finally {
      setGuardando(null);
    }
  };

  if (error) return <ErrorCarga mensaje={error} alReintentar={traer} />;

  if (cargando || !servicio) {
    return (
      <div role="status" aria-label="Cargando pedido" className="mx-auto max-w-4xl p-6 space-y-3">
        <Bloque className="h-8 w-40" />
        <Bloque className="h-[120px] w-full rounded-xl2" />
        <Bloque className="h-[200px] w-full rounded-xl2" />
      </div>
    );
  }

  const indiceActual = SECUENCIA.indexOf(servicio.estado);
  const proximoEstado = indiceActual >= 0 && indiceActual < SECUENCIA.length - 1 ? SECUENCIA[indiceActual + 1] : null;
  const puedeCancelar =
    servicio.estado !== "cancelado" &&
    (servicio.estado === "aceptado" || servicio.estado === "en_camino");

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 lg:px-10 lg:py-10">
      <Link
        href="/operaciones"
        className="press md:hidden min-h-11 inline-flex items-center gap-2 rounded-xl text-sm font-semibold text-brand-700"
      >
        <ArrowLeft className="w-4 h-4" /> Todos los pedidos
      </Link>

      <div className="mt-4 md:mt-0 flex items-start gap-4 border-b border-line pb-7">
        <span className="shrink-0 w-14 h-14 grid place-items-center rounded-2xl bg-brand-700 text-white text-sm font-semibold">
          {servicio.categoriaNombre.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="nora-eyebrow mb-2">Detalle del pedido</p>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold text-ink leading-tight break-words">
            {servicio.categoriaNombre}
          </h1>
          <p className="text-sm text-mute mt-2">{fecha(servicio.creadoEl.slice(0, 10))}</p>
          <BadgeEstado estado={servicio.estado} className="mt-1.5" />
        </div>
      </div>

      {conflicto && (
        <p role="alert" className="text-[13px] text-warn bg-warn/10 rounded-xl2 px-3.5 py-3 mt-4">
          Alguien más ya actualizó este pedido — te muestro el estado real, arriba.
        </p>
      )}
      {avisoAccion && (
        <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
          {avisoAccion}
        </p>
      )}

      {/* ---------- Cliente y propiedad ---------- */}
      <Seccion titulo="Cliente y ubicación" icono={MapPin}>
        <Fila etiqueta="Cliente" valor={servicio.cliente.nombre} />
        <Fila etiqueta="Teléfono" valor={servicio.cliente.telefono ?? "no cargado"} />
        <Fila etiqueta="Domicilio" valor={`${servicio.propiedad.nombre} · ${servicio.propiedad.direccion}`} />
        <Fila etiqueta="Localidad" valor={`${servicio.propiedad.localidad}, ${servicio.propiedad.provincia}`} />
        {servicio.propiedad.notasAcceso && <Fila etiqueta="Notas de acceso" valor={servicio.propiedad.notasAcceso} />}
        {servicio.metodoPago && (
          <Fila
            etiqueta="Pago"
            valor={servicio.metodoPago === "efectivo" ? "Efectivo" : "Mercado Pago"}
          />
        )}
      </Seccion>

      {/* ---------- El problema ---------- */}
      <Seccion titulo="El problema" icono={ClipboardList}>
        <p className="text-sm text-ink leading-relaxed whitespace-pre-line break-words">{servicio.descripcion}</p>
      </Seccion>

      {servicio.fotos.length > 0 && (
        <Seccion titulo="Fotos" icono={Camera}>
          <div className="grid grid-cols-3 gap-2">
            {servicio.fotos.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal
              <img key={f.id} src={f.url} alt="Foto del servicio" className="w-full aspect-square object-cover rounded-xl2 border border-line" />
            ))}
          </div>
        </Seccion>
      )}

      {/* ---------- Aviso a Telegram ---------- */}
      {servicio.enrutamientos.length > 0 && (
        <Seccion titulo="Aviso enviado" icono={Radio}>
          {servicio.enrutamientos.map((e, i) => (
            <p key={i} className="text-[12.5px] text-mute">
              <span className={e.estado === "enviado" ? "text-good font-semibold" : "text-urgent font-semibold"}>
                {e.estado === "enviado" ? "Enviado" : "Falló"}
              </span>{" "}
              vía {e.estrategia} — {fecha(e.creadoEl.slice(0, 10))}
              {e.detalle && e.estado === "fallido" ? ` (${e.detalle})` : ""}
            </p>
          ))}
        </Seccion>
      )}

      {/* ---------- Acciones ---------- */}
      {servicio.estado === "solicitado" ? (
        <ResponderSolicitud
          guardando={guardando}
          onAceptar={(monto) => conGuardado("aceptar", () => aceptarPedidoDirecto(servicio.id, monto))}
          onOfertar={(monto) => conGuardado("ofertar", () => ofertarPrecio(servicio.id, monto))}
          onRechazar={(motivo) => conGuardado("rechazar", () => rechazarPedido(servicio.id, motivo))}
        />
      ) : servicio.estado === "presupuestado" ? (
        <Seccion titulo="Acciones" icono={Wrench}>
          <p className="text-[13px] text-mute leading-relaxed">
            Le ofertaste {servicio.montoArs != null ? `$${servicio.montoArs.toLocaleString("es-AR")}` : "un precio"} —
            esperando que el cliente acepte o rechace desde su pedido.
          </p>
        </Seccion>
      ) : (
        <Seccion titulo="Acciones" icono={Wrench}>
          <div className="flex flex-wrap gap-2.5">
            {proximoEstado && (
              <BotonAccion
                texto={`Avanzar a "${ETIQUETA_ESTADO[proximoEstado]}"`}
                icono={Radio}
                cargando={guardando === "estado"}
                onClick={() =>
                  conGuardado("estado", () => avanzarEstado(servicio.id, servicio.estado, proximoEstado))
                }
              />
            )}
            {puedeCancelar && (
              <BotonAccion
                texto="Cancelar pedido"
                icono={Ban}
                variante="peligro"
                cargando={guardando === "cancelar"}
                onClick={() => {
                  const mensaje =
                    servicio.estado === "en_camino"
                      ? "Ya vamos en camino a hacer este trabajo. ¿Seguro que querés cancelar?"
                      : "¿Cancelar este pedido?";
                  if (!window.confirm(mensaje)) return;
                  conGuardado("cancelar", () => cancelarPedido(servicio.id, servicio.estado));
                }}
              />
            )}
          </div>

          <FormularioPrecio
            valorInicial={servicio.montoArs}
            guardando={guardando === "precio"}
            onGuardar={(monto) => conGuardado("precio", () => editarPrecio(servicio.id, servicio.estado, monto))}
          />

          <FormularioReprogramar
            fechaInicial={servicio.fechaPreferida}
            franjaInicial={servicio.franjaPreferida}
            guardando={guardando === "reprogramar"}
            onGuardar={(fechaPreferida, franjaPreferida, nota) =>
              conGuardado("reprogramar", async () => {
                await reprogramarPedido(servicio.id, servicio.estado, fechaPreferida, franjaPreferida);
                await agregarNotaServicio(servicio.id, nota, servicio.estado);
              })
            }
          />

          <FormularioNota
            guardando={guardando === "nota"}
            onGuardar={(texto) => conGuardado("nota", () => agregarNotaServicio(servicio.id, texto, servicio.estado))}
          />
        </Seccion>
      )}

      {/* La situación es independiente del presupuesto y del estado del pedido. */}
      {!["finalizado", "pagado", "calificado", "cancelado"].includes(servicio.estado) && (
        <Seccion titulo="Situación del trabajo" icono={PauseCircle}>
          <p className="text-sm text-mute mb-3">Informá qué está pendiente sin cambiar el estado del pedido.</p>
          <div className="flex flex-wrap gap-2.5">
            {SITUACIONES.map((s) => (
              <BotonAccion
                key={s}
                texto={servicio.situacion === s ? `Quitar «${ETIQUETA_SITUACION[s]}»` : ETIQUETA_SITUACION[s]}
                icono={PauseCircle}
                cargando={guardando === `situacion-${s}`}
                onClick={() => {
                  const quitar = servicio.situacion === s;
                  const nota = quitar ? null : window.prompt("Detalle para el residente (opcional)");
                  if (!quitar && nota === null) return;
                  conGuardado(`situacion-${s}`, () => marcarSituacion(servicio.id, servicio.estado, quitar ? null : s, nota));
                }}
              />
            ))}
          </div>
        </Seccion>
      )}

      {/* ---------- Bitácora ---------- */}
      <Seccion titulo="Historial" icono={History}>
        {servicio.eventos.length === 0 ? (
          <p className="text-[12.5px] text-faint">Sin movimientos todavía.</p>
        ) : (
          <div className="space-y-3">
            {servicio.eventos.map((e) => (
              <div key={e.id} className="text-[12.5px] border-l-2 border-line pl-3">
                <p className="text-faint">{fecha(e.ocurrioEl.slice(0, 10))}</p>
                {e.estadoPrevio !== e.estadoNuevo && (
                  <p className="text-ink font-medium">
                    {ETIQUETA_ESTADO[e.estadoNuevo]}
                    {e.estadoPrevio ? ` (antes: ${ETIQUETA_ESTADO[e.estadoPrevio]})` : ""}
                  </p>
                )}
                {e.nota && <p className="text-mute mt-0.5">{e.nota}</p>}
              </div>
            ))}
          </div>
        )}
      </Seccion>
    </div>
  );
}

/* ---------- Responder a un pedido recién solicitado ---------- */

function ResponderSolicitud({
  guardando,
  onAceptar,
  onOfertar,
  onRechazar,
}: {
  guardando: string | null;
  onAceptar: (montoArs: number) => void;
  onOfertar: (montoArs: number) => void;
  onRechazar: (motivo: string) => void;
}) {
  const [monto, setMonto] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const montoValido = monto.trim() !== "" && Number(monto) > 0;

  return (
    <Seccion titulo="Responder este pedido" icono={Wrench}>
      <p className="text-[13px] text-mute leading-relaxed">
        Confirmá un precio (queda aceptado directo) u ofertá uno para que el cliente decida.
      </p>
      <label htmlFor="precio-respuesta" className="block text-xs font-semibold tracking-wide text-mute mt-3 mb-1.5">
        Precio (ARS)
      </label>
      <input
        type="number"
        inputMode="numeric"
        id="precio-respuesta"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        placeholder="Ej: 25000"
        className="w-full rounded-xl bg-sand border border-line px-4 py-2.5 text-base text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
      <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
        <BotonAccion
          texto="Aceptar con este precio"
          icono={Check}
          cargando={guardando === "aceptar"}
          onClick={() => montoValido && onAceptar(Number(monto))}
        />
        <BotonAccion
          texto="Ofertar (decide el cliente)"
          icono={Banknote}
          cargando={guardando === "ofertar"}
          onClick={() => montoValido && onOfertar(Number(monto))}
        />
      </div>
      {!montoValido && monto !== "" && (
        <p className="text-[11.5px] text-faint mt-1.5">El precio tiene que ser mayor a cero.</p>
      )}

      <div className="mt-4 pt-4 border-t border-line">
        {!rechazando ? (
          <button
            type="button"
            onClick={() => setRechazando(true)}
            className="press min-h-11 flex items-center gap-1.5 text-sm font-semibold text-urgent"
          >
            <X className="w-3.5 h-3.5" /> Rechazar este pedido
          </button>
        ) : (
          <>
            <label htmlFor="motivo-rechazo" className="block text-xs font-semibold tracking-wide text-mute mb-1.5">
              ¿Por qué se rechaza?
            </label>
            <textarea
              id="motivo-rechazo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: fuera de la zona que cubrimos"
              rows={2}
              className="w-full rounded-xl bg-sand border border-line px-4 py-2.5 text-base text-ink placeholder:text-faint outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
            <div className="flex items-center gap-2 mt-2">
              <BotonAccion
                texto="Confirmar rechazo"
                icono={Ban}
                variante="peligro"
                cargando={guardando === "rechazar"}
                onClick={() => motivo.trim().length >= 5 && onRechazar(motivo)}
              />
              <button
                type="button"
                onClick={() => setRechazando(false)}
                className="press min-h-11 text-sm font-semibold text-mute px-3"
              >
                Cancelar
              </button>
            </div>
            {motivo.trim().length > 0 && motivo.trim().length < 5 && (
              <p className="text-[11.5px] text-faint mt-1.5">Un motivo cortito alcanza.</p>
            )}
          </>
        )}
      </div>
    </Seccion>
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
    <section className="nora-panel mt-5 overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 text-sm font-semibold text-ink">
        <Icono aria-hidden="true" className="w-4 h-4 text-brand-600" /> {titulo}
      </h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 py-2 border-b border-line/60 last:border-0">
      <span className="text-sm text-mute">{etiqueta}</span>
      <span className="text-sm font-medium text-ink break-words">{valor}</span>
    </div>
  );
}

function BotonAccion({
  texto,
  onClick,
  cargando,
  variante = "normal",
  icono: Icono,
}: {
  texto: string;
  onClick: () => void;
  cargando?: boolean;
  variante?: "normal" | "peligro";
  icono?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      className={`press min-h-11 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${
        variante === "peligro" ? "bg-urgent/10 text-urgent" : "bg-brand-700 text-white hover:bg-brand-800"
      }`}
    >
      {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icono && <Icono className="w-3.5 h-3.5" />}
      {texto}
    </button>
  );
}

function FormularioPrecio({
  valorInicial,
  guardando,
  onGuardar,
}: {
  valorInicial: number | null;
  guardando: boolean;
  onGuardar: (monto: number | null) => void;
}) {
  const [valor, setValor] = useState(valorInicial != null ? String(valorInicial) : "");
  return (
    <div className="mt-4 pt-4 border-t border-line">
      <label htmlFor="precio-pedido" className="block text-xs font-semibold tracking-wide text-mute mb-1.5">Precio (ARS)</label>
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          inputMode="numeric"
          id="precio-pedido"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Sin definir"
          className="min-w-0 flex-1 rounded-xl bg-sand border border-line px-4 py-2.5 text-base text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
        <BotonAccion
          texto="Guardar"
          icono={Banknote}
          cargando={guardando}
          onClick={() => onGuardar(valor.trim() ? Number(valor) : null)}
        />
      </div>
    </div>
  );
}

function FormularioReprogramar({
  fechaInicial,
  franjaInicial,
  guardando,
  onGuardar,
}: {
  fechaInicial: string | null;
  franjaInicial: string | null;
  guardando: boolean;
  onGuardar: (fecha: string | null, franja: string | null, nota: string) => void;
}) {
  const [dia, setDia] = useState(fechaInicial ?? "");
  const [franja, setFranja] = useState(franjaInicial ?? "");
  const [nota, setNota] = useState("");
  const [agendaValida, setAgendaValida] = useState(false);

  const puedeGuardar = agendaValida && !!dia && !!franja && nota.trim().length >= 5;

  return (
    <div className="mt-4 pt-4 border-t border-line">
      <label className="block text-xs font-semibold tracking-wide text-mute mb-1.5">Reprogramar</label>
      <SelectorAgenda fecha={dia} franja={franja} onChange={(d,f)=>{setDia(d);setFranja(f ?? "");}} onValidez={setAgendaValida} />
      <label htmlFor="motivo-reprogramacion" className="mt-4 block text-xs font-semibold text-mute">Motivo de la reprogramación</label>
      <textarea
        id="motivo-reprogramacion"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="¿Por qué se reprograma? (obligatorio)"
        rows={2}
        className="mt-2 w-full rounded-xl bg-sand border border-line px-4 py-2.5 text-base text-ink placeholder:text-faint outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
      <div className="mt-2">
        <BotonAccion
          texto="Guardar reprogramación"
          icono={Calendar}
          cargando={guardando}
          onClick={() => puedeGuardar && onGuardar(dia, franja, nota)}
        />
        {!puedeGuardar && (dia || franja || nota) && (
          <p className="text-[11.5px] text-faint mt-1.5">Completá día, franja y el motivo (mínimo unas palabras).</p>
        )}
      </div>
    </div>
  );
}

function FormularioNota({
  guardando,
  onGuardar,
}: {
  guardando: boolean;
  onGuardar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  return (
    <div className="mt-4 pt-4 border-t border-line">
      <label htmlFor="nota-pedido" className="block text-xs font-semibold tracking-wide text-mute mb-1.5">
        Dejar una nota
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          id="nota-pedido"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej: llamé al cliente, confirma horario"
          className="min-w-0 flex-1 rounded-xl bg-sand border border-line px-4 py-2.5 text-base text-ink placeholder:text-faint outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
        <BotonAccion
          texto="Agregar"
          icono={StickyNote}
          cargando={guardando}
          onClick={() => {
            if (!texto.trim()) return;
            onGuardar(texto);
            setTexto("");
          }}
        />
      </div>
    </div>
  );
}
