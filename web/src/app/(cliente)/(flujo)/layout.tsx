/* Layout para flujos a pantalla completa (pedir un servicio, alta de equipo).
   Mismo marco que la app, pero SIN la barra de navegación de abajo.

   Por qué está separado: si el flujo se dibujara encima de la barra,
   la barra seguiría existiendo debajo — invisible, pero alcanzable con
   el teclado y anunciada por los lectores de pantalla. Sacarla del árbol
   es más simple y más correcto que taparla.

   La sesión, el chequeo de operaciones y <ProveedorApp> ya los resuelve
   el layout padre (cliente)/layout.tsx, compartido con (app) — antes
   estaban acá duplicados, con su propio <ProveedorApp> aparte: cruzar
   entre los dos grupos de rutas desmontaba y volvía a montar todo eso
   de cero en cada navegación. */
export default function LayoutFlujo({ children }: { children: React.ReactNode }) {
  return <div className="relative w-full h-dvh bg-sand overflow-hidden">{children}</div>;
}
