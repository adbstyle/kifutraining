-- ============================================================================
-- Team-Kalender (Epic #321), Story 4 (#325): Wer bereitet vor und leitet?
-- Ein oder mehrere Mitglieder je Termin; die Serie gibt vor, ein Termin kann
-- abweichen (PO 8). Wer austritt, verschwindet aus den anstehenden Terminen
-- und aus den Serien; vergangene Termine behalten den Eintrag — nach einer
-- Konto-Löschung ohne Namen.
-- ============================================================================
set lock_timeout = '5s';

create table termin_verantwortliche (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references training_termine(id) on delete cascade,
  -- NULL: ein gelöschtes Konto (PC 8). Das Anonymisieren erledigt
  -- delete_account() vor dem Löschen; `set null` ist nur der Rückhalt.
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (termin_id, user_id)
);
create index termin_verantwortliche_user_idx on termin_verantwortliche (user_id);

create table termin_serien_verantwortliche (
  serie_id uuid not null references termin_serien(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (serie_id, user_id)
);
create index termin_serien_verantwortliche_user_idx on termin_serien_verantwortliche (user_id);

-- Neue Spalte mit Default: Bestandszeilen erhalten `false`, kein Backfill nötig.
alter table training_termine
  add column verantwortliche_abweichend boolean not null default false;

-- Berechnete Felder für PostgREST (`select=…,verantwortlich_name`). Namen immer
-- aktuell (AK 12) — über anzeige_name, nie über profiles direkt.
create function verantwortlich_name(v termin_verantwortliche) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$ select case when v.user_id is null then null else anzeige_name(v.user_id) end $$;

-- Ehemalig: gelöschtes Konto oder nicht mehr Mitglied des Teams des Termins.
create function verantwortlich_ehemalig(v termin_verantwortliche) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select v.user_id is null or not exists (
    select 1 from team_members m join training_termine t on t.team_id = m.team_id
     where t.id = v.termin_id and m.user_id = v.user_id)
$$;

-- Eigener Parametername: Sonst sind die beiden Überladungen für PostgREST
-- (und gen:types) nicht unterscheidbar.
create function verantwortlich_name(sv termin_serien_verantwortliche) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$ select anzeige_name(sv.user_id) $$;

-- Bei DEFINER-Funktionen das implizite EXECUTE für PUBLIC entziehen; die
-- Tabellen liest ohnehin nur `authenticated`.
revoke all on function verantwortlich_name(termin_verantwortliche) from public, anon;
revoke all on function verantwortlich_ehemalig(termin_verantwortliche) from public, anon;
revoke all on function verantwortlich_name(termin_serien_verantwortliche) from public, anon;
grant execute on function verantwortlich_name(termin_verantwortliche) to authenticated;
grant execute on function verantwortlich_ehemalig(termin_verantwortliche) to authenticated;
grant execute on function verantwortlich_name(termin_serien_verantwortliche) to authenticated;

alter table termin_verantwortliche enable row level security;
alter table termin_serien_verantwortliche enable row level security;
create policy tv_select on termin_verantwortliche for select to authenticated
  using (exists (select 1 from training_termine t where t.id = termin_id and ist_team_mitglied(t.team_id)));
create policy tsv_select on termin_serien_verantwortliche for select to authenticated
  using (exists (select 1 from termin_serien s where s.id = serie_id and ist_team_mitglied(s.team_id)));
-- Geschrieben wird nur über die RPCs und Trigger unten. Erst alles entziehen
-- (die Default-Privilegien vergeben auch REFERENCES und TRIGGER), dann nur das
-- Lesen für angemeldete Nutzer.
revoke all on termin_verantwortliche, termin_serien_verantwortliche from anon, authenticated;
grant select on termin_verantwortliche, termin_serien_verantwortliche to authenticated;

-- Nur aktuelle Mitglieder lassen sich NEU eintragen (AK 8, 13). Ein NULL im
-- Feld zählt als Nicht-Mitglied.
create function alle_mitglieder(p_team uuid, p_user uuid[]) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select not exists (select 1 from unnest(coalesce(p_user, '{}')) u
                      where not exists (select 1 from team_members m
                                         where m.team_id = p_team and m.user_id = u))
$$;
-- Reine Hilfsfunktion der DEFINER-RPCs (laufen als Eigentümer): kein Aufruf
-- über PostgREST.
revoke all on function alle_mitglieder(uuid, uuid[]) from public, anon, authenticated;

-- Einen Termin besetzen — nur dieser (AK 1, 2, 5, 7, 9) -----------------------
-- `p_anonyme`: die Einträge ohne Namen (gelöschte Konten), die bleiben
-- sollen; NULL = alle behalten (KI-Weg ohne Angabe).
create function termin_verantwortliche_setzen(
  p_termin uuid, p_user_ids uuid[], p_anonyme uuid[] default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare t training_termine;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  -- Wer schon eingetragen ist, darf bleiben, auch als ehemaliges Mitglied
  -- (AK 9); NEU eintragen nur aktuelle Mitglieder (AK 8, 13).
  if not alle_mitglieder(t.team_id, array(
       select u from unnest(coalesce(p_user_ids, '{}')) u
        where not exists (select 1 from termin_verantwortliche v where v.termin_id = t.id and v.user_id = u))) then
    raise exception 'NICHT_MEHR_MITGLIED';
  end if;
  delete from termin_verantwortliche v
   where v.termin_id = t.id
     and ((v.user_id is not null and v.user_id <> all(coalesce(p_user_ids, '{}')))
          or (v.user_id is null and p_anonyme is not null and v.id <> all(p_anonyme)));
  insert into termin_verantwortliche (termin_id, user_id)
  select t.id, u from unnest(coalesce(p_user_ids, '{}')) u
  on conflict (termin_id, user_id) do nothing;
  -- PC 2: Ein Serientermin weicht ab, sobald man ihn einzeln besetzt.
  if t.serie_id is not null then
    update training_termine set verantwortliche_abweichend = true where id = t.id;
  end if;
  return jsonb_build_object('team', t.team_id);
end;
$$;
revoke all on function termin_verantwortliche_setzen(uuid, uuid[], uuid[]) from public, anon;
grant execute on function termin_verantwortliche_setzen(uuid, uuid[], uuid[]) to authenticated;

-- Serie festlegen mit Verantwortlichen (AK 3, PC 1) -------------------------
-- Neue Signatur: Die alte ohne p_verantwortliche fällt, sonst wären beide
-- Überladungen über PostgREST mehrdeutig. Benannte Aufrufe ohne
-- p_verantwortliche laufen dank Default unverändert weiter.
drop function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text);
create function terminserie_festlegen(
  p_team uuid,
  p_wochentage smallint[],
  p_von date,
  p_bis date,
  p_beginn time,
  p_ende time,
  p_ort text,
  p_bemerkung text,
  p_verantwortliche uuid[] default '{}')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_serie termin_serien;
  v_anzahl integer;
  v_verantwortliche uuid[] := array(select distinct u from unnest(coalesce(p_verantwortliche, '{}')) u);
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if not wochentage_gueltig(p_wochentage) then raise exception 'SERIE_WOCHENTAGE'; end if;
  if p_von is null or p_bis is null then raise exception 'SERIE_OHNE_ZEITRAUM'; end if;
  if p_bis < p_von then raise exception 'SERIE_ENDE_VOR_BEGINN'; end if;
  if p_bis > (p_von + interval '1 year')::date then raise exception 'SERIE_ZU_LANG'; end if;
  -- Reihenfolge wie `serieProblem` (lib/serie.ts): Wochentage im Zeitraum vor der Zeit.
  if not exists (select 1 from serien_tage(p_wochentage, p_von, p_bis)) then raise exception 'SERIE_OHNE_TAG'; end if;
  if p_beginn is null or p_ende is null or p_ende <= p_beginn then raise exception 'SERIE_ZEIT'; end if;
  -- AK 8, 13: nur aktuelle Mitglieder.
  if not alle_mitglieder(p_team, v_verantwortliche) then raise exception 'NICHT_MEHR_MITGLIED'; end if;

  insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung)
  values (p_team,
          (select array_agg(w order by w) from unnest(p_wochentage) w),
          p_von, p_bis, p_beginn, p_ende,
          nullif(btrim(p_ort), ''), nullif(btrim(p_bemerkung), ''))
  returning * into v_serie;
  insert into termin_serien_verantwortliche (serie_id, user_id)
  select v_serie.id, u from unnest(v_verantwortliche) u;

  -- PC 1: je Tag der Regel genau ein Termin ohne Training. PC 3: bestehende
  -- Termine an denselben Tagen bleiben unberührt daneben (PO 5). Jeder Termin
  -- trägt die Verantwortlichen der Serie (Story 4 PC 1).
  with neu as (
    insert into training_termine (team_id, serie_id, serien_tag, datum, beginn, ende, ort, bemerkung)
    select p_team, v_serie.id, d, d, v_serie.beginn, v_serie.ende, v_serie.ort, v_serie.bemerkung
      from serien_tage(v_serie.wochentage, v_serie.beginn_datum, v_serie.end_datum) d
    returning id),
  besetzt as (
    insert into termin_verantwortliche (termin_id, user_id)
    select n.id, u from neu n cross join unnest(v_verantwortliche) u
    returning 1)
  select count(*) into v_anzahl from neu;
  -- AK 6: Kein gewählter Wochentag im Zeitraum — vorab geprüft; diese Prüfung
  -- bleibt als Rückhalt (die Ausnahme rollt auch die Serie zurück, PC 2).
  if v_anzahl = 0 then raise exception 'SERIE_OHNE_TAG'; end if;
  return jsonb_build_object('serie', v_serie.id, 'termine', v_anzahl);
end;
$$;
revoke all on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[]) from public, anon;
grant execute on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[]) to authenticated;

