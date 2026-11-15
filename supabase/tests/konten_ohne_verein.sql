-- Konten ohne Verein (Story 12 #588; Architekturplan Vereine §3.5, §4.4
-- «Kontogrenzen», §6.7 Testfälle 22 und 26): höchstens 50 eigene Übungen und
-- 30 eigene Trainings für ein Konto, das weder einem Team noch einer
-- Vereinsverwaltung angehört. Auf Datenebene:
-- - Zählung (AK 1): was zählt (Entwurf, öffentlich, kopiert), was nicht
--   (Team-Training, Termin-Training, Manual-Übung, anonymisierte Zeile,
--   Varianten, Gruppen, Übungen im Training)
-- - Grenze (AK 2, 3): 49 → geht, 50 → `KONTO_UEBUNGEN_VOLL 50`; 29/30 ebenso;
--   ein abgewiesener Vorgang belegt keinen Platz (AK 8); Übung in ein
--   Training übernehmen bleibt frei (AK 4)
-- - Bestand über der Grenze (PC 1): der Marker nennt den tatsächlichen
--   Bestand; Ändern, Veröffentlichen, Auf-Entwurf-Setzen, Löschen gehen; nach
--   Löschen unter die Grenze geht Anlegen wieder
-- - Konto mit Verein (Team oder nur Verwaltung): keine Grenze; nach Austritt,
--   Team-Auflösen und Verein-Löschen gilt sie wieder, der Bestand bleibt (PC 2)
-- - Wege der Rollen: `authenticated` über die RLS, KI-Token, Service-Rolle
--   (ohne auth.uid() der Grenze unterworfen)
-- - kein Abfluss: fremde owner_id ergibt die RLS-Abweisung, nie den Marker,
--   mit gleichem Text unabhängig vom fremden Konto (die Sperre prüft rennen.sql)
-- - Besitzwechsel per UPDATE zählt; Updates ohne Besitzwechsel,
--   delete_account, FK-SET-NULL, Inserts ohne Besitzer lösen nichts aus
-- - Sammel-Insert über die Grenze: nichts eingefügt; Upsert auf eine eigene
--   Zeile an der Grenze wird abgewiesen (dokumentiertes Verhalten)
-- - `meine_vereinslage().grenzen` in jeder Lage (PC 3)
-- - AK 9: ein Konto ohne Team bekommt am Team-Ort nichts, auch mit KI-Token;
--   die Verwaltung ohne Team behält den Verein-Ort
-- - Grants (Testfall 26)
-- Alles in einer Transaktion mit rollback; hinterlässt nichts. Die Rolle
-- wechselt wie bei PostgREST über `role` und `request.jwt.claims`.

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

-- Zurück zu postgres ohne Anmeldung: `reset role` allein lässt die Claims
-- (und damit auth.uid()) stehen.
create function pg_temp.zurueck() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
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

-- Genau dieser Fehler (SQLSTATE und vollständige Meldung).
create function pg_temp.erwarte_genau(p_sql text, p_fehler text) returns void
language plpgsql as $$
declare
  f text := pg_temp.fehler(p_sql);
begin
  if f is distinct from p_fehler then
    raise exception 'erwartet «%» bei «%», bekommen: %', p_fehler, p_sql, coalesce(f, 'kein Fehler');
  end if;
end $$;

create function pg_temp.geht(p_sql text) returns void
language plpgsql as $$
declare
  f text := pg_temp.fehler(p_sql);
begin
  if f is not null then raise exception 'erwartet Erfolg bei «%», bekommen: %', p_sql, f; end if;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('ohne'), ('gross'), ('mitglied'), ('verw'), ('fremd'), ('aus'), ('aufl'), ('vl'),
  ('ki'), ('dienst'), ('del'), ('fk'), ('v1'), ('v2'), ('t1'), ('t2'), ('termin'), ('sp'),
  ('tr_ohne'), ('tr_team'), ('tr_team2'), ('sammel');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated, service_role;   -- temporär; die Rollen brauchen pg_temp.id

-- SQL für eine Übung bzw. ein Training eines Kontos (wie die Anwendung: ein
-- direkter Insert, über die RLS, sobald eine Rolle gesetzt ist).
create function pg_temp.uebung(p_owner uuid, p_vis text default 'private') returns text
language sql volatile as $$
  select format($q$insert into exercises (slug, name, trainingsteil, aufbau, source, owner_id, visibility)
                   values (%L, 'Übung', 'ausklang', 'Aufbau', 'user', %L, %L)$q$,
                'kov-' || gen_random_uuid(), p_owner, p_vis);
