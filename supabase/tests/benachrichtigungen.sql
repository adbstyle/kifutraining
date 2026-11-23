-- Benachrichtigungen am privaten Link (Epic #641, Story 1 #642), auf
-- Datenebene:
-- - Empfänger (Prinzip 3, PC 1): alle Spieler:innen des Termin-Teams, für die
--   das Spiel gilt — mit Kader nur dessen Spieler:innen, schnuppernde nie,
--   ab Beginn die eingefrorene Menge; unabhängig vom Meldestand
-- - Tagesgrenze (Prinzip 2): gestern still, heute (auch begonnen) zählt
-- - Zustand (Prinzip 1): Training und ausgefallenes Spiel still; ein neues
--   Spiel nur einmal (Doppelschutz)
-- - Inhalt (Prinzip 6, AK 3): Team, Bezeichnung, Datum, Beginn, Ende, Ort;
--   kein Meldestand, kein Grund, kein «wieder»
-- - Nicht-Mitglied und unbekannter Termin: TERMIN_NICHT_GEFUNDEN; unbekanntes
--   Ereignis: EREIGNIS_UNGUELTIG
-- - Rechte: anon/authenticated ohne Tabellenrecht; Bausteine ohne API-Recht;
--   Ablegen nur authenticated, Lesen auch anon
-- - Lesen am Link (AK 1, 5): 90 Tage, neueste zuerst, Form; ungültiger Token;
--   bleibt nach dem Entfernen des Spiels und dem Herausnehmen aus dem Team
-- - Link erneuern leert (PC 2), Spieler:in löschen leert (PC 3; Verein
--   löschen prüft verein_gruenden_loeschen.sql), Frist-Funktion und Job
-- Story 2 (#643): Ausfall und Rücknahme
-- - Zustand (Prinzip 1): `ausfall` nur an einem ausgefallenen, `ruecknahme`
--   nur an einem stattfindenden Termin, sonst still (0)
-- - Tagesgrenze (AK 1): vergangene Termine still
-- - Empfänger (PC 1): auch eine abgemeldete Spieler:in
-- - Inhalt (AK 3, 4): Ausfall mit Grund (auch `null`), Rücknahme ohne Grund
-- Story 3 (#644): Verlegung
-- - Einzeln (`termin_benachrichtigen` 'verlegung'): neuer Stand im Inhalt,
--   `wieder` nur auf Wunsch; ausgefallen oder vergangen still (0)
-- - Vergleich: nur der Kartenlink still (OoS 1)
-- - Serie ändern: Vorschau schreibt nichts und nennt `mitteilbar`; ohne
--   Entscheid nichts; mit: genau eine Zeile `serie` je Spieler:in mit `ab`
--   (erster verlegter Termin, vergangene und ausgefallene zählen nicht) und
--   den geänderten Angaben; abweichende Termine, die sich nicht ändern, und
--   neu angelegte lösen nichts aus; Wochentag-Tausch
-- - Der Serie folgen: Zeit → `verlegung` mit dem Stand der Serie; ohne
--   Entscheid oder ohne Änderung nichts
-- Story 4 (#645): Wegfall
-- - Einzeln entfernen: `wegfall` an alle, für die der Termin bis dahin galt
--   (auch abgemeldete), mit dem Inhalt vor dem Löschen; ausgefallen,
--   vergangen oder ohne Entscheid nichts; der Eintrag bleibt am Link
-- - Serie entfernen: Vorschau schreibt nichts und nennt `mitteilbar`;
--   ausgeführt eine Zeile `serie` je Spieler:in mit `wegfall` (ohne
--   ausgefallene Termine)
-- - Serie ändern: kürzerer Zeitraum und neue Zeit in EINER Zeile (`angaben`
--   und `wegfall`); ein Wochentag fällt weg
-- - Team auflösen und Verein löschen legen nichts ab (Protokoll-Trigger)
-- Alles in einer Transaktion mit rollback; hinterlässt nichts.

\set ON_ERROR_STOP on
\o /dev/null

begin;
set local statement_timeout = '60s';

create function pg_temp.als(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Zurück zu postgres ohne Anmeldung: `reset role` allein lässt die Claims
-- (und damit auth.uid()) stehen.
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
  if p_ok is not true then raise exception 'Benachrichtigungen #642: %', p_text; end if;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('v'), ('t'), ('tf'), ('m'), ('mf'), ('s1'), ('s2'), ('sp'), ('sf'), ('k'),
  ('kader'), ('offen'), ('fest'), ('heute'), ('gestern'), ('training'), ('aus'), ('weg');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

-- Die Empfänger:innen eines Termins als sortierte Namen.
create function pg_temp.empfaenger(p_termin text) returns text language sql stable as $$
  select coalesce(string_agg(i.name, ' ' order by i.name), '')
    from spieler_benachrichtigungen b join ids i on i.id = b.spieler_id
   where b.termin_id = pg_temp.id(p_termin) $$;

create function pg_temp.benachrichtige(p_termin text, p_ereignis text default 'neues_spiel') returns integer
language sql as $$ select termin_benachrichtigen(pg_temp.id(p_termin), p_ereignis) $$;
grant execute on function pg_temp.benachrichtige(text, text) to authenticated;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@benachrichtigungen.test', now() from ids where name in ('m', 'mf');

-- Verein mit Team «Adler» (Mitglied m) und Team «Fremd» (Mitglied mf).
-- s1 und s2 in Adler, s1 im Kader, sp schnuppert in Adler, sf nur in Fremd.
set local session_replication_role = replica;
insert into vereine (id, name) values (pg_temp.id('v'), 'Benachrichtigungs-Verein');
insert into teams (id, name, verein_id) values
  (pg_temp.id('t'), 'Adler', pg_temp.id('v')), (pg_temp.id('tf'), 'Fremd', pg_temp.id('v'));
insert into team_members (team_id, user_id) values (pg_temp.id('t'), pg_temp.id('m')), (pg_temp.id('tf'), pg_temp.id('mf'));
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('s1'), pg_temp.id('t'), pg_temp.id('v'), 'Sara', 'Kader', 2015),
  (pg_temp.id('s2'), pg_temp.id('t'), pg_temp.id('v'), 'Sina', 'Ohne', 2015),
  (pg_temp.id('sp'), pg_temp.id('t'), pg_temp.id('v'), 'Paul', 'Schnupper', 2015),
  (pg_temp.id('sf'), pg_temp.id('tf'), pg_temp.id('v'), 'Fritz', 'Fremd', 2015);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values
  (pg_temp.id('t'), pg_temp.id('s1'), pg_temp.id('v'), null),
  (pg_temp.id('t'), pg_temp.id('s2'), pg_temp.id('v'), null),
  (pg_temp.id('t'), pg_temp.id('sp'), pg_temp.id('v'), now()),
  (pg_temp.id('tf'), pg_temp.id('sf'), pg_temp.id('v'), null);
insert into kader (id, team_id, name) values (pg_temp.id('k'), pg_temp.id('t'), 'Kader A');
insert into kader_spieler (kader_id, spieler_id, team_id) values (pg_temp.id('k'), pg_temp.id('s1'), pg_temp.id('t'));
-- Spiele: «kader» (nur Kader A), «offen» (alle), «fest» (heute begonnen,
-- eingefroren nur mit s2), «heute» (heute begonnen, nicht eingefroren),
-- «gestern», «aus» (ausgefallen), «weg» (wird entfernt); dazu ein Training.
insert into training_termine (id, team_id, datum, beginn, ende, ort, art, bezeichnung) values
  (pg_temp.id('kader'), pg_temp.id('t'), heute_am_trainingsort() + 3, '10:00', '11:30', 'Allmend', 'spiel', 'Match Kader'),
  (pg_temp.id('offen'), pg_temp.id('t'), heute_am_trainingsort() + 4, '14:00', '15:30', 'Schachen', 'spiel', 'Match gegen Uster'),
  (pg_temp.id('fest'), pg_temp.id('t'), heute_am_trainingsort(), '00:00', '23:59', null, 'spiel', 'Match fest'),
  (pg_temp.id('heute'), pg_temp.id('t'), heute_am_trainingsort(), '00:01', '23:59', null, 'spiel', 'Match heute'),
  (pg_temp.id('gestern'), pg_temp.id('t'), heute_am_trainingsort() - 1, '10:00', '11:00', null, 'spiel', 'Match gestern'),
  (pg_temp.id('weg'), pg_temp.id('t'), heute_am_trainingsort() + 5, '10:00', '11:00', null, 'spiel', 'Match weg');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung, ausgefallen, ausfall_grund) values
  (pg_temp.id('aus'), pg_temp.id('t'), heute_am_trainingsort() + 6, '10:00', '11:00', 'spiel', 'Match aus', true, 'Regen');
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('training'), pg_temp.id('t'), heute_am_trainingsort() + 2, '18:00', '19:30');
insert into termin_kader (termin_id, kader_id, team_id) values (pg_temp.id('kader'), pg_temp.id('k'), pg_temp.id('t'));
insert into termin_eingefroren (termin_id, team_id, mit_liste) values (pg_temp.id('fest'), pg_temp.id('t'), true);
insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, gewechselt_am) values
  (pg_temp.id('fest'), pg_temp.id('t'), pg_temp.id('s2'), 'abgemeldet', now());
-- s2 ist vom offenen Spiel abgemeldet: zählt trotzdem (Prinzip 3).
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am) values
  (pg_temp.id('offen'), pg_temp.id('s2'), pg_temp.id('t'), 'abgemeldet', now());
