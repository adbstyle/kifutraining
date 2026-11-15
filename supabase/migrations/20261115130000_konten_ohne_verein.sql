-- Konten ohne Verein (Story 12 #588, Epic #575; Architekturplan Vereine
-- §3.5, §4.4 «Kontogrenzen», §5.1–§5.3).
--
-- Ein Konto ohne Verein (weder Mitglied eines Teams noch in der Verwaltung
-- eines Vereins, `person_verein(..) is null`) besitzt höchstens 50 eigene
-- Übungen und 30 eigene Trainings. Gezählt wird je Art jede Zeile mit
-- `owner_id` = Konto in `exercises` (nur `source = 'user'`; Manual-Übungen
-- gehören niemandem) bzw. `trainings`: Entwürfe wie veröffentlichte,
-- angelegte wie kopierte oder übernommene. Team- und Termin-Trainings und
-- anonymisierte Zeilen haben `owner_id` null und zählen nicht; Varianten,
-- Gruppen und Übungen im Training stehen in eigenen Tabellen.
--
-- Durchsetzung: Alle eigenen Übungen und Trainings entstehen als direkter
-- Insert über die RLS (kein RPC, kein Trigger, keine Migration legt Zeilen
-- mit Besitzer an). Darum ein BEFORE-Trigger je Tabelle, beim INSERT und beim
-- Besitzwechsel (`UPDATE OF owner_id` mit geändertem, nicht leerem Wert, etwa
-- ein Team-Training per direktem UPDATE in persönliches Eigentum). Die
-- WHEN-Klauseln lassen alles ohne Besitzer gar nicht erst in die Funktion:
-- Seed, Team- und Termin-Kopien, `delete_account` (anonymisiert per UPDATE
-- auf null), FK `ON DELETE SET NULL`, Updates ohne Besitzwechsel (Ändern,
-- Veröffentlichen, Auf-Entwurf-Setzen, auch `set owner_id = owner_id`).
-- Löschen löst keinen Insert-Trigger aus. Der Sync läuft unter
-- `session_replication_role = replica` (Trigger feuern nicht). Ein Bestand
-- über der Grenze bleibt und bleibt änderbar (PC 1); kein CHECK, kein
-- Backfill.
--
-- Ablauf der Triggerfunktion (security definer: liest Vereinslage und
-- Bestand unabhängig von der RLS):
--   1. Angemeldet (auth.uid() gesetzt) und die Zeile gehört einem ANDEREN
--      Konto: ohne Zählung, ohne Sperre, ohne Meldung zurück. BEFORE-Trigger
--      laufen vor der WITH-CHECK-Prüfung der RLS; die weist die Zeile danach
--      ab. So liest niemand über den Marker Bestand oder Vereinslage eines
--      fremden Kontos ab und nimmt nie dessen Personensperre. Ohne auth.uid()
--      (Service-Rolle, postgres) gilt die Grenze wie für das Konto selbst.
--   2. `sperre_person(owner_id)` in EIGENER Anweisung, gehalten bis Commit.
--   3. DANACH, in eigenen Anweisungen (frischer Snapshot unter READ
--      COMMITTED): Vereinslage, dann Bestand. Wer auf eine Aufnahme gewartet
--      hat, sieht sie; zwei Anlagen an der Grenze serialisieren an der
--      Sperre, und die zweite zählt die erste mit (AK 8, PC 2). Diese
--      Schritte nie zu einer Anweisung zusammenziehen.
--   4. Mit Verein: durchlassen. Sonst bei Bestand ≥ Grenze abweisen mit
--      `KONTO_UEBUNGEN_VOLL <bestand>` bzw. `KONTO_TRAININGS_VOLL <bestand>`
--      (tatsächlicher Bestand, auch über der Grenze; Muster PROBE_VERFALLEN,
--      im Web per Regex gelesen, web/lib/konto-grenzen.ts).
-- Die Grenzwerte stehen nur in `konto_grenze` (Zwilling: TS-Konstanten im
-- Web, von den Prüfungen gebunden); `meine_vereinslage` liefert sie mit.
--
-- Sperrordnung (AP §4.1): Verein → Suche → Person → Teams → `spieler`-Zeile
-- → Termin. Der Trigger nimmt nur die Personensperre und danach keine
-- weitere. Die Aufnahme in Team oder Verwaltung und `delete_account` halten
-- dieselbe Personensperre (team_members_vorher, verwaltung_vorher,
-- delete_account): Anlage gegen Aufnahme und gegen Konto löschen ist damit in
-- beiden Reihenfolgen geordnet. REGEL für künftige RPCs: keinen zählenden
-- Insert oder Besitzwechsel nach einer Vereins-, Team- oder Terminsperre
-- ausführen (sonst Zyklus mit der Personensperre); heute tut es keiner.
-- REGEL (zweite): Kein DEFINER-Weg legt zählende Zeilen für ein anderes
-- Konto als `auth.uid()` an oder überträgt ihm Besitz (der Trigger steigt bei
-- fremdem Besitzer aus und verlässt sich auf die RLS).
-- Ein Nutzer-Upsert auf exercises/trainings feuerte den Insert-Trigger auch
-- für eine schon vorhandene Zeile (heute upsertet nur der Seed, ohne
-- Besitzer).
--
-- Leistung: Die Zählung läuft je zählendem Insert über die bestehenden
-- Indizes `exercises_owner_idx` und `trainings_owner_idx` (kein neuer Index).
-- Für Konten mit Verein kostet ein zählender Insert die Personensperre und
-- `person_verein` (zwei Indexzugriffe), keine Zählung.
--
-- Hingenommen (AP §3.5): Eine Trainings-Kopie belegt zwischen dem Insert der
-- Trainingszeile und dem Abräumen nach einem Fehler einen Platz.

