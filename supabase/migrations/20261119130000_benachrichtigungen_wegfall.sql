-- ============================================================================
-- Benachrichtigungen am privaten Link (Epic #641), Story 4 (#645): Entfernen
-- mitteilen — einen einzelnen Termin entfernen, eine Terminserie entfernen
-- und eine Terminserie so ändern, dass Termine entfallen.
--
-- Weggefallen ist ein Termin, der im Stand vor der Änderung steht und danach
-- nicht mehr besteht. Er zählt nur, wenn sein bisheriges Datum heute oder
-- später liegt (Prinzip 2: beim Entfernen zählt der bisherige Tag) und er
-- nicht ausgefallen war (Prinzip 1, AK 1). Empfänger sind die
-- Spieler:innen, für die er bis zum Entfernen galt, auch abgemeldete (PC 1,
-- 2) — der Stand (`benachrichtigung_stand`, #644) hält sie unter genau
-- diesen Bedingungen fest; danach lässt es sich nicht mehr erfragen.
--
-- Drei Wege, alle über die Bausteine aus 20261119120000:
-- - Einzeln (`termin_entfernen`): Stand nach der Termin-Sperre, vor dem
--   DELETE; danach `benachrichtigung_vergleich(…, 'einzeln')` → `wegfall`
--   mit dem Inhalt des Termins vor dem Löschen (AK 2; der Stand trägt dafür
--   jetzt `inhalt`).
-- - Serie entfernen (`terminserie_entfernen`): Die Hülle nimmt zuerst die
--   Teamsperre (wie `terminserie_aendern`), hält dann den Stand der Serie
--   fest und vergleicht nach der Rechnung — EINE Zeile `serie` je
--   Spieler:in mit `wegfall` (AK 3, PC 2).
-- - Serie ändern (`terminserie_aendern`): unverändert; der Vergleich kennt
--   jetzt auch den Wegfall (kürzerer Zeitraum, Wochentag fällt weg). Wer
--   Verlegtes und Weggefallenes hat, erhält beides in derselben Zeile
--   (PC 3, Prinzip 5).
--
-- `wegfall` fasst je Spieler:in die für SIE weggefallenen Termine zusammen
-- (AK 3): `{von, bis, wochentage:[1..7 ISO], anzahl}`. Nur Wegfall → `ab`,
-- `angaben` und `termin_id` null. Zwilling: BenachrichtigungSerie in
-- web/lib/benachrichtigung.ts.
--
-- `termin_entfernen` und `terminserie_entfernen` bekommen
-- `p_benachrichtigen boolean default false` als letzten Parameter
-- (DB-Standard false, damit ein altes Bundle beim Deploy niemanden
-- benachrichtigt; Kern und KI senden den Entscheid immer ausdrücklich). Die
-- Vorschau von `terminserie_entfernen` nennt in `mitteilbar`, wie viele
-- Spieler:innen eine Benachrichtigung erhielten; die Ausführung beider
-- nennt `benachrichtigt` (`null`, wenn nicht benachrichtigt werden sollte).
--
-- Sperren: Die Hülle `terminserie_entfernen` nimmt die Teamsperre jetzt
-- selbst vor der Rechnung (die Rechnung nimmt sie danach noch einmal, das
-- ist in derselben Transaktion ohne Wirkung) — Team vor Termin wie bisher.
-- `termin_entfernen` hält den Stand nach seiner Termin-Sperre fest. Stand
-- und Vergleich lesen nur und fügen in `spieler_benachrichtigungen` ein
-- (ohne FK, siehe 20261119100000). `terminserie_entfernen_rechnen` und
-- `terminserie_rechnen` bleiben unberührt.
--
-- Team auflösen und Verein löschen löschen Termine per Kaskade, nicht über
-- diese Wege: Sie benachrichtigen nie (OoS 1).
--
-- Forward-only: `create or replace` von `benachrichtigung_stand` und
-- `benachrichtigung_vergleich` (gleiche Signaturen), ein neuer interner
-- Baustein, zwei RPCs mit neuer Signatur (drop + create, Rechte neu).
-- ============================================================================
set lock_timeout = '5s';

-- ── Stand und Vergleich (ohne API-Recht) ────────────────────────────────────

-- Wie in 20261119120000; neu ist `inhalt` — die Momentaufnahme des Termins
-- (Prinzip 6), für den Wegfall eines einzelnen Termins (AK 2), nur wo er
-- zählt und nicht ausgefallen ist (sonst `null`, wie `empfaenger` leer).
-- Form: {"<id>": {datum, beginn, ende, ort, ausgefallen, empfaenger:[…], inhalt}}.
create or replace function benachrichtigung_stand(p_ids uuid[]) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(t.id, jsonb_build_object(
           'datum', to_char(t.datum, 'YYYY-MM-DD'),
           'beginn', to_char(t.beginn, 'HH24:MI'),
           'ende', to_char(t.ende, 'HH24:MI'),
           'ort', t.ort,
           'ausgefallen', t.ausgefallen,
           'empfaenger', case when x.zaehlt then to_jsonb(array(select benachrichtigung_empfaenger(t.id)))
                              else '[]'::jsonb end,
           'inhalt', case when x.zaehlt then benachrichtigung_inhalt(t) end)), '{}'::jsonb)
    from training_termine t
    cross join lateral (select benachrichtigung_zaehlt(t.datum) and not t.ausgefallen as zaehlt) x
   where t.id = any(p_ids)
$$;
revoke all on function benachrichtigung_stand(uuid[]) from public, anon, authenticated;

-- Die Termine aus einem Stand, die seither weggefallen sind (Prinzipien 1–3):
-- vorher da, jetzt nicht mehr, und vorher mit Empfänger:innen — also
-- bisheriges Datum heute oder später und nicht ausgefallen (siehe Stand).
create function benachrichtigung_weggefallen(p_vorher jsonb)
returns table (termin_id uuid, datum date, inhalt jsonb, empfaenger uuid[])
language sql stable
set search_path = public, pg_temp
as $$
  select x.k::uuid, (x.e ->> 'datum')::date, x.e -> 'inhalt',
         array(select jsonb_array_elements_text(x.e -> 'empfaenger')::uuid)
    from jsonb_each(coalesce(p_vorher, '{}'::jsonb)) as x(k, e)
   where jsonb_array_length(coalesce(x.e -> 'empfaenger', '[]'::jsonb)) > 0
     and not exists (select 1 from training_termine tt where tt.id = x.k::uuid)
$$;
revoke all on function benachrichtigung_weggefallen(jsonb) from public, anon, authenticated;

-- Die Zeilen einer Serienbenachrichtigung: je Spieler:in EINE (Prinzip 5,
-- PC 2, 3) aus ihren verlegten Terminen (Empfänger nachher; `ab` und
-- `termin_id` = ihr erster verlegter Termin, `angaben` = `p_angaben`, #644)
-- und ihren weggefallenen (Empfänger vorher; `wegfall` zusammengefasst nach
-- Zeitraum, Wochentag und Anzahl, AK 3). Zwilling: BenachrichtigungSerie in
-- web/lib/benachrichtigung.ts.
create function benachrichtigung_serie_zeilen(p_vorher jsonb, p_angaben jsonb)
returns table (spieler_id uuid, termin_id uuid, inhalt jsonb)
language sql stable
set search_path = public, pg_temp
as $$
  with erster as (
    select distinct on (e.spieler_id) e.spieler_id, v.id as termin_id, v.team_id, v.datum
      from benachrichtigung_verlegt(p_vorher) v
      cross join lateral benachrichtigung_empfaenger(v.id) e(spieler_id)
     order by e.spieler_id, v.datum, v.beginn nulls last, v.id),
  weg as (
    select e.spieler_id, min(w.inhalt ->> 'team') as team, min(w.datum) as von, max(w.datum) as bis,
           array_agg(distinct extract(isodow from w.datum)::int order by extract(isodow from w.datum)::int) as tage,
           count(*)::int as anzahl
      from benachrichtigung_weggefallen(p_vorher) w
      cross join lateral unnest(w.empfaenger) e(spieler_id)
     group by e.spieler_id)
  select coalesce(x.spieler_id, g.spieler_id), x.termin_id,
         jsonb_build_object(
           'team', coalesce((select name from teams where id = x.team_id), g.team),
           'art', 'training',
           'ab', to_char(x.datum, 'YYYY-MM-DD'),
           'angaben', case when x.spieler_id is not null then p_angaben end,
           'wegfall', case when g.spieler_id is not null then jsonb_build_object(
                        'von', to_char(g.von, 'YYYY-MM-DD'), 'bis', to_char(g.bis, 'YYYY-MM-DD'),
                        'wochentage', to_jsonb(g.tage), 'anzahl', g.anzahl) end)
    from erster x
    full join weg g on g.spieler_id = x.spieler_id
$$;
revoke all on function benachrichtigung_serie_zeilen(jsonb, jsonb) from public, anon, authenticated;

-- Wie in 20261119120000; neu ist der Wegfall (#645):
-- - `einzeln`: zusätzlich je weggefallenem Termin ein `wegfall` mit dem
--   Inhalt vor dem Löschen an die Empfänger:innen vorher (AK 2, PC 1).
-- - `serie`: je Spieler:in EINE Zeile aus Verlegtem und Weggefallenem
--   (`benachrichtigung_serie_zeilen`); gezählt wird jede Spieler:in einmal.
create or replace function benachrichtigung_vergleich(
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
  w record;
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
    for w in select * from benachrichtigung_weggefallen(p_vorher) loop
      v_n := v_n + case when p_ablegen
        then benachrichtigung_ablegen(gen_random_uuid(), 'wegfall', w.termin_id, w.inhalt, w.empfaenger)
        else cardinality(w.empfaenger) end;
    end loop;
    return v_n;
  end if;

  if not p_ablegen then
    return (select count(*)::int from benachrichtigung_serie_zeilen(p_vorher, null));
  end if;
  -- Die geänderten Angaben der Serie (#644 AK 4): nur die Schlüssel, die
  -- sich änderten; keiner → null. Ohne Serie danach (entfernt) keine.
  v_nachher := benachrichtigung_serie_angaben(p_serie);
  select jsonb_object_agg(k, v_nachher -> k) into v_angaben
    from jsonb_object_keys(coalesce(v_nachher, '{}'::jsonb)) k
   where (v_nachher -> k) is distinct from (p_serie_vorher -> k);
  with neu as (
    -- Prinzip 5: ein Vorgang, eine Zeile je Spieler:in (unique (vorgang, spieler_id)).
    insert into spieler_benachrichtigungen (spieler_id, vorgang, ereignis, termin_id, inhalt)
    select z.spieler_id, v_vorgang, 'serie', z.termin_id, z.inhalt
      from benachrichtigung_serie_zeilen(p_vorher, v_angaben) z
    on conflict do nothing
    returning 1)
  select count(*)::int into v_n from neu;
  return v_n;
end;
$$;
revoke all on function benachrichtigung_vergleich(jsonb, text, boolean, jsonb, uuid) from public, anon, authenticated;

-- ── Einen Termin entfernen (AK 1, 2; PC 1) ──────────────────────────────────

-- Rumpf wie in 20261115120000_verein_gruenden_loeschen.sql; neu sind
-- `p_benachrichtigen`, der Stand nach der Termin-Sperre (vor dem DELETE)
-- und der Vergleich danach.
drop function termin_entfernen(uuid, jsonb);
create function termin_entfernen(
  p_termin uuid,
  p_erwartet jsonb default null,
  p_benachrichtigen boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_termin training_termine;
  v_termin_team uuid;
  v_stand jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_termin_team from training_termine where id = p_termin;
  if v_termin_team is null or not ist_team_mitglied(v_termin_team) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  perform sperre_teams(array[v_termin_team]);                    -- Team vor Termin
  select * into v_termin from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(v_termin.team_id) then
    raise exception 'TERMIN_NICHT_GEFUNDEN';
  end if;
  if p_erwartet is not null
     and v_termin.training_id is distinct from (p_erwartet->>'termin_training')::uuid then
    raise exception 'TERMIN_BELEGUNG_GEAENDERT';
  end if;
  -- #645: für wen der Termin bis zum Entfernen galt, und sein Inhalt.
  if p_benachrichtigen then v_stand := benachrichtigung_stand(array[p_termin]); end if;
  delete from training_termine where id = p_termin;
  if v_termin.serie_id is not null then
    insert into termin_serien_luecken (serie_id, tag)
      values (v_termin.serie_id, v_termin.serien_tag) on conflict do nothing;
    delete from termin_serien s
     where s.id = v_termin.serie_id
       and not exists (select 1 from training_termine where serie_id = s.id);
  end if;
  return jsonb_build_object('training', v_termin.training_id, 'team', v_termin.team_id,
    'benachrichtigt', case when p_benachrichtigen then benachrichtigung_vergleich(v_stand, 'einzeln', true) end);
end;
$$;
revoke all on function termin_entfernen(uuid, jsonb, boolean) from public, anon;
grant execute on function termin_entfernen(uuid, jsonb, boolean) to authenticated;

-- ── Eine Serie entfernen (AK 1, 3; PC 2) ────────────────────────────────────

-- Rumpf wie in 20260930211328_terminserien_aendern.sql; neu sind
-- `p_benachrichtigen`, die Teamsperre und der Stand vor der Rechnung (nur,
-- wenn er gebraucht wird: in der Vorschau und beim Benachrichtigen),
-- `mitteilbar` in der Vorschau und `benachrichtigt` nach der Ausführung.
drop function terminserie_entfernen(uuid, text, integer, uuid[], boolean);
create function terminserie_entfernen(
  p_termin uuid,
  p_reichweite text,
  p_version integer default null,
  p_entfallend uuid[] default null,
  p_ausfuehren boolean default true,
  p_benachrichtigen boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
  v_team uuid;
  v_stand jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  -- Ohne Mitgliedschaft keine Sperre; terminserie_entfernen_rechnen weist dann ab.
  if v_team is not null and ist_team_mitglied(v_team) then
    perform sperre_teams(array[v_team]);                         -- Team vor Termin
    if p_benachrichtigen or not p_ausfuehren then
      select benachrichtigung_stand(array(select o.id from training_termine o where o.serie_id = t.serie_id))
        into v_stand
        from training_termine t where t.id = p_termin;
    end if;
  end if;
  if p_ausfuehren then
    v := terminserie_entfernen_rechnen(p_termin, p_reichweite, p_version, p_entfallend);
    return v || jsonb_build_object('benachrichtigt', case when p_benachrichtigen then
                                     benachrichtigung_vergleich(v_stand, 'serie', true) end);
  end if;
  begin
    v := terminserie_entfernen_rechnen(p_termin, p_reichweite, p_version, null);
    -- #645: wie viele Spieler:innen eine Benachrichtigung erhielten.
    v := v || jsonb_build_object('mitteilbar', benachrichtigung_vergleich(v_stand, 'serie', false));
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function terminserie_entfernen(uuid, text, integer, uuid[], boolean, boolean) from public, anon;
grant execute on function terminserie_entfernen(uuid, text, integer, uuid[], boolean, boolean) to authenticated;
