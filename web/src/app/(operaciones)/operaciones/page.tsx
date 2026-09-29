import { ListaPedidos } from "@/componentes/operaciones/ListaPedidos";
import { ClipboardList } from "lucide-react";

/* En escritorio, la lista queda fija en una columna angosta a la
   izquierda y a la derecha se ve el detalle del pedido elegido — acá
   todavía no hay ninguno, así que se explica qué hacer. En el
   celular la columna derecha ni se renderiza (md:flex): esta pantalla
   es sólo la lista, a pantalla completa, igual que antes. */
export default function PaginaOperaciones() {
  return (
    <main className="h-dvh overflow-hidden md:flex">
      <div className="h-full overflow-y-auto md:w-[360px] lg:w-[420px] md:shrink-0 md:border-r md:border-line">
        <ListaPedidos />
      </div>
      <div className="hidden md:flex flex-1 flex-col items-center justify-center px-8 text-center text-mute">
        <span className="mb-6 grid h-20 w-20 place-items-center rounded-3xl border border-line bg-surface shadow-sm"><ClipboardList aria-hidden="true" className="w-8 h-8 text-brand-700" /></span>
        <p className="nora-eyebrow">Todo en su lugar</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">Un pedido a la vez.</h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed">Elegí un pedido para consultar sus datos, coordinar el trabajo y acompañar cada paso.</p>
      </div>
    </main>
  );
}
