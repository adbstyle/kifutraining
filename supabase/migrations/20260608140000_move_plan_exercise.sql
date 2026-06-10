-- ============================================================================
-- move_plan_exercise: Zuordnung innerhalb ihres Trainingsteils umsortieren
-- (Story #12 AC4, Hoch/Runter). Tauscht die Position mit dem Nachbarn in
-- Richtung p_dir (-1 = hoch, +1 = runter). Atomar als SECURITY DEFINER mit
-- Owner-Check; der Tausch läuft über eine Temp-Position (-1), damit der
-- Unique-Constraint (plan_id, trainingsteil, position) kollisionsfrei bleibt.
-- Der Nachbar wird über die Positionsreihenfolge bestimmt (toleriert Lücken,
-- die durch Entfernen entstehen können).
-- ============================================================================
create or replace function move_plan_exercise(p_plan_exercise_id uuid, p_dir int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plan uuid;
  v_teil text;
  v_pos int;
  v_other uuid;
  v_other_pos int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select pe.plan_id, pe.trainingsteil, pe.position
    into v_plan, v_teil, v_pos
  from plan_exercises pe
  join training_plans p on p.id = pe.plan_id
  where pe.id = p_plan_exercise_id and p.owner_id = v_uid;
  if v_plan is null then
    raise exception 'plan exercise not found or not owned by caller';
  end if;

  if p_dir < 0 then
    select id, position into v_other, v_other_pos
    from plan_exercises
    where plan_id = v_plan and trainingsteil = v_teil and position < v_pos
    order by position desc limit 1;
  else
    select id, position into v_other, v_other_pos
    from plan_exercises
    where plan_id = v_plan and trainingsteil = v_teil and position > v_pos
    order by position asc limit 1;
  end if;

  -- Am Rand: kein Nachbar -> nichts zu tun.
  if v_other is null then
    return;
  end if;

  update plan_exercises set position = -1 where id = p_plan_exercise_id;
  update plan_exercises set position = v_pos where id = v_other;
  update plan_exercises set position = v_other_pos where id = p_plan_exercise_id;
end;
$$;

revoke all on function move_plan_exercise(uuid, int) from public, anon;
grant execute on function move_plan_exercise(uuid, int) to authenticated;
