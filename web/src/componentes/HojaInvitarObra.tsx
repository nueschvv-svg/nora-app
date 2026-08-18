"use client";

import { useState } from "react";
import { ArrowLeft, Briefcase, Check, Copy, HardHat, Share2, Users, X } from "lucide-react";
import { ETIQUETA_ROL, invitacionParaRol, linkInvitacionObra, type RolInvitacion } from "@/lib/obras";

const ROLES: { valor: RolInvitacion; Icono: typeof Users }[] = [
  { valor: "arquitecto", Icono: HardHat },
  { valor: "socio", Icono: Users },
  { valor: "contratista", Icono: Briefcase },
  { valor: "otro", Icono: Users },
];

/* Un link DISTINTO por rol — el dueño elige antes de generarlo si es
   para la arquitecta, un socio, etc. (invitacionParaRol(), ver
   db/31_roles_invitacion_obra.sql). Quien abre el link no elige nada:
   el rol ya viene decidido, así el dueño sabe siempre quién es quién
   sin tener que preguntarlo en el chat. */
export function HojaInvitarObra({
  abierto,
  alCerrar,
  nombreObra,
  obraId,
}: {
  abierto: boolean;
  alCerrar: () => void;
  nombreObra: string;
  obraId: string;
}) {
  const [rol, setRol] = useState<RolInvitacion | null>(null);
  const [etiquetaOtro, setEtiquetaOtro] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Mismo criterio que el reset de FormularioPropiedad/FormularioObra:
  // durante el render, no en un efecto — evita el parpadeo de un
  // segundo render y el problema de setState síncrono en un efecto.
  const [estabaAbierto, setEstabaAbierto] = useState(abierto);
  if (abierto !== estabaAbierto) {
    setEstabaAbierto(abierto);
    if (abierto) {
      setRol(null);
      setEtiquetaOtro("");
      setLink(null);
      setError(null);
      setCopiado(false);
    }
  }

  const generar = async (rolElegido: RolInvitacion, etiqueta?: string) => {
    setRol(rolElegido);
    setCargando(true);
    setError(null);
    try {
      const codigo = await invitacionParaRol(obraId, rolElegido, etiqueta);
      setLink(linkInvitacionObra(codigo));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos generar el link.");
    } finally {
      setCargando(false);
    }
  };

  const volver = () => {
    setRol(null);
    setLink(null);
    setError(null);
    setEtiquetaOtro("");
  };

  const copiar = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      /* Sin permiso de portapapeles: el link sigue seleccionable a mano. */
    }
  };

  const compartir = async () => {
    if (!link) return;
    if (!navigator.share) return copiar();
    const rolTexto = rol ? (rol === "otro" && etiquetaOtro ? etiquetaOtro : ETIQUETA_ROL[rol]) : "";
    try {
      await navigator.share({ title: `Sumate a "${nombreObra}" en Nora como ${rolTexto}`, url: link });
    } catch {
      /* Cancelado por la persona — no es un error. */
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        className={`absolute inset-0 z-[55] bg-black/40 transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invitar a la obra"
        className={`absolute bottom-0 inset-x-0 z-[56] bg-sand rounded-t-[26px] shadow-sheet max-h-[80%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <div className="px-5 pt-3 pb-8">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              {link && (
                <button
                  type="button"
                  onClick={volver}
                  className="press flex items-center gap-1 text-[12px] font-semibold text-brand-600 mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Elegir otro rol
                </button>
              )}
              <h2 className="text-[18px] font-bold font-display text-ink">Invitar a la obra</h2>
              <p className="text-[12.5px] text-mute mt-0.5 truncate max-w-[260px]">{nombreObra}</p>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              className="press shrink-0 w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!link ? (
            <>
              <p className="text-[13px] text-mute mt-4 leading-relaxed">
                Elegí quién va a entrar con este link — así sabés siempre quién es quién, sin tener que
                preguntarlo. Quien lo abra no elige nada, el rol ya queda decidido.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {ROLES.filter((r) => r.valor !== "otro").map(({ valor, Icono }) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => generar(valor)}
                    disabled={cargando}
                    className="press flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface shadow-card py-4 disabled:opacity-50"
                  >
                    <Icono className="w-5 h-5 text-brand-600" />
                    <span className="text-[13px] font-semibold text-ink">{ETIQUETA_ROL[valor]}</span>
                  </button>
                ))}
              </div>

              <div className="mt-2.5 rounded-2xl border border-line bg-surface shadow-card p-3.5">
                <label htmlFor="etiqueta-otro" className="text-[12px] font-semibold text-ink">
                  Otro rol
                </label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    id="etiqueta-otro"
                    type="text"
                    value={etiquetaOtro}
                    onChange={(e) => setEtiquetaOtro(e.target.value)}
                    placeholder="Ej: Contratista de pintura"
                    className="flex-1 min-w-0 rounded-xl2 bg-sand border border-line px-3.5 py-2.5 text-[13px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
                  />
                  <button
                    type="button"
                    onClick={() => generar("otro", etiquetaOtro)}
                    disabled={cargando || !etiquetaOtro.trim()}
                    className="press shrink-0 rounded-xl2 bg-brand-600 text-white px-3.5 py-2.5 text-[13px] font-semibold disabled:opacity-40"
                  >
                    Listo
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-3">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[13px] text-mute mt-4 leading-relaxed">
                Link para sumarse como{" "}
                <span className="font-semibold text-ink">
                  {rol === "otro" && etiquetaOtro ? etiquetaOtro : rol ? ETIQUETA_ROL[rol] : ""}
                </span>
                . Cualquiera que lo abra y tenga cuenta en Nora se suma con ese rol ya asignado.
              </p>

              <div className="mt-4 rounded-xl2 bg-surface border border-line shadow-card px-4 py-3.5">
                <p className="text-[13px] text-ink break-all font-mono">{link}</p>
              </div>

              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={copiar}
                  className="press flex items-center justify-center gap-1.5 rounded-xl2 border border-line bg-surface text-ink py-3 text-[13.5px] font-semibold"
                >
                  {copiado ? <Check className="w-4 h-4 text-good" /> : <Copy className="w-4 h-4" />}
                  {copiado ? "Copiado" : "Copiar link"}
                </button>
                <button
                  type="button"
                  onClick={compartir}
                  className="press flex items-center justify-center gap-1.5 rounded-xl2 bg-brand-600 text-white py-3 text-[13.5px] font-semibold"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
