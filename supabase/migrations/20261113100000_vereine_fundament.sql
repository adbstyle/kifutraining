-- Vereine, Fundament (Story 1 #577, Epic #575; Architekturplan Vereine §3.1,
-- §4.1, §6.3).
--
-- Jedes Team gehört einem Verein. Vereine, ihre Verwaltung und die Zuordnung
-- von Spieler:innen zu Teams (`team_spieler`) entstehen hier; alle bestehenden
-- Teams kommen in den Verein «FC Wyler» (`vereine_nachziehen`, am Ende der
-- Datei). Die Zugehörigkeit einer Person zu einem Verein ist abgeleitet
-- (Teammitglied oder Verwaltung); «höchstens ein Verein je Person» sichern
-- Trigger unter Vereins- und Personensperre.
--
-- Expand: keine neue Regel als CHECK oder NOT NULL auf bestehenden Tabellen
-- (der Sync lädt bis zum Release Prod-Dumps ohne die neuen Spalten unter
-- `replica`, AP §6.1). `teams.verein_id` und `spieler.verein_id` halten bis N1
-- die Trigger mit `VEREIN_FEHLT`. Lesepfade über `team_spieler`, die
-- Teamgrenze 100 und die Vereinsgrenze 1000 folgen in
-- `20261113110000_spieler_ueber_zuordnung.sql`, also erst nach dem Backfill.
--
-- Sperrordnung (AP §4.1): Verein → Person → Teams aufsteigend → `spieler`-
-- Zeile → Termin-Zeile.

set lock_timeout = '5s';

-- ── Tabellen ────────────────────────────────────────────────────────────────

create table vereine (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Zwilling: VEREIN_NAME_MAX, vereinsNameProblem() in web/lib/verein.ts
  constraint verein_name check (name = btrim(name) and char_length(name) between 1 and 60)
);

