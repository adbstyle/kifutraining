-- Schnuppertraining in genau einem Team (Story 8 #584; Architekturplan
-- Vereine §3.3 f, §4.3, §4.4, §6.7 Testfälle 17, 18, 28). Was psql braucht
-- (direkte Schreibwege für das Trigger-Netz, Altlasten unter `replica`,
-- Rollenwechsel wie PostgREST); die Rennen (Testfall 19) stehen in rennen.sql.
-- - Rechte: neue Signaturen mit `p_team`, alte fallen; der Zähler-Helfer hat
--   kein API-Recht; `spieler.probe_seit` und `spieler.team_id` sind für
--   `authenticated` nicht mehr lesbar
-- - Trigger-Netz (direktes Schreiben als Eigentümer): zweite Zuordnung einer
--   Schnuppernden → SPIELER_SCHNUPPERT; `probe_seit` setzen bei mehreren
--   Zuordnungen → SCHNUPPERN_MEHRERE_TEAMS; beides zugleich → der erste
--   Marker; Ausschalten geht immer; unter `replica` still; mehrzeilige
--   INSERTs in jeder Reihenfolge; Team, Spieler:in und Verein einer Zuordnung
--   lassen sich nicht ändern (ZUORDNUNG_UNVERAENDERLICH)
-- - Einschalten und Folgen nur als Mitglied von `p_team` für eine
--   Spieler:in in `p_team` (Mitglied eines anderen Teams, Nicht-Mitglied,
--   Verwaltung ohne Mitgliedschaft: SPIELER_NICHT_GEFUNDEN; beide Rollen
--   nicht mehr als ein Mitglied); `spieler.team_id` wird nicht gelesen;
--   SCHNUPPERN_MEHRERE_TEAMS auch über ein KI-Token (AK 5, 6, 15);
--   Ausschalten einer Altlast löscht kommende Meldungen nur im eigenen Team
-- - Zuordnen zum Schnuppern (AK 8–11): Abweisungen in der Reihenfolge
--   SCHNUPPERN_NUR_EINZELN → schnuppern_hat_team → schnuppern_anzahl_fehlt,
--   je in der Vertragsform; Erfolg: zuerst nicht angemeldet, Spiele gelten
--   nicht, Zählung ab der Zuordnung; ein Mitglied ohne Verwaltung und die
--   Verwaltung eines anderen Vereins: VEREIN_NICHT_GEFUNDEN
-- - Schnuppernde weiteren Teams zuordnen: einzeln und gesammelt abgewiesen
--   mit Teamname (AK 12, 16)
-- - Herausnehmen (AK 13, PC 1, 2): `spieler_teams.schnuppert`, der Stand
--   bemerkt Ein- und Ausschalten, `stand_geaendert` trägt `schnuppert`,
--   `schnuppern_beendet` an beiden Wegen; danach zählt ein erneutes
--   Zuordnen ab null; Auflösen beendet das Schnuppern
-- - Zähler der Vereinsansichten (Testfall 28) gleich dem Stand am Team-Ort,
--   auch für eine Verwaltung ohne Mitgliedschaft
-- - Link: `probe`/`probe_info` von der schnuppernden Zuordnung, auch bei
--   einer Altlast in zwei Teams
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
  if p_ok is not true then raise exception 'Story 8: %', p_text; end if;
end $$;

create function pg_temp.schluessel(p jsonb) returns text[]
language sql immutable as $$ select array(select k from jsonb_object_keys(p) k order by k) $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('va'), ('vm'), ('a'), ('b'), ('c'), ('x'), ('v'), ('v2'), ('vx'),
  ('t1'), ('t2'), ('t3'), ('t4'), ('tr_t2'),
  ('ein'), ('zwei'), ('nur2'), ('nur3'), ('frei'), ('frei2'), ('frei3'), ('alt'),
  ('tr_kommend'), ('sp_kommend'), ('tr_vorbei');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@schnuppern.test', now() from ids where name in ('va', 'vm', 'a', 'b', 'c', 'x', 'vx');

