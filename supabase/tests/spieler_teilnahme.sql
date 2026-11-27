-- Teilnahme-Statistik einer Spieler:in (#700), spieler_teilnahme:
-- - Festgehaltene Trainings: da (auch abgemeldet und doch erschienen),
--   abgemeldet, angemeldet und nicht erschienen; ohne Zeile der Spieler:in
--   (bei Beginn nicht auf der Liste) zählt der Termin nicht
-- - Festgehaltene Spiele: da (auch abgemeldet und doch erschienen), nicht
--   aufgeboten vor der Meldung, angemeldet und nicht erschienen, ohne
--   Meldung als «meldefrist_verpasst» mit Frist, sonst «ohne_meldung»
-- - Begonnen, nicht festgehalten: der laufende Meldestand (Abmeldung,
--   Spielmeldung, ohne Meldung)
-- - Ausgefallene und kommende Termine zählen nie; der Zeitraum schliesst
--   beide Tage ein, ein fehlender Tag lässt die Seite offen
-- - Schnuppern (AK 4): Trainings ohne Anmeldung zählen als abgemeldet,
--   Spiele gelten nicht
-- - Nur Mitglieder des Teams bekommen Zeilen; anon hat kein Recht
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
  if p_ok is not true then raise exception '#700: %', p_text; end if;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('v'), ('a'), ('b'), ('t1'), ('t2'), ('lena'), ('elin'),
  ('tr1'), ('tr2'), ('tr3'), ('tr4'), ('tr5'), ('tr6'), ('tr7'), ('tr8'), ('tr9'),
  ('sp1'), ('sp2'), ('sp3'), ('sp4'), ('sp5'), ('sp6'), ('sp7'), ('sp8');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

-- Die Statistik als eine Zeichenkette, sortiert: «art:ergebnis=n,…».
create function pg_temp.stand(p_von date default null, p_bis date default null, p_spieler text default 'lena')
returns text language sql as $$
  select coalesce(string_agg(art || ':' || ergebnis || '=' || anzahl, ',' order by art, ergebnis), '')
    from spieler_teilnahme(pg_temp.id('t1'), pg_temp.id(p_spieler), p_von, p_bis)
$$;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@teilnahme.test', now() from ids where name in ('a', 'b');

-- a ist Mitglied von T1, b nur von T2. Lena gehört T1, Elin schnuppert in T1.
-- Alles unter `replica`: Die Trigger hielten beim Zuordnen die begonnenen
-- Termine fest; hier setzt der Test jeden Stand selbst.
set local session_replication_role = replica;
insert into vereine (id, name) values (pg_temp.id('v'), 'Teilnahme-Verein');
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Team Eins', pg_temp.id('v')), (pg_temp.id('t2'), 'Team Zwei', pg_temp.id('v'));
insert into team_members (team_id, user_id) values (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t2'), pg_temp.id('b'));
insert into spieler (id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('lena'), pg_temp.id('v'), 'Lena', 'Brunner', 2015),
  (pg_temp.id('elin'), pg_temp.id('v'), 'Elin', 'Rossi', 2016);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values
  (pg_temp.id('t1'), pg_temp.id('lena'), pg_temp.id('v'), null),
  (pg_temp.id('t1'), pg_temp.id('elin'), pg_temp.id('v'), now() - interval '30 days');

insert into training_termine (id, team_id, datum, beginn, ende, art, ausgefallen, meldefrist_vorlauf_min, bezeichnung) values
  (pg_temp.id('tr1'), pg_temp.id('t1'), current_date - 20, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr2'), pg_temp.id('t1'), current_date - 18, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr3'), pg_temp.id('t1'), current_date - 16, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr4'), pg_temp.id('t1'), current_date - 14, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr5'), pg_temp.id('t1'), current_date - 12, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr6'), pg_temp.id('t1'), current_date - 10, '10:00', '11:00', 'training', true, null, null),
  (pg_temp.id('tr7'), pg_temp.id('t1'), current_date - 8, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr8'), pg_temp.id('t1'), current_date - 6, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr9'), pg_temp.id('t1'), current_date + 5, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('sp1'), pg_temp.id('t1'), current_date - 19, '10:00', '12:00', 'spiel', false, null, 'Match'),
  (pg_temp.id('sp2'), pg_temp.id('t1'), current_date - 17, '10:00', '12:00', 'spiel', false, null, 'Match'),
  (pg_temp.id('sp3'), pg_temp.id('t1'), current_date - 15, '10:00', '12:00', 'spiel', false, 1440, 'Match'),
  (pg_temp.id('sp4'), pg_temp.id('t1'), current_date - 13, '10:00', '12:00', 'spiel', false, null, 'Match'),
  (pg_temp.id('sp5'), pg_temp.id('t1'), current_date - 11, '10:00', '12:00', 'spiel', false, null, 'Match'),
  (pg_temp.id('sp6'), pg_temp.id('t1'), current_date - 9, '10:00', '12:00', 'spiel', false, null, 'Match'),
  (pg_temp.id('sp7'), pg_temp.id('t1'), current_date - 7, '10:00', '12:00', 'spiel', false, null, 'Match'),
  (pg_temp.id('sp8'), pg_temp.id('t1'), current_date - 5, '10:00', '12:00', 'spiel', false, null, 'Match');

