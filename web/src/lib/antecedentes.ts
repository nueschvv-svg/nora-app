/* ============================================================
   ANTECEDENTES REALES DE ENJINIA EN EBA

   Nora no inventa qué suele ser un problema: lo mira contra lo que
   ENJINIA ya resolvió en el predio. Las filas vienen de la migración
   49, que a su vez se generó desde el CSV del archivo histórico.

   POR QUÉ FAMILIA Y NO CASO EXACTO:
   sobre los casos del archivo hay más de dos mil desperfectos
   distintos, y los 250 más frecuentes cubren menos de la mitad.
   Buscar "el caso idéntico" falla la mayoría de las veces. Nueve
   familias, en cambio, cubren todo. Por eso la clasificación es en
   dos pasos: primero la familia, después los antecedentes de adentro.

   Y POR QUÉ NO HAY BASE VECTORIAL:
   el catálogo entero son ciento treinta y dos filas. Entra en el
   prompt. Una base vectorial acá sería infraestructura para un
   problema que no tenemos.

   La regla que ordena el archivo: lo que devuelve el modelo es dato
   de entrada, no verdad. Las familias se validan contra el enum y
   los antecedentes contra las filas reales. Un id que el modelo se
   invente no llega nunca a la pantalla.
   ============================================================ */

export const FAMILIAS = [
  "humedad_filtracion",
  "plomeria_desagues",
  "aberturas_carpinteria",
  "fisuras_pintura",
  "electricidad",
  "ceramicos_pisos",
  "artefactos_accesorios",
  "limpieza_otros",
  "otros",
] as const;

export type Familia = (typeof FAMILIAS)[number];

/** Centinela para "no pude clasificar". Va como valor del enum y no como
 *  null porque la API rechaza un enum que mezcla strings con null — mismo
 *  motivo que SIN_IDENTIFICAR en diagnostico.ts. */
export const SIN_FAMILIA = "ninguna";

export const NOMBRE_FAMILIA: Record<Familia, string> = {
  humedad_filtracion: "Humedad y filtraciones",
  plomeria_desagues: "Plomería y desagües",
  aberturas_carpinteria: "Aberturas y carpintería",
  fisuras_pintura: "Fisuras y pintura",
  electricidad: "Electricidad",
  ceramicos_pisos: "Cerámicos y pisos",
  artefactos_accesorios: "Artefactos y accesorios",
  limpieza_otros: "Limpieza",
  otros: "Otros",
};

export function esFamilia(valor: unknown): valor is Familia {
  return typeof valor === "string" && (FAMILIAS as readonly string[]).includes(valor);
}

export type CasoEba = {
  id: string;
  familia: Familia;
  frecuencia: number;
  desperfectoTipo: string;
  diagnosticoMasComun: string;
  diagnosticosAlternativos: string;
  tareaTipica: string;
};

/** Fila cruda de `catalogo_eba`, tal como la devuelve Supabase. */
export type FilaCatalogoEba = {
  id: string;
  familia: string;
  frecuencia: number;
  desperfecto_tipo: string;
  diagnostico_mas_comun: string;
  diagnosticos_alternativos: string | null;
  tarea_tipica: string | null;
};

/* La base tiene un CHECK sobre `familia`, pero igual se filtra acá: si
   alguna vez se agrega una familia en SQL sin agregarla al enum de este
   archivo, preferimos ignorar esas filas antes que propagar un valor que
   el resto del código no sabe tratar. */
export function mapearCatalogo(filas: FilaCatalogoEba[]): CasoEba[] {
  const casos: CasoEba[] = [];
  for (const f of filas) {
    if (!esFamilia(f.familia)) {
      console.warn(`[antecedentes] familia desconocida en catalogo_eba: ${f.familia}`);
      continue;
    }
    casos.push({
      id: f.id,
      familia: f.familia,
      frecuencia: Number(f.frecuencia),
      desperfectoTipo: f.desperfecto_tipo,
      diagnosticoMasComun: f.diagnostico_mas_comun,
      diagnosticosAlternativos: f.diagnosticos_alternativos ?? "",
      tareaTipica: f.tarea_tipica ?? "",
    });
  }
  return casos;
}

/** Las familias que realmente tienen antecedentes cargados. Si el catálogo
 *  viniera vacío, no tiene sentido ofrecerle al modelo un enum completo. */
export function familiasConCasos(casos: CasoEba[]): Familia[] {
  const presentes = new Set(casos.map((c) => c.familia));
  return FAMILIAS.filter((f) => presentes.has(f));
}

/* ---------- La sección que se le pasa al modelo ----------

   Se arma agrupada por familia para que el modelo vea la estructura de
   la decisión (primero la familia, después el antecedente) en vez de una
   lista plana de ciento treinta y dos líneas sueltas. */
