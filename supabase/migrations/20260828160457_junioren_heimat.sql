set lock_timeout = '5s';

-- ============================================================================
-- Story 5b (Epic #71): Junioren-Heimat für Übungen
-- ============================================================================
-- Zwei der sechs Junioren-Blöcke sind über den Kinderfussball-Bestand gar
-- nicht erreichbar: die Spielform zum Trainingsziel und die Explosivität
-- kennt das Kinderfussball-Manual nicht. Trainer:innen befüllen sie mit
-- eigenen Übungen — dafür bekommt die Übung eine Junioren-Heimat.
--
-- Die Heimat bleibt die bestehende Spalte `trainingsteil`, erweitert um die
-- drei Einstiegs-Unterblöcke. Dass sie skalar ist, garantiert strukturell,
-- was das Entscheidungsdokument verlangt: genau eine gepflegte Heimat, nie
-- beide Welten gleichzeitig, keine Doppelpflege (§4).
--
-- Alle Änderungen sind Lockerungen bestehender Regeln — jede vorhandene Zeile
-- erfüllt sie unverändert.

-- ----------------------------------------------------------------------------
-- 1) Wertebereich der Heimat
-- ----------------------------------------------------------------------------
-- Nur die drei Einstiegs-Unterblöcke kommen hinzu, bewusst nicht die übrigen
-- Junioren-Blöcke: für Spielformen, Spiel und Ausklang führt der
-- Kinderfussball-Pfad bereits hin, eine direkte Heimat dort erzeugte ohne Not
-- Übungen, die dem Kinderfussball entzogen sind (§4.2).
alter table exercises drop constraint exercises_trainingsteil_check;
alter table exercises add constraint exercises_trainingsteil_check
  check (trainingsteil in (
    'auffangen','einleitung','hauptteil','ausklang',
    'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet'
  ));

-- ----------------------------------------------------------------------------
-- 2) Ablauf-Form je Heimat (Story 5b AC 3–5)
-- ----------------------------------------------------------------------------
-- Aufwärmen und Spielform zum Trainingsziel tragen den methodischen Fahrplan,
-- Explosivität einen Aufbau-Text.
alter table exercises drop constraint ablauf_je_einordnung;
alter table exercises add constraint ablauf_je_einordnung check (
  case
    when hauptteilkategorie = 'fussball-spielen'
      then coalesce(btrim(aufbau), '') <> '' and methodischer_fahrplan is null
    when trainingsteil in ('einleitung', 'hauptteil',
                           'jun-aufwaermen', 'jun-spielform-trainingsziel')
      then methodischer_fahrplan is not null
    else coalesce(btrim(aufbau), '') <> ''
  end
);

-- ----------------------------------------------------------------------------
-- 3) Fahrplan-Vollständigkeit (Story 5b AC 3/4)
-- ----------------------------------------------------------------------------
-- Für die Kinderfussball-Heimaten bleiben alle drei Stufen Pflicht. Für die
-- beiden Junioren-Heimaten ist nur «Offen starten» Pflicht: das Aufwärmen
-- umfasst fachlich auch Körperstabilität und Prävention, und solche Drills
-- haben keinen natürlichen Wettkampf-Abschluss (PO-Entscheid 2026-08-16).
alter table exercises drop constraint fahrplan_vollstaendig;
alter table exercises add constraint fahrplan_vollstaendig check (
  case
    when trainingsteil in ('jun-aufwaermen', 'jun-spielform-trainingsziel')
      then coalesce(methodischer_fahrplan->>'offen_starten', '') <> ''
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

-- ----------------------------------------------------------------------------
-- 4) Erscheinungsform-Berechtigung
-- ----------------------------------------------------------------------------
-- Alle drei Junioren-Heimaten dürfen Erscheinungsformen tragen — auch die
-- Explosivität: das Manual ordnet ihr «Explosiv und dynamisch agieren» 1:1 zu,
-- ohne sie fände dieser Filter genau die passenden Übungen nie (PO 2026-08-17).
-- Auffangen und Ausklang bleiben ausgeschlossen.
alter table exercises drop constraint erscheinungsform_nur_haupt_einleitung;
alter table exercises add constraint erscheinungsform_nur_haupt_einleitung check (
  trainingsteil = any (array['hauptteil','einleitung',
                             'jun-aufwaermen','jun-spielform-trainingsziel',
                             'jun-explosivitaet'])
  or erscheinungsform = '{}'::text[]
);
