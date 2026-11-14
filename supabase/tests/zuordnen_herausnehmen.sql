-- Zuordnen und Herausnehmen (Story 3 #579; Architekturplan Vereine §3.3 b–e,
-- §3.7, §4.3, §4.4, §6.7 Testfälle 8–12). Was psql braucht (Altdaten unter
-- `replica`, direkte Inserts für das Trigger-Netz, Rollenwechsel wie
-- PostgREST); die Rennen stehen in rennen.sql.
-- - Rechte: Zuordnen und Vereinsliste nur die Verwaltung, nie per KI-Token;
--   Team-RPCs nur Mitglieder; `spieler_entfernen` gibt es nicht mehr
-- - Zuordnen: Erfolg, `ersetzt` bei einem Team ohne Spieler:innen (AK 23,
--   PC 13), Abweisungen `bereits`, `gleich` (Altdublette im Zielteam und in
--   der Auswahl), `schnuppert`, `ueber_grenze`, gleiche Angaben vor der Grenze
--   (AK 4–7, 21, 22); alles oder nichts
-- - Trigger-Netz: SCHON_ZUGEORDNET → SPIELER_DOPPELT → SPIELERLISTE_VOLL
-- - weitere Teams (AK 9), Auskunft und Stand (AK 13–16)
-- - Herausnehmen: ohne/mit falschem Stand nichts, sonst verfallen künftige
--   Meldungen, Kader und Statuswechsel, begonnene Termine bleiben mit Namen
--   und `nicht_mehr_im_team` (PC 4–6); Sichtbarkeit (PC 7); Nachtragen an
--   begonnenen Terminen (AK 18); Verlegen schreibt nichts zurück (PC 6);
--   erneutes Zuordnen ohne frühere Kader und Meldungen (PC 9); hält einen
--   begonnenen Termin selbst fest; `letztes_eigenes_team` false bei weiterem
--   eigenem Team
-- - Schnuppern einschalten bei mehreren Teams abgewiesen, das andere Team
--   behält seine Abmeldungen (AP §5.3)
-- - spieler.team_id = erstes Team (Entscheid A.1)
-- - Team auflösen: Spieler:innen bleiben, `team_id` rückt nach bzw. wird null
--   (Entscheid A.2), auch beim Weggang des letzten Mitglieds
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
  if p_ok is not true then raise exception 'Story 3: %', p_text; end if;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('verw'), ('a'), ('b'), ('c'), ('v'), ('v2'),
  ('t1'), ('t2'), ('t3'), ('t4'), ('tx'),
  ('s1'), ('s2'), ('s3'), ('sb'), ('d1'), ('d2'), ('d3'), ('sp'), ('frei1'), ('frei2'), ('frei3'), ('px'),
  ('k1'), ('tp'), ('tf'), ('spp'), ('spf'), ('t3_termin'), ('tb'), ('tv');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@zuordnen.test', now() from ids where name in ('verw', 'a', 'b', 'c');

