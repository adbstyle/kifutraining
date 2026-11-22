-- Spieler:innen des Vereins überblicken (Story 4 #580; Architekturplan
-- Vereine §4.3 «verein_spielerliste», §6.7 Testfälle 4 Teil Vereinsliste
-- und 32). Was psql braucht (Altdubletten und 1001 Zeilen unter `replica`,
-- Rollenwechsel wie PostgREST):
-- - Form je Rolle mit exakten Schlüsselmengen: ein Mitglied ohne Verwaltung
--   bekommt je Spieler:in nur id, Vorname, Nachname, Jahrgang und Teams,
--   auch für die Spieler:innen der eigenen Teams (kein J+S, kein Link-Stand,
--   kein Schnupper-Zähler) und am Kopf die Teams ohne `anzahl`; die
--   Verwaltung (auch mit beiden Rollen) bekommt alles wie bisher; am Kopf
--   `verwaltung` (die eigene Rolle), auch bei 0 Treffern und im leeren Verein
-- - Verträglichkeit: ein Aufruf nur mit `p_verein` liefert der Verwaltung
--   dieselben `spieler` und `teams` wie die Fassung aus Story 8
-- - Zugang (AK 2, PC 1, PC 3): Mitglied und Verwaltung ja; Konto ohne
--   Verein, Mitglied oder Verwaltung eines anderen Vereins, unbekannt, null,
--   nach dem Austritt aus dem letzten Team bzw. der Verwaltung:
--   VEREIN_NICHT_GEFUNDEN; KI-Zugang: NUR_IN_DER_ANWENDUNG
-- - Vollständigkeit und Reihenfolge (AK 1, 4, PC 2): Schnuppernde, ohne
--   Team, Altdubletten als zwei Zeilen; nach Vorname, dann Nachname
-- - Suche (AK 6, OoS 4): Teile von Vor- und Nachname und beides zusammen,
--   Gross/Klein, Akzente in beide Richtungen, Zerlegungsform, keine
--   Umschreibung «ue»; `%`, `_` und `\` sind gewöhnliche Zeichen; Leerzeichen
--   am Rand und innere Folgen zählen nicht; sehr lange Eingabe; eine
--   vergebene J+S-Nummer findet nichts (kein Orakel für andere Felder)
-- - Eingrenzung (AK 7–9): Teams und «ohne Team» als ODER, Jahrgänge, alles
--   zusammen als UND; fremde und unbekannte Team-IDs treffen still nie;
--   leere Listen und Listen aus lauter null grenzen nicht ein, null neben
--   Werten fällt weg; jede Zeile nennt alle Teams
-- - Teams, Jahrgänge und Zahlen am Kopf bleiben bei gesetztem Filter
--   ungefiltert
-- - Testfall 32: 1001 Spieler:innen in einem Aufruf, gefilterte Teilmengen
--   stimmen mit der direkten Zählung — für ein Mitglied und die Verwaltung
-- - Rechte: neue Signatur für `authenticated`, nicht `anon`; die alte ist weg,
--   und es gibt genau eine Funktion dieses Namens (keine Überladung)
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
  if p_ok is not true then raise exception 'Story 4: %', p_text; end if;
end $$;

create function pg_temp.schluessel(p jsonb) returns text[]
language sql immutable as $$ select array(select k from jsonb_object_keys(p) k order by k) $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('verw'), ('verw2'), ('a'), ('b'), ('c'), ('wverw'), ('ohne'), ('m3'),
  ('v3verw'), ('v4verw'), ('v'), ('w'), ('v3'), ('v4'), ('t1'), ('t2'), ('tw'), ('t3'),
  ('s1'), ('s2'), ('s3'), ('x'), ('u1'), ('u2'), ('u3'), ('sw');
-- Feste IDs für die Altdubletten: Bei gleichem Namen und Jahrgang entscheidet
-- die id über die Reihenfolge.
insert into ids (name, id) values ('d1', '00000000-0000-4000-8000-000000000581'),
                                  ('d2', '00000000-0000-4000-8000-000000000582');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

-- Die Treffer einer Liste als Namen der ids-Tabelle, in der Reihenfolge der Liste.
create function pg_temp.treffer(p jsonb) returns text
language sql stable as $$
  select coalesce(string_agg(coalesce(i.name, '?'), ',' order by e.n), '')
    from jsonb_array_elements(p -> 'spieler') with ordinality e(s, n)
    left join ids i on i.id = (e.s ->> 'id')::uuid
$$;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@vereinsliste.test', now() from ids
 where name in ('verw', 'verw2', 'a', 'b', 'c', 'wverw', 'ohne', 'm3', 'v3verw', 'v4verw');

-- Verein V: Verwaltung verw (ohne Team) und verw2 (auch Mitglied in T1),
-- Mitglieder a (T1) und b (T2). Verein W: Verwaltung wverw, c in TW.
-- Verein V3 (Testfall 32): m3 in T3, Verwaltung v3verw. Verein V4: leer, nur
-- die Verwaltung v4verw (kein Team, keine Spieler:in).
insert into vereine (id, name) values (pg_temp.id('v'), 'Listen-Verein'), (pg_temp.id('w'), 'Anderer Verein'),
  (pg_temp.id('v3'), 'Grosser Verein'), (pg_temp.id('v4'), 'Leerer Verein');
insert into verein_verwaltung (verein_id, user_id) values
  (pg_temp.id('v'), pg_temp.id('verw')), (pg_temp.id('v'), pg_temp.id('verw2')), (pg_temp.id('w'), pg_temp.id('wverw')),
  (pg_temp.id('v3'), pg_temp.id('v3verw')), (pg_temp.id('v4'), pg_temp.id('v4verw'));
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Team Eins', pg_temp.id('v')), (pg_temp.id('t2'), 'Team Zwei', pg_temp.id('v')),
  (pg_temp.id('tw'), 'Team W', pg_temp.id('w')), (pg_temp.id('t3'), 'Team Drei', pg_temp.id('v3'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t1'), pg_temp.id('verw2')), (pg_temp.id('t2'), pg_temp.id('b')),
  (pg_temp.id('tw'), pg_temp.id('c')), (pg_temp.id('t3'), pg_temp.id('m3'));
insert into team_probetraining (team_id, anzahl, info) values (pg_temp.id('t2'), 3, null);

-- Spieler:innen unter replica samt team_id wie die Trigger:
--   s1 Lena Müller 2015, T1, mit J+S und bezogenem Link
--   s2 Léa Muller 2014, T1 und T2
--   s3 Ben Zwei 2014, schnuppert in T2
--   x  Xaver Ohne 2016, ohne Team
--   d1/d2 Lea Dublette 2017, Altdublette in T1 bzw. T2
--   u1 Mia Unter_Strich 2016 ohne Team, u2 Noa Pro%Zent 2018 T1,
--   u3 Kim Back\Slash 2018 T2
--   sw Lena Müller 2015 im Verein W (TW)
set local session_replication_role = replica;
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang, js_nummer, link_bezogen) values
  (pg_temp.id('s1'), pg_temp.id('t1'), pg_temp.id('v'), 'Lena', 'Müller', 2015, '1234567', true),
  (pg_temp.id('s2'), pg_temp.id('t1'), pg_temp.id('v'), 'Léa', 'Muller', 2014, null, false),
  (pg_temp.id('s3'), pg_temp.id('t2'), pg_temp.id('v'), 'Ben', 'Zwei', 2014, null, false),
  (pg_temp.id('x'), null, pg_temp.id('v'), 'Xaver', 'Ohne', 2016, '7654321', false),
  (pg_temp.id('d1'), pg_temp.id('t1'), pg_temp.id('v'), 'Lea', 'Dublette', 2017, null, false),
  (pg_temp.id('d2'), pg_temp.id('t2'), pg_temp.id('v'), 'Lea', 'Dublette', 2017, null, false),
  (pg_temp.id('u1'), null, pg_temp.id('v'), 'Mia', 'Unter_Strich', 2016, null, false),
  (pg_temp.id('u2'), pg_temp.id('t1'), pg_temp.id('v'), 'Noa', 'Pro%Zent', 2018, null, false),
  (pg_temp.id('u3'), pg_temp.id('t2'), pg_temp.id('v'), 'Kim', 'Back\Slash', 2018, null, false),
  (pg_temp.id('sw'), pg_temp.id('tw'), pg_temp.id('w'), 'Lena', 'Müller', 2015, null, false);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values
  (pg_temp.id('t1'), pg_temp.id('s1'), pg_temp.id('v'), null),
  (pg_temp.id('t1'), pg_temp.id('s2'), pg_temp.id('v'), null),
  (pg_temp.id('t2'), pg_temp.id('s2'), pg_temp.id('v'), null),
  (pg_temp.id('t2'), pg_temp.id('s3'), pg_temp.id('v'), now() - interval '3 days'),
  (pg_temp.id('t1'), pg_temp.id('d1'), pg_temp.id('v'), null),
  (pg_temp.id('t2'), pg_temp.id('d2'), pg_temp.id('v'), null),
  (pg_temp.id('t1'), pg_temp.id('u2'), pg_temp.id('v'), null),
  (pg_temp.id('t2'), pg_temp.id('u3'), pg_temp.id('v'), null),
  (pg_temp.id('tw'), pg_temp.id('sw'), pg_temp.id('w'), null);
update spieler set probe_seit = now() - interval '3 days' where id = pg_temp.id('s3');
set local session_replication_role = origin;

-- Die Liste der Verwaltung, wie sie die Fassung aus Story 8
-- (20261114230000_schnuppertraining.sql) lieferte, ohne Rechteprüfung; für
-- den Vergleich als Eigentümer aufgerufen.
create function pg_temp.alte_liste(p_verein uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'spieler', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', s.id, 'vorname', s.vorname, 'nachname', s.nachname, 'jahrgang', s.jahrgang,
                  'js', s.js_nummer, 'link_bezogen', s.link_bezogen, 'link_zugestellt', s.link_zugestellt is true,
                  'teams', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)
                                                      order by t.name, t.id), '[]'::jsonb)
                              from public.team_spieler ts join public.teams t on t.id = ts.team_id
                             where ts.spieler_id = s.id),
                  'schnuppern', (select jsonb_build_object('team_id', ts.team_id) || public.team_probe_zaehler(ts.team_id, s.id)
                                   from public.team_spieler ts
                                  where ts.spieler_id = s.id and ts.probe_seit is not null
                                  order by ts.created_at, ts.team_id limit 1))
                  order by s.vorname, s.nachname, s.jahrgang, s.id), '[]'::jsonb)
                  from public.spieler s where s.verein_id = p_verein),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', t.id, 'name', t.name,
                'anzahl', (select count(*) from public.team_spieler ts where ts.team_id = t.id))
                order by t.name, t.id), '[]'::jsonb)
                from public.teams t where t.verein_id = p_verein))
$$;

-- ── Rechte ──────────────────────────────────────────────────────────────────

do $$
declare
  f text := 'verein_spielerliste(uuid,text,uuid[],boolean,integer[])';
begin
  perform pg_temp.pruefe(to_regprocedure('verein_spielerliste(uuid)') is null, 'alte Signatur besteht noch');
  perform pg_temp.pruefe(to_regprocedure(f) is not null, 'neue Signatur fehlt');
  perform pg_temp.pruefe((select count(*) from pg_proc where proname = 'verein_spielerliste') = 1,
                         'mehr als eine Funktion verein_spielerliste (Überladung)');
  perform pg_temp.pruefe(not has_function_privilege('anon', f, 'execute')
                         and not has_function_privilege('public', f, 'execute')
                         and has_function_privilege('authenticated', f, 'execute'), 'Grant von ' || f);
end $$;

-- ── Zugang (AK 2, PC 1) ─────────────────────────────────────────────────────

do $$
declare
  wer text;
begin
  -- Konto ohne Verein, Mitglied und Verwaltung eines anderen Vereins.
  foreach wer in array array['ohne', 'c', 'wverw'] loop
    perform pg_temp.als(pg_temp.id(wer));
    perform pg_temp.erwarte(format('select verein_spielerliste(%L)', pg_temp.id('v')), 'VEREIN_NICHT_GEFUNDEN');
    perform pg_temp.erwarte(format('select verein_spielerliste(%L, %L, array[%L]::uuid[], true, array[2015])',
                                   pg_temp.id('v'), 'lena', pg_temp.id('t1')), 'VEREIN_NICHT_GEFUNDEN');
    reset role;
  end loop;
  -- Mitglied und Verwaltung von V: fremder Verein, unbekannt, null.
  foreach wer in array array['a', 'verw'] loop
    perform pg_temp.als(pg_temp.id(wer));
    perform pg_temp.erwarte(format('select verein_spielerliste(%L)', pg_temp.id('w')), 'VEREIN_NICHT_GEFUNDEN');
    perform pg_temp.erwarte(format('select verein_spielerliste(%L)', gen_random_uuid()), 'VEREIN_NICHT_GEFUNDEN');
    perform pg_temp.erwarte('select verein_spielerliste(null)', 'VEREIN_NICHT_GEFUNDEN');
    reset role;
  end loop;
  -- KI-Zugang, mit einem und mit allen Argumenten.
  foreach wer in array array['a', 'verw'] loop
    perform pg_temp.als(pg_temp.id(wer), '{"client_id": "ki-client"}');
    perform pg_temp.erwarte(format('select verein_spielerliste(%L)', pg_temp.id('v')), 'NUR_IN_DER_ANWENDUNG');
    perform pg_temp.erwarte(format('select verein_spielerliste(%L, %L, array[%L]::uuid[], true, array[2015])',
                                   pg_temp.id('v'), 'lena', pg_temp.id('t1')), 'NUR_IN_DER_ANWENDUNG');
    reset role;
  end loop;
end $$;

-- ── Form je Rolle (AK 3) und Verträglichkeit ────────────────────────────────

do $$
declare
  wer text;
  l jsonb;
  s jsonb;
  t jsonb;
  kopf constant text[] := array['gesamt', 'jahrgaenge', 'ohne_team', 'spieler', 'teams', 'verwaltung'];
begin
  -- Mitglieder ohne Verwaltung: a (T1) und b (T2). Auch die Spieler:innen der
  -- eigenen Teams nur mit den vier Angaben.
  foreach wer in array array['a', 'b'] loop
    perform pg_temp.als(pg_temp.id(wer));
    l := verein_spielerliste(pg_temp.id('v'));
    perform pg_temp.pruefe(pg_temp.schluessel(l) = kopf, wer || ': Kopf ' || pg_temp.schluessel(l)::text);
    perform pg_temp.pruefe(l -> 'verwaltung' = 'false', wer || ': Rolle ' || (l -> 'verwaltung')::text);
    -- Auch ohne Treffer sagt die Antwort die Rolle (die Form hängt nicht an Zeilen).
    perform pg_temp.pruefe(verein_spielerliste(pg_temp.id('v'), 'fremd') -> 'verwaltung' = 'false', wer || ': Rolle ohne Treffer');
    perform pg_temp.pruefe(jsonb_array_length(l -> 'spieler') = 9, wer || ': nicht alle Spieler:innen ' || l::text);
    for s in select * from jsonb_array_elements(l -> 'spieler') loop
      perform pg_temp.pruefe(pg_temp.schluessel(s) = array['id', 'jahrgang', 'nachname', 'teams', 'vorname'],
                             wer || ': Schlüssel der Zeile ' || s::text);
      for t in select * from jsonb_array_elements(s -> 'teams') loop
        perform pg_temp.pruefe(pg_temp.schluessel(t) = array['id', 'name'], wer || ': Team der Zeile ' || t::text);
      end loop;
    end loop;
    for t in select * from jsonb_array_elements(l -> 'teams') loop
      perform pg_temp.pruefe(pg_temp.schluessel(t) = array['id', 'name'], wer || ': Team am Kopf ' || t::text);
    end loop;
    -- J+S (eigenes Team von a: s1; ohne Team: x) und Link-Token nirgends.
    perform pg_temp.pruefe(position('1234567' in l::text) = 0 and position('7654321' in l::text) = 0,
                           wer || ': J+S in der Liste');
    reset role;
    perform pg_temp.pruefe(position((select link_token from spieler where id = pg_temp.id('s1')) in l::text) = 0,
                           wer || ': Link-Token in der Liste');
  end loop;

  -- Verwaltung ohne Team (verw) und mit beiden Rollen (verw2): alles wie
  -- bisher, und ein Aufruf nur mit p_verein liefert dieselben spieler und
  -- teams wie die Fassung aus Story 8.
  foreach wer in array array['verw', 'verw2'] loop
    perform pg_temp.als(pg_temp.id(wer));
    l := verein_spielerliste(pg_temp.id('v'));
    perform pg_temp.pruefe(l = verein_spielerliste(pg_temp.id('v'), null, null, false, null)
                           and l = verein_spielerliste(pg_temp.id('v'), '', '{}', null, '{}'),
                           wer || ': Defaults und leere Eingaben weichen ab');
    perform pg_temp.pruefe(l = verein_spielerliste(pg_temp.id('v'), null, array[null]::uuid[], false, array[null]::integer[]),
                           wer || ': Listen aus lauter null grenzen ein');
    perform pg_temp.pruefe(verein_spielerliste(pg_temp.id('v'), 'fremd') -> 'verwaltung' = 'true', wer || ': Rolle ohne Treffer');
    reset role;
    perform pg_temp.pruefe(pg_temp.schluessel(l) = kopf, wer || ': Kopf ' || pg_temp.schluessel(l)::text);
    perform pg_temp.pruefe(l -> 'verwaltung' = 'true', wer || ': Rolle ' || (l -> 'verwaltung')::text);
    perform pg_temp.pruefe(l - array['gesamt', 'jahrgaenge', 'ohne_team', 'verwaltung'] = pg_temp.alte_liste(pg_temp.id('v')),
                           wer || ': weicht von der bisherigen Liste ab: ' || l::text);
    for s in select * from jsonb_array_elements(l -> 'spieler') loop
      perform pg_temp.pruefe(pg_temp.schluessel(s) = array['id', 'jahrgang', 'js', 'link_bezogen', 'link_zugestellt', 'nachname', 'schnuppern', 'teams', 'vorname'],
                             wer || ': Schlüssel der Zeile ' || s::text);
    end loop;
    for t in select * from jsonb_array_elements(l -> 'teams') loop
      perform pg_temp.pruefe(pg_temp.schluessel(t) = array['anzahl', 'id', 'name'], wer || ': Team am Kopf ' || t::text);
    end loop;
    select e into s from jsonb_array_elements(l -> 'spieler') e where e ->> 'id' = pg_temp.id('s1')::text;
    perform pg_temp.pruefe(s ->> 'js' = '1234567' and (s ->> 'link_bezogen')::boolean and s -> 'schnuppern' = 'null',
                           wer || ': s1 ' || s::text);
    select e into s from jsonb_array_elements(l -> 'spieler') e where e ->> 'id' = pg_temp.id('s3')::text;
    perform pg_temp.pruefe(s -> 'schnuppern' = jsonb_build_object('team_id', pg_temp.id('t2'), 'anzahl', 3, 'besucht', 0),
                           wer || ': s3 ' || s::text);
    perform pg_temp.pruefe(l -> 'teams' = jsonb_build_array(
                             jsonb_build_object('id', pg_temp.id('t1'), 'name', 'Team Eins', 'anzahl', 4),
                             jsonb_build_object('id', pg_temp.id('t2'), 'name', 'Team Zwei', 'anzahl', 4)),
                           wer || ': Teams am Kopf ' || (l -> 'teams')::text);
  end loop;
end $$;

-- Der leere Verein: keine Zeile, kein Team — die Rolle steht trotzdem da.
do $$
declare
  l jsonb;
begin
  perform pg_temp.als(pg_temp.id('v4verw'));
  l := verein_spielerliste(pg_temp.id('v4'));
  reset role;
  perform pg_temp.pruefe(l = '{"spieler": [], "teams": [], "jahrgaenge": [], "gesamt": 0, "ohne_team": 0, "verwaltung": true}',
                         'leerer Verein: ' || l::text);
end $$;

-- ── Vollständigkeit, Reihenfolge, Kopf (AK 1, 4, 11, PC 1, PC 2) ────────────

do $$
declare
  wer text;
  l jsonb;
begin
  foreach wer in array array['a', 'verw'] loop
    perform pg_temp.als(pg_temp.id(wer));
    l := verein_spielerliste(pg_temp.id('v'));
    -- Nach Vorname, dann Nachname (Lea vor Léa); Altdublette als zwei Zeilen;
    -- Schnuppernde und ohne Team dabei; sw (Verein W) nicht.
    perform pg_temp.pruefe(pg_temp.treffer(l) = 's3,u3,d1,d2,s2,s1,u1,u2,x', wer || ': Reihenfolge ' || pg_temp.treffer(l));
    perform pg_temp.pruefe((select e -> 'teams' from jsonb_array_elements(l -> 'spieler') e where e ->> 'id' = pg_temp.id('x')::text) = '[]',
                           wer || ': ohne Team');
    perform pg_temp.pruefe((select e -> 'teams' from jsonb_array_elements(l -> 'spieler') e where e ->> 'id' = pg_temp.id('s2')::text)
                           = jsonb_build_array(jsonb_build_object('id', pg_temp.id('t1'), 'name', 'Team Eins'),
                                               jsonb_build_object('id', pg_temp.id('t2'), 'name', 'Team Zwei')),
                           wer || ': Teams von s2');
    perform pg_temp.pruefe(l -> 'jahrgaenge' = '[2014, 2015, 2016, 2017, 2018]' and l -> 'gesamt' = '9' and l -> 'ohne_team' = '2',
                           wer || ': Kopf ' || (l - 'spieler' - 'teams')::text);
    reset role;
  end loop;
end $$;

-- ── Suche (AK 6, OoS 4) ─────────────────────────────────────────────────────

do $$
declare
  wer text;
  r record;
  l jsonb;
begin
  foreach wer in array array['a', 'verw'] loop
    perform pg_temp.als(pg_temp.id(wer));
    for r in select * from (values
        ('len', 's1'),                                  -- Teil des Vornamens
        ('üll', 's2,s1'),                               -- Teil des Nachnamens, Akzent findet auch ohne
        ('ull', 's2,s1'),                               -- ohne Akzent findet auch mit
        ('lena mül', 's1'),                             -- beides zusammen
        ('LENA MÜLLER', 's1'),                          -- Gross/Klein
        ('léa', 'd1,d2,s2'),
        ('lea', 'd1,d2,s2'),
        ('Müller', 's2,s1'),
        ('muller', 's2,s1'),
        (E'müller', 's2,s1'),                     -- Zerlegungsform
        ('mueller', ''),                                -- keine Umschreibung
        ('a m', 's2,s1'),                               -- über die Grenze Vorname/Nachname
        ('_', 'u1'),                                    -- gewöhnliches Zeichen, kein Platzhalter
        ('%', 'u2'),
        ('\', 'u3'),
        ('o%z', 'u2'),
        ('e_a', ''),                                    -- als Platzhalter träfe «_» «Lena»
        ('n%z', ''),                                    -- als Platzhalter träfe «%» «Ben Zwei»
        ('  lena   müller  ', 's1'),                    -- Rand und innere Folgen
        (E'lena\tmüller', 's1'),
        (E' lena ', 's1'),
        ('   ', 's3,u3,d1,d2,s2,s1,u1,u2,x'),           -- nur Leerzeichen: keine Suche
        ('', 's3,u3,d1,d2,s2,s1,u1,u2,x'),
        (repeat('lena müller ', 2000), ''),              -- sehr lange Eingabe
        ('fremd', ''),
        ('1234567', ''),                                -- J+S-Nummer von s1: kein Orakel
        ('7654321', '')) v(suche, erwartet) loop
      l := verein_spielerliste(pg_temp.id('v'), r.suche);
      perform pg_temp.pruefe(pg_temp.treffer(l) = r.erwartet,
                             format('%s: Suche «%s» ergibt «%s» statt «%s»', wer, left(r.suche, 30), pg_temp.treffer(l), r.erwartet));
    end loop;
    l := verein_spielerliste(pg_temp.id('v'), null);
    perform pg_temp.pruefe(pg_temp.treffer(l) = 's3,u3,d1,d2,s2,s1,u1,u2,x', wer || ': Suche null');
    reset role;
  end loop;
end $$;

-- ── Eingrenzung (AK 7–9) ────────────────────────────────────────────────────

do $$
declare
  wer text;
  r record;
  l jsonb;
  s jsonb;
  t1 uuid := pg_temp.id('t1');
  t2 uuid := pg_temp.id('t2');
  tw uuid := pg_temp.id('tw');
  fremd uuid := gen_random_uuid();
begin
  foreach wer in array array['a', 'verw'] loop
    perform pg_temp.als(pg_temp.id(wer));
    for r in select * from (values
        (null::text, array[t1], false, null::integer[], 'd1,s2,s1,u2'),
        (null, array[t1, t2], false, null, 's3,u3,d1,d2,s2,s1,u2'),       -- Teams: ODER
        (null, null, true, null, 'u1,x'),                                 -- nur ohne Team
        (null, array[t2], true, null, 's3,u3,d2,s2,u1,x'),                -- Team ODER ohne Team
        (null, '{}', true, null, 'u1,x'),
        (null, array[tw], false, null, ''),                               -- fremdes Team trifft nie
        (null, array[fremd], false, null, ''),                            -- unbekanntes ebenso
        (null, array[tw, t1], false, null, 'd1,s2,s1,u2'),
        (null, array[tw], true, null, 'u1,x'),
        (null, array[null, t1]::uuid[], false, null, 'd1,s2,s1,u2'),
        (null, array[null]::uuid[], false, null, 's3,u3,d1,d2,s2,s1,u1,u2,x'),  -- lauter null: keine Eingrenzung
        (null, array[null, null]::uuid[], true, null, 'u1,x'),
        (null, null, false, array[null]::integer[], 's3,u3,d1,d2,s2,s1,u1,u2,x'),
        (null, null, false, array[null, 2014], 's3,s2'),
        (null, '{}', false, null, 's3,u3,d1,d2,s2,s1,u1,u2,x'),           -- leer: keine Eingrenzung
        (null, null, null, null, 's3,u3,d1,d2,s2,s1,u1,u2,x'),
        (null, null, false, array[2014], 's3,s2'),
        (null, null, false, array[2014, 2016], 's3,s2,u1,x'),             -- Jahrgänge: ODER
        (null, null, false, array[1999], ''),
        (null, null, false, '{}', 's3,u3,d1,d2,s2,s1,u1,u2,x'),
        (null, array[t2], false, array[2014], 's3,s2'),                   -- Team UND Jahrgang
        (null, null, true, array[2014], ''),
        ('ben', array[t2], false, array[2014, 2017], 's3'),               -- Suche UND Team UND Jahrgang
        ('lea', array[t2], false, array[2017], 'd2'),
        ('lea', array[t1], true, array[2014, 2016], 's2'),
        ('lena', array[tw], false, null, '')) v(suche, teams, ohne, jahrgaenge, erwartet) loop
      l := verein_spielerliste(pg_temp.id('v'), r.suche, r.teams, r.ohne, r.jahrgaenge);
      perform pg_temp.pruefe(pg_temp.treffer(l) = r.erwartet,
                             format('%s: Eingrenzung %s/%s/%s/%s ergibt «%s» statt «%s»', wer, r.suche, r.teams, r.ohne,
                                    r.jahrgaenge, pg_temp.treffer(l), r.erwartet));
      -- Teams, Jahrgänge und Zahlen am Kopf bleiben ungefiltert.
      perform pg_temp.pruefe(jsonb_array_length(l -> 'teams') = 2 and l -> 'jahrgaenge' = '[2014, 2015, 2016, 2017, 2018]'
                             and l -> 'gesamt' = '9' and l -> 'ohne_team' = '2',
                             wer || ': Kopf gefiltert ' || (l - 'spieler')::text);
    end loop;
    -- Eine nach T1 eingegrenzte Zeile nennt weiter alle Teams.
    l := verein_spielerliste(pg_temp.id('v'), null, array[t1]);
    select e into s from jsonb_array_elements(l -> 'spieler') e where e ->> 'id' = pg_temp.id('s2')::text;
    perform pg_temp.pruefe(jsonb_array_length(s -> 'teams') = 2, wer || ': Teams der eingegrenzten Zeile ' || s::text);
    reset role;
  end loop;
end $$;

-- ── Testfall 32: 1001 Spieler:innen in einem Aufruf ─────────────────────────

set local session_replication_role = replica;
insert into spieler (team_id, verein_id, vorname, nachname, jahrgang)
select case when i % 3 = 0 then pg_temp.id('t3') end, pg_temp.id('v3'), 'Vor' || i, 'Nach' || i, 2010 + i % 8
  from generate_series(1, 1001) i;
insert into team_spieler (team_id, spieler_id, verein_id)
select team_id, id, verein_id from spieler where verein_id = pg_temp.id('v3') and team_id is not null;
set local session_replication_role = origin;

do $$
declare
  v3 uuid := pg_temp.id('v3');
  l jsonb;
  n_suche int := (select count(*) from spieler where verein_id = pg_temp.id('v3') and strpos(vorname || ' ' || nachname, 'or10') > 0);
  n_team int := (select count(*) from team_spieler where team_id = pg_temp.id('t3'));
  n_jg int := (select count(*) from spieler where verein_id = pg_temp.id('v3') and jahrgang in (2011, 2013));
  n_alles int := (select count(*) from spieler s where s.verein_id = pg_temp.id('v3') and s.jahrgang = 2012
                     and not exists (select 1 from team_spieler ts where ts.spieler_id = s.id)
                     and strpos(s.vorname || ' ' || s.nachname, '1') > 0);
  wer text;
  zeile text[];
begin
  -- Ein Mitglied (m3) und die Verwaltung (v3verw), je in ihrer Form.
  foreach wer in array array['m3', 'v3verw'] loop
    zeile := case wer when 'm3' then array['id', 'jahrgang', 'nachname', 'teams', 'vorname']
                  else array['id', 'jahrgang', 'js', 'link_bezogen', 'link_zugestellt', 'nachname', 'schnuppern', 'teams', 'vorname'] end;
    perform pg_temp.als(pg_temp.id(wer));
    l := verein_spielerliste(v3);
    perform pg_temp.pruefe(jsonb_array_length(l -> 'spieler') = 1001 and l -> 'gesamt' = '1001'
                           and (l ->> 'ohne_team')::int = 1001 - n_team, wer || ': Testfall 32: ' || (l - 'spieler')::text);
    perform pg_temp.pruefe(l -> 'verwaltung' = to_jsonb(wer = 'v3verw')
                           and not exists (select 1 from jsonb_array_elements(l -> 'spieler') e
                                            where pg_temp.schluessel(e) <> zeile),
                           wer || ': Testfall 32: Form');
    perform pg_temp.pruefe(jsonb_array_length(verein_spielerliste(v3, 'OR10') -> 'spieler') = n_suche, wer || ': Testfall 32: Suche');
    perform pg_temp.pruefe(jsonb_array_length(verein_spielerliste(v3, null, array[pg_temp.id('t3')]) -> 'spieler') = n_team,
                           wer || ': Testfall 32: Team');
    perform pg_temp.pruefe(jsonb_array_length(verein_spielerliste(v3, null, null, false, array[2011, 2013]) -> 'spieler') = n_jg,
                           wer || ': Testfall 32: Jahrgang');
    perform pg_temp.pruefe(jsonb_array_length(verein_spielerliste(v3, '1', null, true, array[2012]) -> 'spieler') = n_alles,
                           wer || ': Testfall 32: alles zusammen');
    reset role;
  end loop;
end $$;

-- ── Nach dem Austritt nicht mehr (PC 3) ─────────────────────────────────────

delete from team_members where user_id = pg_temp.id('a');
delete from verein_verwaltung where user_id = pg_temp.id('verw');
do $$
declare
  wer text;
begin
  foreach wer in array array['a', 'verw'] loop
    perform pg_temp.als(pg_temp.id(wer));
    perform pg_temp.erwarte(format('select verein_spielerliste(%L)', pg_temp.id('v')), 'VEREIN_NICHT_GEFUNDEN');
    reset role;
  end loop;
  -- verw2 verlässt die Verwaltung (b übernimmt; die letzte geht nicht) und
  -- bleibt in T1: jetzt die Form der Mitglieder.
  insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v'), pg_temp.id('b'));
  delete from verein_verwaltung where user_id = pg_temp.id('verw2');
  perform pg_temp.als(pg_temp.id('verw2'));
  perform pg_temp.pruefe(pg_temp.schluessel(verein_spielerliste(pg_temp.id('v')) -> 'spieler' -> 0)
                         = array['id', 'jahrgang', 'nachname', 'teams', 'vorname']
                         and verein_spielerliste(pg_temp.id('v')) -> 'verwaltung' = 'false', 'verw2 nach dem Austritt aus der Verwaltung');
  reset role;
end $$;

rollback;