$$;
create function pg_temp.training(p_owner uuid, p_team uuid default null, p_termin boolean default false) returns text
language sql volatile as $$
  select format($q$insert into trainings (name, owner_id, team_id, visibility, altersstufe, stufen, termin_training)
                   values ('Training', %L, %L, 'private', 'kinderfussball', array['F'], %L)$q$,
                p_owner, p_team, p_termin);
$$;

-- Bestand ohne Trigger anlegen (wie Prod-Altbestand bzw. Sync unter replica).
create function pg_temp.bestand(p_owner uuid, p_uebungen int, p_trainings int, p_vis text default 'private') returns void
language plpgsql as $$
begin
  set local session_replication_role = replica;   -- als Befehl (supautils erlaubt set_config hier nicht)
  insert into exercises (slug, name, trainingsteil, aufbau, source, owner_id, visibility)
  select 'kov-' || gen_random_uuid(), 'Alt ' || i, 'ausklang', 'Aufbau', 'user', p_owner, p_vis
    from generate_series(1, p_uebungen) i;
  insert into trainings (name, owner_id, visibility, altersstufe, stufen)
  select 'Alt ' || i, p_owner, p_vis, 'kinderfussball', array['F'] from generate_series(1, p_trainings) i;
  set local session_replication_role = origin;
end $$;

create function pg_temp.zaehlt(p_owner uuid, p_uebungen int, p_trainings int, p_fall text) returns void
language plpgsql as $$
declare
  v jsonb := konto_bestand(p_owner);
begin
  if v <> jsonb_build_object('uebungen', p_uebungen, 'trainings', p_trainings) then
    raise exception '%: Bestand %, erwartet % Übungen / % Trainings', p_fall, v, p_uebungen, p_trainings;
  end if;
end $$;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@konten-ohne-verein.test', now() from ids
 where name in ('ohne', 'gross', 'mitglied', 'verw', 'fremd', 'aus', 'aufl', 'vl', 'ki', 'dienst', 'del', 'fk', 'sammel');

-- V1 mit Verwaltung «verw» (ohne Team), Team T1 (mitglied, aus) und Team T2
-- (aufl); V2 mit «vl» als einziger Person, ohne Team.
insert into vereine (id, name) values (pg_temp.id('v1'), 'Konto-Verein Eins'), (pg_temp.id('v2'), 'Konto-Verein Zwei');
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v1'), pg_temp.id('verw')),
                                                         (pg_temp.id('v2'), pg_temp.id('vl'));
insert into teams (id, name, verein_id) values (pg_temp.id('t1'), 'Konto-Team Eins', pg_temp.id('v1')),
                                              (pg_temp.id('t2'), 'Konto-Team Zwei', pg_temp.id('v1'));
insert into team_members (team_id, user_id) values (pg_temp.id('t1'), pg_temp.id('mitglied')),
                                                  (pg_temp.id('t1'), pg_temp.id('aus')),
                                                  (pg_temp.id('t2'), pg_temp.id('aufl'));
insert into training_termine (id, team_id, datum, beginn, ende)
values (pg_temp.id('termin'), pg_temp.id('t1'), current_date + 7, '18:00', '19:30');
set local session_replication_role = replica;
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang)
values (pg_temp.id('sp'), pg_temp.id('t1'), pg_temp.id('v1'), 'Konto', 'Spielerin', 2015);
insert into team_spieler (team_id, spieler_id, verein_id) values (pg_temp.id('t1'), pg_temp.id('sp'), pg_temp.id('v1'));
set local session_replication_role = origin;

-- ── Zählung (AK 1) ──────────────────────────────────────────────────────────
-- «ohne» legt über die RLS an: eine private und eine öffentliche Übung, eine
-- «Kopie» (für die DB ein Insert wie jeder andere), ein Training.
select pg_temp.als(pg_temp.id('ohne'));
select pg_temp.geht(pg_temp.uebung(pg_temp.id('ohne')));
select pg_temp.geht(pg_temp.uebung(pg_temp.id('ohne'), 'public'));
select pg_temp.geht(pg_temp.uebung(pg_temp.id('ohne')));
select pg_temp.geht(format($q$insert into trainings (id, name, owner_id, visibility, altersstufe, stufen)
                              values (%L, 'Eigenes', %L, 'private', 'kinderfussball', array['F'])$q$,
                           pg_temp.id('tr_ohne'), pg_temp.id('ohne')));
-- Varianten, Gruppen und Übungen im Training zählen nicht einzeln (AK 1, 4).
select pg_temp.geht(format($q$insert into training_varianten (training_id, name, position) values (%L, 'B', 1), (%L, 'C', 2)$q$,
                           pg_temp.id('tr_ohne'), pg_temp.id('tr_ohne')));