-- Verein V: Verwaltung ohne Team; T1 (a), T2 (b), T3 (b), T4 (ohne Mitglied
-- ausser b, wird voll). Verein V2 mit TX (c) und einer fremden Spieler:in.
insert into vereine (id, name) values (pg_temp.id('v'), 'Zuordnen-Verein'), (pg_temp.id('v2'), 'Fremd-Verein');
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v'), pg_temp.id('verw'));
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Team Eins', pg_temp.id('v')), (pg_temp.id('t2'), 'Team Zwei', pg_temp.id('v')),
  (pg_temp.id('t3'), 'Team Drei', pg_temp.id('v')), (pg_temp.id('t4'), 'Team Vier', pg_temp.id('v')),
  (pg_temp.id('tx'), 'Team X', pg_temp.id('v2'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t2'), pg_temp.id('b')),
  (pg_temp.id('t3'), pg_temp.id('b')), (pg_temp.id('t4'), pg_temp.id('b')), (pg_temp.id('tx'), pg_temp.id('c'));

-- Spieler:in anlegen (mit echten Triggern), optional mit Zuordnung.
create function pg_temp.neu(p_name text, p_vorname text, p_nachname text, p_team text, p_verein text default 'v')
returns void language plpgsql as $$
begin
  insert into spieler (id, verein_id, vorname, nachname, jahrgang)
  values (pg_temp.id(p_name), pg_temp.id(p_verein), p_vorname, p_nachname, 2015);
  if p_team is not null then
    insert into team_spieler (team_id, spieler_id, verein_id) values (pg_temp.id(p_team), pg_temp.id(p_name), pg_temp.id(p_verein));
  end if;
end $$;
select pg_temp.neu('s1', 'Sara', 'Eins', 't1');
select pg_temp.neu('s2', 'Sven', 'Zwei', 't1');
select pg_temp.neu('sb', 'Bea', 'Zwei', 't2');
select pg_temp.neu('s3', 'Sami', 'Drei', null);
select pg_temp.neu('frei1', 'Frei', 'Eins', null);
select pg_temp.neu('frei2', 'Frei', 'Zwei', null);
select pg_temp.neu('frei3', 'Frei', 'Drei', null);
select pg_temp.neu('px', 'Paul', 'Fremd', 'tx', 'v2');
-- Altdubletten (gleicher Schlüssel, entstanden vor Story 2) und eine
-- Schnuppernde, ohne Trigger angelegt.
set local session_replication_role = replica;
insert into spieler (id, verein_id, team_id, vorname, nachname, jahrgang) values
  (pg_temp.id('d1'), pg_temp.id('v'), pg_temp.id('t1'), 'Lea', 'Dublette', 2016),
  (pg_temp.id('d2'), pg_temp.id('v'), null, 'lea', 'DUBLETTE', 2016),
  (pg_temp.id('d3'), pg_temp.id('v'), null, 'LEA', 'dublette', 2016),
  (pg_temp.id('sp'), pg_temp.id('v'), pg_temp.id('t1'), 'Sina', 'Schnupper', 2016);
-- d1 ist älter in T1 als später in T4: T1 bleibt ihr erstes Team (A.1).
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit, created_at) values
  (pg_temp.id('t1'), pg_temp.id('d1'), pg_temp.id('v'), null, now() - interval '1 day'),
  (pg_temp.id('t1'), pg_temp.id('sp'), pg_temp.id('v'), now(), now());
-- T4 mit 97 Zuordnungen.
insert into spieler (verein_id, team_id, vorname, nachname, jahrgang)
select pg_temp.id('v'), pg_temp.id('t4'), 'Viele', 'Nr ' || i, 2014 from generate_series(1, 97) i;
insert into team_spieler (team_id, spieler_id, verein_id)
select pg_temp.id('t4'), id, pg_temp.id('v') from spieler where team_id = pg_temp.id('t4');
set local session_replication_role = origin;
-- ── Rechte ──────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  perform pg_temp.pruefe(to_regprocedure('spieler_entfernen(uuid)') is null, 'spieler_entfernen besteht noch');
  foreach f in array array['spieler_teams(uuid,uuid)', 'spieler_aus_team_nehmen(uuid,uuid,text)',
                           'spieler_weitere_teams(uuid)', 'verein_spielerliste(uuid)',
                           'verein_spieler_zuordnen(uuid,uuid[])', 'termin_teilnehmer(uuid)',
                           'spiel_teilnehmer(uuid)', 'meine_team_ids()'] loop
    perform pg_temp.pruefe(not has_function_privilege('anon', f, 'execute')
                           and has_function_privilege('authenticated', f, 'execute'), 'Grant von ' || f);
  end loop;
  foreach f in array array['spieler_teams_stand(uuid)', 'spieler_teams_auskunft(uuid,uuid)',
                           'team_spieler_vorher()', 'team_spieler_nachher()'] loop
    perform pg_temp.pruefe(not has_function_privilege('anon', f, 'execute')
                           and not has_function_privilege('authenticated', f, 'execute'), 'kein API-Recht für ' || f);
  end loop;
end $$;

-- Testfall 8: Ein Mitglied ohne Verwaltung ordnet nicht zu und sieht die
-- Vereinsliste nicht; die Verwaltung nicht per KI-Token; fremde Spieler:innen
-- sind unbekannt.
select pg_temp.als(pg_temp.id('a'));
select pg_temp.erwarte(format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])', pg_temp.id('t1'), pg_temp.id('s3')),
                       'VEREIN_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select verein_spielerliste(%L)', pg_temp.id('v')), 'VEREIN_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select spieler_teams(%L, %L)', pg_temp.id('t2'), pg_temp.id('sb')), 'SPIELER_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select spieler_aus_team_nehmen(%L, %L, null)', pg_temp.id('t2'), pg_temp.id('sb')),
                       'SPIELER_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select spieler_weitere_teams(%L)', pg_temp.id('t2')), 'TEAM_NICHT_GEFUNDEN');
