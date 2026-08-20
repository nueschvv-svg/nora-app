/* ============================================================
   ESTIMADOR DE PRECIOS

   De "se rompió el caño" a "esto es lo que pasa, esto es lo que
   arriesgás si esperás, y esto es lo que puede salir".

   Tres reglas que ordenan todo lo de abajo:

   1. SIEMPRE UN RANGO, NUNCA UN NÚMERO. Sin ver el problema no se
      puede dar un precio, y fingir que sí es la forma más rápida
      de terminar discutiendo con un cliente.

   2. EL PRECIO SE CALCULA, NO SE GUARDA. Es horas × tarifa +
      materiales. Cuando la inflación mueve las tarifas, se
      actualiza una fila en la base y todos los estimados quedan
      al día solos.

   3. SI NO SABEMOS, LO DECIMOS. Cuando la descripción no alcanza
      para identificar el trabajo, el estimador devuelve la duda
      y las preguntas que hay que hacer. No inventa.
   ============================================================ */

export type NivelUrgencia = "emergencia" | "urgente" | "pronto" | "programable";

export const TEXTO_URGENCIA: Record<NivelUrgencia, { etiqueta: string; plazo: string }> = {
  emergencia: { etiqueta: "Emergencia", plazo: "Hay que verlo ahora" },
  urgente: { etiqueta: "Urgente", plazo: "En las próximas 24 a 48 horas" },
  pronto: { etiqueta: "Pronto", plazo: "Esta semana" },
  programable: { etiqueta: "Programable", plazo: "Cuando te venga bien" },
};

export type Trabajo = {
  slug: string;
  categoriaSlug: string;
  nombre: string;
  sintomas: string[];
  diagnostico: string;
  riesgoSiEspera: string;
  urgencia: NivelUrgencia;
  horasMin: number;
  horasMax: number;
  materialesMin: number;
  materialesMax: number;
  requiereMatricula: boolean;
  preguntas: string[];
};

export type Tarifa = {
  categoriaSlug: string;
  visitaArs: number;
  visitaMaxArs: number | null;
  horaArs: number | null;
  horaMaxArs: number | null;
  recargoUrgencia: number;
};

export type Estimado = {
  trabajo: Trabajo;
  /** Qué tan seguros estamos de haber identificado el problema (0 a 1). */
  confianza: number;
  desdeArs: number;
  hastaArs: number;
  desdeUsd: number | null;
  hastaUsd: number | null;
  /** El desglose, para que el cliente vea de dónde sale el número. */
  detalle: { concepto: string; desde: number; hasta: number }[];
  /** true si se aplicó el recargo por salida fuera de horario. */
  conRecargo: boolean;
  /* false cuando el rango es tan ancho que mostrarlo confunde más de lo
     que ayuda. Ver ANCHO_MAXIMO. En ese caso la pantalla tiene que
     mostrar sólo el precio de la visita y decir que se cotiza al ver. */
  rangoUtil: boolean;
};

/* Cuántas veces puede el máximo superar al mínimo antes de que el rango
   deje de servir.

   Un "entre $50.000 y $380.000" es información inútil: el cliente no
   puede decidir nada con eso y encima queda con la sensación de que le
   van a cobrar lo que quieran. Pasado este límite preferimos decir la
   verdad — "esto hay que verlo para cotizarlo" — y dar sólo el precio
   de la visita, que ese sí es firme.

   El criterio para elegir el número: un rango sirve si le alcanza a la
   persona para tomar las dos decisiones que tiene que tomar — si esto
   entra en su presupuesto, y si llama hoy o espera al lunes.

   Un 4 a 1 ($50.000 a $200.000) todavía responde las dos: sabés que no
   son $10.000 ni $1.000.000. Un 8 a 1 no responde ninguna.

   Puesto en 3 al principio, subido a 4 después de ver los datos: con 3
   quedaban en "hay que verlo" un montón de trabajos de 3,3x y 3,6x, que
   sí son informativos. Igual esto es un juicio mío, no una verdad: el
   número real hay que recalibrarlo cuando existan 100 trabajos hechos y
   se pueda comparar el estimado con lo que se terminó cobrando. */
const ANCHO_MAXIMO = 4;

