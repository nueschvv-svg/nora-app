# Inventario de controles y rutas

Generado desde el código. Cada fila identifica un control, su acción declarada y su ubicación. No implica que se haya probado cada interacción: consultar INFORME.md para distinguir evidencia de navegador, tests y revisión estática.

Total: 103 declaraciones de controles. Los controles dinámicos (categorías, fechas, filas) generan varias instancias desde una misma declaración.

## web/src/app/(cliente)/(app)/inicio/agenda/page.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 30 | Link | href="/inicio"; aria-label="Volver" | Declaración revisable; ejecución ver informe |
| 98 | button | type="button"; onClick={() => setFormAbierto(true)} | Declaración revisable; ejecución ver informe |
| 107 | Link | href="/pedir" | Declaración revisable; ejecución ver informe |

## web/src/app/(cliente)/(app)/inicio/score/page.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 32 | Link | href="/inicio"; aria-label="Volver" | Declaración revisable; ejecución ver informe |
| 133 | Link | href="/pedir" | Declaración revisable; ejecución ver informe |

## web/src/app/(cliente)/(app)/pedidos/page.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 46 | button | type="button"; disabled={cargando}; onClick={() => { setCargando(true); void cargar(); }} | Declaración revisable; ejecución ver informe |
| 48 | Link | href="/pedir" | Declaración revisable; ejecución ver informe |
| 50 | button | type="button"; onClick={() => setSeleccionado(servicio)} | Declaración revisable; ejecución ver informe |

## web/src/app/(cliente)/(flujo)/pedir/page.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 545 | button | type="button"; onClick={() => (paso === 0 ? router.push("/inicio") : setPaso(paso - 1))}; aria-label={paso === 0 ? "Salir" : "Paso anterior"} | Declaración revisable; ejecución ver informe |
| 568 | Link | href="/inicio"; aria-label="Cerrar" | Declaración revisable; ejecución ver informe |
| 584 | input | type="file"; onChange={alCambiarFoto}; aria-label="Sacar o elegir una foto del problema" | Declaración revisable; ejecución ver informe |
| 619 | button | type="button"; onClick={reintentarCategorias} | Declaración revisable; ejecución ver informe |
| 633 | button | type="button"; disabled={!c.activa}; onClick={() => setCategoria(c.slug)}; aria-label={c.activa ? c.nombre : `${c.nombre} — todavía no disponible`} | Declaración revisable; ejecución ver informe |
| 702 | textarea | id="descripcion"; value={descripcion}; onChange={(e) => setDescripcion(e.target.value)}; placeholder="Ej: pierde agua la conexión de abajo de la bacha de la cocina, gotea desde ayer." | Declaración revisable; ejecución ver informe |
| 723 | ControlFoto |  | Declaración revisable; ejecución ver informe |
| 761 | button | type="button"; onClick={() => setDia(d.iso)} | Declaración revisable; ejecución ver informe |
| 783 | button | type="button"; onClick={() => setFranja(f.id)} | Declaración revisable; ejecución ver informe |
| 830 | button | type="button"; onClick={usarOtrosDatos} | Declaración revisable; ejecución ver informe |
| 851 | CampoTexto | id="nombre-inicial"; etiqueta="Nombre completo"; placeholder="Nombre y apellido"; value={nombreInicial}; onChange={(e) => setNombreInicial(e.target.value)} | Declaración revisable; ejecución ver informe |
| 860 | CampoTexto | id="telefono-inicial"; etiqueta="Teléfono"; type="tel"; value={telefonoInicial}; onChange={(e) => setTelefonoInicial(e.target.value)}; placeholder="11 1234 5678" | Declaración revisable; ejecución ver informe |
| 872 | CampoTexto | id="mail-inicial"; etiqueta="Mail (opcional)"; type="email"; value={mailInicial}; onChange={(e) => setMailInicial(e.target.value)}; placeholder="tu@mail.com" | Declaración revisable; ejecución ver informe |
| 886 | CampoTexto | id="calle-inicial"; etiqueta="Calle"; value={calleInicial}; onChange={(e) => setCalleInicial(e.target.value)} | Declaración revisable; ejecución ver informe |
| 894 | CampoTexto | id="numero-inicial"; etiqueta="Altura"; value={numeroInicial}; onChange={(e) => setNumeroInicial(e.target.value)} | Declaración revisable; ejecución ver informe |
| 904 | CampoTexto | id="localidad-inicial"; etiqueta="Localidad"; value={localidadInicial}; onChange={(e) => setLocalidadInicial(e.target.value)} | Declaración revisable; ejecución ver informe |
| 920 | select | id="provincia-inicial"; value={provinciaInicial}; onChange={(e) => setProvinciaInicial(e.target.value)} | Declaración revisable; ejecución ver informe |
| 1004 | button | type="button"; onClick={avanzar}; disabled={!puedeAvanzar \|\| enviando} | Declaración revisable; ejecución ver informe |
| 1099 | input | id={id}; type="text" | Declaración revisable; ejecución ver informe |
| 1146 | button | type="button"; onClick={() => onQuitar(i)}; aria-label={`Quitar foto ${i + 1}`} | Declaración revisable; ejecución ver informe |
| 1160 | button | type="button"; onClick={onElegir} | Declaración revisable; ejecución ver informe |
| 1371 | textarea | value={descripcion}; onChange={(e) => onDescripcionChange(e.target.value)}; placeholder="¿Algo más para contarle a Nora?" | Declaración revisable; ejecución ver informe |
| 1378 | ControlFoto |  | Declaración revisable; ejecución ver informe |
| 1484 | Link | href="/pedidos" | Declaración revisable; ejecución ver informe |

