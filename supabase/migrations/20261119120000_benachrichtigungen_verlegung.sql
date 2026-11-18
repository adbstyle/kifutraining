-- ============================================================================
-- Benachrichtigungen am privaten Link (Epic #641), Story 3 (#644): Verlegung
-- mitteilen — einzeln, indem ein Termin wieder seiner Serie folgt, und über
-- die Terminserie.
--
-- Verlegt ist ein Termin, der vorher und nachher besteht und dessen Datum,
-- Beginn, Ende oder Ort sich ändert — der Kartenlink allein nicht (OoS 1).
-- Er zählt nur, wenn er danach heute oder später liegt (Prinzip 2: bei einer
-- Verlegung zählt der neue Zeitpunkt) und nicht ausgefallen ist (Prinzip 1:
-- ein ausgefallener Termin meldet nur noch, dass er wieder stattfindet).
-- Empfänger sind die Spieler:innen, für die er danach gilt (PC 1, 2; auch
-- abgemeldete). Termine, die eine Serienänderung neu anlegt, zählen nicht
-- (OoS 4).
--
-- Drei Wege:
-- - Einzeln über RLS (`aendereTermin`): Der Fachkern vergleicht vorher und
--   nachher selbst (Zwilling `istVerlegung` in web/lib/benachrichtigung.ts)
--   und ruft danach `termin_benachrichtigen(…, 'verlegung', p_wieder)`.
--   Die Datenebene prüft hier nur, dass der Termin nicht ausgefallen ist;
--   `wieder` (AK 3) sagt der Kern: Der Termin war vorher ausgefallen.
-- - Der Serie folgen (`termin_der_serie_folgen`) und die Serie ändern
--   (`terminserie_aendern`): Die Hülle hält vor der Rechnung den Stand fest
--   (`benachrichtigung_stand`) und vergleicht danach
--   (`benachrichtigung_vergleich`). Einzeln entsteht eine `verlegung`, über
--   die Serie EINE Zeile `serie` je Spieler:in (Prinzip 5, PO 11) mit dem
--   ersten verlegten Termin dieser Spieler:in (`ab`, `termin_id`) und den
--   geänderten Angaben der Serie in ihrer neuen Fassung (`angaben`, AK 4).
--
-- Beide Hüllen bekommen `p_benachrichtigen boolean default false` als letzten
-- Parameter (DB-Standard false, damit ein altes Bundle beim Deploy niemanden
-- benachrichtigt; Kern und KI senden den Entscheid immer ausdrücklich). Die
-- Vorschau von `terminserie_aendern` (`p_ausfuehren = false`) nennt in
-- `mitteilbar`, wie viele Spieler:innen eine Benachrichtigung erhielten,
-- ohne etwas abzulegen; die Ausführung nennt `benachrichtigt` (`null`, wenn
-- nicht benachrichtigt werden sollte).
--
-- Sperren: keine neuen. Stand und Vergleich lesen nur (Termine, Serie,
-- `team_spieler`) und fügen in `spieler_benachrichtigungen` ein (ohne FK,
-- siehe 20261119100000). `terminserie_aendern` hält den Stand nach seiner
-- Teamsperre fest; `termin_der_serie_folgen` nach der Termin-Zeile, die es
-- ohnehin sperrt (mit `kader` davor die Teamsperre, wie bisher).
-- `terminserie_rechnen` bleibt unberührt.
--
-- #645 (Wegfall) ergänzt `benachrichtigung_vergleich` per `create or replace`
-- um weggefallene Termine (vorher da, nachher nicht; Empfänger aus dem
-- Vorher-Stand) — die Stelle ist im Rumpf markiert.
--
-- Forward-only: `create or replace` von `termin_benachrichtigen` (gleiche
-- Signatur), zwei neue interne Bausteine, zwei Hüllen mit neuer Signatur
-- (drop + create, Rechte neu).
-- ============================================================================
set lock_timeout = '5s';

-- ── Einzeln über den Fachkern (AK 1, 3) ─────────────────────────────────────

create or replace function termin_benachrichtigen(p_termin uuid, p_ereignis text, p_wieder boolean default false)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
begin
  select * into t from training_termine where id = p_termin;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if p_ereignis is null or p_ereignis not in ('neues_spiel', 'ausfall', 'ruecknahme', 'verlegung') then
    raise exception 'EREIGNIS_UNGUELTIG';
  end if;
  if not benachrichtigung_zaehlt(t.datum) then return 0; end if;
  if p_ereignis = 'neues_spiel' then
    -- #642: ein Spiel, das stattfindet, zu dem es noch keines gibt.
    if t.art <> 'spiel' or t.ausgefallen
       or exists (select 1 from spieler_benachrichtigungen b
                   where b.termin_id = t.id and b.ereignis = 'neues_spiel') then
      return 0;
    end if;
  elsif p_ereignis = 'ausfall' then
    -- #643 AK 3: Der Termin ist ausgefallen; der Grund steht im Inhalt.
    if not t.ausgefallen then return 0; end if;
  elsif p_ereignis in ('ruecknahme', 'verlegung') then
    -- #643 AK 4: Der Termin findet wieder statt. #644 AK 1: Ein verlegter
    -- Termin, der ausgefallen bleibt, meldet nichts; ob es eine Verlegung
    -- war und ob er vorher ausfiel (`p_wieder`, AK 3), weiss der Aufrufer.
    if t.ausgefallen then return 0; end if;
  end if;
  return benachrichtigung_ablegen(gen_random_uuid(), p_ereignis, t.id, benachrichtigung_inhalt(t, p_wieder),
                                  array(select benachrichtigung_empfaenger(t.id)));
end;
$$;
revoke all on function termin_benachrichtigen(uuid, text, boolean) from public, anon;
grant execute on function termin_benachrichtigen(uuid, text, boolean) to authenticated;

-- ── Stand und Vergleich (ohne API-Recht) ────────────────────────────────────

-- Der Stand von Terminen vor einer Änderung: je Termin-ID die Angaben, die
-- eine Verlegung ausmachen (Prinzip 1; der Kartenlink nicht, OoS 1), ob er
-- ausgefallen ist, und die Spieler:innen, für die er jetzt gilt — nur, wenn
-- er zählt und nicht ausgefallen ist (Prinzipien 2, 3; für den Wegfall,
-- #645). Form: {"<id>": {datum, beginn, ende, ort, ausgefallen, empfaenger:[…]}}.
create function benachrichtigung_stand(p_ids uuid[]) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(t.id, jsonb_build_object(
           'datum', to_char(t.datum, 'YYYY-MM-DD'),
           'beginn', to_char(t.beginn, 'HH24:MI'),
           'ende', to_char(t.ende, 'HH24:MI'),
           'ort', t.ort,
           'ausgefallen', t.ausgefallen,
           'empfaenger', case when benachrichtigung_zaehlt(t.datum) and not t.ausgefallen
                              then to_jsonb(array(select benachrichtigung_empfaenger(t.id)))
                              else '[]'::jsonb end)), '{}'::jsonb)
    from training_termine t
   where t.id = any(p_ids)
$$;
revoke all on function benachrichtigung_stand(uuid[]) from public, anon, authenticated;

-- Die Angaben einer Serie, die eine Serienbenachrichtigung nennen kann
-- (AK 4): Wochentage, Beginn, Ende, Ort. Zwilling: BenachrichtigungSerie
-- ["angaben"] in web/lib/benachrichtigung.ts.
create function benachrichtigung_serie_angaben(p_serie uuid) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'wochentage', to_jsonb(s.wochentage),
           'beginn', to_char(s.beginn, 'HH24:MI'),
           'ende', to_char(s.ende, 'HH24:MI'),
           'ort', s.ort)
    from termin_serien s
   where s.id = p_serie
