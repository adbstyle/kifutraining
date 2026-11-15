-- Zuordnungs-Invarianten validieren (Story 3 #579, Epic #575; Architekturplan
-- Vereine §3 «Warum die Validierung erst im letzten PR entsteht», §3.3 b,
-- §6.1 Schritt 1; Plan Phase A).
--
-- `20261114100000_zuordnung_invarianten.sql` hat elf Fremdschlüssel `not valid`
-- angelegt: Neue Zeilen prüfen sie seither, den Bestand nicht. Diese Datei
-- prüft den Bestand und markiert sie als gültig. Sie trägt den spätesten
-- Zeitstempel des Release: `db push` läuft ohne `--include-all`, eine früher
-- angelegte Datei hätte jede spätere Story-Migration abgewiesen.
--
-- Nicht hier, sondern im Nachlauf N1 (AP §3.8): die Pflicht `verein_id` auf
-- `teams` und `spieler` (`not valid` → `validate` → `set not null`). Die
-- `not valid`-Constraints von `training_exercises` stammen von vor dem Epic
-- und bleiben unberührt (AP §6.5).
--
-- Warum der Bestand sie erfüllt (Prod hatte vor dem Release je Spieler:in
-- genau ein unveränderliches Team, `spieler_team_fest`):
-- - Zuordnungs-FKs (`ks_`, `ta_`, `sm_zuordnung`): Die Fundament-Migration
--   ordnet jede Spieler:in ihrem Team `spieler.team_id` zu und bricht sonst ab
--   (`BACKFILL_UNVOLLSTAENDIG`). Kader und Meldungen schrieben vor dem Epic
--   nur DEFINER-RPCs, und jede prüfte `spieler.team_id` gegen das Team des
--   Termins bzw. Kaders; `authenticated` hatte auf diese Tabellen nur `select`.
-- - Termin-FKs (`*_termin_team`) und Historie (`*_eingefroren_team`): Dieselben
--   RPCs übernahmen `team_id` aus dem Termin bzw. dem festgehaltenen Termin.
-- Geschrieben haben in diese elf Tabellen bisher nur DEFINER-RPCs und Trigger.
-- Eine theoretische Lücke: `authenticated` durfte auf dem alten Schema
-- `training_termine` direkt ändern (RLS nur mit Team-Mitgliedschaft, kein
-- Trigger auf `team_id`); ein Mitglied zweier Teams hätte einen Termin per
-- direktem API-Aufruf umhängen können. Die Anwendung tut das nie, und die
-- Zählabfrage der Generalprobe (Plan, Phase G) deckt es auf.
-- Rückfallweg: Die Zählabfrage der Generalprobe (elf Zahlen, Soll 0) soll den
-- Fall vorher ausschliessen. Scheitert die Datei dennoch im Fenster, sind alle
-- früheren Dateien angewandt und der fachliche Stand ist vollständig; die
-- Datei ist wiederholbar (`validate constraint` auf ein schon gültiges
-- Constraint ist ein No-op), bleibt aber offen, und jeder weitere `db push`
-- scheitert wieder an ihr. Gangbar: (a) die verletzenden Zeilen im Fenster per
-- SQL bereinigen (ausdrückliche Entscheidung des PO, Freigabe im Moment, nur
-- mit vorheriger Zählung und Protokoll) und `db push` wiederholen; oder (b)
-- eine Bereinigungs-Migration mit einem Zeitstempel zwischen `20261115130000`
-- und `20261115140000` (Prod nimmt sie an, weil dort zuletzt `…130000`
-- angewandt ist; Staging hat `…140000` schon und braucht danach
-- `reset-staging`, Sync aus `main` und `deploy-staging`). Nicht gangbar: eine
-- spätere Migration (sie kommt nie zum Zug) sowie die Datei ändern oder
-- umbenennen (Staging hat sie angewandt). (AP §6.1 «Reihenfolge innerhalb des
-- Release», §10 Risiko 21.)
--
-- `validate constraint` nimmt auf der Tabelle nur SHARE UPDATE EXCLUSIVE
-- (Lesen und Schreiben laufen weiter) und auf der referenzierten Tabelle
-- ROW SHARE, liest aber beide ganz. Im Wartungsfenster unkritisch.

set lock_timeout = '5s';

-- Zuordnungs-FKs: Kader und Meldungen nur für Zugeordnete.
alter table kader_spieler        validate constraint ks_zuordnung;
alter table termin_abmeldungen   validate constraint ta_zuordnung;
alter table spiel_meldungen      validate constraint sm_zuordnung;

-- Termin-FKs: das denormalisierte team_id passt zum Termin.
alter table termin_abmeldungen   validate constraint ta_termin_team;
alter table termin_statuswechsel validate constraint tsw_termin_team;
alter table spiel_meldungen      validate constraint sm_termin_team;
alter table termin_eingefroren   validate constraint te_termin_team;
alter table termin_kader         validate constraint tk_termin_team;
alter table spiel_treffpunkte    validate constraint stp_termin_team;

-- Historie: team_id passt zum festgehaltenen Termin.
alter table termin_teilnahmen    validate constraint tn_eingefroren_team;
alter table spiel_teilnahmen     validate constraint st_eingefroren_team;

reset lock_timeout;
