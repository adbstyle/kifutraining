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

rollback;
