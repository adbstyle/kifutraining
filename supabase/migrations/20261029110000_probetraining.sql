-- ============================================================================
-- Probe-Modus mit begrenzter Anmeldung (#555, Epic #554).
--
-- Eine Spieler:in im Probe-Modus (`spieler.probe_seit`) ist an Trainings
-- zuerst nicht angemeldet und meldet sich an (Grundstand, siehe
-- 20261029100000_meldestand.sql). Über den privaten Link meldet sie sich nur
-- an, solange besuchte und künftig angemeldete Probetrainings samt dieser
-- Anmeldung die Anzahl des Teams nicht übersteigen (AK 10); Mitglieder und KI
-- dürfen darüber hinaus (AK 8). Spiele gelten für sie nicht (PC 3).
--
-- Gezählt wird ab dem Einschalten (PO-Entscheide 3, 23): besucht ist ein
-- nicht ausgefallenes Training, das seither begonnen hat und bei dem sie bei
-- Beginn angemeldet war oder als doch erschienen nachgetragen ist, ausser
-- «nicht erschienen» (PC 4).
--
-- Forward-only: eine neue Tabelle (team_probetraining, steht in
-- PUBLIC_TABLES), neue Funktionen, neu gefasste Funktionen; drei fallen und
-- entstehen neu (neue Rückgabe): termin_teilnehmer, kader_bereinigen_training.
-- ============================================================================
set lock_timeout = '5s';

-- ── Die Anzahl Probetrainings des Teams (AK 1, 2; OoS 6) ────────────────────

create table team_probetraining (
  team_id uuid primary key references teams (id) on delete cascade,
  anzahl smallint not null constraint team_probetraining_anzahl check (anzahl between 1 and 20),
  geaendert_am timestamptz not null default now()
);
alter table team_probetraining enable row level security;
-- Mitglieder sehen die Einstellung ihres Teams; geschrieben wird nur über die
-- RPC — sie lässt sich ändern, nicht entfernen.
create policy tp_select on team_probetraining for select to authenticated using (ist_team_mitglied(team_id));
revoke all on team_probetraining from anon, authenticated;
grant select on team_probetraining to authenticated;

create function team_probetraining_festlegen(p_team uuid, p_anzahl integer) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_team is null or not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if p_anzahl is null or p_anzahl not between 1 and 20 then raise exception 'PROBE_ANZAHL_UNGUELTIG'; end if;
  insert into team_probetraining (team_id, anzahl) values (p_team, p_anzahl)
    on conflict (team_id) do update set anzahl = excluded.anzahl, geaendert_am = now();
  return jsonb_build_object('anzahl', p_anzahl);
end;
$$;
revoke all on function team_probetraining_festlegen(uuid, integer) from public, anon;
grant execute on function team_probetraining_festlegen(uuid, integer) to authenticated;

-- ── Spiele gelten nicht (PC 3) ──────────────────────────────────────────────

-- Rumpf wie in 20261018130000_termin_kader.sql; dazu: Ein Spiel gilt nicht
-- für eine Probe-Spieler:in. Alle Spiel-Wege (Stand, Meldung, Festhalten,
-- Link, Abo, Kader-Bereinigung) folgen dieser einen Regel.
create or replace function termin_gilt_fuer(p_termin uuid, p_spieler uuid) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select not exists (select 1 from training_termine t join spieler s on s.id = p_spieler
                      where t.id = p_termin and t.art = 'spiel' and s.probe_seit is not null)
     and (not exists (select 1 from termin_kader tk where tk.termin_id = p_termin and tk.kader_id is not null)
          or exists (select 1 from termin_kader tk join kader_spieler ks on ks.kader_id = tk.kader_id
                      where tk.termin_id = p_termin and ks.spieler_id = p_spieler));
$$;

-- Rumpf wie in 20261021240000_spiel_nachtrag.sql; die Gesamtzahl zählt, für
-- wen das Spiel gilt (statt alle bzw. die Kader), damit Probe-Spieler:innen
-- nicht mitzählen.
create or replace function spiel_stand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.liste then jsonb_build_object(
           'gesamt', z.n, 'angemeldet', z.an, 'abgemeldet', z.ab, 'ohne_meldung', z.n - z.an - z.ab - z.na,
           'nicht_aufgeboten', z.na, 'meldungen', z.gemeldet, 'eingefroren', z.fest,
           'anwesend', case when z.fest then z.da
                            when termin_begonnen(t.datum, t.beginn) then z.an end) end
    from (select e.fest,
                 case when e.fest then e.mit_liste
                      else exists (select 1 from spieler s where s.team_id = t.team_id) end as liste,
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id)
                      else (select count(*) from spieler s
                             where s.team_id = t.team_id and termin_gilt_fuer(t.id, s.id)) end as n,
                 case when e.fest then (select count(*) from spiel_teilnahmen p
                                         where p.termin_id = t.id and p.zustand = 'angemeldet' and not p.nicht_aufgeboten)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand = 'angemeldet'
                               and not m.nicht_aufgeboten and termin_gilt_fuer(t.id, m.spieler_id)) end as an,
                 case when e.fest then (select count(*) from spiel_teilnahmen p
                                         where p.termin_id = t.id and p.zustand = 'abgemeldet' and not p.nicht_aufgeboten)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand = 'abgemeldet'
                               and not m.nicht_aufgeboten and termin_gilt_fuer(t.id, m.spieler_id)) end as ab,
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id and p.nicht_aufgeboten)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.nicht_aufgeboten
                               and termin_gilt_fuer(t.id, m.spieler_id)) end as na,
                 -- Alle Meldungen, auch die nicht Aufgebotener: was mit dem Spiel verschwände.
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id and p.zustand is not null)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand is not null
                               and termin_gilt_fuer(t.id, m.spieler_id)) end as gemeldet,
                 -- #487 AK 9: wer zählte und nicht als nicht erschienen nachgetragen
                 -- ist, dazu wer als doch erschienen nachgetragen ist.
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id
                                           and spiel_zaehlt(p.zustand, p.nicht_aufgeboten) <> p.nachgetragen) end as da
            from (select f.termin_id is not null as fest, coalesce(f.mit_liste, false) as mit_liste
                    from (select 1) d left join termin_eingefroren f on f.termin_id = t.id) e) z;