reset role;
select pg_temp.als(pg_temp.id('verw'), '{"client_id": "ki-client"}');
select pg_temp.erwarte(format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])', pg_temp.id('t2'), pg_temp.id('s3')),
                       'NUR_IN_DER_ANWENDUNG');
select pg_temp.erwarte(format('select verein_spielerliste(%L)', pg_temp.id('v')), 'NUR_IN_DER_ANWENDUNG');
reset role;
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.erwarte(format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])', pg_temp.id('t2'), pg_temp.id('px')),
                       'SPIELER_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])', pg_temp.id('tx'), pg_temp.id('s3')),
                       'VEREIN_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select verein_spieler_zuordnen(%L, %L::uuid[])', pg_temp.id('t2'), '{}'),
                       'SPIELER_NICHT_GEFUNDEN');
-- Die Verwaltung handelt am Team-Ort nicht ohne Mitgliedschaft.
select pg_temp.erwarte(format('select spieler_teams(%L, %L)', pg_temp.id('t1'), pg_temp.id('s1')), 'SPIELER_NICHT_GEFUNDEN');
reset role;


-- ── Zuordnen ────────────────────────────────────────────────────────────────

-- T3 ohne Spieler:innen mit einem anstehenden Termin samt erwarteter Zahl.
insert into training_termine (id, team_id, datum, beginn, ende, erwartete_spielerzahl)
values (pg_temp.id('t3_termin'), pg_temp.id('t3'), current_date + 7, '18:00', '19:30', 12);
insert into ids (name, id) select 't4_mitglied', spieler_id from team_spieler where team_id = pg_temp.id('t4') limit 1;

select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  v jsonb;
  c_leer constant jsonb := '[]';
  v_t4 uuid := pg_temp.id('t4_mitglied');
