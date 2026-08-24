# Team-Trainingsplan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trainerteams teilen Trainings intern (statt sie zu veröffentlichen), bearbeiten sie gleichberechtigt und führen sie als chronologischen, terminierten Team-Trainingsplan.

**Architecture:** Vier neue Tabellen (`teams`, `team_members`, `training_shares`, `training_termine`) plus `profiles` für den Anzeigenamen. Ein Training gehört immer genau einer Person; Teilen erweitert nur den Zugriff — die bestehenden owner-basierten RLS-Policies werden um Team-Mitgliedschaft erweitert, Sichtbarkeits-Änderungen bleiben per Trigger dem Eigentümer vorbehalten. Termine hängen per Composite-FK an der **Teilung** (nicht am Training), sodass Aufheben/Auflösen/Löschen die abhängigen Termine konstruktiv kaskadiert. Bei Konto-Löschung gehen geteilte Trainings an ein verbleibendes Mitglied über (dritter Zweig in `delete_account`), inklusive Umzug der Fassungs-Bilder in den Ordner des neuen Eigentümers.

**Tech Stack:** Next.js 15 (RSC + Server Actions), Supabase (Postgres RLS, SECURITY-DEFINER-RPCs, Storage), TypeScript.

**Grundlagen:** Epic `docs/superpowers/specs/2026-08-16-team-trainingsplan-epic.md` (EK = Erfolgskriterium, §9 = PO-Entscheide), Story 1 refined in `2026-08-16-team-trainingsplan-stories.md`. Die Stories 2–15 sind noch nicht refined — dieser Plan setzt die PO-Entscheide aus Epic §9 um; weicht ein späteres Refinement ab, gewinnt das Refinement.

## Global Constraints

- Projektsprache Deutsch: Code-Kommentare, Commit-Messages, UI-Texte (CLAUDE.md).
- Forward-only: echte Nutzer, keine destruktiven Migrationen; Verschärfungen via Backfill bzw. `NOT VALID` (CLAUDE.md).
- Supabase server-only: keine `NEXT_PUBLIC_*`-Variablen, kein Browser-Client; Clients via `web/lib/supabase/server.ts` bzw. `admin.ts`.
- RLS + RPC: mehrstufige Mutationen als `SECURITY DEFINER`-RPC mit Auth-/Owner-Check als erster Anweisung.
- Styleguide-first: neue UI-Elemente aus `web/components/ui` (Kit) beziehen; Neues begründen und im Styleguide (`web/app/styleguide`) ergänzen.
- NFR 2 (Story 1): Die E-Mail-Adresse eines Mitglieds ist für andere Mitglieder nie auslesbar — nirgends selektieren, nirgends zurückgeben.
- NFR 1: Zugriff serverseitig (RLS/RPC) durchgesetzt, nie nur in der Oberfläche.
- Pro Teil ein PR auf `develop`; Prod-Merge (develop→main) nur mit expliziter Freigabe des Users.
- Nach jedem Migrations-Task: `npm run gen:types` (web/), dann `npm run typecheck`.
- Verifikation je Task auf Datenebene per `docker exec -i supabase_db_kifu psql -q -U postgres -d postgres -v ON_ERROR_STOP=1`; UI-Tasks zusätzlich per Browser-E2E (Dev-Server via `preview_start`, Login `e2e@test.local`/`Test1234!`, User via Admin-API anlegen — Befehl in CLAUDE.md).

**Rollout in fünf PRs:**
- **Teil A** — Fundament (Story 1 + 2 Datenebene + Story 14): Schema, RLS, RPCs, Anzeigename-Funktion, Konto-Übertragung. Ohne UI keine Verhaltensänderung → eigenständig releasebar.
- **Teil B** — Team-Verwaltung (Stories 2-UI, 3, 4, 13): Teams-Seiten, Mitglieder, Anzeigename im Konto.
- **Teil C** — Teilen & gemeinsames Bearbeiten (Stories 5, 6, 12): Teilen-Dialog, Editor-Zugriff für Mitglieder, Übersichts-Facette.
- **Teil D** — Termine (Stories 7, 8, 9, 10): Terminieren, Trainingsplan-Ansicht, Mehrfachverwendungs-Hinweis, Lösch-Dialoge mit Termin-Anzahl.
- **Teil E** — Öffentlichkeit & Kopie (Stories 11, 15): Urheber-Anzeige, fremdes Training als Kopie übernehmen.

**Im Plan beantwortete offene UX-Fragen (Vorschläge, PO/UX können sie ändern):**
- Frage 3 (Mehrfachverwendungs-Hinweis): stille Info-Zeile im Editor-Kopf «An N Terminen angesetzt» — kein Dialog, stört nicht, ist aber vor jeder Änderung sichtbar (D3).
- Frage 4 (Teamwechsel): kein globaler Team-Kontext; jedes Team hat seine eigene Seite `/team/[id]`, der Teamname steht als Titel — der Bezug ist immer explizit (B2).
- Frage 5 (Auto-Anzeigename): `Trainer:in` + erste 4 Hex-Zeichen von `md5(user_id)` (z. B. «Trainer:in 7f3a») — deterministisch, ohne Profil-Zeile berechenbar, verrät nie die E-Mail-Adresse (A1).

---

## Teil A — Fundament (PR 1: Story 1, Story 2 Datenebene, Story 14)

### Task A1: Migration — Datenmodell, RLS, Regeln

**Files:**
- Create: `supabase/migrations/<timestamp>_team_trainingsplan_datenmodell.sql`

**Interfaces:**
- Produces: Tabellen `teams(id, name)`, `team_members(team_id, user_id)`, `training_shares(training_id, team_id)`, `training_termine(id, training_id, team_id, datum, beginn, ort, bemerkung)`, `profiles(user_id, display_name)`; SQL-Funktionen `ist_team_mitglied(uuid) → boolean` und `anzeige_name(uuid) → text`; Trigger `trainings_sichtbarkeit_nur_eigentuemer` und `team_aufloesen_wenn_leer`.

- [ ] **Step 1: Migration schreiben** (`npx supabase migration new team_trainingsplan_datenmodell --workdir ..` aus `web/`, dann Datei füllen):

