"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Hammer, Loader2, X } from "lucide-react";
import { useApp } from "@/componentes/ContextoApp";
import { unirseAObra } from "@/lib/obras";

/* A dónde llega quien toca el link de invitación (HojaInvitarObra).
   Sin sesión, primero pasa por /entrar y vuelve acá — "volver" ya lo
   soporta esa pantalla. Con sesión, se suma solo (unirse_a_obra(),
   security definer, valida el código) y confirma. */
export default function PaginaUnirseObra({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const router = useRouter();
  const { sesion, cargando } = useApp();

  const [estado, setEstado] = useState<"cargando" | "lista" | "error">("cargando");
  const [nombreObra, setNombreObra] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cargando) return;
    if (!sesion) {
      router.replace(`/entrar?volver=${encodeURIComponent(`/obras/unirse/${codigo}`)}`);
      return;
    }
    let vivo = true;
    unirseAObra(codigo)
      .then((r) => {
        if (!vivo) return;
        setNombreObra(r.nombre);
        setEstado("lista");
      })
      .catch((e) => {
        if (!vivo) return;
        setError(e instanceof Error ? e.message : "No pudimos unirte a la obra.");
        setEstado("error");
      });
    return () => {
      vivo = false;
    };
  }, [cargando, sesion, codigo, router]);

  return (
    <main className="h-dvh flex flex-col items-center justify-center px-8 text-center">
      {estado === "cargando" && (
        <>
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-[14px] text-mute mt-4">Uniéndote a la obra…</p>
        </>
      )}

      {estado === "lista" && (
        <>
          <div className="w-20 h-20 grid place-items-center rounded-full bg-good/15 text-good">
            <Check className="w-9 h-9" />
          </div>
          <h1 className="text-[21px] font-bold font-display text-ink mt-5">¡Listo!</h1>
          <p className="text-[13.5px] text-mute mt-2 max-w-[280px] leading-relaxed">
            Te sumaste a <span className="font-semibold text-ink">{nombreObra}</span>. Ya podés verla en
            Obras y escribir en su chat.
          </p>
          <Link
            href="/obras"
            className="press mt-7 w-full max-w-[260px] flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab"
          >
            <Hammer className="w-[18px] h-[18px]" />
            Ver la obra
          </Link>
        </>
      )}

      {estado === "error" && (
        <>
          <div className="w-20 h-20 grid place-items-center rounded-full bg-urgent/15 text-urgent">
            <X className="w-9 h-9" />
          </div>
          <h1 className="text-[21px] font-bold font-display text-ink mt-5">No pudimos sumarte</h1>
          <p className="text-[13.5px] text-mute mt-2 max-w-[280px] leading-relaxed">{error}</p>
          <Link
            href="/inicio"
            className="press mt-7 w-full max-w-[260px] flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab"
          >
            Ir al inicio
          </Link>
        </>
      )}
    </main>
  );
}