begin
  -- AK 2: in ein weiteres Team, ohne Mitgliedschaft; das Team hatte schon Spieler:innen.
  v := verein_spieler_zuordnen(pg_temp.id('t2'), array[pg_temp.id('s1')]);
  perform pg_temp.pruefe(v = '{"status": "zugeordnet", "anzahl": 1, "ersetzt": 0}', 'Zuordnen in T2: ' || v::text);
  -- AK 23, PC 13: erstes Zuordnen in ein Team ohne Spieler:innen, gesammelt.
  v := verein_spieler_zuordnen(pg_temp.id('t3'), array[pg_temp.id('s3'), pg_temp.id('frei1')]);
  perform pg_temp.pruefe(v = '{"status": "zugeordnet", "anzahl": 2, "ersetzt": 1}', 'Zuordnen in T3: ' || v::text);

  -- AK 4, 6, 21: schon zugeordnet; zusammen mit einer Freien wird keine zugeordnet.
  v := verein_spieler_zuordnen(pg_temp.id('t2'), array[pg_temp.id('s1'), pg_temp.id('frei2')]);
  perform pg_temp.pruefe(v = jsonb_build_object('status', 'abgewiesen',
      'bereits', jsonb_build_array(jsonb_build_object('id', pg_temp.id('s1'), 'vorname', 'Sara', 'nachname', 'Eins', 'jahrgang', 2015)),
      'gleich', c_leer, 'schnuppert', c_leer, 'ueber_grenze', 0), 'bereits: ' || v::text);

  -- AK 4: Altdublette im Zielteam → gleich; zwei Altdubletten in der Auswahl → beide gleich.
  v := verein_spieler_zuordnen(pg_temp.id('t1'), array[pg_temp.id('d2')]);
  perform pg_temp.pruefe(v = jsonb_build_object('status', 'abgewiesen', 'bereits', c_leer,
      'gleich', jsonb_build_array(jsonb_build_object('id', pg_temp.id('d2'), 'vorname', 'lea', 'nachname', 'DUBLETTE', 'jahrgang', 2016)),
      'schnuppert', c_leer, 'ueber_grenze', 0), 'gleich im Team: ' || v::text);
  v := verein_spieler_zuordnen(pg_temp.id('t2'), array[pg_temp.id('d2'), pg_temp.id('d3')]);
  perform pg_temp.pruefe(jsonb_array_length(v -> 'gleich') = 2 and v -> 'bereits' = c_leer, 'gleich in der Auswahl: ' || v::text);

  -- Entscheid A.4: Eine Schnuppernde lässt sich keinem weiteren Team zuordnen.
  v := verein_spieler_zuordnen(pg_temp.id('t2'), array[pg_temp.id('sp')]);
  perform pg_temp.pruefe(v -> 'schnuppert' = jsonb_build_array(jsonb_build_object('id', pg_temp.id('sp'), 'vorname', 'Sina',
                           'nachname', 'Schnupper', 'jahrgang', 2016, 'team', 'Team Eins')), 'schnuppert: ' || v::text);

  -- Testfall 9, AK 22: T4 hat 97; vier Freie gehen eins über die Grenze,
  -- auch zusammen mit einer schon zugeordneten.
  v := verein_spieler_zuordnen(pg_temp.id('t4'), array[v_t4, pg_temp.id('frei2'), pg_temp.id('frei3'), pg_temp.id('s2'), pg_temp.id('sb')]);
  perform pg_temp.pruefe(v ->> 'ueber_grenze' = '1' and jsonb_array_length(v -> 'bereits') = 1, 'gesammelt über der Grenze: ' || v::text);
  v := verein_spieler_zuordnen(pg_temp.id('t4'), array[pg_temp.id('frei2'), pg_temp.id('frei3'), pg_temp.id('s2'), pg_temp.id('sb')]);
  perform pg_temp.pruefe(v = jsonb_build_object('status', 'abgewiesen', 'bereits', c_leer, 'gleich', c_leer,
                                                'schnuppert', c_leer, 'ueber_grenze', 1), 'über der Grenze: ' || v::text);
  -- Alles oder nichts (AK 21): T4 hat weiter 97 (die Verwaltung liest über die Vereinsliste).
  perform pg_temp.pruefe((select (t ->> 'anzahl')::int from jsonb_array_elements(verein_spielerliste(pg_temp.id('v')) -> 'teams') t
                           where t ->> 'name' = 'Team Vier') = 97, 'T4 verändert');

  -- T4 auf genau 100, mit der Altdublette d1 (dann in T1 und T4).
  v := verein_spieler_zuordnen(pg_temp.id('t4'), array[pg_temp.id('d1'), pg_temp.id('frei2'), pg_temp.id('frei3')]);
  perform pg_temp.pruefe(v ->> 'status' = 'zugeordnet', 'T4 auffüllen: ' || v::text);
  -- AK 7: Im vollen Team nennt eine einzelne Zuordnung mit gleichen Angaben nur das.
  v := verein_spieler_zuordnen(pg_temp.id('t4'), array[pg_temp.id('d2')]);
  perform pg_temp.pruefe(jsonb_array_length(v -> 'gleich') = 1 and v ->> 'ueber_grenze' = '0', 'gleich vor der Grenze: ' || v::text);
  v := verein_spieler_zuordnen(pg_temp.id('t4'), array[pg_temp.id('sb')]);
  perform pg_temp.pruefe(v ->> 'ueber_grenze' = '1' and v -> 'gleich' = c_leer, 'volles Team: ' || v::text);

  -- Vereinsliste der Verwaltung: alle Spieler:innen (auch ohne Team) und alle Teams.
  v := verein_spielerliste(pg_temp.id('v'));
  perform pg_temp.pruefe(jsonb_array_length(v -> 'spieler') = 108   -- 11 einzeln angelegt, 97 in T4; die Rolle sieht spieler nicht
      and jsonb_array_length(v -> 'teams') = 4
      and v -> 'teams' @> jsonb_build_array(jsonb_build_object('id', pg_temp.id('t4'), 'name', 'Team Vier', 'anzahl', 100))
      and v -> 'spieler' @> jsonb_build_array(jsonb_build_object('id', pg_temp.id('d2'), 'teams', c_leer))
      and v -> 'spieler' @> jsonb_build_array(jsonb_build_object('id', pg_temp.id('s1'), 'teams',
            jsonb_build_array(jsonb_build_object('id', pg_temp.id('t1'), 'name', 'Team Eins'),
                              jsonb_build_object('id', pg_temp.id('t2'), 'name', 'Team Zwei')))),
      'verein_spielerliste: ' || v::text);
