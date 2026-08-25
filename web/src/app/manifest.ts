import type { MetadataRoute } from "next";

/* Hace que Nora se pueda "instalar" en el celular desde el navegador
   y se abra a pantalla completa, sin barra de direcciones.
   Los íconos hay que generarlos a partir del isotipo (pendiente). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nora, tu hogar en control",
    short_name: "Nora",
    description:
      "Pedí un servicio para tu casa y seguí todo desde el celular. Técnicos verificados y presupuesto claro.",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#0e5c54",
    theme_color: "#0e5c54",
    lang: "es-AR",
    orientation: "portrait",
    icons: [],
  };
}
