-- Treffpunkt für Trainingstermine (#561).
--
-- Ein Trainingstermin trägt höchstens einen Treffpunkt aus Uhrzeit und Ort
-- (AK 3, 4, 6; TS-Zwillinge in lib/termin.ts). Gespeichert ist der Abstand zum
-- Beginn, damit er beim Verlegen mitwandert (PC 1) — wie bei den Treffpunkten
-- eines Spiels (`spiel_treffpunkte.vorlauf_min`), aber am Termintag und nicht
-- nach dem Beginn (AK 5; `treffpunkt_passt`). Eine Serie gibt ihn ihren
-- Terminen mit, ein Termin weicht ab oder ist bewusst ohne und folgt über
-- «der Serie folgen» wieder (AK 2, 7–9; PC 2, 3) — Zeit und Ort sind eine
-- Angabe mit eigenem Merker, Muster wie der Hinweis für Eltern (#590).
--
-- Läge er nach einer Zeitänderung vor dem Termintag, entfällt er an denselben
-- Terminen, für die die Änderung gilt (PC 4): ausdrücklich an jeder Stelle, die
-- den Beginn schreibt (terminserie_rechnen, termin_der_serie_folgen; den
-- einzelnen Termin schreibt der Fachkern). Der CHECK `*_treffpunkt_termintag`
-- lässt eine übersehene Stelle laut scheitern. Die Serienrechnung meldet die
-- anstehenden Termine ohne Treffpunkt (PC 5), und die Vorab-Auskunft zählt sie
-- in den Verfall, damit eine zwischenzeitliche Änderung auffällt.
--
-- Die Spielervertretung sieht ihn am privaten Link und im Abo wie die
-- Treffpunkte eines Spiels (AK 12, 13). Neue, freiwillige Spalten ohne
-- Bestand: Die CHECKs gelten sofort.

set lock_timeout = '5s';

-- Liegt ein Treffpunkt `p_vorlauf` Minuten vor `p_beginn` am selben Tag?
-- Ohne Treffpunkt wahr. TS-Zwilling `treffpunktPasst` in lib/termin.ts.
create function treffpunkt_passt(p_vorlauf integer, p_beginn time) returns boolean
language sql immutable
set search_path = ''
as $$
  select p_vorlauf is null
      or p_vorlauf between 0 and (extract(hour from p_beginn) * 60 + extract(minute from p_beginn))::integer
$$;
revoke all on function treffpunkt_passt(integer, time) from public, anon;
grant execute on function treffpunkt_passt(integer, time) to authenticated, service_role;

alter table training_termine
  add column treffpunkt_vorlauf_min smallint,
  add column treffpunkt_ort text,
  add column treffpunkt_abweichend boolean not null default false,
  add constraint tt_treffpunkt_angabe check ((treffpunkt_vorlauf_min is null) = (treffpunkt_ort is null)
    and (treffpunkt_ort is null or char_length(treffpunkt_ort) between 1 and 100)),
  add constraint tt_treffpunkt_termintag check (treffpunkt_passt(treffpunkt_vorlauf_min, beginn)),
  add constraint tt_treffpunkt_art check (treffpunkt_vorlauf_min is null or art = 'training');

alter table termin_serien
  add column treffpunkt_vorlauf_min smallint,
  add column treffpunkt_ort text,
  add constraint ts_treffpunkt_angabe check ((treffpunkt_vorlauf_min is null) = (treffpunkt_ort is null)
    and (treffpunkt_ort is null or char_length(treffpunkt_ort) between 1 and 100)),
  add constraint ts_treffpunkt_termintag check (treffpunkt_passt(treffpunkt_vorlauf_min, beginn));

-- ── Bausteine der Serienrechnung (aus hinweis_eltern, um `treffpunkt` erweitert) ──

create or replace function serie_angaben_teilen(p_alt uuid, p_neu uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into termin_serien_trainer (serie_id, user_id, verantwortlich)
  select p_neu, user_id, verantwortlich from termin_serien_trainer where serie_id = p_alt;
  update termin_serien n set besetzung_art = a.besetzung_art, besetzung_zahl = a.besetzung_zahl,
                           ort_link = case when n.ort is not distinct from a.ort then a.ort_link end,
                           hinweis_eltern = a.hinweis_eltern,
                           -- #561: der Treffpunkt der Serie, solange er am Tag der Teilserie liegt.
                           treffpunkt_vorlauf_min = case when treffpunkt_passt(a.treffpunkt_vorlauf_min, n.beginn)
                                                         then a.treffpunkt_vorlauf_min end,
                           treffpunkt_ort = case when treffpunkt_passt(a.treffpunkt_vorlauf_min, n.beginn)
                                                 then a.treffpunkt_ort end
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
  v_mit_treffpunkt boolean := p_aenderung ? 'treffpunkt';
  v_tp_min smallint := (p_aenderung->'treffpunkt'->>'vorlauf_min')::smallint;
  v_tp_ort text := nullif(btrim(p_aenderung->'treffpunkt'->>'ort'), '');
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
  -- Kartenlink (#533 PC 1–3): gehört zum Ort der Serie. Die Anwendung
  -- schickt ihn mit jeder Ortsänderung mit (null = weg); er geht an die
  -- Termine, die dem Ort der Serie folgen, und in jedem Fall an den gewählten.
  if p_aenderung ? 'ort_link' then
    update termin_serien set ort_link = nullif(btrim(p_aenderung->>'ort_link'), '') where id = p_serie;
    v_vergangen := v_vergangen || array(
      select tt.id from training_termine tt
       where tt.serie_id = p_serie and (not tt.ort_abweichend or tt.id = p_termin) and tt.datum < p_heute
         and tt.ort_link is distinct from (select ort_link from termin_serien where id = p_serie));
    update training_termine tt set ort_link = s.ort_link
      from termin_serien s
     where s.id = p_serie and tt.serie_id = p_serie and (not tt.ort_abweichend or tt.id = p_termin);
  end if;
  -- Hinweis für Eltern (#590 AK 2, 3; PC 3): wie die Bemerkung — an die
  -- Serie, an die Termine ohne eigenen Hinweis und in jedem Fall an den
  -- gewählten, der danach wieder der Serie folgt.
  if p_aenderung ? 'hinweis_eltern' then
    update termin_serien set hinweis_eltern = nullif(btrim(p_aenderung->>'hinweis_eltern'), '') where id = p_serie;
    v_vergangen := v_vergangen || array(
      select tt.id from training_termine tt
       where tt.serie_id = p_serie and (not tt.hinweis_eltern_abweichend or tt.id = p_termin) and tt.datum < p_heute
         and tt.hinweis_eltern is distinct from (select hinweis_eltern from termin_serien where id = p_serie));
    update training_termine tt set hinweis_eltern = s.hinweis_eltern, hinweis_eltern_abweichend = false
      from termin_serien s
     where s.id = p_serie and tt.serie_id = p_serie and (not tt.hinweis_eltern_abweichend or tt.id = p_termin);
  end if;
  -- Treffpunkt (#561 AK 2, 7, 8; PC 2, 3): wie der Hinweis — an die Serie, an
  -- die Termine ohne eigenen Treffpunkt und in jedem Fall an den gewählten,
  -- der danach wieder der Serie folgt. Läge er an einem Termin mit eigener,
  -- früherer Zeit vor dem Termintag, bleibt dieser ohne und weicht ab.
  if v_mit_treffpunkt then
    update termin_serien set treffpunkt_vorlauf_min = v_tp_min, treffpunkt_ort = v_tp_ort where id = p_serie;
    v_vergangen := v_vergangen || array(
      select tt.id from training_termine tt
       where tt.serie_id = p_serie and (not tt.treffpunkt_abweichend or tt.id = p_termin) and tt.datum < p_heute
         and (tt.treffpunkt_vorlauf_min, tt.treffpunkt_ort) is distinct from (v_tp_min, v_tp_ort));
    update training_termine tt set
      treffpunkt_vorlauf_min = case when treffpunkt_passt(v_tp_min, tt.beginn) then v_tp_min end,
      treffpunkt_ort = case when treffpunkt_passt(v_tp_min, tt.beginn) then v_tp_ort end,
      treffpunkt_abweichend = not treffpunkt_passt(v_tp_min, tt.beginn)
     where tt.serie_id = p_serie and (not tt.treffpunkt_abweichend or tt.id = p_termin);
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
  update training_termine t set besetzung_art = s.besetzung_art, besetzung_zahl = s.besetzung_zahl,
                               ort_link = s.ort_link, hinweis_eltern = s.hinweis_eltern,
                               treffpunkt_vorlauf_min = s.treffpunkt_vorlauf_min, treffpunkt_ort = s.treffpunkt_ort
    from termin_serien s where s.id = p_serie and t.id = any(p_termine);
end;
$$;
revoke all on function serie_angaben_neue_termine(uuid, uuid[]) from public, anon, authenticated;

-- ── Serie festlegen mit Treffpunkt (AK 2) ────────────────────────────────────
-- Vollständiger Rumpf aus hinweis_eltern; neu ist `p_treffpunkt` ({vorlauf_min, ort}).
drop function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[], jsonb, text, text);
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
  p_besetzung jsonb default null,
  p_ort_link text default null,
  p_hinweis_eltern text default null,
  p_treffpunkt jsonb default null)
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
  v_tp_min smallint := (nullif(p_treffpunkt, 'null'::jsonb)->>'vorlauf_min')::smallint;
  v_tp_ort text := nullif(btrim(nullif(p_treffpunkt, 'null'::jsonb)->>'ort'), '');
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
  if not treffpunkt_passt(v_tp_min, p_beginn) then raise exception 'TREFFPUNKT_TERMINTAG'; end if;
  if not alle_mitglieder(p_team, v_eingeladene) then raise exception 'NICHT_MEHR_MITGLIED'; end if;
  if exists (select 1 from unnest(v_kader) k where not exists (select 1 from kader where id = k and team_id = p_team)) then
    raise exception 'KADER_NICHT_GEFUNDEN';
  end if;

  insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung,
                             felder, erwartete_spielerzahl, besetzung_art, besetzung_zahl, ort_link, hinweis_eltern,
                             treffpunkt_vorlauf_min, treffpunkt_ort)
  values (p_team,
          (select array_agg(w order by w) from unnest(p_wochentage) w),
          p_von, p_bis, p_beginn, p_ende,
          nullif(btrim(p_ort), ''), nullif(btrim(p_bemerkung), ''),
          nullif(p_felder, 'null'::jsonb), p_spielerzahl,
          v_besetzung->>'art', (v_besetzung->>'zahl')::smallint,
          nullif(btrim(p_ort_link), ''), nullif(btrim(p_hinweis_eltern), ''),
          v_tp_min, v_tp_ort)
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
revoke all on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[], jsonb, text, text, jsonb) from public, anon;
grant execute on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[], jsonb, text, text, jsonb) to authenticated;

-- ── Serie ändern: Treffpunkt entfällt mit der Zeit (PC 4, 5) ───────────────
-- Vollständiger Rumpf aus trainer_einladen.
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
  v_tp_weg uuid[] := '{}';
  v_tp_liste jsonb;
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
      erwartete_spielerzahl = case when v_mit_zahl then v_zahl else erwartete_spielerzahl end,
      -- #561 PC 4: Läge der Treffpunkt mit dem neuen Beginn vor dem Termintag, entfällt er.
      treffpunkt_vorlauf_min = case when v_zeit and not treffpunkt_passt(treffpunkt_vorlauf_min, v_beginn)
                                    then null else treffpunkt_vorlauf_min end,
      treffpunkt_ort = case when v_zeit and not treffpunkt_passt(treffpunkt_vorlauf_min, v_beginn)
                            then null else treffpunkt_ort end
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
    -- #561 PC 4: An denselben Terminen entfällt ein Treffpunkt, der mit dem
    -- neuen Beginn vor dem Termintag läge; ein eigener bleibt als «ohne» abweichend.
    v_tp_weg := array(
      select id from training_termine
       where serie_id = x and (not zeit_abweichend or id = p_termin) and datum >= v_heute
         and not treffpunkt_passt(treffpunkt_vorlauf_min, v_beginn));
    update training_termine set beginn = v_beginn, ende = v_ende, zeit_abweichend = false,
           treffpunkt_vorlauf_min = case when treffpunkt_passt(treffpunkt_vorlauf_min, v_beginn) then treffpunkt_vorlauf_min end,
           treffpunkt_ort = case when treffpunkt_passt(treffpunkt_vorlauf_min, v_beginn) then treffpunkt_ort end
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

  -- #561 PC 5: die anstehenden Termine, deren Treffpunkt die Zeitänderung
  -- nimmt — nicht die, denen dieselbe Änderung einen neuen gibt oder deren
  -- Treffpunkt sie ausdrücklich entfernt.
  v_tp_liste := coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'datum', datum) order by datum, beginn)
      from training_termine
     where id = any(v_tp_weg) and treffpunkt_vorlauf_min is null
       and (not p_aenderung ? 'treffpunkt' or treffpunkt_abweichend)), '[]'::jsonb);

  if not exists (select 1 from training_termine where serie_id = x) then
    delete from termin_serien where id = x;
    x := null;
  end if;

  return jsonb_build_object(
    'serie', x,
    'version_vorher', v_version_vorher,
    'entfallend', v_liste,
    'entfallend_anzahl', cardinality(v_entfallend),
    'vergangene', (select count(distinct v) from unnest(v_vergangen) v),
    'treffpunkt_entfallend', v_tp_liste);
