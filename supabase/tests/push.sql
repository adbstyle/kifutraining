-- Mitteilungen aufs Mobile (Epic #482, Story 2 #483), auf Datenebene:
-- - Rechte: anon/authenticated ohne Tabellenrecht auf push_abos und
--   push_auftraege; interne Bausteine ohne API-Recht; die Link-RPCs auch für
--   anon, die Mitglieder-RPC nur authenticated, Holen/Melden nur anon und
--   service_role; Cron-Job «push-netz» jede Minute
-- - Einschalten (AK 1, 5–7): falscher Link 'ungueltig', fremder Dienst und
--   unlesbare Schlüssel 'abgewiesen', dasselbe Gerät zweimal ist eine Zeile,
--   Status an/aus, Ausschalten
-- - Grenze (AK 5): 10 Geräte je Spieler:in, das 11. 'grenze'; eine andere
--   Spieler:in auf demselben Gerät zählt für sich
-- - Aufträge (PC 1): je Abo ein Auftrag bei einem Einzelereignis
--   (termin_benachrichtigen) und bei einem Serienereignis (mehrere
--   Spieler:innen in einer Anweisung); ohne Abo keiner
-- - Anstoss: ohne Vault-Eintrag kein Aufruf (net.http_request_queue bleibt
--   gleich), mit beiden Einträgen genau ein Aufruf je Anweisung mit Bearer;
--   die Anfrage geht nie hinaus (rollback)
-- - Ohne VAPID: Holen ohne Schlüssel verwirft alle Aufträge, das Netz
--   stösst danach nicht mehr an; ein vorhandenes Gerät an der Grenze ist
--   der unique-Konflikt, nicht die Grenze; Manifest-RPC spieler_link_app
-- - Holen/Melden: falsches Geheimnis null, richtiges liefert die Aufträge
--   des eigenen Schlüssels (fremde fallen weg), vergibt sie (zweites Holen
--   leer); 'weg' löscht das Abo (PC 4), 'fehler' zählt hoch und löscht nach
--   dem 5. Versuch, 'zugestellt' löscht den Auftrag
-- - Mitglieder (AK 11): sehen nur die Kennungen mit Abo, Fremde
--   TEAM_NICHT_GEFUNDEN
-- - Enden (PC 3): Link erneuern und Spieler:in löschen leeren die Abos samt
--   Aufträgen
-- Alles in einer Transaktion mit rollback (auch die Vault-Einträge);
-- hinterlässt nichts.

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

create function pg_temp.anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
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

create function pg_temp.pruefe(p_ok boolean, p_text text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception 'Mitteilungen #483: %', p_text; end if;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('v'), ('t'), ('tf'), ('m'), ('mf'), ('s1'), ('s2'), ('s3'), ('spiel'), ('spiel2');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated, anon;   -- temporär; die Rollen brauchen pg_temp.id

create function pg_temp.link(p text) returns text language sql stable security definer as $$
  select link_token from spieler where id = pg_temp.id(p) $$;

-- Gültige Schlüssel eines Browsers (base64url) und Adressen je Dienst.
create function pg_temp.p256dh() returns text language sql immutable as $$ select 'B' || repeat('A', 86) $$;
create function pg_temp.auth() returns text language sql immutable as $$ select repeat('A', 22) $$;
create function pg_temp.ep(n integer) returns text language sql immutable as $$
  select 'https://fcm.googleapis.com/fcm/send/geraet-' || n $$;
create function pg_temp.an(p_spieler text, p_endpoint text, p_schluessel text default 'test') returns text
language sql as $$
  select spieler_push_anmelden(pg_temp.link(p_spieler), p_endpoint, pg_temp.p256dh(), pg_temp.auth(), p_schluessel) $$;
grant execute on function pg_temp.link(text), pg_temp.p256dh(), pg_temp.auth(), pg_temp.ep(integer),
  pg_temp.an(text, text, text) to anon, authenticated;

create function pg_temp.abos(p text) returns integer language sql stable as $$
  select count(*)::int from push_abos where spieler_id = pg_temp.id(p) $$;
create function pg_temp.auftraege(p text) returns integer language sql stable as $$
  select count(*)::int from push_auftraege q join push_abos a on a.id = q.abo_id where a.spieler_id = pg_temp.id(p) $$;
create function pg_temp.aufrufe() returns integer language sql stable as $$
  select count(*)::int from net.http_request_queue $$;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@push.test', now() from ids where name in ('m', 'mf');

-- Verein mit Team «Adler» (Mitglied m) und Team «Fremd» (Mitglied mf);
-- s1 und s2 in Adler, s3 nur in Fremd.
set local session_replication_role = replica;
insert into vereine (id, name) values (pg_temp.id('v'), 'Push-Verein');
insert into teams (id, name, verein_id) values
  (pg_temp.id('t'), 'Adler', pg_temp.id('v')), (pg_temp.id('tf'), 'Fremd', pg_temp.id('v'));
insert into team_members (team_id, user_id) values (pg_temp.id('t'), pg_temp.id('m')), (pg_temp.id('tf'), pg_temp.id('mf'));
insert into spieler (id, team_id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('s1'), pg_temp.id('t'), pg_temp.id('v'), 'Lea', 'Eins', 2015),
  (pg_temp.id('s2'), pg_temp.id('t'), pg_temp.id('v'), 'Noah', 'Zwei', 2015),
  (pg_temp.id('s3'), pg_temp.id('tf'), pg_temp.id('v'), 'Mia', 'Drei', 2015);
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit) values
  (pg_temp.id('t'), pg_temp.id('s1'), pg_temp.id('v'), null),
  (pg_temp.id('t'), pg_temp.id('s2'), pg_temp.id('v'), null),
  (pg_temp.id('tf'), pg_temp.id('s3'), pg_temp.id('v'), null);
insert into training_termine (id, team_id, datum, beginn, ende, ort, art, bezeichnung) values
  (pg_temp.id('spiel'), pg_temp.id('t'), heute_am_trainingsort() + 3, '10:00', '11:30', 'Allmend', 'spiel', 'Match gegen Uster'),
  (pg_temp.id('spiel2'), pg_temp.id('t'), heute_am_trainingsort() + 4, '10:00', '11:30', 'Allmend', 'spiel', 'Match gegen Wil');
set local session_replication_role = origin;

-- Vault dieser Umgebung leer (ein lokal gesetzter Eintrag kehrt mit dem
-- rollback zurück).
delete from vault.secrets where name in ('push_url', 'push_geheimnis');

-- ── Rechte ──────────────────────────────────────────────────────────────────

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    perform pg_temp.pruefe(not has_table_privilege(r, t, 'select, insert, update, delete'), r || ' hat ein Recht auf ' || t)
       from unnest(array['push_abos', 'push_auftraege']) t;
    perform pg_temp.pruefe(not has_function_privilege(r, f, 'execute'), r || ' darf ' || f)
       from unnest(array['push_abos_grenze()', 'push_abos_erloeschen()', 'push_konfig()',
                         'push_geheimnis_gilt(text)', 'push_anstossen()', 'push_auftraege_ablegen()',
                         'push_auftraege_anstossen()', 'push_auftraege_aufraeumen()', 'push_netz()',
                         'push_darf(text)']) f;
    perform pg_temp.pruefe(has_function_privilege(r, f, 'execute'), r || ' darf nicht ' || f)
       from unnest(array['spieler_push_anmelden(text, text, text, text, text)',
                         'spieler_push_abmelden(text, text)', 'spieler_push_status(text, text)',
                         'spieler_link_app(text)']) f;
  end loop;
  perform pg_temp.pruefe(not has_function_privilege('anon', 'team_spieler_mitteilungen(uuid)', 'execute')
                         and has_function_privilege('authenticated', 'team_spieler_mitteilungen(uuid)', 'execute'),
                         'Rechte team_spieler_mitteilungen');
  perform pg_temp.pruefe(has_function_privilege('anon', 'push_auftraege_holen(text, text, integer)', 'execute')
                         and not has_function_privilege('authenticated', 'push_auftraege_holen(text, text, integer)', 'execute')
                         and has_function_privilege('anon', 'push_auftraege_melden(text, jsonb)', 'execute')
                         and not has_function_privilege('authenticated', 'push_auftraege_melden(text, jsonb)', 'execute'),
                         'Rechte Holen/Melden');
  perform pg_temp.pruefe(exists (select 1 from cron.job where jobname = 'push-netz' and schedule = '* * * * *'),
                         'Netz-Job fehlt');
end $$;

-- Manifest des Links (#652 Review): nur Vorname und Verein, ungültig null.
select pg_temp.anon();
select pg_temp.pruefe(spieler_link_app(pg_temp.link('s1')) = '{"vorname":"Lea","verein":"Push-Verein"}'::jsonb, 'Manifest: Vorname und Verein');
select pg_temp.pruefe(spieler_link_app('falsch') is null and spieler_link_app(null) is null, 'Manifest: ungültiger Link');
select pg_temp.zurueck();

select pg_temp.anon();
select pg_temp.erwarte('select count(*) from push_abos', '42501');
select pg_temp.erwarte('select count(*) from push_auftraege', '42501');
select pg_temp.zurueck();
select pg_temp.als(pg_temp.id('m'));
select pg_temp.erwarte('select count(*) from push_abos', '42501');
select pg_temp.zurueck();

-- ── Einschalten, Status, Ausschalten (AK 1, 6, 7) ───────────────────────────

select pg_temp.anon();
select pg_temp.pruefe(spieler_push_anmelden('falsch', pg_temp.ep(1), pg_temp.p256dh(), pg_temp.auth(), 'test') = 'ungueltig',
                      'falscher Link');
select pg_temp.pruefe(pg_temp.an('s1', 'https://angreifer.example/fcm.googleapis.com/x') = 'abgewiesen', 'fremder Host');
select pg_temp.pruefe(pg_temp.an('s1', 'http://fcm.googleapis.com/fcm/send/x') = 'abgewiesen', 'ohne https');
select pg_temp.pruefe(pg_temp.an('s1', 'https://fcm.googleapis.com.angreifer.example/x') = 'abgewiesen', 'Host als Präfix');
select pg_temp.pruefe(spieler_push_anmelden(pg_temp.link('s1'), pg_temp.ep(1), 'kaputt', pg_temp.auth(), 'test') = 'abgewiesen',
                      'unlesbarer Schlüssel');
select pg_temp.pruefe(pg_temp.an('s1', pg_temp.ep(1)) = 'ok', 'Einschalten');
select pg_temp.pruefe(pg_temp.an('s1', pg_temp.ep(1)) = 'ok', 'dasselbe Gerät nochmals');
-- Auch beim Nachführen eines bekannten Geräts: 'abgewiesen' statt Fehler.
select pg_temp.pruefe(spieler_push_anmelden(pg_temp.link('s1'), pg_temp.ep(1), 'kaputt', pg_temp.auth(), 'test') = 'abgewiesen',
                      'unlesbarer Schlüssel beim bekannten Gerät');
select pg_temp.pruefe(spieler_push_anmelden(pg_temp.link('s1'), pg_temp.ep(1), pg_temp.p256dh(), 'kaputt', 'test') = 'abgewiesen',
                      'unlesbares Auth beim bekannten Gerät');
select pg_temp.pruefe(pg_temp.an('s1', 'https://web.push.apple.com/QAbc') = 'ok', 'Apple');
select pg_temp.pruefe(pg_temp.an('s1', 'https://updates.push.services.mozilla.com/wpush/v2/x') = 'ok', 'Mozilla');
select pg_temp.pruefe(pg_temp.an('s1', 'https://wns2-par02p.notify.windows.com/w/?token=x') = 'ok', 'Microsoft');
select pg_temp.pruefe(spieler_push_status(pg_temp.link('s1'), pg_temp.ep(1)) = 'an', 'Status an');
select pg_temp.pruefe(spieler_push_status(pg_temp.link('s1'), pg_temp.ep(99)) = 'aus', 'Status aus');
select pg_temp.pruefe(spieler_push_status('falsch', pg_temp.ep(1)) = 'ungueltig', 'Status falscher Link');
select pg_temp.pruefe(spieler_push_abmelden(pg_temp.link('s1'), 'https://web.push.apple.com/QAbc') = 'ok', 'Ausschalten');
select pg_temp.pruefe(spieler_push_abmelden(pg_temp.link('s1'), 'https://web.push.apple.com/QAbc') = 'ok', 'nochmals aus');
select pg_temp.pruefe(spieler_push_abmelden('falsch', pg_temp.ep(1)) = 'ungueltig', 'Ausschalten falscher Link');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.abos('s1') = 3, 'drei Geräte, eines je Adresse');

-- ── Grenze (AK 5) ───────────────────────────────────────────────────────────

select pg_temp.anon();
select pg_temp.pruefe(pg_temp.an('s1', pg_temp.ep(n)) = 'ok', 'Gerät ' || n) from generate_series(2, 8) n;
select pg_temp.pruefe(pg_temp.an('s1', pg_temp.ep(9)) = 'grenze', 'das 11. Gerät');
-- Ein bekanntes Gerät bleibt einschaltbar, eine andere Spieler:in auf demselben zählt für sich.
select pg_temp.pruefe(pg_temp.an('s1', pg_temp.ep(1)) = 'ok', 'bekanntes Gerät an der Grenze');
select pg_temp.pruefe(pg_temp.an('s2', pg_temp.ep(1)) = 'ok', 'Geschwister auf demselben Gerät');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.abos('s1') = 10 and pg_temp.abos('s2') = 1, 'Grenze 10');
select pg_temp.erwarte(format('insert into push_abos (spieler_id, endpoint, p256dh, auth, schluessel) values (%L, %L, %L, %L, %L)',
                              pg_temp.id('s1'), pg_temp.ep(50), pg_temp.p256dh(), pg_temp.auth(), 'test'), 'PUSH_GRENZE');
