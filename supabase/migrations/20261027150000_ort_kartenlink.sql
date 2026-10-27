-- Kartenlink zum Ort eines Termins oder einer Terminserie (#533).
--
-- Ein Mitglied hinterlegt zum Ort einen Weblink (in der Regel einen geteilten
-- Link aus einer Karten-App). Der Link gehört zum Ort: nur mit Ort (AK 4),
-- nur vollständige https-Adressen bis 500 Zeichen (AK 5; TS-Zwilling
-- `kartenlinkProblem` in lib/termin.ts). Ein geleerter Ort nimmt den Link mit
-- (Trigger unten); einen geänderten Ort ohne neuen Link leert die Anwendung
-- (PC 1), weil nur sie weiss, ob der Link mitgeschickt wurde. Weicht der Ort
-- eines Serientermins ab, gilt der Link der Serie dort nicht (PC 2): Ort und
-- Link teilen sich `ort_abweichend`, und «der Serie folgen» übernimmt beides
-- (PC 3). Spielervertretungen sehen den Link am privaten Link, ausser an
-- einem ausgefallenen Termin (AK 6, 7); beide Kalender-Abos führen ihn mit
-- (PC 4).
--
-- Die Serienrechnung bleibt unberührt; ihre Bausteine serie_angaben_* tragen
-- den Schlüssel `ort_link`. Neue, freiwillige Spalten ohne Bestand: Die
-- CHECKs gelten sofort.

set lock_timeout = '5s';

alter table training_termine
  add column ort_link text,
  add constraint tt_ort_link check (
    ort_link is null or (char_length(ort_link) <= 500 and ort_link ~ '^https://[^[:space:]]+$'));

alter table termin_serien
  add column ort_link text,
  add constraint ts_ort_link check (
    ort_link is null or (char_length(ort_link) <= 500 and ort_link ~ '^https://[^[:space:]]+$'));

-- AK 4: kein Kartenlink ohne Ort, auf jedem Weg (Oberfläche, KI, Serienrechnung).
create function ort_link_folgt_ort() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.ort is null then new.ort_link := null; end if;
  return new;
end;
$$;
revoke all on function ort_link_folgt_ort() from public, anon, authenticated;
create trigger tt_ort_link before insert or update of ort, ort_link on training_termine
  for each row execute function ort_link_folgt_ort();
create trigger ts_ort_link before insert or update of ort, ort_link on termin_serien
  for each row execute function ort_link_folgt_ort();

-- ── Bausteine der Serienrechnung (aus mindestbesetzung, um `ort_link` erweitert) ──
-- Teilen: Die Teilserie behält den Link, solange sie den Ort behält.

create or replace function serie_angaben_teilen(p_alt uuid, p_neu uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into termin_serien_trainer (serie_id, user_id, verantwortlich)
  select p_neu, user_id, verantwortlich from termin_serien_trainer where serie_id = p_alt;
  update termin_serien n set besetzung_art = a.besetzung_art, besetzung_zahl = a.besetzung_zahl,
                           ort_link = case when n.ort is not distinct from a.ort then a.ort_link end
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
                               ort_link = s.ort_link
    from termin_serien s where s.id = p_serie and t.id = any(p_termine);
end;
$$;
revoke all on function serie_angaben_neue_termine(uuid, uuid[]) from public, anon, authenticated;

-- ── Serie festlegen mit Kartenlink (AK 2) ──────────────────────────────────
-- Vollständiger Rumpf aus mindestbesetzung; neu ist `p_ort_link`, an die
-- Serie geschrieben — die Termine erhalten ihn über serie_angaben_neue_termine.
drop function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[], jsonb);
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
  p_ort_link text default null)
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
                             felder, erwartete_spielerzahl, besetzung_art, besetzung_zahl, ort_link)
  values (p_team,
          (select array_agg(w order by w) from unnest(p_wochentage) w),
          p_von, p_bis, p_beginn, p_ende,
          nullif(btrim(p_ort), ''), nullif(btrim(p_bemerkung), ''),
          nullif(p_felder, 'null'::jsonb), p_spielerzahl,
          v_besetzung->>'art', (v_besetzung->>'zahl')::smallint,
          nullif(btrim(p_ort_link), ''))
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
revoke all on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[], jsonb, text) from public, anon;
grant execute on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], uuid, jsonb, smallint, uuid[], jsonb, text) to authenticated;

-- ── Wieder der Serie folgen: Ort und Kartenlink gemeinsam (PC 3) ───────────
-- Vollständiger Rumpf aus mindestbesetzung.
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
    ort_link = case when 'ort' = any(p_angaben) then s.ort_link else ort_link end,
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
  -- #533 AK 13, 14: Ein eigener Kartenlink des Termins fällt mit dem Ort weg.
  return jsonb_build_object('team', t.team_id, 'training', t.training_id, 'verfallen', v_verfallen,
    'kartenlink_entfallen', 'ort' = any(p_angaben) and t.ort_link is not null and t.ort_link is distinct from s.ort_link);
