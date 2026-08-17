/* ============================================================
   SCORE DE SALUD DE LA PROPIEDAD

   En el prototipo esto eran tres números inventados (73, 88, 64).
   Acá se calcula de verdad, a partir de los equipos cargados y de
   cuándo se revisó cada uno por última vez.

   Regla de diseño: el score tiene que ser EXPLICABLE. El usuario
   tiene que poder tocarlo y ver exactamente por qué le da lo que
   le da. Por eso la función no devuelve un número suelto, devuelve
   el número + el desglose de cómo se llegó a él.
   ============================================================ */

import { Equipo, Propiedad, REGLAS_EQUIPO } from "./tipos";

export type EstadoRevision = "vencido" | "por_vencer" | "al_dia" | "sin_datos";

export type EquipoEvaluado = {
  equipo: Equipo;
  etiqueta: string;
  icono: string;
  estado: EstadoRevision;
  /** Fecha ISO en que corresponde la próxima revisión. Null si nunca se revisó. */
  proximaRevision: string | null;
  /** Positivo = ya pasó la fecha. Negativo = todavía falta. */
  diasVencido: number | null;
  obligatorio: boolean;
  motivo: string;
  /** Cuántos puntos le resta este equipo al score. */
  penalidad: number;
};

export type ResultadoScore = {
  /** 0 a 100. */
  valor: number;
  /* Frase del hero, ya partida en renglones.
     Antes era un string con <br> que la pantalla inyectaba como HTML.
     Funcionaba porque el texto es nuestro, pero alcanzaba con que alguien
     hiciera este título dependiente de algo que escribe el usuario para
     abrir un agujero. Un arreglo de líneas no puede inyectar nada. */
  titulo: string[];
  nivel: "bueno" | "atencion" | "critico";
  equipos: EquipoEvaluado[];
  /** Desglose legible: qué sumó y qué restó. Es lo que se le muestra al usuario. */
  desglose: { concepto: string; puntos: number }[];
};

/* --- Pesos de la fórmula ---------------------------------------------------
   Son la calibración inicial. Se ajustan cuando tengamos datos reales de
   cuántas urgencias aparecen por propiedad. Están acá arriba y con nombre
   justamente para poder cambiarlos sin tocar la lógica.                     */
const PESO = {
  vencidoObligatorio: 20, // matafuegos o gas vencido: es lo más grave
  vencidoComun: 12,
  porVencer: 4, // faltan menos de 30 días
  sinDatos: 6, // nunca nos dijo cuándo se revisó
  equipoViejo: 3, // más de 10 años sin recambio
  bonoTodoAlDia: 5,
};

const DIAS_AVISO_PREVIO = 30;

function sumarMeses(fechaIso: string, meses: number): Date {
  const d = new Date(fechaIso + "T00:00:00");
  const dia = d.getDate();
  d.setMonth(d.getMonth() + meses);
  // Si el mes destino es más corto (31 ene + 1 mes), no saltar a marzo.
  if (d.getDate() < dia) d.setDate(0);
  return d;
}

function diasEntre(desde: Date, hasta: Date): number {
  const MS_POR_DIA = 86_400_000;
  const a = Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b - a) / MS_POR_DIA);
}

export function evaluarEquipo(equipo: Equipo, hoy: Date = new Date()): EquipoEvaluado {
  const regla = REGLAS_EQUIPO[equipo.tipo];
  const base = {
    equipo,
    etiqueta: equipo.apodo || regla.etiqueta,
    icono: regla.icono,
    obligatorio: regla.obligatorio,
    motivo: regla.motivo,
  };

  // Nunca se revisó: no podemos afirmar que esté mal, pero tampoco que esté bien.
  if (!equipo.ultimaRevision) {
    return {
      ...base,
      estado: "sin_datos",
      proximaRevision: null,
      diasVencido: null,
      penalidad: PESO.sinDatos,
    };
  }

  const proxima = sumarMeses(equipo.ultimaRevision, regla.frecuenciaMeses);
  const diasVencido = diasEntre(proxima, hoy); // >0 = ya pasó

  let estado: EstadoRevision;
  let penalidad: number;

  if (diasVencido > 0) {
    estado = "vencido";
    penalidad = regla.obligatorio ? PESO.vencidoObligatorio : PESO.vencidoComun;
  } else if (diasVencido > -DIAS_AVISO_PREVIO) {
    estado = "por_vencer";
    penalidad = PESO.porVencer;
  } else {
    estado = "al_dia";
    penalidad = 0;
  }

  // Equipo con más de 10 años: aunque esté revisado, suma riesgo.
  const anioActual = hoy.getFullYear();
  if (equipo.anioInstalacion && anioActual - equipo.anioInstalacion > 10) {
    penalidad += PESO.equipoViejo;
  }

  return {
    ...base,
    estado,
    proximaRevision: proxima.toISOString().slice(0, 10),
    diasVencido,
    penalidad,
  };
}

