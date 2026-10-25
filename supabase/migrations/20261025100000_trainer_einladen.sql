-- ============================================================================
-- Epic #518, Story 1 (#519): Trainer:innen zu Terminen einladen und die
-- Verantwortung bestimmen. Ersetzt die «Verantwortlichen» (0..n je Termin,
-- #325) durch Eingeladene mit genau einer verantwortlichen Trainer:in.
--
-- Modell: eine Zeile je Termin und Trainer:in (`termin_trainer`); die
-- Verantwortung ist ein Merkmal dieser Zeile — wer verantwortlich ist, ist so
-- immer eingeladen (PO 3). Die Serie gibt Eingeladene und Verantwortung vor
-- (`termin_serien_trainer`); ein Termin weicht bei beiden je für sich ab.
--
-- Regeln (PO 2026-10-25, vereinfacht): Ausladen wirkt immer — trifft es die
-- Verantwortliche, steht der Termin ohne Verantwortliche:n da (AK 9, PC 14).
-- Wer verantwortlich wird, ist damit eingeladen (PC 13). Serienänderungen
-- gelten an jedem Termin nach denselben Regeln, keiner wird ausgelassen
-- (AK 13).
--
-- Forward-only (echte Daten): Die bisherigen Tabellen termin_verantwortliche
-- und termin_serien_verantwortliche bleiben ungenutzt stehen und fallen in
-- einem späteren Release (Expand/Contract). Der Bestand wird übernommen
-- (PC 3, 4): bisherige Verantwortliche werden Eingeladene; war es genau eine,
-- bleibt sie verantwortlich, sonst steht der Termin ohne Verantwortliche:n da.
-- ============================================================================
set lock_timeout = '5s';

-- ── Tabellen ────────────────────────────────────────────────────────────────

create table termin_trainer (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references training_termine(id) on delete cascade,
  -- NULL: ein gelöschtes Konto (PC 9). Das Anonymisieren erledigt
  -- delete_account() vor dem Löschen; `set null` ist nur der Rückhalt.
  user_id uuid references auth.users(id) on delete set null,
  verantwortlich boolean not null default false,
  created_at timestamptz not null default now(),
  unique (termin_id, user_id)
);
create index termin_trainer_user_idx on termin_trainer (user_id);
-- Genau eine Verantwortliche je Termin (oder keine).
create unique index termin_trainer_verantwortlich_idx on termin_trainer (termin_id) where verantwortlich;

create table termin_serien_trainer (
  serie_id uuid not null references termin_serien(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verantwortlich boolean not null default false,
  primary key (serie_id, user_id)
);
create index termin_serien_trainer_user_idx on termin_serien_trainer (user_id);
create unique index termin_serien_trainer_verantwortlich_idx on termin_serien_trainer (serie_id) where verantwortlich;

-- Eingeladene und Verantwortung weichen je für sich von der Serie ab (PO 3).
alter table training_termine
  add column eingeladene_abweichend boolean not null default false,
  add column verantwortung_abweichend boolean not null default false;

-- ── Berechnete Felder für PostgREST ─────────────────────────────────────────
-- Namen immer aktuell, über anzeige_name. SECURITY INVOKER wie bisher.

create function trainer_name(tr termin_trainer) returns text
language sql stable security invoker
set search_path = public, pg_temp
as $$ select case when tr.user_id is null then null else anzeige_name(tr.user_id) end $$;

-- Ehemalig: gelöschtes Konto oder nicht mehr Mitglied des Teams des Termins.
create function trainer_ehemalig(tr termin_trainer) returns boolean
language sql stable security invoker
set search_path = public, pg_temp
as $$
  select tr.user_id is null or not exists (
    select 1 from team_members m join training_termine t on t.team_id = m.team_id
     where t.id = tr.termin_id and m.user_id = tr.user_id)
$$;

-- Eigener Parametername: Sonst sind die Überladungen für PostgREST nicht
-- unterscheidbar.
create function trainer_name(st termin_serien_trainer) returns text
language sql stable security invoker
set search_path = public, pg_temp
as $$ select anzeige_name(st.user_id) $$;

revoke all on function trainer_name(termin_trainer) from public, anon;
revoke all on function trainer_ehemalig(termin_trainer) from public, anon;
revoke all on function trainer_name(termin_serien_trainer) from public, anon;
grant execute on function trainer_name(termin_trainer) to authenticated;
grant execute on function trainer_ehemalig(termin_trainer) to authenticated;
grant execute on function trainer_name(termin_serien_trainer) to authenticated;

-- ── Zugriff ────────────────────────────────────────────────────────────────
alter table termin_trainer enable row level security;
alter table termin_serien_trainer enable row level security;
create policy ttr_select on termin_trainer for select to authenticated
  using (exists (select 1 from training_termine t where t.id = termin_id and ist_team_mitglied(t.team_id)));
create policy tstr_select on termin_serien_trainer for select to authenticated
  using (exists (select 1 from termin_serien s where s.id = serie_id and ist_team_mitglied(s.team_id)));
-- Geschrieben wird nur über die RPCs und Trigger unten.
revoke all on termin_trainer, termin_serien_trainer from anon, authenticated;
grant select on termin_trainer, termin_serien_trainer to authenticated;

-- ── Bestand übernehmen (PC 3, 4) ────────────────────────────────────────────
insert into termin_trainer (termin_id, user_id, verantwortlich, created_at)
select termin_id, user_id, count(*) over (partition by termin_id) = 1, created_at
  from termin_verantwortliche;
insert into termin_serien_trainer (serie_id, user_id, verantwortlich)
select serie_id, user_id, count(*) over (partition by serie_id) = 1
  from termin_serien_verantwortliche;
-- Die Abweichung der bisherigen Verantwortlichen gilt für beide Angaben.
-- Ohne die Zeilen-Trigger: Der Abgleich der Spielerzahl darf Bestandswerte
-- nicht anfassen, und `updated_at` bleibt der Stand des Termins.
alter table training_termine disable trigger termin_spielerzahl_regel;
alter table training_termine disable trigger training_termine_set_updated_at;
update training_termine
   set eingeladene_abweichend = true, verantwortung_abweichend = true
 where verantwortliche_abweichend;
alter table training_termine enable trigger termin_spielerzahl_regel;
alter table training_termine enable trigger training_termine_set_updated_at;

-- ── Hilfsfunktionen (nur für die DEFINER-RPCs, kein Aufruf über PostgREST) ──

-- Eine Trainer:in verantwortlich machen: Sie ist damit eingeladen (PC 13).
-- `p_user` NULL nimmt die Verantwortung weg (nur intern: Ausladen, Austritt).
create function trainer_verantwortlich_setzen(p_termin uuid, p_user uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Zuerst abgeben: Der Teilindex lässt zwei Verantwortliche nicht einmal
  -- innerhalb eines Statements zu.
  update termin_trainer set verantwortlich = false
   where termin_id = p_termin and verantwortlich and user_id is distinct from p_user;
  if p_user is not null then
    insert into termin_trainer (termin_id, user_id, verantwortlich) values (p_termin, p_user, true)
    on conflict (termin_id, user_id) do update set verantwortlich = true;
  end if;
end;
$$;
revoke all on function trainer_verantwortlich_setzen(uuid, uuid) from public, anon, authenticated;

-- Die Vorgabe einer Serie: Eingeladene (NULL = unverändert) und
-- Verantwortung (nur mit p_mit_verantwortung).
create function serie_trainer_vorgabe(p_serie uuid, p_eingeladene uuid[], p_mit_verantwortung boolean, p_verantwortlich uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_eingeladene is not null then
    delete from termin_serien_trainer where serie_id = p_serie and user_id <> all(p_eingeladene);
    insert into termin_serien_trainer (serie_id, user_id)
    select p_serie, u from unnest(p_eingeladene) u
    on conflict (serie_id, user_id) do nothing;
  end if;
  if p_mit_verantwortung then
    update termin_serien_trainer set verantwortlich = false
     where serie_id = p_serie and verantwortlich and user_id is distinct from p_verantwortlich;
    if p_verantwortlich is not null then
      insert into termin_serien_trainer (serie_id, user_id, verantwortlich) values (p_serie, p_verantwortlich, true)
      on conflict (serie_id, user_id) do update set verantwortlich = true;
    end if;
  end if;
end;
$$;
revoke all on function serie_trainer_vorgabe(uuid, uuid[], boolean, uuid) from public, anon, authenticated;

-- ── Bausteine der Serienrechnung ────────────────────────────────────────────
-- terminserie_rechnen ruft für die Angaben dieser Story nur noch diese drei
-- Bausteine; spätere Angaben (Mindestbesetzung, #521) erweitern sie, statt die
-- Rechnung erneut zu kopieren.

-- Die Teilserie übernimmt die Vorgaben der bisherigen (vor der Änderung).
create function serie_angaben_teilen(p_alt uuid, p_neu uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into termin_serien_trainer (serie_id, user_id, verantwortlich)
  select p_neu, user_id, verantwortlich from termin_serien_trainer where serie_id = p_alt;
end;
$$;
revoke all on function serie_angaben_teilen(uuid, uuid) from public, anon, authenticated;

-- Die Änderung in die Vorgabe der Serie und in alle Termine, die ihr bei der
-- Angabe folgen, und in jedem Fall in den gewählten (der danach wieder folgt).
-- Gibt die vergangenen Termine zurück, deren Angaben sich dabei ändern.
create function serie_angaben_anwenden(p_serie uuid, p_termin uuid, p_aenderung jsonb, p_heute date)
returns uuid[]
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_team uuid := (select team_id from termin_serien where id = p_serie);
  v_eingeladene uuid[] := case when p_aenderung ? 'eingeladene' then
    array(select distinct u::uuid from jsonb_array_elements_text(p_aenderung->'eingeladene') u) end;
  v_mit_verantwortung boolean := p_aenderung ? 'verantwortlich';
  v_verantwortlich uuid := nullif(p_aenderung->>'verantwortlich', '')::uuid;
  v_vergangen uuid[] := '{}';
begin
  if v_mit_verantwortung and v_verantwortlich is null then raise exception 'VERANTWORTUNG_ERSATZLOS'; end if;
  -- AK 11: NEU eintragen nur aktuelle Mitglieder.
  if not alle_mitglieder(v_team, array(
       select u from unnest(coalesce(v_eingeladene, '{}') || case when v_mit_verantwortung then array[v_verantwortlich] else '{}'::uuid[] end) u
        where not exists (select 1 from termin_serien_trainer st where st.serie_id = p_serie and st.user_id = u))) then
    raise exception 'NICHT_MEHR_MITGLIED';
  end if;
  perform serie_trainer_vorgabe(p_serie, v_eingeladene, v_mit_verantwortung, v_verantwortlich);

  if v_eingeladene is not null then
    v_vergangen := v_vergangen || array(
      select tt.id from training_termine tt
       where tt.serie_id = p_serie and (not tt.eingeladene_abweichend or tt.id = p_termin) and tt.datum < p_heute
         and array(select tr.user_id from termin_trainer tr where tr.termin_id = tt.id order by tr.user_id nulls last)
             is distinct from array(select u from unnest(v_eingeladene) u order by u));
    -- Ausladen wirkt immer, auch bei der Verantwortlichen (AK 9).
    delete from termin_trainer tr using training_termine tt
     where tr.termin_id = tt.id and tt.serie_id = p_serie and (not tt.eingeladene_abweichend or tt.id = p_termin)
       and (tr.user_id is null or tr.user_id <> all(v_eingeladene));
    insert into termin_trainer (termin_id, user_id)
    select tt.id, u from training_termine tt cross join unnest(v_eingeladene) u
     where tt.serie_id = p_serie and (not tt.eingeladene_abweichend or tt.id = p_termin)
    on conflict (termin_id, user_id) do nothing;
    update training_termine set eingeladene_abweichend = false where id = p_termin;
  end if;

  if v_mit_verantwortung then
    v_vergangen := v_vergangen || array(
      select tt.id from training_termine tt
       where tt.serie_id = p_serie and (not tt.verantwortung_abweichend or tt.id = p_termin) and tt.datum < p_heute
         and (select tr.user_id from termin_trainer tr where tr.termin_id = tt.id and tr.verantwortlich)
             is distinct from v_verantwortlich);
    perform trainer_verantwortlich_setzen(tt.id, v_verantwortlich)
       from training_termine tt
      where tt.serie_id = p_serie and (not tt.verantwortung_abweichend or tt.id = p_termin);
    update training_termine set verantwortung_abweichend = false where id = p_termin;
  end if;
  return v_vergangen;
end;
$$;
revoke all on function serie_angaben_anwenden(uuid, uuid, jsonb, date) from public, anon, authenticated;

-- Neue Termine einer Serie tragen ihre Vorgaben.
create function serie_angaben_neue_termine(p_serie uuid, p_termine uuid[]) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into termin_trainer (termin_id, user_id, verantwortlich)
  select n, st.user_id, st.verantwortlich
    from unnest(p_termine) n join termin_serien_trainer st on st.serie_id = p_serie;
end;
$$;
revoke all on function serie_angaben_neue_termine(uuid, uuid[]) from public, anon, authenticated;

-- ── Einen Termin besetzen: nur dieser (AK 1, 5–11, 25) ──────────────────────
-- Differenz statt Liste: Wer gleichzeitig jemanden einlädt, überschreibt die
-- Einladungen der anderen nicht. `p_ausladen_eintraege`: Einträge ohne Namen
-- (gelöschte Konten), die wegfallen sollen.
create function termin_trainer_aendern(
  p_termin uuid,
  p_einladen uuid[] default '{}',
  p_ausladen uuid[] default '{}',
  p_verantwortlich uuid default null,
  p_ausladen_eintraege uuid[] default '{}')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_einladen uuid[] := array(select distinct u from unnest(coalesce(p_einladen, '{}')) u
                              where u <> all(coalesce(p_ausladen, '{}')));
  v_neu uuid[];
  v_eingeladene_geaendert boolean;
  v_verantwortung_geaendert boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if p_verantwortlich is not null and p_verantwortlich = any(coalesce(p_ausladen, '{}')) then
    raise exception 'TRAINER_WIDERSPRUCH';
  end if;
  -- AK 11: NEU einladen nur aktuelle Mitglieder; wer schon eingeladen ist,
  -- bleibt es auch als ehemaliges Mitglied.
  v_neu := array(select u from unnest(v_einladen || case when p_verantwortlich is null then '{}'::uuid[] else array[p_verantwortlich] end) u
                  where not exists (select 1 from termin_trainer tr where tr.termin_id = t.id and tr.user_id = u));
  if not alle_mitglieder(t.team_id, v_neu) then raise exception 'NICHT_MEHR_MITGLIED'; end if;

  v_eingeladene_geaendert := cardinality(v_neu) > 0 or exists (
    select 1 from termin_trainer tr where tr.termin_id = t.id
       and (tr.user_id = any(coalesce(p_ausladen, '{}')) or tr.id = any(coalesce(p_ausladen_eintraege, '{}'))));
  -- Auch wer die Verantwortliche auslädt, ändert die Verantwortung.
  v_verantwortung_geaendert := p_verantwortlich is not null or exists (
    select 1 from termin_trainer tr where tr.termin_id = t.id and tr.verantwortlich
       and (tr.user_id = any(coalesce(p_ausladen, '{}')) or tr.id = any(coalesce(p_ausladen_eintraege, '{}'))));
  -- Ausladen wirkt immer (AK 9, PC 14): Mit der Zeile fällt auch die Verantwortung.
  delete from termin_trainer tr
   where tr.termin_id = t.id
     and (tr.user_id = any(coalesce(p_ausladen, '{}')) or tr.id = any(coalesce(p_ausladen_eintraege, '{}')));
  insert into termin_trainer (termin_id, user_id)
  select t.id, u from unnest(v_einladen) u
  on conflict (termin_id, user_id) do nothing;
  if p_verantwortlich is not null then
    perform trainer_verantwortlich_setzen(t.id, p_verantwortlich);
  end if;
  -- Ein Serientermin weicht ab, sobald man ihn einzeln besetzt — je Angabe.
  if t.serie_id is not null then
    update training_termine
       set eingeladene_abweichend = eingeladene_abweichend or v_eingeladene_geaendert,
           verantwortung_abweichend = verantwortung_abweichend or v_verantwortung_geaendert
     where id = t.id and (v_eingeladene_geaendert or v_verantwortung_geaendert);
  end if;
  return jsonb_build_object('team', t.team_id);
end;
$$;
revoke all on function termin_trainer_aendern(uuid, uuid[], uuid[], uuid, uuid[]) from public, anon;
grant execute on function termin_trainer_aendern(uuid, uuid[], uuid[], uuid, uuid[]) to authenticated;

-- ── Serie festlegen mit Eingeladenen und Verantwortlicher (AK 1–4) ──────────
drop function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], jsonb, smallint, uuid[]);
create function terminserie_festlegen(
  p_team uuid,
  p_wochentage smallint[],
  p_von date,
  p_bis date,
  p_beginn time,
  p_ende time,
  p_ort text,
  p_bemerkung text,
  p_eingeladene uuid[] default '{}',
  p_verantwortlich uuid default null,
  p_felder jsonb default null,
  p_spielerzahl smallint default null,
  p_kader uuid[] default '{}')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_serie termin_serien;
  v_anzahl integer;
  -- Die Verantwortliche ist immer eingeladen (PC 13).
  v_eingeladene uuid[] := array(select distinct u from unnest(
    coalesce(p_eingeladene, '{}') || case when p_verantwortlich is null then '{}'::uuid[] else array[p_verantwortlich] end) u);
  v_kader uuid[] := array(select distinct k from unnest(coalesce(p_kader, '{}')) k);
  v_neu uuid[];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if not wochentage_gueltig(p_wochentage) then raise exception 'SERIE_WOCHENTAGE'; end if;
  if p_von is null or p_bis is null then raise exception 'SERIE_OHNE_ZEITRAUM'; end if;
  if p_bis < p_von then raise exception 'SERIE_ENDE_VOR_BEGINN'; end if;
  if p_bis > (p_von + interval '1 year')::date then raise exception 'SERIE_ZU_LANG'; end if;
  if not exists (select 1 from serien_tage(p_wochentage, p_von, p_bis)) then raise exception 'SERIE_OHNE_TAG'; end if;
  if p_beginn is null or p_ende is null or p_ende <= p_beginn then raise exception 'SERIE_ZEIT'; end if;
  -- AK 3: genau eine Verantwortliche beim Festlegen.
  if p_verantwortlich is null then raise exception 'VERANTWORTUNG_PFLICHT'; end if;
  if not alle_mitglieder(p_team, v_eingeladene) then raise exception 'NICHT_MEHR_MITGLIED'; end if;
  if exists (select 1 from unnest(v_kader) k where not exists (select 1 from kader where id = k and team_id = p_team)) then
    raise exception 'KADER_NICHT_GEFUNDEN';
  end if;

  insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung,
                             felder, erwartete_spielerzahl)
  values (p_team,
          (select array_agg(w order by w) from unnest(p_wochentage) w),
          p_von, p_bis, p_beginn, p_ende,
          nullif(btrim(p_ort), ''), nullif(btrim(p_bemerkung), ''),
          nullif(p_felder, 'null'::jsonb), p_spielerzahl)
  returning * into v_serie;
  perform serie_trainer_vorgabe(v_serie.id, v_eingeladene, true, p_verantwortlich);
  insert into termin_serien_kader (serie_id, kader_id, team_id)
  select v_serie.id, k, p_team from unnest(v_kader) k;

  with neu as (
    insert into training_termine (team_id, serie_id, serien_tag, datum, beginn, ende, ort, bemerkung,
                                  felder, erwartete_spielerzahl)
    select p_team, v_serie.id, d, d, v_serie.beginn, v_serie.ende, v_serie.ort, v_serie.bemerkung,
           v_serie.felder, v_serie.erwartete_spielerzahl
      from serien_tage(v_serie.wochentage, v_serie.beginn_datum, v_serie.end_datum) d
    returning id),
  eingeteilt as (
    insert into termin_kader (termin_id, kader_id, team_id)
    select n.id, k, p_team from neu n cross join unnest(v_kader) k
    returning 1)
  select array_agg(id) into v_neu from neu;
  v_anzahl := coalesce(cardinality(v_neu), 0);
  if v_anzahl = 0 then raise exception 'SERIE_OHNE_TAG'; end if;
  perform serie_angaben_neue_termine(v_serie.id, v_neu);
  return jsonb_build_object('serie', v_serie.id, 'termine', v_anzahl);
end;
$$;
revoke all on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[]) from public, anon;
grant execute on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[]) to authenticated;

-- ── Serie ändern (AK 12, 13, PC 1, 2) ───────────────────────────────────────
-- Vollständiger Rumpf aus termin_kader; die Verantwortlichen weichen den drei
-- Bausteinen serie_angaben_* (Schlüssel `eingeladene` = ganze Liste der Serie,
-- `verantwortlich` = Kennung). Alles Übrige ist unverändert.
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
  v_mit_felder boolean := p_aenderung ? 'felder';
  v_felder jsonb := nullif(p_aenderung->'felder', 'null'::jsonb);
  v_mit_zahl boolean := p_aenderung ? 'spielerzahl';
  v_zahl smallint := (p_aenderung->>'spielerzahl')::smallint;
  v_kader uuid[] := case when p_aenderung ? 'kader' then
    array(select distinct k::uuid from jsonb_array_elements_text(p_aenderung->'kader') k) end;
  v_entfallend uuid[] := '{}';
  v_vergangen uuid[] := '{}';
  v_belegt uuid[];
  v_liste jsonb;
  v_neu_ids uuid[];
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

  v_alt_tage := s.wochentage;
  if p_reichweite = 'alle' then
    v_alt_von := s.beginn_datum; v_alt_bis := s.end_datum;
  else
    v_alt_von := t.datum; v_alt_bis := greatest(s.end_datum, t.datum);
  end if;

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
    raise exception 'TEILSERIE_BEGINN';
  end if;
  if not wochentage_gueltig(v_neu_tage) then raise exception 'SERIE_WOCHENTAGE'; end if;
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
  if v_kader is not null and exists (select 1 from unnest(v_kader) k
                                      where not exists (select 1 from kader where id = k and team_id = t.team_id)) then
    raise exception 'KADER_NICHT_GEFUNDEN';
  end if;

  if p_reichweite = 'dieser_und_folgende' then
    insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung,
                               felder, erwartete_spielerzahl, version)
    values (s.team_id, v_neu_tage, v_neu_von, v_neu_bis,
            case when v_zeit then v_beginn else s.beginn end,
            case when v_zeit then v_ende else s.ende end,
            case when p_aenderung ? 'ort' then nullif(btrim(p_aenderung->>'ort'), '') else s.ort end,
            case when p_aenderung ? 'bemerkung' then nullif(btrim(p_aenderung->>'bemerkung'), '') else s.bemerkung end,
            case when v_mit_felder then v_felder else s.felder end,
            case when v_mit_zahl then v_zahl else s.erwartete_spielerzahl end,
            s.version + 1)
    returning id into x;
    -- PC 2: Die Teilserie übernimmt die bisherigen Vorgaben; die Änderung
    -- schreibt sie unten fort.
    perform serie_angaben_teilen(s.id, x);
    insert into termin_serien_kader (serie_id, kader_id, team_id)
    select x, k, s.team_id from unnest(coalesce(v_kader,
                     array(select sk.kader_id from termin_serien_kader sk where sk.serie_id = s.id))) k;
    update training_termine set serie_id = x where serie_id = s.id and datum >= t.datum;
    update termin_serien_luecken set serie_id = x where serie_id = s.id and tag >= t.datum;
    if exists (select 1 from training_termine where serie_id = s.id) then
      update termin_serien
         set end_datum = t.datum - 1, beginn_datum = least(beginn_datum, t.datum - 1)
       where id = s.id;
    else
      delete from termin_serien where id = s.id;
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
      bemerkung = case when p_aenderung ? 'bemerkung' then nullif(btrim(p_aenderung->>'bemerkung'), '') else bemerkung end,
      felder = case when v_mit_felder then v_felder else felder end,
      erwartete_spielerzahl = case when v_mit_zahl then v_zahl else erwartete_spielerzahl end
    where id = x;
    if v_kader is not null then
      delete from termin_serien_kader where serie_id = x;
      insert into termin_serien_kader (serie_id, kader_id, team_id) select x, k, s.team_id from unnest(v_kader) k;
    end if;
  end if;

  -- 1) Wochentage.
  v_weg := array(select w from unnest(v_alt_tage) w where w <> all(v_neu_tage));
  v_dazu := array(select w from unnest(v_neu_tage) w where w <> all(v_alt_tage));
  v_tausch := cardinality(v_weg) = 1 and cardinality(v_dazu) = 1;
  if v_tausch then
    for r in select id, datum, serien_tag from training_termine
              where serie_id = x and extract(isodow from datum)::smallint = v_weg[1]
              order by datum, beginn nulls last, created_at loop
      v_ziel := r.datum + (v_dazu[1] - v_weg[1]);
      if v_ziel < v_neu_von or v_ziel > v_neu_bis
         or exists (select 1 from training_termine o
                     where o.serie_id = x and o.datum = v_ziel and o.id <> r.id)
         or (r.datum >= v_heute and v_ziel < v_heute) then
        v_entfallend := v_entfallend || r.id;
      else
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

  -- 2) Verkleinerter Zeitraum.
  if v_neu_von > v_alt_von or v_neu_bis < v_alt_bis then
    v_entfallend := v_entfallend || array(
      select id from training_termine
       where serie_id = x and (datum < v_neu_von or datum > v_neu_bis));
  end if;
  v_entfallend := array(select distinct e from unnest(v_entfallend) e);

  -- 3) Vorab-Auskunft prüfen.
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

  -- 4) Löschen.
  v_vergangen := v_vergangen || array(
    select id from training_termine where id = any(v_entfallend) and datum < v_heute);
  delete from training_termine where id = any(v_entfallend);

  -- 5) Werte übernehmen.
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
  if v_mit_felder then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not felder_abweichend or id = p_termin) and datum < v_heute
         and felder is distinct from v_felder);
    update training_termine set felder = v_felder, felder_abweichend = false
     where serie_id = x and (not felder_abweichend or id = p_termin);
  end if;
  if v_mit_zahl then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not spielerzahl_abweichend or id = p_termin) and datum < v_heute
         and erwartete_spielerzahl is distinct from v_zahl);
    update training_termine set erwartete_spielerzahl = v_zahl, spielerzahl_abweichend = false
     where serie_id = x and (not spielerzahl_abweichend or id = p_termin);
  end if;
  -- Eingeladene und Verantwortung (#519) — und, was die Bausteine später
  -- dazulernen.
  v_vergangen := v_vergangen || serie_angaben_anwenden(x, p_termin, p_aenderung, v_heute);
  if v_kader is not null then
    delete from termin_kader k using training_termine tt
     where k.termin_id = tt.id and tt.serie_id = x and (not tt.kader_abweichend or tt.id = p_termin)
       and not termin_begonnen(tt.datum, tt.beginn);
    insert into termin_kader (termin_id, kader_id, team_id)
    select tt.id, k, tt.team_id from training_termine tt cross join unnest(v_kader) k
     where tt.serie_id = x and (not tt.kader_abweichend or tt.id = p_termin)
       and not termin_begonnen(tt.datum, tt.beginn);
    update training_termine set kader_abweichend = false
     where id = p_termin and not termin_begonnen(datum, beginn);
  end if;

  -- 6) Hinzugekommene Tage, mit den Vorgaben und Kadern der Serie.
  with neu as (
    insert into training_termine (team_id, serie_id, serien_tag, datum, beginn, ende, ort, bemerkung,
                                  felder, erwartete_spielerzahl)
    select ts.team_id, x, d, d, ts.beginn, ts.ende, ts.ort, ts.bemerkung, ts.felder, ts.erwartete_spielerzahl
      from termin_serien ts, serien_tage(v_neu_tage, v_neu_von, v_neu_bis) d
     where ts.id = x
       and not exists (select 1 from serien_tage(case when v_tausch then v_neu_tage else v_alt_tage end,
                                                 v_alt_von, v_alt_bis) a where a = d)
       and not exists (select 1 from termin_serien_luecken l where l.serie_id = x and l.tag = d)
       and not exists (select 1 from training_termine o where o.serie_id = x and o.serien_tag = d)
       and not exists (select 1 from training_termine o where o.serie_id = x and o.datum = d)
    returning id, datum, team_id),
  eingeteilt as (
    insert into termin_kader (termin_id, kader_id, team_id)
    select n.id, sk.kader_id, n.team_id from neu n join termin_serien_kader sk on sk.serie_id = x
    returning 1)
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(id) filter (where datum < v_heute), '{}')
    into v_neu_ids, v_neu_vergangen from neu;
  perform serie_angaben_neue_termine(x, v_neu_ids);
  v_vergangen := v_vergangen || v_neu_vergangen;

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

