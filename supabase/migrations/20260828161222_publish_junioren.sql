set lock_timeout = '5s';

-- ============================================================================
-- Story 7 (Epic #71): Veröffentlichen je Trainingsschema
-- ============================================================================
-- Die Bedingungen eines öffentlichen Trainings hängen neu an seinem Schema.
-- Ersetzt wird ausschliesslich der Körper von training_pruefe_oeffentlich —
-- die Funktion hinter beiden oeffentlich-Gates. Trigger, Zeitpunkte und die
-- Werfen-Semantik bleiben unangetastet: eine Änderung, die ein öffentliches
-- Training unter die Bedingungen brächte, wird abgewiesen und von der
-- Applikation erklärt («Setze es zuerst auf Entwurf …»).
--
-- Die Regel selbst steht in training_fehlende_bedingungen (Migration
-- junioren_schema) — Gate und Vorabmeldung nennen damit dieselbe.
-- Kinderfussball-Trainings ändern ihr Verhalten nicht (Story 7 Out of Scope 1).
create or replace function training_pruefe_oeffentlich(p_id uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_public boolean;
  v_missing text[];
begin
  select visibility = 'public' into v_public from trainings where id = p_id;
  -- Zeile weg: das ganze Training wurde gelöscht und hat seine Fassungen
  -- mitgenommen. Nichts zu prüfen — sonst schlüge jeder Kaskaden-Delete an.
  if v_public is null then return; end if;
  if not v_public then return; end if;

  v_missing := training_fehlende_bedingungen(p_id);
  if coalesce(array_length(v_missing, 1), 0) >= 1 then
    raise exception 'TRAINING_UNVOLLSTAENDIG: %', v_missing[1];
  end if;
end;
$$;