select pg_temp.geht(format($q$insert into training_gruppen (training_id, name, position) values (%L, 'Rot', 1)$q$,
                           pg_temp.id('tr_ohne')));
select pg_temp.geht(format($q$insert into training_exercises (training_id, trainingsteil, position, name, altersstufe, aufbau)
                              select %L, 'ausklang', i, 'Im Training', 'kinderfussball', 'Aufbau' from generate_series(1, 3) i$q$,
                           pg_temp.id('tr_ohne')));
select pg_temp.zurueck();
-- Eine öffentliche alte Übung (replica) zählt ebenso.
select pg_temp.bestand(pg_temp.id('ohne'), 1, 0, 'public');
-- Nicht: Team-Training und Termin-Training (Mitglied), Manual-Übung,
-- anonymisierte Zeilen (owner_id null), Zeilen anderer Konten.
select pg_temp.als(pg_temp.id('mitglied'));
select pg_temp.geht(format($q$insert into trainings (id, name, team_id, visibility, altersstufe, stufen)
                              values (%L, 'Team', %L, 'private', 'kinderfussball', array['F'])$q$,
                           pg_temp.id('tr_team'), pg_temp.id('t1')));
select pg_temp.geht(pg_temp.training(null, pg_temp.id('t1'), true));
select pg_temp.zurueck();
insert into exercises (slug, name, trainingsteil, aufbau, source, visibility)
values ('kov-manual', 'Manual', 'ausklang', 'Aufbau', 'manual', 'public'),
       ('kov-anonym', 'Anonym', 'ausklang', 'Aufbau', 'user', 'public');
insert into trainings (name, visibility, altersstufe, stufen) values ('Anonym', 'public', 'kinderfussball', array['F']);
select pg_temp.zaehlt(pg_temp.id('ohne'), 4, 1, 'Zählung');
select pg_temp.zaehlt(pg_temp.id('mitglied'), 0, 0, 'Zählung Mitglied (Team-Trainings zählen nicht)');

-- ── Grenze 50/30 (AK 2, 3, 8; Testfall 22) ──────────────────────────────────
select pg_temp.bestand(pg_temp.id('ohne'), 45, 28);
select pg_temp.zaehlt(pg_temp.id('ohne'), 49, 29, 'vor der Grenze');
select pg_temp.als(pg_temp.id('ohne'));
select pg_temp.geht(pg_temp.uebung(pg_temp.id('ohne')));                       -- 50.
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('ohne')), 'P0001 KONTO_UEBUNGEN_VOLL 50');
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('ohne'), 'public'), 'P0001 KONTO_UEBUNGEN_VOLL 50');
select pg_temp.geht(pg_temp.training(pg_temp.id('ohne')));                     -- 30.
select pg_temp.erwarte_genau(pg_temp.training(pg_temp.id('ohne')), 'P0001 KONTO_TRAININGS_VOLL 30');
-- Abgewiesenes belegt keinen Platz.
select pg_temp.zurueck();
select pg_temp.zaehlt(pg_temp.id('ohne'), 50, 30, 'an der Grenze');
select pg_temp.als(pg_temp.id('ohne'));
-- Grenze vor fehlender Kategorie: Die Grenzmeldung kommt zuerst.
select pg_temp.erwarte(format($q$insert into trainings (name, owner_id, visibility, altersstufe, stufen)
                                 values ('Ohne Stufe', %L, 'private', 'kinderfussball', '{}')$q$, pg_temp.id('ohne')),
                       'KONTO_TRAININGS_VOLL 30');
-- Übung in ein Training übernehmen bleibt frei (AK 4).
select pg_temp.geht(format($q$insert into training_exercises (training_id, trainingsteil, position, name, altersstufe, aufbau)
                              values (%L, 'ausklang', 9, 'Übernommen', 'kinderfussball', 'Aufbau')$q$, pg_temp.id('tr_ohne')));
-- Eine Kopie, die nach dem Insert der Trainingszeile scheitert, wird
-- abgeräumt: danach ist der Platz wieder frei (Testfall 22).
select pg_temp.geht(format('delete from trainings where id = %L', pg_temp.id('tr_ohne')));
select pg_temp.geht(pg_temp.training(pg_temp.id('ohne')));
select pg_temp.erwarte_genau(pg_temp.training(pg_temp.id('ohne')), 'P0001 KONTO_TRAININGS_VOLL 30');
select pg_temp.zurueck();

