-- ============================================================================
-- Vereine, Story 7 (#583): Privater Link, Kalender-Abo und Selbstabholung
-- über mehrere Teams (Architekturplan Vereine §4.4, §7.7–§7.9; Plan Phase 7).
--
-- Nur Funktionen und ihre Rechte; keine Tabelle, keine Spalte, kein
-- Constraint, kein Trigger. Kein Token, kein Abo und keine Abholadresse wird
-- angefasst: Jeder bestehende Link und jede Abo-Adresse liefert weiter (PC 5).
--
-- - Link und Abo zeigen die Termine aller Teams, denen die Spieler:in JETZT
--   zugeordnet ist (team_spieler des Termin-Teams, nicht die festgehaltene
--   Teilnahme): Nach dem Herausnehmen verschwinden die Termine dieses Teams,
--   auch ein heute begonnener (PC 2). Kader nur des Termin-Teams
--   (termin_gilt_fuer). Ordnung aus der Datenbank: heute begonnene zuerst,
--   dann Datum, Beginn, Teamname. Neu `teams`, `verein`, `team` je Termin.
-- - Ab- und Anmelden über den Link sperren nur das Termin-Team und prüfen
--   danach die Zuordnung: `gilt_nicht` ohne `stand` (AK 7), auch für einen
--   unbekannten Termin (ein gültiger Link erfährt nicht, ob es einen Termin
--   gibt, der nicht für seine Spieler:in gilt). Die Wege der Mitglieder
--   behalten `nicht_gefunden`.
-- - abholung_abholen gibt den Link aus, für den es «bezogen» setzt.
-- - Link holen und erneuern am Team-Ort je Team (p_team).
-- - spieler_teams und verein_spieler_teams nennen je Team `abholbar`.
-- - Fragen und Feedback über den Link gelten auch ohne Team und speichern
--   kein Team (AK 18, PC 6); feedback_link_team fällt.
--
-- Danach liest spieler.team_id nur noch das Schnuppern (spieler_probe_*,
-- Story 8) und vereine_nachziehen (bis N1).
-- ============================================================================

set lock_timeout = '5s';

-- ── Link-Ansicht ────────────────────────────────────────────────────────────

-- Rumpf wie in 20261113110000_spieler_ueber_zuordnung.sql; Termine aller
-- Teams der Spieler:in, je Termin `team`, dazu `teams` (alphabetisch, auch
-- ohne Termine, ohne IDs) und `verein`. `team` bleibt: bei genau einem Team
-- dessen Name, sonst der Vereinsname. `probe` und `probe_info` nur bei genau
-- einem Team (Schnuppern ist Story 8). Jedes bisherige Feld eines Termins
-- bleibt, wie es war.
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
    -- #555 AK 11: der Stand einer Probe-Spieler:in, sonst null.
    'probe', case when v_einziges is not null then probe_stand(s.id) end,
    -- #556 AK 4; PC 1: das Info-Schreiben, nur im Probe-Modus.
    'probe_info', case when exists (select 1 from team_spieler ts where ts.spieler_id = s.id
                                                 and ts.team_id = v_einziges and ts.probe_seit is not null)
                       then (select i.info from team_probetraining i where i.team_id = v_einziges) end,
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
               -- AK 2, 3: nur die Kader der Spieler:in, über die er für sie gilt.
               -- #523 AK 1–3: nur die Verantwortliche, mit Anzeigenamen, an einem
               -- Termin, der stattfindet; keine weiteren Trainer:innen, keine Lücken.
               'verantwortlich', case when not t.ausgefallen then
                 (select trainer_name(tr) from termin_trainer tr where tr.termin_id = t.id and tr.verantwortlich) end,
               'kader', coalesce((select jsonb_agg(k.name order by k.name)
                                    from termin_kader tk join kader k on k.id = tk.kader_id
                                    join kader_spieler ks on ks.kader_id = k.id and ks.spieler_id = s.id
                                   where tk.termin_id = t.id), '[]'::jsonb))
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

-- ── Kalender-Abo ────────────────────────────────────────────────────────────