## web/src/app/cambiar-clave/page.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 61 | form | onSubmit={guardar} | Declaración revisable; ejecución ver informe |
| 70 | input | id="clave"; type={ver ? "text" : "password"}; value={clave}; onChange={(e) => setClave(e.target.value)} | Declaración revisable; ejecución ver informe |
| 78 | button | type="button"; onClick={() => setVer(!ver)}; aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} | Declaración revisable; ejecución ver informe |
| 99 | input | id="repetida"; type={ver ? "text" : "password"}; value={repetida}; onChange={(e) => setRepetida(e.target.value)} | Declaración revisable; ejecución ver informe |
| 123 | button | type="submit"; disabled={!valido \|\| cargando} | Declaración revisable; ejecución ver informe |

## web/src/app/entrar/page.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 169 | button | type="button"; onClick={() => { setRevisarMail(false); setMailRecuperacion(false); setModo("entrar"); setClave(""); }} | Declaración revisable; ejecución ver informe |
| 202 | form | onSubmit={enviar} | Declaración revisable; ejecución ver informe |
| 233 | input | id="clave"; type={verClave ? "text" : "password"}; value={clave}; onChange={(e) => setClave(e.target.value)} | Declaración revisable; ejecución ver informe |
| 242 | button | type="button"; onClick={() => setVerClave(!verClave)}; aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"} | Declaración revisable; ejecución ver informe |
| 265 | button | type="submit"; disabled={!valido \|\| cargando} | Declaración revisable; ejecución ver informe |
| 283 | button | type="button"; onClick={entrarConGoogle}; disabled={cargando} | Declaración revisable; ejecución ver informe |
| 296 | button | type="button"; onClick={() => { setModo("recuperar"); setError(null); }} | Declaración revisable; ejecución ver informe |
| 310 | button | type="button"; onClick={() => { setModo("entrar"); setError(null); }} | Declaración revisable; ejecución ver informe |
| 323 | button | type="button"; onClick={() => { setModo(registrando ? "entrar" : "registrarse"); setError(null); }} | Declaración revisable; ejecución ver informe |
| 390 | input | id={id}; type="text" | Declaración revisable; ejecución ver informe |

## web/src/app/global-error.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 40 | button | type="button"; onClick={reset} | Declaración revisable; ejecución ver informe |

