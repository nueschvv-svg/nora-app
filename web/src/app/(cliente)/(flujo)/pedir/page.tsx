"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Clock,
  Loader2,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";

import { useApp } from "@/componentes/ContextoApp";
import { IconoEquipo } from "@/componentes/IconoEquipo";
import { Bloque } from "@/componentes/Esqueleto";
import { TituloPaso } from "@/componentes/TituloPaso";
import { useEntradaEscalonada } from "@/lib/useEntradaEscalonada";
import { crearServicio, listarCategorias, subirFotoServicio, type CategoriaBD } from "@/lib/datos";
import { diagnosticarFoto, type ResultadoDiagnostico } from "@/lib/diagnosticarCliente";
import { enrutarPedido } from "@/lib/enrutarPedidoCliente";
import { mandarComprobantePorMail } from "@/lib/mailComprobanteCliente";
import { actualizarMisDatosPersonales, misDatosPersonales } from "@/lib/perfil";
import { type Propiedad, type Servicio } from "@/lib/tipos";

/* Acotado a la zona donde de verdad tenemos cobertura hoy — antes
   listaba las 24 provincias argentinas, dando a entender que
   podíamos llegar a cualquier lado del país. Volver a sumar
   provincias cuando haya técnicos reales fuera de CABA/GBA. */
const PROVINCIAS = ["CABA", "Buenos Aires"];

/* FLUJO DE PEDIDO — versión MVP honesta.

   Diferencias a propósito con el prototipo:
   · No hay presupuesto instantáneo garantizado. Cuando Nora identifica
     el trabajo con confianza, sí mostramos un rango — lo calcula
     lib/precios.ts con las tarifas de la base, no lo inventa el modelo.
     Cuando no puede identificarlo, prometemos presupuesto antes de
     empezar, como siempre.
   · No hay pago acá. Se cobra al terminar, con link de Mercado Pago.

   Todo eso vuelve en fase 3, cuando haya datos que lo sostengan. */

/* `horaFin`: hasta qué hora del día tiene sentido ofrecer la franja —
   pasada esa hora, mostrarla para "hoy" sería prometer un horario que
   ya no existe. "Lo antes posible" no tiene franja fija, así que
   siempre está disponible (null = sin límite). */
const FRANJAS = [
  { id: "manana", texto: "Mañana · 8 a 12 h", horaFin: 12 },
  { id: "tarde-1", texto: "Tarde · 13 a 17 h", horaFin: 17 },
  { id: "tarde-2", texto: "Tarde · 17 a 20 h", horaFin: 20 },
  { id: "urgente", texto: "Lo antes posible", horaFin: null as number | null },
];

