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
--
-- Abgedeckt über alle vier Teams (Termine liegen in t_d und t_f2):
--   lesend      spielstand (→ spielstand_training, spiel_stand, auch direkt),
--               termin_teilnehmer, spiel_teilnehmer, training_meldestand,
--               training_abgemeldet, termin_gilt_fuer, probe_stand,
--               team_probe_staende, spieler_link_ansicht, feedback_link_team,
--               spiel_pruefen, termin_abmeldungen_verfallend,
--               termin_anmeldungen_verfallend;
--   schreibend  Ergebnis und Folgezustand in einer zurückgerollten
--               Untertransaktion (prodweg.zurueck): kader_zuteilung_aendern
--               (→ kader_entfernen_folgen nur, soweit kader_nachher es ruft),
--               abholung_abholen, spiel_einfrieren, spiele_einfrieren,
--               termin_einfrieren_training, termine_einfrieren_training,
--               termin_zeitpunkt_nachher (Verlegen in die Zukunft),
--               termin_abmeldung_setzen, abmeldung_anwenden_training,
--               spieler_link_abmelden, termin_anwesenheit_setzen_training,
--               spiel_anwesenheit_setzen, termin_spielerzahl_regel und
--               serie_spielerzahl_regel (Insert mit Zahl).
-- Nicht abgedeckt: die Schreibwege mit eigenem Testfall (spieler_aufnehmen,
-- spieler_importieren, spieler_entfernen: Testfall 1 in prodweg_pruefen.sql;
-- spieler_probe_setzen, kader_entfernen_folgen beim Löschen eines Kaders)
-- sowie das Festhalten beim Anlegen eines vergangenen Termins (Trigger, nur
-- im alten Schema ausgelöst). Die Rechteprüfungen laufen nur für trainer_a.
-- training_abgemeldet nur für Spieler:innen des Termin-Teams (siehe dort).
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
  ('tr_vorbei'), ('tr_kommend'), ('tr_kader'), ('sp_kommend'), ('sp_vorbei'),
  ('tr_f2'), ('tr_offen'), ('sp_offen');
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
  (prodweg.id('tr_kader'), prodweg.id('t_d'), current_date + 8, '18:00', '19:30'),
  (prodweg.id('tr_f2'), prodweg.id('t_f2'), current_date + 7, '17:00', '18:30');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (prodweg.id('sp_kommend'), prodweg.id('t_d'), current_date + 9, '10:00', '12:00', 'spiel', 'Match kommend');
-- Ein vergangenes Spiel lässt sich nicht mehr anlegen (SPIEL_ANPFIFF_VERGANGEN);
-- auf Prod entstand es vor dem Anpfiff. Darum ohne Trigger anlegen und von
-- Hand festhalten, wie es der Trigger beim Anpfiff täte.
set local session_replication_role = replica;
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (prodweg.id('sp_vorbei'), prodweg.id('t_d'), current_date - 8, '10:00', '12:00', 'spiel', 'Match vorbei');
-- Je ein begonnener, noch nicht festgehaltener Termin samt Meldung: daran
-- halten die Einfrier-Wege im Vergleich fest.
insert into training_termine (id, team_id, datum, beginn, ende) values
  (prodweg.id('tr_offen'), prodweg.id('t_d'), current_date - 3, '18:00', '19:30');
insert into training_termine (id, team_id, datum, beginn, ende, art, bezeichnung) values
  (prodweg.id('sp_offen'), prodweg.id('t_d'), current_date - 2, '10:00', '12:00', 'spiel', 'Match offen');
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (prodweg.id('tr_offen'), prodweg.id('p3'), prodweg.id('t_d'), false);
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am) values
  (prodweg.id('sp_offen'), prodweg.id('p2'), prodweg.id('t_d'), 'angemeldet', now() - interval '3 days');
set local session_replication_role = origin;
select termin_einfrieren(prodweg.id('sp_vorbei')) is null as sp_vorbei_festgehalten \gset
insert into termin_kader (termin_id, kader_id, team_id) values (prodweg.id('tr_kader'), prodweg.id('k1'), prodweg.id('t_d'));
insert into termin_abmeldungen (termin_id, spieler_id, team_id, angemeldet) values
  (prodweg.id('tr_kommend'), prodweg.id('p1'), prodweg.id('t_d'), false),
  (prodweg.id('tr_kommend'), prodweg.id('p_schnupper'), prodweg.id('t_d'), true);
