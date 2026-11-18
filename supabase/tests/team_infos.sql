-- Infos zum Team (#598), Migration 20261118100000_team_infos.sql:
-- - Rechte: Lesen und Festlegen nur als Mitglied des Teams (Nicht-Mitglied,
--   Verwaltung ohne Mitgliedschaft, anon: abgewiesen); kein direkter Zugriff
--   auf die Tabelle; die RPCs haben kein Recht für anon, der Stand-Helfer
--   keines für die API
-- - Festlegen (AK 1, 3): bereinigt (CRLF, Rand), leer entfernt die Zeile,
--   10'000 Zeichen gehen, 10'001 nicht und die bisherige Fassung bleibt
-- - Stand (AK 7): rückt nur, wenn sich der Text ändert
-- - Link (AK 5, 6; PC 1): `team_infos` mit Teamname, Text und Stand, nach
--   Teamname; Teams ohne Infos fehlen; solange die Spieler:in schnuppert und
--   ohne Team ist die Liste leer
-- Alles in einer Transaktion mit rollback; hinterlässt nichts.

\set ON_ERROR_STOP on
\o /dev/null

begin;
set local statement_timeout = '60s';

create function pg_temp.als(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.zurueck() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.fehler(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

create function pg_temp.erwarte(p_sql text, p_marker text) returns void
language plpgsql as $$
declare
  f text := pg_temp.fehler(p_sql);
begin
  if f is null or position(p_marker in f) = 0 then
    raise exception 'erwartet % bei «%», bekommen: %', p_marker, p_sql, coalesce(f, 'kein Fehler');
  end if;
end $$;

create function pg_temp.pruefe(p_ok boolean, p_text text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception '#598: %', p_text; end if;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('a'), ('b'), ('va'), ('v'), ('t1'), ('t2'), ('t3'),
  ('zwei'), ('schnupper'), ('ohne');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@team-infos.test', now() from ids where name in ('a', 'b', 'va');

-- Verein V: a ist Mitglied von T1 und T2, b nur von T3, va nur Verwaltung.
insert into vereine (id, name) values (pg_temp.id('v'), 'Infos-Verein');
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v'), pg_temp.id('va'));
insert into teams (id, name, verein_id) values
  (pg_temp.id('t1'), 'FF13', pg_temp.id('v')), (pg_temp.id('t2'), 'FF11', pg_temp.id('v')),
  (pg_temp.id('t3'), 'Futsal', pg_temp.id('v'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('t1'), pg_temp.id('a')), (pg_temp.id('t2'), pg_temp.id('a')), (pg_temp.id('t3'), pg_temp.id('b'));

insert into spieler (id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('zwei'), pg_temp.id('v'), 'Lea', 'Zwei', 2014),
  (pg_temp.id('schnupper'), pg_temp.id('v'), 'Noah', 'Schnupper', 2015),
  (pg_temp.id('ohne'), pg_temp.id('v'), 'Ohne', 'Team', 2016);
insert into team_spieler (team_id, spieler_id, verein_id) values
  (pg_temp.id('t1'), pg_temp.id('zwei'), pg_temp.id('v')),
  (pg_temp.id('t2'), pg_temp.id('zwei'), pg_temp.id('v')),
  (pg_temp.id('t3'), pg_temp.id('zwei'), pg_temp.id('v')),
  (pg_temp.id('t2'), pg_temp.id('schnupper'), pg_temp.id('v'));
update team_spieler set probe_seit = now()
 where team_id = pg_temp.id('t2') and spieler_id = pg_temp.id('schnupper');

create function pg_temp.link(p text) returns jsonb language sql as $$
  select spieler_link_ansicht((select link_token from spieler where id = pg_temp.id(p)))
$$;

-- ── Rechte ──────────────────────────────────────────────────────────────────

select pg_temp.pruefe(not has_function_privilege('anon', 'team_infos_festlegen(uuid, text)', 'execute'),
  'anon darf team_infos_festlegen nicht ausführen');
select pg_temp.pruefe(not has_function_privilege('anon', 'team_infos_lesen(uuid)', 'execute'),
  'anon darf team_infos_lesen nicht ausführen');
select pg_temp.pruefe(not has_function_privilege('authenticated', 'team_infos_stand(timestamptz)', 'execute'),
  'der Stand-Helfer hat kein API-Recht');
select pg_temp.pruefe(not has_table_privilege('authenticated', 'team_infos', 'select')
                      and not has_table_privilege('authenticated', 'team_infos', 'insert')
                      and not has_table_privilege('authenticated', 'team_infos', 'update')
                      and not has_table_privilege('authenticated', 'team_infos', 'delete')
                      and not has_table_privilege('anon', 'team_infos', 'select'),
  'kein direkter Zugriff auf team_infos');

select pg_temp.als(pg_temp.id('b'));
select pg_temp.erwarte(format('select team_infos_festlegen(%L, %L)', pg_temp.id('t1'), 'Fremd'), 'TEAM_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select team_infos_lesen(%L)', pg_temp.id('t1')), 'TEAM_NICHT_GEFUNDEN');
select pg_temp.zurueck();
select pg_temp.als(pg_temp.id('va'));
select pg_temp.erwarte(format('select team_infos_festlegen(%L, %L)', pg_temp.id('t1'), 'Verwaltung'), 'TEAM_NICHT_GEFUNDEN');
select pg_temp.zurueck();
select pg_temp.erwarte(format('select team_infos_festlegen(%L, %L)', pg_temp.id('t1'), 'Ohne Anmeldung'), 'not authenticated');

-- ── Festlegen, Länge, Stand ─────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(
  team_infos_festlegen(pg_temp.id('t1'), E'  \r\n## Willkommen\r\n- Dienstag\r\n  ') ->> 'text' = E'## Willkommen\n- Dienstag',
  'bereinigt: CRLF zu LF, Rand weg');
select pg_temp.pruefe(team_infos_lesen(pg_temp.id('t1'))
                      = jsonb_build_object('text', E'## Willkommen\n- Dienstag',
                                           'stand', to_char(now() at time zone 'Europe/Zurich', 'YYYY-MM-DD')),
  'das Mitglied liest die Infos seines Teams samt Stand');
select pg_temp.pruefe(team_infos_lesen(pg_temp.id('t2')) = '{"text": null, "stand": null}'::jsonb,
  'ohne Infos: beides null');
select pg_temp.zurueck();

-- Der Stand rückt nur mit dem Text: zurückdatieren, gleich speichern, ändern.
update team_infos set geaendert_am = now() - interval '3 days' where team_id = pg_temp.id('t1');
select pg_temp.als(pg_temp.id('a'));
select team_infos_festlegen(pg_temp.id('t1'), E'## Willkommen\n- Dienstag');
select pg_temp.zurueck();
select pg_temp.pruefe((select geaendert_am < now() - interval '2 days' from team_infos where team_id = pg_temp.id('t1')),
  'gleicher Text lässt den Stand stehen');
select pg_temp.als(pg_temp.id('a'));
select team_infos_festlegen(pg_temp.id('t1'), E'## Willkommen\n- Dienstag und Donnerstag');
select pg_temp.zurueck();
select pg_temp.pruefe((select geaendert_am > now() - interval '1 minute' from team_infos where team_id = pg_temp.id('t1')),
  'geänderter Text rückt den Stand');

select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(char_length(team_infos_festlegen(pg_temp.id('t2'), repeat('ä', 10000)) ->> 'text') = 10000,
  '10000 Zeichen gehen');
select pg_temp.erwarte(format('select team_infos_festlegen(%L, repeat(%L, 10001))', pg_temp.id('t2'), 'x'), 'TEAM_INFOS_ZU_LANG');
select pg_temp.pruefe(char_length(team_infos_lesen(pg_temp.id('t2')) ->> 'text') = 10000,
  'zu lang: die bisherige Fassung bleibt');
select team_infos_festlegen(pg_temp.id('t2'), E'**Fett** www.fc-wyler.ch');
select pg_temp.zurueck();

-- ── Link ────────────────────────────────────────────────────────────────────

select pg_temp.pruefe(
  (select array_agg(e ->> 'team' order by n) from jsonb_array_elements(pg_temp.link('zwei') -> 'team_infos') with ordinality x(e, n))
    = array['FF11', 'FF13'],
  'Link: Infos jedes Teams mit Infos, nach Teamname; Futsal ohne Infos fehlt');
select pg_temp.pruefe(
  (pg_temp.link('zwei') -> 'team_infos' -> 0 ->> 'text') = '**Fett** www.fc-wyler.ch'
  and (pg_temp.link('zwei') -> 'team_infos' -> 0 ->> 'stand') = to_char(now() at time zone 'Europe/Zurich', 'YYYY-MM-DD'),
  'Link: Text und Stand am Trainingsort');
select pg_temp.pruefe(pg_temp.link('schnupper') -> 'team_infos' = '[]'::jsonb, 'Link: beim Schnuppern keine Infos');
select pg_temp.pruefe(pg_temp.link('ohne') -> 'team_infos' = '[]'::jsonb, 'Link: ohne Team keine Infos');

-- Entfernen: leer oder nur Leerraum löscht die Zeile, der Link zeigt nichts mehr.
select pg_temp.als(pg_temp.id('a'));
select pg_temp.pruefe(team_infos_festlegen(pg_temp.id('t2'), E' \n ') ->> 'text' is null, 'leer entfernt');
select pg_temp.zurueck();
select pg_temp.pruefe(not exists (select 1 from team_infos where team_id = pg_temp.id('t2')), 'entfernt = keine Zeile');
select pg_temp.pruefe(jsonb_array_length(pg_temp.link('zwei') -> 'team_infos') = 1, 'Link: entfernte Infos fehlen');

-- Auflösen eines Teams nimmt seine Infos mit.
delete from teams where id = pg_temp.id('t1');
select pg_temp.pruefe(not exists (select 1 from team_infos where team_id = pg_temp.id('t1')), 'Team weg, Infos weg');

\o
select '✓ team_infos.sql' as ergebnis;
rollback;
