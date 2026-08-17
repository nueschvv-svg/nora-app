-- ============================================================
-- PRECIOS FALTANTES — los 6 rubros que nunca tuvieron tarifa
--
-- Bug real, encontrado en vivo dos veces: el cliente pedía un
-- servicio de Aire, Pintura, etc. y JAMÁS veía un estimado de
-- precio, en ningún caso, sin importar lo que escribiera. La causa
-- no era el modelo ni el matching de texto — era que `tarifas` y
-- `catalogo_trabajos` (db/04_catalogo_precios.sql) sólo tenían
-- filas para plomería, electricidad y cerrajería. Sin una tarifa
-- cargada para la categoría, no hay con qué calcular nada: el
-- endpoint devolvía identificado:false y ahí se cortaba todo.
--
-- Esta migración le suma tarifa + catálogo a los 6 rubros que
-- faltaban: aire acondicionado, albañilería, carpintería, gas,
-- limpieza, pintura. Mismos criterios que db/04: horas y riesgo son
-- estables, los montos son referencia de agosto 2026 CABA/GBA y hay
-- que revisarlos con la inflación.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

insert into tarifas (categoria_slug, localidad, visita_ars, visita_max_ars, hora_ars, hora_max_ars, recargo_urgencia, nota)
values
  ('aire',         null, 20000, 32000, 24000, 38000, 0.40, 'Referencia CABA/GBA ago-2026. Service vs. instalación completa varían mucho — la instalación casi siempre se cotiza tras la visita.'),
  ('albanileria',  null, 18000, 28000, 18000, 30000, 0.30, 'Referencia CABA/GBA ago-2026. El alcance del trabajo varía tanto que la mayoría de los casos termina mostrando sólo el precio de la visita.'),
  ('carpinteria',  null, 18000, 26000, 20000, 32000, 0.30, 'Referencia CABA/GBA ago-2026. Muebles a medida y aberturas casi siempre se cotizan tras la visita.'),
  ('gas',          null, 22000, 35000, 26000, 42000, 0.50, 'Referencia CABA/GBA ago-2026. Requiere matriculado — por ley, ninguna instalación de gas la puede hacer alguien sin matrícula.'),
  ('limpieza',     null, 14000, 20000, 12000, 18000, 0.20, 'Referencia CABA/GBA ago-2026. Se suele cotizar por hora o por m² — el rango de acá es orientativo para una limpieza estándar.'),
  ('pintura',      null, 18000, 25000, 16000, 26000, 0.30, 'Referencia CABA/GBA ago-2026. El precio real depende de los m² y el estado de la superficie — la visita es lo que permite cotizar cerrado.')
on conflict do nothing;

-- ---------- Trabajos: aire acondicionado ----------

insert into catalogo_trabajos
  (slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia,
   horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas)
values
('aire-no-enfria', 'aire', 'No enfría o enfría poco',
 array['no enfria','no anda frio','tira aire caliente','poco frio','perdio gas','no refrigera','anda mal'],
 'Puede ser falta de gas refrigerante, filtro sucio o un problema del compresor. La revisión determina la causa exacta.',
 'Bajo en general, salvo en ola de calor: ahí se vuelve urgente por salud, sobre todo con bebés o adultos mayores en la casa.',
 'pronto', 1.0, 2.5, 0, 60000, false,
 array['¿Hace cuánto no le hacías el service?','¿Es split, portátil o central?','¿Sale agua o hace ruido raro?']),

('aire-limpieza-service', 'aire', 'Service y limpieza de filtros',
 array['service','limpieza','mantenimiento','filtro sucio','huele feo','huele a humedad'],
 'Limpieza de filtros y serpentina. Se recomienda al menos una vez al año, antes del verano.',
 'Bajo, pero un equipo sin service pierde eficiencia y consume más luz.',
 'programable', 1.0, 1.5, 0, 5000, false,
 array['¿Cuántos equipos necesitás que tengan service?']),

