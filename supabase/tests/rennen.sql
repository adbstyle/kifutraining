-- Rennen deterministisch prüfen (Architekturplan Vereine §5.5): zuerst ein
-- Selbsttest des dblink-Musters. Er beweist, dass zwei Verbindungen sich in
-- dieser Datenbank verlässlich verschränken lassen. Danach die fachlichen
-- Fälle (Story 1: Teamgrenze 100 unter der Vereinssperre; Story 2:
-- Doppelerfassung im Verein beim Erfassen und Ändern; Story 3: Zuordnen und
-- Herausnehmen; Story 5: 30 Teams, Teamname, leere Verwaltung, Team vor
-- Termin; Story 6: Löschen, Erfassen, Link und Grenze 1000 am Verein-Ort).
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
-- Art, `wait_event`), führt A optional p_sql_a_danach aus (in derselben
-- Transaktion, scheitert es, scheitert der Fall) und committet. Liefert das
-- Ergebnis von B als Text, oder «FEHLER: …». Schliesst die Verbindungen in
-- jedem Fall.
create function rennen_test.verschraenkt(p_ziel text, p_a uuid, p_sql_a text, p_b uuid, p_sql_b text,
                                         p_warte_auf text default null, p_sql_a_danach text default null) returns text
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

  if p_sql_a_danach is not null then
    perform * from extensions.dblink('rennen_a', p_sql_a_danach) as t(x text);
  end if;
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
--     Herausnehmen in termine_einfrieren), die Verwaltung (B) löst Team 5 auf
--     (seit Story 5 verein_team_aufloesen). B muss an der Teamsperre warten
--     (`advisory`), nicht am Termin: Sonst hätte B die Termine schon
--     angefasst, bevor es die Teamsperre nimmt.
-- (f) Austritt des letzten Mitglieds aus Team 6 wartet ebenso an der
--     Teamsperre; seit Story 5 bleibt das Team bestehen.
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
    v_verw, format('select verein_team_aufloesen(%L, %L)::text', rennen_test.z('z_t5'), 'Zuordnen-Team-5'), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'status' <> 'aufgeloest'
     or exists (select 1 from teams where id = rennen_test.z('z_t5')) then
    raise exception '(e) B hätte nach der Sperre auflösen müssen: %', ergebnis;
  end if;

  -- (f) Austritt des letzten Mitglieds wartet an der Teamsperre; das Team bleibt.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_a, format('select rennen_test.sperre(%L)', rennen_test.z('z_t6')),
    v_a, format('select entferne_team_mitglied(%L, %L)::text', rennen_test.z('z_t6'), v_a), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'status' <> 'entfernt'
     or not exists (select 1 from teams where id = rennen_test.z('z_t6'))
     or exists (select 1 from team_members where team_id = rennen_test.z('z_t6')) then
    raise exception '(f) B hätte nach der Sperre austreten müssen, das Team bleibt: %', ergebnis;
  end if;
exception when others or query_canceled then
  perform set_config('rennen.fehler_zuordnen', sqlerrm, false);
end $$;

delete from teams where verein_id = (select id from rennen_test.ids where name = 'z_verein');
delete from spieler where verein_id = (select id from rennen_test.ids where name = 'z_verein');
delete from vereine where id = (select id from rennen_test.ids where name = 'z_verein');
delete from auth.users where id in (select id from rennen_test.ids where name in ('z_verw', 'z_a'));

