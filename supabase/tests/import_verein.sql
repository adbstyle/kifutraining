-- CSV-Import in den Spielerbestand des Vereins (Story 9 #585; Architekturplan
-- Vereine §3.7, §4.3, §7.9, Testfall 24). Auf DB-Ebene, Rollenwechsel wie
-- PostgREST, Altdubletten und volle Vereine unter `replica`:
-- - Rechte: neue Funktion für `authenticated`, nicht `anon`/`public`, genau
--   eine Funktion dieses Namens; die Helfer import_zeilennummern und
--   import_js_paare ohne API-Recht; der Team-Import existiert nicht mehr und scheitert für jede
--   Rolle, auch für die Verwaltung (AK 12)
-- - Zugang (AK 11): nur die Verwaltung des eigenen Vereins (auch mit
--   Teamrolle); Mitglied ohne Verwaltung, fremde Verwaltung, Konto ohne
--   Verein, unbekannter und null-Verein: VEREIN_NICHT_GEFUNDEN, für Vorschau
--   und Übernahme gleich und ohne zu schreiben; KI-Token:
--   NUR_IN_DER_ANWENDUNG; anon: kein Recht
-- - Vorschau-Form exakt nach Vertrag B (Schlüsselmengen und ganze Werte),
--   schreibt nichts (AK 3)
-- - Abgleich über den ganzen Verein (AK 2): ohne Team, schnuppernd, in zwei
--   Teams; Gross/Klein, Leerzeichen, Bindestriche und Apostrophe gleich,
--   Umlaute verschieden (neue Schreibweise = neu, OoS 3); ein anderer Verein
--   zählt nicht; letzte Zeile gewinnt
-- - J+S (PC 2, 3): abweichend = `js` samt alter Nummer; leer, gleich oder
--   länger als 20 Zeichen ändert nichts; neue ohne gültige Nummer bekommen
--   keine
-- - `mehrfach` (AK 5): Vereinigung der Teams aller Treffer ohne Doppelte, nie
--   eine J+S-Änderung, eine Übernahme nur damit ändert nichts
-- - Übernahme: neue ohne Team, J+S gesetzt, sonst nichts (PC 1–3, 5:
--   Zuordnungen, Schnuppern, Termine samt erwarteter Spielerzahl unverändert);
--   die Reihenfolge von p_erwartet zählt nicht
-- - Grenze (AK 6, 7): `ueber` = bestand + neu − 1000; Übernahme darüber →
--   `veraltet` grund 'grenze' ohne zu schreiben; genau 1000 geht; ohne neue
--   auch über 1000; keine Teamgrenze (AK 8: J+S in einem Team mit 100 und
--   neue Spieler:innen trotz vollem Team)
-- - `veraltet` grund 'bestand' (AK 9) je Art der Änderung: inzwischen
--   erfasst, gelöscht, umbenannt, J+S inzwischen gesetzt, Altdublette
--   verschwunden; grund 'grenze': Grenze inzwischen erreicht; jeweils nichts
--   geschrieben und die neue Vorschau dabei; eine unbeteiligte Erfassung macht
--   die Vorschau nicht veraltet; p_erwartet ohne Listen zählt als leer
-- - J+S inzwischen geändert (D1 nach Review): die Vorschau nannte alt «1»,
--   dazwischen steht «2» → `veraltet` grund 'bestand', «2» bleibt; mit der
--   passenden alten Nummer geht die Übernahme durch; die frühere Form von
--   p_erwartet.js als blosse Zeilennummern gilt als abweichend (`veraltet`)
-- - Zeilennummern (D2): ein Element, das kein Objekt ist, eine fehlende, null,
--   nicht ganze, nicht positive oder doppelte `zeile` → technisch abgewiesen
--   (SQLSTATE 22023), für Vorschau und Übernahme
-- - Letzte Zeile ohne gültige J+S nach einer früheren mit gültiger, bei einer
--   Bestehenden: `gleich`, die Nummer bleibt
-- - Alles oder nichts (PC 4): eine ungültige Zeile mitten in 600 neuen lässt
--   keine Zeile und keine J+S-Änderung zurück
-- - IMPORT_ZU_GROSS: 1001 Zeilen, kein Array, null; 1000 gehen
-- - Leistung (Zettel A2): 1000 neue Zeilen eines Jahrgangs in einen leeren
--   Verein und danach die Vorschau derselben 1000 Zeilen gegen den Verein mit
--   1000 Spieler:innen, beides mit erzwungen schlechtem Plan (keine
--   Indexscans), je unter 2 s
-- - Das Netz bleibt: Die Einstellung, mit der spieler_vorher die
--   Dublettenprüfung je Zeile überspringt, ist nach der Übernahme
--   zurückgesetzt, gilt nur für ihren Verein, bleibt nach einem gescheiterten
--   INSERT, den der Aufrufer in einer Untertransaktion abfängt, nicht stehen
--   (der Trigger prüft danach wieder), und keine andere Funktion mit
--   API-Recht nennt sie
-- Rennen: rennen.sql. Alles in einer Transaktion mit rollback; hinterlässt
-- nichts.

\set ON_ERROR_STOP on
\o /dev/null

begin;
set local statement_timeout = '120s';

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
  if p_ok is not true then raise exception 'Story 9: %', p_text; end if;
end $$;

create function pg_temp.schluessel(p jsonb) returns text[]
language sql immutable as $$ select array(select k from jsonb_object_keys(p) k order by k) $$;

-- Lesen am Eigentümer vorbei an RLS, für Prüfungen mitten in Blöcken, die als
-- Verwaltung laufen (sie sieht ohne Teamrolle keine Zeilen).
create function pg_temp.anzahl(p_verein uuid) returns bigint language sql stable security definer as $$
  select count(*) from public.spieler where verein_id = p_verein $$;
create function pg_temp.js(p_spieler uuid) returns text language sql stable security definer as $$
  select js_nummer from public.spieler where id = p_spieler $$;
create function pg_temp.da(p_verein uuid, p_nachname text) returns boolean language sql stable security definer as $$
  select exists (select 1 from public.spieler where verein_id = p_verein and nachname = p_nachname) $$;
create function pg_temp.im_team(p_team uuid) returns bigint language sql stable security definer as $$
  select count(*) from public.team_spieler where team_id = p_team $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values
  ('verw'), ('verw2'), ('a'), ('wverw'), ('ohne'), ('gverw'), ('rverw'),
  ('v'), ('w'), ('g'), ('r'), ('t1'), ('t2'), ('tw'), ('tg'), ('termin'),
  ('p_ohne'), ('p_schn'), ('p_zwei'), ('p_js'), ('d1'), ('d2'), ('d3'), ('p_key'), ('p_lang'), ('p_w'),
  ('r_del'), ('r_ren'), ('r_js'), ('r_js2'), ('r_alt1'), ('r_alt2'), ('g_voll');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id
-- {id, name} eines Teams, als Eigentümer abgelegt (RLS zeigt der Verwaltung
-- ohne Teamrolle keine Teams).
create temp table teamjson (name text primary key, wert jsonb not null);
grant select on teamjson to authenticated;
create function pg_temp.team(p text) returns jsonb language sql stable as $$
  select wert from teamjson where name = p
$$;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@import-verein.test', now() from ids
 where name in ('verw', 'verw2', 'a', 'wverw', 'ohne', 'gverw', 'rverw');

-- Verein V: Verwaltung verw (ohne Team) und verw2 (auch Mitglied in T1),
-- Mitglied a (T1, ohne Verwaltung). Verein W: Verwaltung wverw. Verein G
-- (Grenze): gverw. Verein R (veraltet): rverw.
insert into vereine (id, name) values (pg_temp.id('v'), 'Import-Verein'), (pg_temp.id('w'), 'Anderer Verein'),
  (pg_temp.id('g'), 'Grenz-Verein'), (pg_temp.id('r'), 'Rennbahn-Verein');
