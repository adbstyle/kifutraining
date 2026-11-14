-- Vereinsverwaltung führt Teams und Trainer:innen (Story 5 #581; Architekturplan
-- Vereine §3.6, §4.1–§4.4, §6.7 Testfälle 3 zweiter Teil, 4 Teil Teams, 13, 14,
-- 16, 27, 31). Was psql braucht (Altdaten unter `replica`, Trigger-Netz direkt,
-- Rollenwechsel wie PostgREST); die Rennen stehen in rennen.sql.
-- - Gefallen: create_team, loese_team_auf, entferne_team_mitglied mit
--   Teamnamen, team_aufloesen_wenn_leer, Policy teams_update
-- - `teams` per PostgREST-Rolle nur lesbar (AK 26)
-- - Recht je verein_*-RPC: Mitglied ohne Verwaltung, Verwaltung eines anderen
--   Vereins, Konto ohne Verein, unbekanntes Team → VEREIN_NICHT_GEFUNDEN
-- - Review Focus 4: ein Konto mit Verwaltung UND Mitgliedschaft hat im Team
--   nicht mehr Rechte als ein Mitglied, verein_* wirkt nur über die Verwaltung
-- - verein_ansicht (AK 1–9) und verein_team_ansicht (AK 10, 25)
-- - Anlegen ohne Mitgliedschaft (AK 17), 30 Teams (AK 18, PC 7), Teamname je
--   Verein eindeutig (AK 19–22, PC 6), Vereinsname (AK 23)
-- - Aufnehmen und Bremse über alle fünf Suchwege, `anderer_verein` (AK 13, 30,
--   Testfall 31)
-- - Beitreten, Entfernen, Austritt des letzten Mitglieds, Konto löschen: das
--   Team bleibt samt Inhalten, Links, Abos, Abholadresse (AK 12, 14, 16, 28,
--   29, PC 3, PC 4, Testfall 14)
-- - Verwaltung aufnehmen, entfernen, austreten, letzte Person (AK 30–34,
--   Testfall 16)
-- - Auflösen (AK 24, PC 1, PC 2, Testfall 13) und Herausnehmen durch die
--   Verwaltung (#579 AK 11, 17)
-- - Kader und Serie am Termin weiter für Mitglieder (Sperrordnung umgestellt)
-- Alles in einer Transaktion mit rollback; hinterlässt nichts.

\set ON_ERROR_STOP on
\o /dev/null

begin;
set local statement_timeout = '60s';

create function pg_temp.als(p_user uuid, p_mehr jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_user, 'role', 'authenticated') || p_mehr)::text, true);
  perform set_config('role', 'authenticated', true);
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
  if p_ok is not true then raise exception 'Story 5: %', p_text; end if;
end $$;

-- Schlüssel eines jsonb-Objekts, sortiert.
create function pg_temp.schluessel(p jsonb) returns text[]
language sql immutable as $$ select array(select k from jsonb_object_keys(p) k order by k) $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('verw'), ('verw2'), ('zverw'), ('a'), ('b'), ('c'), ('d'), ('e'), ('wverw'), ('ohne'),
  ('unbest'), ('frei'), ('frei2'),
  ('v'), ('w'), ('t1'), ('t2'), ('t3'), ('t4'), ('t5'), ('tw'),
  ('s1'), ('s2'), ('s3'), ('sb'), ('s5'), ('k1'), ('k5'), ('serie1'), ('tr1'), ('tr2'), ('sp1'), ('tr_serie'), ('tr_t2'),
  ('tr_t2_vorbei'), ('tr1_vorbei'), ('k2'), ('tr_t5'), ('training1'), ('training2'), ('alt1'), ('alt2'), ('w32');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
create function pg_temp.mail(p text) returns text language sql stable as $$ select p || '@verwaltung.test' $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, pg_temp.mail(name), now() from ids
 where name in ('verw', 'verw2', 'zverw', 'a', 'b', 'c', 'd', 'e', 'wverw', 'ohne', 'frei', 'frei2');
insert into auth.users (id, email) values (pg_temp.id('unbest'), pg_temp.mail('unbest'));   -- unbestätigt
insert into profiles (user_id, display_name) values (pg_temp.id('verw2'), 'Vera Zwei'), (pg_temp.id('a'), 'Anna');

