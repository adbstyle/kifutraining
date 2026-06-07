-- Schliesst den Übergangszustand aus 20260607110000: dort wurde der Constraint
-- hauptteilkategorie_genau_bei_hauptteil als NOT VALID angelegt, weil Production
-- bereits geseedet war. Der Seed hat danach alle Hauptteil-Zeilen mit Kategorie
-- versehen; jetzt ist die Voll-Validierung gefahrlos. Damit ist die Invariante
-- für den gesamten Bestand garantiert — kein NOT-VALID-Sonderfall bleibt offen.
alter table exercises validate constraint hauptteilkategorie_genau_bei_hauptteil;
