-- ============================================================================
-- Benachrichtigungen am privaten Link (Epic #641), Story 1 (#642): Die
-- Spielervertretung sieht am privaten Link, welche Spiele für ihre
-- Spieler:in neu erfasst wurden (AK 1, 3), 90 Tage lang (AK 5).
--
-- `spieler_benachrichtigungen` ist der Postausgang für alle Kanäle: heute
-- liest ihn nur der private Link, später auch Push (#482) oder E-Mail. Darum
-- steht der Inhalt strukturiert darin (kein fertiger Text; die Wörter macht
-- web/lib/benachrichtigung.ts), Empfänger ist die Spieler:in (nicht ein
-- Gerät), und der Fachkern versendet nichts — er legt nur ab. Was eine
-- Spielervertretung schon gesehen hat, merkt sich ihr Gerät (Cookie), nicht
-- die Tabelle (AK 2).
--
-- Die sechs Prinzipien des Epics stehen hier an einer Stelle; jede weitere
-- Story (#643 Ausfall/Rücknahme, #644 Verlegung, #645 Wegfall) erweitert
-- dieselben Bausteine per `create or replace`:
-- 1. Was: `termin_benachrichtigen` prüft je Ereignis den Zustand des Termins
--    (hier nur `neues_spiel`: ein Spiel, das stattfindet).
-- 2. Welche Termine: `benachrichtigung_zaehlt` — heute oder später am
--    Trainingsort, wie der Link sie zeigt.
-- 3. Wer: `benachrichtigung_empfaenger` — dieselbe Regel wie
--    `spieler_link_ansicht`, ohne Meldestand.
-- 4. Entscheid: trifft der Aufrufer; wer nicht benachrichtigen will, ruft
--    `termin_benachrichtigen` nicht auf (Standard im Kern und im MCP: ja).
-- 5. Menge: ein Vorgang (`vorgang`) je Aufruf, `unique (vorgang, spieler_id)`;
--    ein neues Spiel benachrichtigt jede Spieler:in höchstens einmal.
-- 6. Inhalt: `benachrichtigung_inhalt` — Momentaufnahme des Termins nach dem
--    Ereignis, nie der Meldestand.
--
-- Keine Fremdschlüssel auf `spieler` und `training_termine`: Ein Insert mit
-- FK auf `spieler` nähme KEY SHARE auf die spieler-Zeile — nach einer
-- Termin-Sperre (die Serien- und Entfernen-Wege der Folgestories sperren
-- zuerst den Termin) die verbotene Richtung der Sperrordnung (CLAUDE.md:
-- … → spieler-Zeile → Termin). Ein FK auf den Termin widerspräche «erhalten
-- ist erhalten» (AK 1: die Benachrichtigung bleibt, auch wenn das Spiel
-- entfernt wird). Aufgeräumt wird darum per Trigger: Spieler:in gelöscht
-- (PC 3, auch Verein löschen) und Link erneuert (PC 2) löschen ihre Zeilen;
-- die tägliche Frist löscht nach 90 Tagen und fängt Zeilen ohne Spieler:in
-- (der Staging-Abgleich läuft ohne Trigger).
--
-- Die Tabelle hat für die API-Rollen kein Recht: Schreiben nur über
-- `termin_benachrichtigen` (Mitglieder, auch KI), Lesen nur über
-- `spieler_link_benachrichtigungen` (mit dem Link). Mitglieder sehen nicht,
-- was abgelegt ist (OoS 5).
--
-- Forward-only: eine neue Tabelle (noch nicht in PUBLIC_TABLES; Staging
-- leert sie nach dem Abgleich), neue Funktionen, ein Cron-Job.
-- ============================================================================
set lock_timeout = '5s';

create table spieler_benachrichtigungen (
  id uuid primary key default gen_random_uuid(),
  -- Ohne FK (siehe Kopf).
  spieler_id uuid not null,
  -- Ein Vorgang = ein Aufruf; je Spieler:in höchstens eine Zeile (Prinzip 5).
  vorgang uuid not null,
  -- Zwilling: BenachrichtigungEreignis in web/lib/benachrichtigung.ts.
  ereignis text not null
    constraint spieler_benachrichtigungen_ereignis
    check (ereignis in ('neues_spiel', 'ausfall', 'ruecknahme', 'verlegung', 'wegfall', 'serie')),
  -- Ohne FK (siehe Kopf): bleibt stehen, wenn der Termin verschwindet.
  termin_id uuid,
  -- Momentaufnahme (Prinzip 6), Form siehe benachrichtigung_inhalt.
  inhalt jsonb not null,
  erstellt_am timestamptz not null default now(),
  constraint spieler_benachrichtigungen_vorgang unique (vorgang, spieler_id)
);
create index spieler_benachrichtigungen_spieler_idx on spieler_benachrichtigungen (spieler_id, erstellt_am desc);
create index spieler_benachrichtigungen_frist_idx on spieler_benachrichtigungen (erstellt_am);
-- Ein neues Spiel benachrichtigt jede Spieler:in höchstens einmal, auch bei
-- zwei gleichzeitigen Aufrufen (Doppelschutz neben der Prüfung in
-- termin_benachrichtigen).
create unique index spieler_benachrichtigungen_neues_spiel_uk
  on spieler_benachrichtigungen (termin_id, spieler_id) where ereignis = 'neues_spiel';

alter table spieler_benachrichtigungen enable row level security;
revoke all on spieler_benachrichtigungen from anon, authenticated;

-- ── Aufräumen (PC 2, PC 3) ──────────────────────────────────────────────────

-- PC 3: Eine gelöschte Spieler:in (einzeln oder mit dem Verein) nimmt ihre
-- Benachrichtigungen mit. Je Anweisung einmal, auch beim Verein-Löschen.
create function spieler_benachrichtigungen_weg() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from spieler_benachrichtigungen b using weg where b.spieler_id = weg.id;
  return null;
end;
$$;
revoke all on function spieler_benachrichtigungen_weg() from public, anon, authenticated;

create trigger spieler_benachrichtigungen_weg
  after delete on spieler
  referencing old table as weg
  for each statement execute function spieler_benachrichtigungen_weg();

-- PC 2: Ein erneuerter Link beginnt ohne die bisherigen Benachrichtigungen
-- (Muster spieler_abo_erloeschen), gleich über welchen Weg.
create function spieler_benachrichtigungen_erloeschen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from spieler_benachrichtigungen where spieler_id = new.id;
  return null;
end;
$$;
revoke all on function spieler_benachrichtigungen_erloeschen() from public, anon, authenticated;

create trigger spieler_benachrichtigungen_link_erneuert
  after update of link_token on spieler
  for each row when (old.link_token is distinct from new.link_token)
  execute function spieler_benachrichtigungen_erloeschen();

-- AK 5: 90 Tage (Zwilling BENACHRICHTIGUNG_TAGE in web/lib/benachrichtigung.ts;
-- dazu der Lesefilter in spieler_link_benachrichtigungen). Dazu Zeilen ohne
-- Spieler:in — der Staging-Abgleich löscht ohne Trigger. Nur der Job ruft
-- sie auf; meldet, wie viele.
create function spieler_benachrichtigungen_frist_loeschen() returns integer
language sql security definer
set search_path = public, pg_temp
as $$
  with weg as (
    delete from spieler_benachrichtigungen b
     where b.erstellt_am < now() - interval '90 days'
        or not exists (select 1 from spieler s where s.id = b.spieler_id)
    returning 1)
  select count(*)::int from weg
$$;
revoke all on function spieler_benachrichtigungen_frist_loeschen() from public, anon, authenticated;

-- Täglich um 03:37 UTC (Vorbild 20261028120000_feedback_frist.sql). Gleicher
-- Name ersetzt einen bestehenden Job.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('spieler-benachrichtigungen-frist', '37 3 * * *',
                     $$select public.spieler_benachrichtigungen_frist_loeschen()$$);

-- ── Die Prinzipien als Bausteine (ohne API-Recht) ───────────────────────────

-- Prinzip 2: ein Termin von heute oder später am Trainingsort — wie der Link
-- ihn zeigt (`t.datum >= heute_am_trainingsort()` in spieler_link_ansicht);
-- am Termintag auch nach Beginn. Bei einer Verlegung zählt der neue, beim
-- Entfernen der bisherige Tag (die Aufrufer übergeben ihn).
create function benachrichtigung_zaehlt(p_datum date) returns boolean
language sql stable
set search_path = public, pg_temp
as $$ select p_datum >= heute_am_trainingsort() $$;
revoke all on function benachrichtigung_zaehlt(date) from public, anon, authenticated;

-- Prinzip 3: die Spieler:innen, für die der Termin jetzt gilt, unabhängig von
-- ihrem Meldestand. Zwilling der Termin-Auswahl in spieler_link_ansicht
-- (20261118100000_team_infos.sql): Zuordnung zum Termin-Team; ab Beginn die
-- eingefrorene Menge, sonst termin_gilt_fuer (Kader, Schnuppern bei Spielen).
-- Ändert sich dort die Regel, hier mit.
create function benachrichtigung_empfaenger(p_termin uuid) returns setof uuid
language sql stable
set search_path = public, pg_temp
as $$
  select zs.spieler_id
    from training_termine t
    join team_spieler zs on zs.team_id = t.team_id
    cross join lateral (select exists (select 1 from termin_eingefroren f where f.termin_id = t.id) as fest) x
   where t.id = p_termin
     and case when x.fest and t.art = 'spiel' then
                exists (select 1 from spiel_teilnahmen p where p.termin_id = t.id and p.spieler_id = zs.spieler_id)
              when x.fest then
                exists (select 1 from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = zs.spieler_id)
              else termin_gilt_fuer(t.id, zs.spieler_id) end
$$;
revoke all on function benachrichtigung_empfaenger(uuid) from public, anon, authenticated;

-- Prinzip 6: der Inhalt als Momentaufnahme des Termins nach dem Ereignis —
-- Team, Training oder welches Spiel, Datum, Beginn, Ende, Ort. `grund` nur an
-- einem ausgefallenen Termin (#643), `wieder` nur, wenn ein ausgefallener
-- Termin wieder stattfindet (#644). Nie der Meldestand. Zwilling:
-- BenachrichtigungTermin in web/lib/benachrichtigung.ts.
create function benachrichtigung_inhalt(t training_termine, p_wieder boolean default false) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'team', (select name from teams where id = t.team_id),
           'art', t.art,
           'bezeichnung', t.bezeichnung,
           'datum', to_char(t.datum, 'YYYY-MM-DD'),
           'beginn', to_char(t.beginn, 'HH24:MI'),
           'ende', to_char(t.ende, 'HH24:MI'),
           'ort', t.ort)
         || case when t.ausgefallen then jsonb_build_object('grund', t.ausfall_grund) else '{}'::jsonb end
         || case when p_wieder then jsonb_build_object('wieder', true) else '{}'::jsonb end
$$;
revoke all on function benachrichtigung_inhalt(training_termine, boolean) from public, anon, authenticated;

-- Prinzip 5: ein Vorgang legt je Spieler:in höchstens eine Zeile ab; was es
-- schon gibt (gleicher Vorgang, ein neues Spiel zum zweiten Mal), bleibt
-- still. Liefert die Zahl der neuen Zeilen.
create function benachrichtigung_ablegen(
  p_vorgang uuid, p_ereignis text, p_termin uuid, p_inhalt jsonb, p_spieler uuid[]
) returns integer
language sql
set search_path = public, pg_temp
as $$
  with neu as (
    insert into spieler_benachrichtigungen (spieler_id, vorgang, ereignis, termin_id, inhalt)
    select distinct s, p_vorgang, p_ereignis, p_termin, p_inhalt from unnest(p_spieler) s
    on conflict do nothing
    returning 1)
  select count(*)::int from neu
$$;
revoke all on function benachrichtigung_ablegen(uuid, text, uuid, jsonb, uuid[]) from public, anon, authenticated;

-- ── Ablegen (AK 6, PC 1) ────────────────────────────────────────────────────

-- Ein Mitglied des Termin-Teams (auch über den KI-Assistenten) legt zu einem
-- Ereignis die Benachrichtigungen ab; der Fachkern ruft sie nach dem letzten
-- Schritt eines Vorgangs auf, nur wenn benachrichtigt werden soll
-- (Prinzip 4). Liefert die Zahl der Benachrichtigungen; 0, wenn der Termin
-- nicht zählt (Prinzip 2) oder sein Zustand nicht zum Ereignis passt
-- (Prinzip 1) — kein Fehler. Nur Lesen und Einfügen, keine Sperre.
--
-- Ereignisse dieser Story: `neues_spiel` (ein Spiel, das stattfindet, zu dem
-- es noch keine solche Benachrichtigung gibt). #643/#644 ergänzen weitere.
create function termin_benachrichtigen(p_termin uuid, p_ereignis text, p_wieder boolean default false)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
begin
  select * into t from training_termine where id = p_termin;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if p_ereignis is null or p_ereignis not in ('neues_spiel') then raise exception 'EREIGNIS_UNGUELTIG'; end if;
  if not benachrichtigung_zaehlt(t.datum) then return 0; end if;
  if p_ereignis = 'neues_spiel' then
    if t.art <> 'spiel' or t.ausgefallen
       or exists (select 1 from spieler_benachrichtigungen b
                   where b.termin_id = t.id and b.ereignis = 'neues_spiel') then
      return 0;
    end if;
  end if;
  return benachrichtigung_ablegen(gen_random_uuid(), p_ereignis, t.id, benachrichtigung_inhalt(t, p_wieder),
                                  array(select benachrichtigung_empfaenger(t.id)));
end;
$$;
revoke all on function termin_benachrichtigen(uuid, text, boolean) from public, anon;
grant execute on function termin_benachrichtigen(uuid, text, boolean) to authenticated;

-- ── Lesen am privaten Link (AK 1, 5; PC 2) ──────────────────────────────────

-- Die Benachrichtigungen der Spieler:in der letzten 90 Tage, neueste zuerst,
-- höchstens 200 — auch zu Terminen, die es nicht mehr gibt oder die nicht
-- mehr für sie gelten (AK 1). `jetzt` (ms) und `heute` (Trainingsort) gibt
-- die Datenebene mit, damit die Seite ohne eigene Uhr rechnet; `erstellt`
-- in ms, `erstellt_tag` als Tag am Trainingsort. Ungültig, erneuert oder
-- entfernt sind wie in spieler_link_ansicht nicht zu unterscheiden.
create function spieler_link_benachrichtigungen(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_spieler uuid;
begin
  select id into v_spieler from spieler where link_token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  return jsonb_build_object(
    'gueltig', true,
    'jetzt', (extract(epoch from now()) * 1000)::bigint,
    'heute', to_char(heute_am_trainingsort(), 'YYYY-MM-DD'),
    'eintraege', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'ereignis', b.ereignis, 'termin_id', b.termin_id, 'inhalt', b.inhalt,
               'erstellt', (extract(epoch from b.erstellt_am) * 1000)::bigint,
               'erstellt_tag', to_char(b.erstellt_am at time zone 'Europe/Zurich', 'YYYY-MM-DD'))
             order by b.erstellt_am desc, b.id)
        from (select * from spieler_benachrichtigungen
               where spieler_id = v_spieler and erstellt_am >= now() - interval '90 days'
               order by erstellt_am desc, id
               limit 200) b), '[]'::jsonb));
end;
$$;
revoke all on function spieler_link_benachrichtigungen(text) from public;
grant execute on function spieler_link_benachrichtigungen(text) to anon, authenticated;
