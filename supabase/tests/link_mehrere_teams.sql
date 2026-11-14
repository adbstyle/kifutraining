-- Privater Link, Kalender-Abo und Selbstabholung über mehrere Teams (Story 7
-- #583; Architekturplan Vereine §4.4, §6.7 Testfälle 13 und 23, §7.7–§7.9).
-- Die Rennen stehen in rennen.sql, der Bestand (PC 5) im Prod-Weg.
-- - Link: Termine aller Teams in der Ordnung der Datenbank (heute begonnene
--   zuerst, Datum, Beginn, Teamname), `team` je Termin, `teams` alphabetisch
--   auch ohne Termine, `verein`; Kader nur des Termin-Teams (AK 1–3, PC 1)
-- - ohne Team gültig und leer (AK 5); eine Spieler:in mit genau einem Team
--   behält jedes bisherige Feld, dazu nur die neuen Schlüssel
-- - Ab- und Anmelden nach den Regeln des Termin-Teams; `gilt_nicht` ohne
--   `stand` in beiden Ursachen, die Wege der Mitglieder behalten
--   `nicht_gefunden` (AK 6, 7)
-- - Abo mit `team` je Termin, ohne Team gültig und leer, bleibt beim
--   Herausnehmen und Auflösen (AK 8, 9, PC 3)
-- - Herausnehmen und Auflösen lassen die Termine des Teams verschwinden, auch
--   einen heute begonnenen, der Link bleibt gültig (PC 2, Testfall 13)
-- - Abholung über jedes Team mit eingeschalteter Abholung, «bezogen» in allen
--   Teams, Erneuern setzt zurück (AK 11, 14, PC 4)
-- - Link holen und erneuern am Team-Ort je Team; `abholbar` in beiden
--   Teams-Auskünften (AK 13, 16)
-- - Fragen und Feedback ohne Team, ohne gespeichertes Team, `ohne_team`
--   (AK 18, PC 6)
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
  if p_ok is not true then raise exception 'Story 7: %', p_text; end if;
end $$;

create function pg_temp.schluessel(p jsonb) returns text[]
language sql immutable as $$ select array(select k from jsonb_object_keys(p) k order by k) $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('v'), ('ta'), ('tb'), ('tg'), ('tf'), ('ma'), ('mb'), ('mf'), ('verw'),
  ('s'), ('e'), ('o'), ('ka'), ('kb'), ('kb2'),
  ('x0'), ('x1'), ('x2'), ('x3'), ('x4'), ('x5'), ('x6'), ('x7'), ('x8'), ('x9'), ('x10');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

create function pg_temp.link(p text) returns text language sql stable
as $$ select link_token from spieler where id = pg_temp.id(p) $$;
grant execute on function pg_temp.link(text) to authenticated;
-- Die Termin-IDs und Teams einer Ansicht bzw. eines Feeds, in Folge, als Namen.
create function pg_temp.termine(p jsonb) returns text language sql stable as $$
  select coalesce(string_agg((select name from ids where id = (e ->> 'id')::uuid) || ':' || coalesce(e ->> 'team', '–'),
                             ' ' order by n), '')
    from jsonb_array_elements(p -> 'termine') with ordinality x(e, n) $$;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@link-mehrere.test', now() from ids where name in ('ma', 'mb', 'mf', 'verw');

-- Verein «Link-Verein» mit den Teams Alpha, Beta, Gamma (ohne Termine) und
-- Fremd. Mitglieder: ma (Alpha), mb (Beta), mf (Fremd); Verwaltung verw.
insert into vereine (id, name) values (pg_temp.id('v'), 'Link-Verein');
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v'), pg_temp.id('verw'));
insert into teams (id, name, verein_id) values
  (pg_temp.id('tb'), 'Beta', pg_temp.id('v')), (pg_temp.id('ta'), 'Alpha', pg_temp.id('v')),
  (pg_temp.id('tg'), 'Gamma', pg_temp.id('v')), (pg_temp.id('tf'), 'Fremd', pg_temp.id('v'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('ta'), pg_temp.id('ma')), (pg_temp.id('tb'), pg_temp.id('mb')), (pg_temp.id('tf'), pg_temp.id('mf'));
-- Abholung: Alpha und Beta an, Gamma aus.
insert into team_abholung (team_id, aktiv) values (pg_temp.id('ta'), true), (pg_temp.id('tb'), true), (pg_temp.id('tg'), false);

-- Spieler:innen unter replica samt team_id wie der Trigger: s in Beta
-- (ältestes, also «erstes» Team), Alpha und Gamma; e nur in Alpha; o ohne Team.
set local session_replication_role = replica;
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('s'), pg_temp.id('tb'), pg_temp.id('v'), 'Sami', 'Mehrfach', 2014),
  (pg_temp.id('e'), pg_temp.id('ta'), pg_temp.id('v'), 'Eli', 'Einzeln', 2014),
  (pg_temp.id('o'), null, pg_temp.id('v'), 'Ole', 'Ohne', 2015);
insert into team_spieler (team_id, spieler_id, verein_id, created_at) values
  (pg_temp.id('tb'), pg_temp.id('s'), pg_temp.id('v'), now() - interval '2 days'),
  (pg_temp.id('ta'), pg_temp.id('s'), pg_temp.id('v'), now() - interval '1 day'),
  (pg_temp.id('tg'), pg_temp.id('s'), pg_temp.id('v'), now()),
  (pg_temp.id('ta'), pg_temp.id('e'), pg_temp.id('v'), now());
-- Termine: x0 (Alpha) und x1 (Beta) heute begonnen; am selben Tag x4 (Beta
-- 17:00), x3 (Beta 18:00, Kader K-Beta mit s, vor x2 angelegt) und x2 (Alpha
-- 18:00); x6 (Alpha, Kader K-Alpha ohne s); x5 Spiel Alpha mit abgelaufener
-- Frist, x9 Spiel Beta ohne Frist, x10 Spiel Beta mit Kader ohne s; x7
-- (Fremd) und x8 (Beta, gestern) nie.
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('x1'), pg_temp.id('tb'), heute_am_trainingsort(), '00:00', '23:59'),
  (pg_temp.id('x0'), pg_temp.id('ta'), heute_am_trainingsort(), '00:00', '23:59'),
  (pg_temp.id('x3'), pg_temp.id('tb'), heute_am_trainingsort() + 3, '18:00', '19:30'),
  (pg_temp.id('x2'), pg_temp.id('ta'), heute_am_trainingsort() + 3, '18:00', '19:30'),
  (pg_temp.id('x4'), pg_temp.id('tb'), heute_am_trainingsort() + 3, '17:00', '18:00'),
  (pg_temp.id('x6'), pg_temp.id('ta'), heute_am_trainingsort() + 1, '18:00', '19:30'),
  (pg_temp.id('x7'), pg_temp.id('tf'), heute_am_trainingsort() + 2, '18:00', '19:30'),
  (pg_temp.id('x8'), pg_temp.id('tb'), heute_am_trainingsort() - 1, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung, meldefrist_vorlauf_min) values
  (pg_temp.id('x5'), pg_temp.id('ta'), heute_am_trainingsort() + 5, '10:00', '12:00', 'spiel', 'Match Alpha', 10 * 24 * 60),
  (pg_temp.id('x9'), pg_temp.id('tb'), heute_am_trainingsort() + 6, '10:00', '12:00', 'spiel', 'Match Beta', null),
  (pg_temp.id('x10'), pg_temp.id('tb'), heute_am_trainingsort() + 7, '10:00', '12:00', 'spiel', 'Match Kader', null);