-- Rumpf wie in 20261031120000_treffpunkt_training.sql; je Termin `team`
-- (AK 8). Termine und Reihenfolge folgen der Ansicht; ohne Team gültig und
-- leer (AK 9).
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
               'id', e -> 'id', 'team', e -> 'team', 'datum', e -> 'datum', 'beginn', e -> 'beginn', 'ende', e -> 'ende',
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

-- ── Ab- und Anmelden über den Link ──────────────────────────────────────────

-- Rumpf wie in 20261113110000_spieler_ueber_zuordnung.sql. Sperrfolge (AP
-- §4.1): nur das Termin-Team (nie das «erste» Team, sonst Zyklus mit dem
-- Löschen, das alle Teams aufsteigend sperrt), danach die Spieler:in samt
-- Geheimnis neu lesen und die Zuordnung prüfen; die Termin-Zeile sperrt
-- abmeldung_anwenden_training unter derselben, erneut genommenen Teamsperre.
-- Nicht (mehr) im Termin-Team oder in keinem Kader des Termins, und ebenso
-- ein unbekannter (auch ein inzwischen gelöschter) Termin:
-- {status: 'abgewiesen', grund: 'gilt_nicht'} ohne `stand` (AK 7). So
-- antwortet der Link auf einen Termin ausserhalb der Liste der Spieler:in
-- immer gleich, ob es ihn gibt oder nicht (auch in einem fremden Verein).
create or replace function spieler_link_abmelden(p_token text, p_termin uuid, p_abgemeldet boolean,
                                                 p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s spieler;
  t training_termine;
  v_team uuid;
  v jsonb;
begin
  select * into s from spieler where link_token = p_token;
  if not found then return jsonb_build_object('status', 'ungueltig'); end if;
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'gilt_nicht');
  end if;
  -- Erst unter der Sperre gelesen, gilt der Probe-Modus: Ein Mitglied, das ihn
  -- gleichzeitig einschaltet, kann die Grenze nicht unterlaufen.
  perform sperre_teams(array[v_team]);
  select * into s from spieler where id = s.id and link_token = p_token;
  if not found then return jsonb_build_object('status', 'ungueltig'); end if;
  if not spieler_im_team(s.id, v_team) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'gilt_nicht');
  end if;
  if exists (select 1 from team_spieler ts where ts.spieler_id = s.id and ts.team_id = v_team
                                              and ts.probe_seit is not null)
     and not p_abgemeldet then
    select * into t from training_termine where id = p_termin;
    if found and t.art = 'training' and not t.ausgefallen and not termin_begonnen(t.datum, t.beginn)
       and (p_gesehen_datum is null or p_gesehen_datum = t.datum)
       and (p_gesehen_beginn is null or p_gesehen_beginn = t.beginn)
       and termin_gilt_fuer(t.id, s.id) and training_abgemeldet(t.id, s.id)
       and (probe_stand(s.id) ->> 'moeglich')::int < 1 then
      return jsonb_build_object('status', 'abgewiesen', 'grund', 'probe_voll',
        'stand', jsonb_build_object('datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                    'ende', to_char(t.ende, 'HH24:MI'), 'ausgefallen', t.ausgefallen));
    end if;
  end if;
  v := abmeldung_anwenden(p_termin, s.id, p_abgemeldet, p_gesehen_datum, p_gesehen_beginn);
  if v ->> 'grund' = 'gilt_nicht' then v := v - 'stand'; end if;
  return v;
end;
$$;

-- Rumpf wie in 20261021210000_spiel_meldungen.sql; dieselbe Sperrfolge und
-- dieselbe Abweisung wie spieler_link_abmelden (auch für einen unbekannten
-- Termin). spiel_pruefen nimmt die
-- Teamsperre erneut und sperrt die Termin-Zeile.
create or replace function spieler_link_melden(p_token text, p_termin uuid, p_angemeldet boolean,
                                               p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spieler uuid;
  v_team uuid;
  v jsonb;
begin
  select id into v_spieler from spieler where link_token = p_token;
  if v_spieler is null then return jsonb_build_object('status', 'ungueltig'); end if;
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'gilt_nicht');
  end if;
  perform sperre_teams(array[v_team]);
  if not exists (select 1 from spieler where id = v_spieler and link_token = p_token) then
    return jsonb_build_object('status', 'ungueltig');
  end if;
  if not spieler_im_team(v_spieler, v_team) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'gilt_nicht');
  end if;
  v := spiel_meldung_anwenden(p_termin, v_spieler, p_angemeldet, p_gesehen_datum, p_gesehen_beginn, true);
  if v ->> 'grund' = 'gilt_nicht' then v := v - 'stand'; end if;
  return v;
end;
$$;

-- ── Selbstabholung ──────────────────────────────────────────────────────────

-- Rumpf wie in 20261113110000_spieler_ueber_zuordnung.sql. Der Token kommt
-- aus derselben Anweisung, die «bezogen» setzt: Ein gleichzeitiges Erneuern
-- hält die Zeile, das Update wertet danach die neue Fassung aus. So ist der
-- ausgegebene Link immer der, für den «bezogen» gilt. Ist die Zeile
-- inzwischen gelöscht: `ungueltig`.
create or replace function abholung_abholen(p_token text, p_schluessel text, p_vorname text, p_nachname text, p_jahrgang integer)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  sp abholung_sperren;
  s spieler;
  v_link text;
begin
  select team_id into v_team from team_abholung where token = p_token and aktiv;
  if v_team is null then return jsonb_build_object('status', 'ungueltig'); end if;
  if p_schluessel is null or length(p_schluessel) < 32 then raise exception 'SCHLUESSEL_FEHLT'; end if;

  -- Abgelaufenes aufräumen, dann die Zeile dieses Anschlusses sperren.
  delete from abholung_sperren
   where coalesce(gesperrt_bis, erster_fehler + interval '15 minutes') < now() - interval '1 day';
  insert into abholung_sperren (schluessel) values (p_schluessel) on conflict (schluessel) do nothing;
  select * into sp from abholung_sperren where schluessel = p_schluessel for update;
  if sp.gesperrt_bis is not null and sp.gesperrt_bis > now() then
    return jsonb_build_object('status', 'gesperrt');
  end if;
  -- Die Zählung beginnt neu, wenn die Sperre oder die 15 Minuten seit dem
  -- ersten Fehlversuch vorbei sind.
  if sp.gesperrt_bis is not null or sp.erster_fehler < now() - interval '15 minutes' then
    update abholung_sperren set fehlversuche = 0, erster_fehler = now(), gesperrt_bis = null
     where schluessel = p_schluessel returning * into sp;
  end if;

  select x.* into s from spieler x
   where exists (select 1 from team_spieler ts where ts.spieler_id = x.id and ts.team_id = v_team)
     and spieler_text_schluessel(x.vorname) = spieler_text_schluessel(spieler_text_bereinigt(coalesce(p_vorname, '')))
     and spieler_text_schluessel(x.nachname) = spieler_text_schluessel(spieler_text_bereinigt(coalesce(p_nachname, '')))
     and x.jahrgang = p_jahrgang;
  if not found then
    update abholung_sperren
       set fehlversuche = fehlversuche + 1,
           erster_fehler = case when fehlversuche = 0 then now() else erster_fehler end,
           gesperrt_bis = case when fehlversuche + 1 >= 5 then now() + interval '15 minutes' end
     where schluessel = p_schluessel
     returning * into sp;
    return jsonb_build_object('status', case when sp.gesperrt_bis is not null then 'gesperrt' else 'passt_nicht' end);
  end if;

  -- Ein Treffer setzt die Fehlversuche NICHT zurück: Sonst rät, wer eine
  -- Spieler:in kennt, zwischen zwei Treffern beliebig viele fremde Namen. Sie
  -- laufen nur mit den 15 Minuten aus.
  update spieler set link_bezogen = true where id = s.id returning link_token into v_link;
  if v_link is null then return jsonb_build_object('status', 'ungueltig'); end if;
  return jsonb_build_object('status', 'ok', 'token', v_link,
                            'spieler', jsonb_build_object('vorname', s.vorname, 'nachname', s.nachname));
end;
$$;

-- ── Link am Team-Ort ────────────────────────────────────────────────────────

-- Neu mit p_team (die Ein-Argument-Fassungen lasen spieler.team_id): Recht
-- im übergebenen Team, und die Spieler:in gehört ihm an; sonst
-- SPIELER_NICHT_GEFUNDEN. Rückgabe wie bisher: der Link.
drop function spieler_link_holen(uuid);
drop function spieler_link_erneuern(uuid);

create function spieler_link_holen(p_team uuid, p_spieler uuid) returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) or not spieler_im_team(p_spieler, p_team) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  return (select link_token from spieler where id = p_spieler);
end;
$$;

