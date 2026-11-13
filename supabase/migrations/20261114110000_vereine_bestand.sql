-- Zuordnen und Herausnehmen (Story 3 #579, Epic #575; Architekturplan
-- Vereine §3.3 d–e, §3.7, §4.1–§4.4).
--
-- Die Vereinsverwaltung ordnet Spieler:innen des Vereins einem Team zu,
-- einzeln oder gesammelt, ganz oder gar nicht (`verein_spieler_zuordnen`).
-- Mitglieder nehmen eine Spieler:in aus ihrem Team, ohne sie zu löschen
-- (`spieler_aus_team_nehmen`, mit `p_stand` aus `spieler_teams`); das Löschen
-- am Team-Ort entfällt (`spieler_entfernen`). Die weiteren Teams einer
-- Spieler:in liefert `spieler_weitere_teams`, den Spielerbestand des Vereins
-- für die Verwaltung die Grundfassung von `verein_spielerliste` (Phase 4
-- ersetzt sie).
--
-- `sp_select` gilt nur noch für Mitglieder zugeordneter Teams (PC 7);
-- `termin_teilnehmer` und `spiel_teilnehmer` werden darum DEFINER mit der
-- Mitgliedschaft im Termin-Team als erster Bedingung und nennen Herausgenommene
-- (`nicht_mehr_im_team`) weiter mit Namen (PC 5).
--
-- Die Schreibwege schreiben `spieler.team_id` nicht mehr selbst; das pflegt
-- `team_spieler_nachher` (20261114100000_zuordnung_invarianten.sql, Entscheid
-- A.1). Die Leser der Spalte (Link, Abo, Schnuppern, Feedback) bleiben bis
-- Phase 7/8 unverändert.
--
-- Rollen nach Ort (AP §4): Team-RPCs prüfen `ist_team_mitglied(p_team)`,
-- `verein_*` beginnt mit `nur_in_der_anwendung()` und prüft
-- `ist_verein_verwaltung`. Sperrordnung Verein → Teams → `spieler`-Zeile →
-- Termin-Zeile.

set lock_timeout = '5s';

-- ── Funktionen: Helfer ──────────────────────────────────────────────────────

-- Teams der aufrufenden Person (Policy sp_select, als InitPlan).
create function meine_team_ids() returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$ select team_id from team_members where user_id = auth.uid(); $$;

-- Stand der Teammenge einer Spieler:in für die Rückfrage beim Herausnehmen:
-- ein Hash über die sortierten Team-IDs, damit keine fremden IDs nach aussen
-- gehen (AP §4.3, Story 13 AK 6). Kein API-Recht.
create function spieler_teams_stand(p_spieler uuid) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select md5(coalesce(string_agg(team_id::text, ',' order by team_id), ''))
    from team_spieler where spieler_id = p_spieler;
$$;

-- Alle Teams einer Spieler:in nach Namen, `eigen` = die aufrufende Person ist
-- Mitglied, `dieses` = das Kontextteam (gleichnamige Teams lassen sich nicht
-- über den Namen unterscheiden, IDs gehen nicht nach aussen). Liest
-- team_members direkt (zeigt nur an, Ortsprüfung AP §5.5). Kein API-Recht.
create function spieler_teams_auskunft(p_spieler uuid, p_team uuid) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', t.name,
           'eigen', exists (select 1 from team_members m where m.team_id = t.id and m.user_id = auth.uid()),
           'dieses', t.id = p_team)
           order by t.name, t.id), '[]'::jsonb)
    from team_spieler ts join teams t on t.id = ts.team_id
   where ts.spieler_id = p_spieler;
$$;

-- ── Funktionen: Schreibwege ohne spieler.team_id ────────────────────────────

