-- RPC-Funktionen für atomare, mehrstufige Operationen.
-- SECURITY DEFINER mit striktem Owner-Check als erste Anweisung; auth.uid() liest
-- weiterhin die Claims des Aufrufers (unabhängig vom Ausführungs-Rolle).

-- ----------------------------------------------------------------------------
-- publish_plan: Plan öffentlich schalten (Planer EK9).
-- Enthält der Plan eigene PRIVATE Übungen und wurde die Mitveröffentlichung nicht
-- bestätigt -> {status: needs_confirmation, count} ohne jede Mutation.
-- Sonst: ggf. eigene private Übungen auf public, dann Plan auf public.
-- ----------------------------------------------------------------------------
create or replace function publish_plan(p_plan_id uuid, p_include_private boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_private_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from training_plans where id = p_plan_id and owner_id = v_uid
  ) then
    raise exception 'plan not found or not owned by caller';
  end if;

  select count(distinct e.id) into v_private_count
  from plan_exercises pe
  join exercises e on e.id = pe.exercise_id
  where pe.plan_id = p_plan_id
    and e.owner_id = v_uid
    and e.visibility = 'private';

  if v_private_count > 0 and not p_include_private then
    return jsonb_build_object('status', 'needs_confirmation', 'count', v_private_count);
  end if;

  if v_private_count > 0 and p_include_private then
    update exercises
      set visibility = 'public'
      where id in (
        select distinct e.id
        from plan_exercises pe
        join exercises e on e.id = pe.exercise_id
        where pe.plan_id = p_plan_id
          and e.owner_id = v_uid
          and e.visibility = 'private'
      );
  end if;

  update training_plans set visibility = 'public' where id = p_plan_id;

  return jsonb_build_object('status', 'published');
end;
$$;

-- ----------------------------------------------------------------------------
-- delete_account: Daten-Teil der Konto-Löschung (Übungs-Epic).
-- Öffentliche Übungen werden anonymisiert (owner_id NULL -> via fehlende
-- Update-Policy unveränderlich) und bleiben erhalten; private Übungen und eigene
-- Pläne werden gelöscht. Die eigentliche Auth-User-Löschung erfolgt anschliessend
-- serverseitig über die Admin-API (service_role).
-- ----------------------------------------------------------------------------
create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update exercises set owner_id = null
    where owner_id = v_uid and visibility = 'public';

  delete from exercises where owner_id = v_uid and visibility = 'private';

  delete from training_plans where owner_id = v_uid;
end;
$$;

revoke all on function publish_plan(uuid, boolean) from public, anon;
revoke all on function delete_account() from public, anon;
grant execute on function publish_plan(uuid, boolean) to authenticated;
grant execute on function delete_account() to authenticated;
