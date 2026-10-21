-- ============================================================================
-- Für Spiele ausdrücklich melden (#463, Epic #448): Jede Spieler:in, für die
-- ein Spiel gilt, ist ohne Meldung, bis sie an- oder abgemeldet wird; eine
-- abgegebene Meldung wechselt nur noch zwischen angemeldet und abgemeldet
-- (AK 1, 4). Mitglieder melden bis zum Anpfiff, die Spielervertretung über
-- den privaten Link bis zur Meldefrist und ohne Frist bis zum Anpfiff
-- (AK 2, 3, 9, 10).
--
-- Ein eigenes Modell neben der Abmeldung der Trainings (PO 2026-10-21,
-- Architektur «sauber getrennt»): `spiel_meldungen` (offen) und
-- `spiel_teilnahmen` (festgehalten beim Anpfiff). Bei Trainings heisst «keine
-- Zeile» angemeldet, bei Spielen ohne Meldung — darum nie in derselben
-- Tabelle. Die Funktionen der Trainings bleiben, wie sie sind; dünne
-- Verteiler entscheiden nach der Art.
--
-- Meldefrist und Treffpunkte stehen als Abstand zum Anpfiff (Wanduhr): So
-- hält eine Verlegung den Abstand von selbst (PC 3). Der «vorher»-Zeitpunkt
-- eines verlegten Spiels ist der zuletzt gültige (AK 15, 16).
--
-- Verfall (PC 1, 2, 4–8): nur, wenn sich das Datum ändert — dann sind alle
-- wieder ohne Meldung, die Spielervertretung sieht, dass ihre verfallen ist.
-- Ruhen bei Ausfall heisst: die Zeilen bleiben, gelesen wird nicht. Ein
-- begonnenes Spiel, am selben Tag auf einen bevorstehenden Anpfiff verlegt,
-- ist mit seinen bisherigen Meldungen wieder offen.
--
-- Forward-only: neue Tabellen, neue Spalten ohne Wert, Checks, die der
-- Bestand erfüllt, umbenannte Trainingsfunktionen hinter Verteilern.
-- ============================================================================
set lock_timeout = '5s';

-- ── Meldefrist und «vorher» am Spiel (AK 8, 15, 16; PC 3) ───────────────────

alter table training_termine
  add column meldefrist_vorlauf_min integer,
  add column vorher_datum date,
  add column vorher_beginn time;

alter table training_termine
  -- Zwilling: meldefristProblem in web/lib/spiel.ts. Die Frist liegt vor dem
  -- Anpfiff, höchstens ein Jahr.
  add constraint tt_meldefrist check (
    meldefrist_vorlauf_min is null or (art = 'spiel' and meldefrist_vorlauf_min between 1 and 525600)),
  add constraint tt_vorher check (art = 'spiel' or (vorher_datum is null and vorher_beginn is null));

-- Der Zeitpunkt der Meldefrist (Wanduhr am Trainingsort); ohne Frist null.
-- Zwilling: meldefristZeitpunkt in web/lib/spiel.ts.
create function spiel_frist(t training_termine) returns timestamp
language sql stable
set search_path = public, pg_temp
as $$
  select case when t.meldefrist_vorlauf_min is null then null
              else (t.datum + t.beginn) - make_interval(mins => t.meldefrist_vorlauf_min) end;
$$;
revoke all on function spiel_frist(training_termine) from public, anon;
grant execute on function spiel_frist(training_termine) to authenticated;

create function spiel_frist_abgelaufen(t training_termine) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce((now() at time zone 'Europe/Zurich') >= spiel_frist(t), false);
$$;
revoke all on function spiel_frist_abgelaufen(training_termine) from public, anon;
grant execute on function spiel_frist_abgelaufen(training_termine) to authenticated;

-- Wie in 20261021200000_spiele_art.sql, dazu «vorher»: der zuletzt gültige
-- Zeitpunkt, bei jeder Verlegung, auch nur der Zeit (PO 4).
create or replace function spiel_zeitpunkt_vorher() returns trigger
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
    new.vorher_datum := old.datum;
    new.vorher_beginn := old.beginn;
  end if;
  return new;
end;
$$;

-- ── Meldungen und Stand beim Anpfiff ────────────────────────────────────────

-- Eine Zeile je Spieler:in und Spiel, nur wenn es etwas zu merken gibt:
-- ihre Meldung oder dass sie mit einer Verlegung verfallen ist (AK 15).
-- `gewechselt_am`: der letzte Wechsel, die erste Meldung zählt (AK 25).
create table spiel_meldungen (
  termin_id uuid not null references training_termine(id) on delete cascade,
  spieler_id uuid not null references spieler(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  zustand text,
  gewechselt_am timestamptz,
  verfallen boolean not null default false,
  primary key (termin_id, spieler_id),
  constraint sm_zustand check (zustand in ('angemeldet', 'abgemeldet')),
  constraint sm_wechsel check ((zustand is null) = (gewechselt_am is null)),
  constraint sm_inhalt check (zustand is not null or verfallen)
);
create index spiel_meldungen_spieler_idx on spiel_meldungen (spieler_id);
create index spiel_meldungen_team_idx on spiel_meldungen (team_id);

-- Je festgehaltenem Spiel eine Zeile pro Spieler:in, für die es beim Anpfiff
-- galt, mit ihrer Meldung (null: ohne Meldung). Fällt sie aus der Liste,
-- bleibt die Zeile ohne Spieler:in stehen (ehemalig).
create table spiel_teilnahmen (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references termin_eingefroren(termin_id) on delete cascade,
  team_id uuid not null,
  spieler_id uuid references spieler(id) on delete set null,
  zustand text,
  gewechselt_am timestamptz,
  unique (termin_id, spieler_id),
  constraint st_zustand check (zustand in ('angemeldet', 'abgemeldet'))
);
create index spiel_teilnahmen_spieler_idx on spiel_teilnahmen (spieler_id);

alter table spiel_meldungen enable row level security;
alter table spiel_teilnahmen enable row level security;
create policy sm_select on spiel_meldungen for select to authenticated using (ist_team_mitglied(team_id));
create policy st_select on spiel_teilnahmen for select to authenticated using (ist_team_mitglied(team_id));
revoke all on spiel_meldungen from anon, authenticated;
revoke all on spiel_teilnahmen from anon, authenticated;
grant select on spiel_meldungen to authenticated;
grant select on spiel_teilnahmen to authenticated;

-- ── Festhalten beim Anpfiff (PC 6) ──────────────────────────────────────────

-- Ein Spiel festhalten, falls es noch offen ist — wie bei Trainings: ohne
-- Spielerliste nichts (kommt später die erste Spieler:in, hält
-- `termine_einfrieren` vorher alle begonnenen fest, leer).
create function spiel_einfrieren(p_termin uuid) returns void
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
  insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, gewechselt_am)
    select p_termin, v_team, s.id, m.zustand, m.gewechselt_am
      from spieler s
      left join spiel_meldungen m on m.termin_id = p_termin and m.spieler_id = s.id
     where s.team_id = v_team and termin_gilt_fuer(p_termin, s.id);
  delete from spiel_meldungen where termin_id = p_termin;
end;
$$;
revoke all on function spiel_einfrieren(uuid) from public, anon, authenticated;

create function spiele_einfrieren(p_team uuid) returns void
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
    insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, gewechselt_am)
      select n.termin_id, p_team, s.id, m.zustand, m.gewechselt_am
        from neu n cross join spieler s
        left join spiel_meldungen m on m.termin_id = n.termin_id and m.spieler_id = s.id
       where s.team_id = p_team and termin_gilt_fuer(n.termin_id, s.id)
      returning termin_id)
  delete from spiel_meldungen m using neu n where m.termin_id = n.termin_id;
