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
--
-- NOT VALID: Production ist bereits geseedet (75 Übungen), die 55 Hauptteil-Zeilen
-- tragen hier noch hauptteilkategorie = NULL. Ein sofort validierender Constraint
-- würde `supabase db push` an genau diesen Altzeilen scheitern lassen. NOT VALID
-- erzwingt die Invariante ab sofort für JEDE neue/geänderte Zeile (auch für die
-- Upserts des idempotenten Manual-Seeds, der die Kategorien nachträgt), prüft aber
-- den Altbestand nicht. Nach dem nächsten seed-prod-Lauf sind alle Zeilen gültig;
-- eine spätere Migration kann dann `validate constraint` nachziehen.
alter table exercises
  add constraint hauptteilkategorie_genau_bei_hauptteil check (
    (trainingsteil = 'hauptteil') = (hauptteilkategorie is not null)
  ) not valid;

-- Filter-Dimension im Katalog/Planer (Stories #22/#23) — Gleichheits-Set (.in()).
create index exercises_hauptteilkategorie_idx on exercises (hauptteilkategorie);
