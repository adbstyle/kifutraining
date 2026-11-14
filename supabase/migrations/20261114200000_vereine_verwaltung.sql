-- Vereinsverwaltung führt Teams und Trainer:innen (Story 5 #581, Epic #575;
-- Architekturplan Vereine §3.6, §4.1–§4.4).
--
-- Teams gehören dem Verein: Anlegen, Umbenennen und Auflösen macht nur die
-- Verwaltung (`verein_team_*`), ohne selbst Mitglied zu werden. Sie nimmt
-- Trainer:innen auf und entfernt sie, nimmt sich selbst in ein Team auf,
-- führt die Verwaltung (`verein_verwaltung_*`) und nimmt Spieler:innen aus
-- Teams. Ein Team ohne Mitglied bleibt bestehen: `create_team`,
-- `loese_team_auf` und der Trigger `team_aufloesen_wenn_leer` fallen, der
-- Austritt (`entferne_team_mitglied`) braucht keinen Teamnamen mehr.
--
-- Teamnamen sind je Verein eindeutig nach `spieler_text_schluessel`; geprüft
-- wird nur, wenn sich der Schlüssel ändert (Altdubletten bleiben, PC 6), die
-- Grenze 30 nur beim Anlegen (PC 7).
--
-- Die Aufnahme per E-Mail weist an beiden Orten ein Konto eines anderen
-- Vereins mit dem Status `anderer_verein` ab; er zählt wie `nicht_gefunden`
-- in der gemeinsamen Bremse (AP §4.3).
--
-- `termin_kader_setzen`, `termin_der_serie_folgen` und `terminserie_aendern`
-- nehmen die Teamsperre vor der Termin-Zeile (Plan Phase 5).
--
-- Rollen nach Ort (AP §4): Team-RPCs prüfen die Mitgliedschaft, `verein_*`
-- beginnt mit `nur_in_der_anwendung()` und prüft die Verwaltung des Vereins
-- (bei Team-RPCs des Vereins des Teams). Kein Recht und unbekanntes Ziel sind
-- ununterscheidbar (`VEREIN_NICHT_GEFUNDEN`); nach der Vereinssperre prüfen
-- sie das Recht und das Team erneut (verwaltung_sperren,
-- verwaltung_team_sperren). Sperrordnung Verein → Suche (suchende Person) →
-- Person → Teams → `spieler`-Zeile → Termin-Zeile.

set lock_timeout = '5s';

-- ── Funktionen: Helfer ──────────────────────────────────────────────────────

-- Name eines anderen Teams des Vereins mit demselben Schlüssel wie p_name,
-- sonst null (AP §3.6). Kein API-Recht.
create function teamname_vergeben(p_verein uuid, p_name text, p_ausser uuid default null) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select t.name from teams t
   where t.verein_id = p_verein and t.id is distinct from p_ausser
     and spieler_text_schluessel(t.name) = spieler_text_schluessel(p_name)
   order by t.name, t.id
   limit 1;
$$;