set local session_replication_role = origin;

-- ── Rechte ──────────────────────────────────────────────────────────────────

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    perform pg_temp.pruefe(not has_table_privilege(r, 'spieler_benachrichtigungen', 'select, insert, update, delete'),
                           r || ' hat ein Tabellenrecht');
    perform pg_temp.pruefe(not has_function_privilege(r, f, 'execute'), r || ' darf ' || f)
       from unnest(array['benachrichtigung_zaehlt(date)', 'benachrichtigung_empfaenger(uuid)',
                         'benachrichtigung_inhalt(training_termine, boolean)',
                         'benachrichtigung_ablegen(uuid, text, uuid, jsonb, uuid[])',
                         'spieler_benachrichtigungen_frist_loeschen()', 'spieler_benachrichtigungen_weg()',
                         'spieler_benachrichtigungen_erloeschen()']) f;
  end loop;
  perform pg_temp.pruefe(not has_function_privilege('anon', 'termin_benachrichtigen(uuid, text, boolean)', 'execute'),
                         'anon darf ablegen');
  perform pg_temp.pruefe(has_function_privilege('authenticated', 'termin_benachrichtigen(uuid, text, boolean)', 'execute'),
                         'authenticated darf nicht ablegen');
  perform pg_temp.pruefe(has_function_privilege('anon', 'spieler_link_benachrichtigungen(text)', 'execute'),
                         'anon darf nicht lesen');
  perform pg_temp.pruefe(exists (select 1 from cron.job where jobname = 'spieler-benachrichtigungen-frist'
                                   and schedule = '37 3 * * *'), 'Frist-Job fehlt');
end $$;

select pg_temp.als(pg_temp.id('m'));
select pg_temp.erwarte('select count(*) from spieler_benachrichtigungen', '42501');
select pg_temp.zurueck();

-- ── Abweisen ────────────────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('mf'));
select pg_temp.erwarte($$select pg_temp.benachrichtige('offen')$$, 'TERMIN_NICHT_GEFUNDEN');
select pg_temp.zurueck();
select pg_temp.als(pg_temp.id('m'));
select pg_temp.erwarte(format('select termin_benachrichtigen(%L, %L)', gen_random_uuid(), 'neues_spiel'), 'TERMIN_NICHT_GEFUNDEN');
select pg_temp.erwarte($$select pg_temp.benachrichtige('offen', 'quatsch')$$, 'EREIGNIS_UNGUELTIG');
select pg_temp.erwarte($$select pg_temp.benachrichtige('offen', null)$$, 'EREIGNIS_UNGUELTIG');
select pg_temp.zurueck();
do $$ begin
  perform pg_temp.pruefe(not exists (select 1 from spieler_benachrichtigungen where spieler_id in (select id from ids)),
                         'eine Abweisung hat abgelegt');
end $$;

-- ── Empfänger, Tagesgrenze, Zustand, Doppelschutz ───────────────────────────

create temp table zahl (termin text primary key, n int);
grant insert on zahl to authenticated;
select pg_temp.als(pg_temp.id('m'));
insert into zahl select x, pg_temp.benachrichtige(x)
  from unnest(array['kader', 'offen', 'fest', 'heute', 'gestern', 'aus', 'training']) x;
select pg_temp.zurueck();

do $$
declare
  z jsonb := (select jsonb_object_agg(termin, n) from zahl);