end;
$$;
revoke all on function terminserie_rechnen(uuid, text, jsonb, integer, uuid[]) from public, anon, authenticated;

-- Rumpf aus probetraining; die entfallenden Treffpunkte zählen in den Verfall,
-- den die Vorschau bestätigen liess.
create or replace function terminserie_aendern(
  p_termin uuid,
  p_reichweite text,
  p_aenderung jsonb,
  p_version integer default null,
  p_entfallend uuid[] default null,
  p_ausfuehren boolean default true,
  p_verfallend integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
  v_team uuid;
  v_verlegt integer;
  v_verlegt_an integer;
  v_kader integer[];
  v_vorher jsonb;
  v_nachtraege integer;
  v_absagen_vorher jsonb;
  v_absagen integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  select coalesce(jsonb_object_agg(termin_id, n), '{}') into v_vorher
    from (select termin_id, count(*) as n from termin_teilnahmen
           where team_id = v_team and nachgetragen and spieler_id is not null group by termin_id) x;
  select coalesce(jsonb_agg(jsonb_build_object('id', tr.id)), '[]') into v_absagen_vorher
    from termin_trainer tr join training_termine t on t.id = tr.termin_id
   where t.team_id = v_team and tr.abgesagt_am is not null;
  if p_ausfuehren then
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, p_entfallend);
    select count(*) filter (where not angemeldet), count(*) filter (where angemeldet)
      into v_verlegt, v_verlegt_an
      from termin_abmeldungen where team_id = v_team and verfallen_am = now();
    v_kader := kader_bereinigen_teile(v_team);
    v_nachtraege := serie_nachtraege_verfallen(v_vorher);
    v_absagen := serie_absagen_verfallen(v_absagen_vorher);
    if p_verfallend is not null
       and p_verfallend <> v_verlegt + v_verlegt_an + v_kader[1] + v_kader[2] + v_kader[3] + v_kader[4]
                          + v_nachtraege + v_absagen
                          + coalesce(jsonb_array_length(v -> 'treffpunkt_entfallend'), 0) then
      raise exception 'SERIE_VERFALL_GEAENDERT';
    end if;
    return v || jsonb_build_object('abmeldungen_verfallend', v_verlegt,
                                   'abmeldungen_kader', v_kader[1] + v_kader[3] + v_kader[4],
                                   'anmeldungen_verfallend', v_verlegt_an + v_kader[2],
                                   'nachtraege_verfallend', v_nachtraege, 'absagen_verfallend', v_absagen);
  end if;
  begin
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, null);
    select count(*) filter (where not angemeldet), count(*) filter (where angemeldet)
      into v_verlegt, v_verlegt_an
      from termin_abmeldungen where team_id = v_team and verfallen_am = now();
    v_kader := kader_bereinigen_teile(v_team);
    v := v || jsonb_build_object('abmeldungen_verfallend', v_verlegt,
                                 'abmeldungen_kader', v_kader[1] + v_kader[3] + v_kader[4],
                                 'anmeldungen_verfallend', v_verlegt_an + v_kader[2],
                                 'nachtraege_verfallend', serie_nachtraege_verfallen(v_vorher),
                                 'absagen_verfallend', serie_absagen_verfallen(v_absagen_vorher));
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;

