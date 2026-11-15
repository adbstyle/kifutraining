-- Backfill «FC Wyler» auf dem Staging-Weg (Architekturplan Vereine §6.3):
-- Teams und Spieler:innen aus einem Prod-Dump ohne Verein, geladen unter
-- `session_replication_role = replica` (Trigger und FK-Prüfungen schweigen),
-- dann `vereine_nachziehen`. Geprüft werden Ergebnis und Idempotenz.
-- Block 1: mit bestätigtem Konto → genau eine Verwaltung. Block 2: nur ein
-- unbestätigtes Konto, dann ohne Konto → keine Verwaltung.
-- Die Zusicherungen gelten nur für die eigenen Testzeilen (die lokale DB
-- kann Bestand haben); bestehende Verwaltungszeilen werden innerhalb der
-- Transaktion entfernt, damit «genau eine» eindeutig ist. Jeder Block endet
-- mit rollback; die Hilfsfunktionen liegen in pg_temp und enden mit der
-- Sitzung. Fällt mit N1 (AP §3.8).

\set ON_ERROR_STOP on
\o /dev/null

-- Bestand im alten Zuschnitt: nur `team_id`, kein `verein_id`, keine Zuordnung.
create function pg_temp.bestand() returns void
language plpgsql as $$
declare
  ta uuid; tb uuid; tc uuid; td uuid;
  v_probe uuid; v_kader uuid; v_kommend uuid; v_vorbei uuid;
begin
  create temp table t_ids (name text primary key, id uuid not null default gen_random_uuid()) on commit drop;
  insert into t_ids (name) values ('konto'), ('unbestaetigt'), ('trainer'), ('ta'), ('tb'), ('tc'), ('td');
  insert into auth.users (id, email, email_confirmed_at)
  select id, name || '@vereine-nachziehen.test', case when name <> 'unbestaetigt' then now() end
    from t_ids where name in ('konto', 'unbestaetigt', 'trainer');
  select id into ta from t_ids where name = 'ta';
  select id into tb from t_ids where name = 'tb';
  select id into tc from t_ids where name = 'tc';
  select id into td from t_ids where name = 'td';

  -- tb ohne Mitglieder, tc mit 150 Spieler:innen.
  insert into teams (id, name) values (ta, 'Nachziehen A'), (tb, 'Nachziehen B'), (tc, 'Nachziehen C'), (td, 'Nachziehen D');
  insert into team_members (team_id, user_id)
  select t, (select id from t_ids where name = 'trainer') from unnest(array[ta, tc, td]) t;

  -- Dieselbe Spieler:in in zwei Teams (Altdublette).
  insert into spieler (team_id, vorname, nachname, jahrgang) values (ta, 'Lea', 'Dublette', 2015), (tb, 'Lea', 'Dublette', 2015);
  insert into spieler (team_id, vorname, nachname, jahrgang)
  select tc, 'Viele', 'Nr ' || i, 2014 from generate_series(1, 150) i;
  insert into spieler (team_id, vorname, nachname, jahrgang) values (td, 'Ria', 'Regulär', 2016);
  insert into spieler (team_id, vorname, nachname, jahrgang, probe_seit)
    values (td, 'Sina', 'Schnupper', 2016, now() - interval '3 days') returning id into v_probe;
  insert into team_probetraining (team_id, anzahl) values (td, 3);

  -- Kader, Meldung an einem kommenden und festgehaltener Stand eines vergangenen Termins.
  insert into kader (team_id, name) values (td, 'Kader D') returning id into v_kader;
  insert into kader_spieler (kader_id, spieler_id, team_id) select v_kader, id, td from spieler where team_id = td;
  insert into training_termine (team_id, datum, beginn, ende)
    values (td, current_date + 7, '18:00', '19:30') returning id into v_kommend;
  insert into training_termine (team_id, datum, beginn, ende)
    values (td, current_date - 7, '18:00', '19:30') returning id into v_vorbei;
  insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet)
  select v_kommend, id, td, false from spieler where team_id = td and probe_seit is null;
  insert into termin_eingefroren (termin_id, team_id, mit_liste) values (v_vorbei, td, true);
  insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet)
  select v_vorbei, td, id, false from spieler where team_id = td;
end $$;

create function pg_temp.id(p text) returns uuid
language plpgsql stable as $$ begin return (select id from t_ids where name = p); end $$;