insert into kader (id, team_id, name) values
  (pg_temp.id('ka'), pg_temp.id('ta'), 'K-Alpha'), (pg_temp.id('kb'), pg_temp.id('tb'), 'K-Beta'),
  (pg_temp.id('kb2'), pg_temp.id('tb'), 'K-Beta-Zwei');
insert into kader_spieler (kader_id, spieler_id, team_id) values (pg_temp.id('kb'), pg_temp.id('s'), pg_temp.id('tb'));
insert into termin_kader (termin_id, kader_id, team_id) values
  (pg_temp.id('x3'), pg_temp.id('kb'), pg_temp.id('tb')), (pg_temp.id('x6'), pg_temp.id('ka'), pg_temp.id('ta')),
  (pg_temp.id('x10'), pg_temp.id('kb2'), pg_temp.id('tb'));
set local session_replication_role = origin;

-- ── Link: Termine aller Teams (AK 1–3, PC 1) ────────────────────────────────

do $$
declare
  v jsonb := spieler_link_ansicht(pg_temp.link('s'));
begin
  perform pg_temp.pruefe((v ->> 'gueltig')::boolean, 'Link s gültig');
  perform pg_temp.pruefe(pg_temp.termine(v) = 'x0:Alpha x1:Beta x4:Beta x2:Alpha x3:Beta x5:Alpha x9:Beta',
                         'Termine s: ' || pg_temp.termine(v));
  perform pg_temp.pruefe(v -> 'teams' = '["Alpha", "Beta", "Gamma"]', 'teams s: ' || (v -> 'teams')::text);
  perform pg_temp.pruefe(v ->> 'team' = 'Link-Verein' and v ->> 'verein' = 'Link-Verein', 'team/verein s: ' || v::text);
  perform pg_temp.pruefe((select e -> 'kader' from jsonb_array_elements(v -> 'termine') e
                           where e ->> 'id' = pg_temp.id('x3')::text) = '["K-Beta"]', 'Kader an x3');
  perform pg_temp.pruefe(v -> 'probe' = 'null' and v -> 'probe_info' = 'null', 'probe bei mehreren Teams');
