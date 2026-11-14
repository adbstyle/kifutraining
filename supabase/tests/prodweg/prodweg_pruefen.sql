-- Prod-Weg, Teil 2 (Architekturplan Vereine §6.5, §6.7): Prüfabfragen nach
-- den Vereine-Migrationen, je Verstoss ein `raise exception`.
--
--   psql "$DB_URL" -f prodweg_pruefen.sql
--
-- Teil A gilt für jede Datenbank nach dem Rollout: CI-Prod-Weg, Generalprobe
-- auf Staging, Staging nach einem Sync. Teil B nur, wenn prodweg_bestand.sql
-- vorher den synthetischen Bestand angelegt hat (Schema `prodweg`): Backfill
-- dieses Bestands, Gleichwertigkeit der Lesepfade mit dem alten Schema und
-- Testfall 1 (Story 1 PC 2) und die Dublette über zwei Teams (Story 2 PC 1,
-- AK 7), Umbenennen der Teams mit gleichem Schlüssel (Story 5 PC 6). Teil B
-- ändert nichts bleibend (rollback). Spätere Stories ergänzen ihre Abfragen
-- (Konten ohne Verein mit Story 12).

\set ON_ERROR_STOP on

-- ── Teil A: Invarianten ─────────────────────────────────────────────────────

begin read only;
set local statement_timeout = '120s';
do $$
declare
  n bigint;
  x text;
begin
  select count(*) into n from teams where verein_id is null;
  if n > 0 then raise exception 'Teams ohne Verein: %', n; end if;
  select count(*) into n from spieler where verein_id is null;
  if n > 0 then raise exception 'Spieler:innen ohne Verein: %', n; end if;
  select count(*) into n from spieler s where s.team_id is not null and not exists
    (select 1 from team_spieler ts where ts.spieler_id = s.id and ts.team_id = s.team_id);
  if n > 0 then raise exception 'Spieler:innen ohne Zuordnung zu ihrem Team: %', n; end if;
  -- spieler.team_id = erstes Team bis Phase 7/8 (Story 3, Entscheid A.1): null nur ohne Zuordnung.
  select count(*) into n from spieler s where s.team_id is null and exists
    (select 1 from team_spieler ts where ts.spieler_id = s.id);
  if n > 0 then raise exception 'Spieler:innen mit Zuordnung, aber ohne team_id: %', n; end if;
  select count(*) into n from team_spieler ts join spieler s on s.id = ts.spieler_id
   where s.verein_id <> ts.verein_id;
  if n > 0 then raise exception 'Zuordnungen mit fremdem Verein: %', n; end if;
  select count(*) into n from vereine v where not exists
    (select 1 from verein_verwaltung w where w.verein_id = v.id);
  if n > 0 then raise exception 'Vereine ohne Verwaltung: %', n; end if;
  -- Höchstens ein Verein je Person (Story 11 AK 7).
  select string_agg(user_id::text, ', ') into x from (
    select user_id from (
      select m.user_id, t.verein_id from team_members m join teams t on t.id = m.team_id
      union select user_id, verein_id from verein_verwaltung) z
     group by user_id having count(distinct verein_id) > 1) d;
  if x is not null then raise exception 'Personen in mehreren Vereinen: %', x; end if;
  -- Schnuppernde stehen in genau einem Team (Story 8 AK 5).
  select count(*) into n from team_spieler ts where ts.probe_seit is not null and exists
    (select 1 from team_spieler a where a.spieler_id = ts.spieler_id and a.team_id <> ts.team_id);
  if n > 0 then raise exception 'Schnuppernde in mehreren Teams: %', n; end if;
  -- Im selben Team kein Schlüssel doppelt.
  select count(*) into n from (
    select 1 from team_spieler ts join spieler s on s.id = ts.spieler_id
     group by ts.team_id, spieler_text_schluessel(s.vorname), spieler_text_schluessel(s.nachname), s.jahrgang
    having count(*) > 1) d;
  if n > 0 then raise exception 'Doppelte Schlüssel im selben Team: %', n; end if;
  -- Keine ungeprüften Constraints an den Tabellen des Epics (andere Tabellen
  -- tragen schon vorher `not valid`-Constraints, etwa training_exercises).
  -- Ausgenommen bis zur Validierung im letzten PR vor dem Release (Plan
  -- Phase A, `_validieren`): die FKs aus 20261114100000_zuordnung_invarianten.sql.
  select string_agg(conname, ', ') into x from pg_constraint
   where conrelid in ('teams'::regclass, 'spieler'::regclass, 'vereine'::regclass,
                      'verein_verwaltung'::regclass, 'team_spieler'::regclass,
                      'kader_spieler'::regclass, 'termin_abmeldungen'::regclass, 'spiel_meldungen'::regclass,
                      'termin_statuswechsel'::regclass, 'termin_eingefroren'::regclass, 'termin_kader'::regclass,
                      'spiel_treffpunkte'::regclass, 'termin_teilnahmen'::regclass, 'spiel_teilnahmen'::regclass)
     and not convalidated
     and conname not in ('ks_zuordnung', 'ta_zuordnung', 'sm_zuordnung', 'ta_termin_team', 'tsw_termin_team',
                         'sm_termin_team', 'te_termin_team', 'tk_termin_team', 'stp_termin_team',
                         'tn_eingefroren_team', 'st_eingefroren_team');
  if x is not null then raise exception 'Ungeprüfte Constraints: %', x; end if;
  -- Story 5: Ein Team ohne Mitglied bleibt bestehen; die Auflösewege der
  -- Mitglieder sind weg (Teams ohne Mitglied sind ab dann erlaubt).
  if to_regprocedure('team_aufloesen_wenn_leer()') is not null
     or exists (select 1 from pg_trigger where tgname = 'team_aufloesen_wenn_leer')
     or to_regprocedure('create_team(text)') is not null
     or to_regprocedure('loese_team_auf(uuid,text)') is not null
     or to_regprocedure('entferne_team_mitglied(uuid,uuid,text)') is not null then
    raise exception 'Auflösewege der Mitglieder bestehen noch';
  end if;
