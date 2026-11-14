-- Vereinsverwaltung führt den Spielerbestand (Story 6 #582; Architekturplan
-- Vereine §4.3 «Spielerbestand am Verein-Ort», §6.7 Testfälle 12 Teil
-- Verwaltung und 30 Teil verein_spieler_entfernen). Was psql braucht
-- (Altdaten unter `replica`, Rollenwechsel wie PostgREST, Funktionstexte);
-- die Rennen stehen in rennen.sql.
-- - Recht je neuer RPC: Mitglied ohne Verwaltung, Verwaltung eines anderen
--   Vereins, Konto ohne Verein, Spieler:in eines anderen Vereins, unbekannt
--   → SPIELER_NICHT_GEFUNDEN (p_spieler) bzw. VEREIN_NICHT_GEFUNDEN (p_verein)
-- - AK 14 und Review Focus 4: Kein Team-Weg erreicht eine Spieler:in ohne
--   Team, auch nicht für ein Konto mit beiden Rollen; am Team-Ort löscht
--   niemand
-- - verein_spielerliste mit J+S und Link-Stand (AK 1, 8), verein_ansicht mit
--   den Zahlen der Verwaltung (Zettel A1.2)
-- - Erfassen ohne Team (AK 3), doppelt mit Teams bzw. ohne Team (AK 4),
--   Grenze 1000 samt Spieler:innen ohne Team, Doppel vor Grenze (AK 6, 7)
-- - Ändern ohne Mitgliedschaft (AK 2), doppelt (AK 5), Altdubletten
-- - Link abrufen und erneuern, auch ohne Team (AK 9–11)
-- - Teams für die Bestätigung, Löschen samt Folgen (AK 12, 13, #579 PC 10,
--   11), danach SPIELER_NICHT_GEFUNDEN (AK 15)
-- - Testfall 30: KI-Token löscht nicht
-- - Nur verein_spieler_entfernen löscht Spieler:innen; link_token nur über
--   die zwei Link-RPCs
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
  if p_ok is not true then raise exception 'Story 6: %', p_text; end if;
end $$;

create function pg_temp.schluessel(p jsonb) returns text[]
language sql immutable as $$ select array(select k from jsonb_object_keys(p) k order by k) $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('verw'), ('verw2'), ('a'), ('b'), ('c'), ('wverw'), ('ohne'),
  ('v'), ('w'), ('t1'), ('t2'), ('tw'),
  ('s1'), ('s3'), ('sb'), ('x'), ('x2'), ('d1'), ('d2'), ('sw'), ('sw2'),
  ('tr1_zukunft'), ('tr1_begonnen'), ('tr2_vorbei'), ('sp1'), ('k1');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@spielerbestand.test', now() from ids
 where name in ('verw', 'verw2', 'a', 'b', 'c', 'wverw', 'ohne');

