"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, Volume2, VolumeX } from "lucide-react";
import { HeroLlaveCasa, contenedorScrolleable } from "./HeroLlaveCasa";
import type { ModoBienvenida } from "./useModoBienvenida";

/** Native sticky scroll: no portal, wheel interception or synthetic scroll. */
export function EscenaCinema({ modo }: { modo: ModoBienvenida }) {
  const driverRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sonido, setSonido] = useState(false);
  useEffect(() => {
    if (modo !== "cinema") return;
    const audio = new Audio('/audio/nora.mp3');
    audio.volume = 0.55;
    audioRef.current = audio;
    let played = false;
    let disposed = false;
    const play = () => {
      if (played || disposed) return;
      void audio.play().then(() => { played = true; if (!disposed) setSonido(true); }).catch(() => {});
    };
    play();
    window.addEventListener('pointerdown', play, {once:true});
    window.addEventListener('keydown', play, {once:true});
    return () => { disposed = true; audio.pause(); audioRef.current = null; window.removeEventListener('pointerdown', play); window.removeEventListener('keydown', play); };
  }, [modo]);
  useEffect(() => {
    const el = driverRef.current;
    if (!el || modo !== "cinema") return;
    const scroller = contenedorScrolleable(el);
    if (!scroller) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      const progress = Math.min(1, Math.max(0, -top / Math.max(1, el.offsetHeight - scroller.clientHeight)));
      el.style.setProperty("--intro-progress", String(progress));
      const exit = Math.min(1, Math.max(0, (progress - 0.65) / 0.35));
      el.style.setProperty("--intro-exit", String(exit));
      el.dataset.active = String(top + el.offsetHeight > 120);
    };
    const update = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); scroller.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [modo]);
  if (modo === "oculto" || modo === "cargando") return null;
  if (modo === "reposo") return <section className="nora-intro-static"><p className="nora-eyebrow">Bienvenido a Nora</p><h1>Tu casa, en buenas manos.</h1></section>;
  const saltar = () => {
    const el = driverRef.current;
    const scroller = contenedorScrolleable(el);
    if (!el || !scroller) return;
    const next = el.nextElementSibling as HTMLElement | null;
    if (!next) return;
    scroller.scrollTo({top: next.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    next.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});
  };
  return <section ref={driverRef} className="nora-intro" data-active="true" aria-label="Bienvenida a Nora">
    <div className="nora-intro-sticky">
      <button type="button" className="nora-intro-sound" aria-label={sonido ? "Silenciar saludo de Nora" : "Escuchar saludo de Nora"} onClick={() => {
        const audio = audioRef.current;
        if (!audio) return;
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