/* ---------- Identificar el problema a partir del texto ----------

   Puntaje simple sobre las palabras del catálogo. No es inteligencia
   artificial y no pretende serlo: es una tabla de síntomas bien hecha.

   Para el 80% de los casos alcanza, porque la gente describe estas
   cosas de forma muy parecida ("se me tapó", "salta la térmica",
   "quedé afuera"). Para el resto está la confianza baja, que dispara
   las preguntas en vez de arriesgar un diagnóstico. */

/** Saca tildes y pasa a minúscula: "perdió" y "perdio" tienen que empatar. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ");
}

export type Coincidencia = { trabajo: Trabajo; confianza: number };

export function identificarTrabajo(
  descripcion: string,
  catalogo: Trabajo[],
  categoriaSlug?: string,
): Coincidencia[] {
  const texto = normalizar(descripcion);
  const palabras = new Set(texto.split(/\s+/).filter((p) => p.length > 2));

  const candidatos = categoriaSlug
    ? catalogo.filter((t) => t.categoriaSlug === categoriaSlug)
    : catalogo;

  const puntuados = candidatos.map((trabajo) => {
    /* Deduplicamos DESPUÉS de normalizar.

       Sin esto, un catálogo que liste "cano" y "caño" como síntomas
       distintos hace que una sola palabra escrita por el usuario cuente
       dos veces, y ese trabajo le gana a otro que describía mejor el
       problema. Pasó exactamente eso con "se rompió un caño adentro de
       la pared", que caía en "caño a la vista".

       Se arregla acá y no en los datos porque escribir las variantes con
       y sin tilde es lo natural al armar el catálogo: el código tiene que
       tolerarlo. */
    const sintomas = [...new Set(trabajo.sintomas.map(normalizar).filter(Boolean))];

    let aciertos = 0;
    for (const s of sintomas) {
      // Frase de varias palabras: tiene que aparecer completa y vale doble.
      if (s.includes(" ")) {
        if (texto.includes(s)) aciertos += 2;
      } else if (palabras.has(s)) {
        aciertos += 1;
      }
    }
    /* Dividimos por la raíz y no por el total de síntomas: si no, un
       trabajo con muchas palabras clave quedaría siempre penalizado
       frente a uno con dos. */
    const confianza = aciertos === 0 ? 0 : Math.min(1, aciertos / Math.sqrt(sintomas.length * 2));
    return { trabajo, confianza };
  });

  return puntuados
    .filter((c) => c.confianza > 0)
    .sort((a, b) => b.confianza - a.confianza)
    .slice(0, 3);
}

/* ---------- Calcular el estimado ---------- */

export function calcularEstimado(
  trabajo: Trabajo,
  tarifa: Tarifa,
  opciones: { confianza?: number; fueraDeHorario?: boolean; dolar?: number | null } = {},
): Estimado {
  const { confianza = 1, fueraDeHorario = false, dolar = null } = opciones;

  const visitaDesde = tarifa.visitaArs;
  const visitaHasta = tarifa.visitaMaxArs ?? tarifa.visitaArs;
  const horaDesde = tarifa.horaArs ?? tarifa.visitaArs;
  const horaHasta = tarifa.horaMaxArs ?? horaDesde;

  const recargo = fueraDeHorario ? 1 + tarifa.recargoUrgencia : 1;

  /* La visita ya incluye la primera hora de trabajo: si la cobráramos
     aparte, el estimado de un arreglo de media hora saldría el doble de
     lo que en la práctica cobra cualquier plomero. */
  const horasExtraMin = Math.max(0, trabajo.horasMin - 1);
  const horasExtraMax = Math.max(0, trabajo.horasMax - 1);

  const detalle = [
    {
      concepto: fueraDeHorario ? "Visita y primera hora (fuera de horario)" : "Visita y primera hora",
      desde: Math.round(visitaDesde * recargo),
      hasta: Math.round(visitaHasta * recargo),
    },
  ];

  if (horasExtraMax > 0) {
    detalle.push({
      concepto:
        horasExtraMin === horasExtraMax
          ? `${horasExtraMax} h adicional${horasExtraMax === 1 ? "" : "es"} de trabajo`
          : `${horasExtraMin} a ${horasExtraMax} h adicionales de trabajo`,
      desde: Math.round(horasExtraMin * horaDesde * recargo),
      hasta: Math.round(horasExtraMax * horaHasta * recargo),
    });
  }

  if (trabajo.materialesMax > 0) {
    detalle.push({
      concepto: "Materiales",
      desde: Math.round(trabajo.materialesMin),
      hasta: Math.round(trabajo.materialesMax),
    });
  }

  const desdeArs = detalle.reduce((t, d) => t + d.desde, 0);
  const hastaArs = detalle.reduce((t, d) => t + d.hasta, 0);

  return {
    trabajo,
    confianza,
    desdeArs,
    hastaArs,
    desdeUsd: dolar ? Math.round(desdeArs / dolar) : null,
    hastaUsd: dolar ? Math.round(hastaArs / dolar) : null,
    detalle,
    conRecargo: fueraDeHorario,
    rangoUtil: desdeArs > 0 && hastaArs / desdeArs <= ANCHO_MAXIMO,
  };
}

