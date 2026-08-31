set lock_timeout = '5s';

-- ============================================================================
-- Story 1 (Epic Übungswelten): Junioren-Testdaten verwerfen
-- ============================================================================
-- Der Juniorenfussball liegt ausschliesslich auf der Testumgebung: Produktion
-- kennt weder die Alterskategorien D bis A noch einen Junioren-Trainingsteil
-- noch einen Übungstyp mit Wert. Der Product Owner hat am 2026-08-30
-- entschieden, dass die dortigen Junioren-Testdaten verworfen werden dürfen —
-- Übungen wie Trainings. Damit entfällt jede Migrationsregel für Objekte mit
-- Werten beider Altersstufen, und die Folgemigrationen können ihre Regeln
-- ohne Rücksicht auf Zwischenzustände scharf schalten.
--
-- Auf Produktion ist diese Datei nachweislich ein No-op: kein Training trägt
-- eine Stufe D–A, keine Zuordnung eine jun-Einordnung, keine Übung einen
-- Übungstyp. Jedes Statement unten trifft dort null Zeilen — die
-- Selbstprüfung am Ende ist damit zugleich der Beleg.
--
-- Reihenfolge zwingend: erst die ganzen Junioren-Trainings (ihre Zuordnungen
-- kaskadieren über den Fremdschlüssel), dann die einzelnen Junioren-
-- Zuordnungen in Kinderfussball-Trainings, dann die Junioren-Übungen, zuletzt
-- die stufenfremden Altwerte an allem, was überlebt hat.

-- ----------------------------------------------------------------------------
-- 0) Die sechs Erscheinungsformen des Manuals Fussball Kinder
-- ----------------------------------------------------------------------------
-- Sie kommen unten sechsmal vor — im Filter, in der Bedingung und in der
-- Selbstprüfung, je an Übung und Fassung. Sechs ausgeschriebene Listen laufen
-- auseinander, ohne dass es auffiele; darum EINE Definition. Sie lebt in
-- `pg_temp`, gilt nur für diese Deploy-Sitzung und verschwindet mit ihr — im
-- Schema bleibt nichts zurück.
--
-- Quelle der Slugs: data/vokabular.yaml, Schlüssel `erscheinungsform`.
create function pg_temp.kifu_erscheinungsformen() returns text[]
language sql immutable
as $$
  select array[
    'spiel-kreativ-gestalten','ball-entschlossen-erobern',
    'mutig-tore-erzielen','mutig-tore-verhindern',
    'flink-geschickt-bewegen','respektvoll-fair-spielen']
$$;

-- ----------------------------------------------------------------------------
-- 1) Zwei Trigger stehen dem Aufräumen im Weg
-- ----------------------------------------------------------------------------
-- `training_exercises_touch` schriebe jedem betroffenen Training das
-- Deploy-Datum als «Geändert» — die Übersicht behauptete eine Änderung, die
-- niemand vorgenommen hat (Muster: herkunftsangaben_abbau).
--
-- `training_exercises_oeffentlich_gate` weist jede Änderung ab, die ein
-- öffentliches Training unter seine Veröffentlichungs-Bedingungen bringt.
-- Genau das tut das Löschen einer Junioren-Zuordnung aus einem öffentlichen
-- Junioren-Training — der Deploy scheiterte daran. Was danach gilt, setzen die
-- Folgemigrationen durch; für den Aufräumlauf selbst ist das Tor zu.
alter table training_exercises disable trigger training_exercises_touch;
alter table training_exercises disable trigger training_exercises_oeffentlich_gate;

-- ----------------------------------------------------------------------------
-- 2) Ganze Junioren-Trainings
-- ----------------------------------------------------------------------------
-- Die Zuordnungen fallen über `training_exercises_training_id_fkey`
-- (ON DELETE CASCADE) automatisch mit; ein vorgezogenes Löschen wäre
-- redundant. Die Termine eines Trainings kaskadieren ebenso.
--
-- Die Bilddateien im Storage bleiben liegen: SQL erreicht ihn nicht. Verwaiste
-- Storage-Dateien sind im Projekt bereits toleriert (`sync-staging` benennt es
-- ausdrücklich), und dies trifft ohnehin nur die Testumgebung.
delete from trainings where stufen && array['D','C','B','A'];

-- ----------------------------------------------------------------------------
-- 3) Junioren-Zuordnungen in überlebenden Trainings
-- ----------------------------------------------------------------------------
-- Sie entstehen im Kinderfussball-Training durch den Schema-Wechsel, den diese
-- Epic ersatzlos zurückbaut. `nacharbeit` gehört dazu: der Zustand «ohne
-- Entsprechung im neuen Schema» kann ohne Wechsel gar nicht mehr auftreten.
delete from training_exercises
  where trainingsteil in (
    'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
    'jun-spielformen','jun-spiel','jun-ausklang','nacharbeit'
  );

