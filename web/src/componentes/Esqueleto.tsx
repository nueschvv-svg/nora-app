/* Placeholders mientras cargan los datos.

   Se muestran en vez de datos vacíos: si dibujáramos "score 0" y después
   saltara a 67, la persona ve un número equivocado durante un instante y
   eso genera desconfianza en un producto cuyo valor es justamente el número. */

export function EsqueletoInicio() {
  return (
    <main className="h-dvh overflow-y-auto no-scrollbar px-5 pt-12 pb-28" aria-busy="true">
      <span className="sr-only">Cargando tus datos…</span>
      <Bloque className="h-9 w-32" />
      <Bloque className="h-7 w-48 mt-5" />
      <Bloque className="h-[68px] w-full mt-4 rounded-2xl" />
      <Bloque className="h-[236px] w-full mt-3.5 rounded-xl3" />
      <Bloque className="h-[74px] w-full mt-3.5 rounded-xl2" />
      <Bloque className="h-[76px] w-full mt-3.5 rounded-xl2" />
    </main>
  );
}

export function Bloque({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-line/70 ${className}`} aria-hidden="true" />;
}

export function ErrorCarga({ mensaje, alReintentar }: { mensaje: string; alReintentar: () => void }) {
  return (
    <main className="h-dvh grid place-content-center px-8 text-center">
      <p className="text-[15px] font-semibold text-ink">No pudimos cargar tus datos</p>
      <p className="text-[13.5px] text-mute mt-2 max-w-[280px]">{mensaje}</p>
      <button
        type="button"
        onClick={alReintentar}
        className="press mt-6 rounded-xl2 bg-brand-600 text-white px-6 py-3.5 text-[14.5px] font-semibold shadow-fab"
      >
        Reintentar
      </button>
    </main>
  );
}