-- ── Wieder der Serie folgen: auch der Treffpunkt (AK 9; PC 4, 6) ──────────
-- Vollständiger Rumpf aus hinweis_eltern.
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
  v_beginn time;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if p_angaben is null or cardinality(p_angaben) = 0
     or not (p_angaben <@ array['zeit', 'ort', 'bemerkung', 'hinweis_eltern', 'treffpunkt', 'datum', 'eingeladene', 'verantwortung',
                                'besetzung', 'felder', 'spielerzahl', 'kader']) then
    raise exception 'SERIE_ANGABEN_UNGUELTIG';
  end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if 'datum' = any(p_angaben) then raise exception 'DATUM_FOLGT_NICHT'; end if;
  v_kader := 'kader' = any(p_angaben);
  if v_kader and termin_begonnen(t.datum, t.beginn) then raise exception 'KADER_TERMIN_BEGONNEN'; end if;
  if v_kader then perform kader_vorher(t.team_id); end if;
  select * into s from termin_serien where id = t.serie_id;
  -- #561: Der Treffpunkt liegt am Termintag, nicht nach dem Beginn, den der
  -- Termin danach hat. Folgt nur die Zeit, entfällt ein eigener, der davor
  -- läge (PC 4) — der Termin bleibt dann bewusst ohne.
  v_beginn := case when 'zeit' = any(p_angaben) then s.beginn else t.beginn end;
  if 'treffpunkt' = any(p_angaben) and not treffpunkt_passt(s.treffpunkt_vorlauf_min, v_beginn) then
    raise exception 'TREFFPUNKT_TERMINTAG';
  end if;
  update training_termine set
    beginn = case when 'zeit' = any(p_angaben) then s.beginn else beginn end,
    ende = case when 'zeit' = any(p_angaben) then s.ende else ende end,
    zeit_abweichend = zeit_abweichend and not ('zeit' = any(p_angaben)),
    ort = case when 'ort' = any(p_angaben) then s.ort else ort end,
    ort_link = case when 'ort' = any(p_angaben) then s.ort_link else ort_link end,
    ort_abweichend = ort_abweichend and not ('ort' = any(p_angaben)),
    bemerkung = case when 'bemerkung' = any(p_angaben) then s.bemerkung else bemerkung end,
    bemerkung_abweichend = bemerkung_abweichend and not ('bemerkung' = any(p_angaben)),
    hinweis_eltern = case when 'hinweis_eltern' = any(p_angaben) then s.hinweis_eltern else hinweis_eltern end,
    hinweis_eltern_abweichend = hinweis_eltern_abweichend and not ('hinweis_eltern' = any(p_angaben)),
    treffpunkt_vorlauf_min = case when 'treffpunkt' = any(p_angaben) then s.treffpunkt_vorlauf_min
                                  when treffpunkt_passt(treffpunkt_vorlauf_min, v_beginn) then treffpunkt_vorlauf_min end,
    treffpunkt_ort = case when 'treffpunkt' = any(p_angaben) then s.treffpunkt_ort
                          when treffpunkt_passt(treffpunkt_vorlauf_min, v_beginn) then treffpunkt_ort end,
    treffpunkt_abweichend = case when 'treffpunkt' = any(p_angaben) then false
                                 when not treffpunkt_passt(treffpunkt_vorlauf_min, v_beginn) then true
                                 else treffpunkt_abweichend end,
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
  -- #533 AK 13, 14: Ein eigener Kartenlink des Termins fällt mit dem Ort weg;
  -- #561 PC 6: ebenso ein eigener Treffpunkt, der vor dem Termintag läge.
  return jsonb_build_object('team', t.team_id, 'training', t.training_id, 'verfallen', v_verfallen,
    'kartenlink_entfallen', 'ort' = any(p_angaben) and t.ort_link is not null and t.ort_link is distinct from s.ort_link,
    'treffpunkt_entfallen', not ('treffpunkt' = any(p_angaben)) and not treffpunkt_passt(t.treffpunkt_vorlauf_min, v_beginn));
