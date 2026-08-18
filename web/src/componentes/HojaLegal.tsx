"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/* Términos y Condiciones + Política de Privacidad.

   BORRADOR — ver aviso también en el chat con el equipo: este texto lo
   escribió Nora (el asistente), no un abogado. Cubre lo que la app
   REALMENTE hace hoy (nada inventado: sin garantías de seguro, sin
   certificaciones que no existen), pero antes de publicarlo de verdad
   tiene que pasar por una revisión legal — sobre todo la razón social,
   CUIT y domicilio real de la empresa, que quedaron como [COMPLETAR]
   porque no son un dato que Nora (el asistente) pueda inventar. */

const ULTIMA_ACTUALIZACION = "18 de agosto de 2026";

export function HojaLegal({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto, alCerrar]);

  return (
    <>
      <div
        onClick={alCerrar}
        className={`absolute inset-0 z-[55] bg-black/40 transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Términos y condiciones, y política de privacidad"
        className={`absolute bottom-0 inset-x-0 z-[56] bg-sand rounded-t-[26px] shadow-sheet max-h-[90%] overflow-y-auto no-scrollbar transition-transform duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
          abierto ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-2.5" />
        <div className="px-5 pt-3 pb-10">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold font-display text-ink">Términos y privacidad</h2>
            <button
              type="button"
              onClick={alCerrar}
              className="press w-9 h-9 grid place-items-center rounded-full bg-surface border border-line text-ink"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11.5px] text-faint mt-1">Última actualización: {ULTIMA_ACTUALIZACION}</p>

          <div className="mt-5 space-y-5 text-[13.5px] text-ink leading-relaxed">
            <Seccion titulo="1. Qué es Nora">
              <p>
                Nora es una plataforma que conecta a personas que necesitan un servicio técnico para
                su hogar (plomería, electricidad, cerrajería, gas, aire acondicionado, pintura,
                carpintería, albañilería y limpieza) con técnicos independientes verificados. Nora
                intermedia el pedido, el presupuesto, el seguimiento y el pago — no es la empresa que
                realiza el trabajo: cada técnico es un prestador independiente, no un empleado de
                Nora.
              </p>
            </Seccion>

            <Seccion titulo="2. Quién puede usar Nora">
              <p>
                Cualquier persona mayor de 18 años puede crear una cuenta como cliente. Para operar
                como técnico hace falta pasar un proceso de verificación (documentación y matrícula
                cuando el rubro la requiere) antes de recibir pedidos.
              </p>
            </Seccion>

            <Seccion titulo="3. Cómo funciona el servicio">
              <p>
                El cliente describe el problema (con texto y, opcionalmente, una foto). Nora estima un
                rango de precio orientativo cuando puede identificar el trabajo; el precio final lo
                confirma el técnico o el equipo de Nora antes de empezar. El pedido se asigna a un
                técnico verificado del rubro y la zona. El cliente puede seguir el estado del pedido en
                vivo (confirmado, en camino, trabajando, terminado) y chatear con el técnico dentro de
                la app. El trabajo se marca como terminado sólo cuando el cliente le dicta al técnico
                un código de confirmación — nadie puede cerrarlo sin eso.
              </p>
            </Seccion>

            <Seccion titulo="4. Pagos">
              <p>
                El cobro se realiza a través de Mercado Pago, una vez confirmado el trabajo. No se
                cobra nada antes de que el cliente confirme el precio. Nora no almacena datos de
                tarjetas ni de medios de pago: eso lo procesa Mercado Pago directamente.
              </p>
            </Seccion>

            <Seccion titulo="5. Cancelaciones">
              <p>
                El cliente puede cancelar un pedido antes de que un técnico lo confirme sin cargo. Una
                vez que el técnico confirmó y especialmente si ya está en camino o trabajando, una
                cancelación puede generar un cargo por el tiempo y el desplazamiento del técnico — la
                app avisa esto de forma explícita antes de confirmar la cancelación en esos casos.
              </p>
            </Seccion>

            <Seccion titulo="6. Responsabilidad">
              <p>
                Nora verifica la identidad y, cuando el rubro lo exige, la matrícula profesional de
                cada técnico antes de habilitarlo — pero no garantiza el resultado del trabajo ni
                actúa como aseguradora. Cualquier reclamo sobre la calidad de un trabajo se gestiona a
                través del sistema de calificaciones y del soporte de Nora, y puede derivar en la
                suspensión del técnico involucrado.
              </p>
            </Seccion>

            <Seccion titulo="7. Cuentas y verificación">
              <p>
                Cada persona es responsable de la información que carga y de mantener segura su
                contraseña. Los técnicos deben presentar documentación real y vigente; presentar
                documentación falsa es motivo de baja inmediata y puede derivar en acciones legales.
              </p>
            </Seccion>

            <Seccion titulo="8. Uso aceptable">
              <p>
                No está permitido usar Nora para coordinar trabajos fuera de la plataforma evitando el
                pago correspondiente, acosar o discriminar a otros usuarios, ni suplantar la identidad
                de otra persona.
              </p>
            </Seccion>

            <Seccion titulo="9. Cambios a estos términos">
              <p>
                Nora puede actualizar estos términos. Los cambios importantes se avisan dentro de la
                app antes de que entren en vigencia.
              </p>
            </Seccion>

            <Seccion titulo="10. Ley aplicable">
              <p>
                Estos términos se rigen por las leyes de la República Argentina, incluyendo la Ley de
                Defensa del Consumidor (24.240). Ante cualquier conflicto, las partes se someten a los
                tribunales competentes de [COMPLETAR — jurisdicción de la empresa].
              </p>
            </Seccion>

            <div className="h-px bg-line my-2" />

            <Seccion titulo="Política de privacidad">
              <p>
                Esta sección explica qué datos recolecta Nora y para qué, en línea con la Ley de
                Protección de Datos Personales (25.326).
              </p>
            </Seccion>

            <Seccion titulo="Qué datos recolectamos">
              <ul className="list-disc pl-4 space-y-1">
                <li>Nombre, email y teléfono de contacto.</li>
                <li>Domicilios cargados, con su ubicación geográfica.</li>
                <li>Descripciones y fotos de los problemas que reportás.</li>
                <li>
                  Para técnicos: documentación de identidad y matrícula, y ubicación en vivo mientras
                  el estado del pedido es &quot;en camino&quot;.
                </li>
                <li>Mensajes de chat dentro de un pedido.</li>
              </ul>
            </Seccion>

            <Seccion titulo="Para qué los usamos">
              <p>
                Para conectar el pedido con un técnico disponible cerca tuyo, mostrarte su seguimiento
                en vivo, procesar el pago, y contactarte por temas relacionados a tu pedido si hace
                falta. No vendemos datos personales a terceros.
              </p>
            </Seccion>

            <Seccion titulo="Con quién se comparte">
              <p>
                El técnico asignado ve tu nombre, domicilio y teléfono mientras el pedido está activo.
                Vos ves el nombre, la foto, el promedio de calificación y la cantidad de trabajos del
                técnico — nunca su documento de identidad, que sólo usa el equipo de Nora para
                verificarlo. Mercado Pago procesa los pagos con sus propias políticas de privacidad.
              </p>
            </Seccion>

            <Seccion titulo="Tus derechos">
              <p>
                Podés pedir acceder, rectificar o eliminar tus datos personales escribiendo por Ayuda
                dentro de la app. La Agencia de Acceso a la Información Pública es el organismo de
                control de la Ley 25.326.
              </p>
            </Seccion>

            <Seccion titulo="Contacto">
              <p>[COMPLETAR — razón social, CUIT, domicilio legal y email de contacto de la empresa]</p>
            </Seccion>
          </div>
        </div>
      </div>
    </>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[13px] font-bold font-display text-ink mb-1">{titulo}</h3>
      {children}
    </div>
  );
}
