-- ============================================================
-- CATÁLOGO DE TRABAJOS Y PRECIOS
--
-- QUÉ ES Y QUÉ NO ES ESTO
--
-- No existe ninguna base de datos pública con precios reales de
-- plomeros en Argentina. Los números de acá salen de agregadores
-- del rubro (agosto 2026) y son ORIENTATIVOS. Sirven para darle al
-- cliente un rango razonable antes de que vaya nadie, no para
-- cerrar un precio.
--
-- La parte que SÍ es sólida y no envejece es el catálogo: qué
-- problema es, por qué pasa, qué riesgo hay si se posterga y
-- cuántas horas lleva. Un flexible bajo la bacha lleva una hora
-- en 2026 y va a llevar una hora en 2030.
--
-- Lo que envejece son las TARIFAS, y por eso viven en su propia
-- tabla, versionadas por fecha, editables sin tocar la app. Con la
-- inflación argentina hay que revisarlas todos los meses.
--
-- El objetivo real: reemplazar estos números por los tuyos. Después
-- de 100 trabajos vas a saber cuánto sale de verdad cada cosa, y
-- ahí el estimador deja de ser una referencia para ser un dato.
-- ============================================================

-- ---------- Nivel de urgencia ----------

create type nivel_urgencia as enum (
  'emergencia',   -- ahora: hay riesgo de daño material o a las personas
  'urgente',      -- en 24-48 h
  'pronto',       -- esta semana
  'programable'   -- cuando le venga bien
);

-- ---------- Catálogo de trabajos ----------

create table catalogo_trabajos (
  slug              text primary key,
  categoria_slug    text not null references categorias(slug) on delete cascade,
  nombre            text not null,

  -- Palabras que aparecen cuando alguien describe este problema.
  -- Sirven para adivinar de qué se trata a partir del texto libre.
  sintomas          text[] not null default '{}',

  -- Qué está pasando, explicado para alguien que no es del rubro.
  diagnostico       text not null,
  -- Qué pasa si lo deja para después. Esto es lo que convence.
  riesgo_si_espera  text not null,
  urgencia          nivel_urgencia not null,

  -- Cuánto lleva el trabajo. Esta es la parte que no envejece.
  horas_min         numeric(4,1) not null check (horas_min > 0),
  horas_max         numeric(4,1) not null,
  check (horas_max >= horas_min),

  -- Materiales, en pesos de hoy. Se actualiza junto con las tarifas.
  materiales_min    numeric(12,2) not null default 0,
  materiales_max    numeric(12,2) not null default 0,
  check (materiales_max >= materiales_min),

  -- Si hace falta matrícula, no cualquier técnico lo puede tomar.
  requiere_matricula boolean not null default false,
  -- Qué preguntarle al cliente para afinar el diagnóstico.
  preguntas         text[] not null default '{}',
  actualizado_el    timestamptz not null default now()
);

create index on catalogo_trabajos (categoria_slug);

comment on table catalogo_trabajos is
  'Las horas y el riesgo son estables en el tiempo. Los montos de materiales no: revisarlos junto con las tarifas.';

-- ---------- Tarifas de mano de obra ----------
-- La tabla `tarifas` ya existe (01_esquema.sql). Le sumamos lo que
-- faltaba para poder calcular un rango y contemplar recargos.

alter table tarifas add column if not exists visita_max_ars   numeric(12,2);
alter table tarifas add column if not exists hora_max_ars      numeric(12,2);
alter table tarifas add column if not exists recargo_urgencia  numeric(4,2) not null default 0.40;
alter table tarifas add column if not exists nota              text;

comment on column tarifas.recargo_urgencia is
  'Recargo por salida fuera de horario, noche o fin de semana. 0.40 = 40% mas caro.';

-- ---------- Tarifas iniciales ----------
-- Referencias de agosto 2026 para CABA y GBA. REVISAR TODOS LOS MESES.

insert into tarifas (categoria_slug, localidad, visita_ars, visita_max_ars, hora_ars, hora_max_ars, recargo_urgencia, nota)
values
  ('plomeria',     null, 15000, 25000, 20000, 35000, 0.40, 'Referencia CABA/GBA ago-2026. En el interior suele ser 20-30% menos.'),
  ('electricidad', null, 18000, 30000, 22000, 38000, 0.40, 'Referencia CABA/GBA ago-2026. Requiere matriculado.'),
  ('cerrajeria',   null, 15000, 28000, 20000, 35000, 0.50, 'Referencia CABA/GBA ago-2026. La urgencia nocturna es lo mas comun del rubro.')
