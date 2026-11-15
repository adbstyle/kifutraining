-- Verein gründen und löschen (Story 11 #587, Epic #575; Architekturplan
-- Vereine §3.4, §4.1, §5.1–§5.3).
--
-- Jedes Konto ohne Verein gründet selbst einen Verein und wird seine erste
-- Verwaltung (`verein_gruenden`, ohne Team, ohne Freigabe). Die Verwaltung
-- löscht ihren Verein mit dem aktuellen Namen (`verein_loeschen`): alle Teams
-- mit allem, was beim Auflösen eines Teams verschwindet, den ganzen
-- Spielerbestand samt Links, Abos und Abholadressen, die Verwaltung und den
-- Verein. Persönliche Übungen und Trainings der Personen bleiben; alle
-- werden Konten ohne Verein. Das Konto der einzigen Person des Vereins nimmt
-- den Verein beim Löschen mit (`delete_account(p_vereinsname)`), wenn sie
-- seinen Namen eingibt; die Vorschau dazu liefert `konto_loeschen_info`.
--
-- Der Name wird wie im Web verglichen (`namen_stimmen`, Zwilling von
-- `namenStimmen` in web/components/ui/NamenBestaetigen.tsx): Gross/Klein
-- zählt, Leerzeichen am Rand (alle, die JS `trim()` entfernt, auf beiden
-- Seiten, also auch am gespeicherten Namen) und die Unicode-Form nicht.
-- Ebenso jetzt der Teamname beim Auflösen eines Teams
-- (`verein_team_aufloesen`, Story 5), der noch mit btrim verglich. Gründen
-- und Umbenennen speichern den Vereinsnamen ohne diesen Rand
-- (`namen_ohne_rand`), kein neuer CHECK.
--
-- Sperrordnung (AP §4.1): Verein → Suche → Person → Teams aufsteigend →
-- `spieler`-Zeile → Termin-Zeile. Gründen: Vereinssperre auf die neue,
-- noch unbekannte UUID, dann die Person, erst dann die Prüfung auf einen
-- Verein (zwei Gründungen derselben Person und Gründen gegen Aufnahme
-- serialisieren an der Personensperre). Löschen: Verein, dann alle Teams des
-- Vereins (Konto löschen: Verein, Person, Teams), erst dann Name und
-- Zugehörige unter den Sperren prüfen; die Kaskade nimmt danach Team-,
-- Zeilen- und Terminsperren in dieser Ordnung. Unter der Vereinssperre
-- kommen weder Teams noch Personen dazu (teams_vorher, team_members_vorher,
-- verwaltung_vorher nehmen sie).
--
-- Kein Schutz-Trigger blockiert das Löschen, keiner wird abgeschaltet:
-- team_spieler_vorher und spieler_vorher kehren in der Kaskade zurück (das
-- Team ist weg bzw. keine Zuordnung mehr), verwaltung_vorher lässt die
-- Verwaltungszeilen gehen, sobald der Verein weg ist (LETZTE_VERWALTUNG gilt
-- nur, solange er besteht). Die FKs `restrict` von teams und spieler auf
-- vereine sind das Netz für die Reihenfolge.
--
-- Laufzeit (Story 11, lokal gemessen, Test verein_gruenden_loeschen.sql):
-- 30 Teams und 1000 Spieler:innen samt Terminen und Trainings in rund 0.3 s,
-- weit unter dem PostgREST-Limit von 8 s. Ein lokales statement_timeout
-- verlängert das laufende Statement nicht und fehlt darum.
--
-- Termin-Ort: termin_entfernen und termin_training_setzen nehmen jetzt zuerst
-- die Teamsperre (Team → Termin), sonst 40P01 gegen das Löschen (rennen.sql).
--
-- Nur Funktionen: keine Tabelle, kein CHECK, kein NOT NULL.

set lock_timeout = '5s';

-- ── Funktionen: Helfer (kein API-Recht) ─────────────────────────────────────

-- Der Name ohne Rand: entfernt am Anfang und Ende alles, was JS `trim()`
-- entfernt (WhiteSpace und LineTerminator nach ECMAScript, nicht nur das
-- Leerzeichen wie btrim). null bleibt null. Zwilling: `.trim()` in
-- web/components/ui/NamenBestaetigen.tsx (namenStimmen) und vor dem Senden
-- eines neuen Vereinsnamens.
create function namen_ohne_rand(p_text text) returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(p_text,
           '^[\u0009-\u000D    -     　﻿]+'
           '|[\u0009-\u000D    -     　﻿]+$', '', 'g');