$$;
revoke all on function benachrichtigung_serie_angaben(uuid) from public, anon, authenticated;

-- Die Termine aus einem Stand, die seither verlegt sind (Prinzipien 1, 2):
-- vorher und jetzt da, Datum, Beginn, Ende oder Ort anders (der Kartenlink
-- zählt nicht, OoS 1), jetzt heute oder später und nicht ausgefallen. Neu
-- angelegte Termine stehen nicht im Stand und zählen darum nicht (OoS 4).
-- Zwilling: istVerlegung in web/lib/benachrichtigung.ts.
create function benachrichtigung_verlegt(p_vorher jsonb) returns setof training_termine
language sql stable
set search_path = public, pg_temp
as $$
  select tt.* from training_termine tt
   where p_vorher ? tt.id::text
     and (to_char(tt.datum, 'YYYY-MM-DD'), to_char(tt.beginn, 'HH24:MI'), to_char(tt.ende, 'HH24:MI'), tt.ort)
         is distinct from (p_vorher -> tt.id::text ->> 'datum', p_vorher -> tt.id::text ->> 'beginn',
                           p_vorher -> tt.id::text ->> 'ende', p_vorher -> tt.id::text ->> 'ort')
     and benachrichtigung_zaehlt(tt.datum)
     and not tt.ausgefallen
