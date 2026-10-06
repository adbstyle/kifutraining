-- ============================================================================
-- Platz und Spielerzahl am Termin (Epic #388), Story 2 (#390): die erwartete
-- Spielerzahl eines Termins — alle erwarteten Kinder einschliesslich
-- Torhüter:innen, ohne Trainer:innen (PO 7). Eine erwartete Zahl, keine
-- Anwesenheit (OoS 1, 2).
--
-- Forward-only: neue, nullable Spalte. Bestandstermine bleiben NULL (= Zahl
-- unbekannt, PC 2); der CHECK auf der neuen Spalte ist darum sofort gültig.
-- Keine neue Tabelle — PUBLIC_TABLES in sync-staging.yml bleibt unverändert.
-- Das Kalender-Abo (kalender_abo_termine) nennt nur ausgewählte Spalten und
-- gibt die Zahl nicht weiter (OoS 5).
-- ============================================================================
set lock_timeout = '5s';

alter table training_termine add column erwartete_spielerzahl smallint;
-- Ganze Zahl von 1 bis 200 wie der Kinder-Filter der Übungssuche (PO 7).
-- Zwilling: SPIELERZAHL_MIN/MAX und spielerzahlProblem() in web/lib/termin.ts.
-- Der Name `tt_spielerzahl` ist der Marker, an dem lib/training-bedingungen.ts
-- die Klartext-Meldung findet (TERMIN_TEXT.spielerzahl).
alter table training_termine add constraint tt_spielerzahl
  check (erwartete_spielerzahl between 1 and 200);

comment on column training_termine.erwartete_spielerzahl is
  'Erwartete Spielerzahl des Termins (#390): alle erwarteten Kinder einschliesslich Torhüter:innen, '
  'ohne Trainer:innen; 1 bis 200, NULL = unbekannt.';

reset lock_timeout;