set lock_timeout = '5s';

-- ── Funktionen ──────────────────────────────────────────────────────────────

-- Grenze je Art; einzige Stelle der Werte in der Datenbank.
create function konto_grenze(p_art text) returns int
language plpgsql immutable
set search_path = public, pg_temp
as $$
begin
  return case p_art when 'uebungen' then 50
                    when 'trainings' then 30
                    else null end;
end;
$$;

-- Bestand eines Kontos je Art (eine Definition für Trigger, Lage und die
-- Prüfabfrage auf Staging/Prod).
create function konto_anzahl(p_user uuid, p_art text) returns int
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case p_art
           when 'uebungen'  then (select count(*) from exercises where owner_id = p_user and source = 'user')
           when 'trainings' then (select count(*) from trainings where owner_id = p_user)
         end::int;
$$;

--   {uebungen: int, trainings: int}
create function konto_bestand(p_user uuid) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('uebungen', konto_anzahl(p_user, 'uebungen'),
                            'trainings', konto_anzahl(p_user, 'trainings'));
$$;

create function konto_grenze_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_art text := case tg_table_name when 'exercises' then 'uebungen' else 'trainings' end;
  v_uid uuid := auth.uid();
  v_bestand int;
begin
  -- Netz zu den WHEN-Klauseln: nur zählende Zeilen und echte Besitzwechsel.
  if new.owner_id is null
     or (tg_op = 'UPDATE' and old.owner_id is not distinct from new.owner_id) then
    return new;
  end if;
  -- 1. Fremde Zeile: die RLS entscheidet, kein Abfluss, keine fremde Sperre.
  if v_uid is not null and new.owner_id <> v_uid then
    return new;
  end if;
  -- 2. Personensperre, eigene Anweisung.
  perform sperre_person(new.owner_id);
  -- 3. Danach Vereinslage und Bestand, je eigene Anweisung.
  if person_verein(new.owner_id) is not null then
    return new;
  end if;
  v_bestand := konto_anzahl(new.owner_id, v_art);
  if v_bestand >= konto_grenze(v_art) then
    if v_art = 'uebungen' then
      raise exception 'KONTO_UEBUNGEN_VOLL %', v_bestand;
    end if;
    raise exception 'KONTO_TRAININGS_VOLL %', v_bestand;
  end if;
  return new;
end;
$$;

-- Lage der aufrufenden Person (AP §4.3), additiv um `grenzen` (PC 3):
--   {verein: {id, name, ist_verwaltung, ist_teammitglied}, grenzen: null}      mit Verein
--   {verein: null, grenzen: {uebungen: {bestand, max}, trainings: {bestand, max}}}   ohne Verein
-- `bestand` kann über `max` liegen. Rumpf sonst wie in
-- 20261113100000_vereine_fundament.sql. Ohne nur_in_der_anwendung: der
-- KI-Hinweis braucht sie.
create or replace function meine_vereinslage() returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verein uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_verein := person_verein(v_uid);
  if v_verein is null then
    return jsonb_build_object('verein', null, 'grenzen', jsonb_build_object(
      'uebungen',  jsonb_build_object('bestand', konto_anzahl(v_uid, 'uebungen'),  'max', konto_grenze('uebungen')),
      'trainings', jsonb_build_object('bestand', konto_anzahl(v_uid, 'trainings'), 'max', konto_grenze('trainings'))));
  end if;
  return jsonb_build_object(
    'verein', (select jsonb_build_object(
                 'id', v.id, 'name', v.name,
                 'ist_verwaltung', exists (select 1 from verein_verwaltung w
                                            where w.verein_id = v.id and w.user_id = v_uid),
                 'ist_teammitglied', exists (select 1 from team_members m join teams t on t.id = m.team_id
                                              where t.verein_id = v.id and m.user_id = v_uid))
                 from vereine v where v.id = v_verein),
    'grenzen', null);
end;
$$;

-- ── Trigger ─────────────────────────────────────────────────────────────────
-- Namen mit «konto_»: Auf trainings feuern sie vor trainings_search und
-- trainings_stufe_pflicht (die Grenzmeldung kommt vor STUFE_FEHLT), auf
-- exercises nach exercises_search.

create trigger konto_grenze_neu
  before insert on exercises
  for each row when (new.owner_id is not null and new.source = 'user')
  execute function konto_grenze_vorher();

create trigger konto_grenze_besitz
  before update of owner_id on exercises
  for each row when (new.owner_id is not null and new.source = 'user'
                     and old.owner_id is distinct from new.owner_id)
  execute function konto_grenze_vorher();

create trigger konto_grenze_neu
  before insert on trainings
  for each row when (new.owner_id is not null)
  execute function konto_grenze_vorher();

create trigger konto_grenze_besitz
  before update of owner_id on trainings
  for each row when (new.owner_id is not null and old.owner_id is distinct from new.owner_id)
  execute function konto_grenze_vorher();

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function konto_grenze(text) from public, anon, authenticated;
revoke all on function konto_anzahl(uuid, text) from public, anon, authenticated;
revoke all on function konto_bestand(uuid) from public, anon, authenticated;
revoke all on function konto_grenze_vorher() from public, anon, authenticated;

revoke all on function meine_vereinslage() from public, anon;
grant execute on function meine_vereinslage() to authenticated;

reset lock_timeout;
