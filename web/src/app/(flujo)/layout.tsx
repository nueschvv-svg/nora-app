import { ProveedorApp } from "@/componentes/ContextoApp";

/* Layout para flujos a pantalla completa (pedir un servicio, alta de equipo).
   Mismo marco que la app, pero SIN la barra de navegación de abajo.

   Por qué está separado: si el flujo se dibujara encima de la barra,
   la barra seguiría existiendo debajo — invisible, pero alcanzable con
   el teclado y anunciada por los lectores de pantalla. Sacarla del árbol
   es más simple y más correcto que taparla. */
export default function LayoutFlujo({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorApp>
      <div className="relative w-full max-w-[440px] h-dvh bg-sand overflow-hidden shadow-2xl">
        {children}
      </div>
    </ProveedorApp>
  );
}
