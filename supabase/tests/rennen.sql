-- Rennen deterministisch prüfen (Architekturplan Vereine §5.5): zuerst ein
-- Selbsttest des dblink-Musters. Er beweist, dass zwei Verbindungen sich in
-- dieser Datenbank verlässlich verschränken lassen. Danach die fachlichen
-- Fälle (ab Story 1: Teamgrenze 100 unter der Vereinssperre).
--
-- Muster für «gleichzeitig, genau eines gelingt» (spätere Stories bauen ihre
-- Fälle als weitere Blöcke nach diesem Vorbild):
--   1. Verbindung A: `begin`, erster Vorgang, Transaktion offen lassen.
--      A hält damit die Sperre.
--   2. Verbindung B: zweiter Vorgang per `dblink_send_query` (asynchron).
--   3. Zustandsbasiert warten, bis `pg_stat_activity` B (erkannt über
--      `application_name`) mit `wait_event_type = 'Lock'` zeigt. Erst dann ist
--      die Verschränkung erzwungen statt erhofft. Schleife mit
--      `pg_stat_clear_snapshot()`, kurzem `pg_sleep` und Zeitlimit.
--   4. A `commit`, dann B mit `dblink_get_result(b, false)` abholen: ein Fehler
--      von B kommt dabei als NOTICE und ist danach über
--      `dblink_error_message(b)` lesbar (Marker bzw. Status prüfen). Ein
--      zweiter `dblink_get_result` schliesst die Abfrage ab.
--   5. In der Tabelle prüfen, dass genau ein Ergebnis steht.
-- Hier: A und B legen denselben Schlüssel an; B wartet auf A, scheitert nach
-- dem Commit am Primärschlüssel, und es bleibt genau eine Zeile.
--
-- Rahmen:
-- - Die Extension `dblink` legt dieser Test an (Schema `extensions`) und
--   entfernt sie am Ende wieder, sofern sie vorher nicht da war. Nie in einer
--   Migration.
-- - Die Verbindungen gehen mit Passwort an die Adresse, über die diese Sitzung
--   angenommen wurde (`inet_server_addr()`, im Supabase-Container die
--   Docker-Adresse, Port 5432 innen). Grund: Über 127.0.0.1 lässt pg_hba ohne
--   Passwort zu (trust), und dblink verweigert Nicht-Superusern Verbindungen,
--   bei denen der Server kein Passwort verlangt. Passwort ist das der lokalen
--   Supabase-DB (`postgres`); der Test ist nur für die lokale bzw.
--   Wegwerf-DB gedacht.
-- - Testobjekte liegen im eigenen Schema `rennen_test`, das am Ende fällt.
--   Die Verbindungen werden auch im Fehlerfall geschlossen; ein Fehler wird
--   erst nach dem Aufräumen gemeldet. Das gilt auch für einen Abbruch durch
--   `statement_timeout` oder Ctrl-C (`query_canceled`, das `others` nicht
--   einschliesst, wird eigens gefangen).
-- - Zeitgrenzen: innen je Verbindung `connect_timeout=5`, die Warteschleife
--   10 s, B selbst `statement_timeout=30s`; zusammen höchstens rund 50 s. Das
--   Sitzungs-`statement_timeout` von 120 s liegt darüber und ist nur die
--   Notbremse für Unvorhergesehenes; es greift nicht vor den eigenen Grenzen.
-- - Reste bleiben nur bei hartem Abbruch (Verbindungsverlust, beendeter
--   psql- oder Runner-Prozess) zwischen Anlegen und Aufräumen: dann bleiben
--   das Schema `rennen_test` (der nächste Lauf räumt es zu Beginn weg) und
--   eine vom Test angelegte Extension `dblink` (der nächste Lauf hält sie
--   für vorher vorhanden und lässt sie stehen; von Hand `drop extension
--   dblink`). Die fachlichen Fälle committen Zeilen in `public`; was dort
--   nach einem harten Abbruch bleibt, nennt der Kopf des Falls. Die
--   dblink-Verbindungen enden mit der Sitzung, eine offene Transaktion von A
--   rollt dabei zurück.

\set ON_ERROR_STOP on
set statement_timeout = '120s';

select exists (select 1 from pg_extension where extname = 'dblink') as dblink_vorher \gset

begin;
create extension if not exists dblink with schema extensions;
drop schema if exists rennen_test cascade;
create schema rennen_test;
create table rennen_test.eintraege (schluessel int primary key, von text not null);
commit;

