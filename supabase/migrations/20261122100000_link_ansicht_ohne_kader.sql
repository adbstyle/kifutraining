-- #663 (Epic #655): Kader am privaten Link ausblenden.
--
-- AK 1: Die Spieler:in erkennt am privaten Link weder ihre Kader noch, dass
-- ein Termin auf einen Kader beschränkt ist. Die Ansicht liefert darum keine
-- Kadernamen mehr. Out of Scope 1: Welche Termine sie sieht, ändert sich
-- nicht — der Filter über termin_kader/kader_spieler (termin_gilt_fuer)
-- bleibt unverändert.
--
-- Rumpf wie in 20261118100000_team_infos.sql; einzige Änderung ist `kader`.

create or replace function spieler_link_ansicht(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $function$
declare
  s spieler;
  v_verein text;
  v_teams jsonb;
  v_einziges uuid;
begin
  select * into s from spieler where link_token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  select name into v_verein from vereine where id = s.verein_id;
  select coalesce(jsonb_agg(t.name order by t.name, t.id), '[]'::jsonb),
         case when count(*) = 1 then (array_agg(t.id))[1] end
    into v_teams, v_einziges
    from team_spieler ts join teams t on t.id = ts.team_id
   where ts.spieler_id = s.id;
  return jsonb_build_object(
    'gueltig', true,
    'team', coalesce((select name from teams where id = v_einziges), v_verein),
    'verein', v_verein,
    'teams', v_teams,
    'spieler', jsonb_build_object('vorname', s.vorname, 'nachname', s.nachname),
    -- #555 AK 11: der Stand einer schnuppernden Spieler:in, sonst null.
    'probe', probe_stand(s.id),
    -- #556 AK 4; PC 1: das Info-Schreiben des Teams, in dem sie schnuppert.
    'probe_info', (select i.info from team_spieler ts join team_probetraining i on i.team_id = ts.team_id
                    where ts.spieler_id = s.id and ts.probe_seit is not null
                    order by ts.created_at, ts.team_id limit 1),
    -- #598 AK 5, 6, 7: die Infos zum Team jedes Teams der Spieler:in, mit
    -- Teamname und Tag der letzten Textänderung; nur Teams mit Infos (PC 1),
    -- keine, solange sie schnuppert.
    'team_infos', case when not exists (select 1 from team_spieler ts
                                         where ts.spieler_id = s.id and ts.probe_seit is not null) then
      coalesce((select jsonb_agg(jsonb_build_object(
                         'team', t.name, 'text', i.text,
                         'stand', team_infos_stand(i.geaendert_am))
                       order by t.name, t.id)
                  from team_spieler ts join teams t on t.id = ts.team_id
                  join team_infos i on i.team_id = ts.team_id
                 where ts.spieler_id = s.id), '[]'::jsonb)
      else '[]'::jsonb end,
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'team', tm.name, 'datum', t.datum,
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
               -- #523 AK 1–3: nur die Verantwortliche, mit Anzeigenamen, an einem
               -- Termin, der stattfindet; keine weiteren Trainer:innen, keine Lücken.
               'verantwortlich', case when not t.ausgefallen then
                 (select trainer_name(tr) from termin_trainer tr where tr.termin_id = t.id and tr.verantwortlich) end,
               -- #663 AK 1: keine Kadernamen mehr. Contract in N1: altes Bundle
               -- liest t.kader.length, darum bleibt der Schlüssel als leere Liste.
               'kader', '[]'::jsonb)
             -- Story 7 AK 1: heute begonnene zuerst, dann Datum, Beginn,
             -- Teamname; created_at wie bisher, damit die Folge innerhalb
             -- eines Teams bleibt.
             order by termin_begonnen(t.datum, t.beginn) desc, t.datum, t.beginn, tm.name, t.team_id, t.created_at, t.id)
        from team_spieler zs
        join training_termine t on t.team_id = zs.team_id
        join teams tm on tm.id = t.team_id
        cross join lateral (select exists (select 1 from termin_eingefroren f where f.termin_id = t.id) as fest,
                                   spielstand(t) as stand) x
       where zs.spieler_id = s.id and t.datum >= heute_am_trainingsort()
         and case when x.fest and t.art = 'spiel' then
                    exists (select 1 from spiel_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                  when x.fest then exists (select 1 from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                  else termin_gilt_fuer(t.id, s.id) end), '[]'::jsonb));
end;
$function$;

revoke all on function spieler_link_ansicht(text) from public;
grant execute on function spieler_link_ansicht(text) to anon, authenticated;