-- Ein schon vorhandenes Gerät zählt nicht als weiteres (#652 Review): an der
-- Grenze der unique-Konflikt (den `spieler_push_anmelden` als 'ok' auffängt),
-- nicht die Grenze. Das Rennen dazu steht in rennen.sql (p3).
select pg_temp.erwarte(format('insert into push_abos (spieler_id, endpoint, p256dh, auth, schluessel) values (%L, %L, %L, %L, %L)',
                              pg_temp.id('s1'), pg_temp.ep(1), pg_temp.p256dh(), pg_temp.auth(), 'test'), '23505');

-- ── Mitglieder (AK 11) ──────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(team_spieler_mitteilungen(pg_temp.id('t'))
                      = (select jsonb_agg(x order by x) from unnest(array[pg_temp.id('s1'), pg_temp.id('s2')]) x),
                      'Mitglied sieht s1 und s2');
select pg_temp.zurueck();
select pg_temp.als(pg_temp.id('mf'));
select pg_temp.pruefe(team_spieler_mitteilungen(pg_temp.id('tf')) = '[]'::jsonb, 'Fremd ohne Abo');
select pg_temp.erwarte(format('select team_spieler_mitteilungen(%L)', pg_temp.id('t')), 'TEAM_NICHT_GEFUNDEN');
select pg_temp.zurueck();

-- ── Aufträge und Anstoss (PC 1) ─────────────────────────────────────────────

-- Einzelereignis ohne Vault: ein Auftrag je Abo, kein Aufruf.
create temp table vorher as select pg_temp.aufrufe() as n;
select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(termin_benachrichtigen(pg_temp.id('spiel'), 'neues_spiel') = 2, 'zwei Benachrichtigungen');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.auftraege('s1') = 10 and pg_temp.auftraege('s2') = 1, 'Einzelereignis: ein Auftrag je Abo');
select pg_temp.pruefe(pg_temp.aufrufe() = (select n from vorher), 'ohne Vault ein Aufruf');