-- Serie ändern mit Reichweite, auch die Verantwortlichen (AK 4, PC 3, 4, 11) --
-- Vollständiger Rumpf aus terminserien_aendern; neu ist der Schlüssel
-- `verantwortliche` (Liste von Konto-IDs, ersetzt die bisherige Liste).
create or replace function terminserie_rechnen(
  p_termin uuid,
  p_reichweite text,
  p_aenderung jsonb,
  p_version integer,
  p_entfallend uuid[])
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_heute date := heute_am_trainingsort();
  t training_termine;
  s termin_serien;
  x uuid;
  v_version_vorher integer;
  v_alt_tage smallint[];
  v_neu_tage smallint[];
  v_alt_von date;
  v_alt_bis date;
  v_neu_von date;
  v_neu_bis date;
  v_weg smallint[];
  v_dazu smallint[];
  v_tausch boolean;
  v_zeit boolean := p_aenderung ? 'beginn' or p_aenderung ? 'ende';
  v_beginn time;
  v_ende time;
  -- NULL: die Verantwortlichen bleiben, wie sie sind. Doppelte fallen weg.
  v_verantwortliche uuid[] := case when p_aenderung ? 'verantwortliche' then
    array(select distinct u::uuid from jsonb_array_elements_text(p_aenderung->'verantwortliche') u) end;
  v_entfallend uuid[] := '{}';
  v_vergangen uuid[] := '{}';
  v_belegt uuid[];
  v_liste jsonb;
  v_neu_vergangen uuid[];
  r record;
  v_ziel date;
