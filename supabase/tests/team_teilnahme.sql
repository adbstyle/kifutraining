-- Teilnahme aller Spieler:innen eines Teams (#702), team_teilnahme:
-- - Äquivalenz (NFR 3): Für jede Spieler:in des Teams sind die Zeilen von
--   team_teilnahme gleich spieler_teilnahme — festgehaltene Trainings und
--   Spiele, begonnene offene Termine, Schnuppern, später Eingetretene,
--   Kader-Termine, Nachträge (doch und nicht erschienen), nicht aufgeboten,
--   mit und ohne Meldefrist, ausgefallen und kommend; ganze Zeit, nur von,
--   nur bis, beides
-- - Zwillinge: teilnahme_kern rechnet «gilt» und «abgemeldet» offener
--   Termine wie termin_gilt_fuer und training_abgemeldet
-- - Ehemalige (nicht mehr in team_spieler) erscheinen nicht (AK 1)
-- - Nicht-Mitglied und Vereinsverwaltung ohne Mitgliedschaft → 42501 (NFR 2)
-- - anon hat kein Recht auf team_teilnahme, authenticated keins auf
--   teilnahme_kern
-- - höchstens eine Zeile je Spieler:in
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
  if p_ok is not true then raise exception '#702: %', p_text; end if;
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
insert into ids (name) values ('v'), ('a'), ('b'), ('va'), ('t1'), ('t2'), ('k'),
  ('lena'), ('elin'), ('mia'), ('noah'), ('ex'),
  ('tr1'), ('tr2'), ('tr3'), ('tr4'), ('tr5'), ('tr6'), ('sp1'), ('sp2'), ('sp3'), ('sp4');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

-- Die Zahlen einer Spieler:in als Zeichenkette «art:ergebnis=n,…», einmal
-- aus spieler_teilnahme und einmal aus team_teilnahme.
create function pg_temp.einzel(p_spieler uuid, p_von date, p_bis date) returns text
language sql as $$
  select coalesce(string_agg(art || ':' || ergebnis || '=' || anzahl, ',' order by art, ergebnis), '')
    from spieler_teilnahme(pg_temp.id('t1'), p_spieler, p_von, p_bis)
$$;
create function pg_temp.team(p_spieler uuid, p_von date, p_bis date) returns text
language sql as $$
  select coalesce(string_agg((z ->> 'art') || ':' || (z ->> 'ergebnis') || '=' || (z ->> 'anzahl'), ','
                             order by z ->> 'art', z ->> 'ergebnis'), '')
    from team_teilnahme(pg_temp.id('t1'), p_von, p_bis) tt, jsonb_array_elements(tt.zeilen) z
   where tt.spieler_id = p_spieler
$$;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@team-teilnahme.test', now() from ids where name in ('a', 'b', 'va');

-- a ist Mitglied von T1, b nur von T2, va verwaltet den Verein ohne Team.
-- Lena, Mia und Noah gehören T1, Elin schnuppert dort, Noah ist erst nach
-- den festgehaltenen Terminen dazugekommen; «ex» stand früher auf der Liste.
-- Alles unter `replica`: Die Trigger hielten beim Zuordnen die begonnenen
-- Termine fest; hier setzt der Test jeden Stand selbst.
set local session_replication_role = replica;
insert into vereine (id, name) values (pg_temp.id('v'), 'Team-Teilnahme-Verein');
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Team Eins', pg_temp.id('v')), (pg_temp.id('t2'), 'Team Zwei', pg_temp.id('v'));
insert into team_members (team_id, user_id) values (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t2'), pg_temp.id('b'));
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v'), pg_temp.id('va'));
insert into spieler (id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('lena'), pg_temp.id('v'), 'Lena', 'Brunner', 2015),
  (pg_temp.id('elin'), pg_temp.id('v'), 'Elin', 'Rossi', 2016),
  (pg_temp.id('mia'), pg_temp.id('v'), 'Mia', 'Keller', 2015),
  (pg_temp.id('noah'), pg_temp.id('v'), 'Noah', 'Huber', 2016),
  (pg_temp.id('ex'), pg_temp.id('v'), 'Ex', 'Weg', 2015);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values
  (pg_temp.id('t1'), pg_temp.id('lena'), pg_temp.id('v'), null),
  (pg_temp.id('t1'), pg_temp.id('elin'), pg_temp.id('v'), now() - interval '30 days'),
  (pg_temp.id('t1'), pg_temp.id('mia'), pg_temp.id('v'), null),
  (pg_temp.id('t1'), pg_temp.id('noah'), pg_temp.id('v'), null);
insert into kader (id, team_id, name) values (pg_temp.id('k'), pg_temp.id('t1'), 'Kader A');
insert into kader_spieler (kader_id, spieler_id, team_id) values (pg_temp.id('k'), pg_temp.id('mia'), pg_temp.id('t1'));

insert into training_termine (id, team_id, datum, beginn, ende, art, ausgefallen, meldefrist_vorlauf_min, bezeichnung) values
  (pg_temp.id('tr1'), pg_temp.id('t1'), current_date - 20, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr2'), pg_temp.id('t1'), current_date - 18, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr3'), pg_temp.id('t1'), current_date - 8, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr4'), pg_temp.id('t1'), current_date - 6, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr5'), pg_temp.id('t1'), current_date - 4, '10:00', '11:00', 'training', true, null, null),
  (pg_temp.id('tr6'), pg_temp.id('t1'), current_date + 5, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('sp1'), pg_temp.id('t1'), current_date - 19, '10:00', '12:00', 'spiel', false, 1440, 'Match'),
  (pg_temp.id('sp2'), pg_temp.id('t1'), current_date - 17, '10:00', '12:00', 'spiel', false, null, 'Match'),
  (pg_temp.id('sp3'), pg_temp.id('t1'), current_date - 7, '10:00', '12:00', 'spiel', false, null, 'Match'),
  (pg_temp.id('sp4'), pg_temp.id('t1'), current_date - 5, '10:00', '12:00', 'spiel', false, 1440, 'Match');