-- ── Bestand über der Grenze (PC 1) ──────────────────────────────────────────
select pg_temp.bestand(pg_temp.id('gross'), 57, 33);
select pg_temp.bestand(pg_temp.id('gross'), 0, 1, 'public');
select pg_temp.als(pg_temp.id('gross'));
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('gross')), 'P0001 KONTO_UEBUNGEN_VOLL 57');
select pg_temp.erwarte_genau(pg_temp.training(pg_temp.id('gross')), 'P0001 KONTO_TRAININGS_VOLL 34');
do $$
declare
  v_ue uuid := (select id from exercises where owner_id = pg_temp.id('gross') order by created_at, id limit 1);
  v_tr uuid := (select id from trainings where owner_id = pg_temp.id('gross') and visibility = 'private' limit 1);
  v_pub uuid := (select id from trainings where owner_id = pg_temp.id('gross') and visibility = 'public' limit 1);
  n int;
begin
  update exercises set name = 'Geändert' where id = v_ue;                    -- ändern
  update exercises set visibility = 'public' where id = v_ue;                -- veröffentlichen
  update exercises set visibility = 'private' where id = v_ue;               -- auf Entwurf setzen
  update exercises set owner_id = owner_id, name = 'Gleicher Besitz' where id = v_ue;   -- UPDATE OF ohne Wechsel
  update trainings set name = 'Geändert', ziel = 'Ziel' where id = v_tr;
  update trainings set owner_id = owner_id where id = v_tr;
  update trainings set visibility = 'private' where id = v_pub;              -- auf Entwurf setzen
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PC 1: auf Entwurf setzen hat % Zeilen getroffen', n; end if;
  if (select name from exercises where id = v_ue) <> 'Gleicher Besitz' or (select name from trainings where id = v_tr) <> 'Geändert' then
    raise exception 'PC 1: Änderungen über der Grenze nicht gespeichert';
  end if;
  -- Löschen bis unter die Grenze: 57 → 49 bzw. 34 → 29.
  delete from exercises where id in (select id from exercises where owner_id = pg_temp.id('gross') limit 8);
  delete from trainings where id in (select id from trainings where owner_id = pg_temp.id('gross') limit 5);
end $$;
select pg_temp.geht(pg_temp.uebung(pg_temp.id('gross')));
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('gross')), 'P0001 KONTO_UEBUNGEN_VOLL 50');
select pg_temp.geht(pg_temp.training(pg_temp.id('gross')));
select pg_temp.erwarte_genau(pg_temp.training(pg_temp.id('gross')), 'P0001 KONTO_TRAININGS_VOLL 30');
select pg_temp.zurueck();
select pg_temp.zaehlt(pg_temp.id('gross'), 50, 30, 'nach Löschen und Neuanlage');

-- ── Sammel-Insert über die Grenze hinweg; Upsert an der Grenze ─────────────
-- Eine Anweisung mit fünf Zeilen bei 48 bzw. 28: Der Trigger läuft je Zeile
-- und sieht die schon eingefügten derselben Anweisung; die dritte trifft die
-- Grenze, und die ganze Anweisung fällt zurück — nichts ist eingefügt.
select pg_temp.bestand(pg_temp.id('sammel'), 48, 28);
select pg_temp.als(pg_temp.id('sammel'));
select pg_temp.erwarte_genau(format($q$insert into exercises (slug, name, trainingsteil, aufbau, source, owner_id, visibility)
                                       select 'kov-s-' || gen_random_uuid(), 'Sammel', 'ausklang', 'Aufbau', 'user', %L, 'private'
                                         from generate_series(1, 5)$q$, pg_temp.id('sammel')),
                             'P0001 KONTO_UEBUNGEN_VOLL 50');
select pg_temp.erwarte_genau(format($q$insert into trainings (name, owner_id, visibility, altersstufe, stufen)
                                       select 'Sammel', %L, 'private', 'kinderfussball', array['F']
                                         from generate_series(1, 5)$q$, pg_temp.id('sammel')),
                             'P0001 KONTO_TRAININGS_VOLL 30');
select pg_temp.zurueck();
select pg_temp.zaehlt(pg_temp.id('sammel'), 48, 28, 'Sammel-Insert über die Grenze: nichts eingefügt');
-- Dokumentiertes Verhalten: Ein Upsert auf eine bestehende eigene Zeile feuert
-- den BEFORE-INSERT-Trigger vor der Konfliktprüfung und wird an der Grenze
-- abgewiesen, auch wenn er nur änderte. Darum keine Upserts auf zählende
-- Zeilen (heute upsertet nur der Seed, ohne Besitzer).
select pg_temp.als(pg_temp.id('sammel'));
select pg_temp.geht(pg_temp.uebung(pg_temp.id('sammel')));
select pg_temp.geht(pg_temp.uebung(pg_temp.id('sammel')));
select pg_temp.geht(pg_temp.training(pg_temp.id('sammel')));
select pg_temp.geht(pg_temp.training(pg_temp.id('sammel')));
select pg_temp.erwarte_genau(format($q$insert into exercises (id, slug, name, trainingsteil, aufbau, source, owner_id, visibility)
                                       select id, slug, 'Upsert', trainingsteil, aufbau, source, owner_id, visibility
                                         from exercises where owner_id = %L order by created_at, id limit 1
                                       on conflict (id) do update set name = excluded.name$q$, pg_temp.id('sammel')),
                             'P0001 KONTO_UEBUNGEN_VOLL 50');