-- Rumpf wie in 20261113200000_spieler_eindeutig_verein.sql; `team_id` pflegt
-- jetzt team_spieler_nachher (A.1).
create or replace function spieler_aufnehmen(p_team uuid, p_vorname text, p_nachname text, p_jahrgang integer, p_js text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_verein uuid;
  v_doppelt jsonb;
  v_ersetzt int := 0;
  v_js text := nullif(btrim(coalesce(p_js, '')), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  select verein_id into v_verein from teams where id = p_team;
  perform sperre_verein(v_verein);
  perform sperre_teams(array[p_team]);
  v_doppelt := spieler_doppelt(v_verein, p_vorname, p_nachname, p_jahrgang);
  if v_doppelt is not null then return spieler_doppelt_status(v_doppelt, p_team); end if;
  v_ersetzt := spielerzahl_freigeben(p_team);
  insert into spieler (verein_id, vorname, nachname, jahrgang, js_nummer)
    values (v_verein, spieler_text_bereinigt(p_vorname), spieler_text_bereinigt(p_nachname), p_jahrgang, v_js)
    returning id into v_id;
  insert into team_spieler (team_id, spieler_id, verein_id) values (p_team, v_id, v_verein);
  return jsonb_build_object('id', v_id, 'ersetzt', v_ersetzt);
end;
$$;

-- Rumpf wie in 20261113110000_spieler_ueber_zuordnung.sql; `team_id` pflegt
-- jetzt team_spieler_nachher (A.1). Gilt bis Story 9.
create or replace function spieler_importieren(p_team uuid, p_zeilen jsonb, p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_verein uuid;
  v_zeilen jsonb;
  v_bestand int;
  v_neu jsonb;
  v_js jsonb;
  v_ersetzt int := 0;
  v_ids uuid[];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if jsonb_typeof(p_zeilen) <> 'array' or jsonb_array_length(p_zeilen) > 1000 then
    raise exception 'SPIELERLISTE_VOLL';
  end if;
  select verein_id into v_verein from teams where id = p_team;
  if p_erwartet is not null then
    perform sperre_verein(v_verein);
    perform sperre_teams(array[p_team]);
  end if;

  -- Jede Zeile einmal je Spieler:in (die letzte), mit der bestehenden, die
  -- sie meint.
  with roh as (
    select (z->>'zeile')::int as zeile,
           spieler_text_bereinigt(z->>'vorname') as vorname,
           spieler_text_bereinigt(z->>'nachname') as nachname,
           (z->>'jahrgang')::int as jahrgang,
           nullif(btrim(coalesce(z->>'js', '')), '') as js
      from jsonb_array_elements(p_zeilen) z
  ), letzte as (
    select distinct on (spieler_text_schluessel(vorname), spieler_text_schluessel(nachname), jahrgang) *
      from roh
     order by spieler_text_schluessel(vorname), spieler_text_schluessel(nachname), jahrgang, zeile desc
  ), im_team as (
    select s.* from spieler s join team_spieler ts on ts.spieler_id = s.id and ts.team_id = p_team
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'zeile', l.zeile, 'vorname', l.vorname, 'nachname', l.nachname, 'jahrgang', l.jahrgang,
           'js', l.js, 'id', s.id, 'alt', s.js_nummer) order by l.zeile), '[]'::jsonb)
    into v_zeilen
    from letzte l
    left join im_team s on spieler_text_schluessel(s.vorname) = spieler_text_schluessel(l.vorname)
                       and spieler_text_schluessel(s.nachname) = spieler_text_schluessel(l.nachname)
                       and s.jahrgang = l.jahrgang;

  select count(*) into v_bestand from team_spieler where team_id = p_team;
  select coalesce(jsonb_agg((z->>'zeile')::int order by (z->>'zeile')::int), '[]'::jsonb) into v_neu
    from jsonb_array_elements(v_zeilen) z where z->>'id' is null;
  select coalesce(jsonb_agg(jsonb_build_object('zeile', (z->>'zeile')::int, 'alt', z->'alt') order by (z->>'zeile')::int), '[]'::jsonb)
    into v_js
    from jsonb_array_elements(v_zeilen) z
   where z->>'id' is not null and z->>'js' is not null and z->>'js' is distinct from z->>'alt';

  if p_erwartet is null then
    return jsonb_build_object(
      'neu', v_neu,
      'js', v_js,
      'gleich', (select coalesce(jsonb_agg((z->>'zeile')::int order by (z->>'zeile')::int), '[]'::jsonb)
                   from jsonb_array_elements(v_zeilen) z
                  where z->>'id' is not null and (z->>'js' is null or z->>'js' = z->>'alt')),
      'bestand', v_bestand);
  end if;

  if v_neu <> coalesce(p_erwartet->'neu', '[]'::jsonb)
     or (select coalesce(jsonb_agg(j->'zeile' order by (j->>'zeile')::int), '[]'::jsonb) from jsonb_array_elements(v_js) j)
        <> coalesce(p_erwartet->'js', '[]'::jsonb) then
    raise exception 'SPIELERLISTE_GEAENDERT';
  end if;
  if jsonb_array_length(v_neu) > 0 and v_bestand + jsonb_array_length(v_neu) > 100 then
    raise exception 'SPIELERLISTE_VOLL';
  end if;

  if jsonb_array_length(v_neu) > 0 then
    v_ersetzt := spielerzahl_freigeben(p_team);
  end if;

  with neu as (
    insert into spieler (verein_id, vorname, nachname, jahrgang, js_nummer)
    select v_verein, z->>'vorname', z->>'nachname', (z->>'jahrgang')::int, z->>'js'
      from jsonb_array_elements(v_zeilen) z
     where z->>'id' is null
     order by (z->>'zeile')::int
    returning id)
  select coalesce(array_agg(id), '{}') into v_ids from neu;
  insert into team_spieler (team_id, spieler_id, verein_id)
  select p_team, x, v_verein from unnest(v_ids) x;

  update spieler s set js_nummer = z->>'js'
    from jsonb_array_elements(v_zeilen) z
   where z->>'id' is not null and s.id = (z->>'id')::uuid
     and z->>'js' is not null and z->>'js' is distinct from z->>'alt';

  return jsonb_build_object('neu', jsonb_array_length(v_neu), 'js', jsonb_array_length(v_js), 'ersetzt', v_ersetzt);
end;
$$;

-- ── Funktionen: Verlegen eines Spiels ───────────────────────────────────────

-- Rumpf wie in 20261021230000_spiel_aufgebot.sql; beim Wieder-Öffnen nur
-- Zugeordnete des Termin-Teams (AP §4.4): Herausgenommene fallen weg wie
-- Ehemalige, statt das Verlegen am FK sm_zuordnung (23503) abzubrechen.
create or replace function spiel_zeitpunkt_nachher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_anderer_tag boolean := new.datum is distinct from old.datum;
begin
  if exists (select 1 from termin_eingefroren where termin_id = new.id) then
    -- Wieder offen: am selben Tag mit Meldungen und Kennzeichnungen derer,
    -- die noch dazugehören; an einem anderen Tag sind beide verfallen.
    insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am, verfallen,
                                 nicht_aufgeboten, aufgebot_verfallen)
      select new.id, p.spieler_id, new.team_id,
             case when v_anderer_tag then null else p.zustand end,
             case when v_anderer_tag then null else p.gewechselt_am end,
             v_anderer_tag and p.zustand is not null,
             p.nicht_aufgeboten and not v_anderer_tag,
             p.nicht_aufgeboten and v_anderer_tag
        from spiel_teilnahmen p
       where p.termin_id = new.id and p.spieler_id is not null
         and (p.zustand is not null or p.nicht_aufgeboten)
         and spieler_im_team(p.spieler_id, new.team_id)
         and termin_gilt_fuer(new.id, p.spieler_id);
    delete from termin_eingefroren where termin_id = new.id;
  elsif v_anderer_tag then
    -- Ein anderes Datum lässt Meldungen und Kennzeichnungen verfallen.
    update spiel_meldungen
       set zustand = null, gewechselt_am = null, nicht_aufgeboten = false,
           verfallen = verfallen or zustand is not null,
           aufgebot_verfallen = aufgebot_verfallen or nicht_aufgeboten
     where termin_id = new.id and (zustand is not null or nicht_aufgeboten);
  end if;
  return null;
