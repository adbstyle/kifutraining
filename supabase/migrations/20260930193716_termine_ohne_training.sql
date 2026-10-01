-- ============================================================================
-- Team-Kalender (Epic #321), Story 1 (#322) + Story 2 (#323).
-- Ein Termin gehört dem Team, nicht mehr seinem Training: Er besteht auch
-- ohne Training, trägt Beginn und Ende und überdauert das Löschen seines
-- Trainings. Ein Training kommt nur noch durch Zuordnen auf ein Datum.
-- ============================================================================
set lock_timeout = '5s';

-- Heute am Trainingsort: die eine Grenze zwischen anstehend und vergangen
-- (Zwilling von heuteAmTrainingsort() in web/lib/zeit.ts).
create function heute_am_trainingsort() returns date
language sql stable
set search_path = public, pg_temp
as $$ select (now() at time zone 'Europe/Zurich')::date $$;
grant execute on function heute_am_trainingsort() to anon, authenticated;

-- 1) Der Termin gehört dem Team (Story 1 AK 1, PC 9) ------------------------
alter table training_termine
  add column team_id uuid references teams(id) on delete cascade,
  add column ende time;

-- Backfill: Jeder Bestandstermin hängt an einem Team-Training (bisheriger
-- Trigger termin_nur_fuer_team_trainings). `updated_at` bleibt unberührt —
-- der Bestand gilt als unverändert (PC 5), und das Abo (Teil G) liest es als
-- LAST-MODIFIED.
alter table training_termine disable trigger training_termine_set_updated_at;
update training_termine tt set team_id = t.team_id
  from trainings t where t.id = tt.training_id;
alter table training_termine enable trigger training_termine_set_updated_at;
alter table training_termine alter column team_id set not null;

-- 2) Der Termin überdauert sein Training (PC 7) ------------------------------
-- UNIQUE (training_id) bleibt: Ein Training ist höchstens für einen Termin
-- eingeplant, ein Termin trägt höchstens ein Training (Epic OoS 3).
alter table training_termine drop constraint training_termine_training_id_fkey;
alter table training_termine alter column training_id drop not null;
alter table training_termine add constraint training_termine_training_id_fkey
  foreign key (training_id) references trainings(id) on delete set null;

-- 3) Zeit und Längen (AK 2, 5, 6; PO 9) --------------------------------------
-- Bestandstermine behalten fehlende Angaben. Die Pflicht für NEUE Termine
-- prüft der Fachkern (lib/termin.ts): Die Datenebene kann «neu» nicht von
-- «Bestand» unterscheiden. Ein Ende setzt einen Beginn voraus und liegt am
-- selben Tag danach.
alter table training_termine add constraint tt_ende_nach_beginn
  check (ende is null or (beginn is not null and ende > beginn));
-- NOT VALID: Bestandstexte wurden nie begrenzt. VALIDATE folgt in Teil B,
-- nachdem der Bestand auf Staging gezählt ist (Task B1 Step 1).
alter table training_termine add constraint tt_ort_laenge
  check (ort is null or char_length(ort) <= 100) not valid;
alter table training_termine add constraint tt_bemerkung_laenge
  check (bemerkung is null or char_length(bemerkung) <= 500) not valid;

-- 4) Training und Termin gehören demselben Team (Story 2 AK 4) --------------
drop trigger termin_nur_fuer_team_trainings on training_termine;
drop function termin_nur_fuer_team_trainings();

create function termin_training_im_team() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.training_id is not null and not exists (
       select 1 from trainings t
        where t.id = new.training_id and t.team_id = new.team_id) then
    raise exception 'TERMIN_TRAINING_FREMDES_TEAM';
  end if;
  return new;
end;
$$;
create trigger termin_training_im_team
  before insert or update of training_id, team_id on training_termine
  for each row execute function termin_training_im_team();

-- 5) RLS über das Team des Termins (AK 22) -----------------------------------
drop policy tt_select on training_termine;
drop policy tt_insert on training_termine;
drop policy tt_update on training_termine;
drop policy tt_delete on training_termine;
create policy tt_select on training_termine for select to authenticated
  using (ist_team_mitglied(team_id));
create policy tt_insert on training_termine for insert to authenticated
  with check (ist_team_mitglied(team_id));
create policy tt_update on training_termine for update to authenticated
  using (ist_team_mitglied(team_id)) with check (ist_team_mitglied(team_id));
