"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { propiedades } from "@/lib/datos-demo";
import { Propiedad } from "@/lib/tipos";

/* Guarda qué propiedad está mirando el usuario.
   Hoy vive en memoria + localStorage; cuando haya login, pasa a ser
   una preferencia del usuario guardada en la base. */

type Contexto = {
  propiedad: Propiedad;
  propiedades: Propiedad[];
  indice: number;
  elegirPropiedad: (id: string) => void;
};

const CLAVE = "nora:propiedad-activa";
const ContextoApp = createContext<Contexto | null>(null);

export function ProveedorApp({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState(propiedades[0].id);

  // Se lee después del primer render para que el HTML del servidor y el
  // del cliente coincidan (si no, React tira error de hidratación).
  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado && propiedades.some((p) => p.id === guardado)) setId(guardado);
  }, []);

  const elegirPropiedad = (nuevo: string) => {
    setId(nuevo);
    localStorage.setItem(CLAVE, nuevo);
  };

  const indice = Math.max(
    0,
    propiedades.findIndex((p) => p.id === id),
  );

  return (
    <ContextoApp.Provider
      value={{ propiedad: propiedades[indice], propiedades, indice, elegirPropiedad }}
    >
      {children}
    </ContextoApp.Provider>
  );
}

export function useApp(): Contexto {
  const ctx = useContext(ContextoApp);
  if (!ctx) throw new Error("useApp tiene que usarse dentro de <ProveedorApp>");
  return ctx;
}