-- Nur das Geheimnis: noch immer kein Aufruf.
select vault.create_secret(repeat('g', 40), 'push_geheimnis');
select pg_temp.pruefe(benachrichtigung_ablegen(gen_random_uuid(), 'ausfall', pg_temp.id('spiel'), '{"team":"Adler"}'::jsonb,
                                               array[pg_temp.id('s2')]) = 1, 'Ausfall abgelegt');
select pg_temp.pruefe(pg_temp.aufrufe() = (select n from vorher), 'ohne push_url ein Aufruf');
select pg_temp.pruefe(pg_temp.auftraege('s2') = 2, 'Auftrag auch ohne Anstoss');

-- Mit Adresse: Serienereignis (mehrere Spieler:innen in einer Anweisung) =
-- je Abo ein Auftrag und genau ein Aufruf mit Bearer.
select vault.create_secret('http://host.docker.internal:3000/api/push/abarbeiten', 'push_url');
select pg_temp.pruefe(benachrichtigung_ablegen(gen_random_uuid(), 'serie', pg_temp.id('spiel'),
                                               '{"team":"Adler","art":"training","ab":null,"angaben":null,"wegfall":null}'::jsonb,
                                               array[pg_temp.id('s1'), pg_temp.id('s2'), pg_temp.id('s3')]) = 3, 'Serie abgelegt');