end $$;
reset role;
select pg_temp.pruefe((select erwartete_spielerzahl from training_termine where id = pg_temp.id('t3_termin')) is null,
                      'erwartete Zahl in T3 nicht entfernt');
-- A.1: spieler.team_id ist das erste Team (created_at, bei Gleichstand in
-- derselben Transaktion team_id).
select pg_temp.pruefe((select team_id from spieler where id = pg_temp.id('s1'))
                        = (select team_id from team_spieler where spieler_id = pg_temp.id('s1') order by created_at, team_id limit 1)
                      and (select team_id from spieler where id = pg_temp.id('s3')) = pg_temp.id('t3')
                      and (select team_id from spieler where id = pg_temp.id('d2')) is null, 'team_id nach dem Zuordnen');

-- ── Trigger-Netz ────────────────────────────────────────────────────────────
-- T4 ist voll und führt d1: Reihenfolge SCHON_ZUGEORDNET → SPIELER_DOPPELT →
-- SPIELERLISTE_VOLL.
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id) values (%L, %L, %L)',
                              pg_temp.id('t4'), pg_temp.id('d1'), pg_temp.id('v')), 'SCHON_ZUGEORDNET');
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id) values (%L, %L, %L)',
                              pg_temp.id('t4'), pg_temp.id('d2'), pg_temp.id('v')), 'SPIELER_DOPPELT');
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id) values (%L, %L, %L)',
                              pg_temp.id('t4'), pg_temp.id('sb'), pg_temp.id('v')), 'SPIELERLISTE_VOLL');
-- Kader und Meldungen nur für Zugeordnete (FK ks_zuordnung).
insert into kader (id, team_id, name) values (pg_temp.id('k1'), pg_temp.id('t1'), 'Kader Eins');
select pg_temp.erwarte(format('insert into kader_spieler (kader_id, spieler_id, team_id) values (%L, %L, %L)',
                              pg_temp.id('k1'), pg_temp.id('sb'), pg_temp.id('t1')), 'ks_zuordnung');

-- ── Schnuppern bei mehreren Teams (AP §5.3, vorgezogen) ─────────────────────
-- d1 steht in T1 (erstes Team, a) und T4 und ist in T4 für ein kommendes
-- Training abgemeldet. Einschalten in T1 wird abgewiesen, auch mit der Zahl;
-- die Abmeldung in T4 bleibt. Ausschalten bleibt unverändert (ohne Wirkung).
insert into team_probetraining (team_id, anzahl) values (pg_temp.id('t1'), 3);
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tv'), pg_temp.id('t4'), current_date + 7, '18:00', '19:30');
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (pg_temp.id('tv'), pg_temp.id('d1'), pg_temp.id('t4'), false);
select pg_temp.als(pg_temp.id('a'));
select pg_temp.erwarte(format('select spieler_probe_folgen(%L)', pg_temp.id('d1')), 'SCHNUPPERN_MEHRERE_TEAMS');
select pg_temp.erwarte(format('select spieler_probe_setzen(%L, true, 1)', pg_temp.id('d1')), 'SCHNUPPERN_MEHRERE_TEAMS');
select pg_temp.pruefe(spieler_probe_setzen(pg_temp.id('d1'), false) = '{"probe": false, "verfallen": 0}', 'Ausschalten');
reset role;
select pg_temp.pruefe(exists (select 1 from termin_abmeldungen where termin_id = pg_temp.id('tv') and spieler_id = pg_temp.id('d1'))
                      and not exists (select 1 from team_spieler where spieler_id = pg_temp.id('d1') and probe_seit is not null),
                      'Schnuppern bei zwei Teams schrieb');

-- ── Herausnehmen ────────────────────────────────────────────────────────────
-- s1 steht in T1 und T2. In T1: Kader, ein begonnenes und ein kommendes
-- Training, ein begonnenes und ein kommendes Spiel, je mit Meldung von s1.
insert into kader_spieler (kader_id, spieler_id, team_id) values (pg_temp.id('k1'), pg_temp.id('s1'), pg_temp.id('t1'));
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tf'), pg_temp.id('t1'), current_date + 7, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (pg_temp.id('spf'), pg_temp.id('t1'), current_date + 9, '10:00', '12:00', 'spiel', 'Match kommend');
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (pg_temp.id('tf'), pg_temp.id('s1'), pg_temp.id('t1'), false);
insert into termin_statuswechsel (termin_id, spieler_id, team_id) values (pg_temp.id('tf'), pg_temp.id('s1'), pg_temp.id('t1'));
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am) values
  (pg_temp.id('spf'), pg_temp.id('s1'), pg_temp.id('t1'), 'angemeldet', now());