select pg_temp.erwarte_genau(format($q$insert into trainings (id, name, owner_id, visibility, altersstufe, stufen)
                                       select id, 'Upsert', owner_id, visibility, altersstufe, stufen
                                         from trainings where owner_id = %L order by created_at, id limit 1
                                       on conflict (id) do update set name = excluded.name$q$, pg_temp.id('sammel')),
                             'P0001 KONTO_TRAININGS_VOLL 30');
select pg_temp.zurueck();
select pg_temp.zaehlt(pg_temp.id('sammel'), 50, 30, 'Upsert an der Grenze: abgewiesen');
do $$ begin
  if exists (select 1 from exercises where owner_id = pg_temp.id('sammel') and name = 'Upsert')
     or exists (select 1 from trainings where owner_id = pg_temp.id('sammel') and name = 'Upsert') then
    raise exception 'Upsert an der Grenze hat geändert';
  end if;
end $$;

-- ── Konto mit Verein: keine Grenze; danach gilt sie wieder (PC 2) ──────────
select pg_temp.bestand(pg_temp.id(x), 50, 30) from unnest(array['mitglied', 'verw', 'aus', 'aufl', 'vl']) x;
do $$
declare
  x text;
begin
  foreach x in array array['mitglied', 'verw', 'aus', 'aufl', 'vl'] loop
    perform pg_temp.als(pg_temp.id(x));
    perform pg_temp.geht(pg_temp.uebung(pg_temp.id(x)));
    perform pg_temp.geht(pg_temp.training(pg_temp.id(x)));
    perform pg_temp.geht(pg_temp.training(pg_temp.id(x)));
    reset role;
    perform pg_temp.zaehlt(pg_temp.id(x), 51, 32, 'mit Verein: ' || x);
  end loop;
end $$;
-- Austritt (Testfall 22: «nach dem Austritt nicht mehr»).
select pg_temp.als(pg_temp.id('aus'));
do $$ begin
  if entferne_team_mitglied(pg_temp.id('t1'), pg_temp.id('aus')) ->> 'status' <> 'entfernt' then
    raise exception 'Austritt gescheitert';
  end if;
end $$;
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('aus')), 'P0001 KONTO_UEBUNGEN_VOLL 51');
select pg_temp.erwarte_genau(pg_temp.training(pg_temp.id('aus')), 'P0001 KONTO_TRAININGS_VOLL 32');
select pg_temp.zurueck();
-- Team auflösen durch die Verwaltung.
select pg_temp.als(pg_temp.id('verw'));
do $$ begin
  if verein_team_aufloesen(pg_temp.id('t2'), 'Konto-Team Zwei') ->> 'status' <> 'aufgeloest' then
    raise exception 'Team auflösen gescheitert';
  end if;
end $$;
select pg_temp.zurueck();
select pg_temp.als(pg_temp.id('aufl'));
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('aufl')), 'P0001 KONTO_UEBUNGEN_VOLL 51');
select pg_temp.erwarte_genau(pg_temp.training(pg_temp.id('aufl')), 'P0001 KONTO_TRAININGS_VOLL 32');
select pg_temp.zurueck();
-- Verein löschen durch die einzige Person.
select pg_temp.als(pg_temp.id('vl'));
do $$ begin
  if verein_loeschen(pg_temp.id('v2'), 'Konto-Verein Zwei') ->> 'status' <> 'geloescht' then
    raise exception 'Verein löschen gescheitert';
  end if;
end $$;
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('vl')), 'P0001 KONTO_UEBUNGEN_VOLL 51');
select pg_temp.zurueck();
select pg_temp.zaehlt(pg_temp.id(x), 51, 32, 'Bestand bleibt: ' || x) from unnest(array['aus', 'aufl', 'vl']) x;
-- Wieder aufgenommen: die 52. gelingt sofort.
insert into team_members (team_id, user_id) values (pg_temp.id('t1'), pg_temp.id('aus'));
select pg_temp.als(pg_temp.id('aus'));
select pg_temp.geht(pg_temp.uebung(pg_temp.id('aus')));
select pg_temp.zurueck();