('aire-instalacion', 'aire', 'Instalación de equipo nuevo',
 array['instalar aire','instalacion','equipo nuevo','split nuevo','compre un aire','colocar aire'],
 'Instalación completa: soporte, cañería, cableado y puesta en marcha. El precio depende de la distancia entre unidades y si hace falta pase de pared.',
 'Ninguno, es un trabajo planificado.',
 'programable', 2.0, 5.0, 40000, 250000, false,
 array['¿Cuántos metros hay entre la unidad interior y la exterior?','¿Ya tenés soporte para la unidad externa?']),

('aire-pierde-agua', 'aire', 'Pierde agua adentro',
 array['pierde agua','gotea','chorrea','humedad en la pared','mancha en el techo','moja'],
 'Casi siempre es el desagüe tapado o mal inclinado. A veces es hielo acumulado por falta de gas.',
 'Medio — puede dañar la pared o el techo si sigue goteando.',
 'pronto', 1.0, 2.0, 0, 15000, false,
 array['¿La pérdida es constante o sólo cuando está prendido?','¿Ves hielo en la unidad?']),

('aire-ruido', 'aire', 'Hace ruido raro o vibra',
 array['hace ruido','vibra','suena feo','traquetea','rechina'],
 'Puede ser un tornillo suelto, el ventilador desbalanceado o el soporte flojo.',
 'Bajo, pero un ruido nuevo suele avisar antes de una falla más cara.',
 'pronto', 0.5, 1.5, 0, 20000, false,
 array['¿El ruido es de la unidad interior o la exterior?','¿Empezó de golpe o de a poco?'])
on conflict do nothing;

-- ---------- Trabajos: albañilería ----------

insert into catalogo_trabajos
  (slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia,
   horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas)
values
('albanileria-grieta', 'albanileria', 'Grieta en pared o techo',
 array['grieta','rajadura','se abrio la pared','fisura','raja en el techo','se rajo'],
 'Hay grietas superficiales (de revoque) y estructurales. Sólo una visita puede distinguirlas — una grieta estructural necesita evaluación antes de cualquier arreglo.',
 'Depende: si crece rápido o está cerca de una columna, no conviene esperar.',
 'pronto', 1.0, 4.0, 5000, 60000, false,
 array['¿La grieta es fina como un pelo o entra un dedo?','¿Está creciendo?','¿Es en pared, techo o cerca de una columna?']),

('albanileria-humedad', 'albanileria', 'Humedad en pared o techo',
 array['humedad','mancha de humedad','se despega la pintura','moho','huele a humedad','pared mojada'],
 'La humedad puede venir de una filtración, condensación o humedad ascendente. Hay que ver el origen antes de tapar la mancha.',
 'Medio — sigue dañando la pared y puede afectar la salud (moho).',
 'pronto', 1.0, 3.0, 5000, 45000, false,
 array['¿La mancha aparece siempre o sólo cuando llueve?','¿Es en una pared que da al exterior?']),

('albanileria-revoque', 'albanileria', 'Arreglo de revoque o piso roto',
 array['revoque caido','piso roto','baldosa rota','se cayo el revoque','piso levantado'],
 'Reparación puntual de revoque, contrapiso o baldosas sueltas.',
 'Bajo, salvo que sea un piso donde alguien se pueda tropezar.',
 'programable', 2.0, 6.0, 8000, 80000, false,
 array['¿Cuántos metros cuadrados aproximadamente?']),

('albanileria-obra-menor', 'albanileria', 'Obra chica (pared, tabique, ampliación)',
 array['levantar una pared','tabique','ampliacion','construir','hacer un muro'],
 'Trabajo de obra que necesita visita para medir y cotizar materiales y días de trabajo.',
 'Ninguno, es planificado.',
 'programable', 4.0, 8.0, 30000, 400000, false,
 array['¿Tenés plano o medidas del espacio?','¿Es interior o exterior?'])
on conflict do nothing;

-- ---------- Trabajos: carpintería ----------

insert into catalogo_trabajos
  (slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia,
   horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas)