insert into verein_verwaltung (verein_id, user_id) values
  (pg_temp.id('v'), pg_temp.id('verw')), (pg_temp.id('v'), pg_temp.id('verw2')), (pg_temp.id('w'), pg_temp.id('wverw')),
  (pg_temp.id('g'), pg_temp.id('gverw')), (pg_temp.id('r'), pg_temp.id('rverw'));
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Team Eins', pg_temp.id('v')), (pg_temp.id('t2'), 'Team Zwei', pg_temp.id('v')),
  (pg_temp.id('tw'), 'Team W', pg_temp.id('w')), (pg_temp.id('tg'), 'Team Voll', pg_temp.id('g'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t1'), pg_temp.id('verw2'));
insert into team_probetraining (team_id, anzahl, info) values (pg_temp.id('t2'), 3, null);
insert into teamjson select i.name, jsonb_build_object('id', t.id, 'name', t.name) from teams t join ids i on i.id = t.id;
insert into training_termine (id, team_id, datum, beginn, ende, erwartete_spielerzahl)
values (pg_temp.id('termin'), pg_temp.id('t1'), current_date + 7, '18:00', '19:30', 12);

-- Bestand V (unter replica samt team_id wie die Trigger):
--   p_ohne  Xaver Ohne 2016, ohne Team, ohne J+S
--   p_schn  Ben Schnupper 2014, schnuppert in T2
--   p_zwei  Léa Muller 2014, T1 und T2, J+S 111
--   p_js    Lena Müller 2015, T1, J+S 1234567
--   d1–d3   Lea Dublette 2017: T1, T2, T1+T2 (Altdublette dreifach)
--   p_key   jean luc / d’amour 2016, T2
--   p_lang  Ugo Lang 2016, ohne Team, J+S 55
-- W: p_w   Neu Fremd 2015 (TW)
set local session_replication_role = replica;
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang, js_nummer, probe_seit) values
  (pg_temp.id('p_ohne'), null, pg_temp.id('v'), 'Xaver', 'Ohne', 2016, null, null),
  (pg_temp.id('p_schn'), pg_temp.id('t2'), pg_temp.id('v'), 'Ben', 'Schnupper', 2014, null, now() - interval '2 days'),
  (pg_temp.id('p_zwei'), pg_temp.id('t1'), pg_temp.id('v'), 'Léa', 'Muller', 2014, '111', null),
  (pg_temp.id('p_js'), pg_temp.id('t1'), pg_temp.id('v'), 'Lena', 'Müller', 2015, '1234567', null),
  (pg_temp.id('d1'), pg_temp.id('t1'), pg_temp.id('v'), 'Lea', 'Dublette', 2017, '1', null),
  (pg_temp.id('d2'), pg_temp.id('t2'), pg_temp.id('v'), 'Lea', 'Dublette', 2017, null, null),
  (pg_temp.id('d3'), pg_temp.id('t1'), pg_temp.id('v'), 'Lea', 'Dublette', 2017, '3', null),
  (pg_temp.id('p_key'), pg_temp.id('t2'), pg_temp.id('v'), 'jean luc', 'd’amour', 2016, null, null),
  (pg_temp.id('p_lang'), null, pg_temp.id('v'), 'Ugo', 'Lang', 2016, '55', null),
  (pg_temp.id('p_w'), pg_temp.id('tw'), pg_temp.id('w'), 'Neu', 'Fremd', 2015, null, null);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values
  (pg_temp.id('t2'), pg_temp.id('p_schn'), pg_temp.id('v'), now() - interval '2 days'),
  (pg_temp.id('t1'), pg_temp.id('p_zwei'), pg_temp.id('v'), null),
  (pg_temp.id('t2'), pg_temp.id('p_zwei'), pg_temp.id('v'), null),
  (pg_temp.id('t1'), pg_temp.id('p_js'), pg_temp.id('v'), null),
  (pg_temp.id('t1'), pg_temp.id('d1'), pg_temp.id('v'), null),
  (pg_temp.id('t2'), pg_temp.id('d2'), pg_temp.id('v'), null),
  (pg_temp.id('t1'), pg_temp.id('d3'), pg_temp.id('v'), null),
  (pg_temp.id('t2'), pg_temp.id('d3'), pg_temp.id('v'), null),
  (pg_temp.id('t2'), pg_temp.id('p_key'), pg_temp.id('v'), null),
  (pg_temp.id('tw'), pg_temp.id('p_w'), pg_temp.id('w'), null);
set local session_replication_role = origin;

-- Der Stand eines Vereins, den der Import nicht ändern darf: alle Angaben
-- der Spieler:innen, Zuordnungen samt Schnuppern, Termine, Schnupper-Angebot.
-- Als Eigentümer aufrufen.
create function pg_temp.stand(p_verein uuid) returns text
language sql stable as $$
  select md5(concat_ws('|',
    (select string_agg(concat_ws(',', s.id, s.vorname, s.nachname, s.jahrgang, s.js_nummer, s.link_token,
                                 s.link_bezogen, s.probe_seit, s.team_id), ';' order by s.id)
       from spieler s where s.verein_id = p_verein),
    (select string_agg(concat_ws(',', ts.team_id, ts.spieler_id, ts.probe_seit, ts.created_at), ';' order by ts.team_id, ts.spieler_id)
       from team_spieler ts where ts.verein_id = p_verein),
    (select string_agg(concat_ws(',', tt.id, tt.erwartete_spielerzahl, tt.updated_at, tt.ausgefallen), ';' order by tt.id)
       from training_termine tt join teams t on t.id = tt.team_id where t.verein_id = p_verein),
    (select string_agg(concat_ws(',', tp.team_id, tp.anzahl, tp.info), ';' order by tp.team_id)
       from team_probetraining tp join teams t on t.id = tp.team_id where t.verein_id = p_verein)))
$$;

-- Die Importdatei für V (Zeilennummern wie im Web, ab 2 nach der Kopfzeile
-- spielt keine Rolle; hier frei gewählt):
--    1 xaver OHNE 2016, J+S 999         → js (alt null, ohne Team)
--    2 Ben Schnupper 2014               → gleich (schnuppert in T2)
--    3 Léa Muller 2014, J+S 111         → gleich (gleiche Nummer, T1 und T2)
--    4 Lena Müller 2015, J+S 7654321    → js (alt 1234567, T1)
--    5 Lea Dublette 2017, J+S 5         → mehrfach (T1 und T2)
--    6 Neu Fremd 2015, J+S 42           → neu (gleiche Angaben nur im Verein W)
--    7 Lena Muller 2015                 → neu (Umlaut zählt, OoS 3)
--    9 Mia Neu 2018, J+S 1              → von Zeile 10 überholt
--   10 « mia »  NEU 2018, J+S 2          → neu (letzte gewinnt)
--   11 Jean-Luc D'Amour 2016            → gleich (Bindestrich, Apostroph)
--   12 Ugo  Lang 2016, J+S 21 Zeichen   → gleich (ungültig belässt 55)
--   13 Neu Lang 2016, J+S 21 Zeichen    → neu, ohne J+S
create function pg_temp.datei() returns jsonb language sql immutable as $$
  select '[
    {"zeile": 1, "vorname": "xaver", "nachname": "OHNE", "jahrgang": 2016, "js": "999"},
    {"zeile": 2, "vorname": "Ben", "nachname": "Schnupper", "jahrgang": 2014, "js": null},
    {"zeile": 3, "vorname": "Léa", "nachname": "Muller", "jahrgang": 2014, "js": "111"},
    {"zeile": 4, "vorname": "Lena", "nachname": "Müller", "jahrgang": 2015, "js": "7654321"},
    {"zeile": 5, "vorname": "Lea", "nachname": "Dublette", "jahrgang": 2017, "js": "5"},
    {"zeile": 6, "vorname": "Neu", "nachname": "Fremd", "jahrgang": 2015, "js": "42"},
    {"zeile": 7, "vorname": "Lena", "nachname": "Muller", "jahrgang": 2015},
    {"zeile": 9, "vorname": "Mia", "nachname": "Neu", "jahrgang": 2018, "js": "1"},
    {"zeile": 10, "vorname": " mia ", "nachname": "NEU", "jahrgang": 2018, "js": " 2 "},
    {"zeile": 11, "vorname": "Jean-Luc", "nachname": "D''Amour", "jahrgang": 2016, "js": ""},
    {"zeile": 12, "vorname": "Ugo ", "nachname": "Lang", "jahrgang": 2016, "js": "123456789012345678901"},
    {"zeile": 13, "vorname": "Neu", "nachname": "Lang", "jahrgang": 2016, "js": "123456789012345678901"}
  ]'::jsonb
