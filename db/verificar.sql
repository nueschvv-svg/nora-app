-- Verificación: ¿quedó todo bien creado y con los acentos correctos?
select
  c.nombre                                                              as categoria,
  c.activa,
  (select count(*) from pg_tables where schemaname = 'public')          as tablas_creadas,
  (select count(*) from pg_tables
    where schemaname = 'public' and rowsecurity)                        as tablas_protegidas
from categorias c
order by c.orden;