-- Verein V: Verwaltung verw (ohne Team), verw2 (Verwaltung und Mitglied in T1),
-- zverw (Verwaltung und Mitglied in T3, für die Bremse). T1 (a, verw2), T2 (b),
-- T3 (zverw), T4 (d), T5 (e). Verein W: TW (c), Verwaltung wverw.
insert into vereine (id, name) values (pg_temp.id('v'), 'Verwaltung-Verein'), (pg_temp.id('w'), 'Anderer Verein');
insert into verein_verwaltung (verein_id, user_id) values
  (pg_temp.id('v'), pg_temp.id('verw')), (pg_temp.id('v'), pg_temp.id('verw2')), (pg_temp.id('v'), pg_temp.id('zverw')),
  (pg_temp.id('w'), pg_temp.id('wverw'));
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Team Eins', pg_temp.id('v')), (pg_temp.id('t2'), 'Team Zwei', pg_temp.id('v')),
  (pg_temp.id('t3'), 'Team Drei', pg_temp.id('v')), (pg_temp.id('t4'), 'Team Vier', pg_temp.id('v')),
  (pg_temp.id('t5'), 'Jüngste', pg_temp.id('v')), (pg_temp.id('tw'), 'Team W', pg_temp.id('w'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t1'), pg_temp.id('verw2')), (pg_temp.id('t2'), pg_temp.id('b')),
  (pg_temp.id('t3'), pg_temp.id('zverw')), (pg_temp.id('t4'), pg_temp.id('d')), (pg_temp.id('t5'), pg_temp.id('e')),
  (pg_temp.id('tw'), pg_temp.id('c'));

-- Spieler:innen (unter replica samt team_id/probe_seit wie die Trigger):
-- s1 nur T1, s2 schnuppert in T1, s3 in T1 und T2, sb nur T2, s5 nur T5.
set local session_replication_role = replica;
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang, js_nummer, probe_seit) values
  (pg_temp.id('s1'), pg_temp.id('t1'), pg_temp.id('v'), 'Sara', 'Eins', 2015, '9876543', null),
  (pg_temp.id('s2'), pg_temp.id('t1'), pg_temp.id('v'), 'Sven', 'Probe', 2015, null, now()),
  (pg_temp.id('s3'), pg_temp.id('t1'), pg_temp.id('v'), 'Sina', 'Beide', 2014, null, null),
  (pg_temp.id('sb'), pg_temp.id('t2'), pg_temp.id('v'), 'Ben', 'Zwei', 2014, null, null),
  (pg_temp.id('s5'), pg_temp.id('t5'), pg_temp.id('v'), 'Fünf', 'Klein', 2018, null, null);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values
  (pg_temp.id('t1'), pg_temp.id('s1'), pg_temp.id('v'), null),
  (pg_temp.id('t1'), pg_temp.id('s2'), pg_temp.id('v'), now()),
  (pg_temp.id('t1'), pg_temp.id('s3'), pg_temp.id('v'), null),
  (pg_temp.id('t2'), pg_temp.id('s3'), pg_temp.id('v'), null),
  (pg_temp.id('t2'), pg_temp.id('sb'), pg_temp.id('v'), null),
  (pg_temp.id('t5'), pg_temp.id('s5'), pg_temp.id('v'), null);
-- Vergangener Termin von T2 mit Abmeldung von sb (Herausnehmen hält ihn fest).
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tr_t2_vorbei'), pg_temp.id('t2'), current_date - 1, '18:00', '19:30');
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (pg_temp.id('tr_t2_vorbei'), pg_temp.id('sb'), pg_temp.id('t2'), false);
set local session_replication_role = origin;
insert into team_probetraining (team_id, anzahl) values (pg_temp.id('t1'), 3);

-- Inhalte von T1 (Auflösen): zwei Trainings (eines als Termin-Training),
-- Serie mit Termin, drei Trainingstermine (einer vorbei, mit Anwesenheit),
-- ein Spiel, Kader, Abmeldung.
insert into trainings (id, name, altersstufe, stufen, team_id) values
  (pg_temp.id('training1'), 'Team-Training', 'kinderfussball', '{F}', pg_temp.id('t1'));
insert into trainings (id, name, altersstufe, stufen, team_id, termin_training) values
  (pg_temp.id('training2'), 'Termin-Training', 'kinderfussball', '{F}', pg_temp.id('t1'), true);
insert into training_exercises (training_id, trainingsteil, position, name, altersstufe, aufbau, bild_url) values
  (pg_temp.id('training1'), 'auffangen', 1, 'Mit Bild', 'kinderfussball', 'Aufbau', 'https://bild.test/eins.webp');
insert into termin_serien (id, team_id, wochentage, beginn_datum, end_datum, beginn, ende) values
  (pg_temp.id('serie1'), pg_temp.id('t1'), array[extract(isodow from current_date + 14)::smallint],
   current_date + 14, current_date + 14, '18:00', '19:30');
insert into training_termine (id, team_id, serie_id, serien_tag, datum, beginn, ende) values
  (pg_temp.id('tr_serie'), pg_temp.id('t1'), pg_temp.id('serie1'), current_date + 14, current_date + 14, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tr1'), pg_temp.id('t1'), current_date + 7, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (pg_temp.id('sp1'), pg_temp.id('t1'), current_date + 9, '10:00', '12:00', 'spiel', 'Match');
insert into kader (id, team_id, name) values (pg_temp.id('k1'), pg_temp.id('t1'), 'Kader Eins');
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (pg_temp.id('tr1'), pg_temp.id('s1'), pg_temp.id('t1'), false);
-- Vergangener Termin von T1 mit festgehaltener Anwesenheit (PC 2).
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tr1_vorbei'), pg_temp.id('t1'), current_date - 2, '18:00', '19:30');
insert into termin_eingefroren (termin_id, team_id) values (pg_temp.id('tr1_vorbei'), pg_temp.id('t1'))
  on conflict do nothing;   -- ein vergangener Termin wird schon beim Anlegen festgehalten
insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet) values
  (pg_temp.id('tr1_vorbei'), pg_temp.id('t1'), pg_temp.id('s1'), false) on conflict do nothing;
-- T2 für Kader und Serie am Termin; T5 mit Link-Abo, Abholadresse, Termin, Kader.
insert into kader (id, team_id, name) values (pg_temp.id('k2'), pg_temp.id('t2'), 'Kader Zwei');
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tr_t2'), pg_temp.id('t2'), current_date + 7, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tr_t5'), pg_temp.id('t5'), current_date + 7, '18:00', '19:30');
insert into kader (id, team_id, name) values (pg_temp.id('k5'), pg_temp.id('t5'), 'Kader Fünf');
insert into spieler_abos (spieler_id) values (pg_temp.id('s5'));
insert into team_abholung (team_id, aktiv) values (pg_temp.id('t5'), true);

-- ── Gefallen und Tabellenrechte ─────────────────────────────────────────────

select pg_temp.pruefe(to_regprocedure('create_team(text)') is null, 'create_team besteht noch');
select pg_temp.pruefe(to_regprocedure('loese_team_auf(uuid,text)') is null, 'loese_team_auf besteht noch');
select pg_temp.pruefe(to_regprocedure('entferne_team_mitglied(uuid,uuid,text)') is null,
                      'entferne_team_mitglied mit Teamnamen besteht noch');
select pg_temp.pruefe(to_regprocedure('entferne_team_mitglied(uuid,uuid)') is not null, 'entferne_team_mitglied(uuid,uuid) fehlt');
select pg_temp.pruefe(to_regprocedure('team_aufloesen_wenn_leer()') is null, 'team_aufloesen_wenn_leer besteht noch');
select pg_temp.pruefe(not exists (select 1 from pg_trigger where tgname = 'team_aufloesen_wenn_leer'), 'Trigger besteht noch');
select pg_temp.pruefe(not exists (select 1 from pg_policy where polrelid = 'teams'::regclass and polcmd <> 'r'),
                      'Schreib-Policy auf teams');

-- AK 26: teams nur lesen, auch für ein Konto mit beiden Rollen.
select pg_temp.als(pg_temp.id('verw2'));
select pg_temp.erwarte(format($$update teams set name = 'Direkt' where id = %L$$, pg_temp.id('t1')), '42501');
select pg_temp.erwarte(format($$update teams set verein_id = %L where id = %L$$, pg_temp.id('w'), pg_temp.id('t1')), '42501');
select pg_temp.erwarte(format($$insert into teams (name, verein_id) values ('Direkt', %L)$$, pg_temp.id('v')), '42501');
select pg_temp.erwarte(format($$delete from teams where id = %L$$, pg_temp.id('t1')), '42501');
select pg_temp.erwarte(format($$insert into team_members (team_id, user_id) values (%L, %L)$$, pg_temp.id('t2'), pg_temp.id('verw2')),
                       '42501');
reset role;
select pg_temp.pruefe((select name from teams where id = pg_temp.id('t1')) = 'Team Eins', 'Team direkt geändert');

-- ── Recht je verein_*-RPC ───────────────────────────────────────────────────

do $$
declare
  aufrufe text[] := array[
    format('select verein_team_ansicht(%L)', pg_temp.id('t1')),
    format($s$select verein_team_anlegen(%L, 'Recht')$s$, pg_temp.id('v')),
    format($s$select verein_team_umbenennen(%L, 'Recht')$s$, pg_temp.id('t1')),
    format($s$select verein_umbenennen(%L, 'Recht')$s$, pg_temp.id('v')),
    format($s$select verein_team_aufloesen(%L, 'Team Eins')$s$, pg_temp.id('t1')),
    format('select verein_finde_person(%L, %L)', pg_temp.id('v'), pg_temp.mail('frei')),
    format('select verein_finde_person(%L, %L, %L)', pg_temp.id('v'), pg_temp.mail('frei'), pg_temp.id('t1')),
    format('select verein_team_aufnehmen(%L, %L)', pg_temp.id('t1'), pg_temp.mail('frei')),
    format('select verein_team_beitreten(%L)', pg_temp.id('t1')),
    format('select verein_team_mitglied_entfernen(%L, %L)', pg_temp.id('t1'), pg_temp.id('a')),
    format('select verein_verwaltung_aufnehmen(%L, %L)', pg_temp.id('v'), pg_temp.mail('frei')),
    format('select verein_verwaltung_entfernen(%L, %L)', pg_temp.id('v'), pg_temp.id('verw')),
    format('select verein_spieler_aus_team_nehmen(%L, %L)', pg_temp.id('t1'), pg_temp.id('s1'))];
  wer text;
  x text;