end;
$$;

-- ── Funktionen: Teilnehmer am Termin ────────────────────────────────────────

-- Rumpf wie in 20261113110000_spieler_ueber_zuordnung.sql, neu DEFINER mit
-- der Mitgliedschaft im Termin-Team als erster Bedingung (sp_select sieht
-- Herausgenommene nicht mehr, AP §4.4). Herausgenommene behalten am
-- festgehaltenen Termin Namen und `spieler_id`, `nicht_mehr_im_team` = true;
-- `ehemalig` bleibt «Spieler:in gelöscht» (PC 5, PC 11).
drop function termin_teilnehmer(uuid);
create function termin_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, abgemeldet boolean, ehemalig boolean,
               kader text[], gewechselt_am timestamptz, nachgetragen boolean, probe boolean,
               nicht_mehr_im_team boolean)
language sql stable security definer
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
         x.probe,
         x.nicht_mehr_im_team
    from (
      select p.spieler_id, s.vorname, s.nachname, p.abgemeldet, p.spieler_id is null as ehemalig, true as fest,
             p.nachgetragen, coalesce(ts.probe_seit is not null, false) as probe,
             p.spieler_id is not null and ts.spieler_id is null as nicht_mehr_im_team
        from termin_teilnahmen p left join spieler s on s.id = p.spieler_id
        left join team_spieler ts on ts.spieler_id = p.spieler_id and ts.team_id = p.team_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname, m.abgemeldet, false, false, false, ts.probe_seit is not null, false
        from training_meldestand(p_termin) m join spieler s on s.id = m.spieler_id
        join training_termine tt on tt.id = p_termin
        join team_spieler ts on ts.spieler_id = m.spieler_id and ts.team_id = tt.team_id
       where not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x
    left join termin_statuswechsel w on w.termin_id = p_termin and w.spieler_id = x.spieler_id
   where ist_team_mitglied((select t.team_id from training_termine t where t.id = p_termin));
$$;

-- Rumpf wie in 20261113110000_spieler_ueber_zuordnung.sql, neu DEFINER wie
-- termin_teilnehmer, mit `nicht_mehr_im_team`.
drop function spiel_teilnehmer(uuid);
create function spiel_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, zustand text, verfallen boolean,
               ehemalig boolean, kader text[], gewechselt_am timestamptz,
               nicht_aufgeboten boolean, aufgebot_verfallen boolean, nachgetragen boolean,
               nicht_mehr_im_team boolean)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select x.spieler_id, x.vorname, x.nachname, x.zustand, x.verfallen, x.ehemalig,
         case when x.fest then '{}'::text[] else
         coalesce(array(select k.name from termin_kader tk join kader k on k.id = tk.kader_id
                          join kader_spieler ks on ks.kader_id = k.id
                         where tk.termin_id = p_termin and ks.spieler_id = x.spieler_id
                         order by k.name), '{}') end,
         x.gewechselt_am, x.nicht_aufgeboten, x.aufgebot_verfallen, x.nachgetragen, x.nicht_mehr_im_team
    from (
      select p.spieler_id, s.vorname, s.nachname, p.zustand, false as verfallen, p.spieler_id is null as ehemalig,
             true as fest, p.gewechselt_am, p.nicht_aufgeboten, false as aufgebot_verfallen, p.nachgetragen,
             p.spieler_id is not null and ts.spieler_id is null as nicht_mehr_im_team
        from spiel_teilnahmen p left join spieler s on s.id = p.spieler_id
        left join team_spieler ts on ts.spieler_id = p.spieler_id and ts.team_id = p.team_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname, m.zustand, coalesce(m.verfallen, false), false, false, m.gewechselt_am,
             coalesce(m.nicht_aufgeboten, false), coalesce(m.aufgebot_verfallen, false), false, false
        from training_termine t
        join team_spieler ts on ts.team_id = t.team_id
        join spieler s on s.id = ts.spieler_id
        left join spiel_meldungen m on m.termin_id = t.id and m.spieler_id = s.id
       where t.id = p_termin and t.art = 'spiel' and termin_gilt_fuer(p_termin, s.id)
         and not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x
   where ist_team_mitglied((select t.team_id from training_termine t where t.id = p_termin));
$$;

-- ── Funktionen: Team-Ort ────────────────────────────────────────────────────

-- Alle Teams einer Spieler:in des eigenen Teams, für die Bestätigung beim
-- Herausnehmen (Story 3 AK 13–16). {teams: [{name, eigen, dieses}], stand}
create function spieler_teams(p_team uuid, p_spieler uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) or not spieler_im_team(p_spieler, p_team) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  return jsonb_build_object('teams', spieler_teams_auskunft(p_spieler, p_team), 'stand', spieler_teams_stand(p_spieler));
end;
$$;

-- Eine Spieler:in aus dem eigenen Team nehmen; löscht nie (AK 10, 12). Erst
-- Teamsperre und `spieler`-Zeile, dann `p_stand` vergleichen: Ein
-- gleichzeitiges Zuordnen hält dieselbe Zeile und kommt ganz vor oder ganz
-- nach dem Vergleich (AP §3.3 d). Keine Vereinssperre, das Herausnehmen
-- verkleinert die Menge nur. Ohne oder mit abweichendem Stand ohne Änderung:
--   {status: 'stand_geaendert', teams: [{name, eigen, dieses}], stand}
-- sonst
--   {status: 'herausgenommen', ohne_team, letztes_eigenes_team}
-- Die Folgen (Meldungen, Kader, Statuswechsel künftiger Termine verfallen,
-- begonnene bleiben mit Namen) tragen Trigger und FK-Kaskade.
create function spieler_aus_team_nehmen(p_team uuid, p_spieler uuid, p_stand text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_stand text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) or not spieler_im_team(p_spieler, p_team) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  perform sperre_teams(array[p_team]);
  perform 1 from spieler where id = p_spieler for update;
  if not spieler_im_team(p_spieler, p_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  v_stand := spieler_teams_stand(p_spieler);
  if p_stand is null or p_stand <> v_stand then
    return jsonb_build_object('status', 'stand_geaendert',
                              'teams', spieler_teams_auskunft(p_spieler, p_team), 'stand', v_stand);
  end if;
  delete from team_spieler where team_id = p_team and spieler_id = p_spieler;
  return jsonb_build_object(
    'status', 'herausgenommen',
    'ohne_team', not exists (select 1 from team_spieler where spieler_id = p_spieler),
    'letztes_eigenes_team', not exists (select 1 from team_spieler ts
                                          join team_members m on m.team_id = ts.team_id and m.user_id = auth.uid()
                                         where ts.spieler_id = p_spieler));
end;
$$;

-- Je Spieler:in des Teams die Namen ihrer weiteren Teams (AK 9), nur wer
-- weitere hat. [{spieler_id, teams: [name]}]
create function spieler_weitere_teams(p_team uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('spieler_id', w.spieler_id, 'teams', w.teams)
                                    order by w.spieler_id), '[]'::jsonb)
            from (select ts.spieler_id, jsonb_agg(t.name order by t.name, t.id) as teams
                    from team_spieler ts
                    join team_spieler a on a.spieler_id = ts.spieler_id and a.team_id <> ts.team_id
                    join teams t on t.id = a.team_id
                   where ts.team_id = p_team
                   group by ts.spieler_id) w);