-- ── Wege der Rollen: KI-Token, Service-Rolle, postgres ──────────────────────
select pg_temp.bestand(pg_temp.id('ki'), 49, 29);
select pg_temp.als(pg_temp.id('ki'), '{"client_id": "ki-client"}');
select pg_temp.geht(pg_temp.uebung(pg_temp.id('ki')));
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('ki')), 'P0001 KONTO_UEBUNGEN_VOLL 50');
select pg_temp.geht(pg_temp.training(pg_temp.id('ki')));
select pg_temp.erwarte_genau(pg_temp.training(pg_temp.id('ki')), 'P0001 KONTO_TRAININGS_VOLL 30');
select pg_temp.zurueck();
select pg_temp.bestand(pg_temp.id('dienst'), 49, 29);
select set_config('request.jwt.claims', '{"role": "service_role"}', true) is not null as claims_dienst \gset
set local role service_role;
select pg_temp.geht(pg_temp.uebung(pg_temp.id('dienst')));
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('dienst')), 'P0001 KONTO_UEBUNGEN_VOLL 50');
select pg_temp.geht(pg_temp.training(pg_temp.id('dienst')));
select pg_temp.erwarte_genau(pg_temp.training(pg_temp.id('dienst')), 'P0001 KONTO_TRAININGS_VOLL 30');
select pg_temp.zurueck();
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('dienst')), 'P0001 KONTO_UEBUNGEN_VOLL 50');

-- ── Kein Abfluss: fremde owner_id ────────────────────────────────────────────
-- «fremd» (ohne Verein, Bestand 0) fügt Zeilen mit der owner_id eines Kontos
-- an der Grenze (dienst), darüber (aufl), mit Verein (mitglied) und mit
-- Bestand 0 (del) ein: immer dieselbe RLS-Abweisung, nie ein Marker.
select pg_temp.als(pg_temp.id('fremd'));
do $$
declare
  x text;
  f text;
begin
  foreach x in array array['dienst', 'aufl', 'mitglied', 'del'] loop
    f := pg_temp.fehler(pg_temp.uebung(pg_temp.id(x)));
    if f is distinct from '42501 new row violates row-level security policy for table "exercises"' then
      raise exception 'Abfluss Übung (%): %', x, f;
    end if;
    f := pg_temp.fehler(pg_temp.training(pg_temp.id(x)));
    if f is distinct from '42501 new row violates row-level security policy for table "trainings"' then
      raise exception 'Abfluss Training (%): %', x, f;
    end if;
  end loop;
end $$;
-- Ebenso mit KI-Token.
select pg_temp.als(pg_temp.id('fremd'), '{"client_id": "ki-client"}');
select pg_temp.erwarte_genau(pg_temp.uebung(pg_temp.id('dienst')),
                             '42501 new row violates row-level security policy for table "exercises"');
select pg_temp.zurueck();
select pg_temp.zaehlt(pg_temp.id('fremd'), 0, 0, 'Abfluss: nichts angelegt');

-- ── Besitzwechsel und Wege, die nichts auslösen dürfen ──────────────────────
-- Team-Training in persönliches Eigentum (direkter UPDATE): zählt wie ein
-- neues eigenes Training. Mitglied: Verein, keine Grenze.
select pg_temp.als(pg_temp.id('mitglied'));
select pg_temp.geht(format('update trainings set owner_id = %L, team_id = null where id = %L',
                           pg_temp.id('mitglied'), pg_temp.id('tr_team')));
select pg_temp.zurueck();
insert into trainings (id, name, team_id, visibility, altersstufe, stufen)
values (pg_temp.id('tr_team2'), 'Team 2', pg_temp.id('t1'), 'private', 'kinderfussball', array['F']);
-- Ohne Verein an der Grenze (dienst: 30): abgewiesen; unter der Grenze: zählt.
select pg_temp.erwarte_genau(format('update trainings set owner_id = %L, team_id = null where id = %L',
                                    pg_temp.id('dienst'), pg_temp.id('tr_team2')), 'P0001 KONTO_TRAININGS_VOLL 30');
select pg_temp.geht(format('update trainings set owner_id = %L, team_id = null where id = %L',
                           pg_temp.id('fremd'), pg_temp.id('tr_team2')));
select pg_temp.zaehlt(pg_temp.id('fremd'), 0, 1, 'Besitzwechsel zählt');
-- Weiterreichen an ein anderes Konto ohne Verein an der Grenze: abgewiesen.
select pg_temp.erwarte_genau(format('update trainings set owner_id = %L where id = %L',
                                    pg_temp.id('dienst'), pg_temp.id('tr_team2')), 'P0001 KONTO_TRAININGS_VOLL 30');
