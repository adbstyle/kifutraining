-- Vereinbarung zur Auftragsbearbeitung (Story #675, ENTWURF; Migration
-- vereinbarung_auftragsbearbeitung).
-- - Gründen ohne Zustimmung (null) und mit einer anderen als der geltenden
--   Fassung legt keinen Verein an (AK 2); ohne «berechtigt» weiterhin nicht
-- - Gründen hält fest, welche Person wann welcher Fassung zugestimmt hat (PC 1)
-- - verein_vereinbarung: die Verwaltung liest geltende Fassung und Zustimmung
--   (AK 3, 4); ein Verein ohne Zustimmung liefert `zustimmung: null`; ein
--   Mitglied ohne Verwaltung, ein fremdes Konto und ein KI-Token nicht
-- - Die Tabelle hat kein API-Recht (anon und authenticated lesen nichts)
-- - Konto gelöscht, Verein bleibt: Fassung und Zeitpunkt bleiben, die Person
--   wird leer (Offene Frage 2)
-- - Verein gelöscht: der Nachweis ist weg (PC 2)
-- Endet mit rollback; hinterlässt nichts.

\set ON_ERROR_STOP on
\o /dev/null

begin;

create function pg_temp.als(p_user uuid, p_mehr jsonb default '{}') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_user, 'role', 'authenticated') || p_mehr)::text, true);
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
  if p_ok is not true then raise exception 'Vereinbarung #675: %', p_text; end if;
end $$;

create temp table ids (name text primary key, id uuid not null default gen_random_uuid());
insert into ids (name) values ('gruender'), ('mitglied'), ('fremd'), ('alt_verw'), ('alt'), ('alt_team');
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant select on ids to authenticated, anon;   -- temporär; die Rollen brauchen pg_temp.id

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@vereinbarung.test', now() from ids where name in ('gruender', 'mitglied', 'fremd', 'alt_verw');

-- Ein Verein von vor #675: ohne Zustimmung (Out of Scope 1).
insert into vereine (id, name) values (pg_temp.id('alt'), 'Alter Verein');
insert into verein_verwaltung (verein_id, user_id) values (pg_temp.id('alt'), pg_temp.id('alt_verw'));

select pg_temp.pruefe(vereinbarung_fassung() = '2026-11-entwurf', 'Zwilling VEREINBARUNG_FASSUNG (web/lib/rechtliches.ts)');

-- ── Gründen (AK 2, PC 1) ────────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('gruender'));
select pg_temp.erwarte($$select verein_gruenden('FC Zustimmung', true, null)$$, 'ZUSTIMMUNG_FEHLT');
select pg_temp.erwarte($$select verein_gruenden('FC Zustimmung', true, '2020-01-alt')$$, 'VEREINBARUNG_VERALTET');
select pg_temp.erwarte($$select verein_gruenden('FC Zustimmung', true, '')$$, 'VEREINBARUNG_VERALTET');
select pg_temp.erwarte($$select verein_gruenden('FC Zustimmung', false, '2026-11-entwurf')$$, 'BESTAETIGUNG_FEHLT');
select pg_temp.zurueck();
select pg_temp.pruefe(person_verein(pg_temp.id('gruender')) is null, 'ohne Zustimmung entsteht kein Verein');
select pg_temp.pruefe(not exists (select 1 from verein_zustimmungen where user_id = pg_temp.id('gruender')), 'und keine Zustimmung');

-- Die alte Signatur gibt es nicht mehr (kein Weg am Häkchen vorbei).
select pg_temp.pruefe(to_regprocedure('verein_gruenden(text,boolean)') is null, 'alte Signatur entfernt');

select pg_temp.als(pg_temp.id('gruender'));
select (verein_gruenden('FC Zustimmung', true, '2026-11-entwurf') ->> 'id') as neu_id \gset
select pg_temp.zurueck();
select pg_temp.pruefe(
  (select count(*) = 1 and bool_and(user_id = pg_temp.id('gruender') and fassung = '2026-11-entwurf'
                                    and zugestimmt_am = now())
     from verein_zustimmungen where verein_id = :'neu_id'::uuid),
  'Gründen hält Person, Fassung und Zeitpunkt fest');

