-- ============================================================================
-- Vereine, Story 8 (#584): Schnuppertraining für Spieler:innen in genau einem
-- Team (Architekturplan Vereine §3.3 f, §4.1, §4.3, §4.4; Plan Phase 8).
--
-- Nur Funktionen, ein Trigger und Rechte; keine Tabelle, keine Spalte, kein
-- Constraint, keine Datenänderung. Anzahl und Info-Schreiben
-- (`team_probetraining`), schnuppernde Spieler:innen und ihre Zählung bleiben,
-- wie sie sind (PC 3). Die internen Namen bleiben `probe_*`.
--
-- - Regel «genau ein Team» (AK 5): Trägt eine Zuordnung `probe_seit`, hat die
--   Spieler:in genau diese eine. Netz in `team_spieler_vorher` (jetzt auch
--   bei UPDATE OF probe_seit), in dieser Reihenfolge: SPIELER_SCHNUPPERT (eine
--   weitere Zuordnung für eine Schnuppernde), SCHNUPPERN_MEHRERE_TEAMS
--   (`probe_seit` neben weiteren Zuordnungen). Team, Spieler:in und Verein
--   einer Zuordnung sind unveränderlich (ZUORDNUNG_UNVERAENDERLICH).
-- - `spieler_probe_setzen` und `spieler_probe_folgen` nehmen `p_team` und
--   lesen `spieler.team_id` nicht mehr. Das Einschalten nimmt zuerst die
--   Vereinssperre (wie das Zuordnen), dann Team und Zeile, und prüft unter
--   den Sperren erneut (AK 14).
-- - `verein_spieler_zuordnen` mit `p_schnuppern` (AK 8–11): nur einzeln
--   (SCHNUPPERN_NUR_EINZELN), nicht mit Team (`schnuppern_hat_team`), nicht
--   ohne Anzahl (`schnuppern_anzahl_fehlt`); sonst Zuordnung mit
--   `probe_seit = now()`.
-- - Herausnehmen meldet `schnuppern_beendet` (AK 13); `spieler_teams` nennt
--   `schnuppert`, der Stand bemerkt Ein- und Ausschalten.
-- - Zähler «Schnuppern n/m» für die Verwaltung in `verein_team_ansicht` und
--   `verein_spielerliste` (Helfer `team_probe_zaehler`, ohne API-Recht).
-- - Link: `probe`/`probe_info` von der schnuppernden Zuordnung.
-- - `spieler.probe_seit` und `spieler.team_id` sind für `authenticated` nicht
--   mehr lesbar. Danach lesen beide Spalten nur noch `vereine_nachziehen`
--   (bis N1); `team_spieler_nachher` pflegt `team_id` weiter.
--
-- Sperrordnung Verein → Suche → Person → Teams → `spieler`-Zeile → Termin.
-- ============================================================================

set lock_timeout = '5s';

-- ── Funktionen: Helfer ──────────────────────────────────────────────────────

-- Rumpf wie in 20261114110000_vereine_bestand.sql; je Team dazu, ob die
-- Spieler:in dort schnuppert: Ein- und Ausschalten ändern den Stand (Story 8
-- A2.6). Ohne Schnuppern bleibt der Wert wie bisher.
create or replace function spieler_teams_stand(p_spieler uuid) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select md5(coalesce(string_agg(team_id::text || case when probe_seit is not null then ':schnuppert' else '' end,
                                 ',' order by team_id), ''))
    from team_spieler where spieler_id = p_spieler;
$$;

-- Zähler «Schnuppern n/m» einer Spieler:in, die in p_team schnuppert, sonst
-- null: {anzahl (null ohne festgelegte Anzahl), besucht}. Dieselbe Zählung
-- wie am Team-Ort (probe_stand). Für die Ansichten der Verwaltung, die keinem
-- Team angehören muss. Kein API-Recht.
create function team_probe_zaehler(p_team uuid, p_spieler uuid) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('anzahl', (p.stand ->> 'anzahl')::int, 'besucht', (p.stand ->> 'besucht')::int)
    from team_spieler ts
    cross join lateral (select probe_stand(ts.spieler_id) as stand) p
   where ts.team_id = p_team and ts.spieler_id = p_spieler and ts.probe_seit is not null;
$$;

-- Rumpf wie in 20261114200000_vereine_verwaltung.sql; dazu, ob die
-- Spieler:in in p_team schnuppert (vor dem Löschen gelesen, unter Teamsperre
-- und Zeile): `schnuppert` in `stand_geaendert`, `schnuppern_beendet` nach
-- dem Herausnehmen (AK 13).
--   {status: 'stand_geaendert', teams: [{name, eigen, dieses, abholbar}], schnuppert, stand}
--   | {status: 'herausgenommen', ohne_team, schnuppern_beendet}
create or replace function spieler_aus_team_nehmen_kern(p_team uuid, p_spieler uuid, p_pruefe_stand boolean, p_stand text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_stand text;
  v_schnuppert boolean;
begin
  perform sperre_teams(array[p_team]);
  perform 1 from spieler where id = p_spieler for update;
  if not spieler_im_team(p_spieler, p_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  v_schnuppert := exists (select 1 from team_spieler
                           where team_id = p_team and spieler_id = p_spieler and probe_seit is not null);
  if p_pruefe_stand then
    v_stand := spieler_teams_stand(p_spieler);
    if p_stand is null or p_stand <> v_stand then
      return jsonb_build_object('status', 'stand_geaendert',
                                'teams', spieler_teams_auskunft(p_spieler, p_team),
                                'schnuppert', v_schnuppert, 'stand', v_stand);
    end if;
  end if;
  delete from team_spieler where team_id = p_team and spieler_id = p_spieler;
  return jsonb_build_object('status', 'herausgenommen',
                            'ohne_team', not exists (select 1 from team_spieler where spieler_id = p_spieler),
                            'schnuppern_beendet', v_schnuppert);
end;
$$;

-- ── Funktionen: Team-Ort ────────────────────────────────────────────────────

-- Rumpf wie in 20261114110000_vereine_bestand.sql; dazu `schnuppert` (in
-- diesem Team) für die Bestätigung beim Herausnehmen (AK 13).
--   {teams: [{name, eigen, dieses, abholbar}], schnuppert, stand}
create or replace function spieler_teams(p_team uuid, p_spieler uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) or not spieler_im_team(p_spieler, p_team) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  return jsonb_build_object(
    'teams', spieler_teams_auskunft(p_spieler, p_team),
    'schnuppert', exists (select 1 from team_spieler
                           where team_id = p_team and spieler_id = p_spieler and probe_seit is not null),
    'stand', spieler_teams_stand(p_spieler));
end;
$$;

-- Rumpf wie in 20261114110000_vereine_bestand.sql; Recht über p_team
-- (Mitglied, Spieler:in im Team) statt über spieler.team_id. Rückgabe
-- unverändert {abmeldungen, meldungen, kennzeichnungen}.
drop function spieler_probe_folgen(uuid);
create function spieler_probe_folgen(p_team uuid, p_spieler uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) or not spieler_im_team(p_spieler, p_team) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  if (select count(*) from team_spieler where spieler_id = p_spieler) > 1 then
    raise exception 'SCHNUPPERN_MEHRERE_TEAMS';
  end if;
  return jsonb_build_object(
    'abmeldungen', (select count(*) from termin_abmeldungen a join training_termine t on t.id = a.termin_id
                     where a.spieler_id = p_spieler and a.verfallen_am is null and not a.angemeldet
                       and not termin_begonnen(t.datum, t.beginn)),
    'meldungen', (select count(*) from spiel_meldungen m join training_termine t on t.id = m.termin_id
                   where m.spieler_id = p_spieler and m.zustand is not null and not termin_begonnen(t.datum, t.beginn)),
    'kennzeichnungen', (select count(*) from spiel_meldungen m join training_termine t on t.id = m.termin_id
                         where m.spieler_id = p_spieler and m.nicht_aufgeboten and not termin_begonnen(t.datum, t.beginn)));
end;
$$;

-- Rumpf wie in 20261114110000_vereine_bestand.sql; Recht über p_team statt
-- spieler.team_id. Sperren neu Verein → Team → Zeile (AP §4.1: wer die
-- Teammenge prüft, nimmt vorher die Vereinssperre). Das Zuordnen hält
-- dieselbe Folge, darum kein Zyklus, und es kommt ganz vor oder ganz nach
-- dieser Prüfung (AK 14). Unter den Sperren erneut: Spieler:in noch im Team
-- (sonst SPIELER_NICHT_GEFUNDEN statt eines stillen Erfolgs), beim
-- Einschalten keine weitere Zuordnung. Ist das Team schon vor der
-- Vereinssperre weg, ebenfalls SPIELER_NICHT_GEFUNDEN. Kommende Ab- und
-- Anmeldungen fallen nur in p_team: Schaltet ein Mitglied eine Altlast
-- (schnuppernd hier, zugeordnet anderswo) aus, bleiben die Meldungen im
-- anderen Team. Rückgabe unverändert
-- {probe, verfallen}.
drop function spieler_probe_setzen(uuid, boolean, integer);
create function spieler_probe_setzen(p_team uuid, p_spieler uuid, p_probe boolean, p_bestaetigt integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_jetzt boolean;
  v_verein uuid;
  v_ab integer := 0;
  v_sp integer := 0;
  v_kz integer := 0;
  v integer := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_probe is null or not ist_team_mitglied(p_team) or not spieler_im_team(p_spieler, p_team) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  v_verein := (select verein_id from teams where id = p_team);
  if v_verein is null then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  perform sperre_verein(v_verein);
  -- Dieselbe Sperre wie jede Meldung; dann begonnene Trainings festhalten:
  -- Ihr Stand bei Beginn folgte noch dem bisherigen Grundstand.
  perform sperre_teams(array[p_team]);
  perform termine_einfrieren(p_team);
  perform 1 from spieler where id = p_spieler for update;
  if not spieler_im_team(p_spieler, p_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  select probe_seit is not null into v_jetzt from team_spieler where spieler_id = p_spieler and team_id = p_team;
  if v_jetzt = p_probe then
    return jsonb_build_object('probe', p_probe, 'verfallen', 0);
  end if;
  if p_probe then
    if (select count(*) from team_spieler where spieler_id = p_spieler) > 1 then
      raise exception 'SCHNUPPERN_MEHRERE_TEAMS';
    end if;
    if not exists (select 1 from team_probetraining where team_id = p_team) then
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
   where a.termin_id = t.id and t.team_id = p_team and a.spieler_id = p_spieler
     and not termin_begonnen(t.datum, t.beginn);
  delete from termin_statuswechsel w using training_termine t
   where w.termin_id = t.id and t.team_id = p_team and w.spieler_id = p_spieler
     and not termin_begonnen(t.datum, t.beginn);
  update team_spieler set probe_seit = case when p_probe then now() end
   where spieler_id = p_spieler and team_id = p_team;
  -- Spiele gelten nun nicht mehr: ihre Meldungen und Kennzeichnungen fallen.
  if p_probe then perform spiel_kader_bereinigen(p_team); end if;
  return jsonb_build_object('probe', p_probe, 'verfallen', v);
end;
$$;

-- ── Funktionen: Verein-Ort ──────────────────────────────────────────────────

-- Rumpf wie in 20261114210000_spielerbestand_verwaltung.sql; dazu
-- p_schnuppern (AK 8–11, Testfall 18). Mit p_schnuppern, in dieser
-- Reihenfolge: mehr als eine Spieler:in → SCHNUPPERN_NUR_EINZELN (die
-- Oberfläche bietet es gesammelt nicht an, OoS 6); schon einem Team
-- zugeordnet (auch dem Zielteam) → grund `schnuppern_hat_team`; Team ohne
-- Anzahl → grund `schnuppern_anzahl_fehlt`; danach die übrigen Befunde. Die
-- Abweisung hat immer dieselbe Form:
--   {status: 'abgewiesen', (grund), bereits, gleich, schnuppert: [P + {team}], ueber_grenze}
-- Erfolg wie bisher {status: 'zugeordnet', anzahl, ersetzt}; zum Schnuppern
-- mit probe_seit = now(), die Zählung beginnt mit der Zuordnung (AK 11).
drop function verein_spieler_zuordnen(uuid, uuid[]);
create function verein_spieler_zuordnen(p_team uuid, p_spieler uuid[], p_schnuppern boolean default false) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_verein uuid;
  v_ids uuid[];
  v_bereits jsonb;
  v_gleich jsonb;
  v_schnuppert jsonb;
  v_frei int;
  v_ueber int;
  v_ersetzt int;
  v_grund text;
begin
  perform nur_in_der_anwendung();
  v_verein := verwaltung_team_sperren(p_team);
  if p_spieler is null or cardinality(p_spieler) = 0 or array_position(p_spieler, null) is not null then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  v_ids := array(select distinct x from unnest(p_spieler) x order by x);
  if coalesce(p_schnuppern, false) and cardinality(v_ids) > 1 then raise exception 'SCHNUPPERN_NUR_EINZELN'; end if;
  perform sperre_teams(array[p_team]);
  perform 1 from spieler where id = any(v_ids) order by id for update;
  if (select count(*) from spieler where id = any(v_ids) and verein_id = v_verein) <> cardinality(v_ids) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;

  if coalesce(p_schnuppern, false) then
    v_grund := case when exists (select 1 from team_spieler where spieler_id = v_ids[1]) then 'schnuppern_hat_team'
                    when not exists (select 1 from team_probetraining where team_id = p_team) then 'schnuppern_anzahl_fehlt' end;
    if v_grund is not null then
      return jsonb_build_object('status', 'abgewiesen', 'grund', v_grund, 'bereits', '[]'::jsonb, 'gleich', '[]'::jsonb,
                                'schnuppert', '[]'::jsonb, 'ueber_grenze', 0);
    end if;
  end if;

  with auswahl as (
    select s.id, s.vorname, s.nachname, s.jahrgang,
           jsonb_build_object('id', s.id, 'vorname', s.vorname, 'nachname', s.nachname, 'jahrgang', s.jahrgang) as p,
           spieler_text_schluessel(s.vorname) as kv, spieler_text_schluessel(s.nachname) as kn
      from spieler s where s.id = any(v_ids)
  ), befund as (
    select a.*,
           spieler_im_team(a.id, p_team) as bereits,
           not spieler_im_team(a.id, p_team) and (
             exists (select 1 from team_spieler ts join spieler o on o.id = ts.spieler_id
                      where ts.team_id = p_team and o.id <> a.id
                        and spieler_text_schluessel(o.vorname) = a.kv
                        and spieler_text_schluessel(o.nachname) = a.kn and o.jahrgang = a.jahrgang)
             or exists (select 1 from auswahl o
                         where o.id <> a.id and o.kv = a.kv and o.kn = a.kn and o.jahrgang = a.jahrgang)) as gleich,
           case when not spieler_im_team(a.id, p_team) then
             (select t.name from team_spieler ts join teams t on t.id = ts.team_id
               where ts.spieler_id = a.id and ts.probe_seit is not null and ts.team_id <> p_team
               order by t.name limit 1) end as schnupper_team
      from auswahl a
  )
  select coalesce(jsonb_agg(p order by vorname, nachname, jahrgang, id) filter (where bereits), '[]'::jsonb),
         coalesce(jsonb_agg(p order by vorname, nachname, jahrgang, id) filter (where gleich), '[]'::jsonb),
         coalesce(jsonb_agg(p || jsonb_build_object('team', schnupper_team)
                            order by vorname, nachname, jahrgang, id) filter (where schnupper_team is not null), '[]'::jsonb),
         count(*) filter (where not bereits and not gleich and schnupper_team is null)
    into v_bereits, v_gleich, v_schnuppert, v_frei
    from befund;
  v_ueber := greatest(0, (select count(*) from team_spieler where team_id = p_team) + v_frei - 100);

  if jsonb_array_length(v_bereits) > 0 or jsonb_array_length(v_gleich) > 0
     or jsonb_array_length(v_schnuppert) > 0 or v_ueber > 0 then
    return jsonb_build_object('status', 'abgewiesen', 'bereits', v_bereits, 'gleich', v_gleich,
                              'schnuppert', v_schnuppert, 'ueber_grenze', v_ueber);
  end if;

  v_ersetzt := spielerzahl_freigeben(p_team);
  insert into team_spieler (team_id, spieler_id, verein_id, probe_seit)
  select p_team, x, v_verein, case when coalesce(p_schnuppern, false) then now() end from unnest(v_ids) x order by x;
  return jsonb_build_object('status', 'zugeordnet', 'anzahl', cardinality(v_ids), 'ersetzt', v_ersetzt);
end;
$$;

-- Rumpf wie in 20261114200000_vereine_verwaltung.sql; je Spieler:in statt
-- `schnuppert` der Zähler `schnuppern` (team_probe_zaehler; Testfall 28,
-- AK 1, 13).
--   {id, name, spieler_zahl, ich_mitglied,
--    trainer: [{user_id, anzeige_name, email, ist_verwaltung, ich}],
--    spieler: [{id, vorname, nachname, jahrgang, schnuppern: {anzahl, besucht} | null, teams: [{id, name}]}],
--    aufloesung: {trainings, termine, spiele, kader}}
create or replace function verein_team_ansicht(p_team uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verein uuid;
begin
  perform nur_in_der_anwendung();
  v_verein := (select verein_id from teams where id = p_team);
  if not ist_verein_verwaltung(v_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  return (select jsonb_build_object(
    'id', t.id, 'name', t.name,
    'spieler_zahl', (select count(*) from team_spieler ts where ts.team_id = t.id),
    'ich_mitglied', exists (select 1 from team_members m where m.team_id = t.id and m.user_id = v_uid),
    'trainer', (select coalesce(jsonb_agg(jsonb_build_object(
                   'user_id', m.user_id, 'anzeige_name', anzeige_name(m.user_id), 'email', u.email,
                   'ist_verwaltung', exists (select 1 from verein_verwaltung w
                                              where w.verein_id = v_verein and w.user_id = m.user_id),
                   'ich', m.user_id = v_uid)
                   order by m.created_at, m.user_id), '[]'::jsonb)
                  from team_members m join auth.users u on u.id = m.user_id
                 where m.team_id = t.id),
    'spieler', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', s.id, 'vorname', s.vorname, 'nachname', s.nachname, 'jahrgang', s.jahrgang,
                   'schnuppern', case when ts.probe_seit is not null then team_probe_zaehler(t.id, s.id) end,
                   'teams', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name)
                                                       order by a.name, a.id), '[]'::jsonb)
                               from team_spieler z join teams a on a.id = z.team_id
                              where z.spieler_id = s.id))
                   order by s.vorname, s.nachname, s.jahrgang, s.id), '[]'::jsonb)
                  from team_spieler ts join spieler s on s.id = ts.spieler_id
                 where ts.team_id = t.id),
    'aufloesung', jsonb_build_object(
      'trainings', (select count(*) from trainings r where r.team_id = t.id and not r.termin_training),
      'termine', (select count(*) from training_termine tt where tt.team_id = t.id and tt.art = 'training'),
      'spiele', (select count(*) from training_termine tt where tt.team_id = t.id and tt.art = 'spiel'),
      'kader', (select count(*) from kader k where k.team_id = t.id)))
    from teams t where t.id = p_team);