end $$;

-- PC 1: Ein Termin mit Kadern erscheint erst, wenn s einem dieser Kader angehört.
insert into kader_spieler (kader_id, spieler_id, team_id) values (pg_temp.id('ka'), pg_temp.id('s'), pg_temp.id('ta'));
select pg_temp.pruefe(pg_temp.termine(spieler_link_ansicht(pg_temp.link('s')))
                      = 'x0:Alpha x1:Beta x6:Alpha x4:Beta x2:Alpha x3:Beta x5:Alpha x9:Beta',
                      'x6 nach dem Kader: ' || pg_temp.termine(spieler_link_ansicht(pg_temp.link('s'))));
delete from kader_spieler where kader_id = pg_temp.id('ka') and spieler_id = pg_temp.id('s');

-- Genau ein Team: Teamname wie bisher, bisherige Schlüssel unverändert, dazu
-- nur `teams`, `verein` und `team` je Termin.
do $$
declare
  v jsonb := spieler_link_ansicht(pg_temp.link('e'));
begin
  perform pg_temp.pruefe(v ->> 'team' = 'Alpha' and v -> 'teams' = '["Alpha"]' and v ->> 'verein' = 'Link-Verein',
                         'Link e: ' || v::text);
  perform pg_temp.pruefe(pg_temp.schluessel(v)
                         = array['gueltig', 'probe', 'probe_info', 'spieler', 'team', 'teams', 'termine', 'verein'],
                         'Schlüssel e: ' || pg_temp.schluessel(v)::text);
  perform pg_temp.pruefe(pg_temp.schluessel(v -> 'termine' -> 0)
                         = array['abgemeldet', 'angemeldet', 'art', 'aufgebot_verfallen', 'ausfall_grund', 'ausgefallen', 'beginn',
                                 'begonnen', 'bezeichnung', 'datum', 'ende', 'frist', 'frist_abgelaufen', 'gesamt',
                                 'hinweis_eltern', 'id', 'kader', 'meldung', 'meldung_verfallen', 'nicht_aufgeboten',
                                 'nicht_aufgeboten_zahl', 'ort', 'ort_link', 'richtwert_max', 'richtwert_min', 'team',
                                 'treffpunkt', 'treffpunkte', 'verantwortlich', 'verfallen', 'vorher'],
                         'Termin-Schlüssel e: ' || pg_temp.schluessel(v -> 'termine' -> 0)::text);
  perform pg_temp.pruefe(pg_temp.termine(v) = 'x0:Alpha x2:Alpha x5:Alpha', 'Termine e: ' || pg_temp.termine(v));