-- Festgehalten: tr1–tr6 und sp1–sp6. tr5 ohne Zeile für Lena (bei Beginn
-- nicht auf der Liste), tr6 ausgefallen.
insert into termin_eingefroren (termin_id, team_id)
select pg_temp.id(n), pg_temp.id('t1')
  from unnest(array['tr1','tr2','tr3','tr4','tr5','tr6','sp1','sp2','sp3','sp4','sp5','sp6']) n;
insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet, nachgetragen) values
  (pg_temp.id('tr1'), pg_temp.id('t1'), pg_temp.id('lena'), false, false),  -- da
  (pg_temp.id('tr2'), pg_temp.id('t1'), pg_temp.id('lena'), true, false),   -- abgemeldet
  (pg_temp.id('tr3'), pg_temp.id('t1'), pg_temp.id('lena'), false, true),   -- nicht erschienen
  (pg_temp.id('tr4'), pg_temp.id('t1'), pg_temp.id('lena'), true, true),    -- doch erschienen
  (pg_temp.id('tr6'), pg_temp.id('t1'), pg_temp.id('lena'), false, false);  -- ausgefallen
insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, nicht_aufgeboten, nachgetragen) values
  (pg_temp.id('sp1'), pg_temp.id('t1'), pg_temp.id('lena'), 'angemeldet', false, false),  -- da
  (pg_temp.id('sp2'), pg_temp.id('t1'), pg_temp.id('lena'), 'angemeldet', true, false),   -- nicht aufgeboten
  (pg_temp.id('sp3'), pg_temp.id('t1'), pg_temp.id('lena'), null, false, false),          -- Frist verpasst
  (pg_temp.id('sp4'), pg_temp.id('t1'), pg_temp.id('lena'), null, false, false),          -- ohne Meldung
  (pg_temp.id('sp5'), pg_temp.id('t1'), pg_temp.id('lena'), 'angemeldet', false, true),   -- nicht erschienen
  (pg_temp.id('sp6'), pg_temp.id('t1'), pg_temp.id('lena'), 'abgemeldet', false, true);   -- doch erschienen

-- Offen, aber begonnen: tr7 mit Abmeldung, tr8 ohne; sp7 abgemeldet, sp8
-- ohne Meldung. Eine verfallene Abmeldung zählt nicht.
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet, verfallen_am, vorher_datum, vorher_beginn) values
  (pg_temp.id('tr7'), pg_temp.id('lena'), pg_temp.id('t1'), false, null, null, null),
  (pg_temp.id('tr8'), pg_temp.id('lena'), pg_temp.id('t1'), false, now() - interval '7 days', current_date - 4, '10:00');
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am) values
  (pg_temp.id('sp7'), pg_temp.id('lena'), pg_temp.id('t1'), 'abgemeldet', now() - interval '8 days');
set local session_replication_role = origin;

-- Als Mitglied von T1.
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(pg_temp.stand() =
  'spiel:abgemeldet=1,spiel:da=2,spiel:meldefrist_verpasst=1,spiel:nicht_aufgeboten=1,spiel:nicht_erschienen=1,spiel:ohne_meldung=2,'
  || 'training:abgemeldet=2,training:da=3,training:nicht_erschienen=1',
  'ganze Zeit: ' || pg_temp.stand());
-- Zeitraum: beide Tage eingeschlossen.
select pg_temp.pruefe(pg_temp.stand(current_date - 16, current_date - 13) =
  'spiel:meldefrist_verpasst=1,spiel:ohne_meldung=1,training:da=1,training:nicht_erschienen=1',
  'Zeitraum: ' || pg_temp.stand(current_date - 16, current_date - 13));
-- Nur ein Tag: die andere Seite bleibt offen.
select pg_temp.pruefe(pg_temp.stand(current_date - 6, null) = 'spiel:ohne_meldung=1,training:da=1',
  'nur von: ' || pg_temp.stand(current_date - 6, null));
select pg_temp.pruefe(pg_temp.stand(null, current_date - 19) = 'spiel:da=1,training:da=1',
  'nur bis: ' || pg_temp.stand(null, current_date - 19));
-- Ohne Termin im Zeitraum: keine Zeilen.
select pg_temp.pruefe(pg_temp.stand(current_date - 40, current_date - 30) = '', 'leerer Zeitraum');
-- Schnuppern: offene Trainings ohne Anmeldung zählen als abgemeldet, Spiele gelten nicht.
select pg_temp.pruefe(pg_temp.stand(null, null, 'elin') = 'training:abgemeldet=2',
  'Schnuppern: ' || pg_temp.stand(null, null, 'elin'));
select pg_temp.zurueck();

-- Ein Mitglied eines anderen Teams sieht nichts.
select pg_temp.als(pg_temp.id('b'));
select pg_temp.pruefe(pg_temp.stand() = '', 'fremdes Team: ' || pg_temp.stand());
select pg_temp.zurueck();

-- anon hat kein Recht auf die Funktion.
select pg_temp.pruefe(not has_function_privilege('anon', 'spieler_teilnahme(uuid, uuid, date, date)', 'execute'),
  'anon darf spieler_teilnahme nicht aufrufen');
select pg_temp.pruefe(has_function_privilege('authenticated', 'spieler_teilnahme(uuid, uuid, date, date)', 'execute'),
  'authenticated darf spieler_teilnahme aufrufen');

rollback;
