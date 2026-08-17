"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Banknote,
  Calendar,
  Camera,
  ClipboardList,
  History,
  Loader2,
  MapPin,
  Radio,
  StickyNote,
  UserCog,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { BadgeEstado } from "@/componentes/BadgeEstado";
import {
  actualizarServicioOperaciones,
  agregarNotaServicio,
  listarTecnicosParaCategoria,
  obtenerServicioOperaciones,
  type ServicioDetalle,
  type TecnicoParaAsignar,
} from "@/lib/operaciones";
import { ETIQUETA_ESTADO, type EstadoServicio } from "@/lib/tipos";
import { fecha } from "@/lib/formato";

/* La secuencia normal de un pedido. "Siguiente paso" avanza uno solo
   por vez — nada de un selector con los 11 estados sueltos, que
   invitaría a saltos sin sentido de negocio (¿"pagado" antes de
   "en_curso"?). Cancelar es aparte porque es la única salida que no
   sigue la secuencia. */
const SECUENCIA: EstadoServicio[] = [
  "solicitado",
  "buscando_tecnico",
  "asignado",
  "presupuestado",
  "aceptado",
  "en_camino",
  "en_curso",
  "finalizado",
  "pagado",
  "calificado",
];

const FRANJAS = [
  { id: "manana", texto: "Mañana · 8 a 12 h" },
  { id: "tarde-1", texto: "Tarde · 13 a 17 h" },
  { id: "tarde-2", texto: "Tarde · 17 a 20 h" },
  { id: "urgente", texto: "Lo antes posible" },
];