-- Verein V: Verwaltung verw (ohne Team) und verw2 (auch Mitglied in T1),
-- Mitglieder a (T1) und b (T2). Verein W: Verwaltung wverw, c in TW.
insert into vereine (id, name) values (pg_temp.id('v'), 'Bestand-Verein'), (pg_temp.id('w'), 'Anderer Verein');
insert into verein_verwaltung (verein_id, user_id) values
  (pg_temp.id('v'), pg_temp.id('verw')), (pg_temp.id('v'), pg_temp.id('verw2')), (pg_temp.id('w'), pg_temp.id('wverw'));
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Team Eins', pg_temp.id('v')), (pg_temp.id('t2'), 'Team Zwei', pg_temp.id('v')),
  (pg_temp.id('tw'), 'Team W', pg_temp.id('w'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t1'), pg_temp.id('verw2')), (pg_temp.id('t2'), pg_temp.id('b')),
  (pg_temp.id('tw'), pg_temp.id('c'));

-- Spieler:innen unter replica samt team_id wie die Trigger: s1 nur T1 (mit
-- J+S), s3 in T1 und T2, sb nur T2, x und x2 ohne Team, Altdublette d1 (T1)
-- und d2 (T2) mit gleichem Schlüssel; sw (TW) mit dem Schlüssel von s3 und
-- sw2 (ohne Team) im Verein W.
set local session_replication_role = replica;
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang, js_nummer) values
  (pg_temp.id('s1'), pg_temp.id('t1'), pg_temp.id('v'), 'Sara', 'Eins', 2015, '9876543'),
  (pg_temp.id('s3'), pg_temp.id('t1'), pg_temp.id('v'), 'Sina', 'Beide', 2014, null),
  (pg_temp.id('sb'), pg_temp.id('t2'), pg_temp.id('v'), 'Ben', 'Zwei', 2014, null),
  (pg_temp.id('x'), null, pg_temp.id('v'), 'Xaver', 'Ohne', 2016, null),
  (pg_temp.id('x2'), null, pg_temp.id('v'), 'Xenia', 'Ohne', 2016, null),
  (pg_temp.id('d1'), pg_temp.id('t1'), pg_temp.id('v'), 'Lea', 'Dublette', 2017, null),
  (pg_temp.id('d2'), pg_temp.id('t2'), pg_temp.id('v'), 'Lea', 'Dublette', 2017, null),
  (pg_temp.id('sw'), pg_temp.id('tw'), pg_temp.id('w'), 'Sina', 'Beide', 2014, null),
  (pg_temp.id('sw2'), null, pg_temp.id('w'), 'Wanda', 'Fremd', 2015, null);
insert into team_spieler (team_id, spieler_id, verein_id) values
  (pg_temp.id('t1'), pg_temp.id('s1'), pg_temp.id('v')),
  (pg_temp.id('t1'), pg_temp.id('s3'), pg_temp.id('v')),
  (pg_temp.id('t2'), pg_temp.id('s3'), pg_temp.id('v')),
  (pg_temp.id('t2'), pg_temp.id('sb'), pg_temp.id('v')),
  (pg_temp.id('t1'), pg_temp.id('d1'), pg_temp.id('v')),
  (pg_temp.id('t2'), pg_temp.id('d2'), pg_temp.id('v')),
  (pg_temp.id('tw'), pg_temp.id('sw'), pg_temp.id('w'));
-- Termine: künftig (T1, mit Abmeldungen von s1 und s3 und einem
-- Statuswechsel von s3), begonnen und noch nicht festgehalten (T1 gestern,
-- T2 vorgestern), ein Spiel (T1) mit Meldung von s3.
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tr1_zukunft'), pg_temp.id('t1'), current_date + 7, '18:00', '19:30'),
  (pg_temp.id('tr1_begonnen'), pg_temp.id('t1'), current_date - 1, '18:00', '19:30'),
  (pg_temp.id('tr2_vorbei'), pg_temp.id('t2'), current_date - 2, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (pg_temp.id('sp1'), pg_temp.id('t1'), current_date + 9, '10:00', '12:00', 'spiel', 'Match');
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (pg_temp.id('tr1_zukunft'), pg_temp.id('s1'), pg_temp.id('t1'), false),
  (pg_temp.id('tr1_zukunft'), pg_temp.id('s3'), pg_temp.id('t1'), false);
insert into termin_statuswechsel (termin_id, spieler_id, team_id) values
  (pg_temp.id('tr1_zukunft'), pg_temp.id('s3'), pg_temp.id('t1'));
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am) values
  (pg_temp.id('sp1'), pg_temp.id('s3'), pg_temp.id('t1'), 'abgemeldet', now());
insert into kader (id, team_id, name) values (pg_temp.id('k1'), pg_temp.id('t1'), 'Kader Eins');
insert into kader_spieler (kader_id, spieler_id, team_id) values (pg_temp.id('k1'), pg_temp.id('s3'), pg_temp.id('t1'));
insert into spieler_abos (spieler_id) values (pg_temp.id('s1')), (pg_temp.id('s3')), (pg_temp.id('x'));
set local session_replication_role = origin;

-- ── Recht je neuer RPC ──────────────────────────────────────────────────────

do $$
declare
  ziel text;
  wer text;
  x text;
  aufrufe text[];
begin
  -- Mitglied ohne Verwaltung, Verwaltung eines anderen Vereins, Konto ohne Verein.
  foreach wer in array array['a', 'wverw', 'ohne'] loop
    perform pg_temp.als(pg_temp.id(wer));
    foreach ziel in array array['s1', 'x'] loop
      foreach x in array array[
        format($s$select verein_spieler_aendern(%L, 'Recht', 'Recht', 2015, null)$s$, pg_temp.id(ziel)),
        format('select verein_spieler_entfernen(%L)', pg_temp.id(ziel)),
        format('select verein_spieler_teams(%L)', pg_temp.id(ziel)),
        format('select verein_spieler_link_holen(%L)', pg_temp.id(ziel)),
        format('select verein_spieler_link_erneuern(%L)', pg_temp.id(ziel))] loop
        perform pg_temp.erwarte(x, 'SPIELER_NICHT_GEFUNDEN');
      end loop;
    end loop;
    perform pg_temp.erwarte(format($s$select verein_spieler_anlegen(%L, 'Recht', 'Recht', 2015, null)$s$, pg_temp.id('v')),
                            'VEREIN_NICHT_GEFUNDEN');
    perform pg_temp.erwarte(format('select verein_spielerliste(%L)', pg_temp.id('v')), 'VEREIN_NICHT_GEFUNDEN');
    reset role;
  end loop;
  -- Die Verwaltung von V: Spieler:in eines anderen Vereins, unbekannt, null.
  perform pg_temp.als(pg_temp.id('verw'));
  foreach x in array array[pg_temp.id('sw')::text, pg_temp.id('sw2')::text, gen_random_uuid()::text] loop
    foreach ziel in array array[
      format($s$select verein_spieler_aendern(%L, 'Recht', 'Recht', 2015, null)$s$, x),
      format('select verein_spieler_entfernen(%L)', x),
      format('select verein_spieler_teams(%L)', x),
      format('select verein_spieler_link_holen(%L)', x),
      format('select verein_spieler_link_erneuern(%L)', x)] loop
      perform pg_temp.erwarte(ziel, 'SPIELER_NICHT_GEFUNDEN');
    end loop;
  end loop;
  perform pg_temp.erwarte('select verein_spieler_entfernen(null)', 'SPIELER_NICHT_GEFUNDEN');
  perform pg_temp.erwarte(format($s$select verein_spieler_anlegen(%L, 'Recht', 'Recht', 2015, null)$s$, pg_temp.id('w')),
                          'VEREIN_NICHT_GEFUNDEN');
  perform pg_temp.erwarte($s$select verein_spieler_anlegen(null, 'Recht', 'Recht', 2015, null)$s$, 'VEREIN_NICHT_GEFUNDEN');
  reset role;
  perform pg_temp.pruefe((select count(*) from spieler where nachname = 'Recht') = 0, 'abgewiesene Aufrufe legten an');
  perform pg_temp.pruefe((select count(*) from spieler where verein_id in (pg_temp.id('v'), pg_temp.id('w'))) = 9,
                         'abgewiesene Aufrufe löschten');
  perform pg_temp.pruefe((select js_nummer from spieler where id = pg_temp.id('s1')) = '9876543'
                         and exists (select 1 from spieler_abos where spieler_id = pg_temp.id('s1')),
                         'abgewiesene Aufrufe änderten oder erneuerten');
end $$;

-- ── AK 14, Review Focus 4: kein Team-Weg zu Spieler:innen ohne Team ─────────

-- a (Mitglied T1) und verw2 (Verwaltung und Mitglied T1) erreichen x über
-- keine Team-RPC und sehen x nicht; verw2 erreicht auch sb (nur T2) nicht.
-- Am Team-Ort gibt es kein Löschen, und direkt darf niemand löschen.
do $$
declare
  wer text;
  ziel record;
  x text;
begin
  foreach wer in array array['a', 'verw2'] loop
    perform pg_temp.als(pg_temp.id(wer));
    for ziel in select * from (values ('x', 't1'), ('sb', 't1'), ('sb', 't2')) z(spieler, team)
                 where z.spieler = 'x' or wer = 'verw2' loop
      foreach x in array array[
        format($s$select spieler_aendern(%L, %L, 'Team', 'Weg', 2015, '1')$s$, pg_temp.id(ziel.team), pg_temp.id(ziel.spieler)),
        format('select spieler_link_holen(%L)', pg_temp.id(ziel.spieler)),
        format('select spieler_link_erneuern(%L)', pg_temp.id(ziel.spieler)),
        format($s$select spieler_aus_team_nehmen(%L, %L, 'x')$s$, pg_temp.id(ziel.team), pg_temp.id(ziel.spieler)),
        format('select spieler_teams(%L, %L)', pg_temp.id(ziel.team), pg_temp.id(ziel.spieler)),
        format('select spieler_probe_folgen(%L)', pg_temp.id(ziel.spieler)),
        format('select spieler_probe_setzen(%L, true)', pg_temp.id(ziel.spieler))] loop
        perform pg_temp.erwarte(x, 'SPIELER_NICHT_GEFUNDEN');
      end loop;
    end loop;
    perform pg_temp.pruefe(not exists (select 1 from spieler where id in (pg_temp.id('x'), pg_temp.id('x2'))),
                           wer || ' sieht Spieler:innen ohne Team');
    perform pg_temp.erwarte(format('delete from spieler where id = %L', pg_temp.id('s1')), '42501');
    perform pg_temp.erwarte(format('delete from spieler where id = %L', pg_temp.id('x')), '42501');
    reset role;
  end loop;
  perform pg_temp.pruefe(to_regproc('spieler_entfernen') is null and to_regproc('spieler_loeschen') is null,
                         'eine Lösch-RPC am Team-Ort besteht');
  perform pg_temp.pruefe((select count(*) from spieler where verein_id = pg_temp.id('v')) = 7
                         and (select nachname from spieler where id = pg_temp.id('x')) = 'Ohne'
                         and (select nachname from spieler where id = pg_temp.id('sb')) = 'Zwei',
                         'ein Team-Weg änderte oder löschte');
  -- Dasselbe Konto löscht über den Verein-Ort.
  perform pg_temp.als(pg_temp.id('verw2'));
  perform pg_temp.pruefe(verein_spieler_entfernen(pg_temp.id('x2')) = '{"status": "geloescht", "teams": []}',
                         'verw2 löscht nicht über den Verein-Ort');
  reset role;
  perform pg_temp.pruefe(not exists (select 1 from spieler where id = pg_temp.id('x2')), 'x2 nicht gelöscht');
end $$;

-- ── verein_spielerliste (AK 1, 8) und verein_ansicht (Zahlen) ───────────────

select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  l jsonb := verein_spielerliste(pg_temp.id('v'));
  s jsonb;
  v jsonb := verein_ansicht(pg_temp.id('v'));
begin
  perform pg_temp.pruefe(jsonb_array_length(l -> 'spieler') = 6, 'Liste: Anzahl ' || l::text);
  for s in select * from jsonb_array_elements(l -> 'spieler') loop
    perform pg_temp.pruefe(pg_temp.schluessel(s) = array['id', 'jahrgang', 'js', 'link_bezogen', 'nachname', 'teams', 'vorname'],
                           'Liste: Schlüssel ' || s::text);
  end loop;
  select e into s from jsonb_array_elements(l -> 'spieler') e where e ->> 'id' = pg_temp.id('s1')::text;
  perform pg_temp.pruefe(s ->> 'js' = '9876543' and s -> 'link_bezogen' = 'false', 'Liste: s1 ' || s::text);
  select e into s from jsonb_array_elements(l -> 'spieler') e where e ->> 'id' = pg_temp.id('x')::text;
  perform pg_temp.pruefe(s -> 'js' = 'null' and s -> 'teams' = '[]', 'Liste: x ' || s::text);
  -- Zahlen der Verwaltung: alle 6 Spieler:innen von V, davon x ohne Team.
  perform pg_temp.pruefe(pg_temp.schluessel(v) = array['name', 'spieler_ohne_team', 'spieler_zahl', 'teams', 'verwaltung'],
                         'Ansicht Verwaltung: Schlüssel ' || pg_temp.schluessel(v)::text);
  perform pg_temp.pruefe(v -> 'spieler_zahl' = '6' and v -> 'spieler_ohne_team' = '1',
                         'Ansicht Verwaltung: Zahlen ' || (v -> 'spieler_zahl')::text || '/' || (v -> 'spieler_ohne_team')::text);
end $$;
reset role;
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(pg_temp.schluessel(verein_ansicht(pg_temp.id('v'))) = array['name', 'teams', 'verwaltung'],
                      'Ansicht Mitglied zeigt Zahlen der Verwaltung');
reset role;
-- Link-Stand in der Liste.
update spieler set link_bezogen = true where id = pg_temp.id('s1');
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe((select e -> 'link_bezogen' from jsonb_array_elements(verein_spielerliste(pg_temp.id('v')) -> 'spieler') e
                        where e ->> 'id' = pg_temp.id('s1')::text) = 'true', 'Liste: link_bezogen');
reset role;

-- ── Erfassen (AK 3, 4) ──────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  r jsonb;
begin
  r := verein_spieler_anlegen(pg_temp.id('v'), '  Nora  ', ' Neu ', 2016, ' 123 ');
  perform pg_temp.pruefe(pg_temp.schluessel(r) = array['id', 'status'] and r ->> 'status' = 'angelegt', 'Anlegen: ' || r::text);
  perform set_config('test.nora', r ->> 'id', true);
  -- AK 4 mit Teams, ohne Team, Altdublette; nie IDs, J+S oder Link.
  r := verein_spieler_anlegen(pg_temp.id('v'), 'sina', 'BEIDE', 2014, '1');
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "doppelt", "teams": ["Team Eins", "Team Zwei"], "ohne_team": false}',
                         'doppelt mit Teams: ' || r::text);
  r := verein_spieler_anlegen(pg_temp.id('v'), 'Xaver', 'Ohne', 2016, null);
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "doppelt", "teams": [], "ohne_team": true}',
                         'doppelt ohne Team: ' || r::text);
  r := verein_spieler_anlegen(pg_temp.id('v'), 'Lea', 'Dublette', 2017, null);
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "doppelt", "teams": ["Team Eins", "Team Zwei"], "ohne_team": false}',
                         'doppelt Altdublette: ' || r::text);
  -- PC 2: Ein Schlüssel aus einem anderen Verein stört nicht.
  r := verein_spieler_anlegen(pg_temp.id('v'), 'Wanda', 'Fremd', 2015, null);
  perform pg_temp.pruefe(r ->> 'status' = 'angelegt', 'Schlüssel eines anderen Vereins: ' || r::text);
  -- Ungültige Angaben wie am Team-Ort (Constraints).
  perform pg_temp.erwarte(format($s$select verein_spieler_anlegen(%L, '  ', 'Leer', 2015, null)$s$, pg_temp.id('v')), '23514');
  perform pg_temp.erwarte(format($s$select verein_spieler_anlegen(%L, 'Alt', 'Alt', 999, null)$s$, pg_temp.id('v')), '23514');
  perform pg_temp.erwarte(format($s$select verein_spieler_anlegen(%L, 'Lang', 'Lang', 2015, %L)$s$, pg_temp.id('v'), repeat('9', 21)),
                          '23514');
