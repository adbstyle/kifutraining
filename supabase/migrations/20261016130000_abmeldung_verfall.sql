-- ============================================================================
-- Abmeldungen der Spieler:innen (Epic #433), Story 4 (#437): Eine Abmeldung
-- gilt für den Zeitpunkt, für den sie abgegeben wurde.
--
-- Wird ein Termin verlegt (Datum oder Beginn) und hat er danach noch nicht
-- begonnen, verfallen seine Abmeldungen: Alle gelten wieder als angemeldet
-- (PC 1) — auch über die Serienrechnung und während er ausfällt. Die Zeile
-- bleibt als Markierung stehen (`verfallen_am`, dazu der Zeitpunkt vorher),
-- damit die Spielervertretung am Link erkennt, dass ihre Abmeldung nicht mehr
-- gilt (AK 2) — bis sie sich neu ab- oder anmeldet (die Zeile wird ersetzt
-- oder gelöscht) oder der Termin beginnt (das Festhalten löscht sie). Gezählt
-- wird überall nur, was gilt: `verfallen_am is null`.
--
-- Ein Termin, der durch die Verlegung schon begonnen hat, behält seine
-- Abmeldungen im festgehaltenen Stand (PC 2). Wird ein festgehaltener Termin
-- in die Zukunft verlegt, werden seine Abmeldungen ebenso zu Markierungen.
--
-- Wie viele verfallen, erfährt man vor dem Speichern (AK 1): einzeln über
-- `termin_abmeldungen_verfallend`, in der Serie aus der Vorschau von
-- `terminserie_aendern` (`abmeldungen_verfallend`). Die Serienrechnung
-- selbst bleibt unberührt.
-- ============================================================================
set lock_timeout = '5s';

alter table termin_abmeldungen
  add column verfallen_am timestamptz,
  add column vorher_datum date,
  add column vorher_beginn time,
  add constraint ta_verfallen check ((verfallen_am is null) = (vorher_datum is null));

-- ── Festhalten: nur, was gilt ───────────────────────────────────────────────

create or replace function termin_einfrieren(p_termin uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not exists (select 1 from spieler where team_id = v_team) then return; end if;
  insert into termin_eingefroren (termin_id, team_id) values (p_termin, v_team)
    on conflict (termin_id) do nothing;
  if not found then return; end if;
  insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet)
    select p_termin, v_team, s.id,
           exists (select 1 from termin_abmeldungen a
                    where a.termin_id = p_termin and a.spieler_id = s.id and a.verfallen_am is null)
      from spieler s where s.team_id = v_team;
  -- Auch die Markierungen: Ab Beginn gibt es nichts mehr zu erkennen (AK 2).
  delete from termin_abmeldungen where termin_id = p_termin;
end;
$$;

create or replace function termine_einfrieren(p_team uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  with neu as (
    insert into termin_eingefroren (termin_id, team_id)
      select t.id, t.team_id from training_termine t
       where t.team_id = p_team
         and t.datum <= heute_am_trainingsort()
         and termin_begonnen(t.datum, t.beginn)
      on conflict (termin_id) do nothing
      returning termin_id),
  teilnahmen as (
    insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet)
      select n.termin_id, p_team, s.id,
             exists (select 1 from termin_abmeldungen a
                      where a.termin_id = n.termin_id and a.spieler_id = s.id and a.verfallen_am is null)
        from neu n cross join spieler s where s.team_id = p_team
      returning termin_id)
  delete from termin_abmeldungen a using neu n where a.termin_id = n.termin_id;
end;
$$;
revoke all on function termin_einfrieren(uuid) from public, anon, authenticated;
revoke all on function termine_einfrieren(uuid) from public, anon, authenticated;

-- ── Verlegen lässt verfallen (PC 1, 2) ──────────────────────────────────────

create or replace function termin_zeitpunkt_nachher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if termin_begonnen(new.datum, new.beginn) then
    perform termin_einfrieren(new.id);
  elsif tg_op = 'UPDATE' then
    -- War er festgehalten (in die Zukunft verlegt): Seine Abmeldungen werden
    -- zu Markierungen, ehemalige Spieler:innen fallen weg.
    insert into termin_abmeldungen (termin_id, spieler_id, team_id, verfallen_am, vorher_datum, vorher_beginn)
      select new.id, p.spieler_id, new.team_id, now(), old.datum, old.beginn
        from termin_teilnahmen p
       where p.termin_id = new.id and p.abgemeldet and p.spieler_id is not null
      on conflict (termin_id, spieler_id) do nothing;
    delete from termin_eingefroren where termin_id = new.id;
    -- Eine schon verfallene behält den Zeitpunkt, für den sie abgegeben wurde.
    update termin_abmeldungen
       set verfallen_am = now(), vorher_datum = old.datum, vorher_beginn = old.beginn
     where termin_id = new.id and verfallen_am is null;
  end if;
  return null;
end;
$$;
revoke all on function termin_zeitpunkt_nachher() from public, anon, authenticated;

-- ── Lesen: nur, was gilt ────────────────────────────────────────────────────

create or replace function spielstand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.n > 0 then jsonb_build_object('gesamt', z.n, 'angemeldet', z.n - z.ab, 'eingefroren', z.fest) end
    from (select e.fest,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id)
                      else (select count(*) from spieler s where s.team_id = t.team_id) end as n,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id and p.abgemeldet)
                      else (select count(*) from termin_abmeldungen a
                             where a.termin_id = t.id and a.verfallen_am is null) end as ab
            from (select exists (select 1 from termin_eingefroren f where f.termin_id = t.id) as fest) e) z;