begin
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if p_reichweite is null or p_reichweite not in ('dieser_und_folgende', 'alle') then
    raise exception 'REICHWEITE_UNGUELTIG';
  end if;
  select * into s from termin_serien where id = t.serie_id for update;
  v_version_vorher := s.version;
  if p_version is not null and s.version <> p_version then raise exception 'SERIE_GEAENDERT'; end if;
  perform 1 from training_termine where serie_id = s.id for update;

  -- Die alte Regel im Bereich der Reichweite.
  v_alt_tage := s.wochentage;
  if p_reichweite = 'alle' then
    v_alt_von := s.beginn_datum; v_alt_bis := s.end_datum;
  else
    v_alt_von := t.datum; v_alt_bis := greatest(s.end_datum, t.datum);
  end if;

  -- Die neue Regel (AK 3, 4) und ihre Prüfung wie beim Festlegen (AK 5).
  if p_aenderung ? 'wochentage' then
    if jsonb_typeof(p_aenderung->'wochentage') <> 'array'
       or jsonb_array_length(p_aenderung->'wochentage') = 0 then
      raise exception 'SERIE_WOCHENTAGE';
    end if;
    v_neu_tage := (select array_agg(w::smallint order by w::smallint)
                     from jsonb_array_elements_text(p_aenderung->'wochentage') w);
  else
    v_neu_tage := v_alt_tage;
  end if;
  v_neu_von := coalesce((p_aenderung->>'beginn_datum')::date, v_alt_von);
  v_neu_bis := coalesce((p_aenderung->>'end_datum')::date, v_alt_bis);
  if p_reichweite = 'dieser_und_folgende' and v_neu_von < t.datum then
    raise exception 'TEILSERIE_BEGINN';   -- PC 19
  end if;
  if not wochentage_gueltig(v_neu_tage) then raise exception 'SERIE_WOCHENTAGE'; end if;
  -- Nur wenn die Regel sich ändert: Bei reinen Werteänderungen kann der
  -- gewählte Termin hinter dem Serienende liegen (verlegt), sodass der Bereich
  -- der Reichweite keine Regelprüfung bestünde.
  if p_aenderung ? 'wochentage' or p_aenderung ? 'beginn_datum' or p_aenderung ? 'end_datum' then
    if v_neu_bis < v_neu_von then raise exception 'SERIE_ENDE_VOR_BEGINN'; end if;
    if v_neu_bis > (v_neu_von + interval '1 year')::date then raise exception 'SERIE_ZU_LANG'; end if;
    if not exists (select 1 from serien_tage(v_neu_tage, v_neu_von, v_neu_bis)) then
      raise exception 'SERIE_OHNE_TAG';
    end if;
  end if;
  if v_zeit then
    v_beginn := (p_aenderung->>'beginn')::time;
    v_ende := (p_aenderung->>'ende')::time;
    if v_beginn is null or v_ende is null or v_ende <= v_beginn then raise exception 'SERIE_ZEIT'; end if;
  end if;
  -- Story 4 AK 8, 13: NEU eintragen nur aktuelle Mitglieder.
  if v_verantwortliche is not null and not alle_mitglieder(t.team_id, v_verantwortliche) then
    raise exception 'NICHT_MEHR_MITGLIED';
  end if;

  -- Teilen (PC 3) oder an Ort und Stelle (PC 4).
  if p_reichweite = 'dieser_und_folgende' then
    -- Die Teilserie erbt die Version der bisherigen Serie plus eins (der
    -- Versions-Trigger greift nur bei UPDATE): Wer vor einer Teilung die alte
    -- Version gesehen hat, wird auch an der neuen Serie abgewiesen (AK 9).
    insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung, version)
    values (s.team_id, v_neu_tage, v_neu_von, v_neu_bis,
            case when v_zeit then v_beginn else s.beginn end,
            case when v_zeit then v_ende else s.ende end,
            case when p_aenderung ? 'ort' then nullif(btrim(p_aenderung->>'ort'), '') else s.ort end,
            case when p_aenderung ? 'bemerkung' then nullif(btrim(p_aenderung->>'bemerkung'), '') else s.bemerkung end,
            s.version + 1)
    returning id into x;
    -- Story 4 PC 4, 11: Die Teilserie übernimmt die neuen Verantwortlichen,
    -- sonst die der bisherigen Serie.
    insert into termin_serien_verantwortliche (serie_id, user_id)
    select x, u from unnest(coalesce(v_verantwortliche,
                     array(select sv.user_id from termin_serien_verantwortliche sv where sv.serie_id = s.id))) u;
    update training_termine set serie_id = x where serie_id = s.id and datum >= t.datum;
    update termin_serien_luecken set serie_id = x where serie_id = s.id and tag >= t.datum;
    if exists (select 1 from training_termine where serie_id = s.id) then
      -- Die bisherige Serie endet vor dem gewählten Termin.
      update termin_serien
         set end_datum = t.datum - 1, beginn_datum = least(beginn_datum, t.datum - 1)
       where id = s.id;
    else
      delete from termin_serien where id = s.id;   -- PC 14
    end if;
  else
    x := s.id;
    update termin_serien set
      wochentage = v_neu_tage,
      beginn_datum = v_neu_von,
      end_datum = v_neu_bis,
      beginn = case when v_zeit then v_beginn else beginn end,
      ende = case when v_zeit then v_ende else ende end,
      ort = case when p_aenderung ? 'ort' then nullif(btrim(p_aenderung->>'ort'), '') else ort end,
      bemerkung = case when p_aenderung ? 'bemerkung' then nullif(btrim(p_aenderung->>'bemerkung'), '') else bemerkung end
    where id = x;
    if v_verantwortliche is not null then
      delete from termin_serien_verantwortliche where serie_id = x;
      insert into termin_serien_verantwortliche (serie_id, user_id) select x, u from unnest(v_verantwortliche) u;
      -- Die Version zählt schon das `update termin_serien` davor hoch (Trigger).
    end if;
  end if;

  -- 1) Wochentage (PC 7–9). Es zählt stets das aktuelle Datum (PO 3).
  v_weg := array(select w from unnest(v_alt_tage) w where w <> all(v_neu_tage));
  v_dazu := array(select w from unnest(v_neu_tage) w where w <> all(v_alt_tage));
  v_tausch := cardinality(v_weg) = 1 and cardinality(v_dazu) = 1;
  if v_tausch then
    for r in select id, datum, serien_tag from training_termine
              where serie_id = x and extract(isodow from datum)::smallint = v_weg[1]
              order by datum, beginn nulls last, created_at loop
      -- Derselbe Montag-bis-Sonntag: Die Differenz der ISO-Wochentage bleibt
      -- in der Woche (So → Mo heisst sechs Tage zurück, Review Focus 3).
      v_ziel := r.datum + (v_dazu[1] - v_weg[1]);
      if v_ziel < v_neu_von or v_ziel > v_neu_bis
         or exists (select 1 from training_termine o
                     where o.serie_id = x and o.datum = v_ziel and o.id <> r.id)
         or (r.datum >= v_heute and v_ziel < v_heute) then
        v_entfallend := v_entfallend || r.id;          -- PC 9
      else
        -- PC 8: samt Training, Abweichungen und Ausfall. Ein unverschobener
        -- Termin bleibt unverschoben (serien_tag wandert mit).
        update training_termine
           set datum = v_ziel,
               serien_tag = case when serien_tag = r.datum then v_ziel else serien_tag end
         where id = r.id;
        if r.datum < v_heute or v_ziel < v_heute then v_vergangen := v_vergangen || r.id; end if;
      end if;
    end loop;
  elsif cardinality(v_weg) > 0 then
    v_entfallend := v_entfallend || array(
      select id from training_termine
       where serie_id = x and extract(isodow from datum)::smallint = any(v_weg));
  end if;

  -- 2) Verkleinerter Zeitraum (PC 7).
  if v_neu_von > v_alt_von or v_neu_bis < v_alt_bis then
    v_entfallend := v_entfallend || array(
      select id from training_termine
       where serie_id = x and (datum < v_neu_von or datum > v_neu_bis));
  end if;
  v_entfallend := array(select distinct e from unnest(v_entfallend) e);

  -- 3) Vorab-Auskunft prüfen (AK 9).
  v_belegt := array(select id from training_termine
                     where id = any(v_entfallend) and training_id is not null order by id);
  if p_entfallend is not null
     and v_belegt is distinct from array(select e from unnest(p_entfallend) e order by e) then
    raise exception 'SERIE_BELEGUNG_GEAENDERT';
  end if;
  v_liste := coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', tt.id, 'datum', tt.datum, 'beginn', to_char(tt.beginn, 'HH24:MI'),
             'training', jsonb_build_object('id', tr.id, 'name', tr.name))
           order by tt.datum, tt.beginn nulls last)
      from training_termine tt join trainings tr on tr.id = tt.training_id
     where tt.id = any(v_entfallend)), '[]'::jsonb);

  -- 4) Löschen — ihre Trainings bleiben ohne Termin im Bestand (PC 13).
  v_vergangen := v_vergangen || array(
    select id from training_termine where id = any(v_entfallend) and datum < v_heute);
  delete from training_termine where id = any(v_entfallend);

  -- 5) Werte übernehmen (PC 5): in alle, die der Serie folgen, und in jedem
  --    Fall in den gewählten, der danach bei dieser Angabe wieder folgt.
  if v_zeit then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not zeit_abweichend or id = p_termin) and datum < v_heute
         and (beginn is distinct from v_beginn or ende is distinct from v_ende));
    update training_termine set beginn = v_beginn, ende = v_ende, zeit_abweichend = false
     where serie_id = x and (not zeit_abweichend or id = p_termin);
  end if;
  if p_aenderung ? 'ort' then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not ort_abweichend or id = p_termin) and datum < v_heute
         and ort is distinct from nullif(btrim(p_aenderung->>'ort'), ''));
    update training_termine set ort = nullif(btrim(p_aenderung->>'ort'), ''), ort_abweichend = false
     where serie_id = x and (not ort_abweichend or id = p_termin);
  end if;
  if p_aenderung ? 'bemerkung' then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not bemerkung_abweichend or id = p_termin) and datum < v_heute
         and bemerkung is distinct from nullif(btrim(p_aenderung->>'bemerkung'), ''));
    update training_termine set bemerkung = nullif(btrim(p_aenderung->>'bemerkung'), ''), bemerkung_abweichend = false
     where serie_id = x and (not bemerkung_abweichend or id = p_termin);
  end if;
  -- Story 4 PC 3: Verantwortliche ebenso — in alle, die der Serie folgen, und
  -- in den gewählten. Vergangene zählen nur, wenn sich ihre Besetzung ändert.
  if v_verantwortliche is not null then
    v_vergangen := v_vergangen || array(
      select tt.id from training_termine tt
       where tt.serie_id = x and (not tt.verantwortliche_abweichend or tt.id = p_termin) and tt.datum < v_heute
         and array(select v.user_id from termin_verantwortliche v where v.termin_id = tt.id order by v.user_id nulls last)
             is distinct from array(select u from unnest(v_verantwortliche) u order by u));
    delete from termin_verantwortliche v using training_termine tt
     where v.termin_id = tt.id and tt.serie_id = x and (not tt.verantwortliche_abweichend or tt.id = p_termin);
    insert into termin_verantwortliche (termin_id, user_id)
    select tt.id, u from training_termine tt cross join unnest(v_verantwortliche) u
     where tt.serie_id = x and (not tt.verantwortliche_abweichend or tt.id = p_termin);
    update training_termine set verantwortliche_abweichend = false where id = p_termin;
  end if;

  -- 6) Hinzugekommene Tage (PC 6): neue Regel minus alte, ohne einzeln
  --    entfernte (PC 10) und ohne Tage, die schon einen Termin der Serie
  --    haben. Beim Tausch zählt der neue Wochentag als alt: Er ersetzt, er
  --    kommt nicht hinzu.
  with neu as (
    insert into training_termine (team_id, serie_id, serien_tag, datum, beginn, ende, ort, bemerkung)
    select ts.team_id, x, d, d, ts.beginn, ts.ende, ts.ort, ts.bemerkung
      from termin_serien ts, serien_tage(v_neu_tage, v_neu_von, v_neu_bis) d
     where ts.id = x
       and not exists (select 1 from serien_tage(case when v_tausch then v_neu_tage else v_alt_tage end,
                                                 v_alt_von, v_alt_bis) a where a = d)
       and not exists (select 1 from termin_serien_luecken l where l.serie_id = x and l.tag = d)
       and not exists (select 1 from training_termine o where o.serie_id = x and o.serien_tag = d)
       and not exists (select 1 from training_termine o where o.serie_id = x and o.datum = d)
    returning id, datum),
  -- Story 4 PC 1: Neue Termine tragen die Verantwortlichen der Serie.
  besetzt as (
    insert into termin_verantwortliche (termin_id, user_id)
    select n.id, sv.user_id from neu n join termin_serien_verantwortliche sv on sv.serie_id = x
    returning 1)
  select coalesce(array_agg(id) filter (where datum < v_heute), '{}') into v_neu_vergangen from neu;
  v_vergangen := v_vergangen || v_neu_vergangen;

  -- PC 14: Eine Serie ohne Termine besteht nicht fort.
  if not exists (select 1 from training_termine where serie_id = x) then
    delete from termin_serien where id = x;
    x := null;
  end if;

  return jsonb_build_object(
    'serie', x,
    'version_vorher', v_version_vorher,
    'entfallend', v_liste,
    'entfallend_anzahl', cardinality(v_entfallend),
    'vergangene', (select count(distinct v) from unnest(v_vergangen) v));
