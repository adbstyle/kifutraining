-- Prod-Weg, Teil 1 (Architekturplan Vereine §6.7, CI-Job «Prod-Weg»):
-- synthetischer Bestand im ALTEN Schema, also auf dem Stand der letzten
-- Migration auf `main` (`supabase db reset --version …`), mit echten Triggern.
-- Danach wendet der Job die Vereine-Migrationen an (`supabase migration up`)
-- und prüft mit prodweg_pruefen.sql.
--
--   psql "$DB_URL" -v verwaltung_konto=<uuid> -f prodweg_bestand.sql
--
-- `verwaltung_konto` ist der Default von `vereine_nachziehen` aus der
-- Fundament-Migration (der Job liest ihn dort aus): Ein bestätigtes Konto mit
-- dieser ID steht im Bestand, damit der Backfill wie auf Prod genau eine
-- Verwaltung einsetzt.
--
-- Bestand: ein Team mit 150 Spieler:innen, zwei Teams mit gleichem
-- normalisiertem Namen und einer Dublette, ein Team mit Schnuppernder, Kader,
-- Trainings und Spielen (kommend und festgehalten) samt Meldungen, Trainer:innen
-- in mehreren Teams und ein bestätigtes Konto ohne Team.
-- Dazu das Schema `prodweg` (nicht `public`): die IDs und eine Funktion, die
-- die Ausgaben der Lesepfade sammelt; ihr Ergebnis hier im alten Schema ist
-- der Vergleichsstand für die Gleichwertigkeit (Story 1, AP §3.2).
-- Nur für die Wegwerf-DB des Jobs bzw. eine lokale DB; committet.

\set ON_ERROR_STOP on
\if :{?verwaltung_konto}
\else
  \echo 'prodweg_bestand.sql: psql-Variable verwaltung_konto fehlt'
  \quit 3
\endif

begin;
set local statement_timeout = '120s';

create schema prodweg;
create table prodweg.ids (name text primary key, id uuid not null default gen_random_uuid());
insert into prodweg.ids (name, id) values ('verwaltung', :'verwaltung_konto');
insert into prodweg.ids (name) values ('trainer_a'), ('trainer_b'), ('ohne_team'),
  ('t_gross'), ('t_f1'), ('t_f2'), ('t_d'),
  ('p1'), ('p2'), ('p3'), ('p4'), ('p_schnupper'), ('k1'),
  ('tr_vorbei'), ('tr_kommend'), ('tr_kader'), ('sp_kommend'), ('sp_vorbei');
create function prodweg.id(p text) returns uuid
language sql stable as $$ select id from prodweg.ids where name = p $$;

insert into auth.users (id, email, email_confirmed_at)
select id, name || '@prodweg.test', now() from prodweg.ids
 where name in ('verwaltung', 'trainer_a', 'trainer_b', 'ohne_team');

insert into teams (id, name) values
  (prodweg.id('t_gross'), 'Prodweg E-Junioren'),
  (prodweg.id('t_f1'), 'Prodweg F-Junioren'),
  (prodweg.id('t_f2'), 'prodweg f junioren'),        -- gleicher Schlüssel wie t_f1
  (prodweg.id('t_d'), 'Prodweg D-Junioren');
insert into team_members (team_id, user_id) values
  (prodweg.id('t_gross'), prodweg.id('verwaltung')),
  (prodweg.id('t_gross'), prodweg.id('trainer_a')),
  (prodweg.id('t_f1'), prodweg.id('trainer_a')),
  (prodweg.id('t_d'), prodweg.id('trainer_a')),
  (prodweg.id('t_f2'), prodweg.id('trainer_b'));

insert into spieler (team_id, vorname, nachname, jahrgang)
select prodweg.id('t_gross'), 'Gross', 'Nr ' || i, 2015 from generate_series(1, 150) i;
insert into spieler (team_id, vorname, nachname, jahrgang) values
  (prodweg.id('t_f1'), 'Lea', 'Dublette', 2017), (prodweg.id('t_f2'), 'Lea', 'Dublette', 2017),
  (prodweg.id('t_f1'), 'Mia', 'Eins', 2017), (prodweg.id('t_f2'), 'Noe', 'Zwei', 2017);
insert into spieler (id, team_id, vorname, nachname, jahrgang, js_nummer) values
  (prodweg.id('p1'), prodweg.id('t_d'), 'Ada', 'Dee', 2013, '111'),
  (prodweg.id('p2'), prodweg.id('t_d'), 'Ben', 'Dee', 2013, null),
  (prodweg.id('p3'), prodweg.id('t_d'), 'Cem', 'Dee', 2013, null),
  (prodweg.id('p4'), prodweg.id('t_d'), 'Dan', 'Dee', 2013, null);
insert into team_probetraining (team_id, anzahl, info) values (prodweg.id('t_d'), 3, 'Bitte Schienbeinschoner mitnehmen.');
insert into spieler (id, team_id, vorname, nachname, jahrgang, probe_seit) values
  (prodweg.id('p_schnupper'), prodweg.id('t_d'), 'Eva', 'Schnupper', 2013, now() - interval '20 days');