insert into spiel_meldungen (termin_id, spieler_id, team_id, zustand, gewechselt_am) values
  (prodweg.id('sp_kommend'), prodweg.id('p2'), prodweg.id('t_d'), 'angemeldet', now()),
  (prodweg.id('sp_kommend'), prodweg.id('p3'), prodweg.id('t_d'), 'abgemeldet', now());
insert into team_abholung (team_id, aktiv) values (prodweg.id('t_d'), true);

-- Führt einen Schreibweg in einer Untertransaktion aus, liest Ergebnis bzw.
-- Folgezustand und rollt zurück: Vorher und nachher laufen so auf demselben
-- Bestand. Ergebnis {wert, fehler}. Der Vergleich allein hielte einen Weg,
-- der vorher und nachher mit demselben Fehler scheitert, für gleichwertig;
-- darum prüft prodweg.erfolg_pruefen zusätzlich `fehler`.
create function prodweg.zurueck(p_tun text, p_lesen text) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v jsonb;
  e text;
begin
  begin
    if p_tun is not null then execute p_tun; end if;
    execute p_lesen into v;
    raise exception 'prodweg_zurueck';
  exception when others then
    if sqlerrm <> 'prodweg_zurueck' then e := sqlerrm; end if;
  end;
  return jsonb_build_object('wert', v, 'fehler', e);
end;
$$;

-- Ausgaben der Lesepfade über den ganzen Bestand. Läuft im alten wie im
-- neuen Schema (die Funktionen werden zur Laufzeit aufgelöst) als postgres,
-- also ohne RLS; wo eine RPC ein Konto verlangt, mit den Claims von
-- trainer_a (Mitglied von t_gross, t_f1, t_d). Volatil wegen der
-- zurückgerollten Schreibwege.
create function prodweg.lesepfade() returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_teams uuid[] := array[prodweg.id('t_gross'), prodweg.id('t_f1'), prodweg.id('t_f2'), prodweg.id('t_d')];
  v_termine uuid[] := array(select t.id from training_termine t
                             where t.team_id = any(v_teams) order by t.id);
  v_spieler uuid[] := array(select s.id from spieler s
                             where s.team_id = any(v_teams) order by s.id);
  v_d uuid[] := array(select s.id from spieler s where s.team_id = prodweg.id('t_d') order by s.id);
  v_claims text := current_setting('request.jwt.claims', true);
  v_abholung text := (select token from team_abholung where team_id = prodweg.id('t_d'));
  v_link_p2 text := (select link_token from spieler where id = prodweg.id('p2'));
  v jsonb;
  -- Folgezustand der Einfrier-Wege und des Verlegens, ohne Zeitstempel.
  c_teilnahmen constant text := $q$select coalesce(jsonb_agg(jsonb_build_object('spieler', p.spieler_id,
      'abgemeldet', p.abgemeldet) order by p.spieler_id), '[]') from termin_teilnahmen p where p.termin_id = %L$q$;
  c_spiel_teilnahmen constant text := $q$select coalesce(jsonb_agg(jsonb_build_object('spieler', p.spieler_id,
      'zustand', p.zustand, 'nicht_aufgeboten', p.nicht_aufgeboten) order by p.spieler_id), '[]')
      from spiel_teilnahmen p where p.termin_id = %L$q$;