-- Verein V: va nur Verwaltung, vm Verwaltung und Mitglied von T1; a in T1,
-- b in T2, c in T3; x gehört keinem Verein an. T1 (Anzahl 3, Info), T2
-- (Anzahl 2), T3 ohne Anzahl, T4 (Anzahl 1, wird aufgelöst). vx verwaltet
-- einen anderen Verein V2.
insert into vereine (id, name) values (pg_temp.id('v'), 'Schnupper-Verein'), (pg_temp.id('v2'), 'Anderer Verein');
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v2'), pg_temp.id('vx'));
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v'), pg_temp.id('va')), (pg_temp.id('v'), pg_temp.id('vm'));
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Team Eins', pg_temp.id('v')), (pg_temp.id('t2'), 'Team Zwei', pg_temp.id('v')),
  (pg_temp.id('t3'), 'Team Drei', pg_temp.id('v')), (pg_temp.id('t4'), 'Team Vier', pg_temp.id('v'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t1'), pg_temp.id('vm')),
  (pg_temp.id('t2'), pg_temp.id('b')), (pg_temp.id('t3'), pg_temp.id('c'));
insert into team_probetraining (team_id, anzahl, info) values
  (pg_temp.id('t1'), 3, 'Info Eins'), (pg_temp.id('t2'), 2, null), (pg_temp.id('t4'), 1, null);

create function pg_temp.neu(p_name text, p_vorname text, p_nachname text, p_teams text[]) returns void
language plpgsql as $$
declare
  t text;
begin
  insert into spieler (id, verein_id, vorname, nachname, jahrgang)
  values (pg_temp.id(p_name), pg_temp.id('v'), p_vorname, p_nachname, 2015);
  foreach t in array p_teams loop
    insert into team_spieler (team_id, spieler_id, verein_id) values (pg_temp.id(t), pg_temp.id(p_name), pg_temp.id('v'));
  end loop;
end $$;
select pg_temp.neu('ein', 'Ena', 'Eins', array['t1']);
select pg_temp.neu('zwei', 'Zoe', 'Zwei', array['t1', 't2']);
select pg_temp.neu('nur2', 'Nia', 'Zwei', array['t2']);
select pg_temp.neu('nur3', 'Noa', 'Drei', array['t3']);
select pg_temp.neu('frei', 'Fia', 'Frei', array[]::text[]);
select pg_temp.neu('frei2', 'Fred', 'Frei', array[]::text[]);
select pg_temp.neu('frei3', 'Fabi', 'Frei', array[]::text[]);
-- nur2 trägt in spieler.team_id ein anderes Team (wie vor dem Bestand
-- denkbar): Schnuppern liest die Spalte nicht mehr.
update spieler set team_id = pg_temp.id('t1') where id = pg_temp.id('nur2');
-- Altlast: schnuppernd in T1 und zugleich in T2 (ohne Trigger, AP §3.3 f).
set local session_replication_role = replica;
insert into spieler (id, verein_id, team_id, vorname, nachname, jahrgang)
values (pg_temp.id('alt'), pg_temp.id('v'), pg_temp.id('t1'), 'Alma', 'Alt', 2014);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit, created_at) values
  (pg_temp.id('t1'), pg_temp.id('alt'), pg_temp.id('v'), now() - interval '5 days', now() - interval '5 days'),
  (pg_temp.id('t2'), pg_temp.id('alt'), pg_temp.id('v'), null, now());
set local session_replication_role = origin;
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tr_kommend'), pg_temp.id('t1'), current_date + 7, '18:00', '19:30'),
  (pg_temp.id('tr_t2'), pg_temp.id('t2'), current_date + 7, '17:00', '18:30');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (pg_temp.id('sp_kommend'), pg_temp.id('t1'), current_date + 8, '10:00', '12:00', 'spiel', 'Match kommend');

-- ── Rechte ──────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array['spieler_probe_folgen(uuid,uuid)', 'spieler_probe_setzen(uuid,uuid,boolean,integer)',
                           'verein_spieler_zuordnen(uuid,uuid[],boolean)', 'spieler_teams(uuid,uuid)',
                           'spieler_aus_team_nehmen(uuid,uuid,text)', 'verein_spieler_aus_team_nehmen(uuid,uuid)',
                           'verein_team_ansicht(uuid)', 'verein_spielerliste(uuid)'] loop
    perform pg_temp.pruefe(not has_function_privilege('anon', f, 'execute')
                           and has_function_privilege('authenticated', f, 'execute'), 'Grant von ' || f);
  end loop;
  perform pg_temp.pruefe(to_regprocedure('spieler_probe_folgen(uuid)') is null
                         and to_regprocedure('spieler_probe_setzen(uuid,boolean,integer)') is null
                         and to_regprocedure('verein_spieler_zuordnen(uuid,uuid[])') is null, 'alte Signaturen bestehen noch');
  f := 'team_probe_zaehler(uuid,uuid)';
  perform pg_temp.pruefe(to_regprocedure(f) is not null and not has_function_privilege('anon', f, 'execute')
                         and not has_function_privilege('authenticated', f, 'execute'), 'Helfer ' || f || ' per API ausführbar');
  -- A2.9: Den Schnupper-Stand und das «erste Team» liest kein API-Client mehr
  -- aus der spieler-Zeile.
  perform pg_temp.pruefe(not has_column_privilege('authenticated', 'spieler', 'probe_seit', 'select')
                         and not has_column_privilege('authenticated', 'spieler', 'team_id', 'select')
                         and has_column_privilege('authenticated', 'spieler', 'vorname', 'select'), 'Spaltenrechte auf spieler');
end $$;

-- ── Trigger-Netz (direkt als Eigentümer, AK 5, 12) ──────────────────────────

-- Einschalten mit einer Zuordnung geht; eine weitere Zuordnung für die
-- Schnuppernde nicht, auch nicht mit probe_seit (dann der erste Marker).
update team_spieler set probe_seit = now() where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('ein');
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id) values (%L, %L, %L)',
                              pg_temp.id('t2'), pg_temp.id('ein'), pg_temp.id('v')), 'SPIELER_SCHNUPPERT');
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values (%L, %L, %L, now())',
                              pg_temp.id('t2'), pg_temp.id('ein'), pg_temp.id('v')), 'SPIELER_SCHNUPPERT');
-- Schon im Team bleibt SCHON_ZUGEORDNET der erste Befund.
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id) values (%L, %L, %L)',
                              pg_temp.id('t1'), pg_temp.id('ein'), pg_temp.id('v')), 'SCHON_ZUGEORDNET');
