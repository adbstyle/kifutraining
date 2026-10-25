-- Trainer:innen sagen ab und wieder zu (#520).
--
-- Eine Absage gilt für genau einen Termin und steht am Eintrag der
-- Eingeladenen (`abgesagt_am`). Wer abgesagt hat, ist nicht dabei; wer
-- verantwortlich ist, hat nicht abgesagt (CHECK) — wer verantwortlich wird,
-- ist damit wieder dabei (PC 11).
--
-- Absagen und Zusagen nur bis zum Beginn bzw. Anpfiff und nie an einem
-- ausgefallenen Termin (AK 3); dort ruhen sie (AK 6, PC 5). Verlegen lässt
-- sie verfallen wie die Abmeldungen der Spieler:innen (PC 2, 3) — Trainer-
-- Absagen sieht niemand ausserhalb des Teams, darum ohne Markierung: Der
-- Zeitpunkt fällt weg. Wie viele verfallen, sagt vorher
-- `termin_absagen_verfallend`, in der Serie die Vorschau von
-- `terminserie_aendern` (`absagen_verfallend`, AK 11).

set lock_timeout = '5s';

-- termin_trainer ist mit #519 im selben Release neu und trägt noch keine
-- Absage: Der CHECK gilt sofort.
alter table termin_trainer
  add column abgesagt_am timestamptz,
  add constraint ttr_verantwortlich_dabei check (not (verantwortlich and abgesagt_am is not null));

-- Wer verantwortlich wird, ist eingeladen und dabei (PC 11, AK 5, 7).
create or replace function trainer_verantwortlich_setzen(p_termin uuid, p_user uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update termin_trainer set verantwortlich = false
   where termin_id = p_termin and verantwortlich and user_id is distinct from p_user;
  if p_user is not null then
    insert into termin_trainer (termin_id, user_id, verantwortlich) values (p_termin, p_user, true)
    on conflict (termin_id, user_id) do update set verantwortlich = true, abgesagt_am = null;
  end if;
end;
$$;
revoke all on function trainer_verantwortlich_setzen(uuid, uuid) from public, anon, authenticated;

-- ── Verlegen lässt verfallen (PC 2, 3) ──────────────────────────────────────

-- Dieselbe Entscheidung für den Trigger und die Zählung vorher: ein Training,
-- dessen Datum oder Beginn sich ändert und das danach noch nicht begonnen
-- hat; ein Spiel, dessen Datum sich ändert.
create function absagen_verfallen_bei(p_art text, p_alt_datum date, p_alt_beginn time, p_datum date, p_beginn time)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select case
    when p_art = 'spiel' then p_datum is distinct from p_alt_datum
    else (p_datum is distinct from p_alt_datum or p_beginn is distinct from p_alt_beginn)
         and not termin_begonnen(p_datum, p_beginn)
  end;
$$;
revoke all on function absagen_verfallen_bei(text, date, time, date, time) from public, anon, authenticated;

create function trainer_absagen_verfallen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if absagen_verfallen_bei(new.art, old.datum, old.beginn, new.datum, new.beginn) then
    update termin_trainer set abgesagt_am = null where termin_id = new.id and abgesagt_am is not null;
  end if;
  return null;
end;
$$;
revoke all on function trainer_absagen_verfallen() from public, anon, authenticated;

create trigger trainer_absagen_verfallen after update of datum, beginn on training_termine
  for each row
  when (old.datum is distinct from new.datum or old.beginn is distinct from new.beginn)
  execute function trainer_absagen_verfallen();

-- Ein einzelner Termin, verlegt auf `p_datum`/`p_beginn`: wie viele Absagen
-- verfielen (AK 11). Nur für Mitglieder seines Teams.
create function termin_absagen_verfallend(p_termin uuid, p_datum date, p_beginn time)
returns integer
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin;
  if not found or not ist_team_mitglied(t.team_id)
     or not absagen_verfallen_bei(t.art, t.datum, t.beginn, p_datum, p_beginn) then
    return 0;
  end if;
  return (select count(*) from termin_trainer where termin_id = p_termin and abgesagt_am is not null);
end;
$$;
revoke all on function termin_absagen_verfallend(uuid, date, time) from public, anon;
grant execute on function termin_absagen_verfallend(uuid, date, time) to authenticated;

-- Die Serie: Gezählt werden vorher die Absagen je Termin und Person; danach
-- zählen die, deren Eintrag es noch gibt und die nicht mehr abgesagt sind —
-- ausser wer inzwischen verantwortlich ist (das hebt die Absage auf, PC 11,
-- und ist kein Verfall). Ausgeladene fallen mit ihrem Eintrag weg (PC 6).
create function serie_absagen_verfallen(p_vorher jsonb) returns integer
language sql stable
set search_path = public, pg_temp
as $$
  select count(*)::int
    from jsonb_array_elements(p_vorher) e
    join termin_trainer tr on tr.id = (e ->> 'id')::uuid
   where tr.abgesagt_am is null and not tr.verantwortlich;
$$;
revoke all on function serie_absagen_verfallen(jsonb) from public, anon, authenticated;

-- Vollständiger Rumpf aus nachtrag_anwesenheit; neu sind die Absagen.
create or replace function terminserie_aendern(
  p_termin uuid,
  p_reichweite text,
  p_aenderung jsonb,
  p_version integer default null,
  p_entfallend uuid[] default null,
  p_ausfuehren boolean default true,
  p_verfallend integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
  v_team uuid;
  v_verlegt integer;
  v_kader integer;
  v_vorher jsonb;
  v_nachtraege integer;
  v_absagen_vorher jsonb;
  v_absagen integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  select coalesce(jsonb_object_agg(termin_id, n), '{}') into v_vorher
    from (select termin_id, count(*) as n from termin_teilnahmen
           where team_id = v_team and nachgetragen and spieler_id is not null group by termin_id) x;
  select coalesce(jsonb_agg(jsonb_build_object('id', tr.id)), '[]') into v_absagen_vorher
    from termin_trainer tr join training_termine t on t.id = tr.termin_id
   where t.team_id = v_team and tr.abgesagt_am is not null;
  if p_ausfuehren then
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, p_entfallend);
    select count(*) into v_verlegt from termin_abmeldungen where team_id = v_team and verfallen_am = now();
    v_kader := kader_bereinigen(v_team);
    v_nachtraege := serie_nachtraege_verfallen(v_vorher);
    v_absagen := serie_absagen_verfallen(v_absagen_vorher);
    if p_verfallend is not null and p_verfallend <> v_verlegt + v_kader + v_nachtraege + v_absagen then
      raise exception 'SERIE_VERFALL_GEAENDERT';
    end if;
    return v || jsonb_build_object('abmeldungen_verfallend', v_verlegt, 'abmeldungen_kader', v_kader,
                                   'nachtraege_verfallend', v_nachtraege, 'absagen_verfallend', v_absagen);
  end if;
  begin
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, null);
    select count(*) into v_verlegt from termin_abmeldungen where team_id = v_team and verfallen_am = now();
    v := v || jsonb_build_object('abmeldungen_verfallend', v_verlegt, 'abmeldungen_kader', kader_bereinigen(v_team),
                                 'nachtraege_verfallend', serie_nachtraege_verfallen(v_vorher),
                                 'absagen_verfallend', serie_absagen_verfallen(v_absagen_vorher));
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer) from public, anon;
grant execute on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer) to authenticated;