end $$;
reset role;
do $$
declare
  neu spieler;
begin
  select * into neu from spieler where id = current_setting('test.nora')::uuid;
  perform pg_temp.pruefe(neu.verein_id = pg_temp.id('v') and neu.team_id is null and neu.vorname = 'Nora'
                         and neu.nachname = 'Neu' and neu.jahrgang = 2016 and neu.js_nummer = '123'
                         and neu.link_token is not null and not neu.link_bezogen,
                         'Anlegen: Zeile falsch');
  perform pg_temp.pruefe(not exists (select 1 from team_spieler where spieler_id = neu.id), 'Anlegen: mit Zuordnung');
  perform pg_temp.pruefe((select count(*) from spieler where verein_id = pg_temp.id('v')) = 8, 'Anlegen: Anzahl im Verein');
end $$;

-- ── Grenze 1000 (AK 6, 7), Doppel vor Grenze ────────────────────────────────

savepoint grenze;
-- Auf 999 auffüllen, alle ohne Team.
set local session_replication_role = replica;
insert into spieler (verein_id, vorname, nachname, jahrgang)
select pg_temp.id('v'), 'Voll', 'Nr ' || i, 2015
  from generate_series(1, 999 - (select count(*) from spieler where verein_id = pg_temp.id('v'))) i;
