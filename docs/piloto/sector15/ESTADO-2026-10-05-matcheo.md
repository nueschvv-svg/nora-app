# Bloque matcheo histórico — estado al 05/10/2026

Trabajo interrumpido por límite de uso. Esto NO es un bloque terminado.

## Hecho y verificado

- Repo en `codex/auditoria-piloto`, HEAD `5136529`, árbol limpio, sin commits
  posteriores al último funcional conocido.
- Leída la documentación obligatoria: memoria del proyecto, INFORME,
  ACTUALIZACION-2026-09-20, ACTIVACION, LECTURA-Y-PRECONDICIONES,
  UNIDAD-Y-TELEGRAM-2026-10-05, plan 2026-09-30 y ambos CSV.
- **`db/49_catalogo_eba.sql` generado**, no aplicado en ningún entorno.
  Se generó por script desde `catalogo_nora_sector15.csv`: 132 filas literales,
  sin casos inventados. Crea `catalogo_eba` (RLS, lectura pública, sin escritura
  para anon/authenticated), valida la familia con CHECK contra las nueve
  familias, y verifica el conteo de 132 antes del commit. Es repetible.
  Agrega además la categoría real `humedad` (fila en `categorias`, no hardcode).

## Bloqueos externos reales

1. **Anthropic: `HTTP 401 invalid x-api-key`.** No es saldo insuficiente como
   decía el reporte anterior: la clave de `web/.env.local` es inválida o fue
   revocada. Hasta reemplazarla no se puede probar clasificación ni chat contra
   el modelo real. Prueba mínima ejecutada contra `/v1/messages`.
2. **GHSA braces: no existe parche.** `braces@3.0.3` es la última publicada y
   `micromatch@4.0.8` (última) sigue dependiendo de ella; `fast-glob@3.3.3`
   también. El único arreglo que ofrece npm es bajar `eslint-config-next` de
   16.3.5 a 14.2.35, un downgrade mayor incompatible con Next 16. No se hizo.
   Es dependencia sólo de desarrollo y `npm audit --omit=dev` da 0
   vulnerabilidades.

## Pendiente

- `web/src/lib/antecedentes.ts`: familias, carga del catálogo, sección de
  prompt y validación servidor de familia + ids de casos devueltos.
- Cablear en `diagnostico.ts` y `chatNora.ts`, y en `/api/diagnosticar` y
  `/api/chat`. Revisar los cuatro puntos de entrada para que ninguno conserve
  la lógica anterior.
- **Bug detectado, sin corregir:** `web/src/lib/descripcionPedido.ts` escribe
  `[Foto analizada por Nora]` siempre que hay observaciones, aunque el pedido
  haya sido sólo texto. Es exactamente el caso que el pedido prohíbe.
- Estados segunda visita / administración / materiales (migración nueva).
- Retirar del recorrido residente: Nominatim, altas generales, marketplace.
- Cron periódico de avisos Telegram.
- Tests, aplicación en staging, recorrido en navegador y publicación.

## Nota sobre precios

Pospuestos por decisión del usuario. En staging no se copiaron tarifas, así que
`estimado` ya degrada a `null` sin bloquear el pedido. No hace falta quitar la
maquinaria de precios; sí asegurarse de no presentar valores históricos como
vigentes.
