-- Sync-Baustein nach dem Restore (sync-staging.yml): Testkonto und Testdaten
-- für Tests auf Staging.
--
-- Der Sync spiegelt `auth.users` aus Prod und löscht damit jedes Staging-
-- Testkonto, ebenso reset-staging (danach fährt man ohnehin den Sync). Dieser
-- Baustein legt das Konto `claude@tester.ch` neu an und gibt ihm erfundene
-- Testdaten:
-- - einen Verein, das Konto in der Vereinsverwaltung,
-- - ein Team, das Konto als Trainer:in,
-- - erfundene Spieler:innen im Team,
-- - drei eigene Trainings (Kinderfussball): eines mit zwei Hauptteil-
--   Varianten, eines vollständig und veröffentlichbar (bleibt Entwurf), eines
--   unvollständig,
-- - Termine im Team in den nächsten Wochen: drei Trainings und ein Spiel.
--
-- Läuft in einer eigenen Transaktion NACH dem Restore, mit
-- `session_replication_role = origin`: alle Trigger (Grenzen, Eindeutigkeit,
-- erste Variante) greifen. Verein, Team und Spieler:innen entstehen über
-- dieselben RPCs wie in der Anwendung, unter den Claims des Kontos
-- (`request.jwt.claims`); Trainings und Termine wie in `lib/kern/` per Insert.
--
-- Erwartet die psql-Variable `passwort` (GitHub-Secret
-- STAGING_TESTKONTO_PASSWORT). Das Passwort steht nie im Repo; ist es leer und
-- fehlt das Konto, geschieht nichts (Warnung). Besteht das Konto schon,
-- braucht es kein Passwort und behält seines.
--
-- Wiederholbar: Steht das Konto schon in einem Verein, legt der Baustein
-- keine Testdaten an. Übungen kommen aus der Manual-Bibliothek (öffentliche
-- `source = 'manual'`), ohne Bilder: alle Manual-Übungen tragen ein Diagramm.
--
-- Nur für Staging. Geprüft von supabase/tests/sync_testkonto.sql.

-- Ohne eigenes begin/commit: der Workflow (bzw. der Test) umschliesst den
-- Baustein mit seiner Transaktion.
set local session_replication_role = origin;
select set_config('testkonto.passwort', :'passwort', true) is not null as testkonto_passwort_gesetzt \gset

-- 1) Das Konto (wie GoTrue es bei «Auto Confirm» anlegt).
do $$
declare
  v_email constant text := 'claude@tester.ch';
  v_pw text := current_setting('testkonto.passwort');
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = v_email;
  if v_uid is not null then
    raise warning 'testkonto: Konto % besteht schon', v_email;
    return;
  end if;
  if coalesce(v_pw, '') = '' then
    raise warning 'testkonto: kein Passwort (Secret STAGING_TESTKONTO_PASSWORT), Konto wird nicht angelegt';
    return;
  end if;
  v_uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token,
    is_sso_user, is_anonymous)
  values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_pw, extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{"email_verified":true}', now(), now(),
    '', '', '', '', '', '', '', '', false, false);
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_uid::text, v_uid,
          jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());
  raise warning 'testkonto: Konto % angelegt', v_email;
end $$;

-- 2) Die Claims des Kontos: auth.uid() in RPCs und Triggern.
select set_config('request.jwt.claims',
         coalesce((select jsonb_build_object('sub', id::text, 'role', 'authenticated', 'email', email)::text
                     from auth.users where email = 'claude@tester.ch'), '{}'),
         true) is not null as testkonto_claims_gesetzt \gset

-- Eine Manual-Übung als Fassung ins Training legen (wie `ordneUebungZu` in
-- lib/kern/fassung.ts, ohne Bildkopie). Gewählt wird die n-te Vorlage des
-- Blocks nach Slug; gibt es weniger, zählt man im Kreis.
create or replace function pg_temp.zuordnen(
  p_training uuid, p_teil text, p_hkat text, p_variante uuid, p_n int, p_dauer int)
returns uuid
language plpgsql as $$
declare
  ex public.exercises;
  v_anzahl int;
  v_id uuid := gen_random_uuid();
  v_diagramm jsonb;
