-- ============================================================
-- NORA — Instalación completa de la base de datos
-- Generado automáticamente: 01_esquema.sql + 02_permisos.sql
-- Se ejecuta todo junto: si algo falla, no queda nada a medias.
-- ============================================================

-- ============================================================
-- NORA — Esquema de base de datos (Supabase / PostgreSQL)
-- Archivo 1 de 2: tablas. Los permisos van en 02_permisos.sql.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar,
-- primero este archivo y después el de permisos.
-- ============================================================

-- ---------- Tipos ----------

create type rol_usuario as enum ('cliente', 'tecnico', 'operaciones');

create type tipo_equipo as enum (
  'calefon', 'termotanque', 'caldera', 'aire_acondicionado',
  'tanque_agua', 'tablero_electrico', 'matafuegos', 'bomba_agua'
);

create type estado_servicio as enum (
  'solicitado',        -- el cliente lo envió, operaciones todavía no lo miró
  'buscando_tecnico',  -- operaciones lo está asignando
  'asignado',          -- hay técnico y el cliente lo sabe
  'presupuestado',     -- el técnico cotizó, falta que el cliente acepte
  'aceptado',          -- el cliente aceptó el presupuesto
  'en_camino',
  'en_curso',
  'finalizado',        -- el técnico terminó y cargó el reporte
  'pagado',
  'calificado',
  'cancelado'
);

create type estado_tecnico as enum ('pendiente', 'verificado', 'suspendido', 'baja');

create type tipo_documento as enum ('dni', 'matricula', 'seguro_rc', 'cbu', 'antecedentes');

-- ---------- Perfiles ----------
-- Extiende auth.users de Supabase. Una fila por persona.

create table perfiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  rol           rol_usuario not null default 'cliente',
  nombre        text not null,
  telefono      text,
  creado_el     timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);

comment on column perfiles.rol is
  'Quién es esta persona en el sistema. NUNCA debe poder cambiarlo el propio usuario: si pudiera, se ascendería a operaciones y vería todo.';

-- ---------- Propiedades ----------

create table propiedades (
  id            uuid primary key default gen_random_uuid(),
  dueno_id      uuid not null references perfiles(id) on delete cascade,
  nombre        text not null,
  calle         text not null,
  numero        text,
  piso_depto    text,
  localidad     text not null,
  provincia     text not null default 'Buenos Aires',
  codigo_postal text,
  latitud       double precision,
  longitud      double precision,
  icono         text not null default 'home',
  notas_acceso  text,
  creado_el     timestamptz not null default now()
);

comment on table propiedades is
  'DATO SENSIBLE. La dirección de la casa de una persona, cruzada con "no voy a estar el viernes", es información peligrosa. Ver 02_permisos.sql: sólo el dueño y el técnico ya asignado pueden verla.';

create index on propiedades (dueno_id);

-- ---------- Equipos ----------
-- El corazón del producto: de acá sale el score y la agenda.

create table equipos (
  id                uuid primary key default gen_random_uuid(),
  propiedad_id      uuid not null references propiedades(id) on delete cascade,
  tipo              tipo_equipo not null,
  apodo             text,
  marca             text,
  modelo            text,
  anio_instalacion  smallint check (anio_instalacion between 1950 and 2100),
  ultima_revision   date check (ultima_revision <= current_date),
  creado_el         timestamptz not null default now()
);

create index on equipos (propiedad_id);

-- ---------- Categorías de servicio ----------

create table categorias (
  slug                text primary key,
  nombre              text not null,
  icono               text not null,
  requiere_matricula  boolean not null default false,
  activa              boolean not null default false,
  orden               smallint not null default 100
);

-- ---------- Técnicos ----------

create table tecnicos (
  id             uuid primary key references perfiles(id) on delete cascade,
  estado         estado_tecnico not null default 'pendiente',
  razon_social   text,
  cuit           text,
  zona_cobertura text[],
  radio_km       smallint,
  comision_pct   numeric(5,2) not null default 20.00
                   check (comision_pct >= 0 and comision_pct <= 100),
  creado_el      timestamptz not null default now()
);

