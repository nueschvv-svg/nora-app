-- ============================================================
-- CATÁLOGO AFINADO
--
-- La primera versión tenía entradas demasiado amplias: "caño roto"
-- iba de media hora a seis, y de $25.000 a $180.000 en materiales.
-- Con eso, el estimador terminaba diciendo "hay que verlo" en 14 de
-- 18 casos — honesto, pero inútil.
--
-- El problema no era la regla, eran los datos. Un "caño roto a la
-- vista" y un "caño roto adentro de la pared" son dos trabajos
-- distintos con precios distintos, y la persona sabe cuál tiene.
-- Alcanza con preguntarle.
--
-- Acá se parten las entradas anchas en casos concretos y se
-- reemplazan las viejas.
-- ============================================================

delete from catalogo_trabajos where slug in (
  'cano-roto-perdida', 'destapacion-simple', 'presion-baja',
  'quede-afuera', 'cerradura-traba', 'instalacion-luminaria',
  'inodoro-perdida', 'enchufe-no-anda'
);

insert into catalogo_trabajos
  (slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia,
   horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas)
values

-- ---------- Plomería ----------

('cano-roto-vista', 'plomeria', 'Caño roto a la vista',
 array['roto','rompio','cano','caño','perdida','chorro','revento','se ve','a la vista','debajo de la pileta'],
 'Un caño o conexión partida en un tramo accesible. Como está a la vista, se corta el tramo dañado y se empalma. Es de los arreglos más directos.',
 'El agua a presión agranda la fisura sola. Si moja la instalación eléctrica o llega al piso de abajo, el problema deja de ser un caño.',
 'emergencia', 1.0, 2.5, 20000, 55000, false,
 array['¿Pudiste cerrar la llave de paso?','¿El caño se ve o está tapado?']),

('cano-roto-pared', 'plomeria', 'Caño roto dentro de la pared o el piso',
 array['adentro de la pared','en la pared','bajo el piso','no se ve','mancha en la pared','humedad y perdida','tuve que romper'],
 'La pérdida está en un tramo embutido. Hay que localizar el punto exacto, abrir sólo ahí, reparar y cerrar. La reparación del revoque y la pintura van aparte.',
 'Es la peor de las pérdidas porque no se ve avanzar. Moja la mampostería desde adentro, puede llegar a un tablero, y en un departamento el daño al vecino de abajo lo pagás vos.',
 'emergencia', 3.0, 7.0, 45000, 130000, false,
 array['¿Sabés por dónde pasa el caño?','¿Es departamento o casa?','¿Hay algún enchufe o tablero cerca de la mancha?']),

('destapacion-artefacto', 'plomeria', 'Destapación de una pileta o inodoro',
 array['tapado','no baja','destapar','lento','una pileta','el inodoro no baja','rebalsa la pileta'],
 'Obstrucción en el desagüe de un solo artefacto, casi siempre por grasa o pelo. Se resuelve con sonda en una visita.',
 'La obstrucción crece. De una pileta lenta se pasa al rebalse, y limpiar eso cuesta más que destapar a tiempo.',
 'urgente', 1.0, 2.0, 0, 15000, false,
 array['¿Es una sola pileta o varias a la vez?']),

('destapacion-principal', 'plomeria', 'Destapación de la cañería principal',
 array['varias piletas','todo tapado','vuelve el agua','rejilla','sale por la rejilla','olor a cloaca','cloaca'],
 'Cuando vuelve agua por otro desagüe, la obstrucción no está en el artefacto sino en el colector. Requiere máquina y a veces acceso a la cámara de inspección.',
 'Puede terminar con agua servida saliendo por las rejillas del baño. Es un problema sanitario, no sólo una molestia.',
 'emergencia', 2.0, 4.0, 10000, 45000, false,
 array['¿Vuelve agua por otro desagüe cuando usás uno?','¿Tenés cámara de inspección accesible?']),

('inodoro-mochila', 'plomeria', 'El inodoro pierde agua por dentro',
 array['inodoro','mochila','deposito','corre el agua','no corta','sigue cargando'],
 'El mecanismo de la mochila no cierra: la válvula quedó gastada o mal calibrada y el agua corre permanentemente hacia el inodoro.',
 'No es peligroso, pero es agua corriendo las 24 horas. Se nota en la factura.',
 'pronto', 1.0, 1.5, 12000, 30000, false,
 array['¿El agua corre adentro del inodoro o aparece en el piso?']),

('inodoro-base', 'plomeria', 'El inodoro pierde por la base',
 array['pierde por abajo','agua en el piso','base del inodoro','se mueve el inodoro','piso mojado baño'],
 'El sello entre el inodoro y el desagüe se rompió. Hay que levantar el artefacto, reemplazar el sello y volver a fijarlo.',
 'El agua va abajo del piso, donde no se ve. En un departamento aparece en el techo del vecino, y ahí el arreglo ya incluye la reparación de ese techo.',
 'urgente', 1.5, 3.0, 15000, 40000, false,
 array['¿El inodoro se mueve cuando te sentás?','¿Vive alguien abajo?']),

