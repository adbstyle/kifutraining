-- Vereine, Fundament (Story 1 #577; Architekturplan Vereine §3.1, §3.3 c,
-- §3.10, §6.7 Testfälle 1, 2, 3 erster Teil, 26):
-- - kein Team ohne Verein, höchstens 30 Teams je Verein
-- - höchstens ein Verein je Person (Team und Verwaltung)
-- - `teams.verein_id` per PostgREST-Rolle nicht änderbar (Testfall 2)
-- - `create_team` nur durch die Verwaltung, im eigenen Verein (Testfall 3)
-- - `meine_vereinslage()` und die Sichtbarkeit der Vereine
-- - Grenzen 100 je Team und 1000 je Verein nur für Neues; Bestand darüber
--   bleibt änderbar und löschbar (Testfall 1, Story 1 PC 2)
-- - `delete_account()`: letzte Verwaltung, KI-Token, Erfolg
-- - Funktionen ohne API-Zweck für anon und authenticated gesperrt (Testfall 26)
-- Alles in einer Transaktion mit rollback; hinterlässt nichts. Die Rolle
-- wechselt wie bei PostgREST über `role` und `request.jwt.claims`.

\set ON_ERROR_STOP on
-- Ergebnisse der Prüfaufrufe nicht ausgeben; Fehler gehen weiter nach stderr.
\o /dev/null

begin;
set local statement_timeout = '60s';

-- Als Konto handeln (wie PostgREST), zurück mit `reset role`.
create function pg_temp.als(p_user uuid, p_mehr jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_user, 'role', 'authenticated') || p_mehr)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Führt SQL aus und liefert den Fehler (SQLSTATE und Meldung) oder null.
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
insert into ids (name) values ('verw'), ('verw2'), ('a'), ('ohne'), ('c'), ('v1'), ('v2'), ('team1'), ('teamx');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@vereine-fundament.test', now() from ids where name in ('verw', 'verw2', 'a', 'ohne', 'c');

-- Zwei Vereine, je ein Team mit Mitglied; V1 mit Verwaltung.
insert into vereine (id, name) values (pg_temp.id('v1'), 'Test-Verein Eins'), (pg_temp.id('v2'), 'Test-Verein Zwei');
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v1'), pg_temp.id('verw'));
insert into teams (id, name, verein_id) values (pg_temp.id('team1'), 'Team Eins', pg_temp.id('v1')),
                                              (pg_temp.id('teamx'), 'Team X', pg_temp.id('v2'));
insert into team_members (team_id, user_id) values (pg_temp.id('team1'), pg_temp.id('a')),
                                                  (pg_temp.id('teamx'), pg_temp.id('c'));

-- Kein Team ohne Verein; höchstens ein Verein je Person.
select pg_temp.erwarte($$insert into teams (name) values ('Ohne Verein')$$, 'VEREIN_FEHLT');
select pg_temp.erwarte(format('insert into team_members (team_id, user_id) values (%L, %L)',
                              pg_temp.id('team1'), pg_temp.id('c')), 'ANDERER_VEREIN');
select pg_temp.erwarte(format('insert into verein_verwaltung (verein_id, user_id) values (%L, %L)',
                              pg_temp.id('v1'), pg_temp.id('c')), 'ANDERER_VEREIN');
select pg_temp.erwarte(format('delete from verein_verwaltung where user_id = %L', pg_temp.id('verw')),
                       'LETZTE_VERWALTUNG');

-- Höchstens 30 Teams je Verein (V2 hat eines).
insert into teams (name, verein_id) select 'X ' || i, pg_temp.id('v2') from generate_series(2, 30) i;
select pg_temp.erwarte(format('insert into teams (name, verein_id) values (%L, %L)', 'X 31', pg_temp.id('v2')),
                       'VEREIN_TEAMS_VOLL');

-- Testfall 2: Ein Mitglied darf das Team ändern (Name), aber nicht den Verein.
select pg_temp.als(pg_temp.id('a'));
select pg_temp.erwarte(format('update teams set verein_id = %L where id = %L', pg_temp.id('v2'), pg_temp.id('team1')),
                       'VEREIN_FEST');
