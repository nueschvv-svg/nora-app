"use client";
import { IsotipoNora } from "@/componentes/LogoNora";

export function contenedorScrolleable(el: HTMLElement | null): HTMLElement | null {
  let nodo = el?.parentElement ?? null;
  while (nodo) {
    if (/(auto|scroll)/.test(getComputedStyle(nodo).overflowY)) return nodo;
    nodo = nodo.parentElement;
  }
  return null;
}

/** Brand sculpture, not a fictitious order or an advertisement for inactive services. */
export function HeroLlaveCasa() {
  return <div className="nora-hero-art" aria-hidden="true">
    <div className="nora-hero-orbit" />
    <div className="nora-hero-plaque">
      <div className="nora-hero-plaque-top"><span>EL CUIDADO EMPIEZA EN CASA</span></div>
      <div className="nora-hero-door"><IsotipoNora className="nora-hero-mark" variante="oscuro" /></div>
      <div className="nora-hero-signature">nora<span>.</span></div>
      <div className="nora-hero-plaque-bottom"><span>Tu hogar.<br/>Nuestro cuidado.</span><span className="nora-hero-seal">ENJINIA</span></div>
    </div>

  </div>;
}
