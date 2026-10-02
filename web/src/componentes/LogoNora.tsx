/* Casa y corazón: evolución vectorial de la marca original, sin animación perpetua. */
export function IsotipoNora({ className = "h-9 w-auto", variante = "claro" }: {
  className?: string; variante?: "claro" | "oscuro";
}) {
  const color = variante === "oscuro" ? "#b9f1dd" : "#0e5c54";
  return <svg viewBox="0 0 96 104" className={className} role="img" aria-label="Nora">
    <path d="M12 43 48 12 84 43v41a12 12 0 0 1-12 12H24a12 12 0 0 1-12-12Z" fill={color} fillOpacity=".08" />
    <path d="m14 45 34-30 34 30v37a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10V45Z" fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" />
    <path d="M34 91V55l28 36V55" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M73 10c-6-8-17 2-10 9l10 9 10-9c7-7-4-17-10-9Z" fill="#d75f83" stroke={variante === "oscuro" ? "#173e39" : "#faf9f5"} strokeWidth="3" strokeLinejoin="round" />
  </svg>;
}
export function LogotipoNora({ className = "" }: { className?: string }) {
  return <div className={`flex items-center gap-2.5 select-none ${className}`}>
    <IsotipoNora className="h-10 w-auto shrink-0" />
    <span className="text-[30px] font-semibold text-ink leading-none" style={{fontFamily:"var(--font-display)",letterSpacing:"-.065em"}}>nora<span className="text-brand-500">.</span></span>
  </div>;
}