end $$;

-- AK 5: ohne Team gültig, ohne Teams und Termine.
select pg_temp.pruefe(spieler_link_ansicht(pg_temp.link('o'))
                      @> '{"gueltig": true, "team": "Link-Verein", "verein": "Link-Verein", "teams": [], "termine": []}',
                      'Link o: ' || spieler_link_ansicht(pg_temp.link('o'))::text);
select pg_temp.pruefe(spieler_link_ansicht(repeat('0', 64)) = '{"gueltig": false}', 'unbekannter Link');

-- ── Abo (AK 8, 9) ───────────────────────────────────────────────────────────

do $$
declare
  a text := spieler_abo_holen(pg_temp.link('s'));
  f jsonb;
begin
  f := spieler_abo_termine(a);
  perform pg_temp.pruefe(pg_temp.termine(f) = 'x0:Alpha x1:Beta x4:Beta x2:Alpha x3:Beta x5:Alpha x9:Beta',
                         'Abo s: ' || pg_temp.termine(f));
  perform pg_temp.pruefe(pg_temp.schluessel(f -> 'termine' -> 0)
                         = array['abgemeldet', 'art', 'beginn', 'begonnen', 'bezeichnung', 'datum', 'ende', 'frist_abgelaufen',
                                 'hinweis_eltern', 'id', 'meldung', 'nicht_aufgeboten', 'ort', 'ort_link', 'team',
                                 'treffpunkt', 'treffpunkte'],
                         'Abo-Schlüssel: ' || pg_temp.schluessel(f -> 'termine' -> 0)::text);
  perform pg_temp.pruefe(pg_temp.schluessel(f) = array['abo', 'gueltig', 'probe', 'team', 'termine'], 'Feed-Schlüssel');
  perform set_config('test.abo_s', a, true);
  -- Ohne Team gültig und leer.
  a := spieler_abo_holen(pg_temp.link('o'));
  f := spieler_abo_termine(a);
  perform pg_temp.pruefe(f ->> 'gueltig' = 'true' and f -> 'termine' = '[]', 'Abo o: ' || f::text);
  perform set_config('test.abo_o', a, true);
end $$;

-- ── Ab- und Anmelden nach dem Termin-Team (AK 6, 7) ─────────────────────────

do $$
declare
  t text := pg_temp.link('s');
  r jsonb;
begin
  r := spieler_link_abmelden(t, pg_temp.id('x4'), true, null, null);
  perform pg_temp.pruefe(r ->> 'status' = 'ok', 'Abmelden x4 (Beta): ' || r::text);
  r := spieler_link_abmelden(t, pg_temp.id('x2'), true, null, null);
  perform pg_temp.pruefe(r ->> 'status' = 'ok', 'Abmelden x2 (Alpha): ' || r::text);
  r := spieler_link_abmelden(t, pg_temp.id('x0'), true, null, null);
  perform pg_temp.pruefe(r ->> 'grund' = 'begonnen', 'Abmelden x0 begonnen: ' || r::text);
  r := spieler_link_abmelden(t, pg_temp.id('x6'), true, null, null);
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "gilt_nicht"}', 'x6 Kader: ' || r::text);
  r := spieler_link_abmelden(t, pg_temp.id('x7'), true, null, null);
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "gilt_nicht"}', 'x7 fremdes Team: ' || r::text);
  r := spieler_link_abmelden(t, gen_random_uuid(), true, null, null);
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "nicht_gefunden"}', 'unbekannter Termin: ' || r::text);
  r := spieler_link_abmelden(t, pg_temp.id('x9'), true, null, null);
  perform pg_temp.pruefe(r ->> 'grund' = 'ist_spiel', 'Spiel über abmelden: ' || r::text);
  r := spieler_link_abmelden(repeat('0', 64), pg_temp.id('x4'), true, null, null);
  perform pg_temp.pruefe(r = '{"status": "ungueltig"}', 'ungültiger Link: ' || r::text);
  -- Spiele: Frist von Alpha abgelaufen, Beta ohne Frist, Kader in Beta ohne s.
  r := spieler_link_melden(t, pg_temp.id('x5'), true, null, null);
  perform pg_temp.pruefe(r ->> 'grund' = 'frist_abgelaufen', 'Melden x5: ' || r::text);
  r := spieler_link_melden(t, pg_temp.id('x9'), true, null, null);
  perform pg_temp.pruefe(r ->> 'status' = 'ok', 'Melden x9: ' || r::text);
  r := spieler_link_melden(t, pg_temp.id('x10'), true, null, null);
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "gilt_nicht"}', 'Melden x10 Kader: ' || r::text);
  r := spieler_link_melden(t, pg_temp.id('x7'), true, null, null);
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "gilt_nicht"}', 'Melden x7 fremdes Team: ' || r::text);
  perform pg_temp.pruefe((select count(*) from termin_abmeldungen where spieler_id = pg_temp.id('s')) = 2
                         and (select count(*) from spiel_meldungen where spieler_id = pg_temp.id('s')) = 1,
                         'Meldungen von s');
