-- Verein gründen und löschen (Story 11 #587; Architekturplan Vereine §3.4,
-- §5.1–§5.3, §6.7 Testfälle 20, 21 und 30). Was psql braucht (Bestand unter
-- `replica`, Rollenwechsel wie PostgREST, Funktionstexte); die Rennen
-- (AK 9, 14, Sperrordnung) stehen in rennen.sql.
-- - Gründen (AK 1–4, 7, PC 1, Testfall 21): Konto ohne Verein, Mitglied,
--   Verwaltung, KI-Token, anon, ohne Anmeldung; Bestätigung fehlt; Namen
--   (leer, nur Leerzeichen, 61 Zeichen, Rand, nicht eindeutig); zweimal;
--   danach einzige Verwaltung eines Vereins ohne Team, und andere Vereine
--   nehmen die Person nicht mehr auf (AK 8)
-- - Namensvergleich wie namenStimmen im Web (Leerzeichen am Rand nach JS
--   `trim()`, Unicode-Form zählen nicht, Gross/Klein schon), auch beim
--   Auflösen eines Teams (verein_team_aufloesen); der gespeicherte Name
--   verliert den Rand ebenso, Gründen und Umbenennen speichern ohne ihn
-- - verein_ansicht.personen, abholung_ansicht.verein (PC 2)
-- - Verein löschen (AK 10, 14, 15, PC 3–5, Testfall 20): nur die eigene
--   Verwaltung; falscher Name löscht nichts; danach ist nichts des Vereins
--   mehr da (jede Tabelle einzeln und über den Katalog), persönliche Übungen
--   und Trainings bleiben, alle Personen sind Konten ohne Verein und können
--   gründen oder aufgenommen werden; ein anderer Verein bleibt unberührt;
--   Link, Abos und Abholadresse antworten wie jedes ungültige Geheimnis;
--   Bilder der Team-Trainings kommen zurück
-- - Konto löschen (AK 12–14): frei, letzte Verwaltung, einzige Person ohne,
--   mit falschem und mit richtigem Namen, inzwischen weitere Person;
--   konto_loeschen_info in jedem Fall; Austreten der einzigen Person
-- - Testfall 30: KI-Token gründet, löscht und fragt nicht
-- - Laufzeit: 30 Teams, 1000 Spieler:innen samt Terminen und Trainings,
--   Rolle `authenticated` mit 8 s wie PostgREST, auf nicht analysiertem
--   Bestand (eigene Transaktion am Ende)
-- Beide Transaktionen enden mit rollback; hinterlässt nichts.

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
  if p_ok is not true then raise exception 'Story 11: %', p_text; end if;
end $$;

create function pg_temp.schluessel(p jsonb) returns text[]
language sql immutable as $$ select array(select k from jsonb_object_keys(p) k order by k) $$;

-- Ergebnis oder Fehlermeldung einer Abfrage als Text (für den Vergleich mit
-- einem unbekannten Geheimnis).
create function pg_temp.antwort(p_sql text) returns text
language plpgsql as $$
declare
  r text;
begin
  execute p_sql into r;
  return coalesce(r, '<null>');
exception when others then
  return 'FEHLER ' || sqlstate || ' ' || sqlerrm;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values
  ('verw'), ('verw2'), ('a'), ('b'), ('wverw'), ('c'), ('ohne'), ('ohne2'), ('ohne3'), ('ohne4'),
  ('einzig'), ('einzig2'), ('q'), ('letzt'), ('lm'),
  ('v'), ('w'), ('e'), ('e2'), ('l'),
  ('t1'), ('t2'), ('t3'), ('tw'), ('te'), ('tl'),
  ('s1'), ('s2'), ('s3'), ('sw'), ('se'), ('se2'),
  ('k1'), ('ser1'), ('tr_z'), ('tr_b'), ('sp1'), ('sp_v'), ('tr_w'),
  ('ttr'), ('ttr_w'), ('ttr_e'), ('ptr_a'), ('pe_a'), ('pe_a_pub'), ('g1'), ('te1'), ('te2'), ('fb');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated, anon;   -- temporär; die Rollen brauchen pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@gruenden-loeschen.test', now() from ids
 where name in ('verw', 'verw2', 'a', 'b', 'wverw', 'c', 'ohne', 'ohne2', 'ohne3', 'ohne4',
                'einzig', 'einzig2', 'q', 'letzt', 'lm');
insert into profiles (user_id, display_name) values (pg_temp.id('a'), 'Anna Eins');

-- ── Bestand ─────────────────────────────────────────────────────────────────
-- Verein V «Löschen-Verein»: Verwaltung verw (ohne Team) und verw2 (auch in
-- T1), Mitglieder a (T1) und b (T2), T3 ohne Mitglied. s1 in T1, s2 in T1
-- und T2, s3 ohne Team. Dazu alles, was an Teams und Spieler:innen hängt.
-- Verein W «Anderer Verein» (wverw, c in TW, sw), Verein E «Einzel-Verein»
-- mit einziger Person einzig (Verwaltung und in TE), E2 «Einzel-Zwei» mit
-- einzig2, L «Letzte-Verein» mit letzt (Verwaltung) und lm (in TL).
set local session_replication_role = replica;
insert into vereine (id, name) values
  (pg_temp.id('v'), 'Löschen-Verein'), (pg_temp.id('w'), 'Anderer Verein'), (pg_temp.id('e'), 'Einzel-Verein'),
  (pg_temp.id('e2'), 'Einzel-Zwei'), (pg_temp.id('l'), 'Letzte-Verein');
