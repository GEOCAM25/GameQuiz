-- ============================================================
-- GAME QUIZ — Esquema de base de datos para Supabase
-- Pega TODO este archivo en el SQL Editor de Supabase y ejecútalo
-- ============================================================

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid,
  status text not null default 'lobby', -- lobby|countdown|question|reveal|board|podium
  settings jsonb not null default '{}',
  current_q int not null default -1,
  q_started_at timestamptz,
  phase_until bigint,   -- marca de tiempo (ms) para el watchdog del anfitrión
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  avatar text not null,
  score int not null default 0,
  total_score int not null default 0,
  connected boolean not null default true,
  is_host boolean not null default false,
  joined_late boolean not null default false,
  joined_at timestamptz not null default now()
);

create table public.answers (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  q_index int not null,
  player_id uuid not null references public.players(id) on delete cascade,
  answer int not null,
  correct boolean not null default false,
  points int not null default 0,
  answered_at timestamptz not null default now(),
  unique (room_id, q_index, player_id)
);

create table public.messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid,
  player_name text,
  avatar text,
  content text,
  sticker text,
  created_at timestamptz not null default now()
);

create table public.votes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null,
  category text not null,
  primary key (room_id, player_id)
);

create table public.game_history (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  game_number int not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS abierto (juego casual con anon key)
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.answers enable row level security;
alter table public.messages enable row level security;
alter table public.votes enable row level security;
alter table public.game_history enable row level security;

create policy "open rooms" on public.rooms for all using (true) with check (true);
create policy "open players" on public.players for all using (true) with check (true);
create policy "open answers" on public.answers for all using (true) with check (true);
create policy "open messages" on public.messages for all using (true) with check (true);
create policy "open votes" on public.votes for all using (true) with check (true);
create policy "open game_history" on public.game_history for all using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.answers;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.game_history;

-- Limpieza automática de salas viejas (opcional, requiere pg_cron activado)
-- select cron.schedule('clean-rooms', '0 * * * *', $$delete from public.rooms where created_at < now() - interval '12 hours'$$);
