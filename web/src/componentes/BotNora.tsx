"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, MessageCircle, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { linkWhatsapp, MENU_ASISTENTE, type NodoCategoria, type NodoRespuesta } from "@/lib/faq";

/* Bot Nora — asistente guiado por botones, sin IA generativa.

   A propósito no hay campo de texto: el usuario navega por un árbol de
   opciones fijo (ver lib/faq.ts) y siempre termina en una respuesta ya
   escrita. Cero variabilidad, cero costo por mensaje. Si no resuelve la
   duda, el único escape es un link real a WhatsApp — no se inventa
   nada ni se simula una derivación que no existe.

   Sin burbuja flotante propia a propósito: con Inicio rediseñado
   alrededor del chat para PEDIR un servicio, una segunda burbuja
   siempre visible para soporte competía por el mismo espacio visual.
   Este panel se sigue abriendo igual, disparando el evento
   "nora:abrir-ayuda" — desde el botón "···" de NavSuperior o desde
   Perfil.

   Recuadro anclado arriba a la derecha (no hoja de pantalla completa
   desde abajo): esto es soporte puntual de preguntas frecuentes, no un
   flujo que merezca tapar toda la pantalla — se abre y cierra ahí
   mismo, cerca de donde está el botón que lo dispara. */

type Mensaje = {
  id: string;
  autor: "nora" | "usuario";
  texto: string;
};

/** Qué botones mostrar después del último mensaje de Nora. */
type Opciones =
  | { tipo: "menu" }
  | { tipo: "categoria"; categoria: NodoCategoria }
  | { tipo: "postRespuesta"; categoria: NodoCategoria }
  | { tipo: "cierre" }
  | { tipo: "escalado" };

const SALUDO = "¡Hola! Soy Nora 👋 ¿En qué necesitás ayuda?";

function AvatarNora({ tamano = "w-8 h-8" }: { tamano?: string }) {
  return (
    <span
      className={`${tamano} shrink-0 grid place-items-center rounded-full bg-brand-600 text-white`}
      aria-hidden="true"
    >
      <Sparkles className="w-[55%] h-[55%]" />
    </span>
  );
}

