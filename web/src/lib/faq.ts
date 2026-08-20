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
          "Tocá el botón + del medio (abajo) o \"Pedir un servicio\". Elegís el rubro, contás qué pasa (o mandás una foto y Nora te tira un estimado ahí mismo) y decís cuándo te viene bien. El seguimiento y el precio confirmado los ves en tu Historial, todo dentro de la app.",
      },
      {
        tipo: "respuesta",
        id: "precio",
        etiqueta: "¿Cuánto cuesta un servicio?",
        texto:
          "Depende del trabajo — si mandás una foto, Nora te da un estimado al toque. El precio final lo confirmamos en tu Historial antes de arrancar, y no se cobra nada hasta que lo aceptás.",
      },
      {
        tipo: "respuesta",
        id: "cancelar",
        etiqueta: "¿Puedo cancelar un pedido?",
        texto:
          "Sí, mientras todavía no arrancó. Por ahora escribinos por WhatsApp para cancelarlo — el botón para hacerlo vos mismo desde Historial todavía no está listo.",
      },
      {
        tipo: "respuesta",
        id: "historial",
        etiqueta: "¿Dónde veo mis pedidos anteriores?",
        texto: "En la pestaña Historial (abajo). Ahí separamos lo que está en curso de lo que ya se resolvió.",
      },
    ],
  },
  {
    tipo: "categoria",
    id: "propiedad",
    etiqueta: "Mi propiedad",
    hijos: [
      {
        tipo: "respuesta",
        id: "domicilio",
        etiqueta: "¿Cómo agrego un domicilio?",
        texto:
          "Desde Perfil, tocá \"Agregar domicilio\" y completá calle, altura y localidad. Podés tener varios y elegir cuál está activo desde Inicio.",
      },
      {
        tipo: "respuesta",
        id: "equipos",
        etiqueta: "¿Para qué sirve cargar mis equipos?",
        texto:
          "Con tus equipos (calefón, termotanque, aire, etc.) calculamos el score de salud de tu propiedad y te avisamos cuándo corresponde la próxima revisión — antes de que se rompan o venzan.",
      },
      {
        tipo: "respuesta",
        id: "score",
        etiqueta: "¿Qué es el score de la propiedad?",
        texto:
          "Es un número de 0 a 100 que resume qué tan al día están tus equipos con sus revisiones obligatorias y recomendadas. Cuantos más equipos cargados y revisados, más alto el score.",
      },
    ],
  },
  {
    tipo: "categoria",
    id: "cuenta",
    etiqueta: "Mi cuenta y trabajo",
    hijos: [
      {
        tipo: "respuesta",
        id: "cuenta",
        etiqueta: "¿Cómo cierro sesión o cambio mi contraseña?",
        texto:
          "Cerrar sesión está al final de Perfil. Para cambiar la contraseña, usá \"Me olvidé la contraseña\" en la pantalla de inicio de sesión.",
      },
      {
        tipo: "respuesta",
        id: "trabajador",
        etiqueta: "¿Cómo me sumo como trabajador de Nora?",
        texto:
          "Desde Perfil, abajo del todo, tocá \"Trabajá con Nora\" y completá tus datos y zona de cobertura. Tu ficha queda pendiente de verificación hasta que nuestro equipo la revise.",
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
