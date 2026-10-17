-- ============================================================================
-- Spielerliste aus einer CSV-Datei übernehmen (Story #455).
--
-- Die Oberfläche liest die Datei im Browser und schickt nur Vorname, Nachname,
-- Jahrgang und J+S-Nummer je Zeile (AK 28). Diese Funktion ordnet die Zeilen
-- nach derselben Schlüsselregel wie die Eindeutigkeit der Liste ein
-- (`spieler_text_schluessel`): neu, bestehend mit neuer J+S-Nummer, bestehend
-- unverändert. Mehrere Zeilen derselben Spieler:in gelten als eine, die
-- letzte gewinnt (AK 21, PO 6).
--
-- Ohne `p_erwartet` ist es die Vorschau und schreibt nichts. Mit `p_erwartet`
-- übernimmt sie unter der Sperre der Liste — aber nur, wenn die Einordnung
-- genau der bestätigten Vorschau entspricht (AK 27), sonst SPIELERLISTE_
-- GEAENDERT. Die Übernahme gilt ganz oder gar nicht (PC 4): ein Aufruf, eine
-- Transaktion. Wie bei `spieler_aufnehmen` ersetzt die erste Spieler:in die
-- erwarteten Zahlen; der Trigger `spieler_vorher` hält vor jedem Einfügen den
-- Stand begonnener Termine fest und prüft die Grenze von 200.
--
-- Forward-only: nur eine neue Funktion.
-- ============================================================================
set lock_timeout = '5s';

create function spieler_importieren(p_team uuid, p_zeilen jsonb, p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_zeilen jsonb;
  v_bestand int;
  v_neu jsonb;
  v_js jsonb;
  v_ersetzt int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if jsonb_typeof(p_zeilen) <> 'array' or jsonb_array_length(p_zeilen) > 1000 then
    raise exception 'SPIELERLISTE_VOLL';
  end if;
  if p_erwartet is not null then
    perform pg_advisory_xact_lock(hashtextextended('spieler:' || p_team::text, 0));
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
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'zeile', l.zeile, 'vorname', l.vorname, 'nachname', l.nachname, 'jahrgang', l.jahrgang,
           'js', l.js, 'id', s.id, 'alt', s.js_nummer) order by l.zeile), '[]'::jsonb)
    into v_zeilen
    from letzte l
    left join spieler s on s.team_id = p_team
                       and spieler_text_schluessel(s.vorname) = spieler_text_schluessel(l.vorname)
                       and spieler_text_schluessel(s.nachname) = spieler_text_schluessel(l.nachname)
                       and s.jahrgang = l.jahrgang;

  select count(*) into v_bestand from spieler where team_id = p_team;
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
  if v_bestand + jsonb_array_length(v_neu) > 200 then raise exception 'SPIELERLISTE_VOLL'; end if;

  if v_bestand = 0 and jsonb_array_length(v_neu) > 0 then
    update training_termine set erwartete_spielerzahl = null, spielerzahl_abweichend = false
     where team_id = p_team and erwartete_spielerzahl is not null and not termin_begonnen(datum, beginn);
    get diagnostics v_ersetzt = row_count;
    update termin_serien set erwartete_spielerzahl = null
     where team_id = p_team and erwartete_spielerzahl is not null;
  end if;

  insert into spieler (team_id, vorname, nachname, jahrgang, js_nummer)
  select p_team, z->>'vorname', z->>'nachname', (z->>'jahrgang')::int, z->>'js'
    from jsonb_array_elements(v_zeilen) z
   where z->>'id' is null
   order by (z->>'zeile')::int;

  update spieler s set js_nummer = z->>'js'
    from jsonb_array_elements(v_zeilen) z
   where z->>'id' is not null and s.id = (z->>'id')::uuid
     and z->>'js' is not null and z->>'js' is distinct from z->>'alt';

  return jsonb_build_object('neu', jsonb_array_length(v_neu), 'js', jsonb_array_length(v_js), 'ersetzt', v_ersetzt);
end;
$$;

revoke all on function spieler_importieren(uuid, jsonb, jsonb) from public, anon;
grant execute on function spieler_importieren(uuid, jsonb, jsonb) to authenticated;

reset lock_timeout;
