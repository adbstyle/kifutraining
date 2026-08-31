set lock_timeout = '5s';

-- ============================================================================
-- Story 1 (Epic Übungswelten): Die Altersstufe als eigene Angabe
-- ============================================================================
-- Bisher erschloss sich die Altersstufe aus den Alterskategorien (D–A ⇒
-- Juniorenfussball) und aus dem Trainingsteil (jun-* ⇒ Juniorenfussball). Beide
-- Herleitungen sind Rateverfahren: ein Training ohne Alterskategorie galt als
-- Kinderfussball, und eine Übung ohne Junioren-Heimat liess sich nicht als
-- Junioren-Übung führen. Künftig steht die Altersstufe an der Zeile selbst und
-- ist die Quelle, aus der die übrigen Wertebereiche folgen (AC 3).
--
-- Forward-only: drei neue Spalten mit Default bzw. Backfill. Jede bestehende
-- Zeile wird Kinderfussball (AC 7) — auf Produktion ist das per Konstruktion
-- richtig, auf der Testumgebung hat die Vorgängermigration den Bestand
-- daraufhin bereinigt.

-- ----------------------------------------------------------------------------
-- 1) Übung
-- ----------------------------------------------------------------------------
-- Der Default BLEIBT bestehen, auch über Story 3 hinaus: der Manual-Seed
-- schreibt keine Altersstufe, und das Manual Fussball Kinder ist per
-- Definition Kinderfussball. Der CHECK hält den Wertebereich an
-- data/vokabular.yaml, Schlüssel `altersstufe`.
alter table exercises add column altersstufe text not null
  default 'kinderfussball'
  check (altersstufe in ('kinderfussball','juniorenfussball'));

comment on column exercises.altersstufe is
  'Nach welchem Lehrmittel diese Übung geführt wird — Manual Fussball Kinder oder Manual Fussball Jugendliche. Bestimmt Alterskategorien, Trainingsteil, Erscheinungsformen, Feldtyp/Spielfeldgrösse, Übungstyp und Ablaufform (Story 1, Epic Übungswelten). Der Default bleibt: der Manual-Seed schreibt die Angabe nicht.';

-- ----------------------------------------------------------------------------
-- 2) Training
-- ----------------------------------------------------------------------------
-- Hier ist der Default ein Übergang: mit Story 5 wählt der Trainer die
-- Altersstufe beim Anlegen, und die Spalte wird ohne Default geführt. Bis
-- dahin legt die Applikation jedes Training als Kinderfussball an (AC 8) —
-- ausser sie leitet es transitional aus den gewählten Alterskategorien ab.
alter table trainings add column altersstufe text not null
  default 'kinderfussball'
  check (altersstufe in ('kinderfussball','juniorenfussball'));

comment on column trainings.altersstufe is
  'Nach welchem Lehrmittel dieses Training geführt wird. Steht ab dem Anlegen fest und ändert sich nie (Trigger trainings_altersstufe_unveraenderlich); wer für die andere Altersstufe plant, legt ein neues Training an (Story 1/5, Epic Übungswelten). Der Default fällt mit Story 5.';

-- ----------------------------------------------------------------------------
-- 3) Fassung im Training
-- ----------------------------------------------------------------------------
-- Die Fassung erbt die Altersstufe ihres Trainings — sie ist keine eigene
-- Angabe, sondern eine mitgeführte Kopie. Nötig ist sie trotzdem: die
-- Wertebereichs-Regeln der Folgemigration sind CHECKs, und ein CHECK kann
-- keine zweite Tabelle lesen.
--
-- Zuerst nullable anlegen, dann backfillen, dann festziehen: ein Default liesse
-- Junioren-Fassungen still als Kinderfussball entstehen, falls der Erb-Trigger
-- je ausfiele.
alter table training_exercises add column altersstufe text
  check (altersstufe in ('kinderfussball','juniorenfussball'));

