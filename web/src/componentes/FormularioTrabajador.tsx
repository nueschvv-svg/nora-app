"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, LocateFixed, X } from "lucide-react";
import { IconoEquipo } from "./IconoEquipo";
import { listarCategorias, type CategoriaBD } from "@/lib/datos";
import {
  guardarTrabajador,
  subirDocumentoTecnico,
  type DatosTrabajador,
  type EstadoTrabajador,
  type MiFichaTrabajador,
  type TipoDocumentoTecnico,
} from "@/lib/trabajadores";

/* Alta (o edición) de la ficha de trabajador.

   Mismo patrón que FormularioPropiedad y FormularioEquipo: hoja que
   sube desde abajo, se limpia al abrir (durante el render, no en un
   efecto, para no parpadear), se cierra con Escape o cancelando sin
   dejar nada guardado a medias.

   Este formulario no crea la cuenta: quien lo abre ya inició sesión
   como cliente. Lo que hace es sumarle a ese mismo usuario una ficha
   en `tecnicos`, en estado "pendiente" hasta que operaciones lo
   verifique — ver db/07_trabajadores.sql. */

const VACIO: DatosTrabajador = {
  telefono: "",
  categorias: [],
  zonaCobertura: [],
  radioKm: 15,
  disponible: true,
  latitud: null,
  longitud: null,
};

