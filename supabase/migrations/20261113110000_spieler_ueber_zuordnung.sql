-- Spieler:innen über die Zuordnung (Story 1 #577, Epic #575; Architekturplan
-- Vereine §3.2, §3.3 c, §4.4).
--
-- Mengen und Prüfungen lesen `team_spieler` statt `spieler.team_id`, der
-- Schnupper-Status liegt auf der Zuordnung (`team_spieler.probe_seit`).
-- Ohne Verhaltensänderung: Bis Story 3 hat jede Spieler:in genau eine
-- Zuordnung, und zwar zu `spieler.team_id`. Signaturen und Ausgaben bleiben.
--
-- Die Schreibwege tragen `verein_id` und die Zuordnung selbst ein und sperren
-- in der Sperrordnung Verein → Teams → `spieler`-Zeile (AP §4.1). Die Grenzen
-- 100 je Team (`team_spieler_vorher`) und 1000 je Verein (`spieler_vorher`)
-- kommen hier, nach dem Backfill der Fundament-Migration, und wirken nur auf
-- neue Einträge: Bestand über einer Grenze bleibt (Story 1 PC 2, 3).
-- `spieler.team_id` schreibt `spieler_aufnehmen` bis Story 3 noch mit;
-- `spieler.probe_seit` ist ab hier tot und fällt mit N1 (AP §3.8).
--
-- Bewusst noch über `spieler.team_id` (Pflicht-Inventar, AP §5.5): die
-- Rechteprüfungen ohne `p_team` (spieler_aendern, spieler_entfernen,
-- spieler_link_holen/_erneuern, spieler_probe_folgen/_setzen), der Link
-- (spieler_link_ansicht, spieler_link_abmelden) und feedback_link_team. Sie
-- bekommen mit Story 2, 3, 7 und 8 ihren Teambezug.

set lock_timeout = '5s';

-- ── Funktionen: Helfer ──────────────────────────────────────────────────────