-- Verwaltungsrecht für alle schreibenden verein_*-RPCs (AP §4.1): prüfen,
-- Vereinssperre nehmen, unter ihr erneut prüfen. Ein gleichzeitiges Entfernen
-- aus der Verwaltung, auf das die Sperre gewartet hat, weist so ab. Die erste
-- Prüfung vor der Sperre hält Fremde von der Vereinssperre fern. Kein
-- API-Recht.
create function verwaltung_sperren(p_verein uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not ist_verein_verwaltung(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  perform sperre_verein(p_verein);
  if not ist_verein_verwaltung(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
end;
$$;

-- Dasselbe für Team-adressierte RPCs: Das Recht folgt dem Verein des Teams,
-- und unter der Vereinssperre muss das Team noch bestehen (aufgelöst wird
-- nur unter ihr). Liefert den Verein. Kein API-Recht.
create function verwaltung_team_sperren(p_team uuid) returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_verein uuid := (select verein_id from teams where id = p_team);
begin
  perform verwaltung_sperren(v_verein);
  if not exists (select 1 from teams where id = p_team) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  return v_verein;
end;
$$;

-- Ziel einer Aufnahme per E-Mail für alle fünf Suchwege (finde_trainer,
-- add_team_member, verein_finde_person, verein_team_aufnehmen,
-- verein_verwaltung_aufnehmen). Status `gebremst`, `nicht_gefunden`,
-- `anderer_verein` oder null mit dem Konto in o_ziel. `nicht_gefunden`
-- vermerkt trainer_per_email, `anderer_verein` vermerkt diese Funktion als
-- erfolglosen Versuch (AP §4.3). Mit p_sperren nimmt sie die Personensperre
-- vor der Prüfung; dann hält der Aufrufer schon die Vereinssperre
-- (Sperrordnung Verein → Person). Läuft mit den Rechten der DEFINER-RPCs.
--
-- Zählen und Vermerken der Bremse laufen unter einer Sperre je suchender
-- Person (Schlüssel `suche:`), sonst kämen gleichzeitige erfolglose Suchen
-- alle an der Bremse vorbei. Nur diese Funktion nimmt die Suchsperre, als
-- erste eigene Sperre: nach der Vereinssperre des Aufrufers (falls er sie
-- hält), vor der Personensperre des Ziels. Wer sie hält, wartet danach
-- höchstens auf diese Personensperre; niemand hält eine Personen-, Team-,
-- Zeilen- oder Terminsperre und will dann die Suchsperre. Ordnung: Verein →
-- Suche → Person → Teams → `spieler`-Zeile → Termin, ohne Zyklus.
create function aufnahme_ziel(p_user uuid, p_email text, p_verein uuid, p_sperren boolean,
                              out o_status text, out o_ziel uuid)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_verein uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('suche:' || p_user::text, 0));
  if such_bremse_aktiv(p_user) then
    o_status := 'gebremst';
    return;
  end if;
  o_ziel := trainer_per_email(p_user, p_email);
  if o_ziel is null then
    o_status := 'nicht_gefunden';
    return;
  end if;
  if p_sperren then perform sperre_person(o_ziel); end if;
  v_verein := person_verein(o_ziel);
  if v_verein is not null and v_verein is distinct from p_verein then
    insert into trainer_suchversuche (user_id) values (p_user);
    o_status := 'anderer_verein';
    o_ziel := null;
  end if;
end;
$$;

-- Herausnehmen ohne Recht (AP §4, Story 5 A1.1): Team- und Verein-Einstieg
-- prüfen ihre Rolle selbst und rufen dann diesen Kern. Sperren Team →
-- `spieler`-Zeile; erst dann prüfen. Mit p_pruefe_stand und abweichendem
-- (oder fehlendem) Stand ohne Änderung
--   {status: 'stand_geaendert', teams: [{name, eigen, dieses}], stand}
-- sonst {status: 'herausgenommen', ohne_team}.
create function spieler_aus_team_nehmen_kern(p_team uuid, p_spieler uuid, p_pruefe_stand boolean, p_stand text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_stand text;
begin
  perform sperre_teams(array[p_team]);
  perform 1 from spieler where id = p_spieler for update;
  if not spieler_im_team(p_spieler, p_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  if p_pruefe_stand then
    v_stand := spieler_teams_stand(p_spieler);
    if p_stand is null or p_stand <> v_stand then
      return jsonb_build_object('status', 'stand_geaendert',
                                'teams', spieler_teams_auskunft(p_spieler, p_team), 'stand', v_stand);
    end if;
  end if;
  delete from team_spieler where team_id = p_team and spieler_id = p_spieler;
  return jsonb_build_object('status', 'herausgenommen',
                            'ohne_team', not exists (select 1 from team_spieler where spieler_id = p_spieler));
end;
$$;

-- ── Funktionen: Trigger ─────────────────────────────────────────────────────

-- Rumpf wie in 20261113100000_vereine_fundament.sql; dazu der Teamname je
-- Verein (AP §3.6, Netz für das Rennen, AK 35). Beim Umbenennen weder
-- VEREIN_FEHLT noch die Grenze 30 (PC 7), und nur, wenn sich der Schlüssel
-- ändert (Altdubletten, PC 6). Zwilling: VEREIN_TEAMS_MAX in web/lib/verein.ts.
create or replace function teams_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.verein_id is null then raise exception 'VEREIN_FEHLT'; end if;
    perform sperre_verein(new.verein_id);
    if (select count(*) from teams where verein_id = new.verein_id) >= 30 then
      raise exception 'VEREIN_TEAMS_VOLL';
    end if;
  elsif new.verein_id is null
        or spieler_text_schluessel(new.name) is not distinct from spieler_text_schluessel(old.name) then
    return new;
  else
    perform sperre_verein(new.verein_id);
  end if;
  if teamname_vergeben(new.verein_id, new.name, new.id) is not null then
    raise exception 'TEAMNAME_VERGEBEN';
  end if;
  return new;
end;
$$;

-- ── Funktionen: Team-Ort ────────────────────────────────────────────────────

drop function create_team(text);
drop function loese_team_auf(uuid, text);
drop trigger team_aufloesen_wenn_leer on team_members;
drop function team_aufloesen_wenn_leer();

-- Mitglied entfernen oder austreten, ohne Teamnamen (AK 16, 28). Das letzte
-- Mitglied geht, das Team bleibt. Teamsperre wie bisher (Rennen mit dem
-- Auflösen und dem Herausnehmen); `team_weg`, wenn die Verwaltung das Team
-- inzwischen aufgelöst hat. Rumpf aus 20261114110000_vereine_bestand.sql.
--   {status: 'entfernt'} | {status: 'team_weg'}
drop function entferne_team_mitglied(uuid, uuid, text);
create function entferne_team_mitglied(p_team uuid, p_user uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then
    if not exists (select 1 from teams where id = p_team) then
      return jsonb_build_object('status', 'team_weg');
    end if;
    raise exception 'not a member of this team';
  end if;
  perform sperre_teams(array[p_team]);
  if not exists (select 1 from teams where id = p_team) then
    return jsonb_build_object('status', 'team_weg');
  end if;
  if not ist_team_mitglied(p_team) then
    raise exception 'not a member of this team';
  end if;
  delete from team_members where team_id = p_team and user_id = p_user;
  return jsonb_build_object('status', 'entfernt');
end;
$$;

-- Rumpf wie in 20260824200312_team_rpcs.sql; dazu `anderer_verein`
-- (aufnahme_ziel).
create or replace function finde_trainer(p_team_id uuid, p_email text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  z record;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team_id and user_id = v_uid) then
    raise exception 'not a member of this team';
  end if;
  z := aufnahme_ziel(v_uid, p_email, (select verein_id from teams where id = p_team_id), false);
  if z.o_status is not null then
    return jsonb_build_object('status', z.o_status);
  end if;
  if exists (select 1 from team_members
             where team_id = p_team_id and user_id = z.o_ziel) then
    return jsonb_build_object('status', 'bereits_mitglied');
  end if;
  return jsonb_build_object('status', 'gefunden', 'anzeige_name', anzeige_name(z.o_ziel));
end;
$$;

-- Rumpf wie in 20260824200312_team_rpcs.sql; dazu `anderer_verein` unter
-- Vereins- und Personensperre (der Trigger team_members_vorher bleibt Netz).
-- Unter der Vereinssperre die Mitgliedschaft erneut prüfen: Hat die
-- Verwaltung das Team inzwischen aufgelöst (oder das Mitglied entfernt),
-- weist das ab wie für ein Nicht-Mitglied.
create or replace function add_team_member(p_team_id uuid, p_email text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verein uuid;
  z record;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team_id and user_id = v_uid) then
    raise exception 'not a member of this team';
  end if;
  v_verein := (select verein_id from teams where id = p_team_id);
  if v_verein is null then raise exception 'not a member of this team'; end if;
  perform sperre_verein(v_verein);
  if not exists (select 1 from team_members
                 where team_id = p_team_id and user_id = v_uid) then
    raise exception 'not a member of this team';
  end if;
  z := aufnahme_ziel(v_uid, p_email, v_verein, true);
  if z.o_status is not null then
    return jsonb_build_object('status', z.o_status);
  end if;
  insert into team_members (team_id, user_id) values (p_team_id, z.o_ziel)
    on conflict do nothing;   -- gleichzeitige Aufnahme wirkt einmalig (PC 3)
  return jsonb_build_object('status', 'aufgenommen', 'anzeige_name', anzeige_name(z.o_ziel));
end;
$$;

-- Rumpf wie in 20261014120000_team_mitglieder_email.sql; dazu je Mitglied
-- `ist_verwaltung` (AK 15). Liest verein_verwaltung direkt (zeigt nur an).
create or replace function team_mitglieder(p_team uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team and user_id = auth.uid()) then
    raise exception 'not a member of this team';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
           'user_id', m.user_id,
           'anzeige_name', anzeige_name(m.user_id),
           'email', u.email,
           'ist_verwaltung', exists (select 1 from verein_verwaltung w join teams t on t.verein_id = w.verein_id
                                      where t.id = p_team and w.user_id = m.user_id))
           order by m.created_at)
    from team_members m
    join auth.users u on u.id = m.user_id
    where m.team_id = p_team), '[]'::jsonb);
end;
$$;

-- Rumpf wie in 20261114110000_vereine_bestand.sql; die Fachlogik liegt im
-- Kern (der Verein-Einstieg ruft ihn auch). Rückgabe unverändert.
create or replace function spieler_aus_team_nehmen(p_team uuid, p_spieler uuid, p_stand text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) or not spieler_im_team(p_spieler, p_team) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  v := spieler_aus_team_nehmen_kern(p_team, p_spieler, true, p_stand);
  if v ->> 'status' <> 'herausgenommen' then return v; end if;
  return v || jsonb_build_object(
    'letztes_eigenes_team', not exists (select 1 from team_spieler ts
                                          join team_members m on m.team_id = ts.team_id and m.user_id = auth.uid()
                                         where ts.spieler_id = p_spieler));
end;
$$;

-- ── Funktionen: Team vor Termin (Plan Phase 5) ──────────────────────────────

-- Rumpf wie in 20261018130000_termin_kader.sql; Team-ID ungesperrt lesen,
-- Teamsperre (kader_vorher), erst dann die Termin-Zeile (Muster
-- abmeldung_anwenden). `team_id` eines Termins ändert sich nie; ist er
-- inzwischen weg (Team aufgelöst), TERMIN_NICHT_GEFUNDEN.
create or replace function termin_kader_setzen(p_termin uuid, p_kader uuid[], p_bestaetigt integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_team uuid;
  v_kader uuid[] := array(select distinct k from unnest(coalesce(p_kader, '{}')) k);
  v_verfallen integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  perform kader_vorher(v_team);
  select * into t from training_termine where id = p_termin for update;
  if not found then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if termin_begonnen(t.datum, t.beginn) then raise exception 'KADER_TERMIN_BEGONNEN'; end if;
  if exists (select 1 from unnest(v_kader) k where not exists (select 1 from kader where id = k and team_id = t.team_id)) then
    raise exception 'KADER_NICHT_GEFUNDEN';
  end if;
  delete from termin_kader where termin_id = p_termin;
  insert into termin_kader (termin_id, kader_id, team_id) select p_termin, k, t.team_id from unnest(v_kader) k;
  if t.serie_id is not null then
    update training_termine set kader_abweichend = true where id = p_termin;
  end if;
  v_verfallen := kader_nachher(t.team_id, p_bestaetigt);
  return jsonb_build_object('team', t.team_id, 'verfallen', v_verfallen);
end;
$$;

-- Rumpf wie in 20261031120000_treffpunkt_training.sql; mit `kader` zuerst die
-- Teamsperre, dann die Termin-Zeile. Prüfreihenfolge der Marker bleibt.
create or replace function termin_der_serie_folgen(p_termin uuid, p_angaben text[], p_bestaetigt integer default null)
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

-- Rumpf wie in 20261031120000_treffpunkt_training.sql; dazu zuerst die
-- Teamsperre. terminserie_rechnen sperrt die Termin- und Serienzeilen und
-- legt neue Termine an (FK auf die Team-Zeile); das Auflösen hält die
-- Teamsperre und löscht Team und Termine. Ohne die Sperre vorn konnten beide
-- aufeinander warten (40P01).
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
  -- Ohne Mitgliedschaft keine Sperre; terminserie_rechnen weist dann ab.
  if v_team is not null and ist_team_mitglied(v_team) then
    perform sperre_teams(array[v_team]);
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

-- ── Funktionen: Verein-Ort, Ansichten ───────────────────────────────────────

-- Verein für seine Mitglieder (AK 1–9). Alle sehen Name, Verwaltung
-- (Anzeigename aus dem Profil, sonst null) und alle Teams; nur die
-- Verwaltung zusätzlich E-Mail und user_id der Verwaltung und je Team die
-- Trainer:innen, die Spielerzahl (wie die Grenze 100) und ob es ohne
-- Mitglied ist. Liest team_members direkt (zeigt nur an).
--   {name, verwaltung: [{anzeige_name, ich, (user_id, email)}],
--    teams: [{id, name, ist_mitglied, (trainer, spieler_zahl, ohne_mitglied)}]}
create function verein_ansicht(p_verein uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verwaltung boolean;
begin
  perform nur_in_der_anwendung();
  if not ist_verein_mitglied(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  v_verwaltung := ist_verein_verwaltung(p_verein);
  return jsonb_build_object(
    'name', (select name from vereine where id = p_verein),
    'verwaltung', (select coalesce(jsonb_agg(
                      jsonb_build_object('anzeige_name', p.display_name, 'ich', w.user_id = v_uid)
                      || case when v_verwaltung then jsonb_build_object('user_id', w.user_id, 'email', u.email)
                              else '{}'::jsonb end
                      order by p.display_name nulls last, w.user_id), '[]'::jsonb)
                     from verein_verwaltung w
                     join auth.users u on u.id = w.user_id
                     left join profiles p on p.user_id = w.user_id
                    where w.verein_id = p_verein),
    'teams', (select coalesce(jsonb_agg(
                 jsonb_build_object('id', t.id, 'name', t.name,
                                    'ist_mitglied', exists (select 1 from team_members m
                                                             where m.team_id = t.id and m.user_id = v_uid))
                 || case when v_verwaltung then jsonb_build_object(
                      'trainer', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'user_id', m.user_id, 'anzeige_name', anzeige_name(m.user_id), 'email', u.email,
                                     'ist_verwaltung', exists (select 1 from verein_verwaltung w
                                                                where w.verein_id = p_verein and w.user_id = m.user_id))
                                     order by m.created_at, m.user_id), '[]'::jsonb)
                                    from team_members m join auth.users u on u.id = m.user_id
                                   where m.team_id = t.id),
                      'spieler_zahl', (select count(*) from team_spieler ts where ts.team_id = t.id),
                      'ohne_mitglied', not exists (select 1 from team_members m where m.team_id = t.id))
                    else '{}'::jsonb end
                 order by t.name, t.id), '[]'::jsonb)
                from teams t where t.verein_id = p_verein));