-- Block 1: mit bestätigtem Konto, zweimal, dann ohne Konto.
begin;
set local statement_timeout = '60s';
set local session_replication_role = replica;
select pg_temp.bestand();
delete from verein_verwaltung;
create temp table t_vorher on commit drop as
select (select count(*) from vereine) as vereine,
       (select count(*) from kader_spieler where team_id = pg_temp.id('td')) as kader,
       (select count(*) from termin_abmeldungen where team_id = pg_temp.id('td')) as abmeldungen,
       (select count(*) from termin_teilnahmen where team_id = pg_temp.id('td')) as teilnahmen;

select vereine_nachziehen(pg_temp.id('konto'));
select vereine_nachziehen(pg_temp.id('konto'));
select vereine_nachziehen(null);

do $$
declare
  v_teams uuid[] := array[pg_temp.id('ta'), pg_temp.id('tb'), pg_temp.id('tc'), pg_temp.id('td')];
  v_verein uuid := (select verein_id from teams where id = pg_temp.id('ta'));
  w t_vorher;
begin
  select * into w from t_vorher;
  if v_verein is null or (select name from vereine where id = v_verein) <> 'FC Wyler' then
    raise exception 'Teams nicht im Verein «FC Wyler»';
  end if;
  if (select count(distinct verein_id) from teams where id = any(v_teams)) <> 1
     or exists (select 1 from teams where id = any(v_teams) and verein_id is null) then
    raise exception 'Teams nicht in genau einem Verein';
  end if;
  if (select count(*) from vereine) - w.vereine > 1 then
    raise exception 'mehr als ein Verein entstanden';
  end if;
  if exists (select 1 from spieler where team_id = any(v_teams) and verein_id is distinct from v_verein) then
    raise exception 'Spieler:innen ohne oder mit falschem Verein';
  end if;
  if (select count(*) from team_spieler where team_id = any(v_teams))
     <> (select count(*) from spieler where team_id = any(v_teams))
     or exists (select 1 from spieler s where s.team_id = any(v_teams) and not exists
                  (select 1 from team_spieler ts where ts.spieler_id = s.id and ts.team_id = s.team_id
                      and ts.verein_id = v_verein)) then
    raise exception 'Zuordnung fehlt oder ist doppelt';
  end if;
  if (select count(*) from team_spieler where team_id = pg_temp.id('tc')) <> 150 then
    raise exception 'Team mit 150 Spieler:innen nicht vollständig zugeordnet';
  end if;
  if (select count(*) from spieler s join team_spieler ts on ts.spieler_id = s.id and ts.team_id = s.team_id
       where s.nachname = 'Dublette' and s.team_id in (pg_temp.id('ta'), pg_temp.id('tb'))) <> 2
     or (select count(distinct id) from spieler where nachname = 'Dublette' and team_id in (pg_temp.id('ta'), pg_temp.id('tb'))) <> 2 then
    raise exception 'Dublette nicht als zwei getrennte Zeilen mit je eigener Zuordnung';
  end if;
  if (select count(*) from team_spieler ts join spieler s on s.id = ts.spieler_id
       where ts.team_id = pg_temp.id('td') and ts.probe_seit is not distinct from s.probe_seit
         and (s.probe_seit is not null) = (s.nachname = 'Schnupper')) <> 2 then
    raise exception 'probe_seit nicht auf der Zuordnung';
  end if;
  if (select array_agg(user_id) from verein_verwaltung where verein_id = v_verein)
     is distinct from array[pg_temp.id('konto')] then
    raise exception 'Verwaltung nicht genau das Testkonto';
  end if;
  if (select count(*) from kader_spieler where team_id = pg_temp.id('td')) <> w.kader
     or (select count(*) from termin_abmeldungen where team_id = pg_temp.id('td')) <> w.abmeldungen
     or (select count(*) from termin_teilnahmen where team_id = pg_temp.id('td')) <> w.teilnahmen then
    raise exception 'Kader, Meldungen oder festgehaltener Stand verändert';
  end if;
end $$;
rollback;

-- Block 2: nur ein unbestätigtes Konto, dann ohne Konto → keine Verwaltung.
-- (Nicht der Default: In einer DB nach prodweg_bestand.sql gibt es das Konto
-- mit der Default-ID. Den Default prüft der CI-Prod-Weg.)
begin;
set local statement_timeout = '60s';
set local session_replication_role = replica;
select pg_temp.bestand();
delete from verein_verwaltung;
select vereine_nachziehen(pg_temp.id('unbestaetigt'));
select vereine_nachziehen(null);
do $$
declare
  v_verein uuid := (select verein_id from teams where id = pg_temp.id('ta'));
begin
  if v_verein is null then raise exception 'Block 2: Team ohne Verein'; end if;
  if exists (select 1 from verein_verwaltung where verein_id = v_verein) then
    raise exception 'Block 2: Verwaltung ohne bestätigtes Konto';
  end if;
end $$;
rollback;