begin
  perform pg_temp.pruefe(z = '{"kader":1,"offen":2,"fest":1,"heute":2,"gestern":0,"aus":0,"training":0}', 'Zahlen: ' || z::text);
  perform pg_temp.pruefe(pg_temp.empfaenger('kader') = 's1', 'Kader: ' || pg_temp.empfaenger('kader'));
  perform pg_temp.pruefe(pg_temp.empfaenger('offen') = 's1 s2', 'alle ohne Schnuppern, auch abgemeldet: ' || pg_temp.empfaenger('offen'));
  perform pg_temp.pruefe(pg_temp.empfaenger('fest') = 's2', 'eingefroren: ' || pg_temp.empfaenger('fest'));
  perform pg_temp.pruefe(pg_temp.empfaenger('heute') = 's1 s2', 'heute begonnen zählt: ' || pg_temp.empfaenger('heute'));
  perform pg_temp.pruefe(pg_temp.empfaenger('gestern') || pg_temp.empfaenger('aus') || pg_temp.empfaenger('training') = '',
                         'gestern, ausgefallen oder Training abgelegt');
  -- Ein Vorgang je Aufruf: beide Zeilen des offenen Spiels teilen ihn.
  perform pg_temp.pruefe((select count(distinct vorgang) from spieler_benachrichtigungen
                           where termin_id = pg_temp.id('offen')) = 1, 'mehr als ein Vorgang');
  -- Inhalt als Momentaufnahme, ohne Meldestand, Grund oder «wieder».
  perform pg_temp.pruefe(
    (select inhalt from spieler_benachrichtigungen where termin_id = pg_temp.id('offen') and spieler_id = pg_temp.id('s2'))
      = jsonb_build_object('team', 'Adler', 'art', 'spiel', 'bezeichnung', 'Match gegen Uster',
                           'datum', to_char(heute_am_trainingsort() + 4, 'YYYY-MM-DD'), 'beginn', '14:00', 'ende', '15:30',
                           'ort', 'Schachen'),
    'Inhalt: ' || (select inhalt::text from spieler_benachrichtigungen
                    where termin_id = pg_temp.id('offen') and spieler_id = pg_temp.id('s2')));
  perform pg_temp.pruefe((select bool_and(ereignis = 'neues_spiel') from spieler_benachrichtigungen
                           where spieler_id in (select id from ids)), 'Ereignis');
end $$;

-- Doppelschutz: dasselbe Spiel ein zweites Mal — still, nichts dazu.
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(pg_temp.benachrichtige('offen') = 0, 'zweites neues_spiel');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.empfaenger('offen') = 's1 s2', 'Doppelschutz: ' || pg_temp.empfaenger('offen'));
-- Auch an der Prüfung vorbei hält die Datenebene: ein zweiter Vorgang legt nichts ab.
select pg_temp.pruefe(
  benachrichtigung_ablegen(gen_random_uuid(), 'neues_spiel', pg_temp.id('offen'), '{}', array[pg_temp.id('s1'), pg_temp.id('s1')]) = 0,
  'Index neues_spiel');

-- ── Lesen am Link (AK 1, 5) ─────────────────────────────────────────────────

-- s1 hat «kader», «offen», «heute»; dazu ein 91 Tage alter und ein 89 Tage alter Eintrag.
insert into spieler_benachrichtigungen (spieler_id, vorgang, ereignis, termin_id, inhalt, erstellt_am) values
  (pg_temp.id('s1'), gen_random_uuid(), 'neues_spiel', null, '{"alt":91}', now() - interval '91 days'),
  (pg_temp.id('s1'), gen_random_uuid(), 'neues_spiel', null, '{"alt":89}', now() - interval '89 days');
-- «weg» benachrichtigen, dann entfernen und s1 aus dem Team nehmen: erhalten bleibt erhalten.
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(pg_temp.benachrichtige('weg') = 2, 'weg');
select pg_temp.zurueck();
delete from training_termine where id = pg_temp.id('weg');

do $$
declare
  a jsonb := spieler_link_benachrichtigungen((select link_token from spieler where id = pg_temp.id('s1')));
  e jsonb;
begin
  perform pg_temp.pruefe(a ->> 'gueltig' = 'true', 'gültig');
  perform pg_temp.pruefe(a ->> 'heute' = to_char(heute_am_trainingsort(), 'YYYY-MM-DD'), 'heute');
  perform pg_temp.pruefe(abs((a ->> 'jetzt')::bigint - (extract(epoch from now()) * 1000)::bigint) < 1000, 'jetzt');
  -- weg, kader, offen, heute (gleiche Zeit: nach id) und der 89 Tage alte; der 91 Tage alte nicht.
  perform pg_temp.pruefe(jsonb_array_length(a -> 'eintraege') = 5, 'Anzahl: ' || (a -> 'eintraege')::text);
  perform pg_temp.pruefe((a -> 'eintraege' -> 4 -> 'inhalt') = '{"alt":89}', 'älteste zuletzt');
  perform pg_temp.pruefe(not (a -> 'eintraege') @> '[{"inhalt":{"alt":91}}]', '91 Tage');
  e := (select x from jsonb_array_elements(a -> 'eintraege') x where (x ->> 'termin_id')::uuid = pg_temp.id('weg'));
  perform pg_temp.pruefe(e is not null, 'entferntes Spiel fehlt');
  perform pg_temp.pruefe(array(select k from jsonb_object_keys(e) k order by k)
                           = array['ereignis', 'erstellt', 'erstellt_tag', 'id', 'inhalt', 'termin_id'], 'Schlüssel: ' || e::text);
  perform pg_temp.pruefe(e ->> 'erstellt_tag' = to_char(now() at time zone 'Europe/Zurich', 'YYYY-MM-DD'), 'erstellt_tag');
  perform pg_temp.pruefe((e ->> 'erstellt')::bigint <= (a ->> 'jetzt')::bigint, 'erstellt');
  perform pg_temp.pruefe(spieler_link_benachrichtigungen('unbekannt') = '{"gueltig":false}', 'ungültiger Token');
  perform pg_temp.pruefe(spieler_link_benachrichtigungen(null) = '{"gueltig":false}', 'leerer Token');
end $$;

-- Herausnehmen aus dem Team lässt sie stehen; anon liest über den Link.
set local session_replication_role = replica;
delete from team_spieler where spieler_id = pg_temp.id('s1');
set local session_replication_role = origin;
create temp table tok as select link_token from spieler where id = pg_temp.id('s1');
grant select on tok to anon;
set local role anon;
select pg_temp.pruefe(jsonb_array_length(spieler_link_benachrichtigungen((select link_token from tok)) -> 'eintraege') = 5,
                      'anon nach dem Herausnehmen');
select pg_temp.erwarte('select count(*) from spieler_benachrichtigungen', '42501');
reset role;

-- ── Link erneuern (PC 2), Spieler:in löschen (PC 3), Frist ─────────────────

update spieler set link_token = neues_geheimnis() where id = pg_temp.id('s1');
do $$ begin
  perform pg_temp.pruefe(not exists (select 1 from spieler_benachrichtigungen where spieler_id = pg_temp.id('s1')),
                         'Link erneuert, Zeilen bleiben');
  perform pg_temp.pruefe(
    spieler_link_benachrichtigungen((select link_token from spieler where id = pg_temp.id('s1'))) -> 'eintraege' = '[]',
    'erneuerter Link nicht leer');
  perform pg_temp.pruefe(spieler_link_benachrichtigungen((select link_token from tok)) = '{"gueltig":false}', 'alter Link gilt');
  -- Andere bleiben.
  perform pg_temp.pruefe(pg_temp.empfaenger('offen') = 's2', 'andere Spieler:in verloren');
end $$;

delete from spieler where id = pg_temp.id('s2');
select pg_temp.pruefe(not exists (select 1 from spieler_benachrichtigungen where spieler_id = pg_temp.id('s2')),
                      'Spieler:in gelöscht, Zeilen bleiben');

