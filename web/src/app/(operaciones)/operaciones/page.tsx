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
      <div className="h-full overflow-y-auto no-scrollbar md:w-[420px] md:shrink-0 md:border-r md:border-line">
        <ListaPedidos />
      </div>
      <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-2 text-mute">
        <ClipboardList className="w-8 h-8 text-faint" />
        <p className="text-[13px]">Elegí un pedido de la lista para ver el detalle.</p>
      </div>
    </main>
  );
}
