set lock_timeout = '5s';

-- ============================================================================
-- Story 3 (Epic #71): Mischverbot validieren
-- ============================================================================
-- Das Mischverbot kam als NOT VALID, weil es eine neue Invariante auf einer
-- bestehenden Tabelle ist. Der Bestand erfüllt es per Konstruktion: vor diesem
-- Epic liess training_valid_stufen ausschliesslich {G,F,E} zu, und jede solche
-- Zeile ist eine Teilmenge des Kinderfussball-Zweigs.
--
-- VALIDATE nimmt nur SHARE UPDATE EXCLUSIVE — kein Schreib-Lock auf trainings.
alter table trainings validate constraint training_stufen_ein_schema;