end;
$$;
revoke all on function spiele_einfrieren(uuid) from public, anon, authenticated;

-- Die Verteiler: Spiele mit ihrem eigenen Festhalten.
create or replace function termin_einfrieren(p_termin uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from training_termine where id = p_termin and art = 'spiel') then
    perform spiel_einfrieren(p_termin);
  else
    perform termin_einfrieren_training(p_termin);
  end if;
end;
$$;

alter function termine_einfrieren(uuid) rename to termine_einfrieren_training;

create function termine_einfrieren(p_team uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform termine_einfrieren_training(p_team);
  perform spiele_einfrieren(p_team);
end;
$$;
revoke all on function termine_einfrieren(uuid) from public, anon, authenticated;

-- ── Verlegen (PC 1, 2, 5, 7, 8) ─────────────────────────────────────────────

-- Der Trigger der Trainings gilt nur noch für Trainings; ein Spiel hat seinen
-- eigenen. Begonnen kann ein Spiel nach einer Verlegung nicht sein (Anpfiff
-- nur in der Zukunft).
drop trigger termin_zeitpunkt_neu on training_termine;
drop trigger termin_zeitpunkt_geaendert on training_termine;
create trigger termin_zeitpunkt_neu after insert on training_termine
  for each row when (new.art = 'training') execute function termin_zeitpunkt_nachher();
create trigger termin_zeitpunkt_geaendert after update of datum, beginn on training_termine
  for each row
  when (new.art = 'training' and (old.datum is distinct from new.datum or old.beginn is distinct from new.beginn))
  execute function termin_zeitpunkt_nachher();

create function spiel_zeitpunkt_nachher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_anderer_tag boolean := new.datum is distinct from old.datum;
begin
  if exists (select 1 from termin_eingefroren where termin_id = new.id) then
    -- Wieder offen (PC 7, 8): am selben Tag mit den bisherigen Meldungen
    -- derer, die noch dazugehören; an einem anderen Tag sind sie verfallen.
    insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am, verfallen)
      select new.id, p.spieler_id, new.team_id,
             case when v_anderer_tag then null else p.zustand end,
             case when v_anderer_tag then null else p.gewechselt_am end,
             v_anderer_tag
        from spiel_teilnahmen p
       where p.termin_id = new.id and p.spieler_id is not null and p.zustand is not null
         and termin_gilt_fuer(new.id, p.spieler_id);
    delete from termin_eingefroren where termin_id = new.id;
  elsif v_anderer_tag then
    -- PC 1: Ein anderes Datum lässt alle Meldungen verfallen.
    update spiel_meldungen set zustand = null, gewechselt_am = null, verfallen = true
     where termin_id = new.id and zustand is not null;
  end if;
  return null;