-- tr3 nur für Kader A (Mia).
insert into termin_kader (termin_id, kader_id, team_id) values (pg_temp.id('tr3'), pg_temp.id('k'), pg_temp.id('t1'));

-- Festgehalten: tr1, tr2, sp1, sp2 (Noah war noch nicht dabei: keine Zeile).
insert into termin_eingefroren (termin_id, team_id)
select pg_temp.id(n), pg_temp.id('t1') from unnest(array['tr1','tr2','sp1','sp2']) n;
insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet, nachgetragen) values
  (pg_temp.id('tr1'), pg_temp.id('t1'), pg_temp.id('lena'), false, false),  -- da
  (pg_temp.id('tr1'), pg_temp.id('t1'), pg_temp.id('elin'), true, false),   -- abgemeldet (Schnuppern)
  (pg_temp.id('tr1'), pg_temp.id('t1'), pg_temp.id('mia'), false, true),    -- nicht erschienen
  (pg_temp.id('tr1'), pg_temp.id('t1'), pg_temp.id('ex'), false, false),    -- Ehemalige: da
  (pg_temp.id('tr2'), pg_temp.id('t1'), pg_temp.id('lena'), true, true),    -- doch erschienen
  (pg_temp.id('tr2'), pg_temp.id('t1'), pg_temp.id('mia'), false, false);   -- da
insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, nicht_aufgeboten, nachgetragen) values
  (pg_temp.id('sp1'), pg_temp.id('t1'), pg_temp.id('lena'), null, false, false),          -- Frist verpasst
  (pg_temp.id('sp1'), pg_temp.id('t1'), pg_temp.id('mia'), 'angemeldet', true, false),    -- nicht aufgeboten
  (pg_temp.id('sp1'), pg_temp.id('t1'), pg_temp.id('ex'), 'angemeldet', false, false),    -- Ehemalige: da
  (pg_temp.id('sp2'), pg_temp.id('t1'), pg_temp.id('lena'), 'angemeldet', false, true),   -- nicht erschienen
  (pg_temp.id('sp2'), pg_temp.id('t1'), pg_temp.id('mia'), 'abgemeldet', false, true);    -- doch erschienen

-- Offen, aber begonnen: tr3 (Kader A) mit Abmeldung von Mia, tr4 mit
-- Abmeldung von Lena; sp3 Lena angemeldet, Mia nicht aufgeboten, Noah ohne
-- Meldung; sp4 (Frist) Noah abgemeldet, Lena ohne Meldung.
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet, verfallen_am, vorher_datum, vorher_beginn) values
  (pg_temp.id('tr3'), pg_temp.id('mia'), pg_temp.id('t1'), false, null, null, null),
  (pg_temp.id('tr4'), pg_temp.id('lena'), pg_temp.id('t1'), false, null, null, null),
  -- Eine verfallene Anmeldung zählt nicht: Elin bleibt beim Grundstand (abgemeldet).
  (pg_temp.id('tr4'), pg_temp.id('elin'), pg_temp.id('t1'), true, now() - interval '7 days', current_date - 3, '10:00');
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am, nicht_aufgeboten) values
  (pg_temp.id('sp3'), pg_temp.id('lena'), pg_temp.id('t1'), 'angemeldet', now() - interval '9 days', false),
  (pg_temp.id('sp3'), pg_temp.id('mia'), pg_temp.id('t1'), null, null, true),
  (pg_temp.id('sp4'), pg_temp.id('noah'), pg_temp.id('t1'), 'abgemeldet', now() - interval '6 days', false);
set local session_replication_role = origin;

-- Zwillinge (als postgres): Für offene, begonnene Termine zählt teilnahme_kern
-- genau dort, wo termin_gilt_fuer gilt, und ein Training ist genau dort
-- abgemeldet, wo training_abgemeldet es sagt.
select pg_temp.pruefe(
         (exists (select 1 from teilnahme_kern(pg_temp.id('t1'), null, null, ts.spieler_id) k where k.termin_id = t.id))
           = termin_gilt_fuer(t.id, ts.spieler_id),
         format('gilt: Termin %s, Spieler:in %s', t.datum, ts.spieler_id))
  from training_termine t join team_spieler ts on ts.team_id = t.team_id
 where t.team_id = pg_temp.id('t1') and not t.ausgefallen and termin_begonnen(t.datum, t.beginn)
   and not exists (select 1 from termin_eingefroren f where f.termin_id = t.id);
select pg_temp.pruefe(
         (select k.ergebnis = 'abgemeldet' from teilnahme_kern(pg_temp.id('t1'), null, null, ts.spieler_id) k where k.termin_id = t.id)
           = training_abgemeldet(t.id, ts.spieler_id),
         format('abgemeldet: Termin %s, Spieler:in %s', t.datum, ts.spieler_id))
  from training_termine t join team_spieler ts on ts.team_id = t.team_id
 where t.team_id = pg_temp.id('t1') and t.art = 'training' and not t.ausgefallen and termin_begonnen(t.datum, t.beginn)
   and not exists (select 1 from termin_eingefroren f where f.termin_id = t.id)
   and termin_gilt_fuer(t.id, ts.spieler_id);

-- Als Mitglied von T1.
select pg_temp.als(pg_temp.id('a'));

-- Äquivalenz für jede Spieler:in und jeden Zeitraum.
select pg_temp.pruefe(pg_temp.team(s.id, z.von, z.bis) = pg_temp.einzel(s.id, z.von, z.bis),
         format('%s %s–%s: team «%s», einzel «%s»', s.name, z.von, z.bis,
                pg_temp.team(s.id, z.von, z.bis), pg_temp.einzel(s.id, z.von, z.bis)))
  from (select name, id from ids where name in ('lena', 'elin', 'mia', 'noah')) s
 cross join (values (null::date, null::date), (current_date - 18, null), (null, current_date - 18),
                    (current_date - 19, current_date - 6), (current_date - 40, current_date - 30)) z(von, bis);