update team_spieler set probe_seit = null where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('ein');
-- Bei zwei Zuordnungen lässt sich probe_seit nicht setzen.
select pg_temp.erwarte(format('update team_spieler set probe_seit = now() where team_id = %L and spieler_id = %L',
                              pg_temp.id('t1'), pg_temp.id('zwei')), 'SCHNUPPERN_MEHRERE_TEAMS');
-- Eine Zuordnung mit probe_seit neben einer bestehenden ebenso.
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values (%L, %L, %L, now())',
                              pg_temp.id('t1'), pg_temp.id('nur2'), pg_temp.id('v')), 'SCHNUPPERN_MEHRERE_TEAMS');
-- Mehrzeilige INSERTs: Der Trigger der zweiten Zeile sieht die erste. Zuerst
-- mit probe_seit, dann ohne → SPIELER_SCHNUPPERT; umgekehrt →
-- SCHNUPPERN_MEHRERE_TEAMS; beide mit → der erste Marker. Nichts bleibt.
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values (%L, %L, %L, now()), (%L, %L, %L, null)',
                              pg_temp.id('t1'), pg_temp.id('frei'), pg_temp.id('v'), pg_temp.id('t2'), pg_temp.id('frei'), pg_temp.id('v')),
                       'SPIELER_SCHNUPPERT');
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values (%L, %L, %L, null), (%L, %L, %L, now())',
                              pg_temp.id('t1'), pg_temp.id('frei'), pg_temp.id('v'), pg_temp.id('t2'), pg_temp.id('frei'), pg_temp.id('v')),
                       'SCHNUPPERN_MEHRERE_TEAMS');
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values (%L, %L, %L, now()), (%L, %L, %L, now())',
                              pg_temp.id('t1'), pg_temp.id('frei'), pg_temp.id('v'), pg_temp.id('t2'), pg_temp.id('frei'), pg_temp.id('v')),
                       'SPIELER_SCHNUPPERT');
select pg_temp.pruefe(not exists (select 1 from team_spieler where spieler_id = pg_temp.id('frei')), 'mehrzeiliger INSERT schrieb');
-- Team, Spieler:in und Verein einer Zuordnung ändert kein Weg: Ein direktes
-- UPDATE ginge sonst am Netz vorbei (die Schnuppernde ein in ein zweites Team,
-- eine zweite Zuordnung von zwei auf eine Schnuppernde).
update team_spieler set probe_seit = now() where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('ein');
select pg_temp.erwarte(format('update team_spieler set team_id = %L where team_id = %L and spieler_id = %L',
                              pg_temp.id('t3'), pg_temp.id('t1'), pg_temp.id('ein')), 'ZUORDNUNG_UNVERAENDERLICH');
select pg_temp.erwarte(format('update team_spieler set spieler_id = %L where team_id = %L and spieler_id = %L',
                              pg_temp.id('ein'), pg_temp.id('t2'), pg_temp.id('nur2')), 'ZUORDNUNG_UNVERAENDERLICH');
select pg_temp.erwarte(format('update team_spieler set verein_id = %L where team_id = %L and spieler_id = %L',
                              pg_temp.id('v2'), pg_temp.id('t1'), pg_temp.id('ein')), 'ZUORDNUNG_UNVERAENDERLICH');
update team_spieler set probe_seit = null where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('ein');
select pg_temp.pruefe((select array_agg(team_id) from team_spieler where spieler_id = pg_temp.id('ein')) = array[pg_temp.id('t1')]
                      and (select array_agg(team_id) from team_spieler where spieler_id = pg_temp.id('nur2')) = array[pg_temp.id('t2')],
                      'UPDATE der Schlüsselspalten schrieb');
-- Ausschalten der Altlast geht trotz zweier Zuordnungen; unter replica bleibt
-- das Netz still (Sync-Weg).
savepoint netz;
update team_spieler set probe_seit = null where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('alt');
rollback to savepoint netz;
set local session_replication_role = replica;
update team_spieler set probe_seit = now() where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('zwei');
update team_spieler set probe_seit = null where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('zwei');
set local session_replication_role = origin;
select pg_temp.pruefe(not exists (select 1 from team_spieler where spieler_id in (pg_temp.id('ein'), pg_temp.id('zwei'), pg_temp.id('nur2'))
                                                               and probe_seit is not null)
                      and (select count(*) from team_spieler where spieler_id = pg_temp.id('ein')) = 1
                      and (select count(*) from team_spieler where spieler_id = pg_temp.id('nur2')) = 1, 'Netz schrieb');

-- ── Einschalten und Folgen am Team-Ort (AK 5, 6, 15) ───────────────────────

do $$
declare
  ziel record;
  x text;