create table verein_verwaltung (
  verein_id uuid not null references vereine(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete restrict,   -- bewusst restrict (AP §8 L3)
  created_at timestamptz not null default now(),
  primary key (verein_id, user_id)
);
create index verein_verwaltung_user_idx on verein_verwaltung (user_id);

-- ── Spalten ─────────────────────────────────────────────────────────────────

alter table teams add column verein_id uuid references vereine(id) on delete restrict;
create index teams_verein_idx on teams (verein_id);
alter table teams add constraint teams_id_verein_uk unique (id, verein_id);

alter table spieler add column verein_id uuid references vereine(id) on delete restrict;
create index spieler_verein_idx on spieler (verein_id);
alter table spieler add constraint spieler_id_verein_uk unique (id, verein_id);

-- Die Zuordnung einer Spieler:in zu einem Team. Beide FKs tragen den Verein
-- mit: Eine Zuordnung über Vereinsgrenzen kann es nicht geben. Der Name
-- `tsp_spieler` ist Vertrag mit dem Web (PostgREST-Embed `spieler!tsp_spieler`).
create table team_spieler (
  team_id    uuid not null,
  spieler_id uuid not null,
  verein_id  uuid not null,
  probe_seit timestamptz,                 -- Schnuppern je Zuordnung (AP §3.3 f); DB-Name bleibt intern
  created_at timestamptz not null default now(),
  primary key (team_id, spieler_id),
  constraint tsp_team    foreign key (team_id, verein_id)    references teams  (id, verein_id) on delete cascade,
  constraint tsp_spieler foreign key (spieler_id, verein_id) references spieler(id, verein_id) on delete cascade
);
create index team_spieler_spieler_idx on team_spieler (spieler_id);

-- ── Funktionen ──────────────────────────────────────────────────────────────

-- Verein der Person: aus der Verwaltung oder über ihre Teams, sonst null.
-- Verletzt jemand die Invariante «höchstens ein Verein», bricht die skalare
-- Unterabfrage laut ab, statt still einen zu wählen.
create function person_verein(p_user uuid) returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select (select distinct z.verein_id from (
            select w.verein_id from verein_verwaltung w where w.user_id = p_user
            union
            select t.verein_id from team_members m join teams t on t.id = m.team_id
             where m.user_id = p_user) z
           where z.verein_id is not null);
$$;

create function mein_verein() returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$ select person_verein(auth.uid()); $$;

create function ist_verein_mitglied(p_verein uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select p_verein is not null and coalesce(mein_verein() = p_verein, false); $$;

create function ist_verein_verwaltung(p_verein uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_verein is not null
     and exists (select 1 from verein_verwaltung where verein_id = p_verein and user_id = auth.uid());
$$;

-- Sperren der Sperrordnung (AP §4.1). Ohne Verein `VEREIN_FEHLT` (bis N1 ist
-- `verein_id` nullable); ohne Person oder Team ein Programmierfehler.
create function sperre_verein(p_verein uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_verein is null then raise exception 'VEREIN_FEHLT'; end if;
  perform pg_advisory_xact_lock(hashtextextended('verein:' || p_verein::text, 0));
end;
$$;

create function sperre_person(p_user uuid) returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_user is null then raise exception 'sperre_person: Person fehlt'; end if;
  perform pg_advisory_xact_lock(hashtextextended('person:' || p_user::text, 0));
end;
$$;

-- Teamsperren aufsteigend nach UUID, bestehender Schlüssel 'spieler:'‖team
-- (wie kader_vorher, abmeldung_anwenden_training usw.).
create function sperre_teams(p_teams uuid[]) returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  if array_position(p_teams, null) is not null then raise exception 'sperre_teams: Team fehlt'; end if;
  for v_team in select distinct x from unnest(p_teams) x order by x loop
    perform pg_advisory_xact_lock(hashtextextended('spieler:' || v_team::text, 0));
  end loop;
end;
$$;

-- Ein OAuth-Token eines KI-Clients trägt den Claim `client_id`
-- (web/lib/supabase/bearer.ts), eine Browser-Sitzung nicht (AP §4.1).
create function nur_in_der_anwendung() returns void
language plpgsql stable
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.jwt() ? 'client_id', false) then raise exception 'NUR_IN_DER_ANWENDUNG'; end if;
end;
$$;

-- Trigger: Ab Story 1 entsteht kein Team ohne Verein; höchstens 30 je Verein.
-- Zwilling: VEREIN_TEAMS_MAX in web/lib/verein.ts.
create function teams_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.verein_id is null then raise exception 'VEREIN_FEHLT'; end if;
  perform sperre_verein(new.verein_id);
  if (select count(*) from teams where verein_id = new.verein_id) >= 30 then
    raise exception 'VEREIN_TEAMS_VOLL';
  end if;
  return new;
end;
$$;

-- Ein Team wechselt nie den Verein (Epic OoS 4); nur NULL → Wert (Backfill).
create function teams_verein_fest() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.verein_id is not null and new.verein_id is distinct from old.verein_id then
    raise exception 'VEREIN_FEST';
  end if;
  return new;
end;
$$;

-- Jeder Weg ins Team (create_team, add_team_member, …): höchstens ein Verein
-- je Person. Die Zugehörigkeit erst nach der Personensperre lesen.
create function team_members_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_verein uuid := (select verein_id from teams where id = new.team_id);
  v_bisher uuid;
begin
  if v_verein is null then raise exception 'VEREIN_FEHLT'; end if;
  perform sperre_verein(v_verein);
  perform sperre_person(new.user_id);
  v_bisher := person_verein(new.user_id);
  if v_bisher is not null and v_bisher <> v_verein then raise exception 'ANDERER_VEREIN'; end if;
  return new;
end;
$$;

-- Verwaltung: Aufnahme nur ohne anderen Verein; die letzte Person bleibt,
-- solange der Verein besteht (beim Kaskadieren aus `delete from vereine` ist
-- er weg, Muster spieler_vorher).
create function verwaltung_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bisher uuid;
begin
  if tg_op = 'INSERT' then
    perform sperre_verein(new.verein_id);
    perform sperre_person(new.user_id);
    v_bisher := person_verein(new.user_id);
    if v_bisher is not null and v_bisher <> new.verein_id then raise exception 'ANDERER_VEREIN'; end if;
    return new;
  end if;
  if not exists (select 1 from vereine where id = old.verein_id) then return old; end if;
  perform sperre_verein(old.verein_id);
  if not exists (select 1 from verein_verwaltung
                  where verein_id = old.verein_id and user_id <> old.user_id) then
    raise exception 'LETZTE_VERWALTUNG';
  end if;
  return old;
end;
$$;

-- Rumpf wie in 20260824200312_team_rpcs.sql; Team nur durch die Verwaltung,
-- im eigenen Verein. Signatur bleibt; die Mitgliedschaft entsteht bis Story 5
-- noch mit (AP §3.1), danach ersetzt verein_team_anlegen die Funktion.
create or replace function create_team(p_name text) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verein uuid;
  v_team uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_verein := person_verein(v_uid);
  if not ist_verein_verwaltung(v_verein) then raise exception 'TEAM_NUR_VERWALTUNG'; end if;
  if coalesce(btrim(p_name), '') = '' or char_length(btrim(p_name)) > 60 then
    raise exception 'TEAMNAME_UNGUELTIG';
  end if;
  insert into teams (name, verein_id) values (btrim(p_name), v_verein) returning id into v_team;
  insert into team_members (team_id, user_id) values (v_team, v_uid);
  return v_team;
end;
$$;

-- Rumpf wie in 20261025100000_trainer_einladen.sql; neu mit Verwaltungs-
-- prüfung vor jedem Löschen und Rückgabe jsonb (AP §3.4, Fassung ohne den
-- Zweig der einzigen Person, der mit Story 11 kommt).
--   {status: 'letzte_verwaltung'}  nichts gelöscht
--   {status: 'geloescht'}
drop function delete_account();
create function delete_account() returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verein uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  perform nur_in_der_anwendung();

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
  if not exists (select 1 from verein_verwaltung where user_id = v_uid) then
    v_verein := null;                                             -- Teammitglied ohne Verwaltung
  end if;
  if v_verein is not null then
    if not exists (select 1 from verein_verwaltung where verein_id = v_verein and user_id <> v_uid) then
      return jsonb_build_object('status', 'letzte_verwaltung');  -- bevor irgendetwas gelöscht ist
    end if;
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
  return jsonb_build_object('status', 'geloescht');
end;
$$;

-- Lage der aufrufenden Person (AP §4.3): Seitenleiste, /teams, Hinweise.
--   {verein: {id, name, ist_verwaltung, ist_teammitglied} | null, grenzen: null}
-- `grenzen` füllt erst Story 12. Liest team_members und verein_verwaltung
-- direkt statt über die Prädikate (Ortsprüfung, AP §5.5). Ohne
-- nur_in_der_anwendung: der KI-Hinweis braucht sie (Story 13 AK 10).
create function meine_vereinslage() returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verein uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_verein := person_verein(v_uid);
  if v_verein is null then
    return jsonb_build_object('verein', null, 'grenzen', null);
  end if;
  return jsonb_build_object(
    'verein', (select jsonb_build_object(
                 'id', v.id, 'name', v.name,
                 'ist_verwaltung', exists (select 1 from verein_verwaltung w
                                            where w.verein_id = v.id and w.user_id = v_uid),
                 'ist_teammitglied', exists (select 1 from team_members m join teams t on t.id = m.team_id
                                              where t.verein_id = v.id and m.user_id = v_uid))
                 from vereine v where v.id = v_verein),
    'grenzen', null);
end;
$$;

-- Backfill «FC Wyler» (AP §6.3): idempotent und nur ergänzend. Läuft hier
-- einmal und auf Staging nach jedem Sync aus Prod (staging_nach_sync). Ohne
-- bestätigtes Konto `p_verwaltung` (lokal, CI) entsteht der Verein ohne
-- Verwaltung; lokal hilft ein Insert per SQL. Fällt mit N1 (AP §3.8).
create function vereine_nachziehen(
  p_verwaltung uuid default '00000000-0000-0000-0000-000000000000'::uuid  -- KONTO_ID_PLATZHALTER
) returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  c_verein constant uuid := '84ac2405-a95a-4cbf-bac8-aaea32bc2292';   -- wiederholbar ohne Duplikat
begin
  if exists (select 1 from teams where verein_id is null) then
    insert into vereine (id, name) values (c_verein, 'FC Wyler') on conflict (id) do nothing;
    update teams set verein_id = c_verein where verein_id is null;     -- teams_verein_fest: NULL → Wert erlaubt
  end if;
  update spieler s set verein_id = t.verein_id     -- Altdubletten bleiben getrennt
    from teams t where t.id = s.team_id and s.verein_id is null;
  insert into team_spieler (team_id, spieler_id, verein_id, probe_seit)
  select s.team_id, s.id, s.verein_id, s.probe_seit from spieler s where s.team_id is not null
  on conflict (team_id, spieler_id) do nothing;
  if p_verwaltung is not null
     and exists (select 1 from vereine where id = c_verein)
     and not exists (select 1 from verein_verwaltung where verein_id = c_verein)
     and exists (select 1 from auth.users where id = p_verwaltung and email_confirmed_at is not null) then
    insert into verein_verwaltung (verein_id, user_id) values (c_verein, p_verwaltung) on conflict do nothing;
  end if;
  -- Zusicherung: die Datei bricht ab, statt einen halben Stand zu hinterlassen.
  if exists (select 1 from spieler s where s.team_id is not null and not exists
               (select 1 from team_spieler ts where ts.spieler_id = s.id and ts.team_id = s.team_id)) then
    raise exception 'BACKFILL_UNVOLLSTAENDIG';
  end if;
end;
$$;

-- Aufruf aus supabase/sync/nach_restore.sql (Vertrag dort): unter `replica`,
-- `search_path` leer, Meldungen als warning. Zieht nur nach, solange Teams
-- ohne Verein da sind (Prod-Dump vor dem Release). Fällt mit N1.
create function staging_nach_sync() returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.teams where verein_id is null) then
    raise warning 'staging_nach_sync: vereine_nachziehen()';
    perform public.vereine_nachziehen();
  end if;
end;
$$;

-- ── Policies ────────────────────────────────────────────────────────────────

alter table vereine           enable row level security;
alter table verein_verwaltung enable row level security;   -- keine Policy: nur RPC
alter table team_spieler      enable row level security;
-- Ohne Verwaltungsklausel (Rollen nach Ort, AP §4.2).
create policy ve_select  on vereine      for select to authenticated using (ist_verein_mitglied(id));
create policy tsp_select on team_spieler for select to authenticated using (ist_team_mitglied(team_id));

-- ── Trigger ─────────────────────────────────────────────────────────────────

create trigger vereine_set_updated_at before update on vereine
  for each row execute function set_updated_at();
create trigger teams_vorher before insert on teams
  for each row execute function teams_vorher();
create trigger teams_verein_fest before update of verein_id on teams
  for each row execute function teams_verein_fest();
create trigger team_members_vorher before insert on team_members
  for each row execute function team_members_vorher();
create trigger verwaltung_vorher before insert or delete on verein_verwaltung
  for each row execute function verwaltung_vorher();

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on vereine, verein_verwaltung, team_spieler from anon, authenticated;
grant select on vereine, team_spieler to authenticated;            -- Schreiben nur per RPC
grant select (verein_id) on spieler to authenticated;              -- spieler hat nur Spalten-Grants

-- Funktionen ohne API-Zweck: EXECUTE geht per Default an PUBLIC und (Default-
-- Privileges) an anon/authenticated, darum ausdrücklich entziehen.
revoke all on function person_verein(uuid) from public, anon, authenticated;
revoke all on function sperre_verein(uuid) from public, anon, authenticated;
revoke all on function sperre_person(uuid) from public, anon, authenticated;
revoke all on function sperre_teams(uuid[]) from public, anon, authenticated;
revoke all on function nur_in_der_anwendung() from public, anon, authenticated;
revoke all on function teams_vorher() from public, anon, authenticated;
revoke all on function teams_verein_fest() from public, anon, authenticated;
revoke all on function team_members_vorher() from public, anon, authenticated;
revoke all on function verwaltung_vorher() from public, anon, authenticated;
revoke all on function vereine_nachziehen(uuid) from public, anon, authenticated;
revoke all on function staging_nach_sync() from public, anon, authenticated;

-- Prädikate (Policy und RPCs), nicht für anon.
revoke all on function mein_verein() from public, anon;
revoke all on function ist_verein_mitglied(uuid) from public, anon;
revoke all on function ist_verein_verwaltung(uuid) from public, anon;
grant execute on function mein_verein() to authenticated;
grant execute on function ist_verein_mitglied(uuid) to authenticated;
grant execute on function ist_verein_verwaltung(uuid) to authenticated;

revoke all on function create_team(text) from public, anon;
grant execute on function create_team(text) to authenticated;
revoke all on function delete_account() from public, anon;
grant execute on function delete_account() to authenticated;
revoke all on function meine_vereinslage() from public, anon;
grant execute on function meine_vereinslage() to authenticated;

-- ── Backfill ────────────────────────────────────────────────────────────────

select vereine_nachziehen();

reset lock_timeout;