end;
$$;
revoke all on function termin_der_serie_folgen(uuid, text[], integer) from public, anon;
grant execute on function termin_der_serie_folgen(uuid, text[], integer) to authenticated;

-- ── Privater Link (AK 6, 7) — Rumpf wie in ausfallgrund_link ────────────────
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
                 else exists (select 1 from termin_abmeldungen a
                               where a.termin_id = t.id and a.spieler_id = s.id and a.verfallen_am is null)
               end,
               'verfallen', case when t.art = 'spiel' then null else
                              (select jsonb_build_object('datum', a.vorher_datum, 'beginn', to_char(a.vorher_beginn, 'HH24:MI'))
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
               -- #465 AK 10; PC 4: bei Spielen die Bemerkung und die Treffpunkte, nur wenn es
               -- stattfindet — ausgefallen spricht der Grund (PO 2026-10-27).
               'bemerkung', case when t.art = 'spiel' and not t.ausgefallen then t.bemerkung end,
               'treffpunkte', case when t.art = 'spiel' and not t.ausgefallen then coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'anreise', tp.anreise,
                          'zeitpunkt', to_char((t.datum + t.beginn) - make_interval(mins => tp.vorlauf_min), 'YYYY-MM-DD"T"HH24:MI'),
                          'ort', tp.ort) order by tp.vorlauf_min desc)
                   from spiel_treffpunkte tp where tp.termin_id = t.id), '[]'::jsonb) end,
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
revoke all on function spieler_link_ansicht(text) from public;
grant execute on function spieler_link_ansicht(text) to anon, authenticated;

-- ── Kalender-Abos (PC 4) — Rümpfe wie in spieler_abos und trainer_abo ───────
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
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e -> 'id', 'datum', e -> 'datum', 'beginn', e -> 'beginn', 'ende', e -> 'ende',
               'ort', e -> 'ort', 'ort_link', e -> 'ort_link', 'art', e -> 'art', 'bezeichnung', e -> 'bezeichnung',
               'begonnen', e -> 'begonnen', 'abgemeldet', e -> 'abgemeldet',
               'meldung', e -> 'meldung', 'frist_abgelaufen', e -> 'frist_abgelaufen',
               'nicht_aufgeboten', e -> 'nicht_aufgeboten',
               'bemerkung', e -> 'bemerkung', 'treffpunkte', e -> 'treffpunkte')
             order by x.n)
        from jsonb_array_elements(v -> 'termine') with ordinality as x(e, n)
       where not (e ->> 'ausgefallen')::boolean), '[]'::jsonb));
end;
$$;
revoke all on function spieler_abo_termine(text) from public;
grant execute on function spieler_abo_termine(text) to anon, authenticated;

create or replace function kalender_abo_termine(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  a kalender_abos;
  v_team teams;
begin
  select * into a from kalender_abos k
   where k.token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  select * into v_team from teams where id = a.team_id;
  return jsonb_build_object(
    'gueltig', true,
    'team', jsonb_build_object('id', v_team.id, 'name', v_team.name),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'datum', t.datum,
               'beginn', to_char(t.beginn, 'HH24:MI'), 'ende', to_char(t.ende, 'HH24:MI'),
               'ort', t.ort, 'ort_link', t.ort_link,
               'geaendert', greatest(t.updated_at, s.geaendert_am),
               'art', t.art, 'bezeichnung', t.bezeichnung,
               'stand', case when ich.verantwortlich then 'verantwortlich'
                             when ich.abgesagt_am is not null then 'abgesagt' else 'dabei' end,
               'trainer', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'name', trainer_name(x), 'ich', x.user_id = a.user_id,
                                     'verantwortlich', x.verantwortlich, 'abgesagt', x.abgesagt_am is not null)
                                   order by trainer_name(x) nulls last), '[]'::jsonb)
                             from termin_trainer x where x.termin_id = t.id),
               'besetzung_art', t.besetzung_art, 'besetzung_zahl', t.besetzung_zahl,
               'erwartete_spielerzahl', t.erwartete_spielerzahl, 'spielstand', spielstand(t))
             order by t.datum, t.beginn nulls last)
        from training_termine t
        join termin_trainer ich on ich.termin_id = t.id and ich.user_id = a.user_id
        left join termin_trainer_stand s on s.termin_id = t.id
       where t.team_id = a.team_id and not t.ausgefallen
         and t.datum >= heute_am_trainingsort() - 28), '[]'::jsonb));
end;
$$;
revoke all on function kalender_abo_termine(text) from public;
grant execute on function kalender_abo_termine(text) to anon, authenticated;

reset lock_timeout;