set local session_replication_role = origin;
select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  r jsonb;
begin
  r := verein_spieler_anlegen(pg_temp.id('v'), 'Tausend', 'Ohne', 2015, null);
  perform pg_temp.pruefe(r ->> 'status' = 'angelegt', '1000. ohne Team: ' || r::text);
  perform pg_temp.pruefe(verein_ansicht(pg_temp.id('v')) -> 'spieler_zahl' = '1000', 'Zahl bei 1000');
  perform pg_temp.erwarte(format($s$select verein_spieler_anlegen(%L, 'Tausend', 'Eins', 2015, null)$s$, pg_temp.id('v')),
                          'VEREIN_VOLL');
  -- Doppel vor Grenze.
  r := verein_spieler_anlegen(pg_temp.id('v'), 'Sina', 'Beide', 2014, null);
  perform pg_temp.pruefe(r ->> 'grund' = 'doppelt', 'bei 1000 doppelt vor der Grenze: ' || r::text);
end $$;
reset role;
-- Am Team-Ort zählen die Spieler:innen ohne Team ebenso.
select pg_temp.als(pg_temp.id('a'));
select pg_temp.erwarte(format($s$select spieler_aufnehmen(%L, 'Team', 'Tausend', 2015, null)$s$, pg_temp.id('t1')), 'VEREIN_VOLL');
reset role;
rollback to savepoint grenze;