$$;

-- Bestätigung durch Eingabe des Namens. Zwilling: namenStimmen in
-- web/components/ui/NamenBestaetigen.tsx (`eingabe.trim().normalize("NFC")
-- === name.trim().normalize("NFC")`). Beide Seiten ohne Rand: Ein
-- gespeicherter Name mit Rand (Bestand, direkter Aufruf; teams_name_check
-- und verein_name prüfen nur btrim) lässt sich so immer bestätigen.
create function namen_stimmen(p_eingabe text, p_name text) returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select p_eingabe is not null and p_name is not null
     and normalize(namen_ohne_rand(p_eingabe), nfc) = normalize(namen_ohne_rand(p_name), nfc);
$$;

-- Verschiedene Konten in Verwaltung und Teams des Vereins.
create function verein_personenzahl(p_verein uuid) returns integer
language sql stable
set search_path = public, pg_temp
as $$
  select count(*)::int from (
    select w.user_id from verein_verwaltung w where w.verein_id = p_verein
    union
    select m.user_id from team_members m join teams t on t.id = m.team_id where t.verein_id = p_verein) x;
$$;

-- Was das Löschen des Kontos für den Verein bedeutet (AK 12, 13), p_verein
-- ist person_verein(p_user): 'frei' (keine Verwaltung oder eine weitere
-- Verwaltung), 'letzte_verwaltung' (weitere Personen im Verein),
-- 'einzige_person'. Liest team_members und verein_verwaltung direkt.
create function konto_loeschen_fall(p_user uuid, p_verein uuid) returns text
language sql stable
set search_path = public, pg_temp
as $$
  select case
    when p_verein is null
      or not exists (select 1 from verein_verwaltung where verein_id = p_verein and user_id = p_user)
      or exists (select 1 from verein_verwaltung where verein_id = p_verein and user_id <> p_user) then 'frei'
    when verein_personenzahl(p_verein) > 1 then 'letzte_verwaltung'
    else 'einzige_person'
  end;
$$;

-- Löscht den Verein mit allem (PC 3). Vorbedingung: Der Aufrufer hält die
-- Vereinssperre und die Sperren aller Teams des Vereins und hat Namen und
-- Zugehörige unter ihnen geprüft. Bilder der Team-Trainings werden vorher
-- eingesammelt (wie verein_team_aufloesen); die Dateien entfernt das Web.
-- Reihenfolge: Teams (Kaskade: Mitgliedschaften samt Kalender-Abos,
-- Zuordnungen, Kader, Termine, Serien, Trainings, Abholadresse, Schnupper-
-- Info), dann Spieler:innen (Kaskade: Abos, Abmeldungen, Meldungen; mit der
-- Zeile Link), dann der Verein (Kaskade: Verwaltung).
--   [{id, bild_url}]
create function verein_loeschen_kern(p_verein uuid) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_bilder jsonb;
begin
  v_bilder := (select coalesce(jsonb_agg(b order by t.id), '[]'::jsonb)
                 from teams t cross join lateral jsonb_array_elements(team_bilder(t.id)) b
                where t.verein_id = p_verein);
  delete from teams where verein_id = p_verein;
  delete from spieler where verein_id = p_verein;
  delete from vereine where id = p_verein;
  return v_bilder;
end;
$$;

-- ── Funktionen: Verein-Ort ──────────────────────────────────────────────────

-- Verein gründen (AK 1–4, 7, PC 1). Nur ein Konto ohne Verein; die Person
-- wird einzige Verwaltung, kein Team. Die Bestätigung wird nicht
-- festgehalten (Out of Scope 2). Vereinsnamen sind nicht eindeutig; ein
-- ungültiger Name scheitert am CHECK verein_name (23514), auch null.
--   {status: 'gegruendet', id, name}
create function verein_gruenden(p_name text, p_bestaetigt boolean) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_name text := coalesce(namen_ohne_rand(p_name), '');   -- Rand wie im Vergleich (namen_stimmen)
begin
  perform nur_in_der_anwendung();
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_bestaetigt is not true then raise exception 'BESTAETIGUNG_FEHLT'; end if;
  perform sperre_verein(v_id);
  perform sperre_person(v_uid);
  if person_verein(v_uid) is not null then raise exception 'SCHON_IM_VEREIN'; end if;
  insert into vereine (id, name) values (v_id, v_name);
  insert into verein_verwaltung (verein_id, user_id) values (v_id, v_uid);
  return jsonb_build_object('status', 'gegruendet', 'id', v_id, 'name', v_name);