insert into verein_verwaltung (verein_id, user_id) values
  (pg_temp.id('v'), pg_temp.id('verw')), (pg_temp.id('v'), pg_temp.id('verw2')), (pg_temp.id('w'), pg_temp.id('wverw')),
  (pg_temp.id('e'), pg_temp.id('einzig')), (pg_temp.id('e2'), pg_temp.id('einzig2')), (pg_temp.id('l'), pg_temp.id('letzt'));
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'Team Eins', pg_temp.id('v')), (pg_temp.id('t2'), 'Team Zwei', pg_temp.id('v')),
  (pg_temp.id('t3'), 'Team Leer', pg_temp.id('v')), (pg_temp.id('tw'), 'Team W', pg_temp.id('w')),
  (pg_temp.id('te'), 'Team Einzel', pg_temp.id('e')), (pg_temp.id('tl'), 'Team Letzt', pg_temp.id('l'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t1'), pg_temp.id('verw2')), (pg_temp.id('t2'), pg_temp.id('b')),
  (pg_temp.id('tw'), pg_temp.id('c')), (pg_temp.id('te'), pg_temp.id('einzig')), (pg_temp.id('tl'), pg_temp.id('lm'));
insert into kalender_abos (team_id, user_id) values (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('tw'), pg_temp.id('c'));
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('s1'), pg_temp.id('t1'), pg_temp.id('v'), 'Sara', 'Eins', 2015),
  (pg_temp.id('s2'), pg_temp.id('t1'), pg_temp.id('v'), 'Sina', 'Beide', 2014),
  (pg_temp.id('s3'), null, pg_temp.id('v'), 'Xaver', 'Ohne', 2016),
  (pg_temp.id('sw'), pg_temp.id('tw'), pg_temp.id('w'), 'Wanda', 'Fremd', 2015),
  (pg_temp.id('se'), pg_temp.id('te'), pg_temp.id('e'), 'Emil', 'Einzel', 2015),
  (pg_temp.id('se2'), null, pg_temp.id('e'), 'Erna', 'Ohne', 2015);
insert into team_spieler (team_id, spieler_id, verein_id) values
  (pg_temp.id('t1'), pg_temp.id('s1'), pg_temp.id('v')), (pg_temp.id('t1'), pg_temp.id('s2'), pg_temp.id('v')),
  (pg_temp.id('t2'), pg_temp.id('s2'), pg_temp.id('v')), (pg_temp.id('tw'), pg_temp.id('sw'), pg_temp.id('w')),
  (pg_temp.id('te'), pg_temp.id('se'), pg_temp.id('e'));
insert into spieler_abos (spieler_id) values (pg_temp.id('s1')), (pg_temp.id('s3')), (pg_temp.id('sw')), (pg_temp.id('se'));
-- Benachrichtigungen (#642) ohne FK: Der Trigger beim Löschen der Spieler:innen räumt sie ab.
insert into spieler_benachrichtigungen (spieler_id, vorgang, ereignis, termin_id, inhalt) values
  (pg_temp.id('s1'), gen_random_uuid(), 'neues_spiel', pg_temp.id('sp1'), '{}'),
  (pg_temp.id('s3'), gen_random_uuid(), 'neues_spiel', null, '{}'),
  (pg_temp.id('sw'), gen_random_uuid(), 'neues_spiel', pg_temp.id('tr_w'), '{}');
insert into team_abholung (team_id, aktiv) values (pg_temp.id('t1'), true), (pg_temp.id('t2'), false), (pg_temp.id('tw'), true),
  (pg_temp.id('te'), true);
insert into team_probetraining (team_id, anzahl, info) values (pg_temp.id('t1'), 3, 'Schienbeinschoner');
insert into kader (id, team_id, name) values (pg_temp.id('k1'), pg_temp.id('t1'), 'Kader Eins');
insert into kader_spieler (kader_id, spieler_id, team_id) values (pg_temp.id('k1'), pg_temp.id('s2'), pg_temp.id('t1'));
insert into termin_serien (id, team_id, wochentage, beginn_datum, end_datum, beginn, ende) values
  (pg_temp.id('ser1'), pg_temp.id('t1'), array[extract(isodow from current_date + 14)::smallint], current_date + 7,
   current_date + 21, '18:00', '19:30');
insert into termin_serien_kader (serie_id, kader_id, team_id) values (pg_temp.id('ser1'), pg_temp.id('k1'), pg_temp.id('t1'));
insert into termin_serien_trainer (serie_id, user_id) values (pg_temp.id('ser1'), pg_temp.id('a'));
insert into termin_serien_verantwortliche (serie_id, user_id) values (pg_temp.id('ser1'), pg_temp.id('a'));
insert into termin_serien_luecken (serie_id, tag) values (pg_temp.id('ser1'), current_date + 7);
insert into training_termine (id, team_id, serie_id, serien_tag, datum, beginn, ende) values
  (pg_temp.id('tr_z'), pg_temp.id('t1'), pg_temp.id('ser1'), current_date + 14, current_date + 14, '18:00', '19:30'),
  (pg_temp.id('tr_b'), pg_temp.id('t1'), null, null, current_date - 7, '18:00', '19:30'),
  (pg_temp.id('tr_w'), pg_temp.id('tw'), null, null, current_date + 7, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (pg_temp.id('sp1'), pg_temp.id('t1'), current_date + 9, '10:00', '12:00', 'spiel', 'Match'),
  (pg_temp.id('sp_v'), pg_temp.id('t2'), current_date - 9, '10:00', '12:00', 'spiel', 'Match vorbei');
insert into termin_trainer (termin_id, user_id) values (pg_temp.id('tr_z'), pg_temp.id('a'));
insert into termin_trainer_stand (termin_id) values (pg_temp.id('tr_z'));
insert into termin_verantwortliche (termin_id, user_id) values (pg_temp.id('tr_z'), pg_temp.id('a'));
insert into termin_kader (termin_id, kader_id, team_id) values (pg_temp.id('tr_z'), pg_temp.id('k1'), pg_temp.id('t1'));
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (pg_temp.id('tr_z'), pg_temp.id('s1'), pg_temp.id('t1'), false), (pg_temp.id('tr_w'), pg_temp.id('sw'), pg_temp.id('tw'), false);
insert into termin_statuswechsel (termin_id, spieler_id, team_id) values (pg_temp.id('tr_z'), pg_temp.id('s2'), pg_temp.id('t1'));
insert into termin_eingefroren (termin_id, team_id, mit_liste) values
  (pg_temp.id('tr_b'), pg_temp.id('t1'), true), (pg_temp.id('sp_v'), pg_temp.id('t2'), true);
insert into termin_teilnahmen (termin_id, team_id, spieler_id) values (pg_temp.id('tr_b'), pg_temp.id('t1'), pg_temp.id('s1'));
insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, gewechselt_am) values
  (pg_temp.id('sp_v'), pg_temp.id('t2'), pg_temp.id('s2'), 'angemeldet', now());
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am) values
  (pg_temp.id('sp1'), pg_temp.id('s2'), pg_temp.id('t1'), 'abgemeldet', now());
insert into spiel_treffpunkte (termin_id, team_id, anreise, vorlauf_min) values (pg_temp.id('sp1'), pg_temp.id('t1'), 'vor_ort', 30);
insert into feedback (id, einordnung, rolle, titel, zusammenfassung, verlauf, seite, version, umgebung, geraet, team_id) values
  (pg_temp.id('fb'), 'frage', 'trainer', 'Frage', '[]', '[]', '/teams', '1.0', 'test', 'psql', pg_temp.id('t1'));
set local session_replication_role = origin;

-- Trainings: je ein Team-Training in T1, TW und TE (mit Bild), ein
-- persönliches Training und zwei Übungen von a (eine mit Bild, eine
-- öffentlich), ein Favorit von a. Mit Triggern (erste Variante).
insert into trainings (id, name, team_id, visibility, altersstufe, stufen) values
  (pg_temp.id('ttr'), 'Team-Training Eins', pg_temp.id('t1'), 'private', 'kinderfussball', array['F']),
  (pg_temp.id('ttr_w'), 'Team-Training W', pg_temp.id('tw'), 'private', 'kinderfussball', array['F']),
  (pg_temp.id('ttr_e'), 'Team-Training Einzel', pg_temp.id('te'), 'private', 'kinderfussball', array['F']);
insert into trainings (id, name, owner_id, visibility, altersstufe, stufen) values
  (pg_temp.id('ptr_a'), 'Persönlich A', pg_temp.id('a'), 'private', 'kinderfussball', array['F']);
insert into training_exercises (id, training_id, trainingsteil, position, name, altersstufe, aufbau, bild_url) values
  (pg_temp.id('te1'), pg_temp.id('ttr'), 'ausklang', 1, 'Mit Bild', 'kinderfussball', 'Aufbau', 'https://bild.test/t1.webp'),
  (pg_temp.id('te2'), pg_temp.id('ttr'), 'ausklang', 2, 'Ohne Bild', 'kinderfussball', 'Aufbau', null);
insert into training_exercises (training_id, trainingsteil, position, name, altersstufe, aufbau, bild_url) values
  (pg_temp.id('ttr_w'), 'ausklang', 1, 'W', 'kinderfussball', 'Aufbau', 'https://bild.test/w.webp'),
  (pg_temp.id('ttr_e'), 'ausklang', 1, 'E', 'kinderfussball', 'Aufbau', 'https://bild.test/e.webp'),
  (pg_temp.id('ptr_a'), 'ausklang', 1, 'P', 'kinderfussball', 'Aufbau', 'https://bild.test/pa.webp');
insert into exercises (id, slug, name, trainingsteil, aufbau, source, owner_id, visibility, bild_url) values
  (pg_temp.id('pe_a'), 'gruenden-loeschen-a', 'Übung A', 'ausklang', 'Aufbau', 'user', pg_temp.id('a'), 'private',
   'https://bild.test/ea.webp'),
  (pg_temp.id('pe_a_pub'), 'gruenden-loeschen-a-pub', 'Übung A öffentlich', 'ausklang', 'Aufbau', 'user', pg_temp.id('a'),
   'public', null);
insert into exercise_favorites (user_id, exercise_id) values (pg_temp.id('a'), pg_temp.id('pe_a'));
set local session_replication_role = replica;
insert into training_gruppen (id, training_id, name, position) values (pg_temp.id('g1'), pg_temp.id('ttr'), 'Gruppe', 1);
insert into training_exercise_gruppen (training_exercise_id, gruppe_id, position) values (pg_temp.id('te1'), pg_temp.id('g1'), 1);
update training_termine set training_id = pg_temp.id('ttr') where id = pg_temp.id('tr_z');
set local session_replication_role = origin;

-- Bezüge je Verein, vor dem Löschen festgehalten.
create temp table bez (art text, verein uuid, id uuid);
insert into bez select 'verein', id, id from vereine where id in (pg_temp.id('v'), pg_temp.id('w'), pg_temp.id('e'));
insert into bez select 'team', verein_id, id from teams where verein_id in (select verein from bez);
insert into bez select 'spieler', verein_id, id from spieler where verein_id in (select verein from bez where art = 'verein');
insert into bez select 'termin', b.verein, t.id from training_termine t join bez b on b.art = 'team' and b.id = t.team_id;
insert into bez select 'serie', b.verein, s.id from termin_serien s join bez b on b.art = 'team' and b.id = s.team_id;
insert into bez select 'training', b.verein, t.id from trainings t join bez b on b.art = 'team' and b.id = t.team_id;
insert into bez select 'kader', b.verein, k.id from kader k join bez b on b.art = 'team' and b.id = k.team_id;
insert into bez select 'te', b.verein, x.id from training_exercises x join bez b on b.art = 'training' and b.id = x.training_id;
insert into bez select 'gruppe', b.verein, x.id from training_gruppen x join bez b on b.art = 'training' and b.id = x.training_id;
insert into bez select 'variante', b.verein, x.id from training_varianten x join bez b on b.art = 'training' and b.id = x.training_id;
create function pg_temp.b(p_art text, p_verein uuid) returns uuid[]
language sql stable as $$ select coalesce(array_agg(id), '{}') from bez where art = p_art and verein = p_verein $$;

-- Zeilen je Tabelle, die am Verein hängen (ausdrücklich, Erkundung §3).
create function pg_temp.zaehlung(p uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'vereine', (select count(*) from vereine where id = p),
    'verein_verwaltung', (select count(*) from verein_verwaltung where verein_id = p),
    'teams', (select count(*) from teams where id = any(pg_temp.b('team', p))),
    'team_members', (select count(*) from team_members where team_id = any(pg_temp.b('team', p))),
    'kalender_abos', (select count(*) from kalender_abos where team_id = any(pg_temp.b('team', p))),
    'team_spieler', (select count(*) from team_spieler where team_id = any(pg_temp.b('team', p))
                                                          or spieler_id = any(pg_temp.b('spieler', p))),
    'spieler', (select count(*) from spieler where id = any(pg_temp.b('spieler', p))),
    'spieler_abos', (select count(*) from spieler_abos where spieler_id = any(pg_temp.b('spieler', p))),
    'spieler_benachrichtigungen', (select count(*) from spieler_benachrichtigungen where spieler_id = any(pg_temp.b('spieler', p))),
    'team_abholung', (select count(*) from team_abholung where team_id = any(pg_temp.b('team', p))),
    'team_probetraining', (select count(*) from team_probetraining where team_id = any(pg_temp.b('team', p))),
    'kader', (select count(*) from kader where id = any(pg_temp.b('kader', p))),
    'kader_spieler', (select count(*) from kader_spieler where kader_id = any(pg_temp.b('kader', p))),
    'termin_serien', (select count(*) from termin_serien where id = any(pg_temp.b('serie', p))),
    'termin_serien_kader', (select count(*) from termin_serien_kader where serie_id = any(pg_temp.b('serie', p))),
    'termin_serien_trainer', (select count(*) from termin_serien_trainer where serie_id = any(pg_temp.b('serie', p))),
    'termin_serien_verantwortliche', (select count(*) from termin_serien_verantwortliche where serie_id = any(pg_temp.b('serie', p))),
    'termin_serien_luecken', (select count(*) from termin_serien_luecken where serie_id = any(pg_temp.b('serie', p))),
    'training_termine', (select count(*) from training_termine where id = any(pg_temp.b('termin', p))),
    'termin_trainer', (select count(*) from termin_trainer where termin_id = any(pg_temp.b('termin', p))),
    'termin_trainer_stand', (select count(*) from termin_trainer_stand where termin_id = any(pg_temp.b('termin', p))),
    'termin_verantwortliche', (select count(*) from termin_verantwortliche where termin_id = any(pg_temp.b('termin', p))),
    'termin_kader', (select count(*) from termin_kader where termin_id = any(pg_temp.b('termin', p))),
    'termin_abmeldungen', (select count(*) from termin_abmeldungen where termin_id = any(pg_temp.b('termin', p))),
    'termin_statuswechsel', (select count(*) from termin_statuswechsel where termin_id = any(pg_temp.b('termin', p))),
    'termin_eingefroren', (select count(*) from termin_eingefroren where termin_id = any(pg_temp.b('termin', p))),
    'termin_teilnahmen', (select count(*) from termin_teilnahmen where termin_id = any(pg_temp.b('termin', p))),
    'spiel_teilnahmen', (select count(*) from spiel_teilnahmen where termin_id = any(pg_temp.b('termin', p))),
    'spiel_meldungen', (select count(*) from spiel_meldungen where termin_id = any(pg_temp.b('termin', p))),
    'spiel_treffpunkte', (select count(*) from spiel_treffpunkte where termin_id = any(pg_temp.b('termin', p))),
    'trainings', (select count(*) from trainings where id = any(pg_temp.b('training', p))),
    'training_varianten', (select count(*) from training_varianten where id = any(pg_temp.b('variante', p))),
    'training_exercises', (select count(*) from training_exercises where id = any(pg_temp.b('te', p))),
    'training_gruppen', (select count(*) from training_gruppen where id = any(pg_temp.b('gruppe', p))),
    'training_exercise_gruppen', (select count(*) from training_exercise_gruppen where gruppe_id = any(pg_temp.b('gruppe', p))),
    'feedback_mit_team', (select count(*) from feedback where team_id = any(pg_temp.b('team', p))));
$$;

-- Über den Katalog: jede Spalte in `public`, die nach ihrem Namen auf einen
-- Bezug des Vereins zeigt, dazu die Schlüssel der Grundtabellen. Fängt auch
-- Tabellen, die nach dieser Story dazukommen. Liefert die Treffer.
create function pg_temp.reste(p uuid) returns text
language plpgsql as $$
declare
  r record;
  n bigint;
  treffer text := '';
begin
  for r in
    select c.table_name, c.column_name, m.art
      from information_schema.columns c
      join (values ('verein_id', 'verein'), ('team_id', 'team'), ('spieler_id', 'spieler'), ('termin_id', 'termin'),
                   ('serie_id', 'serie'), ('training_id', 'training'), ('kader_id', 'kader'),
                   ('training_exercise_id', 'te'), ('gruppe_id', 'gruppe'), ('variante_id', 'variante')) m(spalte, art)
        on m.spalte = c.column_name
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
                                      and t.table_type = 'BASE TABLE'
     where c.table_schema = 'public'
    union all
    select x.tab, 'id', x.art
      from (values ('vereine', 'verein'), ('teams', 'team'), ('spieler', 'spieler'), ('training_termine', 'termin'),
                   ('termin_serien', 'serie'), ('trainings', 'training'), ('kader', 'kader'),
                   ('training_exercises', 'te'), ('training_gruppen', 'gruppe'), ('training_varianten', 'variante')) x(tab, art)
  loop
    execute format('select count(*) from public.%I where %I = any($1)', r.table_name, r.column_name)
      into n using pg_temp.b(r.art, p);
    if n > 0 then treffer := treffer || format('%s.%s=%s ', r.table_name, r.column_name, n); end if;
  end loop;
  return nullif(treffer, '');
end $$;

-- Persönliches der Personen (darf sich durch das Löschen nicht ändern).
create function pg_temp.persoenlich() returns text
language sql stable as $$
  select md5(coalesce((select string_agg(e::text, '|' order by e.id) from exercises e
                        where e.owner_id in (select id from ids)), '')
          || coalesce((select string_agg(t::text, '|' order by t.id) from trainings t
                        where t.owner_id in (select id from ids)), '')
          || coalesce((select string_agg(x::text, '|' order by x.id) from training_exercises x
                        join trainings t on t.id = x.training_id where t.owner_id in (select id from ids)), '')
          || coalesce((select string_agg(f::text, '|' order by f.exercise_id) from exercise_favorites f
                        where f.user_id in (select id from ids)), '')
          || coalesce((select string_agg(p::text, '|' order by p.user_id) from profiles p
                        where p.user_id in (select id from ids)), ''));
$$;

do $$
declare
  z jsonb := pg_temp.zaehlung(pg_temp.id('v'));
  k text;
begin
  -- Der Bestand deckt jede Tabelle der Liste ab, sonst prüfte das Löschen sie still nicht.
  for k in select jsonb_object_keys(z) loop
    perform pg_temp.pruefe((z ->> k)::int > 0, 'Bestand von V ohne Zeilen in ' || k);
  end loop;
end $$;

-- Geheimnisse vor dem Löschen (PC 5).
create temp table tok (art text primary key, token text not null);
insert into tok values
  ('link_team', (select link_token from spieler where id = pg_temp.id('s1'))),
  ('link_ohne', (select link_token from spieler where id = pg_temp.id('s3'))),
  ('abo_spieler', (select token from spieler_abos where spieler_id = pg_temp.id('s1'))),
  ('abo_ohne', (select token from spieler_abos where spieler_id = pg_temp.id('s3'))),
  ('abo_kalender', (select token from kalender_abos where team_id = pg_temp.id('t1'))),
  ('abholung', (select token from team_abholung where team_id = pg_temp.id('t1'))),
  ('abholung_inaktiv', (select token from team_abholung where team_id = pg_temp.id('t2'))),
  ('unbekannt_link', encode(sha256('unbekannt'::bytea), 'hex')),
  ('unbekannt', 'x' || md5('unbekannt'));
grant select on tok to anon;
create function pg_temp.t(p text) returns text language sql stable as $$ select token from tok where art = p $$;

-- ── Rechte und Signaturen ───────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array['verein_gruenden(text,boolean)', 'verein_loeschen(uuid,text)', 'delete_account(text)',
                           'konto_loeschen_info()'] loop
    perform pg_temp.pruefe(to_regprocedure(f) is not null, f || ' fehlt');
    perform pg_temp.pruefe(not has_function_privilege('anon', f, 'execute')
                           and has_function_privilege('authenticated', f, 'execute'), 'Grant von ' || f);
    perform pg_temp.pruefe((select prosecdef from pg_proc where oid = f::regprocedure), f || ' nicht security definer');
  end loop;
  -- Die alte Fassung ohne Argument ist weg (sonst PGRST203 bei Aufruf ohne Argument).
  perform pg_temp.pruefe(to_regprocedure('delete_account()') is null, 'delete_account() besteht noch');
  perform pg_temp.pruefe((select count(*) from pg_proc where proname = 'delete_account'
                            and pronamespace = 'public'::regnamespace) = 1, 'mehr als eine delete_account');
  foreach f in array array['verein_loeschen_kern(uuid)', 'namen_stimmen(text,text)', 'namen_ohne_rand(text)',
                           'verein_personenzahl(uuid)', 'konto_loeschen_fall(uuid,uuid)'] loop
    perform pg_temp.pruefe(to_regprocedure(f) is not null, f || ' fehlt');
    perform pg_temp.pruefe(not has_function_privilege('anon', f, 'execute')
                           and not has_function_privilege('authenticated', f, 'execute'), f || ' hat API-Recht');
  end loop;
  -- abholung_ansicht behält das Recht für anon.
  perform pg_temp.pruefe(has_function_privilege('anon', 'abholung_ansicht(text)', 'execute'), 'abholung_ansicht ohne anon');
end $$;
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.erwarte(format('select verein_loeschen_kern(%L)', pg_temp.id('v')), '42501');
reset role;
set local role anon;
select pg_temp.erwarte($$select verein_gruenden('Anon', true)$$, '42501');
select pg_temp.erwarte(format('select verein_loeschen(%L, %L)', pg_temp.id('v'), 'Löschen-Verein'), '42501');
select pg_temp.erwarte('select konto_loeschen_info()', '42501');
select pg_temp.erwarte('select delete_account()', '42501');
reset role;
-- Ohne Anmeldung (Rolle authenticated ohne sub).
select set_config('request.jwt.claims', '{"role": "authenticated"}', true) is not null as ohne_sub \gset
set local role authenticated;
select pg_temp.erwarte($$select verein_gruenden('Niemand', true)$$, 'not authenticated');
select pg_temp.erwarte('select konto_loeschen_info()', 'not authenticated');
select pg_temp.erwarte('select delete_account()', 'not authenticated');
reset role;

-- ── Namensvergleich wie namenStimmen (web/components/ui/NamenBestaetigen.tsx) ──

do $$
begin
  -- Rand nach JS trim(): WhiteSpace und LineTerminator.
  perform pg_temp.pruefe(namen_stimmen(U&' \0009\000A\000B\000C\000D\00A0\1680\2000\200A\2028\2029\202F\205F\3000\FEFFFC Blau'
                                        || U&'\0020\00A0\FEFF\000A', 'FC Blau'), 'JS-Leerzeichen am Rand');
  perform pg_temp.pruefe(namen_stimmen('  FC Blau  ', 'FC Blau'), 'Leerzeichen am Rand');
  -- Unicode-Form zählt nicht (NFD gegen NFC, in beide Richtungen).
  perform pg_temp.pruefe(namen_stimmen(U&'Lo\0308schen', U&'L\00F6schen'), 'NFD gegen NFC');
  perform pg_temp.pruefe(namen_stimmen(U&'L\00F6schen', U&'Lo\0308schen'), 'NFC gegen NFD');
  -- Gross/Klein, Zeichen innen und Zeichen, die JS nicht trimmt, zählen.
  perform pg_temp.pruefe(not namen_stimmen('fc blau', 'FC Blau'), 'Gross/Klein');
  perform pg_temp.pruefe(not namen_stimmen('FC  Blau', 'FC Blau'), 'Leerzeichen innen');
  perform pg_temp.pruefe(not namen_stimmen(U&'\200BFC Blau', 'FC Blau'), 'U+200B ist kein Leerzeichen für JS');
  perform pg_temp.pruefe(not namen_stimmen(U&'FC Blau\0085', 'FC Blau'), 'U+0085 ist kein Leerzeichen für JS');
  perform pg_temp.pruefe(not namen_stimmen('', 'FC Blau') and not namen_stimmen('   ', 'FC Blau'), 'leer');
  perform pg_temp.pruefe(namen_stimmen(null, 'FC Blau') is false and namen_stimmen('FC Blau', null) is false, 'null');
  -- Der gespeicherte Name verliert den Rand ebenso (Bestand, direkter Aufruf).
  perform pg_temp.pruefe(namen_stimmen('Klub', U&'Klub\00A0') and namen_stimmen(U&' Klub\FEFF', U&'\0009Klub\3000'),
                         'Rand am gespeicherten Namen');
  perform pg_temp.pruefe(not namen_stimmen('klub', U&'Klub\00A0'), 'Rand am gespeicherten Namen, Gross/Klein');
  -- Ein Name nur aus Unicode-Rand (teams_name_check lässt ihn zu) stimmt nie, auch nicht mit leerer Eingabe.
  perform pg_temp.pruefe(not namen_stimmen('', U&'\00A0') and not namen_stimmen(U&'\00A0', U&'\3000\00A0')
                         and not namen_stimmen('', ''), 'Name nur aus Rand');
  perform pg_temp.pruefe(namen_ohne_rand(U&'\00A0FC Rand\FEFF\0009') = 'FC Rand' and namen_ohne_rand(null) is null,
                         'namen_ohne_rand');
end $$;

-- Team auflösen vergleicht den Teamnamen ebenso (verein_team_aufloesen,
-- Story 5): Tabulator und geschütztes Leerzeichen am Rand zählen nicht mehr,
-- Gross/Klein schon. Im Unterblock, der zurückrollt: T3 bleibt für später.
select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  r jsonb;
begin
  begin
    r := verein_team_aufloesen(pg_temp.id('t3'), 'team leer');
    perform pg_temp.pruefe(r = jsonb_build_object('status', 'name_falsch', 'name', 'Team Leer'), 'Teamname Gross/Klein: ' || r::text);
    r := verein_team_aufloesen(pg_temp.id('t3'), null);
    perform pg_temp.pruefe(r ->> 'status' = 'name_falsch', 'Teamname null: ' || r::text);
    r := verein_team_aufloesen(pg_temp.id('t3'), U&'\0009Team Leer\00A0\000A');
    perform pg_temp.pruefe(r ->> 'status' = 'aufgeloest' and r ->> 'name' = 'Team Leer', 'Teamname mit JS-Rand: ' || r::text);
    perform pg_temp.pruefe(not (verein_ansicht(pg_temp.id('v')) -> 'teams') @> jsonb_build_array(jsonb_build_object('id', pg_temp.id('t3'))),
                           'T3 aufgelöst');
    raise exception 'ZURUECK';
  exception when raise_exception then
    if sqlerrm <> 'ZURUECK' then raise; end if;
  end;
end $$;
reset role;
select pg_temp.pruefe(exists (select 1 from teams where id = pg_temp.id('t3')), 'T3 wieder da');

-- Ein Teamname nur aus Unicode-Rand (Bestand, teams_name_check prüft nur
-- btrim) lässt sich weder mit leerer Eingabe noch mit dem Rand selbst
-- bestätigen; das Team bleibt.
update teams set name = U&'\00A0' where id = pg_temp.id('t3');
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_team_aufloesen(pg_temp.id('t3'), '') ->> 'status' = 'name_falsch', 'Teamname nur Rand, Eingabe leer');
select pg_temp.pruefe(verein_team_aufloesen(pg_temp.id('t3'), U&'\00A0') ->> 'status' = 'name_falsch', 'Teamname nur Rand, Eingabe Rand');
reset role;
select pg_temp.pruefe(exists (select 1 from teams where id = pg_temp.id('t3')), 'T3 mit Namen nur aus Rand bleibt');
update teams set name = 'Team Leer' where id = pg_temp.id('t3');

