-- ============================================================
-- GAME QUIZ — Migración 2 (Entrega 3: puntajes por sala)
-- Corre SOLO esto en el SQL Editor de Supabase si ya tienes la base.
-- Crea la tabla que guarda el resultado de cada partida jugada
-- dentro de una sala (para el acumulado y el historial).
-- ============================================================

create table if not exists public.game_history (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  game_number int not null,          -- Partida 1, 2, 3... dentro de la sala
  results jsonb not null,            -- [{player_id, name, avatar, score}, ...]
  created_at timestamptz not null default now()
);

alter table public.game_history enable row level security;

-- Política abierta (juego casual con anon key), igual que las otras tablas
do $$
begin
  if not exists (select 1 from pg_policies where tablename='game_history' and policyname='open game_history') then
    create policy "open game_history" on public.game_history for all using (true) with check (true);
  end if;
end $$;

-- Realtime para que el historial se vea en vivo entre jugadores
alter publication supabase_realtime add table public.game_history;

-- Campo para el total acumulado del jugador en la sala (modo acumulativo)
alter table public.players
  add column if not exists total_score int not null default 0;
