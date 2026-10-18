-- ============================================================================
-- Kader (Epic #447), Story 3 (#454): Die Spielervertretung sieht über den
-- privaten Link nur die Termine, die für ihre Spieler:in gelten.
--
-- Der Link zeigt ausschliesslich anstehende Termine, für die die Spieler:in
-- gilt (AK 1, `termin_gilt_fuer`); ein heute begonnener zählt, wenn sie bei
-- Beginn dabei war. Je Termin stehen die Kader, über die er für sie gilt —
-- nie die übrigen (AK 2, 3). Die Zahl der Angemeldeten zählt nur Geltende
-- (AK 4, `spielstand`). Ab- und Anmelden für einen Termin, der nicht mehr
-- gilt, weist `abmeldung_anwenden` mit dem Grund `gilt_nicht` ab (AK 5, #453).
--
-- Forward-only: nur eine neu gefasste Funktion.
-- ============================================================================
set lock_timeout = '5s';

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
               'begonnen', termin_begonnen(t.datum, t.beginn),
               'angemeldet', case when t.ausgefallen then null else (spielstand(t) ->> 'angemeldet')::int end,
               'abgemeldet', case
                 when x.fest then
                   coalesce((select p.abgemeldet from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id), false)
                 else exists (select 1 from termin_abmeldungen a
                               where a.termin_id = t.id and a.spieler_id = s.id and a.verfallen_am is null)
               end,
               'verfallen', (select jsonb_build_object('datum', a.vorher_datum, 'beginn', to_char(a.vorher_beginn, 'HH24:MI'))
                               from termin_abmeldungen a
                              where a.termin_id = t.id and a.spieler_id = s.id and a.verfallen_am is not null
                                and not termin_begonnen(t.datum, t.beginn)),
               -- AK 2, 3: nur die Kader der Spieler:in, über die er für sie gilt.
               'kader', coalesce((select jsonb_agg(k.name order by k.name)
                                    from termin_kader tk join kader k on k.id = tk.kader_id
                                    join kader_spieler ks on ks.kader_id = k.id and ks.spieler_id = s.id
                                   where tk.termin_id = t.id), '[]'::jsonb))
             order by t.datum, t.beginn, t.created_at)
        from training_termine t
        cross join lateral (select exists (select 1 from termin_eingefroren f where f.termin_id = t.id) as fest) x
       where t.team_id = s.team_id and t.datum >= heute_am_trainingsort()
         and case when x.fest then exists (select 1 from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                  else termin_gilt_fuer(t.id, s.id) end), '[]'::jsonb));
end;
$$;
revoke all on function spieler_link_ansicht(text) from public;
grant execute on function spieler_link_ansicht(text) to anon, authenticated;

reset lock_timeout;
