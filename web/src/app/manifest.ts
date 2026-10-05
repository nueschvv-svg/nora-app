import type { MetadataRoute } from "next";

/* Hace que Nora se pueda "instalar" en el celular desde el navegador
   y se abra a pantalla completa, sin barra de direcciones.
   Los íconos hay que generarlos a partir del isotipo (pendiente). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nora · Sector 15",
    short_name: "Nora",
    /* Lo que decía antes ("técnicos verificados y presupuesto claro") es de
       otro producto: acá no hay técnicos externos y el precio lo confirma
       ENJINIA después. Prometer eso en la pantalla de instalación es una
       promesa que la app no cumple. */
    description:
      "Pedí un arreglo para tu departamento del Sector 15 y seguí cómo avanza. Lo resuelve ENJINIA.",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#0e5c54",
    theme_color: "#0e5c54",
    lang: "es-AR",
    orientation: "portrait",
    icons: [],
  };
}
