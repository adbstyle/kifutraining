-- Mindestbesetzung an Terminen und Terminserien (#521).
--
-- Eine Angabe aus zwei Spalten: feste Zahl an Trainer:innen («fest») oder
-- Verhältnis Spieler:innen je Trainer:in («verhaeltnis»), je eine ganze Zahl
-- von 1 bis 99 (AK 5; TS-Zwilling BESETZUNG_MIN/MAX in lib/besetzung.ts).
-- Die nötige Zahl rechnet allein die Anwendung (`noetigeTrainer`), weil sie
-- der angezeigten Spielerzahl folgt (PC 2); die Datenebene hält nur fest.
--
-- An der Serie wie die erwartete Spielerzahl: Vorgabe der Serie, Abweichung
-- je Termin (`besetzung_abweichend`), wieder folgen (AK 3, 4, PC 1). Die
-- Serienrechnung bleibt unberührt; ihre Bausteine serie_angaben_* aus
-- trainer_einladen tragen die Angabe (Schlüssel `besetzung`: `null` =
-- entfernen, sonst {art, zahl}).

set lock_timeout = '5s';

-- Neue, freiwillige Spalten ohne Bestand: Die CHECKs gelten sofort.
alter table training_termine
  add column besetzung_art text,
  add column besetzung_zahl smallint,
  add column besetzung_abweichend boolean not null default false,
  add constraint tt_besetzung check (
    (besetzung_art is null) = (besetzung_zahl is null)
    and (besetzung_art is null or besetzung_art in ('fest', 'verhaeltnis'))
    and (besetzung_zahl is null or besetzung_zahl between 1 and 99));

alter table termin_serien
  add column besetzung_art text,
  add column besetzung_zahl smallint,
  add constraint ts_besetzung check (
    (besetzung_art is null) = (besetzung_zahl is null)
    and (besetzung_art is null or besetzung_art in ('fest', 'verhaeltnis'))
    and (besetzung_zahl is null or besetzung_zahl between 1 and 99));

-- ── Bausteine der Serienrechnung (aus trainer_einladen, um `besetzung` erweitert) ──

create or replace function serie_angaben_teilen(p_alt uuid, p_neu uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into termin_serien_trainer (serie_id, user_id, verantwortlich)
  select p_neu, user_id, verantwortlich from termin_serien_trainer where serie_id = p_alt;
  update termin_serien n set besetzung_art = a.besetzung_art, besetzung_zahl = a.besetzung_zahl
    from termin_serien a where a.id = p_alt and n.id = p_neu;
end;
$$;
revoke all on function serie_angaben_teilen(uuid, uuid) from public, anon, authenticated;

create or replace function serie_angaben_anwenden(p_serie uuid, p_termin uuid, p_aenderung jsonb, p_heute date)
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
  v_mit_besetzung boolean := p_aenderung ? 'besetzung';
  v_art text := p_aenderung->'besetzung'->>'art';
  v_zahl smallint := (p_aenderung->'besetzung'->>'zahl')::smallint;
  v_vergangen uuid[] := '{}';
begin
  if v_mit_verantwortung and v_verantwortlich is null then raise exception 'VERANTWORTUNG_ERSATZLOS'; end if;
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

  -- Mindestbesetzung (#521 PC 1): Vorgabe der Serie, Termine ohne Abweichung
  -- und in jedem Fall der gewählte.
  if v_mit_besetzung then
    update termin_serien set besetzung_art = v_art, besetzung_zahl = v_zahl where id = p_serie;
    v_vergangen := v_vergangen || array(
      select tt.id from training_termine tt
       where tt.serie_id = p_serie and (not tt.besetzung_abweichend or tt.id = p_termin) and tt.datum < p_heute
         and (tt.besetzung_art, tt.besetzung_zahl) is distinct from (v_art, v_zahl));
    update training_termine set besetzung_art = v_art, besetzung_zahl = v_zahl, besetzung_abweichend = false
     where serie_id = p_serie and (not besetzung_abweichend or id = p_termin);
  end if;
  return v_vergangen;
end;
$$;
revoke all on function serie_angaben_anwenden(uuid, uuid, jsonb, date) from public, anon, authenticated;

create or replace function serie_angaben_neue_termine(p_serie uuid, p_termine uuid[]) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into termin_trainer (termin_id, user_id, verantwortlich)
  select n, st.user_id, st.verantwortlich
    from unnest(p_termine) n join termin_serien_trainer st on st.serie_id = p_serie;
  update training_termine t set besetzung_art = s.besetzung_art, besetzung_zahl = s.besetzung_zahl
    from termin_serien s where s.id = p_serie and t.id = any(p_termine);
end;
$$;
revoke all on function serie_angaben_neue_termine(uuid, uuid[]) from public, anon, authenticated;

-- ── Serie festlegen mit Mindestbesetzung (AK 1, 2) ──────────────────────────
-- Vollständiger Rumpf aus trainer_einladen; neu ist `p_besetzung`
-- ({art, zahl} oder null), an die Serie geschrieben — die Termine erhalten
-- sie über serie_angaben_neue_termine.
drop function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[]);
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
  p_kader uuid[] default '{}',
  p_besetzung jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_serie termin_serien;
  v_anzahl integer;
  v_eingeladene uuid[] := array(select distinct u from unnest(
    coalesce(p_eingeladene, '{}') || case when p_verantwortlich is null then '{}'::uuid[] else array[p_verantwortlich] end) u);
  v_kader uuid[] := array(select distinct k from unnest(coalesce(p_kader, '{}')) k);
  v_neu uuid[];
  v_besetzung jsonb := nullif(p_besetzung, 'null'::jsonb);
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if not wochentage_gueltig(p_wochentage) then raise exception 'SERIE_WOCHENTAGE'; end if;
  if p_von is null or p_bis is null then raise exception 'SERIE_OHNE_ZEITRAUM'; end if;
  if p_bis < p_von then raise exception 'SERIE_ENDE_VOR_BEGINN'; end if;
  if p_bis > (p_von + interval '1 year')::date then raise exception 'SERIE_ZU_LANG'; end if;
  if not exists (select 1 from serien_tage(p_wochentage, p_von, p_bis)) then raise exception 'SERIE_OHNE_TAG'; end if;
  if p_beginn is null or p_ende is null or p_ende <= p_beginn then raise exception 'SERIE_ZEIT'; end if;
  if p_verantwortlich is null then raise exception 'VERANTWORTUNG_PFLICHT'; end if;
  if not alle_mitglieder(p_team, v_eingeladene) then raise exception 'NICHT_MEHR_MITGLIED'; end if;
  if exists (select 1 from unnest(v_kader) k where not exists (select 1 from kader where id = k and team_id = p_team)) then
    raise exception 'KADER_NICHT_GEFUNDEN';
  end if;

  insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung,
                             felder, erwartete_spielerzahl, besetzung_art, besetzung_zahl)
  values (p_team,
          (select array_agg(w order by w) from unnest(p_wochentage) w),
          p_von, p_bis, p_beginn, p_ende,
          nullif(btrim(p_ort), ''), nullif(btrim(p_bemerkung), ''),
          nullif(p_felder, 'null'::jsonb), p_spielerzahl,
          v_besetzung->>'art', (v_besetzung->>'zahl')::smallint)
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
revoke all on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[], jsonb) from public, anon;
grant execute on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[], jsonb) to authenticated;