-- ── Fälle: Verwaltung (Story 5 #581 AK 35, AP §4.1, Plan Phase 5) ───────────
-- Verein «Rennen-Verwaltung» mit den Verwaltungen VA und VB (ohne Team) und
-- Trainer:in M im Team «Rennen-M» (Termin, Serie mit Termin). Über die RPCs
-- wie PostgREST, mit rennen_test.verschraenkt. B wartet jeweils an der
-- Vereins- bzw. Teamsperre (`advisory`).
-- (h) Teamname: VA legt «Rot» an, VB gleichzeitig « rot »: B antwortet mit
--     name_vergeben und nennt «Rot». Dazu Umbenennen gegen Anlegen.
-- (g) 30. Team: Bei 29 Teams legen VA und VB je ein Team an; B scheitert an
--     VEREIN_TEAMS_VOLL, es bleiben 30.
-- (i) Leere Verwaltung: VA und VB treten gleichzeitig aus (B: letzte_verwaltung),
--     und sie entfernen sich gegenseitig (B ist danach keine Verwaltung mehr:
--     VEREIN_NICHT_GEFUNDEN). Es bleibt jeweils genau eine Person.
-- (j) Team vor Termin: A hält nur die Teamsperre von M. B setzt den Kader am
--     Termin (termin_kader_setzen), folgt der Serie samt Kader
--     (termin_der_serie_folgen) bzw. ändert die Serie (terminserie_aendern)
--     und muss an der Teamsperre warten, ohne schon die Termin-Zeile zu halten:
--     A sperrt sie während des Wartens mit `for update nowait` (55P03, wenn B
--     sie hielte). Zuletzt löst VA das Team auf, während M den Kader setzt: B
--     antwortet TERMIN_NICHT_GEFUNDEN, kein 40P01.
-- Ein harter Abbruch lässt den Verein «Rennen-Verwaltung» samt Teams und die
-- Konten «rennen-v…@rennen.test» stehen (von Hand löschen).

select set_config('rennen.fehler_verwaltung', '', false) is not null as rennen_fehler_verwaltung_leer \gset

begin;
insert into rennen_test.ids (name) values ('v_verein'), ('v_va'), ('v_vb'), ('v_m'), ('v_team'), ('v_termin'),
  ('v_serie'), ('v_serientermin'), ('v_gelb');
insert into auth.users (id, email, email_confirmed_at)
select id, 'rennen-' || replace(name, '_', '-') || '@rennen.test', now() from rennen_test.ids where name in ('v_va', 'v_vb', 'v_m');
insert into vereine (id, name) values (rennen_test.z('v_verein'), 'Rennen-Verwaltung');
insert into verein_verwaltung (verein_id, user_id) values
  (rennen_test.z('v_verein'), rennen_test.z('v_va')), (rennen_test.z('v_verein'), rennen_test.z('v_vb'));
insert into teams (id, name, verein_id) values
  (rennen_test.z('v_team'), 'Rennen-M', rennen_test.z('v_verein')),
  (rennen_test.z('v_gelb'), 'Verwaltung 1', rennen_test.z('v_verein'));
insert into teams (name, verein_id) select 'Verwaltung ' || i, rennen_test.z('v_verein') from generate_series(2, 27) i;   -- 28 Teams
insert into team_members (team_id, user_id) values (rennen_test.z('v_team'), rennen_test.z('v_m'));
insert into training_termine (id, team_id, datum, beginn, ende) values
  (rennen_test.z('v_termin'), rennen_test.z('v_team'), current_date + 7, '18:00', '19:30');
insert into termin_serien (id, team_id, wochentage, beginn_datum, end_datum, beginn, ende) values
  (rennen_test.z('v_serie'), rennen_test.z('v_team'), array[extract(isodow from current_date + 14)::smallint],
   current_date + 14, current_date + 14, '18:00', '19:30');
insert into training_termine (id, team_id, serie_id, serien_tag, datum, beginn, ende) values
  (rennen_test.z('v_serientermin'), rennen_test.z('v_team'), rennen_test.z('v_serie'), current_date + 14, current_date + 14,
   '18:00', '19:30');
-- A hält nur die Teamsperre (ohne Zeilen).
create function rennen_test.nur_teamsperre(p_team uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  perform sperre_teams(array[p_team]);
  return 'ok';
end $f$;
-- A prüft, dass niemand die Termin-Zeile hält.
create function rennen_test.termin_frei(p_termin uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  perform 1 from training_termine where id = p_termin for update nowait;
  return 'ok';
end $f$;
grant execute on function rennen_test.nur_teamsperre(uuid), rennen_test.termin_frei(uuid) to authenticated;
commit;

do $$
declare
  ziel   text := format(
    'host=%s port=%s dbname=%s user=postgres password=postgres connect_timeout=5 options=''-c statement_timeout=30s''',
    coalesce(host(inet_server_addr()), '127.0.0.1'), inet_server_port(), current_database());
  v_verein uuid := rennen_test.z('v_verein');
  v_va uuid := rennen_test.z('v_va');
  v_vb uuid := rennen_test.z('v_vb');
  v_m uuid := rennen_test.z('v_m');
  v_team uuid := rennen_test.z('v_team');
  ergebnis text;
begin
  -- (h) Teamname: Anlegen gegen Anlegen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_team_anlegen(%L, 'Rot')::text$q$, v_verein),
    v_vb, format($q$select verein_team_anlegen(%L, ' rot ')::text$q$, v_verein), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb <> '{"status": "abgewiesen", "grund": "name_vergeben", "team": "Rot"}' then
    raise exception '(h) B hätte mit name_vergeben und «Rot» abgewiesen werden müssen: %', ergebnis;
  end if;
  -- Umbenennen gegen Anlegen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_team_umbenennen(%L, 'Gelb')::text$q$, rennen_test.z('v_gelb')),
    v_vb, format($q$select verein_team_anlegen(%L, 'GELB')::text$q$, v_verein), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb <> '{"status": "abgewiesen", "grund": "name_vergeben", "team": "Gelb"}' then
    raise exception '(h) B hätte nach dem Umbenennen mit name_vergeben und «Gelb» abgewiesen werden müssen: %', ergebnis;
  end if;
  if (select count(*) from teams where verein_id = v_verein and spieler_text_schluessel(name) in ('rot', 'gelb')) <> 2 then
    raise exception '(h) Teamnamen nicht je einmal';
  end if;

  -- (g) 30. Team.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_team_anlegen(%L, 'Dreissig A')::text$q$, v_verein),
    v_vb, format($q$select verein_team_anlegen(%L, 'Dreissig B')::text$q$, v_verein), 'advisory');
  if position('VEREIN_TEAMS_VOLL' in ergebnis) = 0 then
    raise exception '(g) B hätte an VEREIN_TEAMS_VOLL scheitern müssen: %', ergebnis;
  end if;
  if (select count(*) from teams where verein_id = v_verein) <> 30
     or not exists (select 1 from teams where verein_id = v_verein and name = 'Dreissig A') then
    raise exception '(g) Erwartet 30 Teams samt «Dreissig A», gefunden: %', (select count(*) from teams where verein_id = v_verein);
  end if;

  -- (i) Beide treten aus.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format('select verein_verwaltung_entfernen(%L, %L)::text', v_verein, v_va),
    v_vb, format('select verein_verwaltung_entfernen(%L, %L)::text', v_verein, v_vb), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb <> '{"status": "letzte_verwaltung"}' then
    raise exception '(i) B hätte letzte_verwaltung melden müssen: %', ergebnis;
  end if;
  if (select array_agg(user_id) from verein_verwaltung where verein_id = v_verein) is distinct from array[v_vb] then
    raise exception '(i) Nach dem Austritt nicht genau VB in der Verwaltung';
  end if;
  -- Wieder aufnehmen, committet über eine eigene Verbindung (dieser Block ist
  -- eine Transaktion, und die Vereinssperre hielte B sonst auf).
  perform extensions.dblink_exec(ziel, format('insert into public.verein_verwaltung (verein_id, user_id) values (%L, %L)',
                                              v_verein, v_va));
  -- Gegenseitig entfernen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format('select verein_verwaltung_entfernen(%L, %L)::text', v_verein, v_vb),
    v_vb, format('select verein_verwaltung_entfernen(%L, %L)::text', v_verein, v_va), 'advisory');
  if position('VEREIN_NICHT_GEFUNDEN' in ergebnis) = 0 then
    raise exception '(i) B ist keine Verwaltung mehr und hätte VEREIN_NICHT_GEFUNDEN bekommen müssen: %', ergebnis;
  end if;
  if (select array_agg(user_id) from verein_verwaltung where verein_id = v_verein) is distinct from array[v_va] then
    raise exception '(i) Nach dem gegenseitigen Entfernen nicht genau VA in der Verwaltung';
  end if;

  -- (j) Team vor Termin: Kader am Termin.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_m, format('select rennen_test.nur_teamsperre(%L)', v_team),
    v_m, format($q$select termin_kader_setzen(%L, '{}')::text$q$, rennen_test.z('v_termin')), 'advisory',
    format('select rennen_test.termin_frei(%L)', rennen_test.z('v_termin')));
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'team' <> v_team::text then
    raise exception '(j) termin_kader_setzen nach der Teamsperre: %', ergebnis;
  end if;
  -- Der Serie samt Kader folgen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_m, format('select rennen_test.nur_teamsperre(%L)', v_team),
    v_m, format($q$select termin_der_serie_folgen(%L, array['kader'])::text$q$, rennen_test.z('v_serientermin')), 'advisory',
    format('select rennen_test.termin_frei(%L)', rennen_test.z('v_serientermin')));
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'team' <> v_team::text then
    raise exception '(j) termin_der_serie_folgen nach der Teamsperre: %', ergebnis;
  end if;
  -- Die Serie ändern.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_m, format('select rennen_test.nur_teamsperre(%L)', v_team),
    v_m, format($q$select terminserie_aendern(%L, 'alle', '{"bemerkung": "Rennen"}')::text$q$, rennen_test.z('v_serientermin')),
    'advisory', format('select rennen_test.termin_frei(%L)', rennen_test.z('v_serientermin')));
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'serie' <> rennen_test.z('v_serie')::text then
    raise exception '(j) terminserie_aendern nach der Teamsperre: %', ergebnis;
  end if;
  -- Auflösen gegen Kader am Termin.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_team_aufloesen(%L, 'Rennen-M')::text$q$, v_team),
    v_m, format($q$select termin_kader_setzen(%L, '{}')::text$q$, rennen_test.z('v_termin')), 'advisory');
  if position('TERMIN_NICHT_GEFUNDEN' in ergebnis) = 0 then
    raise exception '(j) Nach dem Auflösen hätte B TERMIN_NICHT_GEFUNDEN melden müssen: %', ergebnis;
  end if;
  if exists (select 1 from teams where id = v_team) then
    raise exception '(j) Team nicht aufgelöst';
  end if;