begin
  -- Mitglied ohne Verwaltung, Verwaltung eines anderen Vereins, Konto ohne Verein.
  foreach wer in array array['a', 'wverw', 'ohne'] loop
    perform pg_temp.als(pg_temp.id(wer));
    foreach x in array aufrufe loop
      perform pg_temp.erwarte(x, 'VEREIN_NICHT_GEFUNDEN');
    end loop;
    reset role;
  end loop;
  -- Ansicht: Mitglieder des Vereins ja, andere nicht.
  foreach wer in array array['wverw', 'ohne'] loop
    perform pg_temp.als(pg_temp.id(wer));
    perform pg_temp.erwarte(format('select verein_ansicht(%L)', pg_temp.id('v')), 'VEREIN_NICHT_GEFUNDEN');
    reset role;
  end loop;
  -- Unbekanntes Team, Team eines anderen Vereins: für die Verwaltung wie fremd.
  perform pg_temp.als(pg_temp.id('verw'));
  perform pg_temp.erwarte(format('select verein_team_ansicht(%L)', gen_random_uuid()), 'VEREIN_NICHT_GEFUNDEN');
  perform pg_temp.erwarte(format('select verein_team_ansicht(%L)', pg_temp.id('tw')), 'VEREIN_NICHT_GEFUNDEN');
  perform pg_temp.erwarte(format('select verein_team_beitreten(%L)', pg_temp.id('tw')), 'VEREIN_NICHT_GEFUNDEN');
  perform pg_temp.erwarte(format('select verein_finde_person(%L, %L, %L)', pg_temp.id('v'), pg_temp.mail('frei'), pg_temp.id('tw')),
                          'VEREIN_NICHT_GEFUNDEN');
  reset role;
  perform pg_temp.pruefe(not exists (select 1 from trainer_suchversuche
                                      where user_id in (pg_temp.id('a'), pg_temp.id('wverw'), pg_temp.id('ohne'), pg_temp.id('verw'))),
                         'abgewiesene Aufrufe zählen in der Bremse');
end $$;

-- Review Focus 4: verw2 (Verwaltung, Mitglied nur in T1) hat an T2 keine
-- Team-Rechte; sieht per RLS nur T1.
select pg_temp.als(pg_temp.id('verw2'));
do $$
declare
  x text;
begin
  foreach x in array array[
    format('select finde_trainer(%L, %L)', pg_temp.id('t2'), pg_temp.mail('frei')),
    format('select add_team_member(%L, %L)', pg_temp.id('t2'), pg_temp.mail('frei')),
    format('select team_mitglieder(%L)', pg_temp.id('t2')),
    format('select entferne_team_mitglied(%L, %L)', pg_temp.id('t2'), pg_temp.id('b'))] loop
    perform pg_temp.erwarte(x, 'not a member');
  end loop;
  perform pg_temp.erwarte(format('select spieler_aus_team_nehmen(%L, %L, %L)', pg_temp.id('t2'), pg_temp.id('sb'), 'x'),
                          'SPIELER_NICHT_GEFUNDEN');
  perform pg_temp.erwarte(format($s$select termin_kader_setzen(%L, '{}')$s$, pg_temp.id('tr_t2')), 'TERMIN_NICHT_GEFUNDEN');
  perform pg_temp.pruefe((select array_agg(id) from teams) = array[pg_temp.id('t1')], 'verw2 sieht andere Teams');
  perform pg_temp.pruefe(not exists (select 1 from spieler where id = pg_temp.id('sb')), 'verw2 sieht Spieler:innen von T2');
end $$;
reset role;
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(not exists (select 1 from teams), 'Verwaltung ohne Team sieht Teams per RLS');
reset role;

-- ── verein_ansicht (AK 1–9) ─────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('a'));
do $$
declare
  v jsonb := verein_ansicht(pg_temp.id('v'));
  x jsonb;
begin
  perform pg_temp.pruefe(pg_temp.schluessel(v) = array['name', 'teams', 'verwaltung'], 'Ansicht Mitglied: Schlüssel ' || v::text);
  perform pg_temp.pruefe(v ->> 'name' = 'Verwaltung-Verein', 'Vereinsname');
  -- Verwaltung: Anzeigename oder null, sortiert (null zuletzt), nie E-Mail.
  perform pg_temp.pruefe(jsonb_array_length(v -> 'verwaltung') = 3
                         and v -> 'verwaltung' -> 0 = '{"anzeige_name": "Vera Zwei", "ich": false}'
                         and v -> 'verwaltung' -> 1 = '{"anzeige_name": null, "ich": false}'
                         and v -> 'verwaltung' -> 2 = '{"anzeige_name": null, "ich": false}',
                         'Verwaltung für Mitglied: ' || (v -> 'verwaltung')::text);
  -- Teams: nur id, name, ist_mitglied, nach Namen.
  perform pg_temp.pruefe(jsonb_array_length(v -> 'teams') = 5, 'Teams für Mitglied');
  for x in select * from jsonb_array_elements(v -> 'teams') loop
    perform pg_temp.pruefe(pg_temp.schluessel(x) = array['id', 'ist_mitglied', 'name'], 'Team für Mitglied: ' || x::text);
    perform pg_temp.pruefe((x ->> 'ist_mitglied')::boolean = (x ->> 'id' = pg_temp.id('t1')::text), 'ist_mitglied: ' || x::text);
  end loop;
  perform pg_temp.pruefe(array(select e ->> 'name' from jsonb_array_elements(v -> 'teams') e)
                         = array['Jüngste', 'Team Drei', 'Team Eins', 'Team Vier', 'Team Zwei'], 'Teams nicht nach Namen');
  perform pg_temp.pruefe(position('@verwaltung.test' in v::text) = 0, 'Mitglied sieht E-Mail');
end $$;
reset role;

select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  v jsonb := verein_ansicht(pg_temp.id('v'));
  t1 jsonb;
  t3 jsonb;
  ich jsonb;
