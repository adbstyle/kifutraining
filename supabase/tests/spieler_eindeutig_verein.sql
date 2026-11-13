-- Eindeutigkeit je Verein (Story 2 #578; Architekturplan Vereine §3.3 a,
-- §4.4, §6.7 Testfall 7) — die Fälle mit Altdaten, die nur unter `replica`
-- entstehen und darum nicht in pruefe-kern-db.ts laufen:
-- - eine Altdublette über zwei Teams bleibt als zwei Datensätze (PC 1) und ist
--   änderbar, solange der Schlüssel gleich bleibt (AK 7); auf einen
--   vergebenen Schlüssel nicht (AK 5)
-- - eine dritte Erfassung nennt alle Teams beider Datensätze (AK 3, 4)
-- - das Netz im Trigger `spieler_vorher` bei INSERT und Schlüsseländerung,
--   ohne eindeutigen Index
-- - `spieler_doppelt` ist für anon und authenticated gesperrt
-- - der Team-Import ist nicht angepasst (Story 2 OoS 3): trifft eine neue
--   Zeile eine Spieler:in eines anderen Teams, bricht die Übernahme am Netz
--   ab und rollt ganz zurück
-- Gleichzeitiges Erfassen und Ändern: rennen.sql (Testfall 6).
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

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('a'), ('b'), ('verein'), ('team1'), ('team2'), ('team3'), ('alt1'), ('alt2'), ('mia'), ('termin');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@spieler-eindeutig.test', now() from ids where name in ('a', 'b');
insert into vereine (id, name) values (pg_temp.id('verein'), 'Eindeutig-Verein');
insert into teams (id, name, verein_id) values (pg_temp.id('team1'), 'Team Eins', pg_temp.id('verein')),
                                              (pg_temp.id('team2'), 'Team Zwei', pg_temp.id('verein')),
                                              (pg_temp.id('team3'), 'Team Drei', pg_temp.id('verein'));
insert into team_members (team_id, user_id) values (pg_temp.id('team1'), pg_temp.id('a')),
                                                  (pg_temp.id('team2'), pg_temp.id('b')),
                                                  (pg_temp.id('team3'), pg_temp.id('a'));
-- Team 3 ist leer und hat einen anstehenden Termin mit erwarteter Spielerzahl.
insert into training_termine (id, team_id, datum, beginn, ende, erwartete_spielerzahl)
values (pg_temp.id('termin'), pg_temp.id('team3'), current_date + 7, '18:00', '19:30', 12);

-- Altdublette wie im Bestand von Prod: «Lea Alt» je einmal in Team 1 und 2.
set local session_replication_role = replica;
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('alt1'), pg_temp.id('team1'), pg_temp.id('verein'), 'Lea', 'Alt', 2017),
  (pg_temp.id('alt2'), pg_temp.id('team2'), pg_temp.id('verein'), 'Lea', 'Alt', 2017),
  (pg_temp.id('mia'), pg_temp.id('team1'), pg_temp.id('verein'), 'Mia', 'Alt', 2017);
insert into team_spieler (team_id, spieler_id, verein_id) values
  (pg_temp.id('team1'), pg_temp.id('alt1'), pg_temp.id('verein')),
  (pg_temp.id('team2'), pg_temp.id('alt2'), pg_temp.id('verein')),
  (pg_temp.id('team1'), pg_temp.id('mia'), pg_temp.id('verein'));
set local session_replication_role = origin;

-- AK 7 im Trigger: Beide Datensätze tragen denselben Schlüssel; ein direktes
-- update ohne Schlüsseländerung (nur Schreibweise und J+S) geht durch.
update spieler set vorname = 'LEA', js_nummer = '42' where id = pg_temp.id('alt2');
do $$
begin
  if (select count(*) from spieler where verein_id = pg_temp.id('verein')
                                      and spieler_text_schluessel(vorname) = 'lea' and nachname = 'Alt') <> 2 then
    raise exception 'AK 7: Die Altdublette besteht nicht mehr als zwei Datensätze';
  end if;
end $$;

select pg_temp.als(pg_temp.id('a'));
do $$
declare
  v jsonb;
begin
  -- AK 7 über die RPC: Die Altdublette ändert sich, solange der Schlüssel
  -- gleich bleibt — in einer anderen Schreibweise und mit neuer J+S-Nummer.
  v := spieler_aendern(pg_temp.id('team1'), pg_temp.id('alt1'), 'LEA', 'alt', 2017, '999');
  if v <> '{"status": "geaendert"}'::jsonb then raise exception 'AK 7: Altdublette nicht geändert: %', v; end if;
  -- AK 3, 4: Eine dritte Erfassung nennt die Teams beider Datensätze; im eigenen Team.
  v := spieler_aufnehmen(pg_temp.id('team1'), 'Lea', 'Alt', 2017, null);
  if v <> '{"status": "abgewiesen", "grund": "doppelt", "eigenes_team": true, "teams": ["Team Eins", "Team Zwei"], "ohne_team": false}'::jsonb then
    raise exception 'Dritte Erfassung: %', v;
  end if;
  -- AK 5: Mia auf den Schlüssel der Altdublette → abgewiesen mit beiden Teams.
  v := spieler_aendern(pg_temp.id('team1'), pg_temp.id('mia'), 'Lea', 'Alt', 2017, null);
  if v <> '{"status": "abgewiesen", "grund": "doppelt", "eigenes_team": true, "teams": ["Team Eins", "Team Zwei"], "ohne_team": false}'::jsonb then
    raise exception 'AK 5: Ändern auf vergebenen Schlüssel: %', v;
  end if;
  -- Die Altdublette auf einen freien Schlüssel und zurück: zurück ist vergeben.
  v := spieler_aendern(pg_temp.id('team1'), pg_temp.id('alt1'), 'Lea', 'Neu', 2017, null);
  if v <> '{"status": "geaendert"}'::jsonb then raise exception 'Altdublette auf freien Schlüssel: %', v; end if;
  v := spieler_aendern(pg_temp.id('team1'), pg_temp.id('alt1'), 'Lea', 'Alt', 2017, null);
  if v <> '{"status": "abgewiesen", "grund": "doppelt", "eigenes_team": false, "teams": ["Team Zwei"], "ohne_team": false}'::jsonb then
    raise exception 'Altdublette zurück auf vergebenen Schlüssel: %', v;
  end if;