-- ── Wieder der Serie folgen, auch bei der Mindestbesetzung (AK 4) ───────────
-- Vollständiger Rumpf aus trainer_einladen; neu ist die Angabe `besetzung`.
create or replace function termin_der_serie_folgen(p_termin uuid, p_angaben text[], p_bestaetigt integer default null)
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
                                'besetzung', 'felder', 'spielerzahl', 'kader']) then
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
    besetzung_art = case when 'besetzung' = any(p_angaben) then s.besetzung_art else besetzung_art end,
    besetzung_zahl = case when 'besetzung' = any(p_angaben) then s.besetzung_zahl else besetzung_zahl end,
    besetzung_abweichend = besetzung_abweichend and not ('besetzung' = any(p_angaben)),
    felder = case when 'felder' = any(p_angaben) then s.felder else felder end,
    felder_abweichend = felder_abweichend and not ('felder' = any(p_angaben)),
    erwartete_spielerzahl = case when 'spielerzahl' = any(p_angaben) then s.erwartete_spielerzahl else erwartete_spielerzahl end,
    spielerzahl_abweichend = spielerzahl_abweichend and not ('spielerzahl' = any(p_angaben)),
    kader_abweichend = kader_abweichend and not v_kader
  where id = p_termin;
  if 'eingeladene' = any(p_angaben) then
    delete from termin_trainer tr
     where tr.termin_id = t.id
       and (tr.user_id is null or not exists (
             select 1 from termin_serien_trainer st where st.serie_id = s.id and st.user_id = tr.user_id));
    insert into termin_trainer (termin_id, user_id)
    select t.id, st.user_id from termin_serien_trainer st where st.serie_id = s.id
    on conflict (termin_id, user_id) do nothing;
  end if;
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

reset lock_timeout;
