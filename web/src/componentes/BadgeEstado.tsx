import { ETIQUETA_ESTADO, estiloEstado, type EstadoServicio } from "@/lib/tipos";

/* Insignia de estado, compartida entre el panel de técnico y el de
   operaciones — mismo criterio de color en los dos lados, para que
   "en camino" se vea igual sin importar quién lo esté mirando. */
export function BadgeEstado({ estado, className = "" }: { estado: EstadoServicio; className?: string }) {
  const estilo = estiloEstado(estado);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${estilo.badge} ${className}`}
    >
      <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${estilo.punto} ${estilo.vivo ? "live-dot" : ""}`} />
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
