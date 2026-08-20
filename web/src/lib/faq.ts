/* ============================================================
   Asistente Nora — árbol de opciones, sin IA generativa.

   A propósito: nada de texto libre ni de modelo de lenguaje acá.
   Es pura navegación por botones — el usuario elige una categoría,
   dentro de la categoría elige una pregunta, y esa pregunta ya trae
   la respuesta escrita de antemano. Cero variabilidad, cero costo
   por mensaje, cero riesgo de que invente algo que Nora no hace.

   Si el día de mañana esto se banca conectar un LLM de verdad, este
   mismo árbol sirve como el material de referencia (grounding) para
   que no invente respuestas fuera de lo que Nora realmente hace.
   ============================================================ */

export type NodoRespuesta = {
  tipo: "respuesta";
  id: string;
  etiqueta: string;
  texto: string;
};

export type NodoCategoria = {
  tipo: "categoria";
  id: string;
  etiqueta: string;
  hijos: NodoRespuesta[];
};

export const MENU_ASISTENTE: NodoCategoria[] = [
  {
    tipo: "categoria",
    id: "pedidos",
    etiqueta: "Pedidos y servicios",
    hijos: [
      {
        tipo: "respuesta",
        id: "pedir-servicio",
        etiqueta: "¿Cómo pido un servicio?",
        texto:
          "Contanos qué pasa en el chat de Inicio — con texto o una foto, Nora te tira un estimado ahí mismo. Elegís el rubro, decís cuándo te viene bien, y al final dejás tu domicilio y teléfono para que te confirmemos.",
      },
      {
        tipo: "respuesta",
        id: "precio",
        etiqueta: "¿Cuánto cuesta un servicio?",
        texto:
          "Depende del trabajo — si mandás una foto, Nora te da un estimado al toque. El precio final te lo confirmamos antes de arrancar, y no se cobra nada hasta que lo aceptás.",
      },
      {
        tipo: "respuesta",
        id: "estado",
        etiqueta: "¿Cómo veo el estado de mi pedido?",
        texto:
          "Al confirmar el pedido te damos un número de orden — guardalo. Escribinos por WhatsApp con ese número y te contamos en qué está.",
      },
      {
        tipo: "respuesta",
        id: "cancelar",
        etiqueta: "¿Puedo cancelar un pedido?",
        texto: "Sí, mientras todavía no arrancó. Escribinos por WhatsApp con tu número de orden para cancelarlo.",
      },
      {
        tipo: "respuesta",
        id: "contacto",
        etiqueta: "¿Cómo me confirman el pedido?",
        texto:
          "Nuestro equipo te llama o te escribe por WhatsApp al número que dejaste para cerrar el horario exacto y cualquier detalle antes de ir.",
      },
    ],
  },
];

/** Número de WhatsApp de soporte, en formato internacional sin signos
 *  (lo que espera wa.me). +54 9 11 2705-8835 → 5491127058835. */
const WHATSAPP_SOPORTE = "5491127058835";

export function linkWhatsapp(mensaje: string): string {
  return `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`;
}