select pg_temp.erwarte_genau(format('update exercises set owner_id = %L where id = (select id from exercises where owner_id = %L limit 1)',
                                    pg_temp.id('dienst'), pg_temp.id('ohne')), 'P0001 KONTO_UEBUNGEN_VOLL 50');
-- Inserts ohne Besitzer (Seed, Team- und Termin-Kopien) laufen auch als
-- postgres ohne Grenze; die Zählung des Mitglieds bleibt.
insert into exercises (slug, name, trainingsteil, aufbau, source, visibility)
select 'kov-seed-' || i, 'Seed', 'ausklang', 'Aufbau', 'manual', 'public' from generate_series(1, 60) i;
insert into trainings (name, team_id, visibility, altersstufe, stufen, termin_training)
select 'Kopie ' || i, pg_temp.id('t1'), 'private', 'kinderfussball', array['F'], i % 2 = 0 from generate_series(1, 40) i;
-- delete_account eines Kontos über der Grenze (öffentliche Zeilen werden
-- anonymisiert: UPDATE auf owner_id null) und FK-SET-NULL beim Löschen des
-- Auth-Kontos.
select pg_temp.bestand(pg_temp.id('del'), 55, 35, 'public');
select pg_temp.bestand(pg_temp.id('fk'), 55, 35, 'public');
select pg_temp.als(pg_temp.id('del'));
do $$ begin
  if delete_account() ->> 'status' <> 'geloescht' then raise exception 'delete_account über der Grenze gescheitert'; end if;
end $$;
select pg_temp.zurueck();
delete from auth.users where id = pg_temp.id('fk');
select pg_temp.zaehlt(pg_temp.id('del'), 0, 0, 'delete_account');
select pg_temp.zaehlt(pg_temp.id('fk'), 0, 0, 'FK SET NULL');
do $$
begin
  if (select count(*) from exercises where owner_id is null and name like 'Alt %') <> 110
     or (select count(*) from trainings where owner_id is null and team_id is null and name like 'Alt %') <> 70 then
    raise exception 'anonymisierte Zeilen nicht wie erwartet';
  end if;
end $$;

-- ── meine_vereinslage().grenzen (PC 3) ──────────────────────────────────────
do $$
declare
  x text;
  v jsonb;
begin
  -- Konten ohne Verein: Bestand und Grenze, auch über der Grenze.
  foreach x in array array['ohne', 'aufl', 'fremd'] loop
    perform pg_temp.als(pg_temp.id(x));
    v := meine_vereinslage();
    reset role;
    if v <> jsonb_build_object('verein', null, 'grenzen', jsonb_build_object(
               'uebungen', jsonb_build_object('bestand', konto_bestand(pg_temp.id(x)) -> 'uebungen', 'max', 50),
               'trainings', jsonb_build_object('bestand', konto_bestand(pg_temp.id(x)) -> 'trainings', 'max', 30))) then
      raise exception 'meine_vereinslage (ohne Verein, %): %', x, v;
    end if;
  end loop;
  perform pg_temp.als(pg_temp.id('aufl'));
  if meine_vereinslage() -> 'grenzen' <> '{"uebungen": {"bestand": 51, "max": 50}, "trainings": {"bestand": 32, "max": 30}}' then
    raise exception 'meine_vereinslage über der Grenze: %', meine_vereinslage();
  end if;
  reset role;
  perform pg_temp.als(pg_temp.id('fremd'), '{"client_id": "ki-client"}');
  if meine_vereinslage() -> 'grenzen' <> '{"uebungen": {"bestand": 0, "max": 50}, "trainings": {"bestand": 1, "max": 30}}' then
    raise exception 'meine_vereinslage mit KI-Token: %', meine_vereinslage();
  end if;
  reset role;
  -- Mit Verein (Team, nur Verwaltung, wieder aufgenommen): keine Grenzen.
  foreach x in array array['mitglied', 'verw', 'aus'] loop
    perform pg_temp.als(pg_temp.id(x));
    v := meine_vereinslage();
    reset role;
    if v -> 'verein' = 'null' or v -> 'grenzen' <> 'null' then
      raise exception 'meine_vereinslage (mit Verein, %): %', x, v;
    end if;
  end loop;
end $$;

-- ── AK 9: Team-Ort nur für Personen in einem Team ──────────────────────────
-- «ohne» (auch mit KI-Token) und «verw» (Verwaltung ohne Team) sehen am
-- Team-Ort nichts; die Verwaltung behält den Verein-Ort.
do $$
declare
  x text;
  k jsonb;