$$;

-- ── Rechte und AK 12 ────────────────────────────────────────────────────────

do $$
declare
  f text := 'verein_spieler_importieren(uuid,jsonb,jsonb)';
begin
  perform pg_temp.pruefe(to_regprocedure(f) is not null, 'verein_spieler_importieren fehlt');
  perform pg_temp.pruefe((select count(*) from pg_proc where proname = 'verein_spieler_importieren') = 1,
                         'mehr als eine Funktion verein_spieler_importieren (Überladung)');
  perform pg_temp.pruefe(not has_function_privilege('anon', f, 'execute')
                         and not has_function_privilege('public', f, 'execute')
                         and has_function_privilege('authenticated', f, 'execute'), 'Grant von ' || f);
  perform pg_temp.pruefe((select prosecdef from pg_proc where oid = to_regprocedure(f)), f || ' ist nicht security definer');
  perform pg_temp.pruefe(not has_function_privilege('anon', 'import_zeilennummern(jsonb)', 'execute')
                         and not has_function_privilege('authenticated', 'import_zeilennummern(jsonb)', 'execute'),
                         'import_zeilennummern hat ein API-Recht');
  perform pg_temp.pruefe(not has_function_privilege('anon', 'import_js_paare(jsonb)', 'execute')
                         and not has_function_privilege('authenticated', 'import_js_paare(jsonb)', 'execute'),
                         'import_js_paare hat ein API-Recht');
  -- AK 12: Der Team-Import ist gelöscht, unter keinem Namen mit diesem Stamm
  -- und keiner Signatur mehr vorhanden.
  perform pg_temp.pruefe(to_regprocedure('public.spieler_' || 'importieren(uuid, jsonb, jsonb)') is null,
                         'der Import in ein Team besteht noch');
  perform pg_temp.pruefe(not exists (select 1 from pg_proc where proname = 'spieler_' || 'importieren'),
                         'eine Funktion des Team-Imports besteht noch');
end $$;

-- AK 12: Jeder Aufruf des Team-Imports scheitert, auch für eine Person, die
-- der Verwaltung angehört und Mitglied des Teams ist (verw2 in T1).
select pg_temp.als(pg_temp.id('verw2'));
select pg_temp.erwarte(format('select %I(%L::uuid, %L::jsonb, null::jsonb)', 'spieler_' || 'importieren',
                              pg_temp.id('t1'), pg_temp.datei()), '42883');
select pg_temp.erwarte(format('select %I(%L::uuid, %L::jsonb, %L::jsonb)', 'spieler_' || 'importieren',
                              pg_temp.id('t1'), pg_temp.datei(), '{"neu": [], "js": []}'), '42883');
reset role;

-- ── Zugang (AK 11) ──────────────────────────────────────────────────────────

select pg_temp.stand(pg_temp.id('v')) as stand_v_vorher \gset
do $$
declare
  wer text;
  ziel uuid;
begin
  -- Mitglied ohne Verwaltung, fremde Verwaltung, Konto ohne Verein.
  foreach wer in array array['a', 'wverw', 'ohne'] loop
    perform pg_temp.als(pg_temp.id(wer));
    perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L)', pg_temp.id('v'), pg_temp.datei()),
                            'VEREIN_NICHT_GEFUNDEN');
    perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L, %L)', pg_temp.id('v'), pg_temp.datei(),
                                   '{"neu": [6, 7, 10, 13], "js": [{"zeile": 1, "alt": null}, {"zeile": 4, "alt": "1234567"}], "mehrfach": [5]}'), 'VEREIN_NICHT_GEFUNDEN');
    -- Auch eine zu grosse Datei verrät nichts vor der Rollenprüfung.
    perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L)', pg_temp.id('v'), '{}'),
                            'VEREIN_NICHT_GEFUNDEN');
    reset role;
  end loop;
  -- Die Verwaltung mit unbekanntem, fremdem und null-Verein.
  perform pg_temp.als(pg_temp.id('verw'));
  foreach ziel in array array[gen_random_uuid(), pg_temp.id('w'), null] loop
    perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L)', ziel, pg_temp.datei()),
                            'VEREIN_NICHT_GEFUNDEN');
    perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L, %L)', ziel, pg_temp.datei(),
                                   '{"neu": [], "js": [], "mehrfach": []}'), 'VEREIN_NICHT_GEFUNDEN');
  end loop;
  reset role;
  -- KI-Zugang: auch für die Verwaltung des Vereins.
  perform pg_temp.als(pg_temp.id('verw'), '{"client_id": "ki-client"}');
  perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L)', pg_temp.id('v'), pg_temp.datei()),
                          'NUR_IN_DER_ANWENDUNG');
  perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L, %L)', pg_temp.id('v'), pg_temp.datei(),
                                 '{"neu": [6, 7, 10, 13], "js": [{"zeile": 1, "alt": null}, {"zeile": 4, "alt": "1234567"}], "mehrfach": [5]}'), 'NUR_IN_DER_ANWENDUNG');
  reset role;
end $$;
select format('select verein_spieler_importieren(%L, %L)', pg_temp.id('v'), pg_temp.datei()) as anon_aufruf \gset
set local role anon;
select pg_temp.erwarte(:'anon_aufruf', '42501');
reset role;
select pg_temp.pruefe(pg_temp.stand(pg_temp.id('v')) = :'stand_v_vorher', 'eine abgewiesene Anfrage hat geschrieben');

-- ── Vorschau (AK 2, 3, 5; PC 2, 3) ──────────────────────────────────────────

select pg_temp.als(pg_temp.id('verw'));
select verein_spieler_importieren(pg_temp.id('v'), pg_temp.datei()) as vorschau \gset
reset role;
create temp table vorschau_v as select :'vorschau'::jsonb as v;
do $$
declare
  v jsonb := (select v from vorschau_v);
  e jsonb;
  t1 jsonb := pg_temp.team('t1');
  t2 jsonb := pg_temp.team('t2');