-- ── verein_ansicht.personen, abholung_ansicht.verein ───────────────────────

select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  v jsonb := verein_ansicht(pg_temp.id('v'));
begin
  -- verw, verw2 (Verwaltung und Team), a, b: vier verschiedene Konten.
  perform pg_temp.pruefe(pg_temp.schluessel(v) = array['name', 'personen', 'spieler_ohne_team', 'spieler_zahl', 'teams', 'verwaltung'],
                         'Ansicht Verwaltung: Schlüssel ' || pg_temp.schluessel(v)::text);
  perform pg_temp.pruefe(v -> 'personen' = '4', 'personen: ' || (v -> 'personen')::text);
  -- AK 11: Zahlen vor dem Löschen (Teams, Spieler:innen samt ohne Team).
  perform pg_temp.pruefe(jsonb_array_length(v -> 'teams') = 3 and v -> 'spieler_zahl' = '3' and v -> 'spieler_ohne_team' = '1',
                         'Zahlen vor dem Löschen');
end $$;
reset role;
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(pg_temp.schluessel(verein_ansicht(pg_temp.id('v'))) = array['name', 'teams', 'verwaltung'],
                      'Mitglied sieht personen');
reset role;
select pg_temp.als(pg_temp.id('einzig'));
select pg_temp.pruefe(verein_ansicht(pg_temp.id('e')) -> 'personen' = '1', 'personen der einzigen Person');
reset role;