```sql
-- ============================================================================
-- Team-Trainingsplan (Epic 2026-08-16), Story 1: Datenmodell für Team,
-- Mitgliedschaft, Teilung und Trainingstermine — plus Anzeigename (Story 2,
-- Datenebene). Ein Training gehört immer genau einer Person (Epic §9
-- «Eigentum»); Teilen erweitert nur den Zugriff.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Teams und gleichberechtigte Mitgliedschaft (AK 1, 3, 5)
-- ----------------------------------------------------------------------------
create table teams (
  id uuid primary key default gen_random_uuid(),
  -- Frei wählbar, bewusst nicht eindeutig (AK 1).
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- created_at bestimmt bei der Konto-Übertragung deterministisch den
  -- Nachfolger (ältestes verbleibendes Mitglied).
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on team_members (user_id);

-- ----------------------------------------------------------------------------
-- 2) Teilung und Termine (AK 7, 13–17)
-- ----------------------------------------------------------------------------
create table training_shares (
  training_id uuid not null references trainings(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (training_id, team_id)
);
create index training_shares_team_idx on training_shares (team_id);

-- Ein Termin hängt an der TEILUNG, nicht am Training: hebt jemand die Teilung
-- auf oder fällt Team/Training weg, kaskadieren genau die abhängigen Termine
-- (Story 1 Postconditions 1–3) — konstruktiv, ohne Aufräum-Code.
create table training_termine (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null,
  team_id uuid not null,
  foreign key (training_id, team_id)
    references training_shares (training_id, team_id) on delete cascade,
  -- Datum/Beginn gelten als Zeit am Trainingsort (AK 18): bewusst date/time
  -- OHNE Zeitzone — kein Umrechnen, keine Betrachter-Abhängigkeit.
  datum date not null,
  beginn time,
  ort text,
  bemerkung text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Chronologie-Reads des Teams (AK 19, NFR 2): ein Index deckt die Sortierung.
create index training_termine_plan_idx
  on training_termine (team_id, datum, beginn nulls last);
create index training_termine_training_idx on training_termine (training_id);

-- ----------------------------------------------------------------------------
-- 3) Anzeigename (Story 2, Datenebene; Epic §9 «Identität»)
-- ----------------------------------------------------------------------------
-- Eine Profil-Zeile existiert nur, wenn der USER selbst einen Namen wählt.
-- Ohne Zeile greift der deterministische Auto-Name — kein Backfill nötig.
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  updated_at timestamptz not null default now()
);

-- Der Anzeigename ist per PO-Entscheid ein ÖFFENTLICH sichtbares Personendatum
-- (er erscheint an öffentlichen Trainings). Der Auto-Name leitet sich aus der
-- User-ID ab, nie aus der E-Mail-Adresse (Story 1 NFR 4).
create function anzeige_name(p_user uuid) returns text
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select display_name from profiles where user_id = p_user),
    'Trainer:in ' || left(md5(p_user::text), 4)
  );
$$;

-- Urheber als berechnetes Feld an trainings: PostgREST erlaubt damit
-- `select=...,urheber` direkt am Trainings-Select (Story 15).
create function urheber(t trainings) returns text
language sql stable
set search_path = public, pg_temp
as $$
  select case when t.owner_id is null then null else anzeige_name(t.owner_id) end;
$$;

-- ----------------------------------------------------------------------------
-- 4) RLS
-- ----------------------------------------------------------------------------
-- Rekursionsfalle: eine team_members-Policy, die team_members abfragt («sehe
-- Mitglieder meiner Teams»), rekursiert in Postgres. Die Mitgliedschafts-
-- Prüfung läuft darum über eine SECURITY-DEFINER-Funktion, die RLS umgeht.
create function ist_team_mitglied(p_team uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from team_members
    where team_id = p_team and user_id = auth.uid()
  );
$$;
revoke all on function ist_team_mitglied(uuid) from public, anon;
grant execute on function ist_team_mitglied(uuid) to authenticated;

alter table teams enable row level security;
alter table team_members enable row level security;
alter table training_shares enable row level security;
alter table training_termine enable row level security;
alter table profiles enable row level security;

-- Teams: nur Mitglieder sehen/ändern/löschen ihr Team (AK 2; Auflösen = EK 5).
-- INSERT läuft ausschliesslich über die RPC create_team (atomar mit der ersten
-- Mitgliedschaft) — darum keine Insert-Policy.
create policy teams_select on teams for select to authenticated
  using (ist_team_mitglied(id));
create policy teams_update on teams for update to authenticated
  using (ist_team_mitglied(id)) with check (ist_team_mitglied(id));
create policy teams_delete on teams for delete to authenticated
  using (ist_team_mitglied(id));

-- Mitgliedschaften: Mitglieder sehen die Liste ihrer Teams; entfernen darf
-- jedes Mitglied jedes Mitglied inkl. sich selbst (Gleichberechtigung, EK 5).
-- INSERT nur über die RPC add_team_member (E-Mail-Auflösung braucht definer).
create policy tm_select on team_members for select to authenticated
  using (ist_team_mitglied(team_id));
create policy tm_delete on team_members for delete to authenticated
  using (ist_team_mitglied(team_id));

-- Teilungen: Mitglieder sehen sie; anlegen/aufheben darf nur der EIGENTÜMER
-- des Trainings, der zugleich Mitglied des Ziel-Teams ist (Story 5: «eines
-- SEINER Trainings»; Aufheben spiegelbildlich).
create policy ts_select on training_shares for select to authenticated
  using (ist_team_mitglied(team_id));
create policy ts_insert on training_shares for insert to authenticated
  with check (
    ist_team_mitglied(team_id)
    and exists (select 1 from trainings t
                where t.id = training_id and t.owner_id = auth.uid())
  );
create policy ts_delete on training_shares for delete to authenticated
  using (exists (select 1 from trainings t
                 where t.id = training_id and t.owner_id = auth.uid()));

-- Termine: jedes Mitglied des Teams verwaltet sie vollständig (Story 7–9).
create policy tt_select on training_termine for select to authenticated
  using (ist_team_mitglied(team_id));
create policy tt_insert on training_termine for insert to authenticated
  with check (ist_team_mitglied(team_id));
create policy tt_update on training_termine for update to authenticated
  using (ist_team_mitglied(team_id)) with check (ist_team_mitglied(team_id));
create policy tt_delete on training_termine for delete to authenticated
  using (ist_team_mitglied(team_id));

-- Profile: Anzeigename ist öffentlich lesbar (er steht an öffentlichen
-- Trainings); schreiben kann nur der USER an seiner eigenen Zeile.
create policy pr_select on profiles for select using (true);
create policy pr_insert on profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy pr_update on profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- API-Rollen-Grants (Gotcha aus dem Bestand: ohne explizite Grants liefert
-- PostgREST «permission denied for table», siehe 20260614120000).
grant select, update, delete on teams to authenticated;
grant select, delete on team_members to authenticated;
grant select, insert, delete on training_shares to authenticated;
grant select, insert, update, delete on training_termine to authenticated;
grant select on profiles to anon;
grant select, insert, update on profiles to authenticated;

-- ----------------------------------------------------------------------------
-- 5) Trainings-Zugriff für Mitglieder erweitern (AK 9)
-- ----------------------------------------------------------------------------
-- Prüfung «bin ich Mitglied eines Teams, mit dem dieses Training geteilt
-- ist» — als definer-Funktion, damit die Policy-Kette nicht an den RLS der
-- Hilfstabellen hängt und der Planner sie einmal je Zeile auswertet.
create function hat_team_zugriff(p_training uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from training_shares s
    join team_members m on m.team_id = s.team_id
    where s.training_id = p_training and m.user_id = auth.uid()
  );
$$;
revoke all on function hat_team_zugriff(uuid) from public, anon;
grant execute on function hat_team_zugriff(uuid) to authenticated;

drop policy tr_select on trainings;
create policy tr_select on trainings for select
  using (visibility = 'public' or owner_id = auth.uid() or hat_team_zugriff(id));
drop policy tr_update on trainings;
create policy tr_update on trainings for update
  using (owner_id = auth.uid() or hat_team_zugriff(id))
  with check (owner_id = auth.uid() or hat_team_zugriff(id));
-- tr_delete bleibt owner-only: Löschen ist keine gleichberechtigte Aktion
-- (EK 2 — der Eigentümer verantwortet das Training; Story 10 bestätigt).

drop policy te_select on training_exercises;
create policy te_select on training_exercises for select
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.visibility = 'public' or p.owner_id = auth.uid()
                        or hat_team_zugriff(p.id))));
drop policy te_insert on training_exercises;
create policy te_insert on training_exercises for insert
  with check (exists (select 1 from trainings p
                      where p.id = training_id
                        and (p.owner_id = auth.uid() or hat_team_zugriff(p.id))));
drop policy te_update on training_exercises;
create policy te_update on training_exercises for update
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.owner_id = auth.uid() or hat_team_zugriff(p.id))));
drop policy te_delete on training_exercises;
create policy te_delete on training_exercises for delete
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.owner_id = auth.uid() or hat_team_zugriff(p.id))));

-- ----------------------------------------------------------------------------
-- 6) Sichtbarkeit bleibt Sache des Eigentümers (AK 11, 12; Epic §9)
-- ----------------------------------------------------------------------------
-- RLS kann OLD nicht mit NEW vergleichen — darum ein Trigger. Er deckt beide
-- Fälle: das direkte Umschalten UND die Auto-Privatisierung durch
-- training_enforce_publishable_trg, wenn ein MITGLIED die Einleitung oder den
-- Hauptteil eines öffentlichen Trainings leeren würde (die Kette Update →
-- enforce_publishable → visibility-Änderung → dieser Trigger wirft, die ganze
-- Aktion des Mitglieds schlägt fehl — genau AK 12).
create function trainings_sichtbarkeit_nur_eigentuemer() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.visibility is distinct from old.visibility
     and auth.uid() is not null          -- Service-Role/Migrationen bleiben frei
     and auth.uid() <> old.owner_id then
    raise exception 'SICHTBARKEIT_NUR_EIGENTUEMER'
      using hint = 'Nur der Eigentümer kann die Sichtbarkeit dieses Trainings ändern.';
  end if;
  return new;
end;
$$;
create trigger trainings_sichtbarkeit_nur_eigentuemer
  before update on trainings
  for each row execute function trainings_sichtbarkeit_nur_eigentuemer();

-- ----------------------------------------------------------------------------
-- 7) Ein Team ohne Mitglieder besteht nicht fort (AK 6, EK 7)
-- ----------------------------------------------------------------------------
create function team_aufloesen_wenn_leer() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from team_members where team_id = old.team_id) then
    delete from teams where id = old.team_id;
  end if;
  return old;
end;
$$;
create trigger team_aufloesen_wenn_leer
  after delete on team_members
  for each row execute function team_aufloesen_wenn_leer();
```

