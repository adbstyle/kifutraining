-- ============================================================================
-- Hauptteil im Trainingsplaner in Hauptteilkategorien gliedern (Story #23)
-- ============================================================================
-- Der Hauptteil eines Plans wird strukturell in die drei Hauptteilkategorien
-- gegliedert; je Unterkategorie sind nur Übungen der passenden Kategorie
-- zuordenbar (harte Regel). Die Kategorie wird beim Zuordnen aus der Übung als
-- Snapshot auf `plan_exercises` festgehalten (robust auch für Platzhalter, deren
-- Übung später unsichtbar/gelöscht wird) und ist die Sortier-/Gruppierdimension
-- innerhalb des Hauptteils. Positionen sind ab hier pro Unterkategorie eindeutig.

-- ----------------------------------------------------------------------------
-- 1) Snapshot-Spalte auf plan_exercises
-- ----------------------------------------------------------------------------
alter table plan_exercises
  add column hauptteilkategorie text
    check (hauptteilkategorie in
      ('fussball-spielen-lernen','vielseitigkeit-erleben','fussball-spielen'));

-- Bestand backfillen: die Kategorie der zugeordneten Hauptteil-Übung übernehmen.
-- Platzhalter-Zeilen (exercise_id null) im Hauptteil bleiben hier NULL — sie sind
-- pre-launch nicht zu erwarten; der Biconditional-CHECK ist daher NOT VALID.
update plan_exercises pe
   set hauptteilkategorie = e.hauptteilkategorie
  from exercises e
 where pe.exercise_id = e.id
   and pe.trainingsteil = 'hauptteil';

-- Genau bei Hauptteil-Zuordnungen gesetzt, sonst nie (analog exercises). NOT
-- VALID: erzwingt die Invariante ab sofort für jede neue/geänderte Zeile, prüft
-- aber Altzeilen nicht (etwaige Platzhalter ohne auflösbare Kategorie).
alter table plan_exercises
  add constraint plan_ex_hkat_genau_bei_hauptteil check (
    (trainingsteil = 'hauptteil') = (hauptteilkategorie is not null)
  ) not valid;

-- ----------------------------------------------------------------------------
-- 2) Positionen pro Unterkategorie eindeutig
-- ----------------------------------------------------------------------------
-- Bisher: unique (plan_id, trainingsteil, position). Da der Hauptteil nun je
-- Unterkategorie eigene Positionen führt, wird die Eindeutigkeit gesplittet —
-- versionssicher über zwei partielle Unique-Indizes statt NULLS NOT DISTINCT.
alter table plan_exercises
  drop constraint plan_exercises_plan_id_trainingsteil_position_key;

create unique index plan_ex_pos_nonhauptteil
  on plan_exercises (plan_id, trainingsteil, position)
  where trainingsteil <> 'hauptteil';

create unique index plan_ex_pos_hauptteil
  on plan_exercises (plan_id, hauptteilkategorie, position)
  where trainingsteil = 'hauptteil';

-- ----------------------------------------------------------------------------
-- 3) Phasen-Guard: Kategorie-Snapshot aus der Übung setzen
-- ----------------------------------------------------------------------------
-- Erweitert den bestehenden Guard (Trainingsteil-Bindung + Platzhalter-Name):
-- für Hauptteil-Zuordnungen wird hauptteilkategorie zwingend aus der Übung
-- übernommen (Trust Boundary), für alle anderen Trainingsteile auf NULL gezwungen.
create or replace function plan_exercise_phase_guard() returns trigger
language plpgsql as $$
declare
  v_hkat text;
begin
  if new.exercise_id is not null then
    if not exists (
      select 1 from exercises e
      where e.id = new.exercise_id and e.trainingsteil = new.trainingsteil
    ) then
      raise exception
        'Übung % passt nicht zum Trainingsteil % der Phase', new.exercise_id, new.trainingsteil;
    end if;
    -- Platzhalter-Name sicherstellen (Fallback, falls die App ihn nicht setzt).
    if coalesce(new.exercise_name_cache, '') = '' then
      new.exercise_name_cache := (select name from exercises e where e.id = new.exercise_id);
    end if;
    -- Kategorie aus der Übung als Snapshot übernehmen (nur Hauptteil trägt eine).
    if new.trainingsteil = 'hauptteil' then
      select hauptteilkategorie into v_hkat from exercises e where e.id = new.exercise_id;
      new.hauptteilkategorie := v_hkat;
    end if;
  end if;
  -- Kategorie ausschliesslich bei Hauptteil-Zuordnungen; sonst immer NULL —
  -- unabhängig von exercise_id, damit auch Platzhalter-Zeilen den Biconditional-
  -- CHECK erfüllen (Hauptteil-Platzhalter behalten ihren bestehenden Snapshot).
  if new.trainingsteil <> 'hauptteil' then
    new.hauptteilkategorie := null;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Umsortieren innerhalb der Unterkategorie
-- ----------------------------------------------------------------------------
-- Der Nachbar wird zusätzlich auf dieselbe hauptteilkategorie eingeschränkt, damit
-- Hoch/Runter im Hauptteil nicht über Unterkategorie-Grenzen tauscht. Für andere
-- Trainingsteile ist hauptteilkategorie NULL — `is not distinct from` matcht dann
-- wie bisher alle Zeilen des Trainingsteils.
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
  v_hkat text;
  v_pos int;
  v_other uuid;
  v_other_pos int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select pe.plan_id, pe.trainingsteil, pe.hauptteilkategorie, pe.position
    into v_plan, v_teil, v_hkat, v_pos
  from plan_exercises pe
  join training_plans p on p.id = pe.plan_id
  where pe.id = p_plan_exercise_id and p.owner_id = v_uid;
  if v_plan is null then
    raise exception 'plan exercise not found or not owned by caller';
  end if;

  if p_dir < 0 then
    select id, position into v_other, v_other_pos
    from plan_exercises
    where plan_id = v_plan and trainingsteil = v_teil
      and hauptteilkategorie is not distinct from v_hkat
      and position < v_pos
    order by position desc limit 1;
  else
    select id, position into v_other, v_other_pos
    from plan_exercises
    where plan_id = v_plan and trainingsteil = v_teil
      and hauptteilkategorie is not distinct from v_hkat
      and position > v_pos
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
