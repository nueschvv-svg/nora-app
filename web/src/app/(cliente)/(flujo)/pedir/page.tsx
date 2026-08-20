"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Clock,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { Bloque } from "@/componentes/Esqueleto";
import { crearServicio, listarCategorias, subirFotoServicio, type CategoriaBD } from "@/lib/datos";
import { diagnosticarFoto, type ResultadoDiagnostico } from "@/lib/diagnosticarCliente";
import { enrutarPedido } from "@/lib/enrutarPedidoCliente";
import { actualizarMisDatosPersonales } from "@/lib/perfil";

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

/* FLUJO DE PEDIDO — versión MVP honesta.

   Diferencias a propósito con el prototipo:
   · No hay presupuesto instantáneo garantizado. Cuando Nora identifica
     el trabajo con confianza, sí mostramos un rango — lo calcula
     lib/precios.ts con las tarifas de la base, no lo inventa el modelo.
     Cuando no puede identificarlo, prometemos presupuesto antes de
     empezar, como siempre.
   · No hay pago acá. Se cobra al terminar, con link de Mercado Pago.

   Todo eso vuelve en fase 3, cuando haya datos que lo sostengan. */

const FRANJAS = [
  { id: "manana", texto: "Mañana · 8 a 12 h" },
  { id: "tarde-1", texto: "Tarde · 13 a 17 h" },
  { id: "tarde-2", texto: "Tarde · 17 a 20 h" },
  { id: "urgente", texto: "Lo antes posible" },
];

const PASOS = ["Categoría", "El problema", "Cuándo", "Confirmar"];

