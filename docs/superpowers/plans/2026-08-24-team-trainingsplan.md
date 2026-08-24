# Team-Trainingsplan Implementation Plan (Kopie-Modell)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trainerteams planen gemeinsam: Trainings gehören einer Person ODER einem Team, ins Team/an jeden Termin/in die Bibliothek kommt je eine eigenständige Kopie, und der Team-Trainingsplan zeigt die Termine chronologisch.

**Architecture:** Drei neue Tabellen (`teams`, `team_members`, `training_termine`) plus `profiles`; `trainings` erhält `team_id` (XOR-artig zu `owner_id`), eine Trainings-Herkunft und den Vorlagen-Link `vorlage_id`. Es gibt KEINEN Teilen-Zustand: ein zentraler TS-Baustein `kopiereTraining()` bedient alle fünf Kopierwege (ins Team, zu mir, je Termin, Vorlage übernehmen, veröffentlichen). Veröffentlichen erzeugt eine eingefrorene öffentliche Vorlagen-Kopie — das Einfrieren erzwingt die RLS konstruktiv (keine Update-Policy für öffentliche Zeilen), womit der bisherige Auto-Privatisierungs-Trigger entfällt. Termine hängen 1:1 an Team-Trainings (UNIQUE), erneutes Ansetzen kopiert automatisch.

**Tech Stack:** Next.js 15 (RSC + Server Actions), Supabase (Postgres RLS, SECURITY-DEFINER-RPCs, Storage), TypeScript.