end;
$$;
revoke all on function termin_der_serie_folgen(uuid, text[], integer) from public, anon;
grant execute on function termin_der_serie_folgen(uuid, text[], integer) to authenticated;

-- ── Privater Link (AK 12) — Rumpf aus hinweis_eltern ─────────────────────────
create or replace function spieler_link_ansicht(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  s spieler;
  v_team text;
begin
  select * into s from spieler where link_token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  select name into v_team from teams where id = s.team_id;
  return jsonb_build_object(
    'gueltig', true,
    'team', v_team,
    'spieler', jsonb_build_object('vorname', s.vorname, 'nachname', s.nachname),
    -- #555 AK 11: der Stand einer Probe-Spieler:in, sonst null.
    'probe', probe_stand(s.id),
    -- #556 AK 4; PC 1: das Info-Schreiben, nur im Probe-Modus.
    'probe_info', case when s.probe_seit is not null
                       then (select i.info from team_probetraining i where i.team_id = s.team_id) end,
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'datum', t.datum,
               'beginn', to_char(t.beginn, 'HH24:MI'), 'ende', to_char(t.ende, 'HH24:MI'),
               'ort', t.ort, 'ausgefallen', t.ausgefallen,
               -- #533 AK 6, 7: der Kartenlink zum Ort, an einem ausgefallenen Termin nicht.
               'ort_link', case when t.ausgefallen then null else t.ort_link end,
               -- #530 AK 1, 2; PC 2: der Grund des Ausfalls, vollständig; null ohne Grund
               -- (tt_ausfall_grund lässt ihn nur an einem ausgefallenen Termin zu).
               'ausfall_grund', t.ausfall_grund,
               'art', t.art, 'bezeichnung', t.bezeichnung,
               'richtwert_min', t.richtwert_min, 'richtwert_max', t.richtwert_max,
               'begonnen', termin_begonnen(t.datum, t.beginn),
               'angemeldet', case when t.ausgefallen then null else (x.stand ->> 'angemeldet')::int end,
               -- #472 AK 1, 2: von wie vielen — dieselbe Zahl wie für die Mitglieder.
               'gesamt', case when t.ausgefallen then null else (x.stand ->> 'gesamt')::int end,
               'abgemeldet', case
                 when t.art = 'spiel' then false
                 when x.fest then
                   coalesce((select p.abgemeldet from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id), false)
                 else training_abgemeldet(t.id, s.id)
               end,
               -- #555 PC 5: `anmeldung`, wenn eine Anmeldung verfallen ist.
               'verfallen', case when t.art = 'spiel' then null else
                              (select jsonb_build_object('datum', a.vorher_datum, 'beginn', to_char(a.vorher_beginn, 'HH24:MI'),
                                                         'anmeldung', a.angemeldet)
                                 from termin_abmeldungen a
                                where a.termin_id = t.id and a.spieler_id = s.id and a.verfallen_am is not null
                                  and not termin_begonnen(t.datum, t.beginn)) end,
               -- Spiele (#463): Meldung (null = ohne), verfallen, Frist, vorher.
               'meldung', case when t.art <> 'spiel' then null
                               when x.fest then (select p.zustand from spiel_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                               else (select m.zustand from spiel_meldungen m where m.termin_id = t.id and m.spieler_id = s.id) end,
               'meldung_verfallen', t.art = 'spiel' and not x.fest and not termin_begonnen(t.datum, t.beginn)
                                    and coalesce((select m.verfallen from spiel_meldungen m
                                                   where m.termin_id = t.id and m.spieler_id = s.id), false),
               'frist', to_char(spiel_frist(t), 'YYYY-MM-DD"T"HH24:MI'),
               'frist_abgelaufen', t.art = 'spiel' and spiel_frist_abgelaufen(t),
               'vorher', case when t.art = 'spiel' and t.vorher_datum is not null and not termin_begonnen(t.datum, t.beginn)
                              then jsonb_build_object('datum', t.vorher_datum, 'beginn', to_char(t.vorher_beginn, 'HH24:MI')) end,
               -- #464 AK 8, 9; PC 3: ob sie nicht aufgeboten ist, ob die Kennzeichnung
               -- mit einer Verlegung verfallen ist, und wie viele es nicht sind.
               'nicht_aufgeboten', t.art = 'spiel' and coalesce(case
                                     when x.fest then (select p.nicht_aufgeboten from spiel_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                                     else (select m.nicht_aufgeboten from spiel_meldungen m where m.termin_id = t.id and m.spieler_id = s.id) end, false),
               'aufgebot_verfallen', t.art = 'spiel' and not x.fest and not termin_begonnen(t.datum, t.beginn)
                                     and coalesce((select m.aufgebot_verfallen from spiel_meldungen m
                                                    where m.termin_id = t.id and m.spieler_id = s.id), false),
               'nicht_aufgeboten_zahl', case when t.art = 'spiel' and not t.ausgefallen then (x.stand ->> 'nicht_aufgeboten')::int end,
               -- #590 AK 9–11, 13: der Hinweis für Eltern an Trainings und Spielen, nur wenn
               -- der Termin stattfindet — ausgefallen spricht der Grund. Die Bemerkung
               -- bleibt beim Team, auch an Spielen.
               'hinweis_eltern', case when not t.ausgefallen then t.hinweis_eltern end,
               -- #465 AK 10: bei Spielen die Treffpunkte, nur wenn es stattfindet.
               'treffpunkte', case when t.art = 'spiel' and not t.ausgefallen then coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'anreise', tp.anreise,
                          'zeitpunkt', to_char((t.datum + t.beginn) - make_interval(mins => tp.vorlauf_min), 'YYYY-MM-DD"T"HH24:MI'),
                          'ort', tp.ort) order by tp.vorlauf_min desc)
                   from spiel_treffpunkte tp where tp.termin_id = t.id), '[]'::jsonb) end,
               -- #561 AK 12: der Treffpunkt eines Trainings, nur wenn es stattfindet;
               -- ab Beginn und bei einer Abmeldung blendet ihn die Ansicht aus.
               'treffpunkt', case when t.art = 'training' and not t.ausgefallen and t.treffpunkt_vorlauf_min is not null
                               then jsonb_build_object(
                                      'zeit', to_char(t.beginn - make_interval(mins => t.treffpunkt_vorlauf_min), 'HH24:MI'),
                                      'ort', t.treffpunkt_ort) end,
               -- AK 2, 3: nur die Kader der Spieler:in, über die er für sie gilt.
               -- #523 AK 1–3: nur die Verantwortliche, mit Anzeigenamen, an einem
               -- Termin, der stattfindet; keine weiteren Trainer:innen, keine Lücken.
               'verantwortlich', case when not t.ausgefallen then
                 (select trainer_name(tr) from termin_trainer tr where tr.termin_id = t.id and tr.verantwortlich) end,
               'kader', coalesce((select jsonb_agg(k.name order by k.name)
                                    from termin_kader tk join kader k on k.id = tk.kader_id
                                    join kader_spieler ks on ks.kader_id = k.id and ks.spieler_id = s.id
                                   where tk.termin_id = t.id), '[]'::jsonb))
             order by t.datum, t.beginn, t.created_at)
        from training_termine t
        cross join lateral (select exists (select 1 from termin_eingefroren f where f.termin_id = t.id) as fest,
                                   spielstand(t) as stand) x
       where t.team_id = s.team_id and t.datum >= heute_am_trainingsort()
         and case when x.fest and t.art = 'spiel' then
                    exists (select 1 from spiel_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                  when x.fest then exists (select 1 from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                  else termin_gilt_fuer(t.id, s.id) end), '[]'::jsonb));
