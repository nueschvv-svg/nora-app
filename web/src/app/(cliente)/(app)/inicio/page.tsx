"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, ChevronsUpDown, MoreHorizontal, Send, Sparkles } from "lucide-react";

import { LogotipoNora } from "@/componentes/LogoNora";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { HojaPropiedades } from "@/componentes/HojaPropiedades";
import { HojaServicio } from "@/componentes/HojaServicio";
import { HojaNotificaciones } from "@/componentes/HojaNotificaciones";
import { PrimerDomicilio } from "@/componentes/PrimerDomicilio";
import { EsqueletoInicio, ErrorCarga } from "@/componentes/Esqueleto";
import { useApp } from "@/componentes/ContextoApp";
import { recordatoriosDeMantenimiento } from "@/lib/score";
import { listarCategorias, listarServicios, type CategoriaBD } from "@/lib/datos";
import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  suscribirseANotificaciones,
  type Notificacion,
} from "@/lib/notificaciones";
import { ETIQUETA_ESTADO, type EstadoServicio, type Servicio } from "@/lib/tipos";
import { saludo } from "@/lib/formato";

/* Mismo criterio que historial/page.tsx: qué está "en curso". Está
   duplicado a propósito y no importado desde ahí — ver el comentario
   en ese archivo, la razón es la misma acá. */
const EN_CURSO = new Set<EstadoServicio>(["solicitado", "presupuestado", "aceptado", "en_camino", "en_curso"]);