-- ── Absagen und wieder zusagen (AK 1–5, 10, 19; PC 1, 9) ────────────────────
-- `p_gesehen`: was die Oberfläche zeigte ({datum, beginn, verantwortlich});
-- hat sich das seither geändert, ist die Wahl veraltet (AK 10). Ohne (KI)
-- gilt der aktuelle Stand. `p_uebernimmt`: Die Verantwortliche sagt ab und
-- gibt im selben Schritt an eine andere Eingeladene ab, die dabei ist (AK 19).
create function termin_trainer_absage_setzen(
  p_termin uuid,
  p_user uuid,
  p_abgesagt boolean,
  p_gesehen jsonb default null,
  p_uebernimmt uuid default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  tr termin_trainer;
  v_verantwortlich uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  select user_id into v_verantwortlich from termin_trainer where termin_id = t.id and verantwortlich;
  if p_gesehen is not null and (
       (p_gesehen ->> 'datum')::date is distinct from t.datum
       or (p_gesehen ->> 'beginn')::time is distinct from t.beginn
       or nullif(p_gesehen ->> 'verantwortlich', '')::uuid is distinct from v_verantwortlich) then
    raise exception 'ABSAGE_VERALTET';
  end if;
  if t.ausgefallen then raise exception 'ABSAGE_AUSGEFALLEN'; end if;
  if termin_begonnen(t.datum, t.beginn) then raise exception 'ABSAGE_BEGONNEN'; end if;
  select * into tr from termin_trainer where termin_id = t.id and user_id = p_user;
  if not found then raise exception 'TRAINER_NICHT_EINGELADEN'; end if;

  if not p_abgesagt then
    update termin_trainer set abgesagt_am = null where id = tr.id;
    return jsonb_build_object('team', t.team_id);
  end if;

  if tr.verantwortlich then
    if p_uebernimmt is not null then
      if p_uebernimmt = p_user or not exists (
           select 1 from termin_trainer x
            where x.termin_id = t.id and x.user_id = p_uebernimmt and x.abgesagt_am is null)
         or not alle_mitglieder(t.team_id, array[p_uebernimmt]) then
        raise exception 'UEBERNAHME_UNGUELTIG';
      end if;
      perform trainer_verantwortlich_setzen(t.id, p_uebernimmt);
      if t.serie_id is not null then
        update training_termine set verantwortung_abweichend = true where id = t.id and not verantwortung_abweichend;
      end if;
    elsif exists (select 1 from termin_trainer x
                   where x.termin_id = t.id and x.user_id is not null and x.user_id <> p_user and x.abgesagt_am is null) then
      raise exception 'VERANTWORTUNG_UEBERGEBEN';
    else
      -- Niemand sonst ist dabei: ohne Verantwortliche:n (PC 1).
      update termin_trainer set verantwortlich = false where id = tr.id;
      if t.serie_id is not null then
        update training_termine set verantwortung_abweichend = true where id = t.id and not verantwortung_abweichend;
      end if;
    end if;
  end if;
  -- Eine schon bestehende Absage behält ihren Zeitpunkt.
  update termin_trainer set abgesagt_am = coalesce(abgesagt_am, now()) where id = tr.id;
  return jsonb_build_object('team', t.team_id);
end;
$$;
revoke all on function termin_trainer_absage_setzen(uuid, uuid, boolean, jsonb, uuid) from public, anon;
grant execute on function termin_trainer_absage_setzen(uuid, uuid, boolean, jsonb, uuid) to authenticated;

reset lock_timeout;