end $$;
-- Eine Spieler:in eines fremden Teams ändert ein Mitglied nicht (Rollen nach Ort).
select pg_temp.erwarte(format($$select spieler_aendern(%L, %L, 'Lea', 'Alt', 2017, null)$$,
                              pg_temp.id('team1'), pg_temp.id('alt2')), 'SPIELER_NICHT_GEFUNDEN');
select pg_temp.erwarte(format($$select spieler_aendern(%L, %L, 'Lea', 'Alt', 2017, null)$$,
                              pg_temp.id('team2'), pg_temp.id('alt2')), 'SPIELER_NICHT_GEFUNDEN');
select pg_temp.erwarte(format($$select spieler_doppelt(%L, 'Lea', 'Alt', 2017)$$, pg_temp.id('verein')), '42501');
-- OoS 3: Import in das leere Team 3; Zeile 1 ist neu im Verein, Zeile 2 trifft
-- Mia aus Team 1. Das Netz bricht die ganze Übernahme ab.
select pg_temp.erwarte(format($$select spieler_importieren(%L,
  '[{"zeile": 1, "vorname": "Nora", "nachname": "Import", "jahrgang": 2017},
    {"zeile": 2, "vorname": "mia", "nachname": "ALT", "jahrgang": 2017}]'::jsonb,
  '{"neu": [1, 2], "js": []}'::jsonb)$$, pg_temp.id('team3')), 'SPIELER_DOPPELT');
reset role;

-- Das Netz im Trigger, ohne eindeutigen Index: INSERT und Schlüsseländerung
-- auf einen vergebenen Schlüssel (ohne Schlüsseländerung: oben, vor der Umbenennung).
select pg_temp.erwarte(format($$insert into spieler (team_id, verein_id, vorname, nachname, jahrgang)
                                values (%L, %L, 'lea', 'ALT', 2017)$$, pg_temp.id('team1'), pg_temp.id('verein')),
                       'SPIELER_DOPPELT');
select pg_temp.erwarte(format($$update spieler set vorname = 'Lea' where id = %L$$, pg_temp.id('mia')),
                       'SPIELER_DOPPELT');

do $$
begin
  -- OoS 3: Nichts vom Import ist geblieben, keine Zeile, keine Zuordnung, und
  -- die erwartete Spielerzahl des anstehenden Termins ist unverändert.
  if exists (select 1 from spieler where verein_id = pg_temp.id('verein') and nachname = 'Import')
     or exists (select 1 from team_spieler where team_id = pg_temp.id('team3'))
     or (select count(*) from spieler where verein_id = pg_temp.id('verein')) <> 3 then
    raise exception 'OoS 3: Der abgebrochene Import hat Zeilen oder Zuordnungen hinterlassen';
  end if;
  if (select erwartete_spielerzahl from training_termine where id = pg_temp.id('termin')) is distinct from 12::smallint then
    raise exception 'OoS 3: Erwartete Spielerzahl nach dem abgebrochenen Import verändert';
  end if;
  if (select count(*) from spieler where verein_id = pg_temp.id('verein')
                                      and spieler_text_schluessel(vorname) = 'lea' and nachname = 'Alt') <> 1
     or (select js_nummer from spieler where id = pg_temp.id('alt2')) <> '42'
     or (select nachname from spieler where id = pg_temp.id('alt1')) <> 'Neu'
     or (select vorname from spieler where id = pg_temp.id('mia')) <> 'Mia' then
    raise exception 'Bestand nach den Prüfungen falsch';
  end if;
  -- PC 1: Die Altdublette bestand bis zur Umbenennung als zwei Datensätze mit je eigener Zuordnung.
  if (select count(*) from team_spieler where spieler_id in (pg_temp.id('alt1'), pg_temp.id('alt2'))) <> 2 then
    raise exception 'PC 1: Zuordnungen der Altdublette verändert';
  end if;
  -- Index: kein eindeutiger über den Schlüssel mehr, der je Verein ist nicht eindeutig.
  if exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'spieler'
                and indexdef ~* '^create unique index' and indexdef ~ 'spieler_text_schluessel') then
    raise exception 'Eindeutiger Index über den Spieler-Schlüssel besteht noch';
  end if;
  if not exists (select 1 from pg_index where indexrelid = to_regclass('public.spieler_schluessel_verein') and not indisunique) then
    raise exception 'Index spieler_schluessel_verein fehlt oder ist eindeutig';
  end if;
  if has_function_privilege('anon', 'spieler_doppelt(uuid, text, text, integer, uuid)', 'execute')
     or has_function_privilege('authenticated', 'spieler_doppelt(uuid, text, text, integer, uuid)', 'execute') then
    raise exception 'spieler_doppelt ist für anon oder authenticated ausführbar';
  end if;
end $$;

rollback;