begin
  foreach x in array array['ohne', 'ohne+ki', 'verw'] loop
    k := case when x like '%+ki' then '{"client_id": "ki-client"}' else '{}' end;
    perform pg_temp.als(pg_temp.id(split_part(x, '+', 1)), k);
    if exists (select 1 from teams where id = pg_temp.id('t1'))
       or exists (select 1 from team_members where team_id = pg_temp.id('t1'))
       or exists (select 1 from team_spieler where team_id = pg_temp.id('t1'))
       or exists (select 1 from spieler where id = pg_temp.id('sp'))
       or exists (select 1 from training_termine where team_id = pg_temp.id('t1'))
       or exists (select 1 from kalender_abos where team_id = pg_temp.id('t1'))
       or exists (select 1 from trainings where team_id = pg_temp.id('t1'))
       or exists (select 1 from meine_team_ids() t where t = pg_temp.id('t1')) then
      raise exception 'AK 9 (%): Team-Inhalte sichtbar', x;
    end if;
    perform pg_temp.erwarte(format('select team_mitglieder(%L)', pg_temp.id('t1')), 'not a member of this team');
    perform pg_temp.erwarte(format($q$select spieler_aufnehmen(%L, 'Neu', 'Neu', 2015, null)$q$, pg_temp.id('t1')),
                            'TEAM_NICHT_GEFUNDEN');
    perform pg_temp.erwarte(format($q$select termin_kader_setzen(%L, '{}')$q$, pg_temp.id('termin')), 'TERMIN_NICHT_GEFUNDEN');
    perform pg_temp.erwarte(format('select kalender_abo_holen(%L)', pg_temp.id('t1')), 'TEAM_NICHT_GEFUNDEN');
    perform pg_temp.erwarte(format('select add_team_member(%L, %L)', pg_temp.id('t1'), 'fremd@konten-ohne-verein.test'),
                            'not a member');
    reset role;
  end loop;
  -- Verein-Ort: Konto ohne Verein nicht, Verwaltung ohne Team schon.
  perform pg_temp.als(pg_temp.id('ohne'));
  perform pg_temp.erwarte(format('select verein_spielerliste(%L)', pg_temp.id('v1')), 'VEREIN_NICHT_GEFUNDEN');
  perform pg_temp.erwarte(format('select verein_team_ansicht(%L)', pg_temp.id('t1')), 'VEREIN_NICHT_GEFUNDEN');
  reset role;
  perform pg_temp.als(pg_temp.id('verw'));
  perform pg_temp.geht(format('select verein_spielerliste(%L)', pg_temp.id('v1')));
  perform pg_temp.geht(format('select verein_team_ansicht(%L)', pg_temp.id('t1')));
  reset role;
  -- Gegenprobe: das Mitglied sieht sein Team.
  perform pg_temp.als(pg_temp.id('mitglied'));
  if not exists (select 1 from training_termine where team_id = pg_temp.id('t1'))
     or not exists (select 1 from spieler where id = pg_temp.id('sp')) then
    raise exception 'AK 9 Gegenprobe: Mitglied sieht sein Team nicht';
  end if;
  reset role;
end $$;

-- ── Testfall 26: Grants ─────────────────────────────────────────────────────
do $$
declare
  f text;
  r text;
begin
  foreach f in array array['konto_grenze(text)', 'konto_anzahl(uuid,text)', 'konto_bestand(uuid)', 'konto_grenze_vorher()'] loop
    foreach r in array array['anon', 'authenticated'] loop
      if has_function_privilege(r, f, 'execute') then
        raise exception 'Testfall 26: % darf % ausführen', r, f;
      end if;
    end loop;
  end loop;
  if has_function_privilege('anon', 'meine_vereinslage()', 'execute')
     or not has_function_privilege('authenticated', 'meine_vereinslage()', 'execute') then
    raise exception 'Testfall 26: Grant von meine_vereinslage falsch';
  end if;
  -- Die Triggerfunktion läuft als Eigentümerin (liest Vereinslage und
  -- Bestand unabhängig von der RLS) mit festem search_path.
  if not (select prosecdef from pg_proc where oid = 'konto_grenze_vorher()'::regprocedure)
     or not exists (select 1 from pg_proc where oid = 'konto_grenze_vorher()'::regprocedure
                     and proconfig @> array['search_path=public, pg_temp']) then
    raise exception 'konto_grenze_vorher: nicht security definer mit festem search_path';
  end if;
end $$;
select pg_temp.als(pg_temp.id('ohne'));
select pg_temp.erwarte(format('select konto_bestand(%L)', pg_temp.id('gross')), '42501');
select pg_temp.erwarte($$select konto_grenze('uebungen')$$, '42501');
select pg_temp.zurueck();

rollback;