-- Begonnene Termine wie auf Prod: vor Beginn angelegt, dann festgehalten.
set local session_replication_role = replica;
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tp'), pg_temp.id('t1'), current_date - 7, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (pg_temp.id('spp'), pg_temp.id('t1'), current_date - 8, '10:00', '12:00', 'spiel', 'Match vorbei');
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (pg_temp.id('tp'), pg_temp.id('s1'), pg_temp.id('t1'), false);
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am) values
  (pg_temp.id('spp'), pg_temp.id('s1'), pg_temp.id('t1'), 'angemeldet', now() - interval '9 days');
set local session_replication_role = origin;
select termin_einfrieren(pg_temp.id('tp'));
select termin_einfrieren(pg_temp.id('spp'));

select pg_temp.als(pg_temp.id('a'));
do $$
declare
  v jsonb;
  v_auskunft jsonb := spieler_teams(pg_temp.id('t1'), pg_temp.id('s1'));
begin
  -- AK 9: weitere Teams je Spieler:in des Teams, nur wer welche hat.
  v := spieler_weitere_teams(pg_temp.id('t1'));
  perform pg_temp.pruefe(v @> jsonb_build_array(jsonb_build_object('spieler_id', pg_temp.id('s1'), 'teams', '["Team Zwei"]'::jsonb),
                                                jsonb_build_object('spieler_id', pg_temp.id('d1'), 'teams', '["Team Vier"]'::jsonb))
                         and jsonb_array_length(v) = 2, 'spieler_weitere_teams: ' || v::text);
  perform pg_temp.pruefe(v_auskunft -> 'teams' = '[{"name": "Team Eins", "eigen": true, "dieses": true}, {"name": "Team Zwei", "eigen": false, "dieses": false}]'
                         and length(v_auskunft ->> 'stand') = 32, 'spieler_teams: ' || v_auskunft::text);
  perform pg_temp.pruefe((select count(*) from spieler where id = pg_temp.id('s1')) = 1, 'vorher sichtbar');

  -- Testfall 29 (zweiter Teil): ohne oder mit falschem Stand ändert sich nichts.
  v := spieler_aus_team_nehmen(pg_temp.id('t1'), pg_temp.id('s1'), null);
  perform pg_temp.pruefe(v = jsonb_build_object('status', 'stand_geaendert', 'teams', v_auskunft -> 'teams',
                                                'stand', v_auskunft -> 'stand'), 'ohne Stand: ' || v::text);
  v := spieler_aus_team_nehmen(pg_temp.id('t1'), pg_temp.id('s1'), 'veraltet');
  perform pg_temp.pruefe(v ->> 'status' = 'stand_geaendert'
                         and exists (select 1 from team_spieler where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('s1')),
                         'falscher Stand: ' || v::text);

  -- AK 10: herausnehmen; sie bleibt in T2, das letzte eigene Team von a war T1.
  v := spieler_aus_team_nehmen(pg_temp.id('t1'), pg_temp.id('s1'), v_auskunft ->> 'stand');
  perform pg_temp.pruefe(v = '{"status": "herausgenommen", "ohne_team": false, "letztes_eigenes_team": true}', 'herausnehmen: ' || v::text);

  -- PC 7: J+S und Zeile nur noch für Mitglieder weiterer Teams.
  perform pg_temp.pruefe((select count(*) from spieler where id = pg_temp.id('s1')) = 0, 'nach dem Herausnehmen sichtbar');
  -- PC 5: am begonnenen Termin mit Namen, als nicht mehr im Team.
  perform pg_temp.pruefe(exists (select 1 from termin_teilnehmer(pg_temp.id('tp')) r
                                  where r.spieler_id = pg_temp.id('s1') and r.vorname = 'Sara'
                                    and r.nicht_mehr_im_team and not r.ehemalig), 'termin_teilnehmer begonnen');
  perform pg_temp.pruefe(exists (select 1 from spiel_teilnehmer(pg_temp.id('spp')) r
                                  where r.spieler_id = pg_temp.id('s1') and r.vorname = 'Sara' and r.nicht_mehr_im_team),
                         'spiel_teilnehmer begonnen');
  perform pg_temp.pruefe(not exists (select 1 from termin_teilnehmer(pg_temp.id('tf')) r where r.spieler_id = pg_temp.id('s1'))
                         and not exists (select 1 from termin_teilnehmer(pg_temp.id('tp')) r
                                          where r.spieler_id <> pg_temp.id('s1') and r.nicht_mehr_im_team),
                         'termin_teilnehmer kommend');
  -- AK 18: an begonnenen Terminen weiter nachtragbar, an kommenden nicht.
  perform pg_temp.pruefe(termin_anwesenheit_setzen(pg_temp.id('tp'), pg_temp.id('s1'), true, null, null) ->> 'status' = 'ok',
                         'Nachtrag Training');
  perform pg_temp.pruefe(termin_anwesenheit_setzen(pg_temp.id('spp'), pg_temp.id('s1'), false, null, null) ->> 'status' = 'ok',
                         'Nachtrag Spiel');
  perform pg_temp.pruefe(termin_anwesenheit_setzen(pg_temp.id('tf'), pg_temp.id('s1'), true, null, null) ->> 'status' = 'abgewiesen',
                         'Nachtrag am kommenden Training');