## web/src/componentes/BotNora.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 144 | div | role="dialog"; aria-label="Asistente Nora" | Declaración revisable; ejecución ver informe |
| 161 | button | type="button"; onClick={() => setAbierto(false)}; aria-label="Cerrar" | Declaración revisable; ejecución ver informe |
| 230 | a | href={linkWhatsapp("Hola! Necesito ayuda con la app Nora.")} | Declaración revisable; ejecución ver informe |
| 252 | button | type="button"; onClick={onClick} | Declaración revisable; ejecución ver informe |
| 273 | button | type="button"; onClick={onClick} | Declaración revisable; ejecución ver informe |
| 286 | button | type="button"; onClick={onClick} | Declaración revisable; ejecución ver informe |

## web/src/componentes/ChatNora.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 196 | button | type="button"; onClick={solicitarServicio} | Declaración revisable; ejecución ver informe |
| 205 | form | onSubmit={enviar} | Declaración revisable; ejecución ver informe |
| 209 | input | id="mensaje-nora"; type="text"; value={entrada}; onChange={(e) => setEntrada(e.target.value)}; placeholder="Ej: pierde agua la canilla de la cocina…"; disabled={enviando} | Declaración revisable; ejecución ver informe |
| 218 | button | type="submit"; disabled={!entrada.trim() \|\| enviando}; aria-label="Enviar" | Declaración revisable; ejecución ver informe |

## web/src/componentes/Esqueleto.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 30 | button | type="button"; onClick={alReintentar} | Declaración revisable; ejecución ver informe |

## web/src/componentes/FormularioEquipo.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 99 | div | role="dialog"; aria-label="Agregar un equipo" | Declaración revisable; ejecución ver informe |
| 108 | form | onSubmit={guardar} | Declaración revisable; ejecución ver informe |
| 114 | button | type="button"; onClick={alCerrar}; aria-label="Cerrar" | Declaración revisable; ejecución ver informe |
| 134 | button | type="button"; onClick={() => setTipo(t)}; aria-label={r.etiqueta} | Declaración revisable; ejecución ver informe |
| 177 | input | id="ultima-revision"; type="date"; value={ultimaRevision}; disabled={nuncaRevisado}; onChange={(e) => setUltimaRevision(e.target.value)} | Declaración revisable; ejecución ver informe |
| 187 | input | type="checkbox"; onChange={(e) => { setNuncaRevisado(e.target.checked); if (e.target.checked) setUltimaRevision(""); }} | Declaración revisable; ejecución ver informe |
| 209 | input | id="marca"; type="text"; value={marca}; onChange={(e) => setMarca(e.target.value)}; placeholder="Orbis" | Declaración revisable; ejecución ver informe |
| 225 | input | id="anio"; type="text"; value={anio}; onChange={(e) => setAnio(e.target.value.replace(/\D/g, "").slice(0, 4))}; placeholder="2018" | Declaración revisable; ejecución ver informe |
| 251 | button | type="submit"; disabled={!valido \|\| guardando} | Declaración revisable; ejecución ver informe |

## web/src/componentes/HojaLegal.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 38 | div | role="dialog"; aria-label="Términos y condiciones, y política de privacidad" | Declaración revisable; ejecución ver informe |
| 50 | button | type="button"; onClick={alCerrar}; aria-label="Cerrar" | Declaración revisable; ejecución ver informe |

## web/src/componentes/HojaNotificaciones.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 73 | div | role="dialog"; aria-label="Notificaciones" | Declaración revisable; ejecución ver informe |
| 87 | button | type="button"; onClick={alCerrar}; aria-label="Cerrar" | Declaración revisable; ejecución ver informe |
| 98 | button | type="button"; onClick={alMarcarTodas} | Declaración revisable; ejecución ver informe |
| 127 | button | type="button"; onClick={() => tocarNotificacion(n)} | Declaración revisable; ejecución ver informe |
| 195 | Link | href="/pedir"; onClick={alCerrar} | Declaración revisable; ejecución ver informe |

