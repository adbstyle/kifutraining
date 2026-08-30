set lock_timeout = '5s';

-- ============================================================================
-- Story 1 (Epic Übungswelten): Die Wertebereiche hängen an der Altersstufe
-- ============================================================================
-- Jede Regel, die bisher aus Alterskategorie oder Trainingsteil erraten wurde,
-- verzweigt neu über `altersstufe`. Die Datenbank ist dabei die
-- Trust-Boundary (AC 9): auch eine Änderung, die die Oberfläche umgeht, kann
-- keine Übung und kein Training mit Werten der falschen Altersstufe erzeugen.
--
-- Forward-only und beweisbar sicher: Jeder Kinderfussball-Zweig unten ist
-- wortgleich die Regel, die auf Produktion heute schon gilt, und der gesamte
-- dortige Bestand ist Kinderfussball (Spalten-Migration, AC 7). Diese
-- Constraints dürfen darum inline validieren. Alles, wofür es an
-- `training_exercises` bisher GAR KEINE Regel gab, kommt als NOT VALID: die
-- Fassungen wurden dort nie geprüft, und ein Deploy soll nicht an einer
-- Altzeile scheitern, die niemand je zu Gesicht bekommt. Die nachgelagerte
-- Validierung ist Issue #45 und bleibt offen — auch für die bereits
-- bestehenden NOT-VALID-Constraints wird hier NICHTS validiert.
--
-- Slug-Listen unten stammen aus data/vokabular.yaml (Schlüssel `kategorien`,
-- `trainingsteil`, `junioren_block`, `erscheinungsform`,
-- `erscheinungsform_junioren`, `uebungstyp`).

-- ----------------------------------------------------------------------------
-- 1) Alterskategorien je Altersstufe (AC 4, AC 6)
-- ----------------------------------------------------------------------------
-- Der alte `valid_kategorien` liess nach der Junioren-Erweiterung alle sieben
-- Kategorien an jeder Übung zu und kannte keine Nicht-leer-Bedingung; es gibt
-- also keinen Teil, der zu übernehmen wäre. Dass eine Übung mindestens eine
-- Alterskategorie trägt, setzt weiterhin die Applikation durch.
alter table exercises drop constraint valid_kategorien;
alter table exercises add constraint ex_kategorien_je_altersstufe check (
  case altersstufe
    when 'kinderfussball' then kategorien <@ array['G','F','E']
    else kategorien <@ array['D','C','B','A']
  end
);
comment on constraint ex_kategorien_je_altersstufe on exercises is
  'Spiegel von kategorienFuer() in web/lib/altersstufe.ts.';

-- Am Training ersetzen zwei alte Regeln eine neue: `training_valid_stufen`
-- (Wertebereich) und `training_stufen_ein_schema` (Mischverbot) sind beide in
-- dieser Verzweigung enthalten — und schärfer, weil die erlaubte Menge jetzt
-- aus der Altersstufe folgt statt aus der Auswahl selbst.
--
-- Das leere Array erfüllt beide Zweige und bleibt damit erlaubt: bestehende
-- Trainings ohne Alterskategorie bleiben bearbeitbar (PO 2026-08-30). Dass ein
-- NEUES Training mindestens eine trägt, setzt ein Trigger der Rückbau-Migration
-- durch.
alter table trainings drop constraint training_valid_stufen;
alter table trainings drop constraint training_stufen_ein_schema;
alter table trainings add constraint training_stufen_je_altersstufe check (
  case altersstufe
    when 'kinderfussball' then stufen <@ array['G','F','E']
    else stufen <@ array['D','C','B','A']
  end
);
comment on constraint training_stufen_je_altersstufe on trainings is
  'Spiegel von kategorienFuer() in web/lib/altersstufe.ts.';

-- An der Fassung gab es diese Regel bisher nicht — darum NOT VALID.
alter table training_exercises add constraint te_kategorien_je_altersstufe check (
  case altersstufe
    when 'kinderfussball' then kategorien <@ array['G','F','E']
    else kategorien <@ array['D','C','B','A']
  end
) not valid;
comment on constraint te_kategorien_je_altersstufe on training_exercises is
  'Spiegel von kategorienFuer() in web/lib/altersstufe.ts.';

