-- Classic Supabase rooms only. Apply after supabase-setup.sql.
-- The new Party Studio Node server enforces its own 30-player limit.
-- Locks the room row so concurrent inserts cannot exceed capacity.
create or replace function public.gamequiz_capacity_30()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform id from public.rooms where id = new.room_id for update;
  if (select count(*) from public.players where room_id = new.room_id) >= 30 then
    raise exception 'La sala ya tiene 30 jugadores';
  end if;
  return new;
end;
$$;
drop trigger if exists gamequiz_capacity_20 on public.players;
drop trigger if exists gamequiz_capacity_30 on public.players;
create trigger gamequiz_capacity_30 before insert on public.players
for each row execute function public.gamequiz_capacity_30();