end;
$$;

-- ── Funktionen: Verein-Ort ──────────────────────────────────────────────────

-- Grundfassung für die Verwaltung (Phase 4 ersetzt sie durch die Fassung für
-- alle Vereinsmitglieder mit Suche). Alle Spieler:innen und alle Teams des
-- Vereins; `anzahl` zählt die Zuordnungen wie die Grenze 100.
--   {spieler: [{id, vorname, nachname, jahrgang, teams: [{id, name}]}],
--    teams: [{id, name, anzahl}]}
create function verein_spielerliste(p_verein uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform nur_in_der_anwendung();
  if not ist_verein_verwaltung(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  return jsonb_build_object(
    'spieler', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', s.id, 'vorname', s.vorname, 'nachname', s.nachname, 'jahrgang', s.jahrgang,
                  'teams', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)
                                                      order by t.name, t.id), '[]'::jsonb)
                              from team_spieler ts join teams t on t.id = ts.team_id
                             where ts.spieler_id = s.id))
                  order by s.vorname, s.nachname, s.jahrgang, s.id), '[]'::jsonb)
                  from spieler s where s.verein_id = p_verein),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', t.id, 'name', t.name,
                'anzahl', (select count(*) from team_spieler ts where ts.team_id = t.id))
                order by t.name, t.id), '[]'::jsonb)
                from teams t where t.verein_id = p_verein));