-- Der bisherige Link und das Abo (Trigger spieler_link_erneuert) enden für
-- alle Teams, «bezogen» fällt zurück, Abmeldungen bleiben. Sperrfolge wie
-- beim Herausnehmen: Team → `spieler`-Zeile, danach die Zuordnung erneut
-- prüfen (kein neuer Link für ein Team, aus dem die Spieler:in gerade
-- genommen wurde).
create function spieler_link_erneuern(p_team uuid, p_spieler uuid) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) or not spieler_im_team(p_spieler, p_team) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  perform sperre_teams(array[p_team]);
  perform 1 from spieler where id = p_spieler for update;
  if not spieler_im_team(p_spieler, p_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  -- Das Geheimnis erst nach den Prüfungen erzeugen.
  v_token := neues_geheimnis();
  update spieler set link_token = v_token, link_bezogen = false where id = p_spieler;
  return v_token;
end;
$$;

revoke all on function spieler_link_holen(uuid, uuid) from public, anon;
revoke all on function spieler_link_erneuern(uuid, uuid) from public, anon;
grant execute on function spieler_link_holen(uuid, uuid) to authenticated;
grant execute on function spieler_link_erneuern(uuid, uuid) to authenticated;

-- ── Teams einer Spieler:in mit `abholbar` (AK 13, 16) ───────────────────────

-- Rumpf wie in 20261114110000_vereine_bestand.sql; je Team zusätzlich
-- `abholbar` (dieses Team hat die Selbstabholung eingeschaltet). Liest
-- spieler_teams (Erneuern-Dialog am Team-Ort) und, gleichlautend, die Antwort
-- `stand_geaendert` des Herausnehmens. Fremde Team-IDs gehen nicht hinaus.
--   [{name, eigen, dieses, abholbar}]
create or replace function spieler_teams_auskunft(p_spieler uuid, p_team uuid) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', t.name,
           'eigen', exists (select 1 from team_members m where m.team_id = t.id and m.user_id = auth.uid()),
           'dieses', t.id = p_team,
           'abholbar', exists (select 1 from team_abholung a where a.team_id = t.id and a.aktiv))
           order by t.name, t.id), '[]'::jsonb)
    from team_spieler ts join teams t on t.id = ts.team_id
   where ts.spieler_id = p_spieler;
