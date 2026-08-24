-- ============================================================================
-- Story 8 (Epic #72): Vereinfachtes Veröffentlichen
-- ============================================================================
-- Die Rückfrage zur Mitveröffentlichung privater Übungen entfällt: ein Training
-- enthält nur noch eigenständige Fassungen, es gibt keine fremden oder privaten
-- Bibliotheks-Übungen mehr, die mitveröffentlicht werden müssten. Damit fällt
-- auch die Nebenwirkung weg, dass eine Übung öffentlich blieb, nachdem das
-- Training zurückgezogen wurde.
--
-- Was bleibt: die Vollständigkeitsprüfung (Stufe, Einleitung, Hauptteil). Neu
-- ist die einmalige Bestätigung der Tragweite — sie lebt in der Oberfläche, die
-- RPC bleibt die serverseitige Trust-Boundary.

-- Die Signatur bleibt absichtlich zweistellig: DB-Push (CI) und Vercel-Deploy
-- laufen entkoppelt, und im Fenster dazwischen ruft das alte Bundle die RPC
-- noch mit p_include_private auf — ein Drop der Signatur liesse jeden Publish
-- dort mit «function does not exist» scheitern. Der Parameter wird schlicht
-- ignoriert (das neue Bundle lässt ihn weg, der DEFAULT greift); entfernt wird
-- er erst mit dem Verweis-Abbau, wenn kein altes Bundle mehr läuft.
create or replace function publish_training(
  p_training_id uuid,
  p_include_private boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_missing text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from trainings where id = p_training_id and owner_id = v_uid
  ) then
    raise exception 'training not found or not owned by caller';
  end if;

  -- Vollständigkeit: mind. eine Stufe, Einleitung und Hauptteil belegt.
  if not exists (
    select 1 from trainings
    where id = p_training_id and coalesce(array_length(stufen, 1), 0) >= 1
  ) then
    v_missing := array_append(v_missing, 'stufe');
  end if;
  if not exists (
    select 1 from training_exercises
    where training_id = p_training_id and trainingsteil = 'einleitung'
  ) then
    v_missing := array_append(v_missing, 'einleitung');
  end if;
  if not exists (
    select 1 from training_exercises
    where training_id = p_training_id and trainingsteil = 'hauptteil'
  ) then
    v_missing := array_append(v_missing, 'hauptteil');
  end if;
  -- Noch nicht überführte Zuordnungen (name NULL — nur ein altes App-Bundle im
  -- Auslieferungsfenster kann solche nach der Bestand-Migration noch anlegen)
  -- blockieren das Veröffentlichen: sie lesen über den Übungs-Verweis, und eine
  -- private Übung wäre für Besucher eine leere Hülle. Überführte inhaltsleere
  -- Fassungen tragen immer einen Namen (Story 9 AK 4/5) und bleiben publizierbar.
  if exists (
    select 1 from training_exercises
    where training_id = p_training_id and name is null
  ) then
    v_missing := array_append(v_missing, 'ueberfuehrung');
  end if;
  if array_length(v_missing, 1) >= 1 then
    return jsonb_build_object('status', 'incomplete', 'missing', to_jsonb(v_missing));
  end if;

  update trainings set visibility = 'public' where id = p_training_id;
  return jsonb_build_object('status', 'published');
end;
$$;

revoke all on function publish_training(uuid, boolean) from public, anon;
grant execute on function publish_training(uuid, boolean) to authenticated;
