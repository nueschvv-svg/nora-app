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