begin
  -- Wer am Team-Ort nicht Mitglied von p_team ist oder die Spieler:in nicht
  -- in p_team findet: SPIELER_NICHT_GEFUNDEN. vm (beide Rollen) bekommt in
  -- T2 nicht mehr als ein Mitglied, va (nur Verwaltung) nirgends etwas.
  for ziel in select * from (values ('b', 't1', 'ein'), ('b', 't2', 'ein'), ('x', 't1', 'ein'), ('va', 't1', 'ein'),
                                    ('va', 't2', 'nur2'), ('vm', 't2', 'nur2'), ('vm', 't1', 'nur2'), ('c', 't1', 'nur3'))
                          z(wer, team, spieler) loop
    perform pg_temp.als(pg_temp.id(ziel.wer));
    foreach x in array array[
      format('select spieler_probe_folgen(%L, %L)', pg_temp.id(ziel.team), pg_temp.id(ziel.spieler)),
      format('select spieler_probe_setzen(%L, %L, true)', pg_temp.id(ziel.team), pg_temp.id(ziel.spieler)),
      format('select spieler_probe_setzen(%L, %L, false)', pg_temp.id(ziel.team), pg_temp.id(ziel.spieler)),
      format('select spieler_teams(%L, %L)', pg_temp.id(ziel.team), pg_temp.id(ziel.spieler))] loop
      perform pg_temp.erwarte(x, 'SPIELER_NICHT_GEFUNDEN');
    end loop;
  end loop;
  perform pg_temp.als(pg_temp.id('a'));
  perform pg_temp.erwarte(format('select spieler_probe_setzen(%L, %L, null)', pg_temp.id('t1'), pg_temp.id('ein')), 'SPIELER_NICHT_GEFUNDEN');
  -- AK 6: weitere Teams, aus jedem der beiden Teams, auch mit der Zahl.
  perform pg_temp.erwarte(format('select spieler_probe_folgen(%L, %L)', pg_temp.id('t1'), pg_temp.id('zwei')), 'SCHNUPPERN_MEHRERE_TEAMS');
  perform pg_temp.erwarte(format('select spieler_probe_setzen(%L, %L, true)', pg_temp.id('t1'), pg_temp.id('zwei')), 'SCHNUPPERN_MEHRERE_TEAMS');
  perform pg_temp.erwarte(format('select spieler_probe_setzen(%L, %L, true, 1)', pg_temp.id('t1'), pg_temp.id('zwei')), 'SCHNUPPERN_MEHRERE_TEAMS');
  perform pg_temp.pruefe(spieler_probe_setzen(pg_temp.id('t1'), pg_temp.id('zwei'), false) = '{"probe": false, "verfallen": 0}',
                         'Ausschalten bei zwei Teams');
  -- AK 15: über ein KI-Token derselbe Marker.
  perform pg_temp.als(pg_temp.id('a'), '{"client_id": "ki-client"}');
  perform pg_temp.erwarte(format('select spieler_probe_setzen(%L, %L, true)', pg_temp.id('t1'), pg_temp.id('zwei')), 'SCHNUPPERN_MEHRERE_TEAMS');
  perform pg_temp.als(pg_temp.id('b'));
  perform pg_temp.erwarte(format('select spieler_probe_setzen(%L, %L, true)', pg_temp.id('t2'), pg_temp.id('zwei')), 'SCHNUPPERN_MEHRERE_TEAMS');
  -- Ohne Anzahl im Team wie bisher.
  perform pg_temp.als(pg_temp.id('c'));
  perform pg_temp.erwarte(format('select spieler_probe_setzen(%L, %L, true)', pg_temp.id('t3'), pg_temp.id('nur3')), 'PROBE_ANZAHL_FEHLT');
  -- Einschalten im Team der Seite, auch wenn spieler.team_id ein anderes nennt.
  perform pg_temp.als(pg_temp.id('b'));
  perform pg_temp.pruefe(spieler_probe_folgen(pg_temp.id('t2'), pg_temp.id('nur2'))
                         = '{"abmeldungen": 0, "meldungen": 0, "kennzeichnungen": 0}', 'Folgen nur2');
  perform pg_temp.pruefe(spieler_probe_setzen(pg_temp.id('t2'), pg_temp.id('nur2'), true) = '{"probe": true, "verfallen": 0}', 'Einschalten nur2');
  perform pg_temp.pruefe(spieler_probe_setzen(pg_temp.id('t2'), pg_temp.id('nur2'), true) = '{"probe": true, "verfallen": 0}', 'nochmals nur2');
  -- vm schaltet als Mitglied von T1 ein und aus.
  perform pg_temp.als(pg_temp.id('vm'));
  perform pg_temp.pruefe(spieler_probe_setzen(pg_temp.id('t1'), pg_temp.id('ein'), true) = '{"probe": true, "verfallen": 0}', 'vm schaltet ein');
  perform pg_temp.pruefe(spieler_probe_setzen(pg_temp.id('t1'), pg_temp.id('ein'), false) = '{"probe": false, "verfallen": 0}', 'vm schaltet aus');
end $$;
reset role;
select pg_temp.pruefe((select probe_seit from team_spieler where team_id = pg_temp.id('t2') and spieler_id = pg_temp.id('nur2')) is not null
                      and (select probe_seit from team_spieler where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('ein')) is null
                      and not exists (select 1 from team_spieler where spieler_id = pg_temp.id('zwei') and probe_seit is not null),
                      'Stand nach dem Einschalten');