export default function PaginaPedir() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { propiedad, agregarPropiedad } = useApp();

  const [paso, setPaso] = useState(0);
  const [categoria, setCategoria] = useState<string | null>(null);
  /* Si se llega acá desde el chat de Inicio ("contanos qué pasa..."),
     el texto ya escrito viaja en la URL — se precarga acá para no
     hacer a la persona escribirlo dos veces. Sólo se lee una vez, al
     montar: si después cambia la URL (el usuario vuelve atrás y
     entra de nuevo, por ejemplo) no le pisa lo que ya haya tipeado. */
  const [descripcion, setDescripcion] = useState(() => searchParams.get("texto") ?? "");
  const [dia, setDia] = useState<string | null>(null);
  const [franja, setFranja] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  /* Sin cuentas: nadie carga nombre/teléfono/domicilio en un registro
     aparte — se piden acá, la primera vez que hace falta un domicilio
     para mandar un pedido. agregarPropiedad() ya deja `propiedad`
     con valor apenas resuelve (ver ContextoApp), así que ni bien se
     guarda, este mismo componente sigue derecho al paso 0 solo. */
  const [nombreInicial, setNombreInicial] = useState("");
  const [telefonoInicial, setTelefonoInicial] = useState("");
  const [calleInicial, setCalleInicial] = useState("");
  const [numeroInicial, setNumeroInicial] = useState("");
  const [localidadInicial, setLocalidadInicial] = useState("");
  const [provinciaInicial, setProvinciaInicial] = useState("Buenos Aires");
  const [guardandoInicial, setGuardandoInicial] = useState(false);
  const [errorInicial, setErrorInicial] = useState<string | null>(null);

  const datosInicialesValidos =
    nombreInicial.trim().length >= 2 &&
    calleInicial.trim() !== "" &&
    numeroInicial.trim() !== "" &&
    localidadInicial.trim() !== "";

  const enviarDatosIniciales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datosInicialesValidos || guardandoInicial) return;
    setGuardandoInicial(true);
    setErrorInicial(null);
    try {
      await Promise.all([
        actualizarMisDatosPersonales({ nombre: nombreInicial, telefono: telefonoInicial }),
        agregarPropiedad({
          nombre: "Mi casa",
          calle: calleInicial,
          numero: numeroInicial,
          localidad: localidadInicial,
          provincia: provinciaInicial,
          icono: "home",
        }),
      ]);
    } catch (e) {
      setErrorInicial(e instanceof Error ? e.message : "No pudimos guardar tus datos.");
      setGuardandoInicial(false);
    }
  };
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categorias, setCategorias] = useState<CategoriaBD[]>([]);
  const [cargandoCats, setCargandoCats] = useState(true);

  /* Foto + diagnóstico. La foto vive sólo acá (en memoria del navegador)
     hasta que se manda a analizar — no se sube a ningún lado todavía:
     el almacenamiento de fotos (bucket privado de Supabase) sigue
     pendiente, ver ESTADO.md. Lo que SÍ es real es el análisis: pega
     contra /api/diagnosticar, el mismo endpoint probado con Claude. */
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<ResultadoDiagnostico | null>(null);

  const elegirFoto = () => inputFotoRef.current?.click();

  const alCambiarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!archivo) return;

    setFoto(archivo);
    setDiagnostico(null);
    setErrorFoto(null);
    setAnalizando(true);
    try {
      const resultado = await diagnosticarFoto({ foto: archivo, descripcion, categoriaSlug: categoria });
      setDiagnostico(resultado);
    } catch (err) {
      setErrorFoto(err instanceof Error ? err.message : "No pudimos analizar la foto.");
    } finally {
      setAnalizando(false);
    }
  };

  const quitarFoto = () => {
    setFoto(null);
    setDiagnostico(null);
    setErrorFoto(null);
  };

  /* Antes esto sólo pasaba si mandabas una foto — la mitad de la gracia
     de Nora (contarle qué pasa y que te tire un estimado ahí mismo) no
     andaba para quien sólo escribe. Se dispara solo, con un respiro
     después de dejar de tipear, y sólo si no hay foto puesta (la foto
     ya dispara su propio análisis en alCambiarFoto — no tiene sentido
     duplicar la llamada). Si el rubro no tiene catálogo de IA todavía,
     el endpoint devuelve identificado:false — no se inventa nada, se
     lo decimos de frente más abajo (ResultadoAnalisis). */
  useEffect(() => {
    if (foto) return;
    const texto = descripcion.trim();
    if (texto.length < 10) return;

    let vigente = true;
    const espera = setTimeout(() => {
      setAnalizando(true);
      setErrorFoto(null);
      diagnosticarFoto({ descripcion: texto, categoriaSlug: categoria })
        .then((resultado) => {
          /* Si mientras esperábamos la respuesta la persona siguió
             tipeando, ya hay un pedido más nuevo en camino — descartar
             éste evita que una respuesta lenta y vieja pise el
             diagnóstico de lo que realmente escribió al final. */
          if (vigente) setDiagnostico(resultado);
        })
        .catch((err) => {
          if (vigente) setErrorFoto(err instanceof Error ? err.message : "No pudimos analizar el problema.");
        })
        .finally(() => {
          if (vigente) setAnalizando(false);
        });
    }, 900);

    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [descripcion, foto, categoria]);

  /* Los rubros salen de la base, no del código: así podés activar
     "Gas" cuando consigas un gasista matriculado, sin tocar la app.
     cargarCategorias() no se llama nunca sincrónicamente adentro del
     efecto — sólo dispara la promesa; los estados de carga/error ya
     arrancan en su valor correcto (cargandoCats=true, errorCats=false)
     así que no hace falta resetearlos de nuevo en el primer render. */
  const [errorCats, setErrorCats] = useState(false);
  const cargarCategorias = () => {
    listarCategorias()
      .then(setCategorias)
      .catch(() => setErrorCats(true))
      .finally(() => setCargandoCats(false));
  };
  useEffect(() => {
    cargarCategorias();
  }, []);

  const reintentarCategorias = () => {
    setCargandoCats(true);
    setErrorCats(false);
    cargarCategorias();
  };

  const proximosDias = obtenerProximosDias();
  const catElegida = categorias.find((c) => c.slug === categoria);

  /* Igual que el endpoint: alcanza con la foto, no hace falta escribir
     nada. Antes de esto el paso 1 exigía 10 caracteres pase lo que
     pase, lo que no tenía sentido si ya mandaste una foto. */
  const puedeAvanzar =
    (paso === 0 && !!categoria) ||
    (paso === 1 && (descripcion.trim().length >= 10 || !!foto)) ||
    (paso === 2 && !!dia && !!franja) ||
    paso === 3;

  /* Lo que ve operaciones. La persona sigue viendo y
     editando sólo su propio texto en el campo — esto se arma recién al
     mandar, para no meterle a la textarea palabras que no escribió.

     El estimado de precio se suma acá aparte: antes se le mostraba al
     cliente en pantalla y se perdía — operaciones no lo veía nunca y
     tenía que recalcularlo a mano desde cero. Ahora queda escrito en el
     mismo lugar donde operaciones ya mira ("El problema"), con las
     mismas palabras que ya vio el cliente, sin reformatear nada. */
  const lineaEstimado = diagnostico?.estimado
    ? `[Estimado de Nora] ${diagnostico.trabajo ? `${diagnostico.trabajo.nombre}: ` : ""}${diagnostico.estimado.titulo} — ${diagnostico.estimado.aclaracion}`
    : null;

  const descripcionFinal = diagnostico?.observaciones
    ? [descripcion.trim(), `[Foto analizada por Nora] ${diagnostico.observaciones}`, lineaEstimado]
        .filter(Boolean)
        .join("\n\n")
    : descripcion;

  const avanzar = async () => {
    if (!puedeAvanzar || enviando) return;

    if (paso === 3) {
      if (!propiedad || !categoria) return;
      setEnviando(true);
      setError(null);
      try {
        const nuevoServicio = await crearServicio({
          propiedadId: propiedad.id,
          categoriaSlug: categoria,
          descripcion: descripcionFinal,
          fechaPreferida: dia,
          franjaPreferida: franja,
          estimadoDesdeArs: diagnostico?.estimado?.desdeArs ?? null,
          estimadoHastaArs: diagnostico?.estimado?.hastaArs ?? null,
        });

        /* Lo único que de verdad tiene que pasar antes de mostrarle
           "pedido enviado" a la persona es crearServicio() de arriba —
           eso es lo que lo hace visible para operaciones. Subir la foto
           y avisar por Telegram son un plus, ninguno de los dos
           requisito (si fallan, el pedido ya está adentro igual, ver
           comentarios de cada función) — así que no hay motivo para
           tener a la persona mirando un spinner mientras se suben y
           esperan la vuelta de un servidor externo. Corren en
           background, en el mismo orden de antes (foto primero, para
           que el aviso pueda incluir su URL). */
        (async () => {
          if (foto) {
            try {
              await subirFotoServicio(nuevoServicio.id, foto);
            } catch (e) {
              console.error("[pedir] no se pudo guardar la foto:", e);
            }
          }
          try {
            await enrutarPedido(nuevoServicio.id, diagnostico);
          } catch (e) {
            console.error("[pedir] no se pudo avisar del pedido:", e);
          }
        })();

        setEnviado(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos enviar el pedido.");
      } finally {
        setEnviando(false);
      }
      return;
    }

    setPaso(paso + 1);
  };

  if (!propiedad) {
    return (
      <div className="absolute inset-0 z-40 bg-sand flex flex-col">
        <div className="px-5 pt-12 pb-3 flex items-center gap-3">
          <Link
            href="/inicio"
            className="press w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
            aria-label="Salir"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </Link>
        </div>

        <form onSubmit={enviarDatosIniciales} className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6">
          <h1 className="text-[22px] font-bold font-display text-ink leading-tight">
            Antes de
            <br />
            arrancar
          </h1>
          <p className="text-[13px] text-mute mt-1.5">
            Necesitamos saber quién sos y a dónde vamos — sólo una vez.
          </p>

          <CampoTexto
            id="nombre-inicial"
            etiqueta="Tu nombre"
            value={nombreInicial}
            onChange={(e) => setNombreInicial(e.target.value)}
            autoComplete="name"
          />
          <CampoTexto
            id="telefono-inicial"
            etiqueta="Teléfono"
            ayuda="Para avisarte del pedido si hace falta."
            type="tel"
            inputMode="tel"
            value={telefonoInicial}
            onChange={(e) => setTelefonoInicial(e.target.value)}
            autoComplete="tel"
            placeholder="11 1234 5678"
          />

          <div className="grid grid-cols-[1fr_92px] gap-2.5">
            <CampoTexto
              id="calle-inicial"
              etiqueta="Calle"
              value={calleInicial}
              onChange={(e) => setCalleInicial(e.target.value)}
              autoComplete="address-line1"
            />
            <CampoTexto
              id="numero-inicial"
              etiqueta="Altura"
              inputMode="numeric"
              value={numeroInicial}
              onChange={(e) => setNumeroInicial(e.target.value)}
            />
          </div>

          <CampoTexto
            id="localidad-inicial"
            etiqueta="Localidad"
            value={localidadInicial}
            onChange={(e) => setLocalidadInicial(e.target.value)}
            autoComplete="address-level2"
          />

          <div className="mt-3">
            <label
              htmlFor="provincia-inicial"
              className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5"
            >
              Provincia
            </label>
            <select
              id="provincia-inicial"
              value={provinciaInicial}
              onChange={(e) => setProvinciaInicial(e.target.value)}
              className="w-full rounded-2xl bg-surface border border-line shadow-card px-4 py-3.5 text-[14px] text-ink outline-none focus:border-brand-300"
            >
              {PROVINCIAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {errorInicial && (
            <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mt-4">
              {errorInicial}
            </p>
          )}

          <button
            type="submit"
            disabled={!datosInicialesValidos || guardandoInicial}
            className="press mt-5 w-full flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white px-5 py-4 shadow-fab text-[15.5px] font-semibold disabled:opacity-40 disabled:pointer-events-none"
          >
            {guardandoInicial && <Loader2 className="w-[18px] h-[18px] animate-spin" />}
            {guardandoInicial ? "Guardando…" : "Continuar"}
            {!guardandoInicial && <ArrowRight className="w-[19px] h-[19px]" />}
          </button>
        </form>
      </div>
    );
  }

  if (enviado) return <Confirmacion propiedad={propiedad.nombre} />;

  return (
    <div className="absolute inset-0 z-40 bg-sand flex flex-col">
      {/* --- Encabezado con progreso --- */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => (paso === 0 ? router.push("/inicio") : setPaso(paso - 1))}
          className="press w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
          aria-label={paso === 0 ? "Salir" : "Paso anterior"}
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <div className="flex-1">
          <div
            className="h-1.5 w-full rounded-full bg-line overflow-hidden"
            role="progressbar"
            aria-valuenow={paso + 1}
            aria-valuemin={1}
            aria-valuemax={PASOS.length}
            aria-label={`Paso ${paso + 1} de ${PASOS.length}: ${PASOS[paso]}`}
          >
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
              style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }}
            />
          </div>
        </div>
        <Link
          href="/inicio"
          className="press w-10 h-10 grid place-items-center rounded-full bg-surface border border-line text-ink shadow-card"
          aria-label="Cerrar"
        >
          <X className="w-[18px] h-[18px]" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6">
        {/* ---------- PASO 0: categoría ---------- */}
        {paso === 0 && (
          <section>
            <h1 className="text-[22px] font-bold font-display text-ink leading-tight">
              ¿Qué necesitás
              <br />
              resolver?
            </h1>
            <p className="text-[13px] text-mute mt-1.5">
              Arrancamos con estos rubros en {propiedad.localidad}. Vamos sumando más.
            </p>

            {cargandoCats && (
              <div className="grid grid-cols-3 gap-3 mt-5">
                {Array.from({ length: 9 }, (_, i) => (
                  <Bloque key={i} className="h-[92px] rounded-2xl" />
                ))}
              </div>
            )}

            {!cargandoCats && errorCats && (
              <div className="mt-5 rounded-xl2 bg-urgent/10 px-4 py-4 text-center">
                <p role="alert" className="text-[13px] text-urgent">
                  No pudimos cargar los rubros.
                </p>
                <button
                  type="button"
                  onClick={reintentarCategorias}
                  className="press mt-2.5 text-[13px] font-semibold text-urgent underline underline-offset-2"
                >
                  Reintentar
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mt-5">
              {categorias.map((c) => {
                const elegida = categoria === c.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    disabled={!c.activa}
                    onClick={() => setCategoria(c.slug)}
                    aria-pressed={elegida}
                    aria-label={c.activa ? c.nombre : `${c.nombre} — todavía no disponible`}
                    className={`press relative flex flex-col items-center gap-2 rounded-2xl border shadow-card py-4 px-1 ${
                      !c.activa
                        ? "bg-surface/50 border-line opacity-55 cursor-not-allowed"
                        : elegida
                          ? "bg-surface border-brand-500 ring-2 ring-brand-500"
                          : "bg-surface border-line"
                    }`}
                  >
                    <span className={c.activa ? "text-brand-600" : "text-faint"}>
                      <IconoEquipo nombre={c.icono} className="w-6 h-6" />
                    </span>
                    <span className="text-[12px] font-medium text-mute text-center leading-tight">
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
          </section>
        )}

        {/* ---------- PASO 1: el problema ---------- */}
        {paso === 1 && (
          <section>
            <h1 className="text-[22px] font-bold font-display text-ink leading-tight">
              Contanos qué
              <br />
              está pasando
            </h1>
            <p className="text-[13px] text-mute mt-1.5">
              Cuanto más detalle nos des, mejor preparados llegamos.
            </p>

            <div className="mt-4 rounded-2xl bg-surface border border-line shadow-card p-3 flex items-center gap-3">
              <span className="w-8 h-8 grid place-items-center rounded-lg bg-brand-50 text-brand-600">
                <IconoEquipo nombre={propiedad.icono} className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink truncate">
                  {propiedad.nombre} · {propiedad.direccion}
                </p>
                <p className="text-[11px] text-faint">{catElegida?.nombre}</p>
              </div>
            </div>

            <label htmlFor="descripcion" className="sr-only">
              Descripción del problema
            </label>
            <textarea
              id="descripcion"
              rows={5}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: pierde agua la conexión de abajo de la bacha de la cocina, gotea desde ayer."
              className="mt-3 w-full rounded-2xl bg-surface border border-line shadow-card p-4 text-[14px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
            />
            <p className="text-[11.5px] text-faint mt-1.5 px-1">
              {descripcion.trim().length >= 10 || foto
                ? "Perfecto, con eso alcanza."
                : "Escribí unas palabras o mandá una foto — con cualquiera de las dos alcanza."}
            </p>

            {/* La foto se manda a analizar apenas se elige: es lo que
                más ayuda a llegar preparados, y de paso le
                muestra a la persona qué ve Nora en el momento. */}
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={alCambiarFoto}
              className="hidden"
              aria-label="Sacar o elegir una foto del problema"
            />

            {!foto ? (
              <button
                type="button"
                onClick={elegirFoto}
                className="press mt-3 w-full flex items-center justify-center gap-2 rounded-xl2 border border-dashed border-brand-200 text-brand-600 py-3.5 text-[14px] font-semibold"
              >
                <Camera className="w-[17px] h-[17px]" />
                Sumar una foto (opcional)
              </button>
            ) : (
              <div className="mt-3 rounded-xl2 border border-brand-200 bg-surface shadow-card p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="shrink-0 w-9 h-9 grid place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Camera className="w-4 h-4" />
                  </span>
                  <p className="flex-1 min-w-0 text-[13px] font-medium text-ink truncate">
                    {foto.name}
                  </p>
                  <button
                    type="button"
                    onClick={quitarFoto}
                    className="press shrink-0 w-7 h-7 grid place-items-center rounded-full bg-sand border border-line text-faint"
                    aria-label="Quitar foto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Estado del análisis: aplica tanto si mandaste foto como si
                sólo escribiste — Nora mira lo que tenga, foto o texto. */}
            {(analizando || errorFoto || diagnostico) && (
              <div className="mt-3 rounded-xl2 border border-brand-200 bg-surface shadow-card p-3.5">
                {analizando && (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-brand-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {foto ? "Nora está mirando la foto…" : "Nora está analizando…"}
                  </p>
                )}

                {errorFoto && (
                  <p role="alert" className="text-[12.5px] text-urgent">
                    {errorFoto}
                  </p>
                )}

                {diagnostico && <ResultadoAnalisis resultado={diagnostico} />}
              </div>
            )}
          </section>
        )}

        {/* ---------- PASO 2: cuándo ---------- */}
        {paso === 2 && (
          <section>
            <h1 className="text-[22px] font-bold font-display text-ink leading-tight">
              ¿Cuándo te
              <br />
              viene bien?
            </h1>
            <p className="text-[13px] text-mute mt-1.5">
              Elegí día y franja. Te confirmamos el horario exacto.
            </p>

            <div className="mt-5 flex gap-2.5 overflow-x-auto no-scrollbar -mx-5 px-5">
              {proximosDias.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => setDia(d.iso)}
                  aria-pressed={dia === d.iso}
                  className={`press shrink-0 w-[64px] rounded-2xl border bg-surface shadow-card py-3 flex flex-col items-center gap-0.5 ${
                    dia === d.iso ? "border-brand-500 ring-2 ring-brand-500" : "border-line"
                  }`}
                >
                  <span className="text-[11px] text-faint uppercase">{d.diaSemana}</span>
                  <span className="num text-[18px] font-bold text-ink">{d.numero}</span>
                  <span className="text-[11px] text-faint">{d.mes}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {FRANJAS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFranja(f.id)}
                  aria-pressed={franja === f.id}
                  className={`press rounded-2xl border bg-surface shadow-card py-3.5 px-2 text-[13.5px] font-semibold text-ink ${
                    franja === f.id ? "border-brand-500 ring-2 ring-brand-500" : "border-line"
                  }`}
                >
                  {f.texto}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------- PASO 3: confirmar ---------- */}
        {paso === 3 && (
          <section>
            <h1 className="text-[22px] font-bold font-display text-ink leading-tight">
              Revisá y
              <br />
              enviá el pedido
            </h1>

            <div className="mt-5 rounded-xl2 bg-surface border border-line shadow-card divide-y divide-line overflow-hidden">
              <Fila etiqueta="Servicio" valor={catElegida?.nombre ?? "—"} />
              <Fila etiqueta="Domicilio" valor={`${propiedad.nombre} · ${propiedad.direccion}`} />
              <Fila
                etiqueta="Cuándo"
                valor={(() => {
                  const diaTxt = proximosDias.find((d) => d.iso === dia)?.etiquetaLarga ?? "—";
                  const franjaTxt = FRANJAS.find((f) => f.id === franja)?.texto ?? "";
                  const franjaCorta = franjaTxt.includes(" · ") ? franjaTxt.split(" · ")[1] : franjaTxt;
                  return `${diaTxt} · ${franjaCorta}`;
                })()}
              />
              {foto && <Fila etiqueta="Foto" valor={diagnostico ? "Analizada por Nora" : foto.name} />}
            </div>

            <div className="mt-3 rounded-xl2 bg-surface border border-line shadow-card p-4">
              <p className="text-[11px] font-bold tracking-wide uppercase text-faint">El problema</p>
              <p className="text-[13.5px] text-ink leading-relaxed mt-1.5 whitespace-pre-line">
                {descripcionFinal}
              </p>
            </div>

            {/* Ser claro con el precio evita el 90% de los problemas después. */}
            <div className="mt-3 flex items-start gap-2.5 rounded-xl2 bg-brand-50 border border-brand-100 px-3.5 py-3">
              <Clock className="w-[18px] h-[18px] text-brand-600 shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink leading-snug">
                En menos de <span className="font-semibold">2 horas</span> vas a ver en tu Historial el
                estado de tu pedido y el precio confirmado — todo en Nora,{" "}
                <span className="font-semibold">antes</span> de que arranque el trabajo: no se cobra
                nada hasta entonces.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* --- Pie con el botón de avance --- */}
      <div className="px-5 pb-7 pt-2 bg-gradient-to-t from-sand via-sand to-transparent">
        {error && (
          <p role="alert" className="text-[13px] text-urgent bg-urgent/10 rounded-xl2 px-3.5 py-3 mb-2.5">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={avanzar}
          disabled={!puedeAvanzar || enviando}
          className="press w-full flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white px-5 py-4 shadow-fab text-[15.5px] font-semibold disabled:opacity-40 disabled:pointer-events-none"
        >
          {enviando && <Loader2 className="w-[18px] h-[18px] animate-spin" />}
          {enviando ? "Enviando…" : paso === 3 ? "Enviar pedido" : "Continuar"}
          {!enviando && <ArrowRight className="w-[19px] h-[19px]" />}
        </button>
      </div>
    </div>
  );
}

/* Lo que Nora vio en la foto. Sin inventar nada que el endpoint no haya
   devuelto: si no identificó el trabajo, se lo decimos de frente y
   mostramos las preguntas en vez de forzar un diagnóstico. */
function ResultadoAnalisis({ resultado }: { resultado: ResultadoDiagnostico }) {
  return (
    <div className="space-y-2.5">
      {resultado.riesgoInmediato && (
        <div className="flex items-start gap-2 rounded-xl2 bg-urgent/10 px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-urgent shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-urgent font-medium leading-snug">
            Esto puede necesitar atención inmediata. Si hay riesgo real (agua cerca de instalación
            eléctrica, olor a gas), priorizalo.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
        <p className="text-[13px] text-ink leading-snug">{resultado.observaciones}</p>
      </div>

      {resultado.identificado && resultado.trabajo ? (
        <div className="rounded-xl2 bg-brand-50 border border-brand-100 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-ink">{resultado.trabajo.nombre}</p>
          {resultado.estimado && (
            <>
              <p className="text-[13px] font-bold text-brand-600 mt-0.5">{resultado.estimado.titulo}</p>
              <p className="text-[11px] text-faint mt-0.5">{resultado.estimado.aclaracion}</p>
            </>
          )}
        </div>
      ) : (
        /* No identificamos el trabajo puntual, pero si conocemos el rubro
           igual mostramos cuánto sale como mínimo ir a verlo — nunca
           dejamos a la persona sin ningún número. */
        resultado.estimado && (
          <div className="rounded-xl2 bg-brand-50 border border-brand-100 px-3 py-2.5">
            <p className="text-[13px] font-bold text-brand-600">{resultado.estimado.titulo}</p>
            <p className="text-[11px] text-faint mt-0.5">{resultado.estimado.aclaracion}</p>
          </div>
        )
      )}

      {resultado.preguntas.length > 0 && (
        <ul className="space-y-1">
          {resultado.preguntas.map((p) => (
            <li key={p} className="text-[12px] text-mute pl-3 relative before:content-['·'] before:absolute before:left-0">
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CampoTexto({
  id,
  etiqueta,
  ayuda,
  ...props
}: { id: string; etiqueta: string; ayuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mt-3">
      <label htmlFor={id} className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
        {etiqueta}
      </label>
      <input
        id={id}
        type="text"
        className="w-full rounded-2xl bg-surface border border-line shadow-card px-4 py-3.5 text-[14px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
        {...props}
      />
      {ayuda && <p className="text-[12px] text-faint mt-1 px-1">{ayuda}</p>}
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-[13px] text-mute shrink-0">{etiqueta}</span>
      <span className="text-[13px] font-semibold text-ink text-right">{valor}</span>
    </div>
  );
}

function Confirmacion({ propiedad }: { propiedad: string }) {
  return (
    <div className="absolute inset-0 z-40 bg-sand flex flex-col items-center justify-center text-center px-8">
      <div className="w-24 h-24 grid place-items-center rounded-full bg-good/15 text-good">
        <Check className="w-11 h-11" />
      </div>
      <h1 className="text-[24px] font-bold font-display text-ink mt-6">¡Pedido enviado!</h1>
      <p className="text-[13.5px] text-mute mt-2.5 max-w-[290px] leading-relaxed">
        Ya lo estamos viendo. En menos de 2 horas vas a ver en tu Historial el estado y el precio
        confirmado para {propiedad}.
      </p>
      <Link
        href="/inicio"
        className="press mt-8 w-full max-w-[290px] flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

/** Los próximos 7 días, listos para mostrar. */
function obtenerProximosDias() {
  const DIAS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const hoy = new Date();

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    return {
      iso: d.toISOString().slice(0, 10),
      diaSemana: i === 0 ? "HOY" : i === 1 ? "MAÑ" : DIAS[d.getDay()],
      numero: d.getDate(),
      mes: MESES[d.getMonth()],
      etiquetaLarga: i === 0 ? "Hoy" : `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`,
    };
  });
}