end;
$$;

-- Verein löschen (AK 10, 14, 15, PC 3–5), nur die eigene Verwaltung. Sperren
-- Verein → Teams, dann den aktuellen Namen prüfen; stimmt er nicht, bleibt
-- alles, und die Antwort nennt ihn. `name` nennt danach den gelöschten Verein.
--   {status: 'vereinsname_falsch', name} | {status: 'geloescht', name, bilder: [{id, bild_url}]}
create function verein_loeschen(p_verein uuid, p_name text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_bilder jsonb;
begin
  perform nur_in_der_anwendung();
  perform verwaltung_sperren(p_verein);
  perform sperre_teams(array(select id from teams where verein_id = p_verein));
  v_name := (select name from vereine where id = p_verein);
  if not namen_stimmen(p_name, v_name) then
    return jsonb_build_object('status', 'vereinsname_falsch', 'name', v_name);
  end if;
  v_bilder := verein_loeschen_kern(p_verein);
  return jsonb_build_object('status', 'geloescht', 'name', v_name, 'bilder', v_bilder);
end;
$$;

-- Rumpf wie in 20261114200000_vereine_verwaltung.sql; der neue Name verliert
-- den Rand nun wie im Vergleich (namen_ohne_rand statt btrim), damit kein
-- Vereinsname entsteht, den der CHECK verein_name zulässt, das Web aber nie
-- bestätigen könnte.
--   {status: 'umbenannt', name}
create or replace function verein_umbenennen(p_verein uuid, p_name text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := namen_ohne_rand(p_name);
begin
  perform nur_in_der_anwendung();
  perform verwaltung_sperren(p_verein);
  update vereine set name = v_name where id = p_verein;
  return jsonb_build_object('status', 'umbenannt', 'name', v_name);
end;
$$;

-- Rumpf wie in 20261114200000_vereine_verwaltung.sql; der Teamname wird nun
-- wie der Vereinsname verglichen (`namen_stimmen`): btrim liess Tabulator,
-- geschütztes Leerzeichen usw. am Rand stehen, die das Web (`namenStimmen`)
-- wegnimmt — der Knopf war frei, die Datenebene antwortete name_falsch.
--   {status: 'name_falsch', name} | {status: 'aufgeloest', name, bilder, spieler_bleiben}
create or replace function verein_team_aufloesen(p_team uuid, p_teamname text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_bilder jsonb;
  v_spieler int;
begin
  perform nur_in_der_anwendung();
  perform verwaltung_team_sperren(p_team);
  perform sperre_teams(array[p_team]);
  select name into v_name from teams where id = p_team for update;
  -- Netz: Aufgelöst wird nur unter der Vereinssperre; ein späterer Löschweg
  -- ohne sie gäbe sonst name_falsch ohne Namen.
  if not found then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  if not namen_stimmen(p_teamname, v_name) then                  -- auch null
    return jsonb_build_object('status', 'name_falsch', 'name', v_name);
  end if;
  v_bilder := team_bilder(p_team);
  v_spieler := (select count(*) from team_spieler where team_id = p_team);
  delete from teams where id = p_team;
  return jsonb_build_object('status', 'aufgeloest', 'name', v_name, 'bilder', v_bilder, 'spieler_bleiben', v_spieler);
end;
$$;

-- Rumpf wie in 20261114210000_spielerbestand_verwaltung.sql; für die
-- Verwaltung dazu `personen`: verschiedene Konten in Verwaltung und Teams,
-- die beim Löschen zu Konten ohne Verein werden (AK 11).
--   {name, verwaltung: [{anzeige_name, ich, (user_id, email)}],
--    teams: [{id, name, ist_mitglied, (trainer, spieler_zahl, ohne_mitglied)}],
--    (spieler_zahl, spieler_ohne_team, personen)}
create or replace function verein_ansicht(p_verein uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verwaltung boolean;
begin
  perform nur_in_der_anwendung();
  if not ist_verein_mitglied(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  v_verwaltung := ist_verein_verwaltung(p_verein);
  return jsonb_build_object(
    'name', (select name from vereine where id = p_verein),
    'verwaltung', (select coalesce(jsonb_agg(
                      jsonb_build_object('anzeige_name', p.display_name, 'ich', w.user_id = v_uid)
                      || case when v_verwaltung then jsonb_build_object('user_id', w.user_id, 'email', u.email)
                              else '{}'::jsonb end
                      order by p.display_name nulls last, w.user_id), '[]'::jsonb)
                     from verein_verwaltung w
                     join auth.users u on u.id = w.user_id
                     left join profiles p on p.user_id = w.user_id
                    where w.verein_id = p_verein),
    'teams', (select coalesce(jsonb_agg(
                 jsonb_build_object('id', t.id, 'name', t.name,
                                    'ist_mitglied', exists (select 1 from team_members m
                                                             where m.team_id = t.id and m.user_id = v_uid))
                 || case when v_verwaltung then jsonb_build_object(
                      'trainer', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'user_id', m.user_id, 'anzeige_name', anzeige_name(m.user_id), 'email', u.email,
                                     'ist_verwaltung', exists (select 1 from verein_verwaltung w
                                                                where w.verein_id = p_verein and w.user_id = m.user_id))
                                     order by m.created_at, m.user_id), '[]'::jsonb)
                                    from team_members m join auth.users u on u.id = m.user_id
                                   where m.team_id = t.id),
                      'spieler_zahl', (select count(*) from team_spieler ts where ts.team_id = t.id),
                      'ohne_mitglied', not exists (select 1 from team_members m where m.team_id = t.id))
                    else '{}'::jsonb end
                 order by t.name, t.id), '[]'::jsonb)
                from teams t where t.verein_id = p_verein))
    || case when v_verwaltung then jsonb_build_object(
         'spieler_zahl', (select count(*) from spieler s where s.verein_id = p_verein),
         'spieler_ohne_team', (select count(*) from spieler s
                                where s.verein_id = p_verein
                                  and not exists (select 1 from team_spieler ts where ts.spieler_id = s.id)),
         'personen', verein_personenzahl(p_verein))
       else '{}'::jsonb end;
end;
$$;

-- ── Funktionen: Termin-Ort (Team vor Termin) ────────────────────────────────

-- termin_entfernen und termin_training_setzen sperrten zuerst die
-- Termin-Zeile ohne Teamsperre und fassten danach das Termin-Training an
-- (Trigger termin_training_aufraeumen). Die Kaskade beim Löschen eines
-- Vereins oder Auflösen eines Teams (unter den Teamsperren) nimmt erst die
-- Trainings (FK set null auf die Termin-Zeile), dann die Termine: 40P01,
-- nachgestellt in rennen.sql (t1, t2). Jetzt zuerst die Teamsperre, dann die
-- Termin-Zeile (Sperrordnung Team → Termin, AP §4.1, wie
-- termin_kader_setzen). Rumpf sonst unverändert.

-- Rumpf wie in 20260930211328_terminserien_aendern.sql.
create or replace function termin_entfernen(p_termin uuid, p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_termin training_termine;
  v_termin_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_termin_team from training_termine where id = p_termin;
  if v_termin_team is null or not ist_team_mitglied(v_termin_team) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  perform sperre_teams(array[v_termin_team]);                    -- Team vor Termin
  select * into v_termin from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(v_termin.team_id) then
    raise exception 'TERMIN_NICHT_GEFUNDEN';
  end if;
  if p_erwartet is not null
     and v_termin.training_id is distinct from (p_erwartet->>'termin_training')::uuid then
    raise exception 'TERMIN_BELEGUNG_GEAENDERT';
  end if;
  delete from training_termine where id = p_termin;
  if v_termin.serie_id is not null then
    insert into termin_serien_luecken (serie_id, tag)
      values (v_termin.serie_id, v_termin.serien_tag) on conflict do nothing;
    delete from termin_serien s
     where s.id = v_termin.serie_id
       and not exists (select 1 from training_termine where serie_id = s.id);
  end if;
  return jsonb_build_object('training', v_termin.training_id, 'team', v_termin.team_id);
end;
$$;

-- Rumpf wie in 20261007100000_termin_trainings.sql.
create or replace function termin_training_setzen(
  p_termin uuid,
  p_training uuid,
  p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_termin training_termine;
  v_team uuid;
  v_termin_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_termin_team from training_termine where id = p_termin;
  if v_termin_team is null or not ist_team_mitglied(v_termin_team) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  perform sperre_teams(array[v_termin_team]);                    -- Team vor Termin
  select * into v_termin from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(v_termin.team_id) then
    raise exception 'TERMIN_NICHT_GEFUNDEN';
  end if;
  if p_erwartet is not null
     and v_termin.training_id is distinct from (p_erwartet->>'termin_training')::uuid then
    raise exception 'TERMIN_BELEGUNG_GEAENDERT';
  end if;

  -- Lösen: Ein Termin-Training fällt mit (Trigger unten), ein Training aus
  -- dem Bestand bleibt dort.
  if p_training is null then
    update training_termine set training_id = null where id = p_termin;
    return jsonb_build_object('bisher', v_termin.training_id);
  end if;

  if v_termin.ausgefallen then raise exception 'TERMIN_AUSGEFALLEN'; end if;

  select team_id into v_team from trainings where id = p_training for update;
  if not found then raise exception 'TRAINING_NICHT_GEFUNDEN'; end if;
  if v_team is distinct from v_termin.team_id then
    raise exception 'TERMIN_TRAINING_FREMDES_TEAM';
  end if;
  if v_termin.training_id = p_training then
    return jsonb_build_object('bisher', null);
  end if;
  -- Rückhalt: Zugeordnet wird nur eine Kopie, die noch keinen Termin hat.
  if exists (select 1 from training_termine where training_id = p_training) then
    raise exception 'TRAINING_SCHON_EINGEPLANT';
  end if;

  update training_termine set training_id = p_training where id = p_termin;
  update trainings set termin_training = true where id = p_training;
  return jsonb_build_object('bisher', v_termin.training_id);
end;
$$;

-- ── Funktionen: Konto ───────────────────────────────────────────────────────

-- Vorschau für den Dialog «Konto löschen» (AK 12, 13), nur lesend, eigenes
-- Konto. `verein` bei letzte_verwaltung und einzige_person, `teams` und
-- `spieler` nur bei einzige_person (sonst 0). Nennt keine Teamnamen.
--   {fall: 'frei'|'letzte_verwaltung'|'einzige_person', verein, teams, spieler}
create function konto_loeschen_info() returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verein uuid;
  v_fall text;
begin
  perform nur_in_der_anwendung();
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_verein := person_verein(v_uid);
  v_fall := konto_loeschen_fall(v_uid, v_verein);
  return jsonb_build_object(
    'fall', v_fall,
    'verein', case when v_fall <> 'frei' then (select name from vereine where id = v_verein) end,
    'teams', case when v_fall = 'einzige_person' then (select count(*) from teams where verein_id = v_verein) else 0 end,
    'spieler', case when v_fall = 'einzige_person' then (select count(*) from spieler where verein_id = v_verein) else 0 end);
end;
$$;

-- Rumpf wie in 20261113100000_vereine_fundament.sql; neu der Zweig der
-- einzigen Person (AK 12, 14, PC 3): Sperren Verein → Person → Teams, dann
-- unter ihnen Zugehörige und Namen prüfen; mit richtigem Namen geht der
-- Verein samt allem mit, danach der unveränderte Rest. Die letzte
-- Verwaltung eines Vereins mit weiteren Personen löscht nichts, ebenso wer
-- mit Vereinsnamen kommt und nicht mehr einzige Person ist. Das Auth-Konto
-- löscht wie bisher die Action über die Admin-API.
--   {status: 'letzte_verwaltung'}                                   weitere Personen im Verein, nichts gelöscht
--   {status: 'verein_bestaetigen', verein, teams, spieler}         einzige Person ohne Namen, nichts gelöscht
--   {status: 'vereinsname_falsch', name}                           einzige Person, Name falsch, nichts gelöscht
--   {status: 'geloescht', bilder: [{id, bild_url}]}                bilder leer ohne mitgelöschten Verein
drop function delete_account();
create function delete_account(p_vereinsname text default null) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verein uuid;
  v_fall text;
  v_name text;
  v_bilder jsonb := '[]'::jsonb;
begin
  perform nur_in_der_anwendung();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Erst sperren, dann lesen: Der Verein der Person (Verwaltung oder Team)
  -- ist nur der Kandidat für die Vereinssperre. Unter beiden Sperren zählt
  -- die Verwaltungszeile; kam sie seither in einem anderen Verein dazu, bricht
  -- die RPC ab, statt durchzulaufen und am FK `restrict` zu scheitern.
  v_verein := person_verein(v_uid);
  if v_verein is not null then
    perform sperre_verein(v_verein);
  end if;
  perform sperre_person(v_uid);                                   -- nach dem Verein (Sperrordnung)
  if exists (select 1 from verein_verwaltung where user_id = v_uid
              and verein_id is distinct from v_verein) then
    raise exception 'VERWALTUNG_GEAENDERT';
  end if;
  v_fall := konto_loeschen_fall(v_uid, v_verein);
  -- Ein Vereinsname kommt nur aus der Vorschau der einzigen Person. Ist sie
  -- es nicht mehr (inzwischen eine weitere Person, auch in der Verwaltung),
  -- bleibt alles unverändert (AK 14).
  if v_fall = 'letzte_verwaltung'
     or (p_vereinsname is not null and v_verein is not null and v_fall <> 'einzige_person') then
    return jsonb_build_object('status', 'letzte_verwaltung');    -- bevor irgendetwas gelöscht ist
  end if;
  if v_fall = 'einzige_person' then
    perform sperre_teams(array(select id from teams where verein_id = v_verein));
    v_name := (select name from vereine where id = v_verein);
    if p_vereinsname is null then
      return jsonb_build_object('status', 'verein_bestaetigen', 'verein', v_name,
                                'teams', (select count(*) from teams where verein_id = v_verein),
                                'spieler', (select count(*) from spieler where verein_id = v_verein));
    end if;
    if not namen_stimmen(p_vereinsname, v_name) then
      return jsonb_build_object('status', 'vereinsname_falsch', 'name', v_name);
    end if;
    v_bilder := verein_loeschen_kern(v_verein);
  else
    delete from verein_verwaltung where verein_id = v_verein and user_id = v_uid;
  end if;

  delete from termin_trainer tr using training_termine t
   where tr.termin_id = t.id and tr.user_id = v_uid and t.datum >= heute_am_trainingsort();
  delete from termin_serien_trainer where user_id = v_uid;
  update termin_trainer set user_id = null where user_id = v_uid;
  -- Die alten Tabellen bis zu ihrem Wegfall ebenso.
  delete from termin_verantwortliche v using training_termine t
   where v.termin_id = t.id and v.user_id = v_uid and t.datum >= heute_am_trainingsort();
  delete from termin_serien_verantwortliche where user_id = v_uid;
  update termin_verantwortliche set user_id = null where user_id = v_uid;

  delete from exercise_favorites where user_id = v_uid;

  update exercises set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from exercises where owner_id = v_uid and visibility = 'private';

  update trainings set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from trainings where owner_id = v_uid;
  return jsonb_build_object('status', 'geloescht', 'bilder', v_bilder);
end;
$$;

-- ── Funktionen: ohne Konto ──────────────────────────────────────────────────

-- Rumpf wie in 20261016140000_selbstabholung.sql; dazu der Verein, der für
-- die Daten der Spieler:in verantwortlich ist (PC 2). Sonst nichts (AK 18).
--   {gueltig: true, team, verein} | {gueltig: false}
create or replace function abholung_ansicht(p_token text) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select jsonb_build_object('gueltig', true, 'team', t.name, 'verein', v.name)
       from team_abholung a join teams t on t.id = a.team_id
       left join vereine v on v.id = t.verein_id
      where a.token = p_token and a.aktiv),
    jsonb_build_object('gueltig', false));
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function namen_ohne_rand(text) from public, anon, authenticated;
revoke all on function namen_stimmen(text, text) from public, anon, authenticated;
revoke all on function verein_personenzahl(uuid) from public, anon, authenticated;
revoke all on function konto_loeschen_fall(uuid, uuid) from public, anon, authenticated;
revoke all on function verein_loeschen_kern(uuid) from public, anon, authenticated;

revoke all on function verein_gruenden(text, boolean) from public, anon;
grant execute on function verein_gruenden(text, boolean) to authenticated;
revoke all on function verein_loeschen(uuid, text) from public, anon;
grant execute on function verein_loeschen(uuid, text) to authenticated;
revoke all on function konto_loeschen_info() from public, anon;
grant execute on function konto_loeschen_info() to authenticated;
revoke all on function delete_account(text) from public, anon;
grant execute on function delete_account(text) to authenticated;

reset lock_timeout;