-- Ausschalten der Altlast (schnuppernd in T1, zugeordnet in T2) durch ein
-- Mitglied von T1: Kommende Ab- und Anmeldungen und Statuswechsel fallen nur
-- in T1; die in T2 bleiben.
savepoint altlast;
set local session_replication_role = replica;
insert into termin_abmeldungen (termin_id, spieler_id, team_id) values
  (pg_temp.id('tr_kommend'), pg_temp.id('alt'), pg_temp.id('t1')), (pg_temp.id('tr_t2'), pg_temp.id('alt'), pg_temp.id('t2'));
insert into termin_statuswechsel (termin_id, spieler_id, team_id) values
  (pg_temp.id('tr_kommend'), pg_temp.id('alt'), pg_temp.id('t1')), (pg_temp.id('tr_t2'), pg_temp.id('alt'), pg_temp.id('t2'));
set local session_replication_role = origin;
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(spieler_probe_setzen(pg_temp.id('t1'), pg_temp.id('alt'), false) = '{"probe": false, "verfallen": 0}',
                      'Ausschalten der Altlast');
reset role;
select pg_temp.pruefe(
  (select array_agg(termin_id) from termin_abmeldungen where spieler_id = pg_temp.id('alt')) = array[pg_temp.id('tr_t2')]
  and (select array_agg(termin_id) from termin_statuswechsel where spieler_id = pg_temp.id('alt')) = array[pg_temp.id('tr_t2')]
  and (select probe_seit from team_spieler where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('alt')) is null,
  'Altlast: Meldungen im anderen Team bleiben');
rollback to savepoint altlast;

-- ── Zuordnen zum Schnuppern (AK 8–12, 16; Testfall 18) ─────────────────────

select pg_temp.als(pg_temp.id('va'));
do $$
declare
  v jsonb;
  wer text;
  c_leer constant jsonb := '[]';
begin
  -- Reihenfolge: mehr als eine → Marker, auch wenn eine schon ein Team hat
  -- und das Team keine Anzahl.
  perform pg_temp.erwarte(format('select verein_spieler_zuordnen(%L, array[%L, %L]::uuid[], true)',
                                 pg_temp.id('t3'), pg_temp.id('ein'), pg_temp.id('frei')), 'SCHNUPPERN_NUR_EINZELN');
  -- Schon ein Team vor fehlender Anzahl; auch das Zielteam selbst zählt.
  v := verein_spieler_zuordnen(pg_temp.id('t3'), array[pg_temp.id('ein')], true);
  perform pg_temp.pruefe(v = jsonb_build_object('status', 'abgewiesen', 'grund', 'schnuppern_hat_team', 'bereits', c_leer,
                                                'gleich', c_leer, 'schnuppert', c_leer, 'ueber_grenze', 0), 'hat Team: ' || v::text);
  v := verein_spieler_zuordnen(pg_temp.id('t1'), array[pg_temp.id('ein')], true);
  perform pg_temp.pruefe(v ->> 'grund' = 'schnuppern_hat_team', 'hat Team (Zielteam): ' || v::text);
  v := verein_spieler_zuordnen(pg_temp.id('t3'), array[pg_temp.id('frei')], true);
  perform pg_temp.pruefe(v = jsonb_build_object('status', 'abgewiesen', 'grund', 'schnuppern_anzahl_fehlt', 'bereits', c_leer,
                                                'gleich', c_leer, 'schnuppert', c_leer, 'ueber_grenze', 0), 'Anzahl fehlt: ' || v::text);
  -- Ohne p_schnuppern bleibt alles wie bisher (kein grund).
  v := verein_spieler_zuordnen(pg_temp.id('t1'), array[pg_temp.id('ein')]);
  perform pg_temp.pruefe(not v ? 'grund' and jsonb_array_length(v -> 'bereits') = 1, 'ohne Schnuppern: ' || v::text);
  -- Erfolg (AK 8, 11).
  v := verein_spieler_zuordnen(pg_temp.id('t1'), array[pg_temp.id('frei')], true);
  perform pg_temp.pruefe(v = '{"status": "zugeordnet", "anzahl": 1, "ersetzt": 0}', 'zum Schnuppern zugeordnet: ' || v::text);
  -- AK 12: weiteres Team, einzeln (mit und ohne Schnuppern) und gesammelt.
  v := verein_spieler_zuordnen(pg_temp.id('t2'), array[pg_temp.id('frei')]);
  perform pg_temp.pruefe(v = jsonb_build_object('status', 'abgewiesen', 'bereits', c_leer, 'gleich', c_leer,
                           'schnuppert', jsonb_build_array(jsonb_build_object('id', pg_temp.id('frei'), 'vorname', 'Fia',
                             'nachname', 'Frei', 'jahrgang', 2015, 'team', 'Team Eins')), 'ueber_grenze', 0), 'schnuppert: ' || v::text);
  v := verein_spieler_zuordnen(pg_temp.id('t2'), array[pg_temp.id('frei')], true);
  perform pg_temp.pruefe(v ->> 'grund' = 'schnuppern_hat_team', 'schnuppert, zum Schnuppern: ' || v::text);
  -- AK 16: gesammelt nennt genau die Schnuppernde, nichts wird zugeordnet.
  v := verein_spieler_zuordnen(pg_temp.id('t2'), array[pg_temp.id('frei2'), pg_temp.id('frei'), pg_temp.id('frei3')]);
  perform pg_temp.pruefe(v ->> 'status' = 'abgewiesen' and not v ? 'grund'
                         and v -> 'schnuppert' = jsonb_build_array(jsonb_build_object('id', pg_temp.id('frei'), 'vorname', 'Fia',
                               'nachname', 'Frei', 'jahrgang', 2015, 'team', 'Team Eins'))
                         and v -> 'bereits' = c_leer and v -> 'gleich' = c_leer, 'gesammelt: ' || v::text);
  -- Nur die Verwaltung dieses Vereins: ein Mitglied ohne Verwaltung (a in
  -- T1) und die Verwaltung eines anderen Vereins (vx) nicht.
  foreach wer in array array['a', 'vx'] loop
    perform pg_temp.als(pg_temp.id(wer));
    perform pg_temp.erwarte(format('select verein_spieler_zuordnen(%L, array[%L]::uuid[], true)', pg_temp.id('t1'), pg_temp.id('frei2')),
                            'VEREIN_NICHT_GEFUNDEN');
  end loop;
  -- Auch über ein KI-Token nie.
  perform pg_temp.als(pg_temp.id('va'), '{"client_id": "ki-client"}');
  perform pg_temp.erwarte(format('select verein_spieler_zuordnen(%L, array[%L]::uuid[], true)', pg_temp.id('t1'), pg_temp.id('frei2')),
                          'NUR_IN_DER_ANWENDUNG');