begin
  -- Seit Story 6 mit den Zahlen der Spieler:innen (spielerbestand_verwaltung.sql).
  perform pg_temp.pruefe(pg_temp.schluessel(v) = array['name', 'spieler_ohne_team', 'spieler_zahl', 'teams', 'verwaltung'],
                         'Ansicht Verwaltung: Schlüssel');
  perform pg_temp.pruefe(v -> 'spieler_zahl' = '5' and v -> 'spieler_ohne_team' = '0', 'Ansicht Verwaltung: Zahlen');
  select e into ich from jsonb_array_elements(v -> 'verwaltung') e where (e ->> 'ich')::boolean;
  perform pg_temp.pruefe(ich = jsonb_build_object('anzeige_name', null, 'ich', true, 'user_id', pg_temp.id('verw'),
                                                  'email', pg_temp.mail('verw')), 'eigene Zeile der Verwaltung: ' || coalesce(ich::text, '–'));
  perform pg_temp.pruefe((select count(*) from jsonb_array_elements(v -> 'verwaltung') e where e ? 'email' and e ? 'user_id') = 3,
                         'Verwaltung ohne E-Mail für die Verwaltung');
  select e into t1 from jsonb_array_elements(v -> 'teams') e where e ->> 'id' = pg_temp.id('t1')::text;
  select e into t3 from jsonb_array_elements(v -> 'teams') e where e ->> 'id' = pg_temp.id('t3')::text;
  perform pg_temp.pruefe(pg_temp.schluessel(t1) = array['id', 'ist_mitglied', 'name', 'ohne_mitglied', 'spieler_zahl', 'trainer'],
                         'Team für Verwaltung: ' || t1::text);
  perform pg_temp.pruefe((t1 ->> 'spieler_zahl')::int = 3 and not (t1 ->> 'ist_mitglied')::boolean
                         and not (t1 ->> 'ohne_mitglied')::boolean, 'Team 1 für Verwaltung: ' || t1::text);
  perform pg_temp.pruefe(t1 -> 'trainer' @> jsonb_build_array(
                           jsonb_build_object('user_id', pg_temp.id('verw2'), 'anzeige_name', 'Vera Zwei',
                                              'email', pg_temp.mail('verw2'), 'ist_verwaltung', true),
                           jsonb_build_object('user_id', pg_temp.id('a'), 'anzeige_name', 'Anna',
                                              'email', pg_temp.mail('a'), 'ist_verwaltung', false))
                         and jsonb_array_length(t1 -> 'trainer') = 2, 'Trainer:innen von Team 1: ' || (t1 -> 'trainer')::text);
  perform pg_temp.pruefe(not (t3 ->> 'ohne_mitglied')::boolean, 'T3 hat zverw');
end $$;
reset role;

-- ── verein_team_ansicht (AK 10, 25) ─────────────────────────────────────────

select set_config('test.token', (select link_token from spieler where id = pg_temp.id('s1')), true);
select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  v jsonb := verein_team_ansicht(pg_temp.id('t1'));
  s jsonb;
  x jsonb;
begin
  perform pg_temp.pruefe(pg_temp.schluessel(v) = array['aufloesung', 'ich_mitglied', 'id', 'name', 'spieler', 'spieler_zahl', 'trainer'],
                         'Teamansicht: Schlüssel ' || pg_temp.schluessel(v)::text);
  perform pg_temp.pruefe(v ->> 'name' = 'Team Eins' and (v ->> 'spieler_zahl')::int = 3 and not (v ->> 'ich_mitglied')::boolean,
                         'Teamansicht: Kopf');
  perform pg_temp.pruefe(v -> 'aufloesung' = '{"trainings": 1, "termine": 3, "spiele": 1, "kader": 1}',
                         'Auflösungszahlen: ' || (v -> 'aufloesung')::text);
  for x in select * from jsonb_array_elements(v -> 'trainer') loop
    perform pg_temp.pruefe(pg_temp.schluessel(x) = array['anzeige_name', 'email', 'ich', 'ist_verwaltung', 'user_id'],
                           'Trainer:in: ' || x::text);
  end loop;
  perform pg_temp.pruefe(jsonb_array_length(v -> 'trainer') = 2, 'zwei Trainer:innen');
  perform pg_temp.pruefe(jsonb_array_length(v -> 'spieler') = 3, 'drei Spieler:innen');
  for x in select * from jsonb_array_elements(v -> 'spieler') loop
    perform pg_temp.pruefe(pg_temp.schluessel(x) = array['id', 'jahrgang', 'nachname', 'schnuppert', 'teams', 'vorname'],
                           'Spieler:in: ' || x::text);
  end loop;
  select e into s from jsonb_array_elements(v -> 'spieler') e where e ->> 'id' = pg_temp.id('s3')::text;
  perform pg_temp.pruefe(s -> 'teams' = jsonb_build_array(jsonb_build_object('id', pg_temp.id('t1'), 'name', 'Team Eins'),
                                                         jsonb_build_object('id', pg_temp.id('t2'), 'name', 'Team Zwei'))
                         and not (s ->> 'schnuppert')::boolean, 'Teams von s3: ' || s::text);
  select e into s from jsonb_array_elements(v -> 'spieler') e where e ->> 'id' = pg_temp.id('s2')::text;
  perform pg_temp.pruefe((s ->> 'schnuppert')::boolean, 's2 schnuppert');
  -- AK 10: keine J+S-Nummer, kein Link, kein Token.
  perform pg_temp.pruefe(position('9876543' in v::text) = 0
                         and position(current_setting('test.token') in v::text) = 0
                         and position('token' in v::text) = 0 and position('js' in v::text) = 0, 'Teamansicht verrät J+S oder Link');
end $$;
reset role;
-- Ein Konto mit beiden Rollen sieht über die Verwaltung dasselbe, `ich` richtig.
select pg_temp.als(pg_temp.id('verw2'));
select pg_temp.pruefe((verein_team_ansicht(pg_temp.id('t1')) ->> 'ich_mitglied')::boolean
                      and (select (e ->> 'ich')::boolean from jsonb_array_elements(verein_team_ansicht(pg_temp.id('t1')) -> 'trainer') e
                            where e ->> 'user_id' = pg_temp.id('verw2')::text), 'ich_mitglied/ich für verw2');
reset role;

-- team_mitglieder (Team-Ort) zeigt die Verwaltung (AK 15).
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(team_mitglieder(pg_temp.id('t1')) @> jsonb_build_array(
                        jsonb_build_object('user_id', pg_temp.id('verw2'), 'ist_verwaltung', true, 'email', pg_temp.mail('verw2')),
                        jsonb_build_object('user_id', pg_temp.id('a'), 'ist_verwaltung', false)), 'team_mitglieder.ist_verwaltung');
reset role;

-- ── Team anlegen, Namen, Grenze 30 (AK 17–22, PC 6, PC 7) ───────────────────

select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  v jsonb := verein_team_anlegen(pg_temp.id('v'), '  Rot ');
  v_rot uuid := (v ->> 'id')::uuid;
