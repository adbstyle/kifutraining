-- ============================================================================
-- Nicht aufbieten (#464, Epic #448): Ein Mitglied kennzeichnet eine
-- Spieler:in für ein Spiel als nicht aufgeboten — gleich, ob sie ohne
-- Meldung, angemeldet oder abgemeldet ist (AK 1) — und hebt das wieder auf
-- (AK 2). Ihre Meldung bleibt darunter stehen (PC 1); solange sie
-- gekennzeichnet ist, nimmt das Spiel keine Meldung an, weder von
-- Mitgliedern noch über den Link (AK 4). Gezählt wird sie nirgends als
-- angemeldet (AK 7), eigens als nicht aufgeboten (AK 8).
--
-- Die Kennzeichnung lebt in der Zeile der Meldung und teilt darum deren
-- Schicksal (PC 2, 4): Sie verfällt mit einem anderen Datum — mit eigenem
-- Hinweis für die Spielervertretung (PC 3) —, ruht beim Ausfall, wird beim
-- Anpfiff festgehalten, gilt am selben Tag wieder, fällt mit dem Kader weg
-- und mit der Spieler:in. Der Zeitpunkt des letzten Wechsels der Meldung
-- bleibt unberührt (PC 7).
--
-- Forward-only: neue Spalten mit Default, ein gelockerter Check auf einer
-- Tabelle aus demselben Release, neu gefasste Funktionen.
-- ============================================================================
set lock_timeout = '5s';

alter table spiel_meldungen
  add column nicht_aufgeboten boolean not null default false,
  add column aufgebot_verfallen boolean not null default false;
alter table spiel_meldungen drop constraint sm_inhalt;
alter table spiel_meldungen add constraint sm_inhalt
  check (zustand is not null or verfallen or nicht_aufgeboten or aufgebot_verfallen);
alter table spiel_teilnahmen add column nicht_aufgeboten boolean not null default false;

-- ── Festhalten beim Anpfiff (PC 2) ──────────────────────────────────────────

create or replace function spiel_einfrieren(p_termin uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from training_termine where id = p_termin and art = 'spiel';
  if v_team is null or not exists (select 1 from spieler where team_id = v_team) then return; end if;
  insert into termin_eingefroren (termin_id, team_id, mit_liste) values (p_termin, v_team, true)
    on conflict (termin_id) do nothing;
  if not found then return; end if;
  insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, gewechselt_am, nicht_aufgeboten)
    select p_termin, v_team, s.id, m.zustand, m.gewechselt_am, coalesce(m.nicht_aufgeboten, false)
      from spieler s
      left join spiel_meldungen m on m.termin_id = p_termin and m.spieler_id = s.id
     where s.team_id = v_team and termin_gilt_fuer(p_termin, s.id);
  delete from spiel_meldungen where termin_id = p_termin;
end;
$$;

create or replace function spiele_einfrieren(p_team uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  with neu as (
    insert into termin_eingefroren (termin_id, team_id, mit_liste)
      select t.id, t.team_id, exists (select 1 from spieler where team_id = p_team) from training_termine t
       where t.team_id = p_team
         and t.art = 'spiel'
         and t.datum <= heute_am_trainingsort()
         and termin_begonnen(t.datum, t.beginn)
      on conflict (termin_id) do nothing
      returning termin_id),
  teilnahmen as (
    insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, gewechselt_am, nicht_aufgeboten)
      select n.termin_id, p_team, s.id, m.zustand, m.gewechselt_am, coalesce(m.nicht_aufgeboten, false)
        from neu n cross join spieler s
        left join spiel_meldungen m on m.termin_id = n.termin_id and m.spieler_id = s.id
       where s.team_id = p_team and termin_gilt_fuer(n.termin_id, s.id)
      returning termin_id)
  delete from spiel_meldungen m using neu n where m.termin_id = n.termin_id;
end;
$$;

-- ── Verlegen (PC 2, 3) ──────────────────────────────────────────────────────

create or replace function spiel_zeitpunkt_nachher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_anderer_tag boolean := new.datum is distinct from old.datum;
begin
  if exists (select 1 from termin_eingefroren where termin_id = new.id) then
    -- Wieder offen: am selben Tag mit Meldungen und Kennzeichnungen derer,
    -- die noch dazugehören; an einem anderen Tag sind beide verfallen.
    insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am, verfallen,
                                 nicht_aufgeboten, aufgebot_verfallen)
      select new.id, p.spieler_id, new.team_id,
             case when v_anderer_tag then null else p.zustand end,
             case when v_anderer_tag then null else p.gewechselt_am end,
             v_anderer_tag and p.zustand is not null,
             p.nicht_aufgeboten and not v_anderer_tag,
             p.nicht_aufgeboten and v_anderer_tag
        from spiel_teilnahmen p
       where p.termin_id = new.id and p.spieler_id is not null
         and (p.zustand is not null or p.nicht_aufgeboten)
         and termin_gilt_fuer(new.id, p.spieler_id);
    delete from termin_eingefroren where termin_id = new.id;
  elsif v_anderer_tag then
    -- Ein anderes Datum lässt Meldungen und Kennzeichnungen verfallen.
    update spiel_meldungen
       set zustand = null, gewechselt_am = null, nicht_aufgeboten = false,
           verfallen = verfallen or zustand is not null,
           aufgebot_verfallen = aufgebot_verfallen or nicht_aufgeboten
     where termin_id = new.id and (zustand is not null or nicht_aufgeboten);
  end if;
  return null;
