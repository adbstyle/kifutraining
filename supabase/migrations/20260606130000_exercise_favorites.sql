-- Favoriten: benutzerbezogene Markierung einzelner Übungen
-- (Übungspool-Story "Übungen favorisieren").
-- Reine Beziehungstabelle User<->Übung; Sichtbarkeit der Übung regelt weiterhin
-- die RLS auf `exercises`. Die Favoritenzeile bleibt erhalten, wenn eine Übung
-- für den User vorübergehend unsichtbar wird (Postcondition 3) — sie wird dann
-- nur aus dem Katalog-Join ausgeblendet.

create table exercise_favorites (
  user_id     uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  -- verhindert Duplikate; indexiert user_id als Präfix -> "nur meine Favoriten"
  primary key (user_id, exercise_id)
);

alter table exercise_favorites enable row level security;

-- Nur eigene Favoriten lesbar (NFR2: für andere USER nicht einsehbar).
create policy fav_select on exercise_favorites for select
  using (user_id = auth.uid());

-- Setzen nur für sich selbst UND nur auf eine für den USER sichtbare Übung
-- (AC5: Manual-, eigene und fremde öffentliche Übungen — keine fremden privaten).
create policy fav_insert on exercise_favorites for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from exercises e
      where e.id = exercise_id
        and (e.visibility = 'public' or e.owner_id = auth.uid())
    )
  );

create policy fav_delete on exercise_favorites for delete
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- delete_account um die Favoriten-Bereinigung ergänzen (Postcondition 5).
-- Explizit, damit die Markierungen unabhängig vom nachgelagerten Auth-User-Delete
-- (Admin-API) entfernt werden; der FK-Cascade auf auth.users wäre nur Fallback.
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

  delete from exercise_favorites where user_id = v_uid;

  update exercises set owner_id = null
    where owner_id = v_uid and visibility = 'public';

  delete from exercises where owner_id = v_uid and visibility = 'private';

  delete from training_plans where owner_id = v_uid;
end;
$$;

-- Berechtigungen erneut setzen (CREATE OR REPLACE übernimmt sie zwar, hier aber
-- explizit zur Konvention der ersten Migration und gegen Reihenfolge-Annahmen).
revoke all on function delete_account() from public, anon;
grant execute on function delete_account() to authenticated;