create table tecnico_categorias (
  tecnico_id    uuid not null references tecnicos(id) on delete cascade,
  categoria_slug text not null references categorias(slug) on delete cascade,
  primary key (tecnico_id, categoria_slug)
);

-- Documentación habilitante. Sin esto no se puede mandar a nadie a una casa.
create table tecnico_documentos (
  id            uuid primary key default gen_random_uuid(),
  tecnico_id    uuid not null references tecnicos(id) on delete cascade,
  tipo          tipo_documento not null,
  archivo_path  text,               -- ruta en Supabase Storage, bucket privado
  numero        text,
  vence_el      date,
  verificado_el timestamptz,
  verificado_por uuid references perfiles(id),
  creado_el     timestamptz not null default now()
);

comment on table tecnico_documentos is
  'DNI, matrícula, seguro y CBU. Datos personales de terceros: sólo el propio técnico y operaciones. Ningún cliente los ve nunca.';

create index on tecnico_documentos (tecnico_id);

-- ¿Está habilitado hoy para tomar trabajos de esta categoría?
-- Regla dura: si la categoría exige matrícula y la tiene vencida, NO.
create or replace function tecnico_habilitado(p_tecnico_id uuid, p_categoria text)
returns boolean
language sql
stable
as $$
  select
    exists (select 1 from tecnicos t
             where t.id = p_tecnico_id and t.estado = 'verificado')
    and exists (select 1 from tecnico_categorias tc
                 where tc.tecnico_id = p_tecnico_id and tc.categoria_slug = p_categoria)
    and (
      not exists (select 1 from categorias c
                   where c.slug = p_categoria and c.requiere_matricula)
      or exists (select 1 from tecnico_documentos d
                  where d.tecnico_id = p_tecnico_id
                    and d.tipo = 'matricula'
                    and d.verificado_el is not null
                    and (d.vence_el is null or d.vence_el >= current_date))
    );
$$;

-- ---------- Servicios ----------

create table servicios (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references perfiles(id) on delete restrict,
  propiedad_id      uuid not null references propiedades(id) on delete restrict,
  categoria_slug    text not null references categorias(slug),
  equipo_id         uuid references equipos(id) on delete set null,
  descripcion       text not null check (length(trim(descripcion)) >= 10),
  estado            estado_servicio not null default 'solicitado',
  fecha_preferida   date,
  franja_preferida  text,
  tecnico_id        uuid references tecnicos(id) on delete set null,

  -- Plata. El cliente NO puede escribir estas columnas (ver permisos).
  monto_ars         numeric(12,2) check (monto_ars >= 0),
  comision_ars      numeric(12,2) check (comision_ars >= 0),
  pago_referencia   text,          -- id de la operación en Mercado Pago

  reporte           text,
  garantia_hasta    date,
  creado_el         timestamptz not null default now(),
  actualizado_el    timestamptz not null default now()
);

create index on servicios (cliente_id, creado_el desc);
create index on servicios (tecnico_id) where tecnico_id is not null;
create index on servicios (estado);

-- Bitácora de cada cambio de estado. Sin esto no se puede resolver
-- ninguna disputa: es la única prueba de qué pasó y cuándo.
create table servicio_eventos (
  id            bigserial primary key,
  servicio_id   uuid not null references servicios(id) on delete cascade,
  estado_nuevo  estado_servicio not null,
  estado_previo estado_servicio,
  actor_id      uuid references perfiles(id),
  nota          text,
  ocurrio_el    timestamptz not null default now()
);

create index on servicio_eventos (servicio_id, ocurrio_el);

-- Se llena solo: no depende de que nadie se acuerde de registrarlo.
create or replace function registrar_evento_servicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    insert into servicio_eventos (servicio_id, estado_nuevo, estado_previo, actor_id)
    values (new.id, new.estado,
            case when tg_op = 'UPDATE' then old.estado else null end,
            auth.uid());
  end if;
  new.actualizado_el := now();
  return new;
