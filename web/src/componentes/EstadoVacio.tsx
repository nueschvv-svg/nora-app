import type { LucideIcon } from "lucide-react";

/* Empty state con forma, no un renglón de texto gris perdido en medio
   de la pantalla. Compartido entre los paneles de técnico y
   operaciones — son las mismas listas vacías, distinto contexto. */
export function EstadoVacio({
  icono: Icono,
  titulo,
  texto,
}: {
  icono: LucideIcon;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="mt-10 flex flex-col items-center text-center px-8 py-6">
      <span className="w-14 h-14 grid place-items-center rounded-2xl bg-surface border border-line text-faint shadow-card">
        <Icono className="w-6 h-6" />
      </span>
      <p className="text-[14.5px] font-semibold text-ink mt-4">{titulo}</p>
      <p className="text-[13px] text-faint mt-1 max-w-[240px] leading-relaxed">{texto}</p>
    </div>
  );
}