set local role anon;
select pg_temp.pruefe(abholung_ansicht(pg_temp.t('abholung'))
                      = '{"gueltig": true, "team": "Team Eins", "verein": "Löschen-Verein"}', 'Abholseite nennt den Verein');
select pg_temp.pruefe(abholung_ansicht(pg_temp.t('abholung_inaktiv')) = '{"gueltig": false}',
                      'inaktive Abholadresse');
select pg_temp.pruefe(abholung_ansicht('unbekannt') = '{"gueltig": false}', 'unbekannte Abholadresse');
select pg_temp.pruefe(spieler_link_ansicht(pg_temp.t('link_ohne')) ->> 'verein'
                      = 'Löschen-Verein', 'Link nennt den Verein');
reset role;

-- ── konto_loeschen_info (AK 12, 13) ─────────────────────────────────────────

do $$
declare
  r record;
  i jsonb;
begin
  for r in select * from (values
      ('a', '{"fall": "frei", "verein": null, "teams": 0, "spieler": 0}'),          -- nur Mitglied
      ('verw', '{"fall": "frei", "verein": null, "teams": 0, "spieler": 0}'),       -- weitere Verwaltung
      ('ohne', '{"fall": "frei", "verein": null, "teams": 0, "spieler": 0}'),       -- ohne Verein
      ('letzt', '{"fall": "letzte_verwaltung", "verein": "Letzte-Verein", "teams": 0, "spieler": 0}'),
      ('einzig', '{"fall": "einzige_person", "verein": "Einzel-Verein", "teams": 1, "spieler": 2}'),
      ('einzig2', '{"fall": "einzige_person", "verein": "Einzel-Zwei", "teams": 0, "spieler": 0}')) x(wer, erwartet) loop
    perform pg_temp.als(pg_temp.id(r.wer));
    i := konto_loeschen_info();
    perform set_config('role', 'postgres', true);
    perform pg_temp.pruefe(i = r.erwartet::jsonb, format('konto_loeschen_info %s: %s', r.wer, i));
  end loop;
end $$;
reset role;

-- ── Gründen (AK 1–4, 7, PC 1, Testfall 21) ──────────────────────────────────

