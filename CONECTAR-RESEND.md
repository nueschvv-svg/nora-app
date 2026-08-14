# Conectar Resend (los mails de Nora)

## Por qué hace falta

Supabase trae un servicio de mails incluido, pero con un límite de **2 o 3 por hora** y ellos mismos aclaran que no es para producción.

Traducido: si mañana se registran cuatro personas en la misma hora, **la cuarta no recibe el mail de confirmación**, no puede entrar, y no se queja — se va. Vos tampoco te enterás.

Resend manda hasta **3.000 mails por mes gratis** y 100 por día. De sobra para arrancar.

---

## ⚠️ Antes de empezar: necesitás un dominio

Este es el punto que suele frenar todo, así que va primero.

Resend **sólo deja mandar mails desde un dominio propio** que hayas verificado. Sin dominio, únicamente podés mandarte mails a vos mismo — sirve para probar, no para tener usuarios.

**¿Tenés un dominio para Nora?** (`nora.com.ar`, `nora.app`, el que sea)

- **Sí** → seguí con el paso 1.
- **No** → compralo primero. En Argentina, un `.com.ar` en [NIC.ar](https://nic.ar) sale muy poco. Un `.com` o `.app` en Namecheap o Cloudflare ronda los USD 10-15 al año. **Es el paso que te falta**, y lo vas a necesigar igual para publicar la app.

Sin dominio no sigas: no se puede.

---

## Paso 1 — Crear la cuenta

En [resend.com](https://resend.com) → **Sign up**. Gratis, sin tarjeta.

## Paso 2 — Verificar tu dominio

1. En Resend: **Domains** → **Add Domain**
2. Escribí tu dominio (ej: `nora.com.ar`)
3. Resend te muestra **3 o 4 registros DNS** (unos textos raros tipo `resend._domainkey`)
4. Esos registros hay que cargarlos donde compraste el dominio, en la sección **DNS**
5. Volvé a Resend y tocá **Verify**

Tarda entre 5 minutos y algunas horas en verificar, según el proveedor.

**Qué son esos registros:** le dicen al resto de internet que Resend tiene permiso para mandar mails en nombre de tu dominio. Sin eso, Gmail manda todo a spam — o directamente lo rechaza.

## Paso 3 — Sacar las credenciales SMTP

En Resend: **Settings** → **SMTP**. Vas a ver algo así:

```
Host:     smtp.resend.com
Port:     465
Username: resend
Password: re_xxxxxxxxxxxxxxxx
```

Esa contraseña **sí es un secreto**. No la pegues en el chat: va directo en Supabase.

## Paso 4 — Cargarla en Supabase

1. Supabase → **Authentication** → **Emails** → solapa **SMTP Settings**
2. Activá **Enable Custom SMTP**
3. Completá:

| Campo | Qué poner |
|---|---|
| Sender email | `hola@tudominio.com.ar` |
| Sender name | `Nora` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la clave `re_...` de Resend |

4. **Save**

## Paso 5 — Probar

Registrate en la app con un mail tuyo real. Tiene que llegar el mail de confirmación, **de parte de "Nora"**, y no a la carpeta de spam.

---

## Los textos de los mails

Aparte del envío, hay algo que hay que arreglar igual: **los mails de Supabase vienen en inglés**. Alguien se registra en Nora, que le habla de vos, y le llega *"Confirm your signup"*.

En Supabase → **Authentication** → **Emails** → **Templates**, reemplazá cada uno:

### Confirm signup

**Asunto:** `Confirmá tu cuenta en Nora`

```html
<h2>¡Bienvenido a Nora!</h2>
<p>Falta un paso: tocá el botón y tu cuenta queda lista.</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#0E5C54;color:#fff;
            padding:14px 28px;border-radius:14px;text-decoration:none;
            font-weight:600;font-family:system-ui,sans-serif">
    Confirmar mi cuenta
  </a>
</p>
<p style="color:#5B6B68;font-size:13px">
  Si no creaste ninguna cuenta en Nora, ignorá este mail: no pasa nada.
</p>
```

### Reset password

**Asunto:** `Recuperá tu contraseña de Nora`

```html
<h2>Elegí una contraseña nueva</h2>
<p>Tocá el botón y te llevamos a elegirla. El link vence en una hora.</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#0E5C54;color:#fff;
            padding:14px 28px;border-radius:14px;text-decoration:none;
            font-weight:600;font-family:system-ui,sans-serif">
    Elegir contraseña nueva
  </a>
</p>
<p style="color:#5B6B68;font-size:13px">
  Si no pediste esto, ignorá el mail. Tu contraseña sigue siendo la de siempre.
</p>
```

---

## Y una cosa más, que se olvida siempre

Supabase → **Authentication** → **URL Configuration**:

- **Site URL**: hoy `http://localhost:3000`. Cuando publiques, cambialo a tu dominio real.
- **Redirect URLs**: agregá `http://localhost:3000/**` y, cuando publiques, `https://tudominio.com/**`

Si esto queda mal, **los links de los mails te llevan a localhost** — que en el celular de un cliente no existe. Es la causa número uno de "el link del mail no funciona".