create policy tt_delete on training_termine for delete to authenticated
  using (ist_team_mitglied(team_id));

drop index training_termine_plan_idx;
create index training_termine_plan_idx
  on training_termine (team_id, datum, beginn nulls last);

-- 6) Zuordnen, Verschieben, Lösen (Story 2) ----------------------------------
-- Eine Transaktion, weil Verschieben zwei Termine anfasst und UNIQUE
-- (training_id) den bisherigen zuerst freigeben muss. Eine KOPIE legt der
-- Fachkern vorher an (Bilddateien liegen ausserhalb jeder Transaktion) und
-- ruft dann hier mit der Kopie ohne `p_verschieben` auf.
--
-- `p_erwartet` ist, was die Oberfläche bei der Auswahl sah (PO 17):
-- {"termin_training": uuid|null, "training_termin": uuid|null}. Weicht der
-- Stand davon ab, wird abgewiesen; `null` (KI-Weg) prüft nicht.
create function termin_training_setzen(
  p_termin uuid,
  p_training uuid,
  p_verschieben boolean default false,
  p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_termin training_termine;
  v_alt training_termine;
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_termin from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(v_termin.team_id) then
    raise exception 'TERMIN_NICHT_GEFUNDEN';
  end if;
  if p_erwartet is not null
     and v_termin.training_id is distinct from (p_erwartet->>'termin_training')::uuid then
    raise exception 'TERMIN_BELEGUNG_GEAENDERT';
  end if;

  -- Lösen (PC 6): Termin ohne Training, Training ohne Termin im Bestand.
  if p_training is null then
    update training_termine set training_id = null where id = p_termin;
    return jsonb_build_object('bisher', v_termin.training_id, 'frei', null);
  end if;

  select team_id into v_team from trainings where id = p_training for update;
  if not found then raise exception 'TRAINING_NICHT_GEFUNDEN'; end if;
  if v_team is distinct from v_termin.team_id then
    raise exception 'TERMIN_TRAINING_FREMDES_TEAM';
  end if;
  if v_termin.training_id = p_training then
    return jsonb_build_object('bisher', null, 'frei', null);
  end if;

  select * into v_alt from training_termine where training_id = p_training for update;
  if p_erwartet is not null
     and v_alt.id is distinct from (p_erwartet->>'training_termin')::uuid then
    raise exception 'TRAINING_EINPLANUNG_GEAENDERT';
  end if;
  if v_alt.id is not null then
    if not p_verschieben then raise exception 'TRAINING_SCHON_EINGEPLANT'; end if;
    -- AK 11: Ein Training mit vergangenem Termin geht nur als Kopie weiter.
    if v_alt.datum < heute_am_trainingsort() then
      raise exception 'NUR_KOPIE_BEI_VERGANGENEM';
    end if;
    update training_termine set training_id = null where id = v_alt.id;
  end if;

  update training_termine set training_id = p_training where id = p_termin;
  -- PC 4/5: `bisher` bleibt ohne Termin im Bestand, `frei` ist der Termin,
  -- den ein verschobenes Training verlassen hat.
  return jsonb_build_object('bisher', v_termin.training_id, 'frei', v_alt.id);
end;
$$;
revoke all on function termin_training_setzen(uuid, uuid, boolean, jsonb) from public, anon;
grant execute on function termin_training_setzen(uuid, uuid, boolean, jsonb) to authenticated;

-- 7) Termin entfernen (Story 1 AK 11–13, 23; PC 6) ---------------------------
-- Als RPC, weil Teil B hier die Lücke der Serie und das Aufräumen einer leeren
-- Serie in derselben Transaktion ergänzt (create or replace, gleiche Signatur).
create function termin_entfernen(p_termin uuid, p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_termin training_termine;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_termin from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(v_termin.team_id) then
    raise exception 'TERMIN_NICHT_GEFUNDEN';
  end if;
  if p_erwartet is not null
     and v_termin.training_id is distinct from (p_erwartet->>'termin_training')::uuid then
    raise exception 'TERMIN_BELEGUNG_GEAENDERT';
  end if;
  delete from training_termine where id = p_termin;
  -- Das Training bleibt unberührt im Team-Bestand (PC 6).
  return jsonb_build_object('training', v_termin.training_id, 'team', v_termin.team_id);
end;
$$;
revoke all on function termin_entfernen(uuid, jsonb) from public, anon;
grant execute on function termin_entfernen(uuid, jsonb) to authenticated;

reset lock_timeout;