begin
  perform pg_temp.pruefe(pg_temp.schluessel(v) = array['bestand', 'gleich', 'js', 'mehrfach', 'neu', 'status', 'ueber'],
                         'Schlüssel der Vorschau: ' || v::text);
  for e in select * from jsonb_array_elements(v -> 'js') loop
    perform pg_temp.pruefe(pg_temp.schluessel(e) = array['alt', 'teams', 'zeile'], 'Schlüssel in js: ' || e::text);
  end loop;
  for e in select x from jsonb_array_elements(v -> 'gleich') x
           union all select x from jsonb_array_elements(v -> 'mehrfach') x loop
    perform pg_temp.pruefe(pg_temp.schluessel(e) = array['teams', 'zeile'], 'Schlüssel in gleich/mehrfach: ' || e::text);
  end loop;
  for e in select x from jsonb_array_elements(v -> 'js') j, jsonb_array_elements(j -> 'teams') x
           union all select x from jsonb_array_elements(v -> 'gleich') j, jsonb_array_elements(j -> 'teams') x
           union all select x from jsonb_array_elements(v -> 'mehrfach') j, jsonb_array_elements(j -> 'teams') x loop
    perform pg_temp.pruefe(pg_temp.schluessel(e) = array['id', 'name'], 'Schlüssel eines Teams: ' || e::text);
  end loop;
  perform pg_temp.pruefe(v = jsonb_build_object(
    'status', 'vorschau', 'bestand', 9, 'ueber', 0,
    'neu', '[6, 7, 10, 13]'::jsonb,
    'js', jsonb_build_array(
            jsonb_build_object('zeile', 1, 'alt', null, 'teams', '[]'::jsonb),
            jsonb_build_object('zeile', 4, 'alt', '1234567', 'teams', jsonb_build_array(t1))),
    'gleich', jsonb_build_array(
            jsonb_build_object('zeile', 2, 'teams', jsonb_build_array(t2)),
            jsonb_build_object('zeile', 3, 'teams', jsonb_build_array(t1, t2)),
            jsonb_build_object('zeile', 11, 'teams', jsonb_build_array(t2)),
            jsonb_build_object('zeile', 12, 'teams', '[]'::jsonb)),
    'mehrfach', jsonb_build_array(jsonb_build_object('zeile', 5, 'teams', jsonb_build_array(t1, t2)))),
    'Vorschau weicht ab: ' || v::text);
end $$;
select pg_temp.pruefe(pg_temp.stand(pg_temp.id('v')) = :'stand_v_vorher', 'die Vorschau hat geschrieben');

-- Die Rolle mit beiden Rollen (verw2) bekommt dieselbe Vorschau.
select pg_temp.als(pg_temp.id('verw2'));
select pg_temp.pruefe(verein_spieler_importieren(pg_temp.id('v'), pg_temp.datei()) = :'vorschau'::jsonb,
                      'Vorschau für Verwaltung mit Teamrolle weicht ab');
-- Eine leere Datei: alles leer, der Bestand gezählt.
select pg_temp.pruefe(verein_spieler_importieren(pg_temp.id('v'), '[]') =
                      '{"status": "vorschau", "bestand": 9, "ueber": 0, "neu": [], "js": [], "gleich": [], "mehrfach": []}',
                      'Vorschau einer leeren Datei');
reset role;

-- ── Übernahme (PC 1–3, 5; AK 5) ─────────────────────────────────────────────

select (select string_agg(concat_ws(',', team_id, spieler_id, probe_seit), ';' order by team_id, spieler_id)
          from team_spieler where verein_id = pg_temp.id('v')) as zuordnung_v_vorher,
       (select md5(string_agg(concat_ws(',', id, erwartete_spielerzahl, updated_at), ';')) from training_termine
         where id = pg_temp.id('termin')) as termin_vorher,
       pg_temp.stand(pg_temp.id('w')) as stand_w_vorher \gset
create temp table v_vorher as select id from spieler where verein_id = pg_temp.id('v');
select pg_temp.als(pg_temp.id('verw'));
-- Die Reihenfolge der erwarteten Zeilen zählt nicht; `bestand` wird ignoriert.
select pg_temp.pruefe(verein_spieler_importieren(pg_temp.id('v'), pg_temp.datei(),
                        '{"neu": [13, 10, 7, 6], "js": [{"zeile": 4, "alt": "1234567"}, {"zeile": 1, "alt": null}], "mehrfach": [5], "bestand": 0}')
                      = '{"status": "uebernommen", "neu": 4, "js": 2}', 'Übernahme');
select pg_temp.pruefe(current_setting('kifu.import_verein', true) = '', 'Einstellung nach der Übernahme nicht zurückgesetzt');
reset role;
do $$
begin
  -- PC 1: neu, ohne Team, bereinigt, letzte Zeile gewinnt, ungültige J+S leer.
  perform pg_temp.pruefe(pg_temp.anzahl(pg_temp.id('v')) = 13, 'Anzahl nach der Übernahme');
  perform pg_temp.pruefe(exists (select 1 from spieler where verein_id = pg_temp.id('v') and vorname = 'Neu'
                                    and nachname = 'Fremd' and jahrgang = 2015 and js_nummer = '42'), 'Zeile 6 fehlt');
  perform pg_temp.pruefe(exists (select 1 from spieler where verein_id = pg_temp.id('v') and vorname = 'Lena'
                                    and nachname = 'Muller' and jahrgang = 2015 and js_nummer is null), 'Zeile 7 fehlt');
  perform pg_temp.pruefe((select count(*) from spieler where verein_id = pg_temp.id('v')
                            and spieler_text_schluessel(vorname) = 'mia') = 1
                         and exists (select 1 from spieler where verein_id = pg_temp.id('v') and vorname = 'mia'
                                        and nachname = 'NEU' and jahrgang = 2018 and js_nummer = '2'),
                         'Zeile 10 (letzte gewinnt) falsch');
  perform pg_temp.pruefe(exists (select 1 from spieler where verein_id = pg_temp.id('v') and vorname = 'Neu'
                                    and nachname = 'Lang' and js_nummer is null), 'Zeile 13 fehlt oder hat J+S');
  perform pg_temp.pruefe((select count(*) from spieler s where s.verein_id = pg_temp.id('v')
                            and s.id not in (select id from v_vorher)) = 4, 'nicht genau vier neue');
  perform pg_temp.pruefe(not exists (select 1 from spieler s where s.verein_id = pg_temp.id('v')
                                        and s.id not in (select id from v_vorher)
                                        and (s.team_id is not null or s.probe_seit is not null
                                             or exists (select 1 from team_spieler ts where ts.spieler_id = s.id))),
                         'eine neue Spieler:in hat ein Team');
  -- PC 2, 3, AK 5.
  perform pg_temp.pruefe(pg_temp.js(pg_temp.id('p_ohne')) = '999', 'J+S Zeile 1');
  perform pg_temp.pruefe(pg_temp.js(pg_temp.id('p_js')) = '7654321', 'J+S Zeile 4');
  perform pg_temp.pruefe(pg_temp.js(pg_temp.id('p_lang')) = '55', 'ungültige J+S hat geändert');
  perform pg_temp.pruefe(pg_temp.js(pg_temp.id('p_zwei')) = '111', 'gleiche J+S verändert');
  perform pg_temp.pruefe((select string_agg(coalesce(js_nummer, '-'), ',' order by id) from spieler
                           where id in (pg_temp.id('d1'), pg_temp.id('d2'), pg_temp.id('d3')))
                         = (select string_agg(coalesce(x, '-'), ',' order by i) from (values (pg_temp.id('d1'), '1'),
                             (pg_temp.id('d2'), null), (pg_temp.id('d3'), '3')) z(i, x)),
                         'AK 5: J+S einer Altdublette geändert');
  perform pg_temp.pruefe((select vorname from spieler where id = pg_temp.id('p_ohne')) = 'Xaver'
                         and (select nachname from spieler where id = pg_temp.id('p_key')) = 'd’amour',
                         'OoS 3: Namen einer bestehenden geändert');
end $$;
-- PC 5: Zuordnungen, Schnuppern und Termine unverändert; Verein W unberührt.
select pg_temp.pruefe((select string_agg(concat_ws(',', team_id, spieler_id, probe_seit), ';' order by team_id, spieler_id)
                         from team_spieler where verein_id = pg_temp.id('v')) = :'zuordnung_v_vorher',
                      'PC 5: Zuordnungen oder Schnuppern verändert');
