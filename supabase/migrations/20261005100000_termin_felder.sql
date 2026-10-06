-- ============================================================================
-- Platz und Spielerzahl am Termin (Epic #388), Story 1 (#389): die Felder
-- eines Termins. Der Platz besteht aus einem oder mehreren getrennten,
-- gleichzeitig nutzbaren Feldern (PO 1); je Feld Länge und Breite der
-- verfügbaren Fläche, die Tore je Torart und der Untergrund. Jede Angabe ist
-- freiwillig; fehlt sie (null), ist sie unbekannt — null Tore einer Torart
-- heisst dagegen ausdrücklich keine (PO 5).
--
-- Forward-only: neue, nullable Spalte. Bestandstermine bleiben NULL (= Platz
-- unbekannt, PC 2); der CHECK auf der neuen Spalte ist darum sofort gültig.
-- Keine neue Tabelle — PUBLIC_TABLES in sync-staging.yml bleibt unverändert.
-- Das Kalender-Abo (kalender_abo_termine) nennt nur ausgewählte Spalten und
-- gibt die Felder nicht weiter (OoS 4).
-- ============================================================================
set lock_timeout = '5s';

-- Ist das eine gültige Liste von Feldern? Zwilling von felderProblem() in
-- web/lib/termin-felder.ts — beide nehmen genau dieselben Werte an:
--   NULL                     Platz unbekannt (keine Felder erfasst)
--   sonst ein NICHT leeres Array von Objekten mit genau den Schlüsseln
--     laenge_m, breite_m     beide null oder beide ganze Meter von 5 bis 120
--                            (wie die Spielfeldgrösse einer Übung, PO 6)
--     tore                   Objekt mit genau minitor, tor_5m, tor_7m; je null
--                            oder eine ganze Zahl ab 0 (keine fachliche
--                            Obergrenze, PO 6; technisch bis 2^53 - 1, damit
--                            der TS-Zwilling jede Zahl exakt kennt)
--     untergrund             null oder naturrasen, kunstrasen, hartplatz, halle
-- plpgsql statt sql: Die Prüfungen müssen in dieser Reihenfolge laufen
-- (jsonb_array_length auf einem Objekt würfe), und ein SQL-AND garantiert
-- keine Reihenfolge.
create function termin_felder_gueltig(p jsonb) returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  f jsonb;
  w jsonb;
  k text;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) = 0 then return false; end if;
  for f in select x from jsonb_array_elements(p) x loop
    if jsonb_typeof(f) <> 'object' then return false; end if;
    if array(select x from jsonb_object_keys(f) x order by x)
       <> array['breite_m', 'laenge_m', 'tore', 'untergrund'] then return false; end if;

    -- Länge und Breite nur gemeinsam (AK 9).
    if (jsonb_typeof(f -> 'laenge_m') = 'null') <> (jsonb_typeof(f -> 'breite_m') = 'null') then
      return false;
    end if;
    foreach k in array array['laenge_m', 'breite_m'] loop
      w := f -> k;
      if jsonb_typeof(w) <> 'null' and not (
           jsonb_typeof(w) = 'number'
           and w::numeric = trunc(w::numeric)
           and w::numeric between 5 and 120) then
        return false;
      end if;
    end loop;

    -- Tore je Torart (AK 3, 6).
    if jsonb_typeof(f -> 'tore') <> 'object' then return false; end if;
    if array(select x from jsonb_object_keys(f -> 'tore') x order by x)
       <> array['minitor', 'tor_5m', 'tor_7m'] then return false; end if;
    for w in select x from jsonb_each(f -> 'tore') e(k2, x) loop
      if jsonb_typeof(w) <> 'null' and not (
           jsonb_typeof(w) = 'number'
           and w::numeric = trunc(w::numeric)
           and w::numeric between 0 and 9007199254740991) then
        return false;
      end if;
    end loop;

    -- Untergrund aus der festen Auswahl (AK 4).
    w := f -> 'untergrund';
    if jsonb_typeof(w) <> 'null' and not (
         jsonb_typeof(w) = 'string'
         and (w #>> '{}') in ('naturrasen', 'kunstrasen', 'hartplatz', 'halle')) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Der CHECK läuft mit den Rechten des Schreibenden: Termine schreibt jedes
-- Mitglied direkt (RLS tt_*), darum braucht `authenticated` das Ausführrecht.
-- Die Funktion ist rein und billig; anon braucht sie nicht.
revoke all on function termin_felder_gueltig(jsonb) from public, anon;
grant execute on function termin_felder_gueltig(jsonb) to authenticated, service_role;

alter table training_termine add column felder jsonb;
-- Der Name `tt_felder` ist der Marker, an dem lib/training-bedingungen.ts die
-- Klartext-Meldung findet (FELDER_TEXT.ungueltig in web/lib/termin-felder.ts).
alter table training_termine add constraint tt_felder check (termin_felder_gueltig(felder));

comment on function termin_felder_gueltig(jsonb) is
  'Zwilling von felderProblem() in web/lib/termin-felder.ts (Story #389).';
comment on column training_termine.felder is
  'Die Felder des Termins (#389): NULL = Platz unbekannt, sonst ein nicht leeres Array von '
  '{laenge_m, breite_m, tore: {minitor, tor_5m, tor_7m}, untergrund}; jede Angabe null = unbekannt, '
  '0 Tore = keine. Länge und Breite beschreiben die verfügbare Fläche.';

reset lock_timeout;
