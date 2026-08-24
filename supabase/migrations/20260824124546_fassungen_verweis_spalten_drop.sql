-- ============================================================================
-- Story 9 AK 7 (Epic #72), Phase 2: die Verweis-Spalten fallen
-- ============================================================================
-- Phase 1 (20260824120550) hat Code und Regeln bereinigt — seither liest und
-- schreibt kein Bundle mehr exercise_id oder exercise_name_cache. Der Drop
-- läuft bewusst in einem eigenen Release NACH dem Bundle-Swap: in derselben
-- Migration hätte das alte Bundle im Deploy-Fenster jede Trainings-Ansicht
-- verloren (sein Select trug die Spalten noch).
--
-- Kein Nutzdatenverlust: die Inhalte liegen vollständig in den Fassungs-
-- Spalten (Nachweis in Prod 2026-08-24, 37/37); der Namens-Cache war seit
-- Phase 1 toter Ballast. Damit ist der Verweis-Abbau abgeschlossen und ein
-- Training hängt von keiner Bibliotheks-Übung mehr ab.
alter table training_exercises
  drop column exercise_id,
  drop column exercise_name_cache;
