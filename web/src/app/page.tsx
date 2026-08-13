import { redirect } from "next/navigation";

/* Por ahora la raíz lleva directo a la app.
   Cuando exista login, acá va la landing pública y el redirect
   pasa a depender de si hay sesión. */
export default function Raiz() {
  redirect("/inicio");
}