-- ----------------------------------------------------------------------------
-- 2) Trainingsteil je Altersstufe (AC 5)
-- ----------------------------------------------------------------------------
-- Im Kinderfussball die vier Trainingsteile des Manuals Fussball Kinder, im
-- Juniorenfussball alle sechs Blöcke des Manuals Fussball Jugendliche. Die
-- bisherige Beschränkung der Übungen auf drei Junioren-«Heimaten» fällt: eine
-- Junioren-Übung gehört in ihren eigenen Block, nicht in einen, über den ein
-- Kinderfussball-Pfad hinführt (Story 3 AC 4).
alter table exercises drop constraint exercises_trainingsteil_check;
alter table exercises add constraint ex_trainingsteil_je_altersstufe check (
  case altersstufe
    when 'kinderfussball'
      then trainingsteil in ('auffangen','einleitung','hauptteil','ausklang')
    else trainingsteil in (
      'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
      'jun-spielformen','jun-spiel','jun-ausklang')
  end
);
comment on constraint ex_trainingsteil_je_altersstufe on exercises is
  'Spiegel von altersstufeDerEinordnung() in web/lib/altersstufe.ts.';

-- Dieselbe Regel an der Fassung, ohne `nacharbeit`: Der Zustand «ohne
-- Entsprechung im neuen Schema» entstand allein beim Altersstufen-Wechsel, den
-- diese Epic ersatzlos zurückbaut.
alter table training_exercises drop constraint training_exercises_trainingsteil_check;
alter table training_exercises add constraint te_trainingsteil_je_altersstufe check (
  case altersstufe
    when 'kinderfussball'
      then trainingsteil in ('auffangen','einleitung','hauptteil','ausklang')
    else trainingsteil in (
      'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
      'jun-spielformen','jun-spiel','jun-ausklang')
  end
);
comment on constraint te_trainingsteil_je_altersstufe on training_exercises is
  'Spiegel von altersstufeDerEinordnung() in web/lib/altersstufe.ts.';

-- ----------------------------------------------------------------------------
-- 3) Feldtyp nur im Kinderfussball, Übungstyp nur im Juniorenfussball
-- ----------------------------------------------------------------------------
-- Der Feldtyp (Kleinfeld/Grossfeld/Freies Feld) ist eine Kategorie des Manuals
-- Fussball Kinder; das Junioren-Manual führt stattdessen eine Spielfeldgrösse
-- in Metern (Story 3). Den Übungstyp kennt umgekehrt nur das Junioren-Manual —
-- und dort nur in den Blöcken, in denen eine Spielform vorkommen kann:
-- Explosivität und Ausklang tragen keinen (PO 2026-08-30).
--
-- Gleicher Constraint-Name auf beiden Tabellen: es ist dieselbe Regel am
-- gleichen Feld, und die Applikation übersetzt sie in eine Meldung. Constraint-
-- Namen sind in Postgres je Relation eindeutig, die Doppelung ist zulässig.
alter table exercises add constraint ex_feldtyp_nur_kifu check (
  altersstufe = 'kinderfussball' or feldtyp is null
);
comment on constraint ex_feldtyp_nur_kifu on exercises is
  'Der Spiegel in web/lib/altersstufe.ts folgt mit Story 3 (Feldtyp vs. Spielfeldgrösse); bis dahin setzt allein die Datenbank die Regel durch.';

alter table training_exercises add constraint ex_feldtyp_nur_kifu check (
  altersstufe = 'kinderfussball' or feldtyp is null
) not valid;
comment on constraint ex_feldtyp_nur_kifu on training_exercises is
  'Der Spiegel in web/lib/altersstufe.ts folgt mit Story 3 (Feldtyp vs. Spielfeldgrösse); bis dahin setzt allein die Datenbank die Regel durch.';

alter table exercises add constraint ex_uebungstyp_nur_junioren check (
  uebungstyp is null
  or (altersstufe = 'juniorenfussball'
      and trainingsteil in ('jun-aufwaermen','jun-spielform-trainingsziel',
                            'jun-spielformen','jun-spiel'))
);
comment on constraint ex_uebungstyp_nur_junioren on exercises is
  'Der Spiegel in web/lib/altersstufe.ts folgt mit Story 3 (Übungstyp je Block); bis dahin setzt allein die Datenbank die Regel durch.';