- [ ] **Step 2: Lokal einspielen und Grundzustand prüfen**

Run (aus `web/`): `npm run db:reset` → alle Migrationen laufen; dann `npm run seed`.
Expected: kein Fehler; `docker exec supabase_db_kifu psql -U postgres -d postgres -tAc "select count(*) from pg_policies where tablename in ('teams','team_members','training_shares','training_termine','profiles')"` → `13`.

- [ ] **Step 3: `npm run gen:types` + `npm run typecheck`** — Expected: grün.

- [ ] **Step 4: Commit** — `feat(db): Datenmodell Team, Mitgliedschaft, Teilung, Termine + Anzeigename (Team-Epic Story 1/2)`

### Task A2: RPCs — Team anlegen, Mitglied aufnehmen

**Files:**
- Create: `supabase/migrations/<timestamp>_team_rpcs.sql`

**Interfaces:**
- Produces: `create_team(p_name text) → uuid` (legt Team + erste Mitgliedschaft atomar an); `add_team_member(p_team_id uuid, p_email text) → jsonb` (`{status:'aufgenommen', anzeige_name}` | `{status:'nicht_gefunden'}` | `{status:'bereits_mitglied'}`).

- [ ] **Step 1: Migration schreiben**

```sql
-- Team anlegen ist zweistufig (Team + erste Mitgliedschaft) und muss atomar
-- sein (Story 1 Postcondition 6) — darum RPC statt zweier Inserts.
create function create_team(p_name text) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'TEAMNAME_LEER' using hint = 'Bitte einen Teamnamen angeben.';
  end if;
  insert into teams (name) values (btrim(p_name)) returning id into v_team;
  insert into team_members (team_id, user_id) values (v_team, v_uid);
  return v_team;
end;
$$;
revoke all on function create_team(text) from public, anon;
grant execute on function create_team(text) to authenticated;

-- Aufnahme per E-Mail eines BEREITS registrierten Trainers (EK 4); wirkt
-- sofort, ohne Einladungs-Zwischenzustand (Epic §9 «Aufnahme»). Braucht
-- definer für den Blick in auth.users; die E-Mail wird nie zurückgegeben.
-- Bewusst akzeptierte Offenlegung (PO-Modell «Einladung nur an Registrierte»):
-- die Antwort verrät, OB eine Adresse registriert ist.
create function add_team_member(p_team_id uuid, p_email text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_neu uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  -- Owner-/Zugehörigkeits-Check als erste materielle Prüfung (CLAUDE.md).
  if not exists (select 1 from team_members
                 where team_id = p_team_id and user_id = v_uid) then
    raise exception 'not a member of this team';
  end if;

  select id into v_neu from auth.users
   where lower(email) = lower(btrim(p_email)) limit 1;
  if v_neu is null then
    return jsonb_build_object('status', 'nicht_gefunden');
  end if;
  if exists (select 1 from team_members
             where team_id = p_team_id and user_id = v_neu) then
    return jsonb_build_object('status', 'bereits_mitglied');
  end if;

  insert into team_members (team_id, user_id) values (p_team_id, v_neu);
  return jsonb_build_object('status', 'aufgenommen',
                            'anzeige_name', anzeige_name(v_neu));
end;
$$;
revoke all on function add_team_member(uuid, text) from public, anon;
grant execute on function add_team_member(uuid, text) to authenticated;
```