export function calcularScore(equipos: Equipo[], hoy: Date = new Date()): ResultadoScore {
  const evaluados = equipos.map((e) => evaluarEquipo(e, hoy));

  // Sin equipos cargados no hay nada que evaluar. No mostramos 100: mostramos
  // que falta información, que es lo honesto y además invita a cargarlos.
  if (evaluados.length === 0) {
    return {
      valor: 0,
      titulo: ["Cargá tus equipos", "para ver el estado"],
      nivel: "atencion",
      equipos: [],
      desglose: [{ concepto: "Todavía no cargaste ningún equipo", puntos: 0 }],
    };
  }

  const desglose: { concepto: string; puntos: number }[] = [{ concepto: "Punto de partida", puntos: 100 }];

  const vencidos = evaluados.filter((e) => e.estado === "vencido");
  const porVencer = evaluados.filter((e) => e.estado === "por_vencer");
  const sinDatos = evaluados.filter((e) => e.estado === "sin_datos");
  const viejos = evaluados.filter(
    (e) => e.equipo.anioInstalacion && hoy.getFullYear() - e.equipo.anioInstalacion > 10,
  );

  const restaVencidos = vencidos.reduce(
    (t, e) => t + (e.obligatorio ? PESO.vencidoObligatorio : PESO.vencidoComun),
    0,
  );
  if (vencidos.length) {
    desglose.push({
      concepto: `${vencidos.length} ${vencidos.length === 1 ? "mantenimiento vencido" : "mantenimientos vencidos"}`,
      puntos: -restaVencidos,
    });
  }
  if (porVencer.length) {
    desglose.push({
      concepto: `${porVencer.length} por vencer este mes`,
      puntos: -porVencer.length * PESO.porVencer,
    });
  }
  if (sinDatos.length) {
    desglose.push({
      concepto: `${sinDatos.length} sin fecha de última revisión`,
      puntos: -sinDatos.length * PESO.sinDatos,
    });
  }
  if (viejos.length) {
    desglose.push({
      concepto: `${viejos.length} con más de 10 años`,
      puntos: -viejos.length * PESO.equipoViejo,
    });
  }

  const todoAlDia = vencidos.length === 0 && porVencer.length === 0 && sinDatos.length === 0;
  if (todoAlDia) {
    desglose.push({ concepto: "Todo al día", puntos: PESO.bonoTodoAlDia });
  }

  const bruto = desglose.reduce((t, d) => t + d.puntos, 0);
  const valor = Math.max(0, Math.min(100, Math.round(bruto)));

  const hayObligatorioVencido = vencidos.some((e) => e.obligatorio);
  let nivel: ResultadoScore["nivel"];
  let titulo: string[];

  if (hayObligatorioVencido || valor < 60) {
    nivel = "critico";
    titulo = ["Requiere tu", "atención ahora"];
  } else if (valor < 80) {
    nivel = "atencion";
    titulo = ["Tu hogar está", "en buen estado"];
  } else {
    nivel = "bueno";
    titulo = ["Tu propiedad está", "impecable"];
  }

  return { valor, titulo, nivel, equipos: evaluados, desglose };
}

/** Los equipos ordenados por urgencia, para la agenda de mantenimientos. */
export function ordenarPorUrgencia(equipos: EquipoEvaluado[]): EquipoEvaluado[] {
  const orden: Record<EstadoRevision, number> = {
    vencido: 0,
    por_vencer: 1,
    sin_datos: 2,
    al_dia: 3,
  };
  return [...equipos].sort((a, b) => {
    const d = orden[a.estado] - orden[b.estado];
    if (d !== 0) return d;
    return (b.diasVencido ?? -9999) - (a.diasVencido ?? -9999);
  });
}

export type Recordatorio = {
  id: string;
  propiedadNombre: string;
  etiqueta: string;
  icono: string;
  estado: "vencido" | "por_vencer";
  diasVencido: number;
};

/* Recordatorios de mantenimiento para la campanita de notificaciones —
   NO se guardan en ninguna tabla (ver db/28_notificaciones.sql): se
   recalculan acá mismo, en el momento, a partir de los equipos de
   TODAS las propiedades de la persona. Misma lógica que ya usa el
   score de Inicio (evaluarEquipo), sólo que agregada entre propiedades
   en vez de para una sola. */
export function recordatoriosDeMantenimiento(
  propiedades: Propiedad[],
  equiposDe: (propiedadId: string) => Equipo[],
): Recordatorio[] {
  const items: Recordatorio[] = [];

  for (const p of propiedades) {
    for (const equipo of equiposDe(p.id)) {
      const evaluado = evaluarEquipo(equipo);
      if (evaluado.estado !== "vencido" && evaluado.estado !== "por_vencer") continue;
      items.push({
        id: equipo.id,
        propiedadNombre: p.nombre,
        etiqueta: evaluado.etiqueta,
        icono: evaluado.icono,
        estado: evaluado.estado,
        diasVencido: evaluado.diasVencido ?? 0,
      });
    }
  }

  return items.sort((a, b) => b.diasVencido - a.diasVencido);
}