end;
$$;
revoke all on function spiel_zeitpunkt_nachher() from public, anon, authenticated;

create trigger spiel_zeitpunkt_geaendert after update of datum, beginn on training_termine
  for each row
  when (new.art = 'spiel' and (old.datum is distinct from new.datum or old.beginn is distinct from new.beginn))
  execute function spiel_zeitpunkt_nachher();

-- ── Zahlen (AK 6, 7, 19, 20; PC 10) ─────────────────────────────────────────

-- Wie `spielstand_training`: `null` ohne Spielerliste (bzw. ohne bei Anpfiff);
-- gezählt wird, für wen das Spiel gilt. Festgehalten zählt der Stand beim
-- Anpfiff. `anwesend` folgt mit dem Nachtrag (#487).
create function spiel_stand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.liste then jsonb_build_object(
           'gesamt', z.n, 'angemeldet', z.an, 'abgemeldet', z.ab, 'ohne_meldung', z.n - z.an - z.ab,
           'eingefroren', z.fest, 'anwesend', null) end
    from (select e.fest,
                 case when e.fest then e.mit_liste
                      else exists (select 1 from spieler s where s.team_id = t.team_id) end as liste,
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id)
                      when not e.mit_kader then (select count(*) from spieler s where s.team_id = t.team_id)
                      else (select count(distinct ks.spieler_id) from termin_kader tk
                              join kader_spieler ks on ks.kader_id = tk.kader_id
                             where tk.termin_id = t.id) end as n,
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id and p.zustand = 'angemeldet')
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand = 'angemeldet'
                               and termin_gilt_fuer(t.id, m.spieler_id)) end as an,
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id and p.zustand = 'abgemeldet')
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand = 'abgemeldet'
                               and termin_gilt_fuer(t.id, m.spieler_id)) end as ab
            from (select f.termin_id is not null as fest, coalesce(f.mit_liste, false) as mit_liste,
                         exists (select 1 from termin_kader tk where tk.termin_id = t.id and tk.kader_id is not null) as mit_kader
                    from (select 1) d left join termin_eingefroren f on f.termin_id = t.id) e) z;
