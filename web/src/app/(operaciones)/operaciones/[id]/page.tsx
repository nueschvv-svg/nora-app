"use client";

import { use } from "react";
import { ListaPedidos } from "@/componentes/operaciones/ListaPedidos";
import { DetalleServicio } from "@/componentes/operaciones/DetalleServicio";

/* En escritorio, misma columna de lista que /operaciones (con este
   pedido resaltado) y el detalle al lado — cambiar de pedido es un
   click en la lista, no un viaje de ida y vuelta a otra pantalla. En
   el celular la lista se oculta (md:hidden) y sólo se ve el detalle,
   a pantalla completa, igual que antes. */
export default function PaginaDetalleOperaciones({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <main className="h-dvh overflow-hidden md:flex">
      <div className="hidden h-full overflow-y-auto no-scrollbar md:block md:w-[420px] md:shrink-0 md:border-r md:border-line">
        <ListaPedidos idSeleccionado={id} />
      </div>
      <div className="h-full overflow-y-auto no-scrollbar flex-1">
        {/* key={id}: al cambiar de pedido en escritorio (click en la
            lista sin salir de esta ruta), esto fuerza a React a montar
            una instancia nueva en vez de reusar la vieja con props
            distintas — así el estado (cargando, formularios abiertos)
            arranca limpio para cada pedido, sin tener que resetearlo
            a mano dentro de un efecto. */}
        <DetalleServicio key={id} id={id} />
      </div>
    </main>
  );
}
