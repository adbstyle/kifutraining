-- Link als zugestellt markieren (#657, Epic #655). Das Rennen zustellen
-- gegen abholen steht in rennen.sql (z5).
-- - Team-Ort: setzen und zurücknehmen, idempotent; fremdes Team, Spieler:in
--   eines anderen Teams und die Verwaltung ohne Mitgliedschaft bekommen
--   SPIELER_NICHT_GEFUNDEN (AK 1)
-- - Verein-Ort: die Verwaltung auch ohne Team (AK 2); eine Trainer:in ohne
--   Verwaltung und ein KI-Token scheitern (Rollen nach Ort)
-- - abgeholt: kein Schreiben, Stand abgeholt, `geaendert` false (AK 1, 2)
-- - Trigger: Abholen setzt «zugestellt» zurück (PC 2), Erneuern an beiden
--   Orten ebenso (PC 3); Namensänderung und Abholadresse erneuern lassen den
--   Stand stehen
-- - Leser: verein_spielerliste und verein_spieler_link_holen nennen
--   «zugestellt» für die Verwaltung, nicht für Mitglieder (PC 1)
-- - Grants: Kern und Trigger-Funktion ohne API-Recht, Spalte nur lesbar
-- Alles in einer Transaktion mit rollback; hinterlässt nichts. Die Rolle
-- wechselt wie bei PostgREST über `role` und `request.jwt.claims`.

\set ON_ERROR_STOP on
\o /dev/null

begin;
set local statement_timeout = '60s';

create function pg_temp.als(p_user uuid, p_mehr jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_user, 'role', 'authenticated') || p_mehr)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Zurück zu postgres ohne Anmeldung: `reset role` allein lässt die Claims
-- (und damit auth.uid()) stehen.
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
  if p_ok is not true then raise exception '#657: %', p_text; end if;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('v'), ('ta'), ('tb'), ('ma'), ('mb'), ('verw'), ('ki'), ('s'), ('o'), ('b');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated;   -- temporär; die Rolle braucht pg_temp.id

-- Stand der Zeile als «bezogen/zugestellt».
create function pg_temp.stand(p text) returns text language sql stable
as $$ select link_bezogen || '/' || link_zugestellt from spieler where id = pg_temp.id(p) $$;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@link-zugestellt.test', now() from ids where name in ('ma', 'mb', 'verw', 'ki');

-- Verein mit Alpha (ma, ki-Konto) und Beta (mb), Verwaltung verw ohne Team.
-- s in Alpha und Beta, b nur in Beta, o ohne Team. Abholung in Alpha an.
insert into vereine (id, name) values (pg_temp.id('v'), 'Zustell-Verein');
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('v'), pg_temp.id('verw'));
insert into teams (id, name, verein_id) values
  (pg_temp.id('ta'), 'Alpha', pg_temp.id('v')), (pg_temp.id('tb'), 'Beta', pg_temp.id('v'));
insert into team_members (team_id, user_id) values
  (pg_temp.id('ta'), pg_temp.id('ma')), (pg_temp.id('ta'), pg_temp.id('ki')), (pg_temp.id('tb'), pg_temp.id('mb'));
insert into team_abholung (team_id, aktiv) values (pg_temp.id('ta'), true);
insert into spieler (id, verein_id, vorname, nachname, jahrgang) values
  (pg_temp.id('s'), pg_temp.id('v'), 'Sara', 'Zustell', 2015),
  (pg_temp.id('b'), pg_temp.id('v'), 'Bea', 'Beta', 2015),
  (pg_temp.id('o'), pg_temp.id('v'), 'Ole', 'Ohne', 2016);
insert into team_spieler (team_id, spieler_id, verein_id) values
  (pg_temp.id('ta'), pg_temp.id('s'), pg_temp.id('v')), (pg_temp.id('tb'), pg_temp.id('s'), pg_temp.id('v')),
  (pg_temp.id('tb'), pg_temp.id('b'), pg_temp.id('v'));

-- ── Spalte und Grants ───────────────────────────────────────────────────────

select pg_temp.pruefe(pg_temp.stand('s') = 'false/false', 'Default: ' || pg_temp.stand('s'));
select pg_temp.pruefe(has_column_privilege('authenticated', 'spieler', 'link_zugestellt', 'select')
                      and not has_column_privilege('authenticated', 'spieler', 'link_zugestellt', 'update'),
                      'Spalte nur lesbar');
select pg_temp.pruefe(not has_function_privilege('authenticated', 'link_zugestellt_kern(uuid, boolean)', 'execute')
                      and not has_function_privilege('anon', 'link_zugestellt_kern(uuid, boolean)', 'execute')
                      and not has_function_privilege('authenticated', 'spieler_link_zugestellt_fallen()', 'execute'),
                      'Kern und Trigger-Funktion ohne API-Recht');
