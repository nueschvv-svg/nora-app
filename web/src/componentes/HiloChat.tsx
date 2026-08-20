"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase/cliente";

/* Chat genérico — hoy sólo lo usa la obra (dueño/colaboradores, vía
   lib/obraChat.ts). Recibe sus funciones por props en vez de tener la
   lógica hardcodeada: quién puede leer o escribir lo decide la base,
   acá sólo se pinta — así, si en el futuro hace falta otro chat
   (por ejemplo, cliente↔operaciones), se puede reusar sin tocar esto. */

type MensajeChat = {
  id: string;
  autorId: string;
  cuerpo: string;
  creadoEl: string;
};

export function HiloChat({
  idAncla,
  listar,
  enviar,
  suscribirse,
  nombreDeAutor,
}: {
  /** Sólo para que el <label htmlFor> del input sea único en la página. */
  idAncla: string;
  listar: () => Promise<MensajeChat[]>;
  enviar: (cuerpo: string) => Promise<void>;
  suscribirse: (alLlegarMensaje: (m: MensajeChat) => void) => () => void;
  /** Sólo hace falta cuando el chat puede tener más de dos personas
   *  (la obra, con dueño + colaboradores) — sin esto, un mensaje ajeno
   *  no dice de quién es. Un chat siempre entre las mismas dos
   *  personas no lo necesita. */
  nombreDeAutor?: (autorId: string) => string | undefined;
}) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [miId, setMiId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const {
        data: { user },
      } = await supabaseNavegador().auth.getUser();
      if (vivo) setMiId(user?.id ?? null);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    listar()
      .then((m) => {
        if (vivo) setMensajes(m);
      })
      .catch(() => {
        /* Sin historial el chat sigue funcionando para lo nuevo. */
      });

    const cancelar = suscribirse((m) => {
      setMensajes((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
    });

    return () => {
      vivo = false;
      cancelar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listar/suscribirse se recrean cada render en el padre; lo que importa para volver a suscribirse es idAncla
  }, [idAncla]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes]);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);
    setTexto("");
    try {
      await enviar(cuerpo);
    } catch {
      setTexto(cuerpo);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl2 bg-surface border border-line shadow-card overflow-hidden">
      <p className="text-[11px] font-bold tracking-wide uppercase text-faint px-4 pt-3">Chat</p>

      <div className="max-h-[260px] overflow-y-auto no-scrollbar px-4 py-2.5 space-y-2">
        {mensajes.length === 0 ? (
          <p className="text-[12.5px] text-faint py-2">Todavía no hay mensajes.</p>
        ) : (
          mensajes.map((m) => {
            const nombreAutor = m.autorId !== miId ? nombreDeAutor?.(m.autorId) : undefined;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${m.autorId === miId ? "items-end" : "items-start"}`}
              >
                {nombreAutor && (
                  <span className="text-[10.5px] font-semibold text-faint px-1 mb-0.5">{nombreAutor}</span>
                )}
                <p
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
                    m.autorId === miId
                      ? "bg-brand-600 text-white rounded-br-md"
                      : "bg-sand text-ink border border-line rounded-bl-md"
                  }`}
                >
                  {m.cuerpo}
                </p>
              </div>
            );
          })
        )}
        <div ref={finRef} />
      </div>

      <form onSubmit={alEnviar} className="flex items-center gap-2 px-3 py-2.5 border-t border-line">
        <label htmlFor={`chat-${idAncla}`} className="sr-only">
          Escribir un mensaje
        </label>
        <input
          id={`chat-${idAncla}`}
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribir un mensaje…"
          className="flex-1 rounded-full bg-sand border border-line px-4 py-2.5 text-[13.5px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="press shrink-0 w-9 h-9 grid place-items-center rounded-full bg-brand-600 text-white disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