- [ ] **Step 2: Datenebene-Test** — Skript nach `/tmp`-Scratchpad, via psql mit `set_config('request.jwt.claims', …)`-Muster (wie in früheren Plänen):

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', u.id, 'role', 'authenticated')::text, true)
from auth.users u where email = 'e2e@test.local';
set local role authenticated;
select create_team('FC Wyler Ea') as team_id \gset
-- Mitglied sieht sein Team, Name änderbar, Fremder sieht nichts:
select count(*) = 1 as sieht_team from teams where id = :'team_id';
update teams set name = 'FC Wyler Eb' where id = :'team_id' returning name;
-- Aufnahme: unbekannte Mail → nicht_gefunden; eigene Mail → bereits_mitglied
select add_team_member(:'team_id', 'gibtsnicht@test.local');
select add_team_member(:'team_id', 'e2e@test.local');
-- Verlassen → Team löst sich auf (letztes Mitglied):
delete from team_members where team_id = :'team_id';
select count(*) = 0 as team_weg from teams where id = :'team_id';
rollback;
```
Expected: `sieht_team=t`, `{"status":"nicht_gefunden"}`, `{"status":"bereits_mitglied"}`, `team_weg=t`.

- [ ] **Step 3: Zweiter Testuser + Zugriffs-Szenario** — zweiten User `e2e2@test.local` per Admin-API anlegen; Szenario: User A erstellt Team + privates Training, teilt es (`insert into training_shares`), nimmt B auf. Prüfen als B (eigener `set_config`-Block): B sieht das Training (`select count(*)=1 from trainings where id=…`), B kann `update trainings set name='Geändert'`, B kann **nicht** `update trainings set visibility='public'` (Expected: Exception `SICHTBARKEIT_NUR_EIGENTUEMER`), B kann keine Teilung eines fremden Trainings anlegen (ts_insert verweigert). Als Anonymer (`set local role anon`): Training unsichtbar.

- [ ] **Step 4: Commit** — `feat(db): RPCs create_team und add_team_member (Team-Epic Stories 3/4, Datenebene)`

### Task A3: Konto-Löschung überträgt geteilte Trainings (Story 14 / Story-1-Postconditions 4–5)

**Files:**
- Create: `supabase/migrations/<timestamp>_delete_account_uebertragung.sql`
- Modify: `web/lib/actions/auth.ts` (deleteAccount)

**Interfaces:**
- Consumes: `istEigeneFassungsDatei`, `bildUrlToPath` (Bestand); Admin-Client `web/lib/supabase/admin.ts`.
- Produces: RPC `plane_konto_uebertragung() → jsonb` (Liste `{training_id, neuer_owner, bild_pfade: text[]}`); `delete_account` v3 mit Übertragungs-Zweig.

- [ ] **Step 1: Migration schreiben.** Kern: `delete_account` per `create or replace` erweitern — VOR dem bisherigen Anonymisieren/Löschen ein Übertragungs-Zweig. Nachfolger-Wahl und Vorschau nutzen wörtlich denselben Ausdruck (beide Funktionen in DERSELBEN Migrationsdatei halten, Kommentar-Verweis aufeinander):

```sql
-- Nachfolger eines geteilten Trainings: das dienstälteste verbleibende
-- Mitglied über alle Teams, mit denen es geteilt ist. Deterministisch, damit
-- Vorschau (Bild-Umzug) und Vollzug (delete_account) dasselbe Ziel wählen.
create function training_nachfolger(p_training uuid, p_ohne uuid) returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.user_id
  from training_shares s
  join team_members m on m.team_id = s.team_id
  where s.training_id = p_training and m.user_id <> p_ohne
  order by m.created_at, m.user_id
  limit 1;
$$;
revoke all on function training_nachfolger(uuid, uuid) from public, anon;
grant execute on function training_nachfolger(uuid, uuid) to authenticated;

-- Vorschau für den Bild-Umzug: die Action kopiert die Fassungs-Bilder VOR dem
-- Vollzug in den Ordner des Nachfolgers (Storage kann SQL nicht bewegen).
create function plane_konto_uebertragung() returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'training_id', t.id,
           'neuer_owner', training_nachfolger(t.id, auth.uid()),
           'bild_pfade', (
             select coalesce(jsonb_agg(te.bild_url), '[]'::jsonb)
             from training_exercises te
             where te.training_id = t.id and te.bild_url is not null))),
         '[]'::jsonb)
  from trainings t
  where t.owner_id = auth.uid()
    and training_nachfolger(t.id, auth.uid()) is not null;
$$;
revoke all on function plane_konto_uebertragung() from public, anon;
grant execute on function plane_konto_uebertragung() to authenticated;
```

In `delete_account` (bestehende Funktion per `create or replace`, kompletter Body bleibt, NEU als erster Daten-Schritt):

```sql
  -- Übertragungs-Zweig (Team-Epic Story 14): geteilte Trainings wandern zum
  -- dienstältesten verbleibenden Mitglied; die Fassungs-Bilder hat die Action
  -- zuvor in dessen Ordner kopiert — hier wird nur der Verweis umgeschrieben
  -- (Dateiname bleibt <zuordnungs-id>.<ext>, nur der Ordner wechselt).
  update training_exercises te
  set bild_url = replace(te.bild_url,
        '/user/' || v_uid || '/',
        '/user/' || training_nachfolger(t.id, v_uid) || '/')
  from trainings t
  where t.id = te.training_id and t.owner_id = v_uid
    and te.bild_url like '%/user/' || v_uid || '/%'
    and training_nachfolger(t.id, v_uid) is not null;

  update trainings t
  set owner_id = training_nachfolger(t.id, v_uid)
  where t.owner_id = v_uid
    and training_nachfolger(t.id, v_uid) is not null;
  -- Danach greifen die bisherigen Zweige nur noch für nicht übertragbare
  -- Trainings: öffentlich → anonymisieren, privat → löschen (Postcondition 5).
  -- Zusätzlich: Mitgliedschaften des Kontos entfernen (der Auflösen-Trigger
  -- räumt leere Teams); auth.users-Cascade erledigt das sonst erst nach dem
  -- Admin-Schritt und liesse Trainings kurz «mit Geist-Mitglied» zurück.
  delete from team_members where user_id = v_uid;
```

- [ ] **Step 2: deleteAccount-Action erweitern** (`web/lib/actions/auth.ts`), vor dem `delete_account`-RPC:

```ts
  // Team-Epic Story 14: Bilder der zu übertragenden Trainings VOR dem Vollzug
  // in den Ordner des Nachfolgers kopieren (byte-identisch, Admin-Client —
  // fremder Zielordner). Der Dateiname bleibt gleich, nur der Ordner wechselt;
  // delete_account schreibt anschliessend die bild_url passend um.
  const { data: plan } = await supabase.rpc("plane_konto_uebertragung");
  const uebertragungen = (plan ?? []) as {
    training_id: string; neuer_owner: string; bild_pfade: string[];
  }[];
  const admin = createAdminClient();
  const alteKopien: string[] = [];
  for (const u of uebertragungen) {
    for (const url of u.bild_pfade) {
      const alt = bildUrlToPath(url);
      if (!alt) continue;
      const datei = alt.slice(alt.lastIndexOf("/") + 1);
      const neu = `user/${u.neuer_owner}/${datei}`;
      const { error } = await admin.storage.from(STORAGE_BUCKET).copy(alt, neu);
      // "already exists" (Wiederanlauf) ist kein Fehler; alles andere bricht
      // die Konto-Löschung ab, bevor irgendetwas Unumkehrbares passiert ist.
      if (error && !/exists|duplicate/i.test(error.message))
        return; // Meldung analog bestehendem Fehlerpfad
      alteKopien.push(alt);
    }
  }