export default function PaginaDetalleOperaciones({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [servicio, setServicio] = useState<ServicioDetalle | null>(null);
  const [tecnicos, setTecnicos] = useState<TecnicoParaAsignar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [avisoAccion, setAvisoAccion] = useState<string | null>(null);

  const traer = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    obtenerServicioOperaciones(id)
      .then((s) => {
        if (!vivo) return;
        setServicio(s);
        if (s) return listarTecnicosParaCategoria(s.categoriaSlug).then((t) => vivo && setTecnicos(t));
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

  if (cargando || !servicio) {
    return (
      <main className="max-w-2xl mx-auto px-5 py-8 space-y-3">
        <Bloque className="h-8 w-40" />
        <Bloque className="h-[120px] w-full rounded-xl2" />
        <Bloque className="h-[200px] w-full rounded-xl2" />
      </main>
    );
  }

  const indiceActual = SECUENCIA.indexOf(servicio.estado);
  const proximoEstado = indiceActual >= 0 && indiceActual < SECUENCIA.length - 1 ? SECUENCIA[indiceActual + 1] : null;
  const puedeCancelar = servicio.estado !== "cancelado" && indiceActual >= 0 && indiceActual < SECUENCIA.indexOf("en_curso") + 1;

  return (
    <main className="max-w-2xl mx-auto px-5 py-8 pb-20">
      <Link href="/operaciones" className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute">
        <ArrowLeft className="w-4 h-4" /> Todos los pedidos
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <span className="shrink-0 w-11 h-11 grid place-items-center rounded-xl bg-brand-50 text-brand-600 text-[12px] font-bold">
          {servicio.categoriaNombre.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-bold font-display text-ink leading-tight truncate">
            {servicio.categoriaNombre}
          </h1>
          <p className="text-[12.5px] text-mute mt-0.5">{fecha(servicio.creadoEl.slice(0, 10))}</p>
          <BadgeEstado estado={servicio.estado} className="mt-1.5" />
        </div>
      </div>

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
      </Seccion>

      {/* ---------- El problema ---------- */}
      <Seccion titulo="El problema" icono={ClipboardList}>
        <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-line">{servicio.descripcion}</p>
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
      <Seccion titulo="Acciones" icono={Wrench}>
        <div className="flex flex-wrap gap-2.5">
          {proximoEstado && (
            <BotonAccion
              texto={`Avanzar a "${ETIQUETA_ESTADO[proximoEstado]}"`}
              icono={Radio}
              cargando={guardando === "estado"}
              onClick={() =>
                conGuardado("estado", () => actualizarServicioOperaciones(id, { estado: proximoEstado }))
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
                if (!window.confirm("¿Cancelar este pedido?")) return;
                conGuardado("cancelar", () => actualizarServicioOperaciones(id, { estado: "cancelado" }));
              }}
            />
          )}
        </div>

        <FormularioPrecio
          valorInicial={servicio.montoArs}
          guardando={guardando === "precio"}
          onGuardar={(monto) => conGuardado("precio", () => actualizarServicioOperaciones(id, { montoArs: monto }))}
        />

        <FormularioTecnico
          tecnicos={tecnicos}
          valorInicial={servicio.tecnicoId}
          guardando={guardando === "tecnico"}
          onGuardar={(tecnicoId) =>
            conGuardado("tecnico", () => actualizarServicioOperaciones(id, { tecnicoId }))
          }
        />

        <FormularioReprogramar
          fechaInicial={servicio.fechaPreferida}
          franjaInicial={servicio.franjaPreferida}
          guardando={guardando === "reprogramar"}
          onGuardar={(fechaPreferida, franjaPreferida, nota) =>
            conGuardado("reprogramar", async () => {
              await actualizarServicioOperaciones(id, { fechaPreferida, franjaPreferida });
              await agregarNotaServicio(id, nota, servicio.estado);
            })
          }
        />

        <FormularioNota
          guardando={guardando === "nota"}
          onGuardar={(texto) => conGuardado("nota", () => agregarNotaServicio(id, texto, servicio.estado))}
        />
      </Seccion>

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
      <div className="bg-surface rounded-xl2 border border-line shadow-card p-4">{children}</div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
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
      className={`press flex items-center gap-2 rounded-xl2 px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50 ${
        variante === "peligro" ? "bg-urgent/10 text-urgent" : "bg-brand-600 text-white"
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
      <label className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">Precio (ARS)</label>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Sin definir"
          className="flex-1 rounded-2xl bg-sand border border-line px-4 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand-300"
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

function FormularioTecnico({
  tecnicos,
  valorInicial,
  guardando,
  onGuardar,
}: {
  tecnicos: TecnicoParaAsignar[];
  valorInicial: string | null;
  guardando: boolean;
  onGuardar: (tecnicoId: string | null) => void;
}) {
  const [valor, setValor] = useState(valorInicial ?? "");
  return (
    <div className="mt-4 pt-4 border-t border-line">
      <label className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
        Técnico asignado
      </label>
      {tecnicos.length === 0 ? (
        <p className="text-[12.5px] text-faint">No hay técnicos verificados para este rubro todavía.</p>
      ) : (
        <div className="flex gap-2">
          <select
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="flex-1 rounded-2xl bg-sand border border-line px-4 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand-300"
          >
            <option value="">Sin asignar</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} · {t.trabajos} trabajos{t.promedio ? ` · ${t.promedio}★` : ""}
              </option>
            ))}
          </select>
          <BotonAccion texto="Guardar" icono={UserCog} cargando={guardando} onClick={() => onGuardar(valor || null)} />
        </div>
      )}
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

  const puedeGuardar = !!dia && !!franja && nota.trim().length >= 5;

  return (
    <div className="mt-4 pt-4 border-t border-line">
      <label className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">Reprogramar</label>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          className="rounded-2xl bg-sand border border-line px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand-300"
        />
        <select
          value={franja}
          onChange={(e) => setFranja(e.target.value)}
          className="rounded-2xl bg-sand border border-line px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand-300"
        >
          <option value="">Franja</option>
          {FRANJAS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.texto}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="¿Por qué se reprograma? (obligatorio)"
        rows={2}
        className="mt-2 w-full rounded-2xl bg-sand border border-line px-4 py-2.5 text-[13.5px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
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
      <label className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
        Dejar una nota
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej: llamé al cliente, confirma horario"
          className="flex-1 rounded-2xl bg-sand border border-line px-4 py-2.5 text-[13.5px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
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