begin
  select count(*) into v_anzahl from public.exercises
   where source = 'manual' and visibility = 'public' and altersstufe = 'kinderfussball'
     and trainingsteil = p_teil and hauptteilkategorie is not distinct from p_hkat;
  if v_anzahl = 0 then
    raise exception 'testkonto: keine Manual-Übung für % / %', p_teil, p_hkat;
  end if;
  select * into ex from public.exercises
   where source = 'manual' and visibility = 'public' and altersstufe = 'kinderfussball'
     and trainingsteil = p_teil and hauptteilkategorie is not distinct from p_hkat
   order by slug offset (p_n % v_anzahl) limit 1;
  v_diagramm := pg_temp.diagramm_kopie(ex.diagramm);
  insert into public.training_exercises (
    id, training_id, trainingsteil, hauptteilkategorie, variante_id, position, duration_min, altersstufe,
    name, kategorien, erscheinungsform, feldtyp, spielfeld_laenge_m, spielfeld_breite_m, anzahl_kinder,
    material, material_liste, material_basis, methodischer_fahrplan, uebungstyp, aufbau, varianten_text,
    bild_quelle, diagramm)
  values (v_id, p_training, p_teil, p_hkat, p_variante,
         coalesce((select max(position) + 1 from public.training_exercises te
                    where te.training_id = p_training and te.trainingsteil = p_teil
                      and te.hauptteilkategorie is not distinct from p_hkat
                      and te.variante_id is not distinct from p_variante), 0),
         case when p_teil = 'auffangen' then null else p_dauer end,
         ex.altersstufe, ex.name, ex.kategorien, ex.erscheinungsform, ex.feldtyp,
         ex.spielfeld_laenge_m, ex.spielfeld_breite_m, ex.anzahl_kinder, ex.material,
         ex.material_liste, ex.material_basis, ex.methodischer_fahrplan, ex.uebungstyp, ex.aufbau,
         ex.varianten_text,
         case when v_diagramm is null then null else ex.bild_quelle end, v_diagramm);
  return v_id;
end $$;

-- Ein Diagramm mit neuen Element-IDs (wie `kopiereDiagramm` in lib/diagramm).
create or replace function pg_temp.diagramm_kopie(p jsonb) returns jsonb
language sql as $$
  select case when coalesce(jsonb_array_length(p -> 'elemente'), 0) = 0 then null
              else jsonb_build_object('version', p -> 'version', 'elemente',
                     (select jsonb_agg(e || jsonb_build_object('id', gen_random_uuid()::text) order by o)
                        from jsonb_array_elements(p -> 'elemente') with ordinality as x(e, o)))
         end
$$;

-- 3) Die Testdaten.
do $$
declare
  v_uid uuid := auth.uid();
  v_verein uuid;
  v_team uuid;
  v_tr uuid;
  v_var_a uuid;
  v_var_b uuid;
  v_mapping jsonb;
  v_antwort jsonb;
  v_termin uuid;
  v_sp record;
  v_tag date;
  v_start date := current_date;