end $$;
reset role;
-- Mitglieder anderer Teams und anderer Vereine sehen die Teilnehmer nicht.
select pg_temp.als(pg_temp.id('c'));
select pg_temp.pruefe(not exists (select 1 from termin_teilnehmer(pg_temp.id('tp')))
                      and not exists (select 1 from spiel_teilnehmer(pg_temp.id('spp'))), 'Teilnehmer für Fremde');
reset role;
select pg_temp.als(pg_temp.id('b'));
select pg_temp.pruefe((select count(*) from spieler where id = pg_temp.id('s1')) = 1, 'für T2 nicht sichtbar');
reset role;

-- PC 4–6: Spieler:in bleibt samt Link; künftige Meldungen, Kader und
-- Statuswechsel in T1 verfallen; der Stand begonnener Termine bleibt.
select pg_temp.pruefe(exists (select 1 from spieler where id = pg_temp.id('s1') and link_token is not null), 'Spieler:in weg');
select pg_temp.pruefe(not exists (select 1 from kader_spieler where spieler_id = pg_temp.id('s1'))
                      and not exists (select 1 from termin_abmeldungen where spieler_id = pg_temp.id('s1'))
                      and not exists (select 1 from termin_statuswechsel where spieler_id = pg_temp.id('s1'))
                      and not exists (select 1 from spiel_meldungen where spieler_id = pg_temp.id('s1')),
                      'künftige Meldungen, Kader oder Statuswechsel verblieben');
select pg_temp.pruefe(exists (select 1 from termin_teilnahmen where termin_id = pg_temp.id('tp') and spieler_id = pg_temp.id('s1'))
                      and exists (select 1 from spiel_teilnahmen where termin_id = pg_temp.id('spp') and spieler_id = pg_temp.id('s1')),
                      'begonnene Termine ohne s1');
select pg_temp.pruefe((select team_id from spieler where id = pg_temp.id('s1')) = pg_temp.id('t2'), 'team_id rückt nicht nach');
-- Testfall 10: Begonnene Termine in die Zukunft verlegt schreiben ihr nichts zurück (kein 23503).
update training_termine set datum = current_date + 14 where id in (pg_temp.id('tp'), pg_temp.id('spp'));
select pg_temp.pruefe(not exists (select 1 from termin_abmeldungen where spieler_id = pg_temp.id('s1'))
                      and not exists (select 1 from spiel_meldungen where spieler_id = pg_temp.id('s1')),
                      'Verlegen schrieb zurück');

-- AK 16: aus dem letzten Team; danach ohne Team, aber im Verein.
select pg_temp.als(pg_temp.id('b'));
do $$
declare
  v_auskunft jsonb := spieler_teams(pg_temp.id('t2'), pg_temp.id('s1'));
  v jsonb;
