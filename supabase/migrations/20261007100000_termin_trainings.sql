-- ============================================================================
-- Termin-Trainings (PO 2026-10-06).
--
-- Ein Termin bekommt immer still eine eigene Kopie: ein Termin-Training. Es
-- gehört dem Team (alle Mitglieder sehen, ändern und führen es durch), steht
-- aber nicht im Team-Bestand — dorthin kommt ein Training nur bewusst. Es lebt
-- mit seinem Termin: Verliert es ihn (lösen, ersetzen, Termin entfernen, eine
-- Serienänderung, die den Termin entfallen lässt), wird es gelöscht. Ein
-- Ausfall lässt es am Termin ruhen; nach «Ausfall zurücknehmen» ist es wieder
-- da.
--
-- Bestehende Trainings bleiben im Bestand (`termin_training = false`), auch
-- wenn sie einem Termin zugeordnet sind — ihr Lösen lässt sie dort stehen.
-- ============================================================================
set lock_timeout = '5s';

-- 1) Das Merkmal. Konstanter Default: kein Umschreiben der Bestandszeilen;
--    alle bestehenden erfüllen die Prüfung von selbst.
alter table trainings
  add column termin_training boolean not null default false,
  add constraint tr_termin_training_im_team check (not termin_training or team_id is not null);

-- 2) Ein ausgefallener Termin behält sein Training (hebt #327 AK 9 / PC 1 auf).
--    Zuordnen lässt sich einem ausgefallenen Termin weiterhin keines
--    (TERMIN_AUSGEFALLEN in termin_training_setzen).
alter table training_termine drop constraint tt_ausfall_ohne_training;

-- 3) Zuordnen und Lösen. Der Fachkern ordnet immer eine frische Kopie zu; die
--    Funktion macht sie im selben Schritt zum Termin-Training. So entsteht nie
--    ein Termin-Training ohne Termin: Bricht der Vorgang vor dem Verknüpfen ab,
--    bleibt die Kopie sichtbar im Bestand. Kopieren oder Verschieben zu
--    wählen, gibt es nicht mehr.
drop function termin_training_setzen(uuid, uuid, boolean, jsonb);
create function termin_training_setzen(
  p_termin uuid,
  p_training uuid,
  p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_termin training_termine;
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

  -- Lösen: Ein Termin-Training fällt mit (Trigger unten), ein Training aus
  -- dem Bestand bleibt dort.
  if p_training is null then
    update training_termine set training_id = null where id = p_termin;
    return jsonb_build_object('bisher', v_termin.training_id);
  end if;

  if v_termin.ausgefallen then raise exception 'TERMIN_AUSGEFALLEN'; end if;

  select team_id into v_team from trainings where id = p_training for update;
  if not found then raise exception 'TRAINING_NICHT_GEFUNDEN'; end if;
  if v_team is distinct from v_termin.team_id then
    raise exception 'TERMIN_TRAINING_FREMDES_TEAM';
  end if;
  if v_termin.training_id = p_training then
    return jsonb_build_object('bisher', null);
  end if;
  -- Rückhalt: Zugeordnet wird nur eine Kopie, die noch keinen Termin hat.
  if exists (select 1 from training_termine where training_id = p_training) then
    raise exception 'TRAINING_SCHON_EINGEPLANT';
  end if;

  update training_termine set training_id = p_training where id = p_termin;
  update trainings set termin_training = true where id = p_training;
  return jsonb_build_object('bisher', v_termin.training_id);
end;
$$;
revoke all on function termin_training_setzen(uuid, uuid, jsonb) from public, anon;
grant execute on function termin_training_setzen(uuid, uuid, jsonb) to authenticated;

-- 4) Ein Termin-Training, das seinen Termin verliert, wird gelöscht — auf
--    jedem Weg: lösen, ersetzen, Termin entfernen, Serienänderungen (die
--    entfallende Termine in ihren Funktionen löschen). Die Kaskade nimmt die
--    Fassungen mit; ihre Bilddateien räumt der Fachkern danach ab.
create function termin_training_aufraeumen()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if old.training_id is not null
     and (tg_op = 'DELETE' or new.training_id is distinct from old.training_id) then
    delete from trainings t
     where t.id = old.training_id
       and t.termin_training
       and not exists (select 1 from training_termine x where x.training_id = old.training_id);
  end if;
  return null;
end;
$$;
create trigger termin_training_aufraeumen
  after update of training_id or delete on training_termine
  for each row execute function termin_training_aufraeumen();

reset lock_timeout;
