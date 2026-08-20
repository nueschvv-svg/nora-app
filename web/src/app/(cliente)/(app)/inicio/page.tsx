"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";

import { IconoEquipo } from "@/componentes/IconoEquipo";
import { ChatNora } from "@/componentes/ChatNora";
import { HojaServicio } from "@/componentes/HojaServicio";
import { HojaNotificaciones } from "@/componentes/HojaNotificaciones";
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

/* Estados en los que el pedido todavía está en curso. */
const EN_CURSO = new Set<EstadoServicio>(["solicitado", "presupuestado", "aceptado", "en_camino", "en_curso"]);

export default function PaginaInicio() {
  const { propiedad, propiedades, equiposDe, sesion, cargando, error, recargar } = useApp();

  /* Pedido en curso, arriba y grande: que al entrar se vea de una si
     hay algo pasando ahora mismo, como el seguimiento de pedido de
     Rappi. Se pide acá (no en ContextoApp) porque sólo Inicio lo
     necesita — no tiene sentido cargarlo en todas las pantallas. */
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

  if (cargando) return <EsqueletoInicio />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;

  return (
    <main className="h-full overflow-y-auto no-scrollbar pb-8">
      <header className="px-5 pt-6 pb-2 flex items-center justify-between gap-3">
        <h1 className="text-[23px] font-bold font-display text-ink leading-tight">
          {saludo()}{sesion ? `, ${sesion.nombre.split(" ")[0]}` : ""}
        </h1>
        <button
          type="button"
          onClick={() => setNotifAbierta(true)}
          className="press relative w-10 h-10 shrink-0 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
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
      </header>

      <div className="px-5 space-y-3.5">
        {/* --- Pedido en curso: lo primero que hay que ver, si hay algo
            pasando ahora mismo --- */}
        {pedidoActivo && (
          <button
            type="button"
            onClick={() => setSeleccionado(pedidoActivo)}
            className="entra-suave press relative overflow-hidden w-full flex items-center gap-3.5 text-left text-white rounded-xl3 shadow-hero p-4"
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
        <ChatNora nombre={sesion?.nombre?.split(" ")[0]} />
      </div>

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
