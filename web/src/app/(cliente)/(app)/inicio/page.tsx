"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

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
import { type Servicio } from "@/lib/tipos";
import { saludo } from "@/lib/formato";

export default function PaginaInicio() {
  const { propiedades, equiposDe, sesion, cargando, error, recargar } = useApp();

  /* Sin banner de "pedido en curso" en Inicio — la persona ya vio el
     resumen completo en la pantalla de confirmación apenas mandó el
     pedido (número de orden, horario, domicilio). El estado se sigue
     viendo si llega una notificación de novedades (ver campanita más
     abajo), que abre el mismo HojaServicio. */
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