end;
$$;

-- Rumpf wie in 20261114210000_spielerbestand_verwaltung.sql; je Spieler:in
-- dazu `schnuppern` mit dem Team der schnuppernden Zuordnung (Plan Phase 8,
-- aus Phase 6).
--   {spieler: [{id, vorname, nachname, jahrgang, js, link_bezogen, teams: [{id, name}],
--               schnuppern: {team_id, anzahl, besucht} | null}],
--    teams: [{id, name, anzahl}]}
create or replace function verein_spielerliste(p_verein uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform nur_in_der_anwendung();
  if not ist_verein_verwaltung(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  return jsonb_build_object(
    'spieler', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', s.id, 'vorname', s.vorname, 'nachname', s.nachname, 'jahrgang', s.jahrgang,
                  'js', s.js_nummer, 'link_bezogen', s.link_bezogen,
                  'teams', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)
                                                      order by t.name, t.id), '[]'::jsonb)
                              from team_spieler ts join teams t on t.id = ts.team_id
                             where ts.spieler_id = s.id),
                  'schnuppern', (select jsonb_build_object('team_id', ts.team_id) || team_probe_zaehler(ts.team_id, s.id)
                                   from team_spieler ts
                                  where ts.spieler_id = s.id and ts.probe_seit is not null
                                  order by ts.created_at, ts.team_id limit 1))
                  order by s.vorname, s.nachname, s.jahrgang, s.id), '[]'::jsonb)
                  from spieler s where s.verein_id = p_verein),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', t.id, 'name', t.name,
                'anzahl', (select count(*) from team_spieler ts where ts.team_id = t.id))
                order by t.name, t.id), '[]'::jsonb)
                from teams t where t.verein_id = p_verein));
