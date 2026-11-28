-- «Verein voll» am Team-Ort (#706 AK 7), team_verein_voll:
-- - Mitglied eines Teams: false bei 999 Spieler:innen im Verein, true bei 1000
-- - Spieler:innen eines anderen Vereins zählen nicht mit
-- - Mitglied eines anderen Teams und Vereinsverwaltung ohne Teamzugehörigkeit
--   bekommen 42501 (Rollen nach Ort)
-- - Rückgabe ist boolean, keine Zahl
-- - anon hat kein Recht, authenticated schon
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

create function pg_temp.pruefe(p_ok boolean, p_text text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception '#706: %', p_text; end if;
end $$;

create function pg_temp.fehler(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('v'), ('w'), ('a'), ('b'), ('verw'), ('t1'), ('t2'), ('t3');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@verein-voll.test', now() from ids where name in ('a', 'b', 'verw');

-- a ist Trainer:in von T1 (Verein V), b von T3 (Verein W). verw verwaltet V
-- ohne Teamzugehörigkeit. V hat 999 Spieler:innen, W 5. Unter `replica`:
-- Der Test setzt den Bestand selbst, ohne die Trigger.
set local session_replication_role = replica;
insert into vereine (id, name) values (pg_temp.id('v'), 'Voll-Verein'), (pg_temp.id('w'), 'Anderer Verein');
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Team Eins', pg_temp.id('v')),
  (pg_temp.id('t2'), 'Team Zwei', pg_temp.id('v')),
  (pg_temp.id('t3'), 'Team Drei', pg_temp.id('w'));
insert into team_members (team_id, user_id) values (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t3'), pg_temp.id('b'));
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v'), pg_temp.id('verw'));
insert into spieler (verein_id, vorname, nachname, jahrgang)
select pg_temp.id('v'), 'Vorname' || g, 'Nachname', 2015 from generate_series(1, 999) g;
insert into spieler (verein_id, vorname, nachname, jahrgang)
select pg_temp.id('w'), 'Andere' || g, 'Nachname', 2015 from generate_series(1, 5) g;
set local session_replication_role = origin;

-- Rückgabe ist boolean, keine Zahl.
select pg_temp.pruefe(
  (select prorettype = 'boolean'::regtype from pg_proc where oid = 'team_verein_voll(uuid)'::regprocedure),
  'team_verein_voll gibt boolean zurück');

-- 999: noch Platz; die Spieler:innen des anderen Vereins zählen nicht.
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(team_verein_voll(pg_temp.id('t1')) = false, '999 im Verein: nicht voll');
select pg_temp.zurueck();

-- 1000: voll.
set local session_replication_role = replica;
insert into spieler (verein_id, vorname, nachname, jahrgang) values (pg_temp.id('v'), 'Letzte', 'Nachname', 2015);
set local session_replication_role = origin;
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(team_verein_voll(pg_temp.id('t1')) = true, '1000 im Verein: voll');
select pg_temp.zurueck();

-- Ein anderer Verein bleibt davon unberührt.
select pg_temp.als(pg_temp.id('b'));
select pg_temp.pruefe(team_verein_voll(pg_temp.id('t3')) = false, 'anderer Verein: nicht voll');
-- Mitglied eines anderen Teams: 42501.
select pg_temp.pruefe(pg_temp.fehler(format('select team_verein_voll(%L)', pg_temp.id('t1'))) = '42501', 'fremdes Team: 42501');
select pg_temp.zurueck();

-- Die Verwaltung ohne Teamzugehörigkeit erfährt es am Team-Ort nicht.
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(pg_temp.fehler(format('select team_verein_voll(%L)', pg_temp.id('t2'))) = '42501', 'Verwaltung ohne Team: 42501');
select pg_temp.zurueck();

-- anon hat kein Recht auf die Funktion.
select pg_temp.pruefe(not has_function_privilege('anon', 'team_verein_voll(uuid)', 'execute'),
  'anon darf team_verein_voll nicht aufrufen');
select pg_temp.pruefe(has_function_privilege('authenticated', 'team_verein_voll(uuid)', 'execute'),
  'authenticated darf team_verein_voll aufrufen');

rollback;