$$;

-- ── Der Stand einer Probe-Spieler:in (AK 6, 7, 11; PC 4, 7, 13) ─────────────

-- {anzahl, besucht, angemeldet, moeglich} — null für reguläre Spieler:innen.
-- `angemeldet`: künftige, nicht ausgefallene Trainings, für die sie gilt;
-- `moeglich`: die Anzahl abzüglich beider, nie weniger als null.
create function probe_stand(p_spieler uuid) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when s.probe_seit is not null then jsonb_build_object(
           'anzahl', a.anzahl, 'besucht', b.n, 'angemeldet', k.n,
           'moeglich', greatest(0, coalesce(a.anzahl, 0) - b.n - k.n)) end
    from spieler s
    left join team_probetraining a on a.team_id = s.team_id
    cross join lateral (
      select count(*)::int as n from training_termine t
       where t.team_id = s.team_id and t.art = 'training' and not t.ausgefallen
         and t.datum >= (s.probe_seit at time zone 'Europe/Zurich')::date
         and (t.datum + t.beginn) >= (s.probe_seit at time zone 'Europe/Zurich')
         and termin_begonnen(t.datum, t.beginn)
         and case when exists (select 1 from termin_eingefroren f where f.termin_id = t.id)
                  then exists (select 1 from termin_teilnahmen p
                                where p.termin_id = t.id and p.spieler_id = s.id and p.abgemeldet = p.nachgetragen)
                  else termin_gilt_fuer(t.id, s.id) and not training_abgemeldet(t.id, s.id) end) b
    cross join lateral (
      select count(*)::int as n from termin_abmeldungen m join training_termine t on t.id = m.termin_id
       where m.spieler_id = s.id and m.angemeldet and m.verfallen_am is null
         and not t.ausgefallen and not termin_begonnen(t.datum, t.beginn) and termin_gilt_fuer(t.id, s.id)) k
   where s.id = p_spieler;
$$;
revoke all on function probe_stand(uuid) from public, anon;
grant execute on function probe_stand(uuid) to authenticated;

