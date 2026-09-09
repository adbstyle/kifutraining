set lock_timeout = '5s';

-- ============================================================================
-- Story #152 (Epic #148 Pool-Training): Notiz zu jeder Übung eines Trainings
-- ============================================================================
-- Ein freier Text an der Fassung — was für genau dieses Training gilt, etwa wer
-- die Übung betreut. Er hängt an der FASSUNG und nicht an der Übung im Bestand:
-- Die Notiz gilt diesem einen Training (Epic #72), und dieselbe Übung kann in
-- zwei Trainings ganz Verschiedenes verlangen.
--
-- Eine NEUE Spalte, keine Verschärfung an bestehenden Zeilen: Altzeilen sind
-- `null` und erfüllen den CHECK von selbst. Darum ohne `not valid` — es gibt
-- nichts nachzuvalidieren (Lifecycle forward-only, CLAUDE.md).
--
-- 500 Zeichen: Die Notiz ist eine Randbemerkung neben dem Ablauf, kein zweiter
-- Übungstext. Zwilling der Konstante `NOTIZ_MAX` in web/lib/gruppen.ts.

alter table training_exercises
  add column notiz text check (notiz is null or char_length(notiz) <= 500);

comment on column training_exercises.notiz is
  'Trainingsspezifische Notiz (#152). Bewusst NICHT in FASSUNG_INHALT_FELDER — sie geht nie in die Bibliothek.';

-- ----------------------------------------------------------------------------
-- Selbstprüfung
-- ----------------------------------------------------------------------------
-- Geprüft wird die Spalte samt Längenschranke: Sie ist der Zwilling der
-- Konstante `NOTIZ_MAX`, und liefe sie auseinander, bekäme der Trainer statt
-- der Meldung am Feld einen rohen Constraint-Fehler — oder die Datenbank nähme
-- still an, was die Anwendung ablehnt.
--
-- Geprüft wird die Definition und nicht ein Probeschreiben: Die Migration läuft
-- auf einer Datenbank mit echten Trainings, und ein Testwert in einer fremden
-- Zeile wäre eine Änderung an fremden Daten (samt `updated_at`-Anfassen).
do $$
declare
  v_def text;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public'
                    and table_name = 'training_exercises'
                    and column_name = 'notiz') then
    raise exception 'training_exercises.notiz fehlt';
  end if;

  select pg_get_constraintdef(c.oid) into v_def
    from pg_constraint c
   where c.conrelid = 'training_exercises'::regclass
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) like '%notiz%';
  if v_def is null then
    raise exception 'Kein CHECK an training_exercises.notiz gefunden';
  end if;
  if v_def not like '%500%' then
    raise exception 'CHECK an training_exercises.notiz nennt nicht 500: %', v_def;
  end if;
end;
$$;

reset lock_timeout;
