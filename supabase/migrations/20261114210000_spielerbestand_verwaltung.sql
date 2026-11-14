-- Vereinsverwaltung führt den Spielerbestand (Story 6 #582, Epic #575;
-- Architekturplan Vereine §4.1, §4.3 «Spielerbestand am Verein-Ort», §5.5).
--
-- Die Verwaltung erfasst Spieler:innen ohne Team, ändert sie (samt J+S),
-- ruft den privaten Link ab, erneuert ihn und löscht Spieler:innen aus dem
-- Verein, alles ohne Mitgliedschaft in einem Team. `verein_spieler_entfernen`
-- ist der einzige Weg, eine `spieler`-Zeile zu löschen; die Folgen tragen die
-- bestehenden FKs und Trigger (begonnene Termine hält `spieler_vorher` vorher
-- fest, an vergangenen Terminen bleibt die Spieler:in ohne Namen).
--
-- Doppelerfassung wie am Team-Ort: zuerst `spieler_doppelt` (Status
-- `doppelt` mit den Teamnamen und `ohne_team`), erst danach die Grenze 1000
-- aus dem Trigger. Ändern prüft nur, wenn sich der Schlüssel ändert.
--
-- `verein_spielerliste` liefert zusätzlich J+S und den Link-Stand, nie den
-- Link; `verein_ansicht` der Verwaltung die Zahl aller Spieler:innen des
-- Vereins und die Zahl ohne Team. `verein_spieler_zuordnen` prüft Recht und
-- Team jetzt auch unter der Vereinssperre (verwaltung_team_sperren).
--
-- Rollen nach Ort (AP §4): jede `verein_*` beginnt mit
-- `nur_in_der_anwendung()`. RPCs mit `p_spieler` antworten bei fehlendem
-- Recht, unbekannter, fremder oder inzwischen gelöschter Spieler:in mit
-- `SPIELER_NICHT_GEFUNDEN` (ununterscheidbar, AK 15); RPCs mit `p_verein`
-- bleiben bei `VEREIN_NICHT_GEFUNDEN`. Sperrordnung Verein → Suche → Person →
-- Teams → `spieler`-Zeile → Termin-Zeile.

set lock_timeout = '5s';

-- ── Funktionen: Helfer ──────────────────────────────────────────────────────

-- Verwaltungsrecht für Spieler-adressierte verein_*-RPCs: Das Recht folgt
-- dem Verein der Spieler:in; prüfen, Vereinssperre nehmen, unter ihr Recht
-- und Bestehen erneut prüfen (gelöscht wird nur unter ihr). Liefert den
-- Verein. Kein API-Recht.
create function verwaltung_spieler_sperren(p_spieler uuid) returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_verein uuid := (select verein_id from spieler where id = p_spieler);
begin
  if not ist_verein_verwaltung(v_verein) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  perform sperre_verein(v_verein);
  if not ist_verein_verwaltung(v_verein)
     or not exists (select 1 from spieler where id = p_spieler and verein_id = v_verein) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  return v_verein;
end;
$$;

-- ── Funktionen: Verein-Ort, Ansichten ───────────────────────────────────────

-- Rumpf wie in 20261114110000_vereine_bestand.sql; je Spieler:in dazu J+S
-- und ob der Link bezogen ist (AK 1, 8), nie der Link selbst.
--   {spieler: [{id, vorname, nachname, jahrgang, js, link_bezogen, teams: [{id, name}]}],
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

-- Rumpf wie in 20261114200000_vereine_verwaltung.sql; für die Verwaltung
-- dazu auf oberster Ebene die Zahl aller Spieler:innen des Vereins (wie die
-- Grenze 1000) und die Zahl ohne Team (Story 6, Zettel A1.2).
--   {name, verwaltung: [{anzeige_name, ich, (user_id, email)}],
--    teams: [{id, name, ist_mitglied, (trainer, spieler_zahl, ohne_mitglied)}],
--    (spieler_zahl, spieler_ohne_team)}
create or replace function verein_ansicht(p_verein uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verwaltung boolean;
begin
  perform nur_in_der_anwendung();
  if not ist_verein_mitglied(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  v_verwaltung := ist_verein_verwaltung(p_verein);
  return jsonb_build_object(
    'name', (select name from vereine where id = p_verein),
    'verwaltung', (select coalesce(jsonb_agg(
                      jsonb_build_object('anzeige_name', p.display_name, 'ich', w.user_id = v_uid)
                      || case when v_verwaltung then jsonb_build_object('user_id', w.user_id, 'email', u.email)
                              else '{}'::jsonb end
                      order by p.display_name nulls last, w.user_id), '[]'::jsonb)
                     from verein_verwaltung w
                     join auth.users u on u.id = w.user_id
                     left join profiles p on p.user_id = w.user_id
                    where w.verein_id = p_verein),
    'teams', (select coalesce(jsonb_agg(
                 jsonb_build_object('id', t.id, 'name', t.name,
                                    'ist_mitglied', exists (select 1 from team_members m
                                                             where m.team_id = t.id and m.user_id = v_uid))
                 || case when v_verwaltung then jsonb_build_object(
                      'trainer', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'user_id', m.user_id, 'anzeige_name', anzeige_name(m.user_id), 'email', u.email,
                                     'ist_verwaltung', exists (select 1 from verein_verwaltung w
                                                                where w.verein_id = p_verein and w.user_id = m.user_id))
                                     order by m.created_at, m.user_id), '[]'::jsonb)
                                    from team_members m join auth.users u on u.id = m.user_id
                                   where m.team_id = t.id),
                      'spieler_zahl', (select count(*) from team_spieler ts where ts.team_id = t.id),
                      'ohne_mitglied', not exists (select 1 from team_members m where m.team_id = t.id))
                    else '{}'::jsonb end
                 order by t.name, t.id), '[]'::jsonb)
                from teams t where t.verein_id = p_verein))
    || case when v_verwaltung then jsonb_build_object(
         'spieler_zahl', (select count(*) from spieler s where s.verein_id = p_verein),
         'spieler_ohne_team', (select count(*) from spieler s
                                where s.verein_id = p_verein
                                  and not exists (select 1 from team_spieler ts where ts.spieler_id = s.id)))
       else '{}'::jsonb end;