```
Nach erfolgreichem RPC: `alteKopien` per Admin-Client entfernen. Wichtig: die bestehende Sammlung „Bilder privater Trainings löschen" muss übertragene Trainings **ausnehmen** (sie gehören jetzt jemand anderem) — Filter über die `training_id`s aus `uebertragungen`.

- [ ] **Step 3: Datenebene-Test Übertragung.** Szenario auf frischer DB: A + B im Team, A teilt privates Training mit Fassungs-Bild (Bild-Datei real via Storage-Copy anlegen), A löscht Konto (Action per E2E oder RPC-Kette manuell). Expected: Training gehört B (`owner_id`), `bild_url` zeigt auf `user/<B>/…`, Datei existiert dort; ein NICHT geteiltes privates Training von A ist gelöscht; ein öffentliches ungeteiltes ist anonymisiert (`owner_id is null`). Teams ohne A bestehen fort bzw. lösen sich auf, wenn A letztes Mitglied war.

- [ ] **Step 4: `gen:types` + `typecheck` + Commit** — `feat(db): Konto-Löschung überträgt geteilte Trainings an ein verbleibendes Mitglied (Team-Epic Story 14)`

### Task A4: Listen-Query absichern — geteilte Trainings gehören nicht in den Community-Pool

**Files:**
- Modify: `web/lib/queries/trainings.ts` (`getTrainingList` bzw. die Listen-Funktion mit den Filtern `mine`/`visibility`)

Die RLS-Lockerung macht geteilte private Trainings für Mitglieder sichtbar — die Community-Übersicht («Alle») würde sie sonst wie öffentliche zeigen (Story-1-Lösungsansatz 6). Bis Teil C die eigene Facette bringt, grenzt die Listen-Query explizit ein.

- [ ] **Step 1:** In der Listen-Query (nicht in Detail-Queries!) den Default-Scope explizit machen:

```ts
  // Team-geteilte Trainings sind per RLS sichtbar, gehören aber nicht in den
  // Community-Pool: die Übersicht zeigt Öffentliches und Eigenes; Geteiltes
  // bekommt in Teil C eine eigene Facette (Epic EK 22).
  query = query.or(`visibility.eq.public,owner_id.eq.${user?.id ?? "00000000-0000-0000-0000-000000000000"}`);
