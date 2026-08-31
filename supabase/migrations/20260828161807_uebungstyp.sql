set lock_timeout = '5s';

-- ============================================================================
-- Story 9 (Epic #71): Übungstyp
-- ============================================================================
-- Das Manual Fussball Jugendliche typisiert seine Trainingsformen dreiteilig
-- (S. 56). In der Applikation heisst das Attribut «Übungstyp»; der dritte Wert
-- heisst «Isolierte Form» statt wie im Manual «Übung» — dieser Begriff
-- kollidierte mit dem Objekt Übung der Applikation (PO 2026-08-17).
--
-- Optional für alle Übungen und Fassungen, kein Backfill des Bestands: der
-- Übungstyp bleibt eine freie Selbstauskunft und wird gegen nichts geprüft.
alter table exercises add column uebungstyp text
  check (uebungstyp in ('basisspielform','spielform','isolierte-form'));
alter table training_exercises add column uebungstyp text
  check (uebungstyp in ('basisspielform','spielform','isolierte-form'));