end;
$$;

create trigger trg_eventos_servicio
  before insert or update on servicios
  for each row execute function registrar_evento_servicio();

-- ---------- Fotos ----------

create table servicio_fotos (
  id           uuid primary key default gen_random_uuid(),
  servicio_id  uuid not null references servicios(id) on delete cascade,
  archivo_path text not null,       -- bucket privado, se sirve con URL firmada
  momento      text not null default 'antes'
                 check (momento in ('antes', 'despues')),
  subida_por   uuid references perfiles(id),
  creado_el    timestamptz not null default now()
);

create index on servicio_fotos (servicio_id);

-- ---------- Calificaciones ----------

create table calificaciones (
  id            uuid primary key default gen_random_uuid(),
  servicio_id   uuid not null unique references servicios(id) on delete cascade,
  cliente_id    uuid not null references perfiles(id) on delete cascade,
  tecnico_id    uuid not null references tecnicos(id) on delete cascade,
  estrellas     smallint not null check (estrellas between 1 and 5),
  comentario    text,
  creado_el     timestamptz not null default now()
);

create index on calificaciones (tecnico_id);

-- ---------- Tarifas ----------
-- Con inflación, los precios NO pueden estar en el código.
-- Versionadas por fecha: nunca se pisa una fila, se agrega una nueva.

create table tarifas (
  id              uuid primary key default gen_random_uuid(),
  categoria_slug  text not null references categorias(slug) on delete cascade,
  localidad       text,
  visita_ars      numeric(12,2) not null check (visita_ars >= 0),
  hora_ars        numeric(12,2) check (hora_ars >= 0),
  vigente_desde   date not null default current_date,
  vigente_hasta   date,
  check (vigente_hasta is null or vigente_hasta > vigente_desde)
);

create index on tarifas (categoria_slug, vigente_desde desc);

-- ---------- Datos iniciales ----------

insert into categorias (slug, nombre, icono, requiere_matricula, activa, orden) values
  ('plomeria',     'Plomería',     'wrench',       false, true,  10),
  ('electricidad', 'Electricidad', 'zap',          true,  true,  20),
  ('cerrajeria',   'Cerrajería',   'key-round',    false, true,  30),
  ('gas',          'Gas',          'flame',        true,  false, 40),
  ('aire',         'Aire acond.',  'air-vent',     false, false, 50),
  ('pintura',      'Pintura',      'paint-roller', false, false, 60),
  ('carpinteria',  'Carpintería',  'hammer',       false, false, 70),
  ('albanileria',  'Albañilería',  'brick-wall',   false, false, 80),
  ('limpieza',     'Limpieza',     'sparkles',     false, false, 90);


-- ============================================================
-- NORA — Permisos de acceso a los datos (Row Level Security)
-- Archivo 2 de 2. Ejecutar DESPUÉS de 01_esquema.sql.
--
-- POR QUÉ ESTE ARCHIVO IMPORTA MÁS QUE NINGÚN OTRO
--
-- La app le habla a la base de datos directamente desde el celular
-- del usuario. Lo único que impide que una persona lea los datos de
-- otra son estas reglas. No hay una segunda barrera detrás.
--
-- Lo que está en juego no es abstracto: la dirección de la casa de
-- alguien, cruzada con "el viernes de 13 a 17 no voy a estar", es
-- literalmente información para entrar a robar. Un error acá no da
-- error en pantalla — simplemente filtra datos en silencio.
--
-- Tres reglas que no se negocian:
--   1. RLS activado en TODAS las tablas, sin excepción.
--   2. Todo prohibido por defecto. Se habilita caso por caso.
--   3. Los montos y los estados los escribe el servidor, nunca el cliente.
-- ============================================================

-- ---------- Paso 1: cerrar todo ----------
-- Con RLS activado y sin políticas, nadie ve nada. Ese es el punto
-- de partida correcto: se abre a mano lo que haga falta.