end;
$$;
revoke all on function terminserie_rechnen(uuid, text, jsonb, integer, uuid[]) from public, anon, authenticated;

-- Wieder der Serie folgen, auch mit den Verantwortlichen (AK 6) --------------
create or replace function termin_der_serie_folgen(p_termin uuid, p_angaben text[])
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  s termin_serien;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if p_angaben is null or cardinality(p_angaben) = 0
     or not (p_angaben <@ array['zeit', 'ort', 'bemerkung', 'datum', 'verantwortliche']) then
    raise exception 'SERIE_ANGABEN_UNGUELTIG';
  end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if 'datum' = any(p_angaben) then raise exception 'DATUM_FOLGT_NICHT'; end if;
  select * into s from termin_serien where id = t.serie_id;
  update training_termine set
    beginn = case when 'zeit' = any(p_angaben) then s.beginn else beginn end,
    ende = case when 'zeit' = any(p_angaben) then s.ende else ende end,
    zeit_abweichend = zeit_abweichend and not ('zeit' = any(p_angaben)),
    ort = case when 'ort' = any(p_angaben) then s.ort else ort end,
    ort_abweichend = ort_abweichend and not ('ort' = any(p_angaben)),
    bemerkung = case when 'bemerkung' = any(p_angaben) then s.bemerkung else bemerkung end,
    bemerkung_abweichend = bemerkung_abweichend and not ('bemerkung' = any(p_angaben)),
    verantwortliche_abweichend = verantwortliche_abweichend and not ('verantwortliche' = any(p_angaben))
  where id = p_termin;
  -- Die Verantwortlichen der Serie ersetzen die eigenen.
  if 'verantwortliche' = any(p_angaben) then
    delete from termin_verantwortliche where termin_id = t.id;
    insert into termin_verantwortliche (termin_id, user_id)
    select t.id, sv.user_id from termin_serien_verantwortliche sv where sv.serie_id = s.id;
  end if;
  return jsonb_build_object('team', t.team_id, 'training', t.training_id);