end;
$$;

-- ── Funktionen: Link ────────────────────────────────────────────────────────

-- Rumpf wie in 20261114220000_link_mehrere_teams.sql; `probe` und
-- `probe_info` kommen von der schnuppernden Zuordnung statt von «genau einem
-- Team» (A2.8). Unter der Regel dasselbe; eine Altlast in zwei Teams zeigt
-- so den Stand, nach dem auch das Abmelden über den Link urteilt.
-- `spieler_abo_termine` folgt (probe = ob `probe` ein Objekt ist).
create or replace function spieler_link_ansicht(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $function$
declare
  s spieler;
  v_verein text;
  v_teams jsonb;
  v_einziges uuid;
begin
  select * into s from spieler where link_token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  select name into v_verein from vereine where id = s.verein_id;
  select coalesce(jsonb_agg(t.name order by t.name, t.id), '[]'::jsonb),
         case when count(*) = 1 then (array_agg(t.id))[1] end
    into v_teams, v_einziges
    from team_spieler ts join teams t on t.id = ts.team_id
   where ts.spieler_id = s.id;
  return jsonb_build_object(
    'gueltig', true,
    'team', coalesce((select name from teams where id = v_einziges), v_verein),
    'verein', v_verein,
    'teams', v_teams,
    'spieler', jsonb_build_object('vorname', s.vorname, 'nachname', s.nachname),
    -- #555 AK 11: der Stand einer schnuppernden Spieler:in, sonst null.
    'probe', probe_stand(s.id),
    -- #556 AK 4; PC 1: das Info-Schreiben des Teams, in dem sie schnuppert.
    'probe_info', (select i.info from team_spieler ts join team_probetraining i on i.team_id = ts.team_id
                    where ts.spieler_id = s.id and ts.probe_seit is not null
                    order by ts.created_at, ts.team_id limit 1),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'team', tm.name, 'datum', t.datum,
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
               -- #590 AK 9–11, 13: der Hinweis für Eltern an Trainings und Spielen, nur wenn
               -- der Termin stattfindet — ausgefallen spricht der Grund. Die Bemerkung
               -- bleibt beim Team, auch an Spielen.
               'hinweis_eltern', case when not t.ausgefallen then t.hinweis_eltern end,
               -- #465 AK 10: bei Spielen die Treffpunkte, nur wenn es stattfindet.
               'treffpunkte', case when t.art = 'spiel' and not t.ausgefallen then coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'anreise', tp.anreise,
                          'zeitpunkt', to_char((t.datum + t.beginn) - make_interval(mins => tp.vorlauf_min), 'YYYY-MM-DD"T"HH24:MI'),
                          'ort', tp.ort) order by tp.vorlauf_min desc)
                   from spiel_treffpunkte tp where tp.termin_id = t.id), '[]'::jsonb) end,
               -- #561 AK 12: der Treffpunkt eines Trainings, nur wenn es stattfindet;
               -- ab Beginn und bei einer Abmeldung blendet ihn die Ansicht aus.
               'treffpunkt', case when t.art = 'training' and not t.ausgefallen and t.treffpunkt_vorlauf_min is not null
                               then jsonb_build_object(
                                      'zeit', to_char(t.beginn - make_interval(mins => t.treffpunkt_vorlauf_min), 'HH24:MI'),
                                      'ort', t.treffpunkt_ort) end,
               -- AK 2, 3: nur die Kader der Spieler:in, über die er für sie gilt.
               -- #523 AK 1–3: nur die Verantwortliche, mit Anzeigenamen, an einem
               -- Termin, der stattfindet; keine weiteren Trainer:innen, keine Lücken.
               'verantwortlich', case when not t.ausgefallen then
                 (select trainer_name(tr) from termin_trainer tr where tr.termin_id = t.id and tr.verantwortlich) end,
               'kader', coalesce((select jsonb_agg(k.name order by k.name)
                                    from termin_kader tk join kader k on k.id = tk.kader_id
                                    join kader_spieler ks on ks.kader_id = k.id and ks.spieler_id = s.id
                                   where tk.termin_id = t.id), '[]'::jsonb))
             -- Story 7 AK 1: heute begonnene zuerst, dann Datum, Beginn,
             -- Teamname; created_at wie bisher, damit die Folge innerhalb
             -- eines Teams bleibt.
             order by termin_begonnen(t.datum, t.beginn) desc, t.datum, t.beginn, tm.name, t.team_id, t.created_at, t.id)
        from team_spieler zs
        join training_termine t on t.team_id = zs.team_id
        join teams tm on tm.id = t.team_id
        cross join lateral (select exists (select 1 from termin_eingefroren f where f.termin_id = t.id) as fest,
                                   spielstand(t) as stand) x
       where zs.spieler_id = s.id and t.datum >= heute_am_trainingsort()
         and case when x.fest and t.art = 'spiel' then
                    exists (select 1 from spiel_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                  when x.fest then exists (select 1 from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                  else termin_gilt_fuer(t.id, s.id) end), '[]'::jsonb));