('presion-aireador', 'plomeria', 'Poca presión en una sola canilla',
 array['una canilla','poca presion','sale poca agua','chorro debil','solo en la cocina','solo en el baño'],
 'Casi siempre es el filtro del aireador tapado con sarro. Es el arreglo más simple que existe.',
 'Ninguno. Es una molestia.',
 'programable', 0.5, 1.0, 2000, 12000, false,
 array['¿Es una sola canilla o toda la casa?']),

('presion-bomba', 'plomeria', 'Poca presión en toda la casa',
 array['toda la casa','sin presion','bomba','tanque','no sube el agua','presion baja general'],
 'Puede ser la bomba, el tanque o la cañería general. Hay que medir para saber cuál de los tres.',
 'Si es la bomba, dejarla forzando termina en el cambio del equipo completo, que sale bastante más que revisarla.',
 'pronto', 1.5, 3.0, 15000, 45000, false,
 array['¿Tenés tanque, bomba o presión de red directa?','¿Escuchás la bomba trabajando seguido?']),

-- ---------- Electricidad ----------

('enchufe-un-punto', 'electricidad', 'Un enchufe o luz que no funciona',
 array['un enchufe','no anda el enchufe','una luz','no funciona','tomacorriente','velador'],
 'Falla puntual del tomacorriente o de su conexión. Se revisa, se aprieta o se reemplaza el punto.',
 'Una conexión floja calienta, y el calor en un enchufe es una de las causas más frecuentes de incendio doméstico.',
 'pronto', 1.0, 2.0, 8000, 25000, true,
 array['¿Es un solo punto o varios del mismo ambiente?','¿Se calienta o está tiznado?']),

('circuito-sin-luz', 'electricidad', 'Un ambiente entero sin luz',
 array['todo el ambiente','sin luz la pieza','varios enchufes','se corto un sector','circuito'],
 'Un circuito completo cortado: puede ser la térmica de ese circuito, un cable interrumpido o un empalme suelto en una caja.',
 'Un empalme suelto genera arco eléctrico y calor dentro de la pared. Es de las fallas que hay que resolver, no postergar.',
 'urgente', 2.0, 4.0, 15000, 45000, true,
 array['¿Saltó alguna llave del tablero?','¿Se cortó de golpe o fue de a poco?']),

('instalacion-punto-existente', 'electricidad', 'Colocar un artefacto donde ya hay instalación',
 array['colgar','instalar lampara','ventilador de techo','aplique','ya hay cable','cambiar la lampara'],
 'Ya existe la caja y el cableado en el lugar. Es desmontar el viejo, conectar y fijar el nuevo.',
 'Ninguno. Es un trabajo programable.',
 'programable', 1.0, 2.0, 5000, 15000, true,
 array['¿Ya hay un cable saliendo del techo ahí?','¿El artefacto lo tenés?']),

('instalacion-punto-nuevo', 'electricidad', 'Llevar electricidad a un lugar nuevo',
 array['no hay cable','punto nuevo','llevar luz','agregar enchufe','no hay instalacion ahi'],
 'Hay que tirar el circuito desde el tablero o desde una caja existente hasta el punto nuevo, con canalización.',
 'Ninguno mientras no se haga con cables provisorios o zapatillas, que es lo que suele hacer la gente mientras espera.',
 'programable', 3.0, 6.0, 25000, 70000, true,
 array['¿A qué distancia está del tablero o de la caja más cercana?','¿Se puede canalizar por el techo o hay que picar pared?']),

-- ---------- Cerrajería ----------

('apertura-simple', 'cerrajeria', 'Apertura de puerta sin daño',
 array['quede afuera','encerrado','no puedo entrar','perdi las llaves','se cerro la puerta','me deje las llaves adentro'],
 'Apertura con herramienta específica, sin romper la cerradura. Funciona cuando no está puesta la traba de seguridad desde adentro.',
 'Es una emergencia por definición: estás afuera.',
 'emergencia', 0.5, 1.0, 0, 8000, false,
 array['¿La llave quedó puesta del otro lado?','¿Está puesta la traba de seguridad?','¿Es cerradura común o de seguridad?']),

('apertura-con-cambio', 'cerrajeria', 'Apertura con cambio de cerradura',
 array['traba puesta','de seguridad','no abre de ninguna forma','hay que romper','llave rota adentro'],
 'Cuando la traba de seguridad está puesta o la cerradura está dañada, hay que forzar y reemplazarla. El precio incluye la cerradura nueva estándar.',
 'Es una emergencia: estás afuera y además vas a quedar con la puerta sin cerradura hasta que se coloque la nueva.',
 'emergencia', 1.0, 2.0, 45000, 110000, false,
 array['¿Está puesta la traba desde adentro?','¿Se rompió una llave dentro de la cerradura?']),

('cerradura-ajuste', 'cerrajeria', 'La cerradura está dura o cuesta girar',
 array['dura','cuesta','no gira bien','esta trabada','cuesta cerrar','hay que forzar la llave'],
 'Desgaste o falta de lubricación del mecanismo. Se desarma, se limpia y se ajusta. Muchas veces no hace falta cambiar nada.',
 'Una cerradura que cuesta termina no abriendo, y siempre lo hace el día que tenés apuro.',
 'pronto', 0.5, 1.0, 0, 10000, false,
 array['¿Cuesta para abrir, para cerrar, o las dos?','¿Empeoró de golpe o de a poco?']);