select count(*) as vereine_vorher from vereine \gset
select pg_temp.als(pg_temp.id('ohne'));
select pg_temp.erwarte($$select verein_gruenden('FC Neu', false)$$, 'BESTAETIGUNG_FEHLT');
select pg_temp.erwarte($$select verein_gruenden('FC Neu', null)$$, 'BESTAETIGUNG_FEHLT');
-- Namen (AK 2): leer, nur Leerzeichen, null, 61 Zeichen → CHECK verein_name.
select pg_temp.erwarte($$select verein_gruenden('', true)$$, '23514');
select pg_temp.erwarte($$select verein_gruenden('   ', true)$$, '23514');
select pg_temp.erwarte($$select verein_gruenden(null, true)$$, '23514');
select pg_temp.erwarte($$select verein_gruenden(U&'\00A0\3000\FEFF', true)$$, '23514');
select pg_temp.erwarte($$select verein_gruenden(U&'\00A0\3000\FEFF', true)$$, 'verein_name');
select pg_temp.erwarte(format('select verein_gruenden(%L, true)', repeat('x', 61)), '23514');
select pg_temp.erwarte(format('select verein_gruenden(%L, true)', repeat('x', 61)), 'verein_name');
reset role;
select pg_temp.pruefe((select count(*) from vereine) = :vereine_vorher, 'abgewiesenes Gründen hinterlässt einen Verein');

-- Testfall 30: KI-Token gründet nicht; dieselben Claims ohne client_id schon.
select pg_temp.als(pg_temp.id('ohne'), '{"client_id": "ki-client"}');
select pg_temp.erwarte($$select verein_gruenden('FC KI', true)$$, 'NUR_IN_DER_ANWENDUNG');
reset role;
select pg_temp.pruefe((select count(*) from vereine) = :vereine_vorher, 'KI-Token hat gegründet');

-- Mitglied, Verwaltung ohne Team, Verwaltung mit Team, einzige Person: SCHON_IM_VEREIN (AK 4, 7).
do $$
declare
  wer text;
begin
  foreach wer in array array['a', 'verw', 'verw2', 'einzig', 'lm'] loop
    perform pg_temp.als(pg_temp.id(wer));
    perform pg_temp.erwarte($q$select verein_gruenden('FC Zweit', true)$q$, 'SCHON_IM_VEREIN');
    perform set_config('role', 'postgres', true);
  end loop;
end $$;
reset role;
select pg_temp.pruefe((select count(*) from vereine) = :vereine_vorher, 'Mitglied hat gegründet');

select pg_temp.als(pg_temp.id('ohne'));
select verein_gruenden('  FC Neu  ', true) as gegruendet \gset
reset role;
select pg_temp.pruefe(pg_temp.schluessel(:'gegruendet'::jsonb) = array['id', 'name', 'status']
                      and :'gegruendet'::jsonb ->> 'status' = 'gegruendet' and :'gegruendet'::jsonb ->> 'name' = 'FC Neu',
                      'Rückgabe Gründen: ' || :'gegruendet');
select (:'gegruendet'::jsonb ->> 'id')::uuid as neu_id \gset
-- PC 1: einzige Verwaltung des neuen Vereins, kein Team; der Name ohne Rand.
select pg_temp.pruefe((select name from vereine where id = :'neu_id') = 'FC Neu', 'Name gespeichert');
select pg_temp.pruefe((select array_agg(user_id) from verein_verwaltung where verein_id = :'neu_id') = array[pg_temp.id('ohne')],
                      'Verwaltung des neuen Vereins');
select pg_temp.pruefe(not exists (select 1 from teams where verein_id = :'neu_id'), 'neuer Verein hat ein Team');
select pg_temp.pruefe(person_verein(pg_temp.id('ohne')) = :'neu_id', 'person_verein nach dem Gründen');
select pg_temp.als(pg_temp.id('ohne'));
select pg_temp.pruefe(meine_vereinslage() -> 'verein' @> '{"name": "FC Neu", "ist_verwaltung": true, "ist_teammitglied": false}',
                      'meine_vereinslage nach dem Gründen');
select pg_temp.pruefe(konto_loeschen_info() = '{"fall": "einzige_person", "verein": "FC Neu", "teams": 0, "spieler": 0}',
                      'konto_loeschen_info nach dem Gründen');
-- Zweimal gründen (AK 7).
select pg_temp.erwarte($$select verein_gruenden('FC Neu Zwei', true)$$, 'SCHON_IM_VEREIN');
-- Austreten geht auch als einzige Person nicht (AK 13).
select pg_temp.pruefe(verein_verwaltung_entfernen(:'neu_id', pg_temp.id('ohne')) = '{"status": "letzte_verwaltung"}',
                      'einzige Person tritt aus');
reset role;

-- 60 Zeichen und ein Name, den es schon gibt (Precondition 4), gehen.
select pg_temp.als(pg_temp.id('ohne2'));
select pg_temp.pruefe(verein_gruenden(repeat('y', 60), true) ->> 'name' = repeat('y', 60), '60 Zeichen');
reset role;
select pg_temp.als(pg_temp.id('ohne3'));
select pg_temp.pruefe(verein_gruenden('Löschen-Verein', true) ->> 'status' = 'gegruendet', 'gleicher Name wie V');
reset role;
select pg_temp.pruefe((select count(*) from vereine where name = 'Löschen-Verein') = 2, 'zwei Vereine gleichen Namens');

-- AK 8: Die Gründerin gehört einem Verein; andere Vereine nehmen sie nicht
-- auf (ohne den Verein zu nennen). Ihr eigener Verein nimmt ein Konto ohne
-- Verein auf.
select pg_temp.als(pg_temp.id('wverw'));
select pg_temp.pruefe(verein_verwaltung_aufnehmen(pg_temp.id('w'), 'ohne@gruenden-loeschen.test') = '{"status": "anderer_verein"}',
                      'Gründerin in fremde Verwaltung');
select pg_temp.pruefe(verein_team_aufnehmen(pg_temp.id('tw'), 'ohne@gruenden-loeschen.test') = '{"status": "anderer_verein"}',
                      'Gründerin in fremdes Team');
reset role;
select pg_temp.als(pg_temp.id('ohne'));
select pg_temp.pruefe(verein_verwaltung_aufnehmen(:'neu_id', 'ohne4@gruenden-loeschen.test') ->> 'status' = 'aufgenommen',
                      'neuer Verein nimmt auf');
select pg_temp.pruefe(konto_loeschen_info() = '{"fall": "frei", "verein": null, "teams": 0, "spieler": 0}',
                      'konto_loeschen_info mit zweiter Verwaltung');
reset role;
delete from trainer_suchversuche where user_id in (select id from ids);   -- Bremse der Aufnahmen oben

-- ── Verein löschen: Recht (AK 15) und Testfall 30 ───────────────────────────

select pg_temp.zaehlung(pg_temp.id('v')) as v_vorher, pg_temp.zaehlung(pg_temp.id('w')) as w_vorher,
       pg_temp.zaehlung(pg_temp.id('e')) as e_vorher, pg_temp.persoenlich() as persoenlich_vorher \gset
do $$
declare
  wer text;
  ziel text;
begin
  -- Mitglieder ohne Verwaltung, fremde Verwaltung und fremdes Mitglied,
  -- einzige Person bzw. letzte Verwaltung eines anderen Vereins, Konto ohne
  -- Verein.
  foreach wer in array array['a', 'b', 'wverw', 'c', 'einzig', 'letzt', 'q'] loop
    perform pg_temp.als(pg_temp.id(wer));
    perform pg_temp.erwarte(format('select verein_loeschen(%L, %L)', pg_temp.id('v'), 'Löschen-Verein'), 'VEREIN_NICHT_GEFUNDEN');
    perform set_config('role', 'postgres', true);
  end loop;
  -- Unbekannter Verein und null für eine Verwaltung.
  perform pg_temp.als(pg_temp.id('verw'));
  foreach ziel in array array[gen_random_uuid()::text, null] loop
    perform pg_temp.erwarte(format('select verein_loeschen(%L, %L)', ziel, 'Löschen-Verein'), 'VEREIN_NICHT_GEFUNDEN');
  end loop;
  -- Fremden Verein mit dessen Namen.
  perform pg_temp.erwarte(format('select verein_loeschen(%L, %L)', pg_temp.id('w'), 'Anderer Verein'), 'VEREIN_NICHT_GEFUNDEN');
  perform set_config('role', 'postgres', true);
end $$;
reset role;
-- Testfall 30: KI-Token löscht weder den Verein noch eine Spieler:in.
select pg_temp.als(pg_temp.id('verw'), '{"client_id": "ki-client"}');
select pg_temp.erwarte(format('select verein_loeschen(%L, %L)', pg_temp.id('v'), 'Löschen-Verein'), 'NUR_IN_DER_ANWENDUNG');
select pg_temp.erwarte(format('select verein_spieler_entfernen(%L)', pg_temp.id('s3')), 'NUR_IN_DER_ANWENDUNG');
select pg_temp.erwarte('select konto_loeschen_info()', 'NUR_IN_DER_ANWENDUNG');
select pg_temp.erwarte($$select delete_account('Löschen-Verein')$$, 'NUR_IN_DER_ANWENDUNG');
reset role;
select pg_temp.pruefe(pg_temp.zaehlung(pg_temp.id('v')) = :'v_vorher'::jsonb, 'Löschen ohne Recht hat etwas entfernt');

-- ── Verein löschen: falscher Name (AK 10, 14) ───────────────────────────────

select pg_temp.als(pg_temp.id('verw'));
do $$
declare
  falsch text;
  r jsonb;