export default function PaginaInicio() {
  const router = useRouter();
  const { propiedad, indice, propiedades, equiposDe, sesion, cargando, error, recargar } = useApp();
  const [hojaAbierta, setHojaAbierta] = useState(false);

  /* Pedido en curso, arriba y grande — antes esto sólo se veía adentro
     de Historial. La idea (pedida explícitamente): que al entrar se
     vea de una si hay algo pasando ahora mismo, como el seguimiento de
     pedido de Rappi. Se pide acá y no en ContextoApp porque Historial
     ya hace exactamente este mismo fetch por su cuenta — mismo criterio
     de "no compartir entre pantallas distintas" documentado ahí. */
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [categorias, setCategorias] = useState<CategoriaBD[]>([]);
  const [seleccionado, setSeleccionado] = useState<Servicio | null>(null);

  useEffect(() => {
    if (!sesion) return;
    let vivo = true;
    Promise.all([listarServicios(), listarCategorias()])
      .then(([srv, cats]) => {
        if (!vivo) return;
        setServicios(srv);
        setCategorias(cats);
      })
      .catch(() => {
        /* No es crítico: el resto de Inicio sigue andando sin esto. */
      });
    return () => {
      vivo = false;
    };
  }, [sesion]);

  /* Campanita: bandeja de notificaciones + recordatorios de
     mantenimiento. Fetch aparte del de arriba a propósito — mismo
     criterio "no compartir entre pantallas" del resto del archivo, y
     además esto no bloquea nada si falla (la persona sigue viendo
     Inicio igual, sólo sin avisos). */
  const [notifAbierta, setNotifAbierta] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  useEffect(() => {
    if (!sesion) return;
    let vivo = true;
    listarNotificaciones()
      .then((n) => {
        if (vivo) setNotificaciones(n);
      })
      .catch(() => {
        /* Idem: no crítico. */
      });
    const cancelar = suscribirseANotificaciones(sesion.id, (n) => {
      setNotificaciones((prev) => [n, ...prev]);
    });
    return () => {
      vivo = false;
      cancelar();
    };
  }, [sesion]);

  const hayRecordatorios = recordatoriosDeMantenimiento(propiedades, equiposDe).length > 0;
  const hayAvisosSinLeer = notificaciones.some((n) => !n.leida) || hayRecordatorios;

  const marcarLeida = (id: string) => {
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    marcarNotificacionLeida(id).catch(() => {
      /* Optimista: si falla, la próxima carga la vuelve a mostrar sin leer. */
    });
  };

  const marcarTodas = () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    marcarTodasLeidas().catch(() => {});
  };

  const abrirServicioDeNotificacion = (servicioId: string) => {
    const s = servicios.find((x) => x.id === servicioId);
    if (s) setSeleccionado(s);
  };

  const enCurso = propiedad
    ? servicios.filter((s) => s.propiedadId === propiedad.id && EN_CURSO.has(s.estado))
    : [];
  const pedidoActivo = enCurso[0];
  const categoriaActiva = pedidoActivo
    ? categorias.find((c) => c.slug === pedidoActivo.categoriaSlug)
    : undefined;

  /* El "chat" para arrancar un pedido. No es un chat de verdad todavía
     (eso ya lo resuelve /pedir, paso a paso, con el mismo diagnóstico
     de Nora) — esto es la puerta de entrada: lo que la persona escribe
     acá viaja como texto inicial y aparece ya cargado en el paso
     "Contanos qué está pasando" de /pedir, para no hacerla escribir
     dos veces. */
  const [mensaje, setMensaje] = useState("");
  const enviarMensaje = (e: React.FormEvent) => {
    e.preventDefault();
    const texto = mensaje.trim();
    router.push(texto ? `/pedir?texto=${encodeURIComponent(texto)}` : "/pedir");
  };

  if (cargando) return <EsqueletoInicio />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;
  // Recién registrado: todavía no cargó ningún domicilio.
  if (!propiedad) return <PrimerDomicilio />;

  return (
    <main className="h-dvh overflow-y-auto no-scrollbar pb-28">
      <header className="px-5 pt-12 pb-2">
        <div className="flex items-center justify-between">
          <LogotipoNora />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("nora:abrir-ayuda"))}
              className="press w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
              aria-label="Más opciones — soporte"
            >
              <MoreHorizontal className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setNotifAbierta(true)}
              className="press relative w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
              aria-label={hayAvisosSinLeer ? "Notificaciones — hay novedades sin leer" : "Notificaciones"}
            >
              <Bell className="w-[18px] h-[18px]" />
              {hayAvisosSinLeer && (
                <span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-urgent ring-2 ring-surface"
                  aria-hidden="true"
                />
              )}
            </button>
            <Link href="/perfil" aria-label="Ir a mi perfil">
              <span className="w-10 h-10 grid place-items-center rounded-full bg-brand-600 text-white font-semibold text-[15px] ring-2 ring-white shadow-sm">
                {sesion?.inicial ?? ""}
              </span>
            </Link>
          </div>
        </div>

        <h1 className="mt-4 text-[23px] font-bold font-display text-ink leading-tight">
          {saludo()}{sesion ? `, ${sesion.nombre.split(" ")[0]}` : ""}
        </h1>
      </header>

      <div className="px-5 space-y-3.5">
        {/* --- Selector de domicilio --- */}
        <button
          type="button"
          onClick={() => setHojaAbierta(true)}
          className="press w-full flex items-center justify-between bg-surface border border-line rounded-2xl px-4 py-3 shadow-card"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 grid place-items-center rounded-xl bg-brand-50 text-brand-600">
              <IconoEquipo nombre={propiedad.icono} className="w-[18px] h-[18px]" />
            </span>
            <span className="text-left min-w-0">
              <span className="block text-[15px] font-semibold text-ink truncate">{propiedad.nombre}</span>
              <span className="block text-[12.5px] text-faint truncate">
                {propiedad.direccion} · {propiedad.localidad}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-medium text-faint">
              {indice + 1}/{propiedades.length}
            </span>
            <ChevronsUpDown className="w-[18px] h-[18px] text-faint" />
          </span>
        </button>

        {/* --- Pedido en curso: lo primero que hay que ver, si hay algo
            pasando ahora mismo --- */}
        {pedidoActivo && (
          <button
            type="button"
            onClick={() => setSeleccionado(pedidoActivo)}
            className="press relative overflow-hidden w-full flex items-center gap-3.5 text-left text-white rounded-xl3 shadow-hero p-4"
            style={{
              backgroundImage: "radial-gradient(120% 80% at 100% 0%, #14857A 0%, #0E5C54 38%, #0B3B38 100%)",
            }}
          >
            <div className="pointer-events-none absolute -top-10 -right-8 w-32 h-32 rounded-full bg-brand-400/20 blur-2xl" />
            <span className="relative shrink-0 w-12 h-12 grid place-items-center rounded-2xl bg-white/15">
              <IconoEquipo nombre={categoriaActiva?.icono ?? "wrench"} className="w-6 h-6" />
            </span>
            <div className="relative min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-white/15 rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
                {ETIQUETA_ESTADO[pedidoActivo.estado]}
              </span>
              <p className="text-[15.5px] font-bold font-display leading-tight mt-1.5 truncate">
                {categoriaActiva?.nombre ?? "Servicio"}
              </p>
            </div>
            {enCurso.length > 1 && (
              <span className="relative shrink-0 text-[11px] font-semibold text-brand-100 self-start mt-1">
                +{enCurso.length - 1}
              </span>
            )}
            <ChevronRight className="relative w-5 h-5 text-white/70 shrink-0" />
          </button>
        )}

        {/* --- El chat: puerta de entrada para pedir un servicio --- */}
        <section className="rounded-xl3 bg-surface border border-line shadow-card p-4">
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 w-8 h-8 grid place-items-center rounded-full bg-brand-600 text-white">
              <Sparkles className="w-[16px] h-[16px]" />
            </span>
            <p className="bg-sand border border-line rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13.5px] text-ink leading-snug">
              ¿Qué necesitás resolver hoy? Contame qué está pasando y me ocupo.
            </p>
          </div>

          <form onSubmit={enviarMensaje} className="mt-3 flex items-center gap-2">
            <label htmlFor="mensaje-inicio" className="sr-only">
              Contanos qué pasa
            </label>
            <input
              id="mensaje-inicio"
              type="text"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Ej: pierde agua la canilla de la cocina…"
              className="flex-1 rounded-full bg-sand border border-line px-4 py-3 text-[13.5px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
            />
            <button
              type="submit"
              className="press shrink-0 w-11 h-11 grid place-items-center rounded-full bg-brand-600 text-white shadow-fab disabled:opacity-50"
              aria-label="Enviar"
            >
              <Send className="w-[18px] h-[18px]" />
            </button>
          </form>
        </section>
      </div>

      <HojaPropiedades abierta={hojaAbierta} alCerrar={() => setHojaAbierta(false)} />
      <HojaNotificaciones
        abierto={notifAbierta}
        alCerrar={() => setNotifAbierta(false)}
        notificaciones={notificaciones}
        alMarcarLeida={marcarLeida}
        alMarcarTodas={marcarTodas}
        alAbrirServicio={abrirServicioDeNotificacion}
      />
      <HojaServicio
        servicio={seleccionado}
        categoria={seleccionado ? categorias.find((c) => c.slug === seleccionado.categoriaSlug) : undefined}
        abierto={!!seleccionado}
        alCerrar={() => setSeleccionado(null)}
      />
    </main>
  );
}