select pg_temp.pruefe(has_function_privilege('authenticated', 'spieler_link_zugestellt_setzen(uuid, uuid, boolean)', 'execute')
                      and not has_function_privilege('anon', 'spieler_link_zugestellt_setzen(uuid, uuid, boolean)', 'execute')
                      and has_function_privilege('authenticated', 'verein_spieler_link_zugestellt_setzen(uuid, boolean)', 'execute')
                      and not has_function_privilege('anon', 'verein_spieler_link_zugestellt_setzen(uuid, boolean)', 'execute'),
                      'RPCs nur für authenticated');

-- ── Team-Ort (AK 1) ─────────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('ma'));
select pg_temp.pruefe(spieler_link_zugestellt_setzen(pg_temp.id('ta'), pg_temp.id('s'), true)
                      = '{"link_stand": "zugestellt", "geaendert": true}', 'Team: setzen');
select pg_temp.pruefe(spieler_link_zugestellt_setzen(pg_temp.id('ta'), pg_temp.id('s'), true)
                      = '{"link_stand": "zugestellt", "geaendert": true}', 'Team: idempotent');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.stand('s') = 'false/true', 'Team: gesetzt ' || pg_temp.stand('s'));
-- PC 1: derselbe Stand im anderen Team der Spieler:in.
select pg_temp.als(pg_temp.id('mb'));
select pg_temp.pruefe((select link_zugestellt from spieler where id = pg_temp.id('s')), 'Beta liest zugestellt');
select pg_temp.pruefe(spieler_link_zugestellt_setzen(pg_temp.id('tb'), pg_temp.id('s'), false)
                      = '{"link_stand": "offen", "geaendert": true}', 'Team: zurücknehmen in Beta');
select pg_temp.pruefe(spieler_link_zugestellt_setzen(pg_temp.id('tb'), pg_temp.id('s'), false)
                      = '{"link_stand": "offen", "geaendert": true}', 'Team: zurücknehmen idempotent');
-- Fremdes Team bzw. Spieler:in eines anderen Teams.
select pg_temp.erwarte(format('select spieler_link_zugestellt_setzen(%L, %L, true)', pg_temp.id('ta'), pg_temp.id('s')),
                       'SPIELER_NICHT_GEFUNDEN');
select pg_temp.als(pg_temp.id('ma'));
select pg_temp.erwarte(format('select spieler_link_zugestellt_setzen(%L, %L, true)', pg_temp.id('ta'), pg_temp.id('b')),
                       'SPIELER_NICHT_GEFUNDEN');
select pg_temp.erwarte(format('select spieler_link_zugestellt_setzen(%L, %L, true)', pg_temp.id('ta'), gen_random_uuid()),
                       'SPIELER_NICHT_GEFUNDEN');
-- Die Verwaltung ohne Mitgliedschaft kommt am Team-Ort nicht durch.
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.erwarte(format('select spieler_link_zugestellt_setzen(%L, %L, true)', pg_temp.id('tb'), pg_temp.id('b')),
                       'SPIELER_NICHT_GEFUNDEN');
-- Der KI-Client einer Trainer:in kommt am Team-Ort durch (AK 3).
select pg_temp.als(pg_temp.id('ki'), '{"client_id": "ki-client"}');
select pg_temp.pruefe(spieler_link_zugestellt_setzen(pg_temp.id('ta'), pg_temp.id('s'), true) ->> 'link_stand' = 'zugestellt',
                      'KI am Team-Ort');
select pg_temp.pruefe(spieler_link_zugestellt_setzen(pg_temp.id('ta'), pg_temp.id('s'), false) ->> 'link_stand' = 'offen',
                      'KI am Team-Ort zurück');
-- Am Verein-Ort scheitert das KI-Token.
select pg_temp.als(pg_temp.id('verw'), '{"client_id": "ki-client"}');
select pg_temp.erwarte(format('select verein_spieler_link_zugestellt_setzen(%L, true)', pg_temp.id('o')),
                       'NUR_IN_DER_ANWENDUNG');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.stand('s') = 'false/false' and pg_temp.stand('b') = 'false/false'
                      and pg_temp.stand('o') = 'false/false', 'nach den Abweisungen nichts geschrieben');

-- ── Verein-Ort (AK 2) ───────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_spieler_link_zugestellt_setzen(pg_temp.id('o'), true)
                      = '{"link_stand": "zugestellt", "geaendert": true}', 'Verein: ohne Team setzen');
select pg_temp.pruefe(verein_spieler_link_zugestellt_setzen(pg_temp.id('b'), true) ->> 'link_stand' = 'zugestellt',
                      'Verein: mit Team setzen');
select pg_temp.erwarte(format('select verein_spieler_link_zugestellt_setzen(%L, true)', gen_random_uuid()),
                       'SPIELER_NICHT_GEFUNDEN');