on conflict do nothing;

-- ---------- Trabajos: plomería ----------

insert into catalogo_trabajos
  (slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia,
   horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas)
values
('perdida-flexible-bacha', 'plomeria', 'Pérdida en la conexión bajo la bacha',
 array['gotea','pierde','bacha','pileta','cocina','mojado','abajo','flexible','humedad'],
 'Lo más común es que el flexible que conecta la canilla con la llave de paso esté fisurado o que la junta se haya secado. Es la falla más frecuente de la cocina y una de las más baratas de resolver.',
 'Una gota por segundo son unos 30 litros por día. Además el agua se acumula abajo de la bacha, hincha el mueble y termina en un cambio de mueble que sale diez veces más que el arreglo.',
 'pronto', 0.5, 1.5, 8000, 25000, false,
 array['¿El agua aparece sólo cuando abrís la canilla o gotea siempre?','¿Ves el agua saliendo de una manguerita o del cuerpo de la canilla?']),

('cano-roto-perdida', 'plomeria', 'Caño roto con pérdida de agua',
 array['roto','rompio','cano','caño','perdida','agua','chorro','revento','inundado','pared'],
 'Un caño fisurado o partido. Si está a la vista, el arreglo es acotado; si está dentro de la pared o bajo el piso, hay que abrir para llegar y el trabajo se multiplica.',
 'Es de las pocas cosas que empeoran solas y rápido. El agua a presión agranda la fisura, moja la mampostería, puede llegar a la instalación eléctrica y afectar al vecino de abajo. Si es un departamento, el daño a terceros lo pagás vos.',
 'emergencia', 1.5, 6.0, 25000, 180000, false,
 array['¿Pudiste cerrar la llave de paso general?','¿El caño está a la vista o adentro de la pared?','¿Hay agua llegando a algún enchufe o tablero?']),

('destapacion-simple', 'plomeria', 'Destapación de cañería',
 array['tapado','no baja','destapar','rebalsa','lento','desagote','sale mal olor','inodoro','pileta'],
 'Acumulación de grasa, pelo o residuos en el desagüe. Con sonda mecánica se resuelve en una visita salvo que la obstrucción esté en la cañería principal.',
 'La obstrucción avanza. De una pileta lenta se pasa al rebalse, y si es la cañería principal puede volver por las rejillas del baño con agua servida.',
 'urgente', 1.0, 3.0, 0, 30000, false,
 array['¿Es una sola pileta o varias a la vez?','¿Vuelve agua por otro desagüe cuando usás ese?']),

('canilla-goteando', 'plomeria', 'Canilla que gotea',
 array['canilla','gotea','gotera','cierra mal','pierde','grifo'],
 'Cuerito o cartucho gastado. Es el arreglo más simple de plomería.',
 'No es peligroso, pero una canilla que gotea desperdicia unos 100 litros por semana, y eso se ve en la factura.',
 'programable', 0.5, 1.0, 3000, 15000, false,
 array['¿Gotea con la canilla cerrada o sólo mientras corre el agua?']),

('inodoro-perdida', 'plomeria', 'Inodoro que pierde o no corta',
 array['inodoro','mochila','deposito','corre','no corta','pierde agua','baño'],
 'Casi siempre es el mecanismo de la mochila: la válvula no cierra bien y el agua corre permanente hacia el inodoro.',
 'Consumo constante de agua las 24 horas. Si la pérdida es en la base y no en la mochila, el agua está yendo abajo del piso y puede aparecer en el techo del vecino.',
 'pronto', 1.0, 2.0, 12000, 45000, false,
 array['¿El agua corre dentro del inodoro o aparece en el piso alrededor?']),

('termotanque-no-calienta', 'plomeria', 'Termotanque o calefón que no calienta',
 array['no calienta','agua fria','termotanque','calefon','sin agua caliente','no prende','piloto'],
 'Puede ser el piloto, el termostato, la resistencia o sarro acumulado. Hay que ver el equipo para saber cuál de esas.',
 'Si es a gas y no enciende bien, hay riesgo de monóxido de carbono, que no se ve ni se huele. Un equipo de gas que funciona mal no es una molestia: es peligroso.',
 'urgente', 1.0, 3.0, 15000, 150000, true,
 array['¿Es a gas o eléctrico?','¿Se apaga solo o directamente no enciende?','¿Sentís olor a gas?']),