select pg_temp.pruefe((select md5(string_agg(concat_ws(',', id, erwartete_spielerzahl, updated_at), ';')) from training_termine
                        where id = pg_temp.id('termin')) = :'termin_vorher', 'PC 5: Termin verändert');
select pg_temp.pruefe((select probe_seit from spieler where id = pg_temp.id('p_schn')) is not null,
                      'PC 5: Schnuppern verändert');
select pg_temp.pruefe(pg_temp.stand(pg_temp.id('w')) = :'stand_w_vorher', 'Verein W verändert');

-- Dieselbe Datei noch einmal: nichts mehr neu, keine J+S-Änderung; die
-- Übernahme (in der Oberfläche gesperrt) ändert nichts.
select pg_temp.stand(pg_temp.id('v')) as stand_v_nach \gset
do $$
declare
  teams jsonb := jsonb_build_array(pg_temp.team('t1'), pg_temp.team('t2'));
  v jsonb;
begin
  perform pg_temp.als(pg_temp.id('verw'));
  v := verein_spieler_importieren(pg_temp.id('v'), pg_temp.datei());
  perform pg_temp.pruefe(v -> 'neu' = '[]' and v -> 'js' = '[]' and (v ->> 'bestand')::int = 13
                         and v -> 'mehrfach' = jsonb_build_array(jsonb_build_object('zeile', 5, 'teams', teams))
                         and jsonb_array_length(v -> 'gleich') = 10, 'zweite Vorschau: ' || v::text);
  -- AK 5: Eine Übernahme nur mit «mehrfach» ändert nichts.
  perform pg_temp.pruefe(verein_spieler_importieren(pg_temp.id('v'), pg_temp.datei(), '{"neu": [], "js": [], "mehrfach": [5]}')
                         = '{"status": "uebernommen", "neu": 0, "js": 0}', 'Übernahme ohne Änderung');
end $$;
reset role;
select pg_temp.pruefe(pg_temp.stand(pg_temp.id('v')) = :'stand_v_nach', 'Übernahme ohne Änderung hat geschrieben');

-- PC 3 mit «letzte gewinnt»: Eine frühere Zeile mit gültiger J+S, die letzte
-- derselben Bestehenden ohne → unverändert, die Nummer (55) bleibt.
select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  d jsonb := '[{"zeile": 1, "vorname": "Ugo", "nachname": "Lang", "jahrgang": 2016, "js": "66"},
               {"zeile": 2, "vorname": "ugo", "nachname": "LANG", "jahrgang": 2016, "js": null}]';
  v jsonb := verein_spieler_importieren(pg_temp.id('v'), d);
begin
  perform pg_temp.pruefe(v -> 'js' = '[]' and v -> 'neu' = '[]' and v -> 'gleich' = '[{"zeile": 2, "teams": []}]',
                         'frühere Zeile mit J+S, letzte ohne: ' || v::text);
  perform pg_temp.pruefe(verein_spieler_importieren(pg_temp.id('v'), d, '{"neu": [], "js": [], "mehrfach": []}')
                         = '{"status": "uebernommen", "neu": 0, "js": 0}', 'frühere Zeile mit J+S, letzte ohne: Übernahme');
  perform pg_temp.pruefe(pg_temp.js(pg_temp.id('p_lang')) = '55', 'frühere Zeile mit J+S hat die Nummer gesetzt');
end $$;
reset role;

-- Das Netz bleibt: Nach der Übernahme fängt der Trigger eine Dublette in
-- derselben Transaktion; die Einstellung eines anderen Vereins hebt die
-- Prüfung nicht auf.
select pg_temp.erwarte(format($$insert into spieler (verein_id, vorname, nachname, jahrgang)
                                values (%L, 'NEU', 'fremd', 2015)$$, pg_temp.id('v')), 'SPIELER_DOPPELT');
do $$
begin
  perform set_config('kifu.import_verein', pg_temp.id('w')::text, true);
  perform pg_temp.erwarte(format($s$insert into spieler (verein_id, vorname, nachname, jahrgang)
                                    values (%L, 'NEU', 'fremd', 2015)$s$, pg_temp.id('v')), 'SPIELER_DOPPELT');
  perform set_config('kifu.import_verein', '', true);
end $$;
-- Keine andere Funktion mit API-Recht nennt die Einstellung.
select pg_temp.pruefe(coalesce((select string_agg(p.oid::regprocedure::text, ', ') from pg_proc p
                                 where p.pronamespace = 'public'::regnamespace
                                   and p.prosrc like '%kifu.import_verein%'
                                   and (has_function_privilege('authenticated', p.oid, 'execute')
                                        or has_function_privilege('anon', p.oid, 'execute'))
                                   and p.proname <> 'verein_spieler_importieren'), '') = '',
                      'eine weitere Funktion mit API-Recht setzt kifu.import_verein');

-- ── IMPORT_ZU_GROSS ─────────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  z1000 jsonb := (select jsonb_agg(jsonb_build_object('zeile', i, 'vorname', 'Gross', 'nachname', 'Nr ' || i, 'jahrgang', 2010))
                    from generate_series(1, 1000) i);
begin
  perform pg_temp.pruefe(jsonb_array_length(verein_spieler_importieren(pg_temp.id('v'), z1000) -> 'neu') = 1000,
                         '1000 Zeilen nicht angenommen');
  perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L)', pg_temp.id('v'),
                                 z1000 || '[{"zeile": 1001, "vorname": "Zu", "nachname": "Viel", "jahrgang": 2010}]'::jsonb),
                          'IMPORT_ZU_GROSS');
  perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L, %L)', pg_temp.id('v'),
                                 z1000 || '[{"zeile": 1001, "vorname": "Zu", "nachname": "Viel", "jahrgang": 2010}]'::jsonb,
                                 '{"neu": [], "js": [], "mehrfach": []}'), 'IMPORT_ZU_GROSS');
  perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L)', pg_temp.id('v'), '{"zeile": 1}'), 'IMPORT_ZU_GROSS');
  perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L)', pg_temp.id('v'), 'null'), 'IMPORT_ZU_GROSS');
  perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, null)', pg_temp.id('v')), 'IMPORT_ZU_GROSS');
end $$;
reset role;
-- D2: Ohne eigene, positive, ganze Zeilennummer je Objekt weist die Funktion
-- technisch ab (22023, kein Marker), Vorschau wie Übernahme, ohne zu schreiben.
select pg_temp.stand(pg_temp.id('v')) as stand_v_d2 \gset
do $$
declare
  ok jsonb := '{"vorname": "Zeile", "nachname": "Probe", "jahrgang": 2012}';
  kaputt jsonb;
begin
  perform pg_temp.als(pg_temp.id('verw'));
  foreach kaputt in array array[
    jsonb_build_array(ok),                                                    -- zeile fehlt
    jsonb_build_array(ok || '{"zeile": null}'),
    jsonb_build_array(ok || '{"zeile": 0}'),
    jsonb_build_array(ok || '{"zeile": -3}'),
    jsonb_build_array(ok || '{"zeile": 2.5}'),
    jsonb_build_array(ok || '{"zeile": "2"}'),
    jsonb_build_array(ok || '{"zeile": 2}', ok || '{"zeile": 2, "vorname": "Andere"}'),   -- doppelt
    jsonb_build_array(ok || '{"zeile": 2}', '7'::jsonb),                      -- kein Objekt
    jsonb_build_array(ok || '{"zeile": 2}', '[{"zeile": 3}]'::jsonb)
  ] loop
    perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L)', pg_temp.id('v'), kaputt), '22023');
    perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L, %L)', pg_temp.id('v'), kaputt,
                                   '{"neu": [2], "js": [], "mehrfach": []}'), '22023');
  end loop;
