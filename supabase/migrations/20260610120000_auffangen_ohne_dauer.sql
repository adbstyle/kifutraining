-- „Auffangen" trägt keine Dauer: der Teil vor dem eigentlichen Trainingsbeginn
-- wird aufgesetzt, die Spielerinnen machen mit oder nicht — er zählt nicht zur
-- Trainingsdauer. Invariante analog zu `erscheinungsform_nur_haupt_einleitung`.

-- 1) Backfill ZUERST: bestehende Auffangen-Dauern leeren, damit der Constraint
--    danach gegen die Altzeilen validiert (kein NOT VALID nötig — Statements
--    laufen sequenziell in einer Migration).
update public.plan_exercises
set duration_min = null
where trainingsteil = 'auffangen'
  and duration_min is not null;

-- 2) Constraint: Auffangen-Zuordnungen dürfen keine Dauer tragen.
alter table public.plan_exercises
  add constraint dauer_nicht_auffangen
  check (trainingsteil <> 'auffangen' or duration_min is null);