-- Zwei Trigger stehen dem Backfill im Weg — beide zu, wie in der
-- Vorgängermigration (uebungswelten_testdaten_bereinigen):
--
-- `training_exercises_touch` würde jedem Training das Deploy-Datum als
-- «Geändert» schreiben; die Übersicht behauptete eine Änderung, die niemand
-- vorgenommen hat (Muster: herkunftsangaben_abbau).
--
-- `training_exercises_oeffentlich_gate` feuert bei JEDEM Update auf dieser
-- Tabelle und prüft dann die Veröffentlichungs-Bedingungen des ganzen
-- Trainings. Der Backfill fasst jede Zeile an — ein bestehendes öffentliches
-- Training, dem heute eine Bedingung fehlt (Alterskategorie, Einleitung oder
-- freies Spiel), liesse den Deploy an einer Altzeile scheitern, die niemand
-- angerührt hat. Geändert wird hier ohnehin nur die geerbte Altersstufe, die
-- keine Bedingung berührt.
alter table training_exercises disable trigger training_exercises_touch;
alter table training_exercises disable trigger training_exercises_oeffentlich_gate;

update training_exercises te
  set altersstufe = t.altersstufe
  from trainings t
  where t.id = te.training_id;

alter table training_exercises enable trigger training_exercises_oeffentlich_gate;
alter table training_exercises enable trigger training_exercises_touch;

alter table training_exercises alter column altersstufe set not null;

comment on column training_exercises.altersstufe is
  'Geerbt vom Training (Trigger te_altersstufe_erben) — nie von der Applikation geschrieben. Trägt die Altersstufe an die Zeile heran, damit die Wertebereichs-CHECKs sie sehen (Story 1, Epic Übungswelten).';

-- ----------------------------------------------------------------------------
-- 4) Der Erb-Trigger
-- ----------------------------------------------------------------------------
-- Setzt die Altersstufe bedingungslos aus dem Training — auch wenn der
-- Aufrufer einen Wert mitschickt. Damit ist die Spalte für die Applikation
-- unbeschreibbar und kann nicht von der ihres Trainings abweichen.
--
-- `update of training_id` deckt das Verschieben einer Fassung in ein anderes
-- Training ab. Existiert das Training nicht, lässt `select into` den Wert
-- unverändert und die NOT-NULL-Regel bricht ab — der Fremdschlüssel schliesst
-- diesen Fall ohnehin aus.
create function te_altersstufe_erben() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  select t.altersstufe into new.altersstufe
    from trainings t where t.id = new.training_id;
  return new;
end;
$$;

create trigger te_altersstufe_erben
  before insert or update of training_id on training_exercises
  for each row execute function te_altersstufe_erben();

-- ----------------------------------------------------------------------------
-- 5) Die Altersstufe eines Trainings ist unveränderlich
-- ----------------------------------------------------------------------------
-- Der Product Owner hat den Altersstufen-Wechsel am 2026-08-30 ersatzlos
-- gestrichen: Übungsbestand, Trainingsteile und Gliederung der beiden
-- Lehrmittel sind verschieden, fachlich ist nichts übernehmbar. Wer für die
-- andere Altersstufe plant, legt ein neues Training an.
--
-- Bewusst als Trigger und nicht als CHECK: ein CHECK sieht nur die neue Zeile,
-- nicht den Vergleich mit der alten. Die Meldung ist ein Marker, den die
-- Applikation in Klartext übersetzt (web/lib/training-bedingungen.ts).
create function trainings_altersstufe_unveraenderlich() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.altersstufe is distinct from old.altersstufe then
    raise exception 'ALTERSSTUFE_UNVERAENDERLICH: die Altersstufe eines Trainings steht ab dem Anlegen fest';
  end if;
  return new;
end;
$$;

create trigger trainings_altersstufe_unveraenderlich
  before update on trainings
  for each row execute function trainings_altersstufe_unveraenderlich();

reset lock_timeout;
