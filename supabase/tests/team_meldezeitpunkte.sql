-- Meldezeitpunkte der Spieler:innen eines Teams (#703), team_meldezeitpunkte:
-- - Grenzwerte: genau 7 Tage, 3 Tage, 24 Stunden und 6 Stunden zählen ins
--   Fenster, das dort endet; eine Sekunde mehr ins frühere (PO 2026-11-28)
-- - Median bei ungerader und gerader Anzahl (Mittel der beiden mittleren)
-- - Training: nur Abmeldungen, Zeit aus termin_statuswechsel, auch nach dem
--   Festhalten und bei «doch erschienen»; eine Anmeldung zählt nie; der
--   Grundstand Schnuppernder (ohne Zeile) und ein verlegtes Training (Zeile
--   gelöscht) haben keine Angabe
-- - Spiel: An- und Abmeldungen getrennt, aus spiel_meldungen (offen) und
--   spiel_teilnahmen (festgehalten), auch nicht aufgeboten oder nicht
--   erschienen; nur die Uhrzeit verlegt: gemessen gegen den neuen Anpfiff,
--   ab Beginn fällt die Meldung weg; auf einen anderen Tag verlegt: keine
--   Angabe; Schnuppernden gilt kein Spiel
-- - nur streng vor Beginn (Vorverlegung), nur begonnene, nicht ausgefallene
--   Termine im Zeitraum (AK 6); Ehemalige erscheinen nicht (AK 9)
-- - Summe der Fenster = Anzahl
-- - Nicht-Mitglied und Vereinsverwaltung ohne Mitgliedschaft → 42501 (NFR 2),
--   anon ohne Recht
-- Alles in einer Transaktion mit rollback; hinterlässt nichts.

\set ON_ERROR_STOP on
\o /dev/null

begin;
set local statement_timeout = '60s';
-- Abstände in ganzen Sekunden, ohne Sommerzeit-Sprung in der Sitzungszeit.
set local timezone = 'UTC';

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
  if p_ok is not true then raise exception '#703: %', p_text; end if;
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
insert into ids (name) values ('v'), ('a'), ('b'), ('va'), ('t1'), ('t2'),
  ('lena'), ('elin'), ('mia'), ('noah'), ('ex'),
  ('tr1'), ('tr2'), ('tr3'), ('tr4'), ('tr5'), ('tr6'), ('tr7'), ('tr8'), ('tr9'),
  ('sp1'), ('sp2'), ('sp3'), ('sp4');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

-- Der Beginn eines Termins (Ortszeit) minus einem Abstand.
create function pg_temp.vor(p_termin text, p_abstand interval) returns timestamptz
language sql stable as $$
  select ((t.datum + t.beginn) at time zone 'Europe/Zurich') - p_abstand
    from training_termine t where t.id = pg_temp.id(p_termin)
$$;

-- Die Zeilen einer Spieler:in als «meldeart:anzahl:median:{fenster}|…».
create function pg_temp.melde(p_spieler uuid, p_von date, p_bis date) returns text
language sql as $$
  select coalesce(string_agg(m.meldeart || ':' || m.anzahl || ':' || m.median_sekunden || ':' || m.fenster::text,
                             '|' order by m.meldeart), '')
    from team_meldezeitpunkte(pg_temp.id('t1'), p_von, p_bis) m
   where m.spieler_id = p_spieler
$$;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@team-melde.test', now() from ids where name in ('a', 'b', 'va');

-- a ist Mitglied von T1, b nur von T2, va verwaltet den Verein ohne Team.
-- Lena, Mia und Noah gehören T1, Elin schnuppert dort; «ex» stand früher
-- auf der Liste. Alles unter `replica`: Der Test setzt jeden Stand selbst.
set local session_replication_role = replica;
insert into vereine (id, name) values (pg_temp.id('v'), 'Melde-Verein');
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
  (pg_temp.id('t1'), pg_temp.id('elin'), pg_temp.id('v'), now() - interval '60 days'),
  (pg_temp.id('t1'), pg_temp.id('mia'), pg_temp.id('v'), null),
  (pg_temp.id('t1'), pg_temp.id('noah'), pg_temp.id('v'), null);

-- Alle Termine um 10 Uhr; sp3 wurde am selben Tag auf 8 Uhr vorverlegt.
insert into training_termine (id, team_id, datum, beginn, ende, art, ausgefallen, meldefrist_vorlauf_min, bezeichnung) values
  (pg_temp.id('tr1'), pg_temp.id('t1'), current_date - 30, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr2'), pg_temp.id('t1'), current_date - 28, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr3'), pg_temp.id('t1'), current_date - 26, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr4'), pg_temp.id('t1'), current_date - 24, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr5'), pg_temp.id('t1'), current_date - 22, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr6'), pg_temp.id('t1'), current_date - 20, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr7'), pg_temp.id('t1'), current_date - 18, '10:00', '11:00', 'training', true, null, null),
  (pg_temp.id('tr8'), pg_temp.id('t1'), current_date + 3, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('tr9'), pg_temp.id('t1'), current_date - 16, '10:00', '11:00', 'training', false, null, null),
  (pg_temp.id('sp1'), pg_temp.id('t1'), current_date - 30, '14:00', '16:00', 'spiel', false, null, 'Match'),
  (pg_temp.id('sp2'), pg_temp.id('t1'), current_date - 28, '14:00', '16:00', 'spiel', false, 1440, 'Match'),
  (pg_temp.id('sp3'), pg_temp.id('t1'), current_date - 26, '08:00', '10:00', 'spiel', false, null, 'Match'),
  (pg_temp.id('sp4'), pg_temp.id('t1'), current_date - 24, '14:00', '16:00', 'spiel', false, null, 'Match');

