-- ============================================================
-- NORA — El trigger que crea `perfiles` no sobrevivía a una sesión
-- anónima
--
-- crear_perfil_al_registrarse() (vive sólo en la base, nunca estuvo
-- en un archivo de este repo — se armó a mano en algún momento)
-- arma `nombre` con:
--   coalesce(new.raw_user_meta_data->>'nombre',
--            new.raw_user_meta_data->>'full_name',
--            split_part(new.email, '@', 1))
--
-- Una sesión anónima (signInAnonymously(), para el pivot "sin cuentas"
-- del lado cliente) no tiene metadata NI email — auth.users.email
-- queda NULL. Las tres ramas del coalesce dan NULL, perfiles.nombre
-- es `not null`, y el INSERT del trigger revienta: el login anónimo
-- fallaría siempre con una violación de restricción. Se agrega un
-- último fallback fijo para que la fila se cree igual — HojaDatosPersonales
-- ya deja editar nombre/teléfono después, apenas la persona los
-- escriba en el flujo de pedido.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- ============================================================

create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.perfiles (id, rol, nombre, telefono)
  values (
    new.id,
    'cliente',
    coalesce(
      new.raw_user_meta_data->>'nombre',
      new.raw_user_meta_data->>'full_name',
      nullif(split_part(new.email, '@', 1), ''),
      'Invitado'
    ),
    new.raw_user_meta_data->>'telefono'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