export default function PaginaPedir() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { propiedad, agregarPropiedad } = useApp();

  /* Sin cuentas: nadie carga domicilio/teléfono en un registro aparte de
     antemano — se piden como parte del pedido. El paso "Contacto"
     SIEMPRE está en el flujo (antes se salteaba entero si ya había un
     domicilio guardado de una sesión anterior — eso reusaba nombre,
     teléfono y dirección viejos EN SILENCIO, sin mostrárselos a la
     persona: si esta vez el pedido era para otra casa, no había forma
     de notarlo antes de mandarlo). Ahora, si ya hay datos guardados,
     este paso los muestra para CONFIRMAR — "Continuar con estos
     datos" sigue de largo sin re-preguntar nada, "Usar otros datos"
     abre el formulario de siempre. */
  const [propiedadGuardada, setPropiedadGuardada] = useState<Propiedad | null>(null);
  const propiedadActual = propiedad ?? propiedadGuardada;

  /* true = mostrando el formulario editable (como era antes, siempre);
     false = mostrando el resumen de "¿seguimos con esto?". Arranca en
     `false` sólo si YA hay una propiedad guardada al montar — recién
     ahí tiene sentido preguntar "¿seguimos con estos datos?". Se
     decide una vez, no en cada render, por el mismo motivo de antes:
     que no cambie de golpe a mitad de flujo. */
  const [editandoContacto, setEditandoContacto] = useState(() => !propiedad);
  const [perfilPrevio, setPerfilPrevio] = useState<{ nombre: string; telefono: string } | null>(null);
  const [cargandoPerfilPrevio, setCargandoPerfilPrevio] = useState(() => !!propiedad);

  useEffect(() => {
    if (!propiedad) return;
    let vivo = true;
    misDatosPersonales()
      .then((datos) => {
        if (vivo) setPerfilPrevio({ nombre: datos.nombre, telefono: datos.telefono });
      })
      .catch(() => {
        /* Si falla, no bloqueamos el pedido — pasamos directo al
           formulario editable, como si no hubiera datos guardados. */
        if (vivo) setEditandoContacto(true);
      })
      .finally(() => {
        if (vivo) setCargandoPerfilPrevio(false);
      });
    return () => {
      vivo = false;
    };
    // Sólo depende de si HABÍA propiedad al montar, no de `propiedad`
    // en cada render (mismo motivo que arriba).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Al pasar a "usar otros datos": nombre y teléfono se prellenan (son
     de la persona, casi nunca cambian entre pedidos) pero el domicilio
     queda en blanco a propósito — si está acá es porque quiere cargar
     una dirección distinta, precargar la vieja sería justo el error
     que se está tratando de evitar. */
  const usarOtrosDatos = () => {
    if (perfilPrevio) {
      setNombreInicial(perfilPrevio.nombre);
      setTelefonoInicial(perfilPrevio.telefono);
    }
    setEditandoContacto(true);
  };

  const PASOS = ["Categoría", "El problema", "Análisis", "Cuándo", "Contacto", "Confirmar"];
  const pasoAnalisis = 2;
  const pasoCuando = 3;
  const pasoContacto = 4;
  const pasoConfirmar = PASOS.length - 1;

  /* Si Nora ya identificó el rubro Y ya tiene contexto real del chat
     (los dos viajan juntos, ver ChatNora.tsx), no tiene sentido
     hacerla elegir categoría y volver a escribir el problema — eso ya
     pasó en la charla. Arranca directo en Análisis, que dispara solo
     el primer diagnóstico apenas monta (ver PasoAnalisis). Quien entra
     directo a /pedir (sin pasar por el chat) sigue el camino de
     siempre. */
  const [llegoDesdeChat] = useState(() => !!(searchParams.get("categoria") && searchParams.get("texto")));
  const [paso, setPaso] = useState(() => (llegoDesdeChat ? pasoAnalisis : 0));
  /* Si Nora ya identificó el rubro en el chat de Inicio, viaja acá en la
     URL y arranca preseleccionado — la persona igual puede cambiarlo en
     este mismo paso, esto sólo le ahorra un toque. */
  const [categoria, setCategoria] = useState<string | null>(() => searchParams.get("categoria"));
  /* Si se llega acá desde el chat de Inicio ("contanos qué pasa..."),
     el texto ya escrito viaja en la URL — se precarga acá para no
     hacer a la persona escribirlo dos veces. Sólo se lee una vez, al
     montar: si después cambia la URL (el usuario vuelve atrás y
     entra de nuevo, por ejemplo) no le pisa lo que ya haya tipeado.

     El resumen de la URL es sólo una frase de Nora — el contexto real
     (lo que la persona realmente escribió en la charla) viaja aparte
     por sessionStorage, ver ChatNora.tsx. Se lee una sola vez acá
     también, y se borra apenas se lee, para no reusarlo si más
     adelante se vuelve a entrar a /pedir de otra forma. */
  const [descripcion, setDescripcion] = useState(() => {
    const textoUrl = searchParams.get("texto") ?? "";
    if (typeof window === "undefined") return textoUrl;
    try {
      const crudo = sessionStorage.getItem("nora:contextoChat");
      if (!crudo) return textoUrl;
      sessionStorage.removeItem("nora:contextoChat");
      const datos = JSON.parse(crudo) as { mensajesCliente?: string[] };
      if (!datos.mensajesCliente?.length) return textoUrl;
      return [textoUrl, ...datos.mensajesCliente].join("\n\n").slice(0, 4000);
    } catch {
      return textoUrl;
    }
  });
  const [dia, setDia] = useState<string | null>(null);
  const [franja, setFranja] = useState<string | null>(null);
  const [servicioEnviado, setServicioEnviado] = useState<Servicio | null>(null);

  const [nombreInicial, setNombreInicial] = useState("");
  const [telefonoInicial, setTelefonoInicial] = useState("");
  /* Opcional a propósito: sólo sirve para mandar el comprobante por
     mail, no bloquea el pedido si no lo cargan. */
  const [mailInicial, setMailInicial] = useState("");
  const [calleInicial, setCalleInicial] = useState("");
  const [numeroInicial, setNumeroInicial] = useState("");
  const [localidadInicial, setLocalidadInicial] = useState("");
  const [provinciaInicial, setProvinciaInicial] = useState("Buenos Aires");

  /* El teléfono es el dato que más importa de los tres que pide este
     paso — sin él, operaciones no tiene forma de coordinar el pedido
     ni de avisarle al cliente si algo cambia. Antes era el único
     campo del paso que NO bloqueaba "Continuar" si quedaba vacío; el
     mensaje que le llega al equipo por Telegram literalmente decía
     "Teléfono: no cargado" en ese caso (ver lib/enrutamiento/telegram.ts).
     8 dígitos sin contar espacios/guiones alcanza para no aceptar "123"
     pero sin exigir un formato exacto — los números argentinos varían
     bastante en longitud según si llevan código de área. */
  const telefonoValido = telefonoInicial.replace(/\D/g, "").length >= 8;

  /* Mail sigue siendo opcional (sólo sirve para el comprobante) — acá
     sólo se valida el FORMATO, y sólo si escribieron algo. Antes no
     había ninguna validación de mail en el código, pese a que el
     campo ya pedía type="email": un mail mal escrito se guardaba tal
     cual, sin avisar a nadie. */
  const MAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const mailValido = mailInicial.trim() === "" || MAIL_REGEX.test(mailInicial.trim());

  const datosInicialesValidos =
    nombreInicial.trim().length >= 2 &&
    telefonoValido &&
    mailValido &&
    calleInicial.trim() !== "" &&
    numeroInicial.trim() !== "" &&
    localidadInicial.trim() !== "";

  /* Antes, si los datos no eran válidos, "Continuar" quedaba
     deshabilitado sin ninguna explicación — la única pista era el
     botón en 40% de opacidad. Ahora el botón de este paso nunca se
     deshabilita por validación (ver puedeAvanzar): el click siempre
     llega a avanzar(), que revela los errores puntuales recién en ese
     momento (ver más abajo) — así cada campo dice específicamente qué
     falta, en vez de dejar a la persona adivinando. */
  const [intentoContinuarContacto, setIntentoContinuarContacto] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categorias, setCategorias] = useState<CategoriaBD[]>([]);
  const [cargandoCats, setCargandoCats] = useState(true);
  const gridCategoriasRef = useEntradaEscalonada<HTMLDivElement>(categorias.length > 0);

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

  /* Ya no dispara el análisis acá — sólo guarda el archivo y limpia el
     diagnóstico viejo. La única llamada a diagnosticarFoto() vive
     ahora en PasoAnalisis (ver más abajo), en un único efecto que
     reacciona tanto a la foto como al texto. Antes había DOS caminos
     (éste, más un efecto de sólo-texto que se cortaba en seco apenas
     había una foto puesta — `if (foto) return`) — ese era el motivo
     real de que, después de sumar una foto, seguir editando el texto
     no volviera a analizar nada. */
  const alCambiarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!archivo) return;
    setFoto(archivo);
    setDiagnostico(null);
    setErrorFoto(null);
  };

  const quitarFoto = () => {
    setFoto(null);
    setDiagnostico(null);
    setErrorFoto(null);
  };

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

  /* Si el día elegido es hoy, las franjas cuyo horario ya pasó no se
     ofrecen — mostrarlas sería prometer un horario imposible. */
  const franjasDisponibles =
    dia === proximosDias[0]?.iso
      ? FRANJAS.filter((f) => f.horaFin === null || new Date().getHours() < f.horaFin)
      : FRANJAS;

  /* Si cambiás de día y la franja que tenías elegida ya no es válida
     para el nuevo día (ej: elegiste "hoy" tarde y quedó sólo "lo antes
     posible"), se trata como no elegida — derivado en el render, no
     hace falta un efecto ni un setState extra para "corregir" el
     estado: ningún botón de franjasDisponibles queda marcado, y
     puedeAvanzar se calcula sobre este valor, no sobre `franja` crudo. */
  const franjaEfectiva = franjasDisponibles.some((f) => f.id === franja) ? franja : null;

  /* Igual que el endpoint: alcanza con la foto, no hace falta escribir
     nada. Antes de esto el paso 1 exigía 10 caracteres pase lo que
     pase, lo que no tenía sentido si ya mandaste una foto. */
  const puedeAvanzar =
    (paso === 0 && !!categoria) ||
    (paso === 1 && (descripcion.trim().length >= 10 || !!foto)) ||
    /* El paso Análisis nunca bloquea "Continuar" — Nora puede seguir
       pensando, puede no haber identificado nada todavía, o puede
       haber fallado: nada de eso debería trabar a la persona (puntos
       2 y 9 del pedido). */
    paso === pasoAnalisis ||
    (paso === pasoCuando && !!dia && !!franjaEfectiva) ||
    /* Ya no se gatea en datosInicialesValidos: el click siempre tiene
       que llegar a avanzar() para poder revelar los errores puntuales
       (ver avanzar() e intentoContinuarContacto). */
    (paso === pasoContacto && (editandoContacto || !cargandoPerfilPrevio)) ||
    paso === pasoConfirmar;

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

    if (paso === pasoContacto) {
      /* "Continuar con estos datos": ya están guardados de un pedido
         anterior, no hay nada que volver a mandar a la base. */
      if (!editandoContacto) {
        setPaso(paso + 1);
        return;
      }

      if (!datosInicialesValidos) {
        setIntentoContinuarContacto(true);
        return;
      }

      setEnviando(true);
      setError(null);
      try {
        const [, nuevaPropiedad] = await Promise.all([
          actualizarMisDatosPersonales({
            nombre: nombreInicial,
            telefono: telefonoInicial,
            mailContacto: mailInicial,
          }),
          agregarPropiedad({
            nombre: "Mi casa",
            calle: calleInicial,
            numero: numeroInicial,
            localidad: localidadInicial,
            provincia: provinciaInicial,
            icono: "home",
          }),
        ]);
        setPropiedadGuardada(nuevaPropiedad);
        setPaso(paso + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos guardar tus datos.");
      } finally {
        setEnviando(false);
      }
      return;
    }

    if (paso === pasoConfirmar) {
      if (!propiedadActual || !categoria) return;
      setEnviando(true);
      setError(null);
      try {
        const nuevoServicio = await crearServicio({
          propiedadId: propiedadActual.id,
          categoriaSlug: categoria,
          descripcion: descripcionFinal,
          fechaPreferida: dia,
          franjaPreferida: franja,
          estimadoDesdeArs: diagnostico?.estimado?.desdeArs ?? null,
          estimadoHastaArs: diagnostico?.estimado?.hastaArs ?? null,
        });

        /* Lo único que de verdad tiene que pasar antes de mostrarle
           "pedido enviado" a la persona es crearServicio() de arriba —
           eso es lo que lo hace visible para operaciones. Subir la foto,
           avisar por Telegram y mandar el comprobante por mail son un
           plus, ninguno de los tres requisito (si fallan, el pedido ya
           está adentro igual, ver comentarios de cada función) — así
           que no hay motivo para tener a la persona mirando un spinner
           mientras se suben y esperan la vuelta de un servidor externo.
           Corren en background, en el mismo orden de antes (foto primero, para
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
          try {
            await mandarComprobantePorMail(nuevoServicio.id);
          } catch (e) {
            console.error("[pedir] no se pudo mandar el comprobante:", e);
          }
        })();

        setServicioEnviado(nuevoServicio);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos enviar el pedido.");
      } finally {
        setEnviando(false);
      }
      return;
    }

    setPaso(paso + 1);
  };

  if (servicioEnviado) {
    return (
      <Confirmacion
        servicio={servicioEnviado}
        domicilio={propiedadActual ? `${propiedadActual.nombre} · ${propiedadActual.direccion}` : "—"}
        diaTexto={proximosDias.find((d) => d.iso === dia)?.etiquetaLarga ?? "—"}
        franjaTexto={FRANJAS.find((f) => f.id === franja)?.texto ?? "—"}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-40 bg-sand flex flex-col">
      {/* --- Encabezado con progreso ---
          max-w-xl mx-auto en las tres franjas (encabezado, contenido
          scrolleable, pie) — antes cada una ocupaba el ancho entero de
          la pantalla sin límite. En el celular no se nota (ya es
          angosto), pero en tablet/desktop la grilla de categorías y el
          textarea se estiraban a 1400px+ y quedaban con muchísimo aire
          vacío a los costados, más parecido a un layout roto que a un
          sitio prolijo. El fondo (bg-sand) sigue ocupando todo el
          ancho — sólo el contenido en sí se centra y se limita. */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3 max-w-xl mx-auto w-full">
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

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6 max-w-xl mx-auto w-full">
        {/* ---------- PASO 0: categoría ---------- */}
        {paso === 0 && (
          <section className="entra-paso">
            <TituloPaso>
              ¿Qué necesitás
              <br />
              resolver?
            </TituloPaso>
            <p className="text-[13px] text-mute mt-1.5">
              Arrancamos con estos rubros en {propiedadActual?.localidad ?? "tu zona"}. Vamos sumando más.
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

            <div ref={gridCategoriasRef} className="grid grid-cols-3 gap-3 mt-5">
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
                    className={`press relative flex flex-col items-center gap-2 rounded-2xl py-4 px-1 transition-colors ${
                      !c.activa
                        ? "glass opacity-55 cursor-not-allowed"
                        : elegida
                          ? "bg-brand-600 shadow-fab"
                          : "glass"
                    }`}
                  >
                    {elegida && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 grid place-items-center rounded-full bg-white text-brand-600">
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </span>
                    )}
                    <span className={elegida ? "text-white" : c.activa ? "text-brand-600" : "text-faint"}>
                      <IconoEquipo nombre={c.icono} className="w-6 h-6" />
                    </span>
                    <span
                      className={`text-[12px] font-medium text-center leading-tight ${elegida ? "text-white" : "text-mute"}`}
                    >
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
          <section className="entra-paso">
            <TituloPaso>
              Contanos qué
              <br />
              está pasando
            </TituloPaso>
            <p className="text-[13px] text-mute mt-1.5">
              Cuanto más detalle nos des, mejor preparados llegamos.
            </p>

            <div className="mt-4 rounded-2xl bg-surface border border-line shadow-card p-3 flex items-center gap-3">
              <span className="w-8 h-8 grid place-items-center rounded-lg bg-brand-50 text-brand-600">
                <IconoEquipo nombre={catElegida?.icono ?? "wrench"} className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink truncate">{catElegida?.nombre}</p>
                {propiedadActual && (
                  <p className="text-[11px] text-faint truncate">
                    {propiedadActual.nombre} · {propiedadActual.direccion}
                  </p>
                )}
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
            {/* "alcanza" acá se refería sólo al mínimo para poder analizar
                el texto, no a si el detalle es suficiente para un
                diagnóstico preciso — pero la respuesta de Nora de abajo
                también usa "alcanza"/"no alcanza" para ESO otro, y las dos
                frases una debajo de la otra se leían como si se
                contradijeran. Frases sin la palabra en común, mismo
                significado, sin choque. */}
            <p className="text-[11.5px] text-faint mt-1.5 px-1">
              {descripcion.trim().length >= 10 || foto
                ? "Perfecto, ya podemos analizarlo."
                : "Escribí unas palabras o mandá una foto para que Nora lo analice."}
            </p>

            {/* Input oculto compartido: también lo usa ControlFoto en el
                paso Análisis, no hace falta un segundo <input>. */}
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={alCambiarFoto}
              className="hidden"
              aria-label="Sacar o elegir una foto del problema"
            />
            <ControlFoto foto={foto} onElegir={elegirFoto} onQuitar={quitarFoto} />
          </section>
        )}

        {/* ---------- PASO ANÁLISIS ---------- */}
        {paso === pasoAnalisis && (
          <PasoAnalisis
            catElegida={catElegida}
            descripcion={descripcion}
            onDescripcionChange={setDescripcion}
            foto={foto}
            onElegirFoto={elegirFoto}
            onQuitarFoto={quitarFoto}
            categoria={categoria}
            analizando={analizando}
            errorFoto={errorFoto}
            diagnostico={diagnostico}
            setAnalizando={setAnalizando}
            setErrorFoto={setErrorFoto}
            setDiagnostico={setDiagnostico}
          />
        )}

        {/* ---------- PASO CUÁNDO ---------- */}
        {paso === pasoCuando && (
          <section className="entra-paso">
            <TituloPaso>
              ¿Cuándo te
              <br />
              viene bien?
            </TituloPaso>
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
                  className={`press shrink-0 w-[64px] rounded-2xl shadow-card py-3 flex flex-col items-center gap-0.5 transition-colors ${
                    dia === d.iso ? "bg-brand-600" : "border border-line bg-surface"
                  }`}
                >
                  <span className={`text-[11px] uppercase ${dia === d.iso ? "text-brand-100" : "text-faint"}`}>
                    {d.diaSemana}
                  </span>
                  <span className={`num text-[18px] font-bold ${dia === d.iso ? "text-white" : "text-ink"}`}>
                    {d.numero}
                  </span>
                  <span className={`text-[11px] ${dia === d.iso ? "text-brand-100" : "text-faint"}`}>{d.mes}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {franjasDisponibles.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFranja(f.id)}
                  aria-pressed={franja === f.id}
                  className={`press rounded-2xl shadow-card py-3.5 px-2 text-[13.5px] font-semibold transition-colors ${
                    franja === f.id ? "bg-brand-600 text-white" : "border border-line bg-surface text-ink"
                  }`}
                >
                  {f.texto}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------- PASO CONTACTO: domicilio y datos. Si ya hay datos
            guardados de un pedido anterior en esta sesión, primero se
            muestran para CONFIRMAR (o cambiar) — nunca se reusan en
            silencio. ---------- */}
        {paso === pasoContacto && !editandoContacto && (
          <section className="entra-paso">
            <TituloPaso>
              ¿Seguimos
              <br />
              con esto?
            </TituloPaso>
            <p className="text-[13px] text-mute mt-1.5">
              Ya tenemos estos datos de un pedido anterior. Si es para el mismo lugar, seguí de largo.
            </p>

            {cargandoPerfilPrevio ? (
              <div className="mt-4 space-y-2.5">
                <Bloque className="h-[76px] rounded-xl2" />
                <Bloque className="h-[52px] rounded-xl2" />
              </div>
            ) : (
              <div className="mt-4 rounded-xl2 bg-surface border border-line shadow-card divide-y divide-line overflow-hidden">
                <Fila etiqueta="Nombre" valor={perfilPrevio?.nombre || "—"} />
                <Fila etiqueta="Teléfono" valor={perfilPrevio?.telefono || "—"} />
                <Fila
                  etiqueta="Domicilio"
                  valor={propiedadActual ? `${propiedadActual.direccion}, ${propiedadActual.localidad}` : "—"}
                />
              </div>
            )}

            <button
              type="button"
              onClick={usarOtrosDatos}
              className="press mt-3 w-full text-center text-[13px] font-semibold text-brand-600 underline underline-offset-2 py-1.5"
            >
              Usar otros datos (otra dirección, otro contacto)
            </button>
          </section>
        )}

        {paso === pasoContacto && editandoContacto && (
          <section className="entra-paso">
            <TituloPaso>
              ¿A dónde
              <br />
              vamos?
            </TituloPaso>
            <p className="text-[13px] text-mute mt-1.5">
              Necesitamos saber quién sos y a dónde vamos.
            </p>

            <CampoTexto
              id="nombre-inicial"
              etiqueta="Nombre completo"
              placeholder="Nombre y apellido"
              value={nombreInicial}
              onChange={(e) => setNombreInicial(e.target.value)}
              autoComplete="name"
              error={
                intentoContinuarContacto && nombreInicial.trim().length < 2
                  ? "Ingresá tu nombre y apellido."
                  : undefined
              }
            />
            <CampoTexto
              id="telefono-inicial"
              etiqueta="Teléfono"
              ayuda="Para coordinar el pedido por WhatsApp o llamada — obligatorio, sin este dato no podemos avisarte nada."
              type="tel"
              inputMode="tel"
              value={telefonoInicial}
              onChange={(e) => setTelefonoInicial(e.target.value)}
              autoComplete="tel"
              placeholder="11 1234 5678"
              error={
                intentoContinuarContacto && !telefonoValido
                  ? "Ingresá un teléfono válido (mínimo 8 dígitos)."
                  : undefined
              }
            />
            <CampoTexto
              id="mail-inicial"
              etiqueta="Mail (opcional)"
              ayuda="Si lo dejás, te mandamos el comprobante del pedido."
              type="email"
              inputMode="email"
              value={mailInicial}
              onChange={(e) => setMailInicial(e.target.value)}
              autoComplete="email"
              placeholder="tu@mail.com"
              error={
                intentoContinuarContacto && !mailValido
                  ? "Revisá el formato del mail (ej: nombre@dominio.com)."
                  : undefined
              }
            />

            <div className="grid grid-cols-[1fr_92px] gap-2.5">
              <CampoTexto
                id="calle-inicial"
                etiqueta="Calle"
                value={calleInicial}
                onChange={(e) => setCalleInicial(e.target.value)}
                autoComplete="address-line1"
                error={
                  intentoContinuarContacto && calleInicial.trim() === "" ? "Ingresá la calle." : undefined
                }
              />
              <CampoTexto
                id="numero-inicial"
                etiqueta="Altura"
                inputMode="numeric"
                value={numeroInicial}
                onChange={(e) => setNumeroInicial(e.target.value)}
                error={
                  intentoContinuarContacto && numeroInicial.trim() === "" ? "Ingresá la altura." : undefined
                }
              />
            </div>

            <CampoTexto
              id="localidad-inicial"
              etiqueta="Localidad"
              value={localidadInicial}
              onChange={(e) => setLocalidadInicial(e.target.value)}
              autoComplete="address-level2"
              error={
                intentoContinuarContacto && localidadInicial.trim() === ""
                  ? "Ingresá la localidad."
                  : undefined
              }
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
          </section>
        )}

        {/* ---------- PASO CONFIRMAR ---------- */}
        {paso === pasoConfirmar && (
          <section className="entra-paso">
            <TituloPaso>
              Revisá y
              <br />
              enviá el pedido
            </TituloPaso>

            <div className="mt-5 rounded-xl2 bg-surface border border-line shadow-card divide-y divide-line overflow-hidden">
              <Fila etiqueta="Servicio" valor={catElegida?.nombre ?? "—"} />
              <Fila
                etiqueta="Domicilio"
                valor={propiedadActual ? `${propiedadActual.nombre} · ${propiedadActual.direccion}` : "—"}
              />
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
                En menos de <span className="font-semibold">2 horas</span> te contactamos con el precio
                confirmado — <span className="font-semibold">antes</span> de que arranque el trabajo: no
                se cobra nada hasta entonces.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* --- Pie con el botón de avance --- */}
      <div className="px-5 pb-7 pt-2 bg-gradient-to-t from-sand via-sand to-transparent max-w-xl mx-auto w-full">
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
          {enviando
            ? paso === pasoConfirmar
              ? "Enviando…"
              : "Guardando…"
            : paso === pasoConfirmar
              ? "Enviar pedido"
              : "Continuar"}
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
  error,
  ...props
}: { id: string; etiqueta: string; ayuda?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mt-3">
      <label htmlFor={id} className="block text-[11px] font-bold tracking-wide uppercase text-faint mb-1.5">
        {etiqueta}
      </label>
      <input
        id={id}
        type="text"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-2xl bg-surface border shadow-card px-4 py-3.5 text-[14px] text-ink placeholder:text-faint outline-none focus:border-brand-300 ${
          error ? "border-urgent" : "border-line"
        }`}
        {...props}
      />
      {/* Mientras haya error, reemplaza el texto de ayuda — no se
          muestran los dos a la vez, para no duplicar mensajes. */}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-urgent bg-urgent/10 rounded-lg px-2 py-1 mt-1">
          {error}
        </p>
      ) : (
        ayuda && <p className="text-[12px] text-faint mt-1 px-1">{ayuda}</p>
      )}
    </div>
  );
}

/* Picker de foto compartido entre el paso "El problema" y el paso
   "Análisis" — antes este bloque estaba duplicado a mano en el
   archivo; ahora vive una sola vez. */
function ControlFoto({
  foto,
  onElegir,
  onQuitar,
}: {
  foto: File | null;
  onElegir: () => void;
  onQuitar: () => void;
}) {
  if (!foto) {
    return (
      <button
        type="button"
        onClick={onElegir}
        className="press mt-3 w-full flex items-center justify-center gap-2 rounded-xl2 border border-dashed border-brand-200 text-brand-600 py-3.5 text-[14px] font-semibold"
      >
        <Camera className="w-[17px] h-[17px]" />
        Sumar una foto (opcional)
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-xl2 border border-brand-200 bg-surface shadow-card p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 w-9 h-9 grid place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Camera className="w-4 h-4" />
        </span>
        <p className="flex-1 min-w-0 text-[13px] font-medium text-ink truncate">{foto.name}</p>
        <button
          type="button"
          onClick={onQuitar}
          className="press shrink-0 w-7 h-7 grid place-items-center rounded-full bg-sand border border-line text-faint"
          aria-label="Quitar foto"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* El paso "Análisis" — pantalla propia para lo que antes quedaba
   apretado debajo del botón de foto en "El problema". Dueño único de
   la llamada a diagnosticarFoto(): un solo efecto que reacciona tanto
   a la foto como al texto (antes había dos caminos separados, y el de
   sólo-texto se cortaba en seco apenas había una foto puesta — ahí
   estaba el bug real de "se congela después de la primera foto").
   Por eso mismo, cuando se llega acá con contexto ya cargado del chat
   de Inicio, el análisis arranca solo, sin ningún código extra. */
function PasoAnalisis({
  catElegida,
  descripcion,
  onDescripcionChange,
  foto,
  onElegirFoto,
  onQuitarFoto,
  categoria,
  analizando,
  errorFoto,
  diagnostico,
  setAnalizando,
  setErrorFoto,
  setDiagnostico,
}: {
  catElegida: CategoriaBD | undefined;
  descripcion: string;
  onDescripcionChange: (v: string) => void;
  foto: File | null;
  onElegirFoto: () => void;
  onQuitarFoto: () => void;
  categoria: string | null;
  analizando: boolean;
  errorFoto: string | null;
  diagnostico: ResultadoDiagnostico | null;
  setAnalizando: (v: boolean) => void;
  setErrorFoto: (v: string | null) => void;
  setDiagnostico: (v: ResultadoDiagnostico | null) => void;
}) {
  const fotoAnteriorRef = useRef<File | null>(foto);

  useEffect(() => {
    const texto = descripcion.trim();
    if (!foto && texto.length < 10) return;

    const cambioFoto = foto !== fotoAnteriorRef.current;
    fotoAnteriorRef.current = foto;

    let vigente = true;
    const espera = setTimeout(
      () => {
        setAnalizando(true);
        setErrorFoto(null);
        diagnosticarFoto({ descripcion: texto, foto: foto ?? undefined, categoriaSlug: categoria })
          .then((resultado) => {
            if (vigente) setDiagnostico(resultado);
          })
          .catch((err) => {
            if (vigente) setErrorFoto(err instanceof Error ? err.message : "No pudimos analizar el problema.");
          })
          .finally(() => {
            if (vigente) setAnalizando(false);
          });
      },
      cambioFoto ? 0 : 900,
    );

    return () => {
      vigente = false;
      clearTimeout(espera);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descripcion, foto, categoria]);

  return (
    <section className="entra-paso">
      <TituloPaso>
        Nora está
        <br />
        mirando esto
      </TituloPaso>
      <p className="text-[13px] text-mute mt-1.5">
        Podés seguir sumando fotos o contándole más — Nora vuelve a mirar todo junto apenas se lo mandás.
      </p>

      <div className="mt-4 rounded-2xl bg-surface border border-line shadow-card p-3 flex items-center gap-3">
        <span className="w-8 h-8 grid place-items-center rounded-lg bg-brand-50 text-brand-600">
          <IconoEquipo nombre={catElegida?.icono ?? "wrench"} className="w-4 h-4" />
        </span>
        <p className="text-[12.5px] font-semibold text-ink truncate">{catElegida?.nombre}</p>
      </div>

      {/* Panel del análisis — vidrio (Liquid Glass, DESIGN.md lo
          documenta para el card del chat) + los mismos blobs de marca
          que ya usa el fondo de página, no una paleta inventada.
          Reusa el mismo indicador de "escribiendo" de ChatNora
          (.punto-escribiendo) para que se sienta la misma Nora. */}
      <div
        className="entra-analisis relative overflow-hidden rounded-xl3 glass mt-4 p-4"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 0% 0%, rgba(20,133,122,0.14) 0%, transparent 60%), radial-gradient(90% 70% at 100% 100%, rgba(255,107,157,0.10) 0%, transparent 65%)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="shrink-0 w-8 h-8 grid place-items-center rounded-full bg-brand-600 text-white shadow-card">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <p className="text-[12.5px] font-bold font-display text-ink leading-tight">Análisis de Nora</p>
            {analizando && (
              <p className="flex items-center gap-1.5 text-[11px] text-brand-600">
                <span className="live-dot w-[6px] h-[6px] rounded-full bg-brand-600" aria-hidden="true" />
                Mirando {foto ? "la foto" : "lo que contaste"}…
              </p>
            )}
          </div>
        </div>

        {analizando && (
          <p className="flex items-center gap-1 py-2">
            <span className="punto-escribiendo" />
            <span className="punto-escribiendo" />
            <span className="punto-escribiendo" />
          </p>
        )}

        {!analizando && errorFoto && (
          <p role="alert" className="text-[12.5px] text-urgent bg-urgent/10 rounded-xl2 px-3 py-2.5">
            {errorFoto}
          </p>
        )}

        {!analizando && !errorFoto && diagnostico && <ResultadoAnalisis resultado={diagnostico} />}

        {!analizando && !errorFoto && !diagnostico && (
          <p className="text-[12.5px] text-mute">Contanos un poco más o sumá una foto para que Nora empiece.</p>
        )}
      </div>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-faint px-1">Sumar más info</p>
      <textarea
        rows={3}
        value={descripcion}
        onChange={(e) => onDescripcionChange(e.target.value)}
        placeholder="¿Algo más para contarle a Nora?"
        className="mt-1.5 w-full rounded-2xl bg-surface border border-line shadow-card p-4 text-[14px] text-ink placeholder:text-faint outline-none focus:border-brand-300"
      />
      <ControlFoto foto={foto} onElegir={onElegirFoto} onQuitar={onQuitarFoto} />
    </section>
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

/* Lo que ve la persona apenas manda el pedido — lo mismo que esperarías
   de cualquier compra online prolija: cuándo llega, a dónde, y un
   número corto para cualquier consulta con soporte (no hay "Mi
   historial" para volver a buscarlo, así que tiene que quedar claro
   acá, de una). El siguiente contacto es manual: alguien del equipo
   llama o escribe por WhatsApp al teléfono que la persona dejó, para
   cerrar el servicio — ver enrutarPedidoCliente.ts. */
function Confirmacion({
  servicio,
  domicilio,
  diaTexto,
  franjaTexto,
}: {
  servicio: Servicio;
  domicilio: string;
  diaTexto: string;
  franjaTexto: string;
}) {
  const franjaCorta = franjaTexto.includes(" · ") ? franjaTexto.split(" · ")[1] : franjaTexto;
  const checkRef = useRef<HTMLDivElement>(null);

  /* El check merece un poco más de presupuesto de delight que el resto
     del wizard — es el único momento de "listo, terminaste" de todo el
     flujo. Elástico y una sola vez, no en loop. */
  useEffect(() => {
    const el = checkRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(el, { scale: 0, rotate: -35 }, { scale: 1, rotate: 0, duration: 0.6, ease: "elastic.out(1, 0.6)" });
  }, []);

  return (
    <div className="absolute inset-0 z-40 bg-sand flex flex-col overflow-y-auto no-scrollbar">
      <div className="flex-1 flex flex-col items-center px-6 pt-16 pb-6 text-center">
        <div ref={checkRef} className="w-20 h-20 grid place-items-center rounded-full bg-good/15 text-good">
          <Check className="w-10 h-10" />
        </div>
        <TituloPaso className="text-[23px] font-bold font-display text-ink mt-5">
          ¡Pedido enviado!
        </TituloPaso>
        {/* Titular corto y tranquilizador primero, el compromiso
            concreto (2 horas, por teléfono) como detalle debajo — uno
            no reemplaza al otro, cada uno cumple un rol distinto. */}
        <p className="text-[14.5px] font-semibold text-ink mt-2">En breve te contactaremos.</p>
        <p className="text-[13.5px] text-mute mt-1 max-w-[300px] leading-relaxed">
          Ya lo estamos viendo. En menos de 2 horas te contactamos por teléfono con el precio
          confirmado.
        </p>

        <div
          className="relative overflow-hidden mt-7 w-full max-w-[320px] rounded-xl3 text-white shadow-hero p-5"
          style={{
            backgroundImage: "radial-gradient(120% 80% at 100% 0%, #14857A 0%, #0E5C54 38%, #0B3B38 100%)",
          }}
        >
          <div className="pointer-events-none absolute -top-12 -right-8 w-36 h-36 rounded-full bg-brand-400/20 blur-2xl" />
          <p className="relative text-[11px] font-bold uppercase tracking-wide text-brand-100">
            Número de orden
          </p>
          <p className="relative num text-[36px] font-extrabold font-display leading-none mt-1.5">
            #{servicio.numeroOrden}
          </p>
          <p className="relative text-[11.5px] text-brand-100 mt-2 leading-snug">
            Guardalo — es tu referencia ante cualquier consulta con soporte.
          </p>
        </div>

        <div className="mt-3.5 w-full max-w-[320px] rounded-xl2 bg-surface border border-line shadow-card divide-y divide-line overflow-hidden text-left">
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span className="shrink-0 w-8 h-8 grid place-items-center rounded-lg bg-brand-50 text-brand-600">
              <Clock className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-faint">
                ¿A qué hora vamos a venir?
              </p>
              <p className="text-[14px] font-bold text-ink mt-1">{diaTexto}</p>
              <p className="text-[12.5px] text-mute">{franjaCorta}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span className="shrink-0 w-8 h-8 grid place-items-center rounded-lg bg-brand-50 text-brand-600">
              <MapPin className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-faint">A dónde vamos</p>
              <p className="text-[13.5px] font-semibold text-ink mt-0.5 truncate">{domicilio}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8">
        <Link
          href="/inicio"
          className="press w-full flex items-center justify-center gap-2 rounded-xl2 bg-brand-600 text-white py-4 text-[15px] font-semibold shadow-fab"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

/** Los próximos 30 días, listos para mostrar. Un mes de horizonte para
 *  quien quiere agendar con anticipación — antes eran sólo 7, y quien
 *  quería agendar para dentro de dos semanas no tenía cómo. Ya scrollea
 *  horizontal, así que no hace falta rediseñar nada para que quepan. */
function obtenerProximosDias() {
  const DIAS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const hoy = new Date();

  return Array.from({ length: 30 }, (_, i) => {
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
