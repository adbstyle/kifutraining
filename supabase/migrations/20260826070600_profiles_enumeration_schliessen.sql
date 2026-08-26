-- ============================================================================
-- Konto-Enumeration über `profiles` schliessen (Release-Review PR #101).
--
-- Problem: Die Team-Migration (20260824195749) hat `profiles` bewusst offen
-- gelesen — `create policy pr_select on profiles for select using (true)` plus
-- `grant select on profiles to anon`. Damit lieferte ein anonymes
-- `GET /rest/v1/profiles?select=*` die vollständige Liste aller registrierten
-- Konten (user_id + selbst gewählter Anzeigename). Das widerspricht der
-- Anti-Enumerations-Linie derselben Migration: `finde_trainer` bremst
-- E-Mail-Suchen aufwendig auf 10 Fehlversuche pro Stunde, während die Tabelle
-- daneben den ganzen Bestand am Stück herausgab.
--
-- Warum die Policy überhaupt offen war: `anzeige_name(uuid)` ist als
-- SQL-Funktion ohne `security definer` angelegt und liest `profiles` deshalb
-- mit den Rechten des Aufrufers. Sie steckt über das berechnete
-- PostgREST-Feld `urheber(trainings)` in jedem Listen- und Detail-Select der
-- Trainings — auch in dem, den ANONYME Besucher auf öffentliche Vorlagen
-- absetzen. Ohne Leserecht auf `profiles` wäre dort «permission denied»
-- erschienen. Die offene Policy war also nur das Mittel; gebraucht wird
-- lediglich der Name zu EINER bekannten User-ID, nie die Liste.
--
-- Lösung: `anzeige_name` wird SECURITY DEFINER. Die Funktion liest `profiles`
-- dann mit den Rechten ihres Eigentümers (dem Migrations-Rollen-Konto, das die
-- Tabelle besitzt und RLS folglich passiert) und gibt genau das heraus, wofür
-- sie da ist: den Namen zu einer bereits bekannten User-ID. Ein
-- Enumerations-Hebel entsteht daraus nicht — wer die UUID nicht kennt, bekommt
-- nichts, und für Unbekannte liefert die Funktion ohnehin den aus der ID
-- abgeleiteten Ersatznamen statt eines Treffers/Nicht-Treffers.
--
-- Warum `anon` weiterhin EXECUTE braucht: `urheber(trainings)` bleibt
-- bewusst INVOKER (es ist ein rein rechnendes Feld über einer Zeile, die die
-- trainings-RLS bereits freigegeben hat) und ruft `anzeige_name` auf. Ohne
-- Grant an `anon` scheiterte das anonyme Lesen öffentlicher Vorlagen — dasselbe
-- Muster wie bei `ist_team_mitglied` in der Team-Migration.
--
-- `pr_insert` und `pr_update` bleiben unverändert: sie sind bereits auf
-- `to authenticated` mit `user_id = auth.uid()` eingeschränkt, also auf die
-- eigene Zeile. Eine DELETE-Policy gab und gibt es nicht.
--
-- Forward-only (CLAUDE.md): keine Datenänderung, keine verschärfte Invariante
-- auf Bestandszeilen — nur Rechte und Policy. Läuft auf Prod-Bestand wie auf
-- der leeren CI-Wegwerf-DB.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) `anzeige_name` auf SECURITY DEFINER umstellen
--    Signatur, Rumpf, `stable` und `set search_path` bleiben unverändert;
--    einzig `security definer` kommt dazu.
-- ----------------------------------------------------------------------------
create or replace function anzeige_name(p_user uuid) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select display_name from profiles where user_id = p_user),
    'Trainer:in ' || left(md5(p_user::text), 4)
  );
$$;

-- Bei DEFINER-Funktionen das implizite EXECUTE für PUBLIC entziehen und nur
-- die tatsächlich benötigten API-Rollen zulassen (`anon` wegen `urheber`).
revoke all on function anzeige_name(uuid) from public;
grant execute on function anzeige_name(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) Offene SELECT-Policy durch «nur die eigene Zeile» ersetzen
--    Das Web braucht von `profiles` direkt nur `hatEigenenAnzeigenamen()`
--    (web/lib/queries/profil.ts) — ein Select auf die eigene Zeile. Alles
--    andere (Urheber, Mitgliederlisten, Trainer-Suche) läuft über
--    `anzeige_name` / `team_mitglieder` / `finde_trainer`.
-- ----------------------------------------------------------------------------
drop policy pr_select on profiles;
create policy pr_select on profiles for select to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3) Tabellen-Grant für `anon` zurücknehmen
--    Nötig zusätzlich zur Policy, weil `anon` das SELECT-Recht auf `profiles`
--    aus zwei Quellen hat: dem expliziten Grant der Team-Migration und den
--    Default-Privileges aus 20260614120000. REVOKE räumt beide ab; die Policy
--    allein würde die Tabelle zwar leer, aber weiterhin abfragbar lassen.
-- ----------------------------------------------------------------------------
revoke select on profiles from anon;