create function spieler_im_team(p_spieler uuid, p_team uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select exists (select 1 from team_spieler where spieler_id = p_spieler and team_id = p_team); $$;

-- Hat das Team noch keine Zuordnung, ersetzt die erste Spieler:in die
-- erwartete Spielerzahl anstehender Termine und der Serien (bisher doppelt in
-- spieler_aufnehmen und spieler_importieren). Rückgabe: ersetzte Termine.
create function spielerzahl_freigeben(p_team uuid) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ersetzt integer := 0;
begin
  if exists (select 1 from team_spieler where team_id = p_team) then return 0; end if;
  update training_termine set erwartete_spielerzahl = null, spielerzahl_abweichend = false
   where team_id = p_team and erwartete_spielerzahl is not null and not termin_begonnen(datum, beginn);
  get diagnostics v_ersetzt = row_count;
  update termin_serien set erwartete_spielerzahl = null
   where team_id = p_team and erwartete_spielerzahl is not null;
  return v_ersetzt;
end;
$$;

-- ── Funktionen: Trigger der Grenzen ─────────────────────────────────────────

-- Rumpf wie in 20261016100000_spielerliste.sql, neu gefasst (AP §3.3 c):
-- INSERT unter der Vereinssperre, höchstens 1000 je Verein, alle Einträge
-- zählen (Story 1 PC 3; Zwilling VEREIN_SPIELER_MAX in web/lib/verein.ts).
-- Die Teamgrenze und das Festhalten beim Aufnehmen liegen jetzt bei
-- team_spieler_vorher. DELETE: alle noch bestehenden Teams der Spieler:in
-- sperren und festhalten, bevor die Kaskade läuft (Netz; die löschende RPC
-- sperrt vorher selbst). Beim Auflösen des Teams nicht — es geht alles mit.
create or replace function spieler_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_teams uuid[];
  v_team uuid;
begin
  if tg_op = 'INSERT' then
    if new.verein_id is null then raise exception 'VEREIN_FEHLT'; end if;
    perform sperre_verein(new.verein_id);
    if (select count(*) from spieler where verein_id = new.verein_id) >= 1000 then
      raise exception 'VEREIN_VOLL';
    end if;
    return new;
  end if;
  v_teams := array(select ts.team_id from team_spieler ts join teams t on t.id = ts.team_id
                    where ts.spieler_id = old.id order by ts.team_id);
  if cardinality(v_teams) = 0 then return old; end if;
  if old.verein_id is not null then perform sperre_verein(old.verein_id); end if;
  perform sperre_teams(v_teams);
  foreach v_team in array v_teams loop
    perform termine_einfrieren(v_team);
  end loop;
  return old;
end;
$$;

-- Vor dem Zuordnen (AP §3.3 c, Grundfassung): Teamsperre, dann die
-- `spieler`-Zeile; höchstens 100 Zuordnungen je Team, Schnuppernde zählen
-- mit (Zwilling SPIELER_MAX in web/lib/spieler.ts); den Stand der begonnenen
-- Termine festhalten (die neue Spieler:in zählt dort nicht). Story 3 ergänzt
-- DELETE, SCHON_ZUGEORDNET und den Schlüssel im Zielteam.
create function team_spieler_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform sperre_teams(array[new.team_id]);
  perform 1 from spieler where id = new.spieler_id for update;
  if (select count(*) from team_spieler where team_id = new.team_id) >= 100 then
    raise exception 'SPIELERLISTE_VOLL';
  end if;
  perform termine_einfrieren(new.team_id);
  return new;
end;
$$;

-- ── Funktionen: Schreibwege ─────────────────────────────────────────────────

-- Rumpf wie in 20261016100000_spielerliste.sql; Sperre zuerst auf den Verein,
-- dann das Team (AP §3.3 c), `verein_id` aus dem Team, Zuordnung selbst
-- eingetragen; `team_id` bis Story 3 mitgeschrieben.
create or replace function spieler_aufnehmen(p_team uuid, p_vorname text, p_nachname text, p_jahrgang integer, p_js text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_verein uuid;
  v_ersetzt int := 0;
  v_js text := nullif(btrim(coalesce(p_js, '')), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  select verein_id into v_verein from teams where id = p_team;
  perform sperre_verein(v_verein);
  perform sperre_teams(array[p_team]);
  v_ersetzt := spielerzahl_freigeben(p_team);
  begin
    insert into spieler (team_id, verein_id, vorname, nachname, jahrgang, js_nummer)
      values (p_team, v_verein, spieler_text_bereinigt(p_vorname), spieler_text_bereinigt(p_nachname), p_jahrgang, v_js)
      returning id into v_id;
  exception when unique_violation then
    raise exception 'SPIELER_DOPPELT';
  end;
  insert into team_spieler (team_id, spieler_id, verein_id) values (p_team, v_id, v_verein);
  return jsonb_build_object('id', v_id, 'ersetzt', v_ersetzt);
end;
$$;

-- Rumpf wie in 20261018100000_spieler_import.sql; Menge über team_spieler.
-- Bis Story 9 nur auf die Grenzen angepasst: Teamgrenze 100 nur bei neuen
-- Zeilen (ein reiner J+S-Import geht auch bei Bestand über 100, Story 1 PC 2;
-- Zwilling `importZuGross` in web/lib/spieler-import.ts), die Vereinsgrenze
-- prüft spieler_vorher. Sperre Verein → Team.
create or replace function spieler_importieren(p_team uuid, p_zeilen jsonb, p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_verein uuid;
  v_zeilen jsonb;
  v_bestand int;
  v_neu jsonb;
  v_js jsonb;
  v_ersetzt int := 0;
  v_ids uuid[];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if jsonb_typeof(p_zeilen) <> 'array' or jsonb_array_length(p_zeilen) > 1000 then
    raise exception 'SPIELERLISTE_VOLL';
  end if;
  select verein_id into v_verein from teams where id = p_team;
  if p_erwartet is not null then
    perform sperre_verein(v_verein);
    perform sperre_teams(array[p_team]);
  end if;

  -- Jede Zeile einmal je Spieler:in (die letzte), mit der bestehenden, die
  -- sie meint.
  with roh as (
    select (z->>'zeile')::int as zeile,
           spieler_text_bereinigt(z->>'vorname') as vorname,
           spieler_text_bereinigt(z->>'nachname') as nachname,
           (z->>'jahrgang')::int as jahrgang,
           nullif(btrim(coalesce(z->>'js', '')), '') as js
      from jsonb_array_elements(p_zeilen) z
  ), letzte as (
    select distinct on (spieler_text_schluessel(vorname), spieler_text_schluessel(nachname), jahrgang) *
      from roh
     order by spieler_text_schluessel(vorname), spieler_text_schluessel(nachname), jahrgang, zeile desc
  ), im_team as (
    select s.* from spieler s join team_spieler ts on ts.spieler_id = s.id and ts.team_id = p_team
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'zeile', l.zeile, 'vorname', l.vorname, 'nachname', l.nachname, 'jahrgang', l.jahrgang,
           'js', l.js, 'id', s.id, 'alt', s.js_nummer) order by l.zeile), '[]'::jsonb)
    into v_zeilen
    from letzte l
    left join im_team s on spieler_text_schluessel(s.vorname) = spieler_text_schluessel(l.vorname)
                       and spieler_text_schluessel(s.nachname) = spieler_text_schluessel(l.nachname)
                       and s.jahrgang = l.jahrgang;

  select count(*) into v_bestand from team_spieler where team_id = p_team;
  select coalesce(jsonb_agg((z->>'zeile')::int order by (z->>'zeile')::int), '[]'::jsonb) into v_neu
    from jsonb_array_elements(v_zeilen) z where z->>'id' is null;
  select coalesce(jsonb_agg(jsonb_build_object('zeile', (z->>'zeile')::int, 'alt', z->'alt') order by (z->>'zeile')::int), '[]'::jsonb)
    into v_js
    from jsonb_array_elements(v_zeilen) z
   where z->>'id' is not null and z->>'js' is not null and z->>'js' is distinct from z->>'alt';

  if p_erwartet is null then
    return jsonb_build_object(
      'neu', v_neu,
      'js', v_js,
      'gleich', (select coalesce(jsonb_agg((z->>'zeile')::int order by (z->>'zeile')::int), '[]'::jsonb)
                   from jsonb_array_elements(v_zeilen) z
                  where z->>'id' is not null and (z->>'js' is null or z->>'js' = z->>'alt')),
      'bestand', v_bestand);
  end if;

  if v_neu <> coalesce(p_erwartet->'neu', '[]'::jsonb)
     or (select coalesce(jsonb_agg(j->'zeile' order by (j->>'zeile')::int), '[]'::jsonb) from jsonb_array_elements(v_js) j)
        <> coalesce(p_erwartet->'js', '[]'::jsonb) then
    raise exception 'SPIELERLISTE_GEAENDERT';
  end if;
  if jsonb_array_length(v_neu) > 0 and v_bestand + jsonb_array_length(v_neu) > 100 then
    raise exception 'SPIELERLISTE_VOLL';
  end if;

  if jsonb_array_length(v_neu) > 0 then
    v_ersetzt := spielerzahl_freigeben(p_team);
  end if;

  with neu as (
    insert into spieler (team_id, verein_id, vorname, nachname, jahrgang, js_nummer)
    select p_team, v_verein, z->>'vorname', z->>'nachname', (z->>'jahrgang')::int, z->>'js'
      from jsonb_array_elements(v_zeilen) z
     where z->>'id' is null
     order by (z->>'zeile')::int
    returning id)
  select coalesce(array_agg(id), '{}') into v_ids from neu;
  insert into team_spieler (team_id, spieler_id, verein_id)
  select p_team, x, v_verein from unnest(v_ids) x;

  update spieler s set js_nummer = z->>'js'
    from jsonb_array_elements(v_zeilen) z
   where z->>'id' is not null and s.id = (z->>'id')::uuid
     and z->>'js' is not null and z->>'js' is distinct from z->>'alt';

  return jsonb_build_object('neu', jsonb_array_length(v_neu), 'js', jsonb_array_length(v_js), 'ersetzt', v_ersetzt);
end;
$$;

-- Rumpf wie in 20261016100000_spielerliste.sql; die Sperren vor dem DELETE
-- (AP §4.1, löschende RPCs): Verein, Teams, Zeile. Sonst sperrte das DELETE
-- zuerst die Zeile und spieler_vorher erst danach Verein und Team. Fällt mit
-- Story 3 weg.
create or replace function spieler_entfernen(p_spieler uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from spieler where id = p_spieler;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  perform sperre_verein((select verein_id from spieler where id = p_spieler));
  perform sperre_teams(array(select team_id from team_spieler where spieler_id = p_spieler));
  perform 1 from spieler where id = p_spieler for update;
  delete from spieler where id = p_spieler;
end;
$$;

-- Rumpf wie in 20261029110000_probetraining.sql; der Schnupper-Status liegt
-- auf der Zuordnung zum Team (AP §3.2). Signatur bleibt bis Story 8.
create or replace function spieler_probe_setzen(p_spieler uuid, p_probe boolean, p_bestaetigt integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v_jetzt boolean;
  v_ab integer := 0;
  v_sp integer := 0;
  v_kz integer := 0;
  v integer := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from spieler where id = p_spieler;
  if v_team is null or not ist_team_mitglied(v_team) or p_probe is null then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  -- Dieselbe Sperre wie jede Meldung; dann begonnene Trainings festhalten:
  -- Ihr Stand bei Beginn folgte noch dem bisherigen Grundstand.
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || v_team::text, 0));
  perform termine_einfrieren(v_team);
  perform 1 from spieler where id = p_spieler for update;
  select probe_seit is not null into v_jetzt from team_spieler where spieler_id = p_spieler and team_id = v_team;
  if v_jetzt = p_probe then
    return jsonb_build_object('probe', p_probe, 'verfallen', 0);
  end if;
  if p_probe then
    if not exists (select 1 from team_probetraining where team_id = v_team) then
      raise exception 'PROBE_ANZAHL_FEHLT';
    end if;
    select count(*) into v_ab from termin_abmeldungen a join training_termine t on t.id = a.termin_id
     where a.spieler_id = p_spieler and a.verfallen_am is null and not a.angemeldet
       and not termin_begonnen(t.datum, t.beginn);
    select count(*) filter (where m.zustand is not null), count(*) filter (where m.nicht_aufgeboten)
      into v_sp, v_kz
      from spiel_meldungen m join training_termine t on t.id = m.termin_id
     where m.spieler_id = p_spieler and not termin_begonnen(t.datum, t.beginn);
    v := v_ab + v_sp + v_kz;
    if v > 0 and p_bestaetigt is distinct from v then
      raise exception 'PROBE_VERFALLEN % % % %', v, v_ab, v_sp, v_kz;
    end if;
  end if;
  -- Kommende Trainings beginnen im neuen Grundstand (PC 1, 9); niemand hat
  -- dort gewechselt.
  delete from termin_abmeldungen a using training_termine t
   where a.termin_id = t.id and a.spieler_id = p_spieler and not termin_begonnen(t.datum, t.beginn);
  delete from termin_statuswechsel w using training_termine t
   where w.termin_id = t.id and w.spieler_id = p_spieler and not termin_begonnen(t.datum, t.beginn);
  update team_spieler set probe_seit = case when p_probe then now() end
   where spieler_id = p_spieler and team_id = v_team;
  -- Spiele gelten nun nicht mehr: ihre Meldungen und Kennzeichnungen fallen.
  if p_probe then perform spiel_kader_bereinigen(v_team); end if;
  return jsonb_build_object('probe', p_probe, 'verfallen', v);
end;
$$;

-- ── Funktionen: Lesepfade, Menge über team_spieler ──────────────────────────

-- Rumpf wie in 20261016100000_spielerliste.sql; Menge über team_spieler.
create or replace function termin_spielerzahl_regel() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.erwartete_spielerzahl is null
     or not exists (select 1 from team_spieler where team_id = new.team_id)
     or termin_begonnen(new.datum, new.beginn) then
    return new;
  end if;
  if tg_op = 'INSERT' or new.erwartete_spielerzahl is distinct from old.erwartete_spielerzahl then
    raise exception 'SPIELERLISTE_FUEHRT_ZAHL';
  end if;
  new.erwartete_spielerzahl := null;
  new.spielerzahl_abweichend := false;
  return new;
end;
$$;

-- Rumpf wie in 20261016100000_spielerliste.sql; Menge über team_spieler.
create or replace function serie_spielerzahl_regel() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.erwartete_spielerzahl is not null
     and (tg_op = 'INSERT' or new.erwartete_spielerzahl is distinct from old.erwartete_spielerzahl)
     and exists (select 1 from team_spieler where team_id = new.team_id) then
    raise exception 'SPIELERLISTE_FUEHRT_ZAHL';
  end if;
  return new;
end;
$$;

-- Rumpf wie in 20261016140000_selbstabholung.sql; Menge über team_spieler.
create or replace function abholung_abholen(p_token text, p_schluessel text, p_vorname text, p_nachname text, p_jahrgang integer)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  sp abholung_sperren;
  s spieler;
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

  -- Ein Treffer setzt die Fehlversuche NICHT zurück: Sonst rät, wer ein Kind
  -- kennt, zwischen zwei Treffern beliebig viele fremde Namen. Sie laufen nur
  -- mit den 15 Minuten aus.
  update spieler set link_bezogen = true where id = s.id;
  return jsonb_build_object('status', 'ok', 'token', s.link_token,
                            'spieler', jsonb_build_object('vorname', s.vorname, 'nachname', s.nachname));
end;
$$;

-- Rumpf wie in 20261018120000_kader.sql; Prüfung über spieler_im_team.
create or replace function kader_zuteilung_aendern(p_team uuid, p_spieler uuid[], p_dazu uuid[] default '{}',
                                                   p_weg uuid[] default '{}', p_bestaetigt integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_dazu integer;
  v_weg integer;
  v_verfallen integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if exists (select 1 from unnest(coalesce(p_spieler, '{}')) x where not spieler_im_team(x, p_team)) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  if exists (select 1 from unnest(coalesce(p_dazu, '{}') || coalesce(p_weg, '{}')) x
              where not exists (select 1 from kader k where k.id = x and k.team_id = p_team)) then
    raise exception 'KADER_NICHT_GEFUNDEN';
  end if;
  perform kader_vorher(p_team);
  insert into kader_spieler (kader_id, spieler_id, team_id)
    select k, s, p_team from unnest(coalesce(p_dazu, '{}')) k cross join unnest(coalesce(p_spieler, '{}')) s
    on conflict do nothing;
  get diagnostics v_dazu = row_count;
  delete from kader_spieler
   where team_id = p_team and kader_id = any(coalesce(p_weg, '{}')) and spieler_id = any(coalesce(p_spieler, '{}'));
  get diagnostics v_weg = row_count;
  v_verfallen := kader_nachher(p_team, p_bestaetigt);
  return jsonb_build_object('dazu', v_dazu, 'weg', v_weg, 'verfallen', v_verfallen);
end;
$$;

-- Rumpf wie in 20261021230000_spiel_aufgebot.sql; Menge über team_spieler.
create or replace function spiel_einfrieren(p_termin uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from training_termine where id = p_termin and art = 'spiel';
  if v_team is null or not exists (select 1 from team_spieler where team_id = v_team) then return; end if;
  insert into termin_eingefroren (termin_id, team_id, mit_liste) values (p_termin, v_team, true)
    on conflict (termin_id) do nothing;
  if not found then return; end if;
  insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, gewechselt_am, nicht_aufgeboten)
    select p_termin, v_team, ts.spieler_id, m.zustand, m.gewechselt_am, coalesce(m.nicht_aufgeboten, false)
      from team_spieler ts
      left join spiel_meldungen m on m.termin_id = p_termin and m.spieler_id = ts.spieler_id
     where ts.team_id = v_team and termin_gilt_fuer(p_termin, ts.spieler_id);
  delete from spiel_meldungen where termin_id = p_termin;
end;
$$;

-- Rumpf wie in 20261021230000_spiel_aufgebot.sql; Menge über team_spieler.
create or replace function spiele_einfrieren(p_team uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  with neu as (
    insert into termin_eingefroren (termin_id, team_id, mit_liste)
      select t.id, t.team_id, exists (select 1 from team_spieler where team_id = p_team) from training_termine t
       where t.team_id = p_team
         and t.art = 'spiel'
         and t.datum <= heute_am_trainingsort()
         and termin_begonnen(t.datum, t.beginn)
      on conflict (termin_id) do nothing
      returning termin_id),
  teilnahmen as (
    insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, gewechselt_am, nicht_aufgeboten)
      select n.termin_id, p_team, ts.spieler_id, m.zustand, m.gewechselt_am, coalesce(m.nicht_aufgeboten, false)
        from neu n cross join team_spieler ts
        left join spiel_meldungen m on m.termin_id = n.termin_id and m.spieler_id = ts.spieler_id
       where ts.team_id = p_team and termin_gilt_fuer(n.termin_id, ts.spieler_id)
      returning termin_id)
  delete from spiel_meldungen m using neu n where m.termin_id = n.termin_id;
end;
$$;

-- Rumpf wie in 20261021230000_spiel_aufgebot.sql; Prüfung über spieler_im_team.
create or replace function spiel_pruefen(p_termin uuid, p_spieler uuid, p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_team uuid;
  v_stand jsonb;
begin
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is not null then
    perform pg_advisory_xact_lock(hashtextextended('spieler:' || v_team::text, 0));
  end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or t.art <> 'spiel' or not spieler_im_team(p_spieler, t.team_id) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  v_stand := jsonb_build_object('datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                'ende', to_char(t.ende, 'HH24:MI'), 'ausgefallen', t.ausgefallen,
                                'frist', to_char(spiel_frist(t), 'YYYY-MM-DD"T"HH24:MI'));
  if (p_gesehen_datum is not null and p_gesehen_datum is distinct from t.datum)
     or (p_gesehen_beginn is not null and p_gesehen_beginn is distinct from t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'verlegt', 'stand', v_stand);
  end if;
  if t.ausgefallen then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'ausgefallen', 'stand', v_stand);
  end if;
  if termin_begonnen(t.datum, t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'begonnen', 'stand', v_stand);
  end if;
  if not termin_gilt_fuer(p_termin, p_spieler) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'gilt_nicht', 'stand', v_stand);
  end if;
  return null;
end;
$$;

-- Rumpf wie in 20261021240000_spiel_nachtrag.sql. Nachtragen geht für jede
-- Spieler:in im festgehaltenen Stand, auch eine später herausgenommene
-- (AP §3.2, Story 3 AK 18); darum nicht allein spieler_im_team. Heute fällt
-- beides zusammen.
create or replace function spiel_anwesenheit_setzen(p_termin uuid, p_spieler uuid, p_da boolean,
                                                    p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_stand jsonb;
  v_nachgetragen boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin;
  if not found or t.art <> 'spiel' or not ist_team_mitglied(t.team_id) or p_da is null then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  -- Dieselbe Sperre wie Melden und jede Änderung an Liste und Kadern, in
  -- derselben Reihenfolge: erst sie, dann die Zeile.
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || t.team_id::text, 0));
  select * into t from training_termine where id = p_termin for update;
  if not found or not (spieler_im_team(p_spieler, t.team_id)
                       or exists (select 1 from spiel_teilnahmen p
                                   where p.termin_id = p_termin and p.spieler_id = p_spieler)) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  v_stand := jsonb_build_object('datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                'ende', to_char(t.ende, 'HH24:MI'), 'ausgefallen', t.ausgefallen);
  if (p_gesehen_datum is not null and p_gesehen_datum is distinct from t.datum)
     or (p_gesehen_beginn is not null and p_gesehen_beginn is distinct from t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'verlegt', 'stand', v_stand);
  end if;
  if t.ausgefallen then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'ausgefallen', 'stand', v_stand);
  end if;
  if not termin_begonnen(t.datum, t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_begonnen', 'stand', v_stand);
  end if;
  -- Ein begonnenes Spiel ist womöglich noch nicht festgehalten (träge): Seit
  -- dem Anpfiff hat sich nichts an ihm geändert, sein Stand jetzt ist der beim Anpfiff.
  perform spiel_einfrieren(p_termin);
  update spiel_teilnahmen set nachgetragen = (spiel_zaehlt(zustand, nicht_aufgeboten) <> p_da)
   where termin_id = p_termin and spieler_id = p_spieler
  returning nachgetragen into v_nachgetragen;
  -- AK 5: nur, wer im Stand beim Anpfiff steht (OoS 8: ohne Liste keiner).
  if not found then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_dabei', 'stand', v_stand);
  end if;
  return jsonb_build_object('status', 'ok', 'da', p_da, 'nachgetragen', v_nachgetragen,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;

-- Rumpf wie in 20261021240000_spiel_nachtrag.sql; Menge über team_spieler.
-- INVOKER bleibt bis Story 3 (dann DEFINER mit nicht_mehr_im_team, AP §4.4).
create or replace function spiel_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, zustand text, verfallen boolean,
               ehemalig boolean, kader text[], gewechselt_am timestamptz,
               nicht_aufgeboten boolean, aufgebot_verfallen boolean, nachgetragen boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select x.spieler_id, x.vorname, x.nachname, x.zustand, x.verfallen, x.ehemalig,
         case when x.fest then '{}'::text[] else
         coalesce(array(select k.name from termin_kader tk join kader k on k.id = tk.kader_id
                          join kader_spieler ks on ks.kader_id = k.id
                         where tk.termin_id = p_termin and ks.spieler_id = x.spieler_id
                         order by k.name), '{}') end,
         x.gewechselt_am, x.nicht_aufgeboten, x.aufgebot_verfallen, x.nachgetragen
    from (
      select p.spieler_id, s.vorname, s.nachname, p.zustand, false as verfallen, p.spieler_id is null as ehemalig,
             true as fest, p.gewechselt_am, p.nicht_aufgeboten, false as aufgebot_verfallen, p.nachgetragen
        from spiel_teilnahmen p left join spieler s on s.id = p.spieler_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname, m.zustand, coalesce(m.verfallen, false), false, false, m.gewechselt_am,
             coalesce(m.nicht_aufgeboten, false), coalesce(m.aufgebot_verfallen, false), false
        from training_termine t
        join team_spieler ts on ts.team_id = t.team_id
        join spieler s on s.id = ts.spieler_id
        left join spiel_meldungen m on m.termin_id = t.id and m.spieler_id = s.id
       where t.id = p_termin and t.art = 'spiel' and termin_gilt_fuer(p_termin, s.id)
         and not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x;
$$;

-- Rumpf wie in 20261020100000_nachtrag_anwesenheit.sql (seit
-- 20261021240000_spiel_nachtrag.sql unter diesem Namen). Nachtragen wie bei
-- spiel_anwesenheit_setzen: im Team oder im festgehaltenen Stand.
create or replace function termin_anwesenheit_setzen_training(p_termin uuid, p_spieler uuid, p_da boolean,
                                                              p_gesehen_datum date default null,
                                                              p_gesehen_beginn time default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_stand jsonb;
  v_nachgetragen boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin;
  if not found or not ist_team_mitglied(t.team_id) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  -- Dieselbe Sperre wie Ab- und Anmelden und jede Änderung an Liste und
  -- Kadern, in derselben Reihenfolge: erst sie, dann die Zeile.
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || t.team_id::text, 0));
  select * into t from training_termine where id = p_termin for update;
  if not found or not (spieler_im_team(p_spieler, t.team_id)
                       or exists (select 1 from termin_teilnahmen p
                                   where p.termin_id = p_termin and p.spieler_id = p_spieler)) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  v_stand := jsonb_build_object('datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                'ende', to_char(t.ende, 'HH24:MI'), 'ausgefallen', t.ausgefallen);
  if (p_gesehen_datum is not null and p_gesehen_datum is distinct from t.datum)
     or (p_gesehen_beginn is not null and p_gesehen_beginn is distinct from t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'verlegt', 'stand', v_stand);
  end if;
  if t.ausgefallen then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'ausgefallen', 'stand', v_stand);
  end if;
  if not termin_begonnen(t.datum, t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_begonnen', 'stand', v_stand);
  end if;
  -- Ein begonnener Termin ist womöglich noch nicht festgehalten (träge,
  -- siehe spielerliste): Seit Beginn hat sich nichts an ihm geändert, sein
  -- Stand jetzt ist der bei Beginn.
  perform termin_einfrieren(p_termin);
  update termin_teilnahmen set nachgetragen = (abgemeldet = p_da)
   where termin_id = p_termin and spieler_id = p_spieler
  returning nachgetragen into v_nachgetragen;
  -- AK 5: nur, wer im Stand bei Beginn steht — auch keiner, wenn das Team
  -- bei Beginn keine Liste führte.
  if not found then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_dabei', 'stand', v_stand);
  end if;
  return jsonb_build_object('status', 'ok', 'da', p_da, 'nachgetragen', v_nachgetragen,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;

-- Rumpf wie in 20261029100000_meldestand.sql; Menge und Schnupper-Status
-- über team_spieler.
create or replace function training_meldestand(p_termin uuid)
returns table (spieler_id uuid, abgemeldet boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select ts.spieler_id, coalesce(not a.angemeldet, not training_grundstand(ts.probe_seit))
    from training_termine t
    join team_spieler ts on ts.team_id = t.team_id
    left join termin_abmeldungen a on a.termin_id = t.id and a.spieler_id = ts.spieler_id and a.verfallen_am is null
   where t.id = p_termin and termin_gilt_fuer(t.id, ts.spieler_id);
$$;

-- Rumpf wie in 20261029100000_meldestand.sql; Schnupper-Status der
-- Zuordnung zum Termin-Team.
create or replace function training_abgemeldet(p_termin uuid, p_spieler uuid) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(not a.angemeldet, not training_grundstand(ts.probe_seit))
    from training_termine t
    join team_spieler ts on ts.team_id = t.team_id and ts.spieler_id = p_spieler
    left join termin_abmeldungen a on a.termin_id = p_termin and a.spieler_id = p_spieler and a.verfallen_am is null
   where t.id = p_termin;
$$;

-- Rumpf wie in 20261029100000_meldestand.sql; Menge über team_spieler.
create or replace function spielstand_training(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.liste then jsonb_build_object(
           'gesamt', z.n, 'angemeldet', z.n - z.ab, 'eingefroren', z.fest,
           'anwesend', case when z.fest then z.da
                            when termin_begonnen(t.datum, t.beginn) then z.n - z.ab end) end
    from (select e.fest,
                 case when e.fest then e.mit_liste
                      else exists (select 1 from team_spieler ts where ts.team_id = t.team_id) end as liste,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id)
                      else m.n end as n,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id and p.abgemeldet)
                      else m.ab end as ab,
                 case when e.fest then (select count(*) from termin_teilnahmen p
                                         where p.termin_id = t.id and p.abgemeldet = p.nachgetragen) end as da
            from (select f.termin_id is not null as fest, coalesce(f.mit_liste, false) as mit_liste
                    from (select 1) d left join termin_eingefroren f on f.termin_id = t.id) e
            -- Offen den Meldestand einmal auswerten, nicht je Zahl.
            cross join lateral (select count(*) as n, count(*) filter (where x.abgemeldet) as ab
                                  from training_meldestand(t.id) x where not e.fest) m) z;
$$;

-- Rumpf wie in 20261029100000_meldestand.sql; Menge über team_spieler.
create or replace function termin_einfrieren_training(p_termin uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not exists (select 1 from team_spieler where team_id = v_team) then return; end if;
  insert into termin_eingefroren (termin_id, team_id, mit_liste) values (p_termin, v_team, true)
    on conflict (termin_id) do nothing;
  if not found then return; end if;
  insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet)
    select p_termin, v_team, m.spieler_id, m.abgemeldet from training_meldestand(p_termin) m;
  delete from termin_abmeldungen where termin_id = p_termin;
end;
$$;

-- Rumpf wie in 20261029100000_meldestand.sql; Menge über team_spieler.
create or replace function termine_einfrieren_training(p_team uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  with neu as (
    insert into termin_eingefroren (termin_id, team_id, mit_liste)
      select t.id, t.team_id, exists (select 1 from team_spieler where team_id = p_team) from training_termine t
       where t.team_id = p_team
         and t.art = 'training'
         and t.datum <= heute_am_trainingsort()
         and termin_begonnen(t.datum, t.beginn)
      on conflict (termin_id) do nothing
      returning termin_id),
  teilnahmen as (
    insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet)
      select n.termin_id, p_team, m.spieler_id, m.abgemeldet
        from neu n cross join lateral training_meldestand(n.termin_id) m
      returning termin_id)
  delete from termin_abmeldungen a using neu n where a.termin_id = n.termin_id;
end;
$$;

-- Rumpf wie in 20261029100000_meldestand.sql; Prüfung über spieler_im_team,
-- Schnupper-Status der Zuordnung zum Termin-Team.
create or replace function abmeldung_anwenden_training(p_termin uuid, p_spieler uuid, p_abgemeldet boolean,
                                                       p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_team uuid;
  v_stand jsonb;
  v_vorher boolean;
  v_grundstand boolean;
begin
  -- Dieselbe Sperre wie jede Änderung an Kadern (`kader_vorher`) und in
  -- derselben Reihenfolge — erst sie, dann die Zeile (siehe termin_kader).
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is not null then
    perform pg_advisory_xact_lock(hashtextextended('spieler:' || v_team::text, 0));
  end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not spieler_im_team(p_spieler, t.team_id) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  v_stand := jsonb_build_object('datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                'ende', to_char(t.ende, 'HH24:MI'), 'ausgefallen', t.ausgefallen);
  if (p_gesehen_datum is not null and p_gesehen_datum is distinct from t.datum)
     or (p_gesehen_beginn is not null and p_gesehen_beginn is distinct from t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'verlegt', 'stand', v_stand);
  end if;
  if t.ausgefallen then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'ausgefallen', 'stand', v_stand);
  end if;
  if termin_begonnen(t.datum, t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'begonnen', 'stand', v_stand);
  end if;
  if not termin_gilt_fuer(p_termin, p_spieler) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'gilt_nicht', 'stand', v_stand);
  end if;
  -- Eine verfallene Meldung gilt nicht: Wer sie trägt, hat den Grundstand.
  if p_abgemeldet is null then raise exception 'ABGEMELDET_FEHLT'; end if;
  v_vorher := training_abgemeldet(p_termin, p_spieler);
  select training_grundstand(ts.probe_seit) into v_grundstand
    from team_spieler ts where ts.spieler_id = p_spieler and ts.team_id = t.team_id;
  if (not p_abgemeldet) = v_grundstand then
    delete from termin_abmeldungen where termin_id = p_termin and spieler_id = p_spieler;
  else
    insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet)
      values (p_termin, p_spieler, t.team_id, not p_abgemeldet)
      on conflict (termin_id, spieler_id)
      do update set angemeldet = excluded.angemeldet, gesetzt_am = now(),
                    verfallen_am = null, vorher_datum = null, vorher_beginn = null;
  end if;
  if v_vorher is distinct from p_abgemeldet then
    insert into termin_statuswechsel (termin_id, spieler_id, team_id) values (p_termin, p_spieler, t.team_id)
      on conflict (termin_id, spieler_id) do update set gewechselt_am = now();
  end if;
  return jsonb_build_object('status', 'ok', 'abgemeldet', p_abgemeldet,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;

-- Rumpf wie in 20261029100000_meldestand.sql; Schnupper-Status der
-- Zuordnung zum Termin-Team.
create or replace function termin_abmeldungen_verfallend(p_termin uuid, p_datum date, p_beginn time)
returns integer
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin;
  if not found or not ist_team_mitglied(t.team_id)
     or (p_datum is not distinct from t.datum and p_beginn is not distinct from t.beginn)
     or termin_begonnen(p_datum, p_beginn) then
    return 0;
  end if;
  if exists (select 1 from termin_eingefroren f where f.termin_id = p_termin) then
    return (select count(*) from termin_teilnahmen p
              join team_spieler ts on ts.spieler_id = p.spieler_id and ts.team_id = p.team_id
             where p.termin_id = p_termin and p.abgemeldet and training_grundstand(ts.probe_seit));
  end if;
  return (select count(*) from termin_abmeldungen a
           where a.termin_id = p_termin and a.verfallen_am is null and not a.angemeldet);
end;
$$;

-- Rumpf wie in 20261029100000_meldestand.sql; nur Zugeordnete des
-- Termin-Teams, Schnupper-Status der Zuordnung.
create or replace function termin_zeitpunkt_nachher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if termin_begonnen(new.datum, new.beginn) then
    perform termin_einfrieren(new.id);
  elsif tg_op = 'UPDATE' then
    -- War er festgehalten (in die Zukunft verlegt): Seine Meldungen werden
    -- zu Markierungen, ehemalige Spieler:innen fallen weg.
    insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet,
                                    verfallen_am, vorher_datum, vorher_beginn)
      select new.id, p.spieler_id, new.team_id, not p.abgemeldet, now(), old.datum, old.beginn
        from termin_teilnahmen p
        join team_spieler ts on ts.spieler_id = p.spieler_id and ts.team_id = new.team_id
       where p.termin_id = new.id and p.abgemeldet = training_grundstand(ts.probe_seit)
      on conflict (termin_id, spieler_id) do nothing;
    delete from termin_eingefroren where termin_id = new.id;
    -- Eine schon verfallene behält den Zeitpunkt, für den sie abgegeben wurde.
    update termin_abmeldungen
       set verfallen_am = now(), vorher_datum = old.datum, vorher_beginn = old.beginn
     where termin_id = new.id and verfallen_am is null;
    -- Ein anderer Zeitpunkt ist wie ein neuer Termin: niemand hat gewechselt.
    delete from termin_statuswechsel where termin_id = new.id;
  end if;
  return null;
end;
$$;

-- Rumpf wie in 20261029110000_probetraining.sql; Schnupper-Status der
-- Zuordnung zum Termin-Team.
create or replace function termin_gilt_fuer(p_termin uuid, p_spieler uuid) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select not exists (select 1 from training_termine t
                       join team_spieler ts on ts.team_id = t.team_id and ts.spieler_id = p_spieler
                      where t.id = p_termin and t.art = 'spiel' and ts.probe_seit is not null)
     and (not exists (select 1 from termin_kader tk where tk.termin_id = p_termin and tk.kader_id is not null)
          or exists (select 1 from termin_kader tk join kader_spieler ks on ks.kader_id = tk.kader_id
                      where tk.termin_id = p_termin and ks.spieler_id = p_spieler));
$$;

-- Rumpf wie in 20261029110000_probetraining.sql; Menge über team_spieler.
create or replace function spiel_stand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.liste then jsonb_build_object(
           'gesamt', z.n, 'angemeldet', z.an, 'abgemeldet', z.ab, 'ohne_meldung', z.n - z.an - z.ab - z.na,
           'nicht_aufgeboten', z.na, 'meldungen', z.gemeldet, 'eingefroren', z.fest,
           'anwesend', case when z.fest then z.da
                            when termin_begonnen(t.datum, t.beginn) then z.an end) end
    from (select e.fest,
                 case when e.fest then e.mit_liste
                      else exists (select 1 from team_spieler ts where ts.team_id = t.team_id) end as liste,
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id)
                      else (select count(*) from team_spieler ts
                             where ts.team_id = t.team_id and termin_gilt_fuer(t.id, ts.spieler_id)) end as n,
                 case when e.fest then (select count(*) from spiel_teilnahmen p
                                         where p.termin_id = t.id and p.zustand = 'angemeldet' and not p.nicht_aufgeboten)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand = 'angemeldet'
                               and not m.nicht_aufgeboten and termin_gilt_fuer(t.id, m.spieler_id)) end as an,
                 case when e.fest then (select count(*) from spiel_teilnahmen p
                                         where p.termin_id = t.id and p.zustand = 'abgemeldet' and not p.nicht_aufgeboten)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand = 'abgemeldet'
                               and not m.nicht_aufgeboten and termin_gilt_fuer(t.id, m.spieler_id)) end as ab,
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id and p.nicht_aufgeboten)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.nicht_aufgeboten
                               and termin_gilt_fuer(t.id, m.spieler_id)) end as na,
                 -- Alle Meldungen, auch die nicht Aufgebotener: was mit dem Spiel verschwände.
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id and p.zustand is not null)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand is not null
                               and termin_gilt_fuer(t.id, m.spieler_id)) end as gemeldet,
                 -- #487 AK 9: wer zählte und nicht als nicht erschienen nachgetragen
                 -- ist, dazu wer als doch erschienen nachgetragen ist.
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id
                                           and spiel_zaehlt(p.zustand, p.nicht_aufgeboten) <> p.nachgetragen) end as da
            from (select f.termin_id is not null as fest, coalesce(f.mit_liste, false) as mit_liste
                    from (select 1) d left join termin_eingefroren f on f.termin_id = t.id) e) z;