begin
  perform pg_temp.pruefe(v ->> 'status' = 'angelegt' and pg_temp.schluessel(v) = array['id', 'status'], 'anlegen: ' || v::text);
  perform set_config('test.rot', v_rot::text, true);
  perform pg_temp.pruefe(meine_vereinslage() -> 'verein' ->> 'ist_teammitglied' = 'false', 'Verwaltung wurde Mitglied');
  foreach v in array array[verein_team_anlegen(pg_temp.id('v'), 'ROT'), verein_team_anlegen(pg_temp.id('v'), ' rot  ')] loop
    perform pg_temp.pruefe(v = '{"status": "abgewiesen", "grund": "name_vergeben", "team": "Rot"}', 'gleicher Schlüssel: ' || v::text);
  end loop;
  -- Bindestrich = Leerzeichen, Apostroph-Varianten gleich, Umlaute verschieden.
  perform pg_temp.pruefe(verein_team_anlegen(pg_temp.id('v'), 'Team-Drei') ->> 'grund' = 'name_vergeben', 'Bindestrich');
  perform pg_temp.pruefe(verein_team_anlegen(pg_temp.id('v'), 'O''Neil') ->> 'status' = 'angelegt', 'O''Neil');
  perform pg_temp.pruefe(verein_team_anlegen(pg_temp.id('v'), 'O’Neil') ->> 'team' = 'O''Neil', 'Apostroph');
  perform pg_temp.pruefe(verein_team_anlegen(pg_temp.id('v'), 'Jungste') ->> 'status' = 'angelegt', 'Umlaut unterscheidet');
  -- Umbenennen: andere Schreibweise des eigenen Namens geht, fremder Schlüssel nicht.
  perform pg_temp.pruefe(verein_team_umbenennen(v_rot, ' ROT ') = '{"status": "umbenannt", "name": "ROT"}', 'eigene Schreibweise');
  perform pg_temp.pruefe(verein_team_umbenennen(pg_temp.id('t1'), 'rot') = '{"status": "abgewiesen", "grund": "name_vergeben", "team": "ROT"}',
                         'fremder Schlüssel');
  perform pg_temp.pruefe(verein_team_umbenennen(pg_temp.id('t1'), 'Team Eins neu') = '{"status": "umbenannt", "name": "Team Eins neu"}',
                         'umbenennen');
  perform pg_temp.pruefe(verein_team_umbenennen(pg_temp.id('t1'), 'Team Eins') ->> 'status' = 'umbenannt', 'zurück');
end $$;
select pg_temp.erwarte(format($$select verein_team_anlegen(%L, '   ')$$, pg_temp.id('v')), 'teams_name_check');
select pg_temp.erwarte(format($$select verein_team_anlegen(%L, %L)$$, pg_temp.id('v'), repeat('x', 61)), 'teams_name_check');
select pg_temp.erwarte(format($$select verein_team_umbenennen(%L, '')$$, pg_temp.id('t1')), 'teams_name_check');
reset role;
select pg_temp.pruefe(not exists (select 1 from team_members where team_id = current_setting('test.rot')::uuid), 'AK 17: Mitgliedschaft');
-- Netz im Trigger (als Eigentümer, ohne RPC): Anlegen und Umbenennen.
select pg_temp.erwarte(format($$insert into teams (name, verein_id) values ('rot', %L)$$, pg_temp.id('v')), 'TEAMNAME_VERGEBEN');
select pg_temp.erwarte(format($$update teams set name = ' Rot' where id = %L$$, pg_temp.id('t2')), 'TEAMNAME_VERGEBEN');
update teams set name = 'rot' where id = current_setting('test.rot')::uuid;   -- eigener Schlüssel
-- Ein gleicher Name in einem anderen Verein ist erlaubt.
insert into teams (name, verein_id) values ('Rot', pg_temp.id('w'));

-- PC 6: Altdubletten bleiben, sind auf eine andere Schreibweise umbenennbar,
-- nicht aber auf einen anderen vergebenen Schlüssel.
set local session_replication_role = replica;
insert into teams (id, name, verein_id) values (pg_temp.id('alt1'), 'Alt Team', pg_temp.id('v')),
                                              (pg_temp.id('alt2'), 'alt team', pg_temp.id('v'));
set local session_replication_role = origin;
select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  v_alt uuid := pg_temp.id('alt2');
begin
  perform pg_temp.pruefe(verein_team_umbenennen(v_alt, 'ALT-TEAM') ->> 'status' = 'umbenannt', 'Altdublette: Schreibweise');
  perform pg_temp.pruefe(verein_team_umbenennen(v_alt, 'Alt Team neu') ->> 'status' = 'umbenannt', 'Altdublette: neuer Schlüssel');
  perform pg_temp.pruefe(verein_team_umbenennen(v_alt, 'alt team') = '{"status": "abgewiesen", "grund": "name_vergeben", "team": "Alt Team"}',
                         'Altdublette: zurück auf vergebenen Schlüssel');
end $$;
reset role;
update teams set name = 'ALT TEAM' where id = pg_temp.id('alt1');   -- Trigger: Schlüssel unverändert

-- AK 18, PC 7: W mit 30 Teams; das 31. scheitert, ein Bestand über 30 (per
-- replica) bleibt umbenennbar.
insert into teams (name, verein_id) select 'W ' || i, pg_temp.id('w') from generate_series(3, 30) i;   -- TW, Rot und 28
select pg_temp.als(pg_temp.id('wverw'));
select pg_temp.erwarte(format($$select verein_team_anlegen(%L, 'W 31')$$, pg_temp.id('w')), 'VEREIN_TEAMS_VOLL');
reset role;
set local session_replication_role = replica;
insert into teams (id, name, verein_id) values (pg_temp.id('w32'), 'W 32', pg_temp.id('w'));
set local session_replication_role = origin;
select pg_temp.als(pg_temp.id('wverw'));
select pg_temp.pruefe(verein_team_umbenennen(pg_temp.id('w32'), 'W zweiunddreissig') ->> 'status' = 'umbenannt',
                      'PC 7: Umbenennen über der Grenze');
reset role;
select pg_temp.pruefe((select count(*) from teams where verein_id = pg_temp.id('w')) = 31, 'W: Bestand über 30');

-- ── Vereinsname (AK 23) ─────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_umbenennen(pg_temp.id('v'), '  FC Neu ') = '{"status": "umbenannt", "name": "FC Neu"}', 'Verein umbenennen');
select pg_temp.erwarte(format($$select verein_umbenennen(%L, '  ')$$, pg_temp.id('v')), 'verein_name');
select pg_temp.erwarte(format($$select verein_umbenennen(%L, %L)$$, pg_temp.id('v'), repeat('x', 61)), 'verein_name');
reset role;
select pg_temp.pruefe((select name from vereine where id = pg_temp.id('v')) = 'FC Neu', 'Vereinsname');