end $$;

-- ── Abholung und «bezogen» (AK 11, 14) ──────────────────────────────────────

do $$
declare
  r jsonb;
  t text := pg_temp.link('s');
begin
  foreach r in array array[
    abholung_abholen((select token from team_abholung where team_id = pg_temp.id('ta')), repeat('a', 32), 'Sami', 'Mehrfach', 2014),
    abholung_abholen((select token from team_abholung where team_id = pg_temp.id('tb')), repeat('a', 32), 'sami', 'MEHRFACH', 2014)] loop
    perform pg_temp.pruefe(r ->> 'status' = 'ok' and r ->> 'token' = t, 'Abholung: ' || r::text);
  end loop;
  r := abholung_abholen((select token from team_abholung where team_id = pg_temp.id('tg')), repeat('a', 32), 'Sami', 'Mehrfach', 2014);
  perform pg_temp.pruefe(r = '{"status": "ungueltig"}', 'Abholung Gamma (aus): ' || r::text);
  r := abholung_abholen((select token from team_abholung where team_id = pg_temp.id('ta')), repeat('c', 32), 'Ole', 'Ohne', 2015);
  perform pg_temp.pruefe(r ->> 'status' = 'passt_nicht', 'Abholung ohne Team: ' || r::text);
  perform pg_temp.pruefe((select link_bezogen from spieler where id = pg_temp.id('s')), 'bezogen nach der Abholung');
end $$;

-- ── Teams-Auskünfte mit abholbar (AK 13, 16) ────────────────────────────────

select pg_temp.als(pg_temp.id('ma'));
select pg_temp.pruefe(spieler_teams(pg_temp.id('ta'), pg_temp.id('s')) -> 'teams'
                      = '[{"name": "Alpha", "eigen": true, "dieses": true, "abholbar": true},
                          {"name": "Beta", "eigen": false, "dieses": false, "abholbar": true},
                          {"name": "Gamma", "eigen": false, "dieses": false, "abholbar": false}]',
                      'spieler_teams: ' || (spieler_teams(pg_temp.id('ta'), pg_temp.id('s')) -> 'teams')::text);
select pg_temp.pruefe(length(spieler_teams(pg_temp.id('ta'), pg_temp.id('s')) ->> 'stand') = 32, 'stand');
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_spieler_teams(pg_temp.id('s'))
                      = jsonb_build_object('teams', jsonb_build_array(
                          jsonb_build_object('id', pg_temp.id('ta'), 'name', 'Alpha', 'abholbar', true),
                          jsonb_build_object('id', pg_temp.id('tb'), 'name', 'Beta', 'abholbar', true),
                          jsonb_build_object('id', pg_temp.id('tg'), 'name', 'Gamma', 'abholbar', false))),
                      'verein_spieler_teams: ' || verein_spieler_teams(pg_temp.id('s'))::text);
select pg_temp.pruefe(verein_spieler_teams(pg_temp.id('o')) = '{"teams": []}', 'verein_spieler_teams ohne Team');
reset role;

