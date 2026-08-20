"use client";

import { useEffect, useState } from "react";
import { IsotipoNora } from "@/componentes/LogoNora";

const CLAVE_SESION = "nora:splash-visto";
const DURACION_MS = 1900;

/* Sonidito de bienvenida sintetizado con Web Audio — dos notas cortas
   y ascendentes, sin ningún archivo que descargar ni alojar. Los
   navegadores bloquean audio que no venga de un gesto del usuario:
   como esta pantalla aparece justo después de entrar (un click o un
   submit de formulario), casi siempre "cuenta" como gesto reciente,
   pero si el navegador igual lo bloquea, fallamos en silencio — la
   pantalla visual no depende del sonido para funcionar. */
function reproducirSonido() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const ahora = ctx.currentTime;

    [523.25, 783.99].forEach((frecuencia, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frecuencia;
      const inicio = ahora + i * 0.11;
      gain.gain.setValueAtTime(0, inicio);
      gain.gain.linearRampToValueAtTime(0.12, inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.4);
    });

    setTimeout(() => ctx.close(), 900);
  } catch {
    /* Sin Web Audio, o bloqueado por el navegador: no pasa nada. */
  }
}

/* Pantalla de bienvenida — aparece una vez por sesión de navegador (no
   en cada navegación entre Inicio/Historial/Perfil, sólo la primera
   vez que se entra a la app en esta pestaña). Usa sessionStorage y no
   localStorage a propósito: cada sesión nueva (login, pestaña nueva)
   vuelve a mostrarla. */
export function SplashBienvenida({ nombre }: { nombre?: string }) {
  const [visible, setVisible] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(CLAVE_SESION)) return;
    window.sessionStorage.setItem(CLAVE_SESION, "1");

    /* setVisible(true) va en un microtask, no directo en el cuerpo del
       efecto: mismo motivo que en otras pantallas de esta app (ver
       HojaServicio) — arrancar en `false` tanto en el servidor como en
       el primer render del cliente evita un mismatch de hidratación,
       y de paso conforma la regla de lint que evita setState síncrono
       dentro de un efecto. El retraso es imperceptible (un microtask
       resuelve antes que cualquier timeout, incluso de 0ms). */
    let cancelado = false;
    Promise.resolve().then(() => {
      if (cancelado) return;
      setVisible(true);
      reproducirSonido();
    });

    const salir = setTimeout(() => setSaliendo(true), DURACION_MS);
    const ocultar = setTimeout(() => setVisible(false), DURACION_MS + 400);
    return () => {
      cancelado = true;
      clearTimeout(salir);
      clearTimeout(ocultar);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label={`Bienvenido${nombre ? `, ${nombre}` : ""}`}
      className={`absolute inset-0 z-[100] grid place-items-center text-center px-8 transition-opacity duration-[400ms] ${
        saliendo ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        backgroundImage: "radial-gradient(120% 80% at 50% 0%, #14857A 0%, #0E5C54 45%, #0B3B38 100%)",
      }}
    >
      <div className={`transition-all duration-500 ${saliendo ? "scale-95" : "scale-100"}`}>
        <div className="mx-auto w-16 h-16 grid place-items-center rounded-2xl bg-white/15">
          <IsotipoNora className="h-9 w-auto" variante="oscuro" />
        </div>
        <h1 className="mt-5 text-[28px] font-bold font-display text-white leading-tight">
          Hola de nuevo{nombre ? `, ${nombre}` : ""}
        </h1>
      </div>
    </div>
  );
}
