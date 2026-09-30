-- ============================================================================
-- Team-Kalender (Epic #321), Story 6 (#327): Ein Termin fällt aus wie ein
-- abgesagter Kalendereintrag. Der Ausfall löst das Training (PC 1), trägt
-- einen freiwilligen Grund und ist keine Abweichung von der Serie (PC 8).
-- ============================================================================
set lock_timeout = '5s';

-- Bestandszeilen erfüllen beide Prüfungen von selbst (ausgefallen = false,
-- Grund leer), ein Backfill oder NOT VALID ist darum nicht nötig.
alter table training_termine
  add column ausgefallen boolean not null default false,
  add column ausfall_grund text,
  add constraint tt_ausfall_ohne_training check (not ausgefallen or training_id is null),
  add constraint tt_ausfall_grund check (
    ausfall_grund is null or (ausgefallen and char_length(ausfall_grund) <= 500));

-- AK 9: Einem ausgefallenen Termin lässt sich auf keinem Weg ein Training
-- zuordnen. Rumpf wie in termine_ohne_training, ergänzt um die Prüfung.
create or replace function termin_training_setzen(
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

  if v_termin.ausgefallen then raise exception 'TERMIN_AUSGEFALLEN'; end if;

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

reset lock_timeout;