insert into kader (id, team_id, name) values (prodweg.id('k1'), prodweg.id('t_d'), 'Kader Eins');
insert into kader_spieler (kader_id, spieler_id, team_id) values
  (prodweg.id('k1'), prodweg.id('p1'), prodweg.id('t_d')), (prodweg.id('k1'), prodweg.id('p2'), prodweg.id('t_d'));

-- Termine nach der Liste: Vergangene halten beim Anlegen fest (Trigger).
insert into training_termine (id, team_id, datum, beginn, ende) values
  (prodweg.id('tr_vorbei'), prodweg.id('t_d'), current_date - 7, '18:00', '19:30'),
  (prodweg.id('tr_kommend'), prodweg.id('t_d'), current_date + 7, '18:00', '19:30'),
  (prodweg.id('tr_kader'), prodweg.id('t_d'), current_date + 8, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (prodweg.id('sp_kommend'), prodweg.id('t_d'), current_date + 9, '10:00', '12:00', 'spiel', 'Match kommend');
-- Ein vergangenes Spiel lässt sich nicht mehr anlegen (SPIEL_ANPFIFF_VERGANGEN);
-- auf Prod entstand es vor dem Anpfiff. Darum ohne Trigger anlegen und von
-- Hand festhalten, wie es der Trigger beim Anpfiff täte.
set local session_replication_role = replica;
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (prodweg.id('sp_vorbei'), prodweg.id('t_d'), current_date - 8, '10:00', '12:00', 'spiel', 'Match vorbei');
set local session_replication_role = origin;
select termin_einfrieren(prodweg.id('sp_vorbei')) is null as sp_vorbei_festgehalten \gset
insert into termin_kader (termin_id, kader_id, team_id) values (prodweg.id('tr_kader'), prodweg.id('k1'), prodweg.id('t_d'));
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (prodweg.id('tr_kommend'), prodweg.id('p1'), prodweg.id('t_d'), false),
  (prodweg.id('tr_kommend'), prodweg.id('p_schnupper'), prodweg.id('t_d'), true);
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am) values
  (prodweg.id('sp_kommend'), prodweg.id('p2'), prodweg.id('t_d'), 'angemeldet', now()),
  (prodweg.id('sp_kommend'), prodweg.id('p3'), prodweg.id('t_d'), 'abgemeldet', now());

-- Ausgaben der Lesepfade über den ganzen Bestand. Läuft im alten wie im
-- neuen Schema (die Funktionen werden zur Laufzeit aufgelöst) als postgres,
-- also ohne RLS.
create function prodweg.lesepfade() returns jsonb
language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_termine uuid[] := array(select t.id from training_termine t
                             where t.team_id = prodweg.id('t_d') order by t.id);
  v_spieler uuid[] := array(select s.id from spieler s
                             where s.team_id = prodweg.id('t_d') order by s.id);
begin
  return jsonb_build_object(
    'spielstand', (select jsonb_object_agg(t.id, spielstand(t)) from training_termine t where t.id = any(v_termine)),
    'termin_teilnehmer', (select jsonb_object_agg(x, (select coalesce(jsonb_agg(to_jsonb(r) order by r.spieler_id), '[]')
                                                         from termin_teilnehmer(x) r))
                            from unnest(v_termine) x),
    'spiel_teilnehmer', (select jsonb_object_agg(x, (select coalesce(jsonb_agg(to_jsonb(r) order by r.spieler_id), '[]')
                                                        from spiel_teilnehmer(x) r))
                           from unnest(v_termine) x),
    'training_meldestand', (select jsonb_object_agg(x, (select coalesce(jsonb_agg(to_jsonb(r) order by r.spieler_id), '[]')
                                                           from training_meldestand(x) r))
                              from unnest(v_termine) x),
    'je_spieler', (select jsonb_object_agg(s.id, jsonb_build_object(
                      'probe_stand', probe_stand(s.id),
                      'link', spieler_link_ansicht(s.link_token),
                      'gilt', (select jsonb_object_agg(x, termin_gilt_fuer(x, s.id)) from unnest(v_termine) x),
                      'abgemeldet', (select jsonb_object_agg(x, training_abgemeldet(x, s.id)) from unnest(v_termine) x)))
                     from spieler s where s.id = any(v_spieler)),
    'team_probe_staende', (select coalesce(jsonb_agg(to_jsonb(r) order by r.spieler_id), '[]')
                             from team_probe_staende(prodweg.id('t_d')) r),
    'festgehalten', (select coalesce(jsonb_agg(jsonb_build_object('termin', p.termin_id, 'spieler', p.spieler_id,
                                                                  'abgemeldet', p.abgemeldet) order by p.termin_id, p.spieler_id), '[]')
                       from termin_teilnahmen p where p.termin_id = any(v_termine)),
    'spiel_festgehalten', (select coalesce(jsonb_agg(jsonb_build_object('termin', p.termin_id, 'spieler', p.spieler_id,
                                                                        'zustand', p.zustand) order by p.termin_id, p.spieler_id), '[]')
                             from spiel_teilnahmen p where p.termin_id = any(v_termine)));
end;
$$;

create table prodweg.vorher as select prodweg.lesepfade() as lesepfade;

commit;
