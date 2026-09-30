-- ============================================================================
-- Team-Kalender (Epic #321), Story 3 (#324): wöchentliche Terminserien.
-- Eine Serie ist eine Regel (Wochentage, Beginn- und Enddatum) mit Werten
-- (Beginn, Ende, Ort, Bemerkung). Ihre Termine sind echte Zeilen; jede merkt
-- sich den Tag der Regel, für den sie angelegt wurde (serien_tag), und je
-- Angabe, ob sie von der Serie abweicht (Story 5, PO 3).
-- ============================================================================
set lock_timeout = '5s';

-- Teil A hat die Längen NOT VALID eingeführt; der Bestand ist gezählt (Step 1).
alter table training_termine validate constraint tt_ort_laenge;
alter table training_termine validate constraint tt_bemerkung_laenge;

-- ISO-Wochentage 1 = Montag … 7 = Sonntag, mindestens einer, keiner doppelt
-- (Zwilling von wochentageProblem() in web/lib/serie.ts).
create function wochentage_gueltig(p smallint[]) returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select coalesce(cardinality(p), 0) between 1 and 7
     and (select bool_and(w between 1 and 7) from unnest(p) w)
     and (select count(distinct w) from unnest(p) w) = cardinality(p)
$$;

-- Die Tage einer Regel (Zwilling von serienTage() in web/lib/serie.ts).
create function serien_tage(p_wochentage smallint[], p_von date, p_bis date)
returns setof date
language sql immutable
set search_path = public, pg_temp
as $$
  select d::date from generate_series(p_von::timestamp, p_bis::timestamp, interval '1 day') d
   where extract(isodow from d)::smallint = any(p_wochentage)
$$;

-- Reine Hilfsfunktionen: anon darf sie nicht über PostgREST aufrufen
-- (/rpc/serien_tage mit riesigem Bereich kostet CPU). CHECK-Constraint und die
-- SECURITY-DEFINER-RPCs laufen als Eigentümer und brauchen kein Recht.
revoke all on function wochentage_gueltig(smallint[]) from public, anon;
grant execute on function wochentage_gueltig(smallint[]) to authenticated, service_role;
revoke all on function serien_tage(smallint[], date, date) from public, anon;
grant execute on function serien_tage(smallint[], date, date) to authenticated, service_role;

create table termin_serien (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  wochentage smallint[] not null,
  beginn_datum date not null,
  end_datum date not null,
  beginn time not null,
  ende time not null,
  ort text,
  bemerkung text,
  -- Jede Änderung der Serie zählt hoch (Trigger unten): Daran erkennt die
  -- Oberfläche, dass ein anderes Mitglied sie seit der Auswahl geändert hat
  -- (PO 17).
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  constraint ts_wochentage check (wochentage_gueltig(wochentage)),
  -- Enddatum spätestens am gleichen Kalendertag des Folgejahres; nach einem
  -- 29. Februar ist das der 28. Februar — so rechnet Postgres (AK 5).
  constraint ts_zeitraum check (
    end_datum >= beginn_datum and end_datum <= (beginn_datum + interval '1 year')::date),
  constraint ts_zeit check (ende > beginn),
  constraint ts_ort_laenge check (ort is null or char_length(ort) <= 100),
  constraint ts_bemerkung_laenge check (bemerkung is null or char_length(bemerkung) <= 500)
);
create index termin_serien_team_idx on termin_serien (team_id);

create function termin_serie_version() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger termin_serie_version before update on termin_serien
  for each row execute function termin_serie_version();

-- Einzeln entfernte Tage einer Serie: Eine Serienänderung legt sie nicht
-- wieder an (Story 5 PC 10).
create table termin_serien_luecken (
  serie_id uuid not null references termin_serien(id) on delete cascade,
  tag date not null,
  primary key (serie_id, tag)
);

alter table training_termine
  add column serie_id uuid,
  add column serien_tag date,
  add column zeit_abweichend boolean not null default false,
  add column ort_abweichend boolean not null default false,
  add column bemerkung_abweichend boolean not null default false,
  -- Zusammengesetzt: Ein Termin gehört nur einer Serie SEINES Teams. Fällt
  -- die Serie, fallen ihre Termine (Story 5 PC 12); Trainings bleiben.
  add constraint tt_serie foreign key (serie_id, team_id)
    references termin_serien (id, team_id) on delete cascade,
  add constraint tt_serie_vollstaendig check ((serie_id is null) = (serien_tag is null));
create index training_termine_serie_idx on training_termine (serie_id) where serie_id is not null;

alter table termin_serien enable row level security;
alter table termin_serien_luecken enable row level security;
create policy ts_select on termin_serien for select to authenticated
  using (ist_team_mitglied(team_id));
create policy tsl_select on termin_serien_luecken for select to authenticated
  using (exists (select 1 from termin_serien s where s.id = serie_id and ist_team_mitglied(s.team_id)));
-- Geschrieben wird nur über die RPCs: Serie und ihre Termine ändern sich in
-- einer Transaktion (Story 5 PC 15).
-- Erst alles entziehen (die Default-Privilegien vergeben auch REFERENCES und
-- TRIGGER), dann nur das Lesen für angemeldete Nutzer.
revoke all on termin_serien, termin_serien_luecken from anon, authenticated;
grant select on termin_serien, termin_serien_luecken to authenticated;

-- Festlegen (Story 3 AK 1–7, PC 1–3) -----------------------------------------
create function terminserie_festlegen(
  p_team uuid,
  p_wochentage smallint[],
  p_von date,
  p_bis date,
  p_beginn time,
  p_ende time,
  p_ort text,
  p_bemerkung text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_serie termin_serien;
  v_anzahl integer;
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

  insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung)
  values (p_team,
          (select array_agg(w order by w) from unnest(p_wochentage) w),
          p_von, p_bis, p_beginn, p_ende,
          nullif(btrim(p_ort), ''), nullif(btrim(p_bemerkung), ''))
  returning * into v_serie;

  -- PC 1: je Tag der Regel genau ein Termin ohne Training. PC 3: bestehende
  -- Termine an denselben Tagen bleiben unberührt daneben (PO 5).
  insert into training_termine (team_id, serie_id, serien_tag, datum, beginn, ende, ort, bemerkung)
  select p_team, v_serie.id, d, d, v_serie.beginn, v_serie.ende, v_serie.ort, v_serie.bemerkung
    from serien_tage(v_serie.wochentage, v_serie.beginn_datum, v_serie.end_datum) d;
  get diagnostics v_anzahl = row_count;
  -- AK 6: Kein gewählter Wochentag im Zeitraum — vorab geprüft; diese Prüfung
  -- bleibt als Rückhalt (die Ausnahme rollt auch die Serie zurück, PC 2).
  if v_anzahl = 0 then raise exception 'SERIE_OHNE_TAG'; end if;
  return jsonb_build_object('serie', v_serie.id, 'termine', v_anzahl);
end;
$$;
revoke all on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text) from public, anon;
grant execute on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text) to authenticated;

reset lock_timeout;