-- ── Link am Team-Ort je Team ────────────────────────────────────────────────

do $$
declare
  t text := pg_temp.link('s');
  neu text;
  r jsonb;
begin
  perform pg_temp.pruefe(to_regprocedure('spieler_link_holen(uuid)') is null
                         and to_regprocedure('spieler_link_erneuern(uuid)') is null, 'Ein-Argument-Fassungen bestehen');
  perform pg_temp.pruefe(not has_function_privilege('anon', 'spieler_link_holen(uuid,uuid)', 'execute')
                         and not has_function_privilege('anon', 'spieler_link_erneuern(uuid,uuid)', 'execute')
                         and has_function_privilege('authenticated', 'spieler_link_holen(uuid,uuid)', 'execute')
                         and has_function_privilege('authenticated', 'spieler_link_erneuern(uuid,uuid)', 'execute'),
                         'Rechte der Link-RPCs');
  perform pg_temp.als(pg_temp.id('ma'));
  perform pg_temp.pruefe(spieler_link_holen(pg_temp.id('ta'), pg_temp.id('s')) = t, 'holen in Alpha');
  perform pg_temp.erwarte(format('select spieler_link_holen(%L, %L)', pg_temp.id('tb'), pg_temp.id('s')), 'SPIELER_NICHT_GEFUNDEN');
  perform pg_temp.erwarte(format('select spieler_link_erneuern(%L, %L)', pg_temp.id('tb'), pg_temp.id('s')), 'SPIELER_NICHT_GEFUNDEN');
  perform pg_temp.erwarte(format('select spieler_link_holen(%L, %L)', pg_temp.id('ta'), pg_temp.id('o')), 'SPIELER_NICHT_GEFUNDEN');
  perform pg_temp.als(pg_temp.id('mf'));
  perform pg_temp.erwarte(format('select spieler_link_holen(%L, %L)', pg_temp.id('tf'), pg_temp.id('s')), 'SPIELER_NICHT_GEFUNDEN');
  perform pg_temp.erwarte(format('select spieler_link_erneuern(%L, %L)', pg_temp.id('tf'), pg_temp.id('s')), 'SPIELER_NICHT_GEFUNDEN');
  perform pg_temp.als(pg_temp.id('mb'));
  perform pg_temp.pruefe(spieler_link_holen(pg_temp.id('tb'), pg_temp.id('s')) = t, 'holen in Beta');
  -- Erneuern in Beta: «bezogen» fällt für alle Teams, das Abo endet,
  -- Abmeldungen bleiben, beide Abholadressen liefern den neuen Link.
  neu := spieler_link_erneuern(pg_temp.id('tb'), pg_temp.id('s'));
  perform set_config('test.alt_s', t, true);
  reset role;
  perform pg_temp.pruefe(neu <> t and pg_temp.link('s') = neu and not (select link_bezogen from spieler where id = pg_temp.id('s')),
                         'Erneuern in Beta');
  perform pg_temp.pruefe(spieler_link_ansicht(t) = '{"gueltig": false}', 'alter Link gilt');
  perform pg_temp.pruefe(spieler_abo_termine(current_setting('test.abo_s')) = '{"gueltig": false}', 'Abo nach dem Erneuern');
  perform pg_temp.pruefe((select count(*) from termin_abmeldungen where spieler_id = pg_temp.id('s')) = 2, 'Abmeldungen weg');
  r := abholung_abholen((select token from team_abholung where team_id = pg_temp.id('ta')), repeat('a', 32), 'Sami', 'Mehrfach', 2014);
  perform pg_temp.pruefe(r ->> 'token' = neu and (select link_bezogen from spieler where id = pg_temp.id('s')),
                         'Abholung nach dem Erneuern: ' || r::text);
  -- Neues Abo für die weiteren Fälle.
  perform set_config('test.abo_s', spieler_abo_holen(neu), true);
end $$;

-- ── Fragen und Feedback über den Link (AK 18, PC 6) ─────────────────────────

do $$
declare
  t text;
  r jsonb;
  d uuid;
  n int := (select count(*) from feedback);