-- ── Ändern (AK 2, 5) ────────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  r jsonb;
begin
  r := verein_spieler_aendern(pg_temp.id('s1'), 'Sara', 'Eins', 2015, ' 1111111 ');
  perform pg_temp.pruefe(r = '{"status": "geaendert"}', 'Ändern J+S: ' || r::text);
  r := verein_spieler_aendern(pg_temp.id('s1'), ' Sarah ', 'Eins', 2016, null);
  perform pg_temp.pruefe(r = '{"status": "geaendert"}', 'Ändern Name: ' || r::text);
  -- AK 5: mit Teams, ohne Team; nichts geändert.
  r := verein_spieler_aendern(pg_temp.id('s1'), 'Sina', 'Beide', 2014, '2');
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "doppelt", "teams": ["Team Eins", "Team Zwei"], "ohne_team": false}',
                         'Ändern doppelt mit Teams: ' || r::text);
  r := verein_spieler_aendern(pg_temp.id('s1'), 'xaver', 'ohne', 2016, '2');
  perform pg_temp.pruefe(r = '{"status": "abgewiesen", "grund": "doppelt", "teams": [], "ohne_team": true}',
                         'Ändern doppelt ohne Team: ' || r::text);
  -- Altdubletten bleiben änderbar, solange der Schlüssel bleibt.
  r := verein_spieler_aendern(pg_temp.id('d1'), ' lea ', 'DUBLETTE', 2017, '55');
  perform pg_temp.pruefe(r = '{"status": "geaendert"}', 'Altdublette ändern: ' || r::text);
  -- Spieler:in ohne Team, ohne Mitgliedschaft.
  r := verein_spieler_aendern(pg_temp.id('x'), 'Xaver', 'Ohne', 2016, '77');
  perform pg_temp.pruefe(r = '{"status": "geaendert"}', 'ohne Team ändern: ' || r::text);