begin
  foreach falsch in array array['löschen-verein', 'LÖSCHEN-VEREIN', 'Löschen-Verein x', 'Löschen Verein', 'Löschen-Verein.',
                                '', '   ', U&'\200BLöschen-Verein', null] loop
    r := verein_loeschen(pg_temp.id('v'), falsch);
    perform pg_temp.pruefe(r = '{"status": "vereinsname_falsch", "name": "Löschen-Verein"}',
                           format('falscher Name %L: %s', falsch, r));
  end loop;
end $$;
reset role;
select pg_temp.pruefe(pg_temp.zaehlung(pg_temp.id('v')) = :'v_vorher'::jsonb, 'falscher Name hat etwas entfernt');
select pg_temp.pruefe(pg_temp.persoenlich() = :'persoenlich_vorher', 'falscher Name hat Persönliches geändert');

-- ── Verein löschen: Erfolg (AK 10, PC 3–5, Testfall 20) ─────────────────────

-- Vor dem Löschen gelten sie (sonst prüfte der Vergleich danach nichts).
set local role anon;
select pg_temp.pruefe((spieler_link_ansicht(pg_temp.t('link_team')) ->> 'gueltig')::boolean
                      and (spieler_link_ansicht(pg_temp.t('link_ohne')) ->> 'gueltig')::boolean
                      and (spieler_abo_termine(pg_temp.t('abo_spieler')) ->> 'gueltig')::boolean
                      and (kalender_abo_termine(pg_temp.t('abo_kalender')) ->> 'gueltig')::boolean
                      and (abholung_ansicht(pg_temp.t('abholung')) ->> 'gueltig')::boolean
                      and feedback_link_beginnen(pg_temp.t('link_ohne')) ->> 'status' = 'ok', 'Geheimnisse vor dem Löschen');
reset role;

select pg_temp.als(pg_temp.id('verw'));
-- Rand nach JS trim() (Tabulator, geschütztes Leerzeichen, Zeilenumbruch) zählt nicht.
select verein_loeschen(pg_temp.id('v'), U&'\0009 L\00F6schen-Verein\00A0\000A') as geloescht \gset
reset role;
select pg_temp.pruefe(pg_temp.schluessel(:'geloescht'::jsonb) = array['bilder', 'name', 'status']
                      and :'geloescht'::jsonb ->> 'status' = 'geloescht' and :'geloescht'::jsonb ->> 'name' = 'Löschen-Verein',
                      'Rückgabe Löschen: ' || :'geloescht');
-- Bilder: genau die der Team-Trainings des Vereins, nicht die persönlichen.
select pg_temp.pruefe(:'geloescht'::jsonb -> 'bilder'
                      = jsonb_build_array(jsonb_build_object('id', pg_temp.id('te1'), 'bild_url', 'https://bild.test/t1.webp')),
                      'Bilder: ' || (:'geloescht'::jsonb -> 'bilder')::text);

-- PC 3: nichts des Vereins ist mehr da, jede Tabelle einzeln und über den Katalog.
do $$
declare
  z jsonb := pg_temp.zaehlung(pg_temp.id('v'));
  k text;
begin
  for k in select jsonb_object_keys(z) loop
    perform pg_temp.pruefe((z ->> k)::int = 0, format('nach dem Löschen noch %s Zeilen in %s', z ->> k, k));
  end loop;
  perform pg_temp.pruefe(pg_temp.reste(pg_temp.id('v')) is null, 'Reste über den Katalog: ' || pg_temp.reste(pg_temp.id('v')));
  -- Feedback bleibt, ohne Teamverweis.
  perform pg_temp.pruefe((select team_id is null from feedback where id = pg_temp.id('fb')), 'Feedback nicht ohne Team');
end $$;
-- Ein anderer Verein und die einzige Person eines dritten bleiben unberührt.
select pg_temp.pruefe(pg_temp.zaehlung(pg_temp.id('w')) = :'w_vorher'::jsonb, 'Verein W verändert');
select pg_temp.pruefe(pg_temp.zaehlung(pg_temp.id('e')) = :'e_vorher'::jsonb, 'Verein E verändert');
select pg_temp.pruefe(pg_temp.reste(pg_temp.id('w')) is not null, 'Verein W ohne Zeilen');
-- PC 4: Persönliches bleibt, die Personen sind Konten ohne Verein.
select pg_temp.pruefe(pg_temp.persoenlich() = :'persoenlich_vorher', 'Persönliches nach dem Löschen geändert');
select pg_temp.pruefe((select count(*) from auth.users where id in (pg_temp.id('verw'), pg_temp.id('verw2'), pg_temp.id('a'),
                                                                     pg_temp.id('b'))) = 4, 'Konten fehlen');
do $$
declare
  wer text;
begin
  foreach wer in array array['verw', 'verw2', 'a', 'b'] loop
    perform pg_temp.pruefe(person_verein(pg_temp.id(wer)) is null, wer || ' hat noch einen Verein');
    perform pg_temp.als(pg_temp.id(wer));
    perform pg_temp.pruefe(konto_loeschen_info() = '{"fall": "frei", "verein": null, "teams": 0, "spieler": 0}',
                           wer || ': konto_loeschen_info nach dem Löschen');
    perform pg_temp.pruefe(meine_vereinslage() -> 'verein' = 'null', wer || ': meine_vereinslage nach dem Löschen');
    perform set_config('role', 'postgres', true);
  end loop;
end $$;
reset role;

-- PC 5: Link, Abos und Abholadresse antworten wie ein unbekanntes Geheimnis.
set local role anon;
do $$
declare
  f text;
  art text;
  ref text;
  ist text;
begin
  foreach f in array array['select spieler_link_ansicht(%L)::text', 'select feedback_link_beginnen(%L)::text',
                           'select spieler_abo_holen(%L)::text',
                           'select spieler_abo_widerrufen(%L)::text',
                           format('select spieler_link_abmelden(%%L, %L, true, null, null)::text', pg_temp.id('tr_z')),
                           format('select spieler_link_melden(%%L, %L, false, null, null)::text', pg_temp.id('sp1'))] loop
    ref := pg_temp.antwort(format(f, pg_temp.t('unbekannt_link')));
    foreach art in array array['link_team', 'link_ohne'] loop
      ist := pg_temp.antwort(format(f, pg_temp.t(art)));
      perform pg_temp.pruefe(ist = ref, format('%s nach dem Löschen: %s statt %s', format(f, art), ist, ref));
    end loop;
  end loop;
  foreach f in array array['select spieler_abo_termine(%L)::text', 'select kalender_abo_termine(%L)::text',
                           'select abholung_ansicht(%L)::text',
                           'select abholung_abholen(%L, repeat(''k'', 32), ''Sara'', ''Eins'', 2015)::text'] loop
    ref := pg_temp.antwort(format(f, pg_temp.t('unbekannt')));
    foreach art in array array['abo_spieler', 'abo_ohne', 'abo_kalender', 'abholung'] loop
      ist := pg_temp.antwort(format(f, pg_temp.t(art)));
      perform pg_temp.pruefe(ist = ref, format('%s mit %s nach dem Löschen: %s statt %s', f, art, ist, ref));
    end loop;
  end loop;
end $$;
reset role;
select pg_temp.pruefe(not feedback_link_gueltig(pg_temp.t('link_team')) and not feedback_link_gueltig(pg_temp.t('link_ohne')),
                      'Feedback über den Link nach dem Löschen');

-- Ein zweites Löschen findet den Verein nicht mehr.
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.erwarte(format('select verein_loeschen(%L, %L)', pg_temp.id('v'), 'Löschen-Verein'), 'VEREIN_NICHT_GEFUNDEN');
reset role;

-- PC 4: Die Personen können neu gründen oder aufgenommen werden.
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_gruenden('Neuanfang', true) ->> 'status' = 'gegruendet', 'Verwaltung gründet nach dem Löschen');
reset role;
select pg_temp.als(pg_temp.id('wverw'));
select pg_temp.pruefe(verein_team_aufnehmen(pg_temp.id('tw'), 'a@gruenden-loeschen.test') ->> 'status' = 'aufgenommen',
                      'Mitglied nach dem Löschen aufgenommen');
select pg_temp.pruefe(verein_verwaltung_aufnehmen(pg_temp.id('w'), 'verw2@gruenden-loeschen.test') ->> 'status' = 'aufgenommen',
                      'Verwaltung nach dem Löschen aufgenommen');
reset role;

-- ── Konto löschen (AK 12–14) ────────────────────────────────────────────────

-- Letzte Verwaltung mit weiteren Personen: auch mit richtigem Namen nichts gelöscht.
select pg_temp.zaehlung(pg_temp.id('e')) as e_vorher2 \gset
select pg_temp.als(pg_temp.id('letzt'));
select pg_temp.pruefe(delete_account() = '{"status": "letzte_verwaltung"}', 'letzte Verwaltung ohne Namen');
select pg_temp.pruefe(delete_account('Letzte-Verein') = '{"status": "letzte_verwaltung"}', 'letzte Verwaltung mit Namen');
select pg_temp.pruefe(verein_verwaltung_entfernen(pg_temp.id('l'), pg_temp.id('letzt')) = '{"status": "letzte_verwaltung"}',
                      'letzte Verwaltung tritt aus');
reset role;
select pg_temp.pruefe(exists (select 1 from vereine where id = pg_temp.id('l'))
                      and exists (select 1 from verein_verwaltung where verein_id = pg_temp.id('l') and user_id = pg_temp.id('letzt'))
                      and exists (select 1 from teams where id = pg_temp.id('tl')), 'letzte Verwaltung hat gelöscht');