$$;
revoke all on function benachrichtigung_verlegt(jsonb) from public, anon, authenticated;

-- Vergleicht den Stand vor einer Änderung (`benachrichtigung_stand`) mit dem
-- jetzigen und legt die Benachrichtigungen ab (`p_ablegen`) oder zählt nur,
-- wie viele Spieler:innen eine erhielten (Vorschau). Liefert die Zahl der
-- Spieler:innen. Empfänger eines verlegten Termins: für wen er jetzt gilt.
-- - `einzeln` (der Serie folgen): je verlegtem Termin eine `verlegung` mit
--   dem neuen Stand; `wieder`, wenn er vorher ausgefallen war (AK 3).
-- - `serie` (die Serie ändern): je Spieler:in EINE Zeile `serie` (PC 2,
--   Prinzip 5) mit `ab` und `termin_id` = ihr erster verlegter Termin und
--   den geänderten Angaben der Serie (`p_serie_vorher` gegen die Serie
--   `p_serie` danach) — nur die Schlüssel, die sich änderten; keiner → null.
--   Zwilling: BenachrichtigungSerie in web/lib/benachrichtigung.ts.
create function benachrichtigung_vergleich(
  p_vorher jsonb,
  p_modus text,
  p_ablegen boolean,
  p_serie_vorher jsonb default null,
  p_serie uuid default null)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_n integer := 0;
  v_nachher jsonb;
  v_angaben jsonb;
  v_vorgang uuid := gen_random_uuid();
begin
  if p_modus is null or p_modus not in ('einzeln', 'serie') then raise exception 'MODUS_UNGUELTIG'; end if;
  if p_modus = 'einzeln' then
    for t in select * from benachrichtigung_verlegt(p_vorher) loop
      v_n := v_n + case when p_ablegen
        then benachrichtigung_ablegen(gen_random_uuid(), 'verlegung', t.id,
               benachrichtigung_inhalt(t, coalesce((p_vorher -> t.id::text ->> 'ausgefallen')::boolean, false)),
               array(select benachrichtigung_empfaenger(t.id)))
        else (select count(*)::int from benachrichtigung_empfaenger(t.id)) end;
    end loop;
    return v_n;
  end if;

  -- #645 ergänzt hier den Wegfall: Termine aus `p_vorher`, die es nicht mehr
  -- gibt, vorher gezählt und nicht ausgefallen (Empfänger dort aus
  -- `empfaenger`); dieselbe Zeile je Spieler:in trägt dann `wegfall`.
  if not p_ablegen then
    return (select count(distinct e.spieler_id)::int
              from benachrichtigung_verlegt(p_vorher) v
              cross join lateral benachrichtigung_empfaenger(v.id) e(spieler_id));
  end if;
  v_nachher := benachrichtigung_serie_angaben(p_serie);
  select jsonb_object_agg(k, v_nachher -> k) into v_angaben
    from jsonb_object_keys(coalesce(v_nachher, '{}'::jsonb)) k
   where (v_nachher -> k) is distinct from (p_serie_vorher -> k);
  with erster as (
    select distinct on (e.spieler_id) e.spieler_id, v.id as termin_id, v.team_id, v.datum
      from benachrichtigung_verlegt(p_vorher) v
      cross join lateral benachrichtigung_empfaenger(v.id) e(spieler_id)
     order by e.spieler_id, v.datum, v.beginn nulls last, v.id),
  neu as (
    -- Prinzip 5: ein Vorgang, eine Zeile je Spieler:in (unique (vorgang, spieler_id)).
    insert into spieler_benachrichtigungen (spieler_id, vorgang, ereignis, termin_id, inhalt)
    select x.spieler_id, v_vorgang, 'serie', x.termin_id,
           jsonb_build_object('team', (select name from teams where id = x.team_id), 'art', 'training',
                              'ab', to_char(x.datum, 'YYYY-MM-DD'), 'angaben', v_angaben, 'wegfall', null)
      from erster x
    on conflict do nothing
    returning 1)
  select count(*)::int into v_n from neu;
  return v_n;
end;
$$;
revoke all on function benachrichtigung_vergleich(jsonb, text, boolean, jsonb, uuid) from public, anon, authenticated;

-- ── Der Serie folgen (AK 1) ─────────────────────────────────────────────────

