-- ============================================================================
-- Mitteilungen aufs Mobile (Epic #482), Story 2 (#483): Die Spielervertretung
-- schaltet über den privaten Link auf ihrem Gerät Mitteilungen ein; jede
-- Benachrichtigung am Link (#641) geht dann als Mitteilung an jedes Gerät mit
-- eingeschalteten Mitteilungen für die Spieler:in (PC 1).
--
-- Ablauf (Bauplan #482, PO-Entscheid «Versand aus der DB»):
-- 1. `push_abos`: je Gerät und Spieler:in eine Adresse des Mitteilungsdiensts
--    (Web Push: Endpoint und Schlüssel des Browsers). Eingeschaltet über die
--    anonymen RPCs `spieler_push_*` mit dem Link als Berechtigung (Muster
--    `spieler_abo_holen`). Höchstens 10 je Spieler:in (Advisory-Lock-Trigger,
--    Zwilling `PUSH_MAX_GERAETE` in web/lib/push.ts), nur bekannte Dienste
--    (Check, Zwilling `PUSH_ENDPUNKT`).
-- 2. Jede neue Zeile in `spieler_benachrichtigungen` legt je Abo der
--    Spieler:in einen Auftrag in `push_auftraege` ab — gleich über welchen
--    Weg sie entsteht (Einzel- und Serienereignisse). Der Fachkern versendet
--    nichts; scheitert die Zustellung, bleiben Termin und Benachrichtigung
--    (PC 2).
-- 3. Ein Statement-Trigger auf `push_auftraege` stösst den Versand an:
--    `net.http_post` (pg_net, nach dem Commit) auf die Route
--    /api/push/abarbeiten. Adresse und Geheimnis stehen je Umgebung in
--    Supabase Vault (`push_url`, `push_geheimnis`); fehlt einer der beiden
--    Einträge (lokal, CI), passiert nichts. Vault wird nicht gedumpt — Staging
--    stösst nie die Prod-Route an.
-- 4. Die Route holt die Aufträge mit dem Geheimnis über
--    `push_auftraege_holen` (Lease mit `skip locked`), sendet mit web-push und
--    meldet über `push_auftraege_melden` zurück: zugestellt → weg; das Gerät
--    nimmt nichts mehr an (404/410) → Abo weg (PC 4); sonst bis 5 Versuche.
--    Kein Service-Role-Schlüssel zur Laufzeit.
-- 5. pg_cron prüft jede Minute in der DB, ob Aufträge liegen geblieben sind,
--    und stösst nur dann an (#444: ohne offene Aufträge kein Aufruf).
--
-- Testumgebung (PC 5): `schluessel` ist ein Kürzel des VAPID-Public-Keys der
-- Umgebung, in der das Gerät eingeschaltet hat. Die Route liefert nur an Abos
-- mit ihrem Schlüssel; dazu leert sync-staging.yml beide Tabellen nach dem
-- Restore, und Vault bleibt je Umgebung.
--
-- Mitteilungen enden (PC 3): Link erneuern löscht die Abos (Trigger), die
-- gelöschte Spieler:in nimmt sie per Cascade mit. Mitglieder sehen je
-- Spieler:in nur, ob mindestens ein Abo besteht (`team_spieler_mitteilungen`,
-- AK 11), nie die Adressen.
--
-- Sperrordnung: Die RPCs sperren die spieler-Zeile (key share), danach den
-- Advisory-Lock der Grenze. Der Auftrags-Trigger nimmt nur KEY SHARE auf
-- `push_abos` (ausdrücklich, damit wegfallende Abos übersprungen werden) und
-- `spieler_benachrichtigungen` (FK), nie auf `spieler`.
--
-- Forward-only: neue Extension (pg_net), zwei neue Tabellen (stehen in
-- PUBLIC_TABLES von sync-staging.yml und werden nach dem Restore geleert),
-- neue Funktionen, ein Cron-Job.
-- ============================================================================
set lock_timeout = '5s';

create extension if not exists pg_net with schema extensions;

-- ── Tabellen ────────────────────────────────────────────────────────────────

create table push_abos (
  id uuid primary key default gen_random_uuid(),
  spieler_id uuid not null references spieler (id) on delete cascade,
  -- Nur bekannte Mitteilungsdienste (gegen SSRF über die Route): Google (auch
  -- Samsung, Opera), Apple, Mozilla, Microsoft. Zwilling: PUSH_ENDPUNKT in
  -- web/lib/push.ts.
  endpoint text not null
    constraint push_abos_endpunkt check (
      length(endpoint) <= 1024
      and endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'),
  -- Schlüssel des Browsers (base64url): P-256 öffentlich (65 Byte) und Auth (16 Byte).
  p256dh text not null constraint push_abos_p256dh check (p256dh ~ '^[A-Za-z0-9_-]{86,88}={0,2}$'),
  auth text not null constraint push_abos_auth check (auth ~ '^[A-Za-z0-9_-]{21,24}={0,2}$'),
  -- Kürzel des VAPID-Public-Keys der Umgebung (PC 5), siehe Kopf.
  schluessel text not null constraint push_abos_schluessel check (schluessel ~ '^[A-Za-z0-9_-]{1,64}$'),
  erstellt_am timestamptz not null default now(),
  -- Je Link ein Service Worker, also je Spieler:in ein Endpoint; Geschwister
  -- auf demselben Mobile haben je ihr eigenes Abo.
  constraint push_abos_geraet unique (spieler_id, endpoint)
);

alter table push_abos enable row level security;
revoke all on push_abos from anon, authenticated;

create table push_auftraege (
  id uuid primary key default gen_random_uuid(),
  abo_id uuid not null references push_abos (id) on delete cascade,
  -- Verschwindet die Benachrichtigung (Link erneuert, Frist), auch der Auftrag.
  benachrichtigung_id uuid not null references spieler_benachrichtigungen (id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  versuche integer not null default 0,
  -- Vergeben bis (Lease der Route) bzw. nächster Versuch frühestens.
  gesperrt_bis timestamptz,
  constraint push_auftraege_einmal unique (abo_id, benachrichtigung_id)
);
create index push_auftraege_offen_idx on push_auftraege (erstellt_am);

alter table push_auftraege enable row level security;
revoke all on push_auftraege from anon, authenticated;

-- ── Grenze (AK 5) ───────────────────────────────────────────────────────────

-- Höchstens 10 Geräte je Spieler:in (PO), Zwilling PUSH_MAX_GERAETE in
-- web/lib/push.ts. Der Advisory-Lock serialisiert die Zählung (Muster
-- spieler_import.sql); kein Upsert auf diese Tabelle (der Trigger feuert vor
-- der Konfliktprüfung). Ein Gerät, das die Spieler:in schon hat, zählt nicht
-- als weiteres: Schaltet dasselbe Gerät gleichzeitig zweimal ein, sieht der
-- zweite Aufruf nach dem Lock die Zeile des ersten und läuft in den
-- unique-Konflikt (in `spieler_push_anmelden` 'ok') statt in die Grenze.
create function push_abos_grenze() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('push:' || new.spieler_id::text, 0));
  if not exists (select 1 from push_abos where spieler_id = new.spieler_id and endpoint = new.endpoint)
     and (select count(*) from push_abos where spieler_id = new.spieler_id) >= 10 then
    raise exception 'PUSH_GRENZE';
  end if;
  return new;
end;
$$;
revoke all on function push_abos_grenze() from public, anon, authenticated;

create trigger push_abos_grenze
  before insert on push_abos
  for each row execute function push_abos_grenze();

-- ── Enden (PC 3) ────────────────────────────────────────────────────────────

-- Ein erneuerter Link beendet die Mitteilungen aller Geräte (Muster
-- spieler_abo_erloeschen). Die gelöschte Spieler:in nimmt sie per Cascade mit.
create function push_abos_erloeschen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from push_abos where spieler_id = new.id;
  return null;
end;
$$;
revoke all on function push_abos_erloeschen() from public, anon, authenticated;

create trigger push_abos_link_erneuert
  after update of link_token on spieler
  for each row when (old.link_token is distinct from new.link_token)
  execute function push_abos_erloeschen();

-- ── Konfiguration aus Vault ─────────────────────────────────────────────────

-- Adresse der Route und Geheimnis dieser Umgebung; `null`, wenn ein Eintrag
-- fehlt. Lokal setzen (Beispiel im Bericht zu #483):
--   select vault.create_secret('http://host.docker.internal:3000/api/push/abarbeiten', 'push_url');
--   select vault.create_secret('<mindestens 32 Zeichen>', 'push_geheimnis');
create function push_konfig(out url text, out geheimnis text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'push_url' limit 1),
         (select decrypted_secret from vault.decrypted_secrets where name = 'push_geheimnis' limit 1)
$$;
revoke all on function push_konfig() from public, anon, authenticated;

-- Ob ein Wert das Geheimnis der Umgebung ist: mindestens 32 Zeichen, Vergleich
-- über den Hash (keine Zeitabhängigkeit vom Inhalt).
create function push_geheimnis_gilt(p_geheimnis text) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(length(k.geheimnis) >= 32
                  and sha256(convert_to(k.geheimnis, 'UTF8')) = sha256(convert_to(coalesce(p_geheimnis, ''), 'UTF8')),
                  false)
    from push_konfig() k
$$;
revoke all on function push_geheimnis_gilt(text) from public, anon, authenticated;

-- Den Versand anstossen: ein POST auf die Route, nach dem Commit (pg_net).
-- Ohne Vault-Eintrag nichts; ein Fehler hier bricht nie den Vorgang ab (PC 2).
create function push_anstossen() returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  k record;
begin
  select * into k from push_konfig();
  if k.url is null or k.geheimnis is null then return false; end if;
  begin
    perform net.http_post(
      url := k.url,
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || k.geheimnis),
      timeout_milliseconds := 10000);
  exception when others then
    raise warning 'push_anstossen: %', sqlerrm;
    return false;
  end;
  return true;
end;
$$;
revoke all on function push_anstossen() from public, anon, authenticated;

-- ── Aufträge (PC 1) ─────────────────────────────────────────────────────────

-- Je neue Benachrichtigung ein Auftrag je Abo ihrer Spieler:in. Je Anweisung
-- einmal: Eine Serienänderung legt viele Benachrichtigungen in einer
-- Anweisung ab.
-- `for key share of a`: Ein Abo, das gleichzeitig wegfällt (Gerät nimmt nichts
-- mehr an, Ausschalten), überspringt die Abfrage nach dem Warten; ein
-- gesperrtes bleibt bis zum Commit stehen. Ohne die Sperre sähe die Abfrage
-- das Abo noch im Snapshot, und die FK-Prüfung bräche den Termin bzw. die
-- Benachrichtigung ab (PC 2). Der Ausnahmeblock ist das Netz dafür.
create function push_auftraege_ablegen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into push_auftraege (abo_id, benachrichtigung_id)
  select a.id, n.id from neu n join push_abos a on a.spieler_id = n.spieler_id
  for key share of a
  on conflict do nothing;
  return null;
exception when foreign_key_violation then
  raise warning 'push_auftraege_ablegen: %', sqlerrm;
  return null;
end;
$$;
revoke all on function push_auftraege_ablegen() from public, anon, authenticated;

create trigger push_auftraege_ablegen
  after insert on spieler_benachrichtigungen
  referencing new table as neu
  for each statement execute function push_auftraege_ablegen();

-- Neue Aufträge stossen den Versand an — einmal je Anweisung, nur wenn es
-- wirklich neue gibt.
create function push_auftraege_anstossen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from neu) then perform push_anstossen(); end if;
  return null;
end;
$$;
revoke all on function push_auftraege_anstossen() from public, anon, authenticated;

create trigger push_auftraege_anstossen
  after insert on push_auftraege
  referencing new table as neu
  for each statement execute function push_auftraege_anstossen();

-- Was nicht mehr zugestellt werden soll: älter als die Lebensdauer einer
-- Mitteilung beim Dienst (TTL 24 h, Zwilling PUSH_TTL_SEKUNDEN) oder 5-mal
-- gescheitert (PUSH_MAX_VERSUCHE).
create function push_auftraege_aufraeumen() returns integer
language sql security definer
set search_path = public, pg_temp
as $$
  with weg as (
    delete from push_auftraege where erstellt_am < now() - interval '24 hours' or versuche >= 5
    returning 1)
  select count(*)::int from weg
$$;
revoke all on function push_auftraege_aufraeumen() from public, anon, authenticated;

-- Das Netz (jede Minute): räumt auf und stösst nur an, wenn ein Auftrag seit
-- 30 Sekunden auf seinen Versuch wartet. Ohne offene Aufträge kein Aufruf.
create function push_netz() returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform push_auftraege_aufraeumen();
  if exists (select 1 from push_auftraege
              where erstellt_am < now() - interval '30 seconds'
                and (gesperrt_bis is null or gesperrt_bis < now())) then
    return push_anstossen();
  end if;
  return false;
end;
$$;
revoke all on function push_netz() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('push-netz', '* * * * *', $$select public.push_netz()$$);

-- ── Die Route (Geheimnis statt Anmeldung) ───────────────────────────────────

-- Wer die Aufträge abholen darf: das Geheimnis der Umgebung, oder der
-- Service-Role-Schlüssel (nur die Prüfung check:kern-db).
create function push_darf(p_geheimnis text) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select coalesce(auth.role() = 'service_role', false) or push_geheimnis_gilt(p_geheimnis) $$;
revoke all on function push_darf(text) from public, anon, authenticated;

-- Bis zu `p_anzahl` offene Aufträge für Abos mit dem Schlüssel der Umgebung
-- (`p_schluessel`, PC 5) — vergeben für 2 Minuten (`skip locked`: zwei
-- Aufrufe teilen nie einen Auftrag). Aufträge für Abos eines anderen
-- Schlüssels liefert keine Umgebung je aus; sie fallen weg. Ohne Schlüssel
-- (`p_schluessel` null: der Umgebung fehlt VAPID) fallen alle Aufträge weg
-- und es kommt `[]` — sonst stiesse das Netz die Route bis 24 h lang jede
-- Minute an (#444). `null` ohne Berechtigung. Je Auftrag Adresse und Schlüssel des Geräts, Vorname und
-- Link der Spieler:in (für die Adresse in der Mitteilung) und die
-- Benachrichtigung in der Form von `spieler_link_benachrichtigungen`.
create function push_auftraege_holen(p_geheimnis text, p_schluessel text, p_anzahl integer default 50)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
begin
  if not push_darf(p_geheimnis) then return null; end if;
  perform push_auftraege_aufraeumen();
  if p_schluessel is null then
    delete from push_auftraege where true;   -- pg_safeupdate verlangt ein where
    return '[]'::jsonb;
  end if;
  delete from push_auftraege q using push_abos a
   where a.id = q.abo_id and a.schluessel is distinct from p_schluessel;
  with frei as (
    select q.id from push_auftraege q
     where q.gesperrt_bis is null or q.gesperrt_bis < now()
     order by q.erstellt_am, q.id
     limit greatest(1, least(coalesce(p_anzahl, 50), 200))
     for update skip locked),
  vergeben as (
    update push_auftraege q set gesperrt_bis = now() + interval '2 minutes'
      from frei where q.id = frei.id
    returning q.id, q.abo_id, q.benachrichtigung_id, q.versuche, q.erstellt_am)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id,
           'versuche', g.versuche,
           'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
           'vorname', s.vorname, 'link', s.link_token,
           'eintrag', jsonb_build_object(
             'id', b.id, 'ereignis', b.ereignis, 'termin_id', b.termin_id, 'inhalt', b.inhalt,
             'erstellt', (extract(epoch from b.erstellt_am) * 1000)::bigint,
             'erstellt_tag', to_char(b.erstellt_am at time zone 'Europe/Zurich', 'YYYY-MM-DD')))
           order by g.erstellt_am, g.id), '[]'::jsonb)
    into v
    from vergeben g
    join push_abos a on a.id = g.abo_id
    join spieler s on s.id = a.spieler_id
    join spieler_benachrichtigungen b on b.id = g.benachrichtigung_id;
  return v;
end;
$$;
revoke all on function push_auftraege_holen(text, text, integer) from public, authenticated;
grant execute on function push_auftraege_holen(text, text, integer) to anon, service_role;

-- Was aus den Aufträgen wurde: `[{id, ergebnis}]` mit 'zugestellt' (Auftrag
-- weg), 'weg' (das Gerät nimmt nichts mehr an: Abo weg, PC 4) oder 'fehler'
-- (nächster Versuch nach 1, 2, 4, 8 Minuten; nach dem 5. weg). Liefert die
-- Zahl der verarbeiteten Einträge, `null` ohne Berechtigung.
create function push_auftraege_melden(p_geheimnis text, p_ergebnisse jsonb) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  n integer := 0;
  e record;
  v_abo uuid;
begin
  if not push_darf(p_geheimnis) then return null; end if;
  if jsonb_typeof(p_ergebnisse) <> 'array' then return 0; end if;
  for e in
    select x ->> 'id' as id, x ->> 'ergebnis' as ergebnis
      from jsonb_array_elements(p_ergebnisse) x
     where jsonb_typeof(x) = 'object' and (x ->> 'id') ~ '^[0-9a-f-]{36}$'
  loop
    if e.ergebnis = 'zugestellt' then
      delete from push_auftraege where id = e.id::uuid;
    elsif e.ergebnis = 'weg' then
      select abo_id into v_abo from push_auftraege where id = e.id::uuid;
      if found then delete from push_abos where id = v_abo; end if;
    elsif e.ergebnis = 'fehler' then
      update push_auftraege
         set versuche = versuche + 1,
             gesperrt_bis = now() + make_interval(mins => power(2, least(versuche, 4))::int)
       where id = e.id::uuid;
      delete from push_auftraege where id = e.id::uuid and versuche >= 5;
    else
      continue;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function push_auftraege_melden(text, jsonb) from public, authenticated;
grant execute on function push_auftraege_melden(text, jsonb) to anon, service_role;

-- ── Am privaten Link (AK 1, 5–7) ────────────────────────────────────────────

-- Mitteilungen auf diesem Gerät einschalten: 'ok', 'ungueltig' (Link),
-- 'grenze' (schon 10 Geräte, AK 5) oder 'abgewiesen' (unbekannter Dienst oder
-- unlesbare Schlüssel). Dasselbe Gerät ein zweites Mal: dieselbe Zeile, neue
-- Schlüssel. `for key share` hält Erneuern und Löschen an, bis das Abo steht;
-- danach löscht es der Trigger bzw. der Cascade.
create function spieler_push_anmelden(p_link text, p_endpoint text, p_p256dh text, p_auth text, p_schluessel text)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spieler uuid;
begin
  select id into v_spieler from spieler where link_token = p_link for key share;
  if not found then return 'ungueltig'; end if;
  -- Der äussere Block fängt unlesbare Werte auf jedem Weg ab: beim
  -- Nachführen, beim Anlegen und im Handler des gleichzeitigen Einschaltens
  -- (eine Ausnahme im Handler fangen dessen Geschwister nicht).
  begin
    update push_abos set p256dh = p_p256dh, auth = p_auth, schluessel = p_schluessel
     where spieler_id = v_spieler and endpoint = p_endpoint;
    if found then return 'ok'; end if;
    begin
      insert into push_abos (spieler_id, endpoint, p256dh, auth, schluessel)
      values (v_spieler, p_endpoint, p_p256dh, p_auth, p_schluessel);
    exception
      when unique_violation then
        -- Ein gleichzeitiges Einschalten desselben Geräts: steht schon.
        update push_abos set p256dh = p_p256dh, auth = p_auth, schluessel = p_schluessel
         where spieler_id = v_spieler and endpoint = p_endpoint;
    end;
  exception
    when check_violation or not_null_violation then
      return 'abgewiesen';
    when raise_exception then
      if sqlerrm = 'PUSH_GRENZE' then return 'grenze'; end if;
      raise;
  end;
  return 'ok';
end;
$$;
revoke all on function spieler_push_anmelden(text, text, text, text, text) from public;
grant execute on function spieler_push_anmelden(text, text, text, text, text) to anon, authenticated;

-- Ausschalten (AK 7): 'ok', auch wenn das Gerät nicht eingeschaltet war;
-- 'ungueltig' für einen ungültigen Link.
create function spieler_push_abmelden(p_link text, p_endpoint text) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spieler uuid;
begin
  select id into v_spieler from spieler where link_token = p_link;
  if not found then return 'ungueltig'; end if;
  delete from push_abos where spieler_id = v_spieler and endpoint = p_endpoint;
  return 'ok';
end;
$$;
revoke all on function spieler_push_abmelden(text, text) from public;
grant execute on function spieler_push_abmelden(text, text) to anon, authenticated;

-- Ob dieses Gerät eingeschaltet ist (AK 6): 'an', 'aus' oder 'ungueltig'.
create function spieler_push_status(p_link text, p_endpoint text) returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_spieler uuid;
begin
  select id into v_spieler from spieler where link_token = p_link;
  if not found then return 'ungueltig'; end if;
  return case when exists (select 1 from push_abos where spieler_id = v_spieler and endpoint = p_endpoint)
              then 'an' else 'aus' end;
end;
$$;
revoke all on function spieler_push_status(text, text) from public;
grant execute on function spieler_push_status(text, text) to anon, authenticated;

-- Was das Manifest des Links braucht (#650 AK 4): Vorname und Verein, sonst
-- nichts — das Manifest holt der Browser bei jedem Seitenaufruf, die ganze
-- Ansicht (`spieler_link_ansicht` mit allen Terminen) wäre dafür zu teuer.
-- `null` für einen ungültigen Link (wie die Ansicht nicht unterscheidbar).
create function spieler_link_app(p_token text) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('vorname', s.vorname, 'verein', v.name)
    from spieler s join vereine v on v.id = s.verein_id
   where s.link_token = p_token
$$;
revoke all on function spieler_link_app(text) from public;
grant execute on function spieler_link_app(text) to anon, authenticated;

-- ── Für Mitglieder (AK 11, 12) ──────────────────────────────────────────────

-- Die Spieler:innen des Teams, für die nach dem letzten bekannten Stand
-- mindestens ein Gerät Mitteilungen eingeschaltet hat — nur die Kennungen,
-- nie Adressen oder Anzahl. Mitglied des Teams (auch über den KI-Assistenten).
create function team_spieler_mitteilungen(p_team uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  return (select coalesce(jsonb_agg(ts.spieler_id order by ts.spieler_id), '[]'::jsonb)
            from team_spieler ts
           where ts.team_id = p_team
             and exists (select 1 from push_abos a where a.spieler_id = ts.spieler_id));
end;
$$;
revoke all on function team_spieler_mitteilungen(uuid) from public, anon;
grant execute on function team_spieler_mitteilungen(uuid) to authenticated;

reset lock_timeout;
