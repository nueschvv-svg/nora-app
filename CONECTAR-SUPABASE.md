# Conectar Supabase — qué hacés vos y qué hago yo

## Primero: por qué NO me mandás las claves por chat

Me preguntaste si me podés pasar una API key para que haga todo yo. La respuesta corta es **no me la mandes por acá**, y no es una formalidad.

Supabase te da tres cosas distintas y sólo una es inofensiva:

| Qué es | Para qué sirve | ¿Se puede compartir? |
|---|---|---|
| **URL del proyecto** | La dirección de tu base | Sí, es pública |
| **Clave `anon` (pública)** | La que usa la app desde el celular | Sí — está diseñada para viajar al navegador. Los permisos que escribimos son lo que la contiene |
| **Clave `service_role`** | **Saltea TODOS los permisos.** Con esa clave se lee, se cambia y se borra cualquier dato de cualquier usuario | **Nunca.** Ni a mí ni a nadie |
| **Contraseña de la base** | Acceso directo total | **Nunca** |

El problema no es que yo haga algo malo con ellas. Es que **todo lo que se escribe en un chat queda registrado**, y una clave que quedó escrita en algún lado hay que darla por comprometida y rotarla. Es más simple no ponerla nunca.

**La forma correcta:** vos pegás las claves en un archivo del proyecto que ya está excluido del repositorio. Yo escribo el código que las lee por nombre, sin verlas nunca. Funciona igual y no queda nada expuesto.

Si alguna vez pegaste una clave `service_role` en algún chat, mail o mensaje: andá a Supabase → Settings → API → **Reset**. No alcanza con borrar el mensaje.

---

## Lo que tenés que hacer vos (unos 10 minutos)

### 1. Crear el proyecto

En [supabase.com](https://supabase.com), con tu cuenta:
- **New project**
- Nombre: `nora`
- Contraseña de la base: generala con el botón y **guardala en tu gestor de contraseñas**. No la vas a necesitar seguido, pero si la perdés es un lío.
- Región: **South America (São Paulo)** — es la más cercana a Argentina y se nota en la velocidad.

Tarda un par de minutos en levantar.

### 2. Crear las tablas

En el menú de la izquierda: **SQL Editor** → **New query**.

- Abrí `db/01_esquema.sql`, copiá **todo** el contenido, pegalo y dale **Run**.
- Repetí con `db/02_permisos.sql`. **Este orden importa**: el segundo depende de las tablas que crea el primero.

Si alguno tira error, pasame el mensaje tal cual y lo corrijo.

### 3. Pasarme las claves sin mandármelas

En Supabase: **Settings** → **API**. Vas a ver la URL del proyecto y las claves.

En la carpeta `web/` del proyecto hay un archivo `.env.local.ejemplo`. Hacé una copia llamada **`.env.local`** (mismo lugar) y pegá ahí los valores.

Ese archivo ya está en el `.gitignore`: nunca se sube al repositorio ni sale de tu computadora. Yo escribo el código que lo lee, pero no necesito abrirlo.

Cuando lo tengas listo, decime **"ya está el .env.local"** y sigo yo.

---

## Lo que hago yo después

1. Instalo el cliente de Supabase y lo configuro.
2. **Login de verdad**: registro con email y con Google. Ahí dejan de existir los datos de prueba.
3. Cambio el guardado: hoy los domicilios y equipos van a la memoria del navegador; pasan a la base. El mismo usuario los ve desde cualquier dispositivo.
4. El pedido de servicio pasa a guardarse de verdad y aparece en el historial.
5. **El panel de operaciones**, para que vos veas los pedidos que entran y asignes el técnico.

---

## Una advertencia sobre el paso 2

Los permisos de `02_permisos.sql` son lo único que impide que un usuario lea los datos de otro. Antes de que entre una sola persona real, hay que probarlos: creamos dos cuentas de prueba y verificamos a mano que ninguna vea nada de la otra.

Lo digo porque es el tipo de error que **no da ningún síntoma**. La app funciona perfecto, se ve bien, nadie se queja — y mientras tanto cualquiera puede leer la dirección de la casa de todos los clientes. Lo dejo anotado para hacerlo juntos, no lo salteemos.