-- Frist: alt (91 Tage) und ohne Spieler:in weg, frisch (89 Tage) bleibt.
insert into spieler_benachrichtigungen (spieler_id, vorgang, ereignis, inhalt, erstellt_am) values
  (pg_temp.id('sp'), gen_random_uuid(), 'neues_spiel', '{"f":"alt"}', now() - interval '91 days'),
  (pg_temp.id('sp'), gen_random_uuid(), 'neues_spiel', '{"f":"frisch"}', now() - interval '89 days'),
  (gen_random_uuid(), gen_random_uuid(), 'neues_spiel', '{"f":"ohne"}', now());
do $$
declare
  n int := spieler_benachrichtigungen_frist_loeschen();
begin
  perform pg_temp.pruefe(n >= 2, 'Frist löscht zu wenig: ' || n);
  perform pg_temp.pruefe((select array_agg(inhalt ->> 'f') from spieler_benachrichtigungen where inhalt ? 'f') = array['frisch'],
                         'Frist: ' || (select string_agg(inhalt ->> 'f', ' ') from spieler_benachrichtigungen where inhalt ? 'f'));
end $$;

-- ── Ausfall und Rücknahme (#643) ────────────────────────────────────────────

-- Eigenes Team «Falken» (Mitglied m) mit s3 und s4; s4 ist vom Training a1
-- abgemeldet. Trainings: a1 (ausgefallen mit Grund), a2 (findet statt),
-- a3 (gestern, ausgefallen), a4 (ausgefallen ohne Grund).
insert into ids (name) values ('ta'), ('s3'), ('s4'), ('a1'), ('a2'), ('a3'), ('a4');
set local session_replication_role = replica;
insert into teams (id, name, verein_id) values (pg_temp.id('ta'), 'Falken', pg_temp.id('v'));
insert into team_members (team_id, user_id) values (pg_temp.id('ta'), pg_temp.id('m'));
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('s3'), pg_temp.id('ta'), pg_temp.id('v'), 'Tina', 'Da', 2015),
  (pg_temp.id('s4'), pg_temp.id('ta'), pg_temp.id('v'), 'Tom', 'Abgemeldet', 2015);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values
  (pg_temp.id('ta'), pg_temp.id('s3'), pg_temp.id('v'), null),
  (pg_temp.id('ta'), pg_temp.id('s4'), pg_temp.id('v'), null);
insert into training_termine (id, team_id, datum, beginn, ende, ort, ausgefallen, ausfall_grund) values
  (pg_temp.id('a1'), pg_temp.id('ta'), heute_am_trainingsort() + 3, '18:00', '19:30', 'Halle', true, 'Halle besetzt'),
  (pg_temp.id('a2'), pg_temp.id('ta'), heute_am_trainingsort() + 3, '17:00', '18:00', null, false, null),
  (pg_temp.id('a3'), pg_temp.id('ta'), heute_am_trainingsort() - 1, '18:00', '19:30', null, true, null),
  (pg_temp.id('a4'), pg_temp.id('ta'), heute_am_trainingsort() + 2, '18:00', '19:30', null, true, null);
insert into termin_abmeldungen (termin_id, spieler_id, team_id) values (pg_temp.id('a1'), pg_temp.id('s4'), pg_temp.id('ta'));
set local session_replication_role = origin;

-- Die Empfänger:innen eines Termins zu einem Ereignis.
create function pg_temp.empfaenger(p_termin text, p_ereignis text) returns text language sql stable as $$
  select coalesce(string_agg(i.name, ' ' order by i.name), '')
    from spieler_benachrichtigungen b join ids i on i.id = b.spieler_id
   where b.termin_id = pg_temp.id(p_termin) and b.ereignis = p_ereignis $$;

delete from zahl;
select pg_temp.als(pg_temp.id('m'));
insert into zahl select x || ':' || e, pg_temp.benachrichtige(x, e)
  from unnest(array['a1', 'a2', 'a3', 'a4']) x, unnest(array['ausfall', 'ruecknahme']) e;
select pg_temp.zurueck();

do $$
declare
  z jsonb := (select jsonb_object_agg(termin, n) from zahl);
begin
  -- Ausfall nur am ausgefallenen, Rücknahme nur am stattfindenden; gestern still.
  perform pg_temp.pruefe(z = '{"a1:ausfall":2,"a1:ruecknahme":0,"a2:ausfall":0,"a2:ruecknahme":2,'
                             '"a3:ausfall":0,"a3:ruecknahme":0,"a4:ausfall":2,"a4:ruecknahme":0}', '#643 Zahlen: ' || z::text);
  -- PC 1: auch die abgemeldete s4.
  perform pg_temp.pruefe(pg_temp.empfaenger('a1', 'ausfall') = 's3 s4', '#643 Empfänger: ' || pg_temp.empfaenger('a1', 'ausfall'));
  -- AK 3: mit Grund; ohne Grund steht er als null da.
  perform pg_temp.pruefe(
    (select inhalt from spieler_benachrichtigungen where termin_id = pg_temp.id('a1') and spieler_id = pg_temp.id('s4'))
      = jsonb_build_object('team', 'Falken', 'art', 'training', 'bezeichnung', null,
                           'datum', to_char(heute_am_trainingsort() + 3, 'YYYY-MM-DD'), 'beginn', '18:00', 'ende', '19:30',
                           'ort', 'Halle', 'grund', 'Halle besetzt'),
    '#643 Inhalt Ausfall: ' || (select inhalt::text from spieler_benachrichtigungen
                                 where termin_id = pg_temp.id('a1') and spieler_id = pg_temp.id('s4')));
  perform pg_temp.pruefe((select bool_and(inhalt ? 'grund' and inhalt -> 'grund' = 'null'::jsonb)
                            from spieler_benachrichtigungen where termin_id = pg_temp.id('a4')), '#643 Ausfall ohne Grund');
  -- AK 4: Rücknahme ohne Grund und ohne «wieder».
  perform pg_temp.pruefe(
    (select bool_and(not inhalt ? 'grund' and not inhalt ? 'wieder' and inhalt ->> 'team' = 'Falken' and inhalt ->> 'beginn' = '17:00')
       from spieler_benachrichtigungen where termin_id = pg_temp.id('a2')), '#643 Inhalt Rücknahme');
end $$;

-- Rücknahme des gestrigen Ausfalls: still (AK 1).
update training_termine set ausgefallen = false, ausfall_grund = null where id = pg_temp.id('a3');
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(pg_temp.benachrichtige('a3', 'ruecknahme') = 0, '#643 vergangene Rücknahme');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.empfaenger('a3') = '', '#643 vergangen abgelegt');

