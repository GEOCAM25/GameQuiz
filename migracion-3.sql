-- ============================================================
-- GAME QUIZ — Migración 3 (Entrega 4: mini-juegos)
-- Corre SOLO esto en el SQL Editor de Supabase si ya tienes la base.
-- ============================================================

-- Estado del mini-juego dentro de la sala (patrón compartido, ronda, etc.)
alter table public.rooms
  add column if not exists mini_state jsonb;

-- Puntajes/acciones de mini-juegos, sincronizados en tiempo real.
-- 'kind' = flash|color|preg|delator ; 'payload' guarda lo específico de cada uno.
create table if not exists public.mini_scores (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null,
  kind text not null,
  round int not null default 0,
  score int not null default 0,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.mini_scores enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='mini_scores' and policyname='open mini_scores') then
    create policy "open mini_scores" on public.mini_scores for all using (true) with check (true);
  end if;
end $$;

alter publication supabase_realtime add table public.mini_scores;

-- Nombre real para el mini-juego Delator (distinto del apodo del juego)
alter table public.players
  add column if not exists real_name text;