```

- [ ] **Step 2:** `typecheck` + Browser-Stichprobe: Übersicht zeigt wie bisher nur Öffentliches + Eigenes. **Step 3: Commit** — `fix(trainings): Übersicht zeigt Team-geteilte Trainings nicht im Community-Pool`

### Task A5: Teil-A-Gesamtverifikation + PR 1

- [ ] **Step 1:** `npm run db:reset` + `npm run seed` (CI-Pfad) → grün; `npm run build` → grün.
- [ ] **Step 2:** Datenebene-Szenarien aus A2/A3 einmal am Stück auf frischer DB.
- [ ] **Step 3:** Sync-Workflow nachführen: neue public-Tabellen in `PUBLIC_TABLES` von `.github/workflows/sync-staging.yml` ergänzen (`teams`, `team_members`, `training_shares`, `training_termine`, `profiles`) — der Guard bricht sonst ab (CLAUDE.md).
- [ ] **Step 4:** PR 1 auf `develop`: «feat(team): Fundament — Datenmodell, RLS, RPCs, Konto-Übertragung (Team-Epic Stories 1/2/14)». Review einholen; Staging-Deploy prüfen. **Kein Prod-Merge ohne Freigabe.**

---

## Teil B — Team-Verwaltung (PR 2: Stories 2-UI, 3, 4, 13)

### Task B1: Anzeigename im Konto

**Files:**
- Create: `web/lib/actions/profil.ts`
- Modify: `web/app/konto/KontoClient.tsx`, `web/app/konto/page.tsx`

**Interfaces:**
- Produces: `setzeAnzeigename(name: string) → {ok:true} | {ok:false; error:string}` (Server Action, upsert auf `profiles`); Konto-Seite lädt `anzeige_name` via `supabase.rpc("anzeige_name", {p_user: user.id})`.

- [ ] **Step 1:** Action schreiben (upsert `profiles` mit `onConflict: "user_id"`, leerer Name → Fehler «Bitte einen Anzeigenamen angeben.»; `revalidatePath("/konto")`).
- [ ] **Step 2:** Konto-Seite: `TextField` «Anzeigename» mit aktuellem Wert (Auto-Name als Platzhalter sichtbar), Hinweistext: «Dein Anzeigename ist für Team-Mitglieder und an deinen öffentlichen Trainings sichtbar.» (PO-Entscheid Öffentlichkeit transparent machen.)
- [ ] **Step 3:** E2E: Name setzen → erscheint; leeren → Fehler. **Step 4: Commit** — `feat(konto): Anzeigename wählbar (Team-Epic Story 2)`

### Task B2: Teams-Seiten — anlegen, umbenennen, Mitglieder, verlassen, auflösen

**Files:**
- Create: `web/app/teams/page.tsx`, `web/app/team/[id]/page.tsx`, `web/lib/queries/teams.ts`, `web/lib/actions/teams.ts`, `web/components/team/TeamKopf.tsx`, `web/components/team/MitgliederListe.tsx`
- Modify: `web/components/ui/Header`-Navigation (Eintrag «Teams» im Konto-Menü)

**Interfaces:**
- Produces (queries/teams.ts): `getMeineTeams() → {id, name, mitgliederAnzahl}[]`; `getTeam(id) → {id, name, mitglieder: {userId, anzeigeName, istIch}[]} | null`.
- Produces (actions/teams.ts): `erstelleTeam(name)` (ruft `create_team`, redirect `/team/<id>`); `benenneTeamUm(teamId, name)`; `entferneMitglied(teamId, userId)` (auch für sich selbst = verlassen; bei letztem Mitglied löst der DB-Trigger das Team, danach redirect `/teams?aufgeloest=1`); `loeseTeamAuf(teamId)` (delete teams, Bestätigungs-`Dialog` im UI mit Anzahl Teilungen/Termine — Zählung via `select count(*)` auf `training_shares`/`training_termine`).

`getTeam` liest Mitglieder als `team_members`-Select + je `anzeige_name(user_id)` — **nie** die E-Mail (NFR). PostgREST-Weg: `team_members?select=user_id` und Namen per `rpc('anzeige_name')` je Mitglied ODER eine kleine definer-View; im Plan: eigene RPC `team_mitglieder(p_team uuid) → jsonb` (definer, membership-check erste Anweisung, liefert `[{user_id, anzeige_name}]`) — eine Round-Trip, kein E-Mail-Risiko. Diese RPC in einer Teil-B-Migration ergänzen.

- [ ] **Step 1:** Migration `team_mitglieder`-RPC (Muster wie `add_team_member`, nur lesend).
- [ ] **Step 2:** Queries + Actions schreiben (Fehlerbilder: RLS-Nulltreffer → «Team nicht gefunden.»).
- [ ] **Step 3:** `/teams`: Karte je Team (`Card`), Button «Neues Team» (Formular mit `TextField`); `/team/[id]`: `TeamKopf` (Name inline umbenennbar — Muster: Trainingsname-Edit im TrainingEditor), `MitgliederListe` (Anzeigename, «Entfernen»-`IconButton`, eigener Eintrag «Verlassen»), Danger-Zone «Team auflösen» mit `Dialog` («N geteilte Trainings verlieren ihre Teilung, M Termine entfallen. Die Trainings bleiben bei ihren Eigentümern.»).
- [ ] **Step 4:** Styleguide: keine neuen Kit-Primitiven erwartet; falls doch (z. B. Mitglieder-Zeile), im Styleguide ergänzen.
- [ ] **Step 5:** E2E: Team anlegen → umbenennen → auflösen (Dialog-Zahlen stimmen). **Step 6: Commit** — `feat(team): Teams anlegen, umbenennen, verwalten, auflösen (Stories 3/13)`

### Task B3: Mitglied per E-Mail aufnehmen

**Files:**
- Modify: `web/components/team/MitgliederListe.tsx`, `web/lib/actions/teams.ts`

**Interfaces:**
- Produces: `nimmMitgliedAuf(teamId, email) → {ok:true; anzeigeName:string} | {ok:false; error:string}` — mappt die RPC-Stati: `nicht_gefunden` → «Unter dieser E-Mail-Adresse ist niemand registriert.», `bereits_mitglied` → «Ist bereits Mitglied dieses Teams.»

- [ ] **Step 1:** Action + Formularzeile (TextField type=email + Button «Aufnehmen», Erfolg als `Snackbar` «‹Name› ist jetzt Mitglied.»).
- [ ] **Step 2:** E2E mit zwei Usern: B aufnehmen → B sieht `/team/[id]` und die geteilten Inhalte sofort. **Step 3: Commit** — `feat(team): Trainer per E-Mail aufnehmen (Story 4)`

### Task B4: Teil-B-Verifikation + PR 2

- [ ] Typecheck, Build, E2E-Durchlauf (beide User), PR 2 auf `develop`: «feat(team): Team-Verwaltung (Stories 2–4, 13)». Review; Staging prüfen.

---

## Teil C — Teilen & gemeinsames Bearbeiten (PR 3: Stories 5, 6, 12)

### Task C1: Training mit Team teilen / Teilung aufheben

**Files:**
- Create: `web/components/training/TeilenControl.tsx`, `web/lib/actions/teilen.ts`
- Modify: `web/components/training/TrainingEditor.tsx` (Kopfbereich neben Sichtbarkeit)

**Interfaces:**
- Produces: `teileTraining(trainingId, teamId)`, `hebeTeilungAuf(trainingId, teamId) → {ok…}`; Query `getTeilungen(trainingId) → {teamId, teamName, terminAnzahl}[]` (terminAnzahl via `training_termine`-Count je Teilung — AK 20, in Teil C noch immer 0, Anzeige ab Teil D relevant).
- Sichtbarkeitsregel: Das Control erscheint **nur für den Eigentümer** (RLS erzwingt es ohnehin — ts_insert/ts_delete).

- [ ] **Step 1:** Actions (Insert/Delete auf `training_shares`; Delete-Dialog: «Die Teilung mit ‹Team› aufheben? N Termine entfallen.» — Zahl aus `getTeilungen`).
- [ ] **Step 2:** `TeilenControl`: Menü «Mit Team teilen» (Liste `getMeineTeams`, bereits geteilte mit Häkchen), pro Teilung «Aufheben» mit `Dialog`.
- [ ] **Step 3:** E2E: teilen → B sieht das Training; aufheben → B sieht es nicht mehr. **Step 4: Commit** — `feat(team): Training mit Team teilen und Teilung aufheben (Story 5)`

### Task C2: Editor für Mitglieder öffnen

**Files:**
- Modify: `web/lib/queries/trainings.ts` (Editor-Lader: heutige Owner-Bedingung), `web/lib/queries/fassung.ts` (`.eq("trainings.owner_id", user.id)` → Zugriffsprüfung), `web/lib/actions/fassung.ts` (`ladeFassung`: owner-Vergleich), `web/lib/actions/trainings.ts` (alle `.eq("owner_id", user.id)`-Guards der Mutations-Actions ausser Sichtbarkeit/Löschen/Teilen)

Die RLS erlaubt Mitgliedern bereits alles Nötige — die App-Schicht prüft heute aber zusätzlich owner-only (Story-1-Lösungsansatz 3). Muster der Lockerung: statt `owner === userId` eine geteilte Hilfsfunktion

```ts
// web/lib/training-zugriff.ts (neu, nicht "use server")
/** Darf der USER dieses Training bearbeiten? Eigentümer oder Team-Mitglied —
 *  die RLS erzwingt dasselbe serverseitig; hier geht es um klare Meldungen
 *  und darum, den Editor überhaupt zu laden. */
