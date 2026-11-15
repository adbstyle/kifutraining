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
-- Bis zu dieser Datei haben keine Migration und kein Schreibweg Zeilen
-- erzeugt, die die FKs nicht schon beim Schreiben prüften. Die Zählabfragen
-- «Zeilen, die die Validierung brächen» für die Generalprobe stehen im Plan,
-- Phase G. Scheitert nur diese Datei, ist der fachliche Stand vollständig;
-- die Validierung kommt dann nach der Bereinigung als Vorwärts-Migration
-- (AP §6.1 «Reihenfolge innerhalb des Release», §10 Risiko 21).
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
