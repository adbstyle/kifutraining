set lock_timeout = '5s';

-- ============================================================================
-- Story 10 (Epic #71): Trainingsziel
-- ============================================================================
-- Das Manual macht die zielgerichtete Planung zur Kernqualität eines Trainings
-- (S. 41/42). Es spricht von Zielen im Plural über vier Dimensionen; die
-- Applikation verdichtet das bewusst auf genau ein optionales Freitext-Ziel
-- pro Training, für beide Schemata.
--
-- NULL heisst «kein Ziel»; leere und reine Leerzeichen-Eingaben normalisiert
-- die Applikation dorthin. Die Obergrenze entspricht der einzigen bereits
-- bestehenden Textbegrenzung der Applikation (Diagramm-Beschriftungen).
alter table trainings add column ziel text
  check (ziel is null or char_length(ziel) <= 200);