-- Trainings, offen: Lena und Mia abgemeldet, je auf und knapp über den
-- Grenzen (tr1: 7 Tage, tr2: 3 Tage, tr3: 24 Stunden, tr4: 6 Stunden);
-- Noah hat sich in tr1 wieder angemeldet (zählt nie). Elin schnuppert ohne
-- Anmeldung (Grundstand abgemeldet, ohne Zeitpunkt). Die Ehemalige hat
-- sich auch abgemeldet.
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet, verfallen_am, vorher_datum, vorher_beginn)
select pg_temp.id(t), pg_temp.id(s), pg_temp.id('t1'), false, null, null, null
  from (values ('tr1','lena'), ('tr1','mia'), ('tr1','ex'), ('tr2','lena'), ('tr2','mia'), ('tr3','lena'), ('tr3','mia'),
               ('tr4','lena'), ('tr4','mia'), ('tr6','lena'), ('tr6','mia'), ('tr7','lena'), ('tr8','lena'), ('tr9','lena')) x(t, s);
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet, verfallen_am, vorher_datum, vorher_beginn) values
  (pg_temp.id('tr1'), pg_temp.id('noah'), pg_temp.id('t1'), true, null, null, null);
insert into termin_statuswechsel (termin_id, spieler_id, team_id, gewechselt_am) values
  (pg_temp.id('tr1'), pg_temp.id('lena'), pg_temp.id('t1'), pg_temp.vor('tr1', interval '7 days')),
  (pg_temp.id('tr1'), pg_temp.id('mia'),  pg_temp.id('t1'), pg_temp.vor('tr1', interval '7 days 1 second')),
  (pg_temp.id('tr1'), pg_temp.id('ex'),   pg_temp.id('t1'), pg_temp.vor('tr1', interval '2 days')),
  (pg_temp.id('tr1'), pg_temp.id('noah'), pg_temp.id('t1'), pg_temp.vor('tr1', interval '2 days')),
  (pg_temp.id('tr2'), pg_temp.id('lena'), pg_temp.id('t1'), pg_temp.vor('tr2', interval '3 days')),
  (pg_temp.id('tr2'), pg_temp.id('mia'),  pg_temp.id('t1'), pg_temp.vor('tr2', interval '3 days 1 second')),
  (pg_temp.id('tr3'), pg_temp.id('lena'), pg_temp.id('t1'), pg_temp.vor('tr3', interval '24 hours')),
  (pg_temp.id('tr3'), pg_temp.id('mia'),  pg_temp.id('t1'), pg_temp.vor('tr3', interval '24 hours 1 second')),
  (pg_temp.id('tr4'), pg_temp.id('lena'), pg_temp.id('t1'), pg_temp.vor('tr4', interval '6 hours')),
  (pg_temp.id('tr4'), pg_temp.id('mia'),  pg_temp.id('t1'), pg_temp.vor('tr4', interval '6 hours 1 second')),
  -- tr6 wurde vorverlegt: Lena wechselte erst nach, Mia genau zum neuen Beginn.
  (pg_temp.id('tr6'), pg_temp.id('lena'), pg_temp.id('t1'), pg_temp.vor('tr6', interval '-1 hour')),
  (pg_temp.id('tr6'), pg_temp.id('mia'),  pg_temp.id('t1'), pg_temp.vor('tr6', interval '0')),
  -- tr7 ist ausgefallen, tr8 kommt erst.
  (pg_temp.id('tr7'), pg_temp.id('lena'), pg_temp.id('t1'), pg_temp.vor('tr7', interval '2 days')),
  (pg_temp.id('tr8'), pg_temp.id('lena'), pg_temp.id('t1'), now() - interval '1 hour'),
  -- tr5 (festgehalten, unten): Lena 10 Stunden vorher abgemeldet und doch
  -- erschienen; Mia hat sich wieder angemeldet.
  (pg_temp.id('tr5'), pg_temp.id('lena'), pg_temp.id('t1'), pg_temp.vor('tr5', interval '10 hours')),
  (pg_temp.id('tr5'), pg_temp.id('mia'),  pg_temp.id('t1'), pg_temp.vor('tr5', interval '1 day'));
