"use client";

import { Hammer } from "lucide-react";
import { EstadoVacio } from "@/componentes/EstadoVacio";

/* Sección nueva para clientes con una construcción grande en curso
   (no un service puntual de Nora): avance de obra, presupuesto vs.
   ejecutado, etapas, y contacto directo con quien dirige la obra.
   Se conecta con Enjinia, la constructora — todavía sin credenciales
   ni esquema de datos reales, así que por ahora esto es sólo la
   pantalla y el estado vacío. Cuando lleguen los datos, esto pasa a
   listar las obras reales de la cuenta en vez de este mensaje. */
export default function PaginaObras() {
  return (
    <main className="h-dvh overflow-y-auto no-scrollbar px-5 pt-12 pb-28">
      <h1 className="text-[24px] font-bold font-display text-ink">Obras</h1>
      <p className="text-[13px] text-mute mt-0.5">Tus proyectos grandes, bajo control.</p>

      <EstadoVacio
        icono={Hammer}
        titulo="Todavía no tenés obras conectadas"
        texto="Si estás construyendo con Enjinia, en breve vas a poder ver acá el avance, el presupuesto y hablar directo con quien dirige tu obra."
      />
    </main>
  );
}