-- ── Aufnehmen (AK 13, 30) ───────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('verw'));
do $$
begin
  perform pg_temp.pruefe(verein_finde_person(pg_temp.id('v'), ' FREI@verwaltung.TEST ', pg_temp.id('t1'))
                         = jsonb_build_object('status', 'gefunden', 'anzeige_name', anzeige_name(pg_temp.id('frei'))), 'finden mit Team');
  perform pg_temp.pruefe(verein_finde_person(pg_temp.id('v'), pg_temp.mail('a'), pg_temp.id('t1')) = '{"status": "bereits_mitglied"}',
                         'bereits_mitglied');
  perform pg_temp.pruefe(verein_finde_person(pg_temp.id('v'), pg_temp.mail('a')) ->> 'status' = 'gefunden', 'Mitglied für die Verwaltung');
  perform pg_temp.pruefe(verein_finde_person(pg_temp.id('v'), pg_temp.mail('verw2')) = '{"status": "bereits_verwaltung"}',
                         'bereits_verwaltung');
  perform pg_temp.pruefe(verein_finde_person(pg_temp.id('v'), pg_temp.mail('c'), pg_temp.id('t1')) = '{"status": "anderer_verein"}',
                         'anderer_verein (Team)');
  perform pg_temp.pruefe(verein_finde_person(pg_temp.id('v'), pg_temp.mail('wverw')) = '{"status": "anderer_verein"}',
                         'anderer_verein (Verwaltung)');
  perform pg_temp.pruefe(verein_finde_person(pg_temp.id('v'), pg_temp.mail('unbest')) = '{"status": "nicht_gefunden"}',
                         'unbestätigtes Konto');
  -- Ins Team: sofort, einmalig, nicht über Vereinsgrenzen.
  perform pg_temp.pruefe(verein_team_aufnehmen(pg_temp.id('t4'), pg_temp.mail('frei'))
                         = jsonb_build_object('status', 'aufgenommen', 'anzeige_name', anzeige_name(pg_temp.id('frei'))), 'ins Team');
  perform pg_temp.pruefe(verein_team_aufnehmen(pg_temp.id('t4'), pg_temp.mail('frei')) = '{"status": "bereits_mitglied"}', 'zweimal ins Team');
  perform pg_temp.pruefe(verein_team_aufnehmen(pg_temp.id('t4'), pg_temp.mail('c')) = '{"status": "anderer_verein"}', 'Team: anderer_verein');
  perform pg_temp.pruefe(verein_team_aufnehmen(pg_temp.id('t4'), pg_temp.mail('niemand')) = '{"status": "nicht_gefunden"}', 'Team: nicht_gefunden');
  -- In die Verwaltung.
  perform pg_temp.pruefe(verein_verwaltung_aufnehmen(pg_temp.id('v'), pg_temp.mail('frei2'))
                         = jsonb_build_object('status', 'aufgenommen', 'anzeige_name', anzeige_name(pg_temp.id('frei2'))), 'in die Verwaltung');
  perform pg_temp.pruefe(verein_verwaltung_aufnehmen(pg_temp.id('v'), pg_temp.mail('frei2')) = '{"status": "bereits_verwaltung"}',
                         'zweimal in die Verwaltung');
  perform pg_temp.pruefe(verein_verwaltung_aufnehmen(pg_temp.id('v'), pg_temp.mail('c')) = '{"status": "anderer_verein"}',
                         'Verwaltung: anderer_verein');
end $$;
reset role;
select pg_temp.pruefe(exists (select 1 from team_members where team_id = pg_temp.id('t4') and user_id = pg_temp.id('frei'))
                      and not exists (select 1 from team_members where user_id = pg_temp.id('c') and team_id <> pg_temp.id('tw'))
                      and exists (select 1 from verein_verwaltung where verein_id = pg_temp.id('v') and user_id = pg_temp.id('frei2'))
                      and not exists (select 1 from verein_verwaltung where user_id = pg_temp.id('c')), 'Aufnahmen falsch');
-- Team-Ort: anderer_verein als Status statt Rohmeldung.
select pg_temp.als(pg_temp.id('d'));
select pg_temp.pruefe(add_team_member(pg_temp.id('t4'), pg_temp.mail('c')) = '{"status": "anderer_verein"}', 'add_team_member: anderer_verein');
select pg_temp.pruefe(finde_trainer(pg_temp.id('t4'), pg_temp.mail('c')) = '{"status": "anderer_verein"}', 'finde_trainer: anderer_verein');
select pg_temp.pruefe(finde_trainer(pg_temp.id('t4'), pg_temp.mail('b')) ->> 'status' = 'gefunden', 'finde_trainer: gefunden');
reset role;

-- Testfall 31: eine Bremse über alle fünf Suchwege; nicht_gefunden und
-- anderer_verein zählen, gefunden und bereits_* nicht.
select pg_temp.als(pg_temp.id('zverw'));
do $$
declare
  t uuid := pg_temp.id('t3');
  v uuid := pg_temp.id('v');
  c text := pg_temp.mail('c');
begin
  perform pg_temp.pruefe(finde_trainer(t, 'nix1@verwaltung.test') ->> 'status' = 'nicht_gefunden', 'Bremse 1');
  perform pg_temp.pruefe(finde_trainer(t, c) ->> 'status' = 'anderer_verein', 'Bremse 2');
  perform pg_temp.pruefe(add_team_member(t, 'nix2@verwaltung.test') ->> 'status' = 'nicht_gefunden', 'Bremse 3');
  perform pg_temp.pruefe(add_team_member(t, c) ->> 'status' = 'anderer_verein', 'Bremse 4');
  perform pg_temp.pruefe(verein_finde_person(v, 'nix3@verwaltung.test') ->> 'status' = 'nicht_gefunden', 'Bremse 5');
  perform pg_temp.pruefe(verein_finde_person(v, c, t) ->> 'status' = 'anderer_verein', 'Bremse 6');
  perform pg_temp.pruefe(verein_team_aufnehmen(t, 'nix4@verwaltung.test') ->> 'status' = 'nicht_gefunden', 'Bremse 7');
  perform pg_temp.pruefe(verein_team_aufnehmen(t, c) ->> 'status' = 'anderer_verein', 'Bremse 8');
  perform pg_temp.pruefe(verein_verwaltung_aufnehmen(v, 'nix5@verwaltung.test') ->> 'status' = 'nicht_gefunden', 'Bremse 9');
  -- Treffer zählen nicht.
  perform pg_temp.pruefe(finde_trainer(t, pg_temp.mail('zverw')) ->> 'status' = 'bereits_mitglied', 'bereits_mitglied');
  perform pg_temp.pruefe(verein_finde_person(v, pg_temp.mail('verw')) ->> 'status' = 'bereits_verwaltung', 'bereits_verwaltung');
  perform pg_temp.pruefe(verein_finde_person(v, pg_temp.mail('frei'), t) ->> 'status' = 'gefunden', 'gefunden');
  perform pg_temp.pruefe(verein_verwaltung_aufnehmen(v, c) ->> 'status' = 'anderer_verein', 'Bremse 10');
  -- Jetzt gebremst, auf jedem Weg.
  perform pg_temp.pruefe(finde_trainer(t, pg_temp.mail('frei')) = '{"status": "gebremst"}', 'gebremst: finde_trainer');
  perform pg_temp.pruefe(add_team_member(t, pg_temp.mail('frei')) = '{"status": "gebremst"}', 'gebremst: add_team_member');
  perform pg_temp.pruefe(verein_finde_person(v, pg_temp.mail('frei')) = '{"status": "gebremst"}', 'gebremst: verein_finde_person');
  perform pg_temp.pruefe(verein_team_aufnehmen(t, pg_temp.mail('frei')) = '{"status": "gebremst"}', 'gebremst: verein_team_aufnehmen');
  perform pg_temp.pruefe(verein_verwaltung_aufnehmen(v, pg_temp.mail('frei')) = '{"status": "gebremst"}',
                         'gebremst: verein_verwaltung_aufnehmen');
  -- Beitreten hat keine Bremse und ist wiederholbar (AK 12).
  perform pg_temp.pruefe(verein_team_beitreten(pg_temp.id('t2')) = '{"status": "beigetreten"}', 'beitreten trotz Bremse');
  perform pg_temp.pruefe(verein_team_beitreten(pg_temp.id('t2')) = '{"status": "beigetreten"}', 'zweimal beitreten');
end $$;
reset role;
select pg_temp.pruefe((select count(*) from trainer_suchversuche where user_id = pg_temp.id('zverw')) = 10, 'zehn Fehlversuche');
select pg_temp.pruefe((select count(*) from team_members where team_id = pg_temp.id('t2') and user_id = pg_temp.id('zverw')) = 1,
                      'beitreten einmalig');

