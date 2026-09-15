"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";

import { IsotipoNora } from "@/componentes/LogoNora";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { destinoInterno } from "@/lib/destinoInterno";

/* Registro e ingreso.

   Cualquiera puede crear su cuenta solo: no hay que darle de alta a nadie.
   Quien se registra queda siempre como CLIENTE — el rol no sale de nada que
   mande el navegador, lo fija el disparador de la base de datos. */

type Modo = "entrar" | "registrarse" | "recuperar";

export default function PaginaEntrar() {
  return (
    <Suspense fallback={null}>
      <Formulario />
    </Suspense>
  );
}

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const volverA = destinoInterno(params.get("volver"));

  const [modo, setModo] = useState<Modo>("entrar");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") ? traducirParametro(params.get("error")!) : null,
  );
  const [revisarMail, setRevisarMail] = useState(false);
  const [mailRecuperacion, setMailRecuperacion] = useState(false);

  /* Si tocás "Continuar con Google" y volvés atrás con el botón del
     navegador antes de terminar (te arrepentiste, cerraste la pestaña
     de Google, lo que sea), el navegador no recarga esta página de
     cero: la restaura tal cual estaba, con `cargando` todavía en true
     — porque ese estado sólo se apaga si Google devuelve un error, y
     acá no llegó a pasar nada. El resultado es un botón "cargando"
     para siempre, sin ningún pedido de verdad en curso. El evento
     `pageshow` con `persisted` es la señal de que la página volvió
     así (bfcache), no de una carga nueva. */
  useEffect(() => {
    const alRestaurar = (e: PageTransitionEvent) => {
      if (e.persisted) setCargando(false);
    };
    window.addEventListener("pageshow", alRestaurar);
    return () => window.removeEventListener("pageshow", alRestaurar);
  }, []);

  const registrando = modo === "registrarse";
  const recuperando = modo === "recuperar";
  const claveCorta = clave.length > 0 && clave.length < 8;
  const valido = recuperando
    ? email.includes("@")
    : email.includes("@") && clave.length >= 8 && (!registrando || nombre.trim().length >= 2);

  async function entrarConGoogle() {
    setCargando(true);
    setError(null);
    const supabase = supabaseNavegador();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(volverA)}`,
      },
    });
    // Si signInWithOAuth arranca bien, el navegador ya está yéndose a
    // Google — este error sólo salta si ni siquiera pudo iniciar el viaje
    // (por ejemplo, Google no está habilitado del lado de Supabase).
    if (error) {
      setError("No pudimos abrir el ingreso con Google. Probá de nuevo en un momento.");
      setCargando(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || cargando) return;
    setCargando(true);
    setError(null);

    const supabase = supabaseNavegador();

    if (recuperando) {
      /* Mandamos el link de recuperación. Siempre mostramos el mismo
         mensaje, exista o no la cuenta: si dijéramos "ese mail no está
         registrado", cualquiera podría averiguar quién tiene cuenta. */
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
      });
      setMailRecuperacion(true);
      setCargando(false);
      return;
    }

    if (registrando) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: clave,
        options: {
          // Este nombre lo lee el disparador para armar el perfil.
          // Ojo: acá NO va el rol. Lo pone la base, no el navegador.
          data: { nombre: nombre.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (error) {
        setError(traducirError(error.message));
        setCargando(false);
        return;
      }

      // Si Supabase pide confirmar el mail, todavía no hay sesión.
      if (!data.session) {
        setRevisarMail(true);
        setCargando(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: clave,
      });
      if (error) {
        setError(traducirError(error.message));
        setCargando(false);
        return;
      }
    }

    // refresh() para que el servidor vuelva a leer la sesión recién creada.
    router.push(volverA);
    router.refresh();
  }

  if (revisarMail || mailRecuperacion) {
    return (
      <Marco>
        <div className="entra-suave text-center">
          <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-brand-50 text-brand-600">
            <MailCheck className="w-7 h-7" />
          </span>
          <h1 className="text-[22px] font-bold font-display text-ink mt-4">Revisá tu mail</h1>
          <p className="text-[14px] text-mute mt-2 leading-relaxed">
            {mailRecuperacion ? (
              <>
                Si hay una cuenta con <span className="font-semibold text-ink">{email}</span>, te
                llega un link para elegir una contraseña nueva.
              </>
            ) : (
              <>
                Te mandamos un link a <span className="font-semibold text-ink">{email}</span>. Tocalo
                para confirmar tu cuenta y ya podés entrar.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              setRevisarMail(false);
              setMailRecuperacion(false);
              setModo("entrar");
              setClave("");
            }}
            className="press mt-6 w-full rounded-xl2 border border-line bg-surface py-3.5 text-[14.5px] font-semibold text-ink shadow-card"
          >
            Volver
          </button>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <div className="entra-suave flex flex-col items-center text-center">
        <IsotipoNora className="h-14 w-auto" />
        <h1 className="text-[24px] font-bold font-display text-ink mt-3">
          {recuperando ? "Recuperar acceso" : registrando ? "Creá tu cuenta" : "Hola de nuevo"}
        </h1>
        <p className="text-[13.5px] text-mute mt-1.5 max-w-[280px]">
          {recuperando
            ? "Poné tu email y te mandamos un link para elegir una contraseña nueva."
            : registrando
              ? "Tu casa, sus equipos y sus mantenimientos, en un solo lugar."
              : "Entrá para ver el estado de tus propiedades."}
        </p>
      </div>

      <form onSubmit={enviar} className="mt-7 space-y-3" noValidate>
        {registrando && (
          <Campo
            id="nombre"
            etiqueta="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
            placeholder="Mati Valdivia"
          />
        )}

        <Campo
          id="email"
          etiqueta="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="vos@ejemplo.com"
        />

        <div className={recuperando ? "hidden" : ""}>
          <label
            htmlFor="clave"
            className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
          >
            Contraseña
          </label>
          <div className="relative">
            <input
              id="clave"
              type={verClave ? "text" : "password"}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete={registrando ? "new-password" : "current-password"}
              aria-describedby="clave-ayuda"
              className="w-full rounded-2xl bg-surface border border-line shadow-card pl-4 pr-12 py-3.5 text-[14px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
            />
            <button
              type="button"
              onClick={() => setVerClave(!verClave)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-faint"
              aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {verClave ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
            </button>
          </div>
          <p
            id="clave-ayuda"
            className={`text-[12px] mt-1 px-1 ${claveCorta ? "text-urgent" : "text-faint"}`}
          >
            {registrando ? "Mínimo 8 caracteres" : claveCorta ? "Mínimo 8 caracteres" : " "}
          </p>
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
          {recuperando ? "Mandame el link" : registrando ? "Crear mi cuenta" : "Entrar"}
        </button>
      </form>

      {!recuperando && (
        <>
          <div className="flex items-center gap-3 mt-5">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-faint">o</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={entrarConGoogle}
            disabled={cargando}
            className="press mt-4 w-full flex items-center justify-center gap-2.5 rounded-xl2 bg-surface border border-line shadow-card py-3.5 text-[14.5px] font-semibold text-ink disabled:opacity-40 disabled:pointer-events-none"
          >
            <IconoGoogle className="w-[18px] h-[18px]" />
            Continuar con Google
          </button>
        </>
      )}

      {modo === "entrar" && (
        <button
          type="button"
          onClick={() => {
            setModo("recuperar");
            setError(null);
          }}
          className="w-full text-center text-[13px] text-mute mt-4 underline underline-offset-2"
        >
          Me olvidé la contraseña
        </button>
      )}

      <p className="text-[13.5px] text-mute text-center mt-5">
        {recuperando ? (
          <button
            type="button"
            onClick={() => {
              setModo("entrar");
              setError(null);
            }}
            className="font-semibold text-brand-600 underline underline-offset-2"
          >
            Volver
          </button>
        ) : (
          <>
            {registrando ? "¿Ya tenés cuenta?" : "¿Primera vez en Nora?"}{" "}
            <button
              type="button"
              onClick={() => {
                setModo(registrando ? "entrar" : "registrarse");
                setError(null);
              }}
              className="font-semibold text-brand-600 underline underline-offset-2"
            >
              {registrando ? "Entrá" : "Creá tu cuenta"}
            </button>
          </>
        )}
      </p>

      {registrando && (
        <p className="text-[11.5px] text-faint text-center mt-4 leading-snug">
          Al crear tu cuenta aceptás nuestros términos y la política de privacidad.
        </p>
      )}
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full max-w-[440px] mx-auto min-h-dvh bg-sand overflow-y-auto no-scrollbar">
      <div className="px-6 pt-16 pb-10">{children}</div>
    </div>
  );
}

function IconoGoogle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.1-5.1C33.5 6.2 29 4.4 24 4.4 13.2 4.4 4.4 13.2 4.4 24S13.2 43.6 24 43.6 43.6 34.8 43.6 24c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l5.9 4.3C13.9 15.4 18.6 12.4 24 12.4c3.1 0 5.8 1.2 7.9 3.1l5.1-5.1C33.5 6.2 29 4.4 24 4.4c-7.6 0-14.1 4.3-17.7 10.3z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.6c4.9 0 9.4-1.9 12.8-4.9l-5.9-5c-2 1.5-4.5 2.4-6.9 2.4-5.3 0-9.7-3.3-11.3-7.9l-5.9 4.5C10 39.3 16.5 43.6 24 43.6z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.3-2.2 4.2-4.1 5.6l5.9 5c-.4.4 6.4-4.7 6.4-14.2 0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function Campo({
  id,
  etiqueta,
  ...props
}: { id: string; etiqueta: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
      >
        {etiqueta}
      </label>
      <input
        id={id}
        type="text"
        className="w-full rounded-2xl bg-surface border border-line shadow-card px-4 py-3.5 text-[14px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
        {...props}
      />
    </div>
  );
}

/* Los mensajes de Supabase vienen en inglés y son técnicos.
   Nadie tiene por qué leer "Invalid login credentials". */
function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials")) return "El email o la contraseña no coinciden.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ya existe una cuenta con ese email. Probá entrando.";
  if (m.includes("email not confirmed"))
    return "Todavía no confirmaste tu email. Revisá tu casilla.";
  if (m.includes("password") && m.includes("6"))
    return "La contraseña es muy corta.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "Ese email no parece válido.";
  return "No pudimos completar la operación. Probá de nuevo en un momento.";
}

/** Errores que llegan como parámetro en la URL, desde /auth/confirm. */
function traducirParametro(codigo: string): string {
  switch (codigo) {
    case "link_vencido":
      return "Ese link ya venció o se usó. Pedí uno nuevo.";
    case "link_invalido":
      return "El link no es válido. Probá pidiendo uno nuevo.";
    case "no_pudimos_entrar":
    case "sin_codigo":
      return "No pudimos completar el ingreso. Probá de nuevo.";
    default:
      return "Algo salió mal. Probá de nuevo.";
  }
}
