-- Team-Kalender (Epic #321): die Längenchecks aus Teil A (termine_ohne_training)
-- wurden NOT VALID eingeführt. Hier wird der Bestand geprüft — bewusst getrennt
-- von der Terminserien-Migration, damit ein Bestandsproblem auf Prod nicht das
-- ganze Serienschema zurückrollt.
set lock_timeout = '5s';

alter table training_termine validate constraint tt_ort_laenge;
alter table training_termine validate constraint tt_bemerkung_laenge;
