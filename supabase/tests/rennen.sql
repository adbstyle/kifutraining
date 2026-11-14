-- Rennen deterministisch prüfen (Architekturplan Vereine §5.5): zuerst ein
-- Selbsttest des dblink-Musters. Er beweist, dass zwei Verbindungen sich in
-- dieser Datenbank verlässlich verschränken lassen. Danach die fachlichen
-- Fälle (Story 1: Teamgrenze 100 unter der Vereinssperre; Story 2:
-- Doppelerfassung im Verein beim Erfassen und Ändern; Story 3: Zuordnen und
-- Herausnehmen).
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

-- Testzeilen entfernen: das Team nimmt die Zuordnungen mit, die Spieler:innen
-- bleiben im Verein (Story 3) und gehen eigens.
delete from teams where id = (select id from rennen_test.ids where name = 'team');
delete from spieler where verein_id = (select id from rennen_test.ids where name = 'verein');   -- bleiben seit Story 3 im Verein
delete from vereine where id = (select id from rennen_test.ids where name = 'verein');

-- ── Fall: Doppelerfassung im Verein (Story 2 #578 AK 8, AP §3.3 a, Testfall 6) ──
-- Trainer:in A (Team 1) und B (Team 2) desselben Vereins handeln über die RPCs
-- wie PostgREST (Rolle `authenticated`, `request.jwt.claims`). A erfasst und
-- hält die Transaktion offen; B erfasst (a) bzw. ändert (b) gleichzeitig zu
-- denselben Angaben und wartet an der Vereinssperre. In (c) ändert A zuerst
-- eine Spieler:in aus Team 1, und B erfasst dieselben Angaben in Team 2. Nach
-- dem Commit von A antwortet B mit dem Status `doppelt` samt Team 1, und im
-- Verein steht der Schlüssel genau einmal. Die Testzeilen sind committet; ein harter Abbruch
-- lässt den Verein «Rennen-Doppelt» samt Teams und die Konten
-- «rennen-a/-b@rennen.test» stehen (von Hand löschen).

select set_config('rennen.fehler_doppelt', '', false) is not null as rennen_fehler_doppelt_leer \gset

begin;
insert into rennen_test.ids (name) values ('d_verein'), ('d_team1'), ('d_team2'), ('d_a'), ('d_b'), ('d_ella');
insert into auth.users (id, email, email_confirmed_at)
select id, case name when 'd_a' then 'rennen-a@rennen.test' else 'rennen-b@rennen.test' end, now()
  from rennen_test.ids where name in ('d_a', 'd_b');
insert into vereine (id, name) select id, 'Rennen-Doppelt' from rennen_test.ids where name = 'd_verein';
insert into teams (id, name, verein_id)
select id, case name when 'd_team1' then 'Rennen-Team-1' else 'Rennen-Team-2' end,
       (select id from rennen_test.ids where name = 'd_verein')
  from rennen_test.ids where name in ('d_team1', 'd_team2');
insert into team_members (team_id, user_id) values
  ((select id from rennen_test.ids where name = 'd_team1'), (select id from rennen_test.ids where name = 'd_a')),
  ((select id from rennen_test.ids where name = 'd_team2'), (select id from rennen_test.ids where name = 'd_b'));
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang)
select (select id from rennen_test.ids where name = 'd_ella'), (select id from rennen_test.ids where name = 'd_team2'),
       (select id from rennen_test.ids where name = 'd_verein'), 'Ella', 'Rennen', 2015;
insert into team_spieler (team_id, spieler_id, verein_id)
select (select id from rennen_test.ids where name = 'd_team2'), (select id from rennen_test.ids where name = 'd_ella'),
       (select id from rennen_test.ids where name = 'd_verein');