-- ── Verlegung (#644) ────────────────────────────────────────────────────────

-- Eigenes Team «Möwen» (Mitglied m) mit s5 und s6. Eine Serie am Wochentag
-- von morgen (d), vom d-7 bis d+14: Termine d-7, d, d+7, d+14.
insert into ids (name) values ('tm'), ('s5'), ('s6'), ('e1'), ('e2'), ('e3');
set local session_replication_role = replica;
insert into teams (id, name, verein_id) values (pg_temp.id('tm'), 'Möwen', pg_temp.id('v'));
insert into team_members (team_id, user_id) values (pg_temp.id('tm'), pg_temp.id('m'));
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('s5'), pg_temp.id('tm'), pg_temp.id('v'), 'Mia', 'Möwe', 2015),
  (pg_temp.id('s6'), pg_temp.id('tm'), pg_temp.id('v'), 'Moritz', 'Möwe', 2015);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values
  (pg_temp.id('tm'), pg_temp.id('s5'), pg_temp.id('v'), null),
  (pg_temp.id('tm'), pg_temp.id('s6'), pg_temp.id('v'), null);
-- Einzelne Termine: e1 (morgen), e2 (gestern), e3 (morgen, ausgefallen).
insert into training_termine (id, team_id, datum, beginn, ende, ort, ausgefallen) values
  (pg_temp.id('e1'), pg_temp.id('tm'), heute_am_trainingsort() + 1, '18:00', '19:00', 'Halle', false),
  (pg_temp.id('e2'), pg_temp.id('tm'), heute_am_trainingsort() - 1, '18:00', '19:00', 'Halle', false),
  (pg_temp.id('e3'), pg_temp.id('tm'), heute_am_trainingsort() + 1, '18:00', '19:00', 'Halle', true);
set local session_replication_role = origin;

create temp table serie_v (d date, w smallint, termin uuid, serie uuid);
insert into serie_v (d, w) select heute_am_trainingsort() + 1, extract(isodow from heute_am_trainingsort() + 1)::smallint;
grant select, update on serie_v to authenticated;
create function pg_temp.d(p_tage int default 0) returns date language sql stable as $$ select d + p_tage from serie_v $$;
create function pg_temp.st(p_tage int) returns uuid language sql stable as $$
  select t.id from training_termine t where t.team_id = pg_temp.id('tm') and t.serie_id is not null and t.datum = pg_temp.d(p_tage) $$;
-- Die Zeilen eines Ereignisses an Spieler:innen der Möwen.
create function pg_temp.moewen(p_ereignis text) returns setof spieler_benachrichtigungen language sql stable as $$
  select * from spieler_benachrichtigungen where spieler_id in (pg_temp.id('s5'), pg_temp.id('s6')) and ereignis = p_ereignis $$;
grant execute on function pg_temp.d(int), pg_temp.st(int) to authenticated;

select pg_temp.als(pg_temp.id('m'));
select terminserie_festlegen(pg_temp.id('tm'), array[(select w from serie_v)], pg_temp.d(-7), pg_temp.d(14),
                             '18:00', '19:30', 'Allmend', null, '{}', pg_temp.id('m'));
select pg_temp.zurueck();
update serie_v set termin = pg_temp.st(0), serie = (select serie_id from training_termine where id = pg_temp.st(0));
select pg_temp.pruefe((select count(*) from training_termine where serie_id = (select serie from serie_v)) = 4, '#644 Serie angelegt');

-- Einzeln (AK 1, 3): neuer Stand, `wieder` nur auf Wunsch; ausgefallen und gestern still.
update training_termine set datum = heute_am_trainingsort() + 2, ort = 'Wiese' where id = pg_temp.id('e1');
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(termin_benachrichtigen(pg_temp.id('e1'), 'verlegung', true) = 2, '#644 einzeln');
select pg_temp.pruefe(termin_benachrichtigen(pg_temp.id('e2'), 'verlegung') = 0, '#644 gestern');
select pg_temp.pruefe(termin_benachrichtigen(pg_temp.id('e3'), 'verlegung') = 0, '#644 ausgefallen');
select pg_temp.zurueck();
select pg_temp.pruefe(
  (select bool_and(inhalt = jsonb_build_object('team', 'Möwen', 'art', 'training', 'bezeichnung', null,
                                               'datum', to_char(heute_am_trainingsort() + 2, 'YYYY-MM-DD'),
                                               'beginn', '18:00', 'ende', '19:00', 'ort', 'Wiese', 'wieder', true))
     and count(*) = 2 from pg_temp.moewen('verlegung')),
  '#644 Inhalt einzeln: ' || (select string_agg(inhalt::text, ' ') from pg_temp.moewen('verlegung')));

-- Vergleich (OoS 1): nur der Kartenlink ist keine Verlegung; der Ort schon.
do $$
declare
  v jsonb := benachrichtigung_stand(array[pg_temp.id('e1')]);
begin
  perform pg_temp.pruefe(v -> pg_temp.id('e1')::text -> 'inhalt' ->> 'datum' = to_char(heute_am_trainingsort() + 2, 'YYYY-MM-DD')
                         and jsonb_array_length(v -> pg_temp.id('e1')::text -> 'empfaenger') = 2, '#644 Stand: ' || v::text);
  update training_termine set ort_link = 'https://maps.app.goo.gl/abc' where id = pg_temp.id('e1');
  perform pg_temp.pruefe(benachrichtigung_einzeln(v) = 0, '#644 Kartenlink allein');
  update training_termine set ort = 'Halle' where id = pg_temp.id('e1');
  perform pg_temp.pruefe(benachrichtigung_einzeln(v) = 2, '#644 Ort zählt');
  perform pg_temp.pruefe((select count(*) from pg_temp.moewen('verlegung')) = 4, '#644 Ort legt ab');
end $$;

-- Serie ändern: Vorschau schreibt nichts und nennt `mitteilbar` (AK 2).
select pg_temp.als(pg_temp.id('m'));
do $$
declare
  v jsonb := terminserie_aendern(p_termin => (select termin from serie_v), p_reichweite => 'alle',
                                 p_aenderung => '{"beginn": "19:00", "ende": "20:30"}', p_ausfuehren => false,
                                 p_benachrichtigen => true);
begin
  perform pg_temp.pruefe((v ->> 'mitteilbar')::int = 2 and not v ? 'benachrichtigt', '#644 Vorschau: ' || v::text);
  -- Ohne Entscheid: geändert, nichts abgelegt.
  v := terminserie_aendern((select termin from serie_v), 'alle', '{"beginn": "19:00", "ende": "20:30"}');
  perform pg_temp.pruefe(v -> 'benachrichtigt' = 'null'::jsonb, '#644 ohne Entscheid: ' || v::text);
end $$;
select pg_temp.zurueck();
select pg_temp.pruefe(not exists (select 1 from pg_temp.moewen('serie')), '#644 Vorschau oder ohne Entscheid abgelegt');

-- Mit Entscheid: d-7 ist vergangen, d ausgefallen, d+7 hat einen eigenen Ort.
-- Der Ort der Serie ändert sich: verlegt sind nur d+14 (ab) — d+7 behält
-- seinen Ort, d bleibt ausgefallen.
update training_termine set ausgefallen = true where id = pg_temp.st(0);
update training_termine set ort = 'Eigen', ort_abweichend = true where id = pg_temp.st(7);
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(
  (terminserie_aendern((select termin from serie_v), 'alle', '{"ort": "Schachen"}', p_benachrichtigen => true) ->> 'benachrichtigt')::int = 2,
  '#644 Serie Ort');