end;
$function$;

-- ── Funktionen: Trigger ─────────────────────────────────────────────────────

-- Rumpf wie in 20261114100000_zuordnung_invarianten.sql; dazu die Regel
-- «genau ein Team» als Netz (AP §3.3 f; die RPCs antworten vorher mit
-- Auskunft) und neu auch bei UPDATE OF probe_seit. Reihenfolge beim INSERT:
-- SCHON_ZUGEORDNET → SPIELER_SCHNUPPERT (die Spieler:in schnuppert in einem
-- anderen Team) → SCHNUPPERN_MEHRERE_TEAMS (mit probe_seit neben weiteren
-- Zuordnungen) → SPIELER_DOPPELT → SPIELERLISTE_VOLL. Beim UPDATE nur
-- SCHNUPPERN_MEHRERE_TEAMS, und nur beim Einschalten; Ausschalten geht immer.
-- Team, Spieler:in und Verein einer Zuordnung ändert kein Weg (keine Funktion
-- schreibt sie); ein direktes UPDATE darauf ginge am Netz vorbei und wird mit
-- ZUORDNUNG_UNVERAENDERLICH abgewiesen (Herausnehmen und neu Zuordnen).
-- Sperren in der Sperrordnung: Wo Schnuppern beginnt, zuerst die
-- Vereinssperre (die RPCs halten sie schon, `spieler_probe_setzen` und
-- `verein_spieler_zuordnen`), dann Team, dann die `spieler`-Zeile. Jeder Weg,
-- der eine Zuordnung oder ein probe_seit dazubringt, hält dieselbe Zeile; die
-- Prüfungen danach sehen ihn ganz oder gar nicht.
create or replace function team_spieler_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r team_spieler := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' and (new.team_id, new.spieler_id, new.verein_id)
                          is distinct from (old.team_id, old.spieler_id, old.verein_id) then
    raise exception 'ZUORDNUNG_UNVERAENDERLICH';
  end if;
  if not exists (select 1 from teams where id = r.team_id) then return r; end if;
  if tg_op = 'DELETE' and not exists (select 1 from spieler where id = r.spieler_id) then return r; end if;
  if tg_op = 'UPDATE' and new.probe_seit is null then return new; end if;
  if tg_op <> 'DELETE' and r.probe_seit is not null then perform sperre_verein(r.verein_id); end if;
  perform sperre_teams(array[r.team_id]);
  perform 1 from spieler where id = r.spieler_id for update;
  if tg_op = 'UPDATE' then
    if exists (select 1 from team_spieler where spieler_id = new.spieler_id and team_id <> new.team_id) then
      raise exception 'SCHNUPPERN_MEHRERE_TEAMS';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from team_spieler where team_id = new.team_id and spieler_id = new.spieler_id) then
      raise exception 'SCHON_ZUGEORDNET';
    end if;
    if exists (select 1 from team_spieler where spieler_id = new.spieler_id and team_id <> new.team_id
                                            and probe_seit is not null) then
      raise exception 'SPIELER_SCHNUPPERT';
    end if;
    if new.probe_seit is not null
       and exists (select 1 from team_spieler where spieler_id = new.spieler_id and team_id <> new.team_id) then
      raise exception 'SCHNUPPERN_MEHRERE_TEAMS';
    end if;
    if exists (select 1 from team_spieler ts
                 join spieler a on a.id = ts.spieler_id
                 join spieler n on n.id = new.spieler_id
                where ts.team_id = new.team_id and a.id <> n.id
                  and spieler_text_schluessel(a.vorname) = spieler_text_schluessel(n.vorname)
                  and spieler_text_schluessel(a.nachname) = spieler_text_schluessel(n.nachname)
                  and a.jahrgang = n.jahrgang) then
      raise exception 'SPIELER_DOPPELT';
    end if;
    if (select count(*) from team_spieler where team_id = new.team_id) >= 100 then
      raise exception 'SPIELERLISTE_VOLL';
    end if;
  end if;
  perform termine_einfrieren(r.team_id);
  return r;