-- A führt p_a aus und hält die Transaktion offen, B setzt p_b ab; sobald B
-- nachweislich auf eine Sperre wartet (mit p_warte_auf: auf eine Sperre dieser
-- Art, `wait_event`), committet A. Liefert das Ergebnis von B als Text, oder
-- «FEHLER: …». Schliesst die Verbindungen in jedem Fall.
create function rennen_test.verschraenkt(p_ziel text, p_a uuid, p_sql_a text, p_b uuid, p_sql_b text,
                                         p_warte_auf text default null) returns text
language plpgsql as $f$
declare
  frist timestamptz;
  ergebnis text;
  meldung text;
  n text;
begin
  perform extensions.dblink_connect('rennen_a', p_ziel || ' application_name=rennen_a');
  perform extensions.dblink_connect('rennen_b', p_ziel || ' application_name=rennen_b');
  perform extensions.dblink_exec('rennen_a', 'begin');
  perform extensions.dblink_exec('rennen_a', 'set local role authenticated');
  perform * from extensions.dblink('rennen_a', format($q$select set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', p_a, 'role', 'authenticated')::text)) as t(x text);
  perform * from extensions.dblink('rennen_a', p_sql_a) as t(x text);

  perform extensions.dblink_exec('rennen_b', 'begin');
  perform extensions.dblink_exec('rennen_b', 'set local role authenticated');
  perform * from extensions.dblink('rennen_b', format($q$select set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', p_b, 'role', 'authenticated')::text)) as t(x text);
  perform extensions.dblink_send_query('rennen_b', p_sql_b);

  frist := clock_timestamp() + interval '10 seconds';
  loop
    perform pg_stat_clear_snapshot();
    exit when exists (
      select 1 from pg_stat_activity
       where application_name = 'rennen_b' and wait_event_type = 'Lock'
         and (p_warte_auf is null or wait_event = p_warte_auf));
    if clock_timestamp() > frist then
      raise exception 'B wartet nach 10 s nicht auf eine Sperre%', coalesce(' der Art ' || p_warte_auf, '');
    end if;
    perform pg_sleep(0.05);
  end loop;

  perform extensions.dblink_exec('rennen_a', 'commit');
  select t.x into ergebnis from extensions.dblink_get_result('rennen_b', false) as t(x text);
  meldung := extensions.dblink_error_message('rennen_b');
  perform * from extensions.dblink_get_result('rennen_b', false) as t(x text);
  perform extensions.dblink_exec('rennen_b', case when ergebnis is null then 'rollback' else 'commit' end);
  perform extensions.dblink_disconnect('rennen_a');
  perform extensions.dblink_disconnect('rennen_b');
  return coalesce(ergebnis, 'FEHLER: ' || meldung);
exception when others or query_canceled then
  foreach n in array coalesce(extensions.dblink_get_connections(), '{}') loop
    perform extensions.dblink_disconnect(n);
  end loop;
  raise;
end $f$;
commit;

do $$
declare
  ziel   text := format(
    'host=%s port=%s dbname=%s user=postgres password=postgres connect_timeout=5 options=''-c statement_timeout=30s''',
    coalesce(host(inet_server_addr()), '127.0.0.1'), inet_server_port(), current_database());
  v_verein uuid := (select id from rennen_test.ids where name = 'd_verein');
  v_team1 uuid := (select id from rennen_test.ids where name = 'd_team1');
  v_team2 uuid := (select id from rennen_test.ids where name = 'd_team2');
  v_a uuid := (select id from rennen_test.ids where name = 'd_a');
  v_b uuid := (select id from rennen_test.ids where name = 'd_b');
  v_ella uuid := (select id from rennen_test.ids where name = 'd_ella');
  c_erwartet constant jsonb := '{"status": "abgewiesen", "grund": "doppelt", "eigenes_team": false, "teams": ["Rennen-Team-1"], "ohne_team": false}';
  ergebnis text;
  v_doppelt uuid;
begin
  -- (a) Erfassen gegen Erfassen, in zwei Teams.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_a, format($q$select spieler_aufnehmen(%L, 'Rennen', 'Doppelt', 2015, null)::text$q$, v_team1),
    v_b, format($q$select spieler_aufnehmen(%L, 'rennen', 'DOPPELT', 2015, null)::text$q$, v_team2));
  if ergebnis is null or left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb <> c_erwartet then
    raise exception '(a) B hätte mit dem Status doppelt samt Team 1 abgewiesen werden müssen: %', ergebnis;
  end if;
  if (select count(*) from spieler where verein_id = v_verein and nachname ilike 'doppelt') <> 1 then
    raise exception '(a) Erwartet genau eine Spieler:in, gefunden: %',
      (select count(*) from spieler where verein_id = v_verein and nachname ilike 'doppelt');
  end if;

  -- (b) Erfassen gegen Ändern: B ändert Ella zu denselben Angaben.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_a, format($q$select spieler_aufnehmen(%L, 'Rennen', 'Zwei', 2015, null)::text$q$, v_team1),
    v_b, format($q$select spieler_aendern(%L, %L, 'Rennen', 'Zwei', 2015, null)::text$q$, v_team2, v_ella));
  if ergebnis is null or left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb <> c_erwartet then
    raise exception '(b) B hätte mit dem Status doppelt samt Team 1 abgewiesen werden müssen: %', ergebnis;
  end if;
  if (select count(*) from spieler where verein_id = v_verein and nachname = 'Zwei') <> 1
     or (select nachname from spieler where id = v_ella) <> 'Rennen' then
    raise exception '(b) Erwartet genau eine «Rennen Zwei» und Ella unverändert';
  end if;

  -- (c) Ändern gegen Erfassen: A ändert «Rennen Doppelt» aus (a) und hält die
  -- Vereinssperre; B erfasst dieselben neuen Angaben in Team 2.
  select id into v_doppelt from spieler where verein_id = v_verein and nachname ilike 'doppelt';
  ergebnis := rennen_test.verschraenkt(ziel,
    v_a, format($q$select spieler_aendern(%L, %L, 'Rennen', 'Drei', 2015, null)::text$q$, v_team1, v_doppelt),
    v_b, format($q$select spieler_aufnehmen(%L, 'RENNEN', 'drei', 2015, null)::text$q$, v_team2));
  if ergebnis is null or left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb <> c_erwartet then
    raise exception '(c) B hätte mit dem Status doppelt samt Team 1 abgewiesen werden müssen: %', ergebnis;
  end if;
  if (select count(*) from spieler where verein_id = v_verein and nachname ilike 'drei') <> 1
     or (select nachname from spieler where id = v_doppelt) <> 'Drei' then
    raise exception '(c) Erwartet genau eine «Rennen Drei», und zwar die von A geänderte';
  end if;
exception when others or query_canceled then
  perform set_config('rennen.fehler_doppelt', sqlerrm, false);
end $$;

delete from teams where id in (select id from rennen_test.ids where name in ('d_team1', 'd_team2'));
delete from spieler where verein_id = (select id from rennen_test.ids where name = 'd_verein');
delete from vereine where id = (select id from rennen_test.ids where name = 'd_verein');
delete from auth.users where id in (select id from rennen_test.ids where name in ('d_a', 'd_b'));

-- ── Fälle: Zuordnen und Herausnehmen (Story 3 #579 AK 8, Testfall 29, AP §3.3 c–e) ──
-- Verein «Rennen-Zuordnen» mit Verwaltung (ohne Team) und Trainer:in A in
-- Team 1. Über die RPCs wie PostgREST, mit rennen_test.verschraenkt.
-- (a) AK 8, Grenze: Team 2 hat 99; die Verwaltung ordnet in zwei Verbindungen
--     je eine Spieler:in zu. B wartet an der Vereinssperre und wird danach mit
--     ueber_grenze = 1 abgewiesen; es bleiben 100.
-- (b) AK 8, dieselbe Spieler:in zweimal ins Team 3: B antwortet mit `bereits`.
-- (c) Teamsperre in team_spieler_vorher: Team 1 hat 100. A nimmt eine
--     Spieler:in heraus und hält nur Team- und Zeilensperre; B ordnet direkt
--     (ohne RPC, ohne eigene Sperre) eine weitere zu und wartet an der
--     Teamsperre des Triggers. Nach dem Commit von A sieht B 99 und gelingt;
--     ohne die Sperre sähe B die 100 und scheiterte (bzw. wartete nicht).
-- (d) Testfall 29: Die Verwaltung ordnet w gleichzeitig Team 3 zu, während A
--     w mit dem Stand aus der Auskunft aus Team 1 nimmt. A wartet an der
--     `spieler`-Zeile und antwortet nach dem Zuordnen mit `stand_geaendert`;
--     w steht danach in Team 1 und Team 3.
-- (e) Auflösen unter der Teamsperre (Zyklus mit dem Herausnehmen, 40P01): A
--     hält die Teamsperre von Team 5 und die Zeile seines Termins (wie das
--     Herausnehmen in termine_einfrieren), B löst Team 5 auf. B muss an der
--     Teamsperre warten (`advisory`), nicht am Termin: Sonst hätte B die
--     Termine schon angefasst, bevor es die Teamsperre nimmt.
-- (f) Dasselbe beim Austritt des letzten Mitglieds aus Team 6
--     (entferne_team_mitglied, Trigger team_aufloesen_wenn_leer).
-- Ein harter Abbruch lässt den Verein «Rennen-Zuordnen» samt Teams,
-- Spieler:innen und die Konten «rennen-z…@rennen.test» stehen (von Hand löschen).

select set_config('rennen.fehler_zuordnen', '', false) is not null as rennen_fehler_zuordnen_leer \gset

begin;
insert into rennen_test.ids (name) values ('z_verein'), ('z_t1'), ('z_t2'), ('z_t3'), ('z_t5'), ('z_t6'), ('z_verw'), ('z_a'),
  ('z_x1'), ('z_x2'), ('z_y'), ('z_r'), ('z_q'), ('z_w');
create function rennen_test.z(p text) returns uuid language sql stable as $f$ select id from rennen_test.ids where name = p $f$;
insert into auth.users (id, email, email_confirmed_at)
select id, 'rennen-' || replace(name, '_', '-') || '@rennen.test', now() from rennen_test.ids where name in ('z_verw', 'z_a');
insert into vereine (id, name) values (rennen_test.z('z_verein'), 'Rennen-Zuordnen');
insert into verein_verwaltung (verein_id, user_id) values (rennen_test.z('z_verein'), rennen_test.z('z_verw'));
insert into teams (id, name, verein_id) values
  (rennen_test.z('z_t1'), 'Zuordnen-Team-1', rennen_test.z('z_verein')),
  (rennen_test.z('z_t2'), 'Zuordnen-Team-2', rennen_test.z('z_verein')),
  (rennen_test.z('z_t3'), 'Zuordnen-Team-3', rennen_test.z('z_verein')),
  (rennen_test.z('z_t5'), 'Zuordnen-Team-5', rennen_test.z('z_verein')),
  (rennen_test.z('z_t6'), 'Zuordnen-Team-6', rennen_test.z('z_verein'));
insert into team_members (team_id, user_id) values (rennen_test.z('z_t1'), rennen_test.z('z_a')),
  (rennen_test.z('z_t5'), rennen_test.z('z_a')), (rennen_test.z('z_t6'), rennen_test.z('z_a'));
-- Spieler:in anlegen, optional mit Zuordnung (echte Trigger).
create function rennen_test.zneu(p_id uuid, p_nachname text, p_team uuid) returns void
language plpgsql as $f$
begin
  insert into public.spieler (id, verein_id, vorname, nachname, jahrgang)
    values (p_id, rennen_test.z('z_verein'), 'Zuordnen', p_nachname, 2015);
  if p_team is not null then
    insert into public.team_spieler (team_id, spieler_id, verein_id) values (p_team, p_id, rennen_test.z('z_verein'));
  end if;
end $f$;
select rennen_test.zneu(gen_random_uuid(), 'Zwei ' || i, rennen_test.z('z_t2')) from generate_series(1, 99) i;
select rennen_test.zneu(gen_random_uuid(), 'Eins ' || i, rennen_test.z('z_t1')) from generate_series(1, 97) i;
select rennen_test.zneu(rennen_test.z('z_r'), 'R', rennen_test.z('z_t1'));
select rennen_test.zneu(rennen_test.z('z_w'), 'W', rennen_test.z('z_t1'));
select rennen_test.zneu(rennen_test.z('z_x1'), 'X1', null);
select rennen_test.zneu(rennen_test.z('z_x2'), 'X2', null);
select rennen_test.zneu(rennen_test.z('z_y'), 'Y', rennen_test.z('z_t1'));   -- Team 1 hat 100
select rennen_test.zneu(rennen_test.z('z_q'), 'Q', null);
insert into training_termine (team_id, datum, beginn, ende)
select rennen_test.z(t), current_date + 7, '18:00', '19:30' from unnest(array['z_t5', 'z_t6']) t;
-- B ohne RPC: Zuordnung direkt, als Eigentümer (DEFINER; nur der Trigger sperrt).
create function rennen_test.direkt(p_team uuid, p_spieler uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  insert into public.team_spieler (team_id, spieler_id, verein_id) values (p_team, p_spieler, rennen_test.z('z_verein'));
  return 'ok';
end $f$;
-- A hält die Teamsperre und die Termine des Teams (Fälle e, f).
create function rennen_test.sperre(p_team uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  perform sperre_teams(array[p_team]);
  perform 1 from training_termine where team_id = p_team for update;
  return 'ok';
end $f$;
grant usage on schema rennen_test to authenticated;
grant execute on function rennen_test.direkt(uuid, uuid), rennen_test.sperre(uuid), rennen_test.z(text) to authenticated;
commit;

do $$
declare
  ziel   text := format(
    'host=%s port=%s dbname=%s user=postgres password=postgres connect_timeout=5 options=''-c statement_timeout=30s''',
    coalesce(host(inet_server_addr()), '127.0.0.1'), inet_server_port(), current_database());
  v_verw uuid := rennen_test.z('z_verw');
  v_a uuid := rennen_test.z('z_a');
  v_t1 uuid := rennen_test.z('z_t1');
  v_t2 uuid := rennen_test.z('z_t2');
  v_t3 uuid := rennen_test.z('z_t3');
  v_stand text;
  ergebnis text;
begin
  -- (a) Grenze.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_verw, format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])::text', v_t2, rennen_test.z('z_x1')),
    v_verw, format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])::text', v_t2, rennen_test.z('z_x2')));
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'status' <> 'abgewiesen' or ergebnis::jsonb ->> 'ueber_grenze' <> '1' then
    raise exception '(a) B hätte mit ueber_grenze = 1 abgewiesen werden müssen: %', ergebnis;
  end if;
  if (select count(*) from team_spieler where team_id = v_t2) <> 100
     or not exists (select 1 from team_spieler where team_id = v_t2 and spieler_id = rennen_test.z('z_x1')) then
    raise exception '(a) Erwartet 100 Zuordnungen samt X1, gefunden: %', (select count(*) from team_spieler where team_id = v_t2);
  end if;

  -- (b) Dieselbe Spieler:in zweimal.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_verw, format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])::text', v_t3, rennen_test.z('z_x2')),
    v_verw, format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])::text', v_t3, rennen_test.z('z_x2')));
  if left(ergebnis, 7) = 'FEHLER:' or jsonb_array_length(ergebnis::jsonb -> 'bereits') <> 1 then
    raise exception '(b) B hätte mit bereits abgewiesen werden müssen: %', ergebnis;
  end if;
  if (select count(*) from team_spieler where team_id = v_t3 and spieler_id = rennen_test.z('z_x2')) <> 1 then
    raise exception '(b) Zuordnung nicht genau einmal';
  end if;

  -- (c) Teamsperre im Trigger.
  v_stand := spieler_teams_stand(rennen_test.z('z_r'));
  ergebnis := rennen_test.verschraenkt(ziel,
    v_a, format('select spieler_aus_team_nehmen(%L, %L, %L)::text', v_t1, rennen_test.z('z_r'), v_stand),
    v_a, format('select rennen_test.direkt(%L, %L)', v_t1, rennen_test.z('z_q')));
  if ergebnis is distinct from 'ok' then
    raise exception '(c) B hätte nach dem Herausnehmen zuordnen müssen: %', ergebnis;
  end if;
  if (select count(*) from team_spieler where team_id = v_t1) <> 100
     or spieler_im_team(rennen_test.z('z_r'), v_t1) or not spieler_im_team(rennen_test.z('z_q'), v_t1) then
    raise exception '(c) Erwartet 100 Zuordnungen ohne R und mit Q, gefunden: %', (select count(*) from team_spieler where team_id = v_t1);
  end if;

  -- (d) Testfall 29: Herausnehmen mit altem Stand während einer Zuordnung.
  v_stand := spieler_teams_stand(rennen_test.z('z_w'));
  ergebnis := rennen_test.verschraenkt(ziel,
    v_verw, format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])::text', v_t3, rennen_test.z('z_w')),
    v_a, format('select spieler_aus_team_nehmen(%L, %L, %L)::text', v_t1, rennen_test.z('z_w'), v_stand));
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'status' <> 'stand_geaendert'
     or ergebnis::jsonb ->> 'stand' = v_stand then
    raise exception '(d) B hätte mit stand_geaendert und neuem Stand antworten müssen: %', ergebnis;
  end if;
  if not spieler_im_team(rennen_test.z('z_w'), v_t1) or not spieler_im_team(rennen_test.z('z_w'), v_t3) then
    raise exception '(d) W nicht in Team 1 und Team 3';
  end if;

  -- (e) Auflösen wartet an der Teamsperre.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_a, format('select rennen_test.sperre(%L)', rennen_test.z('z_t5')),
    v_a, format('select loese_team_auf(%L, %L)::text', rennen_test.z('z_t5'), 'Zuordnen-Team-5'), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'status' <> 'aufgeloest'
     or exists (select 1 from teams where id = rennen_test.z('z_t5')) then
    raise exception '(e) B hätte nach der Sperre auflösen müssen: %', ergebnis;
  end if;

  -- (f) Austritt des letzten Mitglieds wartet an der Teamsperre.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_a, format('select rennen_test.sperre(%L)', rennen_test.z('z_t6')),
    v_a, format('select entferne_team_mitglied(%L, %L, %L)::text', rennen_test.z('z_t6'), v_a, 'Zuordnen-Team-6'), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'status' <> 'aufgeloest'
     or exists (select 1 from teams where id = rennen_test.z('z_t6')) then
    raise exception '(f) B hätte nach der Sperre austreten und auflösen müssen: %', ergebnis;
  end if;
exception when others or query_canceled then
  perform set_config('rennen.fehler_zuordnen', sqlerrm, false);
end $$;

delete from teams where verein_id = (select id from rennen_test.ids where name = 'z_verein');
delete from spieler where verein_id = (select id from rennen_test.ids where name = 'z_verein');
delete from vereine where id = (select id from rennen_test.ids where name = 'z_verein');
delete from auth.users where id in (select id from rennen_test.ids where name in ('z_verw', 'z_a'));

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
  if current_setting('rennen.fehler_doppelt') <> '' then
    raise exception 'Rennen Doppelerfassung: %', current_setting('rennen.fehler_doppelt');
  end if;
  if current_setting('rennen.fehler_zuordnen') <> '' then
    raise exception 'Rennen Zuordnen/Herausnehmen: %', current_setting('rennen.fehler_zuordnen');
  end if;
end $$;