end $$;
reset role;
select pg_temp.pruefe((select row(vorname, nachname, jahrgang, js_nummer) from spieler where id = pg_temp.id('s1'))
                      = row('Sarah'::text, 'Eins'::text, 2016::smallint, null::text), 'Ändern: s1 falsch');
select pg_temp.pruefe((select row(vorname, nachname, js_nummer) from spieler where id = pg_temp.id('d1'))
                      = row('lea'::text, 'DUBLETTE'::text, '55'::text)
                      and (select js_nummer from spieler where id = pg_temp.id('x')) = '77', 'Ändern: d1 oder x falsch');

-- ── Link (AK 9–11) ──────────────────────────────────────────────────────────

select set_config('test.alt_s1', (select link_token from spieler where id = pg_temp.id('s1')), true);
select set_config('test.alt_x', (select link_token from spieler where id = pg_temp.id('x')), true);
select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  r jsonb;
begin
  r := verein_spieler_link_holen(pg_temp.id('s1'));
  perform pg_temp.pruefe(r = jsonb_build_object('link_token', current_setting('test.alt_s1'), 'ohne_team', false, 'bezogen', true),
                         'Link s1: ' || pg_temp.schluessel(r)::text);
  r := verein_spieler_link_holen(pg_temp.id('x'));
  perform pg_temp.pruefe(r = jsonb_build_object('link_token', current_setting('test.alt_x'), 'ohne_team', true, 'bezogen', false),
                         'Link x: ' || pg_temp.schluessel(r)::text);
  r := verein_spieler_link_erneuern(pg_temp.id('s1'));
  perform pg_temp.pruefe(pg_temp.schluessel(r) = array['link_token'] and r ->> 'link_token' <> current_setting('test.alt_s1'),
                         'Erneuern s1');
  perform set_config('test.neu_s1', r ->> 'link_token', true);
  r := verein_spieler_link_erneuern(pg_temp.id('x'));
  perform set_config('test.neu_x', r ->> 'link_token', true);
  perform pg_temp.pruefe(verein_spieler_link_holen(pg_temp.id('s1'))
                         = jsonb_build_object('link_token', current_setting('test.neu_s1'), 'ohne_team', false, 'bezogen', false),
                         'Link nach dem Erneuern');
end $$;
reset role;
do $$
begin
  perform pg_temp.pruefe((select link_token from spieler where id = pg_temp.id('s1')) = current_setting('test.neu_s1')
                         and not (select link_bezogen from spieler where id = pg_temp.id('s1')), 'Erneuern: Zeile');
  -- Alter Link ungültig, Abo weg und lebt über den alten Link nicht auf,
  -- Abmeldungen bleiben.
  perform pg_temp.pruefe(spieler_link_ansicht(current_setting('test.alt_s1')) = '{"gueltig": false}', 'alter Link s1 gültig');
  perform pg_temp.pruefe(spieler_link_ansicht(current_setting('test.alt_x')) = '{"gueltig": false}', 'alter Link x gültig');
  perform pg_temp.pruefe(not exists (select 1 from spieler_abos where spieler_id in (pg_temp.id('s1'), pg_temp.id('x'))),
                         'Abo nach dem Erneuern');
  perform pg_temp.pruefe(spieler_abo_holen(current_setting('test.alt_s1')) is null
                         and not exists (select 1 from spieler_abos where spieler_id = pg_temp.id('s1')), 'Abo lebt auf');
  perform pg_temp.pruefe(exists (select 1 from termin_abmeldungen where termin_id = pg_temp.id('tr1_zukunft')
                                                                    and spieler_id = pg_temp.id('s1')), 'Abmeldung weg');
  -- Neuer Link gilt; ohne Team ohne Teamnamen und ohne Termine.
  perform pg_temp.pruefe((spieler_link_ansicht(current_setting('test.neu_s1')) ->> 'gueltig')::boolean, 'neuer Link s1');
  perform pg_temp.pruefe(spieler_link_ansicht(current_setting('test.neu_x')) @> '{"gueltig": true, "team": null, "termine": []}',
                         'neuer Link x: ' || spieler_link_ansicht(current_setting('test.neu_x'))::text);