-- Die erwarteten Zahlen (ganze Zeit), damit die Äquivalenz nicht leer gleich ist.
select pg_temp.pruefe(pg_temp.team(pg_temp.id('lena'), null, null) =
  'spiel:da=1,spiel:meldefrist_verpasst=2,spiel:nicht_erschienen=1,training:abgemeldet=1,training:da=2',
  'Lena: ' || pg_temp.team(pg_temp.id('lena'), null, null));
select pg_temp.pruefe(pg_temp.team(pg_temp.id('mia'), null, null) =
  'spiel:da=1,spiel:meldefrist_verpasst=1,spiel:nicht_aufgeboten=2,training:abgemeldet=1,training:da=2,training:nicht_erschienen=1',
  'Mia: ' || pg_temp.team(pg_temp.id('mia'), null, null));
select pg_temp.pruefe(pg_temp.team(pg_temp.id('elin'), null, null) = 'training:abgemeldet=2',
  'Elin (Schnuppern): ' || pg_temp.team(pg_temp.id('elin'), null, null));
select pg_temp.pruefe(pg_temp.team(pg_temp.id('noah'), null, null) = 'spiel:abgemeldet=1,spiel:ohne_meldung=1,training:da=1',
  'Noah (später dazu): ' || pg_temp.team(pg_temp.id('noah'), null, null));

-- Ehemalige erscheinen nicht; höchstens eine Zeile je Spieler:in.
select pg_temp.pruefe(not exists (select 1 from team_teilnahme(pg_temp.id('t1')) where spieler_id = pg_temp.id('ex')),
  'Ehemalige erscheinen nicht');
select pg_temp.pruefe((select count(*) = count(distinct spieler_id) and count(*) <= 4 from team_teilnahme(pg_temp.id('t1'))),
  'eine Zeile je Spieler:in');
select pg_temp.zurueck();

-- Ein Mitglied eines anderen Teams und die Verwaltung ohne Mitgliedschaft: 42501.
select pg_temp.als(pg_temp.id('b'));
select pg_temp.pruefe(pg_temp.fehler(format('select * from team_teilnahme(%L)', pg_temp.id('t1'))) = '42501',
  'fremdes Team: 42501');
select pg_temp.zurueck();
select pg_temp.als(pg_temp.id('va'));
select pg_temp.pruefe(pg_temp.fehler(format('select * from team_teilnahme(%L)', pg_temp.id('t1'))) = '42501',
  'Verwaltung ohne Mitgliedschaft: 42501');
select pg_temp.pruefe(pg_temp.fehler(format('select * from spieler_teilnahme(%L, %L)', pg_temp.id('t1'), pg_temp.id('lena'))) = '42501',
  'Verwaltung ohne Mitgliedschaft, Einzel: 42501');
select pg_temp.zurueck();

-- Rechte: team_teilnahme nur für authenticated, teilnahme_kern für niemanden über die API.
select pg_temp.pruefe(not has_function_privilege('anon', 'team_teilnahme(uuid, date, date)', 'execute'),
  'anon darf team_teilnahme nicht aufrufen');
select pg_temp.pruefe(has_function_privilege('authenticated', 'team_teilnahme(uuid, date, date)', 'execute'),
  'authenticated darf team_teilnahme aufrufen');
select pg_temp.pruefe(not has_function_privilege('authenticated', 'teilnahme_kern(uuid, date, date, uuid)', 'execute')
                  and not has_function_privilege('anon', 'teilnahme_kern(uuid, date, date, uuid)', 'execute'),
  'teilnahme_kern ohne API-Recht');

rollback;