update teams set name = 'Team Eins neu' where id = pg_temp.id('team1');
reset role;
do $$
begin
  if (select verein_id from teams where id = pg_temp.id('team1')) <> pg_temp.id('v1')
     or (select name from teams where id = pg_temp.id('team1')) <> 'Team Eins neu' then
    raise exception 'Testfall 2: Team falsch geändert';
  end if;
end $$;

-- Lage und Sichtbarkeit: Mitglied, Konto ohne Verein.
select pg_temp.als(pg_temp.id('a'));
do $$
declare
  v jsonb := meine_vereinslage();
begin
  if v <> jsonb_build_object('verein', jsonb_build_object('id', pg_temp.id('v1'), 'name', 'Test-Verein Eins',
                                                          'ist_verwaltung', false, 'ist_teammitglied', true),
                             'grenzen', null) then
    raise exception 'meine_vereinslage (Mitglied): %', v;
  end if;
  if (select array_agg(id) from vereine) is distinct from array[pg_temp.id('v1')] then
    raise exception 'Mitglied sieht nicht genau den eigenen Verein';
  end if;
end $$;
reset role;
select pg_temp.als(pg_temp.id('ohne'));
do $$
begin
  if meine_vereinslage() <> '{"verein": null, "grenzen": null}'::jsonb then
    raise exception 'meine_vereinslage (ohne Verein): %', meine_vereinslage();
  end if;
  if exists (select 1 from vereine) then raise exception 'Konto ohne Verein sieht einen Verein'; end if;
end $$;
reset role;

-- Testfall 3 (erster Teil): create_team nur durch die Verwaltung.
select pg_temp.als(pg_temp.id('a'));
select pg_temp.erwarte($$select create_team('Von Mitglied')$$, 'TEAM_NUR_VERWALTUNG');
reset role;
select pg_temp.als(pg_temp.id('ohne'));
select pg_temp.erwarte($$select create_team('Ohne Verein')$$, 'TEAM_NUR_VERWALTUNG');
reset role;
select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  v_team uuid := create_team('Von Verwaltung');
  v jsonb := meine_vereinslage();
begin
  if (v -> 'verein' ->> 'ist_verwaltung')::boolean is not true
     or (v -> 'verein' ->> 'ist_teammitglied')::boolean is not true then
    raise exception 'meine_vereinslage (Verwaltung): %', v;
  end if;
  perform set_config('test.neues_team', v_team::text, true);
end $$;
reset role;
do $$
declare
  v_team uuid := current_setting('test.neues_team')::uuid;
begin
  if (select verein_id from teams where id = v_team) is distinct from pg_temp.id('v1')
     or not exists (select 1 from team_members where team_id = v_team and user_id = pg_temp.id('verw')) then
    raise exception 'Testfall 3: Team nicht im Verein der Verwaltung oder ohne Mitgliedschaft';
  end if;
end $$;

-- Testfall 1: Bestand über den Grenzen (per replica angelegt) bleibt änderbar
-- und löschbar; nur Neues wird abgewiesen, getrennt nach Team und Verein.
set local session_replication_role = replica;
with neu as (
  insert into spieler (team_id, verein_id, vorname, nachname, jahrgang)
  select pg_temp.id('team1'), pg_temp.id('v1'), 'Eins', 'Nr ' || i, 2015 from generate_series(1, 150) i
  returning id)
insert into team_spieler (team_id, spieler_id, verein_id) select pg_temp.id('team1'), id, pg_temp.id('v1') from neu;
insert into spieler (team_id, verein_id, vorname, nachname, jahrgang)
select pg_temp.id('teamx'), pg_temp.id('v2'), 'Zwei', 'Nr ' || i, 2016 from generate_series(1, 1000) i;
set local session_replication_role = origin;

select pg_temp.als(pg_temp.id('a'));
do $$
declare
  v_spieler uuid := (select spieler_id from team_spieler where team_id = pg_temp.id('team1') limit 1);
begin
  perform spieler_aendern(v_spieler, 'Geändert', 'Nr 1', 2015, null);
  perform spieler_entfernen((select spieler_id from team_spieler
                              where team_id = pg_temp.id('team1') and spieler_id <> v_spieler limit 1));
end $$;
select pg_temp.erwarte(format($$select spieler_aufnehmen(%L, 'Neu', 'Neu', 2015, null)$$, pg_temp.id('team1')),
                       'SPIELERLISTE_VOLL');