$$;

-- Rumpf wie in 20261029110000_probetraining.sql; das Team der schnuppernden
-- Zuordnung (Schnuppern gilt in genau einem Team, ab Story 8 erzwungen).
create or replace function probe_stand(p_spieler uuid) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when ts.probe_seit is not null then jsonb_build_object(
           'anzahl', a.anzahl, 'besucht', b.n, 'angemeldet', k.n,
           'moeglich', greatest(0, coalesce(a.anzahl, 0) - b.n - k.n)) end
    from spieler s
    join team_spieler ts on ts.spieler_id = s.id and ts.probe_seit is not null
    left join team_probetraining a on a.team_id = ts.team_id
    cross join lateral (
      select count(*)::int as n from training_termine t
       where t.team_id = ts.team_id and t.art = 'training' and not t.ausgefallen
         and t.datum >= (ts.probe_seit at time zone 'Europe/Zurich')::date
         and (t.datum + t.beginn) >= (ts.probe_seit at time zone 'Europe/Zurich')
         and termin_begonnen(t.datum, t.beginn)
         and case when exists (select 1 from termin_eingefroren f where f.termin_id = t.id)
                  then exists (select 1 from termin_teilnahmen p
                                where p.termin_id = t.id and p.spieler_id = s.id and p.abgemeldet = p.nachgetragen)
                  else termin_gilt_fuer(t.id, s.id) and not training_abgemeldet(t.id, s.id) end) b
    cross join lateral (
      select count(*)::int as n from termin_abmeldungen m join training_termine t on t.id = m.termin_id
       where m.spieler_id = s.id and m.angemeldet and m.verfallen_am is null
         and not t.ausgefallen and not termin_begonnen(t.datum, t.beginn) and termin_gilt_fuer(t.id, s.id)) k
   where s.id = p_spieler;