end $$;

-- ── Teams, Löschen (AK 12, 13, #579 PC 10, 11), AK 15 ───────────────────────

select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_spieler_teams(pg_temp.id('s3'))
                      = jsonb_build_object('teams', jsonb_build_array(
                          jsonb_build_object('id', pg_temp.id('t1'), 'name', 'Team Eins'),
                          jsonb_build_object('id', pg_temp.id('t2'), 'name', 'Team Zwei'))), 'Teams von s3');
select pg_temp.pruefe(verein_spieler_teams(pg_temp.id('x')) = '{"teams": []}', 'Teams von x');
-- s3 aus T2 nehmen: Das hält den vergangenen Termin von T2 mit s3 fest.
select pg_temp.pruefe(verein_spieler_aus_team_nehmen(pg_temp.id('t2'), pg_temp.id('s3')) ->> 'status' = 'herausgenommen',
                      'Herausnehmen aus T2');
reset role;
select pg_temp.pruefe(exists (select 1 from termin_teilnahmen where termin_id = pg_temp.id('tr2_vorbei')
                                                               and spieler_id = pg_temp.id('s3')), 'T2 nicht festgehalten');
select pg_temp.pruefe(not exists (select 1 from termin_eingefroren where termin_id = pg_temp.id('tr1_begonnen')),
                      'begonnener Termin von T1 schon festgehalten');
select set_config('test.token_s3', (select link_token from spieler where id = pg_temp.id('s3')), true);

select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_spieler_entfernen(pg_temp.id('s3'))
                      = jsonb_build_object('status', 'geloescht', 'teams', jsonb_build_array(
                          jsonb_build_object('id', pg_temp.id('t1'), 'name', 'Team Eins'))), 'Löschen s3');
select pg_temp.pruefe(verein_spieler_entfernen(pg_temp.id('x')) = '{"status": "geloescht", "teams": []}', 'Löschen x');
reset role;
do $$
declare
  s uuid := pg_temp.id('s3');
begin
  perform pg_temp.pruefe(not exists (select 1 from spieler where id in (s, pg_temp.id('x'))), 'Gelöschte bestehen');
  perform pg_temp.pruefe(not exists (select 1 from team_spieler where spieler_id = s)
                         and not exists (select 1 from kader_spieler where spieler_id = s)
                         and not exists (select 1 from termin_abmeldungen where spieler_id = s)
                         and not exists (select 1 from spiel_meldungen where spieler_id = s)
                         and not exists (select 1 from termin_statuswechsel where spieler_id = s)
                         and not exists (select 1 from spieler_abos where spieler_id in (s, pg_temp.id('x'))),
                         'Folgen des Löschens fehlen');
  perform pg_temp.pruefe(spieler_link_ansicht(current_setting('test.token_s3')) = '{"gueltig": false}', 'Link nach dem Löschen');
  perform pg_temp.pruefe(spieler_link_abmelden(current_setting('test.token_s3'), pg_temp.id('tr1_zukunft'), true, null, null)
                         = '{"status": "ungueltig"}', 'Abmelden nach dem Löschen');
  -- Begonnener Termin in T1 vorher festgehalten; dort und in T2 ohne Namen.
  perform pg_temp.pruefe(exists (select 1 from termin_eingefroren where termin_id = pg_temp.id('tr1_begonnen')),
                         'begonnener Termin nicht festgehalten');
  perform pg_temp.pruefe((select count(*) from termin_teilnahmen where termin_id = pg_temp.id('tr1_begonnen') and spieler_id is null) = 1
                         and (select count(*) from termin_teilnahmen where termin_id = pg_temp.id('tr2_vorbei') and spieler_id is null) = 1,
                         'Teilnahmen ohne Namen fehlen');
  perform pg_temp.pruefe(exists (select 1 from termin_teilnahmen where termin_id = pg_temp.id('tr1_begonnen')
                                                                    and spieler_id = pg_temp.id('s1')), 'andere Teilnahmen weg');
  perform pg_temp.pruefe((select count(*) from teams where id in (pg_temp.id('t1'), pg_temp.id('t2'))) = 2
                         and (select count(*) from spieler where verein_id = pg_temp.id('v')) = 6
                         and exists (select 1 from kader where id = pg_temp.id('k1')), 'Löschen nahm mehr mit');