end;
$$;

-- Ein Team für die Verwaltung, ohne Mitgliedschaft (AK 10, 25): Trainer:innen
-- mit E-Mail, Spieler:innen mit allen ihren Teams, Zahlen für das Auflösen
-- (Trainings wie in der Trainings-Ansicht ohne Termin-Trainings, Termine und
-- Spiele nach Art, Kader). Nie J+S-Nummer, Link oder Token.
--   {id, name, spieler_zahl, ich_mitglied,
--    trainer: [{user_id, anzeige_name, email, ist_verwaltung, ich}],
--    spieler: [{id, vorname, nachname, jahrgang, schnuppert, teams: [{id, name}]}],
--    aufloesung: {trainings, termine, spiele, kader}}
create function verein_team_ansicht(p_team uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verein uuid;
begin
  perform nur_in_der_anwendung();
  v_verein := (select verein_id from teams where id = p_team);
  if not ist_verein_verwaltung(v_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  return (select jsonb_build_object(
    'id', t.id, 'name', t.name,
    'spieler_zahl', (select count(*) from team_spieler ts where ts.team_id = t.id),
    'ich_mitglied', exists (select 1 from team_members m where m.team_id = t.id and m.user_id = v_uid),
    'trainer', (select coalesce(jsonb_agg(jsonb_build_object(
                   'user_id', m.user_id, 'anzeige_name', anzeige_name(m.user_id), 'email', u.email,
                   'ist_verwaltung', exists (select 1 from verein_verwaltung w
                                              where w.verein_id = v_verein and w.user_id = m.user_id),
                   'ich', m.user_id = v_uid)
                   order by m.created_at, m.user_id), '[]'::jsonb)
                  from team_members m join auth.users u on u.id = m.user_id
                 where m.team_id = t.id),
    'spieler', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', s.id, 'vorname', s.vorname, 'nachname', s.nachname, 'jahrgang', s.jahrgang,
                   'schnuppert', ts.probe_seit is not null,
                   'teams', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name)
                                                       order by a.name, a.id), '[]'::jsonb)
                               from team_spieler z join teams a on a.id = z.team_id
                              where z.spieler_id = s.id))
                   order by s.vorname, s.nachname, s.jahrgang, s.id), '[]'::jsonb)
                  from team_spieler ts join spieler s on s.id = ts.spieler_id
                 where ts.team_id = t.id),
    'aufloesung', jsonb_build_object(
      'trainings', (select count(*) from trainings r where r.team_id = t.id and not r.termin_training),
      'termine', (select count(*) from training_termine tt where tt.team_id = t.id and tt.art = 'training'),
      'spiele', (select count(*) from training_termine tt where tt.team_id = t.id and tt.art = 'spiel'),
      'kader', (select count(*) from kader k where k.team_id = t.id)))
    from teams t where t.id = p_team);