end $$;
reset role;
-- AK 11: zuerst nicht angemeldet, Spiele gelten nicht, Zählung ab der
-- Zuordnung; die Abweisungen schrieben nichts.
select pg_temp.pruefe((select probe_seit from team_spieler where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('frei')) = now()
                      and training_abgemeldet(pg_temp.id('tr_kommend'), pg_temp.id('frei'))
                      and not termin_gilt_fuer(pg_temp.id('sp_kommend'), pg_temp.id('frei'))
                      and probe_stand(pg_temp.id('frei')) = '{"anzahl": 3, "besucht": 0, "angemeldet": 0, "moeglich": 3}',
                      'AK 11: ' || coalesce(probe_stand(pg_temp.id('frei'))::text, '–'));
select pg_temp.pruefe((select array_agg(team_id) from team_spieler
                        where spieler_id in (pg_temp.id('frei'), pg_temp.id('frei2'), pg_temp.id('frei3'))) = array[pg_temp.id('t1')]
                      and (select count(*) from team_spieler where team_id = pg_temp.id('t3')) = 1
                      and (select count(*) from team_spieler where spieler_id = pg_temp.id('ein')) = 1, 'Abweisungen schrieben');

-- ── Zähler der Vereinsansichten = Stand am Team-Ort (Testfall 28, AK 1) ─────

-- frei schnuppert seit drei Tagen und war gestern an einem Training
-- angemeldet (ohne Festhalten, wie vor Beginn gemeldet): besucht 1.
update team_spieler set probe_seit = now() - interval '3 days' where team_id = pg_temp.id('t1') and spieler_id = pg_temp.id('frei');
set local session_replication_role = replica;
insert into training_termine (id, team_id, datum, beginn, ende) values
  (pg_temp.id('tr_vorbei'), pg_temp.id('t1'), current_date - 1, '18:00', '19:30');
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (pg_temp.id('tr_vorbei'), pg_temp.id('frei'), pg_temp.id('t1'), true);
-- Eine Schnuppernde in T3 ohne Anzahl (nur als Eigentümer denkbar).
update team_spieler set probe_seit = now() where team_id = pg_temp.id('t3') and spieler_id = pg_temp.id('nur3');
set local session_replication_role = origin;
select pg_temp.als(pg_temp.id('a'));
select set_config('test.team_ort', (select stand::text from team_probe_staende(pg_temp.id('t1')) where spieler_id = pg_temp.id('frei')), true)
       is not null;
reset role;
select pg_temp.pruefe(current_setting('test.team_ort')::jsonb @> '{"anzahl": 3, "besucht": 1}', 'Team-Ort: ' || current_setting('test.team_ort'));
-- Für va (ohne Mitgliedschaft) und vm (beide Rollen) dieselben Zahlen.
do $$
declare
  wer text;
  v jsonb;
  s jsonb;
  x jsonb;
  c_team_ort constant jsonb := current_setting('test.team_ort')::jsonb;