end $$;
reset role;
select pg_temp.pruefe(pg_temp.stand(pg_temp.id('v')) = :'stand_v_d2', 'D2: eine abgewiesene Zeilennummer hat geschrieben');

-- ── Grenze (AK 6, 7, 8) und veraltet wegen der Grenze (AK 9) ────────────────

-- G: 998 Spieler:innen, davon 100 in «Team Voll» (Teamgrenze erreicht).
set local session_replication_role = replica;
insert into spieler (id, verein_id, team_id, vorname, nachname, jahrgang)
values (pg_temp.id('g_voll'), pg_temp.id('g'), pg_temp.id('tg'), 'Voll', 'Nr 0', 2012);
insert into spieler (verein_id, team_id, vorname, nachname, jahrgang)
select pg_temp.id('g'), case when i < 100 then pg_temp.id('tg') end, 'Voll', 'Nr ' || i, 2012 from generate_series(1, 997) i;
insert into team_spieler (team_id, spieler_id, verein_id)
select pg_temp.id('tg'), id, pg_temp.id('g') from spieler where team_id = pg_temp.id('tg');
set local session_replication_role = origin;
select pg_temp.pruefe(pg_temp.im_team(pg_temp.id('tg')) = 100, 'Team Voll nicht voll');

select pg_temp.als(pg_temp.id('gverw'));
do $$
declare
  zwei jsonb := '[{"zeile": 1, "vorname": "Grenze", "nachname": "Eins", "jahrgang": 2012},
                  {"zeile": 2, "vorname": "Grenze", "nachname": "Zwei", "jahrgang": 2012},
                  {"zeile": 3, "vorname": "Voll", "nachname": "Nr 0", "jahrgang": 2012, "js": "77"}]';
  drei jsonb := zwei || '[{"zeile": 4, "vorname": "Grenze", "nachname": "Drei", "jahrgang": 2012}]';
  v jsonb;
begin
  -- AK 6: 998 + 3 neue = 1001 → ueber 1; die Übernahme schreibt nichts.
  v := verein_spieler_importieren(pg_temp.id('g'), drei);
  perform pg_temp.pruefe((v ->> 'bestand')::int = 998 and (v ->> 'ueber')::int = 1 and v -> 'neu' = '[1, 2, 4]'
                         and v -> 'js' = jsonb_build_array(jsonb_build_object('zeile', 3, 'alt', null,
                               'teams', jsonb_build_array(pg_temp.team('tg')))), 'AK 6 Vorschau: ' || v::text);
  v := verein_spieler_importieren(pg_temp.id('g'), drei, '{"neu": [1, 2, 4], "js": [{"zeile": 3, "alt": null}], "mehrfach": []}');
  perform pg_temp.pruefe(v = jsonb_build_object('status', 'veraltet', 'grund', 'grenze',
                                                'vorschau', verein_spieler_importieren(pg_temp.id('g'), drei) - 'status'),
                         'AK 6 Übernahme über 1000: ' || v::text);
  perform pg_temp.pruefe(pg_temp.anzahl(pg_temp.id('g')) = 998
                         and pg_temp.js(pg_temp.id('g_voll')) is null,
                         'AK 6: über der Grenze geschrieben');

  -- AK 9 (Grenze inzwischen erreicht): Vorschau mit 2 neuen passt (1000),
  -- dann erfasst die Verwaltung eine weitere.
  v := verein_spieler_importieren(pg_temp.id('g'), zwei);
  perform pg_temp.pruefe((v ->> 'ueber')::int = 0 and v -> 'neu' = '[1, 2]', 'Vorschau mit zwei neuen: ' || v::text);
  perform pg_temp.pruefe(verein_spieler_anlegen(pg_temp.id('g'), 'Dazwischen', 'Erfasst', 2012, null) ->> 'status' = 'angelegt',
                         'Erfassen dazwischen');
  v := verein_spieler_importieren(pg_temp.id('g'), zwei, '{"neu": [1, 2], "js": [{"zeile": 3, "alt": null}], "mehrfach": []}');
  perform pg_temp.pruefe(v ->> 'status' = 'veraltet' and v ->> 'grund' = 'grenze'
                         and (v #>> '{vorschau,ueber}')::int = 1 and (v #>> '{vorschau,bestand}')::int = 999,
                         'AK 9 Grenze inzwischen erreicht: ' || v::text);
  perform pg_temp.pruefe(pg_temp.anzahl(pg_temp.id('g')) = 999
                         and pg_temp.js(pg_temp.id('g_voll')) is null,
                         'AK 9: an der Grenze geschrieben');

  -- Genau 1000 geht; AK 8: J+S in einem vollen Team, keine Teamgrenze.
  v := verein_spieler_importieren(pg_temp.id('g'), zwei - 1);
  perform pg_temp.pruefe((v ->> 'ueber')::int = 0 and v -> 'neu' = '[1]', 'Vorschau bis 1000: ' || v::text);
  perform pg_temp.pruefe(verein_spieler_importieren(pg_temp.id('g'), zwei - 1, '{"neu": [1], "js": [{"zeile": 3, "alt": null}], "mehrfach": []}')
                         = '{"status": "uebernommen", "neu": 1, "js": 1}', 'Übernahme bis genau 1000');
  perform pg_temp.pruefe(pg_temp.anzahl(pg_temp.id('g')) = 1000
                         and pg_temp.js(pg_temp.id('g_voll')) = '77'
                         and pg_temp.im_team(pg_temp.id('tg')) = 100,
                         'AK 8: Grenze oder Team nach der Übernahme falsch');
end $$;
reset role;
-- AK 7: Der Verein hat 1001 (Altbestand); ohne neue geht der Import, mit
-- einer neuen liegt er 2 über der Grenze.
set local session_replication_role = replica;
insert into spieler (verein_id, vorname, nachname, jahrgang) values (pg_temp.id('g'), 'Alt', 'Darüber', 2012);
set local session_replication_role = origin;
select pg_temp.als(pg_temp.id('gverw'));
do $$
declare
  nur_js jsonb := '[{"zeile": 1, "vorname": "Voll", "nachname": "Nr 0", "jahrgang": 2012, "js": "78"}]';
  v jsonb;
begin
  v := verein_spieler_importieren(pg_temp.id('g'), nur_js);
  perform pg_temp.pruefe((v ->> 'bestand')::int = 1001 and (v ->> 'ueber')::int = 0 and v -> 'neu' = '[]',
                         'AK 7 Vorschau: ' || v::text);
  perform pg_temp.pruefe(verein_spieler_importieren(pg_temp.id('g'), nur_js, '{"neu": [], "js": [{"zeile": 1, "alt": "77"}], "mehrfach": []}')
                         = '{"status": "uebernommen", "neu": 0, "js": 1}', 'AK 7 Übernahme über 1000 ohne neue');
  perform pg_temp.pruefe(pg_temp.js(pg_temp.id('g_voll')) = '78', 'AK 7: J+S nicht gesetzt');
  v := verein_spieler_importieren(pg_temp.id('g'),
         nur_js || '[{"zeile": 2, "vorname": "Noch", "nachname": "Eine", "jahrgang": 2012}]'::jsonb);
  perform pg_temp.pruefe((v ->> 'ueber')::int = 2 and v -> 'neu' = '[2]', 'AK 6 über 1000 mit einer neuen: ' || v::text);
end $$;
reset role;

-- ── veraltet wegen des Bestands (AK 9) ──────────────────────────────────────

-- R: r_del, r_ren (ohne Team), r_js (J+S 1), r_js2 (J+S 1), die Altdublette
-- r_alt1/r_alt2.
insert into spieler (id, verein_id, vorname, nachname, jahrgang, js_nummer) values
  (pg_temp.id('r_del'), pg_temp.id('r'), 'Rita', 'Weg', 2013, null),
  (pg_temp.id('r_ren'), pg_temp.id('r'), 'Rolf', 'Alt', 2013, null),
  (pg_temp.id('r_js'), pg_temp.id('r'), 'Rea', 'Nummer', 2013, '1'),
  (pg_temp.id('r_js2'), pg_temp.id('r'), 'Ruth', 'Bleibt', 2013, '1');
set local session_replication_role = replica;
insert into spieler (id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('r_alt1'), pg_temp.id('r'), 'Remo', 'Doppelt', 2013),
  (pg_temp.id('r_alt2'), pg_temp.id('r'), 'Remo', 'Doppelt', 2013);
set local session_replication_role = origin;

-- Je Fall dieselbe Datei: neben der betroffenen Zeile immer eine neue
-- (Zeile 1) und eine J+S-Änderung (Zeile 2), an denen sich zeigt, dass
-- nichts geschrieben wurde.
create function pg_temp.r_datei(p_zeile jsonb) returns jsonb language sql immutable as $$
  select '[{"zeile": 1, "vorname": "Nie", "nachname": "Geschrieben", "jahrgang": 2013},
           {"zeile": 2, "vorname": "Ruth", "nachname": "Bleibt", "jahrgang": 2013, "js": "2"}]'::jsonb
         || jsonb_build_array(p_zeile)