values
('carpinteria-puerta-ventana', 'carpinteria', 'Puerta o ventana que no cierra bien',
 array['no cierra','raspa','esta trabada','se traba la puerta','no cierra bien la ventana','roza el piso'],
 'Generalmente es un desnivel de las bisagras o hinchazón de la madera por humedad. Se ajusta o se cepilla.',
 'Bajo, salvo que sea la puerta de entrada (seguridad).',
 'pronto', 0.5, 2.0, 0, 15000, false,
 array['¿Es puerta o ventana?','¿Empezó a fallar de golpe o con el tiempo?']),

('carpinteria-herraje', 'carpinteria', 'Bisagra, picaporte o herraje roto',
 array['bisagra rota','se cayo la puerta','picaporte roto','herraje','tirador roto','cajon no cierra'],
 'Reemplazo o ajuste de herrajes. Es un arreglo rápido en la mayoría de los casos.',
 'Bajo, aunque una puerta que se puede caer es riesgo de golpe.',
 'pronto', 0.5, 1.5, 3000, 25000, false,
 array['¿Qué mueble o puerta es?']),

('carpinteria-mueble-medida', 'carpinteria', 'Mueble a medida',
 array['mueble a medida','placard','biblioteca','alacena','mueble de cocina'],
 'Fabricación a medida. El precio depende del tamaño, material y terminación — necesita visita para medir.',
 'Ninguno, es planificado.',
 'programable', 4.0, 10.0, 80000, 600000, false,
 array['¿Tenés las medidas del espacio?','¿Qué material preferís (melamina, madera maciza)?']),

('carpinteria-exterior', 'carpinteria', 'Deck, pérgola o estructura de madera exterior',
 array['deck','pergola','estructura de madera','madera exterior'],
 'Trabajo de exterior, necesita visita para medir superficie y ver el terreno.',
 'Ninguno.',
 'programable', 6.0, 16.0, 100000, 800000, false,
 array['¿Cuántos metros cuadrados aproximadamente?'])
on conflict do nothing;

-- ---------- Trabajos: gas ----------

insert into catalogo_trabajos
  (slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia,
   horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas)
values
('gas-olor', 'gas', 'Olor a gas',
 array['huele a gas','olor a gas','perdida de gas','escape de gas','huele mal'],
 'Posible fuga en la instalación o en un artefacto. Es una emergencia real: hay que cortar la llave de paso y ventilar.',
 'Alto — riesgo de explosión o intoxicación. No hay que esperar.',
 'emergencia', 1.0, 3.0, 0, 80000, true,
 array['¿Ya cerraste la llave de paso general?','¿El olor es fuerte o leve?','¿Ventilaste el ambiente?']),

('gas-artefacto-no-enciende', 'gas', 'Estufa, cocina o calefón no enciende',
 array['no enciende','no prende','se apaga solo','piloto apagado','no calienta','no hay agua caliente'],
 'Puede ser el termopar, la válvula o falta de presión. Requiere revisión de un gasista matriculado.',
 'Medio — sin agua caliente o calefacción en invierno es urgente para la mayoría de las familias.',
 'urgente', 1.0, 2.5, 5000, 60000, true,
 array['¿Qué artefacto es (calefón, cocina, estufa)?','¿Se apaga solo o nunca prendió?']),

('gas-instalacion-artefacto', 'gas', 'Instalación de artefacto nuevo',
 array['instalar cocina','instalar calefon','instalar estufa','conectar artefacto','artefacto nuevo'],
 'Conexión e instalación de un artefacto nuevo, con certificado de instalación.',
 'Ninguno, planificado — pero por ley no se puede usar el artefacto sin la conexión habilitada.',
 'programable', 1.0, 3.0, 5000, 40000, true,
 array['¿Qué artefacto vas a instalar?','¿Ya tenés la conexión de gas cerca?']),

('gas-certificado', 'gas', 'Certificado de gas o habilitación',
 array['certificado de gas','habilitacion','inspeccion','revision de instalacion','para vender','para alquilar'],
 'Revisión completa de la instalación para emitir el certificado que piden inmobiliarias, seguros o el municipio.',
 'Bajo, salvo que tengas un trámite con fecha límite.',
 'programable', 1.0, 2.0, 0, 10000, true,
 array['¿Para qué necesitás el certificado (venta, alquiler, seguro)?'])
on conflict do nothing;