-- Rumpf wie in 20261114200000_vereine_verwaltung.sql; neu sind
-- `p_benachrichtigen`, der Stand nach der Termin-Zeile und der Vergleich am
-- Schluss (nach `kader_nachher`, das bei geändertem Verfall abweist).
drop function termin_der_serie_folgen(uuid, text[], integer);
create function termin_der_serie_folgen(
  p_termin uuid,
  p_angaben text[],
  p_bestaetigt integer default null,
  p_benachrichtigen boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  s termin_serien;
  v_team uuid;
  v_kader boolean := coalesce('kader' = any(p_angaben), false);
  v_verfallen integer := 0;
  v_beginn time;
  v_stand jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if v_kader then perform kader_vorher(v_team); end if;
  select * into t from training_termine where id = p_termin for update;
  if not found then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if p_angaben is null or cardinality(p_angaben) = 0
     or not (p_angaben <@ array['zeit', 'ort', 'bemerkung', 'hinweis_eltern', 'treffpunkt', 'datum', 'eingeladene', 'verantwortung',
                                'besetzung', 'felder', 'spielerzahl', 'kader']) then
    raise exception 'SERIE_ANGABEN_UNGUELTIG';
  end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if 'datum' = any(p_angaben) then raise exception 'DATUM_FOLGT_NICHT'; end if;
  if v_kader and termin_begonnen(t.datum, t.beginn) then raise exception 'KADER_TERMIN_BEGONNEN'; end if;
  -- #644: der Stand vor dem Folgen, unter der Sperre der Termin-Zeile.
  if p_benachrichtigen then v_stand := benachrichtigung_stand(array[p_termin]); end if;
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
  -- #644 AK 1: Folgen Zeit oder Ort, ist der Termin womöglich verlegt.
  return jsonb_build_object('team', t.team_id, 'training', t.training_id, 'verfallen', v_verfallen,
    'kartenlink_entfallen', 'ort' = any(p_angaben) and t.ort_link is not null and t.ort_link is distinct from s.ort_link,
    'treffpunkt_entfallen', not ('treffpunkt' = any(p_angaben)) and not treffpunkt_passt(t.treffpunkt_vorlauf_min, v_beginn),
    'benachrichtigt', case when p_benachrichtigen then benachrichtigung_vergleich(v_stand, 'einzeln', true) end);
end;
$$;
revoke all on function termin_der_serie_folgen(uuid, text[], integer, boolean) from public, anon;
grant execute on function termin_der_serie_folgen(uuid, text[], integer, boolean) to authenticated;

-- ── Die Serie ändern (AK 2, 4; PC 2) ────────────────────────────────────────

-- Rumpf wie in 20261114200000_vereine_verwaltung.sql; neu sind
-- `p_benachrichtigen`, der Stand nach der Teamsperre (nur, wenn er gebraucht
-- wird: in der Vorschau und beim Benachrichtigen), `mitteilbar` in der
-- Vorschau und `benachrichtigt` nach den Verfallsprüfungen.
drop function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer);
create function terminserie_aendern(
  p_termin uuid,
  p_reichweite text,
  p_aenderung jsonb,
  p_version integer default null,
  p_entfallend uuid[] default null,
  p_ausfuehren boolean default true,
  p_verfallend integer default null,
  p_benachrichtigen boolean default false)
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
  v_stand jsonb;
  v_serie_vorher jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  -- Ohne Mitgliedschaft keine Sperre; terminserie_rechnen weist dann ab.
  if v_team is not null and ist_team_mitglied(v_team) then
    perform sperre_teams(array[v_team]);
    -- #644: der Stand der Serie vor der Änderung, unter der Teamsperre.
    if p_benachrichtigen or not p_ausfuehren then
      select benachrichtigung_stand(array(select o.id from training_termine o where o.serie_id = t.serie_id)),
             benachrichtigung_serie_angaben(t.serie_id)
        into v_stand, v_serie_vorher
        from training_termine t where t.id = p_termin;
    end if;
  end if;
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
                                   'nachtraege_verfallend', v_nachtraege, 'absagen_verfallend', v_absagen,
                                   'benachrichtigt', case when p_benachrichtigen then
                                     benachrichtigung_vergleich(v_stand, 'serie', true, v_serie_vorher, (v ->> 'serie')::uuid) end);
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
                                 'absagen_verfallend', serie_absagen_verfallen(v_absagen_vorher),
                                 -- #644: wie viele Spieler:innen eine Benachrichtigung erhielten.
                                 'mitteilbar', benachrichtigung_vergleich(v_stand, 'serie', false, v_serie_vorher,
                                                                           (v ->> 'serie')::uuid));
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer, boolean) from public, anon;
grant execute on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer, boolean) to authenticated;