('cambio-termotanque', 'plomeria', 'Cambio de termotanque',
 array['cambiar termotanque','termotanque nuevo','instalar termotanque','reemplazo'],
 'Retiro del equipo viejo, adaptación de conexiones e instalación del nuevo. El equipo se compra aparte.',
 'Un termotanque muy viejo pierde eficiencia y puede terminar perdiendo agua por corrosión del tanque, que no tiene arreglo.',
 'programable', 3.0, 6.0, 55000, 120000, true,
 array['¿Es a gas o eléctrico?','¿Vas a reemplazar por uno del mismo tipo y capacidad?']),

('perdida-techo-humedad', 'plomeria', 'Humedad o filtración desde arriba',
 array['humedad','mancha','techo','filtracion','gotea del techo','moho','pared mojada'],
 'Puede venir de una cañería, del techo o de condensación. Hay que encontrar el origen antes de reparar: arreglar la mancha sin encontrar la causa no sirve de nada.',
 'La humedad sostenida arruina la mampostería y la pintura, y genera moho, que es un problema de salud además de estético.',
 'pronto', 1.0, 4.0, 0, 80000, false,
 array['¿La mancha crece cuando llueve o es pareja todo el año?','¿Hay un baño o cocina justo arriba?']),

('presion-baja', 'plomeria', 'Poca presión de agua',
 array['poca presion','sale poca agua','presion baja','chorro debil','bomba'],
 'Puede ser el filtro del aireador tapado, sarro en la cañería, o un problema de la bomba o el tanque.',
 'No es urgente, pero si es la bomba, dejarla forzando termina en el cambio del equipo completo.',
 'programable', 1.0, 3.0, 5000, 90000, false,
 array['¿Es en toda la casa o en una sola canilla?','¿Tenés tanque, bomba, o presión de red directa?']);

-- ---------- Trabajos: electricidad ----------

insert into catalogo_trabajos
  (slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia,
   horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas)
values
('salta-termica', 'electricidad', 'Salta la térmica',
 array['salta','termica','corta la luz','se corta','disyuntor','salta el disyuntor','llave'],
 'La térmica está haciendo su trabajo: corta porque hay más consumo del que soporta el circuito, o porque hay una falla. Lo importante es saber cuál de las dos.',
 'Una térmica que salta seguido está avisando algo. Si el problema es una fuga a tierra, hay riesgo de descarga eléctrica. Puentearla o cambiarla por una de mayor amperaje sin revisar el circuito es como sacarle la alarma de incendio a la casa.',
 'urgente', 1.0, 3.0, 24000, 60000, true,
 array['¿Salta siempre al usar el mismo aparato?','¿Es la llave general o una sola?','¿Sentís olor a quemado en algún enchufe?']),

('enchufe-no-anda', 'electricidad', 'Enchufe o luz que no funciona',
 array['no anda','enchufe','sin luz','no funciona','tomacorriente','velador','lampara'],
 'Puede ser el tomacorriente, el cableado del circuito o una conexión floja. Una conexión floja calienta, y eso es lo que hay que descartar primero.',
 'Una conexión floja genera calor. Es una de las causas más frecuentes de incendio doméstico en Argentina.',
 'pronto', 1.0, 2.5, 8000, 35000, true,
 array['¿Es un solo enchufe o varios del mismo ambiente?','¿Se calienta o está tiznado?','¿Sentís olor a plástico quemado?']),

('revision-tablero', 'electricidad', 'Revisión del tablero eléctrico',
 array['tablero','revision','disyuntor','termicas','revisar instalacion','seguro'],
 'Verificación de térmicas y disyuntor, medición de puesta a tierra y estado general del tablero. Es el chequeo anual recomendado.',
 'El disyuntor es lo que evita una electrocución. Si está fallado no se nota hasta el día que hace falta, y ese día es tarde.',
 'programable', 1.5, 3.0, 20000, 80000, true,
 array['¿Sabés de qué año es la instalación?','¿Tenés disyuntor además de las térmicas?']),