$$;

create or replace function termin_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, abgemeldet boolean, ehemalig boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select p.spieler_id, s.vorname, s.nachname, p.abgemeldet, p.spieler_id is null
    from termin_teilnahmen p left join spieler s on s.id = p.spieler_id
   where p.termin_id = p_termin
  union all
  select s.id, s.vorname, s.nachname,
         exists (select 1 from termin_abmeldungen a
                  where a.termin_id = p_termin and a.spieler_id = s.id and a.verfallen_am is null), false
    from training_termine t join spieler s on s.team_id = t.team_id
   where t.id = p_termin and not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin);
$$;

-- ── Ab- und Anmelden ersetzt die Markierung ─────────────────────────────────

create or replace function abmeldung_anwenden(p_termin uuid, p_spieler uuid, p_abgemeldet boolean,
                                              p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_stand jsonb;
begin
  select * into t from training_termine where id = p_termin for update;
  if not found or not exists (select 1 from spieler where id = p_spieler and team_id = t.team_id) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  v_stand := jsonb_build_object('datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                'ende', to_char(t.ende, 'HH24:MI'), 'ausgefallen', t.ausgefallen);
  if (p_gesehen_datum is not null and p_gesehen_datum is distinct from t.datum)
     or (p_gesehen_beginn is not null and p_gesehen_beginn is distinct from t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'verlegt', 'stand', v_stand);
  end if;
  if t.ausgefallen then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'ausgefallen', 'stand', v_stand);
  end if;
  if termin_begonnen(t.datum, t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'begonnen', 'stand', v_stand);
  end if;
  if p_abgemeldet then
    insert into termin_abmeldungen (termin_id, spieler_id, team_id) values (p_termin, p_spieler, t.team_id)
      on conflict (termin_id, spieler_id)
      do update set gesetzt_am = now(), verfallen_am = null, vorher_datum = null, vorher_beginn = null;
  else
    delete from termin_abmeldungen where termin_id = p_termin and spieler_id = p_spieler;
  end if;
  return jsonb_build_object('status', 'ok', 'abgemeldet', p_abgemeldet,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;
revoke all on function abmeldung_anwenden(uuid, uuid, boolean, date, time) from public, anon, authenticated;

-- ── Was der Link zeigt: dazu die verfallene Abmeldung (AK 2) ────────────────

create or replace function spieler_link_ansicht(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  s spieler;
  v_team text;
begin
  select * into s from spieler where link_token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  select name into v_team from teams where id = s.team_id;
  return jsonb_build_object(
    'gueltig', true,
    'team', v_team,
    'spieler', jsonb_build_object('vorname', s.vorname, 'nachname', s.nachname),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'datum', t.datum,
               'beginn', to_char(t.beginn, 'HH24:MI'), 'ende', to_char(t.ende, 'HH24:MI'),
               'ort', t.ort, 'ausgefallen', t.ausgefallen,
               'begonnen', termin_begonnen(t.datum, t.beginn),
               'angemeldet', case when t.ausgefallen then null else (spielstand(t) ->> 'angemeldet')::int end,
               'abgemeldet', case
                 when exists (select 1 from termin_eingefroren f where f.termin_id = t.id) then
                   coalesce((select p.abgemeldet from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id), false)
                 else exists (select 1 from termin_abmeldungen a
                               where a.termin_id = t.id and a.spieler_id = s.id and a.verfallen_am is null)
               end,
               -- Verlegt, seit sie abgemeldet wurde: der Zeitpunkt vorher —
               -- nur, solange der Termin nicht begonnen hat.
               'verfallen', (select jsonb_build_object('datum', a.vorher_datum, 'beginn', to_char(a.vorher_beginn, 'HH24:MI'))
                               from termin_abmeldungen a
                              where a.termin_id = t.id and a.spieler_id = s.id and a.verfallen_am is not null
                                and not termin_begonnen(t.datum, t.beginn)))
             order by t.datum, t.beginn, t.created_at)
        from training_termine t
       where t.team_id = s.team_id and t.datum >= heute_am_trainingsort()), '[]'::jsonb));
