-- ============================================================================
-- Abmeldungen der Spieler:innen (Epic #433), Story 2 (#435): Mitglieder melden
-- eine Spieler:in für einen Termin ab und wieder an.
--
-- Angemeldet ist der Normalfall und hat keine Zeile (AK 3); gespeichert wird
-- nur die Abmeldung. Ab- und Anmelden geht bis zum Beginn (AK 4) — danach hält
-- die Datenbank den Stand fest (Migration spielerliste), samt Abmeldungen.
--
-- Die Regel für das Ab- und Anmelden steht einmal (`abmeldung_anwenden`): Die
-- Oberfläche der Mitglieder, der KI-Assistent und später der private Link
-- (#436) rufen sie auf. Sie antwortet mit einem Status statt einer Exception,
-- damit die Abweisung den aktuellen Stand nennen kann (#437 AK 5).
-- ============================================================================
set lock_timeout = '5s';

create table termin_abmeldungen (
  termin_id uuid not null references training_termine(id) on delete cascade,
  spieler_id uuid not null references spieler(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  gesetzt_am timestamptz not null default now(),
  primary key (termin_id, spieler_id)
);
create index termin_abmeldungen_spieler_idx on termin_abmeldungen (spieler_id);

alter table termin_abmeldungen enable row level security;
create policy ta_select on termin_abmeldungen for select to authenticated using (ist_team_mitglied(team_id));
revoke all on termin_abmeldungen from anon, authenticated;
grant select on termin_abmeldungen to authenticated;

-- ── Festhalten samt Abmeldungen ─────────────────────────────────────────────

-- Wie in der Migration spielerliste, dazu je Spieler:in, ob sie abgemeldet
-- war. Die Abmeldungen des Termins gehen danach in den festgehaltenen Stand
-- über: Er ist ab jetzt die einzige Quelle.
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
           exists (select 1 from termin_abmeldungen a where a.termin_id = p_termin and a.spieler_id = s.id)
      from spieler s where s.team_id = v_team;
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
             exists (select 1 from termin_abmeldungen a where a.termin_id = n.termin_id and a.spieler_id = s.id)
        from neu n cross join spieler s where s.team_id = p_team
      returning termin_id)
  delete from termin_abmeldungen a using neu n where a.termin_id = n.termin_id;
end;
$$;
revoke all on function termin_einfrieren(uuid) from public, anon, authenticated;
revoke all on function termine_einfrieren(uuid) from public, anon, authenticated;

-- ── Lesen ───────────────────────────────────────────────────────────────────

create or replace function spielstand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.n > 0 then jsonb_build_object('gesamt', z.n, 'angemeldet', z.n - z.ab, 'eingefroren', z.fest) end
    from (select e.fest,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id)
                      else (select count(*) from spieler s where s.team_id = t.team_id) end as n,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id and p.abgemeldet)
                      else (select count(*) from termin_abmeldungen a where a.termin_id = t.id) end as ab
            from (select exists (select 1 from termin_eingefroren f where f.termin_id = t.id) as fest) e) z;
$$;

-- Wer an einem Termin angemeldet und wer abgemeldet ist (AK 5, 7): offen die
-- aktuelle Liste, festgehalten der Stand bei Beginn — dort ehemalige
-- Spieler:innen ohne Namen (#435 PC 4). Sichtbar wie die Tabellen: nur für
-- Mitglieder (security invoker).
create function termin_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, abgemeldet boolean, ehemalig boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select p.spieler_id, s.vorname, s.nachname, p.abgemeldet, p.spieler_id is null
    from termin_teilnahmen p left join spieler s on s.id = p.spieler_id
   where p.termin_id = p_termin
  union all
  select s.id, s.vorname, s.nachname,
         exists (select 1 from termin_abmeldungen a where a.termin_id = p_termin and a.spieler_id = s.id), false
    from training_termine t join spieler s on s.team_id = t.team_id
   where t.id = p_termin and not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin);
$$;
revoke all on function termin_teilnehmer(uuid) from public, anon;
grant execute on function termin_teilnehmer(uuid) to authenticated;

-- ── Ab- und Anmelden ────────────────────────────────────────────────────────

-- Die eine Regel (AK 1, 2, 4; #437 AK 3, 5). `p_gesehen_*`: Datum und Beginn,
-- wie der Aufrufer den Termin sah — weicht der Stand ab, ist er verlegt
-- worden. Status: ok | abgewiesen (grund: nicht_gefunden, verlegt,
-- ausgefallen, begonnen; dazu der aktuelle Stand). Intern: nur die RPCs
-- unten rufen sie auf.
create function abmeldung_anwenden(p_termin uuid, p_spieler uuid, p_abgemeldet boolean,
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
      on conflict (termin_id, spieler_id) do update set gesetzt_am = now();
  else
    delete from termin_abmeldungen where termin_id = p_termin and spieler_id = p_spieler;
  end if;
  return jsonb_build_object('status', 'ok', 'abgemeldet', p_abgemeldet,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;
revoke all on function abmeldung_anwenden(uuid, uuid, boolean, date, time) from public, anon, authenticated;

-- Für Mitglieder (AK 1, 2, 9): Mitglied des Teams des Termins, dann die Regel.
create function termin_abmeldung_setzen(p_termin uuid, p_spieler uuid, p_abgemeldet boolean,
                                        p_gesehen_datum date default null, p_gesehen_beginn time default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not ist_team_mitglied(v_team) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  return abmeldung_anwenden(p_termin, p_spieler, p_abgemeldet, p_gesehen_datum, p_gesehen_beginn);
end;
$$;
revoke all on function termin_abmeldung_setzen(uuid, uuid, boolean, date, time) from public, anon;
grant execute on function termin_abmeldung_setzen(uuid, uuid, boolean, date, time) to authenticated;

reset lock_timeout;