end;
$$;
revoke all on function termin_der_serie_folgen(uuid, text[]) from public, anon;
grant execute on function termin_der_serie_folgen(uuid, text[]) to authenticated;

-- Austreten trägt aus (PC 6, 12): aus allen anstehenden Terminen und aus den
-- Serien des Teams. Ob ein Termin der Serie folgt, ändert das nicht.
-- Vergangene Termine behalten den Eintrag (dann als ehemaliges Mitglied).
create function mitglied_austragen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from termin_verantwortliche v
   using training_termine t
   where v.termin_id = t.id and t.team_id = old.team_id
     and v.user_id = old.user_id and t.datum >= heute_am_trainingsort();
  delete from termin_serien_verantwortliche sv
   using termin_serien s
   where sv.serie_id = s.id and s.team_id = old.team_id and sv.user_id = old.user_id;
  return old;
end;
$$;
create trigger mitglied_austragen after delete on team_members
  for each row execute function mitglied_austragen();

-- PC 13: Wer einen vergangenen Termin auf heute oder später verlegt, trägt
-- ehemalige Mitglieder aus ihm aus — egal über welchen Weg.
create function ehemalige_austragen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if old.datum < heute_am_trainingsort() and new.datum >= heute_am_trainingsort() then
    delete from termin_verantwortliche v
     where v.termin_id = new.id
       and (v.user_id is null or not exists (
             select 1 from team_members m where m.team_id = new.team_id and m.user_id = v.user_id));
  end if;
  return new;
