"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Equipo, Propiedad } from "@/lib/tipos";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { HAY_SUPABASE } from "@/lib/supabase/config";
import {
  crearEquipo,
  crearPropiedad,
  listarEquipos,
  listarPropiedades,
  NuevaPropiedad,
} from "@/lib/datos";

/* Estado compartido de la app: quién entró, sus domicilios y sus equipos.

   Todo esto vive ahora en la base de datos, no en el navegador. Cambió
   sólo este archivo: las pantallas siguen llamando a las mismas funciones.

   Lo único que se guarda localmente es cuál domicilio estabas mirando —
   es una preferencia de pantalla, no un dato. */

const CLAVE_ACTIVA = "nora:propiedad-activa";

export type DatosNuevaPropiedad = NuevaPropiedad;

export type Sesion = {
  id: string;
  email: string;
  nombre: string;
  inicial: string;
};

type Contexto = {
  /** null mientras carga, o cuando la persona todavía no cargó ningún domicilio. */
  propiedad: Propiedad | null;
  propiedades: Propiedad[];
  indice: number;
  elegirPropiedad: (id: string) => void;
  agregarPropiedad: (datos: DatosNuevaPropiedad) => Promise<Propiedad>;
  equiposDe: (propiedadId: string) => Equipo[];
  agregarEquipo: (equipo: Omit<Equipo, "id">) => Promise<Equipo>;
  /** true mientras se están trayendo los datos. Las pantallas muestran
   *  el esqueleto en vez de datos vacíos que después cambian. */
  cargando: boolean;
  error: string | null;
  sesion: Sesion | null;
  cerrarSesion: () => Promise<void>;
  recargar: () => Promise<void>;
};

const ContextoApp = createContext<Contexto | null>(null);

export function ProveedorApp({ children }: { children: React.ReactNode }) {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [idActiva, setIdActiva] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);

  /* --- Traer los datos de la persona --- */
  const traerDatos = useCallback(async () => {
    if (!HAY_SUPABASE) {
      setCargando(false);
      return;
    }
    try {
      setError(null);
      // En paralelo: son dos consultas independientes, no tiene sentido
      // esperar una para pedir la otra.
      const [props, eqs] = await Promise.all([listarPropiedades(), listarEquipos()]);
      setPropiedades(props);
      setEquipos(eqs);

      const guardada = localStorage.getItem(CLAVE_ACTIVA);
      const valida = guardada && props.some((p) => p.id === guardada);
      setIdActiva(valida ? guardada : (props[0]?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar tus datos.");
    } finally {
      setCargando(false);
    }
  }, []);

  /* --- Quién entró --- */
  useEffect(() => {
    if (!HAY_SUPABASE) {
      setCargando(false);
      return;
    }
    const supabase = supabaseNavegador();

    const leerSesion = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSesion(null);
        setPropiedades([]);
        setEquipos([]);
        setCargando(false);
        return;
      }

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("nombre")
        .eq("id", user.id)
        .maybeSingle();

      const nombre =
        perfil?.nombre?.trim() ||
        (user.user_metadata?.nombre as string | undefined)?.trim() ||
        user.email?.split("@")[0] ||
        "Vos";

      setSesion({
        id: user.id,
        email: user.email ?? "",
        nombre,
        inicial: nombre.charAt(0).toUpperCase(),
      });

      await traerDatos();
    };

    leerSesion();

    /* Escuchamos los cambios en vez de leer una sola vez: si se cierra
       sesión en otra pestaña, esta se entera y limpia lo que tenía. */
    const { data: sub } = supabase.auth.onAuthStateChange((evento: string) => {
      if (evento === "SIGNED_OUT") {
        setSesion(null);
        setPropiedades([]);
        setEquipos([]);
        setIdActiva(null);
      } else if (evento === "SIGNED_IN" || evento === "TOKEN_REFRESHED") {
        leerSesion();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [traerDatos]);

  const elegirPropiedad = useCallback((id: string) => {
    setIdActiva(id);
    localStorage.setItem(CLAVE_ACTIVA, id);
  }, []);

  const agregarPropiedad = useCallback(async (datos: DatosNuevaPropiedad): Promise<Propiedad> => {
    const nueva = await crearPropiedad(datos);
    setPropiedades((previas) => [...previas, nueva]);
    // La recién creada pasa a ser la activa: es lo que uno espera.
    setIdActiva(nueva.id);
    localStorage.setItem(CLAVE_ACTIVA, nueva.id);
    return nueva;
  }, []);

  const agregarEquipo = useCallback(async (datos: Omit<Equipo, "id">): Promise<Equipo> => {
    const nuevo = await crearEquipo(datos);
    setEquipos((previos) => [...previos, nuevo]);
    return nuevo;
  }, []);

  const equiposDe = useCallback(
    (propiedadId: string) => equipos.filter((e) => e.propiedadId === propiedadId),
    [equipos],
  );

  const cerrarSesion = useCallback(async () => {
    if (HAY_SUPABASE) await supabaseNavegador().auth.signOut();
    localStorage.removeItem(CLAVE_ACTIVA);
    // Recarga completa: no queda nada del usuario anterior en memoria.
    window.location.href = "/entrar";
  }, []);

  const indice = Math.max(
    0,
    propiedades.findIndex((p) => p.id === idActiva),
  );

  const valor = useMemo<Contexto>(
    () => ({
      propiedad: propiedades[indice] ?? null,
      propiedades,
      indice,
      elegirPropiedad,
      agregarPropiedad,
      equiposDe,
      agregarEquipo,
      cargando,
      error,
      sesion,
      cerrarSesion,
      recargar: traerDatos,
    }),
    [
      propiedades,
      indice,
      elegirPropiedad,
      agregarPropiedad,
      equiposDe,
      agregarEquipo,
      cargando,
      error,
      sesion,
      cerrarSesion,
      traerDatos,
    ],
  );

  return <ContextoApp.Provider value={valor}>{children}</ContextoApp.Provider>;
}

export function useApp(): Contexto {
  const ctx = useContext(ContextoApp);
  if (!ctx) throw new Error("useApp tiene que usarse dentro de <ProveedorApp>");
  return ctx;
}