select pg_temp.pruefe(pg_temp.auftraege('s1') = 20 and pg_temp.auftraege('s2') = 3 and pg_temp.auftraege('s3') = 0,
                      'Serienereignis: ein Auftrag je Abo, ohne Abo keiner');
select pg_temp.pruefe(pg_temp.aufrufe() = (select n from vorher) + 1, 'genau ein Aufruf je Anweisung');
select pg_temp.pruefe((select url = 'http://host.docker.internal:3000/api/push/abarbeiten'
                              and headers ->> 'Authorization' = 'Bearer ' || repeat('g', 40)
                         from net.http_request_queue order by id desc limit 1), 'Aufruf mit Adresse und Bearer');
-- Eine Benachrichtigung ohne Abo stösst nichts an.
select pg_temp.pruefe(benachrichtigung_ablegen(gen_random_uuid(), 'ausfall', pg_temp.id('spiel'), '{"team":"Fremd"}'::jsonb,
                                               array[pg_temp.id('s3')]) = 1, 'ohne Abo abgelegt');
select pg_temp.pruefe(pg_temp.aufrufe() = (select n from vorher) + 1, 'ohne Abo kein Aufruf');

-- Das Netz: frische Aufträge warten auf die Route, ältere stösst es an.
select pg_temp.pruefe(push_netz() = false, 'Netz: nichts liegt seit 30 s');
update push_auftraege q set erstellt_am = now() - interval '1 minute'
                               - case when b.ereignis = 'neues_spiel' then interval '1 minute' else interval '0' end
  from spieler_benachrichtigungen b where b.id = q.benachrichtigung_id;