alter table perfiles             enable row level security;
alter table propiedades          enable row level security;
alter table equipos              enable row level security;
alter table categorias           enable row level security;
alter table tecnicos             enable row level security;
alter table tecnico_categorias   enable row level security;
alter table tecnico_documentos   enable row level security;
alter table servicios            enable row level security;
alter table servicio_eventos     enable row level security;
alter table servicio_fotos       enable row level security;
alter table calificaciones       enable row level security;
alter table tarifas              enable row level security;

-- ---------- Paso 2: funciones de apoyo ----------
--
-- Preguntar "¿este usuario es de operaciones?" implica leer la tabla
-- `perfiles`, que a su vez tiene RLS. Si lo hiciéramos directo, la
-- política se llamaría a sí misma y Postgres cortaría con un error de
-- recursión infinita.
--
-- La salida es SECURITY DEFINER: la función corre con los permisos de
-- quien la creó y saltea RLS. Es una excepción deliberada y por eso
-- lleva search_path fijo — si no, alguien podría crear una tabla
-- `perfiles` falsa en otro esquema y hacer que la función lea esa.

create or replace function es_operaciones()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol = 'operaciones'
  );
$$;

create or replace function es_tecnico()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol = 'tecnico'
  );
$$;

-- ---------- PERFILES ----------

create policy "cada uno ve su perfil"
  on perfiles for select
  using (id = auth.uid() or es_operaciones());

create policy "cada uno edita su perfil"
  on perfiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ⚠️ Falta a propósito una política de INSERT. Los perfiles los crea
-- un trigger sobre auth.users, no el cliente.
--
-- ⚠️ El UPDATE de arriba deja al usuario editar su propia fila... lo
-- que incluye la columna `rol`. Un usuario podría ponerse
-- 'operaciones' y pasar a ver TODO. Postgres no permite políticas por
-- columna, así que lo bloqueamos con un trigger:

create or replace function bloquear_cambio_de_rol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol is distinct from old.rol and not es_operaciones() then
    raise exception 'El rol sólo lo puede cambiar el equipo de operaciones';
  end if;
  return new;
end;
$$;

create trigger trg_bloquear_rol
  before update on perfiles
  for each row execute function bloquear_cambio_de_rol();

-- ---------- PROPIEDADES ----------
-- La dirección la ve el dueño, operaciones, y el técnico SÓLO si ya
-- tiene un trabajo asignado ahí y todavía no terminó. Un técnico no
-- puede navegar direcciones que no le tocan, ni conservar el acceso
-- para siempre después de un trabajo.

create policy "el dueño ve sus propiedades"
  on propiedades for select
  using (dueno_id = auth.uid() or es_operaciones());

create policy "el técnico asignado ve la dirección"
  on propiedades for select
  using (
    exists (
      select 1 from servicios s
      where s.propiedad_id = propiedades.id
        and s.tecnico_id = auth.uid()
        and s.estado in ('asignado', 'presupuestado', 'aceptado', 'en_camino', 'en_curso')
    )
  );

create policy "el dueño crea propiedades"
  on propiedades for insert
  with check (dueno_id = auth.uid());

create policy "el dueño edita sus propiedades"
  on propiedades for update
  using (dueno_id = auth.uid())
  with check (dueno_id = auth.uid());

create policy "el dueño borra sus propiedades"
  on propiedades for delete
  using (dueno_id = auth.uid());

-- ---------- EQUIPOS ----------

create policy "el dueño ve sus equipos"
  on equipos for select
  using (
    exists (select 1 from propiedades p
             where p.id = equipos.propiedad_id and p.dueno_id = auth.uid())
    or es_operaciones()
  );

create policy "el dueño gestiona sus equipos"
  on equipos for all
  using (
    exists (select 1 from propiedades p
             where p.id = equipos.propiedad_id and p.dueno_id = auth.uid())
  )
  with check (
    exists (select 1 from propiedades p
             where p.id = equipos.propiedad_id and p.dueno_id = auth.uid())
  );

