-- Aushelfen mit einem Schritt (#691), Migration 20261124100000_aushelfen.sql:
-- - Rechte: nur als Mitglied des Teams (Nicht-Mitglied, ohne Anmeldung:
--   abgewiesen); kein Ausführungsrecht für anon
-- - Frist wie das Zusagen: anstehend geht und ist dabei; begonnen und
--   ausgefallen werden abgewiesen
-- - wer schon eingeladen ist, ändert nichts (auch eine Absage bleibt)
-- - Serientermin: weicht danach bei den Eingeladenen ab, sonst nichts
-- - Regressionsschutz: `termin_trainer_aendern` lädt an einem vergangenen
--   Termin weiterhin ein (#518 PO 7, Festlegen vergangener Termine)
-- Alles in einer Transaktion mit rollback; hinterlässt nichts.

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

create function pg_temp.zurueck() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.fehler(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

create function pg_temp.erwarte(p_sql text, p_marker text) returns void
language plpgsql as $$
declare
  f text := pg_temp.fehler(p_sql);
begin
  if f is null or position(p_marker in f) = 0 then
    raise exception 'erwartet % bei «%», bekommen: %', p_marker, p_sql, coalesce(f, 'kein Fehler');
  end if;
end $$;

create function pg_temp.pruefe(p_ok boolean, p_text text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception '#691: %', p_text; end if;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('a'), ('b'), ('fremd'), ('v'), ('t1'), ('t2'),
  ('kommend'), ('begonnen'), ('aus'), ('serie'), ('stermin'), ('vorbei');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@aushelfen.test', now() from ids where name in ('a', 'b', 'fremd');

insert into vereine (id, name) values (pg_temp.id('v'), 'Aushelfen-Verein');
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Ea', pg_temp.id('v')), (pg_temp.id('t2'), 'Eb', pg_temp.id('v'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t1'), pg_temp.id('b')),
  (pg_temp.id('t2'), pg_temp.id('fremd'));

insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('kommend'), pg_temp.id('t1'), current_date + 7, '18:00', '19:30'),
  (pg_temp.id('begonnen'), pg_temp.id('t1'), current_date - 1, '18:00', '19:30'),
  (pg_temp.id('vorbei'), pg_temp.id('t1'), current_date - 3, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende, ausgefallen, ausfall_grund) values
  (pg_temp.id('aus'), pg_temp.id('t1'), current_date + 8, '18:00', '19:30', true, 'Halle belegt');
insert into termin_serien (id, team_id, wochentage, beginn_datum, end_datum, beginn, ende) values
  (pg_temp.id('serie'), pg_temp.id('t1'), array[extract(isodow from current_date + 14)::smallint],
   current_date + 14, current_date + 14, '18:00', '19:30');
insert into training_termine (id, team_id, serie_id, serien_tag, datum, beginn, ende) values
  (pg_temp.id('stermin'), pg_temp.id('t1'), pg_temp.id('serie'), current_date + 14, current_date + 14, '18:00', '19:30');
-- b ist am kommenden Termin eingeladen und hat abgesagt.
insert into termin_trainer (termin_id, user_id, abgesagt_am) values
  (pg_temp.id('kommend'), pg_temp.id('b'), now() - interval '1 day');

-- ── Rechte ──────────────────────────────────────────────────────────────────

select pg_temp.pruefe(not has_function_privilege('anon', 'termin_aushelfen(uuid)', 'execute'),
  'anon darf termin_aushelfen nicht ausführen');
select pg_temp.pruefe(has_function_privilege('authenticated', 'termin_aushelfen(uuid)', 'execute'),
  'angemeldete Mitglieder dürfen aushelfen');
select pg_temp.erwarte(format('select termin_aushelfen(%L)', pg_temp.id('kommend')), 'not authenticated');
select pg_temp.als(pg_temp.id('fremd'));
select pg_temp.erwarte(format('select termin_aushelfen(%L)', pg_temp.id('kommend')), 'TERMIN_NICHT_GEFUNDEN');
select pg_temp.zurueck();

-- ── Frist ───────────────────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(termin_aushelfen(pg_temp.id('kommend')) ->> 'team' = pg_temp.id('t1')::text,
  'anstehend: Aushelfen geht');
select pg_temp.erwarte(format('select termin_aushelfen(%L)', pg_temp.id('begonnen')), 'AUSHELFEN_BEGONNEN');
select pg_temp.erwarte(format('select termin_aushelfen(%L)', pg_temp.id('aus')), 'AUSHELFEN_AUSGEFALLEN');
select pg_temp.zurueck();
select pg_temp.pruefe(exists (select 1 from termin_trainer where termin_id = pg_temp.id('kommend')
                               and user_id = pg_temp.id('a') and abgesagt_am is null and not verantwortlich),
  'wer aushilft, ist eingeladen und dabei, nicht verantwortlich');
select pg_temp.pruefe(not exists (select 1 from termin_trainer where termin_id in (pg_temp.id('begonnen'), pg_temp.id('aus'))),
  'abgewiesen: keine Einladung');

-- Nochmals: keine zweite Zeile, kein Fehler.
select pg_temp.als(pg_temp.id('a'));
select termin_aushelfen(pg_temp.id('kommend'));
select pg_temp.zurueck();
select pg_temp.pruefe((select count(*) from termin_trainer where termin_id = pg_temp.id('kommend') and user_id = pg_temp.id('a')) = 1,
  'wiederholt: eine Einladung');

-- Schon eingeladen und abgesagt: Aushelfen ändert die Absage nicht.
select pg_temp.als(pg_temp.id('b'));
select termin_aushelfen(pg_temp.id('kommend'));
select pg_temp.zurueck();
select pg_temp.pruefe((select abgesagt_am is not null from termin_trainer where termin_id = pg_temp.id('kommend') and user_id = pg_temp.id('b')),
  'schon eingeladen: die Absage bleibt');

-- ── Serie ───────────────────────────────────────────────────────────────────

select pg_temp.pruefe(not (select eingeladene_abweichend from training_termine where id = pg_temp.id('stermin')),
  'Serientermin folgt vorher der Serie');
select pg_temp.als(pg_temp.id('a'));
select termin_aushelfen(pg_temp.id('stermin'));
select pg_temp.zurueck();
select pg_temp.pruefe((select eingeladene_abweichend and not verantwortung_abweichend from training_termine where id = pg_temp.id('stermin')),
  'Serientermin weicht nach dem Aushelfen bei den Eingeladenen ab, nicht bei der Verantwortung');

-- ── Regression: Einladen über den Termin bleibt auch vergangen möglich ──────

select pg_temp.als(pg_temp.id('a'));
select termin_trainer_aendern(pg_temp.id('vorbei'), array[pg_temp.id('a'), pg_temp.id('b')]);
select pg_temp.zurueck();
select pg_temp.pruefe((select count(*) from termin_trainer where termin_id = pg_temp.id('vorbei')) = 2,
  'termin_trainer_aendern lädt an einem vergangenen Termin weiter ein');

\o
select '✓ aushelfen.sql' as ergebnis;
rollback;
