"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { supabaseNavegador } from "@/lib/supabase/cliente";

/* Elegir una contraseña nueva.

   Se llega desde el link del mail de recuperación: /auth/confirm ya
   canjeó el token por una sesión, así que acá sólo falta guardar la
   contraseña nueva. Si alguien entra sin sesión, el middleware lo
   manda al login antes de que esta pantalla se dibuje. */
export default function PaginaCambiarClave() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const corta = clave.length > 0 && clave.length < 8;
  const noCoinciden = repetida.length > 0 && clave !== repetida;
  const valido = clave.length >= 8 && clave === repetida;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || cargando) return;
    setCargando(true);
    setError(null);

    const { error } = await supabaseNavegador().auth.updateUser({ password: clave });

    if (error) {
      setError(
        error.message.toLowerCase().includes("same")
          ? "Esa es la contraseña que ya tenías. Elegí una distinta."
          : "No pudimos guardar la contraseña. Probá de nuevo.",
      );
      setCargando(false);
      return;
    }

    router.push("/inicio");
    router.refresh();
  }

  return (
    <div className="relative w-full max-w-[440px] mx-auto min-h-dvh bg-sand overflow-y-auto no-scrollbar">
      <div className="px-6 pt-16 pb-10">
        <div className="flex flex-col items-center text-center">
          <span className="grid place-items-center w-16 h-16 rounded-2xl bg-brand-50 text-brand-600">
            <KeyRound className="w-7 h-7" />
          </span>
          <h1 className="text-[24px] font-bold font-display text-ink mt-4">Elegí una nueva</h1>
          <p className="text-[13.5px] text-mute mt-1.5 max-w-[280px]">
            Poné la contraseña que vas a usar de ahora en adelante.
          </p>
        </div>

        <form onSubmit={guardar} className="mt-7 space-y-3" noValidate>
          <div>
            <label
              htmlFor="clave"
              className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
            >
              Contraseña nueva
            </label>
            <div className="relative">
              <input
                id="clave"
                type={ver ? "text" : "password"}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-2xl bg-surface border border-line shadow-card pl-4 pr-12 py-3.5 text-[14px] text-ink outline-none focus:border-brand-300"
              />
              <button
                type="button"
                onClick={() => setVer(!ver)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-faint"
                aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {ver ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            <p className={`text-[12px] mt-1 px-1 ${corta ? "text-urgent" : "text-faint"}`}>
              Mínimo 8 caracteres
            </p>
          </div>

          <div>
            <label
              htmlFor="repetida"
              className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
            >
              Repetila
            </label>
            <input
              id="repetida"
              type={ver ? "text" : "password"}
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              autoComplete="new-password"
              aria-invalid={noCoinciden}
              className={`w-full rounded-2xl bg-surface border shadow-card px-4 py-3.5 text-[14px] text-ink outline-none ${
                noCoinciden ? "border-urgent" : "border-line focus:border-brand-300"
              }`}
            />
            {noCoinciden && (
              <p role="alert" className="text-[12px] text-urgent mt-1 px-1">
                Las dos contraseñas no coinciden
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!valido || cargando}
            className="press w-full flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab disabled:opacity-40 disabled:pointer-events-none"
          >
            {cargando && <Loader2 className="w-[18px] h-[18px] animate-spin" />}
            Guardar y entrar
          </button>
        </form>
      </div>
    </div>
  );
}
