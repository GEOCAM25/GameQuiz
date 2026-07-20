-- ============================================================
-- MUNDO QUIZ ⛏️ — persistencia del mundo compartido
-- Ejecuta este archivo UNA VEZ en Supabase (SQL Editor → Run) para
-- que lo que construye cada jugador quede guardado PARA SIEMPRE y
-- lo vean todos, desde cualquier teléfono.
--
-- Si NO lo ejecutas, el juego igual funciona: las construcciones se
-- guardan en cada teléfono (localStorage) y se comparten en vivo
-- mientras haya jugadores conectados, pero no quedan en la nube.
-- ============================================================

create table if not exists public.mundo_edits (
  x integer not null,
  y integer not null,
  z integer not null,
  b smallint not null,          -- id del bloque (0 = aire/borrado)
  updated_at timestamptz not null default now(),
  primary key (x, y, z)
);

alter table public.mundo_edits enable row level security;

-- Mismo criterio abierto que el resto del juego (anónimo).
-- Si más adelante activas los inicios de sesión anónimos y endureces
-- la seguridad (supabase-seguridad.sql), cambia "anon, authenticated"
-- por "authenticated" en estas políticas.
drop policy if exists "mundo_select" on public.mundo_edits;
drop policy if exists "mundo_insert" on public.mundo_edits;
drop policy if exists "mundo_update" on public.mundo_edits;
create policy "mundo_select" on public.mundo_edits for select to anon, authenticated using (true);
create policy "mundo_insert" on public.mundo_edits for insert to anon, authenticated with check (true);
create policy "mundo_update" on public.mundo_edits for update to anon, authenticated using (true);
