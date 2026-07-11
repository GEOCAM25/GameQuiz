-- ============================================================
-- GAME QUIZ — REFUERZO DE SEGURIDAD (opcional pero recomendado)
--
-- QUÉ HACE: hoy las reglas (RLS) están abiertas a cualquiera que
-- tenga la clave pública. Este script las cambia para que SOLO los
-- clientes con sesión iniciada (el juego inicia sesión anónima solo)
-- puedan leer/escribir, y pone límites de tamaño anti-abuso en
-- nombres y mensajes del chat.
--
-- ⚠️⚠️ ORDEN OBLIGATORIO — SI TE LO SALTAS, EL JUEGO DEJA DE FUNCIONAR ⚠️⚠️
--
--   PASO 1 (PRIMERO, OBLIGATORIO): activa los inicios anónimos.
--       supabase.com → tu proyecto → Authentication → Sign In / Up
--       → "Allow anonymous sign-ins" → ACTIVADO → Save.
--       (Hoy está DESACTIVADO en tu proyecto — se verificó el 2026-07-11.
--        Sin esto, ningún jugador podrá entrar después de correr este SQL.)
--
--   PASO 2: recién entonces ve a SQL Editor, pega TODO este archivo y RUN.
--
--   PASO 3: prueba crear una sala y entrar con otro teléfono. Si algo
--       falla, corre supabase-setup.sql para volver a las reglas abiertas.
--
-- Se puede correr las veces que quieras (es idempotente).
-- Si algo saliera mal, puedes volver atrás corriendo de nuevo el
-- archivo original supabase-setup.sql (restaura las reglas abiertas).
-- ============================================================

-- 1) Quitar las políticas abiertas
drop policy if exists "open rooms"        on public.rooms;
drop policy if exists "open players"      on public.players;
drop policy if exists "open answers"      on public.answers;
drop policy if exists "open messages"     on public.messages;
drop policy if exists "open votes"        on public.votes;
drop policy if exists "open game_history" on public.game_history;
drop policy if exists "open mini_scores"  on public.mini_scores;

-- 2) Solo clientes AUTENTICADOS (el juego usa sesión anónima, que cuenta
--    como autenticado). Quien use la clave pública "a pelo" queda fuera.
drop policy if exists "auth rooms"        on public.rooms;
create policy "auth rooms" on public.rooms for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth players"      on public.players;
create policy "auth players" on public.players for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated' and char_length(name) between 1 and 20);

drop policy if exists "auth answers"      on public.answers;
create policy "auth answers" on public.answers for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth messages"     on public.messages;
create policy "auth messages" on public.messages for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated'
              and (content is null or char_length(content) <= 300)
              and (player_name is null or char_length(player_name) <= 20));

drop policy if exists "auth votes"        on public.votes;
create policy "auth votes" on public.votes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth game_history" on public.game_history;
create policy "auth game_history" on public.game_history for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth mini_scores"  on public.mini_scores;
create policy "auth mini_scores" on public.mini_scores for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