-- ── Lesen (AK 3, 4) ─────────────────────────────────────────────────────────

-- Ein Team mit einem Mitglied ohne Verwaltung im neuen Verein.
insert into teams (id, name, verein_id) values (pg_temp.id('alt_team'), 'Team Z', :'neu_id'::uuid);
insert into team_members (team_id, user_id) values (pg_temp.id('alt_team'), pg_temp.id('mitglied'));

select pg_temp.als(pg_temp.id('gruender'));
select pg_temp.pruefe(
  (select v ->> 'geltend' = '2026-11-entwurf'
      and v -> 'zustimmung' ->> 'fassung' = '2026-11-entwurf'
      and (v -> 'zustimmung' ->> 'am') is not null
      and (select array_agg(k order by k) from jsonb_object_keys(v -> 'zustimmung') k) = array['am', 'fassung']
     from verein_vereinbarung(:'neu_id'::uuid) v),
  'die Verwaltung liest Fassung und Zeitpunkt, nicht die Person');
select pg_temp.zurueck();

select pg_temp.als(pg_temp.id('alt_verw'));
select pg_temp.pruefe(
  (select v ->> 'geltend' = '2026-11-entwurf' and v -> 'zustimmung' = 'null'::jsonb from verein_vereinbarung(pg_temp.id('alt')) v),
  'Verein ohne Zustimmung: zustimmung null');
select pg_temp.erwarte(format('select verein_vereinbarung(%L)', :'neu_id'), 'VEREIN_NICHT_GEFUNDEN');
select pg_temp.zurueck();

select pg_temp.als(pg_temp.id('mitglied'));
select pg_temp.erwarte(format('select verein_vereinbarung(%L)', :'neu_id'), 'VEREIN_NICHT_GEFUNDEN');
select pg_temp.zurueck();
select pg_temp.als(pg_temp.id('fremd'));
select pg_temp.erwarte(format('select verein_vereinbarung(%L)', :'neu_id'), 'VEREIN_NICHT_GEFUNDEN');
select pg_temp.zurueck();
select pg_temp.als(pg_temp.id('gruender'), jsonb_build_object('client_id', 'ki-client'));
select pg_temp.erwarte(format('select verein_vereinbarung(%L)', :'neu_id'), 'NUR_IN_DER_ANWENDUNG');
select pg_temp.zurueck();

-- ── Kein API-Recht auf die Tabelle ──────────────────────────────────────────

select pg_temp.als(pg_temp.id('gruender'));
select pg_temp.erwarte($$select * from verein_zustimmungen$$, '42501');
select pg_temp.erwarte($$select vereinbarung_fassung()$$, '42501');
select pg_temp.zurueck();
set local role anon;
select pg_temp.erwarte($$select * from verein_zustimmungen$$, '42501');
select pg_temp.erwarte(format('select verein_vereinbarung(%L)', :'neu_id'), '42501');
select pg_temp.zurueck();

-- ── Konto gelöscht, Verein bleibt ───────────────────────────────────────────

-- Eine zweite Verwaltung hält den Verein; die gründende Person geht.
insert into verein_verwaltung (verein_id, user_id) values (:'neu_id'::uuid, pg_temp.id('fremd'));
delete from verein_verwaltung where verein_id = :'neu_id'::uuid and user_id = pg_temp.id('gruender');
delete from auth.users where id = pg_temp.id('gruender');
select pg_temp.pruefe(
  (select count(*) = 1 and bool_and(user_id is null and fassung = '2026-11-entwurf')
     from verein_zustimmungen where verein_id = :'neu_id'::uuid),
  'Konto gelöscht: Fassung und Zeitpunkt bleiben, ohne Person');

-- ── Verein gelöscht (PC 2) ──────────────────────────────────────────────────

select pg_temp.als(pg_temp.id('fremd'));
select pg_temp.pruefe(verein_loeschen(:'neu_id'::uuid, 'FC Zustimmung') ->> 'status' = 'geloescht', 'Verein gelöscht');
select pg_temp.zurueck();
select pg_temp.pruefe(not exists (select 1 from verein_zustimmungen where verein_id = :'neu_id'::uuid),
  'mit dem Verein ist der Nachweis weg');

rollback;