exception when others or query_canceled then
  perform set_config('rennen.fehler_verwaltung', sqlerrm, false);
end $$;

delete from teams where verein_id = (select id from rennen_test.ids where name = 'v_verein');
delete from vereine where id = (select id from rennen_test.ids where name = 'v_verein');
delete from auth.users where id in (select id from rennen_test.ids where name in ('v_va', 'v_vb', 'v_m'));

-- ── Fälle: Recht und Team unter der Vereinssperre, Suchbremse (Story 5 #581) ──
-- Verein «Rennen-Recht» mit den Verwaltungen RA und RB, Trainer:in RM in den
-- Teams «Recht-Eins» (mit Spieler:in), «Recht-Zwei» und «Recht-Drei», Konto
-- RS in «Recht-Drei». B wartet jeweils an einer Beratungssperre (`advisory`).
-- (k) RA löst «Recht-Eins» auf, RB nimmt gleichzeitig die Spieler:in heraus:
--     B prüft unter der Vereinssperre, ob das Team noch besteht →
--     VEREIN_NICHT_GEFUNDEN (nicht SPIELER_NICHT_GEFUNDEN).
-- (l) RA löst «Recht-Zwei» auf, RM nimmt dort gleichzeitig jemanden auf
--     (add_team_member): «not a member of this team», kein rohes VEREIN_FEHLT.
-- (m) RA entfernt RB aus der Verwaltung, während RB «Recht-Drei» auflösen
--     will: VEREIN_NICHT_GEFUNDEN, das Team besteht.
-- (n) Suchbremse: Mit 9 erfolglosen Versuchen sucht A erfolglos (10.) und
--     hält die Transaktion offen; B sucht gleichzeitig und wartet an der
--     Suchsperre → gebremst. Für finde_trainer (Team-Ort) und
--     verein_finde_person (Verein-Ort), die keine Vereinssperre nehmen.
-- (o) 15 Verbindungen suchen gleichzeitig erfolglos (je eine Transaktion):
--     höchstens 10 ungebremste Antworten, höchstens 10 Vermerke.
-- Ein harter Abbruch lässt den Verein «Rennen-Recht» samt Teams und die
-- Konten «rennen-r-…@rennen.test» stehen (von Hand löschen).

select set_config('rennen.fehler_recht', '', false) is not null as rennen_fehler_recht_leer \gset

begin;
insert into rennen_test.ids (name) values ('r_verein'), ('r_va'), ('r_vb'), ('r_m'), ('r_s'),
  ('r_t1'), ('r_t2'), ('r_t3'), ('r_sp');
insert into auth.users (id, email, email_confirmed_at)
select id, 'rennen-' || replace(name, '_', '-') || '@rennen.test', now() from rennen_test.ids
 where name in ('r_va', 'r_vb', 'r_m', 'r_s');
insert into vereine (id, name) values (rennen_test.z('r_verein'), 'Rennen-Recht');
insert into verein_verwaltung (verein_id, user_id) values
  (rennen_test.z('r_verein'), rennen_test.z('r_va')), (rennen_test.z('r_verein'), rennen_test.z('r_vb'));
insert into teams (id, name, verein_id) values
  (rennen_test.z('r_t1'), 'Recht-Eins', rennen_test.z('r_verein')),
  (rennen_test.z('r_t2'), 'Recht-Zwei', rennen_test.z('r_verein')),
  (rennen_test.z('r_t3'), 'Recht-Drei', rennen_test.z('r_verein'));
insert into team_members (team_id, user_id) values
  (rennen_test.z('r_t1'), rennen_test.z('r_m')), (rennen_test.z('r_t2'), rennen_test.z('r_m')),
  (rennen_test.z('r_t3'), rennen_test.z('r_m')), (rennen_test.z('r_t3'), rennen_test.z('r_s'));
insert into spieler (id, verein_id, vorname, nachname, jahrgang)
  values (rennen_test.z('r_sp'), rennen_test.z('r_verein'), 'Recht', 'Spieler', 2015);
insert into team_spieler (team_id, spieler_id, verein_id)
  values (rennen_test.z('r_t1'), rennen_test.z('r_sp'), rennen_test.z('r_verein'));
commit;

do $$
declare
  ziel   text := format(
    'host=%s port=%s dbname=%s user=postgres password=postgres connect_timeout=5 options=''-c statement_timeout=30s''',
    coalesce(host(inet_server_addr()), '127.0.0.1'), inet_server_port(), current_database());
  v_verein uuid := rennen_test.z('r_verein');
  v_va uuid := rennen_test.z('r_va');
  v_vb uuid := rennen_test.z('r_vb');
  v_m uuid := rennen_test.z('r_m');
  v_s uuid := rennen_test.z('r_s');
  ergebnis text;
  verbindungen text[] := '{}';
  n text;
  ungebremst int := 0;
  gebremst int := 0;
begin
  -- (k) Herausnehmen gegen Auflösen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_team_aufloesen(%L, 'Recht-Eins')::text$q$, rennen_test.z('r_t1')),
    v_vb, format('select verein_spieler_aus_team_nehmen(%L, %L)::text', rennen_test.z('r_t1'), rennen_test.z('r_sp')),
    'advisory');
  if position('VEREIN_NICHT_GEFUNDEN' in ergebnis) = 0 then
    raise exception '(k) B hätte VEREIN_NICHT_GEFUNDEN melden müssen: %', ergebnis;
  end if;
  if exists (select 1 from teams where id = rennen_test.z('r_t1'))
     or not exists (select 1 from spieler where id = rennen_test.z('r_sp')) then
    raise exception '(k) Team nicht aufgelöst oder Spieler:in weg';
  end if;

  -- (l) Aufnehmen am Team-Ort gegen Auflösen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_team_aufloesen(%L, 'Recht-Zwei')::text$q$, rennen_test.z('r_t2')),
    v_m, format($q$select add_team_member(%L, 'rennen-r-vb@rennen.test')::text$q$, rennen_test.z('r_t2')),
    'advisory');
  if position('not a member of this team' in ergebnis) = 0 then
    raise exception '(l) B hätte wie ein Nicht-Mitglied abgewiesen werden müssen: %', ergebnis;
  end if;

  -- (m) Auflösen gegen Entfernen aus der Verwaltung.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format('select verein_verwaltung_entfernen(%L, %L)::text', v_verein, v_vb),
    v_vb, format($q$select verein_team_aufloesen(%L, 'Recht-Drei')::text$q$, rennen_test.z('r_t3')),
    'advisory');
  if position('VEREIN_NICHT_GEFUNDEN' in ergebnis) = 0 then
    raise exception '(m) B ist keine Verwaltung mehr und hätte VEREIN_NICHT_GEFUNDEN bekommen müssen: %', ergebnis;
  end if;
  if not exists (select 1 from teams where id = rennen_test.z('r_t3')) then
    raise exception '(m) «Recht-Drei» ist aufgelöst';
  end if;

  -- (n) Suchbremse am Team-Ort: 9 Versuche stehen, A macht den 10.
  perform extensions.dblink_exec(ziel, format(
    'insert into public.trainer_suchversuche (user_id) select %L from generate_series(1, 9)', v_m));
  ergebnis := rennen_test.verschraenkt(ziel,
    v_m, format($q$select finde_trainer(%L, 'niemand-a@rennen.test')::text$q$, rennen_test.z('r_t3')),
    v_m, format($q$select finde_trainer(%L, 'niemand-b@rennen.test')::text$q$, rennen_test.z('r_t3')),
    'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb <> '{"status": "gebremst"}' then
    raise exception '(n) finde_trainer: B hätte gebremst werden müssen: %', ergebnis;
  end if;
  -- Am Verein-Ort.
  perform extensions.dblink_exec(ziel, format(
    'insert into public.trainer_suchversuche (user_id) select %L from generate_series(1, 9)', v_va));
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_finde_person(%L, 'niemand-a@rennen.test')::text$q$, v_verein),
    v_va, format($q$select verein_finde_person(%L, 'niemand-b@rennen.test')::text$q$, v_verein),
    'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb <> '{"status": "gebremst"}' then
    raise exception '(n) verein_finde_person: B hätte gebremst werden müssen: %', ergebnis;
  end if;

  -- (o) Viele gleichzeitige erfolglose Suchen von RS.
  for i in 1..15 loop
    n := 'rennen_s' || i;
    perform extensions.dblink_connect(n, ziel || ' application_name=' || n);
    verbindungen := verbindungen || n;
    perform extensions.dblink_exec(n, 'set role authenticated');
    perform * from extensions.dblink(n, format($q$select set_config('request.jwt.claims', %L, false)$q$,
      jsonb_build_object('sub', v_s, 'role', 'authenticated')::text)) as t(x text);
  end loop;
  foreach n in array verbindungen loop
    perform extensions.dblink_send_query(n, format($q$select finde_trainer(%L, %L)::text$q$,
      rennen_test.z('r_t3'), 'niemand-' || n || '@rennen.test'));
  end loop;
  foreach n in array verbindungen loop
    select t.x into ergebnis from extensions.dblink_get_result(n, false) as t(x text);
    if ergebnis is null then
      raise exception '(o) Suche auf % scheiterte: %', n, extensions.dblink_error_message(n);
    end if;
    perform * from extensions.dblink_get_result(n, false) as t(x text);
    case ergebnis::jsonb ->> 'status'
      when 'nicht_gefunden' then ungebremst := ungebremst + 1;
      when 'gebremst' then gebremst := gebremst + 1;
      else raise exception '(o) unerwartete Antwort: %', ergebnis;
    end case;
    perform extensions.dblink_disconnect(n);
  end loop;
  verbindungen := '{}';
  if ungebremst <> 10 or gebremst <> 5 or (select count(*) from trainer_suchversuche where user_id = v_s) <> 10 then
    raise exception '(o) Erwartet 10 ungebremst, 5 gebremst, 10 Vermerke; bekommen: %, %, %',
      ungebremst, gebremst, (select count(*) from trainer_suchversuche where user_id = v_s);
  end if;
