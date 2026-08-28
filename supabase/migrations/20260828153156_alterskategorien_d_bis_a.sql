set lock_timeout = '5s';

-- ============================================================================
-- Story 2 (Epic #71): Alterskategorien D bis A
-- ============================================================================
-- Erweitert die erlaubten Alterskategorien von {G,F,E} auf {G,F,E,D,C,B,A}.
-- Reine ERWEITERUNG des Wertebereichs (Epic-NFR 2): jede bestehende Zeile
-- erfüllt die neue Regel trivial. Drop + Add in einer Transaktion ist damit
-- forward-only-sicher; das ADD validiert die kleinen Tabellen inline, ohne
-- dass je ein Zustand entsteht, in dem produktive Zeilen eine geltende Regel
-- verletzen.
--
-- Das Mischverbot — ein Training trägt nie Kategorien beider Schemata —
-- gehört bewusst NICHT hierher, sondern zur Schema-Story. Übungen dürfen
-- mischen: eine Übung kann beiden Schemata dienen (Story 2, Anmerkung).

alter table exercises drop constraint valid_kategorien;
alter table exercises add constraint valid_kategorien
  check (kategorien <@ array['G','F','E','D','C','B','A']);

alter table trainings drop constraint training_valid_stufen;
alter table trainings add constraint training_valid_stufen
  check (stufen <@ array['G','F','E','D','C','B','A']);
