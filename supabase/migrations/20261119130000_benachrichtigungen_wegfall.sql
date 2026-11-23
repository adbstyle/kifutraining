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
--   DELETE; danach `benachrichtigung_einzeln` → `wegfall` mit dem Inhalt des
--   Termins vor dem Löschen (AK 2; `inhalt` im Stand).
-- - Serie entfernen (`terminserie_entfernen`): Die Hülle nimmt zuerst die
--   Teamsperre (wie `terminserie_aendern`), hält dann den Stand der Serie
--   fest und vergleicht nach der Rechnung (`benachrichtigung_serie`) — EINE
--   Zeile `serie` je Spieler:in mit `wegfall` (AK 3, PC 2).
-- - Serie ändern (`terminserie_aendern`): unverändert; die Zeilen der Serie
--   (`benachrichtigung_serie_zeilen`) kennen jetzt auch den Wegfall
--   (kürzerer Zeitraum, Wochentag fällt weg). Wer Verlegtes und
--   Weggefallenes hat, erhält beides in derselben Zeile (PC 3, Prinzip 5).
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
-- Forward-only: `create or replace` von `benachrichtigung_einzeln` und
-- `benachrichtigung_serie_zeilen` (gleiche Signaturen), ein neuer interner
-- Baustein, zwei RPCs mit neuer Signatur (drop + create, Rechte neu).
-- ============================================================================
set lock_timeout = '5s';

-- ── Stand und Vergleich (ohne API-Recht) ────────────────────────────────────

-- Die Termine aus einem Stand, die seither weggefallen sind (Prinzipien 1–3):
-- vorher da, jetzt nicht mehr, und vorher mit Empfänger:innen — also
-- bisheriges Datum heute oder später und nicht ausgefallen (siehe
-- `benachrichtigung_stand`). `inhalt` ist die Momentaufnahme vor dem Löschen.
create function benachrichtigung_weggefallen(p_vorher jsonb)
returns table (termin_id uuid, datum date, inhalt jsonb, empfaenger uuid[])
language sql stable
set search_path = public, pg_temp
as $$
  select x.k::uuid, (x.e -> 'inhalt' ->> 'datum')::date, x.e -> 'inhalt',
         array(select jsonb_array_elements_text(x.e -> 'empfaenger')::uuid)
    from jsonb_each(coalesce(p_vorher, '{}'::jsonb)) as x(k, e)
   where jsonb_array_length(coalesce(x.e -> 'empfaenger', '[]'::jsonb)) > 0
     and not exists (select 1 from training_termine tt where tt.id = x.k::uuid)
$$;
revoke all on function benachrichtigung_weggefallen(jsonb) from public, anon, authenticated;

-- Wie in 20261119120000; neu ist je weggefallenem Termin ein `wegfall` mit
-- dem Inhalt vor dem Löschen an die Empfänger:innen vorher (AK 2, PC 1).
create or replace function benachrichtigung_einzeln(p_vorher jsonb) returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  w record;
  v_n integer := 0;
begin
  for t in select * from benachrichtigung_verlegt(p_vorher) loop
    v_n := v_n + benachrichtigung_ablegen(gen_random_uuid(), 'verlegung', t.id,
                   benachrichtigung_inhalt(t, (p_vorher -> t.id::text ->> 'ausgefallen')::boolean),
                   array(select benachrichtigung_empfaenger(t.id)));
  end loop;
  for w in select * from benachrichtigung_weggefallen(p_vorher) loop
    v_n := v_n + benachrichtigung_ablegen(gen_random_uuid(), 'wegfall', w.termin_id, w.inhalt, w.empfaenger);
  end loop;
  return v_n;
end;
$$;
revoke all on function benachrichtigung_einzeln(jsonb) from public, anon, authenticated;

-- Wie in 20261119120000; je Spieler:in EINE Zeile (Prinzip 5, PC 2, 3) aus
-- ihren verlegten Terminen (Empfänger nachher; `ab` und `termin_id` = ihr
-- erster verlegter Termin, `angaben` = `p_angaben`, #644) und neu aus ihren
-- weggefallenen (Empfänger vorher; `wegfall` zusammengefasst nach Zeitraum,
-- ISO-Wochentag und Anzahl, AK 3). Nur Wegfall → `ab`, `angaben` und
-- `termin_id` null. Zwilling: BenachrichtigungSerie in web/lib/benachrichtigung.ts.
create or replace function benachrichtigung_serie_zeilen(p_vorher jsonb, p_angaben jsonb)
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
           'ab', x.datum,
           'angaben', case when x.spieler_id is not null then p_angaben end,
           'wegfall', case when g.spieler_id is not null then jsonb_build_object(
                        'von', g.von, 'bis', g.bis, 'wochentage', to_jsonb(g.tage), 'anzahl', g.anzahl) end)
    from erster x
    full join weg g on g.spieler_id = x.spieler_id
$$;
revoke all on function benachrichtigung_serie_zeilen(jsonb, jsonb) from public, anon, authenticated;

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
    'benachrichtigt', case when p_benachrichtigen then benachrichtigung_einzeln(v_stand) end);
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
                                     benachrichtigung_serie(v_stand, true) end);
  end if;
  begin
    v := terminserie_entfernen_rechnen(p_termin, p_reichweite, p_version, null);
    -- #645: wie viele Spieler:innen eine Benachrichtigung erhielten.
    v := v || jsonb_build_object('mitteilbar', benachrichtigung_serie(v_stand, false));
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function terminserie_entfernen(uuid, text, integer, uuid[], boolean, boolean) from public, anon;
grant execute on function terminserie_entfernen(uuid, text, integer, uuid[], boolean, boolean) to authenticated;