select set_config('rennen.fehler', '', false) is not null as rennen_fehler_leer \gset

do $$
declare
  ziel   text := format(
    'host=%s port=%s dbname=%s user=postgres password=postgres connect_timeout=5 options=''-c statement_timeout=30s''',
    coalesce(host(inet_server_addr()), '127.0.0.1'), inet_server_port(), current_database());
  frist  timestamptz;
  ergebnis text;
  meldung text;
  anzahl int;
  n      text;
begin
  perform extensions.dblink_connect('rennen_a', ziel || ' application_name=rennen_a');
  perform extensions.dblink_connect('rennen_b', ziel || ' application_name=rennen_b');

  -- 1. A hält die Sperre in offener Transaktion.
  perform extensions.dblink_exec('rennen_a', 'begin');
  perform extensions.dblink_exec('rennen_a',
    $q$insert into rennen_test.eintraege values (1, 'A')$q$);

  -- 2. B asynchron absetzen.
  perform extensions.dblink_send_query('rennen_b',
    $q$insert into rennen_test.eintraege values (1, 'B')$q$);

  -- 3. Warten, bis B nachweislich auf die Sperre von A wartet.
  frist := clock_timestamp() + interval '10 seconds';
  loop
    perform pg_stat_clear_snapshot();
    exit when exists (
      select 1 from pg_stat_activity
       where application_name = 'rennen_b' and wait_event_type = 'Lock');
    if clock_timestamp() > frist then
      raise exception 'B wartet nach 10 s nicht auf eine Sperre (pg_stat_activity zeigt kein wait_event_type = Lock)';
    end if;
    perform pg_sleep(0.05);
  end loop;

  -- 4. A gibt frei, B wird abgeholt.
  perform extensions.dblink_exec('rennen_a', 'commit');
  select t.status into ergebnis
    from extensions.dblink_get_result('rennen_b', false) as t(status text);
  meldung := extensions.dblink_error_message('rennen_b');
  perform * from extensions.dblink_get_result('rennen_b', false) as t(status text);

  if ergebnis is not null or position('eintraege_pkey' in meldung) = 0 then
    raise exception 'B hätte am Primärschlüssel scheitern müssen (Status: %, Meldung: %)', ergebnis, meldung;
  end if;

  -- 5. Genau ein Ergebnis, und zwar das von A.
  select count(*) into anzahl from rennen_test.eintraege where schluessel = 1 and von = 'A';
  if anzahl <> 1 or (select count(*) from rennen_test.eintraege) <> 1 then
    raise exception 'Erwartet genau eine Zeile von A, gefunden: %', (select count(*) from rennen_test.eintraege);
  end if;

  perform extensions.dblink_disconnect('rennen_a');
  perform extensions.dblink_disconnect('rennen_b');
exception when others or query_canceled then
  -- Verbindungen schliessen (eine offene Transaktion von A rollt dabei zurück)
  -- und den Fehler für die Meldung nach dem Aufräumen merken.
  foreach n in array coalesce(extensions.dblink_get_connections(), '{}') loop
    perform extensions.dblink_disconnect(n);
  end loop;
  perform set_config('rennen.fehler', sqlerrm, false);
end $$;