end $$;
rollback;

-- ── Teil B: synthetischer Bestand (nur nach prodweg_bestand.sql) ────────────

select to_regnamespace('prodweg') is not null as prodweg_bestand \gset
\if :prodweg_bestand

begin;
set local statement_timeout = '120s';

do $$
declare
  v_teams uuid[] := array[prodweg.id('t_gross'), prodweg.id('t_f1'), prodweg.id('t_f2'), prodweg.id('t_d')];
  v_verein uuid := (select verein_id from teams where id = prodweg.id('t_gross'));
  v_vorher jsonb := (select lesepfade from prodweg.vorher);
  v_jetzt jsonb := prodweg.lesepfade();
  k text;
begin
  -- Backfill: ein Verein «FC Wyler» mit genau der Verwaltung aus dem Default.
  if (select name from vereine where id = v_verein) is distinct from 'FC Wyler'
     or (select count(distinct verein_id) from teams where id = any(v_teams)) <> 1 then
    raise exception 'Bestand nicht im Verein «FC Wyler»';
  end if;
  if (select array_agg(user_id) from verein_verwaltung where verein_id = v_verein)
     is distinct from array[prodweg.id('verwaltung')] then
    raise exception 'Verwaltung von FC Wyler ist nicht genau das Konto aus vereine_nachziehen';
  end if;
  if person_verein(prodweg.id('ohne_team')) is not null then
    raise exception 'Konto ohne Team gehört einem Verein an';
  end if;
  if (select count(*) from team_spieler where team_id = any(v_teams))
     <> (select count(*) from spieler where team_id = any(v_teams))
     or (select count(*) from team_spieler where team_id = prodweg.id('t_gross')) <> 150 then
    raise exception 'Zuordnungen des Bestands unvollständig';
  end if;
  if (select count(distinct s.id) from spieler s join team_spieler ts on ts.spieler_id = s.id and ts.team_id = s.team_id
       where s.nachname = 'Dublette' and s.team_id = any(v_teams)) <> 2 then
    raise exception 'Dublette nicht als zwei Datensätze mit je eigener Zuordnung';
  end if;
  if (select name from teams where id = prodweg.id('t_f2')) <> 'prodweg f junioren' then
    raise exception 'Teamname mit gleichem Schlüssel verändert';
  end if;
  if (select probe_seit from team_spieler where spieler_id = prodweg.id('p_schnupper'))
     is distinct from (select probe_seit from spieler where id = prodweg.id('p_schnupper')) then
    raise exception 'Schnupper-Status nicht auf der Zuordnung';
  end if;

  -- Gleichwertigkeit: dieselben Ausgaben wie im alten Schema, und die
  -- Schreibwege, die gelingen sollen, gelingen (vorher prüft prodweg_bestand.sql).
  perform prodweg.erfolg_pruefen(v_jetzt, 'nachher');
  if v_jetzt is distinct from v_vorher then
    for k in select key from jsonb_each(v_vorher) loop
      if v_jetzt -> k is distinct from v_vorher -> k then
        raise exception 'Lesepfad «%» weicht ab. Vorher: % Jetzt: %', k, v_vorher -> k, v_jetzt -> k;
      end if;
    end loop;
    raise exception 'Lesepfade weichen ab';
  end if;