-- ── Entfernen, Austritt, Konto löschen: das Team bleibt (AK 14, 16, 28, 29, PC 3, PC 4) ──

-- AK 16 / PC 4: Ein Mitglied entfernt ein Verwaltungsmitglied aus dem Team;
-- die Verwaltung bleibt.
select pg_temp.als(pg_temp.id('b'));
select pg_temp.pruefe(entferne_team_mitglied(pg_temp.id('t2'), pg_temp.id('zverw')) = '{"status": "entfernt"}', 'Mitglied entfernt Verwaltung');
reset role;
select pg_temp.pruefe(exists (select 1 from verein_verwaltung where user_id = pg_temp.id('zverw'))
                      and not exists (select 1 from team_members where team_id = pg_temp.id('t2') and user_id = pg_temp.id('zverw')),
                      'PC 4: Verwaltung nach dem Entfernen aus dem Team');
-- AK 14: Die Verwaltung entfernt die letzte Trainer:in; T2 bleibt.
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_team_mitglied_entfernen(pg_temp.id('t2'), pg_temp.id('b')) = '{"status": "entfernt"}', 'Verwaltung entfernt');
select pg_temp.pruefe(verein_team_mitglied_entfernen(pg_temp.id('t2'), pg_temp.id('b')) = '{"status": "entfernt"}', 'zweimal entfernen');
select pg_temp.pruefe((verein_ansicht(pg_temp.id('v')) -> 'teams') @> jsonb_build_array(
                        jsonb_build_object('id', pg_temp.id('t2'), 'ohne_mitglied', true)), 'AK 7: ohne_mitglied');
reset role;
-- AK 28: Das letzte Mitglied tritt aus, ohne Namen; T4 hat noch frei → erst
-- frei, dann d.
select pg_temp.als(pg_temp.id('frei'));
select pg_temp.pruefe(entferne_team_mitglied(pg_temp.id('t4'), pg_temp.id('frei')) = '{"status": "entfernt"}', 'Austritt');
reset role;
select pg_temp.als(pg_temp.id('d'));
select pg_temp.pruefe(entferne_team_mitglied(pg_temp.id('t4'), pg_temp.id('d')) = '{"status": "entfernt"}', 'Austritt des letzten Mitglieds');
reset role;
-- AK 29: Konto des letzten Mitglieds von T5 löschen.
delete from auth.users where id = pg_temp.id('e');
select pg_temp.pruefe(exists (select 1 from teams where id = pg_temp.id('t2')) and exists (select 1 from teams where id = pg_temp.id('t4'))
                      and exists (select 1 from teams where id = pg_temp.id('t5')), 'PC 3: Team ohne Mitglied verschwunden');
select pg_temp.pruefe(exists (select 1 from training_termine where id = pg_temp.id('tr_t5'))
                      and exists (select 1 from kader where id = pg_temp.id('k5'))
                      and exists (select 1 from team_spieler where team_id = pg_temp.id('t5') and spieler_id = pg_temp.id('s5'))
                      and exists (select 1 from spieler_abos where spieler_id = pg_temp.id('s5'))
                      and exists (select 1 from team_abholung where team_id = pg_temp.id('t5') and aktiv)
                      and exists (select 1 from training_termine where id = pg_temp.id('tr_t2'))
                      and exists (select 1 from kader where id = pg_temp.id('k2')), 'PC 3: Inhalte, Abo oder Abholadresse weg');

-- ── Verwaltung entfernen und austreten (AK 31–34, PC 4, Testfall 16) ────────

select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_verwaltung_entfernen(pg_temp.id('v'), pg_temp.id('frei2')) = '{"status": "entfernt"}', 'AK 31');
select pg_temp.pruefe(verein_verwaltung_entfernen(pg_temp.id('v'), pg_temp.id('frei2')) = '{"status": "entfernt"}', 'zweimal');
reset role;
-- AK 32, PC 4: verw2 tritt aus der Verwaltung aus und bleibt Trainer:in in T1;
-- danach wirkt verein_* für sie nicht mehr (Review Focus 4).
select pg_temp.als(pg_temp.id('verw2'));
select pg_temp.pruefe(verein_verwaltung_entfernen(pg_temp.id('v'), pg_temp.id('verw2')) = '{"status": "entfernt"}', 'AK 32');
select pg_temp.erwarte(format('select verein_team_ansicht(%L)', pg_temp.id('t1')), 'VEREIN_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select verein_team_beitreten(%L)', pg_temp.id('t1')), 'VEREIN_NICHT_GEFUNDEN');
select pg_temp.pruefe(jsonb_array_length(team_mitglieder(pg_temp.id('t1'))) = 2, 'verw2 nach Austritt nicht mehr im Team');
reset role;
-- AK 33, 34: W hat nur wverw.
select pg_temp.als(pg_temp.id('wverw'));
select pg_temp.pruefe(verein_verwaltung_entfernen(pg_temp.id('w'), pg_temp.id('wverw')) = '{"status": "letzte_verwaltung"}', 'AK 33');
select pg_temp.pruefe(delete_account() = '{"status": "letzte_verwaltung"}', 'AK 34');
reset role;
select pg_temp.pruefe(exists (select 1 from verein_verwaltung where user_id = pg_temp.id('wverw')), 'letzte Verwaltung entfernt');

-- ── Herausnehmen durch die Verwaltung (#579 AK 11, 17) ──────────────────────

select pg_temp.pruefe(not exists (select 1 from termin_eingefroren where termin_id = pg_temp.id('tr_t2_vorbei')), 'tr_t2_vorbei festgehalten');
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_spieler_aus_team_nehmen(pg_temp.id('t2'), pg_temp.id('s3')) = '{"status": "herausgenommen", "ohne_team": false}',
                      'herausnehmen mit weiterem Team');
select pg_temp.pruefe(verein_spieler_aus_team_nehmen(pg_temp.id('t2'), pg_temp.id('sb')) = '{"status": "herausgenommen", "ohne_team": true}',
                      'herausnehmen ohne weiteres Team');
select pg_temp.erwarte(format('select verein_spieler_aus_team_nehmen(%L, %L)', pg_temp.id('t2'), pg_temp.id('sb')), 'SPIELER_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select verein_spieler_aus_team_nehmen(%L, %L)', pg_temp.id('t2'), gen_random_uuid()), 'SPIELER_NICHT_GEFUNDEN');
reset role;
select pg_temp.pruefe(exists (select 1 from spieler where id = pg_temp.id('sb') and team_id is null)
                      and (select team_id from spieler where id = pg_temp.id('s3')) = pg_temp.id('t1')
                      and exists (select 1 from termin_teilnahmen where termin_id = pg_temp.id('tr_t2_vorbei')
                                   and spieler_id = pg_temp.id('sb') and abgemeldet), 'Herausnehmen: Folgen falsch');

-- ── Kader und Serie am Termin (Sperrordnung «Team vor Termin») ──────────────

