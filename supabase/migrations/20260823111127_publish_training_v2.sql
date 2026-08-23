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

-- Der Parameter p_include_private entfällt; CREATE OR REPLACE kann die Signatur
-- nicht ändern, daher Drop + Neuanlage samt Grants.
drop function publish_training(uuid, boolean);

create function publish_training(p_training_id uuid)
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
  if array_length(v_missing, 1) >= 1 then
    return jsonb_build_object('status', 'incomplete', 'missing', to_jsonb(v_missing));
  end if;

  update trainings set visibility = 'public' where id = p_training_id;
  return jsonb_build_object('status', 'published');
end;
$$;

revoke all on function publish_training(uuid) from public, anon;
grant execute on function publish_training(uuid) to authenticated;
