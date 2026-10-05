/* Lo que ENJINIA necesita leer, persistido en el pedido para que sobreviva
   aunque el navegador se cierre antes de que salga el aviso.

   El encabezado de las observaciones depende de si HUBO fotos. Antes decía
   siempre "[Foto analizada por Nora]", también cuando la persona sólo había
   escrito: le afirmaba a ENJINIA que alguien miró una imagen que no existía. */

export type AntecedenteParaOperaciones = {
  desperfecto: string;
  sueleSer: string;
};

export function descripcionDelPedido(
  descripcion: string,
  riesgo: boolean,
  observaciones?: string | null,
  estimado?: string | null,
  opciones?: {
    conFotos?: boolean;
    familiaNombre?: string | null;
    antecedentes?: AntecedenteParaOperaciones[];
    /** Lo que Nora preguntó y lo que respondió la persona, si lo hubo. */
    contexto?: string | null;
  },
): string {
  const encabezado = opciones?.conFotos
    ? "[Fotos analizadas por Nora]"
    : "[Lectura de Nora sobre lo que contó la persona]";

  const antecedentes = opciones?.antecedentes?.length
    ? [
        `[Antecedentes de ENJINIA${opciones.familiaNombre ? ` · ${opciones.familiaNombre}` : ""}]`,
        ...opciones.antecedentes.map((a) => `· "${a.desperfecto}" → solía ser: ${a.sueleSer}`),
        "Orientación del archivo histórico, no un diagnóstico confirmado.",
      ].join("\n")
    : null;

  return [
    riesgo ? "[RIESGO INMEDIATO]" : null,
    descripcion.trim(),
    opciones?.contexto?.trim() ? `[Lo que preguntó Nora]\n${opciones.contexto.trim()}` : null,
    observaciones ? `${encabezado} ${observaciones}` : null,
    antecedentes,
    estimado,
  ]
    .filter(Boolean)
    .join("\n\n");
}