begin
  perform pg_temp.pruefe(v_auskunft -> 'teams' = '[{"name": "Team Zwei", "eigen": true, "dieses": true}]', 'Auskunft letztes Team: ' || v_auskunft::text);
  v := spieler_aus_team_nehmen(pg_temp.id('t2'), pg_temp.id('s1'), v_auskunft ->> 'stand');
  perform pg_temp.pruefe(v = '{"status": "herausgenommen", "ohne_team": true, "letztes_eigenes_team": true}', 'letztes Team: ' || v::text);
end $$;
reset role;
select pg_temp.pruefe(exists (select 1 from spieler where id = pg_temp.id('s1') and team_id is null), 'ohne Team nicht im Verein');

-- PC 9: erneut zugeordnet wie neu, ohne frühere Kader und Meldungen.
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_spieler_zuordnen(pg_temp.id('t1'), array[pg_temp.id('s1')]) ->> 'status' = 'zugeordnet', 'erneut zuordnen');
reset role;
select pg_temp.pruefe(not exists (select 1 from kader_spieler where spieler_id = pg_temp.id('s1'))
                      and not exists (select 1 from termin_abmeldungen where spieler_id = pg_temp.id('s1'))
                      and (select team_id from spieler where id = pg_temp.id('s1')) = pg_temp.id('t1'), 'erneut zugeordnet');

-- Das Herausnehmen hält einen begonnenen, noch nicht festgehaltenen Termin
-- selbst fest (team_spieler_vorher), mit der Spieler:in und ihrer Abmeldung.
set local session_replication_role = replica;
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tb'), pg_temp.id('t1'), current_date - 1, '18:00', '19:30');
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (pg_temp.id('tb'), pg_temp.id('s2'), pg_temp.id('t1'), false);
set local session_replication_role = origin;
select pg_temp.pruefe(not exists (select 1 from termin_eingefroren where termin_id = pg_temp.id('tb')), 'tb schon festgehalten');
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(spieler_aus_team_nehmen(pg_temp.id('t1'), pg_temp.id('s2'),
                        spieler_teams(pg_temp.id('t1'), pg_temp.id('s2')) ->> 'stand') ->> 'status' = 'herausgenommen', 's2 herausnehmen');
reset role;
select pg_temp.pruefe(exists (select 1 from termin_teilnahmen where termin_id = pg_temp.id('tb')
                               and spieler_id = pg_temp.id('s2') and abgemeldet), 'begonnener Termin nicht selbst festgehalten');

-- ── Team auflösen (Entscheid A.2) ───────────────────────────────────────────
-- s3 steht in T3 und T2, frei1 nur in T3. Auflösen von T3: beide bleiben,
-- s3 rückt auf T2, frei1 ohne Team. Dann verlässt b als letztes Mitglied T2
-- (team_aufloesen_wenn_leer): sb und s3 bleiben ohne Team.
insert into team_spieler (team_id, spieler_id, verein_id) values (pg_temp.id('t2'), pg_temp.id('s3'), pg_temp.id('v'));
-- b ist auch Mitglied von T3: Aus T2 genommen bleibt s3 in einem eigenen Team.
select pg_temp.als(pg_temp.id('b'));
select pg_temp.pruefe(spieler_aus_team_nehmen(pg_temp.id('t2'), pg_temp.id('s3'), spieler_teams(pg_temp.id('t2'), pg_temp.id('s3')) ->> 'stand')
                        = '{"status": "herausgenommen", "ohne_team": false, "letztes_eigenes_team": false}', 'letztes_eigenes_team bei weiterem eigenem Team');
reset role;
insert into team_spieler (team_id, spieler_id, verein_id) values (pg_temp.id('t2'), pg_temp.id('s3'), pg_temp.id('v'));
delete from teams where id = pg_temp.id('t3');
select pg_temp.pruefe((select team_id from spieler where id = pg_temp.id('s3')) = pg_temp.id('t2')
                      and exists (select 1 from spieler where id = pg_temp.id('frei1') and team_id is null),
                      'Auflösen von T3');
delete from team_members where team_id = pg_temp.id('t2');
select pg_temp.pruefe(not exists (select 1 from teams where id = pg_temp.id('t2'))
                      and (select count(*) from spieler where id in (pg_temp.id('s3'), pg_temp.id('sb')) and team_id is null) = 2,
                      'letztes Mitglied verlässt T2');

rollback;