end;
$$;

-- ── Funktionen: Verein-Ort, Teams ───────────────────────────────────────────

-- Team anlegen, ohne Mitglied zu werden (AK 17). Name mit gleichem Schlüssel
-- → {status: 'abgewiesen', grund: 'name_vergeben', team: <Name>} (AK 21);
-- sonst {status: 'angelegt', id}. Grenze 30 und Teamname prüft auch der
-- Trigger (VEREIN_TEAMS_VOLL, TEAMNAME_VERGEBEN), Länge der CHECK.
create function verein_team_anlegen(p_verein uuid, p_name text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(p_name);
  v_vergeben text;
  v_team uuid;
begin
  perform nur_in_der_anwendung();
  perform verwaltung_sperren(p_verein);
  v_vergeben := teamname_vergeben(p_verein, v_name);
  if v_vergeben is not null then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'name_vergeben', 'team', v_vergeben);
  end if;
  insert into teams (name, verein_id) values (v_name, p_verein) returning id into v_team;
  return jsonb_build_object('status', 'angelegt', 'id', v_team);
end;
$$;

-- Team umbenennen (AK 19–22). Geprüft wird nur ein neuer Schlüssel: Eine
-- andere Schreibweise des eigenen Namens geht, auch bei Altdubletten (PC 6).
--   {status: 'umbenannt', name} | {status: 'abgewiesen', grund: 'name_vergeben', team}
create function verein_team_umbenennen(p_team uuid, p_name text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(p_name);
  v_verein uuid;
  v_alt text;
  v_vergeben text;
begin
  perform nur_in_der_anwendung();
  v_verein := verwaltung_team_sperren(p_team);
  v_alt := (select name from teams where id = p_team);   -- unter der Vereinssperre (Anlegen, Umbenennen, Auflösen)
  if spieler_text_schluessel(v_name) is distinct from spieler_text_schluessel(v_alt) then
    v_vergeben := teamname_vergeben(v_verein, v_name, p_team);
    if v_vergeben is not null then
      return jsonb_build_object('status', 'abgewiesen', 'grund', 'name_vergeben', 'team', v_vergeben);
    end if;
  end if;
  update teams set name = v_name where id = p_team;
  return jsonb_build_object('status', 'umbenannt', 'name', v_name);
end;
$$;

-- Vereinsname (AK 23); Länge und Rand prüft der CHECK `verein_name`.
create function verein_umbenennen(p_verein uuid, p_name text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(p_name);
begin
  perform nur_in_der_anwendung();
  perform verwaltung_sperren(p_verein);
  update vereine set name = v_name where id = p_verein;
  return jsonb_build_object('status', 'umbenannt', 'name', v_name);
end;
$$;

-- Team auflösen mit dem aktuellen Namen (AK 24; Vergleich wie bisher:
-- Rand-Leerzeichen und Unicode-Form zählen nicht, Gross/Klein schon).
-- Sperren Verein → Team vor dem DELETE; die Kaskade nimmt Inhalte,
-- Zuordnungen und Mitgliedschaften mit, die Spieler:innen bleiben im Verein
-- (PC 1, 2). Rumpf nach loese_team_auf (20261114110000_vereine_bestand.sql).
-- `name` nennt den Namen des aufgelösten Teams (für die Meldung danach).
--   {status: 'name_falsch', name} | {status: 'aufgeloest', name, bilder, spieler_bleiben}
create function verein_team_aufloesen(p_team uuid, p_teamname text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_bilder jsonb;
  v_spieler int;
begin
  perform nur_in_der_anwendung();
  perform verwaltung_team_sperren(p_team);
  perform sperre_teams(array[p_team]);
  select name into v_name from teams where id = p_team for update;
  if p_teamname is null
     or normalize(btrim(p_teamname), nfc) is distinct from normalize(v_name, nfc) then
    return jsonb_build_object('status', 'name_falsch', 'name', v_name);
  end if;
  v_bilder := team_bilder(p_team);
  v_spieler := (select count(*) from team_spieler where team_id = p_team);
  delete from teams where id = p_team;
  return jsonb_build_object('status', 'aufgeloest', 'name', v_name, 'bilder', v_bilder, 'spieler_bleiben', v_spieler);
end;
$$;

-- Spieler:in aus einem Team nehmen, ohne Mitgliedschaft (#579 AK 11, 17).
-- Kein Stand-Vergleich (die Verwaltung sieht alle Teams). Ein inzwischen
-- aufgelöstes Team ist VEREIN_NICHT_GEFUNDEN (verwaltung_team_sperren).
--   {status: 'herausgenommen', ohne_team}
create function verein_spieler_aus_team_nehmen(p_team uuid, p_spieler uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform nur_in_der_anwendung();
  perform verwaltung_team_sperren(p_team);
  return spieler_aus_team_nehmen_kern(p_team, p_spieler, false, null);
end;
$$;

-- ── Funktionen: Verein-Ort, Personen ────────────────────────────────────────

-- Vorschau der Aufnahme (AK 13, 30): mit p_team ins Team (bereits_mitglied),
-- ohne in die Verwaltung (bereits_verwaltung). Bremse und Zählregel wie am
-- Team-Ort (aufnahme_ziel). `anderer_verein` nennt weder Verein noch Namen.
--   {status: 'gefunden', anzeige_name} | {status}
create function verein_finde_person(p_verein uuid, p_email text, p_team uuid default null) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  z record;
begin
  perform nur_in_der_anwendung();
  if not ist_verein_verwaltung(p_verein)
     or (p_team is not null and not exists (select 1 from teams where id = p_team and verein_id = p_verein)) then
    raise exception 'VEREIN_NICHT_GEFUNDEN';
  end if;
  z := aufnahme_ziel(auth.uid(), p_email, p_verein, false);
  if z.o_status is not null then
    return jsonb_build_object('status', z.o_status);
  end if;
  if p_team is not null and exists (select 1 from team_members where team_id = p_team and user_id = z.o_ziel) then
    return jsonb_build_object('status', 'bereits_mitglied');
  end if;
  if p_team is null and exists (select 1 from verein_verwaltung where verein_id = p_verein and user_id = z.o_ziel) then
    return jsonb_build_object('status', 'bereits_verwaltung');
  end if;
  return jsonb_build_object('status', 'gefunden', 'anzeige_name', anzeige_name(z.o_ziel));
end;
$$;

-- Trainer:in ins Team aufnehmen, sofort (AK 13). Sperren Verein → Person.
--   {status: 'aufgenommen', anzeige_name} | {status}
create function verein_team_aufnehmen(p_team uuid, p_email text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_verein uuid;
  z record;
begin
  perform nur_in_der_anwendung();
  v_verein := verwaltung_team_sperren(p_team);
  z := aufnahme_ziel(auth.uid(), p_email, v_verein, true);
  if z.o_status is not null then
    return jsonb_build_object('status', z.o_status);
  end if;
  if exists (select 1 from team_members where team_id = p_team and user_id = z.o_ziel) then
    return jsonb_build_object('status', 'bereits_mitglied');
  end if;
  insert into team_members (team_id, user_id) values (p_team, z.o_ziel);
  return jsonb_build_object('status', 'aufgenommen', 'anzeige_name', anzeige_name(z.o_ziel));
end;
$$;

-- Sich selbst ins Team aufnehmen, ohne Bremse; wiederholbar (AK 12).
create function verein_team_beitreten(p_team uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform nur_in_der_anwendung();
  perform verwaltung_team_sperren(p_team);
  insert into team_members (team_id, user_id) values (p_team, auth.uid()) on conflict do nothing;
  return jsonb_build_object('status', 'beigetreten');
end;
$$;

-- Jede Trainer:in aus dem Team nehmen, auch sich selbst; das Team bleibt
-- (AK 14, PC 3). Sperren Verein → Team (wie Austritt und Auflösen).
create function verein_team_mitglied_entfernen(p_team uuid, p_user uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform nur_in_der_anwendung();
  perform verwaltung_team_sperren(p_team);
  perform sperre_teams(array[p_team]);
  delete from team_members where team_id = p_team and user_id = p_user;
  return jsonb_build_object('status', 'entfernt');
end;
$$;

-- Person in die Verwaltung aufnehmen, sofort, ohne Obergrenze (AK 30).
-- Unter der Vereinssperre prüft verwaltung_sperren die Verwaltung erneut (ein
-- gleichzeitiges Entfernen kann sie eben genommen haben).
--   {status: 'aufgenommen', anzeige_name} | {status}
create function verein_verwaltung_aufnehmen(p_verein uuid, p_email text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  z record;
begin
  perform nur_in_der_anwendung();
  perform verwaltung_sperren(p_verein);
  z := aufnahme_ziel(auth.uid(), p_email, p_verein, true);
  if z.o_status is not null then
    return jsonb_build_object('status', z.o_status);
  end if;
  if exists (select 1 from verein_verwaltung where verein_id = p_verein and user_id = z.o_ziel) then
    return jsonb_build_object('status', 'bereits_verwaltung');
  end if;
  insert into verein_verwaltung (verein_id, user_id) values (p_verein, z.o_ziel);
  return jsonb_build_object('status', 'aufgenommen', 'anzeige_name', anzeige_name(z.o_ziel));
end;
$$;

-- Person aus der Verwaltung nehmen oder selbst austreten (AK 31–33). Die
-- letzte Person bleibt: {status: 'letzte_verwaltung'} (Netz: Trigger
-- verwaltung_vorher, LETZTE_VERWALTUNG). Teammitgliedschaften bleiben (PC 4).
-- Unter der Vereinssperre prüft verwaltung_sperren die eigene Verwaltung
-- erneut (zwei, die sich gegenseitig entfernen: die zweite ist danach keine
-- Verwaltung mehr).
create function verein_verwaltung_entfernen(p_verein uuid, p_user uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform nur_in_der_anwendung();
  perform verwaltung_sperren(p_verein);
  if not exists (select 1 from verein_verwaltung where verein_id = p_verein and user_id = p_user) then
    return jsonb_build_object('status', 'entfernt');
  end if;
  if not exists (select 1 from verein_verwaltung where verein_id = p_verein and user_id <> p_user) then
    return jsonb_build_object('status', 'letzte_verwaltung');
  end if;
  delete from verein_verwaltung where verein_id = p_verein and user_id = p_user;
  return jsonb_build_object('status', 'entfernt');
end;
$$;

-- ── Policies ────────────────────────────────────────────────────────────────

-- Teams schreibt nur noch die Verwaltung per RPC (AP §3.6, §4.2).
drop policy teams_update on teams;

-- ── Trigger ─────────────────────────────────────────────────────────────────

drop trigger teams_vorher on teams;
create trigger teams_vorher before insert or update of name on teams
  for each row execute function teams_vorher();

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on teams from authenticated;
grant select on teams to authenticated;

revoke all on function teamname_vergeben(uuid, text, uuid) from public, anon, authenticated;
revoke all on function verwaltung_sperren(uuid) from public, anon, authenticated;
revoke all on function verwaltung_team_sperren(uuid) from public, anon, authenticated;
revoke all on function aufnahme_ziel(uuid, text, uuid, boolean) from public, anon, authenticated;
revoke all on function spieler_aus_team_nehmen_kern(uuid, uuid, boolean, text) from public, anon, authenticated;

revoke all on function entferne_team_mitglied(uuid, uuid) from public, anon;
grant execute on function entferne_team_mitglied(uuid, uuid) to authenticated;
revoke all on function verein_ansicht(uuid) from public, anon;
grant execute on function verein_ansicht(uuid) to authenticated;
revoke all on function verein_team_ansicht(uuid) from public, anon;
grant execute on function verein_team_ansicht(uuid) to authenticated;
revoke all on function verein_team_anlegen(uuid, text) from public, anon;
grant execute on function verein_team_anlegen(uuid, text) to authenticated;
revoke all on function verein_team_umbenennen(uuid, text) from public, anon;
grant execute on function verein_team_umbenennen(uuid, text) to authenticated;
revoke all on function verein_umbenennen(uuid, text) from public, anon;
grant execute on function verein_umbenennen(uuid, text) to authenticated;
revoke all on function verein_team_aufloesen(uuid, text) from public, anon;
grant execute on function verein_team_aufloesen(uuid, text) to authenticated;
revoke all on function verein_spieler_aus_team_nehmen(uuid, uuid) from public, anon;
grant execute on function verein_spieler_aus_team_nehmen(uuid, uuid) to authenticated;
revoke all on function verein_finde_person(uuid, text, uuid) from public, anon;
grant execute on function verein_finde_person(uuid, text, uuid) to authenticated;
revoke all on function verein_team_aufnehmen(uuid, text) from public, anon;
grant execute on function verein_team_aufnehmen(uuid, text) to authenticated;
revoke all on function verein_team_beitreten(uuid) from public, anon;
grant execute on function verein_team_beitreten(uuid) to authenticated;
revoke all on function verein_team_mitglied_entfernen(uuid, uuid) from public, anon;
grant execute on function verein_team_mitglied_entfernen(uuid, uuid) to authenticated;
revoke all on function verein_verwaltung_aufnehmen(uuid, text) from public, anon;
grant execute on function verein_verwaltung_aufnehmen(uuid, text) to authenticated;
revoke all on function verein_verwaltung_entfernen(uuid, uuid) from public, anon;
grant execute on function verein_verwaltung_entfernen(uuid, uuid) to authenticated;

reset lock_timeout;