export function seccionPromptAntecedentes(casos: CasoEba[]): string {
  if (casos.length === 0) return "";

  const bloques: string[] = [];
  for (const familia of familiasConCasos(casos)) {
    const deLaFamilia = casos
      .filter((c) => c.familia === familia)
      .sort((a, b) => b.frecuencia - a.frecuencia);

    const lineas = deLaFamilia.map((c) => {
      const alternativos = c.diagnosticosAlternativos.trim()
        ? ` | también fue: ${c.diagnosticosAlternativos.trim()}`
        : "";
      return `  [${c.id}] (${c.frecuencia} veces) "${c.desperfectoTipo}" → suele ser: ${c.diagnosticoMasComun}${alternativos}`;
    });

    bloques.push(`${familia} — ${NOMBRE_FAMILIA[familia]}\n${lineas.join("\n")}`);
  }

  return bloques.join("\n\n");
}

export const INSTRUCCIONES_ANTECEDENTES = `ANTECEDENTES REALES DE ENJINIA EN ESTE PREDIO

Abajo está lo que ENJINIA ya resolvió acá. Cada línea es un caso real con su
identificador entre corchetes, cuántas veces apareció, cómo se describió el
desperfecto y qué terminó siendo.

Cómo usarlos:

1. Primero elegí la FAMILIA del problema. Es la decisión más importante y la
   que casi siempre se puede tomar bien.
2. Después elegí hasta 3 antecedentes DE ESA MISMA FAMILIA que se parezcan al
   caso de la persona, y devolvé sus identificadores exactos.
3. Si ninguno se parece, devolvé la lista de antecedentes vacía. Es una
   respuesta válida y preferible a forzar un parecido que no existe.
4. NUNCA inventes un identificador. Sólo valen los que están en esta lista,
   escritos igual. Cualquier otro se descarta y la persona se queda sin
   antecedentes.
5. Los antecedentes son ORIENTACIÓN, no un diagnóstico cerrado. En el archivo
   hay muchísimos casos donde lo que parecía a distancia no era lo que estaba
   pasando. Nunca digas que algo "es" X: decí que suele ser X y preguntá lo
   que haga falta para confirmarlo.
6. Nora no hace inspecciones ni pisa el departamento. No afirmes haber
   revisado nada ni describas una verificación que no ocurrió.
7. Las tareas del archivo son reparaciones profesionales de ENJINIA. No son
   instrucciones para que la persona las haga por su cuenta, y no se las
   presentes como tales.`;

/* ---------- Validación de lo que devuelve el modelo ----------

   Esto es la puerta. Todo lo que no esté acá adentro no existe. */

export function validarFamilia(valor: unknown, casos: CasoEba[]): Familia | null {
  if (!esFamilia(valor)) return null;
  // Una familia sin antecedentes cargados no sirve para mostrar nada.
  return casos.some((c) => c.familia === valor) ? valor : null;
}

/** Devuelve sólo los antecedentes que existen de verdad Y pertenecen a la
 *  familia elegida. Un id inventado, repetido o de otra familia se descarta
 *  en silencio para la persona, con aviso en el log del servidor. */
export function validarAntecedentes(
  valor: unknown,
  casos: CasoEba[],
  familia: Familia | null,
  maximo = 3,
): CasoEba[] {
  if (!Array.isArray(valor) || familia === null) return [];

  const porId = new Map(casos.map((c) => [c.id, c]));
  const elegidos: CasoEba[] = [];
  const yaVistos = new Set<string>();

  for (const bruto of valor) {
    if (typeof bruto !== "string") continue;
    const id = bruto.trim();
    if (!id || yaVistos.has(id)) continue;

    const caso = porId.get(id);
    if (!caso) {
      console.warn(`[antecedentes] el modelo devolvió un id que no existe: ${id}`);
      continue;
    }
    if (caso.familia !== familia) {
      console.warn(`[antecedentes] id ${id} es de ${caso.familia}, no de ${familia}`);
      continue;
    }

    yaVistos.add(id);
    elegidos.push(caso);
    if (elegidos.length >= maximo) break;
  }

  return elegidos;
}

/** Lo que viaja al navegador. Se manda la tarea típica porque a la persona le
 *  sirve saber qué suele implicar el arreglo, pero la pantalla tiene que
 *  presentarla como lo que es: lo que hizo ENJINIA otras veces. */
export type AntecedenteParaCliente = {
  id: string;
  familia: Familia;
  familiaNombre: string;
  frecuencia: number;
  desperfecto: string;
  sueleSer: string;
  tambienFue: string;
  tareaHabitual: string;
};

export function paraCliente(casos: CasoEba[]): AntecedenteParaCliente[] {
  return casos.map((c) => ({
    id: c.id,
    familia: c.familia,
    familiaNombre: NOMBRE_FAMILIA[c.familia],
    frecuencia: c.frecuencia,
    desperfecto: c.desperfectoTipo,
    sueleSer: c.diagnosticoMasComun,
    tambienFue: c.diagnosticosAlternativos,
    tareaHabitual: c.tareaTipica,
  }));
}
