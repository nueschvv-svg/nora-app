import { redirect } from "next/navigation";

/* La raíz lleva directo a la app — no hay landing pública separada.
   Sin sesión, el middleware ya se encarga de crear una anónima antes
   de que esto corra (o de mandar a /entrar si eso falla), así que acá
   no hace falta preguntar nada: /inicio siempre tiene con qué pintar. */
export default function Raiz() {
  redirect("/inicio");
}