select pg_temp.zurueck();
do $$ begin
  perform pg_temp.pruefe((select count(*) from pg_temp.moewen('serie')) = 2
                         and (select count(distinct vorgang) from pg_temp.moewen('serie')) = 1, '#644 eine Zeile je Spieler:in');
  perform pg_temp.pruefe(
    (select bool_and(termin_id = pg_temp.st(14)
                     and inhalt = jsonb_build_object('team', 'Möwen', 'art', 'training',
                                                     'ab', to_char(pg_temp.d(14), 'YYYY-MM-DD'),
                                                     'angaben', jsonb_build_object('ort', 'Schachen'), 'wegfall', null))
       from pg_temp.moewen('serie')),
    '#644 Inhalt Serie: ' || (select string_agg(inhalt::text, ' ') from pg_temp.moewen('serie')));
end $$;

-- Nur neue Termine (das Ende rückt hinaus): niemand. Der eigene Ort von d+7
-- bleibt, auch beim Ändern auf denselben Ort.
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(
  (terminserie_aendern((select termin from serie_v), 'alle', jsonb_build_object('end_datum', pg_temp.d(21)),
                       p_benachrichtigen => true) ->> 'benachrichtigt')::int = 0, '#644 neue Termine');
select pg_temp.pruefe(
  (terminserie_aendern((select termin from serie_v), 'alle', '{"ort": "Schachen"}', p_benachrichtigen => true) ->> 'benachrichtigt')::int = 0,
  '#644 nichts geändert');
select pg_temp.zurueck();
select pg_temp.pruefe((select count(*) from pg_temp.moewen('serie')) = 2, '#644 neue oder unveränderte Termine abgelegt');

-- Wochentag-Tausch (AK 2, 4): die Termine wandern um einen Tag; ab dem
-- ersten verlegten von heute oder später, Angaben = neue Wochentage.
delete from spieler_benachrichtigungen where spieler_id in (pg_temp.id('s5'), pg_temp.id('s6'));
update training_termine set ausgefallen = false where id = pg_temp.st(0);
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(
  (terminserie_aendern((select termin from serie_v), 'alle',
                       jsonb_build_object('wochentage', array[case when (select w from serie_v) = 7 then 6 else (select w from serie_v) + 1 end]),
                       p_benachrichtigen => true) ->> 'benachrichtigt')::int = 2, '#644 Tausch');
select pg_temp.zurueck();
do $$
declare
  w2 smallint := case when (select w from serie_v) = 7 then 6 else (select w from serie_v) + 1 end;
  ab date := pg_temp.d(w2 - (select w from serie_v));
begin
  perform pg_temp.pruefe(
    (select bool_and(inhalt -> 'angaben' = jsonb_build_object('wochentage', jsonb_build_array(w2))
                     and inhalt ->> 'ab' = to_char(ab, 'YYYY-MM-DD')
                     and termin_id = (select id from training_termine where team_id = pg_temp.id('tm') and serie_id is not null and datum = ab))
       and count(*) = 2 from pg_temp.moewen('serie')),
    '#644 Inhalt Tausch: ' || (select string_agg(inhalt::text, ' ') from pg_temp.moewen('serie')));
end $$;

-- Der Serie folgen (AK 1): der Termin mit eigener Zeit folgt der Zeit der Serie.
update training_termine set beginn = '17:00', ende = '18:00', zeit_abweichend = true
 where id = (select termin from serie_v);
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(termin_der_serie_folgen((select termin from serie_v), array['bemerkung'], null, true) ->> 'benachrichtigt' = '0',
                      '#644 folgen ohne Änderung');
select pg_temp.pruefe(termin_der_serie_folgen((select termin from serie_v), array['zeit'], null, true) ->> 'benachrichtigt' = '2',
                      '#644 folgen Zeit');
select pg_temp.zurueck();
select pg_temp.pruefe(
  (select bool_and(termin_id = (select termin from serie_v) and inhalt ->> 'beginn' = '19:00' and inhalt ->> 'ende' = '20:30'
                   and not inhalt ? 'wieder')
     and count(*) = 2 from pg_temp.moewen('verlegung') where termin_id = (select termin from serie_v)),
  '#644 Inhalt folgen: ' || (select string_agg(inhalt::text, ' ') from pg_temp.moewen('verlegung')));
-- Ohne Entscheid: nichts.
update training_termine set beginn = '17:00', ende = '18:00', zeit_abweichend = true
 where id = (select termin from serie_v);
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(termin_der_serie_folgen((select termin from serie_v), array['zeit']) -> 'benachrichtigt' = 'null'::jsonb,
                      '#644 folgen ohne Entscheid');
select pg_temp.zurueck();
select pg_temp.pruefe((select count(*) from pg_temp.moewen('verlegung') where termin_id = (select termin from serie_v)) = 2,
                      '#644 folgen ohne Entscheid abgelegt');

-- ── Wegfall (#645) ──────────────────────────────────────────────────────────

-- Eigenes Team «Kraniche» (Mitglied m, Verwaltung verw) mit s7 und s8; s8 ist
-- vom Training w1 abgemeldet. Einzelne Termine: w1 (Training in 3 Tagen),
-- w2 (ausgefallen), w3 (gestern), w4 (ohne Entscheid), w5 (Spiel).
insert into ids (name) values ('tk'), ('s7'), ('s8'), ('w1'), ('w2'), ('w3'), ('w4'), ('w5'), ('verw');
insert into auth.users (id, email, email_confirmed_at)
select id, name || '@benachrichtigungen.test', now() from ids where name = 'verw';
set local session_replication_role = replica;
insert into teams (id, name, verein_id) values (pg_temp.id('tk'), 'Kraniche', pg_temp.id('v'));
insert into team_members (team_id, user_id) values (pg_temp.id('tk'), pg_temp.id('m'));
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v'), pg_temp.id('verw'));
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('s7'), pg_temp.id('tk'), pg_temp.id('v'), 'Kim', 'Kranich', 2015),
  (pg_temp.id('s8'), pg_temp.id('tk'), pg_temp.id('v'), 'Kai', 'Abgemeldet', 2015);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values
  (pg_temp.id('tk'), pg_temp.id('s7'), pg_temp.id('v'), null),
  (pg_temp.id('tk'), pg_temp.id('s8'), pg_temp.id('v'), null);