-- Einzige Person: ohne Namen die Zahlen, mit falschem Namen nichts.
select pg_temp.als(pg_temp.id('einzig'));
select pg_temp.pruefe(delete_account() = '{"status": "verein_bestaetigen", "verein": "Einzel-Verein", "teams": 1, "spieler": 2}',
                      'einzige Person ohne Namen: ' || delete_account()::text);
select pg_temp.pruefe(delete_account(null) ->> 'status' = 'verein_bestaetigen', 'einzige Person mit null');
select pg_temp.pruefe(delete_account('einzel-verein') = '{"status": "vereinsname_falsch", "name": "Einzel-Verein"}',
                      'einzige Person, Gross/Klein');
select pg_temp.pruefe(delete_account('') = '{"status": "vereinsname_falsch", "name": "Einzel-Verein"}', 'einzige Person, leer');
select pg_temp.pruefe(verein_verwaltung_entfernen(pg_temp.id('e'), pg_temp.id('einzig')) = '{"status": "letzte_verwaltung"}',
                      'einzige Person tritt aus');
reset role;
select pg_temp.pruefe(pg_temp.zaehlung(pg_temp.id('e')) = :'e_vorher2'::jsonb, 'einzige Person ohne richtigen Namen hat gelöscht');

-- Inzwischen weitere Person (AK 14): einzig2 ist einzige Person, dann kommt q dazu.
select pg_temp.als(pg_temp.id('einzig2'));
select pg_temp.pruefe(delete_account() ->> 'status' = 'verein_bestaetigen', 'einzig2 zuerst einzige Person');
select verein_team_anlegen(pg_temp.id('e2'), 'Team Zwei E') ->> 'id' as team_e2 \gset
select pg_temp.pruefe(verein_team_aufnehmen(:'team_e2', 'q@gruenden-loeschen.test') ->> 'status' = 'aufgenommen', 'q in E2');
select pg_temp.pruefe(delete_account('Einzel-Zwei') = '{"status": "letzte_verwaltung"}', 'inzwischen weitere Person');
select pg_temp.pruefe(konto_loeschen_info() = '{"fall": "letzte_verwaltung", "verein": "Einzel-Zwei", "teams": 0, "spieler": 0}',
                      'konto_loeschen_info mit weiterer Person');
reset role;
select pg_temp.pruefe(exists (select 1 from vereine where id = pg_temp.id('e2'))
                      and exists (select 1 from verein_verwaltung where user_id = pg_temp.id('einzig2')), 'E2 trotz weiterer Person gelöscht');

-- Einzige Person mit richtigem Namen: Verein samt allem weg, dazu die
-- Konto-Daten wie bisher (private Übungen gelöscht, öffentliche anonymisiert).
set local session_replication_role = replica;
insert into exercises (slug, name, trainingsteil, aufbau, source, owner_id, visibility) values
  ('gruenden-loeschen-e', 'Übung E', 'ausklang', 'Aufbau', 'user', pg_temp.id('einzig'), 'private'),
  ('gruenden-loeschen-e-pub', 'Übung E öffentlich', 'ausklang', 'Aufbau', 'user', pg_temp.id('einzig'), 'public');
set local session_replication_role = origin;
select pg_temp.zaehlung(pg_temp.id('w')) as w_vorher2 \gset
select pg_temp.als(pg_temp.id('einzig'));
select delete_account('  Einzel-Verein ') as konto_geloescht \gset
reset role;
select pg_temp.pruefe(:'konto_geloescht'::jsonb = jsonb_build_object('status', 'geloescht', 'bilder',
                        jsonb_build_array(jsonb_build_object('id', (select id from bez where art = 'te' and verein = pg_temp.id('e')),
                                                             'bild_url', 'https://bild.test/e.webp'))),
                      'Rückgabe Konto löschen mit Verein: ' || :'konto_geloescht');
do $$
declare
  z jsonb := pg_temp.zaehlung(pg_temp.id('e'));
  k text;
begin
  for k in select jsonb_object_keys(z) loop
    perform pg_temp.pruefe((z ->> k)::int = 0, format('nach dem Konto-Löschen noch %s Zeilen in %s', z ->> k, k));
  end loop;
  perform pg_temp.pruefe(pg_temp.reste(pg_temp.id('e')) is null, 'Reste nach dem Konto-Löschen: ' || pg_temp.reste(pg_temp.id('e')));
  perform pg_temp.pruefe(not exists (select 1 from exercises where owner_id = pg_temp.id('einzig'))
                         and exists (select 1 from exercises where slug = 'gruenden-loeschen-e-pub' and owner_id is null)
                         and not exists (select 1 from exercises where slug = 'gruenden-loeschen-e'),
                         'Konto-Daten der einzigen Person');
end $$;
select pg_temp.pruefe(pg_temp.zaehlung(pg_temp.id('w')) = :'w_vorher2'::jsonb, 'W durch Konto-Löschen verändert');

-- Bestehendes Verhalten ohne Verein bzw. mit weiteren Personen: geloescht mit
-- leeren Bildern; Teams und Mitgliedschaften bleiben (die Mitgliedschaft
-- nimmt erst das Löschen des Auth-Kontos mit). Ohne Verein spielt ein Name
-- keine Rolle.
select pg_temp.als(pg_temp.id('c'));
select pg_temp.pruefe(delete_account() = '{"status": "geloescht", "bilder": []}', 'Mitglied löscht Konto');
reset role;
select pg_temp.pruefe(exists (select 1 from team_members where team_id = pg_temp.id('tw') and user_id = pg_temp.id('c'))
                      and exists (select 1 from teams where id = pg_temp.id('tw')), 'Konto-Löschen eines Mitglieds');
-- Mit Vereinsnamen, obwohl inzwischen eine zweite Verwaltung dazukam (ohne4,
-- AK 14): nichts gelöscht; ohne Namen dann wie bisher.
select pg_temp.als(pg_temp.id('ohne'));
select pg_temp.pruefe(delete_account('FC Neu') = '{"status": "letzte_verwaltung"}', 'Name, aber inzwischen zweite Verwaltung');
reset role;
select pg_temp.pruefe(exists (select 1 from verein_verwaltung where user_id = pg_temp.id('ohne')),
                      'Name, aber inzwischen zweite Verwaltung: Verwaltung entfernt');
select pg_temp.als(pg_temp.id('ohne'));
select pg_temp.pruefe(delete_account() = '{"status": "geloescht", "bilder": []}', 'Verwaltung mit zweiter Verwaltung');
reset role;
select pg_temp.pruefe(not exists (select 1 from verein_verwaltung where user_id = pg_temp.id('ohne'))
                      and exists (select 1 from vereine where id = :'neu_id'), 'Verwaltung mit zweiter Verwaltung: Verein');
select pg_temp.als(pg_temp.id('b'));
select pg_temp.pruefe(delete_account('Löschen-Verein') = '{"status": "geloescht", "bilder": []}', 'Konto ohne Verein');
reset role;
-- Eine einzige Person mit falschem Namen nennt den aktuellen Namen.
select pg_temp.als(pg_temp.id('ohne2'));
select pg_temp.pruefe(delete_account('irgendwas') = jsonb_build_object('status', 'vereinsname_falsch', 'name', repeat('y', 60)),
                      'einzige Person, falscher Name');
reset role;

-- ── Gespeicherter Name mit Rand (Fix-Lauf Story 11) ─────────────────────────
-- Der CHECK verein_name und der Teamname-CHECK prüfen nur btrim: Ein Name mit
-- geschütztem Leerzeichen oder Tabulator am Rand kann gespeichert sein. Er
-- lässt sich trotzdem bestätigen (Verein löschen, Konto der einzigen Person,
-- Team auflösen); Gründen und Umbenennen speichern ihn ohne Rand.
insert into ids (name) values ('rand1'), ('rand2'), ('rand3'), ('rand4'), ('rv1'), ('rv2'), ('rv3'), ('rt');
insert into auth.users (id, email, email_confirmed_at)
select id, name || '@gruenden-loeschen.test', now() from ids where name in ('rand1', 'rand2', 'rand3', 'rand4');
set local session_replication_role = replica;
insert into vereine (id, name) values
  (pg_temp.id('rv1'), U&'Klub\00A0'), (pg_temp.id('rv2'), U&'\0009Einsam'), (pg_temp.id('rv3'), 'Rand-Verein');
insert into verein_verwaltung (verein_id, user_id) values
  (pg_temp.id('rv1'), pg_temp.id('rand1')), (pg_temp.id('rv2'), pg_temp.id('rand2')), (pg_temp.id('rv3'), pg_temp.id('rand3'));
insert into teams (id, name, verein_id) values (pg_temp.id('rt'), U&'Rand-Team\00A0', pg_temp.id('rv3'));
set local session_replication_role = origin;

select pg_temp.als(pg_temp.id('rand1'));
select pg_temp.pruefe(verein_loeschen(pg_temp.id('rv1'), 'klub') = jsonb_build_object('status', 'vereinsname_falsch', 'name', U&'Klub\00A0'),
                      'Verein mit Rand, Gross/Klein');
select pg_temp.pruefe(verein_loeschen(pg_temp.id('rv1'), 'Klub') ->> 'status' = 'geloescht', 'Verein mit Rand löschen');
reset role;
select pg_temp.pruefe(not exists (select 1 from vereine where id = pg_temp.id('rv1')), 'Verein mit Rand noch da');

