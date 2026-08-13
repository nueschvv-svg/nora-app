"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { propiedades as propiedadesDemo, equipos as equiposDemo } from "@/lib/datos-demo";
import { Equipo, Propiedad } from "@/lib/tipos";

/* Estado de la app en el navegador.

   Hoy guarda en localStorage. Mañana, en Supabase. Las pantallas usan
   estas funciones (`agregarPropiedad`, `agregarEquipo`) y no saben
   dónde terminan los datos — por eso el cambio va a tocar sólo este
   archivo, no las pantallas. */

const CLAVE_ACTIVA = "nora:propiedad-activa";
const CLAVE_PROPIEDADES = "nora:propiedades";
const CLAVE_EQUIPOS = "nora:equipos";

export type DatosNuevaPropiedad = {
  nombre: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  icono: Propiedad["icono"];
};

type Contexto = {
  propiedad: Propiedad;
  propiedades: Propiedad[];
  indice: number;
  elegirPropiedad: (id: string) => void;
  agregarPropiedad: (datos: DatosNuevaPropiedad) => Propiedad;
  equiposDe: (propiedadId: string) => Equipo[];
  agregarEquipo: (equipo: Omit<Equipo, "id">) => Equipo;
  /** Mientras es true, todavía no leímos lo guardado: no mostramos datos que después cambian. */
  cargando: boolean;
};

const ContextoApp = createContext<Contexto | null>(null);

function leerGuardado<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : porDefecto;
  } catch {
    // Si el JSON quedó corrupto, arrancamos limpio en vez de romper la app.
    return porDefecto;
  }
}

export function ProveedorApp({ children }: { children: React.ReactNode }) {
  const [propiedades, setPropiedades] = useState<Propiedad[]>(propiedadesDemo);
  const [equipos, setEquipos] = useState<Equipo[]>(equiposDemo);
  const [id, setId] = useState(propiedadesDemo[0].id);
  const [cargando, setCargando] = useState(true);

  /* Se lee después del primer render, no durante: el servidor no tiene
     localStorage, y si el HTML del servidor y el del cliente no coinciden,
     React tira un error de hidratación. */
  useEffect(() => {
    const guardadas = leerGuardado<Propiedad[]>(CLAVE_PROPIEDADES, propiedadesDemo);
    const guardados = leerGuardado<Equipo[]>(CLAVE_EQUIPOS, equiposDemo);
    setPropiedades(guardadas.length ? guardadas : propiedadesDemo);
    setEquipos(guardados);

    const activa = localStorage.getItem(CLAVE_ACTIVA);
    if (activa && guardadas.some((p) => p.id === activa)) setId(activa);
    setCargando(false);
  }, []);

  const elegirPropiedad = useCallback((nuevo: string) => {
    setId(nuevo);
    localStorage.setItem(CLAVE_ACTIVA, nuevo);
  }, []);

  const agregarPropiedad = useCallback((datos: DatosNuevaPropiedad): Propiedad => {
    const nueva: Propiedad = {
      id: crypto.randomUUID(),
      nombre: datos.nombre.trim(),
      direccion: `${datos.calle.trim()} ${datos.numero.trim()}`.trim(),
      localidad: datos.localidad.trim(),
      provincia: datos.provincia.trim(),
      icono: datos.icono,
    };

    setPropiedades((previas) => {
      const siguiente = [...previas, nueva];
      localStorage.setItem(CLAVE_PROPIEDADES, JSON.stringify(siguiente));
      return siguiente;
    });

    // La propiedad recién creada pasa a ser la activa: es lo que el
    // usuario espera después de cargarla.
    setId(nueva.id);
    localStorage.setItem(CLAVE_ACTIVA, nueva.id);
    return nueva;
  }, []);

  const agregarEquipo = useCallback((datos: Omit<Equipo, "id">): Equipo => {
    const nuevo: Equipo = { ...datos, id: crypto.randomUUID() };
    setEquipos((previos) => {
      const siguiente = [...previos, nuevo];
      localStorage.setItem(CLAVE_EQUIPOS, JSON.stringify(siguiente));
      return siguiente;
    });
    return nuevo;
  }, []);

  const equiposDe = useCallback(
    (propiedadId: string) => equipos.filter((e) => e.propiedadId === propiedadId),
    [equipos],
  );

  const indice = Math.max(
    0,
    propiedades.findIndex((p) => p.id === id),
  );

  const valor = useMemo<Contexto>(
    () => ({
      propiedad: propiedades[indice] ?? propiedades[0],
      propiedades,
      indice,
      elegirPropiedad,
      agregarPropiedad,
      equiposDe,
      agregarEquipo,
      cargando,
    }),
    [propiedades, indice, elegirPropiedad, agregarPropiedad, equiposDe, agregarEquipo, cargando],
  );

  return <ContextoApp.Provider value={valor}>{children}</ContextoApp.Provider>;
}

export function useApp(): Contexto {
  const ctx = useContext(ContextoApp);
  if (!ctx) throw new Error("useApp tiene que usarse dentro de <ProveedorApp>");
  return ctx;
}