-- Die Stände aller Probe-Spieler:innen eines Teams (Spielerliste, Karte).
create function team_probe_staende(p_team uuid)
returns table (spieler_id uuid, stand jsonb)
language sql stable
set search_path = public, pg_temp
as $$
  select s.id, probe_stand(s.id) from spieler s where s.team_id = p_team and s.probe_seit is not null;
$$;
revoke all on function team_probe_staende(uuid) from public, anon;
grant execute on function team_probe_staende(uuid) to authenticated;

-- ── Ein- und ausschalten (AK 3–5, 16, 19; PC 1, 9, 10) ──────────────────────

-- Was das Einschalten verfallen liesse, vor dem Speichern (AK 5).
create function spieler_probe_folgen(p_spieler uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from spieler where id = p_spieler;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  return jsonb_build_object(
    'anzahl_festgelegt', exists (select 1 from team_probetraining where team_id = v_team),
    'probe', (select probe_seit is not null from spieler where id = p_spieler),
    'abmeldungen', (select count(*) from termin_abmeldungen a join training_termine t on t.id = a.termin_id
                     where a.spieler_id = p_spieler and a.verfallen_am is null and not a.angemeldet
                       and not termin_begonnen(t.datum, t.beginn)),
    'meldungen', (select count(*) from spiel_meldungen m join training_termine t on t.id = m.termin_id
                   where m.spieler_id = p_spieler and m.zustand is not null and not termin_begonnen(t.datum, t.beginn)),
    'kennzeichnungen', (select count(*) from spiel_meldungen m join training_termine t on t.id = m.termin_id
                         where m.spieler_id = p_spieler and m.nicht_aufgeboten and not termin_begonnen(t.datum, t.beginn)));
end;
$$;
revoke all on function spieler_probe_folgen(uuid) from public, anon;
grant execute on function spieler_probe_folgen(uuid) to authenticated;

-- Schaltet den Probe-Modus. Einschalten nur mit festgelegter Anzahl (AK 4)
-- und mit bestätigter Zahl der verfallenden Meldungen (AK 5); der Marker
-- nennt die Summe, davon Abmeldungen, Meldungen zu Spielen, Kennzeichnungen.
create function spieler_probe_setzen(p_spieler uuid, p_probe boolean, p_bestaetigt integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v_jetzt boolean;
  v_ab integer := 0;
  v_sp integer := 0;
  v_kz integer := 0;
  v integer := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from spieler where id = p_spieler;
  if v_team is null or not ist_team_mitglied(v_team) or p_probe is null then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  -- Dieselbe Sperre wie jede Meldung; dann begonnene Trainings festhalten:
  -- Ihr Stand bei Beginn folgte noch dem bisherigen Grundstand.
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || v_team::text, 0));
  perform termine_einfrieren(v_team);
  select probe_seit is not null into v_jetzt from spieler where id = p_spieler for update;
  if v_jetzt = p_probe then
    return jsonb_build_object('probe', p_probe, 'verfallen', 0);
  end if;
  if p_probe then
    if not exists (select 1 from team_probetraining where team_id = v_team) then
      raise exception 'PROBE_ANZAHL_FEHLT';
    end if;
    select count(*) into v_ab from termin_abmeldungen a join training_termine t on t.id = a.termin_id
     where a.spieler_id = p_spieler and a.verfallen_am is null and not a.angemeldet
       and not termin_begonnen(t.datum, t.beginn);
    select count(*) filter (where m.zustand is not null), count(*) filter (where m.nicht_aufgeboten)
      into v_sp, v_kz
      from spiel_meldungen m join training_termine t on t.id = m.termin_id
     where m.spieler_id = p_spieler and not termin_begonnen(t.datum, t.beginn);
    v := v_ab + v_sp + v_kz;
    if v > 0 and p_bestaetigt is distinct from v then
      raise exception 'PROBE_VERFALLEN % % % %', v, v_ab, v_sp, v_kz;
    end if;
  end if;
  -- Kommende Trainings beginnen im neuen Grundstand (PC 1, 9); niemand hat
  -- dort gewechselt.
  delete from termin_abmeldungen a using training_termine t
   where a.termin_id = t.id and a.spieler_id = p_spieler and not termin_begonnen(t.datum, t.beginn);
  delete from termin_statuswechsel w using training_termine t
   where w.termin_id = t.id and w.spieler_id = p_spieler and not termin_begonnen(t.datum, t.beginn);
  update spieler set probe_seit = case when p_probe then now() end where id = p_spieler;
  -- Spiele gelten nun nicht mehr: ihre Meldungen und Kennzeichnungen fallen.
  if p_probe then perform spiel_kader_bereinigen(v_team); end if;
  return jsonb_build_object('probe', p_probe, 'verfallen', v);