end;
$$;

-- Spieler:innen des Vereins einem Team des Vereins zuordnen, einzeln oder
-- gesammelt, ganz oder gar nicht (AK 2, 20, 21; AP §3.3 e). Nur die
-- Verwaltung des Vereins des Teams, ohne Mitgliedschaft. Sperren: Verein,
-- Team, die `spieler`-Zeilen nach UUID; erst danach prüfen. Befunde je
-- Spieler:in P = {id, vorname, nachname, jahrgang}:
--   bereits     dem Team schon zugeordnet
--   gleich      das Team oder die Auswahl führt eine andere Spieler:in mit
--               gleichem Schlüssel (Altdubletten, AK 4)
--   schnuppert  schnuppert in einem anderen Team (P + {team}; Entscheid A.4)
--   ueber_grenze = max(0, Bestand + Anzahl ohne Befund − 100): Gleiche Angaben
--               vor der Grenze (AK 7), gesammelt beides (AK 22)
-- Mit Befund ohne jede Änderung {status: 'abgewiesen', bereits, gleich,
-- schnuppert, ueber_grenze}, sonst {status: 'zugeordnet', anzahl, ersetzt}.
-- `ersetzt` = anstehende Termine ohne erwartete Spielerzahl, nur wenn das
-- Team vorher keine Spieler:innen hatte (AK 23, PC 13). Kein Kader (PC 1).
-- Die Trigger prüfen jede Zuordnung noch einmal (Netz für das Rennen, AK 8).
create function verein_spieler_zuordnen(p_team uuid, p_spieler uuid[]) returns jsonb
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
begin
  perform nur_in_der_anwendung();
  if not ist_verein_verwaltung((select verein_id from teams where id = p_team)) then
    raise exception 'VEREIN_NICHT_GEFUNDEN';
  end if;
  select verein_id into v_verein from teams where id = p_team;
  if p_spieler is null or cardinality(p_spieler) = 0 or array_position(p_spieler, null) is not null then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  v_ids := array(select distinct x from unnest(p_spieler) x order by x);
  perform sperre_verein(v_verein);
  perform sperre_teams(array[p_team]);
  perform 1 from spieler where id = any(v_ids) order by id for update;
  if (select count(*) from spieler where id = any(v_ids) and verein_id = v_verein) <> cardinality(v_ids) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
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
  insert into team_spieler (team_id, spieler_id, verein_id)
  select p_team, x, v_verein from unnest(v_ids) x order by x;
  return jsonb_build_object('status', 'zugeordnet', 'anzahl', cardinality(v_ids), 'ersetzt', v_ersetzt);
