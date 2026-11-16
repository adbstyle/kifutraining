-- Sync-Baustein supabase/sync/testkonto.sql (sync-staging.yml):
-- (a) Ohne Passwort und ohne Konto geschieht nichts.
-- (b) Mit Passwort entstehen Konto, Verein mit Verwaltung, Team mit dem Konto
--     als Trainer:in, Spieler:innen, drei Trainings (eines mit zwei Varianten
--     und vollständig, eines vollständig mit einer Variante, eines
--     unvollständig) und vier anstehende Termine, davon ein Spiel.
-- (c) Ein zweiter Lauf ändert nichts.
-- Braucht die Manual-Übungen (in der CI läuft der Seed vor den psql-Tests
-- nicht: dann fehlen sie, und der Test legt je Block eine Attrappe an).
-- Alles in einer Transaktion mit rollback; hinterlässt nichts.

\set ON_ERROR_STOP on

begin;
set local statement_timeout = '60s';

-- Ein lokal schon bestehendes claude@tester.ch weicht für diesen Test aus
-- (rollback stellt es wieder her).
update auth.users set email = 'claude-ausweich@tester.local' where email = 'claude@tester.ch';

-- Attrappen, falls die Manual-Übungen fehlen (Werte gemäss ablauf_je_einordnung
-- und fahrplan_vollstaendig).
insert into public.exercises (slug, name, trainingsteil, hauptteilkategorie, source, visibility, altersstufe, aufbau, methodischer_fahrplan)
select x.slug, x.slug, x.teil, x.hkat, 'manual', 'public', 'kinderfussball', 'Aufbau',
       case when x.teil in ('einleitung', 'hauptteil') and x.hkat is distinct from 'fussball-spielen'
            then '{"offen_starten": "Start", "ueben": ["- Üben"], "wetteifern": "Wetteifern"}'::jsonb end
  from (values ('zz-test-auffangen', 'auffangen', null), ('zz-test-einleitung', 'einleitung', null),
               ('zz-test-fsl', 'hauptteil', 'fussball-spielen-lernen'), ('zz-test-fs', 'hauptteil', 'fussball-spielen'),
               ('zz-test-ve', 'hauptteil', 'vielseitigkeit-erleben'), ('zz-test-ausklang', 'ausklang', null)) as x(slug, teil, hkat)
 where not exists (select 1 from public.exercises e
                    where e.source = 'manual' and e.visibility = 'public' and e.altersstufe = 'kinderfussball'
                      and e.trainingsteil = x.teil and e.hauptteilkategorie is not distinct from x.hkat);

-- (a) Kein Passwort, kein Konto: nichts.
\set passwort ''
\ir ../sync/testkonto.sql
do $$
begin
  if exists (select 1 from auth.users where email = 'claude@tester.ch') then
    raise exception '(a) Konto ohne Passwort angelegt';
  end if;
end $$;

-- (b) Mit Passwort.
\set passwort 'Test-nur-lokal-1!'
\ir ../sync/testkonto.sql
create temp table stand as
select (select count(*) from public.vereine) vereine,
       (select count(*) from public.teams) teams,
       (select count(*) from public.spieler) spieler,
       (select count(*) from public.trainings) trainings,
       (select count(*) from public.training_termine) termine;
do $$
declare
  v_uid uuid := (select id from auth.users where email = 'claude@tester.ch');
  v_team uuid;
begin
  if v_uid is null then raise exception '(b) Konto fehlt'; end if;
  if not exists (select 1 from auth.identities where user_id = v_uid and provider = 'email') then
    raise exception '(b) Identität fehlt';
  end if;
  if not exists (select 1 from public.verein_verwaltung vv where vv.user_id = v_uid) then
    raise exception '(b) Verwaltung fehlt';
  end if;
  select tm.team_id into v_team from public.team_members tm where tm.user_id = v_uid;
  if v_team is null then raise exception '(b) Team fehlt'; end if;
  if (select count(*) from public.team_spieler where team_id = v_team) < 3 then
    raise exception '(b) zu wenige Spieler:innen';
  end if;
  if (select count(*) from public.trainings where owner_id = v_uid) <> 3 then
    raise exception '(b) erwartet drei eigene Trainings';
  end if;
  if not exists (select 1 from public.trainings t where t.owner_id = v_uid
                  and (select count(*) from public.training_varianten v where v.training_id = t.id) = 2
                  and public.training_fehlende_bedingungen(t.id) = '{}') then
    raise exception '(b) vollständiges Training mit zwei Varianten fehlt';
  end if;
  if (select count(*) from public.trainings t where t.owner_id = v_uid
       and public.training_fehlende_bedingungen(t.id) = '{}') <> 2 then
    raise exception '(b) erwartet zwei vollständige Trainings';
  end if;
  if (select count(*) from public.training_termine where team_id = v_team and datum > current_date) <> 4
     or (select count(*) from public.training_termine where team_id = v_team and art = 'spiel') <> 1 then
    raise exception '(b) erwartet vier anstehende Termine, davon ein Spiel';
  end if;
  if exists (select 1 from public.training_termine tt where tt.team_id = v_team
              and not exists (select 1 from public.termin_trainer tr
                               where tr.termin_id = tt.id and tr.user_id = v_uid and tr.verantwortlich)) then
    raise exception '(b) Termin ohne Konto als Verantwortliche';
  end if;
end $$;

-- (c) Zweiter Lauf: keine neuen Zeilen.
\ir ../sync/testkonto.sql
do $$
begin
  if (select (vereine, teams, spieler, trainings, termine) from stand) is distinct from
     (select ((select count(*) from public.vereine), (select count(*) from public.teams),
              (select count(*) from public.spieler), (select count(*) from public.trainings),
              (select count(*) from public.training_termine))) then
    raise exception '(c) zweiter Lauf hat Zeilen angelegt';
  end if;
end $$;

rollback;