end $$;
select pg_temp.als(pg_temp.id('b'));
select pg_temp.pruefe(exists (select 1 from termin_teilnehmer(pg_temp.id('tr2_vorbei')) t
                               where t.ehemalig and t.vorname is null and t.nachname is null), 'ehemalig am vergangenen Termin');
reset role;

-- AK 15: Danach antwortet jede RPC mit SPIELER_NICHT_GEFUNDEN.
select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  x text;
begin
  foreach x in array array[
    format($s$select verein_spieler_aendern(%L, 'Sina', 'Beide', 2014, null)$s$, pg_temp.id('s3')),
    format('select verein_spieler_entfernen(%L)', pg_temp.id('s3')),
    format('select verein_spieler_teams(%L)', pg_temp.id('s3')),
    format('select verein_spieler_link_holen(%L)', pg_temp.id('s3')),
    format('select verein_spieler_link_erneuern(%L)', pg_temp.id('s3'))] loop
    perform pg_temp.erwarte(x, 'SPIELER_NICHT_GEFUNDEN');
  end loop;
end $$;
reset role;

-- ── Testfall 30: KI-Token löscht nicht ──────────────────────────────────────

select pg_temp.als(pg_temp.id('verw'), '{"client_id": "ki-client"}');
select pg_temp.erwarte(format('select verein_spieler_entfernen(%L)', pg_temp.id('s1')), 'NUR_IN_DER_ANWENDUNG');
select pg_temp.erwarte(format($s$select verein_spieler_anlegen(%L, 'Ki', 'Ki', 2015, null)$s$, pg_temp.id('v')), 'NUR_IN_DER_ANWENDUNG');
reset role;
select pg_temp.pruefe(exists (select 1 from spieler where id = pg_temp.id('s1'))
                      and not exists (select 1 from spieler where nachname = 'Ki'), 'KI-Token wirkte');

-- ── Löschen nur über verein_spieler_entfernen, link_token nur über die Link-RPCs ──

do $$
declare
  x text;
  token text := (select link_token from spieler where id = pg_temp.id('s1'));
begin
  select string_agg(p.proname, ', ' order by p.proname) into x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and (p.prosrc || ' ' || coalesce(pg_get_function_sqlbody(p.oid), '')) ~* '\mdelete\s+from\s+(public\.)?spieler\M';
  perform pg_temp.pruefe(x = 'verein_spieler_entfernen', 'delete from spieler steht in: ' || coalesce(x, '–'));
  foreach x in array array['anon', 'authenticated'] loop
    perform pg_temp.pruefe(not has_table_privilege(x, 'spieler', 'insert') and not has_table_privilege(x, 'spieler', 'update')
                           and not has_table_privilege(x, 'spieler', 'delete')
                           and not has_column_privilege(x, 'spieler', 'link_token', 'select'), x || ' darf spieler schreiben');
  end loop;
  select string_agg(p.proname, ', ' order by p.proname) into x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'verein\_%' and p.prosrc ~ '\mlink_token\M';
  perform pg_temp.pruefe(x = 'verein_spieler_link_erneuern, verein_spieler_link_holen', 'link_token in: ' || coalesce(x, '–'));
  -- Die lesenden Verein-RPCs liefern ihn nicht.
  perform pg_temp.als(pg_temp.id('verw'));
  perform pg_temp.pruefe(position(token in verein_spielerliste(pg_temp.id('v'))::text) = 0
                         and position(token in verein_ansicht(pg_temp.id('v'))::text) = 0
                         and position(token in verein_team_ansicht(pg_temp.id('t1'))::text) = 0
                         and position(token in verein_spieler_teams(pg_temp.id('s1'))::text) = 0, 'Token in einer Ansicht');
  reset role;
end $$;

-- ── Rechte der neuen Funktionen ─────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array['verein_spieler_anlegen(uuid,text,text,integer,text)',
    'verein_spieler_aendern(uuid,text,text,integer,text)', 'verein_spieler_entfernen(uuid)', 'verein_spieler_teams(uuid)',
    'verein_spieler_link_holen(uuid)', 'verein_spieler_link_erneuern(uuid)', 'verein_spielerliste(uuid)',
    'verein_ansicht(uuid)', 'verein_spieler_zuordnen(uuid,uuid[])'] loop
    if has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute') then
      raise exception 'Story 6: Grant von % falsch', f;
    end if;
  end loop;
  f := 'verwaltung_spieler_sperren(uuid)';
  if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
    raise exception 'Story 6: Helfer % ist per API ausführbar', f;
  end if;
end $$;

rollback;
