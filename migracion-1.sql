-- ============================================================
-- GAME QUIZ — Migración 1 (Entrega 1: bugs)
-- Si YA tienes la base creada, corre SOLO esto en el SQL Editor
-- de Supabase. Agrega la columna que necesita el nuevo motor.
-- (Si la columna ya existe, no pasa nada: usa IF NOT EXISTS.)
-- ============================================================

alter table public.rooms
  add column if not exists phase_until bigint;