end;
$$;

-- ── Zahlen (AK 6–8) ─────────────────────────────────────────────────────────

-- Wie in 20261021210000_spiel_meldungen.sql; eine nicht aufgebotene
-- Spieler:in zählt nur als solche, nicht nach ihrer Meldung. `meldungen`
-- zählt alle Meldungen, auch die nicht Aufgebotener (Rückfrage beim Entfernen).
create or replace function spiel_stand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.liste then jsonb_build_object(
           'gesamt', z.n, 'angemeldet', z.an, 'abgemeldet', z.ab, 'ohne_meldung', z.n - z.an - z.ab - z.na,
           'nicht_aufgeboten', z.na, 'meldungen', z.gemeldet, 'eingefroren', z.fest, 'anwesend', null) end
    from (select e.fest,
                 case when e.fest then e.mit_liste
                      else exists (select 1 from spieler s where s.team_id = t.team_id) end as liste,
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id)
                      when not e.mit_kader then (select count(*) from spieler s where s.team_id = t.team_id)
                      else (select count(distinct ks.spieler_id) from termin_kader tk
                              join kader_spieler ks on ks.kader_id = tk.kader_id
                             where tk.termin_id = t.id) end as n,
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
                               and termin_gilt_fuer(t.id, m.spieler_id)) end as gemeldet
            from (select f.termin_id is not null as fest, coalesce(f.mit_liste, false) as mit_liste,
                         exists (select 1 from termin_kader tk where tk.termin_id = t.id and tk.kader_id is not null) as mit_kader
                    from (select 1) d left join termin_eingefroren f on f.termin_id = t.id) e) z;
$$;