insert into training_termine (id, team_id, datum, beginn, ende, ort, art, bezeichnung, ausgefallen) values
  (pg_temp.id('w1'), pg_temp.id('tk'), heute_am_trainingsort() + 3, '18:00', '19:30', 'Halle', 'training', null, false),
  (pg_temp.id('w2'), pg_temp.id('tk'), heute_am_trainingsort() + 3, '17:00', '18:00', null, 'training', null, true),
  (pg_temp.id('w3'), pg_temp.id('tk'), heute_am_trainingsort() - 1, '18:00', '19:30', null, 'training', null, false),
  (pg_temp.id('w4'), pg_temp.id('tk'), heute_am_trainingsort() + 4, '18:00', '19:30', null, 'training', null, false),
  (pg_temp.id('w5'), pg_temp.id('tk'), heute_am_trainingsort() + 5, '10:00', '11:00', 'Schachen', 'spiel', 'Match Kraniche', false);
insert into termin_abmeldungen (termin_id, spieler_id, team_id) values (pg_temp.id('w1'), pg_temp.id('s8'), pg_temp.id('tk'));
set local session_replication_role = origin;

-- Die Zeilen eines Ereignisses an Spieler:innen der Kraniche.
create function pg_temp.kraniche(p_ereignis text) returns setof spieler_benachrichtigungen language sql stable as $$
  select * from spieler_benachrichtigungen where spieler_id in (pg_temp.id('s7'), pg_temp.id('s8')) and ereignis = p_ereignis $$;

create temp table wegfall_z (fall text primary key, v jsonb);
grant select, insert on wegfall_z to authenticated;
select pg_temp.als(pg_temp.id('m'));
insert into wegfall_z values
  ('w1', termin_entfernen(pg_temp.id('w1'), null, true)),
  ('w2', termin_entfernen(pg_temp.id('w2'), null, true)),
  ('w3', termin_entfernen(pg_temp.id('w3'), null, true)),
  ('w4', termin_entfernen(pg_temp.id('w4'))),
  ('w5', termin_entfernen(p_termin => pg_temp.id('w5'), p_benachrichtigen => true));
select pg_temp.zurueck();

do $$
declare
  z jsonb := (select jsonb_object_agg(fall, v -> 'benachrichtigt') from wegfall_z);
  a jsonb := spieler_link_benachrichtigungen((select link_token from spieler where id = pg_temp.id('s8')));
begin
  -- AK 1: ausgefallen, gestern und ohne Entscheid still.
  perform pg_temp.pruefe(z = '{"w1": 2, "w2": 0, "w3": 0, "w4": null, "w5": 2}', '#645 Zahlen: ' || z::text);
  perform pg_temp.pruefe(not exists (select 1 from training_termine where team_id = pg_temp.id('tk')), '#645 entfernt');
  -- PC 1: auch die abgemeldete s8.
  perform pg_temp.pruefe(pg_temp.empfaenger('w1', 'wegfall') = 's7 s8', '#645 Empfänger: ' || pg_temp.empfaenger('w1', 'wegfall'));
  perform pg_temp.pruefe(pg_temp.empfaenger('w2') || pg_temp.empfaenger('w3') || pg_temp.empfaenger('w4') = '', '#645 still abgelegt');
  -- AK 2: der Termin vor dem Löschen; beim Spiel die Bezeichnung.
  perform pg_temp.pruefe(
    (select bool_and(inhalt = jsonb_build_object('team', 'Kraniche', 'art', 'training', 'bezeichnung', null,
                                                 'datum', to_char(heute_am_trainingsort() + 3, 'YYYY-MM-DD'),
                                                 'beginn', '18:00', 'ende', '19:30', 'ort', 'Halle'))
       from spieler_benachrichtigungen where termin_id = pg_temp.id('w1')),
    '#645 Inhalt einzeln: ' || (select string_agg(inhalt::text, ' ') from spieler_benachrichtigungen where termin_id = pg_temp.id('w1')));
  perform pg_temp.pruefe(
    (select bool_and(ereignis = 'wegfall' and inhalt ->> 'art' = 'spiel' and inhalt ->> 'bezeichnung' = 'Match Kraniche'
                     and inhalt ->> 'ort' = 'Schachen')
       from spieler_benachrichtigungen where termin_id = pg_temp.id('w5')), '#645 Inhalt Spiel');
  -- Erhalten ist erhalten: der Eintrag bleibt am Link, obwohl der Termin weg ist.
  perform pg_temp.pruefe(
    (select count(*) from jsonb_array_elements(a -> 'eintraege') e
      where e ->> 'ereignis' = 'wegfall' and e ->> 'termin_id' in (pg_temp.id('w1')::text, pg_temp.id('w5')::text)) = 2,
    '#645 am Link: ' || a::text);
end $$;

-- Eine Serie am Wochentag von morgen (d, w), von d bis d+21: d, d+7, d+14, d+21.
delete from spieler_benachrichtigungen where spieler_id in (pg_temp.id('s7'), pg_temp.id('s8'));
create function pg_temp.kt(p_tage int) returns uuid language sql stable as $$
  select t.id from training_termine t where t.team_id = pg_temp.id('tk') and t.serie_id is not null and t.datum = pg_temp.d(p_tage) $$;
grant execute on function pg_temp.kt(int) to authenticated;
select pg_temp.als(pg_temp.id('m'));
select terminserie_festlegen(pg_temp.id('tk'), array[(select w from serie_v)], pg_temp.d(0), pg_temp.d(21),
                             '18:00', '19:30', 'Allmend', null, '{}', pg_temp.id('m'));
-- Serie entfernen, Vorschau (AK 1): schreibt nichts, nennt `mitteilbar`.
do $$
declare
  v jsonb := terminserie_entfernen(pg_temp.kt(7), 'dieser_und_folgende', p_ausfuehren => false, p_benachrichtigen => true);
begin
  perform pg_temp.pruefe((v ->> 'mitteilbar')::int = 2 and not v ? 'benachrichtigt' and (v ->> 'entfallend_anzahl')::int = 3,
                         '#645 Vorschau: ' || v::text);
end $$;
select pg_temp.zurueck();
select pg_temp.pruefe(not exists (select 1 from pg_temp.kraniche('serie'))
                      and (select count(*) from training_termine where team_id = pg_temp.id('tk')) = 4, '#645 Vorschau abgelegt');

-- Serie ändern (PC 3): kürzer (bis d+7) und neue Zeit — EINE Zeile je
-- Spieler:in mit den neuen Angaben ab d und dem Wegfall von d+14 und d+21.
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(
  (terminserie_aendern(pg_temp.kt(0), 'alle', jsonb_build_object('end_datum', pg_temp.d(7), 'beginn', '17:00', 'ende', '18:30'),
                       p_benachrichtigen => true) ->> 'benachrichtigt')::int = 2, '#645 Serie ändern');