export async function darfBearbeiten(
  supabase: SupabaseClient, trainingId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("hat_team_zugriff", { p_training: trainingId });
  if (data === true) return true;
  const { data: t } = await supabase
    .from("trainings").select("owner_id").eq("id", trainingId).maybeSingle();
  const { data: { user } } = await supabase.auth.getUser();
  return !!t && !!user && t.owner_id === user.id;
}
```

**Owner-only bleiben:** `publishTrainingAction`/`unpublishTrainingAction` (RPC prüft), `deleteTraining`, `teileTraining`/`hebeTeilungAuf`. **Fehler-Mapping:** Der Trigger-Fehler `SICHTBARKEIT_NUR_EIGENTUEMER` (z. B. Mitglied leert den Hauptteil eines öffentlichen Trainings) wird in `removeTrainingExercise`/`updateFassung` erkannt (`error.message.includes("SICHTBARKEIT_NUR_EIGENTUEMER")`) und als «Diese Änderung würde das Training aus der Öffentlichkeit nehmen — das kann nur sein Eigentümer ‹Anzeigename›.» gemeldet.

- [ ] **Step 1:** Hilfsfunktion + Lockerungen einbauen; Owner-only-Aktionen im Editor für Mitglieder ausblenden (`istEigentuemer`-Prop; Sichtbarkeits-Control und Löschen nur für Eigentümer, EK 6).
- [ ] **Step 2:** E2E als Mitglied B: Übung hinzufügen, Fassung bearbeiten, Diagramm speichern — alles wirksam; Sichtbarkeit umschalten nicht angeboten; Hauptteil eines öffentlichen geteilten Trainings leeren → verständliche Fehlermeldung. **Step 3: Commit** — `feat(team): geteilte Trainings gemeinsam bearbeiten (Story 6)`

### Task C3: Übersicht — Facette «Mit mir geteilt» (EK 22)

**Files:**
- Modify: `web/lib/queries/trainings.ts` (Listen-Query: neuer Filter `geteilt?: boolean`), `web/app/trainings/…` (Filter-UI: bestehende `FilterChip`/`SegmentedControl`-Leiste um «Mit mir geteilt» ergänzen), `web/components/…TrainingCard` (Badge «Team: ‹Name›» auf geteilten Karten)

- [ ] **Step 1:** Query: `geteilt=true` → nur Trainings mit `hat_team_zugriff` und `owner_id <> user.id`; PostgREST-Weg: Inner-Join-Embed `training_shares!inner(team_id, teams(name))` plus `.neq("owner_id", user.id)` (die A4-Eingrenzung entfällt für diese Facette).
- [ ] **Step 2:** UI-Facette + Badge; E2E: B sieht das geteilte Training unter «Mit mir geteilt», nicht im Community-Pool. **Step 3: Commit** — `feat(trainings): Facette «Mit mir geteilt» (Story 12)`

### Task C4: Teil-C-Verifikation + PR 3

- [ ] Typecheck, Build, E2E beide User (teilen → gemeinsam bearbeiten → Facette), PR 3 auf `develop`. Review; Staging prüfen.

---

## Teil D — Termine & Trainingsplan (PR 4: Stories 7, 8, 9, 10)

### Task D1: Termin-Datenpfad

**Files:**
- Create: `web/lib/queries/termine.ts`, `web/lib/actions/termine.ts`

**Interfaces:**
- Produces (queries): `getTeamPlan(teamId) → {id, datum, beginn, ort, bemerkung, training: {id, name, stufen}}[]` — sortiert `datum asc, beginn asc nulls last` (AK 19), ein Select mit Embed auf `trainings` (NFR: <1 s bei 100 Terminen — ein Query, Index aus A1 deckt ihn); `getTerminAnzahl(trainingId) → number` (für Editor-Hinweis und Lösch-Dialoge).
- Produces (actions): `erstelleTermin(teamId, trainingId, {datum, beginn?, ort?, bemerkung?})` — Datum Pflicht, Vergangenheit erlaubt (AK 17, J+S-Nachweis); `aktualisiereTermin(id, felder)`; `entferneTermin(id)` (Story 9 — löscht NUR den Termin).

- [ ] **Step 1:** Queries/Actions schreiben; Validierung: `datum` als `YYYY-MM-DD` (Date-Input), `beginn` als `HH:MM` oder leer; `ort`/`bemerkung` getrimmt, leer → null.
- [ ] **Step 2:** Datenebene-Test: 3 Termine (gestern ohne Beginn, heute 18:00, heute 17:30) → Reihenfolge gestern, 17:30, 18:00? Nein — gestern zuerst (Datum), dann 17:30, 18:00; Termin ohne Beginn am selben Tag zuletzt. Mehrere Termine desselben Trainings ohne Duplikat (AK 15/16). **Step 3: Commit** — `feat(team): Termin-Datenpfad (Story 7, Datenteil)`

### Task D2: Trainingsplan-Ansicht auf `/team/[id]`

**Files:**
- Modify: `web/app/team/[id]/page.tsx`
- Create: `web/components/team/TrainingsPlan.tsx`, `web/components/team/TerminForm.tsx`

- [ ] **Step 1:** `TrainingsPlan`: chronologische Liste (vergangene Termine gedämpft dargestellt, aber vorhanden — EK 16), je Zeile Datum · Beginn · Trainingsname (Link auf `/training/[id]`) · Ort · Bemerkung · Entfernen-`IconButton` mit `Dialog` («Nur diesen Termin entfernen? Das Training bleibt unverändert.» — Story 9).
- [ ] **Step 2:** `TerminForm` («Termin ansetzen»): Select über die mit DIESEM Team geteilten Trainings (`training_shares`-Embed), Date-Input (nativer `<input type="date">` — neu im Kit? → als `DateField` ins Kit + Styleguide), Beginn (`<input type="time">` analog), Ort/Bemerkung (`TextField`).
- [ ] **Step 3:** E2E: Termin heute + vergangener Termin (J+S) + zweiter Termin desselben Trainings; Reihenfolge korrekt; Termin entfernen lässt Training und andere Termine stehen. **Step 4: Commit** — `feat(team): chronologischer Trainingsplan mit Terminen (Stories 7/9)`

### Task D3: Mehrfachverwendung sichtbar machen + Lösch-Folgen beziffern

**Files:**
- Modify: `web/components/training/TrainingEditor.tsx` (Kopf: Info-Zeile), `web/lib/actions/trainings.ts` (`deleteTraining`-Dialog-Daten), `web/components/training/TeilenControl.tsx` (Termin-Anzahl im Aufheben-Dialog — Anzeige aus C1 wird jetzt real), Trainings-Detailseite (dieselbe Info-Zeile)

- [ ] **Step 1:** Editor/Detail: wenn `getTerminAnzahl(trainingId) > 0`, stille Zeile unter dem Titel: «An N Terminen angesetzt — Änderungen wirken auf alle.» (UX-Frage 3: Hinweis permanent sichtbar statt Dialog je Änderung).
- [ ] **Step 2:** `deleteTraining`-Bestätigung: «Training löschen? N Termine in M Teams entfallen.» (EK 15) — Zählung vor dem Dialog laden; Aufheben-Dialog aus C1 zeigt die echte Termin-Anzahl je Teilung.
- [ ] **Step 3:** E2E: Training an 2 Terminen → Hinweis-Zeile da; Löschen-Dialog zeigt «2 Termine»; Teilung aufheben entfernt beide Termine, Training bleibt. **Step 4: Commit** — `feat(team): Mehrfachverwendung und Lösch-Folgen sichtbar (Stories 8/10)`

### Task D4: Teil-D-Verifikation + PR 4

- [ ] Typecheck, Build, E2E-Gesamtdurchlauf; NFR-Stichprobe: 100 Termine seeden (SQL-Schleife), `/team/[id]` lädt < 1 s (Server-Timing im Dev-Log). PR 4 auf `develop`. Review; Staging prüfen.

---

## Teil E — Öffentlichkeit & Kopie (PR 5: Stories 11, 15)

### Task E1: Urheber an öffentlichen Trainings (Story 15, EK 19)

**Files:**
- Modify: `web/lib/queries/trainings.ts` (Detail- und Listen-Select um `urheber` erweitern — berechnetes Feld aus A1: `select=…,urheber`), Trainings-Detailseite + TrainingCard («von ‹Anzeigename›»; bei `owner_id is null` — anonymisiert — entfällt die Zeile)

- [ ] **Step 1:** Selects + Anzeige; anonyme Besucher eingeschlossen (profiles-Select-Policy erlaubt es, `anzeige_name` ist `stable sql` — funktioniert im PostgREST-Embed).
- [ ] **Step 2:** E2E als Anonymer: öffentliches Training zeigt «von Trainer:in ‹…›» bzw. den gewählten Namen. **Step 3: Commit** — `feat(trainings): Urheber-Anzeige an öffentlichen Trainings (Story 15)`

### Task E2: Fremdes öffentliches Training als Kopie übernehmen (Story 11, EK 17)

**Files:**
- Create: `web/lib/actions/training-kopie.ts`, `web/components/training/TrainingUebernehmenButton.tsx`
- Modify: Trainings-Detailseite (Button für eingeloggte Nicht-Eigentümer)

**Interfaces:**
- Consumes: `kopiereBild`, `kopiereDiagrammVon`, `inhaltFelder`, `stempleHerkunft`, `FASSUNG_INHALT_FELDER` aus `web/lib/fassung.ts` (Bausteine aus Epic #72 — exakt der Zweck, für den sie geteilt wurden).
- Produces: `uebernimmTraining(trainingId) → {ok:true; neueId:string} | {ok:false; error:string}` — legt ein neues privates Training des USERS an (Name + Stufen kopiert) und kopiert jede Fassung: `inhaltFelder(q)` + eigene Bildkopie (`kopiereBild` mit der NEUEN Zuordnungs-ID) + `kopiereDiagrammVon` + `stempleHerkunft(q, user.id)` (Ur-Herkunft bleibt — Epic §9 «Fremde Trainings»). Einordnung (`trainingsteil`, `hauptteilkategorie`, `position`, `duration_min`) 1:1.

- [ ] **Step 1:** Action schreiben (Quelle via `getTraining` — RLS: öffentlich lesbar; Insert Training, dann Fassungen sequentiell; bei Bild-Kopierfehler abbrechen und bereits angelegte Kopien aufräumen — Muster `uebernehmeInBibliothek`).
- [ ] **Step 2:** Button «Training übernehmen» auf der Detailseite (nur eingeloggt + nicht Eigentümer), Erfolg → redirect in den Editor der Kopie mit `Snackbar`.
- [ ] **Step 3:** E2E: fremdes öffentliches Training übernehmen → private Kopie mit allen Fassungen, eigenen Bildern (`user/<ich>/<neue-id>.<ext>`), Ur-Herkunft sichtbar; Original unberührt; Kopie mit eigenem Team teilbar. **Step 4: Commit** — `feat(trainings): fremdes Training als eigenständige Kopie übernehmen (Story 11)`

### Task E3: Abschluss — Doku, Verifikation, PR 5

- [ ] **Step 1:** Epic-Doku: §11-Fragen 3–5 mit den umgesetzten Antworten in §9 überführen; `docs/superpowers/specs/2026-08-16-team-trainingsplan-stories.md` um Verweis auf diesen Plan ergänzen.
- [ ] **Step 2:** Typecheck, Build, E2E-Gesamtdurchlauf (Kernpfad: Team → teilen → gemeinsam bearbeiten → terminieren → Konto-Löschung mit Übertragung als Datenebene-Test).
- [ ] **Step 3:** PR 5 auf `develop`. Review; Staging als Generalprobe (inkl. `sync-staging` einmal laufen lassen — prüft den `PUBLIC_TABLES`-Guard aus A5 real). **Prod-Merges aller Teile nur mit expliziter Freigabe.**

---

## Story-Abdeckung (Selbst-Check)

| Story | Tasks |
|---|---|
| 1 (Enabler Datenmodell) | A1, A2, A3, A4 |
| 2 (Anzeigename) | A1 (Funktion), B1 (UI) |
| 3 (Team erstellen/umbenennen) | A2, B2 |
| 4 (Aufnehmen per E-Mail) | A2, B3 |
| 5 (Teilen/Aufheben) | C1 (+ D3 Termin-Anzahl) |
| 6 (Gemeinsam bearbeiten) | C2 |
| 7 (Terminieren + Plan) | D1, D2 |
| 8 (Mehrfach ansetzen + Hinweis) | D1 (kein Duplikat), D3 (Hinweis) |
| 9 (Termin entfernen) | D1, D2 |
| 10 (Lösch-Folgen bestätigen) | D3 |
| 11 (Fremdes Training kopieren) | E2 |
| 12 (Eigene/geteilte getrennt) | A4 (Abgrenzung), C3 (Facette) |
| 13 (Verlassen/Entfernen/Auflösen) | B2 (+ A1-Trigger) |
| 14 (Konto-Übertragung) | A3 |
| 15 (Urheber anzeigen) | A1 (Funktion), E1 (UI) |

## Bewusste Entwurfs-Entscheide (für Review und Refinement)

1. **Termine hängen an der Teilung (Composite-FK)** — Postconditions 1–3 der Story 1 sind damit konstruktiv erfüllt statt per Aufräum-Code.
2. **`ist_team_mitglied`/`hat_team_zugriff` als SECURITY DEFINER** — einzige saubere Lösung gegen die RLS-Selbstrekursion von Mitglieder-Tabellen; die Funktionen sind minimal und lecken nichts (boolean).
3. **Sichtbarkeits-Guard als Trigger, nicht RLS** — RLS kann OLD/NEW nicht vergleichen; der Trigger deckt zugleich die Auto-Privatisierung durch Mitglieder-Aktionen ab (AK 12) und lässt Service-Role-Läufe (auth.uid() null) unangetastet.
4. **`delete_account`-Übertragung zweiphasig (Action kopiert Bilder, RPC vollzieht)** — Storage lässt sich aus SQL nicht bewegen; die deterministischen Fassungs-Bildpfade (`user/<owner>/<teId>.<ext>`) aus Epic #72 machen den Umzug zu Copy + `replace()` der URL.
5. **Auto-Anzeigename aus der User-ID, nie aus der E-Mail** — sonst verletzte die bequemste Lösung (E-Mail-Localpart) direkt NFR 4.
6. **`add_team_member` legt offen, ob eine E-Mail registriert ist** — unvermeidbare Folge des PO-Modells «Einladung nur an Registrierte, sofort wirksam»; im Code als bewusste Entscheidung kommentiert.
7. **Story 11 kopiert mit den #72-Bausteinen** — `kopiereBild`/`inhaltFelder`/`stempleHerkunft` wurden genau dafür geteilt; keine neue Kopier-Logik.
8. **Löschen und Teilen bleiben owner-only** — «gleichberechtigt bearbeiten» (EK 5/Story 6) heisst Inhalt, nicht Bestand: Sichtbarkeit (EK 6), Löschen (Story 10: «Ein Trainer … seines Trainings») und Teilung (Story 5: «eines seiner Trainings») verantwortet der Eigentümer.