end;
$$;

-- Löschen am Team-Ort entfällt ohne Nachfolger (AP §4.4, Story 3 AK 12):
-- Mitglieder nehmen nur aus dem Team; aus dem Verein löscht ab Phase 6 die
-- Verwaltung (`verein_spieler_entfernen`). Bis dahin löscht niemand.
drop function spieler_entfernen(uuid);

-- vereine_nachziehen (20261113100000_vereine_fundament.sql) legt Zuordnungen
-- aus spieler.team_id an; mit A.1 ist das weiter das erste Team. Ihr
-- `on conflict do nothing` hilft gegen team_spieler_vorher nicht (BEFORE
-- INSERT läuft vor der Konfliktprüfung, SCHON_ZUGEORDNET): Sie läuft nur in
-- der Fundament-Migration (vor diesem Trigger) und auf Staging unter
-- `replica` (staging_nach_sync). Fällt mit N1.
comment on function vereine_nachziehen(uuid) is
  'Backfill FC Wyler (AP §6.3). Nur in der Fundament-Migration und unter session_replication_role = replica (staging_nach_sync); sonst weist team_spieler_vorher bestehende Zuordnungen mit SCHON_ZUGEORDNET ab. Fällt mit N1.';

-- ── Policies ────────────────────────────────────────────────────────────────

-- Nur für Mitglieder zugeordneter Teams (AP §3.7, §4.2; PC 7). Die
-- Verwaltung liest den Bestand nur über verein_*-RPCs; Spaltengrants bleiben.
drop policy sp_select on spieler;
create policy sp_select on spieler for select to authenticated using (
  exists (select 1 from team_spieler ts
           where ts.spieler_id = spieler.id and ts.team_id in (select meine_team_ids())));

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function spieler_teams_stand(uuid) from public, anon, authenticated;
revoke all on function spieler_teams_auskunft(uuid, uuid) from public, anon, authenticated;

revoke all on function meine_team_ids() from public, anon;
grant execute on function meine_team_ids() to authenticated;

revoke all on function termin_teilnehmer(uuid) from public, anon;
grant execute on function termin_teilnehmer(uuid) to authenticated;
revoke all on function spiel_teilnehmer(uuid) from public, anon;
grant execute on function spiel_teilnehmer(uuid) to authenticated;

revoke all on function spieler_teams(uuid, uuid) from public, anon;
grant execute on function spieler_teams(uuid, uuid) to authenticated;
revoke all on function spieler_aus_team_nehmen(uuid, uuid, text) from public, anon;
grant execute on function spieler_aus_team_nehmen(uuid, uuid, text) to authenticated;
revoke all on function spieler_weitere_teams(uuid) from public, anon;
grant execute on function spieler_weitere_teams(uuid) to authenticated;
revoke all on function verein_spielerliste(uuid) from public, anon;
grant execute on function verein_spielerliste(uuid) to authenticated;
revoke all on function verein_spieler_zuordnen(uuid, uuid[]) from public, anon;
grant execute on function verein_spieler_zuordnen(uuid, uuid[]) to authenticated;

reset lock_timeout;