end;
$$;
revoke all on function spieler_probe_setzen(uuid, boolean, integer) from public, anon;
grant execute on function spieler_probe_setzen(uuid, boolean, integer) to authenticated;

-- ── Anmelden (AK 8–10, 12; Zusatzentscheid «Hinweis über der Anzahl») ───────

-- Rumpf wie in 20261016110000_abmeldungen.sql; dazu der Stand einer
-- Probe-Spieler:in, damit die Oberfläche eine Anmeldung über der Anzahl
-- benennen kann.
create or replace function termin_abmeldung_setzen(p_termin uuid, p_spieler uuid, p_abgemeldet boolean,
                                                   p_gesehen_datum date default null, p_gesehen_beginn time default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not ist_team_mitglied(v_team) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  v := abmeldung_anwenden(p_termin, p_spieler, p_abgemeldet, p_gesehen_datum, p_gesehen_beginn);
  if v ->> 'status' = 'ok' and exists (select 1 from spieler where id = p_spieler and probe_seit is not null) then
    v := v || jsonb_build_object('probe', probe_stand(p_spieler));
  end if;
  return v;
end;
$$;

-- Rumpf wie in 20261016120000_spieler_link.sql. Über den Link meldet sich
-- eine Probe-Spieler:in nur an, solange noch ein Probetraining möglich ist;
-- unter derselben Sperre wie die Meldung, damit zwei Geräte nicht beide den
-- letzten Platz nehmen.
create or replace function spieler_link_abmelden(p_token text, p_termin uuid, p_abgemeldet boolean,
                                                 p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s spieler;
  t training_termine;
  v jsonb;
begin
  select * into s from spieler where link_token = p_token;
  if not found then return jsonb_build_object('status', 'ungueltig'); end if;
  if s.probe_seit is not null and not p_abgemeldet then
    perform pg_advisory_xact_lock(hashtextextended('spieler:' || s.team_id::text, 0));
    select * into t from training_termine where id = p_termin and team_id = s.team_id;
    if found and t.art = 'training' and not t.ausgefallen and not termin_begonnen(t.datum, t.beginn)
       and (p_gesehen_datum is null or p_gesehen_datum = t.datum)
       and (p_gesehen_beginn is null or p_gesehen_beginn = t.beginn)
       and termin_gilt_fuer(t.id, s.id) and training_abgemeldet(t.id, s.id)
       and (probe_stand(s.id) ->> 'moeglich')::int < 1 then
      return jsonb_build_object('status', 'abgewiesen', 'grund', 'probe_voll',
        'stand', jsonb_build_object('datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                    'ende', to_char(t.ende, 'HH24:MI'), 'ausgefallen', t.ausgefallen),
        'probe', probe_stand(s.id));
    end if;
  end if;
  v := abmeldung_anwenden(p_termin, s.id, p_abgemeldet, p_gesehen_datum, p_gesehen_beginn);
  if s.probe_seit is not null then
    v := v || jsonb_build_object('probe', probe_stand(s.id));
  end if;
  return v;
end;
$$;

-- ── Verlegen (PC 5, AK 14) ──────────────────────────────────────────────────

-- Das Gegenstück zu `termin_abmeldungen_verfallend`: Anmeldungen von
-- Probe-Spieler:innen, die eine Verlegung verfallen liesse.
create function termin_anmeldungen_verfallend(p_termin uuid, p_datum date, p_beginn time)
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
    return (select count(*) from termin_teilnahmen p join spieler s on s.id = p.spieler_id
             where p.termin_id = p_termin and not p.abgemeldet and not training_grundstand(s.probe_seit));
  end if;
  return (select count(*) from termin_abmeldungen a
           where a.termin_id = p_termin and a.verfallen_am is null and a.angemeldet);
end;
$$;
revoke all on function termin_anmeldungen_verfallend(uuid, date, time) from public, anon;
grant execute on function termin_anmeldungen_verfallend(uuid, date, time) to authenticated;

-- Rumpf wie in 20261025110000_trainer_absagen.sql; die verfallenden
-- Anmeldungen von Probe-Spieler:innen getrennt (Verlegung und Kader).
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
  v_verlegt_an integer;
  v_kader integer[];
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
    select count(*) filter (where not angemeldet), count(*) filter (where angemeldet)
      into v_verlegt, v_verlegt_an
      from termin_abmeldungen where team_id = v_team and verfallen_am = now();
    v_kader := kader_bereinigen_teile(v_team);
    v_nachtraege := serie_nachtraege_verfallen(v_vorher);
    v_absagen := serie_absagen_verfallen(v_absagen_vorher);
    if p_verfallend is not null
       and p_verfallend <> v_verlegt + v_verlegt_an + v_kader[1] + v_kader[2] + v_kader[3] + v_kader[4]
                          + v_nachtraege + v_absagen then
      raise exception 'SERIE_VERFALL_GEAENDERT';
    end if;
    return v || jsonb_build_object('abmeldungen_verfallend', v_verlegt,
                                   'abmeldungen_kader', v_kader[1] + v_kader[3] + v_kader[4],
                                   'anmeldungen_verfallend', v_verlegt_an + v_kader[2],
                                   'nachtraege_verfallend', v_nachtraege, 'absagen_verfallend', v_absagen);
  end if;
  begin
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, null);
    select count(*) filter (where not angemeldet), count(*) filter (where angemeldet)
      into v_verlegt, v_verlegt_an
      from termin_abmeldungen where team_id = v_team and verfallen_am = now();
    v_kader := kader_bereinigen_teile(v_team);
    v := v || jsonb_build_object('abmeldungen_verfallend', v_verlegt,
                                 'abmeldungen_kader', v_kader[1] + v_kader[3] + v_kader[4],
                                 'anmeldungen_verfallend', v_verlegt_an + v_kader[2],
                                 'nachtraege_verfallend', serie_nachtraege_verfallen(v_vorher),
                                 'absagen_verfallend', serie_absagen_verfallen(v_absagen_vorher));
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;

-- ── Kader-Wegfall (PC 5, 6; AK 14) ──────────────────────────────────────────

-- Rumpf wie in 20261019100000_statuswechsel.sql (seit
-- 20261021210000_spiel_meldungen.sql `kader_bereinigen_training`); gezählt
-- getrennt: {Abmeldungen, Anmeldungen von Probe-Spieler:innen}.
drop function kader_bereinigen_training(uuid);
create function kader_bereinigen_training(p_team uuid) returns integer[]
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v integer[];
begin
  delete from termin_statuswechsel w using training_termine t
   where w.termin_id = t.id and t.team_id = p_team
     and not termin_begonnen(t.datum, t.beginn)
     and not termin_gilt_fuer(t.id, w.spieler_id);
  with weg as (
    delete from termin_abmeldungen a using training_termine t
     where a.termin_id = t.id and t.team_id = p_team
       and not termin_begonnen(t.datum, t.beginn)
       and not termin_gilt_fuer(t.id, a.spieler_id)
    returning a.verfallen_am, a.angemeldet)
  select array[count(*) filter (where verfallen_am is null and not angemeldet),
               count(*) filter (where verfallen_am is null and angemeldet)]::integer[]
    into v from weg;
  return v;
end;
$$;
revoke all on function kader_bereinigen_training(uuid) from public, anon, authenticated;

-- Alle Teile: {Abmeldungen, Anmeldungen, Meldungen zu Spielen, Kennzeichnungen}.
create function kader_bereinigen_teile(p_team uuid) returns integer[]
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spiele integer[] := spiel_kader_bereinigen(p_team);
begin
  return kader_bereinigen_training(p_team) || v_spiele;
end;
$$;
revoke all on function kader_bereinigen_teile(uuid) from public, anon, authenticated;

-- Für alle Wege, die nur die Summe brauchen.
create or replace function kader_bereinigen(p_team uuid) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v integer[] := kader_bereinigen_teile(p_team);
begin
  return v[1] + v[2] + v[3] + v[4];
end;
$$;

-- Der Marker nennt die Summe, davon Meldungen und Kennzeichnungen an Spielen,
-- dazu Anmeldungen von Probe-Spieler:innen.
create or replace function kader_nachher(p_team uuid, p_bestaetigt integer) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t integer[] := kader_bereinigen_teile(p_team);
  v integer := t[1] + t[2] + t[3] + t[4];
begin
  if v > 0 and p_bestaetigt is distinct from v then
    raise exception 'ABMELDUNGEN_VERFALLEN % % % %', v, t[3], t[4], t[2];
  end if;
  return v;
end;
$$;

-- Rumpf wie in 20261021230000_spiel_aufgebot.sql, dazu
-- `verfallend_anmeldungen`.
create or replace function kader_entfernen_folgen(p_kader uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v jsonb;
  v_teile integer[];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from kader where id = p_kader;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'KADER_NICHT_GEFUNDEN'; end if;
  v := jsonb_build_object(
    'spieler', (select count(*) from kader_spieler where kader_id = p_kader),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                          'ende', to_char(t.ende, 'HH24:MI'), 'serie', t.serie_id)
                       order by t.datum, t.beginn)
        from training_termine t
       where t.team_id = v_team and not termin_begonnen(t.datum, t.beginn)
         and exists (select 1 from termin_kader tk where tk.termin_id = t.id and tk.kader_id = p_kader)
         and not exists (select 1 from termin_kader tk where tk.termin_id = t.id
                          and tk.kader_id is not null and tk.kader_id <> p_kader)), '[]'::jsonb),
    'serien', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'wochentage', s.wochentage, 'beginn', to_char(s.beginn, 'HH24:MI'),
                                          'ende', to_char(s.ende, 'HH24:MI'), 'bis', s.end_datum)
                       order by s.beginn_datum)
        from termin_serien s
       where s.team_id = v_team
         and exists (select 1 from termin_serien_kader sk where sk.serie_id = s.id and sk.kader_id = p_kader)
         and not exists (select 1 from termin_serien_kader sk where sk.serie_id = s.id and sk.kader_id <> p_kader)
         and exists (select 1 from training_termine t where t.serie_id = s.id
                      and not termin_begonnen(t.datum, t.beginn))), '[]'::jsonb));
  begin
    delete from termin_kader tk using training_termine t
     where tk.termin_id = t.id and tk.kader_id = p_kader and not termin_begonnen(t.datum, t.beginn);
    delete from kader where id = p_kader;
    v_teile := kader_bereinigen_teile(v_team);
    v := v || jsonb_build_object('verfallend', v_teile[1] + v_teile[2] + v_teile[3] + v_teile[4],
                                 'verfallend_spiele', v_teile[3], 'verfallend_kennzeichnungen', v_teile[4],
                                 'verfallend_anmeldungen', v_teile[2]);
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;

