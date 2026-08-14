-- ============================================================
-- Corrige los acentos de las categorias que se rompieron al pegar.
--
-- Esta consulta no tiene NI UNA letra acentuada: usa los codigos
-- Unicode de cada una (\00ED = i con tilde, \00F1 = enie), asi es
-- imposible que se rompa de nuevo por la codificacion.
-- ============================================================

update categorias set nombre = U&'Plomer\00EDa'        where slug = 'plomeria';
update categorias set nombre = U&'Cerrajer\00EDa'      where slug = 'cerrajeria';
update categorias set nombre = U&'Carpinter\00EDa'     where slug = 'carpinteria';
update categorias set nombre = U&'Alba\00F1iler\00EDa' where slug = 'albanileria';

-- Verificacion final: tiene que verse todo bien escrito.
select
  c.nombre                                                     as categoria,
  c.activa,
  (select count(*) from pg_tables
    where schemaname = 'public' and rowsecurity)               as tablas_protegidas
from categorias c
order by c.orden;
