"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Send, Sparkles } from "lucide-react";
import { chatearConNora, type TurnoChat } from "@/lib/chatCliente";
import { IsotipoNora } from "@/componentes/LogoNora";

type Mensaje = { rol: "cliente" | "nora"; texto: string };

/* El chat de verdad: Nora saluda, charla para entender el problema con
   un par de preguntas cortas (ver lib/chatNora.ts para las reglas), y
   cuando ya identificó el rubro muestra un botón — "Solicitar servicio"
   — que lleva al flujo de pedir de siempre (/pedir), con el rubro y el
   resumen ya cargados. El saludo inicial es fijo y local (no gasta un
   solo token): no hace falta llamar al modelo sólo para decir "hola". */
export function ChatNora() {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<Mensaje[]>(() => [
    {
      rol: "nora",
      texto: "¡Hola! Soy Nora 👋 Contame qué está pasando en tu casa y vemos cómo te ayudo.",
    },
  ]);
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{ categoriaSlug: string; resumen: string } | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  /* scrollTo() sobre el propio contenedor de mensajes, no
     scrollIntoView() sobre un div sentinela al final: scrollIntoView
     mueve TODOS los ancestros con scroll que hagan falta para que el
     elemento quede a la vista, y acá arriba (ver PaginaInicio) main
     también scrollea — así que cada mensaje nuevo empujaba la página
     entera hacia abajo, tapando la barra superior. Moviendo el scroll
     directo del contenedor interno, main nunca se entera. */
  useEffect(() => {
    const el = listaRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [mensajes, enviando]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = entrada.trim();
    if (!texto || enviando) return;

    const nuevos: Mensaje[] = [...mensajes, { rol: "cliente", texto }];
    setMensajes(nuevos);
    setEntrada("");
    setError(null);
    setEnviando(true);

    try {
      // El saludo inicial es local, nunca se lo mandamos al modelo.
      const historial: TurnoChat[] = nuevos.slice(1).map((m) => ({ rol: m.rol, texto: m.texto }));
      const resultado = await chatearConNora(historial);
      setMensajes((prev) => [...prev, { rol: "nora", texto: resultado.respuesta }]);
      if (resultado.listo && resultado.categoriaSlug) {
        setListo({ categoriaSlug: resultado.categoriaSlug, resumen: resultado.resumen });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos responder ahora.");
    } finally {
      setEnviando(false);
    }
  };

  const solicitarServicio = () => {
    if (!listo) return;
    const params = new URLSearchParams();
    if (listo.resumen) params.set("texto", listo.resumen);
    params.set("categoria", listo.categoriaSlug);
    router.push(`/pedir?${params.toString()}`);
  };

  return (
    <section className="glass rounded-xl3 p-4">
      {/* Encabezado de marca: sin esto el chat es una lista de globos
          sin firma — con el isotipo real y "en línea" (el mismo
          .live-dot que ya usa el resto de la app para estados en
          vivo) se lee como un producto de verdad, no un widget
          genérico pegado a la pantalla. */}
      <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-line/60">
        <span className="shrink-0 w-9 h-9 grid place-items-center rounded-full bg-brand-600">
          <IsotipoNora className="w-5 h-5" variante="oscuro" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold font-display text-ink leading-tight">Nora</p>
          <p className="flex items-center gap-1.5 text-[11px] text-mute">
            <span className="live-dot w-[6px] h-[6px] rounded-full bg-good" aria-hidden="true" />
            En línea
          </p>
        </div>
      </div>

      <div ref={listaRef} className="space-y-3 max-h-[360px] overflow-y-auto no-scrollbar pr-0.5">
        {mensajes.map((m, i) => (
          <div
            key={i}
            className={`burbuja-chat flex items-start gap-2.5 ${m.rol === "cliente" ? "flex-row-reverse" : ""}`}
          >
            {m.rol === "nora" && (
              <span className="shrink-0 w-8 h-8 grid place-items-center rounded-full bg-brand-600 text-white shadow-card">
                <Sparkles className="w-[16px] h-[16px]" />
              </span>
            )}
            <p
              className={`max-w-[80%] px-3.5 py-2.5 text-[13.5px] leading-snug whitespace-pre-line shadow-card ${
                m.rol === "nora"
                  ? "bg-sand border border-line rounded-2xl rounded-tl-md text-ink"
                  : "bg-brand-600 text-white rounded-2xl rounded-tr-md"
              }`}
            >
              {m.texto}
            </p>
          </div>
        ))}

        {enviando && (
          <div className="indicador-escribiendo flex items-start gap-2.5">
            <span className="shrink-0 w-8 h-8 grid place-items-center rounded-full bg-brand-600 text-white shadow-card">
              <Sparkles className="w-[16px] h-[16px]" />
            </span>
            <p className="flex items-center gap-1 bg-sand border border-line rounded-2xl rounded-tl-md px-4 py-3.5 text-mute shadow-card">
              <span className="punto-escribiendo" />
              <span className="punto-escribiendo" />
              <span className="punto-escribiendo" />
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-[12.5px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-2.5">
            {error}
          </p>
        )}
      </div>

      {listo ? (
        <button
          type="button"
          onClick={solicitarServicio}
          className="cta-chat press mt-3 w-full flex items-center justify-center gap-2 rounded-full bg-brand-600 text-white px-5 py-3 text-[14px] font-semibold shadow-fab"
        >
          Solicitar servicio
          <ArrowRight className="w-[17px] h-[17px]" />
        </button>
      ) : (
        <form onSubmit={enviar} className="mt-3 flex items-center gap-2">
          <label htmlFor="mensaje-nora" className="sr-only">
            Escribile a Nora
          </label>
          <input
            id="mensaje-nora"
            type="text"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder="Ej: pierde agua la canilla de la cocina…"
            disabled={enviando}
            className="flex-1 rounded-full bg-sand border border-line px-4 py-3 text-[13.5px] text-ink placeholder:text-faint outline-none focus:border-brand-300 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!entrada.trim() || enviando}
            className="press shrink-0 w-11 h-11 grid place-items-center rounded-full bg-brand-600 text-white shadow-fab disabled:opacity-50"
            aria-label="Enviar"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </form>
      )}
    </section>
  );
}