select pg_temp.als(pg_temp.id('rand2'));
select pg_temp.pruefe(konto_loeschen_info() ->> 'fall' = 'einzige_person', 'rand2 einzige Person');
select pg_temp.pruefe(delete_account('Einsam') = '{"status": "geloescht", "bilder": []}', 'Konto der einzigen Person, Verein mit Rand');
reset role;
select pg_temp.pruefe(not exists (select 1 from vereine where id = pg_temp.id('rv2')), 'Verein mit Rand nach Konto-Löschen noch da');

select pg_temp.als(pg_temp.id('rand3'));
select pg_temp.pruefe(verein_team_aufloesen(pg_temp.id('rt'), 'Rand-Team') ->> 'status' = 'aufgeloest', 'Team mit Rand auflösen');
select pg_temp.pruefe(verein_umbenennen(pg_temp.id('rv3'), U&'\00A0Rand-Neu\2003') = '{"status": "umbenannt", "name": "Rand-Neu"}',
                      'Umbenennen ohne Rand');
reset role;
select pg_temp.pruefe(not exists (select 1 from teams where id = pg_temp.id('rt'))
                      and (select name from vereine where id = pg_temp.id('rv3')) = 'Rand-Neu', 'Team mit Rand bzw. Umbenennen');

select pg_temp.als(pg_temp.id('rand4'));
select verein_gruenden(U&'\00A0FC Rand\FEFF\0009', true) as rand_gegruendet \gset
reset role;
select pg_temp.pruefe(:'rand_gegruendet'::jsonb ->> 'name' = 'FC Rand'
                      and (select name from vereine where id = (:'rand_gegruendet'::jsonb ->> 'id')::uuid) = 'FC Rand',
                      'Gründen mit Rand speichert ohne Rand: ' || :'rand_gegruendet');

rollback;

-- ── Laufzeit (Zettel A2) ────────────────────────────────────────────────────
-- 30 Teams (je ein Mitglied mit Kalender-Abo, Abholadresse), 1000
-- Spieler:innen in je zwei Teams, 500 Eltern-Abos, Kader, 3000 Termine
-- (30 % Spiele) mit Trainer-Einladungen, Abmeldungen, Statuswechseln,
-- 1500 festgehaltenen Terminen mit 18000 Teilnahmen, 150 Team-Trainings mit
-- 1200 Übungen. Die Zeilen sind in dieser Transaktion neu und nie analysiert
-- (Stand wie auf einer frisch zurückgesetzten DB). Gelöscht wird als Rolle
-- `authenticated` mit dem PostgREST-Limit von 8 s; die Schranke von 4 s ist
-- grosszügig (lokal gemessen: siehe Bericht zu Story 11, rund 0.3 s).

begin;
set local statement_timeout = '120s';

create function pg_temp.als(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create temp table k (n text primary key, id uuid not null default gen_random_uuid());
insert into k (n) values ('v'), ('verw'), ('m');
insert into k (n) select 't' || i from generate_series(1, 30) i;
create function pg_temp.k(p text) returns uuid language sql stable as $$ select id from k where n = p $$;
grant select on k to authenticated;   -- temporär; die Rolle braucht pg_temp.k
insert into auth.users (id, email, email_confirmed_at) select id, n || '@laufzeit11.test', now() from k where n in ('verw', 'm');
insert into vereine (id, name) values (pg_temp.k('v'), 'Laufzeit-Verein');
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.k('v'), pg_temp.k('verw'));
insert into teams (id, name, verein_id) select pg_temp.k('t' || i), 'Team ' || i, pg_temp.k('v') from generate_series(1, 30) i;
insert into team_members (team_id, user_id) select pg_temp.k('t' || i), pg_temp.k('m') from generate_series(1, 30) i;
insert into kalender_abos (team_id, user_id) select pg_temp.k('t' || i), pg_temp.k('m') from generate_series(1, 30) i;
insert into team_abholung (team_id, aktiv) select pg_temp.k('t' || i), true from generate_series(1, 30) i;
set local session_replication_role = replica;
create temp table sp as select gen_random_uuid() as id, i from generate_series(1, 1000) i;
insert into spieler (id, verein_id, vorname, nachname, jahrgang, js_nummer)
select id, pg_temp.k('v'), 'Vor' || i, 'Nach' || i, 2010 + i % 8, (1000000 + i)::text from sp;
insert into team_spieler (team_id, spieler_id, verein_id) select pg_temp.k('t' || (1 + i % 30)), id, pg_temp.k('v') from sp;
insert into team_spieler (team_id, spieler_id, verein_id) select pg_temp.k('t' || (1 + (i + 7) % 30)), id, pg_temp.k('v') from sp;
update spieler s set team_id = (select min(ts.team_id::text)::uuid from team_spieler ts where ts.spieler_id = s.id)
 where s.verein_id = pg_temp.k('v');
insert into spieler_abos (spieler_id) select id from sp where i % 2 = 0;
insert into kader (id, team_id, name) select gen_random_uuid(), pg_temp.k('t' || i), 'Kader ' || j
  from generate_series(1, 30) i, generate_series(1, 2) j;
insert into kader_spieler (kader_id, spieler_id, team_id)
select kd.id, ts.spieler_id, ts.team_id
  from (select id, team_id, row_number() over (partition by team_id order by name) rn from kader
         where team_id in (select id from k)) kd
  join lateral (select spieler_id, team_id from team_spieler x where x.team_id = kd.team_id order by spieler_id limit 15) ts on true
 where kd.rn = 1;
create temp table tt as select gen_random_uuid() as id, pg_temp.k('t' || t) as team, t, j
  from generate_series(1, 30) t, generate_series(1, 100) j;
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung)
select id, team, current_date - 120 + j * 2, '18:00', '19:30', case when j % 10 < 3 then 'spiel' else 'training' end,
       case when j % 10 < 3 then 'Spiel ' || j end from tt;
insert into termin_trainer (termin_id, user_id) select id, pg_temp.k('m') from tt where j % 3 = 0;
insert into termin_abmeldungen (termin_id, spieler_id, team_id)
select tt.id, z.spieler_id, tt.team from tt
  join lateral (select spieler_id from team_spieler x where x.team_id = tt.team order by spieler_id offset (tt.j % 20) limit 8) z on true
 where tt.j % 10 < 3;
insert into termin_statuswechsel (termin_id, spieler_id, team_id)
select tt.id, z.spieler_id, tt.team from tt
  join lateral (select spieler_id from team_spieler x where x.team_id = tt.team order by spieler_id offset (tt.j % 20) limit 4) z on true
 where tt.j % 10 < 3;
insert into termin_eingefroren (termin_id, team_id, mit_liste) select id, team, true from tt where j <= 50;
insert into termin_teilnahmen (termin_id, team_id, spieler_id)
select tt.id, tt.team, z.spieler_id from tt
  join lateral (select spieler_id from team_spieler x where x.team_id = tt.team order by spieler_id offset (tt.j % 30) limit 12) z on true
 where tt.j <= 50;
create temp table tr as select gen_random_uuid() as id, pg_temp.k('t' || t) as team, t, j
  from generate_series(1, 30) t, generate_series(1, 5) j;
set local session_replication_role = origin;
insert into trainings (id, name, team_id, visibility, altersstufe, stufen)
select id, 'Training ' || t || '-' || j, team, 'private', 'kinderfussball', array['F'] from tr;
insert into training_exercises (training_id, trainingsteil, position, name, altersstufe, aufbau, bild_url)
select tr.id, 'ausklang', e, 'Übung ' || e, 'kinderfussball', 'Aufbau',
       case when e = 1 then 'https://bild.test/laufzeit/' || tr.id || '.webp' end
  from tr, generate_series(1, 8) e;

do $$
begin
  if (select count(*) from spieler where verein_id = pg_temp.k('v')) <> 1000
     or (select count(*) from team_spieler where verein_id = pg_temp.k('v')) <> 2000
     or (select count(*) from training_termine where team_id in (select id from k)) <> 3000
     or (select count(*) from termin_teilnahmen where team_id in (select id from k)) <> 18000
     or (select count(*) from training_exercises x join trainings t on t.id = x.training_id
          where t.team_id in (select id from k)) <> 1200 then
    raise exception 'Story 11 Laufzeit: Bestand nicht wie erwartet';
  end if;
end $$;

select pg_temp.als(pg_temp.k('verw'));
set local statement_timeout = '8s';
do $$
declare
  t0 timestamptz := clock_timestamp();
  r jsonb;
  ms int;
begin
  r := verein_loeschen(pg_temp.k('v'), 'Laufzeit-Verein');
  ms := (extract(epoch from clock_timestamp() - t0) * 1000)::int;
  raise notice 'Story 11 Laufzeit: verein_loeschen mit 30 Teams und 1000 Spieler:innen: % ms', ms;
  if r ->> 'status' <> 'geloescht' or jsonb_array_length(r -> 'bilder') <> 150 then
    raise exception 'Story 11 Laufzeit: Rückgabe %', left(r::text, 200);
  end if;
  if ms > 4000 then
    raise exception 'Story 11 Laufzeit: verein_loeschen brauchte % ms (Schranke 4000 ms)', ms;
  end if;
end $$;
reset role;
set local statement_timeout = '120s';
do $$
begin
  if exists (select 1 from vereine where id = pg_temp.k('v')) or exists (select 1 from spieler where verein_id = pg_temp.k('v'))
     or exists (select 1 from teams where id in (select id from k))
     or exists (select 1 from training_termine where team_id in (select id from k)) then
    raise exception 'Story 11 Laufzeit: nicht alles gelöscht';
  end if;
end $$;

rollback;