$$;
revoke all on function spiel_stand(training_termine) from public, anon;
grant execute on function spiel_stand(training_termine) to authenticated;

create or replace function spielstand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when t.art = 'spiel' then spiel_stand(t) else spielstand_training(t) end;
$$;

-- Wer an einem Spiel welche Meldung trägt (AK 5, 20, 25), wie
-- `termin_teilnehmer`. Offen: alle, für die es gilt, mit ihrer Meldung oder
-- ohne; festgehalten: der Stand beim Anpfiff samt ehemaligen.
create function spiel_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, zustand text, verfallen boolean, ehemalig boolean,
               kader text[], gewechselt_am timestamptz)
language sql stable
set search_path = public, pg_temp
as $$
  select x.spieler_id, x.vorname, x.nachname, x.zustand, x.verfallen, x.ehemalig,
         case when x.fest then '{}'::text[] else
         coalesce(array(select k.name from termin_kader tk join kader k on k.id = tk.kader_id
                          join kader_spieler ks on ks.kader_id = k.id
                         where tk.termin_id = p_termin and ks.spieler_id = x.spieler_id
                         order by k.name), '{}') end,
         x.gewechselt_am
    from (
      select p.spieler_id, s.vorname, s.nachname, p.zustand, false as verfallen, p.spieler_id is null as ehemalig,
             true as fest, p.gewechselt_am
        from spiel_teilnahmen p left join spieler s on s.id = p.spieler_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname, m.zustand, coalesce(m.verfallen, false), false, false, m.gewechselt_am
        from training_termine t join spieler s on s.team_id = t.team_id
        left join spiel_meldungen m on m.termin_id = t.id and m.spieler_id = s.id
       where t.id = p_termin and t.art = 'spiel' and termin_gilt_fuer(p_termin, s.id)
         and not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x;
$$;
revoke all on function spiel_teilnehmer(uuid) from public, anon;
grant execute on function spiel_teilnehmer(uuid) to authenticated;

-- ── Melden (AK 2–4, 9, 10, 17, 18, 21, 24, 25) ──────────────────────────────

-- Die eine Regel für Mitglieder, Link und KI. Dieselbe Sperre wie jede
-- Änderung an Liste, Kadern und Abmeldungen, in derselben Reihenfolge: erst
-- sie, dann die Zeile. Über den Link nur vor Ablauf der Meldefrist.
create function spiel_meldung_anwenden(p_termin uuid, p_spieler uuid, p_angemeldet boolean,
                                       p_gesehen_datum date, p_gesehen_beginn time, p_link boolean)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_team uuid;
  v_stand jsonb;
  v_neu text := case when p_angemeldet then 'angemeldet' else 'abgemeldet' end;
begin
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is not null then
    perform pg_advisory_xact_lock(hashtextextended('spieler:' || v_team::text, 0));
  end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or t.art <> 'spiel' or p_angemeldet is null
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
  if p_link and spiel_frist_abgelaufen(t) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'frist_abgelaufen', 'stand', v_stand);
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
revoke all on function spiel_meldung_anwenden(uuid, uuid, boolean, date, time, boolean) from public, anon, authenticated;

