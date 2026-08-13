/* Marca Nora: la casa esquemática con el corazón que late.
   Migrado tal cual del prototipo (líneas 113-141). */

export function IsotipoNora({
  className = "h-9 w-auto",
  variante = "claro",
}: {
  className?: string;
  variante?: "claro" | "oscuro";
}) {
  // En fondo oscuro las líneas finas necesitan más luz para verse.
  const detalle = variante === "oscuro" ? "#3FE0D2" : "#007A8C";
  const opacidadDetalle = variante === "oscuro" ? 0.6 : 0.55;

  return (
    <svg viewBox="0 0 110 125" className={className} role="img" aria-label="Nora">
      <path d="M8 52L55 8l47 44H90v62H20V52Z" fill="#00C2B8" opacity={variante === "oscuro" ? 0.1 : 0.07} />
      <g stroke="#00C2B8" strokeWidth="4" strokeLinecap="round">
        <line x1="28" y1="52" x2="28" y2="114" />
        <line x1="82" y1="52" x2="82" y2="114" />
        <line x1="28" y1="114" x2="82" y2="114" />
        <line x1="28" y1="52" x2="55" y2="22" />
        <line x1="82" y1="52" x2="55" y2="22" />
        <line x1="72" y1="22" x2="72" y2="8" />
        <line x1="66" y1="22" x2="79" y2="22" />
      </g>
      <g stroke={detalle} strokeLinecap="round" opacity={opacidadDetalle}>
        <line x1="28" y1="79" x2="82" y2="79" strokeWidth="2.5" />
        <line x1="64" y1="60" x2="64" y2="79" strokeWidth="2" />
        <line x1="45" y1="114" x2="45" y2="96" strokeWidth="2" />
        <line x1="65" y1="114" x2="65" y2="96" strokeWidth="2" />
        <line x1="45" y1="96" x2="65" y2="96" strokeWidth="2" />
      </g>
      <circle cx="55" cy="22" r="5.5" fill="#00C2B8" />
      <circle cx="28" cy="52" r="5" fill="#00C2B8" />
      <circle cx="82" cy="52" r="5" fill="#00C2B8" />
      <circle cx="28" cy="114" r="5" fill="#00C2B8" />
      <circle cx="82" cy="114" r="5" fill="#00C2B8" />
      <circle cx="45" cy="96" r="3" fill={detalle} opacity={opacidadDetalle} />
      <circle cx="65" cy="96" r="3" fill={detalle} opacity={opacidadDetalle} />
      <g className="heart-pulse">
        <path d="M72 4Q72 0 74.5 0Q77 0 77 4Q77 8 72 11Q67 8 67 4Q67 0 69.5 0Q72 0 72 4Z" fill="#FF6B9D" />
        <circle className="wring r1" cx="72" cy="5" r="5" />
        <circle className="wring r2" cx="72" cy="5" r="5" />
        <circle className="wring r3" cx="72" cy="5" r="5" />
      </g>
    </svg>
  );
}

export function LogotipoNora({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <IsotipoNora className="h-9 w-auto shrink-0" />
      <span
        className="text-[28px] text-ink leading-none"
        style={{ fontFamily: "var(--font-logo)", letterSpacing: "-0.045em" }}
      >
        nora
      </span>
    </div>
  );
}