-- Leser der Verwaltung (PC 1).
select pg_temp.pruefe(verein_spieler_link_holen(pg_temp.id('o')) ->> 'zugestellt' = 'true'
                      and verein_spieler_link_holen(pg_temp.id('s')) ->> 'zugestellt' = 'false',
                      'link_holen: zugestellt');
select pg_temp.pruefe((select e -> 'link_zugestellt' from jsonb_array_elements(verein_spielerliste(pg_temp.id('v')) -> 'spieler') e
                        where e ->> 'id' = pg_temp.id('o')::text) = 'true', 'Liste: link_zugestellt');
-- Eine Trainer:in ohne Verwaltung scheitert am Verein-Ort und sieht in der
-- Vereinsliste keinen Stand.
select pg_temp.als(pg_temp.id('mb'));
select pg_temp.erwarte(format('select verein_spieler_link_zugestellt_setzen(%L, false)', pg_temp.id('b')),
                       'SPIELER_NICHT_GEFUNDEN');
select pg_temp.pruefe(not (verein_spielerliste(pg_temp.id('v')) -> 'spieler' -> 0) ? 'link_zugestellt',
                      'Liste für Mitglieder ohne Stand');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.stand('b') = 'false/true', 'b bleibt zugestellt');

-- ── Namensänderung und Abholadresse erneuern lassen den Stand stehen ────────

select pg_temp.als(pg_temp.id('mb'));
select spieler_aendern(pg_temp.id('tb'), pg_temp.id('b'), 'Beatrice', 'Beta', 2015, null);
select pg_temp.als(pg_temp.id('ma'));
select abholung_erneuern(pg_temp.id('ta'));
select pg_temp.zurueck();
select pg_temp.pruefe((select vorname from spieler where id = pg_temp.id('b')) = 'Beatrice', 'Name geändert');
select pg_temp.pruefe(pg_temp.stand('b') = 'false/true', 'Namensänderung lässt zugestellt: ' || pg_temp.stand('b'));

-- ── Erneuern setzt zurück (PC 3), an beiden Orten ───────────────────────────

select pg_temp.als(pg_temp.id('mb'));
select spieler_link_erneuern(pg_temp.id('tb'), pg_temp.id('b'));
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.stand('b') = 'false/false', 'Erneuern am Team-Ort: ' || pg_temp.stand('b'));
select pg_temp.als(pg_temp.id('verw'));
select verein_spieler_link_erneuern(pg_temp.id('o'));
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.stand('o') = 'false/false', 'Erneuern am Verein-Ort: ' || pg_temp.stand('o'));

-- ── Abholen setzt zurück (PC 2); abgeholt ist kein Schreiben ────────────────

select pg_temp.als(pg_temp.id('ma'));
select spieler_link_zugestellt_setzen(pg_temp.id('ta'), pg_temp.id('s'), true);
select pg_temp.zurueck();
select pg_temp.pruefe(abholung_abholen((select token from team_abholung where team_id = pg_temp.id('ta')),
                                       repeat('z', 32), 'Sara', 'Zustell', 2015) ->> 'status' = 'ok', 'abholen');
select pg_temp.pruefe(pg_temp.stand('s') = 'true/false', 'Abholen: ' || pg_temp.stand('s'));
select pg_temp.als(pg_temp.id('ma'));
select pg_temp.pruefe(spieler_link_zugestellt_setzen(pg_temp.id('ta'), pg_temp.id('s'), true)
                      = '{"link_stand": "abgeholt", "geaendert": false}', 'abgeholt: Team setzt nicht');
select pg_temp.pruefe(spieler_link_zugestellt_setzen(pg_temp.id('ta'), pg_temp.id('s'), false)
                      = '{"link_stand": "abgeholt", "geaendert": false}', 'abgeholt: Team nimmt nicht zurück');
select pg_temp.als(pg_temp.id('verw'));
select pg_temp.pruefe(verein_spieler_link_zugestellt_setzen(pg_temp.id('s'), true)
                      = '{"link_stand": "abgeholt", "geaendert": false}', 'abgeholt: Verein setzt nicht');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.stand('s') = 'true/false', 'abgeholt bleibt: ' || pg_temp.stand('s'));
-- Nach dem Erneuern ist der neue Link offen und wieder markierbar.
select pg_temp.als(pg_temp.id('ma'));
select spieler_link_erneuern(pg_temp.id('ta'), pg_temp.id('s'));
select pg_temp.pruefe(spieler_link_zugestellt_setzen(pg_temp.id('ta'), pg_temp.id('s'), true)
                      = '{"link_stand": "zugestellt", "geaendert": true}', 'nach dem Erneuern markierbar');
select pg_temp.zurueck();
select pg_temp.pruefe(pg_temp.stand('s') = 'false/true', 'Endstand: ' || pg_temp.stand('s'));

delete from abholung_sperren where schluessel = repeat('z', 32);

rollback;
