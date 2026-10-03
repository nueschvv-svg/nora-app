"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Volume2, VolumeX } from "lucide-react";
import { HeroLlaveCasa, contenedorScrolleable } from "./HeroLlaveCasa";
import type { ModoBienvenida } from "./useModoBienvenida";

/** Native sticky scroll: no portal, wheel interception or synthetic scroll. */
export function EscenaCinema({ modo, alTerminar }: { modo: ModoBienvenida; alTerminar: () => void }) {
  const driverRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sonido, setSonido] = useState(false);
  const terminado = useRef(false);
  const saludoIntentado = useRef(false);
  const [saliendo, setSaliendo] = useState(false);
  const reproducir = useCallback(() => {
    if (saludoIntentado.current) return;
    saludoIntentado.current = true;
    const audio = audioRef.current ?? new Audio('/audio/nora.mp3');
    audioRef.current = audio;
    audio.volume = 0.55;
    void audio.play().then(() => setSonido(true)).catch(() => {
      // Algunos navegadores no consideran wheel/scroll activación de usuario.
      saludoIntentado.current = false;
    });
  }, []);
  useEffect(() => {
    if (!saliendo) return;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 620;
    const timer = window.setTimeout(alTerminar, delay);
    return () => window.clearTimeout(timer);
  }, [saliendo, alTerminar]);
  useEffect(() => {
    const el = driverRef.current;
    const scroller = contenedorScrolleable(el);
    if (!el || !scroller) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const progress = Math.min(1, scroller.scrollTop / Math.max(1, el.offsetHeight - scroller.clientHeight));
      el.style.setProperty('--intro-progress', String(progress));
      if (scroller.scrollTop > 8) reproducir();
      if (progress >= 0.96 && !terminado.current) {
        terminado.current = true;
        setSaliendo(true);
      }
    };
    const update = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const touchEnd = () => { if (scroller.scrollTop > 8) reproducir(); };
    scroller.addEventListener('scroll', update, { passive:true });
    scroller.addEventListener('touchend', touchEnd, { passive:true });
    return () => { cancelAnimationFrame(frame); scroller.removeEventListener('scroll', update); scroller.removeEventListener('touchend', touchEnd); };
  }, [reproducir]);
  const saltar = () => {
    reproducir();
    if (terminado.current) return;
    terminado.current = true;
    setSaliendo(true);
  };
  return <section ref={driverRef} className="nora-intro" data-active="true" data-leaving={saliendo} data-reduced={modo === "reposo"} aria-label="Bienvenida a Nora">
    <div className="nora-intro-sticky">
      <button type="button" className="nora-intro-sound" aria-label={sonido ? "Silenciar saludo de Nora" : "Escuchar saludo de Nora"} onClick={() => {
        const audio = audioRef.current;
        if (!audio) { reproducir(); return; }
        if (sonido) { audio.pause(); setSonido(false); }
        else { audio.currentTime = 0; void audio.play().then(()=>setSonido(true)).catch(()=>setSonido(false)); }
      }}>{sonido ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
      <div className="nora-intro-grid">
        <div className="nora-intro-copy">
          <p className="nora-eyebrow">TU HOGAR, MEJOR ACOMPAÑADO</p>
          <h1>Las cosas<br/>de casa.<br/><em>Resueltas.</em></h1>
          <p className="nora-intro-description">Contanos qué pasa. Coordiná tu servicio y seguí cada paso, en un solo lugar.</p>

        </div>
        <HeroLlaveCasa />
      </div>
      <div className="nora-intro-footer"><span>NORA · SERVICIOS PARA TU HOGAR</span><button onClick={saltar}>Deslizá para empezar <ArrowDown size={16} aria-hidden="true" /></button><span className="hidden sm:block">CERCA, EN CADA DETALLE.</span></div>
      <div className="nora-intro-progress" aria-hidden="true" />
    </div>
  </section>;
}