begin
  foreach wer in array array['va', 'vm'] loop
    perform pg_temp.als(pg_temp.id(wer));
    v := verein_team_ansicht(pg_temp.id('t1'));
    for x in select * from jsonb_array_elements(v -> 'spieler') loop
      perform pg_temp.pruefe(pg_temp.schluessel(x) = array['id', 'jahrgang', 'nachname', 'schnuppern', 'teams', 'vorname'],
                             'Teamansicht, Schlüssel: ' || x::text);
    end loop;
    select e into s from jsonb_array_elements(v -> 'spieler') e where e ->> 'id' = pg_temp.id('frei')::text;
    perform pg_temp.pruefe(s -> 'schnuppern' = jsonb_build_object('anzahl', c_team_ort -> 'anzahl', 'besucht', c_team_ort -> 'besucht')
                           and s -> 'teams' = jsonb_build_array(jsonb_build_object('id', pg_temp.id('t1'), 'name', 'Team Eins')),
                           wer || ': Teamansicht frei ' || s::text);
    select e into s from jsonb_array_elements(v -> 'spieler') e where e ->> 'id' = pg_temp.id('ein')::text;
    perform pg_temp.pruefe(s -> 'schnuppern' = 'null', wer || ': Teamansicht ein ' || s::text);
    -- Ohne festgelegte Anzahl: anzahl null.
    select e into s from jsonb_array_elements(verein_team_ansicht(pg_temp.id('t3')) -> 'spieler') e
     where e ->> 'id' = pg_temp.id('nur3')::text;
    perform pg_temp.pruefe(s -> 'schnuppern' = '{"anzahl": null, "besucht": 0}', wer || ': ohne Anzahl ' || s::text);

    v := verein_spielerliste(pg_temp.id('v'));
    for x in select * from jsonb_array_elements(v -> 'spieler') loop
      perform pg_temp.pruefe(pg_temp.schluessel(x) = array['id', 'jahrgang', 'js', 'link_bezogen', 'nachname', 'schnuppern', 'teams', 'vorname'],
                             'Vereinsliste, Schlüssel: ' || x::text);
    end loop;
    select e into s from jsonb_array_elements(v -> 'spieler') e where e ->> 'id' = pg_temp.id('frei')::text;
    perform pg_temp.pruefe(s -> 'schnuppern' = jsonb_build_object('team_id', pg_temp.id('t1'), 'anzahl', c_team_ort -> 'anzahl',
                                                                  'besucht', c_team_ort -> 'besucht'), wer || ': Vereinsliste frei ' || s::text);
    select e into s from jsonb_array_elements(v -> 'spieler') e where e ->> 'id' = pg_temp.id('nur2')::text;
    perform pg_temp.pruefe(s -> 'schnuppern' = jsonb_build_object('team_id', pg_temp.id('t2'), 'anzahl', 2, 'besucht', 0),
                           wer || ': Vereinsliste nur2 ' || s::text);
    select e into s from jsonb_array_elements(v -> 'spieler') e where e ->> 'id' = pg_temp.id('zwei')::text;
    perform pg_temp.pruefe(s -> 'schnuppern' = 'null', wer || ': Vereinsliste zwei ' || s::text);
  end loop;
  -- Ein Mitglied ohne Verwaltung sieht die Vereinsansichten nicht.
  perform pg_temp.als(pg_temp.id('a'));
  perform pg_temp.erwarte(format('select verein_team_ansicht(%L)', pg_temp.id('t1')), 'VEREIN_NICHT_GEFUNDEN');
  perform pg_temp.erwarte(format('select verein_spielerliste(%L)', pg_temp.id('v')), 'VEREIN_NICHT_GEFUNDEN');
end $$;
reset role;
update team_spieler set probe_seit = null where team_id = pg_temp.id('t3') and spieler_id = pg_temp.id('nur3');

-- ── Link (A2.8) ─────────────────────────────────────────────────────────────

select set_config('test.abo_alt', spieler_abo_holen((select link_token from spieler where id = pg_temp.id('alt'))), true) is not null;
do $$
declare
  v jsonb;
begin
  v := spieler_link_ansicht((select link_token from spieler where id = pg_temp.id('frei')));
  perform pg_temp.pruefe(v -> 'probe' = probe_stand(pg_temp.id('frei')) and v ->> 'probe_info' = 'Info Eins'
                         and v ->> 'team' = 'Team Eins', 'Link frei: ' || v::text);
  -- Altlast in zwei Teams: Stand und Info der schnuppernden Zuordnung.
  v := spieler_link_ansicht((select link_token from spieler where id = pg_temp.id('alt')));
  perform pg_temp.pruefe(jsonb_typeof(v -> 'probe') = 'object' and v -> 'probe' = probe_stand(pg_temp.id('alt'))
                         and v ->> 'probe_info' = 'Info Eins' and v ->> 'team' = 'Schnupper-Verein', 'Link Altlast: ' || v::text);
  perform pg_temp.pruefe((spieler_abo_termine(current_setting('test.abo_alt')) ->> 'probe')::boolean, 'Abo Altlast');
  -- Ohne Schnuppern: null, auch bei einem einzigen Team.
  v := spieler_link_ansicht((select link_token from spieler where id = pg_temp.id('ein')));
  perform pg_temp.pruefe(v -> 'probe' = 'null' and v -> 'probe_info' = 'null', 'Link ein: ' || v::text);
end $$;

-- ── Herausnehmen beendet das Schnuppern (AK 13, PC 1, 2) ───────────────────

select pg_temp.als(pg_temp.id('a'));
do $$
declare
  v jsonb;
  v_stand text;