begin
  perform pg_temp.pruefe(to_regprocedure('feedback_link_team(text)') is null, 'feedback_link_team besteht');
  perform pg_temp.pruefe(not has_function_privilege('anon', 'feedback_link_gueltig(text)', 'execute')
                         and not has_function_privilege('authenticated', 'feedback_link_gueltig(text)', 'execute'),
                         'feedback_link_gueltig mit API-Recht');
  foreach t in array array['s', 'o'] loop
    r := feedback_link_beginnen(pg_temp.link(t));
    perform pg_temp.pruefe(r ->> 'status' = 'ok' and (r ->> 'ohne_team')::boolean = (t = 'o'), 'beginnen ' || t || ': ' || r::text);
    d := (r ->> 'dialog')::uuid;
    r := feedback_link_zaehlen(pg_temp.link(t), d);
    perform pg_temp.pruefe(r ->> 'status' = 'ok' and (r ->> 'ohne_team')::boolean = (t = 'o'), 'zaehlen ' || t || ': ' || r::text);
    perform feedback_link_vermerken(pg_temp.link(t), d);
    r := feedback_link_ablegen(pg_temp.link(t), d, 'frage', 'Frage ' || t, '[]', '[]', '/abmelden', '1.0', 'test', 'psql');
    perform pg_temp.pruefe(r = '{"status": "ok"}', 'ablegen ' || t || ': ' || r::text);
  end loop;
  perform pg_temp.pruefe((select count(*) from feedback) = n + 2
                         and not exists (select 1 from feedback where titel in ('Frage s', 'Frage o')
                                                                  and (team_id is not null or user_id is not null
                                                                       or rolle <> 'spielervertretung')),
                         'Feedback ohne Team gespeichert');
  -- Erneuert bzw. unbekannt: ungültig.
  foreach t in array array[current_setting('test.alt_s'), repeat('0', 64), 'kein-token'] loop
    perform pg_temp.pruefe(feedback_link_beginnen(t) = '{"status": "ungueltig"}', 'beginnen ungültig');
    perform pg_temp.pruefe(feedback_link_zaehlen(t, d) = '{"status": "ungueltig"}', 'zaehlen ungültig');
  end loop;
end $$;

-- ── Herausnehmen und Auflösen (PC 2, PC 3, AK 7, Testfall 13) ───────────────

select pg_temp.als(pg_temp.id('ma'));
select pg_temp.pruefe(spieler_aus_team_nehmen(pg_temp.id('ta'), pg_temp.id('s'),
                        spieler_teams(pg_temp.id('ta'), pg_temp.id('s')) ->> 'stand') ->> 'status' = 'herausgenommen',
                      's aus Alpha nehmen');
-- Nicht mehr in Alpha: weder holen noch erneuern.
select pg_temp.erwarte(format('select spieler_link_holen(%L, %L)', pg_temp.id('ta'), pg_temp.id('s')), 'SPIELER_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select spieler_link_erneuern(%L, %L)', pg_temp.id('ta'), pg_temp.id('s')), 'SPIELER_NICHT_GEFUNDEN');
-- Der Weg der Mitglieder behält nicht_gefunden.
select pg_temp.pruefe(termin_abmeldung_setzen(pg_temp.id('x2'), pg_temp.id('s'), true) ->> 'grund' = 'nicht_gefunden',
                      'Mitglied: Abmelden nach dem Herausnehmen');
select pg_temp.pruefe(termin_meldung_setzen(pg_temp.id('x5'), pg_temp.id('s'), true, null, null) ->> 'grund' = 'nicht_gefunden',
                      'Mitglied: Melden nach dem Herausnehmen');
reset role;
do $$
declare
  t text := pg_temp.link('s');
  v jsonb := spieler_link_ansicht(t);
  r jsonb;
