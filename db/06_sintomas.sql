-- ============================================================
-- Afinado de síntomas
--
-- La prueba destapó una confusión concreta: "el inodoro pierde agua"
-- caía en "canilla goteando". La causa es que 'pierde' estaba como
-- síntoma de la canilla, y 'pierde' lo dice todo el mundo para
-- cualquier pérdida de agua.
--
-- Regla que sale de esto: los síntomas de una palabra tienen que ser
-- específicos del problema. Lo genérico va como frase de dos o tres
-- palabras, que puntúa doble y no se confunde.
-- ============================================================

update catalogo_trabajos
set sintomas = array['canilla','gotea','gotera','grifo','cierra mal','la canilla pierde','gotea la canilla']
where slug = 'canilla-goteando';

update catalogo_trabajos
set sintomas = array['inodoro','mochila','deposito','corre el agua','no corta','sigue cargando',
                     'el inodoro pierde','pierde agua el inodoro','inodoro pierde agua']
where slug = 'inodoro-mochila';

-- 'humedad' también era ambiguo entre el flexible y la filtración.
update catalogo_trabajos
set sintomas = array['gotea','pierde','bacha','pileta','cocina','flexible','abajo de la bacha',
                     'debajo de la bacha','humedad en el mueble','mueble mojado']
where slug = 'perdida-flexible-bacha';

update catalogo_trabajos
set sintomas = array['mancha','techo','filtracion','moho','pared mojada','gotea del techo',
                     'humedad en la pared','humedad en el techo','mancha de humedad']
where slug = 'perdida-techo-humedad';