reset role;
select pg_temp.als(pg_temp.id('c'));
select pg_temp.erwarte(format($$select spieler_aufnehmen(%L, 'Neu', 'Neu', 2015, null)$$, pg_temp.id('teamx')),
                       'VEREIN_VOLL');
reset role;
do $$
begin
  if (select count(*) from team_spieler where team_id = pg_temp.id('team1')) <> 149
     or not exists (select 1 from spieler where team_id = pg_temp.id('team1') and vorname = 'Geändert')
     or (select count(*) from spieler where verein_id = pg_temp.id('v2')) <> 1000 then
    raise exception 'Testfall 1: Bestand nicht wie erwartet';
  end if;
end $$;

-- delete_account: letzte Verwaltung → Status, nichts gelöscht; KI-Token →
-- NUR_IN_DER_ANWENDUNG; mit zweiter Verwaltung → gelöscht.
select pg_temp.als(pg_temp.id('verw'));
do $$
begin
  if delete_account() <> '{"status": "letzte_verwaltung"}'::jsonb then
    raise exception 'delete_account der letzten Verwaltung: kein Status letzte_verwaltung';
  end if;
end $$;
reset role;
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v1'), pg_temp.id('verw2'));
select pg_temp.als(pg_temp.id('verw'), '{"client_id": "ki-client"}');
select pg_temp.erwarte('select delete_account()', 'NUR_IN_DER_ANWENDUNG');
reset role;
select pg_temp.als(pg_temp.id('verw'));
do $$
begin
  if delete_account() <> '{"status": "geloescht"}'::jsonb then
    raise exception 'delete_account mit zweiter Verwaltung: kein Status geloescht';
  end if;
end $$;
reset role;
do $$
begin
  if exists (select 1 from verein_verwaltung where user_id = pg_temp.id('verw'))
     or not exists (select 1 from verein_verwaltung where user_id = pg_temp.id('verw2')) then
    raise exception 'delete_account: Verwaltung falsch';
  end if;
end $$;

-- Schreiben in die neuen Tabellen nur per RPC.
select pg_temp.als(pg_temp.id('a'));
select pg_temp.erwarte($$insert into vereine (name) values ('Direkt')$$, '42501');
select pg_temp.erwarte(format('insert into team_spieler (team_id, spieler_id, verein_id) select team_id, spieler_id, verein_id from team_spieler where team_id = %L limit 1',
                              pg_temp.id('team1')), '42501');
select pg_temp.erwarte('select * from verein_verwaltung', '42501');
reset role;

-- Testfall 26: Funktionen ohne API-Zweck sind für anon und authenticated
-- nicht ausführbar; die Prädikate nicht für anon. Ein Aufruf zur Probe.
do $$
declare
  f text;
  r text;
begin
  foreach f in array array[
    'person_verein(uuid)', 'sperre_verein(uuid)', 'sperre_person(uuid)', 'sperre_teams(uuid[])',
    'nur_in_der_anwendung()', 'spieler_im_team(uuid,uuid)', 'spielerzahl_freigeben(uuid)',
    'vereine_nachziehen(uuid)', 'staging_nach_sync()', 'teams_vorher()', 'teams_verein_fest()',
    'team_members_vorher()', 'verwaltung_vorher()', 'team_spieler_vorher()'] loop
    foreach r in array array['anon', 'authenticated'] loop
      if has_function_privilege(r, f, 'execute') then
        raise exception 'Testfall 26: % darf % ausführen', r, f;
      end if;
    end loop;
  end loop;
  foreach f in array array['mein_verein()', 'ist_verein_mitglied(uuid)', 'ist_verein_verwaltung(uuid)',
                           'meine_vereinslage()', 'delete_account()', 'create_team(text)'] loop
    if has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute') then
      raise exception 'Testfall 26: Grant von % falsch', f;
    end if;
  end loop;
end $$;
select pg_temp.als(pg_temp.id('a'));
select pg_temp.erwarte($$select vereine_nachziehen(null)$$, '42501');
select pg_temp.erwarte(format('select person_verein(%L)', pg_temp.id('a')), '42501');
reset role;

rollback;