-- ----------------------------------------------------------------------------
-- 4) Junioren-Übungen
-- ----------------------------------------------------------------------------
-- Nur Trainer-Übungen: der Manual-Bestand (`source = 'manual'`) ist per
-- Konstruktion Kinderfussball und wird vom Seed ohnehin neu geschrieben.
-- Zwei Merkmale machen eine Übung zur Junioren-Übung: eine Junioren-Heimat
-- oder eine Alterskategorie D–A.
delete from exercises
  where source = 'user'
    and (trainingsteil like 'jun-%' or kategorien && array['D','C','B','A']);

-- ----------------------------------------------------------------------------
-- 5) Stufenfremde Altwerte an allem, was überlebt hat
-- ----------------------------------------------------------------------------
-- Eine Kinderfussball-Übung durfte bisher eine Junioren-Erscheinungsform und
-- einen Übungstyp tragen; beide Vokabulare standen allen berechtigten Übungen
-- offen. Ab der Regel-Migration gilt beides nur noch im Juniorenfussball, und
-- eine solche Zeile wäre für jede weitere Bearbeitung gesperrt. Der PO hat
-- entschieden, den Wert zu entfernen statt die Zeile stehen zu lassen
-- (2026-08-30) — auf Produktion gibt es solche Werte nicht.
update exercises
  set kategorien = array(
        select k from unnest(kategorien) k where k = any (array['G','F','E'])),
      erscheinungsform = array(
        select f from unnest(erscheinungsform) f
         where f = any (pg_temp.kifu_erscheinungsformen())),
      uebungstyp = null
  where kategorien && array['D','C','B','A']
     or not (erscheinungsform <@ pg_temp.kifu_erscheinungsformen())
     or uebungstyp is not null;

-- Dieselbe Bereinigung an den Fassungen. Zusätzlich fallen hier die beiden
-- Konserven-Spalten des Schema-Wechsels leer: sie merkten sich die verlassene
-- Einordnung für den Rückweg, den es ohne Wechsel nicht mehr gibt. Die Spalten
-- selbst fallen in der Rückbau-Migration.
update training_exercises
  set kategorien = array(
        select k from unnest(kategorien) k where k = any (array['G','F','E'])),
      erscheinungsform = array(
        select f from unnest(erscheinungsform) f
         where f = any (pg_temp.kifu_erscheinungsformen())),
      uebungstyp = null,
      einordnung_vorher = null,
      hauptteilkategorie_vorher = null
  where kategorien && array['D','C','B','A']
     or not (erscheinungsform <@ pg_temp.kifu_erscheinungsformen())
     or uebungstyp is not null
     or einordnung_vorher is not null
     or hauptteilkategorie_vorher is not null;

-- ----------------------------------------------------------------------------
-- 6) Die Tore wieder auf
-- ----------------------------------------------------------------------------
alter table training_exercises enable trigger training_exercises_oeffentlich_gate;
alter table training_exercises enable trigger training_exercises_touch;

-- ----------------------------------------------------------------------------
-- 7) Selbstprüfung: kein Junioren-Wert bleibt zurück
-- ----------------------------------------------------------------------------
-- Ein Fund rollt die ganze Datei zurück. Ein erfolgreicher Deploy ist damit
-- die Aussage «der Bestand ist restlos Kinderfussball» — die Voraussetzung,
-- unter der die Folgemigration ihre Kinderfussball-Zweige inline validieren
-- darf. Kein Zähl-Block daneben: `supabase db push` gibt NOTICE nicht aus.
do $$
declare
  v_funde text;
begin
  -- Jeder Zweig ist geklammert: ein `limit` in einem ungeklammerten
  -- UNION-Zweig gälte für die ganze Vereinigung und meldete höchstens EINEN
  -- Fund statt aller.
  select string_agg(fund, ', ' order by fund) into v_funde from (
    (select 'Training mit Alterskategorie D–A' as fund
       from trainings where stufen && array['D','C','B','A'] limit 1)
    union all
    (select 'Übung mit Alterskategorie D–A'
       from exercises where kategorien && array['D','C','B','A'] limit 1)
    union all
    (select 'Fassung mit Alterskategorie D–A'
       from training_exercises where kategorien && array['D','C','B','A'] limit 1)
    union all
    (select 'Übung mit Junioren-Heimat'
       from exercises where trainingsteil like 'jun-%' limit 1)
    union all
    (select 'Fassung mit Junioren-Einordnung oder Nacharbeit'
       from training_exercises
      where trainingsteil like 'jun-%' or trainingsteil = 'nacharbeit' limit 1)
    union all
    (select 'Übung mit Junioren-Erscheinungsform'
       from exercises
      where not (erscheinungsform <@ pg_temp.kifu_erscheinungsformen()) limit 1)
    union all
    (select 'Fassung mit Junioren-Erscheinungsform'
       from training_exercises
      where not (erscheinungsform <@ pg_temp.kifu_erscheinungsformen()) limit 1)
    union all
    (select 'Übung mit Übungstyp' from exercises where uebungstyp is not null limit 1)
    union all
    (select 'Fassung mit Übungstyp'
       from training_exercises where uebungstyp is not null limit 1)
  ) f;

  if v_funde is not null then
    raise exception 'Junioren-Testdaten nicht restlos verworfen: %', v_funde;
  end if;
end;
$$;

reset lock_timeout;