## web/src/componentes/HojaServicio.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 281 | div | role="dialog"; aria-label="Detalle del servicio" | Declaración revisable; ejecución ver informe |
| 319 | button | type="button"; onClick={alCerrar}; aria-label="Cerrar" | Declaración revisable; ejecución ver informe |
| 378 | button | type="button"; onClick={() => responderOferta("aceptar")}; disabled={!!respondiendoOferta} | Declaración revisable; ejecución ver informe |
| 391 | button | type="button"; onClick={() => { if (!window.confirm("¿Rechazar esta oferta? Te vamos a contactar de nuevo.")) return; responderOferta("rechazar"); }}; disabled={!!respondiendoOferta} | Declaración revisable; ejecución ver informe |
| 443 | button | type="button"; onClick={confirmarEfectivo}; disabled={confirmandoPago} | Declaración revisable; ejecución ver informe |
| 456 | button | type="button"; disabled | Declaración revisable; ejecución ver informe |
| 526 | button | type="button"; onClick={() => setEstrellas(n)}; aria-label={`${n} estrellas`} | Declaración revisable; ejecución ver informe |
| 539 | textarea | value={comentarioCalificacion}; onChange={(e) => setComentarioCalificacion(e.target.value)}; placeholder="Contanos cómo te fue (opcional)" | Declaración revisable; ejecución ver informe |
| 551 | button | type="button"; onClick={enviarCalificacion}; disabled={guardandoCalificacion} | Declaración revisable; ejecución ver informe |

## web/src/componentes/NavSuperior.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 16 | Link | href="/pedir" | Declaración revisable; ejecución ver informe |
| 23 | Link | href="/pedidos" | Declaración revisable; ejecución ver informe |
| 25 | Link | href="/inicio"; aria-label="Ir a inicio" | Declaración revisable; ejecución ver informe |
| 29 | button | type="button"; onClick={() => window.dispatchEvent(new Event("nora:abrir-ayuda"))}; aria-label="Ayuda" | Declaración revisable; ejecución ver informe |

## web/src/componentes/cinema/EscenaCinema.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 100 | button | type="button"; onClick={saltarAlChat} | Declaración revisable; ejecución ver informe |

## web/src/componentes/operaciones/DetalleServicio.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 135 | Link | href="/operaciones" | Declaración revisable; ejecución ver informe |
| 335 | input | type="number"; value={monto}; onChange={(e) => setMonto(e.target.value)}; placeholder="Ej: 25000" | Declaración revisable; ejecución ver informe |
| 363 | button | type="button"; onClick={() => setRechazando(true)} | Declaración revisable; ejecución ver informe |
| 375 | textarea | value={motivo}; onChange={(e) => setMotivo(e.target.value)}; placeholder="Ej: fuera de la zona que cubrimos" | Declaración revisable; ejecución ver informe |
| 390 | button | type="button"; onClick={() => setRechazando(false)} | Declaración revisable; ejecución ver informe |
| 452 | button | type="button"; onClick={onClick}; disabled={cargando} | Declaración revisable; ejecución ver informe |
| 480 | input | type="number"; value={valor}; onChange={(e) => setValor(e.target.value)}; placeholder="Sin definir" | Declaración revisable; ejecución ver informe |
| 520 | input | type="date"; value={dia}; onChange={(e) => setDia(e.target.value)} | Declaración revisable; ejecución ver informe |
| 526 | select | value={franja}; onChange={(e) => setFranja(e.target.value)} | Declaración revisable; ejecución ver informe |
| 539 | textarea | value={nota}; onChange={(e) => setNota(e.target.value)}; placeholder="¿Por qué se reprograma? (obligatorio)" | Declaración revisable; ejecución ver informe |
| 575 | input | type="text"; value={texto}; onChange={(e) => setTexto(e.target.value)}; placeholder="Ej: llamé al cliente, confirma horario" | Declaración revisable; ejecución ver informe |

## web/src/componentes/operaciones/ListaPedidos.tsx

| Línea | Elemento | Acción / identificación | Evidencia |
|---|---|---|---|
| 77 | button | type="button"; onClick={async () => { await supabaseNavegador().auth.signOut(); router.replace("/entrar"); router.refresh(); }} | Declaración revisable; ejecución ver informe |
| 141 | button | type="button"; onClick={() => setPestana(valor)} | Declaración revisable; ejecución ver informe |
| 177 | Link | href={`/operaciones/${s.id}`} | Declaración revisable; ejecución ver informe |
