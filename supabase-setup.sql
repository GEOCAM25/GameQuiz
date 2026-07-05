-- ============================================================
-- GAME QUIZ — Script único de base de datos para Supabase
-- Reemplaza a supabase-setup.sql + migracion-1/2/3.sql
-- Se puede correr las veces que quieras: todo usa "if not exists",
-- así que nunca da error aunque ya tengas parte de esto creado.
-- Pega TODO este archivo en el SQL Editor de Supabase y presiona Run.
-- ============================================================

-- ---------- Tablas base ----------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid,
  status text not null default 'lobby',
  settings jsonb not null default '{}',
  current_q int not null default -1,
  q_started_at timestamptz,
  phase_until bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
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

create table if not exists public.answers (
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

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid,
  player_name text,
  avatar text,
  content text,
  sticker text,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null,
  category text not null,
  primary key (room_id, player_id)
);

create table if not exists public.game_history (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  game_number int not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

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

-- ---------- Columnas agregadas por las migraciones (por si la tabla ya existía) ----------
alter table public.rooms   add column if not exists phase_until bigint;
alter table public.rooms   add column if not exists mini_state jsonb;
alter table public.players add column if not exists total_score int not null default 0;
alter table public.players add column if not exists real_name text;

-- ---------- Seguridad: RLS abierto (juego casual con anon key) ----------
alter table public.rooms         enable row level security;
alter table public.players       enable row level security;
alter table public.answers       enable row level security;
alter table public.messages      enable row level security;
alter table public.votes         enable row level security;
alter table public.game_history  enable row level security;
alter table public.mini_scores   enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='rooms' and policyname='open rooms') then
    create policy "open rooms" on public.rooms for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='players' and policyname='open players') then
    create policy "open players" on public.players for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='answers' and policyname='open answers') then
    create policy "open answers" on public.answers for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='messages' and policyname='open messages') then
    create policy "open messages" on public.messages for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='votes' and policyname='open votes') then
    create policy "open votes" on public.votes for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='game_history' and policyname='open game_history') then
    create policy "open game_history" on public.game_history for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='mini_scores' and policyname='open mini_scores') then
    create policy "open mini_scores" on public.mini_scores for all using (true) with check (true);
  end if;
end $$;

-- ---------- Tiempo real (Realtime) ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='players') then
    alter publication supabase_realtime add table public.players;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='answers') then
    alter publication supabase_realtime add table public.answers;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='votes') then
    alter publication supabase_realtime add table public.votes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='game_history') then
    alter publication supabase_realtime add table public.game_history;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mini_scores') then
    alter publication supabase_realtime add table public.mini_scores;
  end if;
end $$;

-- Limpieza automática de salas viejas (opcional, requiere pg_cron activado)
-- select cron.schedule('clean-rooms', '0 * * * *', $$delete from public.rooms where created_at < now() - interval '12 hours'$$);
