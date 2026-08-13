import { NavInferior } from "@/componentes/NavInferior";
import { ProveedorApp } from "@/componentes/ContextoApp";

/* El "marco de teléfono". En el celular ocupa toda la pantalla;
   en escritorio queda centrado con el fondo arena alrededor.
   Uso dvh y no vh: en Safari de iPhone, vh queda tapado por la
   barra de direcciones y se come la navegación de abajo. */
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorApp>
      <div className="relative w-full max-w-[440px] h-dvh bg-sand overflow-hidden shadow-2xl">
        {children}
        <NavInferior />
      </div>
    </ProveedorApp>
  );
}