-- tr9 wurde auf einen anderen Tag verlegt: Lenas Zeitpunkt ist weg.

-- Festgehalten: tr5 und sp2.
insert into termin_eingefroren (termin_id, team_id) values (pg_temp.id('tr5'), pg_temp.id('t1')), (pg_temp.id('sp2'), pg_temp.id('t1'));
insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet, nachgetragen) values
  (pg_temp.id('tr5'), pg_temp.id('t1'), pg_temp.id('lena'), true, true),   -- abgemeldet, doch erschienen
  (pg_temp.id('tr5'), pg_temp.id('t1'), pg_temp.id('mia'), false, false),  -- da
  (pg_temp.id('tr5'), pg_temp.id('t1'), pg_temp.id('noah'), false, false); -- da

-- Spiele. sp1 offen: Lena 2 Tage vorher angemeldet, Mia 12 Stunden vorher
-- abgemeldet, Noah 5 Tage vorher angemeldet und nicht aufgeboten; Elin
-- schnuppert (ihr gilt kein Spiel).
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am, nicht_aufgeboten) values
  (pg_temp.id('sp1'), pg_temp.id('lena'), pg_temp.id('t1'), 'angemeldet', pg_temp.vor('sp1', interval '2 days'), false),
  (pg_temp.id('sp1'), pg_temp.id('mia'),  pg_temp.id('t1'), 'abgemeldet', pg_temp.vor('sp1', interval '12 hours'), false),
  (pg_temp.id('sp1'), pg_temp.id('noah'), pg_temp.id('t1'), 'angemeldet', pg_temp.vor('sp1', interval '5 days'), true),
  (pg_temp.id('sp1'), pg_temp.id('elin'), pg_temp.id('t1'), 'angemeldet', pg_temp.vor('sp1', interval '2 days'), false),
  -- sp3 nur in der Uhrzeit vorverlegt (10 → 8 Uhr): Lenas Anmeldung um 9 Uhr
  -- liegt jetzt nach Beginn, Mias um 7 Uhr eine Stunde davor.
  (pg_temp.id('sp3'), pg_temp.id('lena'), pg_temp.id('t1'), 'angemeldet', pg_temp.vor('sp3', interval '-1 hour'), false),
  (pg_temp.id('sp3'), pg_temp.id('mia'),  pg_temp.id('t1'), 'angemeldet', pg_temp.vor('sp3', interval '1 hour'), false);
-- sp4 auf einen anderen Tag verlegt: Meldung und Zeitpunkt sind weg, die
-- Meldung ist verfallen.
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am, verfallen, nicht_aufgeboten) values
  (pg_temp.id('sp4'), pg_temp.id('lena'), pg_temp.id('t1'), null, null, true, false);
-- sp2 festgehalten: Lena 4 Tage vorher angemeldet und nicht erschienen, Mia
-- eine Stunde vorher abgemeldet und nicht aufgeboten, Noah ohne Meldung.
insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, gewechselt_am, nicht_aufgeboten, nachgetragen) values
  (pg_temp.id('sp2'), pg_temp.id('t1'), pg_temp.id('lena'), 'angemeldet', pg_temp.vor('sp2', interval '4 days'), false, true),
  (pg_temp.id('sp2'), pg_temp.id('t1'), pg_temp.id('mia'),  'abgemeldet', pg_temp.vor('sp2', interval '1 hour'), true, false),
  (pg_temp.id('sp2'), pg_temp.id('t1'), pg_temp.id('noah'), null, null, false, false);
set local session_replication_role = origin;

-- Als Mitglied von T1.
select pg_temp.als(pg_temp.id('a'));

-- Lena: Trainings 7 d, 3 d, 24 h, 6 h (je genau auf der Grenze) und 10 h
-- (festgehalten, doch erschienen) → Median 24 h; Spiele angemeldet 2 d
-- (offen) und 4 d (festgehalten, nicht erschienen) → Median 3 d.
select pg_temp.pruefe(pg_temp.melde(pg_temp.id('lena'), null, null) =
  'spiel_anmeldung:2:259200:{0,1,1,0,0}|training_abmeldung:5:86400:{0,1,1,2,1}',
  'Lena: ' || pg_temp.melde(pg_temp.id('lena'), null, null));