**Grundlagen:** Epic (revidiert 2026-08-24) `docs/superpowers/specs/2026-08-16-team-trainingsplan-epic.md`; alle 14 Stories final in `2026-08-16-team-trainingsplan-stories.md`. Der frühere Plan (PR #96) basierte auf dem verworfenen Teilen-Modell — nicht wiederverwenden.

## Global Constraints

- Projektsprache Deutsch: Code-Kommentare, Commit-Messages, UI-Texte (CLAUDE.md).
- Forward-only: echte Nutzer, keine destruktiven Migrationen; Verschärfungen via Backfill bzw. `NOT VALID` (CLAUDE.md).
- Supabase server-only: keine `NEXT_PUBLIC_*`-Variablen; Clients via `web/lib/supabase/server.ts` bzw. `admin.ts`.
- RLS + RPC: mehrstufige Mutationen als `SECURITY DEFINER`-RPC mit Auth-/Owner-Check als erster Anweisung.
- Styleguide-first: neue UI-Elemente aus `web/components/ui`; Neues begründen und im Styleguide ergänzen.
- E-Mail-Adressen von Mitgliedern sind nie auslesbar (Story-1-NFR 4) — nirgends selektieren oder zurückgeben.
- Kopier-NFR: jeder Trainings-Kopierweg < 10 s auch mit vielen Übungen/Bildern; Team-Trainingsplan < 1 s bei 100 Terminen.
- Pro Teil ein PR auf `develop`; **Prod-Merge (develop→main) nur mit expliziter Freigabe des Users**.
- Nach jedem Migrations-Task: `npm run gen:types` (web/), dann `npm run typecheck`; UI-Tasks zusätzlich Browser-E2E (Dev-Server via `preview_start`, User `e2e@test.local`/`Test1234!` via Admin-API, Befehl in CLAUDE.md). Datenebene-Checks per `docker exec -i supabase_db_kifu psql -q -U postgres -d postgres -v ON_ERROR_STOP=1`.
- Neue public-Tabellen in `PUBLIC_TABLES` von `.github/workflows/sync-staging.yml` nachführen (Guard bricht sonst).

**Bewusster Bestandsübergang (Story 1 PC 5, PO 2026-08-24):** Mit Teil A werden die bestehenden öffentlichen Trainings zu eingefrorenen Vorlagen — ihre Eigentümer können sie nicht mehr direkt bearbeiten (nur zurückziehen oder Kopie bearbeiten und neu veröffentlichen). Das ist die einzige Verhaltensänderung am Bestand und tritt mit dem Teil-A-Release ein.

**Rollout in fünf PRs:**
- **Teil A — Fundament & Vorlagen-Modell** (Stories 1, 14): Schema, RLS mit konstruktivem Einfrieren, `kopiereTraining`, Publish v3 (Kopie/Ersetzen/Zurückziehen).
- **Teil B — Teams & Mitglieder** (Stories 2-UI, 3, 4, 13): Konto-Anzeigename, Teams-Bereich, Aufnahme mit Vorschau, Verlassen/Entfernen/Auflösen.
- **Teil C — Team-Trainings** (Stories 5, 6): ins Team stellen / zu mir übernehmen / entfernen; Editor für Mitglieder.
- **Teil D — Termine & Plan** (Stories 7, 8, 9): Terminieren, Team-Trainingsplan, Auto-Kopie beim erneuten Ansetzen.
- **Teil E — Bibliothek & Urheber** (Stories 11, 12, 15): Vorlage übernehmen, Übersicht/Navigation, Urheber-Anzeige.

---

## Teil A — Fundament & Vorlagen-Modell (PR 1: Stories 1 + 14)

### Task A1: Migration — Datenmodell, RLS, Einfrieren, Anzeigename

**Files:**
- Create: `supabase/migrations/<timestamp>_team_datenmodell.sql`

**Interfaces:**
- Produces: Tabellen `teams`, `team_members`, `training_termine`, `profiles`; Spalten `trainings.team_id/herkunft_name/herkunft_datum/vorlage_id`; SQL-Funktionen `ist_team_mitglied(uuid)→boolean`, `anzeige_name(uuid)→text`, `urheber(trainings)→text` (berechnetes PostgREST-Feld); Trigger `team_aufloesen_wenn_leer`, `termin_nur_fuer_team_trainings`.

- [ ] **Step 1: Migration schreiben** (`npx supabase migration new team_datenmodell --workdir ..` aus `web/`):

```sql
-- ============================================================================
-- Team-Trainingsplan (Epic 2026-08-16, revidiert 2026-08-24, Kopie-Modell):
-- Story 1 — Teams, Mitgliedschaft, Team-Eigentum, Termine, Anzeigename.
-- Ein Training gehört einer Person ODER einem Team; geteilt wird nie, kopiert
-- immer (dasselbe Paradigma wie die Übungsbibliothek).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Teams und gleichberechtigte Mitgliedschaft (AK 1–6)
-- ----------------------------------------------------------------------------
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(btrim(name)) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on team_members (user_id);

-- ----------------------------------------------------------------------------
-- 2) Trainings: Team-Eigentum, Herkunft, Vorlagen-Link (AK 7, 11, 20)
-- ----------------------------------------------------------------------------
alter table trainings
  add column team_id uuid references teams(id) on delete cascade,
  -- Herkunft der Kopie: nur Name des Ursprungs + Zeitpunkt, ohne Person
  -- (dasselbe Muster wie die Übungs-Fassungen; Ur-Herkunft bleibt bei Ketten).
  add column herkunft_name text,
  add column herkunft_datum timestamptz,
  -- Je persönlichem Training höchstens eine aktive Vorlage (Story 14 AK 3):
  -- der Link zeigt vom PERSÖNLICHEN Training auf seine veröffentlichte Kopie.
  add column vorlage_id uuid references trainings(id) on delete set null;

-- Nie Person UND Team zugleich; beide NULL = anonymisierte Vorlage (Bestand).
alter table trainings add constraint tr_ein_eigentuemer
  check (owner_id is null or team_id is null);
-- Team-Trainings sind nie öffentlich (AK 9): öffentlich sind nur Vorlagen.
alter table trainings add constraint tr_team_nie_public
  check (team_id is null or visibility = 'private');
alter table trainings add constraint tr_herkunft_vollstaendig
  check ((herkunft_name is null) = (herkunft_datum is null));

-- ----------------------------------------------------------------------------
-- 3) Termine: 1:1 an Team-Trainings (AK 12–19)
-- ----------------------------------------------------------------------------
create table training_termine (
  id uuid primary key default gen_random_uuid(),
  -- UNIQUE = höchstens ein Termin je Training (AK 15); je Termin eine eigene
  -- Trainings-Kopie, das erneute Ansetzen kopiert (Story 8).
  training_id uuid not null unique references trainings(id) on delete cascade,
  -- Zeit am Trainingsort (AK 17): bewusst date/time OHNE Zeitzone.
  datum date not null,
  beginn time,
  ort text,
  bemerkung text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_termine_plan_idx on training_termine (datum, beginn nulls last);

-- Termine gibt es nur für Team-Trainings (Epic Out of Scope 3).
create function termin_nur_fuer_team_trainings() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from trainings t
                 where t.id = new.training_id and t.team_id is not null) then
    raise exception 'TERMIN_NUR_FUER_TEAM_TRAININGS';
  end if;
  return new;
end;
$$;
create trigger termin_nur_fuer_team_trainings
  before insert or update of training_id on training_termine
  for each row execute function termin_nur_fuer_team_trainings();

-- ----------------------------------------------------------------------------
-- 4) Anzeigename (Story 2, Datenebene)
-- ----------------------------------------------------------------------------
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
    check (btrim(display_name) <> '' and char_length(btrim(display_name)) <= 40),
  updated_at timestamptz not null default now()
);

-- Auto-Name aus der User-ID, nie aus der E-Mail (NFR 4); je Konto verschieden.
create function anzeige_name(p_user uuid) returns text
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select display_name from profiles where user_id = p_user),
    'Trainer:in ' || left(md5(p_user::text), 4)
  );
$$;

-- Berechnetes PostgREST-Feld: `select=...,urheber` an trainings (Story 15).
create function urheber(t trainings) returns text
language sql stable
set search_path = public, pg_temp
as $$
  select case when t.owner_id is null then null else anzeige_name(t.owner_id) end;
$$;

-- ----------------------------------------------------------------------------
-- 5) RLS
-- ----------------------------------------------------------------------------
-- Rekursionsfalle: eine team_members-Policy, die team_members abfragt,
-- rekursiert in Postgres — darum eine SECURITY-DEFINER-Prüf-Funktion.
create function ist_team_mitglied(p_team uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_team is not null and exists (
    select 1 from team_members where team_id = p_team and user_id = auth.uid());
$$;
revoke all on function ist_team_mitglied(uuid) from public, anon;
grant execute on function ist_team_mitglied(uuid) to authenticated;

alter table teams enable row level security;
alter table team_members enable row level security;
alter table training_termine enable row level security;
alter table profiles enable row level security;

create policy teams_select on teams for select to authenticated
  using (ist_team_mitglied(id));
create policy teams_update on teams for update to authenticated
  using (ist_team_mitglied(id)) with check (ist_team_mitglied(id));
create policy teams_delete on teams for delete to authenticated
  using (ist_team_mitglied(id));
-- INSERT nur via RPC create_team (atomar mit erster Mitgliedschaft).

create policy tm_select on team_members for select to authenticated
  using (ist_team_mitglied(team_id));
create policy tm_delete on team_members for delete to authenticated
  using (ist_team_mitglied(team_id));
-- INSERT nur via RPC add_team_member (E-Mail-Auflösung braucht definer).

create policy tt_select on training_termine for select to authenticated
  using (exists (select 1 from trainings t
                 where t.id = training_id and ist_team_mitglied(t.team_id)));
create policy tt_insert on training_termine for insert to authenticated
  with check (exists (select 1 from trainings t
                      where t.id = training_id and ist_team_mitglied(t.team_id)));
create policy tt_update on training_termine for update to authenticated
  using (exists (select 1 from trainings t
                 where t.id = training_id and ist_team_mitglied(t.team_id)));
create policy tt_delete on training_termine for delete to authenticated
  using (exists (select 1 from trainings t
                 where t.id = training_id and ist_team_mitglied(t.team_id)));

create policy pr_select on profiles for select using (true);
create policy pr_insert on profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy pr_update on profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Trainings-Policies neu: Vorlagen sind KONSTRUKTIV eingefroren — es gibt
-- schlicht keine Update-Policy für öffentliche Zeilen. Bearbeitbar sind nur
-- private persönliche Trainings (Eigentümer) und Team-Trainings (Mitglieder).
drop policy tr_select on trainings;
create policy tr_select on trainings for select
  using (visibility = 'public' or owner_id = auth.uid() or ist_team_mitglied(team_id));
drop policy tr_update on trainings;
create policy tr_update on trainings for update
  using ((owner_id = auth.uid() and visibility = 'private') or ist_team_mitglied(team_id))
  with check ((owner_id = auth.uid() and visibility = 'private') or ist_team_mitglied(team_id));
drop policy tr_delete on trainings;
-- Löschen: Eigentümer (persönlich UND Vorlage-zurückziehen) oder Team-Mitglied.
create policy tr_delete on trainings for delete
  using (owner_id = auth.uid() or ist_team_mitglied(team_id));
drop policy tr_insert on trainings;
create policy tr_insert on trainings for insert
  with check (owner_id = auth.uid() or ist_team_mitglied(team_id));

-- training_exercises erben die neue Logik.
drop policy te_select on training_exercises;
create policy te_select on training_exercises for select
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.visibility = 'public' or p.owner_id = auth.uid()
                        or ist_team_mitglied(p.team_id))));
drop policy te_insert on training_exercises;
create policy te_insert on training_exercises for insert
  with check (exists (select 1 from trainings p
                      where p.id = training_id
                        and ((p.owner_id = auth.uid() and p.visibility = 'private')
                             or ist_team_mitglied(p.team_id))));
drop policy te_update on training_exercises;
create policy te_update on training_exercises for update
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and ((p.owner_id = auth.uid() and p.visibility = 'private')
                        or ist_team_mitglied(p.team_id))));
drop policy te_delete on training_exercises;
create policy te_delete on training_exercises for delete
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and ((p.owner_id = auth.uid() and p.visibility = 'private')
                        or ist_team_mitglied(p.team_id))));

-- Storage: Team-Bilder liegen unter team/<team_id>/<te_id>.<ext>, damit jedes
-- Mitglied sie ersetzen kann (Story 6 NFR 2); user/<uid>/ bleibt persönlich.
create policy "exercise_images_team_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = 'team'
    and ist_team_mitglied(((storage.foldername(name))[2])::uuid)
  );
create policy "exercise_images_team_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = 'team'
    and ist_team_mitglied(((storage.foldername(name))[2])::uuid)
  );
create policy "exercise_images_team_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = 'team'
    and ist_team_mitglied(((storage.foldername(name))[2])::uuid)
  );

-- ----------------------------------------------------------------------------
-- 6) Ein Team ohne Mitglieder besteht nicht fort (AK 6)
-- ----------------------------------------------------------------------------
create function team_aufloesen_wenn_leer() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from team_members where team_id = old.team_id) then
    delete from teams where id = old.team_id;  -- kaskadiert Trainings + Termine
  end if;
  return old;
end;
$$;
create trigger team_aufloesen_wenn_leer
  after delete on team_members
  for each row execute function team_aufloesen_wenn_leer();

-- ----------------------------------------------------------------------------
-- 7) Alte Publish-Mechanik entfällt (Story 14: Publish = Kopie)
-- ----------------------------------------------------------------------------
-- Auto-Privatisierung ist obsolet: public entsteht nur noch als komplette
-- Vorlagen-Kopie über das Publish-Gate; die fehlende Update-Policy friert ein.
drop trigger training_enforce_publishable_trg on trainings;
drop function training_enforce_publishable();
-- unpublish entfällt: Zurückziehen = DELETE der Vorlage durch den Urheber.
drop function unpublish_training(uuid);
drop function publish_training(uuid);

-- API-Grants (Gotcha 20260614120000: ohne Grants «permission denied»).
grant select, update, delete on teams to authenticated;
grant select, delete on team_members to authenticated;
grant select, insert, update, delete on training_termine to authenticated;
grant select on profiles to anon;
grant select, insert, update on profiles to authenticated;
```

- [ ] **Step 2:** `npm run db:reset` + `npm run seed` → grün; Policy-Zählung: `select count(*) from pg_policies where tablename in ('teams','team_members','training_termine','profiles')` → `11`.
- [ ] **Step 3:** Einfrieren-Probe (Bestandsübergang): als Testuser ein Training public setzen (direktes SQL), dann als derselbe User per PostgREST-Rolle `update trainings set name='X'` → 0 Zeilen betroffen (Policy greift); `delete` → erlaubt (Zurückziehen).
- [ ] **Step 4:** `gen:types` + `typecheck`; App-Code kompiliert noch nicht vollständig (publish-Aufrufe) — die Action wird in A3 umgebaut, darum A1–A3 in EINEM Commit-Zug halten oder publish-Action in diesem Task minimal auf «deaktiviert» stellen. **Vorgehen:** A1–A3 als ein zusammenhängender Commit nach A3.

### Task A2: RPCs — Team anlegen, Trainer finden, aufnehmen

**Files:**
- Create: `supabase/migrations/<timestamp>_team_rpcs.sql`

**Interfaces:**
- Produces: `create_team(p_name text) → uuid`; `finde_trainer(p_email text) → jsonb` (`{status:'gefunden', anzeige_name}` | `{status:'nicht_gefunden'}` | `{status:'bereits_mitglied'}` — mit `p_team_id` als Kontext); `add_team_member(p_team_id uuid, p_email text) → jsonb`; `team_mitglieder(p_team uuid) → jsonb` (`[{user_id, anzeige_name}]`, nie E-Mail); Tabelle `trainer_suchversuche` fürs Rate-Limit.

- [ ] **Step 1: Migration schreiben:**

```sql
-- Team + erste Mitgliedschaft atomar (Story 3 PC 2).
create function create_team(p_name text) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(btrim(p_name), '') = '' or char_length(btrim(p_name)) > 60 then
    raise exception 'TEAMNAME_UNGUELTIG';
  end if;
  insert into teams (name) values (btrim(p_name)) returning id into v_team;
  insert into team_members (team_id, user_id) values (v_team, v_uid);
  return v_team;
end;
$$;
revoke all on function create_team(text) from public, anon;
grant execute on function create_team(text) to authenticated;

-- Rate-Limit-Grundlage (Story 4 NFR 2): erfolglose Suchversuche je Konto.
create table trainer_suchversuche (
  user_id uuid not null references auth.users(id) on delete cascade,
  versucht_am timestamptz not null default now()
);
create index trainer_suchversuche_idx on trainer_suchversuche (user_id, versucht_am);
alter table trainer_suchversuche enable row level security;  -- kein Grant: nur definer-RPCs

-- Vorschau (Story 4 AK 2): Trainer per E-Mail finden, Anzeigename zurückgeben.
-- Bewusste, dokumentierte Ausnahme von der Anti-Enumeration-Linie — nur für
-- Team-Mitglieder, gebremst auf 10 erfolglose Versuche je Stunde.
create function finde_trainer(p_team_id uuid, p_email text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ziel uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team_id and user_id = v_uid) then
    raise exception 'not a member of this team';
  end if;
  if (select count(*) from trainer_suchversuche
      where user_id = v_uid and versucht_am > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'gebremst');
  end if;

  select id into v_ziel from auth.users
   where lower(email) = lower(btrim(p_email))
     and email_confirmed_at is not null   -- nur bestätigte Konten (Story 4)
   limit 1;
  if v_ziel is null then
    insert into trainer_suchversuche (user_id) values (v_uid);
    return jsonb_build_object('status', 'nicht_gefunden');
  end if;
  if exists (select 1 from team_members
             where team_id = p_team_id and user_id = v_ziel) then
    return jsonb_build_object('status', 'bereits_mitglied');
  end if;
  return jsonb_build_object('status', 'gefunden', 'anzeige_name', anzeige_name(v_ziel));
end;
$$;
revoke all on function finde_trainer(uuid, text) from public, anon;
grant execute on function finde_trainer(uuid, text) to authenticated;

-- Aufnahme nach Bestätigung (Story 4 AK 6); Doppel-Aufnahme wirkt einmalig.
create function add_team_member(p_team_id uuid, p_email text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ziel uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team_id and user_id = v_uid) then
    raise exception 'not a member of this team';
  end if;
  select id into v_ziel from auth.users
   where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null
   limit 1;
  if v_ziel is null then return jsonb_build_object('status', 'nicht_gefunden'); end if;
  insert into team_members (team_id, user_id) values (p_team_id, v_ziel)
    on conflict do nothing;   -- gleichzeitige Aufnahme wirkt einmalig (PC 3)
  return jsonb_build_object('status', 'aufgenommen', 'anzeige_name', anzeige_name(v_ziel));
end;
$$;
revoke all on function add_team_member(uuid, text) from public, anon;
grant execute on function add_team_member(uuid, text) to authenticated;

-- Mitgliederliste ohne E-Mail (NFR 4).
create function team_mitglieder(p_team uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team and user_id = auth.uid()) then
    raise exception 'not a member of this team';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
           'user_id', m.user_id, 'anzeige_name', anzeige_name(m.user_id))
           order by m.created_at)
    from team_members m where m.team_id = p_team), '[]'::jsonb);
end;
$$;
revoke all on function team_mitglieder(uuid) from public, anon;
grant execute on function team_mitglieder(uuid) to authenticated;
```

- [ ] **Step 2: Datenebene-Test** (psql-Szenario mit `set_config('request.jwt.claims', …)`-Muster): create_team → sieht Team; finde_trainer unbekannt → `nicht_gefunden` und Suchversuch gezählt; 10× → `gebremst`; eigene Mail → `bereits_mitglied`; zweiter Testuser: finden → `gefunden` mit Anzeigename, aufnehmen → Zugriff; letzter verlässt → Team weg.
- [ ] **Step 3: Commit** (zusammen mit A1 nach A3).

### Task A3: `kopiereTraining`-Baustein + Publish v3 (Story 14)

**Files:**
- Create: `web/lib/training-kopie.ts`
- Modify: `web/lib/actions/trainings.ts` (`publishTrainingAction`/`unpublishTrainingAction` ersetzen), `web/components/training/TrainingVisibilityControl.tsx` (wird `VorlagenControl`), `web/lib/queries/trainings.ts` (Editor lädt nur private persönliche bzw. Team)

**Interfaces:**
- Produces (training-kopie.ts, nicht "use server"):

```ts
export type KopieZiel =
  | { art: "persoenlich"; ownerId: string }                    // zu mir / Übernahme
  | { art: "team"; teamId: string }                            // ins Team / je Termin
  | { art: "vorlage"; ownerId: string };                       // veröffentlichen (public)

/** Kopiert ein ganzes Training samt aller Übungs-Fassungen mit eigenen Bild-
 *  und Diagrammkopien. Herkunft: bestehende Herkunft der Quelle wird
 *  weitergereicht (Ur-Herkunft), sonst Name der Quelle + jetzt. Bilder landen
 *  je Ziel unter user/<owner>/ bzw. team/<team>/ mit der NEUEN Fassungs-ID.
 *  Bei einem Fehler werden bereits kopierte Bilder und die halbe Kopie
 *  entfernt — es bleibt nie eine Teilkopie (Story 11 PC 2). */
export async function kopiereTraining(
  supabase: SupabaseClient,
  quelleId: string,
  ziel: KopieZiel,
): Promise<{ ok: true; neueId: string } | { ok: false; error: string }>;
```

- Produces (actions): `veroeffentlicheTraining(trainingId)` — Gate (Stufe/Einleitung/Hauptteil) in der Action prüfen, `kopiereTraining(…, {art:"vorlage"})`, danach in einer Folge: alte Vorlage aus `vorlage_id` löschen (inkl. Storage-Bilder, Guard `istEigeneFassungsDatei`), `vorlage_id` auf die neue setzen. `zieheVorlageZurueck(trainingId)` — löscht die verlinkte Vorlage samt Bildern, nullt den Link. Beide owner-only, Tragweite-Dialog nennt die öffentliche Sichtbarkeit des Anzeigenamens (Story 14 AK 2).

- [ ] **Step 1:** `kopiereTraining` implementieren — Quelle via RLS lesen (`TRAINING_SELECT`-Muster), Ziel-Training inserten (Name, Stufen, `herkunft_name/datum`, `team_id`/`owner_id`/`visibility` je Ziel; bei `vorlage` `visibility:'public'` — Insert-Policy erlaubt owner-Insert, das Einfrieren greift erst für Updates), je Fassung neue UUID → `kopiereBild` (Zielordner je Ziel-Art: `user/<owner>/` bzw. `team/<team>/`) → Insert mit `inhaltFelder` + `kopiereDiagrammVon` + `stempleHerkunft`-Analogon für Trainings-Fassungen (bestehende Fassungs-Herkunft bleibt). Fehlerpfad: alle bereits kopierten Bilder + das Ziel-Training löschen, `{ok:false}`.
- [ ] **Step 2:** Publish-Actions umbauen; `VorlagenControl`: Zustände «Nicht veröffentlicht» → [Veröffentlichen], «Vorlage aktiv» → [Erneut veröffentlichen (ersetzt)] [Zurückziehen]; MISSING-Meldungen wie bisher aus dem Gate.
- [ ] **Step 3: Datenebene-Test:** Training mit 3 Fassungen (2 Bilder) veröffentlichen → Vorlage public mit eigenen Bildpfaden, Original privat + `vorlage_id` gesetzt; Original ändern → Vorlage unverändert; erneut veröffentlichen → alte Vorlagen-Zeilen und -Bilder weg, neuer Stand da, Link aktualisiert; zurückziehen → Vorlage weg, Link null; Vorlage per Update anfassen → 0 Zeilen (eingefroren).
- [ ] **Step 4:** `typecheck` + `build`; E2E: Veröffentlichen-Dialog inkl. Anzeigename-Hinweis, Ersetzen, Zurückziehen. **Step 5: Commit A1+A2+A3** — `feat(team): Fundament — Datenmodell, RLS, Vorlagen-Publish als Kopie (Stories 1/14)`

### Task A4: Teil-A-Verifikation + PR 1

- [ ] **Step 1:** `db:reset` + `seed` + `build` grün; Datenebene-Szenarien aus A2/A3 am Stück.
- [ ] **Step 2:** `PUBLIC_TABLES` in `.github/workflows/sync-staging.yml` um `teams, team_members, training_termine, profiles, trainer_suchversuche` ergänzen.
- [ ] **Step 3:** PR 1 auf `develop`; im PR-Text den Bestandsübergang (öffentliche Trainings eingefroren) prominent nennen. Review; Staging prüfen. **Kein Prod-Merge ohne Freigabe.**

---

## Teil B — Teams & Mitglieder (PR 2: Stories 2-UI, 3, 4, 13)

### Task B1: Anzeigename im Konto (Story 2)

**Files:** Create `web/lib/actions/profil.ts`; Modify `web/app/konto/page.tsx`, `web/app/konto/KontoClient.tsx`

- [ ] `setzeAnzeigename(name)` (upsert `profiles`, trim, 1–40, leer → «Bitte einen Anzeigenamen angeben.»; einmal gewählt nicht entfernbar → kein Lösch-Pfad); Konto zeigt aktuellen Namen (`rpc anzeige_name`) mit Hinweis «für Team-Mitglieder und an deinen Vorlagen öffentlich sichtbar». E2E; Commit.

### Task B2: Teams-Bereich — anlegen, umbenennen, Mitglieder (Stories 3, 4)

**Files:** Create `web/app/teams/page.tsx`, `web/app/team/[id]/page.tsx`, `web/lib/queries/teams.ts`, `web/lib/actions/teams.ts`, `web/components/team/TeamKopf.tsx`, `web/components/team/MitgliederListe.tsx`; Modify Header-Navigation (Hauptnav-Eintrag «Teams» — PO-Entscheid: eigener Navigationspunkt)

**Interfaces:** `getMeineTeams() → {id, name, mitgliederAnzahl}[]`; `getTeam(id)` (Mitglieder via `rpc team_mitglieder`); Actions `erstelleTeam(name)`, `benenneTeamUm(teamId, name)`, `sucheTrainer(teamId, email)` (mappt `finde_trainer`-Stati: `nicht_gefunden` → «Unter dieser Adresse ist niemand registriert.», `gebremst` → «Zu viele Versuche — bitte später erneut.»), `nimmMitgliedAuf(teamId, email)` (nach Vorschau-Bestätigung).

- [ ] `/teams`: Karten + «Neues Team» (nur Name); `/team/[id]`: Kopf mit inline-Umbenennen, Mitgliederliste (Anzeigenamen), Aufnahme-Formular mit Vorschau-Dialog («‹Name› gefunden — aufnehmen?»). E2E mit zwei Usern (B sieht Team-Inhalte sofort). Commit.

### Task B3: Verlassen, Entfernen, Auflösen (Story 13)

**Files:** Modify `web/lib/actions/teams.ts`, `web/app/team/[id]/page.tsx`

**Interfaces:** `entferneMitglied(teamId, userId)` — prüft im Moment der Ausführung, ob die Aktion das Team leert (Story 13 AK 4): dann `{status:'braucht_aufloesung', trainings, termine}` statt Ausführung; `verlasseTeam(teamId)` analog; `loeseTeamAuf(teamId)` — Dialog nennt Anzahl Team-Trainings + Termine (Query vorab), Delete auf `teams` (Kaskade).

- [ ] Aktionen + Dialoge; Leeren-Guard-Race per zweitem Check serverseitig (die Action zählt Mitglieder in derselben Transaktion via RPC `verlasse_team(p_team, p_bestaetigt boolean)` — definer, wirft `AUFLOESUNG_NOETIG` wenn letzter und nicht bestätigt). E2E: 2er-Team, einer entfernt den anderen (Team bleibt, 1 Mitglied); letzter verlässt ohne Bestätigung → Meldung; mit Bestätigung → Team samt Trainings/Terminen weg, persönliche unberührt. Commit + PR 2.

---

## Teil C — Team-Trainings (PR 3: Stories 5, 6)

### Task C1: Ins Team stellen, zu mir übernehmen, entfernen (Story 5)

**Files:** Create `web/lib/actions/team-trainings.ts`, `web/components/training/InTeamStellenControl.tsx`; Modify `web/app/team/[id]/page.tsx` (Bestandsliste + «Training erstellen»), Trainings-Detail/Editor (Control für Eigentümer)

**Interfaces:** `stelleInsTeam(trainingId, teamId)` → `kopiereTraining(…, {art:"team", teamId})` (auch Entwürfe, kein Gate); `uebernimmZuMir(teamTrainingId)` → `kopiereTraining(…, {art:"persoenlich"})`; `entferneTeamTraining(teamTrainingId)` — Dialog zeigt, ob und welcher Termin entfällt (auch vergangene; gleicher Text für beide); `erstelleTeamTraining(teamId, name)` (direkt im Team, analog createTraining mit `team_id`).

- [ ] Actions + UI (Menü «Ins Team stellen» mit Team-Liste am eigenen Training; im Team-Bereich: Bestand mit Herkunftszeile «basiert auf ‹Name›, seit ‹Datum› im Team», «Zu mir übernehmen», «Entfernen»). E2E: stellen → B sieht + bearbeitet; mehrfach ins selbe Team → zwei Kopien; entfernen → Original unberührt. Commit.

### Task C2: Editor für Mitglieder öffnen (Story 6)

**Files:** Create `web/lib/training-zugriff.ts`; Modify `web/lib/queries/trainings.ts` (`getTrainingForEdit`: statt owner-only → owner-private ODER Team-Mitglied; lädt `team_id` + Teamname), `web/lib/queries/fassung.ts`, `web/lib/actions/fassung.ts` (`ladeFassung`), `web/lib/actions/trainings.ts` (Mutations-Guards), `web/lib/fassung.ts` (`fassungBildPfad` bekommt Ziel-Ordner-Parameter `user/<uid>` | `team/<teamId>`), `web/components/training/TrainingEditor.tsx` (Team-Kopf «Team-Training von ‹Teamname›»)

- [ ] Zugriffs-Helper (`darfBearbeiten`: owner-private oder `rpc ist_team_mitglied`); alle App-Owner-Gates lockern (RLS bleibt Autorität); Bild-Upload/Copy bei Team-Trainings in den Team-Ordner; Vorlagen (public) laden den Editor NICHT (eingefroren — Redirect mit Hinweis). E2E als Mitglied: Übung hinzufügen, Fassung + Foto + Diagramm ändern, Name/Stufen ändern; Fremder ohne Team: kein Zugriff. Commit + PR 3.

---

## Teil D — Termine & Plan (PR 4: Stories 7, 8, 9)

### Task D1: Termin-Datenpfad + Team-Trainingsplan (Story 7)

**Files:** Create `web/lib/queries/termine.ts`, `web/lib/actions/termine.ts`, `web/components/team/TrainingsPlan.tsx`, `web/components/team/TerminForm.tsx`, Kit: `DateField`/`TimeField` (+ Styleguide-Eintrag); Modify `web/app/team/[id]/page.tsx`, `web/app/training/[id]/durchfuehren/page.tsx` (optionaler `?termin=<id>`-Kontext: Kopf mit Datum/Beginn/Ort/Bemerkung)

**Interfaces:** `getTeamPlan(teamId) → {id, datum, beginn, ort, bemerkung, training:{id,name,stufen}}[]` — ein Select (`training_termine` mit `trainings!inner`-Embed, Filter `trainings.team_id`), Sortierung `datum asc, beginn asc nulls last, created_at asc` (stabiler Tiebreaker); `erstelleTermin(teamTrainingId, {datum, beginn?, ort?, bemerkung?})` (nur für terminlose — UNIQUE fängt Races); `aktualisiereTermin(id, felder)`; `entferneTermin(id)` (Bestätigung; «schon weg» = erledigt ohne Fehler).

- [ ] Plan-Ansicht: chronologisch aufsteigend, vergangene gedämpft (Grenze: `datum < heute`), leerer Plan mit Hinweis, Zeile verlinkt auf Training (Ansicht) und «Durchführen» mit Termin-Kontext. E2E inkl. Sortier-Grenzfälle (gleicher Tag mit/ohne Beginn) und Vergangenheits-Erfassung. Commit.

### Task D2: Erneut ansetzen = Auto-Kopie (Story 8) + Termin entfernen (Story 9)

**Files:** Modify `web/lib/actions/termine.ts`, `web/components/team/TrainingsPlan.tsx`/`TerminForm.tsx`

**Interfaces:** `setzeErneutAn(teamTrainingId, {datum, beginn?, ort?, bemerkung?})` — `kopiereTraining(…, {art:"team"})` + Termin an der Kopie; das Formular ist mit Beginn/Ort/Bemerkung des bisherigen Termins vorbefüllt, das Datum leer (PO-Entscheid). Fehlerpfad: keine Teilkopie (Baustein räumt auf), kein Termin ohne Training.

- [ ] «Erneut ansetzen» am Plan-Eintrag und am angesetzten Training; Herkunftszeile an der Kopie zeigt den Ursprung (Ur-Herkunft, keine Zwischenkopien). Termin-Entfernen-Dialog (ein Text für vergangene wie künftige). E2E: zweimal ansetzen → zwei unabhängige Trainings mit je einem Termin; Änderung an einem lässt das andere unberührt; Termin entfernen → Training bleibt terminlos im Bestand. NFR-Stichprobe: 100 Termine seeden, Plan < 1 s. Commit + PR 4.

---

## Teil E — Bibliothek & Urheber (PR 5: Stories 11, 12, 15)

### Task E1: Vorlage übernehmen (Story 11)

**Files:** Create `web/components/training/VorlageUebernehmenControl.tsx`; Modify Trainings-Detailseite, `web/lib/actions/team-trainings.ts`

**Interfaces:** `uebernimmVorlage(vorlageId, ziel: {art:"persoenlich"} | {art:"team"; teamId})` → `kopiereTraining`; Menü «Übernehmen» (für mich / je Team) an öffentlichen Vorlagen für Angemeldete.

- [ ] E2E: fremde Vorlage → private persönliche Kopie und Team-Kopie, Herkunft + Urheber sichtbar (anonymisierte ohne Urheber-Zeile), Original unberührt, mehrfach möglich. Commit.

### Task E2: Übersicht & Navigation (Story 12)

**Files:** Modify `web/lib/queries/trainings.ts` (Pool: Default = nur `visibility='public'`; Facette «Meine Trainings» = owner-private; Team-Trainings NIE im Pool), `web/app/trainings/…` (Facetten-UI, Kennzeichnung Vorlage/persönlich), Header (Teams-Nav aus B2 verifizieren)

- [ ] Default-Ansicht Vorlagen (auch anonym); «Meine Trainings»-Eingrenzung; Team-Bestand nur im Team-Bereich; Filter kombinieren. E2E in beiden Rollen. Commit.

### Task E3: Urheber-Anzeige (Story 15) + Abschluss

**Files:** Modify `web/lib/queries/trainings.ts` (Selects um berechnetes Feld `urheber`), Trainings-Detail + `TrainingCard` («von ‹Anzeigename›», entfällt bei `urheber = null`)

- [ ] Anzeige in Übersicht + Detail, live bei Namensänderung, nie E-Mail. E2E anonym. Doku: Epic-§11-Reststand prüfen; Styleguide-Einträge (DateField/TimeField, Team-Komponenten) vollständig. Typecheck/Build/E2E-Gesamtdurchlauf (Kernpfad: Team → Training stellen → terminieren → erneut ansetzen → veröffentlichen aus persönlicher Übernahme). PR 5. **Prod-Merges aller Teile nur mit expliziter Freigabe.**

---

## Story-Abdeckung (Selbst-Check)

| Story | Tasks |
|---|---|
| 1 (Enabler Datenmodell) | A1, A2 |
| 2 (Anzeigename) | A1 (Funktion), B1 (UI) |
| 3 (Team erstellen/umbenennen) | A2, B2 |
| 4 (Aufnehmen mit Vorschau) | A2, B2 |
| 5 (Ins Team stellen / zu mir / entfernen) | C1 |
| 6 (Gemeinsam bearbeiten) | A1 (RLS/Storage), C2 |
| 7 (Terminieren + Plan) | D1 |
| 8 (Erneut ansetzen = Kopie) | D2 |
| 9 (Termin entfernen) | D2 |
| 10 | entfallen (in Story 5 aufgegangen) |
| 11 (Vorlage übernehmen) | E1 |
| 12 (Übersicht/Navigation) | B2 (Teams-Nav), E2 |
| 13 (Verlassen/Entfernen/Auflösen) | A1 (Trigger), B3 |
| 14 (Vorlagen-Publish) | A3 |
| 15 (Urheber) | A1 (Funktion), E3 |

## Bewusste Entwurfs-Entscheide (für Review)

1. **Einfrieren via fehlender Update-Policy statt Trigger** — Vorlagen sind konstruktiv unveränderlich; Zurückziehen ist ein DELETE durch den Urheber. `training_enforce_publishable` und `unpublish_training` entfallen ersatzlos.
2. **Ein Kopier-Baustein für fünf Wege** — `kopiereTraining()` mit Ziel-Diskriminator; die Fassungs-Bausteine (`kopiereBild`, `inhaltFelder`, `kopiereDiagrammVon`) aus Epic #72 werden wiederverwendet; Fehlerpfad räumt vollständig auf (nie Teilkopien).
3. **Team-Bilder unter `team/<team_id>/…`** — löst die IST-Kopplung «Storage-Schreibrecht nur im eigenen User-Ordner», damit jedes Mitglied Fotos ersetzen kann; `istEigeneFassungsDatei`-Guard gilt weiter (Dateiname = Fassungs-ID).
4. **Termin UNIQUE auf `training_id`** — «höchstens ein Termin je Training» ist Schema-Invariante; das erneute Ansetzen MUSS kopieren, Races fängt die DB.
5. **`vorlage_id` am persönlichen Training** — der PO-Entscheid «erneutes Veröffentlichen ersetzt» braucht genau diesen Link; `on delete set null` hält ihn konsistent, wenn die Vorlage anderweitig verschwindet.
6. **Rate-Limit als Tabelle + Zählung in der RPC** — bewusst simpel (10 erfolglose Suchversuche/Stunde), kein Infrastruktur-Zusatz.
7. **Bestandsübergang ohne Daten-Backfill** — bestehende öffentliche Trainings werden allein durch die neuen Policies zu eingefrorenen Vorlagen; kein Backfill nötig, `vorlage_id` bleibt bei Alt-Vorlagen null (sie haben kein persönliches Pendant).
8. **Deploy-Fenster Teil A:** Das alte Bundle ruft `publish_training`/`unpublish_training` auf, die die Migration droppt → im Vercel-Build-Fenster schlägt Veröffentlichen/Zurückziehen mit sauberer Fehlermeldung fehl (Minuten, kein Datenverlust); alle Lese- und übrigen Schreibpfade bleiben verträglich. Bewusst akzeptiert — im PR-Text nennen.