begin
  v := spieler_teams(pg_temp.id('t1'), pg_temp.id('frei'));
  perform pg_temp.pruefe(pg_temp.schluessel(v) = array['schnuppert', 'stand', 'teams'] and (v ->> 'schnuppert')::boolean,
                         'spieler_teams frei: ' || v::text);
  v_stand := v ->> 'stand';
  perform pg_temp.pruefe(spieler_teams(pg_temp.id('t1'), pg_temp.id('ein')) -> 'schnuppert' = 'false', 'spieler_teams ein');
  -- Ausschalten ändert den Stand: der Dialog erfährt es mit `schnuppert`.
  perform spieler_probe_setzen(pg_temp.id('t1'), pg_temp.id('frei'), false);
  v := spieler_aus_team_nehmen(pg_temp.id('t1'), pg_temp.id('frei'), v_stand);
  perform pg_temp.pruefe(v ->> 'status' = 'stand_geaendert' and v -> 'schnuppert' = 'false' and v ->> 'stand' <> v_stand
                         and pg_temp.schluessel(v) = array['schnuppert', 'stand', 'status', 'teams'], 'nach dem Ausschalten: ' || v::text);
  -- Wieder einschalten zählt ab null, der Stand ändert sich erneut.
  perform spieler_probe_setzen(pg_temp.id('t1'), pg_temp.id('frei'), true);
  perform pg_temp.pruefe((probe_stand(pg_temp.id('frei')) ->> 'besucht')::int = 0, 'Einschalten zählt ab null');
  v := spieler_aus_team_nehmen(pg_temp.id('t1'), pg_temp.id('frei'), v ->> 'stand');
  perform pg_temp.pruefe(v ->> 'status' = 'stand_geaendert' and v -> 'schnuppert' = 'true', 'nach dem Einschalten: ' || v::text);
  v := spieler_aus_team_nehmen(pg_temp.id('t1'), pg_temp.id('frei'), v ->> 'stand');
  perform pg_temp.pruefe(v = '{"status": "herausgenommen", "ohne_team": true, "letztes_eigenes_team": true, "schnuppern_beendet": true}',
                         'herausnehmen: ' || v::text);
end $$;
reset role;
select pg_temp.pruefe(not exists (select 1 from team_spieler where spieler_id = pg_temp.id('frei'))
                      and probe_stand(pg_temp.id('frei')) is null, 'PC 1: Zuordnung oder Stand bleibt');
-- PC 2: wieder zugeordnet schnuppert sie nicht; die Verwaltung nimmt sie
-- heraus (schnuppern_beendet false), zum Schnuppern zugeordnet zählt sie ab
-- null, herausgenommen endet es (true).
select pg_temp.als(pg_temp.id('va'));
do $$
declare
  v jsonb;
begin
  perform pg_temp.pruefe(verein_spieler_zuordnen(pg_temp.id('t1'), array[pg_temp.id('frei')]) ->> 'status' = 'zugeordnet', 'wieder zuordnen');
  perform pg_temp.pruefe(verein_team_ansicht(pg_temp.id('t1')) -> 'spieler' @> jsonb_build_array(jsonb_build_object(
                           'id', pg_temp.id('frei'), 'schnuppern', null)), 'wieder zugeordnet schnuppert');
  v := verein_spieler_aus_team_nehmen(pg_temp.id('t1'), pg_temp.id('frei'));
  perform pg_temp.pruefe(v = '{"status": "herausgenommen", "ohne_team": true, "schnuppern_beendet": false}', 'Verwaltung, ohne Schnuppern: ' || v::text);
  perform pg_temp.pruefe(verein_spieler_zuordnen(pg_temp.id('t1'), array[pg_temp.id('frei')], true) ->> 'status' = 'zugeordnet',
                         'erneut zum Schnuppern');
  perform pg_temp.pruefe(verein_team_ansicht(pg_temp.id('t1')) -> 'spieler' @> jsonb_build_array(jsonb_build_object(
                           'id', pg_temp.id('frei'), 'schnuppern', jsonb_build_object('anzahl', 3, 'besucht', 0))), 'zählt ab null');
  v := verein_spieler_aus_team_nehmen(pg_temp.id('t1'), pg_temp.id('frei'));
  perform pg_temp.pruefe(v = '{"status": "herausgenommen", "ohne_team": true, "schnuppern_beendet": true}', 'Verwaltung, schnuppernd: ' || v::text);
  -- Auflösen beendet das Schnuppern (PC 1).
  perform pg_temp.pruefe(verein_spieler_zuordnen(pg_temp.id('t4'), array[pg_temp.id('frei2')], true) ->> 'status' = 'zugeordnet', 'T4');
  perform pg_temp.pruefe(verein_team_aufloesen(pg_temp.id('t4'), 'Team Vier') ->> 'status' = 'aufgeloest', 'T4 auflösen');
end $$;
reset role;
select pg_temp.pruefe(not exists (select 1 from team_spieler where spieler_id in (pg_temp.id('frei'), pg_temp.id('frei2')))
                      and probe_stand(pg_temp.id('frei2')) is null
                      and exists (select 1 from spieler where id = pg_temp.id('frei2')), 'Auflösen: Schnuppern bleibt');
-- Danach wieder normal zugeordnet: Spiele gelten, nicht schnuppernd.
select pg_temp.als(pg_temp.id('va'));
select pg_temp.pruefe(verein_spieler_zuordnen(pg_temp.id('t1'), array[pg_temp.id('frei2')]) ->> 'status' = 'zugeordnet', 'frei2 in T1');
reset role;
select pg_temp.pruefe(termin_gilt_fuer(pg_temp.id('sp_kommend'), pg_temp.id('frei2'))
                      and (select probe_seit from team_spieler where spieler_id = pg_temp.id('frei2')) is null, 'PC 2: frei2');

rollback;