-- ---------- CATEGORÍAS Y TARIFAS ----------
-- Las categorías son públicas. Las tarifas vigentes también: el precio
-- de referencia tiene que poder verlo cualquiera antes de registrarse.
-- Las históricas no, porque muestran cómo movimos los precios.

create policy "categorías visibles para todos"
  on categorias for select using (true);

create policy "tarifas vigentes visibles"
  on tarifas for select
  using (
    (vigente_desde <= current_date
      and (vigente_hasta is null or vigente_hasta >= current_date))
    or es_operaciones()
  );

-- ---------- TÉCNICOS ----------
-- Un cliente puede ver quién es el técnico verificado que le tocó,
-- pero NUNCA su comisión ni su CUIT. Para eso está la vista de abajo:
-- la tabla queda cerrada y se expone sólo lo público.

create policy "el técnico ve su ficha"
  on tecnicos for select
  using (id = auth.uid() or es_operaciones());

create policy "el técnico edita su ficha"
  on tecnicos for update
  using (id = auth.uid())
  with check (id = auth.uid());

create view tecnicos_publico
with (security_invoker = true) as
  select
    t.id,
    p.nombre,
    t.zona_cobertura,
    (select round(avg(c.estrellas)::numeric, 1)
       from calificaciones c where c.tecnico_id = t.id) as promedio,
    (select count(*) from servicios s
      where s.tecnico_id = t.id and s.estado in ('pagado', 'calificado')) as trabajos
  from tecnicos t
  join perfiles p on p.id = t.id
  where t.estado = 'verificado';

comment on view tecnicos_publico is
  'Lo único que un cliente puede ver de un técnico. Sin CUIT, sin comisión, sin documentos.';

create policy "categorías del técnico visibles"
  on tecnico_categorias for select
  using (tecnico_id = auth.uid() or es_operaciones());

-- ---------- DOCUMENTOS DEL TÉCNICO ----------
-- DNI, matrícula, seguro, CBU. Datos personales de terceros.
-- Sólo el propio técnico y operaciones. Ningún cliente, nunca.
-- La verificación la hace operaciones, no el técnico sobre sí mismo.

create policy "el técnico ve sus documentos"
  on tecnico_documentos for select
  using (tecnico_id = auth.uid() or es_operaciones());

create policy "el técnico sube sus documentos"
  on tecnico_documentos for insert
  with check (tecnico_id = auth.uid());

create policy "sólo operaciones verifica documentos"
  on tecnico_documentos for update
  using (es_operaciones())
  with check (es_operaciones());

-- ---------- SERVICIOS ----------

create policy "el cliente ve sus servicios"
  on servicios for select
  using (cliente_id = auth.uid() or es_operaciones());

create policy "el técnico ve los servicios que le asignaron"
  on servicios for select
  using (tecnico_id = auth.uid());

-- El cliente crea el pedido, pero sólo puede fijar el problema y la
-- preferencia horaria. El estado arranca en 'solicitado' y los montos
-- tienen que venir vacíos: si no, alguien podría enviar un pedido ya
-- "pagado" por $0 desde la consola del navegador.
create policy "el cliente crea su pedido"
  on servicios for insert
  with check (
    cliente_id = auth.uid()
    and estado = 'solicitado'
    and tecnico_id is null
    and monto_ars is null
    and comision_ars is null
    and pago_referencia is null
    and exists (
      select 1 from propiedades p
      where p.id = propiedad_id and p.dueno_id = auth.uid()
    )
  );

-- ⚠️ NO hay política de UPDATE para clientes ni técnicos.
--
-- Es deliberado. Avanzar de estado, poner el monto, asignar el técnico
-- y cargar el pago pasa por el servidor (service_role, que saltea RLS)
-- con las validaciones de negocio hechas ahí. Un cliente que pudiera
-- hacer UPDATE podría ponerse el precio o marcarse el trabajo como
-- pagado. En Postgres no se puede restringir UPDATE por columna, así
-- que la única opción segura es no dárselo a nadie.
--
-- Cancelar es la excepción razonable y va con su propia política
-- acotada, más un trigger que asegura que sólo cambie esa columna:

