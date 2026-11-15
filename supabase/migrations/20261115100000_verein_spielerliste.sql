-- ============================================================================
-- Vereine, Story 4 (#580): Spieler:innen des Vereins überblicken
-- (Architekturplan Vereine §4.1, §4.3 «verein_spielerliste»; Plan Phase 4).
--
-- Nur diese eine Funktion samt Rechten; keine Tabelle, keine Spalte, kein
-- Index, kein Constraint, keine Datenänderung. Die Signatur wächst um Suche
-- und Eingrenzung, darum drop + create statt create or replace.
--
-- - Zugang (AK 2, PC 1, PC 3): jedes Vereinsmitglied (Team oder Verwaltung),
--   sonst VEREIN_NICHT_GEFUNDEN; KI-Zugang wie bisher NUR_IN_DER_ANWENDUNG.
-- - Form je Rolle (AK 3): Mitglieder ohne Verwaltung bekommen je Spieler:in
--   nur id, Vorname, Nachname, Jahrgang und Teams und am Kopf die Teams ohne
--   `anzahl`. Die Verwaltung bekommt alles wie in
--   20261114230000_schnuppertraining.sql (js, link_bezogen, schnuppern,
--   anzahl je Team); ein Aufruf nur mit p_verein liefert ihr dieselben
--   `spieler` und `teams` wie bisher.
-- - Suche (AK 6): p_suche wird wie die Namen bereinigt
--   (spieler_text_bereinigt: NFC, Leerzeichenfolgen zu einem, Rand weg); leer
--   oder null heisst keine Suche. Treffer ist, wer die Eingabe als Teilstring
--   in «Vorname Nachname» enthält, beides durch lower(unaccent(…)), also
--   ohne Rücksicht auf Gross/Klein und Akzente. strpos statt like: `%`, `_`
--   und `\` sind gewöhnliche Zeichen. Keine Umschreibung wie «ue» für «ü»
--   (OoS 4).
-- - Eingrenzung (AK 7–9): p_teams ODER p_ohne_team bilden eine Bedingung,
--   p_jahrgaenge eine zweite, Suche und beide gelten zusammen. null-Elemente
--   fallen zuerst aus den Listen; null, eine danach leere Liste und
--   p_ohne_team = false grenzen nicht ein. Team-IDs ausserhalb des
--   Vereins treffen still nie (die Zuordnung trägt den Verein der
--   Spieler:in, FK tsp_spieler); kein Marker verrät einen anderen Verein.
--   Jede Zeile nennt weiter alle Teams der Spieler:in.
-- - Rolle (`verwaltung`): ob die aufrufende Person der Verwaltung dieses
--   Vereins angehört — sie erfährt damit nur ihre eigene Rolle. Die Form der
--   Zeilen und Teams folgt genau diesem Wert; der Kern entscheidet an ihm,
--   nicht an vorhandenen Schlüsseln (auch bei 0 Treffern und 0 Teams).
-- - Kopf ungefiltert (AK 11): alle Teams des Vereins, die vorkommenden
--   Jahrgänge, `gesamt` und `ohne_team`. Für Mitglieder kein neuer Einblick
--   (sie sehen alle Zeilen); die Zahlen tragen den Kopf der Seite und
--   unterscheiden «Verein leer» von «keine Treffer».
-- - Reihenfolge wie bisher: Vorname, Nachname, Jahrgang, id (AK 1).
-- - search_path mit `extensions`: unaccent liegt lokal und auf Staging in
--   `public`, auf Supabase-Prod in `extensions` (so lösen es die Such-Trigger
--   seit 20260608120000_search_text_contains.sql).
--
-- Rückgabe (jsonb, eine Zeile; max_rows kappt nichts):
--   {spieler: [{id, vorname, nachname, jahrgang, teams: [{id, name}]
--               (nur Verwaltung:) js, link_bezogen,
--               schnuppern: {team_id, anzahl, besucht} | null}],
--    teams: [{id, name (nur Verwaltung:) anzahl}],
--    jahrgaenge: [int], gesamt: int, ohne_team: int, verwaltung: boolean}
-- ============================================================================

drop function verein_spielerliste(uuid);

create function verein_spielerliste(p_verein uuid, p_suche text default null, p_teams uuid[] default null,
                                    p_ohne_team boolean default false, p_jahrgaenge integer[] default null)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_verwaltung boolean;
  v_suche text;
  v_teams uuid[];
  v_ohne boolean := coalesce(p_ohne_team, false);
  v_jahrgaenge integer[];
begin
  perform nur_in_der_anwendung();
  if not ist_verein_mitglied(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  v_verwaltung := ist_verein_verwaltung(p_verein);
  v_suche := nullif(lower(unaccent(spieler_text_bereinigt(p_suche))), '');
  v_teams := nullif(array_remove(p_teams, null), '{}');
  v_jahrgaenge := nullif(array_remove(p_jahrgaenge, null), '{}');

  return (
    with treffer as (
      select s.*
        from spieler s
       where s.verein_id = p_verein
         and (v_suche is null or strpos(lower(unaccent(s.vorname || ' ' || s.nachname)), v_suche) > 0)
         and ((v_teams is null and not v_ohne)
              or (v_teams is not null
                  and exists (select 1 from team_spieler ts where ts.spieler_id = s.id and ts.team_id = any(v_teams)))
              or (v_ohne and not exists (select 1 from team_spieler ts where ts.spieler_id = s.id)))
         and (v_jahrgaenge is null or s.jahrgang = any(v_jahrgaenge))
    )
    select jsonb_build_object(
      'spieler', (select coalesce(jsonb_agg(
                    jsonb_build_object(
                      'id', s.id, 'vorname', s.vorname, 'nachname', s.nachname, 'jahrgang', s.jahrgang,
                      'teams', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)
                                                          order by t.name, t.id), '[]'::jsonb)
                                  from team_spieler ts join teams t on t.id = ts.team_id
                                 where ts.spieler_id = s.id))
                    || case when v_verwaltung then jsonb_build_object(
                         'js', s.js_nummer, 'link_bezogen', s.link_bezogen,
                         'schnuppern', (select jsonb_build_object('team_id', ts.team_id) || team_probe_zaehler(ts.team_id, s.id)
                                          from team_spieler ts
                                         where ts.spieler_id = s.id and ts.probe_seit is not null
                                         order by ts.created_at, ts.team_id limit 1))
                       else '{}'::jsonb end
                    order by s.vorname, s.nachname, s.jahrgang, s.id), '[]'::jsonb)
                    from treffer s),
      'teams', (select coalesce(jsonb_agg(
                  jsonb_build_object('id', t.id, 'name', t.name)
                  || case when v_verwaltung
                          then jsonb_build_object('anzahl', (select count(*) from team_spieler ts where ts.team_id = t.id))
                          else '{}'::jsonb end
                  order by t.name, t.id), '[]'::jsonb)
                  from teams t where t.verein_id = p_verein),
      'jahrgaenge', (select coalesce(jsonb_agg(j.jahrgang order by j.jahrgang), '[]'::jsonb)
                       from (select distinct s.jahrgang from spieler s where s.verein_id = p_verein) j),
      'gesamt', (select count(*) from spieler s where s.verein_id = p_verein),
      'ohne_team', (select count(*) from spieler s
                     where s.verein_id = p_verein
                       and not exists (select 1 from team_spieler ts where ts.spieler_id = s.id)),
      'verwaltung', v_verwaltung));
end;
$$;

revoke all on function verein_spielerliste(uuid, text, uuid[], boolean, integer[]) from public, anon;
grant execute on function verein_spielerliste(uuid, text, uuid[], boolean, integer[]) to authenticated;
