-- ============================================================
-- NORA — Obras: seguimiento de construcciones propias del cliente
--
-- No es exclusivo de Enjinia (esa integración queda para cuando
-- llegue su base de datos, en una etapa aparte) — cualquier cliente
-- puede cargar una obra propia: nombre, ubicación, presupuesto,
-- etapas, y el contacto de quien la dirige. Datos que carga y
-- mantiene el propio cliente a mano, no verificados por nadie — por
-- eso el CRUD es completo y sólo suyo, mismo criterio que
-- `propiedades` o `equipos`.
--
-- Las etapas van en una columna jsonb en vez de una tabla aparte:
-- es una lista corta (4-8 ítems típicamente) que el cliente edita
-- como conjunto — "guardar toda la obra de una", no filas
-- independientes con su propio ciclo de vida. Una tabla aparte acá
-- sería más estructura de la que este dato necesita.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create table obras (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references perfiles(id) on delete cascade,
  nombre          text not null check (length(trim(nombre)) >= 2),
  ubicacion       text,
  presupuesto_ars numeric(14,2) check (presupuesto_ars is null or presupuesto_ars >= 0),
  ejecutado_ars   numeric(14,2) check (ejecutado_ars is null or ejecutado_ars >= 0),
  -- [{ "nombre": "Fundaciones y estructura", "estado": "completo" }, ...]
  -- estado: 'pendiente' | 'en_curso' | 'completo'
  etapas          jsonb not null default '[]'::jsonb,
  contacto_nombre text,
  contacto_rol    text,
  contacto_telefono text,
  creado_el       timestamptz not null default now(),
  actualizado_el  timestamptz not null default now()
);

create index on obras (cliente_id, creado_el desc);

alter table obras enable row level security;

create policy "el cliente administra sus propias obras"
  on obras for all
  using (cliente_id = auth.uid())
  with check (cliente_id = auth.uid());

create or replace function tocar_obra()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_el = now();
  return new;
end;
$$;

create trigger trg_tocar_obra
  before update on obras
  for each row execute function tocar_obra();
