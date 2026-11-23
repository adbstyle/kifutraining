-- Übungen und Trainings nur mit Konto (Story #669, Migration nur_mit_konto):
-- - ohne Anmeldung (`anon`) liefert keine Tabelle der Übungen und Trainings
--   eine Zeile, auch nicht Manual-Übungen und Community-Trainings
-- - angemeldet bleibt alles wie bisher: Community-Inhalte für alle Konten
--   (PC 3), auch anonymisierte gelöschter Konten
-- - ohne Anmeldung lassen sich die Bilder im Bucket nicht aufzählen, und die
--   Namens- und Bedingungsfunktionen sind für anon zu (Migration
--   nur_mit_konto_nachzug)
-- - `startseite_beispiele()` liefert ohne Anmeldung genau die sechs festen
--   Manual-Übungen, in der Reihenfolge der Anzeige, und sonst nichts
-- Läuft auch auf der leeren Wegwerf-DB der CI (vor `npm run seed`): fehlende
-- Manual-Übungen legt der Test selbst an. Alles in einer Transaktion mit
-- rollback; hinterlässt nichts.

\set ON_ERROR_STOP on
\o /dev/null

begin;
set local statement_timeout = '60s';

create function pg_temp.als(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.anonym() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

-- Zurück zu postgres ohne Anmeldung: `reset role` allein lässt die Claims
-- (und damit auth.uid()) stehen.
create function pg_temp.zurueck() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.pruefe(p_ok boolean, p_text text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception '#669: %', p_text; end if;
end $$;

-- ── Bestand: die sechs Beispiele (falls nicht geseedet), ein Konto mit
--    Community-Training samt Kind-Zeilen, eine anonymisierte Community-Übung ──
insert into public.exercises (slug, name, trainingsteil, aufbau, source, visibility)
select s, 'Beispiel ' || s, 'ausklang', 'Aufbau', 'manual', 'public'
from unnest(array[
  'freies-kleinfeldspiel', 'autorennen', 'dribbling-1-1-frontal-auf-ein-tor',
  'passen-und-ballkontrolle-tigerball-durch-das-tor', 'torabschluss-zielschuss', 'penalty-koenig-in'
]) s
on conflict (slug) do nothing;

insert into public.exercises (slug, name, trainingsteil, aufbau, source, visibility)
values ('nur-mit-konto-manual-extra', 'Weitere Manual-Übung', 'ausklang', 'Aufbau', 'manual', 'public');

insert into auth.users (id, email, aud, role)
values ('69690000-0000-4000-8000-000000000001', 'nur-mit-konto-a@test.local', 'authenticated', 'authenticated'),
       ('69690000-0000-4000-8000-000000000002', 'nur-mit-konto-b@test.local', 'authenticated', 'authenticated');

-- Eine Community-Übung ohne Eigentümer (anonymisiert nach «Konto löschen»).
insert into public.exercises (slug, name, trainingsteil, aufbau, source, visibility, owner_id)
values ('nur-mit-konto-verwaist', 'Verwaiste Community-Übung', 'ausklang', 'Aufbau', 'user', 'public', null);

-- Ein Training des Kontos A, zuerst als Entwurf, samt einer Fassung. Weiter
-- unten wird es zum Community-Training.
select pg_temp.als('69690000-0000-4000-8000-000000000001');
insert into public.trainings (id, name, owner_id, altersstufe, stufen)
values ('69690000-0000-4000-8000-0000000000a1', 'Training A', '69690000-0000-4000-8000-000000000001', 'kinderfussball', array['F']);
select pg_temp.zurueck();

insert into public.training_exercises (training_id, name, trainingsteil, position, aufbau)
select '69690000-0000-4000-8000-0000000000a1', 'Fassung', 'ausklang', 0, 'Aufbau';

-- Ein Bild im Bucket der Übungen (Nachzug: anon zählt keine Objekte auf).
insert into storage.objects (bucket_id, name)
values ('exercise-images', 'user/69690000-0000-4000-8000-000000000001/nur-mit-konto.webp');

-- ── Ohne Anmeldung: nichts ──────────────────────────────────────────────────
select pg_temp.anonym();
select pg_temp.pruefe((select count(*) from storage.objects where bucket_id = 'exercise-images') = 0, 'anon zählt keine Bilder auf');
select pg_temp.pruefe((select count(*) from public.exercises) = 0, 'anon liest keine Übung');
select pg_temp.pruefe((select count(*) from public.exercise_favorites) = 0, 'anon liest keine Favoriten');
select pg_temp.pruefe((select count(*) from public.trainings) = 0, 'anon liest kein Training');
select pg_temp.pruefe((select count(*) from public.training_exercises) = 0, 'anon liest keine Fassung');
select pg_temp.pruefe((select count(*) from public.training_gruppen) = 0, 'anon liest keine Gruppe');
select pg_temp.pruefe((select count(*) from public.training_exercise_gruppen) = 0, 'anon liest keinen Durchlauf');
select pg_temp.pruefe((select count(*) from public.training_varianten) = 0, 'anon liest keine Variante');

-- Die Startseite: genau die sechs, in der Reihenfolge der Anzeige.
select pg_temp.pruefe(
  (select array_agg(slug) from public.startseite_beispiele()) = array[
    'freies-kleinfeldspiel', 'autorennen', 'dribbling-1-1-frontal-auf-ein-tor',
    'passen-und-ballkontrolle-tigerball-durch-das-tor', 'torabschluss-zielschuss', 'penalty-koenig-in'],
  'startseite_beispiele liefert die sechs in fester Reihenfolge');
select pg_temp.pruefe((select count(*) from public.startseite_beispiele()) = 6, 'genau sechs Zeilen');
select pg_temp.pruefe(
  (select bool_and(source = 'manual' and visibility = 'public') from public.startseite_beispiele()),
  'nur Manual-Übungen');
select pg_temp.zurueck();

-- ── Angemeldet: wie bisher ──────────────────────────────────────────────────
-- A sieht sein Training samt Fassung, Variante (erste Variante entsteht per
-- Trigger) und die Community-Übungen, auch die verwaiste.
select pg_temp.als('69690000-0000-4000-8000-000000000001');
select pg_temp.pruefe((select count(*) from public.trainings where id = '69690000-0000-4000-8000-0000000000a1') = 1, 'Eigentümer liest sein Training');
select pg_temp.pruefe((select count(*) from public.training_exercises where training_id = '69690000-0000-4000-8000-0000000000a1') = 1, 'Eigentümer liest die Fassung');
select pg_temp.pruefe((select count(*) from public.training_varianten where training_id = '69690000-0000-4000-8000-0000000000a1') >= 1, 'Eigentümer liest die Variante');
select pg_temp.pruefe((select count(*) from public.exercises where slug = 'nur-mit-konto-verwaist') = 1, 'Community-Übung eines gelöschten Kontos bleibt lesbar (PC 3)');
select pg_temp.pruefe((select count(*) from public.exercises where source = 'manual') >= 7, 'Manual-Übungen mit Konto lesbar');
select pg_temp.pruefe((select count(*) from storage.objects where bucket_id = 'exercise-images') >= 1, 'Bilder mit Konto auflistbar');
select pg_temp.zurueck();

-- B sieht den fremden Entwurf nicht, ein Community-Training dagegen schon.
select pg_temp.als('69690000-0000-4000-8000-000000000002');
select pg_temp.pruefe((select count(*) from public.trainings where id = '69690000-0000-4000-8000-0000000000a1') = 0, 'fremder Entwurf unsichtbar');
select pg_temp.zurueck();

-- Ein Community-Training (die Gates sind für diese Lese-Probe unter
-- `replica` ausgesetzt; geprüft wird nur, wer lesen darf).
set local session_replication_role = replica;
update public.trainings set visibility = 'public' where id = '69690000-0000-4000-8000-0000000000a1';
set local session_replication_role = origin;

select pg_temp.als('69690000-0000-4000-8000-000000000002');
select pg_temp.pruefe((select count(*) from public.trainings where id = '69690000-0000-4000-8000-0000000000a1') = 1, 'Community-Training für jedes Konto lesbar');
select pg_temp.pruefe((select count(*) from public.training_exercises where training_id = '69690000-0000-4000-8000-0000000000a1') = 1, 'seine Fassung ebenso');
select pg_temp.zurueck();

select pg_temp.anonym();
select pg_temp.pruefe((select count(*) from public.trainings) = 0, 'auch das Community-Training nicht ohne Anmeldung');
select pg_temp.pruefe((select count(*) from public.training_exercises) = 0, 'und seine Fassung nicht');
select pg_temp.zurueck();

-- ── Rechte der Funktion ────────────────────────────────────────────────────
select pg_temp.pruefe(has_function_privilege('anon', 'public.startseite_beispiele()', 'execute'), 'anon darf die Beispiele lesen');
-- Was anon nur fürs öffentliche Lesen ausführen durfte, ist zu (Nachzug).
select pg_temp.pruefe(not has_function_privilege('anon', f, 'execute'), 'anon führt ' || f || ' nicht aus')
from unnest(array['public.anzeige_name(uuid)', 'public.urheber(public.trainings)',
                  'public.training_fehlende_bedingungen(uuid)', 'public.training_pruefe_oeffentlich(uuid)']) f;
select pg_temp.pruefe(has_function_privilege('authenticated', f, 'execute'), 'authenticated führt ' || f || ' aus')
from unnest(array['public.anzeige_name(uuid)', 'public.urheber(public.trainings)',
                  'public.training_fehlende_bedingungen(uuid)', 'public.training_pruefe_oeffentlich(uuid)']) f;
select pg_temp.pruefe(
  (select prosecdef and proconfig @> array['search_path=public, pg_temp'] from pg_proc where proname = 'startseite_beispiele'),
  'SECURITY DEFINER mit festem search_path');

\o
\echo 'nur_mit_konto.sql: ok'
rollback;