begin
  -- x0 ist heute begonnen und mit s festgehalten, erscheint aber nicht mehr.
  perform pg_temp.pruefe(exists (select 1 from termin_teilnahmen where termin_id = pg_temp.id('x0') and spieler_id = pg_temp.id('s')),
                         'x0 nicht festgehalten');
  perform pg_temp.pruefe((v ->> 'gueltig')::boolean and v -> 'teams' = '["Beta", "Gamma"]'
                         and pg_temp.termine(v) = 'x1:Beta x4:Beta x3:Beta x9:Beta',
                         'Link nach dem Herausnehmen: ' || pg_temp.termine(v) || ' ' || (v -> 'teams')::text);
  perform pg_temp.pruefe(pg_temp.termine(spieler_abo_termine(current_setting('test.abo_s'))) = 'x1:Beta x4:Beta x3:Beta x9:Beta',
                         'Abo nach dem Herausnehmen');
  perform pg_temp.pruefe(not exists (select 1 from termin_abmeldungen where spieler_id = pg_temp.id('s') and termin_id = pg_temp.id('x2')),
                         'Abmeldung in Alpha nicht verfallen');
  r := spieler_link_abmelden(t, pg_temp.id('x2'), false, null, null);
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "gilt_nicht"}', 'Abmelden Alpha nach dem Herausnehmen: ' || r::text);
  r := spieler_link_melden(t, pg_temp.id('x5'), true, null, null);
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "gilt_nicht"}', 'Melden Alpha nach dem Herausnehmen: ' || r::text);
  r := spieler_link_abmelden(t, pg_temp.id('x4'), false, null, null);
  perform pg_temp.pruefe(r ->> 'status' = 'ok', 'Beta nach dem Herausnehmen: ' || r::text);
  perform pg_temp.pruefe(not exists (select 1 from termin_abmeldungen a where a.spieler_id = pg_temp.id('s')
                                       and not exists (select 1 from team_spieler ts where ts.spieler_id = a.spieler_id
                                                                                    and ts.team_id = a.team_id)),
                         'Meldung ohne Zuordnung');
end $$;

-- Beta auflösen: Termine von Beta weg (auch der heute begonnene), Link und
-- Abo gelten; dann aus Gamma nehmen: ohne Team gültig und leer.
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_team_aufloesen(pg_temp.id('tb'), 'Beta') ->> 'status' = 'aufgeloest', 'Beta auflösen');
reset role;
select pg_temp.pruefe(spieler_link_ansicht(pg_temp.link('s')) @> '{"gueltig": true, "teams": ["Gamma"], "termine": []}'
                      and spieler_link_ansicht(pg_temp.link('s')) ->> 'team' = 'Gamma',
                      'Link nach dem Auflösen: ' || spieler_link_ansicht(pg_temp.link('s'))::text);
select pg_temp.pruefe(spieler_abo_termine(current_setting('test.abo_s')) @> '{"gueltig": true, "termine": []}',
                      'Abo nach dem Auflösen');
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_spieler_aus_team_nehmen(pg_temp.id('tg'), pg_temp.id('s')) ->> 'status' = 'herausgenommen',
                      's aus Gamma nehmen');
reset role;
select pg_temp.pruefe(spieler_link_ansicht(pg_temp.link('s'))
                      @> '{"gueltig": true, "team": "Link-Verein", "teams": [], "termine": []}', 'Link ohne Team');
select pg_temp.pruefe(spieler_abo_termine(current_setting('test.abo_s')) @> '{"gueltig": true, "termine": []}',
                      'Abo ohne Team');
select pg_temp.pruefe(feedback_link_beginnen(pg_temp.link('s')) @> '{"status": "ok", "ohne_team": true}', 'Feedback ohne Team');

-- AK 9, PC 1: o wird Alpha zugeordnet; dieselbe Abo-Adresse liefert dessen
-- Termine (x6 nur mit Kader, also nicht; x0 ist begonnen und ohne o
-- festgehalten, also auch nicht).
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_spieler_zuordnen(pg_temp.id('ta'), array[pg_temp.id('o')]) is not null, 'o zuordnen');
reset role;
select pg_temp.pruefe(pg_temp.termine(spieler_abo_termine(current_setting('test.abo_o'))) = 'x2:Alpha x5:Alpha',
                      'Abo o nach dem Zuordnen: ' || pg_temp.termine(spieler_abo_termine(current_setting('test.abo_o'))));

rollback;