$$;
-- Vorschau, dann p_aenderung (als Verwaltung), dann Übernahme mit der
-- Erwartung aus der Vorschau. Liefert das Ergebnis der Übernahme; prüft, dass
-- nichts geschrieben wurde und die mitgelieferte Vorschau der aktuellen gleicht.
create function pg_temp.veraltet(p_zeile jsonb, p_aenderung text) returns jsonb
language plpgsql as $$
declare
  d jsonb := pg_temp.r_datei(p_zeile);
  v jsonb;
  e jsonb;
  ergebnis jsonb;
begin
  v := verein_spieler_importieren(pg_temp.id('r'), d);
  e := jsonb_build_object('neu', v -> 'neu',
                          'js', (select coalesce(jsonb_agg(jsonb_build_object('zeile', x -> 'zeile', 'alt', x -> 'alt')), '[]'::jsonb)
                                   from jsonb_array_elements(v -> 'js') x),
                          'mehrfach', (select coalesce(jsonb_agg(x -> 'zeile'), '[]'::jsonb) from jsonb_array_elements(v -> 'mehrfach') x));
  execute p_aenderung;
  ergebnis := verein_spieler_importieren(pg_temp.id('r'), d, e);
  perform pg_temp.pruefe(pg_temp.schluessel(ergebnis) = array['grund', 'status', 'vorschau']
                         and ergebnis ->> 'status' = 'veraltet'
                         and ergebnis -> 'vorschau' = verein_spieler_importieren(pg_temp.id('r'), d) - 'status',
                         format('veraltet nach «%s»: %s', p_aenderung, ergebnis));
  perform pg_temp.pruefe(not pg_temp.da(pg_temp.id('r'), 'Geschrieben')
                         and pg_temp.js(pg_temp.id('r_js2')) = '1',
                         format('nach «%s» trotz veraltet geschrieben', p_aenderung));
  return ergebnis;
end $$;

select pg_temp.als(pg_temp.id('rverw'));
do $$
declare
  v jsonb;