$$;

-- Rumpf wie in 20261114210000_spielerbestand_verwaltung.sql; je Team
-- zusätzlich `abholbar`.
--   {teams: [{id, name, abholbar}]}
create or replace function verein_spieler_teams(p_spieler uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform nur_in_der_anwendung();
  if not ist_verein_verwaltung((select verein_id from spieler where id = p_spieler)) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  return jsonb_build_object('teams', (select coalesce(jsonb_agg(jsonb_build_object(
                                                'id', t.id, 'name', t.name,
                                                'abholbar', exists (select 1 from team_abholung a
                                                                     where a.team_id = t.id and a.aktiv))
                                                                order by t.name, t.id), '[]'::jsonb)
                                        from team_spieler ts join teams t on t.id = ts.team_id
                                       where ts.spieler_id = p_spieler));
end;
$$;

-- ── Fragen und Feedback über den Link (AK 18, PC 6) ─────────────────────────

-- Gilt der Link? Nur über das Geheimnis, unabhängig vom Team. Erneuert,
-- entfernt oder nie vergeben sehen gleich aus (#436 AK 10, 11). Kein API-Recht.
create function feedback_link_gueltig(p_token text) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select p_token ~ '^[0-9a-f]{64}$' and exists (select 1 from spieler where link_token = p_token) $$;
revoke all on function feedback_link_gueltig(text) from public, anon, authenticated;

-- Ob die Spieler:in hinter einem (gültigen) Link keinem Team zugeordnet ist:
-- Danach richten sich Begrüssung und Systemprompt (Dringendes an die
-- Vereinsverwaltung statt an die Trainer:innen, AK 19). Kein API-Recht.
-- Für einen ungültigen Token liefert sie `true` (kein Treffer); das ist ohne
-- Folgen, weil sie nur nach feedback_link_gueltig gerufen wird (beginnen,
-- zaehlen) und deren Antwort für einen ungültigen Link `ohne_team` nie trägt.
create function feedback_link_ohne_team(p_token text) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select not exists (select 1 from spieler s join team_spieler ts on ts.spieler_id = s.id where s.link_token = p_token)
$$;
revoke all on function feedback_link_ohne_team(text) from public, anon, authenticated;

-- Rümpfe wie in 20261028110000_feedback_link.sql; Gültigkeit über
-- feedback_link_gueltig. beginnen und zaehlen liefern additiv `ohne_team`.
create or replace function feedback_link_beginnen(p_token text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not feedback_link_gueltig(p_token) then return jsonb_build_object('status', 'ungueltig'); end if;
  return feedback_dialog_anlegen(feedback_link_schluessel(p_token, heute_am_trainingsort()))
         || jsonb_build_object('ohne_team', feedback_link_ohne_team(p_token));
end;
$$;

create or replace function feedback_link_zaehlen(p_token text, p_dialog uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tag date := feedback_dialog_tag(p_dialog);
begin
  if not feedback_link_gueltig(p_token) then return jsonb_build_object('status', 'ungueltig'); end if;
  if v_tag is null then
    return jsonb_build_object('status', 'unbekannt', 'ohne_team', feedback_link_ohne_team(p_token));
  end if;
  return feedback_nachricht_zaehlen_fuer(p_dialog, feedback_link_schluessel(p_token, v_tag))
         || jsonb_build_object('ohne_team', feedback_link_ohne_team(p_token));
end;
$$;

create or replace function feedback_link_vermerken(p_token text, p_dialog uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tag date := feedback_dialog_tag(p_dialog);
begin
  if v_tag is null or not feedback_link_gueltig(p_token) then return; end if;
  perform feedback_vorschlag_vermerken_fuer(p_dialog, feedback_link_schluessel(p_token, v_tag));
end;
$$;

-- Speichert weder Spieler:in noch Link noch Team (PC 6). Die Spalte
-- feedback.team_id bleibt für ältere Einträge (bis N1).
create or replace function feedback_link_ablegen(
  p_token text, p_dialog uuid, p_einordnung feedback_einordnung, p_titel text, p_zusammenfassung jsonb,
  p_verlauf jsonb, p_seite text, p_version text, p_umgebung text, p_geraet text
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tag date := feedback_dialog_tag(p_dialog);
begin
  -- Wird der Link vor dem Bestätigen ungültig, speichert KiFu nichts (PC 5).
  if not feedback_link_gueltig(p_token) then return jsonb_build_object('status', 'ungueltig'); end if;
  if v_tag is null then return jsonb_build_object('status', 'unbekannt'); end if;
  return feedback_ablegen_fuer(p_dialog, feedback_link_schluessel(p_token, v_tag), 'spielervertretung', null, null,
    p_einordnung, p_titel, p_zusammenfassung, p_verlauf, p_seite, p_version, p_umgebung, p_geraet);
end;
$$;

drop function feedback_link_team(text);

reset lock_timeout;
