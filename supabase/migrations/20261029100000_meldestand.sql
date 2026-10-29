-- ============================================================================
-- Probetraining (Epic #554), Umbau ohne Verhaltensänderung: der Meldestand
-- einer Spieler:in an einem Training als eine Regel.
--
-- Bisher hiess «keine Zeile in `termin_abmeldungen`» angemeldet, und jede
-- Funktion, die den Stand las, fragte die Tabelle selbst ab. Mit dem
-- Probe-Modus (#555) gibt es zwei Grundstände: Reguläre Spieler:innen sind
-- angemeldet, bis sie abgemeldet werden; Probe-Spieler:innen sind nicht
-- angemeldet, bis sie angemeldet werden. Eine Zeile ist darum künftig eine
-- Meldung, die vom Grundstand abweicht, und trägt ihre Richtung
-- (`angemeldet`). Der Grundstand steht an genau einer Stelle
-- (`training_grundstand`), gelesen wird über `training_meldestand` /
-- `training_abgemeldet`, geschrieben über `abmeldung_anwenden_training`.
--
-- Diese Migration ändert nichts am Verhalten: Es gibt noch keine
-- Probe-Spieler:in (`probe_seit` ist überall leer), jede Zeile ist eine
-- Abmeldung (`angemeldet = false`). Die bestehende Prüfsuite sichert das ab.
--
-- Forward-only: neue Spalten mit Default bzw. leer, neu gefasste Funktionen
-- mit gleicher Signatur.
-- ============================================================================
set lock_timeout = '5s';

-- ── Neue Spalten ────────────────────────────────────────────────────────────

-- Seit wann die Spieler:in im Probe-Modus ist; leer = regulär (#555).
alter table spieler add column probe_seit timestamptz;
grant select (probe_seit) on spieler to authenticated;

-- Die Richtung der Meldung: false = abgemeldet (der Bestand), true =
-- angemeldet (nur bei Probe-Spieler:innen, #555).
alter table termin_abmeldungen add column angemeldet boolean not null default false;
comment on table termin_abmeldungen is
  'Meldungen an Trainings, die vom Grundstand der Spieler:in abweichen (training_grundstand): '
  'reguläre Spieler:innen abgemeldet, Probe-Spieler:innen angemeldet. Mit verfallen_am nur eine Markierung.';

-- ── Die Regel ───────────────────────────────────────────────────────────────

-- Der Grundstand an einem Training ohne eigene Meldung: angemeldet (regulär)
-- oder nicht angemeldet (Probe). Die einzige Stelle, die das entscheidet.
-- Nimmt `probe_seit` statt der ganzen Zeile: Mitglieder dürfen nicht jede
-- Spalte von `spieler` lesen (`link_token`), und die Regel läuft auch mit
-- ihren Rechten (`spielstand`).
create function training_grundstand(p_probe_seit timestamptz) returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select p_probe_seit is null;
$$;
revoke all on function training_grundstand(timestamptz) from public, anon;
grant execute on function training_grundstand(timestamptz) to authenticated;

-- Der Meldestand aller Spieler:innen, für die ein (offenes) Training gilt:
-- die eigene Meldung, sonst der Grundstand. Ein festgehaltenes Training liest
-- seinen Stand aus `termin_teilnahmen`.
create function training_meldestand(p_termin uuid)
returns table (spieler_id uuid, abgemeldet boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select s.id, coalesce(not a.angemeldet, not training_grundstand(s.probe_seit))
    from training_termine t
    join spieler s on s.team_id = t.team_id
    left join termin_abmeldungen a on a.termin_id = t.id and a.spieler_id = s.id and a.verfallen_am is null
   where t.id = p_termin and termin_gilt_fuer(t.id, s.id);
$$;
revoke all on function training_meldestand(uuid) from public, anon;
grant execute on function training_meldestand(uuid) to authenticated;

-- Dasselbe für eine Spieler:in (ohne Prüfung, ob das Training für sie gilt).
create function training_abgemeldet(p_termin uuid, p_spieler uuid) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(not a.angemeldet, not training_grundstand(s.probe_seit))
    from spieler s
    left join termin_abmeldungen a on a.termin_id = p_termin and a.spieler_id = s.id and a.verfallen_am is null
   where s.id = p_spieler;
$$;
revoke all on function training_abgemeldet(uuid, uuid) from public, anon;
grant execute on function training_abgemeldet(uuid, uuid) to authenticated;

-- ── Lesen ───────────────────────────────────────────────────────────────────

-- Rumpf wie in 20261020100000_nachtrag_anwesenheit.sql (seit
-- 20261021200000_spiele_art.sql `spielstand_training`); offen zählt der
-- Meldestand.
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
                      else exists (select 1 from spieler s where s.team_id = t.team_id) end as liste,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id)
                      else (select count(*) from training_meldestand(t.id)) end as n,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id and p.abgemeldet)
                      else (select count(*) from training_meldestand(t.id) m where m.abgemeldet) end as ab,
                 case when e.fest then (select count(*) from termin_teilnahmen p
                                         where p.termin_id = t.id and p.abgemeldet = p.nachgetragen) end as da
            from (select f.termin_id is not null as fest, coalesce(f.mit_liste, false) as mit_liste
                    from (select 1) d left join termin_eingefroren f on f.termin_id = t.id) e) z;
$$;

-- Rumpf wie in 20261020100000_nachtrag_anwesenheit.sql; offen liest der
-- Meldestand.
create or replace function termin_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, abgemeldet boolean, ehemalig boolean, kader text[],
               gewechselt_am timestamptz, nachgetragen boolean)
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
         x.nachgetragen
    from (
      select p.spieler_id, s.vorname, s.nachname, p.abgemeldet, p.spieler_id is null as ehemalig, true as fest,
             p.nachgetragen
        from termin_teilnahmen p left join spieler s on s.id = p.spieler_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname, m.abgemeldet, false, false, false
        from training_meldestand(p_termin) m join spieler s on s.id = m.spieler_id
       where not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x
    left join termin_statuswechsel w on w.termin_id = p_termin and w.spieler_id = x.spieler_id;
$$;

-- ── Festhalten ──────────────────────────────────────────────────────────────

-- Rumpf wie in 20261018130000_termin_kader.sql (seit
-- 20261021200000_spiele_art.sql `termin_einfrieren_training`).
create or replace function termin_einfrieren_training(p_termin uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not exists (select 1 from spieler where team_id = v_team) then return; end if;
  insert into termin_eingefroren (termin_id, team_id, mit_liste) values (p_termin, v_team, true)
    on conflict (termin_id) do nothing;
  if not found then return; end if;
  insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet)
    select p_termin, v_team, m.spieler_id, m.abgemeldet from training_meldestand(p_termin) m;
  delete from termin_abmeldungen where termin_id = p_termin;
end;
$$;

-- Rumpf wie in 20261021200000_spiele_art.sql (seit
-- 20261021210000_spiel_meldungen.sql `termine_einfrieren_training`).
create or replace function termine_einfrieren_training(p_team uuid) returns void
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
      select n.termin_id, p_team, m.spieler_id, m.abgemeldet
        from neu n cross join lateral training_meldestand(n.termin_id) m
      returning termin_id)
  delete from termin_abmeldungen a using neu n where a.termin_id = n.termin_id;
end;
$$;

-- ── Schreiben ───────────────────────────────────────────────────────────────

-- Rumpf wie in 20261019100000_statuswechsel.sql (seit
-- 20261021200000_spiele_art.sql `abmeldung_anwenden_training`). Eine Meldung,
-- die dem Grundstand entspricht, ist keine Zeile; jede andere trägt ihre
-- Richtung.
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
  if not found or not exists (select 1 from spieler where id = p_spieler and team_id = t.team_id) then
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
  v_vorher := training_abgemeldet(p_termin, p_spieler);
  select training_grundstand(s.probe_seit) into v_grundstand from spieler s where s.id = p_spieler;
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

-- ── Verlegen ────────────────────────────────────────────────────────────────

-- Rumpf wie in 20261019100000_statuswechsel.sql. Aus einem festgehaltenen
-- Stand werden die Meldungen zu Markierungen, die vom Grundstand abwichen.
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
        from termin_teilnahmen p join spieler s on s.id = p.spieler_id
       where p.termin_id = new.id and p.abgemeldet = training_grundstand(s.probe_seit)
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

-- Rumpf wie in 20261016130000_abmeldung_verfall.sql: Abmeldungen, die eine
-- Verlegung verfallen liesse.
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
    return (select count(*) from termin_teilnahmen p join spieler s on s.id = p.spieler_id
             where p.termin_id = p_termin and p.abgemeldet and training_grundstand(s.probe_seit));
  end if;
  return (select count(*) from termin_abmeldungen a
           where a.termin_id = p_termin and a.verfallen_am is null and not a.angemeldet);
end;
$$;

reset lock_timeout;