export function BotNora() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([{ id: "saludo", autor: "nora", texto: SALUDO }]);
  const [opciones, setOpciones] = useState<Opciones>({ tipo: "menu" });
  const finRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const proximoId = (prefijo: string) => `${prefijo}-${++idRef.current}`;

  useEffect(() => {
    if (!abierto) return;
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes, abierto]);

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto]);

  /* Sin backdrop que oscurezca el resto de la pantalla (es un recuadro
     chico, no una hoja modal) — así que el cierre al tocar afuera hay
     que armarlo a mano. Si el clic cae justo sobre el botón "···" que
     lo abre, este handler lo cierra y el propio onClick del botón lo
     vuelve a abrir en el mismo gesto — parpadeo imperceptible, no vale
     la complejidad de coordinar los dos componentes para evitarlo. */
  useEffect(() => {
    if (!abierto) return;
    const alTocarAfuera = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", alTocarAfuera);
    return () => document.removeEventListener("pointerdown", alTocarAfuera);
  }, [abierto]);

  /* El botón "Ayuda" de Perfil dispara este evento en vez de recibir un
     prop: BotNora ya vive montado una sola vez en (app)/layout.tsx, y
     abrirlo así evita tener que pasar setAbierto por todo el árbol de
     componentes sólo para este único caso de uso. */
  useEffect(() => {
    const abrir = () => setAbierto(true);
    window.addEventListener("nora:abrir-ayuda", abrir);
    return () => window.removeEventListener("nora:abrir-ayuda", abrir);
  }, []);

  function agregar(autor: Mensaje["autor"], texto: string) {
    setMensajes((prev) => [...prev, { id: proximoId(autor), autor, texto }]);
  }

  function irAlMenu() {
    agregar("nora", "¿Algo más en lo que te pueda ayudar?");
    setOpciones({ tipo: "menu" });
  }

  function elegirCategoria(categoria: NodoCategoria) {
    agregar("usuario", categoria.etiqueta);
    agregar("nora", `${categoria.etiqueta} — elegí tu duda:`);
    setOpciones({ tipo: "categoria", categoria });
  }

  function elegirRespuesta(categoria: NodoCategoria, respuesta: NodoRespuesta) {
    agregar("usuario", respuesta.etiqueta);
    agregar("nora", respuesta.texto);
    setOpciones({ tipo: "postRespuesta", categoria });
  }

  function volverACategoria(categoria: NodoCategoria) {
    agregar("nora", `${categoria.etiqueta} — elegí tu duda:`);
    setOpciones({ tipo: "categoria", categoria });
  }

  function resolverSi() {
    agregar("usuario", "Sí, gracias");
    agregar("nora", "¡Genial! Cualquier otra duda, acá estoy.");
    setOpciones({ tipo: "cierre" });
  }

  function resolverNo() {
    agregar("usuario", "No, todavía tengo dudas");
    agregar("nora", "Sin problema, te paso con una persona del equipo por WhatsApp.");
    setOpciones({ tipo: "escalado" });
  }

  return (
    <>
      {/* Panel de chat — recuadro anclado arriba a la derecha, cerca
          del botón "···" de NavSuperior (h-16 = 4rem) que lo abre. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Asistente Nora"
        className={`absolute right-3 top-[4.75rem] z-50 w-[min(340px,calc(100vw-1.5rem))] max-h-[70vh] bg-surface rounded-xl2 border border-line shadow-sheet flex flex-col overflow-hidden transition-all duration-200 ease-[cubic-bezier(.22,1,.36,1)] origin-top-right ${
          abierto ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
        }`}
      >
        {/* Encabezado */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line shrink-0">
          <AvatarNora />
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-bold font-display text-ink leading-tight">Nora</p>
            <p className="text-[11px] text-faint">Asistente · preguntas frecuentes</p>
          </div>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="press w-8 h-8 grid place-items-center rounded-full bg-sand border border-line text-ink"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-2.5">
          {mensajes.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.autor === "usuario" ? "justify-end" : "justify-start"}`}>
              {m.autor === "nora" && <AvatarNora tamano="w-6 h-6" />}
              <p
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug ${
                  m.autor === "usuario"
                    ? "bg-brand-600 text-white rounded-br-md"
                    : "bg-sand text-ink border border-line rounded-bl-md"
                }`}
              >
                {m.texto}
              </p>
            </div>
          ))}

          {/* Opciones vigentes: siempre atadas al último mensaje de Nora. */}
          <div className="pl-8 flex flex-col gap-1.5 pt-1">
            {opciones.tipo === "menu" &&
              MENU_ASISTENTE.map((cat) => (
                <BotonFila key={cat.id} onClick={() => elegirCategoria(cat)}>
                  {cat.etiqueta}
                </BotonFila>
              ))}

            {opciones.tipo === "categoria" && (
              <>
                {opciones.categoria.hijos.map((resp) => (
                  <BotonFila key={resp.id} onClick={() => elegirRespuesta(opciones.categoria, resp)}>
                    {resp.etiqueta}
                  </BotonFila>
                ))}
                <BotonVolver onClick={irAlMenu} texto="← Volver al menú" />
              </>
            )}

            {opciones.tipo === "postRespuesta" && (
              <>
                <p className="text-[12px] text-faint px-1">¿Pudiste resolver tu duda?</p>
                <div className="flex gap-2">
                  <BotonChico onClick={resolverSi} icono={<ThumbsUp className="w-3.5 h-3.5" />}>
                    Sí
                  </BotonChico>
                  <BotonChico onClick={resolverNo} icono={<ThumbsDown className="w-3.5 h-3.5" />}>
                    No
                  </BotonChico>
                </div>
                <BotonVolver
                  onClick={() => volverACategoria(opciones.categoria)}
                  texto={`← Volver a ${opciones.categoria.etiqueta}`}
                />
              </>
            )}

            {opciones.tipo === "cierre" && <BotonVolver onClick={irAlMenu} texto="Volver al menú" />}

            {opciones.tipo === "escalado" && (
              <>
                <a
                  href={linkWhatsapp("Hola! Necesito ayuda con la app Nora.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press w-full flex items-center justify-center gap-2 rounded-xl2 bg-[#25D366] text-white py-3 text-[13.5px] font-semibold shadow-card"
                >
                  <MessageCircle className="w-4 h-4" /> Escribir por WhatsApp
                </a>
                <BotonVolver onClick={irAlMenu} texto="Volver al menú" />
              </>
            )}
          </div>

          <div ref={finRef} />
        </div>
      </div>
    </>
  );
}

function BotonFila({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press w-full flex items-center justify-between gap-2 rounded-xl2 bg-sand border border-line px-3.5 py-2.5 text-[13.5px] font-medium text-ink text-left"
    >
      {children}
      <ChevronRight className="w-4 h-4 text-faint shrink-0" />
    </button>
  );
}

function BotonChico({
  children,
  onClick,
  icono,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icono: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex-1 flex items-center justify-center gap-1.5 rounded-xl2 bg-brand-50 border border-brand-100 py-2.5 text-[13px] font-semibold text-brand-600"
    >
      {icono}
      {children}
    </button>
  );
}

function BotonVolver({ onClick, texto }: { onClick: () => void; texto: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press w-full text-center text-[12.5px] text-mute underline underline-offset-2 py-1.5"
    >
      {texto}
    </button>
  );
}
