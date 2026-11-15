-- ============================================================================
-- Vereine, Story 9 (#585): CSV-Import in den Spielerbestand des Vereins
-- (Architekturplan Vereine §3.7, §4.3, §7.9, Testfall 24; Plan Phase 9).
--
-- Keine Tabelle, keine Spalte, kein Index, kein Constraint, keine
-- Datenänderung. Der Import in die Spielerliste eines Teams fällt (AK 12):
-- `spieler_importieren` wird gelöscht, jeder Aufruf scheitert, auch für die
-- Verwaltung. Neu ist der Import am Verein-Ort, nur für die Verwaltung, in den
-- Bestand ohne Team (AK 1, 11, PC 1).
--
-- verein_spieler_importieren(p_verein, p_zeilen, p_erwartet default null):
-- - Erste Anweisung nur_in_der_anwendung() (kein KI-Zugang, OoS 6).
-- - p_erwartet null = Vorschau: nur die Rolle (ist_verein_verwaltung, sonst
--   VEREIN_NICHT_GEFUNDEN), keine Sperre, schreibt nichts. Sonst Übernahme:
--   verwaltung_sperren (Recht → Vereinssperre → Recht). Danach braucht der
--   Import keine weitere Sperre ausser den Zeilensperren des UPDATE der
--   J+S-Nummern (Sperrordnung Verein → `spieler`-Zeile); er berührt weder
--   Teams noch Zuordnungen noch Termine (PC 5).
-- - p_zeilen: [{zeile, vorname, nachname, jahrgang, js}], kein Array oder
--   mehr als 1000 Elemente → IMPORT_ZU_GROSS. Ein Element, das kein Objekt
--   ist, oder eine fehlende, nicht ganze, nicht positive oder doppelte
--   `zeile` weist die Funktion technisch ab (SQLSTATE 22023, kein Marker; das
--   Web prüft das schon vorab): Sonst hinge «die letzte gewinnt» und der
--   Abgleich der Übernahme an zufälligen Werten.
-- - Mehrere Zeilen derselben Spieler:in (Schlüssel der Doppelerfassung:
--   spieler_text_schluessel von Vor- und Nachname, Jahrgang): die letzte
--   gewinnt (PC 3 der Story-Vorbedingungen).
-- - Abgleich über den ganzen Verein (AK 2), mengenweise: 0 Treffer = neu,
--   1 Treffer = bestehend (`js`, wenn die Zeile eine gültige, abweichende
--   J+S-Nummer trägt, sonst `gleich`), 2 und mehr = `mehrfach` (Altdubletten;
--   ändert nie etwas, AK 5). Ohne Team und schnuppernd zählen wie alle.
-- - J+S: gültig ist, was nach dem Trimmen 1 bis 20 Zeichen hat (wie
--   verein_spieler_aendern; «nur Ziffern» prüft das Web). Eine Zeile ohne
--   gültige J+S-Nummer ändert die bestehende nicht (PC 3), eine neue
--   Spieler:in bekommt dann keine.
-- - Grenze (AK 6, 7): ueber = bestand + neu − 1000, nur bei neu > 0, sonst 0.
--   Keine Teamgrenze (AK 8).
-- - Übernahme: Die Einordnung wird unter der Vereinssperre neu gerechnet und
--   mit p_erwartet = {neu: [zeile], js: [{zeile, alt}], mehrfach: [zeile]}
--   verglichen (die Reihenfolge des Aufrufers zählt nicht); bei `js` zählt
--   auch die bisherige Nummer `alt`, damit eine inzwischen geänderte J+S-
--   Nummer nicht still überschrieben wird. Ein `js`-Element ohne diese Form
--   (etwa eine blosse Zeilennummer) gilt als abweichend. Weicht etwas ab →
--   `veraltet`, grund 'bestand'; passt es, aber der Verein läge über 1000 →
--   `veraltet`, grund 'grenze'. Beides schreibt nichts und liefert die neue
--   Vorschau mit (AK 9).
--   Die rohe Zahl `bestand` zählt nicht: eine unbeteiligte Erfassung macht die
--   Vorschau nicht falsch.
-- - Alles in einem Aufruf, also einer Transaktion (PC 4).
--
-- Rückgabe (jsonb):
--   V = {bestand, ueber, neu: [zeile],
--        js: [{zeile, alt, teams: [{id, name}]}],
--        gleich: [{zeile, teams}], mehrfach: [{zeile, teams}]}
--   Listen nach zeile, Teams nach Name (dann id); teams [] = ohne Team; bei
--   `mehrfach` die Vereinigung der Teams aller Treffer.
--   {status: 'vorschau', …V}
--   | {status: 'uebernommen', neu: int, js: int}
--   | {status: 'veraltet', grund: 'bestand' | 'grenze', vorschau: V}
-- Marker: NUR_IN_DER_ANWENDUNG, VEREIN_NICHT_GEFUNDEN, IMPORT_ZU_GROSS; als
-- Netz aus spieler_vorher SPIELER_DOPPELT und VEREIN_VOLL.
--
-- Leistung (Zettel A2): spieler_vorher ruft beim INSERT je Zeile
-- spieler_doppelt. Dessen Abfrage plant Postgres einmal je Anweisung mit der
-- Statistik der Tabelle; greift der Ausdrucksindex nicht (frische,
-- unanalysierte Tabelle), rechnet sie je eingefügter Zeile den Schlüssel
-- jeder Vereinszeile gleichen Jahrgangs neu — 1000 neue Zeilen eines
-- Jahrgangs sind dann rund eine Million Regex-Aufrufe, über PostgREST über
-- dem statement_timeout. Der Import hat die Dubletten aber schon unter der
-- Vereinssperre mengenweise bestimmt (und fügt nur Zeilen ohne Treffer und
-- mit je eigenem Schlüssel ein). Darum setzt er für genau sein INSERT die
-- transaktionslokale Einstellung `kifu.import_verein` auf den Verein und
-- danach wieder zurück; spieler_vorher überspringt für Zeilen dieses Vereins
-- nur spieler_doppelt. Sperre, Vereinsgrenze (VEREIN_VOLL) und alle anderen
-- Schreibwege bleiben unverändert geschützt. Auslösbar ist das nur hier:
-- API-Rollen erreichen die Datenbank allein über PostgREST, das keine
-- Einstellungen setzen lässt, und keine andere Funktion mit API-Recht setzt
-- diese. import_verein.sql prüft davon das Zweite am Katalog, dazu, dass die
-- Einstellung nach der Übernahme zurückgesetzt ist, nur für ihren Verein gilt
-- und nach einem gescheiterten INSERT, den der Aufrufer in einer
-- Untertransaktion abfängt, nicht stehen bleibt.
-- ============================================================================

set lock_timeout = '5s';

-- ── Funktionen ──────────────────────────────────────────────────────────────

drop function spieler_importieren(uuid, jsonb, jsonb);

-- Zeilennummern aus p_erwartet, aufsteigend; kein Array zählt als leer.
-- Kein API-Recht.
create function import_zeilennummern(p jsonb) returns integer[]
language sql immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg((e #>> '{}')::int order by (e #>> '{}')::int), '{}')
    from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) e;
$$;

-- Die J+S-Änderungen als geordnete Paare {zeile, alt}, aus p_erwartet wie
-- aus der Vorschau gleich gebildet; kein Array zählt als leer, ein Element
-- ohne Objektform ergibt {zeile: null, alt: null} und passt so nie. Kein
-- API-Recht.
create function import_js_paare(p jsonb) returns jsonb
language sql immutable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
    from (select jsonb_build_object('zeile', e -> 'zeile', 'alt', e -> 'alt') as x
            from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) e) y;
$$;

-- Rumpf wie in 20261113200000_spieler_eindeutig_verein.sql; beim INSERT
-- entfällt spieler_doppelt nur für Zeilen des Vereins, den
-- verein_spieler_importieren eben einfügt (siehe Kopf, «Leistung»).
create or replace function spieler_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_teams uuid[];
  v_team uuid;
begin
  if tg_op = 'INSERT' then
    if new.verein_id is null then raise exception 'VEREIN_FEHLT'; end if;
    perform sperre_verein(new.verein_id);
    if current_setting('kifu.import_verein', true) is distinct from new.verein_id::text then
      if spieler_doppelt(new.verein_id, new.vorname, new.nachname, new.jahrgang, new.id) is not null then
        raise exception 'SPIELER_DOPPELT';
      end if;
    end if;
    if (select count(*) from spieler where verein_id = new.verein_id) >= 1000 then
      raise exception 'VEREIN_VOLL';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if spieler_text_schluessel(new.vorname) = spieler_text_schluessel(old.vorname)
       and spieler_text_schluessel(new.nachname) = spieler_text_schluessel(old.nachname)
       and new.jahrgang = old.jahrgang then
      return new;
    end if;
    perform sperre_verein(new.verein_id);
    if spieler_doppelt(new.verein_id, new.vorname, new.nachname, new.jahrgang, new.id) is not null then
      raise exception 'SPIELER_DOPPELT';
    end if;
    return new;
  end if;
  v_teams := array(select ts.team_id from team_spieler ts join teams t on t.id = ts.team_id
                    where ts.spieler_id = old.id order by ts.team_id);
  if cardinality(v_teams) = 0 then return old; end if;
  if old.verein_id is not null then perform sperre_verein(old.verein_id); end if;
  perform sperre_teams(v_teams);
  foreach v_team in array v_teams loop
    perform termine_einfrieren(v_team);
  end loop;
  return old;
end;
$$;

-- Siehe Kopf. Die Einordnung läuft in einer Anweisung über materialisierte
-- Zwischenstände (Schlüssel einmal je Zeile gerechnet), damit sie nicht von
-- der Statistik abhängt.
create function verein_spieler_importieren(p_verein uuid, p_zeilen jsonb, p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_zeilen jsonb;
  v_bestand int;
  v_neu int;
  v_vorschau jsonb;
begin
  perform nur_in_der_anwendung();
  if p_erwartet is null then
    if not ist_verein_verwaltung(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  else
    perform verwaltung_sperren(p_verein);
  end if;
  if jsonb_typeof(p_zeilen) is distinct from 'array' then raise exception 'IMPORT_ZU_GROSS'; end if;
  if jsonb_array_length(p_zeilen) > 1000 then raise exception 'IMPORT_ZU_GROSS'; end if;
  -- Jede Zeile ein Objekt mit eigener, positiver, ganzer Zeilennummer (siehe Kopf).
  if exists (
    with n as (select case when jsonb_typeof(z) = 'object' and jsonb_typeof(z -> 'zeile') = 'number'
                           then (z ->> 'zeile')::numeric end as zeile
                 from jsonb_array_elements(p_zeilen) z)
    select 1 from n where zeile is null or zeile < 1 or zeile <> trunc(zeile)
    union all
    select 1 from n group by zeile having count(*) > 1
  ) then
    raise exception using errcode = '22023',
      message = 'verein_spieler_importieren: jede Zeile braucht ein Objekt mit eigener, positiver, ganzer Zeilennummer';
  end if;

  -- Je Spieler:in der Datei die letzte Zeile, eingeordnet gegen den Verein.
  with roh as materialized (
    select (z ->> 'zeile')::int as zeile,
           spieler_text_bereinigt(z ->> 'vorname') as vorname,
           spieler_text_bereinigt(z ->> 'nachname') as nachname,
           (z ->> 'jahrgang')::int as jahrgang,
           nullif(btrim(coalesce(z ->> 'js', '')), '') as js
      from jsonb_array_elements(p_zeilen) z
  ), letzte as materialized (
    select distinct on (r.kv, r.kn, r.jahrgang)
           r.zeile, r.vorname, r.nachname, r.jahrgang, r.kv, r.kn,
           case when char_length(r.js) <= 20 then r.js end as js
      from (select roh.*, spieler_text_schluessel(roh.vorname) as kv, spieler_text_schluessel(roh.nachname) as kn
              from roh) r
     order by r.kv, r.kn, r.jahrgang, r.zeile desc
  ), bestand as materialized (
    select s.id, s.js_nummer, s.jahrgang,
           spieler_text_schluessel(s.vorname) as kv, spieler_text_schluessel(s.nachname) as kn
      from spieler s
     where s.verein_id = p_verein
  ), treffer as materialized (
    select l.zeile, l.kv, l.kn, l.jahrgang, b.id, b.js_nummer
      from letzte l
      join bestand b on b.kv = l.kv and b.kn = l.kn and b.jahrgang = l.jahrgang
  ), je_zeile as (
    select l.zeile, l.vorname, l.nachname, l.jahrgang, l.kv, l.kn, l.js,
           count(t.id) as anzahl, (array_agg(t.id))[1] as id, (array_agg(t.js_nummer))[1] as alt
      from letzte l
      left join treffer t on t.kv = l.kv and t.kn = l.kn and t.jahrgang = l.jahrgang
     group by l.zeile, l.vorname, l.nachname, l.jahrgang, l.kv, l.kn, l.js
  ), ihre_teams as (
    select x.zeile, x.kv, x.kn, x.jahrgang,
           jsonb_agg(jsonb_build_object('id', x.team_id, 'name', x.name) order by x.name, x.team_id) as teams
      from (select distinct t.zeile, t.kv, t.kn, t.jahrgang, tm.id as team_id, tm.name
              from treffer t
              join team_spieler ts on ts.spieler_id = t.id
              join teams tm on tm.id = ts.team_id) x
     group by x.zeile, x.kv, x.kn, x.jahrgang
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'zeile', j.zeile,
           'art', case when j.anzahl = 0 then 'neu'
                       when j.anzahl > 1 then 'mehrfach'
                       when j.js is not null and j.js is distinct from j.alt then 'js'
                       else 'gleich' end,
           'vorname', j.vorname, 'nachname', j.nachname, 'jahrgang', j.jahrgang, 'js', j.js,
           'id', j.id, 'alt', j.alt, 'teams', coalesce(it.teams, '[]'::jsonb))
           order by j.zeile), '[]'::jsonb),
         (select count(*) from bestand)
    into v_zeilen, v_bestand
    from je_zeile j
    left join ihre_teams it on it.zeile = j.zeile and it.kv = j.kv and it.kn = j.kn and it.jahrgang = j.jahrgang;

  v_neu := (select count(*) from jsonb_array_elements(v_zeilen) z where z ->> 'art' = 'neu');
  v_vorschau := jsonb_build_object(
    'bestand', v_bestand,
    'ueber', case when v_neu > 0 then greatest(0, v_bestand + v_neu - 1000) else 0 end,
    'neu', (select coalesce(jsonb_agg(z -> 'zeile' order by (z ->> 'zeile')::int), '[]'::jsonb)
              from jsonb_array_elements(v_zeilen) z where z ->> 'art' = 'neu'),
    'js', (select coalesce(jsonb_agg(jsonb_build_object('zeile', z -> 'zeile', 'alt', z -> 'alt', 'teams', z -> 'teams')
                                     order by (z ->> 'zeile')::int), '[]'::jsonb)
             from jsonb_array_elements(v_zeilen) z where z ->> 'art' = 'js'),
    'gleich', (select coalesce(jsonb_agg(jsonb_build_object('zeile', z -> 'zeile', 'teams', z -> 'teams')
                                         order by (z ->> 'zeile')::int), '[]'::jsonb)
                 from jsonb_array_elements(v_zeilen) z where z ->> 'art' = 'gleich'),
    'mehrfach', (select coalesce(jsonb_agg(jsonb_build_object('zeile', z -> 'zeile', 'teams', z -> 'teams')
                                           order by (z ->> 'zeile')::int), '[]'::jsonb)
                   from jsonb_array_elements(v_zeilen) z where z ->> 'art' = 'mehrfach'));

  if p_erwartet is null then
    return jsonb_build_object('status', 'vorschau') || v_vorschau;
  end if;

  if import_zeilennummern(p_erwartet -> 'neu')
       <> array(select (z ->> 'zeile')::int from jsonb_array_elements(v_zeilen) z where z ->> 'art' = 'neu' order by 1)
     or import_js_paare(p_erwartet -> 'js') <> import_js_paare(v_vorschau -> 'js')
     or import_zeilennummern(p_erwartet -> 'mehrfach')
       <> array(select (z ->> 'zeile')::int from jsonb_array_elements(v_zeilen) z where z ->> 'art' = 'mehrfach' order by 1) then
    return jsonb_build_object('status', 'veraltet', 'grund', 'bestand', 'vorschau', v_vorschau);
  end if;
  if (v_vorschau ->> 'ueber')::int > 0 then
    return jsonb_build_object('status', 'veraltet', 'grund', 'grenze', 'vorschau', v_vorschau);
  end if;

  perform set_config('kifu.import_verein', p_verein::text, true);
  insert into spieler (verein_id, vorname, nachname, jahrgang, js_nummer)
  select p_verein, z ->> 'vorname', z ->> 'nachname', (z ->> 'jahrgang')::int, z ->> 'js'
    from jsonb_array_elements(v_zeilen) z
   where z ->> 'art' = 'neu'
   order by (z ->> 'zeile')::int;
  perform set_config('kifu.import_verein', '', true);

  update spieler s set js_nummer = z ->> 'js'
    from jsonb_array_elements(v_zeilen) z
   where z ->> 'art' = 'js' and s.id = (z ->> 'id')::uuid;

  return jsonb_build_object('status', 'uebernommen', 'neu', v_neu,
                            'js', jsonb_array_length(v_vorschau -> 'js'));
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function import_zeilennummern(jsonb) from public, anon, authenticated;
revoke all on function import_js_paare(jsonb) from public, anon, authenticated;
revoke all on function verein_spieler_importieren(uuid, jsonb, jsonb) from public, anon;
grant execute on function verein_spieler_importieren(uuid, jsonb, jsonb) to authenticated;

reset lock_timeout;