end;
$$;

-- ── Trigger ─────────────────────────────────────────────────────────────────

-- Neu auch bei UPDATE OF probe_seit (Einschalten, AK 5) und bei UPDATE der
-- Schlüsselspalten (abgewiesen).
drop trigger team_spieler_vorher on team_spieler;
create trigger team_spieler_vorher before insert or update of probe_seit, team_id, spieler_id, verein_id or delete on team_spieler
  for each row execute function team_spieler_vorher();

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function team_probe_zaehler(uuid, uuid) from public, anon, authenticated;

revoke all on function spieler_probe_folgen(uuid, uuid) from public, anon;
grant execute on function spieler_probe_folgen(uuid, uuid) to authenticated;
revoke all on function spieler_probe_setzen(uuid, uuid, boolean, integer) from public, anon;
grant execute on function spieler_probe_setzen(uuid, uuid, boolean, integer) to authenticated;
revoke all on function verein_spieler_zuordnen(uuid, uuid[], boolean) from public, anon;
grant execute on function verein_spieler_zuordnen(uuid, uuid[], boolean) to authenticated;

-- A2.9: Den Schnupper-Stand und das «erste Team» liest kein API-Client mehr
-- aus der spieler-Zeile (Schnuppern liegt auf der Zuordnung, AP §3.2; das
-- Team kommt aus team_spieler). Rückbau wäre ein einzelner grant.
revoke select (probe_seit) on spieler from authenticated;
revoke select (team_id) on spieler from authenticated;

reset lock_timeout;