insert into team_members (team_id, user_id) values (pg_temp.id('t2'), pg_temp.id('b'));
select pg_temp.als(pg_temp.id('b'));
select pg_temp.pruefe(termin_kader_setzen(pg_temp.id('tr_t2'), array[pg_temp.id('k2')]) ->> 'team' = pg_temp.id('t2')::text, 'Kader am Termin');
select pg_temp.erwarte(format($$select termin_kader_setzen(%L, '{}')$$, pg_temp.id('tr1')), 'TERMIN_NICHT_GEFUNDEN');
select pg_temp.erwarte(format($$select termin_kader_setzen(%L, '{}')$$, gen_random_uuid()), 'TERMIN_NICHT_GEFUNDEN');
select pg_temp.erwarte(format($$select termin_kader_setzen(%L, array[%L]::uuid[])$$, pg_temp.id('tr_t2'), pg_temp.id('k1')), 'KADER_NICHT_GEFUNDEN');
select pg_temp.erwarte(format($$select termin_der_serie_folgen(%L, array['kader'])$$, pg_temp.id('tr_serie')), 'TERMIN_NICHT_GEFUNDEN');
select pg_temp.erwarte(format($$select termin_der_serie_folgen(%L, array['kader'])$$, pg_temp.id('tr_t2')), 'TERMIN_OHNE_SERIE');
select pg_temp.erwarte(format($$select termin_der_serie_folgen(%L, null)$$, pg_temp.id('tr_t2')), 'SERIE_ANGABEN_UNGUELTIG');
reset role;
select pg_temp.pruefe((select array_agg(kader_id) from termin_kader where termin_id = pg_temp.id('tr_t2')) = array[pg_temp.id('k2')],
                      'Kader am Termin nicht gesetzt');
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(termin_der_serie_folgen(pg_temp.id('tr_serie'), array['kader', 'ort']) ->> 'verfallen' = '0', 'Serie folgen mit Kader');
select pg_temp.pruefe(terminserie_aendern(pg_temp.id('tr_serie'), 'alle', '{"bemerkung": "Neu"}') ->> 'serie' = pg_temp.id('serie1')::text,
                      'Serie ändern');
reset role;
select pg_temp.als(pg_temp.id('b'));
select pg_temp.erwarte(format($$select terminserie_aendern(%L, 'alle', '{"bemerkung": "X"}')$$, pg_temp.id('tr_serie')), 'TERMIN_NICHT_GEFUNDEN');
reset role;

-- ── Auflösen (AK 24, 25, PC 1, PC 2, Testfall 13) ───────────────────────────

select pg_temp.pruefe(exists (select 1 from termin_teilnahmen where termin_id = pg_temp.id('tr1_vorbei')
                               and spieler_id = pg_temp.id('s1')), 'Anwesenheit von T1 fehlt vor dem Auflösen');
select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  v jsonb;
begin
  perform pg_temp.pruefe(verein_team_aufloesen(pg_temp.id('t1'), 'team eins') = '{"status": "name_falsch", "name": "Team Eins"}',
                         'Gross/Klein zählt');
  perform pg_temp.pruefe(verein_team_aufloesen(pg_temp.id('t1'), null) ->> 'status' = 'name_falsch', 'ohne Namen');
  v := verein_team_aufloesen(pg_temp.id('t1'), '  Team Eins ');
  perform pg_temp.pruefe(v ->> 'status' = 'aufgeloest' and (v ->> 'spieler_bleiben')::int = 3
                         and v -> 'bilder' @> '[{"bild_url": "https://bild.test/eins.webp"}]' and jsonb_array_length(v -> 'bilder') = 1,
                         'aufgelöst: ' || v::text);
  -- NFD-Eingabe für einen NFC-Namen.
  perform pg_temp.pruefe(verein_team_aufloesen(pg_temp.id('t5'), normalize('Jüngste', nfd)) ->> 'status' = 'aufgeloest', 'NFD');
end $$;
select pg_temp.erwarte(format($$select verein_team_aufloesen(%L, 'Team Eins')$$, pg_temp.id('t1')), 'VEREIN_NICHT_GEFUNDEN');
reset role;
select pg_temp.pruefe(not exists (select 1 from teams where id in (pg_temp.id('t1'), pg_temp.id('t5'))), 'Team besteht noch');
-- PC 1: Spieler:innen bleiben samt Link, Schnuppern endet, Zuordnungen weg.
select pg_temp.pruefe((select count(*) from spieler where id in (pg_temp.id('s1'), pg_temp.id('s2'), pg_temp.id('s3'), pg_temp.id('s5'))) = 4
                      and (select link_token from spieler where id = pg_temp.id('s1')) = current_setting('test.token')
                      and (select team_id from spieler where id = pg_temp.id('s1')) is null
                      and not exists (select 1 from team_spieler where spieler_id in (pg_temp.id('s1'), pg_temp.id('s2'), pg_temp.id('s3'), pg_temp.id('s5')))
                      and exists (select 1 from spieler_abos where spieler_id = pg_temp.id('s5')), 'PC 1');
-- PC 2: Termine, Serien, Spiele, Kader, Abmeldungen, Anwesenheit, Trainings weg.
select pg_temp.pruefe(not exists (select 1 from training_termine where id in (pg_temp.id('tr1'), pg_temp.id('sp1'), pg_temp.id('tr_serie'), pg_temp.id('tr_t5')))
                      and not exists (select 1 from termin_serien where id = pg_temp.id('serie1'))
                      and not exists (select 1 from kader where id in (pg_temp.id('k1'), pg_temp.id('k5')))
                      and not exists (select 1 from termin_abmeldungen where termin_id = pg_temp.id('tr1'))
                      and not exists (select 1 from termin_eingefroren where team_id = pg_temp.id('t1'))
                      and not exists (select 1 from termin_teilnahmen where team_id = pg_temp.id('t1'))
                      and not exists (select 1 from trainings where id in (pg_temp.id('training1'), pg_temp.id('training2')))
                      and not exists (select 1 from team_abholung where team_id = pg_temp.id('t5')), 'PC 2');
-- Ein früheres Mitglied erfährt, dass das Team weg ist.
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(entferne_team_mitglied(pg_temp.id('t1'), pg_temp.id('a')) = '{"status": "team_weg"}', 'team_weg');
reset role;

-- ── Rechte der neuen Funktionen ─────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array['verein_ansicht(uuid)', 'verein_team_ansicht(uuid)', 'verein_team_anlegen(uuid,text)',
    'verein_team_umbenennen(uuid,text)', 'verein_umbenennen(uuid,text)', 'verein_team_aufloesen(uuid,text)',
    'verein_finde_person(uuid,text,uuid)', 'verein_team_aufnehmen(uuid,text)', 'verein_team_beitreten(uuid)',
    'verein_team_mitglied_entfernen(uuid,uuid)', 'verein_verwaltung_aufnehmen(uuid,text)',
    'verein_verwaltung_entfernen(uuid,uuid)', 'verein_spieler_aus_team_nehmen(uuid,uuid)',
    'entferne_team_mitglied(uuid,uuid)'] loop
    if has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute') then
      raise exception 'Story 5: Grant von % falsch', f;
    end if;
  end loop;
  -- Helfer ohne API-Recht.
  foreach f in array array['teamname_vergeben(uuid,text,uuid)', 'aufnahme_ziel(uuid,text,uuid,boolean)',
    'spieler_aus_team_nehmen_kern(uuid,uuid,boolean,text)', 'verwaltung_sperren(uuid)',
    'verwaltung_team_sperren(uuid)'] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'Story 5: Helfer % ist per API ausführbar', f;
    end if;
  end loop;
end $$;

rollback;
