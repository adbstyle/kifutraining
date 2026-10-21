-- ============================================================================
-- Spiele selbst erfassen (#459, Epic #448): Ein Termin ist ein Training oder
-- ein Spiel. Die Art wird beim Festlegen gewählt und danach nie geändert
-- (AK 13); alle bestehenden Termine und alle Terminserien bleiben Trainings
-- (PC 3) — der Default trägt den Bestand.
--
-- Ein Spiel trägt eine Bezeichnung (AK 2, 10) und auf Wunsch einen Richtwert:
-- Mindest- und Höchstzahl je für sich (AK 5, 11). Es trägt nie ein Training,
-- keine Felder und keine erwartete Spielerzahl und gehört nie einer Serie
-- (AK 14, 16; Out of Scope 1). Sein Anpfiff (Beginn) liegt beim Festlegen und
-- bei jeder Verlegung in der Zukunft (AK 21); eine Verlegung beendet seinen
-- Ausfall (PC 5).
--
-- Meldungen hat ein Spiel erst mit #463 — bis dahin weist die Abmeldung der
-- Trainings Spiele ab, es gibt keine Spielerzahl und nichts wird beim Anpfiff
-- festgehalten. Dafür stehen dünne Verteiler vor den Trainingsfunktionen
-- (`spielstand`, `termin_einfrieren`, `abmeldung_anwenden`); die Rümpfe der
-- Trainings bleiben, wie sie sind (umbenannt, nicht neu gefasst).
--
-- Forward-only: neue Spalten mit Default bzw. ohne Wert, Checks, die der
-- Bestand erfüllt (art = 'training', alle Spielspalten leer), Trigger und
-- neu gefasste Funktionen.
-- ============================================================================
set lock_timeout = '5s';

-- ── Spalten und Regeln (AK 1, 2, 5, 10, 11, 14, 16) ─────────────────────────

alter table training_termine
  add column art text not null default 'training',
  add column bezeichnung text,
  add column richtwert_min smallint,
  add column richtwert_max smallint;

alter table training_termine
  add constraint tt_art check (art in ('training', 'spiel')),
  -- Zwilling: bezeichnungProblem in web/lib/spiel.ts.
  add constraint tt_spiel_bezeichnung check (
    (art = 'spiel') = (bezeichnung is not null)
    and (bezeichnung is null or char_length(bezeichnung) between 1 and 120)),
  -- Zwilling: richtwertProblem in web/lib/spiel.ts.
  add constraint tt_richtwert check (
    (richtwert_min is null or richtwert_min between 1 and 200)
    and (richtwert_max is null or richtwert_max between 1 and 200)
    and (richtwert_min is null or richtwert_max is null or richtwert_min <= richtwert_max)
    and (art = 'spiel' or (richtwert_min is null and richtwert_max is null))),
  -- Ein Spiel trägt kein Training, keine Felder, keine erwartete Zahl und
  -- gehört keiner Serie.
  add constraint tt_spiel_ohne_training check (
    art = 'training'
    or (training_id is null and serie_id is null and felder is null and erwartete_spielerzahl is null));

-- ── Die Art bleibt (AK 13) ──────────────────────────────────────────────────

create function termin_art_fest() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.art is distinct from old.art then
    raise exception 'TERMIN_ART_FEST';
  end if;
  return new;
end;
$$;
revoke all on function termin_art_fest() from public, anon, authenticated;

create trigger training_termine_art_fest before update of art on training_termine
  for each row execute function termin_art_fest();

-- ── Anpfiff in der Zukunft; Verlegen beendet den Ausfall (AK 21, PC 5) ──────

-- Beim Festlegen und bei jeder Änderung von Datum oder Anpfiff. Ein
-- unverändert gebliebener Zeitpunkt (andere Angaben eines begonnenen Spiels)
-- prüft nichts.
create function spiel_zeitpunkt_vorher() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.datum is not distinct from old.datum and new.beginn is not distinct from old.beginn then
    return new;
  end if;
  if termin_begonnen(new.datum, new.beginn) then
    raise exception 'SPIEL_ANPFIFF_VERGANGEN';
  end if;
  if tg_op = 'UPDATE' then
    new.ausgefallen := false;
    new.ausfall_grund := null;
  end if;
  return new;
end;
$$;
revoke all on function spiel_zeitpunkt_vorher() from public, anon, authenticated;

create trigger training_termine_spiel_zeitpunkt before insert or update of datum, beginn on training_termine
  for each row when (new.art = 'spiel') execute function spiel_zeitpunkt_vorher();

-- ── Verteiler vor den Trainingsfunktionen ───────────────────────────────────

-- Die Spielerzahl: bei Spielen bis #463 keine.
alter function spielstand(training_termine) rename to spielstand_training;

create function spielstand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when t.art = 'spiel' then null else spielstand_training(t) end;
$$;
revoke all on function spielstand(training_termine) from public, anon;
grant execute on function spielstand(training_termine) to authenticated;

-- Festhalten beim Beginn: bei Spielen bis #463 nichts.
alter function termin_einfrieren(uuid) rename to termin_einfrieren_training;

create function termin_einfrieren(p_termin uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from training_termine where id = p_termin and art = 'spiel') then
    return;
  end if;
  perform termin_einfrieren_training(p_termin);
end;
$$;
revoke all on function termin_einfrieren(uuid) from public, anon, authenticated;

-- Alle begonnenen Termine eines Teams festhalten: nur Trainings. Rumpf wie in
-- 20261018130000_termin_kader.sql, dazu die Art.
create or replace function termine_einfrieren(p_team uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  with neu as (
    insert into termin_eingefroren (termin_id, team_id, mit_liste)
      select t.id, t.team_id, exists (select 1 from spieler where team_id = p_team) from training_termine t
       where t.team_id = p_team
         and t.art = 'training'
         and t.datum <= heute_am_trainingsort()
         and termin_begonnen(t.datum, t.beginn)
      on conflict (termin_id) do nothing
      returning termin_id),
  teilnahmen as (
    insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet)
      select n.termin_id, p_team, s.id,
             exists (select 1 from termin_abmeldungen a
                      where a.termin_id = n.termin_id and a.spieler_id = s.id and a.verfallen_am is null)
        from neu n cross join spieler s where s.team_id = p_team and termin_gilt_fuer(n.termin_id, s.id)
      returning termin_id)
  delete from termin_abmeldungen a using neu n where a.termin_id = n.termin_id;
end;
$$;
revoke all on function termine_einfrieren(uuid) from public, anon, authenticated;

-- Ab- und Anmelden gilt nur für Trainings; ein Spiel kennt eigene Meldungen
-- (#463). Mitglieder, Link und KI laufen hier durch.
alter function abmeldung_anwenden(uuid, uuid, boolean, date, time) rename to abmeldung_anwenden_training;

create function abmeldung_anwenden(p_termin uuid, p_spieler uuid, p_abgemeldet boolean,
                                   p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from training_termine where id = p_termin and art = 'spiel') then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'ist_spiel');
  end if;
  return abmeldung_anwenden_training(p_termin, p_spieler, p_abgemeldet, p_gesehen_datum, p_gesehen_beginn);
end;
$$;
revoke all on function abmeldung_anwenden(uuid, uuid, boolean, date, time) from public, anon, authenticated;

-- ── Privater Link: ein Spiel als Spiel (AK 17) ──────────────────────────────

-- Rumpf wie in 20261019120000_spieler_link_gesamt.sql, dazu Art,
-- Bezeichnung und Richtwert.
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
        cross join lateral (select exists (select 1 from termin_eingefroren f where f.termin_id = t.id) as fest,
                                   spielstand(t) as stand) x
       where t.team_id = s.team_id and t.datum >= heute_am_trainingsort()
         and case when x.fest then exists (select 1 from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                  else termin_gilt_fuer(t.id, s.id) end), '[]'::jsonb));
end;
$$;
revoke all on function spieler_link_ansicht(text) from public;
grant execute on function spieler_link_ansicht(text) to anon, authenticated;

-- ── Kalender-Abo: Titel eines Spiels (PC 1, 2) ──────────────────────────────

-- Rumpf wie in 20261001013441_kalender_abos.sql, dazu Art und Bezeichnung.
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
               'ort', t.ort, 'geaendert', t.updated_at,
               'art', t.art, 'bezeichnung', t.bezeichnung)
             order by t.datum, t.beginn nulls last)
        from training_termine t
       where t.team_id = a.team_id and not t.ausgefallen
         and t.datum >= heute_am_trainingsort() - 28), '[]'::jsonb));
end;
$$;
revoke all on function kalender_abo_termine(text) from public;
grant execute on function kalender_abo_termine(text) to anon, authenticated;

reset lock_timeout;