select pg_temp.zurueck();
do $$ begin
  perform pg_temp.pruefe((select count(*) from pg_temp.kraniche('serie')) = 2
                         and (select count(distinct vorgang) from pg_temp.kraniche('serie')) = 1, '#645 eine Zeile je Spieler:in');
  perform pg_temp.pruefe(
    (select bool_and(termin_id = pg_temp.kt(0)
                     and inhalt = jsonb_build_object('team', 'Kraniche', 'art', 'training',
                                                     'ab', to_char(pg_temp.d(0), 'YYYY-MM-DD'),
                                                     'angaben', jsonb_build_object('beginn', '17:00', 'ende', '18:30'),
                                                     'wegfall', jsonb_build_object('von', to_char(pg_temp.d(14), 'YYYY-MM-DD'),
                                                                                   'bis', to_char(pg_temp.d(21), 'YYYY-MM-DD'),
                                                                                   'wochentage', jsonb_build_array((select w from serie_v)),
                                                                                   'anzahl', 2)))
       from pg_temp.kraniche('serie')),
    '#645 Inhalt Verlegung und Wegfall: ' || (select string_agg(inhalt::text, ' ') from pg_temp.kraniche('serie')));
end $$;

-- Serie entfernen (AK 3; PC 2): d ist ausgefallen und zählt nicht; d+7 fällt weg.
delete from spieler_benachrichtigungen where spieler_id in (pg_temp.id('s7'), pg_temp.id('s8'));
update training_termine set ausgefallen = true where id = pg_temp.kt(0);
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe((terminserie_entfernen(pg_temp.kt(0), 'alle', p_benachrichtigen => true) ->> 'benachrichtigt')::int = 2,
                      '#645 Serie entfernen');
select pg_temp.zurueck();
select pg_temp.pruefe(
  (select bool_and(termin_id is null
                   and inhalt = jsonb_build_object('team', 'Kraniche', 'art', 'training', 'ab', null, 'angaben', null,
                                                   'wegfall', jsonb_build_object('von', to_char(pg_temp.d(7), 'YYYY-MM-DD'),
                                                                                 'bis', to_char(pg_temp.d(7), 'YYYY-MM-DD'),
                                                                                 'wochentage', jsonb_build_array((select w from serie_v)),
                                                                                 'anzahl', 1)))
     and count(*) = 2 from pg_temp.kraniche('serie')),
  '#645 Inhalt Serie entfernen: ' || (select string_agg(inhalt::text, ' ') from pg_temp.kraniche('serie')));

-- Ein Wochentag fällt weg: Serie an w und w2 (d bis d+13: d, d+1, d+7, d+8);
-- nur noch w — d+1 und d+8 fallen weg, nichts ist verlegt.
delete from spieler_benachrichtigungen where spieler_id in (pg_temp.id('s7'), pg_temp.id('s8'));
select pg_temp.als(pg_temp.id('m'));
select terminserie_festlegen(pg_temp.id('tk'), array[(select w from serie_v), (select w % 7 + 1 from serie_v)::smallint],
                             pg_temp.d(0), pg_temp.d(13), '18:00', '19:30', 'Allmend', null, '{}', pg_temp.id('m'));
select pg_temp.pruefe(
  (terminserie_aendern(pg_temp.kt(0), 'alle', jsonb_build_object('wochentage', array[(select w from serie_v)]),
                       p_benachrichtigen => true) ->> 'benachrichtigt')::int = 2, '#645 Wochentag weg');
select pg_temp.zurueck();
select pg_temp.pruefe(
  (select bool_and(inhalt -> 'angaben' = 'null'::jsonb and inhalt -> 'ab' = 'null'::jsonb
                   and inhalt -> 'wegfall' = jsonb_build_object('von', to_char(pg_temp.d(1), 'YYYY-MM-DD'),
                                                                'bis', to_char(pg_temp.d(8), 'YYYY-MM-DD'),
                                                                'wochentage', jsonb_build_array((select w % 7 + 1 from serie_v)),
                                                                'anzahl', 2))
     and count(*) = 2 from pg_temp.kraniche('serie')),
  '#645 Inhalt Wochentag weg: ' || (select string_agg(inhalt::text, ' ') from pg_temp.kraniche('serie')));

-- Team auflösen und Verein löschen (OoS 1): nichts wird abgelegt — auch
-- nicht kurz (ein Protokoll-Trigger zählt jede neue Zeile, bevor das
-- Löschen der Spieler:innen sie wieder mitnähme).
create temp table protokoll (n int);
grant insert on protokoll to public;
create function benachrichtigung_test_protokoll() returns trigger language plpgsql as $$
begin
  insert into pg_temp.protokoll values (1);
  return null;
end $$;
create trigger benachrichtigung_test_protokoll after insert on spieler_benachrichtigungen
  for each row execute function benachrichtigung_test_protokoll();
set local session_replication_role = replica;
insert into training_termine (id, team_id, datum, beginn, ende) values
  (gen_random_uuid(), pg_temp.id('tk'), heute_am_trainingsort() + 2, '18:00', '19:00'),
  (gen_random_uuid(), pg_temp.id('tm'), heute_am_trainingsort() + 2, '18:00', '19:00');
set local session_replication_role = origin;
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_team_aufloesen(pg_temp.id('tk'), 'Kraniche') ->> 'status' = 'aufgeloest', '#645 Team auflösen');
select pg_temp.pruefe(verein_loeschen(pg_temp.id('v'), 'Benachrichtigungs-Verein') ->> 'status' = 'geloescht', '#645 Verein löschen');
select pg_temp.zurueck();
select pg_temp.pruefe(not exists (select 1 from pg_temp.protokoll), '#645 Auflösen oder Löschen legte ab');

-- Rechte der neuen Bausteine.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    perform pg_temp.pruefe(not has_function_privilege(r, f, 'execute'), r || ' darf ' || f)
       from unnest(array['benachrichtigung_stand(uuid[])', 'benachrichtigung_serie_angaben(uuid)',
                         'benachrichtigung_verlegt(jsonb)', 'benachrichtigung_einzeln(jsonb)',
                         'benachrichtigung_serie(jsonb, boolean, jsonb, uuid)',
                         'benachrichtigung_weggefallen(jsonb)', 'benachrichtigung_serie_zeilen(jsonb, jsonb)']) f;
  end loop;
  perform pg_temp.pruefe(not has_function_privilege('anon', 'terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer, boolean)', 'execute')
                         and has_function_privilege('authenticated', 'terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer, boolean)', 'execute')
                         and not has_function_privilege('anon', 'termin_der_serie_folgen(uuid, text[], integer, boolean)', 'execute')
                         and has_function_privilege('authenticated', 'termin_der_serie_folgen(uuid, text[], integer, boolean)', 'execute'),
                         '#644 Rechte der Hüllen');
  perform pg_temp.pruefe(not has_function_privilege('anon', 'termin_entfernen(uuid, jsonb, boolean)', 'execute')
                         and has_function_privilege('authenticated', 'termin_entfernen(uuid, jsonb, boolean)', 'execute')
                         and not has_function_privilege('anon', 'terminserie_entfernen(uuid, text, integer, uuid[], boolean, boolean)', 'execute')
                         and has_function_privilege('authenticated', 'terminserie_entfernen(uuid, text, integer, uuid[], boolean, boolean)', 'execute'),
                         '#645 Rechte');
end $$;

rollback;