/** Qué mostrarle al cliente: el rango, o la verdad de que hay que verlo. */
export function textoEstimado(e: Estimado): {
  titulo: string;
  aclaracion: string;
  usd: string | null;
} {
  const pesos = (n: number) => "$ " + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

  if (!e.rangoUtil) {
    const visita = e.detalle[0];
    return {
      titulo: `Visita desde ${pesos(visita.desde)}`,
      aclaracion:
        "Este trabajo cambia mucho según lo que se encuentre, así que darte un número ahora sería inventarlo. Lo vemos, te pasamos el precio cerrado y recién ahí decidís.",
      usd: null,
    };
  }

  return {
    titulo: `${pesos(e.desdeArs)} – ${pesos(e.hastaArs)}`,
    aclaracion: "Estimado. Te confirmamos el precio final antes de arrancar el trabajo.",
    usd: e.desdeUsd && e.hastaUsd ? `USD ${e.desdeUsd} – ${e.hastaUsd}` : null,
  };
}

/* ---------- Estimado sólo con la visita ----------

   Para cuando no se pudo identificar el trabajo exacto (foto ambigua,
   descripción rara, categoría sin catálogo de IA todavía) pero SÍ hay
   tarifa cargada para la categoría. En vez de no mostrar nada — que es
   lo que pasaba antes y por lo que el cliente nunca veía un precio en
   varios rubros — mostramos lo único que sí podemos afirmar sin ver el
   problema: cuánto sale ir a verlo. Mismo criterio que el caso
   `!rangoUtil` de arriba, pero sin depender de un `Trabajo` del catálogo. */

export type EstimadoVisita = {
  desdeArs: number;
  hastaArs: number;
  desdeUsd: number | null;
  hastaUsd: number | null;
  conRecargo: boolean;
};

export function calcularVisita(
  tarifa: Tarifa,
  opciones: { fueraDeHorario?: boolean; dolar?: number | null } = {},
): EstimadoVisita {
  const { fueraDeHorario = false, dolar = null } = opciones;
  const recargo = fueraDeHorario ? 1 + tarifa.recargoUrgencia : 1;
  const desdeArs = Math.round(tarifa.visitaArs * recargo);
  const hastaArs = Math.round((tarifa.visitaMaxArs ?? tarifa.visitaArs) * recargo);

  return {
    desdeArs,
    hastaArs,
    desdeUsd: dolar ? Math.round(desdeArs / dolar) : null,
    hastaUsd: dolar ? Math.round(hastaArs / dolar) : null,
    conRecargo: fueraDeHorario,
  };
}

export function textoVisita(e: EstimadoVisita): { titulo: string; aclaracion: string; usd: string | null } {
  const pesos = (n: number) => "$ " + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const titulo =
    e.desdeArs === e.hastaArs
      ? `Visita desde ${pesos(e.desdeArs)}`
      : `Visita desde ${pesos(e.desdeArs)} a ${pesos(e.hastaArs)}`;

  return {
    titulo,
    aclaracion:
      "No pudimos identificar el trabajo exacto, así que esto es sólo lo que sale ir a verlo — incluye la primera hora. El precio final te lo confirmamos antes de arrancar.",
    usd: e.desdeUsd != null && e.hastaUsd != null
      ? `USD ${e.desdeUsd}${e.desdeUsd !== e.hastaUsd ? ` – ${e.hastaUsd}` : ""}`
      : null,
  };
}

/** ¿Corresponde recargo? Fuera de 8-20 h de lunes a viernes, o fin de semana. */
export function esFueraDeHorario(cuando: Date = new Date()): boolean {
  const dia = cuando.getDay();
  const hora = cuando.getHours();
  if (dia === 0 || dia === 6) return true;
  return hora < 8 || hora >= 20;
}