end $$;

-- Testfall 1 (Story 1 PC 2): Ein Team mit 150 Bestand kann ändern,
-- herausnehmen (seit Story 3 statt löschen) und J+S importieren; die 151. Spieler:in und ein Import mit neuer Zeile
-- scheitern an der Teamgrenze. Als Trainer:in über die RPCs (wie PostgREST).
select set_config('request.jwt.claims',
         jsonb_build_object('sub', prodweg.id('trainer_a'), 'role', 'authenticated')::text, true) is not null
       as prodweg_claims \gset
grant usage on schema prodweg to authenticated;
grant select on prodweg.ids to authenticated;
set local role authenticated;
do $$
declare
  v_team uuid := prodweg.id('t_gross');
  v_eins uuid := (select id from spieler where team_id = v_team and nachname = 'Nr 1');
  v_zeile jsonb := jsonb_build_object('zeile', 1, 'vorname', 'Gross', 'nachname', 'Nr 2', 'jahrgang', 2015, 'js', '4711');
  v_drei uuid;
  v jsonb;
  f text;
begin
  perform spieler_aendern(v_team, v_eins, 'Gross', 'Nr 1', 2015, '1234');
  -- Herausnehmen statt Löschen (Story 3).
  v_drei := (select id from spieler where team_id = v_team and nachname = 'Nr 3');
  v := spieler_aus_team_nehmen(v_team, v_drei, spieler_teams(v_team, v_drei) ->> 'stand');
  if v ->> 'status' <> 'herausgenommen' or not (v ->> 'ohne_team')::boolean then
    raise exception 'Testfall 1: Herausnehmen über der Grenze: %', v;
  end if;
  begin
    perform spieler_aufnehmen(v_team, 'Neu', 'Neu', 2015, null);
    raise exception 'Testfall 1: 151. Spieler:in aufgenommen';
  exception when others then
    if position('SPIELERLISTE_VOLL' in sqlerrm) = 0 then raise; end if;
  end;
  -- Reiner J+S-Import bei Bestand über 100 geht durch.
  v := spieler_importieren(v_team, jsonb_build_array(v_zeile));
  v := spieler_importieren(v_team, jsonb_build_array(v_zeile),
         jsonb_build_object('neu', v -> 'neu', 'js', (select jsonb_agg(j -> 'zeile') from jsonb_array_elements(v -> 'js') j)));
  if (v ->> 'js')::int <> 1 then raise exception 'Testfall 1: J+S-Import ohne Wirkung: %', v; end if;
  -- Mit einer neuen Zeile nicht.
  v_zeile := jsonb_build_object('zeile', 1, 'vorname', 'Ganz', 'nachname', 'Neu', 'jahrgang', 2015);
  v := spieler_importieren(v_team, jsonb_build_array(v_zeile));
  begin
    perform spieler_importieren(v_team, jsonb_build_array(v_zeile), jsonb_build_object('neu', v -> 'neu', 'js', '[]'::jsonb));
    raise exception 'Testfall 1: Import mit neuer Zeile über der Teamgrenze';
  exception when others then
    if position('SPIELERLISTE_VOLL' in sqlerrm) = 0 then raise; end if;
  end;

  -- Story 2 (PC 1, AK 7): Die Dublette über zwei Teams bleibt ohne
  -- Schlüsseländerung änderbar; eine dritte Erfassung mit demselben
  -- Schlüssel weist ab und nennt beide Teams.
  v := spieler_aendern(prodweg.id('t_f1'), (select id from spieler where team_id = prodweg.id('t_f1') and nachname = 'Dublette'),
                       'Lea', 'Dublette', 2017, '55');
  if v <> '{"status": "geaendert"}'::jsonb then raise exception 'Story 2: Dublette nicht änderbar: %', v; end if;
  v := spieler_aufnehmen(prodweg.id('t_d'), 'Lea', 'Dublette', 2017, null);
  if v ->> 'status' <> 'abgewiesen' or v ->> 'grund' <> 'doppelt' or (v ->> 'eigenes_team')::boolean
     or jsonb_array_length(v -> 'teams') <> 2
     or not v -> 'teams' @> '["Prodweg F-Junioren", "prodweg f junioren"]'::jsonb then
    raise exception 'Story 2: dritte Erfassung nicht als doppelt abgewiesen: %', v;
  end if;
