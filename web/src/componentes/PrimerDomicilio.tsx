"use client";

import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { IsotipoNora } from "./LogoNora";
import { FormularioPropiedad } from "./FormularioPropiedad";
import { useApp } from "./ContextoApp";

/* Lo primero que ve alguien que recién se registró.

   Sin un domicilio cargado la app no tiene nada que mostrar: ni score,
   ni agenda, ni pedidos. En vez de dibujar pantallas vacías con ceros,
   la llevamos derecho a lo único que importa ahora. */
export function PrimerDomicilio() {
  const { sesion } = useApp();
  const [abierto, setAbierto] = useState(false);

  return (
    <main className="h-dvh overflow-y-auto no-scrollbar px-6 pt-20 pb-28">
      <div className="flex flex-col items-center text-center">
        <IsotipoNora className="h-16 w-auto" />
        <h1 className="text-[24px] font-bold font-display text-ink mt-4 leading-tight">
          Bienvenido a Nora{sesion ? `, ${sesion.nombre.split(" ")[0]}` : ""}
        </h1>
        <p className="text-[14px] text-mute mt-2.5 leading-relaxed max-w-[300px]">
          Empecemos por tu casa. Cargala una vez y Nora se encarga del resto.
        </p>
      </div>

      <ul className="mt-8 space-y-3">
        <Paso
          numero="1"
          titulo="Cargás tu domicilio"
          detalle="Dónde queda y cómo querés llamarlo."
        />
        <Paso
          numero="2"
          titulo="Sumás tus equipos"
          detalle="El calefón, el aire, el tanque. Con marca y año si los tenés a mano."
        />
        <Paso
          numero="3"
          titulo="Nora te avisa"
          detalle="Te decimos qué hay que revisar y cuándo, antes de que se rompa."
        />
      </ul>

      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="press mt-8 w-full flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab"
      >
        <Plus className="w-[19px] h-[19px]" /> Cargar mi domicilio
      </button>

      <FormularioPropiedad abierto={abierto} alCerrar={() => setAbierto(false)} />
    </main>
  );
}

function Paso({ numero, titulo, detalle }: { numero: string; titulo: string; detalle: string }) {
  return (
    <li className="flex items-start gap-3.5 bg-surface rounded-xl2 border border-line shadow-card p-4">
      <span className="shrink-0 w-8 h-8 grid place-items-center rounded-full bg-brand-50 text-brand-600 text-[14px] font-bold num">
        {numero}
      </span>
      <div className="min-w-0">
        <p className="text-[14.5px] font-semibold text-ink leading-tight">{titulo}</p>
        <p className="text-[12.5px] text-mute mt-1 leading-snug">{detalle}</p>
      </div>
      <ArrowRight className="w-[16px] h-[16px] text-faint shrink-0 mt-1" />
    </li>
  );
}