alter table training_exercises add constraint ex_uebungstyp_nur_junioren check (
  uebungstyp is null
  or (altersstufe = 'juniorenfussball'
      and trainingsteil in ('jun-aufwaermen','jun-spielform-trainingsziel',
                            'jun-spielformen','jun-spiel'))
) not valid;
comment on constraint ex_uebungstyp_nur_junioren on training_exercises is
  'Der Spiegel in web/lib/altersstufe.ts folgt mit Story 3 (Übungstyp je Block); bis dahin setzt allein die Datenbank die Regel durch.';

-- ----------------------------------------------------------------------------
-- 4) Erscheinungsformen je Altersstufe
-- ----------------------------------------------------------------------------
-- Die beiden Manuals führen zwei verschiedene Kataloge; bisher standen beide
-- jeder berechtigten Übung offen. Neu gilt je Altersstufe genau einer.
--
-- Im Juniorenfussball dürfen ALLE sechs Blöcke eine Erscheinungsform tragen,
-- der Ausklang eingeschlossen: er ist dort mehr als das Ausklingen des
-- Kinderfussballs — Cool-down, Mobilität und Austausch, und der Austausch
-- trifft «Positiv miteinander umgehen» (PO 2026-08-30).
--
-- Im Kinderfussball bleibt alles wie bisher: nur Hauptteil und Einleitung,
-- nur die sechs Werte des Manuals Fussball Kinder, sonst leer.
alter table exercises drop constraint erscheinungsform_nur_haupt_einleitung;
alter table exercises add constraint erscheinungsform_je_altersstufe check (
  case
    when altersstufe = 'juniorenfussball' then erscheinungsform <@ array[
      'spiel-variantenreich-aufbauen','torchancen-vorbereiten-abschliessen',
      'offensive-zweikaempfe-bestreiten','ballorientiert-kompakt-verteidigen',
      'defensive-zweikaempfe-bestreiten','schnell-umschalten',
      'explosiv-dynamisch-agieren','koerper-stabil-halten',
      'intensive-spielaktionen-ausfuehren','positiv-miteinander-umgehen',
      'mutig-selbstbewusst-handeln']
    when trainingsteil in ('hauptteil','einleitung') then erscheinungsform <@ array[
      'spiel-kreativ-gestalten','ball-entschlossen-erobern',
      'mutig-tore-erzielen','mutig-tore-verhindern',
      'flink-geschickt-bewegen','respektvoll-fair-spielen']
    else erscheinungsform = '{}'::text[]
  end
);
comment on constraint erscheinungsform_je_altersstufe on exercises is
  'Spiegel von erscheinungsformenFuer() in web/lib/altersstufe.ts.';

-- An der Fassung gab es bisher GAR KEINE Erscheinungsform-Regel — eine Fassung
-- konnte in jedem Block eine tragen. Darum NOT VALID: Altfassungen im
-- Auffangen oder Ausklang mit einer Erscheinungsform sollen keinen Deploy
-- scheitern lassen. Bearbeitet der Trainer eine solche Fassung, räumt die
-- Applikation das Feld ohnehin auf.
alter table training_exercises add constraint te_erscheinungsform_je_altersstufe check (
  case
    when altersstufe = 'juniorenfussball' then erscheinungsform <@ array[
      'spiel-variantenreich-aufbauen','torchancen-vorbereiten-abschliessen',
      'offensive-zweikaempfe-bestreiten','ballorientiert-kompakt-verteidigen',
      'defensive-zweikaempfe-bestreiten','schnell-umschalten',
      'explosiv-dynamisch-agieren','koerper-stabil-halten',
      'intensive-spielaktionen-ausfuehren','positiv-miteinander-umgehen',
      'mutig-selbstbewusst-handeln']
    when trainingsteil in ('hauptteil','einleitung') then erscheinungsform <@ array[
      'spiel-kreativ-gestalten','ball-entschlossen-erobern',
      'mutig-tore-erzielen','mutig-tore-verhindern',
      'flink-geschickt-bewegen','respektvoll-fair-spielen']
    else erscheinungsform = '{}'::text[]
  end
) not valid;
comment on constraint te_erscheinungsform_je_altersstufe on training_exercises is
  'Spiegel von erscheinungsformenFuer() in web/lib/altersstufe.ts.';