-- Mitglieder (und ihr KI-Assistent): bis zum Anpfiff, auch nach der Frist.
create function termin_meldung_setzen(p_termin uuid, p_spieler uuid, p_angemeldet boolean,
                                      p_gesehen_datum date default null, p_gesehen_beginn time default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not ist_team_mitglied(v_team) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  return spiel_meldung_anwenden(p_termin, p_spieler, p_angemeldet, p_gesehen_datum, p_gesehen_beginn, false);
end;
$$;
revoke all on function termin_meldung_setzen(uuid, uuid, boolean, date, time) from public, anon;
grant execute on function termin_meldung_setzen(uuid, uuid, boolean, date, time) to authenticated;

-- Die Spielervertretung über den privaten Link: bis zur Meldefrist.
create function spieler_link_melden(p_token text, p_termin uuid, p_angemeldet boolean,
                                    p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spieler uuid;
begin
  select id into v_spieler from spieler where link_token = p_token;
  if v_spieler is null then return jsonb_build_object('status', 'ungueltig'); end if;
  return spiel_meldung_anwenden(p_termin, v_spieler, p_angemeldet, p_gesehen_datum, p_gesehen_beginn, true);
end;
$$;
revoke all on function spieler_link_melden(text, uuid, boolean, date, time) from public;
grant execute on function spieler_link_melden(text, uuid, boolean, date, time) to anon, authenticated;

-- ── Kader-Wegfall (AK 14; PC 4) ─────────────────────────────────────────────

-- Gilt ein anstehendes Spiel für eine Spieler:in nicht mehr, verfällt ihre
-- Meldung samt Zeitpunkt, auch an einem ausgefallenen; gilt es wieder, ist
-- sie ohne Meldung. Gezählt werden Meldungen, nicht blosse Verfall-Hinweise.
create function spiel_kader_bereinigen(p_team uuid) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v integer;
begin
  with weg as (
    delete from spiel_meldungen m using training_termine t
     where m.termin_id = t.id and t.team_id = p_team
       and not termin_begonnen(t.datum, t.beginn)
       and not termin_gilt_fuer(t.id, m.spieler_id)
    returning m.zustand)
  select count(*) filter (where zustand is not null) into v from weg;
  return v;
end;
$$;
revoke all on function spiel_kader_bereinigen(uuid) from public, anon, authenticated;

alter function kader_bereinigen(uuid) rename to kader_bereinigen_training;

-- Für alle Wege, die nur die Summe brauchen (Serien, Nachtrag).
create function kader_bereinigen(p_team uuid) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  return kader_bereinigen_training(p_team) + spiel_kader_bereinigen(p_team);
end;
$$;
revoke all on function kader_bereinigen(uuid) from public, anon, authenticated;

-- Wie in 20261018130000_termin_kader.sql; der Marker nennt dazu, wie viele
-- der verfallenden Meldungen zu Spielen gehören (AK 14).
create or replace function kader_nachher(p_team uuid, p_bestaetigt integer) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spiele integer := spiel_kader_bereinigen(p_team);
  v integer := kader_bereinigen_training(p_team) + v_spiele;
begin
  if v > 0 and p_bestaetigt is distinct from v then
    raise exception 'ABMELDUNGEN_VERFALLEN % %', v, v_spiele;
  end if;
  return v;
end;
$$;
revoke all on function kader_nachher(uuid, integer) from public, anon, authenticated;

-- Wie in 20261018130000_termin_kader.sql, dazu `verfallend_spiele`.
create or replace function kader_entfernen_folgen(p_kader uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v jsonb;
  v_spiele integer;
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
    v := v || jsonb_build_object('verfallend', kader_bereinigen_training(v_team) + v_spiele, 'verfallend_spiele', v_spiele);
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function kader_entfernen_folgen(uuid) from public, anon;
grant execute on function kader_entfernen_folgen(uuid) to authenticated;

-- ── Privater Link (AK 3, 7, 11, 12, 15, 19, 21) ─────────────────────────────

-- Rumpf wie in 20261021200000_spiele_art.sql, dazu bei Spielen die Meldung,
-- ob sie verfallen ist, die Meldefrist und der Zeitpunkt vorher; ein
-- festgehaltenes Spiel gilt für die, die beim Anpfiff dabei standen.
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