-- ---------- Trabajos: limpieza ----------

insert into catalogo_trabajos
  (slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia,
   horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas)
values
('limpieza-profunda', 'limpieza', 'Limpieza profunda del hogar',
 array['limpieza profunda','limpieza a fondo','despues de obra','fin de obra','limpieza general'],
 'Limpieza completa de todos los ambientes, incluyendo zócalos, vidrios y espacios que no se limpian a diario.',
 'Ninguno.',
 'programable', 3.0, 6.0, 0, 8000, false,
 array['¿Cuántos ambientes tiene la propiedad?','¿Es después de una obra o mudanza?']),

('limpieza-mantenimiento', 'limpieza', 'Limpieza de mantenimiento',
 array['limpieza semanal','limpieza quincenal','empleada domestica','limpieza regular','mantenimiento'],
 'Limpieza periódica de rutina. Se coordina un día y horario fijo.',
 'Ninguno.',
 'programable', 3.0, 5.0, 0, 5000, false,
 array['¿Con qué frecuencia la necesitás (semanal, quincenal)?']),

('limpieza-vidrios', 'limpieza', 'Limpieza de vidrios y aberturas',
 array['vidrios','ventanas sucias','limpiar vidrios','aberturas'],
 'Limpieza de vidrios interiores y exteriores. En pisos altos puede requerir equipo especial.',
 'Ninguno.',
 'programable', 1.0, 3.0, 0, 5000, false,
 array['¿Hay vidrios que sólo se acceden desde afuera (piso alto)?']),

('limpieza-tapizados', 'limpieza', 'Limpieza de tapizados o alfombras',
 array['tapizados','alfombra sucia','sillon sucio','limpiar sillon','limpieza de tapizado'],
 'Limpieza con máquina de inyección-extracción para tapizados y alfombras.',
 'Bajo, salvo manchas que se puedan fijar con el tiempo.',
 'programable', 1.0, 3.0, 0, 10000, false,
 array['¿Cuántos ambientes o piezas necesitás limpiar?'])
on conflict do nothing;

-- ---------- Trabajos: pintura ----------

insert into catalogo_trabajos
  (slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia,
   horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas)
values
('pintura-ambiente', 'pintura', 'Pintar un ambiente',
 array['pintar','pintura','cambiar color','repintar','pintar habitacion','pintar living'],
 'Pintura de paredes y techo de un ambiente. El precio depende de m², estado de la pared y si hay que lijar o tapar grietas antes.',
 'Ninguno, es planificado.',
 'programable', 4.0, 10.0, 20000, 120000, false,
 array['¿Cuántos ambientes o m² aproximadamente?','¿La pared está en buen estado o hay que prepararla?']),

('pintura-descascarada', 'pintura', 'Pintura descascarada o con burbujas',
 array['se descascara','pintura vieja','burbujas','se pela la pintura','desconchada'],
 'Casi siempre viene de humedad debajo de la pintura. Hay que resolver la causa antes de repintar, si no vuelve a pasar.',
 'Bajo, pero conviene resolverlo antes de que se extienda.',
 'pronto', 2.0, 6.0, 15000, 80000, false,
 array['¿Sabés si hay o hubo humedad en esa pared?']),

('pintura-exterior', 'pintura', 'Pintura de fachada o exterior',
 array['fachada','frente','pintar exterior','pintar afuera'],
 'Pintura exterior, requiere andamio o silleta según la altura y buen tiempo para secar.',
 'Ninguno.',
 'programable', 8.0, 24.0, 60000, 400000, false,
 array['¿Cuántos pisos tiene la fachada?','¿Es una casa o un edificio?']),

('pintura-metal', 'pintura', 'Pintura de rejas o estructuras metálicas',
 array['pintar reja','oxidado','pintar porton','pintar metal','antioxido'],
 'Requiere lijado y antióxido antes de pintar, si no la pintura nueva se levanta rápido.',
 'Bajo, aunque el óxido avanza con el tiempo.',
 'programable', 2.0, 6.0, 10000, 60000, false,
 array['¿Cuánto óxido tiene la superficie?'])
on conflict do nothing;