end;
$$;

-- ── Kalender-Abo am privaten Link (AK 13) — Rumpf aus hinweis_eltern ────────
create or replace function spieler_abo_termine(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  a spieler_abos;
  v jsonb;
begin
  select * into a from spieler_abos where token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  v := spieler_link_ansicht((select link_token from spieler where id = a.spieler_id));
  if not coalesce((v ->> 'gueltig')::boolean, false) then return jsonb_build_object('gueltig', false); end if;
  return jsonb_build_object(
    'gueltig', true,
    'abo', a.id,
    'team', v -> 'team',
    'probe', jsonb_typeof(v -> 'probe') = 'object',
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e -> 'id', 'datum', e -> 'datum', 'beginn', e -> 'beginn', 'ende', e -> 'ende',
               'ort', e -> 'ort', 'ort_link', e -> 'ort_link', 'art', e -> 'art', 'bezeichnung', e -> 'bezeichnung',
               'begonnen', e -> 'begonnen', 'abgemeldet', e -> 'abgemeldet',
               'meldung', e -> 'meldung', 'frist_abgelaufen', e -> 'frist_abgelaufen',
               'nicht_aufgeboten', e -> 'nicht_aufgeboten',
               'hinweis_eltern', e -> 'hinweis_eltern', 'treffpunkte', e -> 'treffpunkte',
               'treffpunkt', e -> 'treffpunkt')
             order by x.n)
        from jsonb_array_elements(v -> 'termine') with ordinality as x(e, n)
       where not (e ->> 'ausgefallen')::boolean), '[]'::jsonb));
end;
$$;

reset lock_timeout;
