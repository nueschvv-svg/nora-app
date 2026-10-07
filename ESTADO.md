# Nora — Dónde estamos

> Este documento conserva el estado histórico de agosto. Para la auditoría del 14/09/2026, correcciones y bloqueos del piloto ENJINIA, ver [INFORME.md](docs/piloto/INFORME.md).

Actualizado: 13 de agosto de 2026

---

## Lo que funciona hoy

| | Estado |
|---|---|
| Base de datos en Supabase | ✅ 12 tablas, las 12 con permisos cerrados |
| Registro automático de usuarios | ✅ Nadie tiene que dar de alta a nadie |
| Login / cerrar sesión | ✅ |
| Recuperar contraseña | ✅ |
| Rutas protegidas | ✅ Sin cuenta, todo redirige al login |
| Alta de domicilios | ✅ Guarda en la base |
| Alta de equipos | ✅ Guarda en la base |
| Score calculado y explicado | ✅ Con el desglose de por qué da lo que da |
| Agenda de mantenimientos | ✅ Calculada desde los equipos |
| Pedir un servicio | ✅ Se guarda y aparece en el historial |
| Historial | ✅ Separa "en curso" de "resueltos" |

**Ya no hay datos inventados en ningún lado.** El archivo de datos de prueba está borrado.

---

## Lo que falta, en orden

### 1. Apagar la confirmación por mail (3 clics, los hacés vos)

`Authentication` → `Sign In / Providers` → `Email` → apagar **"Confirm email"** → Save

Sin esto no puedo terminar de probar el flujo completo con dos usuarios.

### 2. La prueba de los dos usuarios ← **lo más importante**

Crear dos cuentas, cargar un domicilio con la primera, y verificar que la segunda no pueda verlo.

Ya probé que **sin sesión** no se ve nada. Falta probar que **con sesión ajena** tampoco. Es el escenario real: un usuario registrado intentando leer datos de otro.

No es un trámite. Es la diferencia entre un sistema y un colador, y quiero hacerla antes de que exista un solo cliente.

### 3. Panel de operaciones

Es donde vas a vivir el primer año: ver los pedidos que entran, asignar el técnico a mano, cambiar estados. **Hoy los pedidos entran y nadie los ve.** Es el agujero más grande que queda.

### 4. Notificaciones

Cuando cambia el estado de un pedido, hoy no se avisa. En Argentina el canal es WhatsApp.

### 5. Antes de lanzar

- Volver a prender la confirmación de email, con Resend configurado
- Términos y condiciones + política de privacidad (abogado)
- Botón de arrepentimiento (Ley 24.240)
- Sentry y PostHog
- Google como forma de entrar (el código ya está listo, faltan credenciales)

---

## Decisiones que necesito de vos

**1. Zona y rubros de arranque.** Puse plomería, electricidad y cerrajería activas. Las otras seis aparecen en gris con "PRONTO". Se cambia desde la base sin tocar la app — decime si van otras.

**2. Borrar un domicilio.** Hoy se puede agregar pero no borrar, a propósito. Si alguien borra una casa que tiene servicios pagados, ¿qué pasa con esas facturas? Lo más probable es que convenga ocultarla en vez de borrarla. Es decisión tuya, no técnica.

**3. Confirmación de email.** ¿Apagamos ahora y la prendemos antes de lanzar, o configuramos Resend ya?

---

## Deuda anotada

Cosas que sé que están y decidí dejar para después, para que no aparezcan como sorpresa:

- **Sin paginación** en historial y equipos. Con menos de 100 registros no se nota.
- **Sin fotos todavía.** El botón de la cámara en el pedido cuenta las fotos pero no las sube. Falta configurar el almacenamiento en Supabase, con buckets privados: si fueran públicos, las fotos del interior de las casas de los clientes quedarían accesibles con el link.
- **Sin límite de pedidos por usuario.** Hoy nada impide mandar 10.000. Hace falta antes de abrir al público.
- **`borrarPropiedad` y `borrarEquipo` existen sin botón**, esperando la decisión de arriba.

---

## Los commits

```
34d8cf7  Revisión de código: 6 correcciones
179ea35  Los datos viven en la base, no en el navegador
747d40b  Registro y login: cualquiera puede crear su cuenta solo
8820aa1  Supabase conectado: base creada y permisos verificados
d40574e  Los botones ahora hacen algo
79bf453  Base de la app real: diseño migrado y score funcionando
778e11b  Punto de partida: prototipo auditado
```

Se puede volver a cualquiera de estos puntos.