$$;

-- Rumpf wie in 20261029110000_probetraining.sql; Menge über team_spieler.
create or replace function team_probe_staende(p_team uuid)
returns table (spieler_id uuid, stand jsonb)
language sql stable
set search_path = public, pg_temp
as $$
  select ts.spieler_id, probe_stand(ts.spieler_id) from team_spieler ts
   where ts.team_id = p_team and ts.probe_seit is not null;
$$;

-- Rumpf wie in 20261029110000_probetraining.sql; Schnupper-Status der
-- Zuordnung zum Termin-Team.
create or replace function termin_abmeldung_setzen(p_termin uuid, p_spieler uuid, p_abgemeldet boolean,
                                                   p_gesehen_datum date default null, p_gesehen_beginn time default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not ist_team_mitglied(v_team) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  v := abmeldung_anwenden(p_termin, p_spieler, p_abgemeldet, p_gesehen_datum, p_gesehen_beginn);
  if v ->> 'status' = 'ok' and exists (select 1 from team_spieler
                                        where spieler_id = p_spieler and team_id = v_team and probe_seit is not null) then
    v := v || jsonb_build_object('probe', probe_stand(p_spieler));
  end if;
  return v;
end;
$$;

-- Rumpf wie in 20261029110000_probetraining.sql; Schnupper-Status der
-- Zuordnung zum Termin-Team.
create or replace function termin_anmeldungen_verfallend(p_termin uuid, p_datum date, p_beginn time)
returns integer
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin;
  if not found or not ist_team_mitglied(t.team_id)
     or (p_datum is not distinct from t.datum and p_beginn is not distinct from t.beginn)
     or termin_begonnen(p_datum, p_beginn) then
    return 0;
  end if;
  if exists (select 1 from termin_eingefroren f where f.termin_id = p_termin) then
    return (select count(*) from termin_teilnahmen p
              join team_spieler ts on ts.spieler_id = p.spieler_id and ts.team_id = p.team_id
             where p.termin_id = p_termin and not p.abgemeldet and not training_grundstand(ts.probe_seit));
  end if;
  return (select count(*) from termin_abmeldungen a
           where a.termin_id = p_termin and a.verfallen_am is null and a.angemeldet);
end;
$$;

-- Rumpf wie in 20261029110000_probetraining.sql; Schnupper-Status der
-- Zuordnung zum Termin-Team. INVOKER bleibt bis Story 3.
create or replace function termin_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, abgemeldet boolean, ehemalig boolean,
               kader text[], gewechselt_am timestamptz, nachgetragen boolean, probe boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select x.spieler_id, x.vorname, x.nachname, x.abgemeldet, x.ehemalig,
         case when x.fest then '{}'::text[] else
         coalesce(array(select k.name from termin_kader tk join kader k on k.id = tk.kader_id
                          join kader_spieler ks on ks.kader_id = k.id
                         where tk.termin_id = p_termin and ks.spieler_id = x.spieler_id
                         order by k.name), '{}') end,
         w.gewechselt_am,
         x.nachgetragen,
         x.probe
    from (
      select p.spieler_id, s.vorname, s.nachname, p.abgemeldet, p.spieler_id is null as ehemalig, true as fest,
             p.nachgetragen, coalesce(ts.probe_seit is not null, false) as probe
        from termin_teilnahmen p left join spieler s on s.id = p.spieler_id
        left join team_spieler ts on ts.spieler_id = p.spieler_id and ts.team_id = p.team_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname, m.abgemeldet, false, false, false, ts.probe_seit is not null
        from training_meldestand(p_termin) m join spieler s on s.id = m.spieler_id
        join training_termine tt on tt.id = p_termin
        join team_spieler ts on ts.spieler_id = m.spieler_id and ts.team_id = tt.team_id
       where not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x
    left join termin_statuswechsel w on w.termin_id = p_termin and w.spieler_id = x.spieler_id;
$$;

-- Rumpf wie in 20261029110000_probetraining.sql; Schnupper-Status der
-- Zuordnung zum Termin-Team. Team und Sperre folgen bis Story 7 noch
-- `spieler.team_id` (AP §4.4).
create or replace function spieler_link_abmelden(p_token text, p_termin uuid, p_abgemeldet boolean,
                                                 p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s spieler;
  t training_termine;
begin
  select * into s from spieler where link_token = p_token;
  if not found then return jsonb_build_object('status', 'ungueltig'); end if;
  -- Erst unter der Sperre gelesen, gilt der Probe-Modus: Ein Mitglied, das ihn
  -- gleichzeitig einschaltet, kann die Grenze nicht unterlaufen.
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || s.team_id::text, 0));
  select * into s from spieler where id = s.id;
  if not found then return jsonb_build_object('status', 'ungueltig'); end if;
  if exists (select 1 from team_spieler ts where ts.spieler_id = s.id and ts.team_id = s.team_id
                                              and ts.probe_seit is not null)
     and not p_abgemeldet then
    select * into t from training_termine where id = p_termin and team_id = s.team_id;
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
  return abmeldung_anwenden(p_termin, s.id, p_abgemeldet, p_gesehen_datum, p_gesehen_beginn);
end;
$$;

-- Rumpf wie in 20261031120000_treffpunkt_training.sql; `probe_info` nach dem
-- Schnupper-Status der Zuordnung. Termine und Team folgen bis Story 7 noch
-- `spieler.team_id` (AP §4.4, §7.7).
create or replace function spieler_link_ansicht(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $function$
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
    -- #555 AK 11: der Stand einer Probe-Spieler:in, sonst null.
    'probe', probe_stand(s.id),
    -- #556 AK 4; PC 1: das Info-Schreiben, nur im Probe-Modus.
    'probe_info', case when exists (select 1 from team_spieler ts where ts.spieler_id = s.id
                                                 and ts.team_id = s.team_id and ts.probe_seit is not null)
                       then (select i.info from team_probetraining i where i.team_id = s.team_id) end,
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
$function$;

-- ── Trigger ─────────────────────────────────────────────────────────────────

create trigger team_spieler_vorher before insert on team_spieler
  for each row execute function team_spieler_vorher();

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function spieler_im_team(uuid, uuid) from public, anon, authenticated;
revoke all on function spielerzahl_freigeben(uuid) from public, anon, authenticated;
revoke all on function team_spieler_vorher() from public, anon, authenticated;

-- ── Backfill ────────────────────────────────────────────────────────────────

-- Schnupper-Status auf die Zuordnung (AP §3.2). Eindeutig, weil bis hier jede
-- Spieler:in genau eine Zuordnung hat; vereine_nachziehen hat ihn schon
-- übernommen, dies gleicht eine Änderung seither ab.
update team_spieler ts set probe_seit = s.probe_seit
  from spieler s
 where s.id = ts.spieler_id and ts.team_id = s.team_id
   and ts.probe_seit is distinct from s.probe_seit;

reset lock_timeout;