-- ----------------------------------------------------------------------------
-- 5) Ablaufform je Altersstufe und Einordnung
-- ----------------------------------------------------------------------------
-- Der methodische Fahrplan («Offen starten – Üben – Wetteifern») ist Didaktik
-- des Manuals Fussball Kinder und bleibt ihm vorbehalten. Eine Junioren-Übung
-- trägt in ALLEN sechs Blöcken einen zusammenhängenden Beschreibungstext, und
-- zwar zwingend (PO 2026-08-30, am Manual belegt: die Wörter «offen starten»,
-- «üben» und «wetteifern» kommen im Manual Fussball Jugendliche kein einziges
-- Mal vor).
--
-- Der Junioren-Zweig kommt zuerst; die drei Kinderfussball-Zweige darunter sind
-- wortgleich die bisherige Fassung (Migration junioren_heimat), abzüglich der
-- beiden Junioren-Heimaten, die es als Kinderfussball-Sonderfall nicht mehr
-- gibt.
alter table exercises drop constraint ablauf_je_einordnung;
alter table exercises add constraint ablauf_je_einordnung check (
  case
    when altersstufe = 'juniorenfussball'
      then methodischer_fahrplan is null and coalesce(btrim(aufbau), '') <> ''
    when hauptteilkategorie = 'fussball-spielen'
      then coalesce(btrim(aufbau), '') <> '' and methodischer_fahrplan is null
    when trainingsteil in ('einleitung', 'hauptteil')
      then methodischer_fahrplan is not null
    else coalesce(btrim(aufbau), '') <> ''
  end
);
comment on constraint ablauf_je_einordnung on exercises is
  'Der Spiegel in web/lib/altersstufe.ts folgt mit Story 3 (Ablaufform je Altersstufe); die Kinderfussball-Zweige spiegelt heute brauchtFahrplan() in web/lib/labels.ts.';

-- Dieselbe Regel an der Fassung, ebenfalls neu und darum NOT VALID: eine
-- Fassung konnte bisher inhaltsleer im Training liegen.
alter table training_exercises add constraint te_ablauf_je_einordnung check (
  case
    when altersstufe = 'juniorenfussball'
      then methodischer_fahrplan is null and coalesce(btrim(aufbau), '') <> ''
    when hauptteilkategorie = 'fussball-spielen'
      then coalesce(btrim(aufbau), '') <> '' and methodischer_fahrplan is null
    when trainingsteil in ('einleitung', 'hauptteil')
      then methodischer_fahrplan is not null
    else coalesce(btrim(aufbau), '') <> ''
  end
) not valid;
comment on constraint te_ablauf_je_einordnung on training_exercises is
  'Der Spiegel in web/lib/altersstufe.ts folgt mit Story 3 (Ablaufform je Altersstufe); die Kinderfussball-Zweige spiegelt heute brauchtFahrplanFuerFassung() in web/lib/labels.ts.';

-- ----------------------------------------------------------------------------
-- 6) Fahrplan-Vollständigkeit bleibt Kinderfussball
-- ----------------------------------------------------------------------------
-- Die beiden Junioren-Sonderzweige — nur «Offen starten» Pflicht — fallen
-- ersatzlos: eine Junioren-Übung trägt gar keinen Fahrplan mehr. Die
-- Kinderfussball-Logik ist unverändert; für eine Junioren-Zeile greift der
-- ELSE-Zweig, weil `einleitung` und `hauptteil` dort keine gültigen
-- Trainingsteile sind.
alter table exercises drop constraint fahrplan_vollstaendig;
alter table exercises add constraint fahrplan_vollstaendig check (
  case
    when trainingsteil in ('einleitung', 'hauptteil')
         and hauptteilkategorie is distinct from 'fussball-spielen'
      then coalesce(methodischer_fahrplan->>'offen_starten', '') <> ''
        -- jsonb_typeof-Guard: schützt vor {"ueben": null}, wo
        -- jsonb_array_length hart würfe.
        and jsonb_typeof(methodischer_fahrplan->'ueben') = 'array'
        and jsonb_array_length(methodischer_fahrplan->'ueben') >= 1
        and coalesce(methodischer_fahrplan->>'wetteifern', '') <> ''
    else true
  end
);
comment on constraint fahrplan_vollstaendig on exercises is
  'Spiegel von fassungUnvollstaendig() in web/lib/fassung.ts; die Zuständigkeit je Altersstufe steht in altersstufeDerEinordnung() in web/lib/altersstufe.ts.';

reset lock_timeout;