-- ── Wieder der Serie folgen: Eingeladene und Verantwortung je für sich (AK 14) ──
drop function termin_der_serie_folgen(uuid, text[], integer);
create function termin_der_serie_folgen(p_termin uuid, p_angaben text[], p_bestaetigt integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  s termin_serien;
  v_kader boolean;
  v_verfallen integer := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if p_angaben is null or cardinality(p_angaben) = 0
     or not (p_angaben <@ array['zeit', 'ort', 'bemerkung', 'datum', 'eingeladene', 'verantwortung',
                                'felder', 'spielerzahl', 'kader']) then
    raise exception 'SERIE_ANGABEN_UNGUELTIG';
  end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if 'datum' = any(p_angaben) then raise exception 'DATUM_FOLGT_NICHT'; end if;
  v_kader := 'kader' = any(p_angaben);
  if v_kader and termin_begonnen(t.datum, t.beginn) then raise exception 'KADER_TERMIN_BEGONNEN'; end if;
  if v_kader then perform kader_vorher(t.team_id); end if;
  select * into s from termin_serien where id = t.serie_id;
  update training_termine set
    beginn = case when 'zeit' = any(p_angaben) then s.beginn else beginn end,
    ende = case when 'zeit' = any(p_angaben) then s.ende else ende end,
    zeit_abweichend = zeit_abweichend and not ('zeit' = any(p_angaben)),
    ort = case when 'ort' = any(p_angaben) then s.ort else ort end,
    ort_abweichend = ort_abweichend and not ('ort' = any(p_angaben)),
    bemerkung = case when 'bemerkung' = any(p_angaben) then s.bemerkung else bemerkung end,
    bemerkung_abweichend = bemerkung_abweichend and not ('bemerkung' = any(p_angaben)),
    eingeladene_abweichend = eingeladene_abweichend and not ('eingeladene' = any(p_angaben)),
    verantwortung_abweichend = verantwortung_abweichend and not ('verantwortung' = any(p_angaben)),
    felder = case when 'felder' = any(p_angaben) then s.felder else felder end,
    felder_abweichend = felder_abweichend and not ('felder' = any(p_angaben)),
    erwartete_spielerzahl = case when 'spielerzahl' = any(p_angaben) then s.erwartete_spielerzahl else erwartete_spielerzahl end,
    spielerzahl_abweichend = spielerzahl_abweichend and not ('spielerzahl' = any(p_angaben)),
    kader_abweichend = kader_abweichend and not v_kader
  where id = p_termin;
  -- Eingeladene der Serie: Wer nicht in ihr steht, fällt weg — auch die
  -- Verantwortliche (Ausladen wirkt immer).
  if 'eingeladene' = any(p_angaben) then
    delete from termin_trainer tr
     where tr.termin_id = t.id
       and (tr.user_id is null or not exists (
             select 1 from termin_serien_trainer st where st.serie_id = s.id and st.user_id = tr.user_id));
    insert into termin_trainer (termin_id, user_id)
    select t.id, st.user_id from termin_serien_trainer st where st.serie_id = s.id
    on conflict (termin_id, user_id) do nothing;
  end if;
  -- Verantwortung der Serie: lädt ein (PC 13); ohne Verantwortliche der Serie
  -- hat der Termin danach keine.
  if 'verantwortung' = any(p_angaben) then
    perform trainer_verantwortlich_setzen(t.id,
      (select st.user_id from termin_serien_trainer st where st.serie_id = s.id and st.verantwortlich));
  end if;
  if v_kader then
    delete from termin_kader where termin_id = t.id;
    insert into termin_kader (termin_id, kader_id, team_id)
    select t.id, sk.kader_id, t.team_id from termin_serien_kader sk where sk.serie_id = s.id;
    v_verfallen := kader_nachher(t.team_id, p_bestaetigt);
  end if;
  return jsonb_build_object('team', t.team_id, 'training', t.training_id, 'verfallen', v_verfallen);
end;
$$;
revoke all on function termin_der_serie_folgen(uuid, text[], integer) from public, anon;
grant execute on function termin_der_serie_folgen(uuid, text[], integer) to authenticated;

-- Der bisherige Weg entfällt; die alten Tabellen bleiben ungenutzt stehen.
drop function termin_verantwortliche_setzen(uuid, uuid[], uuid[]);

-- ── Austreten und Konto löschen (PC 6–9) ────────────────────────────────────
-- Austreten trägt aus allen anstehenden Terminen und aus den Serien des Teams
-- aus; war die Person verantwortlich, steht der Termin ohne Verantwortliche:n
-- da (PC 7). Vergangene Termine behalten den Eintrag mit aktuellem Namen (PC 8).
create or replace function mitglied_austragen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from termin_trainer tr
   using training_termine t
   where tr.termin_id = t.id and t.team_id = old.team_id
     and tr.user_id = old.user_id and t.datum >= heute_am_trainingsort();
  delete from termin_serien_trainer st
   using termin_serien s
   where st.serie_id = s.id and s.team_id = old.team_id and st.user_id = old.user_id;
  -- Die alten Tabellen bis zu ihrem Wegfall mitpflegen.
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

-- Wer einen vergangenen Termin auf heute oder später verlegt, trägt ehemalige
-- Mitglieder aus ihm aus.
create or replace function ehemalige_austragen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if old.datum < heute_am_trainingsort() and new.datum >= heute_am_trainingsort() then
    delete from termin_trainer tr
     where tr.termin_id = new.id
       and (tr.user_id is null or not exists (
             select 1 from team_members m where m.team_id = new.team_id and m.user_id = tr.user_id));
    delete from termin_verantwortliche v
     where v.termin_id = new.id
       and (v.user_id is null or not exists (
             select 1 from team_members m where m.team_id = new.team_id and m.user_id = v.user_id));
  end if;
  return new;
end;
$$;

-- Konto löschen: anstehende Termine und Serien austragen, vergangene Einträge
-- ohne Namen erhalten (PC 9) — auch in Teams, die die Person schon verlassen
-- hat. Der Rest ist unverändert (Migration termin_verantwortliche).
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

  delete from termin_trainer tr using training_termine t
   where tr.termin_id = t.id and tr.user_id = v_uid and t.datum >= heute_am_trainingsort();
  delete from termin_serien_trainer where user_id = v_uid;
  update termin_trainer set user_id = null where user_id = v_uid;
  -- Die alten Tabellen bis zu ihrem Wegfall ebenso.
  delete from termin_verantwortliche v using training_termine t
   where v.termin_id = t.id and v.user_id = v_uid and t.datum >= heute_am_trainingsort();
  delete from termin_serien_verantwortliche where user_id = v_uid;
  update termin_verantwortliche set user_id = null where user_id = v_uid;

  delete from exercise_favorites where user_id = v_uid;

  update exercises set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from exercises where owner_id = v_uid and visibility = 'private';

  update trainings set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from trainings where owner_id = v_uid;
end;
$$;
revoke all on function delete_account() from public, anon;
grant execute on function delete_account() to authenticated;

reset lock_timeout;