begin
  if v_uid is null then
    raise warning 'testkonto: kein Konto, keine Testdaten';
    return;
  end if;
  if public.person_verein(v_uid) is not null then
    raise warning 'testkonto: Konto steht schon in einem Verein, keine Testdaten';
    return;
  end if;

  insert into public.profiles (user_id, display_name) values (v_uid, 'Claude Test')
  on conflict (user_id) do nothing;

  -- Verein und Team wie in der Anwendung (Einstieg → Verein gründen; Verwaltung
  -- legt ein Team an und nimmt sich auf).
  v_antwort := public.verein_gruenden('Testverein Claude', true);
  v_verein := (v_antwort ->> 'id')::uuid;
  if v_verein is null then raise exception 'testkonto: Verein nicht gegründet: %', v_antwort; end if;
  v_antwort := public.verein_team_anlegen(v_verein, 'Claude Testteam F');
  v_team := (v_antwort ->> 'id')::uuid;
  if v_team is null then raise exception 'testkonto: Team nicht angelegt: %', v_antwort; end if;
  perform public.verein_team_beitreten(v_team);

  -- Erfundene Spieler:innen.
  for v_sp in
    select * from (values
      ('Lena', 'Muster', 2018), ('Noah', 'Beispiel', 2018), ('Mia', 'Testli', 2019),
      ('Luca', 'Probeli', 2018), ('Elif', 'Fiktiv', 2019), ('Jonas', 'Erfunden', 2019)
    ) as s(vorname, nachname, jahrgang)
  loop
    perform public.spieler_aufnehmen(v_team, v_sp.vorname, v_sp.nachname, v_sp.jahrgang, null);
  end loop;

  -- Training mit zwei Hauptteil-Varianten (vollständig je Variante).
  insert into public.trainings (name, ziel, altersstufe, stufen, visibility, owner_id)
  values ('Testtraining mit Varianten', 'Dribbeln und Torabschluss', 'kinderfussball', '{F,E}', 'private', v_uid)
  returning id into v_tr;
  select id into v_var_a from public.training_varianten where training_id = v_tr;
  perform pg_temp.zuordnen(v_tr, 'auffangen', null, null, 0, null);
  perform pg_temp.zuordnen(v_tr, 'einleitung', null, null, 0, 15);
  perform pg_temp.zuordnen(v_tr, 'hauptteil', 'fussball-spielen-lernen', v_var_a, 0, 20);
  perform pg_temp.zuordnen(v_tr, 'hauptteil', 'fussball-spielen', v_var_a, 0, 20);
  perform pg_temp.zuordnen(v_tr, 'ausklang', null, null, 0, 10);
  -- Die zweite Variante als Kopie der ersten (lege_variante_an wie in der App).
  select coalesce(jsonb_agg(jsonb_build_object(
           'quelle_id', te.id, 'neue_id', gen_random_uuid(),
           'bild_url', null, 'diagramm', pg_temp.diagramm_kopie(te.diagramm))), '[]')
    into v_mapping
    from public.training_exercises te where te.variante_id = v_var_a;
  v_var_b := public.lege_variante_an(v_tr, v_var_a, 'Schlechtwetter', 'Normal', v_mapping);
  perform pg_temp.zuordnen(v_tr, 'hauptteil', 'vielseitigkeit-erleben', v_var_b, 0, 15);

  -- Vollständiges, veröffentlichbares Training (bleibt Entwurf).
  insert into public.trainings (name, ziel, altersstufe, stufen, visibility, owner_id)
  values ('Testtraining vollständig', 'Passen und Ballkontrolle', 'kinderfussball', '{F}', 'private', v_uid)
  returning id into v_tr;
  select id into v_var_a from public.training_varianten where training_id = v_tr;
  perform pg_temp.zuordnen(v_tr, 'auffangen', null, null, 1, null);
  perform pg_temp.zuordnen(v_tr, 'einleitung', null, null, 1, 15);
  perform pg_temp.zuordnen(v_tr, 'hauptteil', 'fussball-spielen-lernen', v_var_a, 30, 20);
  perform pg_temp.zuordnen(v_tr, 'hauptteil', 'fussball-spielen', v_var_a, 0, 20);
  perform pg_temp.zuordnen(v_tr, 'ausklang', null, null, 1, 10);

  -- Unvollständiger Entwurf (Einleitung und freies Spiel fehlen).
  insert into public.trainings (name, altersstufe, stufen, visibility, owner_id)
  values ('Testtraining Entwurf', 'kinderfussball', '{G}', 'private', v_uid)
  returning id into v_tr;
  perform pg_temp.zuordnen(v_tr, 'auffangen', null, null, 2, null);

  -- Termine im Team: drei Trainings und ein Spiel in den nächsten Wochen.
  foreach v_tag in array array[v_start + 2, v_start + 9, v_start + 16] loop
    insert into public.training_termine (team_id, art, datum, beginn, ende, ort)
    values (v_team, 'training', v_tag, '17:30', '19:00', 'Testplatz')
    returning id into v_termin;
    perform public.termin_trainer_aendern(v_termin, array[v_uid], '{}', v_uid);
  end loop;
  insert into public.training_termine (
    team_id, art, bezeichnung, richtwert_min, richtwert_max, meldefrist_vorlauf_min, datum, beginn, ende, ort)
  values (v_team, 'spiel', 'Testturnier', 6, 10, 2880, v_start + 12, '09:00', '12:00', 'Testplatz')
  returning id into v_termin;
  perform public.termin_trainer_aendern(v_termin, array[v_uid], '{}', v_uid);

  raise warning 'testkonto: Testdaten angelegt (Verein %, Team %)', v_verein, v_team;
end $$;