exception when others or query_canceled then
  foreach n in array coalesce(extensions.dblink_get_connections(), '{}') loop
    perform extensions.dblink_disconnect(n);
  end loop;
  perform set_config('rennen.fehler_recht', sqlerrm, false);
end $$;

delete from teams where verein_id = (select id from rennen_test.ids where name = 'r_verein');
delete from spieler where verein_id = (select id from rennen_test.ids where name = 'r_verein');
delete from vereine where id = (select id from rennen_test.ids where name = 'r_verein');
delete from auth.users where id in (select id from rennen_test.ids where name in ('r_va', 'r_vb', 'r_m', 'r_s'));

-- ── Fälle: Spielerbestand der Verwaltung (Story 6 #582, AP §4.1, §4.3) ──────
-- Verein «Rennen-Bestand» mit den Verwaltungen BA und BB (ohne Team) und
-- Trainer:in BM in «Bestand-Eins» (künftiger Termin) und «Bestand-Zwei».
-- Über die RPCs wie PostgREST, mit rennen_test.verschraenkt; B wartet
-- jeweils an einer Beratungssperre (Verein oder Team, `advisory`).
-- (p) Löschen gegen Zuordnen, beide Richtungen: Nach dem Zuordnen nimmt das
--     Löschen das neue Team mit (und nennt es); nach dem Löschen findet das
--     Zuordnen die Spieler:in nicht.
-- (q) Löschen gegen Herausnehmen am Team-Ort (Team → Zeile), beide
--     Richtungen: Das Löschen sperrt die Teams vor der Zeile; kein 40P01,
--     nach dem Löschen SPIELER_NICHT_GEFUNDEN.
-- (r) Löschen gegen eine Abmeldung über den privaten Link, beide Richtungen:
--     danach `ungueltig` bzw. keine Abmeldung ohne Spieler:in.
-- (s) Löschen gegen Ändern: SPIELER_NICHT_GEFUNDEN (AK 15).
-- (t) Zweimal dieselbe Spieler:in gleichzeitig erfassen: B antwortet
--     `doppelt` ohne Team, der Schlüssel steht einmal.
-- (u) Grenze 1000: Bei 999 erfassen BA und BB je eine; B scheitert an
--     VEREIN_VOLL, es bleiben 1000.
-- (v) Recht unter der Sperre: BA entfernt BB aus der Verwaltung, während BB
--     löscht: SPIELER_NICHT_GEFUNDEN, die Spieler:in bleibt.
-- (w) Zuordnen gegen Auflösen: B antwortet VEREIN_NICHT_GEFUNDEN statt mit
--     einem rohen Fehler.
-- (x) Erfassen im Verein gegen Aufnehmen am Team-Ort mit demselben
--     Schlüssel, beide Richtungen: genau eine gelingt, die andere antwortet
--     `doppelt` (am Team-Ort mit dem Status des Team-Orts).
-- (y) Link erneuern gegen Abo holen über den alten Link, beide Richtungen:
--     Danach gibt es kein Abo zum alten Link (`for key share` hält das
--     Erneuern an; nach dem Erneuern findet der alte Link nichts mehr).
-- Ein harter Abbruch lässt den Verein «Rennen-Bestand» samt Teams und
-- Spieler:innen und die Konten «rennen-b-…@rennen.test» stehen (von Hand löschen).

select set_config('rennen.fehler_bestand', '', false) is not null as rennen_fehler_bestand_leer \gset

begin;
insert into rennen_test.ids (name) values ('b_verein'), ('b_va'), ('b_vb'), ('b_m'), ('b_t1'), ('b_t2'), ('b_termin'),
  ('b_p1'), ('b_p2'), ('b_q1'), ('b_q2'), ('b_r1'), ('b_r2'), ('b_s1'), ('b_v1'), ('b_w1'), ('b_y1'), ('b_y2');
insert into auth.users (id, email, email_confirmed_at)
select id, 'rennen-' || replace(name, '_', '-') || '@rennen.test', now() from rennen_test.ids where name in ('b_va', 'b_vb', 'b_m');
insert into vereine (id, name) values (rennen_test.z('b_verein'), 'Rennen-Bestand');
insert into verein_verwaltung (verein_id, user_id) values
  (rennen_test.z('b_verein'), rennen_test.z('b_va')), (rennen_test.z('b_verein'), rennen_test.z('b_vb'));
insert into teams (id, name, verein_id) values
  (rennen_test.z('b_t1'), 'Bestand-Eins', rennen_test.z('b_verein')),
  (rennen_test.z('b_t2'), 'Bestand-Zwei', rennen_test.z('b_verein'));
insert into team_members (team_id, user_id) values
  (rennen_test.z('b_t1'), rennen_test.z('b_m')), (rennen_test.z('b_t2'), rennen_test.z('b_m'));
insert into training_termine (id, team_id, datum, beginn, ende) values
  (rennen_test.z('b_termin'), rennen_test.z('b_t1'), current_date + 7, '18:00', '19:30');
insert into spieler (id, verein_id, vorname, nachname, jahrgang)
select id, rennen_test.z('b_verein'), 'Bestand', name, 2015 from rennen_test.ids where name like 'b\_%' and name ~ '^b_[pqrsvwy][0-9]$';
insert into team_spieler (team_id, spieler_id, verein_id)
select rennen_test.z('b_t1'), id, rennen_test.z('b_verein') from rennen_test.ids where name in ('b_p2', 'b_q1', 'b_q2', 'b_r1', 'b_r2', 'b_y1');
commit;

do $$
declare
  ziel   text := format(
    'host=%s port=%s dbname=%s user=postgres password=postgres connect_timeout=5 options=''-c statement_timeout=30s''',
    coalesce(host(inet_server_addr()), '127.0.0.1'), inet_server_port(), current_database());
  v_verein uuid := rennen_test.z('b_verein');
  v_va uuid := rennen_test.z('b_va');
  v_vb uuid := rennen_test.z('b_vb');
  v_m uuid := rennen_test.z('b_m');
  v_t1 uuid := rennen_test.z('b_t1');
  v_termin uuid := rennen_test.z('b_termin');
  ergebnis text;
begin
  -- (p) Zuordnen, dann Löschen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])::text', v_t1, rennen_test.z('b_p1')),
    v_vb, format('select verein_spieler_entfernen(%L)::text', rennen_test.z('b_p1')), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:'
     or ergebnis::jsonb <> jsonb_build_object('status', 'geloescht', 'teams',
                                              jsonb_build_array(jsonb_build_object('id', v_t1, 'name', 'Bestand-Eins'))) then
    raise exception '(p) B hätte nach dem Zuordnen samt Team löschen müssen: %', ergebnis;
  end if;
  if exists (select 1 from spieler where id = rennen_test.z('b_p1'))
     or exists (select 1 from team_spieler where spieler_id = rennen_test.z('b_p1')) then
    raise exception '(p) Spieler:in oder Zuordnung nach dem Löschen da';
  end if;
  -- Löschen, dann Zuordnen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format('select verein_spieler_entfernen(%L)::text', rennen_test.z('b_p2')),
    v_vb, format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])::text', rennen_test.z('b_t2'), rennen_test.z('b_p2')),
    'advisory');
  if position('SPIELER_NICHT_GEFUNDEN' in ergebnis) = 0 then
    raise exception '(p) Zuordnen nach dem Löschen hätte SPIELER_NICHT_GEFUNDEN melden müssen: %', ergebnis;
  end if;

  -- (q) Herausnehmen (Team-Ort), dann Löschen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_m, format('select spieler_aus_team_nehmen(%L, %L, %L)::text', v_t1, rennen_test.z('b_q1'),
                spieler_teams_stand(rennen_test.z('b_q1'))),
    v_va, format('select verein_spieler_entfernen(%L)::text', rennen_test.z('b_q1')), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb <> '{"status": "geloescht", "teams": []}' then
    raise exception '(q) B hätte nach dem Herausnehmen ohne Team löschen müssen: %', ergebnis;
  end if;
  -- Löschen, dann Herausnehmen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format('select verein_spieler_entfernen(%L)::text', rennen_test.z('b_q2')),
    v_m, format('select spieler_aus_team_nehmen(%L, %L, %L)::text', v_t1, rennen_test.z('b_q2'),
                spieler_teams_stand(rennen_test.z('b_q2'))), 'advisory');
  if position('SPIELER_NICHT_GEFUNDEN' in ergebnis) = 0 then
    raise exception '(q) Herausnehmen nach dem Löschen hätte SPIELER_NICHT_GEFUNDEN melden müssen: %', ergebnis;
  end if;

  -- (r) Löschen, dann Abmelden über den Link.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format('select verein_spieler_entfernen(%L)::text', rennen_test.z('b_r1')),
    v_m, format('select spieler_link_abmelden(%L, %L, true, null, null)::text',
                (select link_token from spieler where id = rennen_test.z('b_r1')), v_termin), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb <> '{"status": "ungueltig"}' then
    raise exception '(r) Abmelden nach dem Löschen hätte ungueltig melden müssen: %', ergebnis;
  end if;
  -- Abmelden, dann Löschen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_m, format('select spieler_link_abmelden(%L, %L, true, null, null)::text',
                (select link_token from spieler where id = rennen_test.z('b_r2')), v_termin),
    v_va, format('select verein_spieler_entfernen(%L)::text', rennen_test.z('b_r2')), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'status' <> 'geloescht' then
    raise exception '(r) B hätte nach dem Abmelden löschen müssen: %', ergebnis;
  end if;
  if exists (select 1 from termin_abmeldungen where termin_id = v_termin)
     or exists (select 1 from spieler where id in (rennen_test.z('b_r1'), rennen_test.z('b_r2'))) then
    raise exception '(r) Abmeldung oder Spieler:in nach dem Löschen da';
  end if;

  -- (s) Löschen, dann Ändern.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format('select verein_spieler_entfernen(%L)::text', rennen_test.z('b_s1')),
    v_vb, format($q$select verein_spieler_aendern(%L, 'Bestand', 'Neu', 2015, null)::text$q$, rennen_test.z('b_s1')), 'advisory');
  if position('SPIELER_NICHT_GEFUNDEN' in ergebnis) = 0 then
    raise exception '(s) Ändern nach dem Löschen hätte SPIELER_NICHT_GEFUNDEN melden müssen: %', ergebnis;
  end if;

  -- (t) Zweimal dieselbe Spieler:in.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_spieler_anlegen(%L, 'Rennen', 'Gleich', 2015, null)::text$q$, v_verein),
    v_vb, format($q$select verein_spieler_anlegen(%L, ' rennen ', 'GLEICH', 2015, '1')::text$q$, v_verein), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:'
     or ergebnis::jsonb <> '{"status": "abgewiesen", "grund": "doppelt", "teams": [], "ohne_team": true}' then
    raise exception '(t) B hätte doppelt ohne Team melden müssen: %', ergebnis;
  end if;
  if (select count(*) from spieler where verein_id = v_verein and nachname ilike 'gleich') <> 1 then
    raise exception '(t) Schlüssel nicht genau einmal';
  end if;

  -- (x) Erfassen im Verein, dann Aufnehmen am Team-Ort.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_spieler_anlegen(%L, 'Kreuz', 'Eins', 2015, null)::text$q$, v_verein),
    v_m, format($q$select spieler_aufnehmen(%L, ' kreuz ', 'EINS', 2015, null)::text$q$, v_t1), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:'
     or ergebnis::jsonb <> '{"status": "abgewiesen", "grund": "doppelt", "eigenes_team": false, "teams": [], "ohne_team": true}' then
    raise exception '(x) Aufnehmen nach dem Erfassen hätte doppelt ohne Team melden müssen: %', ergebnis;
  end if;
  if (select count(*) from spieler where verein_id = v_verein and nachname ilike 'eins' and vorname ilike 'kreuz') <> 1
     or exists (select 1 from team_spieler ts join spieler s on s.id = ts.spieler_id
                 where s.verein_id = v_verein and s.vorname = 'Kreuz') then
    raise exception '(x) Erwartet genau eine «Kreuz Eins» ohne Team';
  end if;
  -- Aufnehmen am Team-Ort, dann Erfassen im Verein.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_m, format($q$select spieler_aufnehmen(%L, 'Kreuz', 'Zwei', 2015, null)::text$q$, v_t1),
    v_va, format($q$select verein_spieler_anlegen(%L, 'KREUZ', ' zwei ', 2015, null)::text$q$, v_verein), 'advisory');
  if left(ergebnis, 7) = 'FEHLER:'
     or ergebnis::jsonb <> '{"status": "abgewiesen", "grund": "doppelt", "teams": ["Bestand-Eins"], "ohne_team": false}' then
    raise exception '(x) Erfassen nach dem Aufnehmen hätte doppelt mit Bestand-Eins melden müssen: %', ergebnis;
  end if;
  if (select count(*) from spieler where verein_id = v_verein and nachname ilike 'zwei' and vorname ilike 'kreuz') <> 1 then
    raise exception '(x) Erwartet genau eine «Kreuz Zwei»';
  end if;

  -- (y) Link erneuern, dann Abo über den alten Link holen: Der alte Link
  -- findet nach dem Commit nichts mehr.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format('select verein_spieler_link_erneuern(%L)::text', rennen_test.z('b_y1')),
    v_m, format($q$select coalesce(spieler_abo_holen(%L), 'kein Abo')$q$,
                (select link_token from spieler where id = rennen_test.z('b_y1'))));
  if ergebnis <> 'kein Abo' then
    raise exception '(y) Abo über den alten Link nach dem Erneuern: %', ergebnis;
  end if;
  -- Abo über den alten Link holen, dann erneuern: Der Trigger beendet es.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_m, format('select spieler_abo_holen(%L)', (select link_token from spieler where id = rennen_test.z('b_y2'))),
    v_va, format('select verein_spieler_link_erneuern(%L)::text', rennen_test.z('b_y2')));
  if left(ergebnis, 7) = 'FEHLER:' or ergebnis::jsonb ->> 'link_token' is null then
    raise exception '(y) B hätte nach dem Abo erneuern müssen: %', ergebnis;
  end if;
  if exists (select 1 from spieler_abos where spieler_id in (rennen_test.z('b_y1'), rennen_test.z('b_y2'))) then
    raise exception '(y) Abo zum alten Link nach dem Erneuern da';
  end if;

  -- (u) Grenze 1000: auf 999 auffüllen (eigene Verbindung, committet).
  perform extensions.dblink_exec(ziel, format(
    $q$set session_replication_role = replica;
       insert into public.spieler (verein_id, vorname, nachname, jahrgang)
       select %L, 'Voll', 'Nr ' || i, 2015 from generate_series(1, %s) i$q$,
    v_verein, 999 - (select count(*) from spieler where verein_id = v_verein)));
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_spieler_anlegen(%L, 'Grenze', 'A', 2015, null)::text$q$, v_verein),
    v_vb, format($q$select verein_spieler_anlegen(%L, 'Grenze', 'B', 2015, null)::text$q$, v_verein), 'advisory');
  if position('VEREIN_VOLL' in ergebnis) = 0 then
    raise exception '(u) B hätte an VEREIN_VOLL scheitern müssen: %', ergebnis;
  end if;
  if (select count(*) from spieler where verein_id = v_verein) <> 1000
     or not exists (select 1 from spieler where verein_id = v_verein and nachname = 'A') then
    raise exception '(u) Erwartet 1000 samt A, gefunden: %', (select count(*) from spieler where verein_id = v_verein);
  end if;

  -- (v) Recht unter der Sperre.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format('select verein_verwaltung_entfernen(%L, %L)::text', v_verein, v_vb),
    v_vb, format('select verein_spieler_entfernen(%L)::text', rennen_test.z('b_v1')), 'advisory');
  if position('SPIELER_NICHT_GEFUNDEN' in ergebnis) = 0 then
    raise exception '(v) BB ist keine Verwaltung mehr und hätte SPIELER_NICHT_GEFUNDEN bekommen müssen: %', ergebnis;
  end if;
  if not exists (select 1 from spieler where id = rennen_test.z('b_v1')) then
    raise exception '(v) Spieler:in gelöscht';
  end if;

  -- (w) Zuordnen gegen Auflösen.
  ergebnis := rennen_test.verschraenkt(ziel,
    v_va, format($q$select verein_team_aufloesen(%L, 'Bestand-Zwei')::text$q$, rennen_test.z('b_t2')),
    v_va, format('select verein_spieler_zuordnen(%L, array[%L]::uuid[])::text', rennen_test.z('b_t2'), rennen_test.z('b_w1')),
    'advisory');
  if position('VEREIN_NICHT_GEFUNDEN' in ergebnis) = 0 then
    raise exception '(w) Zuordnen nach dem Auflösen hätte VEREIN_NICHT_GEFUNDEN melden müssen: %', ergebnis;
  end if;
  if exists (select 1 from team_spieler where spieler_id = rennen_test.z('b_w1')) then
    raise exception '(w) Zuordnung nach dem Auflösen da';
  end if;
exception when others or query_canceled then
  perform set_config('rennen.fehler_bestand', sqlerrm, false);
end $$;

delete from teams where verein_id = (select id from rennen_test.ids where name = 'b_verein');
delete from spieler where verein_id = (select id from rennen_test.ids where name = 'b_verein');
delete from vereine where id = (select id from rennen_test.ids where name = 'b_verein');
delete from auth.users where id in (select id from rennen_test.ids where name in ('b_va', 'b_vb', 'b_m'));

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
  if current_setting('rennen.fehler_verwaltung') <> '' then
    raise exception 'Rennen Verwaltung: %', current_setting('rennen.fehler_verwaltung');
  end if;
  if current_setting('rennen.fehler_recht') <> '' then
    raise exception 'Rennen Recht und Suchbremse: %', current_setting('rennen.fehler_recht');
  end if;
  if current_setting('rennen.fehler_bestand') <> '' then
    raise exception 'Rennen Spielerbestand: %', current_setting('rennen.fehler_bestand');
  end if;
end $$;