export function FormularioTrabajador({
  abierto,
  alCerrar,
  alGuardar,
  fichaInicial,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar?: (ficha: MiFichaTrabajador) => void;
  /** La ficha ya cargada por la pantalla que muestra el botón (evita
   *  pedirla de nuevo acá, y evita depender de un efecto atado a
   *  `abierto` para traerla — ver nota más abajo). null si la persona
   *  todavía no se dio de alta. */
  fichaInicial: MiFichaTrabajador | null;
}) {
  const [datos, setDatos] = useState<DatosTrabajador>(VACIO);
  const [estado, setEstado] = useState<EstadoTrabajador | null>(null);
  const [zonaTexto, setZonaTexto] = useState("");
  const [categorias, setCategorias] = useState<CategoriaBD[]>([]);
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);

  /* Documentos de verificación. Sólo obligatorios en el alta nueva —
     quien ya tiene ficha puede sumarlos después sin tener que
     resubirlos cada vez que edita otra cosa. */
  const [dniFrente, setDniFrente] = useState<File | null>(null);
  const [dniDorso, setDniDorso] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [matricula, setMatricula] = useState<File | null>(null);
  const [errorDocumentos, setErrorDocumentos] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  /* Los rubros son catálogo estático: se traen una sola vez al montar,
     sin esperar a que se abra la hoja. Antes se pedían recién al abrir,
     atado a la prop `abierto` — pero un efecto que sólo corre en la
     transición false→true de una prop puede perderse esa primera
     transición si el padre todavía se está re-renderizando por otras
     cargas (sesión, domicilios, equipos). Pidiéndolos siempre al montar
     se evita depender de ese momento exacto. */
  useEffect(() => {
    listarCategorias()
      .then(setCategorias)
      .catch(() => {
        /* Sin rubros para elegir el formulario queda inutilizable,
           pero no es motivo para no poder cerrar y cancelar. */
      });
  }, []);

  /* Reset sincrónico al abrir, durante el render y no en un efecto —
     así no se ve un parpadeo con los datos de la vez anterior. Mismo
     patrón que FormularioPropiedad. La ficha ya la trajo la pantalla
     que nos pasó `fichaInicial`, así que este reset es puramente
     sincrónico: no dispara ningún pedido de red. */
  const [estabaAbierto, setEstabaAbierto] = useState(abierto);
  if (abierto !== estabaAbierto) {
    setEstabaAbierto(abierto);
    if (abierto) {
      setDatos(fichaInicial ?? VACIO);
      setEstado(fichaInicial?.estado ?? null);
      setZonaTexto(fichaInicial?.zonaCobertura.join(", ") ?? "");
      setTocados({});
      setErrorGuardar(null);
      setErrorUbicacion(null);
      setDniFrente(null);
      setDniDorso(null);
      setSelfie(null);
      setMatricula(null);
      setErrorDocumentos(null);
      setGuardadoOk(false);
    }
  }

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto, alCerrar]);

  const detectarUbicacion = () => {
    if (!("geolocation" in navigator)) {
      setErrorUbicacion("Tu navegador no puede compartir tu ubicación.");
      return;
    }
    setBuscandoUbicacion(true);
    setErrorUbicacion(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDatos((d) => ({ ...d, latitud: pos.coords.latitude, longitud: pos.coords.longitude }));
        setBuscandoUbicacion(false);
      },
      () => {
        setErrorUbicacion("No pudimos obtener tu ubicación. Podés intentar de nuevo más tarde.");
        setBuscandoUbicacion(false);
      },
      { timeout: 10_000 },
    );
  };

  const zonas = zonaTexto
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean);

  const esAltaNueva = !estado;

  const errores: Partial<Record<"telefono" | "categorias" | "zona" | "radioKm", string>> = {};
  if (!datos.telefono.trim()) errores.telefono = "Falta un teléfono de contacto";
  if (datos.categorias.length === 0) errores.categorias = "Elegí al menos un rubro";
  if (zonas.length === 0) errores.zona = "Contanos qué zona cubrís";
  if (!datos.radioKm || datos.radioKm <= 0) errores.radioKm = "Poné un radio mayor a 0";

  // Documentos obligatorios sólo en el alta nueva — ver comentario del
  // estado más arriba.
  const faltanDocumentos = esAltaNueva && (!dniFrente || !dniDorso || !selfie);

  const valido = Object.keys(errores).length === 0 && !faltanDocumentos;
  const mostrarError = (clave: keyof typeof errores) => tocados[clave] && errores[clave];

  const alternarCategoria = (slug: string) => {
    setDatos((d) => ({
      ...d,
      categorias: d.categorias.includes(slug)
        ? d.categorias.filter((c) => c !== slug)
        : [...d.categorias, slug],
    }));
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    if (!valido) {
      setTocados({ telefono: true, categorias: true, zona: true, radioKm: true });
      return;
    }
    setGuardando(true);
    setErrorGuardar(null);
    setErrorDocumentos(null);
    try {
      const datosGuardados = { ...datos, zonaCobertura: zonas };
      await guardarTrabajador(datosGuardados);

      // Los documentos obligatorios sí bloquean: sin ellos, operaciones
      // no tiene con qué verificar. La matrícula es opcional — si falla,
      // se avisa pero no se corta el alta (la puede sumar después).
      const subidas: Array<[TipoDocumentoTecnico, File | null, boolean]> = [
        ["dni_frente", dniFrente, true],
        ["dni_dorso", dniDorso, true],
        ["selfie", selfie, true],
        ["matricula", matricula, false],
      ];
      for (const [tipo, archivo, obligatorio] of subidas) {
        if (!archivo) continue;
        try {
          await subirDocumentoTecnico(tipo, archivo);
        } catch (errDoc) {
          if (obligatorio) throw errDoc;
          setErrorDocumentos("No pudimos subir la matrícula. Podés sumarla después.");
        }
      }

      // Sin verificación no cambia el estado; si ya tenía uno (edición),
      // se mantiene. Si es alta nueva, la política de la base lo crea
      // en "pendiente" — ver db/07_trabajadores.sql.
      alGuardar?.({ ...datosGuardados, estado: estado ?? "pendiente" });
      setGuardadoOk(true);
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : "No pudimos guardar tu ficha.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        className={`absolute inset-0 z-[55] bg-black/40 transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trabajá con Nora"
        className={`absolute bottom-0 inset-x-0 z-[56] bg-sand rounded-t-[26px] shadow-sheet max-h-[92%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />

        {guardadoOk ? (
          <div className="px-5 pt-3 pb-9 text-center">
            <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-good/15 text-good mt-4">
              <Check className="w-7 h-7" />
            </span>
            <h2 className="text-[18px] font-bold font-display text-ink mt-4">
              Datos cargados correctamente
            </h2>
            <p className="text-[13.5px] text-mute mt-2 leading-relaxed max-w-[280px] mx-auto">
              En breve recibirás respuesta. Nuestro equipo revisa tu ficha antes de que puedas
              empezar a tomar trabajos.
            </p>
            <button
              type="button"
              onClick={alCerrar}
              className="press mt-6 w-full rounded-xl2 bg-brand-600 text-white py-3.5 text-[14.5px] font-semibold shadow-fab"
            >
              Listo
            </button>
          </div>
        ) : (
        <form onSubmit={enviar} className="px-5 pt-3 pb-7" noValidate>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-bold font-display text-ink">Trabajá con Nora</h2>
              <p className="text-[12.5px] text-mute">Sumate como prestador de servicios</p>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              className="press w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {estado === "pendiente" && (
            <div className="mt-4 rounded-xl2 bg-brand-50 border border-brand-100 px-3.5 py-3">
              <p className="text-[12.5px] text-ink leading-snug">
                Tu ficha está <span className="font-semibold">pendiente de verificación</span>. Nuestro
                equipo la revisa antes de que empieces a recibir pedidos.
              </p>
            </div>
          )}

          <Campo
            id="telefono-trabajador"
            etiqueta="Teléfono de contacto"
            error={mostrarError("telefono")}
            type="tel"
            inputMode="tel"
            placeholder="11 5555 5555"
            value={datos.telefono}
            onChange={(e) => setDatos((d) => ({ ...d, telefono: e.target.value }))}
            onBlur={() => setTocados((t) => ({ ...t, telefono: true }))}
          />

          <fieldset className="mt-4">
            <legend className="text-[11px] font-bold tracking-wide uppercase text-faint mb-2">
              Qué rubro ofrecés
            </legend>
            <div className="grid grid-cols-3 gap-2.5">
              {categorias.map((c) => {
                const elegida = datos.categorias.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    disabled={!c.activa}
                    onClick={() => alternarCategoria(c.slug)}
                    aria-pressed={elegida}
                    aria-label={c.activa ? c.nombre : `${c.nombre} — todavía no disponible`}
                    className={`press relative flex flex-col items-center gap-1.5 rounded-2xl border shadow-card py-3 px-1 ${
                      !c.activa
                        ? "bg-surface/50 border-line opacity-55 cursor-not-allowed"
                        : elegida
                          ? "bg-surface border-brand-500 ring-2 ring-brand-500"
                          : "bg-surface border-line"
                    }`}
                  >
                    <span className={c.activa && elegida ? "text-brand-600" : "text-faint"}>
                      <IconoEquipo nombre={c.icono} className="w-5 h-5" />
                    </span>
                    <span className="text-[11.5px] font-medium text-mute text-center leading-tight">
                      {c.nombre}
                    </span>
                    {!c.activa && (
                      <span className="text-[9.5px] font-semibold uppercase tracking-wide text-faint">
                        Pronto
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {mostrarError("categorias") && (
              <p role="alert" className="text-[12px] text-urgent mt-1.5 px-1">
                {errores.categorias}
              </p>
            )}
          </fieldset>

          <Campo
            id="zona-trabajador"
            etiqueta="Zona de cobertura"
            ayuda="Localidades o barrios separados por coma"
            error={mostrarError("zona")}
            placeholder="Palermo, Belgrano, Recoleta"
            value={zonaTexto}
            onChange={(e) => setZonaTexto(e.target.value)}
            onBlur={() => setTocados((t) => ({ ...t, zona: true }))}
          />

          <div className="grid grid-cols-[1fr_1.4fr] gap-2.5">
            <Campo
              id="radio-trabajador"
              etiqueta="Radio (km)"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              error={mostrarError("radioKm")}
              value={String(datos.radioKm)}
              onChange={(e) => setDatos((d) => ({ ...d, radioKm: Number(e.target.value) || 0 }))}
              onBlur={() => setTocados((t) => ({ ...t, radioKm: true }))}
            />
            <div className="mt-3">
              <label className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
                Tu ubicación
              </label>
              <button
                type="button"
                onClick={detectarUbicacion}
                disabled={buscandoUbicacion}
                className="press w-full flex items-center justify-center gap-2 rounded-2xl bg-surface border border-line shadow-card px-3 py-3.5 text-[13px] font-semibold text-brand-600 disabled:opacity-50"
              >
                <LocateFixed className="w-4 h-4" />
                {buscandoUbicacion
                  ? "Buscando…"
                  : datos.latitud != null
                    ? "Ubicación cargada ✓"
                    : "Usar mi ubicación actual"}
              </button>
            </div>
          </div>
          {errorUbicacion && <p className="text-[11.5px] text-faint mt-1 px-1">{errorUbicacion}</p>}
          {datos.latitud == null && !errorUbicacion && (
            <p className="text-[11.5px] text-faint mt-1.5 px-1 leading-snug">
              Sin ubicación no vas a aparecer en las búsquedas de clientes cercanos. Podés cargarla
              ahora o más tarde.
            </p>
          )}

          <fieldset className="mt-4">
            <legend className="text-[11px] font-bold tracking-wide uppercase text-faint mb-2">
              Documentos para verificarte
            </legend>
            <div className="grid grid-cols-2 gap-2.5">
              <CampoArchivo etiqueta="DNI (frente)" archivo={dniFrente} onElegir={setDniFrente} />
              <CampoArchivo etiqueta="DNI (dorso)" archivo={dniDorso} onElegir={setDniDorso} />
              <CampoArchivo etiqueta="Selfie" archivo={selfie} onElegir={setSelfie} />
              <CampoArchivo
                etiqueta="Título o matrícula"
                archivo={matricula}
                onElegir={setMatricula}
                opcional
              />
            </div>
            {esAltaNueva && (
              <p className="text-[11.5px] text-faint mt-1.5 px-1 leading-snug">
                DNI y selfie son obligatorios para que operaciones pueda verificarte. El título o
                matrícula lo podés sumar ahora o después.
              </p>
            )}
            {errorDocumentos && <p className="text-[12px] text-urgent mt-1.5 px-1">{errorDocumentos}</p>}
          </fieldset>

          <label className="mt-4 flex items-center gap-2.5 px-1 cursor-pointer">
            <input
              type="checkbox"
              checked={datos.disponible}
              onChange={(e) => setDatos((d) => ({ ...d, disponible: e.target.checked }))}
              className="w-4 h-4 accent-[#0E5C54]"
            />
            <span className="text-[13px] text-mute">Estoy disponible para tomar trabajos ahora</span>
          </label>

          {errorGuardar && (
            <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
              {errorGuardar}
            </p>
          )}

          <button
            type="submit"
            className="press mt-5 w-full rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab disabled:opacity-40"
            disabled={!valido || guardando}
          >
            {guardando ? "Guardando…" : estado ? "Guardar cambios" : "Sumarme como trabajador"}
          </button>

          <p className="text-[11.5px] text-faint text-center mt-3 leading-snug">
            No implica pagos ni contratos todavía. Es sólo el primer paso: contarnos qué ofrecés y
            dónde.
          </p>
        </form>
        )}
      </div>
    </>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  ...props
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string | false;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mt-3">
      <label
        htmlFor={id}
        className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
      >
        {etiqueta}
      </label>
      <input
        id={id}
        type="text"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined}
        className={`w-full rounded-2xl bg-surface border shadow-card px-4 py-3.5 text-[14px] text-ink placeholder:text-faint outline-none ${
          error ? "border-urgent" : "border-line focus:border-brand-300"
        }`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-urgent mt-1 px-1">
          {error}
        </p>
      ) : ayuda ? (
        <p id={`${id}-ayuda`} className="text-[12px] text-faint mt-1 px-1">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

/* Selector de un documento. Se elige y listo — la subida real pasa
   recién al enviar el formulario entero (ver enviar()), así un
   documento elegido y después descartado (cancelás el formulario) no
   deja nada guardado a medias. */
function CampoArchivo({
  etiqueta,
  archivo,
  onElegir,
  opcional,
}: {
  etiqueta: string;
  archivo: File | null;
  onElegir: (archivo: File | null) => void;
  opcional?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onElegir(f);
        }}
        className="hidden"
        aria-label={etiqueta}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`press w-full flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3.5 px-2 text-center ${
          archivo ? "border-good bg-good/10" : "border-dashed border-line bg-surface"
        }`}
      >
        {archivo ? <Check className="w-4 h-4 text-good" /> : <Camera className="w-4 h-4 text-faint" />}
        <span className="text-[11.5px] font-medium text-mute leading-tight">
          {etiqueta}
          {opcional && <span className="text-faint"> (opcional)</span>}
        </span>
        {archivo && <span className="text-[10.5px] text-good font-semibold">Listo</span>}
      </button>
    </div>
  );
}