-- Wie in 20261021210000_spiel_meldungen.sql, dazu die Kennzeichnung und ob
-- sie verfallen ist (AK 6). Neue Spalten: neu angelegt.
drop function spiel_teilnehmer(uuid);
create function spiel_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, zustand text, verfallen boolean, ehemalig boolean,
               kader text[], gewechselt_am timestamptz, nicht_aufgeboten boolean, aufgebot_verfallen boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select x.spieler_id, x.vorname, x.nachname, x.zustand, x.verfallen, x.ehemalig,
         case when x.fest then '{}'::text[] else
         coalesce(array(select k.name from termin_kader tk join kader k on k.id = tk.kader_id
                          join kader_spieler ks on ks.kader_id = k.id
                         where tk.termin_id = p_termin and ks.spieler_id = x.spieler_id
                         order by k.name), '{}') end,
         x.gewechselt_am, x.nicht_aufgeboten, x.aufgebot_verfallen
    from (
      select p.spieler_id, s.vorname, s.nachname, p.zustand, false as verfallen, p.spieler_id is null as ehemalig,
             true as fest, p.gewechselt_am, p.nicht_aufgeboten, false as aufgebot_verfallen
        from spiel_teilnahmen p left join spieler s on s.id = p.spieler_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname, m.zustand, coalesce(m.verfallen, false), false, false, m.gewechselt_am,
             coalesce(m.nicht_aufgeboten, false), coalesce(m.aufgebot_verfallen, false)
        from training_termine t join spieler s on s.team_id = t.team_id
        left join spiel_meldungen m on m.termin_id = t.id and m.spieler_id = s.id
       where t.id = p_termin and t.art = 'spiel' and termin_gilt_fuer(p_termin, s.id)
         and not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x;
$$;
revoke all on function spiel_teilnehmer(uuid) from public, anon;
grant execute on function spiel_teilnehmer(uuid) to authenticated;

-- ── Melden und Kennzeichnen (AK 1–5) ────────────────────────────────────────

-- Was Meldung und Kennzeichnung gemeinsam prüfen (AK 5): dieselbe Sperre wie
-- jede Änderung an Liste, Kadern und Abmeldungen, in derselben Reihenfolge —
-- erst sie, dann die Zeile —, dann bis zum Anpfiff, nicht an einem
-- ausgefallenen oder inzwischen verlegten Spiel, nur für wen es gilt.
-- `null`: Es darf geschrieben werden.
create function spiel_pruefen(p_termin uuid, p_spieler uuid, p_gesehen_datum date, p_gesehen_beginn time)
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
  if not found or t.art <> 'spiel'
     or not exists (select 1 from spieler where id = p_spieler and team_id = t.team_id) then
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
revoke all on function spiel_pruefen(uuid, uuid, date, time) from public, anon, authenticated;

-- Wie in 20261021210000_spiel_meldungen.sql: die eine Regel für Mitglieder,
-- Link und KI. Eine nicht aufgebotene Spieler:in meldet niemand (AK 4).
create or replace function spiel_meldung_anwenden(p_termin uuid, p_spieler uuid, p_angemeldet boolean,
                                                  p_gesehen_datum date, p_gesehen_beginn time, p_link boolean)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v jsonb;
  v_neu text := case when p_angemeldet then 'angemeldet' else 'abgemeldet' end;
begin
  if p_angemeldet is null then return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden'); end if;
  v := spiel_pruefen(p_termin, p_spieler, p_gesehen_datum, p_gesehen_beginn);
  if v is not null then return v; end if;
  select * into t from training_termine where id = p_termin;
  if exists (select 1 from spiel_meldungen where termin_id = p_termin and spieler_id = p_spieler and nicht_aufgeboten) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_aufgeboten');
  end if;
  if p_link and spiel_frist_abgelaufen(t) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'frist_abgelaufen',
                              'stand', jsonb_build_object('datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                                          'ende', to_char(t.ende, 'HH24:MI'), 'ausgefallen', t.ausgefallen,
                                                          'frist', to_char(spiel_frist(t), 'YYYY-MM-DD"T"HH24:MI')));
  end if;
  insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am, verfallen)
    values (p_termin, p_spieler, t.team_id, v_neu, now(), false)
    on conflict (termin_id, spieler_id) do update
      set zustand = excluded.zustand,
          verfallen = false,
          gewechselt_am = case when spiel_meldungen.zustand is distinct from excluded.zustand
                               then now() else spiel_meldungen.gewechselt_am end;
  return jsonb_build_object('status', 'ok', 'angemeldet', p_angemeldet,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;

-- Kennzeichnen und aufheben (AK 1–3, 5; PC 1, 7): nur Mitglieder, zu
-- denselben Bedingungen wie ihre Meldung. Die Meldung und ihr Zeitpunkt
-- bleiben unberührt.
create function termin_aufgebot_setzen(p_termin uuid, p_spieler uuid, p_nicht_aufgeboten boolean,
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
  if v_team is null or not ist_team_mitglied(v_team) or p_nicht_aufgeboten is null then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  v := spiel_pruefen(p_termin, p_spieler, p_gesehen_datum, p_gesehen_beginn);
  if v is not null then return v; end if;
  if p_nicht_aufgeboten then
    insert into spiel_meldungen (termin_id, spieler_id, team_id, nicht_aufgeboten)
      values (p_termin, p_spieler, v_team, true)
      on conflict (termin_id, spieler_id) do update set nicht_aufgeboten = true, aufgebot_verfallen = false;
  else
    -- Eine Zeile, die nur die Kennzeichnung trug, geht ganz.
    delete from spiel_meldungen
     where termin_id = p_termin and spieler_id = p_spieler
       and zustand is null and not verfallen and not aufgebot_verfallen;
    update spiel_meldungen set nicht_aufgeboten = false where termin_id = p_termin and spieler_id = p_spieler;
  end if;
  return jsonb_build_object('status', 'ok', 'nicht_aufgeboten', p_nicht_aufgeboten,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;
revoke all on function termin_aufgebot_setzen(uuid, uuid, boolean, date, time) from public, anon;
grant execute on function termin_aufgebot_setzen(uuid, uuid, boolean, date, time) to authenticated;

-- ── Kader-Wegfall (AK 10; PC 2) ─────────────────────────────────────────────

-- Wie in 20261021210000_spiel_meldungen.sql, gezählt getrennt: Meldungen
-- und Kennzeichnungen ({meldungen, kennzeichnungen}).
drop function spiel_kader_bereinigen(uuid);
create function spiel_kader_bereinigen(p_team uuid) returns integer[]
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v integer[];
begin
  with weg as (
    delete from spiel_meldungen m using training_termine t
     where m.termin_id = t.id and t.team_id = p_team
       and not termin_begonnen(t.datum, t.beginn)
       and not termin_gilt_fuer(t.id, m.spieler_id)
    returning m.zustand, m.nicht_aufgeboten)
  select array[count(*) filter (where zustand is not null), count(*) filter (where nicht_aufgeboten)]::integer[]
    into v from weg;
  return v;
end;
$$;
revoke all on function spiel_kader_bereinigen(uuid) from public, anon, authenticated;

create or replace function kader_bereinigen(p_team uuid) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spiele integer[] := spiel_kader_bereinigen(p_team);
begin
  return kader_bereinigen_training(p_team) + v_spiele[1] + v_spiele[2];
end;
$$;

-- Der Marker nennt die Summe, davon Meldungen und Kennzeichnungen an Spielen.
create or replace function kader_nachher(p_team uuid, p_bestaetigt integer) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spiele integer[] := spiel_kader_bereinigen(p_team);
  v integer := kader_bereinigen_training(p_team) + v_spiele[1] + v_spiele[2];
begin
  if v > 0 and p_bestaetigt is distinct from v then
    raise exception 'ABMELDUNGEN_VERFALLEN % % %', v, v_spiele[1], v_spiele[2];
  end if;
  return v;
end;
$$;

-- Rumpf wie in 20261021210000_spiel_meldungen.sql, dazu
-- `verfallend_kennzeichnungen`.
create or replace function kader_entfernen_folgen(p_kader uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v jsonb;
  v_spiele integer[];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from kader where id = p_kader;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'KADER_NICHT_GEFUNDEN'; end if;
  v := jsonb_build_object(
    'spieler', (select count(*) from kader_spieler where kader_id = p_kader),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                          'ende', to_char(t.ende, 'HH24:MI'), 'serie', t.serie_id)
                       order by t.datum, t.beginn)
        from training_termine t
       where t.team_id = v_team and not termin_begonnen(t.datum, t.beginn)
         and exists (select 1 from termin_kader tk where tk.termin_id = t.id and tk.kader_id = p_kader)
         and not exists (select 1 from termin_kader tk where tk.termin_id = t.id
                          and tk.kader_id is not null and tk.kader_id <> p_kader)), '[]'::jsonb),
    'serien', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'wochentage', s.wochentage, 'beginn', to_char(s.beginn, 'HH24:MI'),
                                          'ende', to_char(s.ende, 'HH24:MI'), 'bis', s.end_datum)
                       order by s.beginn_datum)
        from termin_serien s
       where s.team_id = v_team
         and exists (select 1 from termin_serien_kader sk where sk.serie_id = s.id and sk.kader_id = p_kader)
         and not exists (select 1 from termin_serien_kader sk where sk.serie_id = s.id and sk.kader_id <> p_kader)
         and exists (select 1 from training_termine t where t.serie_id = s.id
                      and not termin_begonnen(t.datum, t.beginn))), '[]'::jsonb));
  begin
    delete from termin_kader tk using training_termine t
     where tk.termin_id = t.id and tk.kader_id = p_kader and not termin_begonnen(t.datum, t.beginn);
    delete from kader where id = p_kader;
    v_spiele := spiel_kader_bereinigen(v_team);
    v := v || jsonb_build_object('verfallend', kader_bereinigen_training(v_team) + v_spiele[1] + v_spiele[2],
                                 'verfallend_spiele', v_spiele[1], 'verfallend_kennzeichnungen', v_spiele[2]);
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function kader_entfernen_folgen(uuid) from public, anon;
grant execute on function kader_entfernen_folgen(uuid) to authenticated;

-- ── Privater Link (AK 8, 9; PC 3) ───────────────────────────────────────────

-- Rumpf wie in 20261021220000_spiel_treffpunkte.sql, dazu die Kennzeichnung.
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
               -- #464 AK 8, 9; PC 3: ob sie nicht aufgeboten ist, ob die Kennzeichnung
               -- mit einer Verlegung verfallen ist, und wie viele es nicht sind.
               'nicht_aufgeboten', t.art = 'spiel' and coalesce(case
                                     when x.fest then (select p.nicht_aufgeboten from spiel_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id)
                                     else (select m.nicht_aufgeboten from spiel_meldungen m where m.termin_id = t.id and m.spieler_id = s.id) end, false),
               'aufgebot_verfallen', t.art = 'spiel' and not x.fest and not termin_begonnen(t.datum, t.beginn)
                                     and coalesce((select m.aufgebot_verfallen from spiel_meldungen m
                                                    where m.termin_id = t.id and m.spieler_id = s.id), false),
               'nicht_aufgeboten_zahl', case when t.art = 'spiel' and not t.ausgefallen then (x.stand ->> 'nicht_aufgeboten')::int end,
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