-- ── Am Training (Reiter «Spieler:innen», KI) ────────────────────────────────

-- Rumpf wie in 20261029100000_meldestand.sql; dazu, ob die Spieler:in im
-- Probe-Modus ist (für die KI: «abgemeldet» heisst dann nicht angemeldet).
drop function termin_teilnehmer(uuid);
create function termin_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, abgemeldet boolean, ehemalig boolean, kader text[],
               gewechselt_am timestamptz, nachgetragen boolean, probe boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select x.spieler_id, x.vorname, x.nachname, x.abgemeldet, x.ehemalig,
         case when x.fest then '{}'::text[] else
         coalesce(array(select k.name from termin_kader tk join kader k on k.id = tk.kader_id
                          join kader_spieler ks on ks.kader_id = k.id
                         where tk.termin_id = p_termin and ks.spieler_id = x.spieler_id
                         order by k.name), '{}') end,
         w.gewechselt_am,
         x.nachgetragen,
         x.probe
    from (
      select p.spieler_id, s.vorname, s.nachname, p.abgemeldet, p.spieler_id is null as ehemalig, true as fest,
             p.nachgetragen, coalesce(s.probe_seit is not null, false) as probe
        from termin_teilnahmen p left join spieler s on s.id = p.spieler_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname, m.abgemeldet, false, false, false, s.probe_seit is not null
        from training_meldestand(p_termin) m join spieler s on s.id = m.spieler_id
       where not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x
    left join termin_statuswechsel w on w.termin_id = p_termin and w.spieler_id = x.spieler_id;
$$;
revoke all on function termin_teilnehmer(uuid) from public, anon;
grant execute on function termin_teilnehmer(uuid) to authenticated;

-- ── Privater Link und Abo (AK 9, 11, 12; PC 5, 11) ──────────────────────────

-- Rumpf wie in 20261027150000_ort_kartenlink.sql; dazu der Stand einer
-- Probe-Spieler:in, der Meldestand nach der einen Regel und die Richtung
-- einer verfallenen Meldung.
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
    -- #555 AK 11: der Stand einer Probe-Spieler:in, sonst null.
    'probe', probe_stand(s.id),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'datum', t.datum,
               'beginn', to_char(t.beginn, 'HH24:MI'), 'ende', to_char(t.ende, 'HH24:MI'),
               'ort', t.ort, 'ausgefallen', t.ausgefallen,
               -- #533 AK 6, 7: der Kartenlink zum Ort, an einem ausgefallenen Termin nicht.
               'ort_link', case when t.ausgefallen then null else t.ort_link end,
               -- #530 AK 1, 2; PC 2: der Grund des Ausfalls, vollständig; null ohne Grund
               -- (tt_ausfall_grund lässt ihn nur an einem ausgefallenen Termin zu).
               'ausfall_grund', t.ausfall_grund,
               'art', t.art, 'bezeichnung', t.bezeichnung,
               'richtwert_min', t.richtwert_min, 'richtwert_max', t.richtwert_max,
               'begonnen', termin_begonnen(t.datum, t.beginn),
               'angemeldet', case when t.ausgefallen then null else (x.stand ->> 'angemeldet')::int end,
               -- #472 AK 1, 2: von wie vielen — dieselbe Zahl wie für die Mitglieder.
               'gesamt', case when t.ausgefallen then null else (x.stand ->> 'gesamt')::int end,
               'abgemeldet', case
                 when t.art = 'spiel' then false
                 when x.fest then
                   coalesce((select p.abgemeldet from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id), false)
                 else training_abgemeldet(t.id, s.id)
               end,
               -- #555 PC 5: `anmeldung`, wenn eine Anmeldung verfallen ist.
               'verfallen', case when t.art = 'spiel' then null else
                              (select jsonb_build_object('datum', a.vorher_datum, 'beginn', to_char(a.vorher_beginn, 'HH24:MI'),
                                                         'anmeldung', a.angemeldet)
                                 from termin_abmeldungen a
                                where a.termin_id = t.id and a.spieler_id = s.id and a.verfallen_am is not null
                                  and not termin_begonnen(t.datum, t.beginn)) end,
               -- Spiele (#463): Meldung (null = ohne), verfallen, Frist, vorher.
               'meldung', case when t.art <> 'spiel' then null
                               when x.fest then (select p.zustand from spiel_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                               else (select m.zustand from spiel_meldungen m where m.termin_id = t.id and m.spieler_id = s.id) end,
               'meldung_verfallen', t.art = 'spiel' and not x.fest and not termin_begonnen(t.datum, t.beginn)
                                    and coalesce((select m.verfallen from spiel_meldungen m
                                                   where m.termin_id = t.id and m.spieler_id = s.id), false),
               'frist', to_char(spiel_frist(t), 'YYYY-MM-DD"T"HH24:MI'),
               'frist_abgelaufen', t.art = 'spiel' and spiel_frist_abgelaufen(t),
               'vorher', case when t.art = 'spiel' and t.vorher_datum is not null and not termin_begonnen(t.datum, t.beginn)
                              then jsonb_build_object('datum', t.vorher_datum, 'beginn', to_char(t.vorher_beginn, 'HH24:MI')) end,
               -- #464 AK 8, 9; PC 3: ob sie nicht aufgeboten ist, ob die Kennzeichnung
               -- mit einer Verlegung verfallen ist, und wie viele es nicht sind.
               'nicht_aufgeboten', t.art = 'spiel' and coalesce(case
                                     when x.fest then (select p.nicht_aufgeboten from spiel_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                                     else (select m.nicht_aufgeboten from spiel_meldungen m where m.termin_id = t.id and m.spieler_id = s.id) end, false),
               'aufgebot_verfallen', t.art = 'spiel' and not x.fest and not termin_begonnen(t.datum, t.beginn)
                                     and coalesce((select m.aufgebot_verfallen from spiel_meldungen m
                                                    where m.termin_id = t.id and m.spieler_id = s.id), false),
               'nicht_aufgeboten_zahl', case when t.art = 'spiel' and not t.ausgefallen then (x.stand ->> 'nicht_aufgeboten')::int end,
               -- #465 AK 10; PC 4: bei Spielen die Bemerkung und die Treffpunkte, nur wenn es
               -- stattfindet — ausgefallen spricht der Grund (PO 2026-10-27).
               'bemerkung', case when t.art = 'spiel' and not t.ausgefallen then t.bemerkung end,
               'treffpunkte', case when t.art = 'spiel' and not t.ausgefallen then coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'anreise', tp.anreise,
                          'zeitpunkt', to_char((t.datum + t.beginn) - make_interval(mins => tp.vorlauf_min), 'YYYY-MM-DD"T"HH24:MI'),
                          'ort', tp.ort) order by tp.vorlauf_min desc)
                   from spiel_treffpunkte tp where tp.termin_id = t.id), '[]'::jsonb) end,
               -- AK 2, 3: nur die Kader der Spieler:in, über die er für sie gilt.
               -- #523 AK 1–3: nur die Verantwortliche, mit Anzeigenamen, an einem
               -- Termin, der stattfindet; keine weiteren Trainer:innen, keine Lücken.
               'verantwortlich', case when not t.ausgefallen then
                 (select trainer_name(tr) from termin_trainer tr where tr.termin_id = t.id and tr.verantwortlich) end,
               'kader', coalesce((select jsonb_agg(k.name order by k.name)
                                    from termin_kader tk join kader k on k.id = tk.kader_id
                                    join kader_spieler ks on ks.kader_id = k.id and ks.spieler_id = s.id
                                   where tk.termin_id = t.id), '[]'::jsonb))
             order by t.datum, t.beginn, t.created_at)
        from training_termine t
        cross join lateral (select exists (select 1 from termin_eingefroren f where f.termin_id = t.id) as fest,
                                   spielstand(t) as stand) x
       where t.team_id = s.team_id and t.datum >= heute_am_trainingsort()
         and case when x.fest and t.art = 'spiel' then
                    exists (select 1 from spiel_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                  when x.fest then exists (select 1 from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                  else termin_gilt_fuer(t.id, s.id) end), '[]'::jsonb));