end $$;
reset role;
-- Das Netz im Trigger: dieselbe dritte Erfassung ohne RPC.
do $$
begin
  insert into spieler (team_id, verein_id, vorname, nachname, jahrgang)
  values (prodweg.id('t_d'), (select verein_id from teams where id = prodweg.id('t_d')), 'Lea', 'Dublette', 2017);
  raise exception 'Story 2: dritte Erfassung ohne RPC angenommen';
exception when others then
  if position('SPIELER_DOPPELT' in sqlerrm) = 0 then raise; end if;
end $$;
do $$
begin
  if (select count(*) from team_spieler where team_id = prodweg.id('t_gross')) <> 149
     or (select js_nummer from spieler where team_id = prodweg.id('t_gross') and nachname = 'Nr 2') <> '4711' then
    raise exception 'Testfall 1: Bestand nach Ändern, Herausnehmen und Import falsch';
  end if;
  if (select count(*) from spieler where nachname = 'Dublette' and team_id in (prodweg.id('t_f1'), prodweg.id('t_f2'))) <> 2
     or (select js_nummer from spieler where team_id = prodweg.id('t_f1') and nachname = 'Dublette') <> '55' then
    raise exception 'Story 2: Dublette nicht als zwei Datensätze erhalten oder Änderung fehlt';
  end if;
end $$;

-- Story 5 (PC 6, AK 22): Von den zwei Teams mit gleichem Schlüssel lässt sich
-- eines auf eine andere Schreibweise und auf einen neuen Schlüssel umbenennen,
-- nicht aber zurück auf den Schlüssel des anderen; ein drittes Team mit
-- diesem Schlüssel entsteht nicht. Als Verwaltung über die RPCs.
select set_config('request.jwt.claims',
         jsonb_build_object('sub', prodweg.id('verwaltung'), 'role', 'authenticated')::text, true) is not null
       as prodweg_claims_verwaltung \gset
set local role authenticated;
do $$
declare
  v_verein uuid := (select verein_id from teams where id = prodweg.id('t_gross'));
  v jsonb;
begin
  v := verein_team_umbenennen(prodweg.id('t_f2'), 'Prodweg F junioren');
  if v <> '{"status": "umbenannt", "name": "Prodweg F junioren"}'::jsonb then
    raise exception 'Story 5: Altdublette nicht auf andere Schreibweise umbenennbar: %', v;
  end if;
  v := verein_team_anlegen(v_verein, 'PRODWEG F-JUNIOREN');
  if v ->> 'status' <> 'abgewiesen' or v ->> 'grund' <> 'name_vergeben' then
    raise exception 'Story 5: drittes Team mit vergebenem Schlüssel: %', v;
  end if;
  v := verein_team_umbenennen(prodweg.id('t_f2'), 'Prodweg F-Junioren Zwei');
  if v ->> 'status' <> 'umbenannt' then raise exception 'Story 5: Umbenennen auf neuen Schlüssel: %', v; end if;
  v := verein_team_umbenennen(prodweg.id('t_f2'), 'prodweg f junioren');
  if v <> '{"status": "abgewiesen", "grund": "name_vergeben", "team": "Prodweg F-Junioren"}'::jsonb then
    raise exception 'Story 5: Umbenennen zurück auf vergebenen Schlüssel: %', v;
  end if;
end $$;
reset role;

rollback;
\endif
