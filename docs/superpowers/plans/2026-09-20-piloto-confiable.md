# Piloto confiable Implementation Plan

> **For agentic workers:** aplicar subagent-driven-development para la tarea independiente de edificio y revisión; ejecutar cola y pruebas relacionadas localmente.

**Goal:** evitar pedidos sin aviso recuperable y preparar edificio/unidad sin registro.
**Architecture:** trigger transaccional + cola con leases + consumidor Next autenticado + cron Supabase. Configuración de edificio persistida y seleccionada por enlace.
**Tech Stack:** Next, Supabase, PostgreSQL, node:test y PGlite sólo desarrollo.
**Spec:** docs/superpowers/specs/2026-09-20-piloto-confiable.md

## Constraints
No cambios destructivos ni instalación de migraciones históricas. Rama codex/auditoria-piloto existente y aislada del proyecto padre. Push autorizado por el usuario. Sin mensajes reales a terceros. No datos del edificio inventados.

## Tarea 1: cola y consumidor
- [x] Tests SQL de trigger atómico, acceso, claim exclusivo, lease vencido, token obsoleto, backoff y entrega final.
- [x] db/44_cola_telegram.sql: tabla, trigger, RPC claim/finalizar/reintentar y RLS. No backfill automático.
- [x] web/src/lib/enrutamiento/cola.ts: cargar pedido persistido y consumir un claim con registro atómico.
- [x] Endpoint cron con secreto privado; endpoint enrutamiento existente sólo comprueba cola, sin envío desde navegador.
- [x] Panel de avisos con pendientes, errores y reintento protegido por rol.

## Tarea 2: edificio (agente independiente)
- [x] Tests de configuración/unidad, migración db/45_edificio_piloto.sql, wizard, tipos/datos/operaciones/Telegram con ubicación completa.
- [x] No activar edificio hasta recibir datos. Documentar alta y enlace.

## Tarea 3: aceptación y entrega
- [x] Revisar y probar permisos y restricciones con dos identidades, registrar límites frente al esquema remoto no inventariado.
- [x] Script de cron separado y runbook de instalación/rollback/pruebas reales.
- [x] Revisión independiente, tests/lint/build/audit, actualizar diagnóstico, commit y push.

## Cierre y límites
Implementación y pruebas locales completadas; credenciales, aplicación de migraciones, cron del proyecto y recepción Telegram real pendientes por falta de configuración. Edificio real pendiente de los datos del martes. La revisión independiente detectó y se corrigió paginación de avisos antiguos; además se protegió la firma privilegiada de fotos. Ver docs/piloto/ACTIVACION.md.