select pg_temp.pruefe(push_netz() = true, 'Netz stösst an');

-- ── Holen und Melden (PC 4) ─────────────────────────────────────────────────

-- Ein Abo mit dem Schlüssel einer anderen Umgebung (PC 5).
update push_abos set schluessel = 'prod' where spieler_id = pg_temp.id('s2');

select pg_temp.anon();
select pg_temp.pruefe(push_auftraege_holen('falsch', 'test') is null, 'falsches Geheimnis');
select pg_temp.pruefe(push_auftraege_holen(null, 'test') is null, 'ohne Geheimnis');
select pg_temp.pruefe(push_auftraege_melden('falsch', '[]'::jsonb) is null, 'Melden mit falschem Geheimnis');
create temp table geholt as select push_auftraege_holen(repeat('g', 40), 'test', 5) as v;
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.auftraege('s2') = 0, 'Aufträge des fremden Schlüssels fallen weg');
select pg_temp.pruefe(pg_temp.abos('s2') = 1, 'das Abo des fremden Schlüssels bleibt');
select pg_temp.pruefe(jsonb_array_length(v) = 5, 'höchstens p_anzahl') from geholt;
select pg_temp.pruefe(bool_and(e ->> 'vorname' = 'Lea' and e ->> 'link' = pg_temp.link('s1')
                               and e ->> 'endpoint' like 'https://%' and e ->> 'p256dh' = pg_temp.p256dh()
                               and e -> 'eintrag' ? 'erstellt_tag' and e -> 'eintrag' ? 'id')
                      and bool_or(e -> 'eintrag' ->> 'ereignis' = 'neues_spiel'
                                  and e -> 'eintrag' -> 'inhalt' ->> 'bezeichnung' = 'Match gegen Uster'), 'Form eines Auftrags')
  from geholt, jsonb_array_elements(v) e;
select pg_temp.pruefe((select count(*) from push_auftraege where gesperrt_bis > now()) = 5, 'fünf vergeben');

-- Ein zweiter Aufruf bekommt die vergebenen nicht.
select pg_temp.anon();
create temp table geholt2 as select push_auftraege_holen(repeat('g', 40), 'test', 200) as v;
select pg_temp.zurueck();
select pg_temp.pruefe(jsonb_array_length(v) = 15, 'die übrigen 15')
  from geholt2;
select pg_temp.pruefe(not exists (select 1 from geholt g, geholt2 h, jsonb_array_elements(g.v) a, jsonb_array_elements(h.v) b
                                   where a ->> 'id' = b ->> 'id'), 'kein Auftrag doppelt');

-- Melden: zugestellt, weg (Gerät nimmt nichts mehr an), fehler.
create temp table eins as
  select (v -> 0 ->> 'id')::uuid as zugestellt, (v -> 1 ->> 'id')::uuid as weg, (v -> 2 ->> 'id')::uuid as fehler,
         (v -> 1 ->> 'endpoint') as weg_endpoint
    from geholt;