create policy "el cliente cancela su pedido si todavía no arrancó"
  on servicios for update
  using (
    cliente_id = auth.uid()
    and estado in ('solicitado', 'buscando_tecnico', 'asignado')
  )
  with check (cliente_id = auth.uid() and estado = 'cancelado');

create or replace function solo_permitir_cancelar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El servidor (service_role) y operaciones pasan de largo.
  if auth.uid() is null or es_operaciones() then
    return new;
  end if;
  -- Para el resto: si tocaron algo que no sea el estado, se corta.
  if new.monto_ars       is distinct from old.monto_ars
     or new.comision_ars is distinct from old.comision_ars
     or new.tecnico_id   is distinct from old.tecnico_id
     or new.cliente_id   is distinct from old.cliente_id
     or new.propiedad_id is distinct from old.propiedad_id
     or new.pago_referencia is distinct from old.pago_referencia
     or new.reporte      is distinct from old.reporte then
    raise exception 'Sólo el equipo de Nora puede modificar estos datos del servicio';
  end if;
  return new;
end;
$$;

create trigger trg_solo_cancelar
  before update on servicios
  for each row execute function solo_permitir_cancelar();

-- ---------- EVENTOS ----------
-- Sólo lectura para todo el mundo. Los escribe el trigger.
-- Si alguien pudiera editarlos, la bitácora dejaría de servir como
-- prueba en una disputa, que es exactamente para lo que existe.

create policy "ver la historia del propio servicio"
  on servicio_eventos for select
  using (
    exists (
      select 1 from servicios s
      where s.id = servicio_eventos.servicio_id
        and (s.cliente_id = auth.uid() or s.tecnico_id = auth.uid())
    )
    or es_operaciones()
  );

-- ---------- FOTOS ----------

create policy "ver fotos del propio servicio"
  on servicio_fotos for select
  using (
    exists (
      select 1 from servicios s
      where s.id = servicio_fotos.servicio_id
        and (s.cliente_id = auth.uid() or s.tecnico_id = auth.uid())
    )
    or es_operaciones()
  );

create policy "subir fotos al propio servicio"
  on servicio_fotos for insert
  with check (
    subida_por = auth.uid()
    and exists (
      select 1 from servicios s
      where s.id = servicio_id
        and (s.cliente_id = auth.uid() or s.tecnico_id = auth.uid())
    )
  );

-- ---------- CALIFICACIONES ----------
-- Se pueden leer todas: son la reputación pública del técnico.
-- Sólo las escribe el cliente, sólo sobre un servicio suyo y sólo
-- cuando el trabajo terminó de verdad.

create policy "calificaciones visibles"
  on calificaciones for select using (true);

create policy "el cliente califica su servicio terminado"
  on calificaciones for insert
  with check (
    cliente_id = auth.uid()
    and exists (
      select 1 from servicios s
      where s.id = servicio_id
        and s.cliente_id = auth.uid()
        and s.estado in ('finalizado', 'pagado')
    )
  );

-- ============================================================
-- QUÉ FALTA (para la revisión de seguridad antes de salir a producción)
--
-- 1. Storage: los buckets de fotos y documentos necesitan sus propias
--    políticas. Deben ser PRIVADOS y servirse con URLs firmadas de
--    corta duración. Un bucket público expone fotos del interior de
--    las casas de los clientes.
-- 2. Rate limiting en el alta de servicios (hoy nada impide mandar
--    10.000 pedidos).
-- 3. Trigger que cree la fila de `perfiles` al registrarse un usuario.
-- 4. Probar cada política con dos usuarios distintos ANTES de abrirlo
--    a nadie: crear dos cuentas y verificar a mano que ninguna ve los
--    datos de la otra. Las políticas se escriben rápido; el error se
--    nota tarde.
-- 5. Encriptar en reposo los documentos del técnico (DNI, CBU).
-- ============================================================