end;
$$;
revoke all on function spieler_link_ansicht(text) from public;
grant execute on function spieler_link_ansicht(text) to anon, authenticated;

-- ── Vor dem Speichern: wie viele verfallen (AK 1) ───────────────────────────

-- Ein einzelner Termin, verlegt auf `p_datum`/`p_beginn`: dieselbe
-- Entscheidung wie der Trigger oben. Nur für Mitglieder seines Teams.
create function termin_abmeldungen_verfallend(p_termin uuid, p_datum date, p_beginn time)
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
     or (p_datum is not distinct from t.datum and p_beginn is not distinct from t.beginn)
     or termin_begonnen(p_datum, p_beginn) then
    return 0;
  end if;
  if exists (select 1 from termin_eingefroren f where f.termin_id = p_termin) then
    return (select count(*) from termin_teilnahmen p
             where p.termin_id = p_termin and p.abgemeldet and p.spieler_id is not null);
  end if;
  return (select count(*) from termin_abmeldungen a where a.termin_id = p_termin and a.verfallen_am is null);
end;
$$;
revoke all on function termin_abmeldungen_verfallend(uuid, date, time) from public, anon;
grant execute on function termin_abmeldungen_verfallend(uuid, date, time) to authenticated;

-- Die Serie: Die Hülle zählt nach der Rechnung, was eben verfallen ist — in
-- der Vorschau vor dem Zurückrollen. `now()` ist der Beginn der Transaktion;
-- ältere Markierungen tragen eine frühere Zeit.
create or replace function terminserie_aendern(
  p_termin uuid,
  p_reichweite text,
  p_aenderung jsonb,
  p_version integer default null,
  p_entfallend uuid[] default null,
  p_ausfuehren boolean default true)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  if p_ausfuehren then
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, p_entfallend);
    return v || jsonb_build_object('abmeldungen_verfallend',
      (select count(*) from termin_abmeldungen where team_id = v_team and verfallen_am = now()));
  end if;
  -- Vorschau: Die Rechnung läuft bis zum Ende und wird zurückgerollt. Die im
  -- Ergebnis genannte `serie` einer Teilung stammt aus diesem zurückgerollten
  -- Einfügen und darf von Aufrufern nicht verwendet werden.
  begin
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, null);
    v := v || jsonb_build_object('abmeldungen_verfallend',
      (select count(*) from termin_abmeldungen where team_id = v_team and verfallen_am = now()));
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean) from public, anon;
grant execute on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean) to authenticated;

reset lock_timeout;