end;
$$;
create trigger ehemalige_austragen after update of datum on training_termine
  for each row execute function ehemalige_austragen();

-- Konto löschen (PC 6, 8): VOR dem Löschen aus allen anstehenden Terminen und
-- Serien austragen und die vergangenen Einträge anonymisieren — auch in
-- Teams, die die Person schon verlassen hat. Der Rest ist unverändert
-- (Migration team_datenmodell).
create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Verantwortliche: anstehende Termine und Serien austragen, vergangene
  -- Einträge ohne Namen erhalten.
  delete from termin_verantwortliche v using training_termine t
   where v.termin_id = t.id and v.user_id = v_uid and t.datum >= heute_am_trainingsort();
  delete from termin_serien_verantwortliche where user_id = v_uid;
  update termin_verantwortliche set user_id = null where user_id = v_uid;

  -- Favoriten des Kontos entfernen.
  delete from exercise_favorites where user_id = v_uid;

  -- Übungen: öffentliche anonymisieren, private löschen.
  update exercises set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from exercises where owner_id = v_uid and visibility = 'private';

  -- Trainings: öffentliche Vorlagen anonymisiert erhalten (unveränderlich via
  -- fehlende Update-Policy), alle übrigen eigenen löschen.
  update trainings set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from trainings where owner_id = v_uid;
end;
$$;
revoke all on function delete_account() from public, anon;
grant execute on function delete_account() to authenticated;

reset lock_timeout;