-- Mia: Trainings je eine Sekunde über der Grenze → ins frühere Fenster;
-- gerade Anzahl → Mittel der beiden mittleren. Spiele: abgemeldet 12 h
-- (offen) und 1 h (festgehalten, nicht aufgeboten); angemeldet 1 h vor dem
-- vorverlegten Anpfiff.
select pg_temp.pruefe(pg_temp.melde(pg_temp.id('mia'), null, null) =
  'spiel_abmeldung:2:23400:{0,0,0,1,1}|spiel_anmeldung:1:3600:{0,0,0,0,1}|training_abmeldung:4:172801:{1,1,1,1,0}',
  'Mia: ' || pg_temp.melde(pg_temp.id('mia'), null, null));
-- Noah: nur die Anmeldung zum Spiel, bei dem er nicht aufgeboten wurde; die
-- Trainings-Anmeldung zählt nicht, ohne Meldung keine Angabe.
select pg_temp.pruefe(pg_temp.melde(pg_temp.id('noah'), null, null) = 'spiel_anmeldung:1:432000:{0,1,0,0,0}',
  'Noah: ' || pg_temp.melde(pg_temp.id('noah'), null, null));
-- Elin: Grundstand ohne Zeitpunkt, Spiele gelten ihr nicht → keine Angabe.
select pg_temp.pruefe(pg_temp.melde(pg_temp.id('elin'), null, null) = '',
  'Elin (Schnuppern): ' || pg_temp.melde(pg_temp.id('elin'), null, null));
-- Zeitraum: nur tr4 und tr5 (6 h und 10 h) → Median 8 h.
select pg_temp.pruefe(pg_temp.melde(pg_temp.id('lena'), current_date - 24, current_date - 22) =
  'training_abmeldung:2:28800:{0,0,0,1,1}',
  'Lena im Zeitraum: ' || pg_temp.melde(pg_temp.id('lena'), current_date - 24, current_date - 22));
-- Nur von: ab tr6 zählt keine Meldung mehr (vorverlegt, ausgefallen, kommend, verlegt).
select pg_temp.pruefe(pg_temp.melde(pg_temp.id('lena'), current_date - 21, null) = '',
  'Lena ab tr6: ' || pg_temp.melde(pg_temp.id('lena'), current_date - 21, null));

-- Ehemalige erscheinen nicht; die Fenster summieren sich zur Anzahl;
-- höchstens eine Zeile je Spieler:in und Meldeart.
select pg_temp.pruefe(not exists (select 1 from team_meldezeitpunkte(pg_temp.id('t1')) where spieler_id = pg_temp.id('ex')),
  'Ehemalige erscheinen nicht');
select pg_temp.pruefe(not exists (
  select 1 from team_meldezeitpunkte(pg_temp.id('t1')) m
   where (select sum(f) from unnest(m.fenster) f) <> m.anzahl or array_length(m.fenster, 1) <> 5),
  'Fenster summieren sich zur Anzahl');
select pg_temp.pruefe((select count(*) = count(distinct (spieler_id, meldeart)) from team_meldezeitpunkte(pg_temp.id('t1'))),
  'eine Zeile je Spieler:in und Meldeart');
select pg_temp.zurueck();

-- Ein Mitglied eines anderen Teams und die Verwaltung ohne Mitgliedschaft: 42501.
select pg_temp.als(pg_temp.id('b'));
select pg_temp.pruefe(pg_temp.fehler(format('select * from team_meldezeitpunkte(%L)', pg_temp.id('t1'))) = '42501',
  'fremdes Team: 42501');
select pg_temp.zurueck();
select pg_temp.als(pg_temp.id('va'));
select pg_temp.pruefe(pg_temp.fehler(format('select * from team_meldezeitpunkte(%L)', pg_temp.id('t1'))) = '42501',
  'Verwaltung ohne Mitgliedschaft: 42501');
select pg_temp.zurueck();

-- Rechte: nur authenticated.
select pg_temp.pruefe(not has_function_privilege('anon', 'team_meldezeitpunkte(uuid, date, date)', 'execute'),
  'anon darf team_meldezeitpunkte nicht aufrufen');
select pg_temp.pruefe(has_function_privilege('authenticated', 'team_meldezeitpunkte(uuid, date, date)', 'execute'),
  'authenticated darf team_meldezeitpunkte aufrufen');

rollback;