end;
$$;

-- Rumpf wie in 20261027150000_ort_kartenlink.sql; dazu, ob die Spieler:in im
-- Probe-Modus ist (PC 11: nicht angemeldet steht als vielleicht).
create or replace function spieler_abo_termine(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  a spieler_abos;
  v jsonb;
begin
  select * into a from spieler_abos where token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  v := spieler_link_ansicht((select link_token from spieler where id = a.spieler_id));
  if not coalesce((v ->> 'gueltig')::boolean, false) then return jsonb_build_object('gueltig', false); end if;
  return jsonb_build_object(
    'gueltig', true,
    'abo', a.id,
    'team', v -> 'team',
    'probe', jsonb_typeof(v -> 'probe') = 'object',
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e -> 'id', 'datum', e -> 'datum', 'beginn', e -> 'beginn', 'ende', e -> 'ende',
               'ort', e -> 'ort', 'ort_link', e -> 'ort_link', 'art', e -> 'art', 'bezeichnung', e -> 'bezeichnung',
               'begonnen', e -> 'begonnen', 'abgemeldet', e -> 'abgemeldet',
               'meldung', e -> 'meldung', 'frist_abgelaufen', e -> 'frist_abgelaufen',
               'nicht_aufgeboten', e -> 'nicht_aufgeboten',
               'bemerkung', e -> 'bemerkung', 'treffpunkte', e -> 'treffpunkte')
             order by x.n)
        from jsonb_array_elements(v -> 'termine') with ordinality as x(e, n)
       where not (e ->> 'ausgefallen')::boolean), '[]'::jsonb));
end;
$$;

reset lock_timeout;