-- ── Fall: Teamgrenze 100 unter der Vereinssperre (Story 1 #577, AP §3.3 c) ──
-- Das Team hat 99 Zuordnungen. A nimmt die 100. Spieler:in auf und hält die
-- Transaktion offen; B will gleichzeitig eine weitere aufnehmen und wartet an
-- der Vereinssperre (`spieler_vorher`, Sperrordnung Verein → Team → Zeile).
-- Nach dem Commit von A scheitert B mit SPIELERLISTE_VOLL; es bleiben genau
-- 100 Zuordnungen. Die Testzeilen sind committet (zwei Verbindungen) und
-- werden danach mit Team und Verein wieder entfernt; ein harter Abbruch lässt
-- den Verein «Rennen-Verein» samt Team stehen (von Hand löschen).

select set_config('rennen.fehler_grenze', '', false) is not null as rennen_fehler_grenze_leer \gset

begin;
create table rennen_test.ids (name text primary key, id uuid not null default gen_random_uuid());
insert into rennen_test.ids (name) values ('verein'), ('team');
insert into vereine (id, name) select id, 'Rennen-Verein' from rennen_test.ids where name = 'verein';
insert into teams (id, name, verein_id)
select (select id from rennen_test.ids where name = 'team'), 'Rennen-Team', (select id from rennen_test.ids where name = 'verein');
create function rennen_test.aufnehmen(p_name text) returns void
language plpgsql as $f$
declare
  v_verein uuid := (select id from rennen_test.ids where name = 'verein');
  v_team uuid := (select id from rennen_test.ids where name = 'team');
  v_id uuid;
begin
  insert into public.spieler (team_id, verein_id, vorname, nachname, jahrgang)
    values (v_team, v_verein, 'Rennen', p_name, 2015) returning id into v_id;
  insert into public.team_spieler (team_id, spieler_id, verein_id) values (v_team, v_id, v_verein);
end $f$;
do $$ begin for i in 1..99 loop perform rennen_test.aufnehmen('Nr ' || i); end loop; end $$;
commit;

do $$
declare
  ziel   text := format(
    'host=%s port=%s dbname=%s user=postgres password=postgres connect_timeout=5 options=''-c statement_timeout=30s''',
    coalesce(host(inet_server_addr()), '127.0.0.1'), inet_server_port(), current_database());
  v_team uuid := (select id from rennen_test.ids where name = 'team');
  frist  timestamptz;
  ergebnis text;
  meldung text;
  n      text;
begin
  perform extensions.dblink_connect('rennen_a', ziel || ' application_name=rennen_a');
  perform extensions.dblink_connect('rennen_b', ziel || ' application_name=rennen_b');

  -- 1. A nimmt die 100. auf und hält Vereins- und Teamsperre.
  perform extensions.dblink_exec('rennen_a', 'begin');
  perform * from extensions.dblink('rennen_a', $q$select rennen_test.aufnehmen('A')$q$) as t(x text);

  -- 2. B asynchron.
  perform extensions.dblink_send_query('rennen_b', $q$select rennen_test.aufnehmen('B')$q$);

  -- 3. Warten, bis B nachweislich auf eine Sperre wartet.
  frist := clock_timestamp() + interval '10 seconds';
  loop
    perform pg_stat_clear_snapshot();
    exit when exists (
      select 1 from pg_stat_activity
       where application_name = 'rennen_b' and wait_event_type = 'Lock');
    if clock_timestamp() > frist then
      raise exception 'B wartet nach 10 s nicht auf eine Sperre';
    end if;
    perform pg_sleep(0.05);
  end loop;

  -- 4. A gibt frei, B scheitert an der Grenze.
  perform extensions.dblink_exec('rennen_a', 'commit');
  select t.status into ergebnis
    from extensions.dblink_get_result('rennen_b', false) as t(status text);
  meldung := extensions.dblink_error_message('rennen_b');
  perform * from extensions.dblink_get_result('rennen_b', false) as t(status text);

  if position('SPIELERLISTE_VOLL' in coalesce(meldung, '')) = 0 then
    raise exception 'B hätte mit SPIELERLISTE_VOLL scheitern müssen (Status: %, Meldung: %)', ergebnis, meldung;
  end if;

  -- 5. Genau 100 Zuordnungen, A dabei, B nicht.
  if (select count(*) from team_spieler where team_id = v_team) <> 100
     or not exists (select 1 from spieler where team_id = v_team and nachname = 'A')
     or exists (select 1 from spieler where team_id = v_team and nachname = 'B') then
    raise exception 'Erwartet genau 100 Zuordnungen samt A und ohne B, gefunden: %',
      (select count(*) from team_spieler where team_id = v_team);
  end if;

  perform extensions.dblink_disconnect('rennen_a');
  perform extensions.dblink_disconnect('rennen_b');
exception when others or query_canceled then
  foreach n in array coalesce(extensions.dblink_get_connections(), '{}') loop
    perform extensions.dblink_disconnect(n);
  end loop;
  perform set_config('rennen.fehler_grenze', sqlerrm, false);
end $$;

-- Testzeilen entfernen: das Team nimmt Spieler:innen und Zuordnungen mit.
delete from teams where id = (select id from rennen_test.ids where name = 'team');
delete from vereine where id = (select id from rennen_test.ids where name = 'verein');

-- Aufräumen, auch nach einem Fehler.
drop schema rennen_test cascade;
\if :dblink_vorher
\else
drop extension dblink;
\endif

do $$
begin
  if current_setting('rennen.fehler') <> '' then
    raise exception 'Rennen-Selbsttest: %', current_setting('rennen.fehler');
  end if;
  if current_setting('rennen.fehler_grenze') <> '' then
    raise exception 'Rennen Teamgrenze: %', current_setting('rennen.fehler_grenze');
  end if;
end $$;
