-- Hauptteilkategorie als eigenständige, kontrollierte Dimension (Enabler #21).
-- Gliedert Hauptteil-Übungen nach Trainingsinhalt; orthogonal zur Erscheinungsform.
-- Skalar (genau eine Kategorie pro Hauptteil-Übung) — bewusst kein text[] wie
-- erscheinungsform, denn die Kardinalität ist 1, nicht n.

alter table exercises
  add column hauptteilkategorie text
    check (hauptteilkategorie in
      ('fussball-spielen-lernen','vielseitigkeit-erleben','fussball-spielen'));

-- Genau bei Hauptteil-Übungen gesetzt, sonst nie (AC2/AC3 + Postcondition 2):
-- (trainingsteil = 'hauptteil') ⇔ (hauptteilkategorie is not null).
alter table exercises
  add constraint hauptteilkategorie_genau_bei_hauptteil check (
    (trainingsteil = 'hauptteil') = (hauptteilkategorie is not null)
  );

-- Filter-Dimension im Katalog/Planer (Stories #22/#23) — Gleichheits-Set (.in()).
create index exercises_hauptteilkategorie_idx on exercises (hauptteilkategorie);
