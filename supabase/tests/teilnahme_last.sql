-- Lasttest der Teilnahme aller Spieler:innen eines Teams (#702 NFR 1): 100
-- Spieler:innen, ein Jahr mit 100 Trainings und 50 Spielen, drei Kader,
-- gemischte Meldungen. team_teilnahme muss als `authenticated` in weniger
-- als 2 Sekunden antworten — einmal, wenn noch nichts festgehalten ist (die
-- Helfer laufen je Termin und Spieler:in), und einmal, wenn alles
-- festgehalten ist. Die Dauer steht als NOTICE in der Ausgabe.
-- Wird es knapp: zuerst den Plan prüfen (`explain analyze`), nicht die
-- Grenze heben.
-- Alles in einer Transaktion mit rollback; hinterlässt nichts.

\set ON_ERROR_STOP on
\o /dev/null

begin;
set local statement_timeout = '120s';

create function pg_temp.als(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.zurueck() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Misst team_teilnahme über das ganze Jahr und bricht ab, wenn es 2 s oder
-- länger dauert. Gibt die Zahl der Spieler:innen mit Zeilen zurück.
create function pg_temp.messe(p_team uuid, p_lauf text) returns void
language plpgsql as $$
declare
  t0 timestamptz := clock_timestamp();
  n integer;
  dauer interval;
begin
  select count(*) into n from team_teilnahme(p_team, current_date - 365, current_date);
  dauer := clock_timestamp() - t0;
  raise notice '#702 Last (%): % Spieler:innen in % ms', p_lauf, n, round(extract(epoch from dauer) * 1000);
  if n <> 100 then raise exception '#702 Last (%): % statt 100 Spieler:innen', p_lauf, n; end if;
  if dauer >= interval '2 seconds' then
    raise exception '#702 Last (%): % — mehr als 2 s', p_lauf, dauer;
  end if;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('v'), ('a'), ('t');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

insert into auth.users (id, email, email_confirmed_at) values (pg_temp.id('a'), 'a@teilnahme-last.test', now());

set local session_replication_role = replica;
insert into vereine (id, name) values (pg_temp.id('v'), 'Last-Verein');
insert into teams (id, name, verein_id) values (pg_temp.id('t'), 'Last-Team', pg_temp.id('v'));
insert into team_members (team_id, user_id) values (pg_temp.id('t'), pg_temp.id('a'));

-- 100 Spieler:innen, jede zehnte schnuppert.
create temp table sp as
  select gen_random_uuid() as id, i from generate_series(1, 100) i;
insert into spieler (id, verein_id, vorname, nachname, jahrgang)
select id, pg_temp.id('v'), 'S' || i, 'Last', 2015 from sp;
insert into team_spieler (team_id, spieler_id, verein_id, probe_seit)
select pg_temp.id('t'), id, pg_temp.id('v'), case when i % 10 = 0 then now() - interval '400 days' end from sp;

-- Drei Kader, je ein Drittel.
create temp table kd as select gen_random_uuid() as id, k from generate_series(0, 2) k;
insert into kader (id, team_id, name) select id, pg_temp.id('t'), 'Kader ' || k from kd;
insert into kader_spieler (kader_id, spieler_id, team_id)
select kd.id, sp.id, pg_temp.id('t') from sp join kd on kd.k = sp.i % 3;

-- 100 Trainings und 50 Spiele übers Jahr; jedes fünfte mit Kader.
create temp table tm as
  select gen_random_uuid() as id, j, case when j % 3 = 0 then 'spiel' else 'training' end as art,
         current_date - 2 - (j * 363 / 150) as datum
    from generate_series(0, 149) j;
insert into training_termine (id, team_id, datum, beginn, ende, art, ausgefallen, meldefrist_vorlauf_min, bezeichnung)
select id, pg_temp.id('t'), datum, '18:00', '19:30', art, j % 37 = 0,
       case when art = 'spiel' and j % 2 = 0 then 1440 end,
       case when art = 'spiel' then 'Match' end
  from tm;
insert into termin_kader (termin_id, kader_id, team_id)
select tm.id, kd.id, pg_temp.id('t') from tm join kd on kd.k = tm.j % 3 where tm.j % 5 = 0;

-- Meldungen: jede siebte Spieler:in meldet sich vom Training ab, an Spielen
-- melden sich die meisten an, einige ab, einige sind nicht aufgeboten.
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet, verfallen_am, vorher_datum, vorher_beginn)
select tm.id, sp.id, pg_temp.id('t'), sp.i % 10 = 0, null, null, null
  from tm cross join sp where tm.art = 'training' and (sp.i + tm.j) % 7 = 0;
insert into termin_statuswechsel (termin_id, spieler_id, team_id, gewechselt_am)
select tm.id, sp.id, pg_temp.id('t'), (tm.datum - 2)::timestamptz
  from tm cross join sp where tm.art = 'training' and (sp.i + tm.j) % 7 = 0;
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am, nicht_aufgeboten)
select tm.id, sp.id, pg_temp.id('t'),
       case when (sp.i + tm.j) % 9 = 0 then 'abgemeldet' when (sp.i + tm.j) % 4 = 0 then null else 'angemeldet' end,
       case when (sp.i + tm.j) % 4 = 0 and (sp.i + tm.j) % 9 <> 0 then null else (tm.datum - 3)::timestamptz end,
       (sp.i + tm.j) % 11 = 0
  from tm cross join sp
 where tm.art = 'spiel' and ((sp.i + tm.j) % 4 <> 0 or (sp.i + tm.j) % 9 = 0 or (sp.i + tm.j) % 11 = 0);
set local session_replication_role = origin;
analyze training_termine, team_spieler, termin_abmeldungen, spiel_meldungen, termin_statuswechsel, termin_kader, kader_spieler;

-- Lauf 1: nichts festgehalten (der teurere Fall).
select pg_temp.als(pg_temp.id('a'));
select pg_temp.messe(pg_temp.id('t'), 'offen');
select pg_temp.zurueck();

-- Lauf 2: alles festgehalten.
set local session_replication_role = replica;
insert into termin_eingefroren (termin_id, team_id) select id, pg_temp.id('t') from tm;
insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet, nachgetragen)
select tm.id, pg_temp.id('t'), sp.id, (sp.i + tm.j) % 7 = 0, (sp.i + tm.j) % 13 = 0
  from tm cross join sp where tm.art = 'training';
insert into spiel_teilnahmen (termin_id, team_id, spieler_id, zustand, gewechselt_am, nicht_aufgeboten, nachgetragen)
select tm.id, pg_temp.id('t'), sp.id,
       case when (sp.i + tm.j) % 9 = 0 then 'abgemeldet' when (sp.i + tm.j) % 4 = 0 then null else 'angemeldet' end,
       (tm.datum - 3)::timestamptz, (sp.i + tm.j) % 11 = 0, (sp.i + tm.j) % 13 = 0
  from tm cross join sp where tm.art = 'spiel' and sp.i % 10 <> 0;
set local session_replication_role = origin;
analyze termin_eingefroren, termin_teilnahmen, spiel_teilnahmen;

select pg_temp.als(pg_temp.id('a'));
select pg_temp.messe(pg_temp.id('t'), 'festgehalten');
select pg_temp.zurueck();

rollback;