begin
  perform set_config('request.jwt.claims',
            jsonb_build_object('sub', prodweg.id('trainer_a'), 'role', 'authenticated')::text, true);
  v := jsonb_build_object(
    'spielstand', (select jsonb_object_agg(t.id, spielstand(t)) from training_termine t where t.id = any(v_termine)),
    'spielstand_training', (select jsonb_object_agg(t.id, spielstand_training(t)) from training_termine t
                             where t.id = any(v_termine) and t.art = 'training'),
    'spiel_stand', (select jsonb_object_agg(t.id, spiel_stand(t)) from training_termine t
                     where t.id = any(v_termine) and t.art = 'spiel'),
    'verfallend', (select jsonb_object_agg(x, jsonb_build_array(
                      termin_abmeldungen_verfallend(x, current_date + 30, '18:00'),
                      termin_anmeldungen_verfallend(x, current_date + 30, '18:00')))
                     from unnest(v_termine) x),
    'spiel_pruefen', (select jsonb_object_agg(s, spiel_pruefen(prodweg.id('sp_kommend'), s, null, null))
                        from unnest(v_d) s),
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
                      'feedback_team', feedback_link_team(s.link_token),
                      'gilt', (select jsonb_object_agg(x, termin_gilt_fuer(x, s.id)) from unnest(v_termine) x),
                      -- Nur Termine des eigenen Teams: Für eine fremde Spieler:in gab
                      -- training_abgemeldet bisher false (bzw. bei Schnuppernden true)
                      -- zurück, jetzt null. Kein Aufrufer fragt so (alle prüfen vorher
                      -- die Zugehörigkeit zum Termin-Team).
                      'abgemeldet', (select jsonb_object_agg(t.id, training_abgemeldet(t.id, s.id)) from training_termine t
                                      where t.id = any(v_termine) and t.team_id = s.team_id)))
                     from spieler s where s.id = any(v_spieler)),
    'team_probe_staende', (select jsonb_object_agg(x, (select coalesce(jsonb_agg(to_jsonb(r) order by r.spieler_id), '[]')
                                                          from team_probe_staende(x) r))
                             from unnest(v_teams) x),
    'festgehalten', (select coalesce(jsonb_agg(jsonb_build_object('termin', p.termin_id, 'spieler', p.spieler_id,
                                                                  'abgemeldet', p.abgemeldet) order by p.termin_id, p.spieler_id), '[]')
                       from termin_teilnahmen p where p.termin_id = any(v_termine)),
    'spiel_festgehalten', (select coalesce(jsonb_agg(jsonb_build_object('termin', p.termin_id, 'spieler', p.spieler_id,
                                                                        'zustand', p.zustand) order by p.termin_id, p.spieler_id), '[]')
                             from spiel_teilnahmen p where p.termin_id = any(v_termine)),
    'schreibend', jsonb_build_object(
      'kader_dazu', prodweg.zurueck(null, format('select kader_zuteilung_aendern(%L, array[%L]::uuid[], array[%L]::uuid[])',
                       prodweg.id('t_d'), prodweg.id('p3'), prodweg.id('k1'))),
      'kader_weg', prodweg.zurueck(null, format('select kader_zuteilung_aendern(%L, array[%L]::uuid[], ''{}'', array[%L]::uuid[], 1)',
                       prodweg.id('t_d'), prodweg.id('p1'), prodweg.id('k1'))),
      'abholung_treffer', prodweg.zurueck(null, format('select abholung_abholen(%L, %L, ''Ada'', ''Dee'', 2013)',
                             v_abholung, repeat('a', 32))),
      'abholung_fehl', prodweg.zurueck(null, format('select abholung_abholen(%L, %L, ''Zoe'', ''Dee'', 2013)',
                          v_abholung, repeat('b', 32))),
      'spiel_einfrieren', prodweg.zurueck(format('select spiel_einfrieren(%L)', prodweg.id('sp_offen')),
                             format(c_spiel_teilnahmen, prodweg.id('sp_offen'))),
      'spiele_einfrieren', prodweg.zurueck(format('select spiele_einfrieren(%L)', prodweg.id('t_d')),
                              format(c_spiel_teilnahmen, prodweg.id('sp_offen'))),
      'termin_einfrieren_training', prodweg.zurueck(format('select termin_einfrieren_training(%L)', prodweg.id('tr_offen')),
                                       format(c_teilnahmen, prodweg.id('tr_offen'))),
      'termine_einfrieren_training', prodweg.zurueck(format('select termine_einfrieren_training(%L)', prodweg.id('t_d')),
                                        format(c_teilnahmen, prodweg.id('tr_offen'))),
      'termin_zeitpunkt_nachher', prodweg.zurueck(
          -- Je eine Abweichung vom Grundstand (abgemeldet bzw. schnuppernd angemeldet) wird zur Meldung.
          format($q$update termin_teilnahmen set abgemeldet = not abgemeldet where termin_id = %1$L and spieler_id in (%2$L, %3$L);
                    update training_termine set datum = current_date + 14 where id = %1$L$q$,
                 prodweg.id('tr_vorbei'), prodweg.id('p1'), prodweg.id('p_schnupper')),
          format($q$select jsonb_build_object('eingefroren', exists (select 1 from termin_eingefroren where termin_id = %1$L),
                     'meldungen', (select coalesce(jsonb_agg(jsonb_build_object('spieler', a.spieler_id, 'angemeldet', a.angemeldet,
                        'vorher_datum', a.vorher_datum, 'verfallen', a.verfallen_am is not null) order by a.spieler_id), '[]')
                        from termin_abmeldungen a where a.termin_id = %1$L))$q$, prodweg.id('tr_vorbei'))),
      'termin_abmeldung_setzen', prodweg.zurueck(null, format('select termin_abmeldung_setzen(%L, %L, true)',
                                    prodweg.id('tr_kommend'), prodweg.id('p2'))),
      'termin_abmeldung_schnupper', prodweg.zurueck(null, format('select termin_abmeldung_setzen(%L, %L, false)',
                                       prodweg.id('tr_kommend'), prodweg.id('p_schnupper'))),
      'abmeldung_anwenden_training', prodweg.zurueck(null, format('select abmeldung_anwenden_training(%L, %L, true, null, null)',
                                        prodweg.id('tr_kommend'), prodweg.id('p3'))),
      'spieler_link_abmelden', prodweg.zurueck(null, format('select spieler_link_abmelden(%L, %L, true, null, null)',
                                  v_link_p2, prodweg.id('tr_kommend'))),
      'termin_anwesenheit_setzen_training', prodweg.zurueck(null, format('select termin_anwesenheit_setzen_training(%L, %L, false)',
                                               prodweg.id('tr_vorbei'), prodweg.id('p1'))),
      'spiel_anwesenheit_setzen', prodweg.zurueck(null, format('select spiel_anwesenheit_setzen(%L, %L, true, null, null)',
                                     prodweg.id('sp_vorbei'), prodweg.id('p2'))),
      -- Die zwei Spielerzahl-Regeln: Hier ist der Fehler selbst das erwartete
      -- Ergebnis (SPIELERLISTE_FUEHRT_ZAHL); es zählt nur der Vergleich mit
      -- vorher (siehe prodweg.erfolg_pruefen).
      'termin_spielerzahl_regel', prodweg.zurueck(
          format($q$insert into training_termine (team_id, datum, beginn, ende, erwartete_spielerzahl)
                    values (%L, current_date + 20, '18:00', '19:30', 12)$q$, prodweg.id('t_d')), 'select null::jsonb'),
      'serie_spielerzahl_regel', prodweg.zurueck(
          format($q$insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, erwartete_spielerzahl)
                    values (%L, '{1}', current_date + 1, current_date + 60, '18:00', '19:30', 12)$q$, prodweg.id('t_d')),
          'select null::jsonb')));
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return v;
end;
$$;

-- Alle Schreibwege ausser den Spielerzahl-Regeln müssen gelingen, im alten
-- wie im neuen Schema: `fehler` ist null.
create function prodweg.erfolg_pruefen(p_lesepfade jsonb, p_stand text) returns void
language plpgsql as $$
declare
  x text;
begin
  select string_agg(k || ': ' || (v ->> 'fehler'), '; ' order by k) into x
    from jsonb_each(p_lesepfade -> 'schreibend') e(k, v)
   where k not in ('termin_spielerzahl_regel', 'serie_spielerzahl_regel')
     and v ->> 'fehler' is not null;
  if x is not null then raise exception 'Schreibweg scheitert (%): %', p_stand, x; end if;
end;
$$;

create table prodweg.vorher as select prodweg.lesepfade() as lesepfade;
do $$ begin perform prodweg.erfolg_pruefen((select lesepfade from prodweg.vorher), 'vorher'); end $$;

commit;