begin
  -- Inzwischen erfasst: Zeile 3 war neu und ist jetzt bestehend.
  v := pg_temp.veraltet('{"zeile": 3, "vorname": "Rosa", "nachname": "Spaet", "jahrgang": 2013}',
                        format($s$select verein_spieler_anlegen(%L, 'rosa', 'SPAET', 2013, null)$s$, pg_temp.id('r')));
  perform pg_temp.pruefe(v ->> 'grund' = 'bestand' and v #> '{vorschau,neu}' = '[1]'
                         and v #> '{vorschau,gleich}' = '[{"zeile": 3, "teams": []}]', 'inzwischen erfasst: ' || v::text);
  -- Gelöscht: Zeile 3 war bestehend und ist jetzt neu.
  v := pg_temp.veraltet('{"zeile": 3, "vorname": "Rita", "nachname": "Weg", "jahrgang": 2013}',
                        format('select verein_spieler_entfernen(%L)', pg_temp.id('r_del')));
  perform pg_temp.pruefe(v ->> 'grund' = 'bestand' and v #> '{vorschau,neu}' = '[1, 3]', 'gelöscht: ' || v::text);
  -- Umbenannt: Zeile 3 trifft niemanden mehr.
  v := pg_temp.veraltet('{"zeile": 3, "vorname": "Rolf", "nachname": "Alt", "jahrgang": 2013, "js": "9"}',
                        format($s$select verein_spieler_aendern(%L, 'Rolf', 'Neu', 2013, null)$s$, pg_temp.id('r_ren')));
  perform pg_temp.pruefe(v ->> 'grund' = 'bestand' and v #> '{vorschau,neu}' = '[1, 3]'
                         and v #> '{vorschau,js}' = '[{"zeile": 2, "alt": "1", "teams": []}]', 'umbenannt: ' || v::text);
  -- J+S inzwischen geändert (D1): Die Vorschau nannte bei Zeile 3 die alte
  -- Nummer «1», dazwischen steht «2». Zeile 3 bleibt eine J+S-Änderung, aber
  -- mit anderer alter Nummer: veraltet, «2» wird nicht still überschrieben.
  v := pg_temp.veraltet('{"zeile": 3, "vorname": "Rea", "nachname": "Nummer", "jahrgang": 2013, "js": "3"}',
                        format($s$select verein_spieler_aendern(%L, 'Rea', 'Nummer', 2013, '2')$s$, pg_temp.id('r_js')));
  perform pg_temp.pruefe(v ->> 'grund' = 'bestand'
                         and v #> '{vorschau,js}' = '[{"zeile": 2, "alt": "1", "teams": []}, {"zeile": 3, "alt": "2", "teams": []}]',
                         'J+S inzwischen geändert: ' || v::text);
  perform pg_temp.pruefe(pg_temp.js(pg_temp.id('r_js')) = '2', 'J+S inzwischen geändert: «2» überschrieben');
  -- J+S inzwischen gesetzt: Zeile 3 war eine J+S-Änderung und ist jetzt gleich.
  v := pg_temp.veraltet('{"zeile": 3, "vorname": "Rea", "nachname": "Nummer", "jahrgang": 2013, "js": "9"}',
                        format($s$select verein_spieler_aendern(%L, 'Rea', 'Nummer', 2013, '9')$s$, pg_temp.id('r_js')));
  perform pg_temp.pruefe(v ->> 'grund' = 'bestand' and v #> '{vorschau,gleich}' = '[{"zeile": 3, "teams": []}]',
                         'J+S inzwischen gesetzt: ' || v::text);
  -- Altdublette verschwunden: Zeile 3 war mehrfach und ist jetzt eine J+S-Änderung.
  v := pg_temp.veraltet('{"zeile": 3, "vorname": "Remo", "nachname": "Doppelt", "jahrgang": 2013, "js": "5"}',
                        format('select verein_spieler_entfernen(%L)', pg_temp.id('r_alt2')));
  perform pg_temp.pruefe(v ->> 'grund' = 'bestand' and v #> '{vorschau,mehrfach}' = '[]'
                         and v #> '{vorschau,js}' = '[{"zeile": 2, "alt": "1", "teams": []}, {"zeile": 3, "alt": null, "teams": []}]',
                         'Altdublette verschwunden: ' || v::text);

  -- Eine unbeteiligte Erfassung macht die Vorschau nicht veraltet.
  v := verein_spieler_importieren(pg_temp.id('r'), pg_temp.r_datei('{"zeile": 3, "vorname": "Rea", "nachname": "Nummer", "jahrgang": 2013}'));
  perform pg_temp.pruefe(v -> 'neu' = '[1]' and jsonb_array_length(v -> 'js') = 1, 'Vorschau vor der unbeteiligten Erfassung: ' || v::text);
  perform verein_spieler_anlegen(pg_temp.id('r'), 'Ganz', 'Unbeteiligt', 2014, null);
  -- p_erwartet ohne Listen zählt als leer: mit einer neuen Zeile veraltet.
  perform pg_temp.pruefe(verein_spieler_importieren(pg_temp.id('r'),
                           pg_temp.r_datei('{"zeile": 3, "vorname": "Rea", "nachname": "Nummer", "jahrgang": 2013}'), '{}') ->> 'grund'
                         = 'bestand', 'p_erwartet ohne Listen');
  -- Die frühere Form (js als blosse Zeilennummern) gilt als abweichend (D1).
  perform pg_temp.pruefe(verein_spieler_importieren(pg_temp.id('r'),
                           pg_temp.r_datei('{"zeile": 3, "vorname": "Rea", "nachname": "Nummer", "jahrgang": 2013}'),
                           '{"neu": [1], "js": [2], "mehrfach": []}') ->> 'grund' = 'bestand', 'p_erwartet.js als Zeilennummern');
  perform pg_temp.pruefe(pg_temp.js(pg_temp.id('r_js2')) = '1', 'frühere Form hat geschrieben');
  -- Gegenfall zu D1: Mit der alten Nummer der Vorschau («1») geht die Übernahme
  -- durch, auch nach der unbeteiligten Erfassung.
  perform pg_temp.pruefe(verein_spieler_importieren(pg_temp.id('r'),
                           pg_temp.r_datei('{"zeile": 3, "vorname": "Rea", "nachname": "Nummer", "jahrgang": 2013}'),
                           '{"neu": [1], "js": [{"zeile": 2, "alt": "1"}], "mehrfach": []}') = '{"status": "uebernommen", "neu": 1, "js": 1}',
                         'Übernahme nach unbeteiligter Erfassung');
  perform pg_temp.pruefe(pg_temp.da(pg_temp.id('r'), 'Geschrieben')
                         and pg_temp.js(pg_temp.id('r_js2')) = '2', 'Übernahme in R ohne Wirkung');
end $$;
reset role;

-- ── Alles oder nichts (PC 4) ────────────────────────────────────────────────

select pg_temp.stand(pg_temp.id('r')) as stand_r_vorher \gset
select pg_temp.als(pg_temp.id('rverw'));
do $$
declare
  d jsonb := (select jsonb_agg(jsonb_build_object('zeile', i, 'vorname', 'Ganz', 'nachname', 'Nr ' || i,
                                                  'jahrgang', case when i = 500 then 999 else 2011 end) order by i)
                from generate_series(1, 600) i)
             || '[{"zeile": 601, "vorname": "Ruth", "nachname": "Bleibt", "jahrgang": 2013, "js": "3"}]'::jsonb;
  v jsonb := verein_spieler_importieren(pg_temp.id('r'), d);
begin
  perform pg_temp.pruefe(jsonb_array_length(v -> 'neu') = 600 and jsonb_array_length(v -> 'js') = 1, 'PC 4 Vorschau');
  perform pg_temp.erwarte(format('select verein_spieler_importieren(%L, %L, %L)', pg_temp.id('r'), d,
                                 jsonb_build_object('neu', v -> 'neu', 'js', v -> 'js')), 'spieler_jahrgang');
end $$;
reset role;
select pg_temp.pruefe(pg_temp.stand(pg_temp.id('r')) = :'stand_r_vorher', 'PC 4: ein gescheiterter Import hat Spuren hinterlassen');
-- D3: Der INSERT scheiterte nach set_config; pg_temp.erwarte fing den Fehler
-- in einer Untertransaktion ab. Die Einstellung steht danach nicht mehr auf R,
-- und der Trigger prüft für R wieder auf Dubletten (Ruth Bleibt 2013 gibt es).
select pg_temp.pruefe(coalesce(current_setting('kifu.import_verein', true), '') = '',
                      'Einstellung nach gescheitertem INSERT stehen geblieben: ' || current_setting('kifu.import_verein', true));
select pg_temp.erwarte(format($$insert into spieler (verein_id, vorname, nachname, jahrgang)
                                values (%L, 'RUTH', 'bleibt', 2013)$$, pg_temp.id('r')), 'SPIELER_DOPPELT');

-- ── Leistung (Zettel A2) ────────────────────────────────────────────────────

-- 1000 neue Zeilen eines Jahrgangs in den leeren Verein W2 (eigene Verwaltung)
-- und danach die Vorschau derselben Datei gegen die 1000, mit erzwungen
-- schlechtem Plan: Ohne Indexscans müsste die Dublettenprüfung des Triggers je
-- Zeile alle Vereinszeilen gleichen Jahrgangs neu schlüsseln (quadratisch);
-- der Import bestimmt die Dubletten mengenweise und überspringt sie im Trigger.
insert into ids (name) values ('w2'), ('w2verw');
insert into auth.users (id, email, email_confirmed_at) values (pg_temp.id('w2verw'), 'w2verw@import-verein.test', now());
insert into vereine (id, name) values (pg_temp.id('w2'), 'Leistungs-Verein');
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('w2'), pg_temp.id('w2verw'));
set local enable_indexscan = off;
set local enable_bitmapscan = off;
set local enable_indexonlyscan = off;
select pg_temp.als(pg_temp.id('w2verw'));
do $$
declare
  d jsonb := (select jsonb_agg(jsonb_build_object('zeile', i + 1, 'vorname', 'Kind' || i, 'nachname', 'Leistung',
                                                  'jahrgang', 2016, 'js', (1000000 + i)::text) order by i)
                from generate_series(1, 1000) i);
  t0 timestamptz;
  ms_vorschau numeric;
  ms_uebernahme numeric;
  ms_gegen numeric;
  v jsonb;
begin
  t0 := clock_timestamp();
  v := verein_spieler_importieren(pg_temp.id('w2'), d);
  ms_vorschau := extract(epoch from clock_timestamp() - t0) * 1000;
  t0 := clock_timestamp();
  v := verein_spieler_importieren(pg_temp.id('w2'), d, jsonb_build_object('neu', v -> 'neu'));
  ms_uebernahme := extract(epoch from clock_timestamp() - t0) * 1000;
  perform pg_temp.pruefe(v = '{"status": "uebernommen", "neu": 1000, "js": 0}', 'Leistung: Übernahme ' || v::text);
  t0 := clock_timestamp();
  v := verein_spieler_importieren(pg_temp.id('w2'), d);
  ms_gegen := extract(epoch from clock_timestamp() - t0) * 1000;
  perform pg_temp.pruefe(jsonb_array_length(v -> 'gleich') = 1000 and (v ->> 'bestand')::int = 1000,
                         'Leistung: Vorschau gegen 1000');
  raise notice 'Leistung (ms, ohne Indexscans): Vorschau leer %, Übernahme 1000 %, Vorschau gegen 1000 %',
    round(ms_vorschau), round(ms_uebernahme), round(ms_gegen);
  perform pg_temp.pruefe(ms_uebernahme < 2000, format('Leistung: Übernahme von 1000 dauerte %s ms', round(ms_uebernahme)));
  perform pg_temp.pruefe(ms_gegen < 2000, format('Leistung: Vorschau gegen 1000 dauerte %s ms', round(ms_gegen)));
end $$;
reset role;

rollback;
