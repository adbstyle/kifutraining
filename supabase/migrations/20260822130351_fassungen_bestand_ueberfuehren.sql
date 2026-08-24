-- ============================================================================
-- Story 9 (Epic #72): Bestand einmalig in Fassungen überführen
-- ============================================================================
-- Schritt 2 des vierschrittigen Verfahrens (Spike Gate 7):
--   1. Bildkopien  (scripts/fassungen-bilder-kopieren.ts, VOR dieser Migration)
--   2. Feld-Überführung (diese Migration, atomar)
--   3. Nachweis   (scripts/fassungen-nachweis.ts)
--   4. Verweis-Abbau (eigene Migration, erst nach grünem Nachweis)
--
-- Die Bild-URL wird aus dem deterministischen Zielpfad des Kopierskripts
-- gebildet — dieselbe Regel wie in lib/fassung.ts (fassungBildPfad). Läuft die
-- Migration ohne vorherigen Skriptlauf, zeigt die URL ins Leere; genau das
-- deckt der Nachweis in Schritt 3 auf, und ein erneuter Skriptlauf heilt es.
--
-- Angefasst wird nur, was noch nicht überführt ist (`herkunft_datum is null`).
-- Zusätzlich gilt: Inhalte werden nur übertragen, wenn die Zuordnung noch keine
-- trägt (`name is null`). Hat ein Trainer im Auslieferungsfenster — zwischen
-- App-Deploy und dieser Migration — schon eine Fassung bearbeitet, bleibt seine
-- Eingabe erhalten; sie bekommt in Schritt 3 nur noch den fehlenden Stempel.

-- ----------------------------------------------------------------------------
-- 1) Zuordnungen mit auflösbarer Übung
-- ----------------------------------------------------------------------------
update training_exercises te
set name                  = e.name,
    kategorien            = e.kategorien,
    erscheinungsform      = e.erscheinungsform,
    feldtyp               = e.feldtyp,
    anzahl_kinder         = e.anzahl_kinder,
    material              = e.material,
    methodischer_fahrplan = e.methodischer_fahrplan,
    aufbau                = e.aufbau,
    varianten             = e.varianten,
    -- coalesce: ein im Auslieferungsfenster via saveFassungDiagramm an der
    -- Zuordnung gespeichertes Diagramm (setzt name nicht, die Zeile fällt also
    -- hierher) darf nicht von der Vorlagen-Kopie überschrieben werden.
    diagramm              = coalesce(te.diagramm, e.diagramm),
    bild_quelle           = coalesce(te.bild_quelle, e.bild_quelle),
    -- Zielpfad der Bildkopie: user/<trainings-eigentümer>/<zuordnungs-id>.<ext>.
    -- Die Endung wird aus der Quell-URL übernommen; ohne Eigentümer (anonymi-
    -- siertes Training) gibt es kein Zielverzeichnis, dann bleibt die Fassung
    -- ohne Bild und der Nachweis meldet es.
    bild_url = case
      when e.bild_url is null or t.owner_id is null then null
      else regexp_replace(e.bild_url, '/exercise-images/.*$', '')
           || '/exercise-images/user/' || t.owner_id || '/' || te.id || '.'
           || coalesce(nullif(regexp_replace(e.bild_url, '^.*\.', ''), e.bild_url), 'png')
    end,
    herkunft_name = e.name,
    herkunft_typ = case
      when e.source = 'manual' then 'manual'
      when e.owner_id is not null and e.owner_id = t.owner_id then 'eigen'
      else 'community'
    end,
    herkunft_datum = now()
from exercises e, trainings t
where e.id = te.exercise_id
  and t.id = te.training_id
  and te.herkunft_datum is null
  and te.name is null;

-- ----------------------------------------------------------------------------
-- 2) Zuordnungen ohne auflösbare Übung (Story 9 AK 4)
-- ----------------------------------------------------------------------------
-- Die Übung ist gelöscht; erhalten ist nur der zwischengespeicherte Name. Er
-- wird Fassungs- und Herkunftsname. Als Quelltyp gilt die Community-Vorlage:
-- nur Trainer-Übungen können verschwinden, der kuratierte Bestand nicht.
-- Solche Fassungen bleiben inhaltsleer und damit zulässig gespeichert (AK 5) —
-- die Ablauf-Vollständigkeit greift erst, wenn ein Trainer sie bearbeitet.
update training_exercises
set name = coalesce(nullif(btrim(exercise_name_cache), ''), 'Übung ohne Inhalt'),
    herkunft_name = coalesce(nullif(btrim(exercise_name_cache), ''), 'Übung ohne Inhalt'),
    herkunft_typ = 'community',
    herkunft_datum = now()
where exercise_id is null
  and herkunft_datum is null
  and name is null;

-- ----------------------------------------------------------------------------
-- 3) Im Auslieferungsfenster bearbeitete Zuordnungen nur stempeln
-- ----------------------------------------------------------------------------
-- Diese Zeilen tragen bereits eigene Inhalte (vom Trainer erfasst), ihnen fehlen
-- nur Herkunft und — weil das Formular im Fenster kein Bild anzeigen konnte —
-- der Verweis auf die bereits kopierte Bilddatei. Ohne beides würde der Nachweis
-- sie zu Recht beanstanden und den Verweis-Abbau blockieren.
update training_exercises te
set -- Die Bildkopie hat Schritt 1 des Verfahrens schon angelegt; hier fehlt nur
    -- der Verweis darauf. Ein bereits gesetzter bleibt unangetastet.
    bild_url = coalesce(te.bild_url, (
      select case
               when e.bild_url is null or t.owner_id is null then null
               else regexp_replace(e.bild_url, '/exercise-images/.*$', '')
                    || '/exercise-images/user/' || t.owner_id || '/' || te.id || '.'
                    || coalesce(nullif(regexp_replace(e.bild_url, '^.*\.', ''), e.bild_url), 'png')
             end
        from exercises e where e.id = te.exercise_id
    )),
    bild_quelle = coalesce(
      te.bild_quelle,
      (select e.bild_quelle from exercises e where e.id = te.exercise_id)
    ),
    -- Das Formular schreibt nie das Diagramm — ohne diesen coalesce verlöre
    -- eine im Fenster bearbeitete Fassung das Diagramm ihrer Vorlage dauerhaft
    -- (und bild_quelle='diagramm' stünde ohne Diagramm da).
    diagramm = coalesce(
      te.diagramm,
      (select e.diagramm from exercises e where e.id = te.exercise_id)
    ),
    herkunft_name = coalesce(
      (select e.name from exercises e where e.id = te.exercise_id),
      nullif(btrim(te.exercise_name_cache), ''),
      te.name
    ),
    herkunft_typ = coalesce(
      (select case
                when e.source = 'manual' then 'manual'
                when e.owner_id is not null and e.owner_id = t.owner_id then 'eigen'
                else 'community'
              end
         from exercises e where e.id = te.exercise_id),
      -- Ohne auflösbare Quelle: nur eine Trainer-Übung kann verschwinden.
      'community'
    ),
    herkunft_datum = now()
from trainings t
where t.id = te.training_id
  and te.herkunft_datum is null
  and te.name is not null;