grant select on eins to anon;
select pg_temp.anon();
select pg_temp.pruefe(push_auftraege_melden(repeat('g', 40), jsonb_build_array(
         jsonb_build_object('id', zugestellt, 'ergebnis', 'zugestellt'),
         jsonb_build_object('id', weg, 'ergebnis', 'weg'),
         jsonb_build_object('id', fehler, 'ergebnis', 'fehler'),
         jsonb_build_object('id', 'kaputt', 'ergebnis', 'weg'),
         jsonb_build_object('id', gen_random_uuid(), 'ergebnis', 'quatsch'))) = 3, 'drei gemeldet')
  from eins;
select pg_temp.zurueck();
select pg_temp.pruefe(not exists (select 1 from push_auftraege where id = zugestellt), 'zugestellt: Auftrag weg') from eins;
select pg_temp.pruefe(not exists (select 1 from push_abos where spieler_id = pg_temp.id('s1') and endpoint = weg_endpoint),
                      'weg: Abo weg (PC 4)') from eins;
select pg_temp.pruefe(pg_temp.abos('s1') = 9, 'neun Abos bleiben');
select pg_temp.pruefe((select versuche = 1 and gesperrt_bis > now() + interval '50 seconds' from push_auftraege where id = fehler),
                      'fehler: ein Versuch, wartet') from eins;
update push_auftraege set versuche = 4, gesperrt_bis = null where id = (select fehler from eins);
select pg_temp.anon();
select pg_temp.pruefe(push_auftraege_melden(repeat('g', 40), jsonb_build_array(jsonb_build_object('id', fehler, 'ergebnis', 'fehler'))) = 1,
                      'fünfter Versuch') from eins;
select pg_temp.zurueck();
select pg_temp.pruefe(not exists (select 1 from push_auftraege where id = fehler), 'nach 5 Versuchen weg') from eins;

-- Service-Role darf ohne Geheimnis (nur check:kern-db).
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select pg_temp.pruefe(push_auftraege_holen(null, 'test') is not null, 'service_role holt');
select pg_temp.zurueck();

-- Aufräumen: älter als 24 h fällt weg.
update push_auftraege set erstellt_am = now() - interval '25 hours';
select pg_temp.pruefe(push_auftraege_aufraeumen() > 0, 'TTL 24 h räumt auf');
select pg_temp.pruefe(not exists (select 1 from push_auftraege), 'TTL 24 h: nichts bleibt');

-- Ohne VAPID (#652 Review): Die Route holt ohne Schlüssel, alle Aufträge
-- fallen weg, und das Netz stösst danach nicht mehr jede Minute an (#444).
select pg_temp.pruefe(benachrichtigung_ablegen(gen_random_uuid(), 'ausfall', pg_temp.id('spiel'), '{"team":"Adler"}'::jsonb,
                                               array[pg_temp.id('s1')]) = 1, 'Ausfall für s1');
update push_auftraege set erstellt_am = now() - interval '1 minute';
select pg_temp.pruefe(pg_temp.auftraege('s1') = 9 and push_netz() = true, 'liegen geblieben: das Netz stösst an');
select pg_temp.anon();
select pg_temp.pruefe(push_auftraege_holen('falsch', null) is null, 'ohne VAPID: falsches Geheimnis');
select pg_temp.pruefe(push_auftraege_holen(repeat('g', 40), null) = '[]'::jsonb, 'ohne VAPID: nichts zuzustellen');
select pg_temp.zurueck();
select pg_temp.pruefe(not exists (select 1 from push_auftraege), 'ohne VAPID: alle Aufträge fallen weg');
select pg_temp.pruefe(pg_temp.abos('s1') = 9, 'ohne VAPID: die Abos bleiben');
select pg_temp.pruefe(push_netz() = false, 'ohne VAPID: das Netz stösst nicht mehr an');

-- ── Enden (PC 3) ────────────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('m'));
select pg_temp.pruefe(termin_benachrichtigen(pg_temp.id('spiel2'), 'neues_spiel') = 2, 'neues Spiel');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.auftraege('s1') = 9, 'Aufträge vor dem Erneuern');
update spieler set link_token = neues_geheimnis() where id = pg_temp.id('s1');
select pg_temp.pruefe(pg_temp.abos('s1') = 0 and not exists (select 1 from push_auftraege q join push_abos a on a.id = q.abo_id
                                                              where a.spieler_id = pg_temp.id('s1')),
                      'Link erneuern leert Abos und Aufträge');
select pg_temp.pruefe(pg_temp.abos('s2') = 1, 'andere Spieler:in bleibt');
delete from spieler where id = pg_temp.id('s2');
select pg_temp.pruefe(pg_temp.abos('s2') = 0 and not exists (select 1 from push_auftraege), 'Löschen leert');

rollback;
