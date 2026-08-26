-- ============================================================================
-- Team-Trainingsplan Story 6: Team-Trainings gemeinsam bearbeiten
-- ============================================================================
-- Die RLS lässt Mitglieder seit dem Fundament schreiben; `move_training_exercise`
-- war die letzte Stelle, die noch fest am Eigentümer hing. Sie bekommt dieselbe
-- Bedingung wie die Policies: das eigene PRIVATE Training oder ein Training des
-- eigenen Teams. Veröffentlichte Vorlagen bleibt sie damit auch dem Urheber
-- verschlossen — sie sind eingefroren.
create or replace function move_training_exercise(p_training_exercise_id uuid, p_dir int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_training uuid;
  v_teil text;
  v_hkat text;
  v_pos int;
  v_other uuid;
  v_other_pos int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select te.training_id, te.trainingsteil, te.hauptteilkategorie, te.position
    into v_training, v_teil, v_hkat, v_pos
  from training_exercises te
  join trainings t on t.id = te.training_id
  where te.id = p_training_exercise_id
    and ((t.owner_id = v_uid and t.visibility = 'private')
         or ist_team_mitglied(t.team_id));
  if v_training is null then
    raise exception 'training exercise not found or not editable by caller';
  end if;

  if p_dir < 0 then
    select id, position into v_other, v_other_pos
    from training_exercises
    where training_id = v_training and trainingsteil = v_teil
      and hauptteilkategorie is not distinct from v_hkat
      and position < v_pos
    order by position desc limit 1;
  else
    select id, position into v_other, v_other_pos
    from training_exercises
    where training_id = v_training and trainingsteil = v_teil
      and hauptteilkategorie is not distinct from v_hkat
      and position > v_pos
    order by position asc limit 1;
  end if;

  -- Am Rand: kein Nachbar -> nichts zu tun.
  if v_other is null then
    return;
  end if;

  update training_exercises set position = -1 where id = p_training_exercise_id;
  update training_exercises set position = v_pos where id = v_other;
  update training_exercises set position = v_other_pos where id = p_training_exercise_id;
end;
$$;
revoke all on function move_training_exercise(uuid, int) from public, anon;
grant execute on function move_training_exercise(uuid, int) to authenticated;
