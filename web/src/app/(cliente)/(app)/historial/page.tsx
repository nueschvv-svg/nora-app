"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Clock, Wrench } from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { Bloque, ErrorCarga } from "@/componentes/Esqueleto";
import { HojaServicio } from "@/componentes/HojaServicio";
import { listarCategorias, listarServicios, type CategoriaBD } from "@/lib/datos";
import { ETIQUETA_ESTADO, type Servicio } from "@/lib/tipos";
import { fechaCorta, pesos } from "@/lib/formato";

/* Estos son los estados en los que el trabajo todavía está en curso.
   Se muestran arriba y con otro color: es lo que la persona quiere ver
   primero al abrir la pantalla. */
const EN_CURSO = new Set(["solicitado", "presupuestado", "aceptado", "en_camino", "en_curso"]);

export default function PaginaHistorial() {
  const { propiedad, cargando: cargandoApp, sesion } = useApp();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [categorias, setCategorias] = useState<CategoriaBD[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [intento, setIntento] = useState(0);
  const traer = useCallback(() => setIntento((n) => n + 1), []);

  const [seleccionado, setSeleccionado] = useState<Servicio | null>(null);

  /* Esperamos a tener sesión antes de pedir los servicios.

     Sin esta espera había un error silencioso y difícil de detectar: si la
     consulta salía antes de que la sesión estuviera lista, la base devolvía
     cero filas (correcto: sin sesión no hay nada que mostrar) y la pantalla
     decía "todavía no hay nada acá" a alguien que sí tenía servicios.
     No fallaba: mentía, que es peor.

     El `vivo` evita escribir estado si la persona ya se fue de la pantalla
     mientras la consulta estaba en camino. */
  useEffect(() => {
    if (!sesion) return;
    let vivo = true;

    (async () => {
      try {
        const [srv, cats] = await Promise.all([listarServicios(), listarCategorias()]);
        if (!vivo) return;
        setServicios(srv);
        setCategorias(cats);
        setError(null);
      } catch (e) {
        if (!vivo) return;
        setError(e instanceof Error ? e.message : "No pudimos cargar tu historial.");
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [sesion, intento]);

  const delDomicilio = useMemo(
    () => (propiedad ? servicios.filter((s) => s.propiedadId === propiedad.id) : []),
    [servicios, propiedad],
  );

  const activos = delDomicilio.filter((s) => EN_CURSO.has(s.estado));
  const cerrados = delDomicilio.filter((s) => !EN_CURSO.has(s.estado) && s.estado !== "cancelado");
  const total = cerrados.reduce((t, s) => t + (s.montoArs ?? 0), 0);

  const nombreCategoria = (slug: string) => categorias.find((c) => c.slug === slug);

  if (error) return <ErrorCarga mensaje={error} alReintentar={traer} />;

  return (
    <main className="h-dvh overflow-y-auto no-scrollbar pb-28">
      <div className="px-5 pt-12 pb-2">
        <h1 className="text-[24px] font-bold font-display text-ink">Historial</h1>
        <p className="text-[13px] text-mute mt-0.5">
          {propiedad ? `${propiedad.nombre} · todo lo que Nora resolvió` : "Tus servicios"}
        </p>
      </div>

      {cargando || cargandoApp ? (
        <div className="px-5 mt-3 space-y-3">
          <Bloque className="h-[62px] w-full rounded-2xl" />
          <Bloque className="h-[76px] w-full rounded-xl2" />
          <Bloque className="h-[76px] w-full rounded-xl2" />
        </div>
      ) : delDomicilio.length === 0 ? (
        <EstadoVacio />
      ) : (
        <>
          <div className="px-5 grid grid-cols-3 gap-2.5">
            <Tarjeta valor={String(cerrados.length)} etiqueta="resueltos" />
            <Tarjeta valor={pesos(total)} etiqueta="invertido" />
            <Tarjeta
              valor={String(activos.length)}
              etiqueta={activos.length === 1 ? "en curso" : "en curso"}
              color={activos.length ? "text-brand-600" : "text-ink"}
            />
          </div>

          {activos.length > 0 && (
            <div className="px-5 mt-5">
              <p className="text-[11px] font-bold tracking-wide uppercase text-faint px-0.5 mb-2">
                En curso
              </p>
              <div className="bg-surface rounded-xl2 border border-brand-200 shadow-card divide-y divide-line overflow-hidden">
                {activos.map((s) => (
                  <Fila
                    key={s.id}
                    servicio={s}
                    categoria={nombreCategoria(s.categoriaSlug)}
                    enCurso
                    onClick={() => setSeleccionado(s)}
                  />
                ))}
              </div>
            </div>
          )}

          {cerrados.length > 0 && (
            <div className="px-5 mt-5">
              <p className="text-[11px] font-bold tracking-wide uppercase text-faint px-0.5 mb-2">
                Resueltos
              </p>
              <div className="bg-surface rounded-xl2 border border-line shadow-card divide-y divide-line overflow-hidden">
                {cerrados.map((s) => (
                  <Fila
                    key={s.id}
                    servicio={s}
                    categoria={nombreCategoria(s.categoriaSlug)}
                    onClick={() => setSeleccionado(s)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <HojaServicio
        servicio={seleccionado}
        categoria={seleccionado ? nombreCategoria(seleccionado.categoriaSlug) : undefined}
        abierto={!!seleccionado}
        alCerrar={() => setSeleccionado(null)}
      />
    </main>
  );
}

function Fila({
  servicio,
  categoria,
  enCurso = false,
  onClick,
}: {
  servicio: Servicio;
  categoria?: CategoriaBD;
  enCurso?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="press w-full flex items-center gap-3.5 p-3.5 text-left">
      <span
        className={`shrink-0 w-11 h-11 grid place-items-center rounded-2xl ${
          enCurso ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600"
        }`}
      >
        <IconoEquipo nombre={categoria?.icono ?? "wrench"} className="w-[19px] h-[19px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink leading-tight">
          {categoria?.nombre ?? "Servicio"}
        </p>
        <p className="text-[12.5px] text-faint mt-0.5 truncate">
          {servicio.descripcion.slice(0, 48)}
          {servicio.descripcion.length > 48 ? "…" : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        {enCurso ? (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-brand-600 font-semibold">
            <Clock className="w-3 h-3" /> {ETIQUETA_ESTADO[servicio.estado]}
          </span>
        ) : (
          <>
            <p className="num text-[13px] font-semibold text-ink">{pesos(servicio.montoArs)}</p>
            <span className="inline-flex items-center gap-1 text-[11px] text-good font-medium">
              <Check className="w-3 h-3" /> Resuelto
            </span>
          </>
        )}
        <p className="text-[11px] text-faint mt-0.5">{fechaCorta(servicio.creadoEl)}</p>
      </div>
    </button>
  );
}

function Tarjeta({
  valor,
  etiqueta,
  color = "text-ink",
}: {
  valor: string;
  etiqueta: string;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-2xl shadow-card p-3 text-center">
      <p className={`num text-[17px] font-extrabold font-display leading-tight ${color}`}>{valor}</p>
      <p className="text-[11px] text-faint mt-0.5">{etiqueta}</p>
    </div>
  );
}

function EstadoVacio() {
  return (
    <div className="px-5 mt-10 flex flex-col items-center text-center">
      <span className="w-16 h-16 grid place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Wrench className="w-7 h-7" />
      </span>
      <h2 className="text-[17px] font-bold font-display text-ink mt-4">Todavía no hay nada acá</h2>
      <p className="text-[13px] text-mute mt-1.5 max-w-[260px]">
        Cuando pidas tu primer servicio, vas a ver acá el detalle, el reporte del trabajo y la
        factura.
      </p>
      <Link
        href="/pedir"
        className="press mt-5 inline-flex items-center gap-2 rounded-xl2 bg-brand-600 text-white px-5 py-3.5 text-[14.5px] font-semibold shadow-fab"
      >
        Pedir un servicio <ArrowRight className="w-[18px] h-[18px]" />
      </Link>
    </div>
  );
}
