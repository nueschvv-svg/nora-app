"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [idActiva, setIdActiva] = useState<string | null>(null);
  /* Arranca en true sólo si hay algo que cargar. Sin Supabase configurado
     no hay espera, y así no hace falta apagarlo desde un efecto. */
  const [cargando, setCargando] = useState(HAY_SUPABASE);
  const [error, setError] = useState<string | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);

  /* --- Traer los datos de la persona --- */
  const traerDatos = useCallback(async () => {
    if (!HAY_SUPABASE) return;
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
    if (!HAY_SUPABASE) return;
    const supabase = supabaseNavegador();

    /* Quién está adentro según la última lectura. Sirve para no repetir
       trabajo cuando llegan eventos de sesión que no cambian al usuario. */
    let usuarioActual: string | null = null;

    const leerSesion = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        usuarioActual = null;
        setSesion(null);
        setPropiedades([]);
        setEquipos([]);
        setCargando(false);
        return;
      }

      usuarioActual = user.id;

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
       sesión en otra pestaña, esta se entera y limpia lo que tenía.

       Guardamos el id de quien está adentro para no recargar de gusto:
       SIGNED_IN se dispara también al montar (justo después del leerSesion()
       de arriba) y TOKEN_REFRESHED se dispara solo cada ~50 minutos. Sin
       este control, cada uno de esos eventos volvía a pedir todos los
       domicilios y equipos sin que hubiera cambiado nada. */
    const { data: sub } = supabase.auth.onAuthStateChange(
      (evento: string, sesionNueva: { user?: { id?: string } } | null) => {
        if (evento === "SIGNED_OUT") {
          usuarioActual = null;
          setSesion(null);
          setPropiedades([]);
          setEquipos([]);
          setIdActiva(null);
          return;
        }
        const idNuevo = sesionNueva?.user?.id ?? null;
        if (idNuevo && idNuevo !== usuarioActual) leerSesion();
      },
    );

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
    /* signOut dispara SIGNED_OUT, que arriba vacía domicilios y equipos:
       no queda nada del usuario anterior en memoria.

       A /inicio, no a /entrar: sin cuentas del lado cliente, /entrar es
       sólo para el login real de operaciones — mandar ahí a alguien que
       tocó "Empezar de nuevo" lo dejaría frente a un formulario de
       email/contraseña que no puede (ni tiene que) usar. El middleware
       ve que ya no hay sesión y crea una anónima nueva sola, así que
       esto es, en los hechos, "borrar todo y arrancar de cero" — no un
       logout real. El refresh() obliga al servidor a releer la sesión
       (ahora vacía) antes de pintar. */
    router.replace("/inicio");
    router.refresh();
  }, [router]);

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