end;
$$;

-- Teams einer Spieler:in für die Bestätigungen (AK 10, 13), nach Name.
-- Liest team_spieler direkt (zeigt nur an).
--   {teams: [{id, name}]}
create function verein_spieler_teams(p_spieler uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform nur_in_der_anwendung();
  if not ist_verein_verwaltung((select verein_id from spieler where id = p_spieler)) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  return jsonb_build_object('teams', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)
                                                                order by t.name, t.id), '[]'::jsonb)
                                        from team_spieler ts join teams t on t.id = ts.team_id
                                       where ts.spieler_id = p_spieler));
end;
$$;

-- Privater Link für die Verwaltung, auch ohne Team (AK 9, 10). Einer der
-- zwei Wege, auf denen link_token die Datenbank verlässt.
--   {link_token, ohne_team, bezogen}
create function verein_spieler_link_holen(p_spieler uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  s spieler;
begin
  perform nur_in_der_anwendung();
  select * into s from spieler where id = p_spieler;
  if not found or not ist_verein_verwaltung(s.verein_id) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  return jsonb_build_object('link_token', s.link_token,
                            'ohne_team', not exists (select 1 from team_spieler ts where ts.spieler_id = s.id),
                            'bezogen', s.link_bezogen);
end;
$$;

-- ── Funktionen: Verein-Ort, Spielerbestand ──────────────────────────────────

-- Spieler:in ohne Team erfassen (AK 3, 4, 6, 7). Unter der Vereinssperre
-- zuerst `spieler_doppelt`: Eine Abweisung ist ein Status und hinterlässt
-- nichts; danach die Grenze 1000 aus spieler_vorher (VEREIN_VOLL).
-- Ungültige Angaben scheitern an den Constraints wie am Team-Ort.
--   {status: 'angelegt', id}
--   | {status: 'abgewiesen', grund: 'doppelt', teams: [Name], ohne_team}
create function verein_spieler_anlegen(p_verein uuid, p_vorname text, p_nachname text, p_jahrgang integer, p_js text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_doppelt jsonb;
begin
  perform nur_in_der_anwendung();
  perform verwaltung_sperren(p_verein);
  v_doppelt := spieler_doppelt(p_verein, p_vorname, p_nachname, p_jahrgang);
  if v_doppelt is not null then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'doppelt',
                              'teams', v_doppelt -> 'teams', 'ohne_team', v_doppelt -> 'ohne_team');
  end if;
  insert into spieler (verein_id, vorname, nachname, jahrgang, js_nummer)
    values (p_verein, spieler_text_bereinigt(p_vorname), spieler_text_bereinigt(p_nachname), p_jahrgang,
            nullif(btrim(coalesce(p_js, '')), ''))
    returning id into v_id;
  return jsonb_build_object('status', 'angelegt', 'id', v_id);
end;
$$;

-- Ändern ohne Mitgliedschaft, samt J+S (AK 2, 5; `null` leert J+S). Ein
-- Name wirkt überall, auch an vergangenen Terminen. Sperren Verein →
-- `spieler`-Zeile. Nur wenn sich der Schlüssel ändert, prüft
-- `spieler_doppelt` gegen alle anderen im Verein; gleicher Schlüssel geht
-- immer, auch bei Altdubletten.
--   {status: 'geaendert'}
--   | {status: 'abgewiesen', grund: 'doppelt', teams: [Name], ohne_team}
create function verein_spieler_aendern(p_spieler uuid, p_vorname text, p_nachname text, p_jahrgang integer, p_js text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_verein uuid;
  v_alt spieler%rowtype;
  v_doppelt jsonb;
begin
  perform nur_in_der_anwendung();
  v_verein := verwaltung_spieler_sperren(p_spieler);
  select * into v_alt from spieler where id = p_spieler for update;
  if not found then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  if spieler_text_schluessel(p_vorname) is distinct from spieler_text_schluessel(v_alt.vorname)
     or spieler_text_schluessel(p_nachname) is distinct from spieler_text_schluessel(v_alt.nachname)
     or p_jahrgang is distinct from v_alt.jahrgang then
    v_doppelt := spieler_doppelt(v_verein, p_vorname, p_nachname, p_jahrgang, p_spieler);
    if v_doppelt is not null then
      return jsonb_build_object('status', 'abgewiesen', 'grund', 'doppelt',
                                'teams', v_doppelt -> 'teams', 'ohne_team', v_doppelt -> 'ohne_team');
    end if;
  end if;
  update spieler set vorname = spieler_text_bereinigt(p_vorname), nachname = spieler_text_bereinigt(p_nachname),
                     jahrgang = p_jahrgang, js_nummer = nullif(btrim(coalesce(p_js, '')), '')
   where id = p_spieler;
  return jsonb_build_object('status', 'geaendert');
end;
$$;

-- Link erneuern, auch ohne Team (AK 11): Der bisherige Link endet sofort,
-- link_bezogen fällt zurück, das Kalender-Abo endet über den Trigger
-- spieler_link_erneuert; Abmeldungen und Meldungen hängen an der
-- Spieler:in und bleiben. Sperren Verein → `spieler`-Zeile (das Update).
--   {link_token}
create function verein_spieler_link_erneuern(p_spieler uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  perform nur_in_der_anwendung();
  perform verwaltung_spieler_sperren(p_spieler);
  -- Das Geheimnis erst nach den Prüfungen erzeugen.
  v_token := neues_geheimnis();
  update spieler set link_token = v_token, link_bezogen = false where id = p_spieler;
  return jsonb_build_object('link_token', v_token);
end;
$$;

-- Aus dem Verein löschen, mit oder ohne Team (AK 12, 13; #579 AK 12, PC 10,
-- 11). Einziger Weg, eine `spieler`-Zeile zu löschen. Sperren vor dem
-- DELETE (AP §4.1): Verein, dann alle Teams der Spieler:in aufsteigend (unter
-- der Vereinssperre kann ihre Menge nur noch schrumpfen: Zuordnen und
-- Aufnehmen halten sie), dann die Zeile. Die Trigger nehmen dieselben
-- Sperren erneut (spieler_vorher hält begonnene Termine fest). Kein
-- Stand-Abgleich (Out of Scope 1). Liefert die Teams vor dem Löschen.
--   {status: 'geloescht', teams: [{id, name}]}
create function verein_spieler_entfernen(p_spieler uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_teams jsonb;
begin
  perform nur_in_der_anwendung();
  perform verwaltung_spieler_sperren(p_spieler);
  perform sperre_teams(array(select team_id from team_spieler where spieler_id = p_spieler));
  perform 1 from spieler where id = p_spieler for update;
  v_teams := (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name, t.id), '[]'::jsonb)
                from team_spieler ts join teams t on t.id = ts.team_id
               where ts.spieler_id = p_spieler);
  delete from spieler where id = p_spieler;
  return jsonb_build_object('status', 'geloescht', 'teams', v_teams);
end;
$$;

-- Rumpf wie in 20261114110000_vereine_bestand.sql; Recht und Team jetzt über
-- verwaltung_team_sperren, also auch unter der Vereinssperre: Löst die
-- Verwaltung das Team dazwischen auf, antwortet das mit
-- VEREIN_NICHT_GEFUNDEN statt mit einem rohen Fehler. Signatur und Rückgabe
-- unverändert.
create or replace function verein_spieler_zuordnen(p_team uuid, p_spieler uuid[]) returns jsonb
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
  v_verein := verwaltung_team_sperren(p_team);
  if p_spieler is null or cardinality(p_spieler) = 0 or array_position(p_spieler, null) is not null then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  v_ids := array(select distinct x from unnest(p_spieler) x order by x);
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

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function verwaltung_spieler_sperren(uuid) from public, anon, authenticated;

revoke all on function verein_spieler_teams(uuid) from public, anon;
grant execute on function verein_spieler_teams(uuid) to authenticated;
revoke all on function verein_spieler_link_holen(uuid) from public, anon;
grant execute on function verein_spieler_link_holen(uuid) to authenticated;
revoke all on function verein_spieler_anlegen(uuid, text, text, integer, text) from public, anon;
grant execute on function verein_spieler_anlegen(uuid, text, text, integer, text) to authenticated;
revoke all on function verein_spieler_aendern(uuid, text, text, integer, text) from public, anon;
grant execute on function verein_spieler_aendern(uuid, text, text, integer, text) to authenticated;
revoke all on function verein_spieler_link_erneuern(uuid) from public, anon;
grant execute on function verein_spieler_link_erneuern(uuid) to authenticated;
revoke all on function verein_spieler_entfernen(uuid) from public, anon;
grant execute on function verein_spieler_entfernen(uuid) to authenticated;

reset lock_timeout;