('certificado-dci', 'electricidad', 'Certificado DCI para alquiler',
 array['dci','certificado','alquiler','habilitacion','certificado electrico'],
 'Verificación y certificación de la instalación eléctrica, obligatoria para alquilar en varias jurisdicciones. Sólo la puede emitir un matriculado.',
 'Sin el certificado no podés alquilar en regla, y si hay un siniestro eléctrico el seguro puede rechazar la cobertura.',
 'programable', 2.0, 4.0, 120000, 240000, true,
 array['¿Es para CABA o para provincia?','¿La instalación tiene disyuntor y puesta a tierra?']),

('instalacion-luminaria', 'electricidad', 'Instalación de artefacto de luz o ventilador',
 array['colgar','instalar','lampara','ventilador de techo','aplique','spot','luminaria'],
 'Colocación y conexión del artefacto. Si no hay caja ni cableado en el lugar, el trabajo incluye llevar el circuito hasta ahí.',
 'Bajo. Es un trabajo programable.',
 'programable', 1.0, 3.0, 5000, 40000, true,
 array['¿Ya hay un cable saliendo del techo en ese lugar?','¿El artefacto lo tenés o hay que comprarlo?']);

-- ---------- Trabajos: cerrajería ----------

insert into catalogo_trabajos
  (slug, categoria_slug, nombre, sintomas, diagnostico, riesgo_si_espera, urgencia,
   horas_min, horas_max, materiales_min, materiales_max, requiere_matricula, preguntas)
values
('quede-afuera', 'cerrajeria', 'Quedé afuera de casa',
 array['afuera','encerrado','no puedo entrar','perdi las llaves','se cerro','adentro'],
 'Apertura sin dañar la cerradura cuando se puede. Si la puerta tiene traba de seguridad puesta desde adentro, a veces hay que forzar y reemplazar.',
 'Es una emergencia por definición: estás afuera.',
 'emergencia', 0.5, 1.5, 0, 60000, false,
 array['¿La llave está puesta del otro lado?','¿Es cerradura común o de seguridad?','¿Hay alguien adentro?']),

('cambio-cerradura', 'cerrajeria', 'Cambio de cerradura',
 array['cambiar cerradura','cerradura nueva','cambio de bombin','seguridad','me robaron las llaves'],
 'Reemplazo de la cerradura o del bombín. Si sólo se perdieron las llaves, cambiar el bombín alcanza y es más barato que la cerradura completa.',
 'Si perdiste las llaves o se te fue alguien con una copia, cada día que pasa es un día con la puerta abierta para esa persona.',
 'urgente', 1.0, 2.0, 35000, 180000, false,
 array['¿Perdiste las llaves o la cerradura funciona mal?','¿Cuántas copias necesitás?','¿Es puerta de madera, chapa o blindada?']),

('cerradura-traba', 'cerrajeria', 'La cerradura no abre o traba',
 array['no abre','traba','dura','cuesta','no gira','llave trabada','se rompio la llave'],
 'Desgaste del mecanismo, falta de lubricación, o una llave copiada con defecto que fue limando el interior.',
 'Una cerradura que traba termina no abriendo. Y en general lo hace el día que tenés apuro, o te deja encerrado adentro.',
 'pronto', 0.5, 1.5, 0, 90000, false,
 array['¿Traba para abrir, para cerrar, o las dos?','¿Se rompió una llave adentro?']),

('reja-puerta-blindada', 'cerrajeria', 'Colocación de reja o refuerzo',
 array['reja','reforzar','blindar','seguridad','trabas','pasadores'],
 'Colocación de rejas, pasadores o refuerzos. Se cotiza según medida y tipo, casi siempre requiere una visita previa para medir.',
 'Bajo. Es un trabajo planificado.',
 'programable', 2.0, 8.0, 80000, 500000, false,
 array['¿Qué medidas tiene la abertura?','¿Buscás reja fija o con salida de emergencia?']);

-- ---------- Permisos ----------
-- El catálogo es público: alguien tiene que poder ver el rango de precios
-- antes de registrarse. Es información comercial, no datos de nadie.

alter table catalogo_trabajos enable row level security;

create policy "catalogo visible para todos"
  on catalogo_trabajos for select using (true);
