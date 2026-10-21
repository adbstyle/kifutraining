-- ============================================================================
-- Treffpunkte und Bemerkung eines Spiels (#465, Epic #448): Je Anreiseart
-- (vor Ort, öV, Auto, Velo, Car oder Vereinsbus) höchstens ein Treffpunkt,
-- also höchstens fünf (AK 2, 3, 6); jeder ausser vor Ort mit einem Ort von
-- höchstens 100 Zeichen (AK 4, 7). Vor Ort nennt immer den aktuellen Ort
-- des Spiels (PC 1) und trägt darum keinen eigenen.
--
-- Der Zeitpunkt steht als Abstand zum Anpfiff (Wanduhr), auch nach dem
-- Anpfiff oder an einem anderen Tag (AK 5): Eine Verlegung nimmt die
-- Treffpunkte im selben Abstand mit (PC 2). Geschrieben wird die ganze
-- Liste über `spiel_treffpunkte_setzen`.
--
-- Die Spielervertretung sieht über den Link die Treffpunkte und die
-- Bemerkung eines Spiels — an einem ausgefallenen nur die Bemerkung (AK 10,
-- 11; PC 3); die Bemerkung eines Trainings weiterhin nicht (PC 4). Ins
-- Kalender-Abo gehen keine Treffpunkte (PC 5).
--
-- Forward-only: eine neue Tabelle, eine neue Funktion, eine neu gefasste.
-- ============================================================================
set lock_timeout = '5s';

create table spiel_treffpunkte (
  termin_id uuid not null references training_termine(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  anreise text not null,
  vorlauf_min integer not null,
  ort text,
  primary key (termin_id, anreise),
  -- Zwillinge: ANREISEARTEN, treffpunkteProblem in web/lib/spiel.ts.
  constraint stp_anreise check (anreise in ('vor_ort', 'oev', 'auto', 'velo', 'car')),
  constraint stp_ort check ((anreise = 'vor_ort') = (ort is null) and (ort is null or char_length(ort) between 1 and 100)),
  constraint stp_vorlauf check (vorlauf_min between -525600 and 525600)
);
create index spiel_treffpunkte_team_idx on spiel_treffpunkte (team_id);

alter table spiel_treffpunkte enable row level security;
create policy stp_select on spiel_treffpunkte for select to authenticated using (ist_team_mitglied(team_id));
revoke all on spiel_treffpunkte from anon, authenticated;
grant select on spiel_treffpunkte to authenticated;

-- Die ganze Liste eines Spiels ersetzen (AK 1, 12): `p_liste` ist ein Array
-- aus {anreise, vorlauf_min, ort}. Nur Mitglieder, nur an einem Spiel.
create function spiel_treffpunkte_setzen(p_termin uuid, p_liste jsonb) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if t.art <> 'spiel' then raise exception 'TREFFPUNKTE_NUR_SPIEL'; end if;
  delete from spiel_treffpunkte where termin_id = p_termin;
  insert into spiel_treffpunkte (termin_id, team_id, anreise, vorlauf_min, ort)
    select p_termin, t.team_id, x.anreise, x.vorlauf_min, x.ort
      from jsonb_to_recordset(coalesce(p_liste, '[]'::jsonb)) as x(anreise text, vorlauf_min integer, ort text);
end;
$$;
revoke all on function spiel_treffpunkte_setzen(uuid, jsonb) from public, anon;
grant execute on function spiel_treffpunkte_setzen(uuid, jsonb) to authenticated;

-- Rumpf wie in 20261021210000_spiel_meldungen.sql, dazu Bemerkung und
-- Treffpunkte eines Spiels.
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
               -- #465 AK 10, 11; PC 4: bei Spielen die Bemerkung, Treffpunkte nur, wenn es stattfindet.
               'bemerkung', case when t.art = 'spiel' then t.bemerkung end,
               'treffpunkte', case when t.art = 'spiel' and not t.ausgefallen then coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'anreise', tp.anreise,
                          'zeitpunkt', to_char((t.datum + t.beginn) - make_interval(mins => tp.vorlauf_min), 'YYYY-MM-DD"T"HH24:MI'),
                          'ort', tp.ort) order by tp.vorlauf_min desc)
                   from spiel_treffpunkte tp where tp.termin_id = t.id), '[]'::jsonb) end,
               -- AK 2, 3: nur die Kader der Spieler:in, über die er für sie gilt.
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

reset lock_timeout;
