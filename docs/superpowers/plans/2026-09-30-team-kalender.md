# Team-Kalender Implementation Plan (Epic #321)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Team legt Trainingszeiten als Termine im Kalender fest, einzeln oder als wöchentliche Terminserie, und ordnet ihnen danach Trainings aus dem Team-Bestand oder persönliche Trainings zu. Dazu kommen Verantwortliche, Ausfälle, ein Monatsüberblick und ein persönliches Kalender-Abo. Alles ausser dem Abo geht auch über den KI-Assistenten.

**Architecture:** Der Termin gehört neu dem Team (`training_termine.team_id`) statt seinem Training. `training_id` wird freiwillig und bei `on delete set null` belassen; UNIQUE bleibt, damit ein Training höchstens einen Termin trägt. Terminserien (`termin_serien`) legen ihre Termine als echte Zeilen an. Jeder Serientermin merkt sich seinen Serientag (`serien_tag`) und je Angabe, ob er von der Serie abweicht (`*_abweichend`). Serienänderungen mit Reichweite laufen in **einer** plpgsql-Funktion, die dieselbe Rechnung als Vorschau (Rollback) oder als Ausführung fährt. So stimmen die Vorab-Auskunft zu belegten entfallenden Terminen und das Ergebnis immer überein. Gleichzeitige Änderungen fängt eine einheitliche optimistische Prüfung ab. Die Oberfläche sendet die Erwartung, die sie angezeigt hat (Training des Termins, Serienversion, belegte entfallende Termine); der KI-Weg sendet keine. Alle Regeln liegen im Fachkern (`web/lib/kern/*`), den Server Actions und KI-Werkzeuge gleichermassen aufrufen. Das Abo ist ein anonym abrufbarer iCalendar-Feed hinter einem geheimen Token.

**Tech Stack:** Next.js 15 (RSC + Server Actions + Route Handler), Supabase (Postgres, RLS, SECURITY-DEFINER-RPCs), TypeScript, zod 4, MCP (`@modelcontextprotocol/server`, `mcp-handler`), iCalendar RFC 5545 (handgeschrieben, keine neue Abhängigkeit).

**Spec:** Epic [adbstyle/kifutraining#321](https://github.com/adbstyle/kifutraining/issues/321) mit den Stories #322–#330 (alle READY seit 2026-09-30). Massgeblich sind die Issue-Texte. Die PO-Entscheide 1–18 stehen im Epic-Abschnitt «Abgrenzung». Jeder Task nennt die AK/PC-Nummern, die er umsetzt.

| Story | Issue | Teil |
|---|---|---|
| 1 Termin ohne Training | #322 | A |
| 2 Training zuordnen und lösen | #323 | A |
| 3 Terminserie festlegen | #324 | B |
| 5 Terminserie ändern, verkürzen, entfernen | #326 | B |
| 4 Verantwortliche | #325 | C |
| 6 Ausfall | #327 | D |
| 7 Persönliches Training zuordnen | #328 | E |
| 8 Monatsüberblick | #329 | F |
| 9 Kalender-Abo | #330 | G |

## Global Constraints

- Projektsprache Deutsch: Code-Kommentare, Commit-Messages, UI- und KI-Texte (CLAUDE.md).
- **Forward-only**: Es gibt echte Nutzer, also keine destruktiven Migrationen. Verschärfungen auf Bestandstabellen laufen über Backfill oder `NOT VALID` plus späteres `VALIDATE`. Eine Lock-Schranke (`set lock_timeout = '5s';`) gehört an den Dateianfang, `reset lock_timeout;` ans Ende. Kein `set local`.
- Trigger immer explizit droppen (Trigger → Funktion → Spalten). Postgres trackt die Abhängigkeit nicht.
- `db push` und der Vercel-Build laufen parallel. Keine Spalte umbenennen oder im Typ ändern, die das alte Bundle liest (Memory «Spaltentyp Expand/Contract»). Die Tabelle heisst darum weiter `training_termine`.
- Supabase server-only: keine `NEXT_PUBLIC_*`-Variablen. Clients kommen aus `web/lib/supabase/server.ts`, `bearer.ts` oder dem neuen `anon.ts` (Teil G). `admin.ts` bleibt Seed und Aufräumen vorbehalten.
- Mehrstufige Mutationen laufen als `SECURITY DEFINER`-RPC. Deren erste Anweisung ist die Anmeldeprüfung, die zweite die Mitgliedschaft (`ist_team_mitglied`). Jede RPC erhält `revoke all … from public, anon; grant execute … to authenticated;`, ausser dem Abo-Feed (Teil G).
- Fachkern-Konvention (`web/lib/kern/ergebnis.ts`): `(supabase, userId, eingabe) → Promise<KernErgebnis<T>>`, wirft nie. Eingaben und `wert` sind camelCase, `feld` ist der snake_case-Name des KI-Feldes. `lib/kern/*.ts` trägt `import "server-only";` und importiert weder `next/*` noch `@/lib/actions/*` noch `@/lib/mcp/*` (Wächter in `check:kern`).
- Client-Komponenten importieren aus `lib/queries/*` nur Typen, Werte (etwa `nochNichtVorbereitet`) nur aus den `*-fuer.ts`-Dateien. Die Cookie-Wrapper ziehen sonst `next/headers` ins Client-Bundle.
- Reine Regelmodule (`web/lib/termin.ts`, `web/lib/serie.ts`, `web/lib/monat.ts`, `web/lib/ical.ts`) haben **keine** Importe ausser untereinander. `check:kern` lädt sie mit tsx.
- Meldungen sind wortgleich in Oberfläche und KI (jede Story, «wortgleiche Meldungen»). Jede Meldung steht einmal als Konstante, und Tests prüfen den Wortlaut.
- Der KI-Werkzeugsatz ist die Zugangsgrenze. Jede Story erweitert `ZUGANG_DARF` in `web/lib/mcp/umfang.ts`, ohne erneute Zustimmung (PO-Entscheid 14). Sie führt die Namensliste in `web/scripts/pruefe-kern.ts` («jeStory») nach. Jedes Werkzeug mit `termin_id` nennt `TERMIN_KENNUNG_FEHLER`, jedes mit `team_id` nennt `TEAM_KENNUNG_FEHLER`.
- Styleguide-first: neue UI-Bausteine nach `web/components/ui` mit Demo in `web/app/styleguide`. Secondary-Farbe ist verboten (`check:farben`).
- «ansetzen» kommt ab Teil A in keinem nutzersichtbaren Text mehr vor (Story 2 PC 11). Es heisst «eingeplant» und «zuordnen».
- Neue public-Tabellen gehören in `PUBLIC_TABLES` von `.github/workflows/sync-staging.yml`, bytewise sortiert (collate "C").
- `npm run typecheck` prüft auch `web/scripts/`. Wächst `TerminZeile` (B4, C2, D2), die Fixtures in `pruefe-kern.ts` (A3 `nochNichtVorbereitet`, Auskunft mit Termin) im selben Task um die neuen Felder ergänzen.
- Nach jedem Migrations-Task: `npm run db:reset` (aus `web/`), danach `npm run gen:types` und `npm run typecheck`. Danach den E2E-User neu anlegen (siehe CLAUDE.md, `db:reset` wischt `auth.users`).
- Ein PR je Teil auf `develop`, mit Commit pro Task. **Prod-Merge (develop → main) nur mit ausdrücklicher Freigabe des Users im Moment.** Release-Kopplung: Teil A (Stories 1+2) und Teil B (Stories 3+5) gehen je als Ganzes nach Prod. Jede Prod-Freigabe braucht die nachgeführte Produktdoku (`docs/produkt/`) und ein GitHub-Release (Memory).
- Arbeit in einem eigenen Worktree auf Basis `develop` (CLAUDE.md «Ein Worktree pro Session»).

## Review Focus

Diese fünf Eingaben und Zustände deckt kein Story-Satz wörtlich ab. Sie beissen im Betrieb am ehesten; jede Zeile hat ihren Test im genannten Task.

1. **Tage um die Zeitumstellung und Mitternacht.** Ein Serientermin am letzten Märzsonntag um 02:30 oder eine 90-Minuten-Ergänzung ab 23:00 müssen im Abo zur Schweizer Wanduhrzeit erscheinen und dürfen nicht verrutschen. Nach 23:00 endet ein Termin am Folgetag. → Test in G2 (`lib/ical.ts`).
2. **Schaltjahr-Grenze der Serie.** Der Beginn 2028-02-29 erlaubt höchstens das Ende 2029-02-28. Das gilt beim Festlegen, beim Ändern des Beginndatums mit «dieser und folgende» und beim KI-Zeitraum. → Tests in B2 (`maxEnddatum`) und F1.
3. **Wochentag-Tausch über die Wochengrenze.** Sonntag → Montag verlegt in dieselbe ISO-Woche, also sechs Tage zurück. Liegt der Montag vor heute, wird ein anstehender Sonntagstermin entfernt statt in die Vergangenheit verlegt. → Test in B5 (DB-Szenario «Tausch So→Mo»).
4. **Gleichzeitige Bearbeitung.** Zwei Mitglieder haben denselben Termin oder dieselbe Serie offen. Die Aktion des zweiten wird nur abgewiesen, wenn sich etwas geändert hat, das ihr Ergebnis oder ihre Vorab-Auskunft verändert (PO 17). Sonst geht sie durch. → Tests in A4, B4, C2, D2.
5. **Bestandstermine mit unvollständigen Angaben.** Termine ohne Beginn oder Ende müssen sich überall anzeigen, ändern (ohne die Zeit zu erzwingen), abonnieren (ganztägig oder 90 Minuten) und im Monatsüberblick kennzeichnen lassen. → Tests in A2, A4, F2 (Browser), G2.

---

## Zielmodell nach allen Teilen (Überblick)

```
teams 1─* training_termine (team_id NOT NULL, on delete cascade)
            id, team_id, datum, beginn, ende, ort, bemerkung,
            training_id  → trainings  (NULL erlaubt, UNIQUE, on delete set null)   [A]
            serie_id, serien_tag     → termin_serien (serie_id, team_id)           [B]
            zeit_abweichend, ort_abweichend, bemerkung_abweichend                  [B]
            verantwortliche_abweichend                                              [C]
            ausgefallen, ausfall_grund                                              [D]
teams 1─* termin_serien   id, team_id, wochentage smallint[] (ISO 1–7), beginn_datum,
                          end_datum, beginn, ende, ort, bemerkung, version          [B]
termin_serien 1─* termin_serien_luecken (serie_id, tag)  – einzeln entfernte Serientage [B]
training_termine 1─* termin_verantwortliche (termin_id, user_id NULL = gelöschtes Konto) [C]
termin_serien 1─* termin_serien_verantwortliche (serie_id, user_id)                 [C]
teams 1─* kalender_abos (team_id, user_id, token) UNIQUE (team_id, user_id)         [G]
```

Invarianten:
- Ein Termin trägt höchstens ein Training. Ein Training ist höchstens für einen Termin eingeplant (UNIQUE `training_id`). Training und Termin gehören demselben Team (Trigger `termin_training_im_team`).
- Werte eines Serientermins stehen immer materialisiert in seiner Zeile. «Folgt der Serie» heisst: Das Flag `*_abweichend` ist `false`, und Serienänderungen schreiben den Wert mit.
- Das Datum weicht ab, wenn `datum <> serien_tag` (PO 3). Man kann es nicht «wieder folgen lassen».
- Ein ausgefallener Termin trägt kein Training (`check`).
- Heute ist `heute_am_trainingsort()` in SQL beziehungsweise `heuteAmTrainingsort()` in TS: der Kalendertag in Europe/Zurich. Anstehend heisst `datum >= heute`.

## Rollout

| Teil | Stories | PR auf develop | Prod |
|---|---|---|---|
| A | #322 + #323 | «feat(kalender): Termine ohne Training und Zuordnen» | Release 1 |
| B | #324 + #326 | «feat(kalender): Terminserien» | Release 2 |
| C | #325 | «feat(kalender): Verantwortliche» | Release 3 |
| D | #327 | «feat(kalender): Ausfall» | Release 3 oder 4 |
| E | #328 | «feat(kalender): persönliches Training zuordnen» | frei |
| F | #329 | «feat(kalender): Monatsüberblick» | frei |
| G | #330 | «feat(kalender): Kalender-Abo» | frei |

Die Reihenfolge folgt den Abhängigkeiten im Epic. E, F und G sind nach D voneinander unabhängig und können parallel laufen, aber je in einem eigenen Worktree. Zu jedem Prod-Release gehört Task Z (Produktdoku und Release) am Ende dieses Plans.

---

## Teil A — Termine ohne Training und Zuordnen (Stories #322 + #323, PR 1, Release 1)

Stories 1 und 2 gehen zusammen nach Prod: Das alte Ansetzen und das Zuordnen dürfen nie gleichzeitig bestehen (Epic, Abhängigkeitszeile).

### Task A1: Migration — Termin gehört dem Team, Zuordnen und Entfernen als RPC

**Files:**
- Create: `supabase/migrations/<zeitstempel>_termine_ohne_training.sql` (aus `web/`: `npx supabase migration new termine_ohne_training --workdir ..`)

**Interfaces:**
- Produces:
  - SQL-Funktion `heute_am_trainingsort() → date`
  - Spalten `training_termine.team_id uuid NOT NULL` und `training_termine.ende time`
  - `training_id` nullable mit `on delete set null`
  - Trigger `termin_training_im_team`, Marker `TERMIN_TRAINING_FREMDES_TEAM`
  - RPC `termin_training_setzen(p_termin uuid, p_training uuid, p_verschieben boolean, p_erwartet jsonb) → jsonb {bisher, frei}`
  - RPC `termin_entfernen(p_termin uuid, p_erwartet jsonb) → jsonb {training, team}`
  - Marker `TERMIN_NICHT_GEFUNDEN`, `TRAINING_NICHT_GEFUNDEN`, `TERMIN_BELEGUNG_GEAENDERT`, `TRAINING_EINPLANUNG_GEAENDERT`, `TRAINING_SCHON_EINGEPLANT`, `NUR_KOPIE_BEI_VERGANGENEM`

- [ ] **Step 1: Migration schreiben**

```sql
-- ============================================================================
-- Team-Kalender (Epic #321), Story 1 (#322) + Story 2 (#323).
-- Ein Termin gehört dem Team, nicht mehr seinem Training: Er besteht auch
-- ohne Training, trägt Beginn und Ende und überdauert das Löschen seines
-- Trainings. Ein Training kommt nur noch durch Zuordnen auf ein Datum.
-- ============================================================================
set lock_timeout = '5s';

-- Heute am Trainingsort: die eine Grenze zwischen anstehend und vergangen
-- (Zwilling von heuteAmTrainingsort() in web/lib/zeit.ts).
create function heute_am_trainingsort() returns date
language sql stable
set search_path = public, pg_temp
as $$ select (now() at time zone 'Europe/Zurich')::date $$;
grant execute on function heute_am_trainingsort() to anon, authenticated;

-- 1) Der Termin gehört dem Team (Story 1 AK 1, PC 9) ------------------------
alter table training_termine
  add column team_id uuid references teams(id) on delete cascade,
  add column ende time;

-- Backfill: Jeder Bestandstermin hängt an einem Team-Training (bisheriger
-- Trigger termin_nur_fuer_team_trainings). `updated_at` bleibt unberührt —
-- der Bestand gilt als unverändert (PC 5), und das Abo (Teil G) liest es als
-- LAST-MODIFIED.
alter table training_termine disable trigger training_termine_set_updated_at;
update training_termine tt set team_id = t.team_id
  from trainings t where t.id = tt.training_id;
alter table training_termine enable trigger training_termine_set_updated_at;
alter table training_termine alter column team_id set not null;

-- 2) Der Termin überdauert sein Training (PC 7) ------------------------------
-- UNIQUE (training_id) bleibt: Ein Training ist höchstens für einen Termin
-- eingeplant, ein Termin trägt höchstens ein Training (Epic OoS 3).
alter table training_termine drop constraint training_termine_training_id_fkey;
alter table training_termine alter column training_id drop not null;
alter table training_termine add constraint training_termine_training_id_fkey
  foreign key (training_id) references trainings(id) on delete set null;

-- 3) Zeit und Längen (AK 2, 5, 6; PO 9) --------------------------------------
-- Bestandstermine behalten fehlende Angaben. Die Pflicht für NEUE Termine
-- prüft der Fachkern (lib/termin.ts): Die Datenebene kann «neu» nicht von
-- «Bestand» unterscheiden. Ein Ende setzt einen Beginn voraus und liegt am
-- selben Tag danach.
alter table training_termine add constraint tt_ende_nach_beginn
  check (ende is null or (beginn is not null and ende > beginn));
-- NOT VALID: Bestandstexte wurden nie begrenzt. VALIDATE folgt in Teil B,
-- nachdem der Bestand auf Staging gezählt ist (Task B1 Step 1).
alter table training_termine add constraint tt_ort_laenge
  check (ort is null or char_length(ort) <= 100) not valid;
alter table training_termine add constraint tt_bemerkung_laenge
  check (bemerkung is null or char_length(bemerkung) <= 500) not valid;

-- 4) Training und Termin gehören demselben Team (Story 2 AK 4) --------------
drop trigger termin_nur_fuer_team_trainings on training_termine;
drop function termin_nur_fuer_team_trainings();

create function termin_training_im_team() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.training_id is not null and not exists (
       select 1 from trainings t
        where t.id = new.training_id and t.team_id = new.team_id) then
    raise exception 'TERMIN_TRAINING_FREMDES_TEAM';
  end if;
  return new;
end;
$$;
create trigger termin_training_im_team
  before insert or update of training_id, team_id on training_termine
  for each row execute function termin_training_im_team();

-- 5) RLS über das Team des Termins (AK 22) -----------------------------------
drop policy tt_select on training_termine;
drop policy tt_insert on training_termine;
drop policy tt_update on training_termine;
drop policy tt_delete on training_termine;
create policy tt_select on training_termine for select to authenticated
  using (ist_team_mitglied(team_id));
create policy tt_insert on training_termine for insert to authenticated
  with check (ist_team_mitglied(team_id));
create policy tt_update on training_termine for update to authenticated
  using (ist_team_mitglied(team_id)) with check (ist_team_mitglied(team_id));
create policy tt_delete on training_termine for delete to authenticated
  using (ist_team_mitglied(team_id));

drop index training_termine_plan_idx;
create index training_termine_plan_idx
  on training_termine (team_id, datum, beginn nulls last);

-- 6) Zuordnen, Verschieben, Lösen (Story 2) ----------------------------------
-- Eine Transaktion, weil Verschieben zwei Termine anfasst und UNIQUE
-- (training_id) den bisherigen zuerst freigeben muss. Eine KOPIE legt der
-- Fachkern vorher an (Bilddateien liegen ausserhalb jeder Transaktion) und
-- ruft dann hier mit der Kopie ohne `p_verschieben` auf.
--
-- `p_erwartet` ist, was die Oberfläche bei der Auswahl sah (PO 17):
-- {"termin_training": uuid|null, "training_termin": uuid|null}. Weicht der
-- Stand davon ab, wird abgewiesen; `null` (KI-Weg) prüft nicht.
create function termin_training_setzen(
  p_termin uuid,
  p_training uuid,
  p_verschieben boolean default false,
  p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_termin training_termine;
  v_alt training_termine;
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_termin from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(v_termin.team_id) then
    raise exception 'TERMIN_NICHT_GEFUNDEN';
  end if;
  if p_erwartet is not null
     and v_termin.training_id is distinct from (p_erwartet->>'termin_training')::uuid then
    raise exception 'TERMIN_BELEGUNG_GEAENDERT';
  end if;

  -- Lösen (PC 6): Termin ohne Training, Training ohne Termin im Bestand.
  if p_training is null then
    update training_termine set training_id = null where id = p_termin;
    return jsonb_build_object('bisher', v_termin.training_id, 'frei', null);
  end if;

  select team_id into v_team from trainings where id = p_training for update;
  if not found then raise exception 'TRAINING_NICHT_GEFUNDEN'; end if;
  if v_team is distinct from v_termin.team_id then
    raise exception 'TERMIN_TRAINING_FREMDES_TEAM';
  end if;
  if v_termin.training_id = p_training then
    return jsonb_build_object('bisher', null, 'frei', null);
  end if;

  select * into v_alt from training_termine where training_id = p_training for update;
  if p_erwartet is not null
     and v_alt.id is distinct from (p_erwartet->>'training_termin')::uuid then
    raise exception 'TRAINING_EINPLANUNG_GEAENDERT';
  end if;
  if v_alt.id is not null then
    if not p_verschieben then raise exception 'TRAINING_SCHON_EINGEPLANT'; end if;
    -- AK 11: Ein Training mit vergangenem Termin geht nur als Kopie weiter.
    if v_alt.datum < heute_am_trainingsort() then
      raise exception 'NUR_KOPIE_BEI_VERGANGENEM';
    end if;
    update training_termine set training_id = null where id = v_alt.id;
  end if;

  update training_termine set training_id = p_training where id = p_termin;
  -- PC 4/5: `bisher` bleibt ohne Termin im Bestand, `frei` ist der Termin,
  -- den ein verschobenes Training verlassen hat.
  return jsonb_build_object('bisher', v_termin.training_id, 'frei', v_alt.id);
end;
$$;
revoke all on function termin_training_setzen(uuid, uuid, boolean, jsonb) from public, anon;
grant execute on function termin_training_setzen(uuid, uuid, boolean, jsonb) to authenticated;

-- 7) Termin entfernen (Story 1 AK 11–13, 23; PC 6) ---------------------------
-- Als RPC, weil Teil B hier die Lücke der Serie und das Aufräumen einer leeren
-- Serie in derselben Transaktion ergänzt (create or replace, gleiche Signatur).
create function termin_entfernen(p_termin uuid, p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_termin training_termine;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_termin from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(v_termin.team_id) then
    raise exception 'TERMIN_NICHT_GEFUNDEN';
  end if;
  if p_erwartet is not null
     and v_termin.training_id is distinct from (p_erwartet->>'termin_training')::uuid then
    raise exception 'TERMIN_BELEGUNG_GEAENDERT';
  end if;
  delete from training_termine where id = p_termin;
  -- Das Training bleibt unberührt im Team-Bestand (PC 6).
  return jsonb_build_object('training', v_termin.training_id, 'team', v_termin.team_id);
end;
$$;
revoke all on function termin_entfernen(uuid, jsonb) from public, anon;
grant execute on function termin_entfernen(uuid, jsonb) to authenticated;

reset lock_timeout;
```

- [ ] **Step 2: Anwenden und prüfen**

Run (aus `web/`): `npm run db:reset && npm run gen:types`
Expected: Der Reset läuft ohne Fehler. In `lib/database.types.ts` ist `training_termine.Row.training_id: string | null`, und es gibt `team_id: string` und `ende: string | null`.

Dann `docker exec -i supabase_db_kifu psql -q -U postgres -d postgres -v ON_ERROR_STOP=1 -c "\d training_termine"`
Expected: `training_termine_training_id_fkey … ON DELETE SET NULL`, `training_termine_training_id_key UNIQUE`, Trigger `termin_training_im_team`, kein `termin_nur_fuer_team_trainings`.

- [ ] **Step 3: Fenster festhalten (im PR-Body von Teil A)**
  - **Deploy-Fenster:** `db push` und der Vercel-Build laufen parallel. Bis das neue Bundle live ist (1–3 min), scheitert im alten Bundle das Ansetzen, weil `team_id` fehlt; alles andere läuft weiter. Das ist in Kauf genommen: Prod-Release tagsüber, nicht zu Trainingszeiten am Abend.
  - **sync-staging:** Solange Teil A auf develop und Staging liegt, aber noch nicht auf main und Prod, bricht `sync-staging` am `NOT NULL` von `team_id` ab (Prod-Dump ohne die Spalte). In diesem Fenster nicht syncen. Nach Release 1 geht es wieder, denn der Workflow läuft von main.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_termine_ohne_training.sql web/lib/database.types.ts
git commit -m "feat(kalender): Termin gehört dem Team, Zuordnen und Entfernen als RPC (#322, #323)"
```

### Task A2: Reine Termin-Regeln und Meldungen

**Files:**
- Modify: `web/lib/termin.ts` (ganz ersetzen)
- Modify: `web/lib/training-bedingungen.ts:327-351` (Termin-Marker)
- Test: `web/scripts/pruefe-kern.ts:511-537` (Termin-Blöcke ersetzen)

**Interfaces:**
- Produces:
  - `type TerminFelder = { datum: string; beginn?: string|null; ende?: string|null; ort?: string|null; bemerkung?: string|null }`
  - `type TerminFeld = "datum"|"beginn"|"ende"|"ort"|"bemerkung"`
  - `type TerminProblem = { feld: TerminFeld; text: string }`
  - `ORT_MAX = 100`, `BEMERKUNG_MAX = 500`, `TERMIN_TEXT`
  - `istKalendertag(iso): boolean`, `istUhrzeit(hhmm): boolean`, `leerZuNull(v)`
  - `zeitProblem(beginn, ende): TerminProblem|null`, `textProblem({ort, bemerkung}): TerminProblem|null`
  - `terminProblem(f, bisher?): TerminProblem|null`
  - `TERMIN_MELDUNG: Record<TerminMarker, string>`, `KONFLIKT_MARKER: readonly TerminMarker[]`, `kopieGebliebenText(name): string`
  - `zeitText(beginn, ende): string|null` (Anzeige «18:30–20:00»)

- [ ] **Step 1: Failing test schreiben** — in `web/scripts/pruefe-kern.ts` den Import auf Zeile 74 und die beiden Blöcke ab «── Termin-Felder (#198 AK 7/8)» ersetzen:

```ts
import {
  TERMIN_MELDUNG,
  TERMIN_TEXT,
  kopieGebliebenText,
  leerZuNull,
  terminProblem,
  zeitText,
} from "../lib/termin";
```

```ts
// ── Termin-Felder (#322 AK 2, 5, 6, 8–10) ────────────────────────────────────
pruefe("terminProblem: neuer Termin braucht Datum, Beginn und Ende", () => {
  const ok = { datum: "2026-10-07", beginn: "18:30", ende: "20:00" };
  assert.equal(terminProblem(ok), null);
  assert.equal(terminProblem({ ...ok, datum: "2028-02-29" }), null, "Schalttag");
  for (const datum of ["", undefined, "2026-02-30", "2027-02-29", "2026-13-01", "0000-01-01", "23.09.2026"])
    assert.deepEqual(terminProblem({ ...ok, datum: datum as string }), { feld: "datum", text: TERMIN_TEXT.datum }, `Datum ${datum}`);
  assert.deepEqual(terminProblem({ ...ok, beginn: "" }), { feld: "beginn", text: TERMIN_TEXT.zeitPflicht });
  assert.deepEqual(terminProblem({ ...ok, ende: null }), { feld: "ende", text: TERMIN_TEXT.zeitPflicht });
  for (const beginn of ["25:99", "24:00", "8:30", "18.30", "18:30:00"])
    assert.deepEqual(terminProblem({ ...ok, beginn }), { feld: "beginn", text: TERMIN_TEXT.uhrzeit }, `Beginn ${beginn}`);
  assert.deepEqual(terminProblem({ ...ok, ende: "18:30" }), { feld: "ende", text: TERMIN_TEXT.endeNachBeginn }, "gleich");
  assert.deepEqual(terminProblem({ ...ok, ende: "17:00" }), { feld: "ende", text: TERMIN_TEXT.endeNachBeginn }, "davor");
  assert.deepEqual(terminProblem({ ...ok, ort: "x".repeat(101) }), { feld: "ort", text: TERMIN_TEXT.ortLang });
  assert.equal(terminProblem({ ...ok, ort: "x".repeat(100) }), null);
  assert.deepEqual(terminProblem({ ...ok, bemerkung: "x".repeat(501) }), { feld: "bemerkung", text: TERMIN_TEXT.bemerkungLang });
});

pruefe("terminProblem: Bestand ohne vollständige Zeit bleibt änderbar, eine geänderte Zeit muss vollständig sein", () => {
  const alt = { beginn: "18:30", ende: null };
  // AK 9: Datum, Ort, Bemerkung ändern, ohne die Zeit zu ergänzen.
  assert.equal(terminProblem({ datum: "2026-10-08", beginn: "18:30", ende: null, ort: "Halle" }, alt), null);
  assert.equal(terminProblem({ datum: "2026-10-08", beginn: null, ende: null }, { beginn: null, ende: null }), null);
  // AK 10: Wer die Zeit anfasst, muss sie vollständig geben.
  assert.deepEqual(terminProblem({ datum: "2026-10-08", beginn: "19:00", ende: null }, alt), { feld: "ende", text: TERMIN_TEXT.zeitPflicht });
  assert.equal(terminProblem({ datum: "2026-10-08", beginn: "19:00", ende: "20:30" }, alt), null);
  // AK 8: Beginn und Ende lassen sich nicht leeren.
  assert.deepEqual(
    terminProblem({ datum: "2026-10-08", beginn: null, ende: null }, { beginn: "18:30", ende: "20:00" }),
    { feld: "beginn", text: TERMIN_TEXT.zeitPflicht },
  );
  assert.equal(leerZuNull("  "), null);
  assert.equal(leerZuNull(" Allmend "), "Allmend");
});

pruefe("Termin-Anzeige und -Marker: derselbe Satz vorab und aus der Datenbank", () => {
  assert.equal(zeitText("18:30", "20:00"), "18:30–20:00");
  assert.equal(zeitText("18:30", null), "ab 18:30");
  assert.equal(zeitText(null, null), null);
  for (const [marker, satz] of Object.entries(TERMIN_MELDUNG)) {
    const f = still(() => ausDbFehler({ message: `${marker}` }));
    assert.equal(f.meldung, satz, marker);
  }
  assert.match(kopieGebliebenText("Spielformen"), /«Spielformen» ist im Team-Bestand geblieben/);
  assert.equal(NICHT_GEFUNDEN.termin, "Termin nicht gefunden.");
});
```

Den Fall `"TERMIN_NUR_FUER_TEAM_TRAININGS: Training x"` in der Marker-Tabelle bei Zeile 177 durch `"TERMIN_TRAINING_FREMDES_TEAM"` ersetzen, mit dem Satz aus `TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM`.

- [ ] **Step 2: Test laufen lassen**

Run (aus `web/`): `npm run check:kern`
Expected: FAIL mit «The requested module '../lib/termin' does not provide an export named 'TERMIN_MELDUNG'».

- [ ] **Step 3: `web/lib/termin.ts` ersetzen**

```ts
// Die Regeln eines Termins (Team-Kalender #322, #323; vorher Team-Epic
// Stories 7–9 und #198).
//
// Eine Regelquelle für den Kalender der Oberfläche und die KI-Werkzeuge
// «termin_*» und «training_zuordnen» — der Fachkern (lib/kern/termine.ts)
// ruft sie vor jedem Schreiben auf, und die Datenebene meldet mit denselben
// Markern (TERMIN_MELDUNG), wenn sie trotzdem abweist.
//
// REIN: keine Importe — `check:kern` lädt diese Datei mit tsx.

export type TerminFelder = {
  datum: string;
  beginn?: string | null;
  ende?: string | null;
  ort?: string | null;
  bemerkung?: string | null;
};

export type TerminFeld = "datum" | "beginn" | "ende" | "ort" | "bemerkung";
export type TerminProblem = { feld: TerminFeld; text: string };

/** Zwillinge der Checks `tt_ort_laenge` und `tt_bemerkung_laenge`. */
export const ORT_MAX = 100;
export const BEMERKUNG_MAX = 500;

export const TERMIN_TEXT = {
  datum: "Bitte ein Datum angeben.",
  uhrzeit: "Bitte eine gültige Uhrzeit angeben.",
  zeitPflicht: "Bitte Beginn und Ende angeben.",
  endeNachBeginn: "Das Ende muss am selben Tag nach dem Beginn liegen.",
  ortLang: `Der Ort darf höchstens ${ORT_MAX} Zeichen lang sein.`,
  bemerkungLang: `Die Bemerkung darf höchstens ${BEMERKUNG_MAX} Zeichen lang sein.`,
} as const;

/** Leere Eingaben sind „nicht erfasst", nicht „leerer Text". */
export function leerZuNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/** Gibt es diesen Kalendertag? `YYYY-MM-DD` allein genügt nicht: «2026-02-30»
 *  passt auf das Muster, die `date`-Spalte weist ihn aber ab — über den
 *  KI-Client jederzeit eingebbar. Das Jahr 0000 kennt Postgres ebenfalls nicht. */
export function istKalendertag(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (j < 1 || mo < 1 || mo > 12 || t < 1) return false;
  return t <= new Date(Date.UTC(j, mo, 0)).getUTCDate();
}

/** Eine Uhrzeit `HH:MM` innerhalb eines Tages; «24:00» ist kein Beginn. */
export function istUhrzeit(hhmm: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/** Beginn und Ende als EINE Angabe (Story 5 PC 2): beide da, beide gültig,
 *  das Ende am selben Tag danach (AK 5). */
export function zeitProblem(
  beginnRoh: string | null | undefined,
  endeRoh: string | null | undefined,
): TerminProblem | null {
  const beginn = leerZuNull(beginnRoh);
  const ende = leerZuNull(endeRoh);
  if (!beginn) return { feld: "beginn", text: TERMIN_TEXT.zeitPflicht };
  if (!ende) return { feld: "ende", text: TERMIN_TEXT.zeitPflicht };
  if (!istUhrzeit(beginn)) return { feld: "beginn", text: TERMIN_TEXT.uhrzeit };
  if (!istUhrzeit(ende)) return { feld: "ende", text: TERMIN_TEXT.uhrzeit };
  if (ende <= beginn) return { feld: "ende", text: TERMIN_TEXT.endeNachBeginn };
  return null;
}

/** Ort und Bemerkung sind frei, aber begrenzt (AK 6). */
export function textProblem(f: {
  ort?: string | null;
  bemerkung?: string | null;
}): TerminProblem | null {
  if ((leerZuNull(f.ort) ?? "").length > ORT_MAX) return { feld: "ort", text: TERMIN_TEXT.ortLang };
  if ((leerZuNull(f.bemerkung) ?? "").length > BEMERKUNG_MAX)
    return { feld: "bemerkung", text: TERMIN_TEXT.bemerkungLang };
  return null;
}

/** Was an einem Termin nicht stimmt, sonst `null`.
 *
 *  Ohne `bisher` ist der Termin neu: Datum, Beginn und Ende sind Pflicht
 *  (AK 2, PO 9). Mit `bisher` wird geändert: Eine Zeit, die sich ändert, muss
 *  danach vollständig sein (AK 8, 10); eine unveränderte, unvollständige Zeit
 *  eines übernommenen Termins bleibt stehen (AK 9). `bisher` trägt `HH:MM`. */
export function terminProblem(
  f: { datum?: string | null; beginn?: string | null; ende?: string | null; ort?: string | null; bemerkung?: string | null },
  bisher?: { beginn: string | null; ende: string | null },
): TerminProblem | null {
  if (!istKalendertag(f.datum ?? "")) return { feld: "datum", text: TERMIN_TEXT.datum };
  const beginn = leerZuNull(f.beginn);
  const ende = leerZuNull(f.ende);
  const zeitGeaendert = !bisher || beginn !== bisher.beginn || ende !== bisher.ende;
  if (zeitGeaendert) {
    const z = zeitProblem(beginn, ende);
    if (z) return z;
  }
  return textProblem(f);
}

/** Die Zeit eines Termins zum Anzeigen: «18:30–20:00», «ab 18:30» für einen
 *  übernommenen Termin ohne Ende, sonst `null` (AK 14, 15). */
export function zeitText(beginn: string | null, ende: string | null): string | null {
  if (beginn && ende) return `${beginn}–${ende}`;
  if (beginn) return `ab ${beginn}`;
  return null;
}

/** Die Sätze zu den Markern der Datenebene (Migration termine_ohne_training)
 *  — dieselben, die der Fachkern vorab verwendet. */
export const TERMIN_MELDUNG = {
  TERMIN_NICHT_GEFUNDEN: "Termin nicht gefunden.",
  TRAINING_NICHT_GEFUNDEN: "Training nicht gefunden.",
  TERMIN_BELEGUNG_GEAENDERT:
    "Am Termin hat sich inzwischen etwas geändert: Ihm wurde ein anderes Training zugeordnet " +
    "oder sein Training gelöst. Sieh ihn dir noch einmal an.",
  TRAINING_EINPLANUNG_GEAENDERT:
    "Das Training wurde inzwischen einem anderen Termin zugeordnet oder von seinem Termin gelöst. " +
    "Wähle noch einmal.",
  TERMIN_TRAINING_FREMDES_TEAM:
    "Einem Termin lassen sich nur Trainings aus dem Bestand seines Teams zuordnen.",
  TRAINING_SCHON_EINGEPLANT:
    "Dieses Training ist bereits für einen anstehenden Termin eingeplant. Wähle, ob du es für " +
    "diesen Termin kopierst oder auf ihn verschiebst.",
  NUR_KOPIE_BEI_VERGANGENEM:
    "Ein Training mit vergangenem Termin lässt sich nur kopieren, nicht verschieben.",
} as const;

export type TerminMarker = keyof typeof TERMIN_MELDUNG;

/** Marker, die «seit der Auswahl geändert» heissen (PO 17) — der Fachkern
 *  ordnet sie als `konflikt` ein, nicht als Regel. Teil B ergänzt die der
 *  Serien. */
export const KONFLIKT_MARKER: readonly string[] = [
  "TERMIN_BELEGUNG_GEAENDERT",
  "TRAINING_EINPLANUNG_GEAENDERT",
];

/** Ein Zusatz zu jeder Meldung, deren Kopie nicht aufgeräumt werden konnte
 *  (Story 2 PC 9, Story 7 PC 8) — in der Oberfläche und beim Assistenten. */
export function kopieGebliebenText(name: string): string {
  return `Eine unvollständige Kopie «${name}» ist im Team-Bestand geblieben; du kannst sie dort entfernen.`;
}
```

- [ ] **Step 4: Marker in `web/lib/training-bedingungen.ts` umstellen** — `TERMIN_NUR_FUER_TEAM` und `TERMIN_MARKER` (Zeilen 327-338) ersetzen durch:

```ts
import { TERMIN_MELDUNG } from "@/lib/termin";

/** Die Marker, mit denen die Datenebene im Kalender abweist (#322, #323) —
 *  ihre Sätze stehen in lib/termin.ts, damit Fachkern und Datenebene
 *  denselben Wortlaut tragen. */
const TERMIN_MARKER: [string, string][] = Object.entries(TERMIN_MELDUNG);
```

(Den Import an den Dateikopf zu den übrigen Importen stellen; `lib/termin.ts` ist rein, die Datei bleibt es auch.)

- [ ] **Step 5: Test laufen lassen**

Run: `npm run check:kern`
Expected: Die drei neuen Prüfungen bestehen. Weiterhin schlagen fehl: die Werkzeug-Liste «#198» und `terminProblem`-Aufrufe in `lib/kern/termine.ts` (typecheck). Das ist erwartet und wird in A3 bis A6 behoben.

- [ ] **Step 6: Commit**

```bash
git add web/lib/termin.ts web/lib/training-bedingungen.ts web/scripts/pruefe-kern.ts
git commit -m "feat(kalender): Termin-Regeln mit Beginn, Ende und Längen (#322)"
```

### Task A3: Lesepfad — Termine ohne Training im Plan, Bestand und in den Auskünften

**Files:**
- Modify: `web/lib/queries/termine-fuer.ts` (Typ, Select, Plan-Abfrage, neuer Helfer)
- Modify: `web/lib/queries/termine.ts` (Re-Export `nochNichtVorbereitet`)
- Modify: `web/lib/queries/trainings-fuer.ts:497-514` (`TeamTrainingRow.termin.ende`, `TEAM_LIST_SELECT`)
- Modify: `web/lib/queries/teams.ts:72-88` (`getTeamAufloesungsInfo`)
- Modify: `web/lib/kern/auskunft-schema.ts:158-168`, `web/lib/kern/auskunft.ts:247-258`, `web/lib/kern/lesen.ts:50-57, 89-101`
- Modify: `web/lib/kern/loeschen.ts:54-113` (`terminEntfiel` → `terminBleibt`)
- Test: `web/scripts/pruefe-kern.ts:484-509` (Auskunft mit Termin)

**Interfaces:**
- Consumes: Spalten aus A1.
- Produces:
  - `type TerminZeile = { id; teamId; datum; beginn: string|null; ende: string|null; ort; bemerkung; training: { id; name; stufen: KategorieSlug[] } | null }`
  - `nochNichtVorbereitet(t: TerminZeile, heute: string): boolean`
  - `TeamTrainingRow.termin: { id; datum; beginn; ende; ort; bemerkung } | null`
  - `TrefferTermin` mit `ende`
  - Auskunft `termin` mit `ende`
  - `TrainingGeloescht.terminBleibt: { id: string; datum: string } | null`

- [ ] **Step 1: Failing test** — in `pruefe-kern.ts` den Fall «Auskunft: Termin eines Team-Trainings mit «anstehend»» anpassen. Die Fixture `termin` trägt jetzt `teamId`, `ende: "20:00"` und `training: { id: …, name: …, stufen: [] }`. Die Erwartung lautet:

```ts
assert.deepEqual(a.termin, {
  id: TERMIN_ID,
  datum: "2026-09-23",
  beginn: "18:30",
  ende: "20:00",
  ort: "Allmend",
  bemerkung: null,
  anstehend: true,
});
```

Dazu ein neuer Fall:

```ts
pruefe("nochNichtVorbereitet: anstehend und ohne Training", () => {
  const t = { id: "t", teamId: "x", datum: "2026-10-07", beginn: "18:30", ende: "20:00", ort: null, bemerkung: null, training: null };
  assert.equal(nochNichtVorbereitet(t, "2026-10-07"), true, "heute zählt ganz zum Anstehenden");
  assert.equal(nochNichtVorbereitet(t, "2026-10-08"), false, "vergangen");
  assert.equal(nochNichtVorbereitet({ ...t, training: { id: "a", name: "A", stufen: [] } }, "2026-10-01"), false);
});
```

Import: `import { nochNichtVorbereitet } from "../lib/queries/termine-fuer";`

- [ ] **Step 2: Test laufen lassen** — `npm run check:kern` → FAIL: `nochNichtVorbereitet` fehlt.

- [ ] **Step 3: `web/lib/queries/termine-fuer.ts` anpassen**

```ts
export type TerminZeile = {
  id: string;
  teamId: string;
  datum: string;
  /** `HH:MM`. Neue Termine tragen Beginn und Ende immer; übernommene können
   *  ohne sein (#322 PO 9). */
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  bemerkung: string | null;
  /** `null`: Der Termin trägt (noch) kein Training (#322). */
  training: { id: string; name: string; stufen: KategorieSlug[] } | null;
};

type RawTermin = {
  id: string;
  team_id: string;
  datum: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  bemerkung: string | null;
  created_at: string;
  trainings: { id: string; name: string; stufen: string[] | null } | null;
};

const TERMIN_SELECT =
  "id, team_id, datum, beginn, ende, ort, bemerkung, created_at, trainings ( id, name, stufen )";

function mapTermin(t: RawTermin): TerminZeile {
  return {
    id: t.id,
    teamId: t.team_id,
    datum: t.datum,
    beginn: kurzeZeit(t.beginn),
    ende: kurzeZeit(t.ende),
    ort: t.ort,
    bemerkung: t.bemerkung,
    training: t.trainings
      ? { id: t.trainings.id, name: t.trainings.name, stufen: sortStufen(t.trainings.stufen ?? []) }
      : null,
  };
}
```

In `getTeamPlanFuer` die Filterzeile `.eq("trainings.team_id", teamId)` durch `.eq("team_id", teamId)` ersetzen. Die Sortierung bleibt (PC 2). Neu:

```ts
/** «Noch nicht vorbereitet» (Epic PO 7): anstehend und ohne Training. Teil D
 *  nimmt ausgefallene Termine aus. */
export function nochNichtVorbereitet(t: TerminZeile, heute: string): boolean {
  return t.datum >= heute && t.training === null;
}
```

Die Kopfkommentare der Datei nachführen: Ein Termin gehört dem Team, das Training ist freiwillig, «ansetzen» kommt nicht mehr vor. In `web/lib/queries/termine.ts` im Re-Export `nochNichtVorbereitet` ergänzen.

- [ ] **Step 4: Bestand, Auflösung, Auskünfte, Löschen**

`web/lib/queries/trainings-fuer.ts`: Im Typ `TeamTrainingRow.termin` `ende: string | null;` ergänzen, den Kommentar auf «eingeplant» umstellen und
`const TEAM_LIST_SELECT = \`${LIST_SELECT}, training_termine ( id, datum, beginn, ende, ort, bemerkung )\`;` setzen. Das Mapping nutzt `einzelnerTermin`; `beginn` und `ende` gehen durch `kurzeZeit`.

`web/lib/queries/teams.ts` `getTeamAufloesungsInfo`:

```ts
  const { count: termine } = await supabase
    .from("training_termine")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);
  return { trainings: trainings ?? 0, termine: termine ?? 0 };
```

Das zählt alle Termine, auch jene ohne Training (PC 10).

`web/lib/kern/auskunft-schema.ts`: Im `termin`-Objekt `ende: z.string().nullable(),` nach `beginn` ergänzen. `web/lib/kern/auskunft.ts`: Im Mapping `ende: k.termin.ende,` ergänzen. `web/lib/kern/lesen.ts`: `TrefferTermin` um `ende: string | null` ergänzen; den Kommentar «Termine tragen nur Team-Trainings (Trigger …)» ersetzen durch «Nur Team-Trainings lassen sich einem Termin zuordnen (Trigger `termin_training_im_team`)».

`web/lib/kern/loeschen.ts`:

```ts
  /** Der Termin, dem das Team-Training zugeordnet war: Er bleibt ohne
   *  Training im Trainingsplan (#322 PC 7, 8). */
  terminBleibt: { id: string; datum: string } | null;
```

```ts
    supabase.from("training_termine").select("id, datum").eq("training_id", zeile.id).maybeSingle<{ id: string; datum: string }>(),
```

```ts
    terminBleibt: termin.data ?? null,
```

In `web/scripts/pruefe-kern-db.ts:1117` `terminEntfiel: false` durch `terminBleibt: null` ersetzen.

- [ ] **Step 5: Tests laufen lassen**

Run: `npm run check:kern`
Expected: Die Auskunft- und `nochNichtVorbereitet`-Fälle bestehen.

- [ ] **Step 6: Commit**

```bash
git add web/lib/queries web/lib/kern/auskunft-schema.ts web/lib/kern/auskunft.ts web/lib/kern/lesen.ts web/lib/kern/loeschen.ts web/scripts/pruefe-kern.ts web/scripts/pruefe-kern-db.ts
git commit -m "feat(kalender): Termine ohne Training lesen, Termin bleibt beim Löschen (#322)"
```

### Task A4: Fachkern — Termine festlegen, ändern, entfernen, Training zuordnen und lösen

**Files:**
- Modify: `web/lib/kern/termine.ts` (ganz ersetzen)
- Test: `web/scripts/pruefe-kern-db.ts` (Szenario «Teams und Termine (#198)» L1132-1282 ersetzen, Importe L57-62)

**Interfaces:**
- Consumes: `terminProblem`, `TERMIN_MELDUNG`, `KONFLIKT_MARKER`, `kopieGebliebenText` (A2); RPCs aus A1; `kopiereTraining`, `HINWEIS_NICHTS_ENTSTANDEN`, `hinweisRest` (`lib/kern/kopie.ts`); `loescheTrainingMitBildern` (`lib/kern/loeschen.ts`); `ladeTrainingZumBearbeiten`, `pruefeTeamMitglied` (`lib/kern/zugriff.ts`).
- Produces:
  - `legeTerminFest(supabase, userId, e: TerminFestlegen) → KernErgebnis<{ terminId; teamId }>`
  - `aendereTermin(supabase, userId, e: TerminAendern) → KernErgebnis<{ terminId; teamId; trainingId: string|null }>`
  - `entferneTermin(supabase, userId, e: { terminId; erwartetesTraining?: string|null }) → KernErgebnis<{ teamId; trainingId: string|null }>`
  - `ordneTrainingZu(supabase, userId, e: Zuordnung) → KernErgebnis<Zugeordnet>`
  - `loeseTraining(supabase, userId, e: { terminId; erwartetesTraining?: string|null }) → KernErgebnis<{ terminId; teamId; trainingId: string|null }>`
  - `kalenderFehler(e, wiederholbar?) → KernFehler`, `mitAufgeraeumterKopie(supabase, f, kopieId) → Promise<KernFehler>`
  - `ladeTermin(supabase, terminId) → KernErgebnis<TerminRoh>`, `TERMIN_ROH`, `type TerminRoh`

- [ ] **Step 1: Failing DB-Test schreiben** — die Importe L59-62 ersetzen:

```ts
const { legeTerminFest, aendereTermin, entferneTermin, ordneTrainingZu, loeseTraining } = await import(
  "../lib/kern/termine"
);
const { TERMIN_MELDUNG, TERMIN_TEXT } = await import("../lib/termin");
```

Das Szenario ab «── Teams und Termine (#198)» ersetzen durch die zwei folgenden. `ein` ist die Einleitungs-Vorlage aus dem bestehenden Kopf des Skripts.

```ts
  // ── Kalender: Termin ohne Training (#322) ───────────────────────────────
  await pruefe("Kalender: festlegen, ändern, entfernen, Bestand, Löschen, fremd", async () => {
    const TEAM_FREMD = "Team nicht gefunden. Du kannst nur in Teams arbeiten, in denen du Mitglied bist.";
    const { data: team, error } = await admin.from("teams").insert({ name: "Kern-DB-Kalender" }).select("id").single();
    if (error) throw error;
    teams.push(team.id);
    const { error: e2 } = await admin.from("team_members").insert({ team_id: team.id, user_id: a.id });
    if (e2) throw e2;
    const heute = new Date();
    const tag = (d: number) => new Date(heute.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    const zeile = async (id: string) =>
      (await admin.from("training_termine").select("datum, beginn, ende, ort, bemerkung, training_id").eq("id", id).single()).data;

    // AK 1, 2, 4: ohne Training, auch vergangen; Beginn und Ende Pflicht.
    fehler(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(2), beginn: "18:30", ende: "" }), "eingabe", TERMIN_TEXT.zeitPflicht);
    fehler(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(2), beginn: "18:30", ende: "18:00" }), "eingabe", TERMIN_TEXT.endeNachBeginn);
    const t1 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(2), beginn: "18:30", ende: "20:00", ort: " Allmend " }));
    const t0 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(-3), beginn: "10:00", ende: "11:30" }));
    assert.deepEqual(await zeile(t1.terminId), { datum: tag(2), beginn: "18:30:00", ende: "20:00:00", ort: "Allmend", bemerkung: null, training_id: null });
    // AK 22: nur Mitglieder.
    fehler(await legeTerminFest(b.supabase, b.id, { teamId: team.id, datum: tag(2), beginn: "18:30", ende: "20:00" }), "nicht_gefunden", TEAM_FREMD);

    // PC 5 / AK 9: ein übernommener Termin ohne Ende bleibt änderbar.
    const { data: alt } = await admin.from("training_termine")
      .insert({ team_id: team.id, datum: tag(5), beginn: "17:00" }).select("id").single();
    wert(await aendereTermin(a.supabase, a.id, { terminId: alt!.id, ort: "Halle" }));
    assert.deepEqual(await zeile(alt!.id), { datum: tag(5), beginn: "17:00:00", ende: null, ort: "Halle", bemerkung: null, training_id: null });
    // AK 10: Wer die Zeit ändert, gibt sie vollständig.
    fehler(await aendereTermin(a.supabase, a.id, { terminId: alt!.id, beginn: "17:30" }), "eingabe", TERMIN_TEXT.zeitPflicht);
    wert(await aendereTermin(a.supabase, a.id, { terminId: alt!.id, beginn: "17:30", ende: "19:00" }));
    // AK 8: nicht leeren.
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, beginn: null, ende: null }), "eingabe", TERMIN_TEXT.zeitPflicht);

    // Plan: Termine ohne Training zählen wie alle anderen (PC 3).
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team.id }));
    assert.deepEqual(plan.kommend.map((t) => t.id), [t1.terminId, alt!.id]);
    assert.deepEqual(plan.vergangen.map((t) => t.id), [t0.terminId]);
    assert.equal(plan.kommend[0].training, null);
    assert.equal(plan.kommend[0].ende, "20:00");

    // PC 7, 8: Löschen des Trainings lässt den Termin stehen.
    const tt = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Kalender", altersstufe: "kinderfussball", stufen: ["F"], teamId: team.id }));
    wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: tt.id }));
    const weg = wert(await loescheTraining(a.supabase, a.id, { trainingId: tt.id }));
    assert.deepEqual(weg.terminBleibt, { id: t1.terminId, datum: tag(2) });
    assert.equal((await zeile(t1.terminId))!.training_id, null);

    // AK 23: Wer mit veralteter Auswahl ändert oder entfernt, wird abgewiesen.
    const tt2 = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Zwei", altersstufe: "kinderfussball", stufen: ["F"], teamId: team.id }));
    wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: tt2.id }));
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, ort: "x", erwartetesTraining: null }), "konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);
    fehler(await entferneTermin(a.supabase, a.id, { terminId: t1.terminId, erwartetesTraining: null }), "konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);
    // PC 6: Entfernen lässt das Training im Bestand.
    assert.deepEqual(wert(await entferneTermin(a.supabase, a.id, { terminId: t1.terminId, erwartetesTraining: tt2.id })), { teamId: team.id, trainingId: tt2.id });
    assert.ok(await ladeTrainingDetail(a.supabase, tt2.id), "das Training bleibt im Team-Bestand");
    fehler(await entferneTermin(a.supabase, a.id, { terminId: t1.terminId }), "nicht_gefunden", "Termin nicht gefunden.");
    fehler(await aendereTermin(b.supabase, b.id, { terminId: t0.terminId, ort: "x" }), "nicht_gefunden", "Termin nicht gefunden.");

    // PC 9, 10: Auflösen nimmt alle Termine mit, auch ohne Training.
    const { count } = await admin.from("training_termine").select("id", { count: "exact", head: true }).eq("team_id", team.id);
    assert.equal(count, 2);
  });

  // ── Kalender: Training zuordnen und lösen (#323) ───────────────────────
  await pruefe("Kalender: zuordnen, ersetzen, Kopie, Verschieben, lösen, Konflikte", async () => {
    const { data: team } = await admin.from("teams").insert({ name: "Kern-DB-Zuordnen" }).select("id").single();
    teams.push(team!.id);
    await admin.from("team_members").insert({ team_id: team!.id, user_id: a.id });
    const { data: anderes } = await admin.from("teams").insert({ name: "Kern-DB-Anderes" }).select("id").single();
    teams.push(anderes!.id);
    await admin.from("team_members").insert({ team_id: anderes!.id, user_id: a.id });
    const heute = new Date();
    const tag = (d: number) => new Date(heute.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    const termin = async (d: number, teamId = team!.id) =>
      wert(await legeTerminFest(a.supabase, a.id, { teamId, datum: tag(d), beginn: "18:00", ende: "19:30" })).terminId;
    const training = async (name: string, teamId: string | undefined = team!.id) =>
      wert(await legeTrainingAn(a.supabase, a.id, { name, altersstufe: "kinderfussball", stufen: ["F"], teamId })).id;
    const traegt = async (terminId: string) =>
      (await admin.from("training_termine").select("training_id").eq("id", terminId).single()).data!.training_id;

    const morgen = await termin(1), uebermorgen = await termin(2), gestern = await termin(-1);
    const x = await training("Kern-DB-X");

    // AK 1, PC 1: Training ohne Termin wird verknüpft.
    const z1 = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: morgen, trainingId: x }));
    assert.deepEqual({ kopie: z1.kopie, imBestand: z1.imBestand, freierTermin: z1.freierTermin }, { kopie: false, imBestand: null, freierTermin: null });
    // AK 4: fremdes Team und persönliches Training.
    const fremd = await training("Kern-DB-Fremd", anderes!.id);
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: uebermorgen, trainingId: fremd }), "regel", TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM);
    const persoenlich = await training("Kern-DB-Persönlich", undefined);
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: uebermorgen, trainingId: persoenlich }), "regel", TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM);

    // AK 10, 16: anstehend eingeplant → Wahl Pflicht.
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: uebermorgen, trainingId: x }), "regel", TERMIN_MELDUNG.TRAINING_SCHON_EINGEPLANT);
    // PC 2, 3: Kopie — gleichnamig, das Original bleibt.
    const k = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: uebermorgen, trainingId: x, art: "kopie" }));
    assert.equal(k.kopie, true);
    assert.notEqual(k.trainingId, x);
    assert.equal((await admin.from("trainings").select("name").eq("id", k.trainingId).single()).data!.name, "Kern-DB-X");
    assert.equal(await traegt(morgen), x);
    // PC 4: Verschieben — der bisherige Termin wird frei.
    const v = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: gestern, trainingId: x, art: "verschieben" }));
    assert.deepEqual({ frei: v.freierTermin, auf: await traegt(gestern), weg: await traegt(morgen) }, { frei: morgen, auf: x, weg: null });
    // AK 11, 16: vergangen → nur Kopie; ohne Wahl ist es eine Kopie.
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: morgen, trainingId: x, art: "verschieben" }), "regel", TERMIN_MELDUNG.NUR_KOPIE_BEI_VERGANGENEM);
    const k2 = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: morgen, trainingId: x }));
    assert.equal(k2.kopie, true);
    assert.equal(await traegt(gestern), x);

    // AK 9, PC 5: ersetzen — das bisherige bleibt ohne Termin im Bestand.
    const y = await training("Kern-DB-Y");
    const r = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: morgen, trainingId: y }));
    assert.equal(r.imBestand, k2.trainingId);
    assert.equal((await admin.from("training_termine").select("id").eq("training_id", k2.trainingId).maybeSingle()).data, null);

    // AK 14: veraltete Auswahl.
    const w = await training("Kern-DB-W");
    fehler(
      await ordneTrainingZu(a.supabase, a.id, { terminId: morgen, trainingId: w, erwartet: { terminTraining: null, trainingTermin: null } }),
      "konflikt",
      TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT,
    );
    fehler(
      await ordneTrainingZu(a.supabase, a.id, { terminId: uebermorgen, trainingId: y, art: "verschieben", erwartet: { terminTraining: k.trainingId, trainingTermin: null } }),
      "konflikt",
      TERMIN_MELDUNG.TRAINING_EINPLANUNG_GEAENDERT,
    );
    assert.equal(await traegt(morgen), y, "PC 7: abgewiesen heisst unverändert");

    // AK 12, PC 6: lösen.
    assert.equal(wert(await loeseTraining(a.supabase, a.id, { terminId: morgen })).trainingId, y);
    assert.equal(await traegt(morgen), null);

    // PC 8: scheitert die Zuordnung der Kopie, geht die Kopie wieder.
    const kaputt = new Proxy(a.supabase, {
      get(ziel, name, empf) {
        if (name === "rpc")
          return async (fn: string, args: unknown) =>
            fn === "termin_training_setzen" && (args as { p_verschieben: boolean }).p_verschieben === false
              ? { data: null, error: { message: "Probe", code: "XX000" } }
              : ziel.rpc(fn, args as never);
        return Reflect.get(ziel, name, empf);
      },
    });
    const zahl = async () => (await admin.from("trainings").select("*", { count: "exact", head: true }).eq("team_id", team!.id)).count;
    const vorher = await zahl();
    const f = fehler(await ordneTrainingZu(kaputt, a.id, { terminId: morgen, trainingId: x, art: "kopie" }), "technisch") as { hinweis?: string };
    assert.equal(f.hinweis, HINWEIS_NICHTS_ENTSTANDEN);
    assert.equal(await zahl(), vorher, "keine Kopie bleibt stehen");
  });
```

In den Importen des Skripts `loescheTraining` ergänzen (`await import("../lib/kern/loeschen")`), falls er noch nicht geladen ist.

- [ ] **Step 2: Test laufen lassen**

Run (aus `web/`, lokaler Stack läuft, Seed geladen): `npm run check:kern-db`
Expected: FAIL beim Import («does not provide an export named 'legeTerminFest'»).

- [ ] **Step 3: `web/lib/kern/termine.ts` ersetzen**

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  KONFLIKT_MARKER,
  TERMIN_MELDUNG,
  kopieGebliebenText,
  leerZuNull,
  terminProblem,
  type TerminMarker,
  type TerminProblem,
} from "@/lib/termin";
import { kurzeZeit } from "@/lib/queries/termine-fuer";
import { heuteAmTrainingsort } from "@/lib/zeit";
import { ladeTrainingZumBearbeiten, pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { HINWEIS_NICHTS_ENTSTANDEN, hinweisRest, kopiereTraining } from "@/lib/kern/kopie";
import { loescheTrainingMitBildern } from "@/lib/kern/loeschen";
import {
  NICHT_GEFUNDEN,
  ausDbFehler,
  fehlschlag,
  ok,
  type KernErgebnis,
  type KernFehler,
} from "@/lib/kern/ergebnis";

/**
 * Der Kalender eines Teams (Epic #321): Termine festlegen, ändern und
 * entfernen (#322), Trainings zuordnen und lösen (#323).
 *
 * Zeitrahmen und Inhalt sind getrennt (PO 15): Ein Termin gehört dem Team und
 * besteht auch ohne Training; ein Training kommt nur durch Zuordnen an einen
 * bestehenden Termin auf ein Datum. Ein Termin trägt höchstens ein Training,
 * ein Training ist höchstens für einen Termin eingeplant — ein weiterer Termin
 * bekommt eine eigenständige Kopie, oder das Training wird verschoben.
 *
 * Gleichzeitige Änderungen (PO 17): Die Oberfläche sendet mit, was sie bei der
 * Auswahl sah (`erwartet…`), und wird abgewiesen, wenn sich genau das geändert
 * hat. Der KI-Weg kennt keine Auswahl; er prüft gegen den eben gelesenen Stand
 * und bekommt bei einem Wettlauf `wiederholbar: true`.
 *
 * Wer schreiben darf, entscheidet die RLS (`tt_*`: jedes Mitglied des Teams)
 * bzw. die Mitgliedschaftsprüfung der RPCs.
 */

export const TERMIN_FELD = { feld: "termin_id" } as const;

export const TERMIN_ROH = "id, team_id, training_id, datum, beginn, ende, ort, bemerkung";

export type TerminRoh = {
  id: string;
  team_id: string;
  training_id: string | null;
  datum: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  bemerkung: string | null;
};

function feldFehler(p: TerminProblem | null): KernFehler | null {
  return p ? fehlschlag("eingabe", p.text, { feld: p.feld }) : null;
}

/** Ein Fehler der Kalender-RPCs als Kern-Fehler. «Nicht gefunden» und «seit
 *  der Auswahl geändert» ordnet nur der Kalender ein; alle übrigen Marker
 *  übersetzt `ausDbFehler` als Regel mit demselben Satz. */
export function kalenderFehler(e: { message: string; code?: string }, wiederholbar = false): KernFehler {
  if (e.message.includes("TERMIN_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  if (e.message.includes("TRAINING_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.training, { feld: "training_id" });
  const konflikt = KONFLIKT_MARKER.find((m) => e.message.includes(m));
  if (konflikt)
    return fehlschlag("konflikt", meldungZu(konflikt), wiederholbar ? { wiederholbar: true } : {});
  return ausDbFehler(e);
}

/** Der Satz zu einem Konflikt-Marker. Teil B ergänzt die Serien-Marker in
 *  `KONFLIKT_MARKER`; ihre Sätze stehen dann ebenfalls in einer Meldungstabelle. */
function meldungZu(marker: string): string {
  return TERMIN_MELDUNG[marker as TerminMarker] ?? marker;
}

/** Einen Termin lesen, soweit die RLS ihn zeigt (nur Mitglieder des Teams).
 *  Unsichtbar und nicht vorhanden bleiben ununterscheidbar. */
export async function ladeTermin(
  supabase: SupabaseClient,
  terminId: string,
): Promise<KernErgebnis<TerminRoh>> {
  if (!istUuid(terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  const { data, error } = await supabase
    .from("training_termine")
    .select(TERMIN_ROH)
    .eq("id", terminId)
    .maybeSingle<TerminRoh>();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  return ok({ ...data, beginn: kurzeZeit(data.beginn), ende: kurzeZeit(data.ende) });
}

// ── Festlegen, ändern, entfernen (#322) ─────────────────────────────────────

export type TerminFestlegen = {
  teamId: string;
  datum: string;
  beginn: string;
  ende: string;
  ort?: string | null;
  bemerkung?: string | null;
};

/** Einen einzelnen Termin ohne Training festlegen (AK 1–6), auch in der
 *  Vergangenheit (AK 4). */
export async function legeTerminFest(
  supabase: SupabaseClient,
  _userId: string,
  e: TerminFestlegen,
): Promise<KernErgebnis<{ terminId: string; teamId: string }>> {
  const problem = feldFehler(terminProblem(e));
  if (problem) return problem;
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;

  const { data, error } = await supabase
    .from("training_termine")
    .insert({
      team_id: e.teamId,
      datum: e.datum,
      beginn: leerZuNull(e.beginn),
      ende: leerZuNull(e.ende),
      ort: leerZuNull(e.ort),
      bemerkung: leerZuNull(e.bemerkung),
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return ausDbFehler(error);
  return ok({ terminId: data.id, teamId: e.teamId });
}

export type TerminAendern = {
  terminId: string;
  /** `undefined` = unverändert. Das Datum lässt sich nicht leeren. */
  datum?: string;
  /** `undefined` = unverändert. Beginn und Ende sind eine Angabe (AK 8–10). */
  beginn?: string | null;
  ende?: string | null;
  /** `undefined` = unverändert, `null` oder `""` = leeren. */
  ort?: string | null;
  bemerkung?: string | null;
  /** Das Training, das der Termin bei der Auswahl trug (AK 23). `undefined`
   *  beim KI-Weg: geprüft wird dann gegen den eben gelesenen Stand. */
  erwartetesTraining?: string | null;
};

/** Warum ein bedingtes Schreiben keine Zeile traf: Der Termin ist weg, oder
 *  sein Training hat sich seit der Auswahl geändert (AK 23). */
async function warumNichtGeschrieben(
  supabase: SupabaseClient,
  terminId: string,
  wiederholbar: boolean,
): Promise<KernFehler> {
  const { data } = await supabase.from("training_termine").select("id").eq("id", terminId).maybeSingle();
  return data
    ? fehlschlag("konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT, wiederholbar ? { wiederholbar: true } : {})
    : fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
}

/** Datum, Zeit, Ort und Bemerkung eines Termins ändern (AK 7–10, 23). Nur die
 *  übergebenen Felder ändern sich; der Termin wird mit seinem Stand
 *  zusammengeführt und als Ganzes geprüft. */
export async function aendereTermin(
  supabase: SupabaseClient,
  _userId: string,
  e: TerminAendern,
): Promise<KernErgebnis<{ terminId: string; teamId: string; trainingId: string | null }>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;

  const neu = {
    datum: e.datum ?? t.datum,
    beginn: e.beginn !== undefined ? leerZuNull(e.beginn) : t.beginn,
    ende: e.ende !== undefined ? leerZuNull(e.ende) : t.ende,
    ort: e.ort !== undefined ? leerZuNull(e.ort) : t.ort,
    bemerkung: e.bemerkung !== undefined ? leerZuNull(e.bemerkung) : t.bemerkung,
  };
  const problem = feldFehler(terminProblem(neu, { beginn: t.beginn, ende: t.ende }));
  if (problem) return problem;

  const erwartet = e.erwartetesTraining !== undefined ? e.erwartetesTraining : t.training_id;
  const basis = supabase.from("training_termine").update(neu).eq("id", t.id);
  const { data, error } = await (erwartet === null
    ? basis.is("training_id", null)
    : basis.eq("training_id", erwartet)
  )
    .select("id")
    .maybeSingle();
  if (error) return ausDbFehler(error);
  if (!data) return warumNichtGeschrieben(supabase, t.id, e.erwartetesTraining === undefined);
  return ok({ terminId: t.id, teamId: t.team_id, trainingId: erwartet });
}

/** Einen Termin entfernen (AK 11–13, 23). Sein Training bleibt im
 *  Team-Bestand (PC 6); `trainingId` nennt es. */
export async function entferneTermin(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; erwartetesTraining?: string | null },
): Promise<KernErgebnis<{ teamId: string; trainingId: string | null }>> {
  if (!istUuid(e.terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  const { data, error } = await supabase.rpc("termin_entfernen", {
    p_termin: e.terminId,
    p_erwartet: e.erwartetesTraining === undefined ? null : { termin_training: e.erwartetesTraining },
  });
  if (error) return kalenderFehler(error);
  const r = data as { training: string | null; team: string };
  return ok({ teamId: r.team, trainingId: r.training });
}

// ── Zuordnen und lösen (#323) ────────────────────────────────────────────────

export type Zuordnung = {
  terminId: string;
  trainingId: string;
  /** Nur für ein Training, das schon einem anderen Termin gehört: `kopie`
   *  legt eine eigenständige Kopie an, `verschieben` nimmt es vom bisherigen
   *  — nur anstehenden — Termin weg (AK 10, 11). */
  art?: "kopie" | "verschieben";
  /** Was die Oberfläche bei der Auswahl sah (AK 14); `undefined` beim KI-Weg. */
  erwartet?: { terminTraining: string | null; trainingTermin: string | null };
};

export type Zugeordnet = {
  terminId: string;
  teamId: string;
  /** Das Training, das jetzt am Termin steht — bei einer Kopie die Kopie. */
  trainingId: string;
  kopie: boolean;
  /** Das Training, das den Termin verlassen hat und ohne Termin im
   *  Team-Bestand bleibt (PC 5). */
  imBestand: string | null;
  /** Der Termin, den ein verschobenes Training verlassen hat (PC 4). */
  freierTermin: string | null;
};

type Erwartung = { termin_training: string | null; training_termin: string | null };

async function setze(
  supabase: SupabaseClient,
  t: TerminRoh,
  trainingId: string,
  verschieben: boolean,
  erwartet: Erwartung,
  wiederholbar: boolean,
  kopie: boolean,
): Promise<KernErgebnis<Zugeordnet>> {
  const { data, error } = await supabase.rpc("termin_training_setzen", {
    p_termin: t.id,
    p_training: trainingId,
    p_verschieben: verschieben,
    p_erwartet: erwartet,
  });
  if (error) return kalenderFehler(error, wiederholbar);
  const r = data as { bisher: string | null; frei: string | null };
  return ok({ terminId: t.id, teamId: t.team_id, trainingId, kopie, imBestand: r.bisher, freierTermin: r.frei });
}

/** Eine gescheiterte Zuordnung räumt ihre Kopie wieder weg (Story 2 PC 8,
 *  Story 7 PC 8). Bleibt sie stehen, nennt die Meldung sie — in der
 *  Oberfläche und beim Assistenten (PC 9). */
export async function mitAufgeraeumterKopie(
  supabase: SupabaseClient,
  f: KernFehler,
  kopieId: string,
): Promise<KernFehler> {
  if (await loescheTrainingMitBildern(supabase, kopieId)) return { ...f, hinweis: HINWEIS_NICHTS_ENTSTANDEN };
  const { data } = await supabase.from("trainings").select("name").eq("id", kopieId).maybeSingle<{ name: string }>();
  return { ...f, meldung: `${f.meldung} ${kopieGebliebenText(data?.name ?? "Kopie")}`, hinweis: hinweisRest(kopieId) };
}

/** Einem Termin ein Training aus dem Team-Bestand zuordnen (AK 1–11, 14–17;
 *  PC 1–9). Ersetzt ein Training, das der Termin schon trägt (AK 9). */
export async function ordneTrainingZu(
  supabase: SupabaseClient,
  userId: string,
  e: Zuordnung,
): Promise<KernErgebnis<Zugeordnet>> {
  const termin = await ladeTermin(supabase, e.terminId);
  if (!termin.ok) return termin;
  const t = termin.wert;

  const training = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!training.ok) return training;
  const { ziel } = training.wert;
  if (ziel.art !== "team" || ziel.teamId !== t.team_id)
    return fehlschlag("regel", TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM, { feld: "training_id" });
  if (t.training_id === e.trainingId)
    return ok({ terminId: t.id, teamId: t.team_id, trainingId: e.trainingId, kopie: false, imBestand: null, freierTermin: null });

  const { data: bisher, error } = await supabase
    .from("training_termine")
    .select("id, datum")
    .eq("training_id", e.trainingId)
    .maybeSingle<{ id: string; datum: string }>();
  if (error) return ausDbFehler(error);
  if (e.erwartet && (bisher?.id ?? null) !== e.erwartet.trainingTermin)
    return fehlschlag("konflikt", TERMIN_MELDUNG.TRAINING_EINPLANUNG_GEAENDERT);

  const wiederholbar = !e.erwartet;
  const erwartet: Erwartung = e.erwartet
    ? { termin_training: e.erwartet.terminTraining, training_termin: e.erwartet.trainingTermin }
    : { termin_training: t.training_id, training_termin: bisher?.id ?? null };

  // Ohne bisherigen Termin wird schlicht verknüpft (PC 1).
  if (!bisher) return setze(supabase, t, e.trainingId, false, erwartet, wiederholbar, false);

  const vergangen = bisher.datum < heuteAmTrainingsort();
  if (vergangen && e.art === "verschieben")
    return fehlschlag("regel", TERMIN_MELDUNG.NUR_KOPIE_BEI_VERGANGENEM, { feld: "art" });
  if (!vergangen && !e.art)
    return fehlschlag("regel", TERMIN_MELDUNG.TRAINING_SCHON_EINGEPLANT, {
      feld: "art",
      zulaessig: ["kopie", "verschieben"],
    });
  if (e.art === "verschieben") return setze(supabase, t, e.trainingId, true, erwartet, wiederholbar, false);

  // Kopie (PC 2, 3): eigenständig, gleichnamig, so vollständig wie jede Kopie.
  const kopie = await kopiereTraining(supabase, e.trainingId, { art: "team", teamId: t.team_id });
  if (!kopie.ok)
    return fehlschlag(kopie.art, kopie.error, {
      hinweis: kopie.nichtsEntstanden ? HINWEIS_NICHTS_ENTSTANDEN : hinweisRest(kopie.rest),
    });
  const r = await setze(supabase, t, kopie.neueId, false, { ...erwartet, training_termin: null }, wiederholbar, true);
  return r.ok ? r : mitAufgeraeumterKopie(supabase, r, kopie.neueId);
}

/** Das Training von seinem Termin lösen (AK 12, PC 6). */
export async function loeseTraining(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; erwartetesTraining?: string | null },
): Promise<KernErgebnis<{ terminId: string; teamId: string; trainingId: string | null }>> {
  const termin = await ladeTermin(supabase, e.terminId);
  if (!termin.ok) return termin;
  const t = termin.wert;
  const { data, error } = await supabase.rpc("termin_training_setzen", {
    p_termin: t.id,
    p_training: null,
    p_verschieben: false,
    p_erwartet: {
      termin_training: e.erwartetesTraining !== undefined ? e.erwartetesTraining : t.training_id,
      training_termin: null,
    },
  });
  if (error) return kalenderFehler(error, e.erwartetesTraining === undefined);
  return ok({ terminId: t.id, teamId: t.team_id, trainingId: (data as { bisher: string | null }).bisher });
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npm run typecheck && npm run check:kern-db`
Expected: `typecheck` scheitert noch in `lib/actions/termine.ts`, `lib/mcp/werkzeuge/team.ts` und den Komponenten (alte Importe); das beheben A5 bis A7. Zum Prüfen dieses Tasks die alten Aufrufer vorübergehend nicht anfassen und `check:kern-db` allein laufen lassen (tsx prüft keine Typen).
Expected: die beiden Kalender-Szenarien «✓».

- [ ] **Step 5: Commit**

```bash
git add web/lib/kern/termine.ts web/scripts/pruefe-kern-db.ts
git commit -m "feat(kalender): Fachkern für Termine ohne Training und Zuordnen (#322, #323)"
```

### Task A5: Server Actions

**Files:**
- Modify: `web/lib/actions/termine.ts` (ganz ersetzen)

**Interfaces:**
- Consumes: A4.
- Produces (alle `"use server"`, Rückgabe `{ ok: true, … } | { ok: false; error: string }`):
  - `legeTerminFestAktion(teamId, felder: TerminFelder)`
  - `aendereTerminAktion(terminId, felder: TerminFelder, erwartetesTraining: string|null)`
  - `entferneTerminAktion(terminId, erwartetesTraining: string|null)`
  - `ordneTrainingZuAktion(e: Zuordnung)` → `{ ok: true; kopie: boolean; imBestand: string|null }`
  - `loeseTrainingAktion(terminId, erwartetesTraining: string)`

- [ ] **Step 1: Datei ersetzen**

```ts
"use server";

import {
  aendereTermin,
  entferneTermin,
  legeTerminFest,
  loeseTraining,
  ordneTrainingZu,
  type Zuordnung,
} from "@/lib/kern/termine";
import { revalidiereTeam, revalidiereTraining } from "@/lib/revalidate";
import { NICHT_ANGEMELDET, angemeldet, oberflaechenMeldung } from "@/lib/actions/adapter";
import type { TerminFelder } from "@/lib/termin";

/**
 * Der Kalender eines Teams (#322, #323) — dünne Adapter über den Fachkern
 * (lib/kern/termine.ts), dieselben Funktionen wie die KI-Werkzeuge. Die
 * Oberfläche sendet stets mit, was sie bei der Auswahl sah (PO 17).
 */

export type { TerminFelder } from "@/lib/termin";

type Fehler = { ok: false; error: string };

export async function legeTerminFestAktion(
  teamId: string,
  felder: TerminFelder,
): Promise<{ ok: true; terminId: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await legeTerminFest(a.supabase, a.userId, {
    teamId,
    datum: felder.datum,
    beginn: felder.beginn ?? "",
    ende: felder.ende ?? "",
    ort: felder.ort,
    bemerkung: felder.bemerkung,
  });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  return { ok: true, terminId: r.wert.terminId };
}

/** Der Dialog sendet immer alle Felder; ein leeres heisst «leeren». */
export async function aendereTerminAktion(
  terminId: string,
  felder: TerminFelder,
  erwartetesTraining: string | null,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await aendereTermin(a.supabase, a.userId, {
    terminId,
    datum: felder.datum,
    beginn: felder.beginn ?? null,
    ende: felder.ende ?? null,
    ort: felder.ort ?? null,
    bemerkung: felder.bemerkung ?? null,
    erwartetesTraining,
  });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}

export async function entferneTerminAktion(
  terminId: string,
  erwartetesTraining: string | null,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await entferneTermin(a.supabase, a.userId, { terminId, erwartetesTraining });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}

export async function ordneTrainingZuAktion(
  e: Zuordnung,
): Promise<{ ok: true; kopie: boolean; imBestand: string | null } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await ordneTrainingZu(a.supabase, a.userId, e);
  if (!r.ok) return { ok: false, error: oberflaechenMeldung(r) };
  revalidiereTeam(r.wert.teamId);
  for (const id of [r.wert.trainingId, r.wert.imBestand, e.trainingId])
    if (id) revalidiereTraining(id);
  return { ok: true, kopie: r.wert.kopie, imBestand: r.wert.imBestand };
}

export async function loeseTrainingAktion(
  terminId: string,
  erwartetesTraining: string,
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await loeseTraining(a.supabase, a.userId, { terminId, erwartetesTraining });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  if (r.wert.trainingId) revalidiereTraining(r.wert.trainingId);
  return { ok: true };
}
```

- [ ] **Step 2: Commit** (Typecheck folgt mit A7)

```bash
git add web/lib/actions/termine.ts
git commit -m "feat(kalender): Server Actions für Termine und Zuordnen (#322, #323)"
```

### Task A6: KI-Werkzeuge — festlegen, ändern, entfernen, zuordnen, lösen; Ansetzen entfällt

**Files:**
- Modify: `web/lib/mcp/werkzeuge/team.ts` (Termin-Werkzeuge ersetzen, `TERMIN_MODELL` neu, `PlanEintrag` mit `ende` und nullable `training`)
- Modify: `web/lib/mcp/server.ts:49-56, 104-107` (Importe und `WERKZEUGE`)
- Modify: `web/lib/mcp/umfang.ts:16`
- Modify: `web/lib/mcp/werkzeuge/trainings-lesen.ts:62-64, 119-130, 143-145` (`ende`, Texte ohne «angesetzt»)
- Modify: `web/lib/mcp/werkzeuge/trainings-bestand.ts:81-111` (`termin_bleibt`)
- Test: `web/scripts/pruefe-kern.ts:1300-1345` (Werkzeug-Wächter, `jeStory`)

**Interfaces:**
- Consumes: A4, A3.
- Produces:
  - KI-Werkzeuge `termin_festlegen`, `termin_aendern`, `termin_entfernen`, `training_zuordnen`, `training_loesen`
  - geänderte Ausgabe von `team_plan_abrufen` (`ende`, `training: … | null`)
  - Die Werkzeuge `termin_ansetzen` und `training_erneut_ansetzen` entfallen.

- [ ] **Step 1: Failing test** — in `pruefe-kern.ts` die Werkzeug-Liste anpassen:

```ts
    "#198": ["teams_abrufen", "team_plan_abrufen"],
    "#322": ["termin_festlegen", "termin_aendern", "termin_entfernen"],
    "#323": ["training_zuordnen", "training_loesen"],
```

Die Ausnahme `&& m[1] !== "terminEntfernen"` im `TERMIN_KENNUNG_FEHLER`-Wächter streichen. `termin_entfernen` meldet jetzt «nicht gefunden» wie jedes andere Werkzeug.

Dazu ein Wächter gegen «ansetzen» (Story 2 PC 11):

```ts
pruefe("Kein «ansetzen» mehr in Oberfläche und KI-Texten (#323 PC 11)", () => {
  const treffer: string[] = [];
  for (const wurzel of ["app", "components", "lib/mcp", "lib/kern", "lib/actions", "lib/termin.ts"].map((p) => join(WEB, p)))
    for (const datei of existsSync(wurzel) && statSync(wurzel).isDirectory() ? quelldateien(wurzel) : [wurzel])
      readFileSync(datei, "utf8").split("\n").forEach((zeile, i) => {
        // Kommentare sieht niemand; geprüft wird, was Oberfläche und KI sagen.
        if (/^\s*(\*|\/\/|\/\*)/.test(zeile)) return;
        const ohneKommentar = zeile.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
        if (/ansetz|angesetzt|Ansetz|Angesetzt/.test(ohneKommentar)) treffer.push(`${relative(WEB, datei)}:${i + 1}`);
      });
  assert.deepEqual(treffer, [], `«ansetzen» steht noch in: ${treffer.join(", ")}`);
});
```

Kommentare in den Dateien, die ein Task ohnehin anfasst, trotzdem auf «zuordnen»/«eingeplant» umstellen (Memory «Hygiene»). `WEB`, `quelldateien`, `join`, `relative`, `existsSync`, `statSync` und `readFileSync` gibt es im Skript bereits für die bestehenden Wächter (L1150ff). Fehlt einer davon, den Import aus `node:fs` bzw. `node:path` ergänzen.

- [ ] **Step 2: Test laufen lassen** — `npm run check:kern` → FAIL: Die Liste «#322» ist nicht registriert, und «ansetzen» steht noch in team.ts, TrainingsPlan.tsx und weiteren Dateien.

- [ ] **Step 3: `web/lib/mcp/werkzeuge/team.ts` — Termin-Teil ersetzen** (ab `TERMIN_MODELL` bis Dateiende; `teamsAbrufen` bleibt, im Beschreibungstext «angesetzten» durch «eingeplanten» ersetzen):

```ts
const TERMIN_MODELL =
  "Der Kalender eines Teams besteht aus Terminen: Datum, Beginn, Ende, Ort und Bemerkung, mit oder " +
  "ohne Training. Termine entstehen nur mit «termin_festlegen»; ein Training kommt ausschliesslich " +
  "durch «training_zuordnen» an einen bestehenden Termin auf ein Datum. Ein Termin trägt höchstens " +
  "ein Training, und ein Training ist höchstens für einen Termin eingeplant — für einen weiteren " +
  "Termin entsteht eine eigenständige Kopie, oder ein Training mit anstehendem Termin wird " +
  "verschoben. Zeiten gelten am Trainingsort (Schweiz). «hat stattgefunden» kennt KiFu nicht.";

const DATUM = z.string().describe("Datum als JJJJ-MM-TT, etwa 2026-10-07.");
const UHRZEIT = z.string().describe("Uhrzeit als HH:MM (24 Stunden), etwa 18:30.");
const ORT = z.string().describe("Ort, frei formuliert, höchstens 100 Zeichen, etwa «Sportplatz Allmend, Feld 2».");
const BEMERKUNG = z.string().describe("Bemerkung, frei formuliert, höchstens 500 Zeichen.");

const PlanEintrag = z.object({
  id: z.string(),
  datum: z.string(),
  beginn: z.string().nullable(),
  ende: z.string().nullable(),
  ort: z.string().nullable(),
  bemerkung: z.string().nullable(),
  /** `null`: Der Termin trägt kein Training (#322 AK 20). */
  training: z.object({ id: z.string(), name: z.string(), stufen: z.array(Wert), url: z.string() }).nullable(),
});

function planEintrag(t: TerminZeile, zugang: Zugang) {
  return {
    id: t.id,
    datum: t.datum,
    beginn: t.beginn,
    ende: t.ende,
    ort: t.ort,
    bemerkung: t.bemerkung,
    training: t.training
      ? {
          id: t.training.id,
          name: t.training.name,
          stufen: t.training.stufen.map((s) => wert(kategorieStufe, s)),
          url: zugang.url("training", t.training.id, "edit"),
        }
      : null,
  };
}
```

`teamPlanAbrufen` bleibt in der Struktur; nur die Beschreibung wird ersetzt:

```ts
  beschreibung:
    "Liefert den Kalender eines deiner Teams, bereits geteilt wie im Team-Bereich: «kommend» (ab " +
    "heute, aufsteigend; der heutige Tag zählt ganz dazu) und «vergangen» (der jüngste zuerst). " +
    "«heute» ist der Tag, an dem geteilt wurde — gemessen am Trainingsort (Schweiz), nicht in deiner " +
    "Zeitzone; rechne nicht selbst. Jeder Eintrag nennt Datum, Beginn, Ende, Ort, Bemerkung und das " +
    "zugeordnete Training; «training: null» heisst, der Termin trägt noch keins. Ein anstehender " +
    "Termin ohne Training ist noch nicht vorbereitet. Übernommene Termine können ohne Beginn oder " +
    "Ende sein. Team-Trainings ohne Termin nennt «trainings_suchen» (bestand: team). " +
    TEAM_KENNUNG_FEHLER,
```

Neue und geänderte Werkzeuge:

```ts
export const terminFestlegen = werkzeug({
  name: "termin_festlegen",
  titel: "Termin festlegen",
  beschreibung:
    "Legt im Kalender eines deiner Teams einen einzelnen Termin ohne Training fest — auch in der " +
    "Vergangenheit. Datum, Beginn und Ende sind Pflicht, das Ende liegt am selben Tag nach dem " +
    "Beginn; Ort und Bemerkung sind frei. Ein Training ordnest du danach mit «training_zuordnen» zu. " +
    `${TERMIN_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    team_id: TeamId,
    datum: DATUM,
    beginn: UHRZEIT.describe("Beginn als HH:MM, etwa 18:30."),
    ende: UHRZEIT.describe("Ende als HH:MM am selben Tag, etwa 20:00."),
    ort: ORT.optional(),
    bemerkung: BEMERKUNG.optional(),
  }),
  ausgabe: z.object({ termin_id: z.string(), team_id: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await legeTerminFest(zugang.supabase, zugang.userId, {
        teamId: e.team_id,
        datum: e.datum,
        beginn: e.beginn,
        ende: e.ende,
        ort: e.ort,
        bemerkung: e.bemerkung,
      }),
      (w) => ({ termin_id: w.terminId, team_id: w.teamId }),
    ),
});

const AendernEingabe = z.object({
  termin_id: TerminId,
  datum: DATUM.optional().describe("Neues Datum als JJJJ-MM-TT; ohne Angabe unverändert."),
  beginn: UHRZEIT.optional().describe(
    "Neuer Beginn als HH:MM; ohne Angabe unverändert. Wer die Zeit ändert, gibt Beginn UND Ende an.",
  ),
  ende: UHRZEIT.optional().describe("Neues Ende als HH:MM am selben Tag; ohne Angabe unverändert."),
  ort: ORT.nullable().optional().describe("Neuer Ort; null leert ihn, ohne Angabe unverändert."),
  bemerkung: BEMERKUNG.nullable().optional().describe("Neue Bemerkung; null leert sie, ohne Angabe unverändert."),
});

export const terminAendern = werkzeug({
  name: "termin_aendern",
  titel: "Termin ändern",
  beschreibung:
    "Ändert Datum, Zeit, Ort oder Bemerkung eines Termins — nur, was du mitgibst. Beginn und Ende " +
    "lassen sich nicht leeren; ändert sich die Zeit, braucht der Termin danach beide. Ein " +
    "übernommener Termin ohne vollständige Zeit lässt sich ändern, ohne die Zeit zu ergänzen. Das " +
    "zugeordnete Training bleibt dasselbe. " +
    `${TERMIN_MODELL} ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: AendernEingabe,
  ausgabe: z.object({ termin_id: z.string(), training_id: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await aendereTermin(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        datum: e.datum,
        beginn: e.beginn,
        ende: e.ende,
        ort: e.ort,
        bemerkung: e.bemerkung,
      }),
      (w) => ({ termin_id: w.terminId, training_id: w.trainingId }),
    ),
});

export const terminEntfernen = werkzeug({
  name: "termin_entfernen",
  titel: "Termin entfernen",
  beschreibung:
    "Entfernt einen Termin sofort und ohne Rückfrage. Sein Training bleibt im Bestand des Teams " +
    "— «training_id» nennt es — und lässt sich mit «training_zuordnen» einem anderen Termin " +
    "zuordnen. Ein ganzes Team-Training löscht «training_loeschen»; sein Termin bleibt dann ohne " +
    `Training bestehen. ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId }),
  ausgabe: z.object({ training_id: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await entferneTermin(zugang.supabase, zugang.userId, { terminId: e.termin_id }), (w) => ({
      training_id: w.trainingId,
    })),
});

export const trainingZuordnen = werkzeug({
  name: "training_zuordnen",
  titel: "Training einem Termin zuordnen",
  beschreibung:
    "Ordnet einem Termin ein Training aus dem Bestand desselben Teams zu; trägt der Termin schon " +
    "eins, bleibt jenes ohne Termin im Bestand («im_bestand_geblieben»). Ist das Training bereits " +
    "für einen ANSTEHENDEN Termin eingeplant, musst du «art» wählen: «kopie» legt eine " +
    "eigenständige, gleichnamige Kopie für diesen Termin an, «verschieben» nimmt es vom bisherigen " +
    "Termin weg («frei_gewordener_termin»). Ist sein Termin VERGANGEN, entsteht immer eine Kopie; " +
    "«verschieben» wird dann abgewiesen. Scheitert die Zuordnung einer Kopie, entfernt KiFu die " +
    `Kopie wieder; «hinweis» sagt, ob etwas stehen blieb. ${TERMIN_MODELL} ${TERMIN_KENNUNG_FEHLER} ` +
    KENNUNG_FEHLER,
  nurLesen: false,
  eingabe: z.object({
    termin_id: TerminId,
    training_id: TrainingId,
    art: z
      .enum(["kopie", "verschieben"])
      .optional()
      .describe("Nur für ein Training, das schon einem anderen Termin gehört."),
  }),
  ausgabe: z.object({
    termin_id: z.string(),
    training_id: z.string().describe("Das Training, das jetzt am Termin steht — bei einer Kopie die Kopie."),
    kopie: z.boolean(),
    im_bestand_geblieben: z.string().nullable(),
    frei_gewordener_termin: z.string().nullable(),
    url: z.string(),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await ordneTrainingZu(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        trainingId: e.training_id,
        art: e.art,
      }),
      (w) => ({
        termin_id: w.terminId,
        training_id: w.trainingId,
        kopie: w.kopie,
        im_bestand_geblieben: w.imBestand,
        frei_gewordener_termin: w.freierTermin,
        url: zugang.url("training", w.trainingId, "edit"),
      }),
    ),
});

export const trainingLoesen = werkzeug({
  name: "training_loesen",
  titel: "Training vom Termin lösen",
  beschreibung:
    "Löst das Training von seinem Termin: Der Termin bleibt ohne Training im Kalender, das " +
    `Training ohne Termin im Bestand des Teams. ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId }),
  ausgabe: z.object({ training_id: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await loeseTraining(zugang.supabase, zugang.userId, { terminId: e.termin_id }), (w) => ({
      training_id: w.trainingId,
    })),
});
```

Die Importe am Dateikopf lauten jetzt: `aendereTermin, entferneTermin, legeTerminFest, loeseTraining, ordneTrainingZu` aus `@/lib/kern/termine`. `TerminId` in `trainings.ts:81-84` beschreibt unverändert «(«id» eines Eintrags aus «team_plan_abrufen» …)»; «angesetzt» kommt dort nicht vor.

- [ ] **Step 4: Registrierung, Zugangstext, Auskunft-Texte**

`web/lib/mcp/server.ts`: Die Importe und die `WERKZEUGE`-Einträge `terminAnsetzen` und `trainingErneutAnsetzen` durch `terminFestlegen, trainingZuordnen, trainingLoesen` ersetzen (Reihenfolge: `teamsAbrufen, teamPlanAbrufen, terminFestlegen, terminAendern, terminEntfernen, trainingZuordnen, trainingLoesen`).

`web/lib/mcp/umfang.ts` Zeile 16:

```ts
  "Team-Trainings deiner Teams führen und im Kalender deiner Teams Termine festlegen, ändern und entfernen und ihnen Trainings zuordnen",
```

`web/lib/mcp/werkzeuge/trainings-lesen.ts`:
- Die Beschreibung von `training_abrufen` sagt: «Ein Team-Training trägt in «termin» den Termin, dem es zugeordnet ist (höchstens einen; «anstehend» sagt, ob er heute oder später ist), sonst null.»
- `SuchenTreffer.termin` erhält `ende: z.string().nullable()`.

`web/lib/mcp/werkzeuge/trainings-bestand.ts` `training_loeschen`:
- Beschreibung: «… samt allen Übungen, Bildern, Gruppen und Varianten. War es einem Termin zugeordnet, bleibt der Termin ohne Training im Kalender («termin_bleibt»). …»
- Ausgabe: `termin_bleibt: z.object({ id: z.string(), datum: z.string() }).nullable()`
- Mapping: `termin_bleibt: w.terminBleibt`

- [ ] **Step 5: Tests laufen lassen**

Run: `npm run check:kern && npm run check:ki-zugang`
Expected: Der Werkzeug-Wächter besteht. Der «ansetzen»-Wächter meldet nur noch Oberflächen-Dateien (`app/team/[id]/page.tsx`, `components/team/*`, `app/styleguide/page.tsx`); die behebt A7.

- [ ] **Step 6: Commit**

```bash
git add web/lib/mcp web/scripts/pruefe-kern.ts
git commit -m "feat(ki): Kalender-Werkzeuge festlegen, ändern, entfernen, zuordnen, lösen (#322, #323)"
```

### Task A7: Oberfläche — Trainingsplan als Kalender-Liste mit Dialogen

**Files:**
- Create: `web/components/team/TerminBereich.tsx` (Aktions-Kontext mit allen Dialogen; Teil F nutzt ihn für den Monatsüberblick)
- Create: `web/components/team/TrainingWahlDialog.tsx`
- Modify: `web/components/team/TerminDialog.tsx` (Ende, Pflicht, Fehler am Feld)
- Modify: `web/components/team/TrainingsPlan.tsx` (ganz ersetzen)
- Modify: `web/components/ui/Badge.tsx` (Ton `befund`) und `web/app/styleguide/page.tsx` (Plaketten-Demo, Leerzustand-Demo L2286)
- Modify: `web/app/team/[id]/page.tsx`

**Interfaces:**
- Consumes: A3 (`TerminZeile`, `Plan`, `nochNichtVorbereitet`), A5 (Actions), `getTeamTrainings` (`lib/queries/trainings.ts:133`), `zeitText` (A2).
- Produces:
  - `TerminBereich({ teamId, trainings, heute, children })` und `useTerminAktionen(): TerminAktionen` mit `{ neu(datum?: string), bearbeiten(t), zuordnen(t), loesen(t), entfernen(t), pending }`. Teil B ergänzt `neueSerie`, C die Props `mitglieder`/`ich`, D `ausfallen`/`ausfallZuruecknehmen`, E die Prop `persoenliche`, F `oeffnen`.
  - `TrainingsPlan({ plan, heute })` (Teil G ergänzt `hervorheben`), `TerminKarte({ t, heute })`
  - Badge-Ton `befund`

- [ ] **Step 1: Badge-Ton `befund` ergänzen** — in `Badge.tsx` `type Tone` um `"befund"` erweitern und in `tones`:

```ts
  // Etwas ist offen, das jemand erledigen muss — noch kein Training am
  // anstehenden Termin (Team-Kalender #322 AK 16). Derselbe Ton wie der
  // Befund am ChipMenu: Rahmen und Schrift in Error, keine Fläche. Er meldet
  // eine Lücke, keinen Fehler; darum umrandet statt gefüllt.
  befund: "kontur border-error text-error",
```

Im Styleguide, Abschnitt 09 «Plaketten & Chips», neben den bestehenden Plaketten ergänzen: `<Badge tone="befund"><CalendarX2 size={12} strokeWidth={2.5} aria-hidden />Noch kein Training</Badge>`. Dazu kommt die Begründung als Satz unter der Plaketten-Reihe: «Befund: eine offene Lücke, die jemand schliessen muss — etwa ein anstehender Termin ohne Training.»

- [ ] **Step 2: `TerminDialog.tsx` ersetzen**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, DateField, Dialog, TextArea, TextField, TimeField } from "@/components/ui";
import { BEMERKUNG_MAX, ORT_MAX, terminProblem, type TerminFeld, type TerminFelder } from "@/lib/termin";

/* Einen einzelnen Termin festlegen oder ändern (Team-Kalender #322).
   Die Regeln kommen aus lib/termin.ts — dieselben, die der Fachkern prüft;
   der Dialog zeigt den Fehler am Feld, bevor er etwas sendet. */
export function TerminDialog({
  open,
  titel,
  bestaetigung,
  start,
  /** Die Zeit vor dem Ändern — ohne: neuer Termin, Beginn und Ende Pflicht. */
  bisher,
  pending,
  fehler: serverFehler,
  onClose,
  onSpeichern,
}: {
  open: boolean;
  titel: string;
  bestaetigung: string;
  start?: Partial<TerminFelder>;
  bisher?: { beginn: string | null; ende: string | null };
  pending?: boolean;
  fehler?: string;
  onClose: () => void;
  onSpeichern: (felder: TerminFelder) => void;
}) {
  const [felder, setFelder] = useState<TerminFelder>({ datum: "" });
  const [problem, setProblem] = useState<{ feld: TerminFeld; text: string } | null>(null);

  // Beim Öffnen auf die Vorbelegung zurücksetzen — der Dialog überlebt sonst
  // mit den Werten des zuletzt bearbeiteten Termins.
  useEffect(() => {
    if (!open) return;
    setFelder({
      datum: start?.datum ?? "",
      beginn: start?.beginn ?? "",
      ende: start?.ende ?? "",
      ort: start?.ort ?? "",
      bemerkung: start?.bemerkung ?? "",
    });
    setProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setze = (k: keyof TerminFelder) => (v: string) => setFelder((f) => ({ ...f, [k]: v }));
  const fehlerAn = (k: TerminFeld) => (problem?.feld === k ? problem.text : undefined);

  function speichern() {
    const p = terminProblem(felder, bisher);
    setProblem(p);
    if (!p) onSpeichern(felder);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={titel}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" onClick={speichern} disabled={pending}>{bestaetigung}</Button>
        </>
      }
    >
      {serverFehler && <p role="alert" className="mb-4 text-error">{serverFehler}</p>}
      <div className="flex flex-col gap-4">
        <DateField label="Datum" value={felder.datum} onChange={(e) => setze("datum")(e.target.value)} error={fehlerAn("datum")} />
        <div className="flex flex-col gap-4 sm:flex-row">
          <TimeField label="Beginn" value={felder.beginn ?? ""} onChange={(e) => setze("beginn")(e.target.value)} error={fehlerAn("beginn")} />
          <TimeField label="Ende" value={felder.ende ?? ""} onChange={(e) => setze("ende")(e.target.value)} error={fehlerAn("ende")} />
        </div>
        <TextField label="Ort (optional)" maxLength={ORT_MAX} value={felder.ort ?? ""} onChange={(e) => setze("ort")(e.target.value)} error={fehlerAn("ort")} />
        <TextArea label="Bemerkung (optional)" rows={3} maxLength={BEMERKUNG_MAX} value={felder.bemerkung ?? ""} onChange={(e) => setze("bemerkung")(e.target.value)} error={fehlerAn("bemerkung")} />
      </div>
    </Dialog>
  );
}
```

(Die Feld-Props `value`/`onChange`/`error` entsprechen den bestehenden Aufrufen; `DateField`/`TimeField` reichen Input-Props durch.)

- [ ] **Step 3: `TrainingWahlDialog.tsx` anlegen** (AK 5, 6, 10, 11)

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ChoiceChip, ChoiceChipGroup, Dialog } from "@/components/ui";
import { datumKurz } from "@/lib/zeit";
import type { TeamTrainingRow } from "@/lib/queries/trainings";
import type { TerminZeile } from "@/lib/queries/termine";

/* Einem Termin ein Training wählen (Team-Kalender #323 AK 5, 6, 10, 11).
   Noch nicht eingeplante Trainings stehen zuerst; bei eingeplanten steht,
   für welchen Termin. Gehört das gewählte schon einem ANSTEHENDEN Termin,
   muss zwischen Kopie und Verschieben gewählt werden; bei einem vergangenen
   entsteht immer eine Kopie. */
export type TrainingWahl = { trainingId: string; art?: "kopie" | "verschieben"; trainingTermin: string | null };

export function TrainingWahlDialog({
  termin,
  trainings,
  heute,
  pending,
  onClose,
  onWahl,
}: {
  termin: TerminZeile | null;
  trainings: TeamTrainingRow[];
  heute: string;
  pending?: boolean;
  onClose: () => void;
  onWahl: (w: TrainingWahl) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [art, setArt] = useState<"kopie" | "verschieben" | null>(null);
  useEffect(() => { setGewaehlt(null); setArt(null); }, [termin]);

  const liste = useMemo(
    () =>
      trainings
        .filter((t) => t.id !== termin?.training?.id)
        // Stabil: innerhalb der Gruppen bleibt die Reihenfolge des Bestands.
        .sort((a, b) => Number(a.termin !== null) - Number(b.termin !== null)),
    [trainings, termin],
  );
  const wahl = liste.find((t) => t.id === gewaehlt) ?? null;
  const anstehend = wahl?.termin ? wahl.termin.datum >= heute : false;
  const bereit = wahl !== null && (!anstehend || art !== null);

  return (
    <Dialog
      open={termin !== null}
      onClose={onClose}
      title={termin?.training ? "Training ersetzen" : "Training zuordnen"}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button
            variant="filled"
            disabled={!bereit || pending}
            onClick={() =>
              wahl && onWahl({
                trainingId: wahl.id,
                art: wahl.termin ? (anstehend ? art! : "kopie") : undefined,
                trainingTermin: wahl.termin?.id ?? null,
              })
            }
          >
            Zuordnen
          </Button>
        </>
      }
    >
      {termin?.training && (
        <p className="mb-3">
          «{termin.training.name}» bleibt ohne Termin im Team-Bestand.
        </p>
      )}
      {liste.length === 0 ? (
        <p>Im Team-Bestand gibt es noch kein weiteres Training.</p>
      ) : (
        <ul role="listbox" aria-label="Trainings des Teams" className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {liste.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                role="option"
                aria-selected={t.id === gewaehlt}
                onClick={() => { setGewaehlt(t.id); setArt(null); }}
                className={`focus-ring w-full rounded-flaeche px-3 py-2 text-left ${t.id === gewaehlt ? "bg-elev-08" : "hover:bg-elev-04"}`}
              >
                <span className="block text-on-surface">{t.name}</span>
                <span className="type-body-small text-on-surface-mittel">
                  {t.termin ? `Eingeplant · ${datumKurz(t.termin.datum)}` : "Noch nicht eingeplant"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {wahl?.termin && anstehend && (
        <div className="mt-4">
          <p className="mb-2">
            «{wahl.name}» ist schon für {datumKurz(wahl.termin.datum)} eingeplant.
          </p>
          <ChoiceChipGroup ariaLabel="Kopieren oder verschieben">
            <ChoiceChip tabStop selected={art === "kopie"} onSelect={() => setArt("kopie")} look="nutzertext">
              Kopie für diesen Termin
            </ChoiceChip>
            <ChoiceChip selected={art === "verschieben"} onSelect={() => setArt("verschieben")} look="nutzertext">
              Auf diesen Termin verschieben
            </ChoiceChip>
          </ChoiceChipGroup>
        </div>
      )}
      {wahl?.termin && !anstehend && (
        <p className="mt-4">
          «{wahl.name}» gehört zum vergangenen Termin {datumKurz(wahl.termin.datum)}. Für diesen
          Termin entsteht eine eigenständige Kopie.
        </p>
      )}
    </Dialog>
  );
}
```

- [ ] **Step 4: `TerminBereich.tsx` anlegen**

```tsx
"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { TerminDialog } from "./TerminDialog";
import { TrainingWahlDialog, type TrainingWahl } from "./TrainingWahlDialog";
import {
  aendereTerminAktion,
  entferneTerminAktion,
  legeTerminFestAktion,
  loeseTrainingAktion,
  ordneTrainingZuAktion,
  type TerminFelder,
} from "@/lib/actions/termine";
import { datumKurz } from "@/lib/zeit";
import type { TeamTrainingRow } from "@/lib/queries/trainings";
import type { TerminZeile } from "@/lib/queries/termine";

/* Alle Aktionen am Kalender eines Teams an einer Stelle (Team-Kalender
   #322, #323). Die Liste und — ab Teil F — der Monatsüberblick rufen
   dieselben Funktionen auf, damit ein Termin in beiden Ansichten dieselben
   Aktionen bietet (#329 AK 8). */
export type TerminAktionen = {
  neu: (datum?: string) => void;
  bearbeiten: (t: TerminZeile) => void;
  zuordnen: (t: TerminZeile) => void;
  loesen: (t: TerminZeile) => void;
  entfernen: (t: TerminZeile) => void;
  pending: boolean;
};

const Kontext = createContext<TerminAktionen | null>(null);

export function useTerminAktionen(): TerminAktionen {
  const k = useContext(Kontext);
  if (!k) throw new Error("useTerminAktionen ausserhalb von <TerminBereich>");
  return k;
}

export function TerminBereich({
  teamId,
  trainings,
  heute,
  children,
}: {
  teamId: string;
  trainings: TeamTrainingRow[];
  heute: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [neu, setNeu] = useState<string | null>(null); // Vorbelegtes Datum; "" = ohne
  const [bearbeiten, setBearbeiten] = useState<TerminZeile | null>(null);
  const [zuordnen, setZuordnen] = useState<TerminZeile | null>(null);
  const [entfernen, setEntfernen] = useState<TerminZeile | null>(null);
  const [dialogFehler, setDialogFehler] = useState<string | undefined>();

  /** Eine Aktion ausführen: bei Erfolg schliessen, neu laden, melden; bei
   *  einem Fehler bleibt ein Formular offen und zeigt ihn (`imDialog`),
   *  sonst meldet die Snackbar. */
  function lauf<T extends { ok: boolean; error?: string }>(
    aufruf: () => Promise<T>,
    erfolg: (r: T) => string,
    schliessen: () => void,
    imDialog = false,
  ) {
    startTransition(async () => {
      const r = await aufruf();
      if (!r.ok && imDialog) { setDialogFehler(r.error); return; }
      schliessen();
      setDialogFehler(undefined);
      router.refresh();
      melde(r.ok ? erfolg(r) : (r.error ?? "Fehlgeschlagen."));
    });
  }

  const aktionen: TerminAktionen = {
    neu: (datum) => { setDialogFehler(undefined); setNeu(datum ?? ""); },
    bearbeiten: (t) => { setDialogFehler(undefined); setBearbeiten(t); },
    zuordnen: setZuordnen,
    loesen: (t) =>
      t.training &&
      lauf(() => loeseTrainingAktion(t.id, t.training!.id), () => `«${t.training!.name}» ist gelöst und bleibt im Team-Bestand.`, () => {}),
    entfernen: setEntfernen,
    pending,
  };

  return (
    <Kontext.Provider value={aktionen}>
      {children}

      <TerminDialog
        open={neu !== null}
        titel="Termin festlegen"
        bestaetigung="Festlegen"
        start={{ datum: neu ?? "" }}
        pending={pending}
        fehler={dialogFehler}
        onClose={() => setNeu(null)}
        onSpeichern={(f: TerminFelder) =>
          lauf(() => legeTerminFestAktion(teamId, f), () => "Termin festgelegt.", () => setNeu(null), true)
        }
      />

      <TerminDialog
        open={bearbeiten !== null}
        titel="Termin ändern"
        bestaetigung="Speichern"
        start={bearbeiten ? { datum: bearbeiten.datum, beginn: bearbeiten.beginn ?? "", ende: bearbeiten.ende ?? "", ort: bearbeiten.ort ?? "", bemerkung: bearbeiten.bemerkung ?? "" } : undefined}
        bisher={bearbeiten ? { beginn: bearbeiten.beginn, ende: bearbeiten.ende } : undefined}
        pending={pending}
        fehler={dialogFehler}
        onClose={() => setBearbeiten(null)}
        onSpeichern={(f) =>
          bearbeiten &&
          lauf(() => aendereTerminAktion(bearbeiten.id, f, bearbeiten.training?.id ?? null), () => "Termin geändert.", () => setBearbeiten(null), true)
        }
      />

      <TrainingWahlDialog
        termin={zuordnen}
        trainings={trainings}
        heute={heute}
        pending={pending}
        onClose={() => setZuordnen(null)}
        onWahl={(w: TrainingWahl) =>
          zuordnen &&
          lauf(
            () => ordneTrainingZuAktion({
              terminId: zuordnen.id,
              trainingId: w.trainingId,
              art: w.art,
              erwartet: { terminTraining: zuordnen.training?.id ?? null, trainingTermin: w.trainingTermin },
            }),
            (r) => ("kopie" in r && r.kopie ? "Kopie angelegt und dem Termin zugeordnet." : "Training zugeordnet."),
            () => setZuordnen(null),
          )
        }
      />

      <Dialog
        open={entfernen !== null}
        onClose={() => setEntfernen(null)}
        title="Termin entfernen?"
        actions={
          <>
            <Button variant="text" onClick={() => setEntfernen(null)}>Abbrechen</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                entfernen &&
                lauf(() => entferneTerminAktion(entfernen.id, entfernen.training?.id ?? null), () => "Termin entfernt.", () => setEntfernen(null))
              }
            >
              Entfernen
            </Button>
          </>
        }
      >
        <p>
          Der Termin am {entfernen ? datumKurz(entfernen.datum) : ""} verschwindet aus dem Kalender.
          {entfernen?.training && (
            <> <strong className="text-on-surface">{entfernen.training.name}</strong> bleibt ohne Termin im Team-Bestand.</>
          )}
        </p>
      </Dialog>
    </Kontext.Provider>
  );
}
```

- [ ] **Step 5: `TrainingsPlan.tsx` ersetzen**

```tsx
"use client";

import Link from "next/link";
import { CalendarDays, CalendarPlus, CalendarX2, MapPin, Pencil, PlayCircle, Trash2, Unlink } from "lucide-react";
import { Badge, Card, Disclosure, IconButton, IconButtonLink, KategorieChip, OverflowMenu, Tooltip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useTerminAktionen } from "./TerminBereich";
import { zeitText } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
// Werte aus termine-fuer.ts, nicht aus termine.ts: Jenes zieht den Cookie-Client
// (next/headers) ins Client-Bundle.
import { nochNichtVorbereitet, type Plan, type TerminZeile } from "@/lib/queries/termine-fuer";

/* Der Kalender eines Teams als Liste (Team-Kalender #322, #323; gegliedert
   mit Story 18): zuoberst, was ansteht, danach der Rückblick, zugeklappt.
   Ein Termin ohne Training ist auf einen Blick erkennbar (AK 16, 17). */
export function TrainingsPlan({ plan, heute }: { plan: Plan; heute: string }) {
  const nichtsMehrOffen = plan.kommend.length === 0;
  return (
    <>
      <section>
        <h3 className="type-title-small text-on-surface-mittel">
          Als Nächstes <span className="text-on-surface-tief">{plan.kommend.length}</span>
        </h3>
        <ol className="mt-2 flex flex-col gap-3">
          {plan.kommend.map((t) => <TerminKarte key={t.id} t={t} heute={heute} />)}
        </ol>
      </section>
      {plan.vergangen.length > 0 && (
        <Disclosure
          key={nichtsMehrOffen ? "allein" : "mit-kommendem"}
          title="Vergangen"
          count={plan.vergangen.length}
          defaultOpen={nichtsMehrOffen}
          className={cn(plan.kommend.length > 0 && "mt-6")}
        >
          <ol className="mt-2 flex flex-col gap-3">
            {plan.vergangen.map((t) => <TerminKarte key={t.id} t={t} heute={heute} />)}
          </ol>
        </Disclosure>
      )}
    </>
  );
}

export function TerminKarte({ t, heute }: { t: TerminZeile; heute: string }) {
  const a = useTerminAktionen();
  const vergangen = t.datum < heute;
  const zeit = zeitText(t.beginn, t.ende);
  const kopf = (
    <p className="flex flex-wrap items-center gap-x-2 type-body-small text-on-surface-mittel">
      <CalendarDays size={14} aria-hidden />
      {datumKurz(t.datum)}
      {zeit ? <> · {zeit} Uhr</> : null}
      {/* AK 15: fehlende Zeit sichtbar machen, ohne den Termin zu öffnen. */}
      {!t.beginn && <span className="text-error">· Zeit fehlt</span>}
      {t.beginn && !t.ende && <span className="text-error">· Ende fehlt</span>}
      {t.ort && <><MapPin size={14} aria-hidden />{t.ort}</>}
    </p>
  );

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className={cn("min-w-0 flex-1", vergangen && "opacity-60")}>
            {kopf}
            {t.training ? (
              <Link href={`/training/${t.training.id}`} className="focus-ring group mt-1 block rounded-flaeche">
                <h4 className="type-title-medium text-on-surface group-hover:underline">{t.training.name}</h4>
                <div className="mt-1 flex flex-wrap gap-1">{t.training.stufen.map((k) => <KategorieChip key={k} k={k} />)}</div>
              </Link>
            ) : (
              <div className="mt-1">
                {nochNichtVorbereitet(t, heute) ? (
                  <Badge tone="befund"><CalendarX2 size={12} strokeWidth={2.5} aria-hidden />Noch kein Training</Badge>
                ) : (
                  <Badge tone="neutral">Ohne Training</Badge>
                )}
              </div>
            )}
            {t.bemerkung && <p className="mt-1 type-body-small text-on-surface-mittel">{t.bemerkung}</p>}
          </div>
          <div className="flex shrink-0 gap-0.5">
            {t.training && (
              <Tooltip label="Durchführen">
                <IconButtonLink href={`/training/${t.training.id}/durchfuehren?termin=${t.id}`} icon={PlayCircle} label={`${t.training.name} durchführen`} />
              </Tooltip>
            )}
            <Tooltip label={t.training ? "Training ersetzen" : "Training zuordnen"}>
              <IconButton icon={CalendarPlus} label={`Training für ${datumKurz(t.datum)} ${t.training ? "ersetzen" : "zuordnen"}`} onClick={() => a.zuordnen(t)} />
            </Tooltip>
            <OverflowMenu
              label={`Weitere Aktionen zum Termin ${datumKurz(t.datum)}`}
              items={[
                { label: "Termin ändern", icon: Pencil, onSelect: () => a.bearbeiten(t) },
                ...(t.training ? [{ label: "Training lösen", icon: Unlink, onSelect: () => a.loesen(t) }] : []),
                { label: "Termin entfernen", icon: Trash2, danger: true, onSelect: () => a.entfernen(t) },
              ]}
            />
          </div>
        </div>
      </Card>
    </li>
  );
}
```

- [ ] **Step 6: `web/app/team/[id]/page.tsx` ersetzen**

```tsx
import { CalendarPlus } from "lucide-react";
import { Leerzustand } from "@/components/ui";
import { TerminBereich } from "@/components/team/TerminBereich";
import { TrainingsPlan } from "@/components/team/TrainingsPlan";
import { NeuerTerminKnopf } from "@/components/team/NeuerTerminKnopf";
import { getTeamPlan, teilePlan } from "@/lib/queries/termine";
import { getTeamTrainings } from "@/lib/queries/trainings";
import { heuteAmTrainingsort } from "@/lib/zeit";

/* Der Kalender eines Teams — die Einstiegsansicht (Story 17 AK 3; #329 PC 1).
   Geteilt wird hier in Kommendes und Vergangenes: Der Schnitt hängt am
   heutigen Tag am Trainingsort und lässt sich nur an einer Stelle bestimmen,
   wenn Server und Browser dieselbe Liste rendern sollen. */
export default async function TeamPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const heute = heuteAmTrainingsort();
  const [termine, trainings] = await Promise.all([getTeamPlan(id), getTeamTrainings(id)]);
  const plan = teilePlan(termine, heute);
  const leer = termine.length === 0;

  return (
    <TerminBereich teamId={id} trainings={trainings} heute={heute}>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-title-large text-on-surface">Trainingsplan</h2>
          <NeuerTerminKnopf />
        </div>
        {leer ? (
          <Leerzustand icon={CalendarPlus} titel="Noch keine Termine" dicht>
            Lege die Trainingszeiten des Teams als Termine fest. Welches Training dort stattfindet,
            ordnest du danach zu.
          </Leerzustand>
        ) : (
          <TrainingsPlan plan={plan} heute={heute} />
        )}
      </section>
    </TerminBereich>
  );
}
```

Dazu `web/components/team/NeuerTerminKnopf.tsx`:

```tsx
"use client";

import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui";
import { useTerminAktionen } from "./TerminBereich";

/** Der Einstieg in den Kalender (#322 AK 1). Teil B stellt «Terminserie
 *  festlegen» daneben. */
export function NeuerTerminKnopf() {
  const a = useTerminAktionen();
  return (
    <Button variant="tonal" onClick={() => a.neu()}>
      <CalendarPlus size={18} aria-hidden /> Termin festlegen
    </Button>
  );
}
```

Im Styleguide die Leerzustand-Demo (L2286-2287) auf «Noch keine Termine» mit dem neuen Text umstellen.

- [ ] **Step 7: Typecheck und Wächter**

Run: `npm run typecheck && npm run check:kern && npm run check:farben`
Expected: `typecheck` meldet nur noch `TeamTrainingsListe.tsx` (alte Importe `erstelleTermin`, `setzeErneutAn`); das behebt A8. `check:farben` ist grün (keine Secondary-Klasse).

- [ ] **Step 8: Commit**

```bash
git add web/components/team web/components/ui/Badge.tsx web/app/team/[id]/page.tsx web/app/styleguide/page.tsx
git commit -m "feat(kalender): Trainingsplan zeigt Termine ohne Training, Festlegen und Zuordnen (#322, #323)"
```

### Task A8: Oberfläche — Team-Bestand, Löschdialoge, Durchführen, Auflösen

**Files:**
- Create: `web/components/team/TerminWahlDialog.tsx`
- Modify: `web/components/team/TeamTrainingsListe.tsx` (Ansetzen → «Termin zuordnen», Plakette «Eingeplant», Entfernen-Text)
- Modify: `web/app/team/[id]/trainings/page.tsx` (Plan mitladen)
- Modify: `web/components/training/TrainingAktionen.tsx:67-97, 305-333` (neue Prop `terminDatum`)
- Modify: `web/app/training/[id]/page.tsx:99`, `web/components/training/editor/TrainingEditor.tsx:582` (Prop durchreichen)
- Modify: `web/components/training/TrainingDurchfuehren.tsx:19-45` (`TerminKopf` mit Ende)
- Modify: `web/app/training/[id]/durchfuehren/page.tsx:30-40` (`ende` durchreichen)

**Interfaces:**
- Consumes: A5 `ordneTrainingZuAktion`; A3 `TeamTrainingRow.termin`, `TerminZeile`.
- Produces: `TerminWahlDialog({ training, termine, heute, pending, onClose, onWahl })`

- [ ] **Step 1: `TerminWahlDialog.tsx`** (AK 2, 7, 8, 10, 11, 13)

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, ChoiceChip, ChoiceChipGroup, Dialog } from "@/components/ui";
import { zeitText } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
import type { TeamTrainingRow } from "@/lib/queries/trainings";
import type { TerminZeile } from "@/lib/queries/termine";

/* Einem Training aus dem Team-Bestand einen Termin wählen (#323 AK 2, 7, 8).
   Jeder Termin des Teams steht zur Wahl — auch vergangene (AK 13) — ausser
   dem, den das Training schon trägt. Bei jedem steht, ob und welches
   Training er trägt. */
export function TerminWahlDialog({
  training,
  termine,
  heute,
  pending,
  onClose,
  onWahl,
}: {
  training: TeamTrainingRow | null;
  /** Anstehende aufsteigend, dann vergangene absteigend (`teilePlan`). */
  termine: TerminZeile[];
  heute: string;
  pending?: boolean;
  onClose: () => void;
  onWahl: (w: { termin: TerminZeile; art?: "kopie" | "verschieben" }) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<TerminZeile | null>(null);
  const [art, setArt] = useState<"kopie" | "verschieben" | null>(null);
  useEffect(() => { setGewaehlt(null); setArt(null); }, [training]);

  const liste = termine.filter((t) => t.id !== training?.termin?.id);
  const eigenAnstehend = training?.termin ? training.termin.datum >= heute : false;
  const bereit = gewaehlt !== null && (!training?.termin || !eigenAnstehend || art !== null);

  return (
    <Dialog
      open={training !== null}
      onClose={onClose}
      title="Termin zuordnen"
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button
            variant="filled"
            disabled={!bereit || pending}
            onClick={() => gewaehlt && onWahl({ termin: gewaehlt, art: training?.termin ? (eigenAnstehend ? art! : "kopie") : undefined })}
          >
            Zuordnen
          </Button>
        </>
      }
    >
      {liste.length === 0 ? (
        <p>Das Team hat noch keinen Termin. Lege ihn im Trainingsplan fest.</p>
      ) : (
        <ul role="listbox" aria-label="Termine des Teams" className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {liste.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                role="option"
                aria-selected={t.id === gewaehlt?.id}
                onClick={() => setGewaehlt(t)}
                className={`focus-ring w-full rounded-flaeche px-3 py-2 text-left ${t.id === gewaehlt?.id ? "bg-elev-08" : "hover:bg-elev-04"} ${t.datum < heute ? "opacity-70" : ""}`}
              >
                <span className="block text-on-surface">
                  {datumKurz(t.datum)}{zeitText(t.beginn, t.ende) ? ` · ${zeitText(t.beginn, t.ende)} Uhr` : ""}
                </span>
                <span className="type-body-small text-on-surface-mittel">
                  {t.training ? `Trägt «${t.training.name}»` : "Ohne Training"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {training?.termin && eigenAnstehend && (
        <ChoiceChipGroup ariaLabel="Kopieren oder verschieben" className="mt-4">
          <ChoiceChip tabStop selected={art === "kopie"} onSelect={() => setArt("kopie")} look="nutzertext">Kopie für den gewählten Termin</ChoiceChip>
          <ChoiceChip selected={art === "verschieben"} onSelect={() => setArt("verschieben")} look="nutzertext">Auf ihn verschieben</ChoiceChip>
        </ChoiceChipGroup>
      )}
      {training?.termin && !eigenAnstehend && (
        <p className="mt-4">Das Training gehört zu einem vergangenen Termin; für den gewählten entsteht eine eigenständige Kopie.</p>
      )}
    </Dialog>
  );
}
```

- [ ] **Step 2: `TeamTrainingsListe.tsx` umbauen**
  - Props um `termine: TerminZeile[]` und `heute: string` erweitern.
  - State `ansetzen` → `zuordnen: TeamTrainingRow | null`.
  - `ansetzenSpeichern` ersetzen durch:

```tsx
  function zuordnenSpeichern({ termin, art }: { termin: TerminZeile; art?: "kopie" | "verschieben" }) {
    if (!zuordnen) return;
    startTransition(async () => {
      const res = await ordneTrainingZuAktion({
        terminId: termin.id,
        trainingId: zuordnen.id,
        art,
        erwartet: { terminTraining: termin.training?.id ?? null, trainingTermin: zuordnen.termin?.id ?? null },
      });
      setZuordnen(null);
      router.refresh();
      melde(res.ok ? (res.kopie ? "Kopie angelegt und dem Termin zugeordnet." : "Training zugeordnet.") : res.error);
    });
  }
```

  - Plakette (L136-141): `Eingeplant · {datumKurz(t.termin.datum)}`.
  - Knopf (L166-170): `<Tooltip label="Termin zuordnen"><IconButton icon={CalendarPlus} label={\`${t.name} einem Termin zuordnen\`} onClick={() => setZuordnen(t)} /></Tooltip>`.
  - Den `TerminDialog` durch `<TerminWahlDialog training={zuordnen} termine={termine} heute={heute} pending={pending} onClose={() => setZuordnen(null)} onWahl={zuordnenSpeichern} />` ersetzen.
  - Den Entfernen-Dialog (L251) so fassen, dass er den Termin nur nennt, wenn es einen gibt (AK 18):

```tsx
          <p>
            <strong className="text-on-surface">{entfernen?.name}</strong> wird für das ganze Team gelöscht.
            {entfernen?.termin && <> Der Termin am {datumKurz(entfernen.termin.datum)} bleibt ohne Training im Trainingsplan bestehen.</>}
          </p>
```

  - Importe: `erstelleTermin, setzeErneutAn` und `TerminDialog` entfernen; `ordneTrainingZuAktion` und `TerminWahlDialog` sowie `type TerminZeile` aus `@/lib/queries/termine` importieren.

`web/app/team/[id]/trainings/page.tsx`: `getTeamPlan(id)` parallel zu `getTeamTrainings(id)` laden. `teilePlan(termine, heute)` mit `heute = heuteAmTrainingsort()` bilden und `termine={[...plan.kommend, ...plan.vergangen]} heute={heute}` an `TeamTrainingsListe` übergeben.

- [ ] **Step 3: Löschen im Editor nennt den Termin (AK 18)** — `TrainingAktionen`: Prop `terminDatum?: string | null` ergänzen (Doku: «Der Termin, dem das Team-Training zugeordnet ist — der Löschdialog nennt ihn, weil er bestehen bleibt»). Im Dialog «Training löschen?» nach dem ersten Absatz:

```tsx
          {terminDatum && (
            <p className="mt-3">
              Der Termin am {datumKurz(terminDatum)} bleibt ohne Training im Trainingsplan des Teams bestehen.
            </p>
          )}
```

In `app/training/[id]/page.tsx:99` und `TrainingEditor.tsx:582` `terminDatum={training.terminDatum}` übergeben. `TrainingDetail.terminDatum` gibt es bereits (`trainings-fuer.ts:95`). Im Editor heisst das Objekt je nach Datei `training` oder `detail`; den vorhandenen Namen verwenden.

- [ ] **Step 4: Durchführen-Kopf zeigt Beginn und Ende (AK 14, 15)** — `TrainingDurchfuehren.tsx`: `TerminKontext` um `ende: string | null` ergänzen. In `TerminKopf` `{datumKurz(termin.datum)}{zeitText(termin.beginn, termin.ende) && <> · {zeitText(termin.beginn, termin.ende)} Uhr</>}` rendern. Ohne Beginn: `<span className="text-error">· Zeit fehlt</span>`. `durchfuehren/page.tsx` reicht `ende: termin.ende` durch.

- [ ] **Step 5: Typecheck, alle Wächter**

Run: `npm run typecheck && npm run check:kern && npm run check:ki-zugang && npm run check:farben`
Expected: alles grün. Der «ansetzen»-Wächter findet nichts mehr.

- [ ] **Step 6: Commit**

```bash
git add web/components web/app
git commit -m "feat(kalender): Team-Bestand ordnet Termine zu, Löschdialoge nennen den bleibenden Termin (#322, #323)"
```

### Task A9: End-to-End und PR

- [ ] **Step 1: Lokaler Stack und Dev-Server** — `npm run db:reset`, `npm run seed`, E2E-User per Admin-API anlegen (CLAUDE.md). Den Dev-Server per `preview_start` starten und im Worktree mit `lsof` prüfen, dass er den Worktree ausliefert (Memory «Preview-Server im Worktree»).

- [ ] **Step 2: Browser-Durchgang** (read_page/Screenshots)
  1. Ein Team anlegen und «Termin festlegen». Ohne Ende muss der Fehler am Feld «Bitte Beginn und Ende angeben.» lauten. Danach mit 18:30–20:00 speichern.
  2. Die Karte zeigt «Noch kein Training» in Befund-Plakette. Ein vergangener Termin zeigt «Ohne Training».
  3. Unter «Trainings» ein Training anlegen und «Termin zuordnen» wählen. Die Plakette lautet danach «Eingeplant · …».
  4. Im Plan «Training ersetzen» mit einem zweiten Training. Das erste steht danach im Bestand ohne Plakette.
  5. Ein eingeplantes Training einem zweiten anstehenden Termin zuordnen. Die Wahl Kopie/Verschieben muss erscheinen, danach beide Wege prüfen.
  6. Das Training eines Termins im Editor löschen. Der Dialog nennt den Termin, und der Termin bleibt «Noch kein Training».
  7. Unter «Team» → Auflösen muss die Zahl der Termine inklusive jener ohne Training stimmen.
  8. Konflikt: Zwei Tabs öffnen, in Tab 1 zuordnen, in Tab 2 «Termin ändern». Die Meldung «Am Termin hat sich inzwischen etwas geändert …» muss erscheinen.
  9. Kein «ansetzen» auf keiner Seite (`find` nach «ansetz»).

- [ ] **Step 3: KI-Pfad** — mit dem MCP-Inspector oder dem lokalen Claude-Client gegen `http://localhost:<port>/api/mcp`: `termin_festlegen`, `team_plan_abrufen` (Eintrag `training: null`), `training_zuordnen` ohne `art` bei anstehend → Regel-Meldung, `training_loesen`, `termin_entfernen`.

- [ ] **Step 4: PR auf develop** — Titel «feat(kalender): Termine ohne Training und Zuordnen (#322, #323)». Der Body nennt die Release-Kopplung «Stories 1+2 gehen zusammen nach Prod». Die Closes-Keywords gehören in den späteren Release-PR develop → main, nicht hierher (Memory «Pool-Training auf Prod»).


---

## Teil B — Terminserien festlegen, ändern und entfernen (Stories #324 + #326, PR 2, Release 2)

Story 3 und 5 gehen zusammen nach Prod: Eine Serie darf sich nie anlegen lassen, ohne dass man sie als Ganzes korrigieren kann.

**Rechenmodell (für alle Tasks dieses Teils):**
- Eine Serie ist eine Regel `(wochentage, beginn_datum, end_datum)` plus Werte `(beginn, ende, ort, bemerkung)`. Ihre Termine sind echte Zeilen mit `serie_id` und `serien_tag`. `serien_tag` ist der Tag der Regel, für den der Termin angelegt wurde.
- «Nur dieser» ändert die Zeile und setzt für jede geänderte Angabe `*_abweichend = true`. Das Datum weicht ab, sobald `datum <> serien_tag`.
- «Dieser und folgende» (T = gewählter Termin) legt eine neue Serie X an. X erhält alle Termine der Serie S mit `datum >= T.datum` und die Lücken mit `tag >= T.datum`. S endet am Tag vor T; bleibt S ohne Termin, wird S gelöscht. Danach wird X wie bei «alle» geändert, mit der alten Regel `[T.datum, S.end_datum]`.
- «Alle» ändert S an Ort und Stelle, vergangene Termine eingeschlossen.
- Die Reihenfolge der Änderung ist fest:
  1. Wochentag-Tausch oder weggenommene Wochentage
  2. verkleinerter Zeitraum
  3. Konfliktprüfung der belegten entfallenden Termine
  4. Löschen
  5. Werte übernehmen: nicht abweichende Termine plus der gewählte
  6. hinzugekommene Tage anlegen: neue Regel minus alte Regel, ohne Lücken und ohne schon belegte Serientage
- Ein Tausch (genau ein Wochentag weg, genau einer dazu) verlegt statt zu löschen. Dabei entstehen keine Tage auf dem neuen Wochentag innerhalb des alten Zeitraums; nur ein erweiterter Zeitraum legt an.
- Die Vorschau fährt dieselbe Funktion und rollt danach zurück. Die Vorab-Auskunft ist damit genau das Ergebnis.

### Task B1: Migration — Serien-Tabellen, Hilfsfunktionen, Festlegen

**Files:**
- Create: `supabase/migrations/<zeitstempel>_terminserien.sql`
- Modify: `.github/workflows/sync-staging.yml:51` (`PUBLIC_TABLES`)

**Interfaces:**
- Produces:
  - SQL `wochentage_gueltig(smallint[]) → boolean`, `serien_tage(smallint[], date, date) → setof date`
  - Tabellen `termin_serien` und `termin_serien_luecken`
  - Spalten `training_termine.serie_id, serien_tag, zeit_abweichend, ort_abweichend, bemerkung_abweichend`
  - RPC `terminserie_festlegen(p_team, p_wochentage smallint[], p_von, p_bis, p_beginn time, p_ende time, p_ort, p_bemerkung) → jsonb {serie, termine}`
  - Marker `TEAM_NICHT_GEFUNDEN`, `SERIE_WOCHENTAGE`, `SERIE_ENDE_VOR_BEGINN`, `SERIE_ZU_LANG`, `SERIE_OHNE_TAG`, `SERIE_ZEIT`

- [ ] **Step 1: Bestand der Längen prüfen** — auf Staging (frisch per `sync-staging` gespiegelt, Supabase-Connector `execute_sql` auf `lcxxfugtuazsqcahrqou`):

```sql
select count(*) filter (where char_length(ort) > 100) as ort_zu_lang,
       count(*) filter (where char_length(bemerkung) > 500) as bemerkung_zu_lang
  from training_termine;
```

Expected: `0 | 0`. Wenn nicht 0: die beiden `validate constraint`-Zeilen unten weglassen, den Befund dem User melden und eine eigene Bereinigungs-Migration vorschlagen. Nicht still kürzen.

- [ ] **Step 2: Migration schreiben**

```sql
-- ============================================================================
-- Team-Kalender (Epic #321), Story 3 (#324): wöchentliche Terminserien.
-- Eine Serie ist eine Regel (Wochentage, Beginn- und Enddatum) mit Werten
-- (Beginn, Ende, Ort, Bemerkung). Ihre Termine sind echte Zeilen; jede merkt
-- sich den Tag der Regel, für den sie angelegt wurde (serien_tag), und je
-- Angabe, ob sie von der Serie abweicht (Story 5, PO 3).
-- ============================================================================
set lock_timeout = '5s';

-- Teil A hat die Längen NOT VALID eingeführt; der Bestand ist gezählt (Step 1).
alter table training_termine validate constraint tt_ort_laenge;
alter table training_termine validate constraint tt_bemerkung_laenge;

-- ISO-Wochentage 1 = Montag … 7 = Sonntag, mindestens einer, keiner doppelt
-- (Zwilling von wochentageProblem() in web/lib/serie.ts).
create function wochentage_gueltig(p smallint[]) returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select coalesce(cardinality(p), 0) between 1 and 7
     and (select bool_and(w between 1 and 7) from unnest(p) w)
     and (select count(distinct w) from unnest(p) w) = cardinality(p)
$$;

-- Die Tage einer Regel (Zwilling von serienTage() in web/lib/serie.ts).
create function serien_tage(p_wochentage smallint[], p_von date, p_bis date)
returns setof date
language sql immutable
set search_path = public, pg_temp
as $$
  select d::date from generate_series(p_von::timestamp, p_bis::timestamp, interval '1 day') d
   where extract(isodow from d)::smallint = any(p_wochentage)
$$;

create table termin_serien (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  wochentage smallint[] not null,
  beginn_datum date not null,
  end_datum date not null,
  beginn time not null,
  ende time not null,
  ort text,
  bemerkung text,
  -- Jede Änderung der Serie zählt hoch (Trigger unten): Daran erkennt die
  -- Oberfläche, dass ein anderes Mitglied sie seit der Auswahl geändert hat
  -- (PO 17).
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  constraint ts_wochentage check (wochentage_gueltig(wochentage)),
  -- Enddatum spätestens am gleichen Kalendertag des Folgejahres; nach einem
  -- 29. Februar ist das der 28. Februar — so rechnet Postgres (AK 5).
  constraint ts_zeitraum check (
    end_datum >= beginn_datum and end_datum <= (beginn_datum + interval '1 year')::date),
  constraint ts_zeit check (ende > beginn),
  constraint ts_ort_laenge check (ort is null or char_length(ort) <= 100),
  constraint ts_bemerkung_laenge check (bemerkung is null or char_length(bemerkung) <= 500)
);
create index termin_serien_team_idx on termin_serien (team_id);

create function termin_serie_version() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger termin_serie_version before update on termin_serien
  for each row execute function termin_serie_version();

-- Einzeln entfernte Tage einer Serie: Eine Serienänderung legt sie nicht
-- wieder an (Story 5 PC 10).
create table termin_serien_luecken (
  serie_id uuid not null references termin_serien(id) on delete cascade,
  tag date not null,
  primary key (serie_id, tag)
);

alter table training_termine
  add column serie_id uuid,
  add column serien_tag date,
  add column zeit_abweichend boolean not null default false,
  add column ort_abweichend boolean not null default false,
  add column bemerkung_abweichend boolean not null default false,
  -- Zusammengesetzt: Ein Termin gehört nur einer Serie SEINES Teams. Fällt
  -- die Serie, fallen ihre Termine (Story 5 PC 12); Trainings bleiben.
  add constraint tt_serie foreign key (serie_id, team_id)
    references termin_serien (id, team_id) on delete cascade,
  add constraint tt_serie_vollstaendig check ((serie_id is null) = (serien_tag is null));
create index training_termine_serie_idx on training_termine (serie_id) where serie_id is not null;

alter table termin_serien enable row level security;
alter table termin_serien_luecken enable row level security;
create policy ts_select on termin_serien for select to authenticated
  using (ist_team_mitglied(team_id));
create policy tsl_select on termin_serien_luecken for select to authenticated
  using (exists (select 1 from termin_serien s where s.id = serie_id and ist_team_mitglied(s.team_id)));
-- Geschrieben wird nur über die RPCs: Serie und ihre Termine ändern sich in
-- einer Transaktion (Story 5 PC 15).
grant select on termin_serien, termin_serien_luecken to authenticated;
revoke insert, update, delete, truncate on termin_serien, termin_serien_luecken from anon, authenticated;
revoke select on termin_serien, termin_serien_luecken from anon;

-- Festlegen (Story 3 AK 1–7, PC 1–3) -----------------------------------------
create function terminserie_festlegen(
  p_team uuid,
  p_wochentage smallint[],
  p_von date,
  p_bis date,
  p_beginn time,
  p_ende time,
  p_ort text,
  p_bemerkung text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_serie termin_serien;
  v_anzahl integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if not wochentage_gueltig(p_wochentage) then raise exception 'SERIE_WOCHENTAGE'; end if;
  if p_bis < p_von then raise exception 'SERIE_ENDE_VOR_BEGINN'; end if;
  if p_bis > (p_von + interval '1 year')::date then raise exception 'SERIE_ZU_LANG'; end if;
  if p_beginn is null or p_ende is null or p_ende <= p_beginn then raise exception 'SERIE_ZEIT'; end if;

  insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung)
  values (p_team,
          (select array_agg(w order by w) from unnest(p_wochentage) w),
          p_von, p_bis, p_beginn, p_ende,
          nullif(btrim(p_ort), ''), nullif(btrim(p_bemerkung), ''))
  returning * into v_serie;

  -- PC 1: je Tag der Regel genau ein Termin ohne Training. PC 3: bestehende
  -- Termine an denselben Tagen bleiben unberührt daneben (PO 5).
  insert into training_termine (team_id, serie_id, serien_tag, datum, beginn, ende, ort, bemerkung)
  select p_team, v_serie.id, d, d, v_serie.beginn, v_serie.ende, v_serie.ort, v_serie.bemerkung
    from serien_tage(v_serie.wochentage, v_serie.beginn_datum, v_serie.end_datum) d;
  get diagnostics v_anzahl = row_count;
  -- AK 6: Kein gewählter Wochentag im Zeitraum — dann entsteht gar nichts
  -- (die Ausnahme rollt auch die Serie zurück, PC 2).
  if v_anzahl = 0 then raise exception 'SERIE_OHNE_TAG'; end if;
  return jsonb_build_object('serie', v_serie.id, 'termine', v_anzahl);
end;
$$;
revoke all on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text) from public, anon;
grant execute on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text) to authenticated;

reset lock_timeout;
```

- [ ] **Step 3: `sync-staging.yml`** — `PUBLIC_TABLES` wird (collate "C", `_` vor Buchstaben):

```yaml
    PUBLIC_TABLES: "exercise_favorites exercises ki_aufrufe ki_zugang_namen profiles team_members teams termin_serien termin_serien_luecken trainer_suchversuche training_exercise_gruppen training_exercises training_gruppen training_termine training_varianten trainings"
```

Die Reihenfolge per `printf '%s\n' … | LC_ALL=C sort` gegenprüfen. Die Zeichenkette muss exakt dem Guard-Query entsprechen.

- [ ] **Step 4: Anwenden** — `npm run db:reset && npm run gen:types && npm run typecheck`. Danach:

```bash
docker exec -i supabase_db_kifu psql -q -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
 "select count(*) from serien_tage('{2,4}', '2026-10-01', '2026-10-31'); select ('2028-02-29'::date + interval '1 year')::date;"
```

Expected: `9` (Di/Do im Oktober 2026) und `2029-02-28`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_terminserien.sql .github/workflows/sync-staging.yml web/lib/database.types.ts
git commit -m "feat(kalender): Terminserien als Regel mit echten Terminen (#324)"
```

### Task B2: Reine Serien-Regeln

**Files:**
- Create: `web/lib/serie.ts`
- Modify: `web/lib/training-bedingungen.ts` (Serien-Marker)
- Modify: `web/lib/termin.ts` (`KONFLIKT_MARKER` um Serien-Marker)
- Test: `web/scripts/pruefe-kern.ts`

**Interfaces:**
- Consumes: `istKalendertag`, `zeitProblem`, `textProblem` aus `@/lib/termin`.
- Produces:
  - `type Wochentag = 1|2|3|4|5|6|7`, `WOCHENTAGE: readonly Wochentag[]`, `WOCHENTAG_KURZ: Record<Wochentag,string>`
  - `KI_WOCHENTAG = ["mo","di","mi","do","fr","sa","so"] as const`, `alsWochentag(k)`, `alsKiWochentag(w)`
  - `type Reichweite = "nur_dieser" | "dieser_und_folgende" | "alle"`
  - `wochentagVon(iso) → Wochentag`, `maxEnddatum(von) → string`, `serienTage(w, von, bis) → string[]`, `wochentageText(w) → string`
  - `type SerieFeld = "wochentage"|"von"|"bis"|"beginn"|"ende"|"ort"|"bemerkung"`
  - `serieProblem(f) → { feld: SerieFeld; text } | null`
  - `tausch(alt, neu) → { von: Wochentag; nach: Wochentag } | null`
  - `SERIE_TEXT`, `SERIE_MELDUNG`, `vergangeneBestaetigen(n) → string`

- [ ] **Step 1: Failing test** (in `pruefe-kern.ts`, Import `from "../lib/serie"`)

```ts
// ── Terminserien (#324 AK 2–6, #326 AK 5; Review Focus 2, 3) ─────────────────
pruefe("Serie: Enddatum höchstens am gleichen Kalendertag des Folgejahres, 29.2. → 28.2.", () => {
  assert.equal(maxEnddatum("2026-10-07"), "2027-10-07");
  assert.equal(maxEnddatum("2028-02-29"), "2029-02-28");
  assert.equal(maxEnddatum("2027-02-28"), "2028-02-28");
  const gut = { wochentage: [2, 4] as Wochentag[], von: "2026-10-01", bis: "2027-03-31", beginn: "18:00", ende: "19:30" };
  assert.equal(serieProblem(gut), null);
  assert.equal(serieProblem({ ...gut, von: "2028-02-29", bis: "2029-02-28" }), null);
  assert.deepEqual(serieProblem({ ...gut, von: "2028-02-29", bis: "2029-03-01" }), { feld: "bis", text: SERIE_TEXT.zuLang });
  assert.deepEqual(serieProblem({ ...gut, bis: "2026-09-30" }), { feld: "bis", text: SERIE_TEXT.endeVorBeginn });
  assert.deepEqual(serieProblem({ ...gut, wochentage: [] }), { feld: "wochentage", text: SERIE_TEXT.wochentage });
  // AK 6: kein gewählter Wochentag im Zeitraum.
  assert.deepEqual(serieProblem({ ...gut, wochentage: [6], von: "2026-10-05", bis: "2026-10-09" }), { feld: "wochentage", text: SERIE_TEXT.ohneTag });
  assert.deepEqual(serieProblem({ ...gut, ende: "17:00" }), { feld: "ende", text: TERMIN_TEXT.endeNachBeginn });
  assert.deepEqual(serieProblem({ ...gut, von: "2026-02-30" }), { feld: "von", text: TERMIN_TEXT.datum });
});

pruefe("Serie: Tage, Wochentage, Tausch", () => {
  assert.deepEqual(serienTage([2, 4], "2026-10-01", "2026-10-08"), ["2026-10-01", "2026-10-06", "2026-10-08"]);
  assert.equal(wochentagVon("2026-10-04"), 7, "Sonntag");
  assert.equal(wochentagVon("2026-10-05"), 1, "Montag");
  // Zeitumstellung am 25.10.2026 verschiebt keinen Tag.
  assert.deepEqual(serienTage([7], "2026-10-24", "2026-11-01"), ["2026-10-25", "2026-11-01"]);
  assert.deepEqual(tausch([2, 4], [3, 4]), { von: 2, nach: 3 });
  assert.equal(tausch([2, 4], [4]), null, "weggenommen");
  assert.equal(tausch([2], [3, 5]), null, "zwei dazu");
  assert.equal(wochentageText([2, 4]), "Di, Do");
  assert.equal(alsWochentag("so"), 7);
  assert.equal(alsKiWochentag(1), "mo");
});

pruefe("Serien-Marker: vorab und aus der Datenbank derselbe Satz", () => {
  for (const [marker, satz] of Object.entries(SERIE_MELDUNG))
    assert.equal(still(() => ausDbFehler({ message: marker })).meldung, satz, marker);
  assert.match(vergangeneBestaetigen(3), /3 vergangene Termine.*«bestaetigt: true»/);
});
```

- [ ] **Step 2: Test laufen lassen** — `npm run check:kern` → FAIL (Modul fehlt).

- [ ] **Step 3: `web/lib/serie.ts` schreiben**

```ts
// Die Regeln einer Terminserie (Team-Kalender #324, #326).
//
// Eine Regelquelle für die Serien-Dialoge der Oberfläche und die KI-Werkzeuge
// «terminserie_festlegen», «termin_aendern» und «termin_entfernen» mit
// Reichweite. Die Datenebene (Migration terminserien) prüft dieselben Regeln
// als Rückhalt und meldet mit den Markern aus SERIE_MELDUNG.
//
// REIN: importiert nur lib/termin.ts (ebenfalls rein) — `check:kern` lädt sie mit tsx.
import { TERMIN_TEXT, istKalendertag, textProblem, zeitProblem } from "@/lib/termin";

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag (Zwilling: `extract(isodow …)`). */
export type Wochentag = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WOCHENTAGE: readonly Wochentag[] = [1, 2, 3, 4, 5, 6, 7];
export const WOCHENTAG_KURZ: Record<Wochentag, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So" };
export const WOCHENTAG_LANG: Record<Wochentag, string> = {
  1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag", 5: "Freitag", 6: "Samstag", 7: "Sonntag",
};

/** Die Kürzel des KI-Werkzeugs — Wörter statt Zahlen, damit der Assistent
 *  nicht rätselt, ob die Woche am Sonntag beginnt. */
export const KI_WOCHENTAG = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;
export type KiWochentag = (typeof KI_WOCHENTAG)[number];
export const alsWochentag = (k: KiWochentag): Wochentag => (KI_WOCHENTAG.indexOf(k) + 1) as Wochentag;
export const alsKiWochentag = (w: Wochentag): KiWochentag => KI_WOCHENTAG[w - 1];

/** «Nur dieser», «dieser und folgende», «alle» — wie in gängigen Kalendern (PO 16). */
export type Reichweite = "nur_dieser" | "dieser_und_folgende" | "alle";

/** Der Wochentag eines Kalendertags. In UTC gerechnet: Ein Kalendertag hat
 *  keine Zeitzone, und die Zeitumstellung verschiebt so keinen Tag. */
export function wochentagVon(iso: string): Wochentag {
  const t = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return (t === 0 ? 7 : t) as Wochentag;
}

const zwei = (n: number) => String(n).padStart(2, "0");
const alsIso = (d: Date) => `${String(d.getUTCFullYear()).padStart(4, "0")}-${zwei(d.getUTCMonth() + 1)}-${zwei(d.getUTCDate())}`;

/** Der letzte zulässige Tag einer Serie: der gleiche Kalendertag im
 *  Folgejahr, nach einem 29. Februar der 28. Februar (#324 AK 5) —
 *  Zwilling von `(beginn_datum + interval '1 year')::date`. */
export function maxEnddatum(von: string): string {
  const [j, m, t] = von.split("-").map(Number);
  const letzter = new Date(Date.UTC(j + 1, m, 0)).getUTCDate();
  return `${String(j + 1).padStart(4, "0")}-${zwei(m)}-${zwei(Math.min(t, letzter))}`;
}

/** Einen Kalendertag um `n` Tage verschieben. */
export function plusTage(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return alsIso(d);
}

/** Die Tage einer Regel, aufsteigend (Zwilling von `serien_tage`). */
export function serienTage(wochentage: readonly Wochentag[], von: string, bis: string): string[] {
  const tage: string[] = [];
  for (let d = von; d <= bis; d = plusTage(d, 1)) if (wochentage.includes(wochentagVon(d))) tage.push(d);
  return tage;
}

/** «Di, Do» — für Karten und Auskünfte. */
export function wochentageText(w: readonly Wochentag[]): string {
  return [...w].sort().map((x) => WOCHENTAG_KURZ[x]).join(", ");
}

/** Genau ein Wochentag weg und genau einer dazu: ein Tausch (#326 PC 8). */
export function tausch(alt: readonly Wochentag[], neu: readonly Wochentag[]): { von: Wochentag; nach: Wochentag } | null {
  const weg = alt.filter((w) => !neu.includes(w));
  const dazu = neu.filter((w) => !alt.includes(w));
  return weg.length === 1 && dazu.length === 1 ? { von: weg[0], nach: dazu[0] } : null;
}

export const SERIE_TEXT = {
  wochentage: "Bitte mindestens einen Wochentag wählen.",
  endeVorBeginn: "Das Enddatum darf nicht vor dem Beginndatum liegen.",
  zuLang:
    "Eine Terminserie dauert höchstens bis zum gleichen Kalendertag im Folgejahr (nach einem 29. Februar bis zum 28. Februar).",
  ohneTag: "Im gewählten Zeitraum liegt keiner der gewählten Wochentage.",
} as const;

export type SerieFeld = "wochentage" | "von" | "bis" | "beginn" | "ende" | "ort" | "bemerkung";

/** Was an einer Serie nicht stimmt, sonst `null` (#324 AK 2, 4–6; #326 AK 5:
 *  beim Ändern mit dem aktuellen Beginndatum der jeweiligen Serie). */
export function serieProblem(f: {
  wochentage: readonly number[];
  von: string;
  bis: string;
  beginn?: string | null;
  ende?: string | null;
  ort?: string | null;
  bemerkung?: string | null;
}): { feld: SerieFeld; text: string } | null {
  const w = f.wochentage;
  if (w.length === 0 || w.length > 7 || new Set(w).size !== w.length || w.some((x) => !Number.isInteger(x) || x < 1 || x > 7))
    return { feld: "wochentage", text: SERIE_TEXT.wochentage };
  if (!istKalendertag(f.von)) return { feld: "von", text: TERMIN_TEXT.datum };
  if (!istKalendertag(f.bis)) return { feld: "bis", text: TERMIN_TEXT.datum };
  if (f.bis < f.von) return { feld: "bis", text: SERIE_TEXT.endeVorBeginn };
  if (f.bis > maxEnddatum(f.von)) return { feld: "bis", text: SERIE_TEXT.zuLang };
  if (serienTage(w as Wochentag[], f.von, f.bis).length === 0) return { feld: "wochentage", text: SERIE_TEXT.ohneTag };
  const z = zeitProblem(f.beginn, f.ende);
  if (z) return z;
  return textProblem(f);
}

/** Die Sätze zu den Markern der Datenebene (Migrationen terminserien und
 *  terminserien_aendern) und zu den Regeln, die der Fachkern vorab prüft. */
export const SERIE_MELDUNG = {
  TEAM_NICHT_GEFUNDEN: "Team nicht gefunden. Du kannst nur in Teams arbeiten, in denen du Mitglied bist.",
  SERIE_WOCHENTAGE: SERIE_TEXT.wochentage,
  SERIE_ENDE_VOR_BEGINN: SERIE_TEXT.endeVorBeginn,
  SERIE_ZU_LANG: SERIE_TEXT.zuLang,
  SERIE_OHNE_TAG: SERIE_TEXT.ohneTag,
  SERIE_ZEIT: "Bitte Beginn und Ende angeben; das Ende liegt am selben Tag nach dem Beginn.",
  TERMIN_OHNE_SERIE: "Dieser Termin gehört zu keiner Terminserie.",
  REICHWEITE_UNGUELTIG: "Wähle «nur dieser», «dieser und folgende» oder «alle».",
  REICHWEITE_FEHLT:
    "Dieser Termin gehört zu einer Terminserie. Gib an, ob es nur für diesen Termin, für diesen und alle folgenden oder für alle Termine der Serie gilt.",
  DATUM_NUR_EINZELN: "Das Datum lässt sich nur für diesen einen Termin ändern.",
  REGEL_NUR_SERIE: "Wochentage und Zeitraum gelten für die Serie. Wähle «dieser und folgende» oder «alle».",
  TEILSERIE_BEGINN: "Mit «dieser und folgende» beginnt die Serie frühestens am gewählten Termin.",
  DATUM_FOLGT_NICHT: "Das Datum lässt sich nicht wieder der Serie folgen lassen; es zählt stets das aktuelle.",
  SERIE_GEAENDERT:
    "Die Terminserie wurde inzwischen von einem anderen Mitglied geändert. Sieh sie dir noch einmal an.",
  SERIE_BELEGUNG_GEAENDERT:
    "Seit deiner Auswahl hat sich geändert, welche wegfallenden Termine ein Training tragen. Sieh dir die Änderung noch einmal an.",
  KEINE_AENDERUNG: "Gib mindestens eine Angabe an, die sich ändern soll.",
} as const;

/** Der KI-Weg verlangt eine ausdrückliche Bestätigung, wenn «dieser und
 *  folgende» oder «alle» vergangene Termine erfasst oder entfallen lässt
 *  (PO 16, #326 AK 11, #325 AK 20). */
export function vergangeneBestaetigen(n: number): string {
  return `Das erfasst ${n} vergangene ${n === 1 ? "Termin" : "Termine"}. Wiederhole den Aufruf mit «bestaetigt: true», wenn das so gewollt ist.`;
}
```

Im Test `vergangeneBestaetigen(3)` ergibt «Das erfasst 3 vergangene Termine. … «bestaetigt: true» …». Der Regex prüft «3 vergangene Termine». In `pruefe-kern.ts` `TERMIN_TEXT` mit importieren.

- [ ] **Step 4: Marker registrieren** — `web/lib/training-bedingungen.ts`:

```ts
import { SERIE_MELDUNG } from "@/lib/serie";
const TERMIN_MARKER: [string, string][] = [...Object.entries(TERMIN_MELDUNG), ...Object.entries(SERIE_MELDUNG)];
```

Achtung: `includes`-Abgleich über Marker-Präfixe. `SERIE_BELEGUNG_GEAENDERT` enthält nicht `SERIE_GEAENDERT` als Teilstring, weil `BELEGUNG_` dazwischen steht. `TERMIN_BELEGUNG_GEAENDERT` enthält ebenfalls keinen anderen Marker. Die Tabelle trotzdem so ordnen, dass der längere Marker zuerst steht.

`web/lib/termin.ts` `KONFLIKT_MARKER` um `"SERIE_GEAENDERT", "SERIE_BELEGUNG_GEAENDERT"` ergänzen. `meldungZu` in `lib/kern/termine.ts` sucht dann in `{ ...TERMIN_MELDUNG, ...SERIE_MELDUNG }`:

```ts
import { SERIE_MELDUNG } from "@/lib/serie";
function meldungZu(marker: string): string {
  return ({ ...TERMIN_MELDUNG, ...SERIE_MELDUNG } as Record<string, string>)[marker] ?? marker;
}
```

`kalenderFehler` prüft zusätzlich `TEAM_NICHT_GEFUNDEN` → `fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" })`.

- [ ] **Step 5: Tests** — `npm run check:kern` → PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/serie.ts web/lib/termin.ts web/lib/training-bedingungen.ts web/lib/kern/termine.ts web/scripts/pruefe-kern.ts
git commit -m "feat(kalender): Regeln der Terminserie (#324, #326)"
```

### Task B3: Migration — Serie ändern und entfernen mit Vorschau, Lücken, der Serie folgen

**Files:**
- Create: `supabase/migrations/<zeitstempel>_terminserien_aendern.sql`

**Interfaces:**
- Consumes: B1.
- Produces:
  - RPC `terminserie_aendern(p_termin uuid, p_reichweite text, p_aenderung jsonb, p_version int, p_entfallend uuid[], p_ausfuehren boolean) → jsonb`
  - RPC `terminserie_entfernen(p_termin uuid, p_reichweite text, p_version int, p_entfallend uuid[], p_ausfuehren boolean) → jsonb`
  - RPC `termin_der_serie_folgen(p_termin uuid, p_angaben text[]) → jsonb {team, training}`
  - `termin_entfernen` (ersetzt) trägt jetzt die Lücke ein und räumt eine leere Serie weg
  - Ergebnis beider Serien-RPCs: `{ serie: uuid|null, version_vorher: int, entfallend: [{id, datum, beginn, training:{id,name}}], entfallend_anzahl: int, vergangene: int }`
  - Schlüssel von `p_aenderung`: `wochentage int[]`, `beginn_datum date`, `end_datum date`, `beginn time` + `ende time` (nur gemeinsam), `ort text|null`, `bemerkung text|null`

- [ ] **Step 1: Migration schreiben**

```sql
-- ============================================================================
-- Team-Kalender (Epic #321), Story 5 (#326): Terminserien ändern, verkürzen
-- und entfernen mit der Reichweite gängiger Kalender (PO 16).
--
-- Eine Rechnung für Vorschau und Ausführung: Die Vorschau fährt dieselbe
-- Funktion und rollt danach zurück (Ausnahme im Unterblock). So nennt die
-- Vorab-Auskunft genau die Termine, die die Ausführung entfallen liesse
-- (AK 8), und die Ausführung weist ab, wenn sich das seither geändert hat
-- (AK 9, PO 17).
-- ============================================================================
set lock_timeout = '5s';

-- Die Rechnung. Nicht aufrufbar für API-Rollen; nur die beiden Hüllen unten
-- rufen sie (sie laufen als Eigentümer).
create function terminserie_rechnen(
  p_termin uuid,
  p_reichweite text,
  p_aenderung jsonb,
  p_version integer,
  p_entfallend uuid[])
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_heute date := heute_am_trainingsort();
  t training_termine;
  s termin_serien;
  x uuid;
  v_version_vorher integer;
  v_alt_tage smallint[];
  v_neu_tage smallint[];
  v_alt_von date;
  v_alt_bis date;
  v_neu_von date;
  v_neu_bis date;
  v_weg smallint[];
  v_dazu smallint[];
  v_tausch boolean;
  v_zeit boolean := p_aenderung ? 'beginn' or p_aenderung ? 'ende';
  v_beginn time;
  v_ende time;
  v_entfallend uuid[] := '{}';
  v_vergangen uuid[] := '{}';
  v_belegt uuid[];
  v_liste jsonb;
  v_neu_vergangen uuid[];
  r record;
  v_ziel date;
begin
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if p_reichweite is null or p_reichweite not in ('dieser_und_folgende', 'alle') then
    raise exception 'REICHWEITE_UNGUELTIG';
  end if;
  select * into s from termin_serien where id = t.serie_id for update;
  v_version_vorher := s.version;
  if p_version is not null and s.version <> p_version then raise exception 'SERIE_GEAENDERT'; end if;
  perform 1 from training_termine where serie_id = s.id for update;

  -- Die alte Regel im Bereich der Reichweite.
  v_alt_tage := s.wochentage;
  if p_reichweite = 'alle' then
    v_alt_von := s.beginn_datum; v_alt_bis := s.end_datum;
  else
    v_alt_von := t.datum; v_alt_bis := greatest(s.end_datum, t.datum);
  end if;

  -- Die neue Regel (AK 3, 4) und ihre Prüfung wie beim Festlegen (AK 5).
  if p_aenderung ? 'wochentage' then
    if jsonb_typeof(p_aenderung->'wochentage') <> 'array'
       or jsonb_array_length(p_aenderung->'wochentage') = 0 then
      raise exception 'SERIE_WOCHENTAGE';
    end if;
    v_neu_tage := (select array_agg(w::smallint order by w::smallint)
                     from jsonb_array_elements_text(p_aenderung->'wochentage') w);
  else
    v_neu_tage := v_alt_tage;
  end if;
  v_neu_von := coalesce((p_aenderung->>'beginn_datum')::date, v_alt_von);
  v_neu_bis := coalesce((p_aenderung->>'end_datum')::date, v_alt_bis);
  if p_reichweite = 'dieser_und_folgende' and v_neu_von < t.datum then
    raise exception 'TEILSERIE_BEGINN';   -- PC 19
  end if;
  if not wochentage_gueltig(v_neu_tage) then raise exception 'SERIE_WOCHENTAGE'; end if;
  if v_neu_bis < v_neu_von then raise exception 'SERIE_ENDE_VOR_BEGINN'; end if;
  if v_neu_bis > (v_neu_von + interval '1 year')::date then raise exception 'SERIE_ZU_LANG'; end if;
  if not exists (select 1 from serien_tage(v_neu_tage, v_neu_von, v_neu_bis)) then
    raise exception 'SERIE_OHNE_TAG';
  end if;
  if v_zeit then
    v_beginn := (p_aenderung->>'beginn')::time;
    v_ende := (p_aenderung->>'ende')::time;
    if v_beginn is null or v_ende is null or v_ende <= v_beginn then raise exception 'SERIE_ZEIT'; end if;
  end if;

  -- Teilen (PC 3) oder an Ort und Stelle (PC 4).
  if p_reichweite = 'dieser_und_folgende' then
    insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung)
    values (s.team_id, v_neu_tage, v_neu_von, v_neu_bis,
            case when v_zeit then v_beginn else s.beginn end,
            case when v_zeit then v_ende else s.ende end,
            case when p_aenderung ? 'ort' then nullif(btrim(p_aenderung->>'ort'), '') else s.ort end,
            case when p_aenderung ? 'bemerkung' then nullif(btrim(p_aenderung->>'bemerkung'), '') else s.bemerkung end)
    returning id into x;
    update training_termine set serie_id = x where serie_id = s.id and datum >= t.datum;
    update termin_serien_luecken set serie_id = x where serie_id = s.id and tag >= t.datum;
    if exists (select 1 from training_termine where serie_id = s.id) then
      -- Die bisherige Serie endet vor dem gewählten Termin.
      update termin_serien
         set end_datum = t.datum - 1, beginn_datum = least(beginn_datum, t.datum - 1)
       where id = s.id;
    else
      delete from termin_serien where id = s.id;   -- PC 14
    end if;
  else
    x := s.id;
    update termin_serien set
      wochentage = v_neu_tage,
      beginn_datum = v_neu_von,
      end_datum = v_neu_bis,
      beginn = case when v_zeit then v_beginn else beginn end,
      ende = case when v_zeit then v_ende else ende end,
      ort = case when p_aenderung ? 'ort' then nullif(btrim(p_aenderung->>'ort'), '') else ort end,
      bemerkung = case when p_aenderung ? 'bemerkung' then nullif(btrim(p_aenderung->>'bemerkung'), '') else bemerkung end
    where id = x;
  end if;

  -- 1) Wochentage (PC 7–9). Es zählt stets das aktuelle Datum (PO 3).
  v_weg := array(select w from unnest(v_alt_tage) w where w <> all(v_neu_tage));
  v_dazu := array(select w from unnest(v_neu_tage) w where w <> all(v_alt_tage));
  v_tausch := cardinality(v_weg) = 1 and cardinality(v_dazu) = 1;
  if v_tausch then
    for r in select id, datum, serien_tag from training_termine
              where serie_id = x and extract(isodow from datum)::smallint = v_weg[1]
              order by datum, beginn nulls last, created_at loop
      -- Derselbe Montag-bis-Sonntag: Die Differenz der ISO-Wochentage bleibt
      -- in der Woche (So → Mo heisst sechs Tage zurück, Review Focus 3).
      v_ziel := r.datum + (v_dazu[1] - v_weg[1]);
      if v_ziel < v_neu_von or v_ziel > v_neu_bis
         or exists (select 1 from training_termine o
                     where o.serie_id = x and o.datum = v_ziel and o.id <> r.id)
         or (r.datum >= v_heute and v_ziel < v_heute) then
        v_entfallend := v_entfallend || r.id;          -- PC 9
      else
        -- PC 8: samt Training, Abweichungen und Ausfall. Ein unverschobener
        -- Termin bleibt unverschoben (serien_tag wandert mit).
        update training_termine
           set datum = v_ziel,
               serien_tag = case when serien_tag = r.datum then v_ziel else serien_tag end
         where id = r.id;
        if r.datum < v_heute or v_ziel < v_heute then v_vergangen := v_vergangen || r.id; end if;
      end if;
    end loop;
  elsif cardinality(v_weg) > 0 then
    v_entfallend := v_entfallend || array(
      select id from training_termine
       where serie_id = x and extract(isodow from datum)::smallint = any(v_weg));
  end if;

  -- 2) Verkleinerter Zeitraum (PC 7).
  if v_neu_von > v_alt_von or v_neu_bis < v_alt_bis then
    v_entfallend := v_entfallend || array(
      select id from training_termine
       where serie_id = x and (datum < v_neu_von or datum > v_neu_bis));
  end if;
  v_entfallend := array(select distinct e from unnest(v_entfallend) e);

  -- 3) Vorab-Auskunft prüfen (AK 9).
  v_belegt := array(select id from training_termine
                     where id = any(v_entfallend) and training_id is not null order by id);
  if p_entfallend is not null
     and v_belegt is distinct from array(select e from unnest(p_entfallend) e order by e) then
    raise exception 'SERIE_BELEGUNG_GEAENDERT';
  end if;
  v_liste := coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', tt.id, 'datum', tt.datum, 'beginn', to_char(tt.beginn, 'HH24:MI'),
             'training', jsonb_build_object('id', tr.id, 'name', tr.name))
           order by tt.datum, tt.beginn nulls last)
      from training_termine tt join trainings tr on tr.id = tt.training_id
     where tt.id = any(v_entfallend)), '[]'::jsonb);

  -- 4) Löschen — ihre Trainings bleiben ohne Termin im Bestand (PC 13).
  v_vergangen := v_vergangen || array(
    select id from training_termine where id = any(v_entfallend) and datum < v_heute);
  delete from training_termine where id = any(v_entfallend);

  -- 5) Werte übernehmen (PC 5): in alle, die der Serie folgen, und in jedem
  --    Fall in den gewählten, der danach bei dieser Angabe wieder folgt.
  if v_zeit then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not zeit_abweichend or id = p_termin) and datum < v_heute
         and (beginn is distinct from v_beginn or ende is distinct from v_ende));
    update training_termine set beginn = v_beginn, ende = v_ende, zeit_abweichend = false
     where serie_id = x and (not zeit_abweichend or id = p_termin);
  end if;
  if p_aenderung ? 'ort' then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not ort_abweichend or id = p_termin) and datum < v_heute
         and ort is distinct from nullif(btrim(p_aenderung->>'ort'), ''));
    update training_termine set ort = nullif(btrim(p_aenderung->>'ort'), ''), ort_abweichend = false
     where serie_id = x and (not ort_abweichend or id = p_termin);
  end if;
  if p_aenderung ? 'bemerkung' then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not bemerkung_abweichend or id = p_termin) and datum < v_heute
         and bemerkung is distinct from nullif(btrim(p_aenderung->>'bemerkung'), ''));
    update training_termine set bemerkung = nullif(btrim(p_aenderung->>'bemerkung'), ''), bemerkung_abweichend = false
     where serie_id = x and (not bemerkung_abweichend or id = p_termin);
  end if;

  -- 6) Hinzugekommene Tage (PC 6): neue Regel minus alte, ohne einzeln
  --    entfernte (PC 10) und ohne Tage, die schon einen Termin der Serie
  --    haben. Beim Tausch zählt der neue Wochentag als alt: Er ersetzt, er
  --    kommt nicht hinzu.
  with neu as (
    insert into training_termine (team_id, serie_id, serien_tag, datum, beginn, ende, ort, bemerkung)
    select ts.team_id, x, d, d, ts.beginn, ts.ende, ts.ort, ts.bemerkung
      from termin_serien ts, serien_tage(v_neu_tage, v_neu_von, v_neu_bis) d
     where ts.id = x
       and not exists (select 1 from serien_tage(case when v_tausch then v_neu_tage else v_alt_tage end,
                                                 v_alt_von, v_alt_bis) a where a = d)
       and not exists (select 1 from termin_serien_luecken l where l.serie_id = x and l.tag = d)
       and not exists (select 1 from training_termine o where o.serie_id = x and o.serien_tag = d)
    returning id, datum)
  select coalesce(array_agg(id) filter (where datum < v_heute), '{}') into v_neu_vergangen from neu;
  v_vergangen := v_vergangen || v_neu_vergangen;

  -- PC 14: Eine Serie ohne Termine besteht nicht fort.
  if not exists (select 1 from training_termine where serie_id = x) then
    delete from termin_serien where id = x;
    x := null;
  end if;

  return jsonb_build_object(
    'serie', x,
    'version_vorher', v_version_vorher,
    'entfallend', v_liste,
    'entfallend_anzahl', cardinality(v_entfallend),
    'vergangene', (select count(distinct v) from unnest(v_vergangen) v));
end;
$$;
revoke all on function terminserie_rechnen(uuid, text, jsonb, integer, uuid[]) from public, anon, authenticated;

create function terminserie_aendern(
  p_termin uuid,
  p_reichweite text,
  p_aenderung jsonb,
  p_version integer default null,
  p_entfallend uuid[] default null,
  p_ausfuehren boolean default true)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_ausfuehren then
    return terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, p_entfallend);
  end if;
  begin
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, null);
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean) from public, anon;
grant execute on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean) to authenticated;

-- Entfernen mit Reichweite (AK 7, PC 11, 12, 14) -----------------------------
create function terminserie_entfernen_rechnen(
  p_termin uuid, p_reichweite text, p_version integer, p_entfallend uuid[])
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_heute date := heute_am_trainingsort();
  t training_termine;
  s termin_serien;
  v_entfallend uuid[];
  v_belegt uuid[];
  v_liste jsonb;
  v_vergangen integer;
begin
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if p_reichweite is null or p_reichweite not in ('dieser_und_folgende', 'alle') then
    raise exception 'REICHWEITE_UNGUELTIG';
  end if;
  select * into s from termin_serien where id = t.serie_id for update;
  if p_version is not null and s.version <> p_version then raise exception 'SERIE_GEAENDERT'; end if;

  v_entfallend := array(select id from training_termine
                         where serie_id = s.id and (p_reichweite = 'alle' or datum >= t.datum));
  v_belegt := array(select id from training_termine
                     where id = any(v_entfallend) and training_id is not null order by id);
  if p_entfallend is not null
     and v_belegt is distinct from array(select e from unnest(p_entfallend) e order by e) then
    raise exception 'SERIE_BELEGUNG_GEAENDERT';
  end if;
  v_liste := coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', tt.id, 'datum', tt.datum, 'beginn', to_char(tt.beginn, 'HH24:MI'),
             'training', jsonb_build_object('id', tr.id, 'name', tr.name))
           order by tt.datum, tt.beginn nulls last)
      from training_termine tt join trainings tr on tr.id = tt.training_id
     where tt.id = any(v_entfallend)), '[]'::jsonb);
  select count(*) into v_vergangen from training_termine where id = any(v_entfallend) and datum < v_heute;

  delete from training_termine where id = any(v_entfallend);
  if p_reichweite = 'alle' or not exists (select 1 from training_termine where serie_id = s.id) then
    delete from termin_serien where id = s.id;
  else
    update termin_serien
       set end_datum = t.datum - 1, beginn_datum = least(beginn_datum, t.datum - 1)
     where id = s.id;
    delete from termin_serien_luecken where serie_id = s.id and tag >= t.datum;
  end if;

  return jsonb_build_object(
    'serie', (select id from termin_serien where id = s.id),
    'version_vorher', s.version,
    'entfallend', v_liste,
    'entfallend_anzahl', cardinality(v_entfallend),
    'vergangene', v_vergangen);
end;
$$;
revoke all on function terminserie_entfernen_rechnen(uuid, text, integer, uuid[]) from public, anon, authenticated;

create function terminserie_entfernen(
  p_termin uuid,
  p_reichweite text,
  p_version integer default null,
  p_entfallend uuid[] default null,
  p_ausfuehren boolean default true)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_ausfuehren then
    return terminserie_entfernen_rechnen(p_termin, p_reichweite, p_version, p_entfallend);
  end if;
  begin
    v := terminserie_entfernen_rechnen(p_termin, p_reichweite, p_version, null);
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function terminserie_entfernen(uuid, text, integer, uuid[], boolean) from public, anon;
grant execute on function terminserie_entfernen(uuid, text, integer, uuid[], boolean) to authenticated;

-- Einen Serientermin einzeln entfernen: Der Tag wird zur Lücke (PC 10); eine
-- Serie ohne Termine verschwindet (PC 14). Gleiche Signatur wie in Teil A.
create or replace function termin_entfernen(p_termin uuid, p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_termin training_termine;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
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

-- Eine abweichende Angabe wieder der Serie folgen lassen (AK 6) -------------
create function termin_der_serie_folgen(p_termin uuid, p_angaben text[])
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  s termin_serien;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if 'datum' = any(p_angaben) then raise exception 'DATUM_FOLGT_NICHT'; end if;
  select * into s from termin_serien where id = t.serie_id;
  update training_termine set
    beginn = case when 'zeit' = any(p_angaben) then s.beginn else beginn end,
    ende = case when 'zeit' = any(p_angaben) then s.ende else ende end,
    zeit_abweichend = zeit_abweichend and not ('zeit' = any(p_angaben)),
    ort = case when 'ort' = any(p_angaben) then s.ort else ort end,
    ort_abweichend = ort_abweichend and not ('ort' = any(p_angaben)),
    bemerkung = case when 'bemerkung' = any(p_angaben) then s.bemerkung else bemerkung end,
    bemerkung_abweichend = bemerkung_abweichend and not ('bemerkung' = any(p_angaben))
  where id = p_termin;
  return jsonb_build_object('team', t.team_id, 'training', t.training_id);
end;
$$;
revoke all on function termin_der_serie_folgen(uuid, text[]) from public, anon;
grant execute on function termin_der_serie_folgen(uuid, text[]) to authenticated;

reset lock_timeout;
```

- [ ] **Step 2: Anwenden** — `npm run db:reset && npm run gen:types`
Expected: ohne Fehler. Die Rechnung selbst prüfen die DB-Szenarien in B4 über den echten Pfad (angemeldete Wegwerf-Konten); in psql fehlt `auth.uid()`, darum dort keine Probe.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*_terminserien_aendern.sql web/lib/database.types.ts
git commit -m "feat(kalender): Serien ändern und entfernen mit Vorschau und Reichweite (#326)"
```

### Task B4: Fachkern — Serien festlegen, ändern, entfernen, folgen; Einzeländerung setzt Abweichungen

**Files:**
- Create: `web/lib/kern/serien.ts`
- Modify: `web/lib/kern/termine.ts` (`TERMIN_ROH` um Serienfelder, `aendereTermin` setzt Flags)
- Modify: `web/lib/queries/termine-fuer.ts` (`TerminZeile.serie`, `abweichungen`)
- Test: `web/scripts/pruefe-kern-db.ts` (neue Szenarien)

**Interfaces:**
- Consumes: B1–B3, `serieProblem`, `SERIE_MELDUNG`, `vergangeneBestaetigen`, `tausch`, `Reichweite`, `Wochentag` (B2); `aendereTermin`, `entferneTermin`, `ladeTermin`, `kalenderFehler` (A4).
- Produces:
  - `type TerminSerie = { id; version; wochentage: Wochentag[]; beginnDatum; endDatum; beginn; ende; ort; bemerkung }`
  - `type Abweichung = "datum" | "zeit" | "ort" | "bemerkung"`
  - `TerminZeile.serie: TerminSerie | null`, `TerminZeile.serienTag: string | null`, `TerminZeile.abweichungen: Abweichung[]`
  - `legeSerieFest(supabase, userId, e: SerieFestlegen) → KernErgebnis<{ serieId; teamId; termine: number }>`
  - `type SerienAenderung = { wochentage?: Wochentag[]; von?: string; bis?: string; beginn?: string; ende?: string; ort?: string|null; bemerkung?: string|null }`
  - `type SerienFolge = { serieId: string|null; versionVorher: number; entfallend: EntfallenderTermin[]; entfallendAnzahl: number; vergangene: number; teamId: string }`
  - `aendereSerie(supabase, userId, e: { terminId; reichweite: "dieser_und_folgende"|"alle"; aenderung; vorschau?; erwartet?: { version: number; entfallend: string[] }; bestaetigt? }) → KernErgebnis<SerienFolge>`
  - `entferneSerie(supabase, userId, e: { terminId; reichweite; vorschau?; erwartet?; bestaetigt? }) → KernErgebnis<SerienFolge>`
  - `folgeDerSerie(supabase, userId, e: { terminId; angaben: ("zeit"|"ort"|"bemerkung")[] }) → KernErgebnis<{ terminId; teamId }>`
  - `aendereMitReichweite(supabase, userId, e: TerminAendern & SerienAenderungFelder & { reichweite?: Reichweite; bestaetigt?: boolean })`, `entferneMitReichweite(...)` für den KI-Weg

- [ ] **Step 1: Failing DB-Tests** — in `pruefe-kern-db.ts` nach den Kalender-Szenarien:

```ts
  const { legeSerieFest, aendereSerie, entferneSerie, folgeDerSerie, aendereMitReichweite, entferneMitReichweite } =
    await import("../lib/kern/serien");
  const { SERIE_MELDUNG, SERIE_TEXT } = await import("../lib/serie");

  // Hilfen für Serien: ein Team, das Kalenderdatum relativ zu heute (Schweiz)
  // und die Termine einer Serie in Datumsfolge.
  async function serienTeam(name: string) {
    const { data: team } = await admin.from("teams").insert({ name }).select("id").single();
    teams.push(team!.id);
    await admin.from("team_members").insert({ team_id: team!.id, user_id: a.id });
    return team!.id as string;
  }
  const heuteCh = kalendertagAmTrainingsort();
  const tagCh = (d: number) => plusTage(heuteCh, d);
  const termineDer = async (serieId: string) =>
    (await admin.from("training_termine").select("id, datum, serien_tag, beginn, ende, ort, zeit_abweichend, ort_abweichend, training_id")
      .eq("serie_id", serieId).order("datum")).data!;

  await pruefe("Serie festlegen: je Wochentag ein Termin, Regeln, bestehende Termine bleiben (#324)", async () => {
    const team = await serienTeam("Kern-DB-Serie");
    const einzel = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: "2030-01-01", beginn: "10:00", ende: "11:00" }));
    const s = wert(await legeSerieFest(a.supabase, a.id, {
      teamId: team, wochentage: [2, 4], von: "2030-01-01", bis: "2030-01-31", beginn: "18:00", ende: "19:30", ort: "Allmend",
    }));
    assert.equal(s.termine, 9);   // Januar 2030: 5 Di + 4 Do
    const t = await termineDer(s.serieId);
    assert.equal(t[0].datum, "2030-01-01");
    assert.ok(t.every((x) => x.training_id === null && x.ort === "Allmend" && x.serien_tag === x.datum));
    assert.ok(await admin.from("training_termine").select("id").eq("id", einzel.terminId).single(), "PC 3");
    fehler(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [6], von: "2030-01-07", bis: "2030-01-11", beginn: "18:00", ende: "19:30" }), "eingabe", SERIE_TEXT.ohneTag);
    fehler(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: "2028-02-29", bis: "2029-03-01", beginn: "18:00", ende: "19:30" }), "eingabe", SERIE_TEXT.zuLang);
    wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: "2028-02-29", bis: "2029-02-28", beginn: "18:00", ende: "19:30" }));
    fehler(await legeSerieFest(b.supabase, b.id, { teamId: team, wochentage: [2], von: "2030-01-01", bis: "2030-01-31", beginn: "18:00", ende: "19:30" }), "nicht_gefunden");
  });

  await pruefe("Serie ändern: nur dieser, folgende teilt, alle erfasst Vergangenes, Abweichungen bleiben (#326)", async () => {
    const team = await serienTeam("Kern-DB-Serie-Ändern");
    // Wöchentlich dienstags, drei Wochen zurück bis fünf Wochen voraus.
    const von = tagCh(-21), bis = tagCh(35);
    const w = wochentagVon(heuteCh);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [w], von, bis, beginn: "18:00", ende: "19:30", ort: "A" }));
    let t = await termineDer(s.serieId);
    const heuteTermin = t.find((x) => x.datum === heuteCh)!;
    const naechster = t.find((x) => x.datum === tagCh(7))!;

    // Nur dieser: Ort weicht ab.
    wert(await aendereTermin(a.supabase, a.id, { terminId: naechster.id, ort: "B" }));
    assert.equal((await termineDer(s.serieId)).find((x) => x.id === naechster.id)!.ort_abweichend, true);

    // KI ohne Reichweite → abgewiesen (AK 11).
    fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: naechster.id, ort: "C" }), "regel", SERIE_MELDUNG.REICHWEITE_FEHLT);
    // KI «alle» mit Vergangenem → Bestätigung nötig.
    const ohne = fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: naechster.id, reichweite: "alle", beginn: "18:30", ende: "20:00" }), "regel");
    assert.match((ohne as { meldung: string }).meldung, /vergangene Termine/);
    // Alle, bestätigt: Zeit überall, auch vergangen; der abweichende Ort bleibt.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: naechster.id, reichweite: "alle", beginn: "18:30", ende: "20:00", bestaetigt: true }));
    t = await termineDer(s.serieId);
    assert.ok(t.every((x) => x.beginn === "18:30:00"), "PC 4");
    assert.equal(t.find((x) => x.id === naechster.id)!.ort, "B", "PC 5");

    // Dieser und folgende ab heute: teilt; alte Serie endet gestern.
    const f = wert(await aendereSerie(a.supabase, a.id, { terminId: heuteTermin.id, reichweite: "dieser_und_folgende", aenderung: { ort: "C" } }));
    assert.notEqual(f.serieId, s.serieId);
    const alt = (await admin.from("termin_serien").select("end_datum").eq("id", s.serieId).single()).data!;
    assert.equal(alt.end_datum, tagCh(-1), "PC 3");
    const neu = await termineDer(f.serieId!);
    assert.equal(neu[0].id, heuteTermin.id);
    assert.equal(neu.find((x) => x.id === naechster.id)!.ort, "B", "die Abweichung reist mit");
    assert.ok(neu.filter((x) => x.id !== naechster.id).every((x) => x.ort === "C"));
    // PC 19: Mit «folgende» beginnt die Teilserie frühestens am gewählten Termin.
    fehler(await aendereSerie(a.supabase, a.id, { terminId: naechster.id, reichweite: "dieser_und_folgende", aenderung: { von: heuteCh } }), "eingabe", SERIE_MELDUNG.TEILSERIE_BEGINN);

    // Der Serie folgen lassen (AK 6): Ort wieder aus der Serie.
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: naechster.id, angaben: ["ort"] }));
    assert.equal((await termineDer(f.serieId!)).find((x) => x.id === naechster.id)!.ort, "C");
  });

  await pruefe("Serie: Wochentag weg/dazu/Tausch, Zeitraum, belegte vorab genannt, Konflikt, Lücken (#326)", async () => {
    const team = await serienTeam("Kern-DB-Serie-Regel");
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2, 4], von: "2030-01-01", bis: "2030-01-31", beginn: "18:00", ende: "19:30" }));
    let t = await termineDer(s.serieId);
    const tt = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Serie-Training", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const donnerstag = t.find((x) => x.datum === "2030-01-03")!;
    wert(await ordneTrainingZu(a.supabase, a.id, { terminId: donnerstag.id, trainingId: tt.id }));
    // Einzeln entfernt: Der 8.1. kommt bei keiner Änderung zurück (PC 10).
    wert(await entferneTermin(a.supabase, a.id, { terminId: t.find((x) => x.datum === "2030-01-08")!.id }));

    // Tausch Do → Fr (PC 8): samt Training in dieselbe Woche.
    const v = wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2, 5] }, vorschau: true }));
    assert.equal(v.entfallendAnzahl, 0);
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2, 5] }, erwartet: { version: v.versionVorher, entfallend: [] } }));
    t = await termineDer(s.serieId);
    assert.equal(t.find((x) => x.id === donnerstag.id)!.datum, "2030-01-04");
    assert.equal(t.find((x) => x.id === donnerstag.id)!.training_id, tt.id);
    assert.equal(t.filter((x) => x.datum === "2030-01-08").length, 0, "PC 10");

    // Wochentag weg (PC 7): Fr entfällt, auch mit Training — vorab genannt (AK 8).
    const v2 = wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2] }, vorschau: true }));
    assert.deepEqual(v2.entfallend.map((e) => e.terminId), [donnerstag.id]);
    assert.equal(v2.entfallend[0].training.name, "Kern-DB-Serie-Training");
    // AK 9: Hat sich die Belegung seit der Vorschau geändert → abgewiesen.
    fehler(
      await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2] }, erwartet: { version: v2.versionVorher, entfallend: [] } }),
      "konflikt",
      SERIE_MELDUNG.SERIE_BELEGUNG_GEAENDERT,
    );
    fehler(
      await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2] }, erwartet: { version: v2.versionVorher - 1, entfallend: [donnerstag.id] } }),
      "konflikt",
      SERIE_MELDUNG.SERIE_GEAENDERT,
    );
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2] }, erwartet: { version: v2.versionVorher, entfallend: [donnerstag.id] } }));
    assert.ok(await ladeTrainingDetail(a.supabase, tt.id), "PC 13: das Training bleibt im Bestand");

    // Zeitraum erweitern (PC 6) — der 8.1. bleibt Lücke, der Februar kommt dazu.
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { bis: "2030-02-12" }, erwartet: { version: v2.versionVorher + 1, entfallend: [] } }));
    t = await termineDer(s.serieId);
    assert.deepEqual(t.map((x) => x.datum), ["2030-01-01", "2030-01-15", "2030-01-22", "2030-01-29", "2030-02-05", "2030-02-12"]);

    // Entfernen «dieser und folgende» (PC 11) und «alle» (PC 12, 14).
    const e1 = wert(await entferneSerie(a.supabase, a.id, { terminId: t[3].id, reichweite: "dieser_und_folgende" }));
    assert.equal(e1.entfallendAnzahl, 3);
    assert.equal((await admin.from("termin_serien").select("end_datum").eq("id", s.serieId).single()).data!.end_datum, "2030-01-28");
    wert(await entferneSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle" }));
    assert.equal((await admin.from("termin_serien").select("id").eq("id", s.serieId).maybeSingle()).data, null);
  });

  await pruefe("Tausch So → Mo über die Wochengrenze; anstehend nicht in die Vergangenheit (Review Focus 3)", async () => {
    const team = await serienTeam("Kern-DB-Tausch");
    // Ein Sonntag in der Zukunft und einer zwei Wochen zurück.
    const sonntagVoraus = plusTage(heuteCh, ((7 - wochentagVon(heuteCh)) % 7) || 7);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [7], von: plusTage(sonntagVoraus, -14), bis: sonntagVoraus, beginn: "10:00", ende: "11:30" }));
    wert(await aendereSerie(a.supabase, a.id, { terminId: (await termineDer(s.serieId))[0].id, reichweite: "alle", aenderung: { wochentage: [1] }, bestaetigt: true }));
    const t = await termineDer(s.serieId);
    // Jeder Sonntag wandert auf den Montag DERSELBEN Woche (6 Tage zurück).
    assert.ok(t.every((x) => wochentagVon(x.datum) === 1));
    // Liegt der Montag vor heute, entfällt der anstehende Sonntag (PC 9).
    const montag = plusTage(sonntagVoraus, -6);
    assert.equal(t.some((x) => x.datum === montag), montag >= heuteCh);
  });
```

Imports oben im Skript ergänzen: `kalendertagAmTrainingsort` aus `../lib/zeit`, `plusTage, wochentagVon` aus `../lib/serie`. Der Test «bestaetigt» im KI-Pfad erwartet `art: "regel"`, die Meldung kommt aus `vergangeneBestaetigen`.

- [ ] **Step 2: Test laufen lassen** — `npm run check:kern-db` → FAIL (Modul `serien` fehlt).

- [ ] **Step 3: Lesepfad erweitern** — `web/lib/queries/termine-fuer.ts`:

```ts
import type { Wochentag } from "@/lib/serie";

export type TerminSerie = {
  id: string;
  version: number;
  wochentage: Wochentag[];
  beginnDatum: string;
  endDatum: string;
  beginn: string;
  ende: string;
  ort: string | null;
  bemerkung: string | null;
};

/** Welche Angaben eines Serientermins von seiner Serie abweichen (#326 AK 12,
 *  14; PO 3). Das Datum weicht ab, wenn der Termin nicht mehr an seinem
 *  Serientag liegt. */
export type Abweichung = "datum" | "zeit" | "ort" | "bemerkung";
```

`TerminZeile` erhält `serie: TerminSerie | null; serienTag: string | null; abweichungen: Abweichung[];`. `TERMIN_SELECT` wird zu

```ts
const TERMIN_SELECT =
  "id, team_id, datum, beginn, ende, ort, bemerkung, created_at, serien_tag, zeit_abweichend, ort_abweichend, bemerkung_abweichend, " +
  "trainings ( id, name, stufen ), termin_serien ( id, version, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung )";
```

und `mapTermin` ergänzt:

```ts
    serie: t.termin_serien
      ? {
          id: t.termin_serien.id,
          version: t.termin_serien.version,
          wochentage: t.termin_serien.wochentage as Wochentag[],
          beginnDatum: t.termin_serien.beginn_datum,
          endDatum: t.termin_serien.end_datum,
          beginn: kurzeZeit(t.termin_serien.beginn)!,
          ende: kurzeZeit(t.termin_serien.ende)!,
          ort: t.termin_serien.ort,
          bemerkung: t.termin_serien.bemerkung,
        }
      : null,
    serienTag: t.serien_tag,
    abweichungen: t.termin_serien
      ? ([
          t.serien_tag !== t.datum && "datum",
          t.zeit_abweichend && "zeit",
          t.ort_abweichend && "ort",
          t.bemerkung_abweichend && "bemerkung",
        ].filter(Boolean) as Abweichung[])
      : [],
```

(`RawTermin` entsprechend um diese Felder ergänzen; `termin_serien` ist ein Objekt oder `null`. In `lib/queries/termine.ts` `type TerminSerie` und `type Abweichung` mit re-exportieren.)

- [ ] **Step 4: `aendereTermin` setzt Abweichungen** — in `web/lib/kern/termine.ts` `TERMIN_ROH` um `, serie_id, zeit_abweichend, ort_abweichend, bemerkung_abweichend` und `TerminRoh` um die Felder ergänzen. In `aendereTermin` vor dem Update:

```ts
  // «Nur dieser» (#326 AK 1, PC 1): Jede Angabe, die sich an einem Serientermin
  // ändert, weicht danach ab — bis man sie wieder der Serie folgen lässt.
  // Das Datum braucht kein Flag: Es weicht ab, sobald es nicht mehr auf dem
  // Serientag liegt.
  const flags = t.serie_id
    ? {
        zeit_abweichend: t.zeit_abweichend || neu.beginn !== t.beginn || neu.ende !== t.ende,
        ort_abweichend: t.ort_abweichend || neu.ort !== t.ort,
        bemerkung_abweichend: t.bemerkung_abweichend || neu.bemerkung !== t.bemerkung,
      }
    : {};
  const basis = supabase.from("training_termine").update({ ...neu, ...flags }).eq("id", t.id);
```

- [ ] **Step 5: `web/lib/kern/serien.ts` schreiben**

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  SERIE_MELDUNG,
  serieProblem,
  vergangeneBestaetigen,
  type Reichweite,
  type Wochentag,
} from "@/lib/serie";
import { leerZuNull, zeitProblem, textProblem } from "@/lib/termin";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import {
  TERMIN_FELD,
  aendereTermin,
  entferneTermin,
  kalenderFehler,
  ladeTermin,
  type TerminAendern,
} from "@/lib/kern/termine";
import { NICHT_GEFUNDEN, fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";

/**
 * Terminserien (#324, #326): festlegen, mit Reichweite ändern und entfernen,
 * abweichende Angaben wieder der Serie folgen lassen.
 *
 * Die Rechnung steht in der Datenebene (terminserie_rechnen); hier stehen
 * die Vorprüfung mit den Feldnamen des KI-Werkzeugs, die Vorschau und die
 * Bestätigung des KI-Wegs (PO 16).
 */

export type SerieFestlegen = {
  teamId: string;
  wochentage: Wochentag[];
  von: string;
  bis: string;
  beginn: string;
  ende: string;
  ort?: string | null;
  bemerkung?: string | null;
};

export async function legeSerieFest(
  supabase: SupabaseClient,
  _userId: string,
  e: SerieFestlegen,
): Promise<KernErgebnis<{ serieId: string; teamId: string; termine: number }>> {
  const p = serieProblem(e);
  if (p) return fehlschlag("eingabe", p.text, { feld: p.feld });
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const { data, error } = await supabase.rpc("terminserie_festlegen", {
    p_team: e.teamId,
    p_wochentage: e.wochentage,
    p_von: e.von,
    p_bis: e.bis,
    p_beginn: e.beginn,
    p_ende: e.ende,
    p_ort: leerZuNull(e.ort),
    p_bemerkung: leerZuNull(e.bemerkung),
  });
  if (error) return kalenderFehler(error);
  const r = data as { serie: string; termine: number };
  return ok({ serieId: r.serie, teamId: e.teamId, termine: r.termine });
}

export type SerienAenderung = {
  wochentage?: Wochentag[];
  von?: string;
  bis?: string;
  /** Beginn und Ende nur gemeinsam — eine Angabe «Zeit» (PC 2). */
  beginn?: string;
  ende?: string;
  /** `null` oder `""` = leeren. */
  ort?: string | null;
  bemerkung?: string | null;
};

export type EntfallenderTermin = {
  terminId: string;
  datum: string;
  beginn: string | null;
  training: { id: string; name: string };
};

export type SerienFolge = {
  /** Die Serie, in der geändert wurde (bei «folgende» die neue Teilserie);
   *  `null`, wenn keine übrig blieb. */
  serieId: string | null;
  /** Die Version, gegen die gerechnet wurde — die Oberfläche sendet sie beim
   *  Ausführen mit (PO 17). */
  versionVorher: number;
  /** Nur die entfallenden Termine MIT Training (AK 8, PC 17). */
  entfallend: EntfallenderTermin[];
  entfallendAnzahl: number;
  /** Vergangene Termine, die die Änderung erfasst oder entfallen lässt. */
  vergangene: number;
  teamId: string;
};

type Roh = {
  serie: string | null;
  version_vorher: number;
  entfallend: { id: string; datum: string; beginn: string | null; training: { id: string; name: string } }[];
  entfallend_anzahl: number;
  vergangene: number;
};

function folge(r: Roh, teamId: string): SerienFolge {
  return {
    serieId: r.serie,
    versionVorher: r.version_vorher,
    entfallend: r.entfallend.map((x) => ({ terminId: x.id, datum: x.datum, beginn: x.beginn, training: x.training })),
    entfallendAnzahl: r.entfallend_anzahl,
    vergangene: r.vergangene,
    teamId,
  };
}

type Lauf = {
  vorschau?: boolean;
  /** Was die Oberfläche in der Vorschau sah; ohne (KI) rechnet der Kern die
   *  Vorschau selbst und verlangt `bestaetigt` für Vergangenes. */
  erwartet?: { version: number; entfallend: string[] };
  bestaetigt?: boolean;
};

/** Vorschau, KI-Bestätigung und Ausführung — für Ändern und Entfernen
 *  derselbe Ablauf. `rpc(ausfuehren, erwartet)` ruft die Hülle der Datenebene. */
async function laufe(
  teamId: string,
  lauf: Lauf,
  rpc: (ausfuehren: boolean, erwartet: { version: number; entfallend: string[] } | null) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>,
): Promise<KernErgebnis<SerienFolge>> {
  if (lauf.vorschau || !lauf.erwartet) {
    const v = await rpc(false, lauf.erwartet ?? null);
    if (v.error) return kalenderFehler(v.error);
    const vorschau = folge(v.data as Roh, teamId);
    if (lauf.vorschau) return ok(vorschau);
    if (vorschau.vergangene > 0 && !lauf.bestaetigt)
      return fehlschlag("regel", vergangeneBestaetigen(vorschau.vergangene), { feld: "bestaetigt" });
    lauf = { erwartet: { version: vorschau.versionVorher, entfallend: vorschau.entfallend.map((x) => x.terminId) } };
  }
  const r = await rpc(true, lauf.erwartet!);
  if (r.error) return kalenderFehler(r.error);
  return ok(folge(r.data as Roh, teamId));
}

/** Eine Serie ab dem gewählten Termin («dieser und folgende») oder als Ganzes
 *  ändern (#326 AK 1, 3–5, 8, 9, 11; PC 2–10, 13–17, 19). */
export async function aendereSerie(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; reichweite: "dieser_und_folgende" | "alle"; aenderung: SerienAenderung } & Lauf,
): Promise<KernErgebnis<SerienFolge>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  if (!t.serie_id) return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, TERMIN_FELD);

  const a = e.aenderung;
  const hatZeit = a.beginn !== undefined || a.ende !== undefined;
  if (!hatZeit && a.wochentage === undefined && a.von === undefined && a.bis === undefined && a.ort === undefined && a.bemerkung === undefined)
    return fehlschlag("eingabe", SERIE_MELDUNG.KEINE_AENDERUNG);
  if (hatZeit) {
    const z = zeitProblem(a.beginn, a.ende);
    if (z) return fehlschlag("eingabe", z.text, { feld: z.feld });
  }
  const tp = textProblem(a);
  if (tp) return fehlschlag("eingabe", tp.text, { feld: tp.feld });

  // Die Regel vorab prüfen, mit den Feldnamen des Werkzeugs (AK 5, PC 19).
  const { data: s } = await supabase
    .from("termin_serien")
    .select("wochentage, beginn_datum, end_datum")
    .eq("id", t.serie_id)
    .single<{ wochentage: Wochentag[]; beginn_datum: string; end_datum: string }>();
  if (s) {
    const altVon = e.reichweite === "alle" ? s.beginn_datum : t.datum;
    const altBis = e.reichweite === "alle" ? s.end_datum : (s.end_datum > t.datum ? s.end_datum : t.datum);
    const regel = { wochentage: a.wochentage ?? s.wochentage, von: a.von ?? altVon, bis: a.bis ?? altBis };
    if (e.reichweite === "dieser_und_folgende" && regel.von < t.datum)
      return fehlschlag("eingabe", SERIE_MELDUNG.TEILSERIE_BEGINN, { feld: "von" });
    const p = serieProblem({ ...regel, beginn: "00:00", ende: "00:01" });
    if (p) return fehlschlag("eingabe", p.text, { feld: p.feld });
  }

  const aenderung: Record<string, unknown> = {};
  if (a.wochentage) aenderung.wochentage = a.wochentage;
  if (a.von) aenderung.beginn_datum = a.von;
  if (a.bis) aenderung.end_datum = a.bis;
  if (hatZeit) Object.assign(aenderung, { beginn: a.beginn, ende: a.ende });
  if (a.ort !== undefined) aenderung.ort = leerZuNull(a.ort);
  if (a.bemerkung !== undefined) aenderung.bemerkung = leerZuNull(a.bemerkung);

  return laufe(t.team_id, e, async (ausfuehren, erwartet) =>
    supabase.rpc("terminserie_aendern", {
      p_termin: t.id,
      p_reichweite: e.reichweite,
      p_aenderung: aenderung,
      p_version: erwartet?.version ?? null,
      p_entfallend: ausfuehren ? (erwartet?.entfallend ?? null) : null,
      p_ausfuehren: ausfuehren,
    }),
  );
}

/** Einen Serientermin und alle folgenden oder alle Termine der Serie
 *  entfernen (#326 AK 7–9, 11; PC 11–17). */
export async function entferneSerie(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; reichweite: "dieser_und_folgende" | "alle" } & Lauf,
): Promise<KernErgebnis<SerienFolge>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  if (!t.serie_id) return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, TERMIN_FELD);
  return laufe(t.team_id, e, async (ausfuehren, erwartet) =>
    supabase.rpc("terminserie_entfernen", {
      p_termin: t.id,
      p_reichweite: e.reichweite,
      p_version: erwartet?.version ?? null,
      p_entfallend: ausfuehren ? (erwartet?.entfallend ?? null) : null,
      p_ausfuehren: ausfuehren,
    }),
  );
}

export type FolgeAngabe = "zeit" | "ort" | "bemerkung";

/** Abweichende Angaben wieder der Serie folgen lassen (#326 AK 6; das Datum
 *  nie, PO 3). */
export async function folgeDerSerie(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; angaben: FolgeAngabe[] },
): Promise<KernErgebnis<{ terminId: string; teamId: string }>> {
  if (!istUuid(e.terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  if (e.angaben.length === 0) return fehlschlag("eingabe", SERIE_MELDUNG.KEINE_AENDERUNG, { feld: "angaben" });
  const { data, error } = await supabase.rpc("termin_der_serie_folgen", { p_termin: e.terminId, p_angaben: e.angaben });
  if (error) return kalenderFehler(error);
  return ok({ terminId: e.terminId, teamId: (data as { team: string }).team });
}

// ── Der KI-Weg: ein Werkzeug, die Reichweite als Angabe (#326 AK 10, 11) ──────

export type MitReichweite = TerminAendern & {
  reichweite?: Reichweite;
  wochentage?: Wochentag[];
  von?: string;
  bis?: string;
  bestaetigt?: boolean;
};

/** Ändern mit Reichweite: Ein Serientermin verlangt sie (AK 11); das Datum
 *  nur für diesen (AK 2), Wochentage und Zeitraum nur für folgende oder alle
 *  (AK 3, 4). */
export async function aendereMitReichweite(
  supabase: SupabaseClient,
  userId: string,
  e: MitReichweite,
): Promise<KernErgebnis<{ terminId: string; teamId: string; serie: SerienFolge | null }>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  const regel = e.wochentage !== undefined || e.von !== undefined || e.bis !== undefined;

  if (!t.serie_id) {
    if (regel || (e.reichweite && e.reichweite !== "nur_dieser"))
      return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, { feld: "reichweite" });
  } else if (!e.reichweite) {
    return fehlschlag("regel", SERIE_MELDUNG.REICHWEITE_FEHLT, {
      feld: "reichweite",
      zulaessig: ["nur_dieser", "dieser_und_folgende", "alle"],
    });
  }

  if (!t.serie_id || e.reichweite === "nur_dieser") {
    if (regel) return fehlschlag("regel", SERIE_MELDUNG.REGEL_NUR_SERIE, { feld: "reichweite" });
    const r = await aendereTermin(supabase, userId, e);
    return r.ok ? ok({ terminId: r.wert.terminId, teamId: r.wert.teamId, serie: null }) : r;
  }
  if (e.datum !== undefined) return fehlschlag("regel", SERIE_MELDUNG.DATUM_NUR_EINZELN, { feld: "datum" });
  const r = await aendereSerie(supabase, userId, {
    terminId: e.terminId,
    reichweite: e.reichweite!,
    aenderung: {
      wochentage: e.wochentage,
      von: e.von,
      bis: e.bis,
      beginn: e.beginn ?? undefined,
      ende: e.ende ?? undefined,
      ort: e.ort,
      bemerkung: e.bemerkung,
    },
    bestaetigt: e.bestaetigt,
  });
  return r.ok ? ok({ terminId: e.terminId, teamId: r.wert.teamId, serie: r.wert }) : r;
}

/** Entfernen mit Reichweite (AK 7, 11). */
export async function entferneMitReichweite(
  supabase: SupabaseClient,
  userId: string,
  e: { terminId: string; reichweite?: Reichweite; bestaetigt?: boolean },
): Promise<KernErgebnis<{ teamId: string; trainingId: string | null; serie: SerienFolge | null }>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  if (t.serie_id && !e.reichweite)
    return fehlschlag("regel", SERIE_MELDUNG.REICHWEITE_FEHLT, {
      feld: "reichweite",
      zulaessig: ["nur_dieser", "dieser_und_folgende", "alle"],
    });
  if (!t.serie_id && e.reichweite && e.reichweite !== "nur_dieser")
    return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, { feld: "reichweite" });
  if (!t.serie_id || e.reichweite === "nur_dieser") {
    const r = await entferneTermin(supabase, userId, { terminId: t.id });
    return r.ok ? ok({ ...r.wert, serie: null }) : r;
  }
  const r = await entferneSerie(supabase, userId, { terminId: t.id, reichweite: e.reichweite!, bestaetigt: e.bestaetigt });
  return r.ok ? ok({ teamId: r.wert.teamId, trainingId: null, serie: r.wert }) : r;
}
```

(Der `serieProblem`-Aufruf mit Platzhalterzeit `00:00`–`00:01` prüft nur die Regel. Zeit und Texte prüfen die Zeilen davor mit ihren eigenen Feldnamen.)

- [ ] **Step 6: Tests** — `npm run check:kern-db` → die vier Serien-Szenarien «✓». `npm run check:kern` bleibt grün (Wächter: `lib/kern/serien.ts` trägt `import "server-only"`).

- [ ] **Step 7: Commit**

```bash
git add web/lib/kern web/lib/queries/termine-fuer.ts web/scripts/pruefe-kern-db.ts
git commit -m "feat(kalender): Fachkern für Terminserien mit Reichweite, Vorschau und KI-Bestätigung (#324, #326)"
```

### Task B5: KI-Werkzeuge für Serien

**Files:**
- Modify: `web/lib/mcp/werkzeuge/team.ts`
- Modify: `web/lib/mcp/server.ts`, `web/lib/mcp/umfang.ts:16`
- Modify: `web/lib/kern/auskunft-schema.ts`, `web/lib/kern/auskunft.ts` (Termin der Auskunft mit `serie_id`)
- Test: `web/scripts/pruefe-kern.ts` (`jeStory` «#324», «#326»)

**Interfaces:**
- Produces: neue Werkzeuge `terminserie_festlegen`, `termin_der_serie_folgen`. `termin_aendern` und `termin_entfernen` erhalten `reichweite`, `bestaetigt`, `wochentage`, `von` und `bis`. `team_plan_abrufen` liefert zusätzlich `serien[]` und je Eintrag `serie_id` und `abweichungen`.

- [ ] **Step 1: Failing test** — `jeStory` ergänzen:

```ts
    "#324": ["terminserie_festlegen"],
    "#326": ["termin_der_serie_folgen"],
```

- [ ] **Step 2: Werkzeuge** — in `team.ts`:

```ts
const Wochentage = z
  .array(z.enum(KI_WOCHENTAG))
  .min(1)
  .describe("Wochentage als «mo», «di», «mi», «do», «fr», «sa», «so».");
const Reichweite = z
  .enum(["nur_dieser", "dieser_und_folgende", "alle"])
  .describe(
    "Für Termine einer Serie Pflicht: «nur_dieser», «dieser_und_folgende» (teilt die Serie am " +
      "gewählten Termin) oder «alle» (ganze Serie, vergangene Termine eingeschlossen).",
  );
const Bestaetigt = z
  .boolean()
  .optional()
  .describe("Nur nötig, wenn «dieser_und_folgende» oder «alle» vergangene Termine erfasst oder entfallen lässt.");

const SERIEN_MODELL =
  "Eine Terminserie läuft wöchentlich an einem oder mehreren Wochentagen zwischen Beginn- und " +
  "Enddatum (höchstens bis zum gleichen Kalendertag im Folgejahr) und legt ihre Termine als " +
  "einzelne Termine an. Ein Termin einer Serie kann je Angabe abweichen (Datum, Zeit, Ort, " +
  "Bemerkung) und behält die Abweichung bei späteren Serienänderungen; das Datum gilt immer, wie " +
  "es ist. Einzeln entfernte Termine legt keine Serienänderung wieder an.";

export const terminserieFestlegen = werkzeug({
  name: "terminserie_festlegen",
  titel: "Terminserie festlegen",
  beschreibung:
    "Legt für eines deiner Teams eine wöchentliche Terminserie fest: je gewähltem Wochentag " +
    "zwischen «von» und «bis» (beide eingeschlossen) einen Termin ohne Training mit Beginn, Ende, " +
    "Ort und Bemerkung der Serie — auch ganz oder teilweise in der Vergangenheit. Bestehende " +
    "Termine an denselben Tagen bleiben daneben stehen. " +
    `${SERIEN_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    team_id: TeamId,
    wochentage: Wochentage,
    von: DATUM.describe("Beginndatum als JJJJ-MM-TT."),
    bis: DATUM.describe("Enddatum als JJJJ-MM-TT, spätestens am gleichen Kalendertag im Folgejahr."),
    beginn: UHRZEIT,
    ende: UHRZEIT,
    ort: ORT.optional(),
    bemerkung: BEMERKUNG.optional(),
  }),
  ausgabe: z.object({ serie_id: z.string(), termine: z.number().int() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await legeSerieFest(zugang.supabase, zugang.userId, {
        teamId: e.team_id,
        wochentage: e.wochentage.map(alsWochentag),
        von: e.von,
        bis: e.bis,
        beginn: e.beginn,
        ende: e.ende,
        ort: e.ort,
        bemerkung: e.bemerkung,
      }),
      (w) => ({ serie_id: w.serieId, termine: w.termine }),
    ),
});
```

`AendernEingabe` um

```ts
  reichweite: Reichweite.optional(),
  wochentage: Wochentage.optional().describe("Neue Wochentage der Serie (nur mit «dieser_und_folgende» oder «alle»)."),
  von: DATUM.optional().describe("Neues Beginndatum der Serie (nur mit «dieser_und_folgende» oder «alle»; bei «dieser_und_folgende» frühestens am gewählten Termin)."),
  bis: DATUM.optional().describe("Neues Enddatum der Serie (nur mit «dieser_und_folgende» oder «alle»)."),
  bestaetigt: Bestaetigt,
```

ergänzen. `terminAendern.ausfuehren` ruft `aendereMitReichweite`, mit `wochentage: e.wochentage?.map(alsWochentag)`. Ausgabe:

```ts
  ausgabe: z.object({
    termin_id: z.string(),
    serie_id: z.string().nullable().describe("Bei «dieser_und_folgende» die neue Teilserie."),
    entfallen_mit_training: z.array(z.object({ termin_id: z.string(), datum: z.string(), training: z.object({ id: z.string(), name: z.string() }) })),
  }),
```

Mapping: `entfallen_mit_training: (w.serie?.entfallend ?? []).map((x) => ({ termin_id: x.terminId, datum: x.datum, training: x.training }))`. Die Beschreibung erhält den Satz: «Für einen Termin einer Serie ist «reichweite» Pflicht; das Datum ändert nur «nur_dieser», Wochentage und Zeitraum nur «dieser_und_folgende» oder «alle». Das Ergebnis nennt entfallene Termine mit Training; ihre Trainings bleiben im Bestand des Teams.» plus `SERIEN_MODELL`.

`termin_entfernen`: Eingabe `{ termin_id, reichweite: Reichweite.optional(), bestaetigt: Bestaetigt }`, Aufruf `entferneMitReichweite`, Ausgabe `{ training_id, entfallen_mit_training }`. PC 17 lautet sinngemäss «… ihre Trainings bleiben im Bestand des Teams».

```ts
export const terminDerSerieFolgen = werkzeug({
  name: "termin_der_serie_folgen",
  titel: "Termin wieder der Serie folgen lassen",
  beschreibung:
    "Lässt abweichende Angaben eines Serientermins wieder seiner Serie folgen: Zeit, Ort oder " +
    "Bemerkung übernehmen die Werte der Serie und folgen ihr bei künftigen Änderungen. Das Datum " +
    `lässt sich nicht zurücksetzen. ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId, angaben: z.array(z.enum(["zeit", "ort", "bemerkung"])).min(1) }),
  ausgabe: z.object({ termin_id: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await folgeDerSerie(zugang.supabase, zugang.userId, { terminId: e.termin_id, angaben: e.angaben }), (w) => ({
      termin_id: w.terminId,
    })),
});
```

`team_plan_abrufen`:
- `PlanEintrag` um `serie_id: z.string().nullable()` und `abweichungen: z.array(z.enum(["datum", "zeit", "ort", "bemerkung"]))` ergänzen.
- Die Ausgabe um `serien: z.array(z.object({ id, wochentage: z.array(z.enum(KI_WOCHENTAG)), von, bis, beginn, ende, ort: nullable, bemerkung: nullable }))` ergänzen.
- `serien` entsteht aus den `t.serie` aller Einträge, eindeutig per `id`.
- In der Beschreibung ergänzen: «Termine einer Serie tragen «serie_id»; «serien» nennt Wochentage, Zeitraum, Zeit, Ort und Bemerkung jeder Serie, «abweichungen» die Angaben, in denen ein Termin von ihr abweicht.»

Auskunft (`training_abrufen`, `trainings_suchen`): Das `termin`-Objekt erhält `serie_id: z.string().nullable()`. Das Mapping nimmt `k.termin.serie?.id ?? null`; der Suchtreffer liest `serie_id` im `TEAM_LIST_SELECT` mit (`training_termine ( id, datum, beginn, ende, ort, bemerkung, serie_id )`). Den Test in `pruefe-kern.ts` (Auskunft mit Termin) um `serie_id: null` ergänzen.

`umfang.ts`:

```ts
  "Team-Trainings deiner Teams führen und im Kalender deiner Teams Termine und Terminserien festlegen, ändern und entfernen und ihnen Trainings zuordnen",
```

`server.ts`: `terminserieFestlegen` und `terminDerSerieFolgen` hinter `terminEntfernen` registrieren.

- [ ] **Step 3: Tests** — `npm run check:kern && npm run typecheck` → grün.

- [ ] **Step 4: Commit**

```bash
git add web/lib/mcp web/lib/kern/auskunft-schema.ts web/lib/kern/auskunft.ts web/lib/queries/trainings-fuer.ts web/scripts/pruefe-kern.ts
git commit -m "feat(ki): Terminserien festlegen, mit Reichweite ändern und entfernen (#324, #326)"
```

### Task B6: Oberfläche — Serie festlegen und kennzeichnen

**Files:**
- Create: `web/components/team/SerieDialog.tsx`
- Create: `web/components/ui/WochentagWahl.tsx` + Demo im Styleguide (Abschnitt 16 «Einfachauswahl» → neuer Unterabschnitt «Wochentage»)
- Modify: `web/lib/actions/termine.ts` (`legeSerieFestAktion`)
- Modify: `web/components/team/TerminBereich.tsx` (`neueSerie`), `NeuerTerminKnopf.tsx`, `TrainingsPlan.tsx` (Serien-Kennzeichen)

**Interfaces:**
- Produces: `WochentagWahl({ wert: Wochentag[]; onChange; error? })`, `SerieDialog({ open, start, pending, fehler, onClose, onSpeichern(f: SerieFelder) })`, `type SerieFelder = { wochentage; von; bis; beginn; ende; ort; bemerkung }`. `TerminAktionen.neueSerie(datum?)`.

- [ ] **Step 1: `WochentagWahl.tsx`** — eine Mehrfachauswahl aus sieben FilterChips. Neu ist sie, weil `MultiSelect` ein Menü öffnet, sieben feste Tage aber auf einen Blick sichtbar sein sollen. Begründung auch im Styleguide.

```tsx
"use client";

import { FilterChip } from "./Chip";
import { WOCHENTAGE, WOCHENTAG_KURZ, WOCHENTAG_LANG, type Wochentag } from "@/lib/serie";

/* Wochentage einer Terminserie wählen (#324 AK 2). Sieben feste Werte —
   sichtbar nebeneinander statt in einem Menü, Montag zuerst wie im
   Schweizer Kalender. */
export function WochentagWahl({
  wert,
  onChange,
  error,
}: {
  wert: readonly Wochentag[];
  onChange: (w: Wochentag[]) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 type-body-small text-on-surface-mittel">Wochentage</legend>
      <div className="flex flex-wrap gap-2">
        {WOCHENTAGE.map((w) => (
          <FilterChip
            key={w}
            selected={wert.includes(w)}
            onClick={() => onChange(wert.includes(w) ? wert.filter((x) => x !== w) : [...wert, w].sort())}
          >
            <span aria-hidden>{WOCHENTAG_KURZ[w]}</span>
            <span className="sr-only">{WOCHENTAG_LANG[w]}</span>
          </FilterChip>
        ))}
      </div>
      {error && <p role="alert" className="mt-1 type-body-small text-error">{error}</p>}
    </fieldset>
  );
}
```

Export in `web/components/ui/index.ts` ergänzen. Im Styleguide eine Demo mit `useState<Wochentag[]>([2, 4])` anlegen, samt Satz «Für die sieben festen Wochentage einer Terminserie; alle Werte stehen sichtbar nebeneinander.».

- [ ] **Step 2: `SerieDialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, DateField, Dialog, TextArea, TextField, TimeField, WochentagWahl } from "@/components/ui";
import { maxEnddatum, serieProblem, type SerieFeld, type Wochentag } from "@/lib/serie";
import { BEMERKUNG_MAX, ORT_MAX } from "@/lib/termin";

export type SerieFelder = {
  wochentage: Wochentag[];
  von: string;
  bis: string;
  beginn: string;
  ende: string;
  ort: string;
  bemerkung: string;
};

/* Eine Terminserie festlegen (#324 AK 1–7). Die Regeln sind dieselben wie
   im Fachkern (lib/serie.ts); das Enddatum kann nicht über den gleichen
   Kalendertag im Folgejahr hinaus gewählt werden. */
export function SerieDialog({
  open,
  start,
  pending,
  fehler: serverFehler,
  onClose,
  onSpeichern,
}: {
  open: boolean;
  start?: Partial<SerieFelder>;
  pending?: boolean;
  fehler?: string;
  onClose: () => void;
  onSpeichern: (f: SerieFelder) => void;
}) {
  const leer: SerieFelder = { wochentage: [], von: "", bis: "", beginn: "", ende: "", ort: "", bemerkung: "" };
  const [f, setF] = useState<SerieFelder>(leer);
  const [problem, setProblem] = useState<{ feld: SerieFeld; text: string } | null>(null);
  useEffect(() => {
    if (!open) return;
    setF({ ...leer, ...start });
    setProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const an = (k: SerieFeld) => (problem?.feld === k ? problem.text : undefined);
  const setze = <K extends keyof SerieFelder>(k: K, v: SerieFelder[K]) => setF((x) => ({ ...x, [k]: v }));

  function speichern() {
    const p = serieProblem(f);
    setProblem(p);
    if (!p) onSpeichern(f);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Terminserie festlegen"
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" onClick={speichern} disabled={pending}>Festlegen</Button>
        </>
      }
    >
      {serverFehler && <p role="alert" className="mb-4 text-error">{serverFehler}</p>}
      <div className="flex flex-col gap-4">
        <WochentagWahl wert={f.wochentage} onChange={(w) => setze("wochentage", w)} error={an("wochentage")} />
        <div className="flex flex-col gap-4 sm:flex-row">
          <DateField label="Beginndatum" value={f.von} onChange={(e) => setze("von", e.target.value)} error={an("von")} />
          <DateField label="Enddatum" value={f.bis} min={f.von || undefined} max={f.von ? maxEnddatum(f.von) : undefined} onChange={(e) => setze("bis", e.target.value)} error={an("bis")} />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <TimeField label="Beginn" value={f.beginn} onChange={(e) => setze("beginn", e.target.value)} error={an("beginn")} />
          <TimeField label="Ende" value={f.ende} onChange={(e) => setze("ende", e.target.value)} error={an("ende")} />
        </div>
        <TextField label="Ort (optional)" maxLength={ORT_MAX} value={f.ort} onChange={(e) => setze("ort", e.target.value)} error={an("ort")} />
        <TextArea label="Bemerkung (optional)" rows={3} maxLength={BEMERKUNG_MAX} value={f.bemerkung} onChange={(e) => setze("bemerkung", e.target.value)} error={an("bemerkung")} />
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 3: Action und Einstieg** — in `web/lib/actions/termine.ts`:

```ts
import { legeSerieFest } from "@/lib/kern/serien";
import type { Wochentag } from "@/lib/serie";

export async function legeSerieFestAktion(
  teamId: string,
  f: { wochentage: Wochentag[]; von: string; bis: string; beginn: string; ende: string; ort: string; bemerkung: string },
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await legeSerieFest(a.supabase, a.userId, { teamId, ...f });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(teamId);
  return { ok: true };
}
```

`TerminBereich`:
- `neueSerie: (datum?: string) => void` im Typ und im Objekt ergänzen, State `serieNeu: string | null`.
- Einen `<SerieDialog open={serieNeu !== null} start={{ von: serieNeu ?? "" }} … onSpeichern={(f) => lauf(() => legeSerieFestAktion(teamId, f), () => "Terminserie festgelegt.", () => setSerieNeu(null), true)} />` rendern.
- PC 4 story 3 bestätigt das Festlegen ohne Anzahl (OoS 5).

`NeuerTerminKnopf` rendert daneben `<Button variant="outlined" onClick={() => a.neueSerie()}><Repeat size={18} aria-hidden /> Terminserie festlegen</Button>`.

`TerminKarte`: Im Kopf nach dem Datum `{t.serie && <span className="inline-flex items-center gap-1"><Repeat size={14} aria-hidden /><span className="sr-only">Teil einer Terminserie </span>{wochentageText(t.serie.wochentage)}</span>}` einfügen (#324 AK 8).

- [ ] **Step 4: Typecheck, Wächter, Commit**

Run: `npm run typecheck && npm run check:kern && npm run check:farben`

```bash
git add web/components web/lib/actions/termine.ts web/app/styleguide
git commit -m "feat(kalender): Terminserie in der Oberfläche festlegen und kennzeichnen (#324)"
```

### Task B7: Oberfläche — Reichweite, Vorschau, Bestätigung, Abweichungen

**Files:**
- Create: `web/components/team/ReichweiteDialog.tsx`
- Create: `web/components/team/EntfallendBestaetigung.tsx`
- Modify: `web/components/team/TerminDialog.tsx` (Serien-Abschnitt, Abweichungen, «Der Serie folgen»)
- Modify: `web/components/team/TerminBereich.tsx` (Abläufe Ändern/Entfernen mit Reichweite)
- Modify: `web/lib/actions/termine.ts` (Serien-Actions)

**Interfaces:**
- Consumes: B4.
- Produces: Actions `vorschauSerieAktion(terminId, reichweite, aenderung, version)`, `aendereSerieAktion(terminId, reichweite, aenderung, erwartet)`, `vorschauSerieEntfernenAktion(terminId, reichweite, version)`, `entferneSerieAktion(terminId, reichweite, erwartet)`, `folgeDerSerieAktion(terminId, angaben)`. Alle liefern `{ ok: true; folge?: SerienFolge } | Fehler`.

- [ ] **Step 1: Actions** — in `web/lib/actions/termine.ts`:

```ts
import { aendereSerie, entferneSerie, folgeDerSerie, type FolgeAngabe, type SerienAenderung, type SerienFolge } from "@/lib/kern/serien";

type Serienweit = "dieser_und_folgende" | "alle";

async function serienLauf(f: (s: SupabaseClient, u: string) => Promise<KernErgebnis<SerienFolge>>) {
  const a = await angemeldet();
  if (!a) return { ok: false as const, error: NICHT_ANGEMELDET };
  const r = await f(a.supabase, a.userId);
  if (!r.ok) return { ok: false as const, error: r.meldung };
  return { ok: true as const, folge: r.wert };
}

export async function vorschauSerieAktion(terminId: string, reichweite: Serienweit, aenderung: SerienAenderung, version: number) {
  return serienLauf((s, u) => aendereSerie(s, u, { terminId, reichweite, aenderung, vorschau: true, erwartet: { version, entfallend: [] } }));
}

export async function aendereSerieAktion(terminId: string, reichweite: Serienweit, aenderung: SerienAenderung, erwartet: { version: number; entfallend: string[] }) {
  const r = await serienLauf((s, u) => aendereSerie(s, u, { terminId, reichweite, aenderung, erwartet }));
  if (r.ok) revalidiereTeam(r.folge.teamId);
  return r;
}

export async function vorschauSerieEntfernenAktion(terminId: string, reichweite: Serienweit, version: number) {
  return serienLauf((s, u) => entferneSerie(s, u, { terminId, reichweite, vorschau: true, erwartet: { version, entfallend: [] } }));
}

export async function entferneSerieAktion(terminId: string, reichweite: Serienweit, erwartet: { version: number; entfallend: string[] }) {
  const r = await serienLauf((s, u) => entferneSerie(s, u, { terminId, reichweite, erwartet }));
  if (r.ok) revalidiereTeam(r.folge.teamId);
  return r;
}

export async function folgeDerSerieAktion(terminId: string, angaben: FolgeAngabe[]): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await folgeDerSerie(a.supabase, a.userId, { terminId, angaben });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  return { ok: true };
}
```

(Importe `SupabaseClient` und `KernErgebnis` als Typen ergänzen. Die Vorschau prüft über `erwartet.version` schon beim Rechnen, ob die Serie seit dem Laden des Plans geändert wurde; `entfallend: []` ist dort ohne Belang, weil die Hülle die Vorschau ohne Belegungsvergleich fährt.)

- [ ] **Step 2: `ReichweiteDialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, ChoiceChip, ChoiceChipGroup, Dialog } from "@/components/ui";
import type { Reichweite } from "@/lib/serie";

/* Wie in gängigen Kalendern (PO 16): Für welchen Teil der Serie gilt es?
   Welche Wahl erlaubt ist, entscheidet, was sich ändert — das Datum nur für
   diesen Termin, Wochentage und Zeitraum nur für folgende oder alle
   (#326 AK 2–4). */
export function ReichweiteDialog({
  open,
  titel,
  erlaubt,
  hinweis,
  pending,
  onClose,
  onWahl,
}: {
  open: boolean;
  titel: string;
  erlaubt: readonly Reichweite[];
  hinweis?: string;
  pending?: boolean;
  onClose: () => void;
  onWahl: (r: Reichweite) => void;
}) {
  const [wahl, setWahl] = useState<Reichweite | null>(null);
  useEffect(() => { if (open) setWahl(erlaubt.length === 1 ? erlaubt[0] : null); }, [open, erlaubt]);
  const text: Record<Reichweite, string> = {
    nur_dieser: "Nur dieser Termin",
    dieser_und_folgende: "Dieser und alle folgenden",
    alle: "Alle Termine der Serie",
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={titel}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" disabled={!wahl || pending} onClick={() => wahl && onWahl(wahl)}>Weiter</Button>
        </>
      }
    >
      {hinweis && <p className="mb-3">{hinweis}</p>}
      <ChoiceChipGroup ariaLabel="Reichweite" className="flex-col items-start">
        {(["nur_dieser", "dieser_und_folgende", "alle"] as const).filter((r) => erlaubt.includes(r)).map((r, i) => (
          <ChoiceChip key={r} tabStop={i === 0} selected={wahl === r} onSelect={() => setWahl(r)} look="nutzertext">
            {text[r]}
          </ChoiceChip>
        ))}
      </ChoiceChipGroup>
    </Dialog>
  );
}
```

- [ ] **Step 3: `EntfallendBestaetigung.tsx`** (AK 8)

```tsx
"use client";

import { AlertTriangle } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { datumKurz } from "@/lib/zeit";
import type { SerienFolge } from "@/lib/kern/serien";

/* Fallen Termine weg, muss das bestätigt werden (#326 AK 8). Genannt werden
   die wegfallenden Termine MIT Training; ihre Trainings bleiben ohne Termin
   im Team-Bestand (PO 4). */
export function EntfallendBestaetigung({
  folge,
  aktion,
  pending,
  onClose,
  onBestaetigen,
}: {
  folge: SerienFolge | null;
  aktion: "aendern" | "entfernen";
  pending?: boolean;
  onClose: () => void;
  onBestaetigen: () => void;
}) {
  return (
    <Dialog
      open={folge !== null}
      onClose={onClose}
      title={aktion === "entfernen" ? "Termine entfernen?" : "Termine fallen weg"}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="danger" disabled={pending} onClick={onBestaetigen}>
            {aktion === "entfernen" ? "Entfernen" : "Ändern"}
          </Button>
        </>
      }
    >
      <p className="flex items-start gap-2">
        <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0 text-error" />
        {/* Ohne Zahl: Die Anwendung nennt die Anzahl entfallender Termine nicht (#326 OoS 4). */}
        Termine der Serie fallen damit weg.
      </p>
      {folge && folge.entfallend.length > 0 && (
        <>
          <p className="mt-3">Diese tragen ein Training; es bleibt ohne Termin im Team-Bestand:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {folge.entfallend.map((e) => (
              <li key={e.terminId}>{datumKurz(e.datum)} — <strong className="text-on-surface">{e.training.name}</strong></li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
```

(`SerienFolge` ist ein reiner Typ; `import type` aus `lib/kern/serien` zieht kein `server-only` in das Client-Bundle.)

- [ ] **Step 4: `TerminDialog.tsx` — Serien-Abschnitt**
  - Props ergänzen: `serie?: TerminSerie | null`, `abweichungen?: Abweichung[]`, `serienTag?: string | null` und `onFolgen?: (angabe: "zeit" | "ort" | "bemerkung") => void`.
  - `onSpeichern` erhält einen zweiten Parameter `regel?: { wochentage: Wochentag[]; von: string; bis: string }`.
  - Unter den Feldern, wenn `serie`:

```tsx
      {serie && (
        <section className="mt-6 border-t border-linie pt-4">
          <h3 className="type-title-small text-on-surface">Terminserie</h3>
          <p className="type-body-small text-on-surface-mittel">
            {wochentageText(serie.wochentage)} · {datumKurz(serie.beginnDatum)} bis {datumKurz(serie.endDatum)} · {serie.beginn}–{serie.ende} Uhr
          </p>
          {/* #326 AK 14: welche Angaben abweichen — mit dem Weg zurück (AK 6). */}
          <ul className="mt-2 flex flex-col gap-1 type-body-small">
            {abweichungen?.includes("datum") && serienTag && (
              <li>Verschoben — ursprünglich {datumKurz(serienTag)}.</li>
            )}
            {(["zeit", "ort", "bemerkung"] as const).filter((a) => abweichungen?.includes(a)).map((a) => (
              <li key={a} className="flex items-center justify-between gap-2">
                <span>{{ zeit: "Zeit", ort: "Ort", bemerkung: "Bemerkung" }[a]} weicht von der Serie ab.</span>
                <Button variant="text" size="sm" onClick={() => onFolgen?.(a)}>Der Serie folgen</Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-4">
            <WochentagWahl wert={regel.wochentage} onChange={(w) => setRegel((r) => ({ ...r, wochentage: w }))} />
            <div className="flex flex-col gap-4 sm:flex-row">
              <DateField label="Beginn der Serie" value={regel.von} onChange={(e) => setRegel((r) => ({ ...r, von: e.target.value }))} />
              <DateField label="Ende der Serie" value={regel.bis} max={regel.von ? maxEnddatum(regel.von) : undefined} onChange={(e) => setRegel((r) => ({ ...r, bis: e.target.value }))} />
            </div>
            <p className="type-body-small text-on-surface-mittel">Wochentage und Zeitraum gelten für diesen und folgende oder für alle Termine.</p>
          </div>
        </section>
      )}
```

  - State `regel` wird beim Öffnen aus `serie` belegt: `{ wochentage: serie.wochentage, von: serie.beginnDatum, bis: serie.endDatum }`.
  - `speichern()` ruft `onSpeichern(felder, serie ? regel : undefined)`.
  - Die Termin-Regeln prüfen weiter nur `terminProblem`; eine geänderte Regel prüft `serieProblem`, bevor gesendet wird. Den Fehler am Serien-Abschnitt als `<p role="alert">` zeigen.

- [ ] **Step 5: `TerminBereich` — Abläufe**
  - Zusätzlicher State: `reichweite: { art: "aendern" | "entfernen"; t: TerminZeile; felder?: TerminFelder; regel?: Regel; erlaubt: Reichweite[] } | null` und `bestaetigen: { art; t; reichweite: Serienweit; aenderung?: SerienAenderung; folge: SerienFolge } | null`.
  - `bearbeiten.onSpeichern(f, regel)`:

```tsx
  function aenderungErmitteln(t: TerminZeile, f: TerminFelder, regel?: Regel) {
    const datum = f.datum !== t.datum;
    const regelGeaendert = !!regel && !!t.serie && (
      regel.von !== t.serie.beginnDatum || regel.bis !== t.serie.endDatum ||
      regel.wochentage.join() !== t.serie.wochentage.join());
    const aenderung: SerienAenderung = {};
    if ((f.beginn || null) !== t.beginn || (f.ende || null) !== t.ende) Object.assign(aenderung, { beginn: f.beginn ?? "", ende: f.ende ?? "" });
    if ((f.ort || null) !== t.ort) aenderung.ort = f.ort ?? null;
    if ((f.bemerkung || null) !== t.bemerkung) aenderung.bemerkung = f.bemerkung ?? null;
    if (regelGeaendert && regel) Object.assign(aenderung, {
      wochentage: regel.wochentage,
      ...(regel.von !== t.serie!.beginnDatum ? { von: regel.von } : {}),
      ...(regel.bis !== t.serie!.endDatum ? { bis: regel.bis } : {}),
    });
    return { datum, regelGeaendert, aenderung };
  }

  function speichereBearbeitung(t: TerminZeile, f: TerminFelder, regel?: Regel) {
    if (!t.serie) return lauf(() => aendereTerminAktion(t.id, f, t.training?.id ?? null), () => "Termin geändert.", () => setBearbeiten(null), true);
    const { datum, regelGeaendert } = aenderungErmitteln(t, f, regel);
    if (datum && regelGeaendert) { setDialogFehler("Datum und Wochentage oder Zeitraum lassen sich nicht in einem Schritt ändern."); return; }
    const erlaubt: Reichweite[] = datum ? ["nur_dieser"] : regelGeaendert ? ["dieser_und_folgende", "alle"] : ["nur_dieser", "dieser_und_folgende", "alle"];
    setReichweite({ art: "aendern", t, felder: f, regel, erlaubt });
  }

  function reichweiteGewaehlt(r: Reichweite) {
    if (!reichweite) return;
    const { art, t, felder, regel } = reichweite;
    if (r === "nur_dieser") {
      setReichweite(null);
      // Einzeln entfernen geht durch die Bestätigung aus Teil A: Sie nennt das
      // Training, das im Bestand bleibt (#322 AK 12, 13).
      if (art === "entfernen") return setEntfernen(t);
      return lauf(() => aendereTerminAktion(t.id, felder!, t.training?.id ?? null), () => "Termin geändert.", () => setBearbeiten(null));
    }
    startTransition(async () => {
      const aenderung = art === "aendern" ? aenderungErmitteln(t, felder!, regel).aenderung : undefined;
      const v = art === "aendern"
        ? await vorschauSerieAktion(t.id, r, aenderung!, t.serie!.version)
        : await vorschauSerieEntfernenAktion(t.id, r, t.serie!.version);
      setReichweite(null);
      if (!v.ok) { melde(v.error); return; }
      // AK 8: Bestätigen nur, wenn Termine wegfallen — Entfernen immer.
      if (art === "entfernen" || v.folge.entfallendAnzahl > 0) setBestaetigen({ art, t, reichweite: r, aenderung, folge: v.folge });
      else ausfuehren({ art, t, reichweite: r, aenderung, folge: v.folge });
    });
  }

  function ausfuehren(b: NonNullable<typeof bestaetigen>) {
    const erwartet = { version: b.folge.versionVorher, entfallend: b.folge.entfallend.map((e) => e.terminId) };
    lauf(
      () => (b.art === "aendern" ? aendereSerieAktion(b.t.id, b.reichweite, b.aenderung!, erwartet) : entferneSerieAktion(b.t.id, b.reichweite, erwartet)),
      () => (b.art === "aendern" ? "Terminserie geändert." : "Termine entfernt."),
      () => { setBestaetigen(null); setBearbeiten(null); },
    );
  }
```

  - `aktionen.entfernen = (t) => (t.serie ? setReichweite({ art: "entfernen", t, erlaubt: ["nur_dieser", "dieser_und_folgende", "alle"] }) : setEntfernen(t))`. «Nur dieser» führt in den bestehenden Dialog «Termin entfernen?» (Code oben); «dieser und folgende» und «alle» laufen über Vorschau und `EntfallendBestaetigung`.
  - `onFolgen(angabe)` → `lauf(() => folgeDerSerieAktion(t.id, [angabe]), () => "Folgt wieder der Serie.", () => setBearbeiten(null))`.
  - Den `ReichweiteDialog` mit Titel «Termin ändern» bzw. «Termin entfernen» und den `EntfallendBestaetigung` rendern.

- [ ] **Step 6: Typecheck und Commit**

Run: `npm run typecheck && npm run check:kern && npm run check:farben`

```bash
git add web/components/team web/lib/actions/termine.ts
git commit -m "feat(kalender): Serien in der Oberfläche mit Reichweite ändern und entfernen (#326)"
```

### Task B8: End-to-End und PR

- [ ] **Step 1: Browser-Durchgang**
  1. Eine Serie Di+Do für die nächsten sechs Wochen festlegen. Alle Karten tragen das Serien-Kennzeichen «Di, Do».
  2. Einen Termin öffnen und nur den Ort ändern → Reichweite «Nur dieser Termin». Beim erneuten Öffnen steht «Ort weicht von der Serie ab», dann «Der Serie folgen».
  3. Beim Ändern des Datums bietet die Reichweite nur «Nur dieser Termin».
  4. Ein Training einem Donnerstag zuordnen. Danach «Alle Termine der Serie» mit Wochentagen nur Di → die Bestätigung nennt Datum und Training. Nach dem Bestätigen steht das Training im Bestand ohne Termin.
  5. Tausch Di → Mi (alle). Die Termine liegen in derselben Woche, das Training wandert mit.
  6. «Dieser und folgende» ab dem dritten Termin, Zeit ändern → zwei Serien. Die ersten beiden Termine sind unverändert.
  7. Entfernen: «Dieser und alle folgenden» → Bestätigung, danach sind nur die früheren Termine da.
  8. Konflikt in zwei Tabs: In Tab 1 die Serie ändern, in Tab 2 danach «Alle» wählen → «Die Terminserie wurde inzwischen von einem anderen Mitglied geändert …».

- [ ] **Step 2: KI-Pfad**
  - `terminserie_festlegen`
  - `team_plan_abrufen` mit `serien` und `abweichungen`
  - `termin_aendern` ohne `reichweite` an einem Serientermin → Regel
  - «alle» mit Vergangenem ohne `bestaetigt` → Regel, mit `bestaetigt: true` → ausgeführt, samt `entfallen_mit_training`
  - `termin_der_serie_folgen`

- [ ] **Step 3: PR auf develop** — «feat(kalender): Terminserien (#324, #326)»; Release-Kopplung im Body.


---

## Teil C — Verantwortliche je Termin und Terminserie (Story #325, PR 3)

### Task C1: Migration — Verantwortliche, Austragen, Anonymisieren

**Files:**
- Create: `supabase/migrations/<zeitstempel>_termin_verantwortliche.sql`
- Modify: `.github/workflows/sync-staging.yml` (`PUBLIC_TABLES` um `termin_serien_verantwortliche` und `termin_verantwortliche`)

**Interfaces:**
- Produces:
  - Tabellen `termin_verantwortliche(id, termin_id, user_id NULL = gelöschtes Konto)` und `termin_serien_verantwortliche(serie_id, user_id)`
  - Spalte `training_termine.verantwortliche_abweichend`
  - berechnete Felder `verantwortlich_name(termin_verantwortliche)`, `verantwortlich_ehemalig(termin_verantwortliche)`, `verantwortlich_name(termin_serien_verantwortliche)`
  - RPC `termin_verantwortliche_setzen(p_termin, p_user_ids uuid[], p_anonyme uuid[]) → jsonb {team}`
  - neue Signatur `terminserie_festlegen(…, p_verantwortliche uuid[])`
  - `terminserie_rechnen` versteht den Schlüssel `verantwortliche`
  - `termin_der_serie_folgen` versteht `'verantwortliche'`
  - Trigger `mitglied_austragen` (team_members) und `ehemalige_austragen` (training_termine)
  - `delete_account()` anonymisiert
  - Marker `NICHT_MEHR_MITGLIED`

- [ ] **Step 1: Migration schreiben**

```sql
-- ============================================================================
-- Team-Kalender (Epic #321), Story 4 (#325): Wer bereitet vor und leitet?
-- Ein oder mehrere Mitglieder je Termin; die Serie gibt vor, ein Termin kann
-- abweichen (PO 8). Wer austritt, verschwindet aus den anstehenden Terminen
-- und aus den Serien; vergangene Termine behalten den Eintrag — nach einer
-- Konto-Löschung ohne Namen.
-- ============================================================================
set lock_timeout = '5s';

create table termin_verantwortliche (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references training_termine(id) on delete cascade,
  -- NULL: ein gelöschtes Konto (PC 8). Das Anonymisieren erledigt
  -- delete_account() vor dem Löschen; `set null` ist nur der Rückhalt.
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (termin_id, user_id)
);
create index termin_verantwortliche_user_idx on termin_verantwortliche (user_id);

create table termin_serien_verantwortliche (
  serie_id uuid not null references termin_serien(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (serie_id, user_id)
);

alter table training_termine
  add column verantwortliche_abweichend boolean not null default false;

-- Namen immer aktuell (AK 12) — über anzeige_name, nie über profiles direkt.
create function verantwortlich_name(v termin_verantwortliche) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$ select case when v.user_id is null then null else anzeige_name(v.user_id) end $$;

create function verantwortlich_ehemalig(v termin_verantwortliche) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select v.user_id is null or not exists (
    select 1 from team_members m join training_termine t on t.team_id = m.team_id
     where t.id = v.termin_id and m.user_id = v.user_id)
$$;

create function verantwortlich_name(v termin_serien_verantwortliche) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$ select anzeige_name(v.user_id) $$;

grant execute on function verantwortlich_name(termin_verantwortliche) to authenticated;
grant execute on function verantwortlich_ehemalig(termin_verantwortliche) to authenticated;
grant execute on function verantwortlich_name(termin_serien_verantwortliche) to authenticated;

alter table termin_verantwortliche enable row level security;
alter table termin_serien_verantwortliche enable row level security;
create policy tv_select on termin_verantwortliche for select to authenticated
  using (exists (select 1 from training_termine t where t.id = termin_id and ist_team_mitglied(t.team_id)));
create policy tsv_select on termin_serien_verantwortliche for select to authenticated
  using (exists (select 1 from termin_serien s where s.id = serie_id and ist_team_mitglied(s.team_id)));
grant select on termin_verantwortliche, termin_serien_verantwortliche to authenticated;
revoke insert, update, delete, truncate on termin_verantwortliche, termin_serien_verantwortliche from anon, authenticated;
revoke select on termin_verantwortliche, termin_serien_verantwortliche from anon;

-- Nur aktuelle Mitglieder lassen sich NEU eintragen (AK 8, 13).
create function alle_mitglieder(p_team uuid, p_user uuid[]) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select not exists (select 1 from unnest(coalesce(p_user, '{}')) u
                      where not exists (select 1 from team_members m
                                         where m.team_id = p_team and m.user_id = u))
$$;
revoke all on function alle_mitglieder(uuid, uuid[]) from public, anon, authenticated;

-- Einen Termin besetzen — nur dieser (AK 1, 2, 5, 7, 9) -----------------------
-- `p_anonyme`: die Einträge ohne Namen (gelöschte Konten), die bleiben
-- sollen; NULL = alle behalten (KI-Weg ohne Angabe).
create function termin_verantwortliche_setzen(
  p_termin uuid, p_user_ids uuid[], p_anonyme uuid[] default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare t training_termine;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  -- Wer schon eingetragen ist, darf bleiben, auch als ehemaliges Mitglied
  -- (AK 9); NEU eintragen nur aktuelle Mitglieder (AK 8, 13).
  if not alle_mitglieder(t.team_id, array(
       select u from unnest(coalesce(p_user_ids, '{}')) u
        where not exists (select 1 from termin_verantwortliche v where v.termin_id = t.id and v.user_id = u))) then
    raise exception 'NICHT_MEHR_MITGLIED';
  end if;
  delete from termin_verantwortliche v
   where v.termin_id = t.id
     and ((v.user_id is not null and v.user_id <> all(coalesce(p_user_ids, '{}')))
          or (v.user_id is null and p_anonyme is not null and v.id <> all(p_anonyme)));
  insert into termin_verantwortliche (termin_id, user_id)
  select t.id, u from unnest(coalesce(p_user_ids, '{}')) u
  on conflict (termin_id, user_id) do nothing;
  -- PC 2: Ein Serientermin weicht ab, sobald man ihn einzeln besetzt.
  if t.serie_id is not null then
    update training_termine set verantwortliche_abweichend = true where id = t.id;
  end if;
  return jsonb_build_object('team', t.team_id);
end;
$$;
revoke all on function termin_verantwortliche_setzen(uuid, uuid[], uuid[]) from public, anon;
grant execute on function termin_verantwortliche_setzen(uuid, uuid[], uuid[]) to authenticated;

-- Serie festlegen mit Verantwortlichen (AK 3, PC 1) -------------------------
drop function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text);
create function terminserie_festlegen(
  p_team uuid,
  p_wochentage smallint[],
  p_von date,
  p_bis date,
  p_beginn time,
  p_ende time,
  p_ort text,
  p_bemerkung text,
  p_verantwortliche uuid[] default '{}')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_serie termin_serien;
  v_anzahl integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if not wochentage_gueltig(p_wochentage) then raise exception 'SERIE_WOCHENTAGE'; end if;
  if p_bis < p_von then raise exception 'SERIE_ENDE_VOR_BEGINN'; end if;
  if p_bis > (p_von + interval '1 year')::date then raise exception 'SERIE_ZU_LANG'; end if;
  if p_beginn is null or p_ende is null or p_ende <= p_beginn then raise exception 'SERIE_ZEIT'; end if;
  if not alle_mitglieder(p_team, p_verantwortliche) then raise exception 'NICHT_MEHR_MITGLIED'; end if;

  insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung)
  values (p_team, (select array_agg(w order by w) from unnest(p_wochentage) w),
          p_von, p_bis, p_beginn, p_ende, nullif(btrim(p_ort), ''), nullif(btrim(p_bemerkung), ''))
  returning * into v_serie;
  insert into termin_serien_verantwortliche (serie_id, user_id)
  select v_serie.id, u from unnest(coalesce(p_verantwortliche, '{}')) u on conflict do nothing;

  with neu as (
    insert into training_termine (team_id, serie_id, serien_tag, datum, beginn, ende, ort, bemerkung)
    select p_team, v_serie.id, d, d, v_serie.beginn, v_serie.ende, v_serie.ort, v_serie.bemerkung
      from serien_tage(v_serie.wochentage, v_serie.beginn_datum, v_serie.end_datum) d
    returning id),
  besetzt as (
    insert into termin_verantwortliche (termin_id, user_id)
    select n.id, u from neu n cross join unnest(coalesce(p_verantwortliche, '{}')) u
    returning 1)
  select count(*) into v_anzahl from neu;
  if v_anzahl = 0 then raise exception 'SERIE_OHNE_TAG'; end if;
  return jsonb_build_object('serie', v_serie.id, 'termine', v_anzahl);
end;
$$;
revoke all on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[]) from public, anon;
grant execute on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[]) to authenticated;

-- Wieder der Serie folgen, auch mit den Verantwortlichen (AK 6) --------------
create or replace function termin_der_serie_folgen(p_termin uuid, p_angaben text[])
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  s termin_serien;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if 'datum' = any(p_angaben) then raise exception 'DATUM_FOLGT_NICHT'; end if;
  select * into s from termin_serien where id = t.serie_id;
  update training_termine set
    beginn = case when 'zeit' = any(p_angaben) then s.beginn else beginn end,
    ende = case when 'zeit' = any(p_angaben) then s.ende else ende end,
    zeit_abweichend = zeit_abweichend and not ('zeit' = any(p_angaben)),
    ort = case when 'ort' = any(p_angaben) then s.ort else ort end,
    ort_abweichend = ort_abweichend and not ('ort' = any(p_angaben)),
    bemerkung = case when 'bemerkung' = any(p_angaben) then s.bemerkung else bemerkung end,
    bemerkung_abweichend = bemerkung_abweichend and not ('bemerkung' = any(p_angaben)),
    verantwortliche_abweichend = verantwortliche_abweichend and not ('verantwortliche' = any(p_angaben))
  where id = p_termin;
  if 'verantwortliche' = any(p_angaben) then
    delete from termin_verantwortliche where termin_id = t.id;
    insert into termin_verantwortliche (termin_id, user_id)
    select t.id, sv.user_id from termin_serien_verantwortliche sv where sv.serie_id = s.id;
  end if;
  return jsonb_build_object('team', t.team_id, 'training', t.training_id);
end;
$$;

-- Austreten trägt aus (PC 6, 12): aus allen anstehenden Terminen und aus den
-- Serien des Teams. Ob ein Termin der Serie folgt, ändert das nicht.
create function mitglied_austragen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from termin_verantwortliche v
   using training_termine t
   where v.termin_id = t.id and t.team_id = old.team_id
     and v.user_id = old.user_id and t.datum >= heute_am_trainingsort();
  delete from termin_serien_verantwortliche sv
   using termin_serien s
   where sv.serie_id = s.id and s.team_id = old.team_id and sv.user_id = old.user_id;
  return old;
end;
$$;
create trigger mitglied_austragen after delete on team_members
  for each row execute function mitglied_austragen();

-- PC 13: Wer einen vergangenen Termin auf heute oder später verlegt, trägt
-- ehemalige Mitglieder aus ihm aus — egal über welchen Weg.
create function ehemalige_austragen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if old.datum < heute_am_trainingsort() and new.datum >= heute_am_trainingsort() then
    delete from termin_verantwortliche v
     where v.termin_id = new.id
       and (v.user_id is null or not exists (
             select 1 from team_members m where m.team_id = new.team_id and m.user_id = v.user_id));
  end if;
  return new;
end;
$$;
create trigger ehemalige_austragen after update of datum on training_termine
  for each row execute function ehemalige_austragen();

-- Konto löschen (PC 6, 8): VOR dem Löschen aus allen anstehenden Terminen und
-- Serien austragen und die vergangenen Einträge anonymisieren — auch in
-- Teams, die die Person schon verlassen hat. Der Rest ist unverändert
-- (Migration team_datenmodell).
create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
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
end;
$$;

reset lock_timeout;
```

**Vor dem Schreiben prüfen:** `delete_account()` ist zuletzt in `20260824195749_team_datenmodell.sql:351-380` definiert. Mit `grep -ln "function delete_account" supabase/migrations/*` sicherstellen, dass seither keine spätere Migration den Rumpf geändert hat. Gibt es eine, deren Rumpf übernehmen und nur die drei Zeilen zu den Verantwortlichen voranstellen.

- [ ] **Step 2: `terminserie_rechnen` um Verantwortliche erweitern** — In derselben Migration folgt `create or replace function terminserie_rechnen(...)` mit dem **vollständigen** Rumpf aus der Migration `…_terminserien_aendern.sql` (Task B3), dazu vier Einschübe:

(a) Deklaration: `v_verantwortliche uuid[] := case when p_aenderung ? 'verantwortliche' then array(select u::uuid from jsonb_array_elements_text(p_aenderung->'verantwortliche') u) end;`

(b) Nach `if v_zeit then … raise exception 'SERIE_ZEIT'; end if; end if;`:

```sql
  if v_verantwortliche is not null and not alle_mitglieder(t.team_id, v_verantwortliche) then
    raise exception 'NICHT_MEHR_MITGLIED';
  end if;
```

(c) Im Teilen-Zweig direkt nach `returning id into x;` (PC 4, 11):

```sql
    insert into termin_serien_verantwortliche (serie_id, user_id)
    select x, u from unnest(coalesce(v_verantwortliche,
                     array(select sv.user_id from termin_serien_verantwortliche sv where sv.serie_id = s.id))) u;
```

und im Zweig «alle» nach dem `update termin_serien …`:

```sql
    if v_verantwortliche is not null then
      delete from termin_serien_verantwortliche where serie_id = x;
      insert into termin_serien_verantwortliche (serie_id, user_id) select x, u from unnest(v_verantwortliche) u;
      -- Die Version zählt schon das `update termin_serien` davor hoch (Trigger).
    end if;
```

(d) Nach Schritt 5 (Werte übernehmen), vor Schritt 6 (PC 3):

```sql
  if v_verantwortliche is not null then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not verantwortliche_abweichend or id = p_termin) and datum < v_heute);
    delete from termin_verantwortliche v using training_termine tt
     where v.termin_id = tt.id and tt.serie_id = x and (not tt.verantwortliche_abweichend or tt.id = p_termin);
    insert into termin_verantwortliche (termin_id, user_id)
    select tt.id, u from training_termine tt cross join unnest(v_verantwortliche) u
     where tt.serie_id = x and (not tt.verantwortliche_abweichend or tt.id = p_termin);
    update training_termine set verantwortliche_abweichend = false where id = p_termin;
  end if;
```

(e) Schritt 6 besetzt die neuen Termine mit den Verantwortlichen der Serie. Die CTE `neu` wird ergänzt:

```sql
  with neu as ( … unverändert … returning id, datum),
  besetzt as (
    insert into termin_verantwortliche (termin_id, user_id)
    select n.id, sv.user_id from neu n join termin_serien_verantwortliche sv on sv.serie_id = x
    returning 1)
  select coalesce(array_agg(id) filter (where datum < v_heute), '{}') into v_neu_vergangen from neu;
```

- [ ] **Step 3: `sync-staging.yml`** — `PUBLIC_TABLES`:

```yaml
    PUBLIC_TABLES: "exercise_favorites exercises ki_aufrufe ki_zugang_namen profiles team_members teams termin_serien termin_serien_luecken termin_serien_verantwortliche termin_verantwortliche trainer_suchversuche training_exercise_gruppen training_exercises training_gruppen training_termine training_varianten trainings"
```

- [ ] **Step 4: Anwenden** — `npm run db:reset && npm run gen:types`. Prüfen, dass `select verantwortlich_name` als berechnetes Feld erscheint: `curl "$SUPABASE_URL/rest/v1/termin_verantwortliche?select=id,verantwortlich_name" -H "apikey: $ANON" -H "Authorization: Bearer <e2e-token>"` liefert `[]` statt eines Fehlers.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_termin_verantwortliche.sql .github/workflows/sync-staging.yml web/lib/database.types.ts
git commit -m "feat(kalender): Verantwortliche je Termin und Serie, Austragen und Anonymisieren (#325)"
```

### Task C2: Lesepfad und Fachkern

**Files:**
- Modify: `web/lib/queries/termine-fuer.ts` (`verantwortliche`, `serie.verantwortliche`, Abweichung `"verantwortliche"`, Filter `nurMeine`)
- Modify: `web/lib/queries/teams-fuer.ts` (`getTeamMitgliederFuer`)
- Create: `web/lib/kern/verantwortliche.ts`
- Modify: `web/lib/kern/serien.ts` (`SerienAenderung.verantwortliche`, `SerieFestlegen.verantwortliche`, `FolgeAngabe` + `"verantwortliche"`)
- Modify: `web/lib/kern/team.ts` (`teamPlan({ nurMeine })`)
- Modify: `web/lib/termin.ts` (`TERMIN_MELDUNG.NICHT_MEHR_MITGLIED`)
- Test: `web/scripts/pruefe-kern-db.ts`

**Interfaces:**
- Produces:
  - `type Verantwortlicher = { eintragId: string; userId: string | null; name: string | null; ehemalig: boolean }`
  - `TerminZeile.verantwortliche: Verantwortlicher[]`
  - `TerminSerie.verantwortliche: { userId: string; name: string }[]`
  - `getTeamMitgliederFuer(supabase, teamId) → { userId; anzeigeName }[]`
  - `setzeVerantwortliche(supabase, userId, e: { terminId; userIds: string[]; anonyme?: string[] | null; reichweite?: Reichweite; erwartet?: { version: number; entfallend: string[] }; bestaetigt?: boolean }) → KernErgebnis<{ terminId; teamId; serie: SerienFolge | null }>`
  - `teamMitglieder(supabase, userId, { teamId }) → KernErgebnis<{ mitglieder: { id; anzeigename; ich: boolean }[] }>`
  - `teamPlan(supabase, userId, { teamId; heute?; nurMeine? })`
  - `istVerantwortlich(t: TerminZeile, userId: string): boolean`

- [ ] **Step 1: Failing DB-Test**

```ts
  const { setzeVerantwortliche, teamMitglieder } = await import("../lib/kern/verantwortliche");

  await pruefe("Verantwortliche: eintragen, Serie gibt vor, abweichen, folgen, austreten, Konto löschen (#325)", async () => {
    const team = await serienTeam("Kern-DB-Verantwortliche");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const c = await wegwerfKonto();
    await admin.from("team_members").insert({ team_id: team, user_id: c.id });

    const m = wert(await teamMitglieder(a.supabase, a.id, { teamId: team })).mitglieder;
    assert.equal(m.length, 3);
    assert.equal(m.find((x) => x.id === a.id)!.ich, true);
    assert.ok(m.every((x) => !("email" in x)), "PC 9");

    const w = wochentagVon(heuteCh);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [w], von: tagCh(-14), bis: tagCh(14), beginn: "18:00", ende: "19:30", verantwortliche: [a.id, b.id] }));
    const leute = async (terminId: string) =>
      (await admin.from("termin_verantwortliche").select("user_id").eq("termin_id", terminId)).data!.map((x) => x.user_id).sort();
    let t = await termineDer(s.serieId);
    assert.deepEqual(await leute(t[0].id), [a.id, b.id].sort(), "PC 1");

    // Nur dieser: C statt B (AK 5, PC 2).
    const kuenftig = t.find((x) => x.datum === tagCh(7))!;
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: kuenftig.id, userIds: [c.id], reichweite: "nur_dieser" }));
    // Alle: nur A — der abweichende bleibt bei C (PC 3).
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: t[0].id, userIds: [a.id], reichweite: "alle", bestaetigt: true }));
    assert.deepEqual(await leute(kuenftig.id), [c.id]);
    assert.deepEqual(await leute(t[0].id), [a.id]);
    // AK 21: Hat ein anderes Mitglied die Serie seit der Auswahl geändert → abgewiesen.
    fehler(
      await setzeVerantwortliche(a.supabase, a.id, { terminId: t[0].id, userIds: [b.id], reichweite: "alle", erwartet: { version: 1, entfallend: [] } }),
      "konflikt",
      SERIE_MELDUNG.SERIE_GEAENDERT,
    );
    // AK 20: KI ohne Reichweite am Serientermin → abgewiesen.
    fehler(await setzeVerantwortliche(a.supabase, a.id, { terminId: t[0].id, userIds: [b.id] }), "regel", SERIE_MELDUNG.REICHWEITE_FEHLT);

    // Austritt (PC 6, 12): C verschwindet aus dem anstehenden Termin, der abweichend bleibt.
    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", c.id);
    assert.deepEqual(await leute(kuenftig.id), []);
    assert.equal((await admin.from("training_termine").select("verantwortliche_abweichend").eq("id", kuenftig.id).single()).data!.verantwortliche_abweichend, true);
    // AK 13: ein ehemaliges Mitglied lässt sich nicht neu eintragen.
    fehler(await setzeVerantwortliche(a.supabase, a.id, { terminId: kuenftig.id, userIds: [c.id], reichweite: "nur_dieser" }), "regel", TERMIN_MELDUNG.NICHT_MEHR_MITGLIED);

    // Vergangenes bleibt (PC 7): B an einem vergangenen Termin, dann tritt B aus.
    const vergangen = t.find((x) => x.datum < heuteCh)!;
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: vergangen.id, userIds: [a.id, b.id], reichweite: "nur_dieser" }));
    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", b.id);
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const vb = plan.vergangen.find((x) => x.id === vergangen.id)!.verantwortliche.find((v) => v.userId === b.id)!;
    assert.equal(vb.ehemalig, true);
    assert.ok(vb.name, "mit aktuellem Anzeigenamen");
    // PC 13: Verlegt man ihn auf heute, fällt B heraus.
    wert(await aendereTermin(a.supabase, a.id, { terminId: vergangen.id, datum: heuteCh }));
    assert.deepEqual(await leute(vergangen.id), [a.id]);

    // AK 11, 17: nur die eigenen.
    const meine = wert(await teamPlan(a.supabase, a.id, { teamId: team, nurMeine: true }));
    assert.ok([...meine.kommend, ...meine.vergangen].every((x) => x.verantwortliche.some((v) => v.userId === a.id)));
  });

  await pruefe("Konto löschen anonymisiert vergangene Einträge, auch nach dem Austritt (#325 PC 8)", async () => {
    const team = await serienTeam("Kern-DB-Anonym");
    const d = await wegwerfKonto();
    await admin.from("team_members").insert({ team_id: team, user_id: d.id });
    const alt = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(-3), beginn: "10:00", ende: "11:00" }));
    const neu = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "10:00", ende: "11:00" }));
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: alt.terminId, userIds: [d.id] }));
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: neu.terminId, userIds: [d.id] }));
    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", d.id);   // erst Austritt …
    assert.equal((await d.supabase.rpc("delete_account")).error, null);                     // … dann Konto
    const e = (await admin.from("termin_verantwortliche").select("user_id").eq("termin_id", alt.terminId)).data!;
    assert.deepEqual(e, [{ user_id: null }]);
    const p = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    assert.deepEqual(p.vergangen[0].verantwortliche.map((v) => ({ name: v.name, ehemalig: v.ehemalig })), [{ name: null, ehemalig: true }]);
  });
```

(`wegwerfKonto()` legt ein weiteres Konto an; `aufraeumen()` löscht es über `konten`. `d` ruft `delete_account` selbst auf; danach löscht `aufraeumen()` den Auth-User.)

- [ ] **Step 2: Test laufen lassen** → FAIL (Modul fehlt).

- [ ] **Step 3: Lesepfad** — `termine-fuer.ts`:

```ts
export type Verantwortlicher = {
  eintragId: string;
  /** `null`: ein gelöschtes Konto (#325 PC 8). */
  userId: string | null;
  /** Der aktuelle Anzeigename (AK 12); `null` bei gelöschtem Konto. */
  name: string | null;
  /** Nicht mehr im Team (oder Konto gelöscht). */
  ehemalig: boolean;
};

/** Ist dieses Konto für den Termin verantwortlich? (AK 11) */
export function istVerantwortlich(t: TerminZeile, userId: string): boolean {
  return t.verantwortliche.some((v) => v.userId === userId);
}
```

`Abweichung` um `"verantwortliche"` ergänzen. `TerminSerie` um `verantwortliche: { userId: string; name: string }[]` ergänzen. Den `TERMIN_SELECT` erweitern:
- `verantwortliche_abweichend`
- `termin_verantwortliche ( id, user_id, verantwortlich_name, verantwortlich_ehemalig )`
- im Serien-Embed `termin_serien_verantwortliche ( user_id, verantwortlich_name )`

Das Mapping sortiert nach Name (`localeCompare("de")`, anonyme zuletzt). Abweichung `"verantwortliche"` gilt, wenn `verantwortliche_abweichend`. In `lib/queries/termine.ts` `type Verantwortlicher` und `istVerantwortlich` mit re-exportieren. `getTeamPlanFuer` erhält einen dritten Parameter `f: { nurMeine?: string } = {}` (die userId); ist er gesetzt, filtert es nach dem Mapping mit `istVerantwortlich`.

`teams-fuer.ts`:

```ts
/** Die Mitglieder eines Teams mit Anzeigename, ohne E-Mail (Story 1 NFR 4,
 *  #325 PC 9) — dieselbe RPC wie der Team-Bereich (`getTeam`). */
export async function getTeamMitgliederFuer(
  supabase: SupabaseClient,
  teamId: string,
): Promise<{ userId: string; anzeigeName: string }[]> {
  const { data, error } = await supabase.rpc("team_mitglieder", { p_team: teamId });
  if (error) throw error;
  return ((data ?? []) as { user_id: string; anzeige_name: string }[]).map((m) => ({ userId: m.user_id, anzeigeName: m.anzeige_name }));
}
```

`lib/kern/team.ts` `teamPlan`: Den Parameter `nurMeine?: boolean` durchreichen als `getTeamPlanFuer(supabase, e.teamId, { nurMeine: e.nurMeine ? userId : undefined })`; dafür `_userId` in `userId` umbenennen.

- [ ] **Step 4: `web/lib/kern/verantwortliche.ts`**

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SERIE_MELDUNG, type Reichweite } from "@/lib/serie";
import { getTeamMitgliederFuer } from "@/lib/queries/teams-fuer";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { kalenderFehler, ladeTermin } from "@/lib/kern/termine";
import { aendereSerie, type SerienFolge } from "@/lib/kern/serien";
import { fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";

/**
 * Verantwortliche je Termin und Serie (#325). Einzeln über
 * termin_verantwortliche_setzen, für folgende und alle über die
 * Serienrechnung (terminserie_rechnen, Schlüssel «verantwortliche») — dort
 * teilt «dieser und folgende» die Serie wie jede andere Änderung (PC 11).
 */

export async function teamMitglieder(
  supabase: SupabaseClient,
  userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<{ mitglieder: { id: string; anzeigename: string; ich: boolean }[] }>> {
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  try {
    const m = await getTeamMitgliederFuer(supabase, e.teamId);
    return ok({ mitglieder: m.map((x) => ({ id: x.userId, anzeigename: x.anzeigeName, ich: x.userId === userId })) });
  } catch (err) {
    console.error("[kern] teamMitglieder:", err instanceof Error ? err.message : err);
    return fehlschlag("technisch", "Das Team liess sich gerade nicht lesen. Bitte versuche es noch einmal.", { wiederholbar: true });
  }
}

export async function setzeVerantwortliche(
  supabase: SupabaseClient,
  userId: string,
  e: {
    terminId: string;
    userIds: string[];
    /** Einträge ohne Namen, die bleiben; `null`/fehlend = alle behalten. */
    anonyme?: string[] | null;
    reichweite?: Reichweite;
    erwartet?: { version: number; entfallend: string[] };
    bestaetigt?: boolean;
  },
): Promise<KernErgebnis<{ terminId: string; teamId: string; serie: SerienFolge | null }>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  const userIds = [...new Set(e.userIds)];

  if (t.serie_id && !e.reichweite)
    return fehlschlag("regel", SERIE_MELDUNG.REICHWEITE_FEHLT, {
      feld: "reichweite",
      zulaessig: ["nur_dieser", "dieser_und_folgende", "alle"],
    });
  if (!t.serie_id && e.reichweite && e.reichweite !== "nur_dieser")
    return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, { feld: "reichweite" });

  if (!t.serie_id || e.reichweite === "nur_dieser") {
    const { error } = await supabase.rpc("termin_verantwortliche_setzen", {
      p_termin: t.id,
      p_user_ids: userIds,
      p_anonyme: e.anonyme ?? null,
    });
    if (error) return kalenderFehler(error);
    return ok({ terminId: t.id, teamId: t.team_id, serie: null });
  }
  const r = await aendereSerie(supabase, userId, {
    terminId: t.id,
    reichweite: e.reichweite!,
    aenderung: { verantwortliche: userIds },
    erwartet: e.erwartet,
    bestaetigt: e.bestaetigt,
  });
  return r.ok ? ok({ terminId: t.id, teamId: r.wert.teamId, serie: r.wert }) : r;
}
```

`lib/kern/serien.ts`:
- `SerienAenderung` um `verantwortliche?: string[]` ergänzen. Die Leer-Prüfung zählt es mit, und `aenderung.verantwortliche = a.verantwortliche` wird gesetzt.
- `SerieFestlegen` erhält `verantwortliche?: string[]`, der RPC-Aufruf `p_verantwortliche: e.verantwortliche ?? []`.
- `FolgeAngabe` wird zu `"zeit" | "ort" | "bemerkung" | "verantwortliche"`.
- `lib/termin.ts` `TERMIN_MELDUNG` erhält `NICHT_MEHR_MITGLIED: "Mindestens eine gewählte Person ist nicht mehr Mitglied des Teams. Sieh dir die Mitglieder noch einmal an."`.

- [ ] **Step 5: Tests** — `npm run check:kern-db && npm run check:kern` → grün.

- [ ] **Step 6: Commit**

```bash
git add web/lib web/scripts/pruefe-kern-db.ts
git commit -m "feat(kalender): Verantwortliche im Fachkern und Lesepfad (#325)"
```

### Task C3: KI-Werkzeuge

**Files:** `web/lib/mcp/werkzeuge/team.ts`, `web/lib/mcp/server.ts`, `web/lib/mcp/umfang.ts`, `web/lib/kern/auskunft-schema.ts`, `web/lib/kern/auskunft.ts`, `web/scripts/pruefe-kern.ts`

- [ ] **Step 1: Failing test** — `jeStory` erhält `"#325": ["team_mitglieder_abrufen", "termin_verantwortliche_setzen"]`.

- [ ] **Step 2: Werkzeuge**

```ts
const Verantwortlich = z.object({
  id: z.string().nullable().describe("Kennung des Mitglieds; null bei einem gelöschten Konto."),
  anzeigename: z.string().nullable(),
  ehemalig: z.boolean().describe("Nicht mehr im Team."),
});

export const teamMitgliederAbrufen = werkzeug({
  name: "team_mitglieder_abrufen",
  titel: "Mitglieder eines Teams",
  beschreibung:
    "Nennt die Mitglieder eines deiner Teams mit Anzeigename und Kennung — ohne E-Mail-Adresse. " +
    "«ich» markiert dich selbst. Die Kennungen brauchst du für «verantwortliche» in " +
    `«termin_verantwortliche_setzen» und «terminserie_festlegen». ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: z.object({ mitglieder: z.array(z.object({ id: z.string(), anzeigename: z.string(), ich: z.boolean() })) }),
  ausfuehren: async (e, zugang) => teamMitglieder(zugang.supabase, zugang.userId, { teamId: e.team_id }),
});

export const terminVerantwortlicheSetzen = werkzeug({
  name: "termin_verantwortliche_setzen",
  titel: "Verantwortliche eines Termins setzen",
  beschreibung:
    "Setzt die Mitglieder, die einen Termin vorbereiten und leiten — ein oder mehrere, oder keine " +
    "(leere Liste). Neu eintragen lassen sich nur aktuelle Mitglieder; Einträge ehemaliger " +
    "Mitglieder an vergangenen Terminen bleiben, wenn du sie mitgibst. Einträge gelöschter Konten " +
    "(ohne Kennung) bleiben, ausser «ohne_namen_behalten» ist false. Für einen Termin einer Serie " +
    "ist «reichweite» Pflicht; «dieser_und_folgende» teilt die Serie, die neue Serie trägt die " +
    `neuen Verantwortlichen. ${SERIEN_MODELL} ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    termin_id: TerminId,
    verantwortliche: z.array(kennung("Kennung eines Mitglieds aus «team_mitglieder_abrufen».")),
    ohne_namen_behalten: z.boolean().optional(),
    reichweite: Reichweite.optional(),
    bestaetigt: Bestaetigt,
  }),
  ausgabe: z.object({ termin_id: z.string(), serie_id: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeVerantwortliche(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        userIds: e.verantwortliche,
        anonyme: e.ohne_namen_behalten === false ? [] : null,
        reichweite: e.reichweite,
        bestaetigt: e.bestaetigt,
      }),
      (w) => ({ termin_id: w.terminId, serie_id: w.serie?.serieId ?? null }),
    ),
});
```

(`kennung` aus `@/lib/mcp/bausteine` importieren.)

- `terminserie_festlegen` erhält `verantwortliche: z.array(kennung(…)).optional()`.
- `termin_der_serie_folgen`: `angaben` um `"verantwortliche"` ergänzen.
- `team_plan_abrufen`:
  - Eingabe `nur_meine: z.boolean().optional().describe("Nur Termine, für die du verantwortlich bist.")`
  - `PlanEintrag` erhält `verantwortliche: z.array(Verantwortlich)`; `abweichungen` erhält `"verantwortliche"`
  - `serien[]` erhält `verantwortliche: z.array(z.object({ id, anzeigename }))`
  - Beschreibung: «… Jeder Eintrag nennt seine Verantwortlichen; «nur_meine» grenzt auf deine ein.»
- Auskunft: Das `termin`-Objekt von `training_abrufen` und `trainings_suchen` erhält `verantwortliche: z.array(obj({ id: z.string().nullable(), anzeigename: z.string().nullable(), ehemalig: z.boolean() }))` (#325 AK 16). Der Suchtreffer liest `termin_verantwortliche ( user_id, verantwortlich_name, verantwortlich_ehemalig )` im `TEAM_LIST_SELECT` mit. Den Fall in `pruefe-kern.ts` um `verantwortliche: []` ergänzen.

`umfang.ts` Zeile 16:

```ts
  "Team-Trainings deiner Teams führen und im Kalender deiner Teams Termine und Terminserien festlegen, ändern und entfernen, ihnen Trainings zuordnen und Verantwortliche eintragen",
  "die Anzeigenamen der Mitglieder deiner Teams lesen (ohne E-Mail-Adressen)",
```

`server.ts`: `teamMitgliederAbrufen` hinter `teamPlanAbrufen` registrieren, `terminVerantwortlicheSetzen` hinter `terminDerSerieFolgen`.

- [ ] **Step 3: Tests und Commit**

Run: `npm run check:kern && npm run typecheck`

```bash
git add web/lib web/scripts/pruefe-kern.ts
git commit -m "feat(ki): Verantwortliche und Team-Mitglieder über den KI-Assistenten (#325)"
```

### Task C4: Oberfläche

**Files:**
- Create: `web/components/team/VerantwortlicheWahl.tsx`
- Create: `web/components/team/NurMeineFilter.tsx`
- Modify: `TerminDialog.tsx`, `SerieDialog.tsx`, `TerminBereich.tsx`, `TrainingsPlan.tsx`, `app/team/[id]/page.tsx`, `TrainingDurchfuehren.tsx`, `durchfuehren/page.tsx`
- Modify: `web/lib/actions/termine.ts` (`setzeVerantwortlicheAktion`; `legeSerieFestAktion` mit Verantwortlichen)

**Interfaces:**
- Consumes: C2 (`Verantwortlicher`, `istVerantwortlich`), `getTeam(id).mitglieder` (`TeamMitglied = { userId; anzeigeName }`).
- Produces: `VerantwortlicheWahl({ mitglieder, wert: Verantwortlicher[] | string[], onChange })`, `NurMeineFilter({ aktiv, href })`.

- [ ] **Step 1: `VerantwortlicheWahl.tsx`** (AK 1, 2, 7, 9)

```tsx
"use client";

import { MultiSelect } from "@/components/ui";
import type { TeamMitglied } from "@/lib/queries/teams";
import type { Verantwortlicher } from "@/lib/queries/termine";

/* Verantwortliche eines Termins oder einer Serie (#325). Zur Wahl stehen die
   aktuellen Mitglieder; Einträge ehemaliger Mitglieder an einem Termin
   bleiben wählbar, damit man sie entfernen kann (AK 9), lassen sich aber
   nicht neu hinzufügen (AK 8). Gleichnamige unterscheidet die Anwendung nicht
   (OoS 4). */
export type VerantwortlicheWert = { userIds: string[]; anonyme: string[] };

export function VerantwortlicheWahl({
  mitglieder,
  bisher = [],
  wert,
  onChange,
}: {
  mitglieder: TeamMitglied[];
  bisher?: Verantwortlicher[];
  wert: VerantwortlicheWert;
  onChange: (w: VerantwortlicheWert) => void;
}) {
  const ehemalige = bisher.filter((v) => v.ehemalig);
  const options = [
    ...mitglieder.map((m) => ({ value: `u:${m.userId}`, label: m.anzeigeName })),
    ...ehemalige.map((v) => ({
      value: v.userId ? `u:${v.userId}` : `a:${v.eintragId}`,
      label: v.name ? `${v.name} (nicht mehr im Team)` : "Ehemaliges Mitglied",
      group: "Ehemalige",
    })),
  ];
  const value = [...wert.userIds.map((u) => `u:${u}`), ...wert.anonyme.map((a) => `a:${a}`)];
  return (
    <MultiSelect
      label="Verantwortlich (optional)"
      options={options}
      value={value}
      onChange={(vs) =>
        onChange({
          userIds: vs.filter((v) => v.startsWith("u:")).map((v) => v.slice(2)),
          anonyme: vs.filter((v) => v.startsWith("a:")).map((v) => v.slice(2)),
        })
      }
    />
  );
}
```

Ehemalige ohne bisherigen Eintrag erscheinen nicht, also kann man sie nicht neu wählen. Einmal abgewählt, verschwinden sie beim nächsten Öffnen aus der Liste.

- [ ] **Step 2: Dialoge**
  - `TerminDialog`: Props `mitglieder: TeamMitglied[]` und `verantwortliche?: Verantwortlicher[]`; State `verantwortlich: VerantwortlicheWert` (Start aus `verantwortliche`). Das Feld steht nach der Bemerkung.
  - `onSpeichern(felder, regel?, verantwortlich?)` erhält als dritten Parameter den `VerantwortlicheWert`, aber nur, wenn er sich geändert hat.
  - Im Serien-Abschnitt steht `abweichungen.includes("verantwortliche")` als Zeile «Verantwortliche weichen von der Serie ab.» mit «Der Serie folgen».
  - `SerieDialog`: `VerantwortlicheWahl` ohne `bisher`; `SerieFelder.verantwortliche: string[]`.

- [ ] **Step 3: Actions**

```ts
export async function setzeVerantwortlicheAktion(
  terminId: string,
  wert: { userIds: string[]; anonyme: string[] },
  reichweite: Reichweite | undefined,
  erwartet?: { version: number; entfallend: string[] },
): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await setzeVerantwortliche(a.supabase, a.userId, { terminId, userIds: wert.userIds, anonyme: wert.anonyme, reichweite, erwartet });
  if (!r.ok) return { ok: false, error: r.meldung };
  revalidiereTeam(r.wert.teamId);
  return { ok: true };
}
```

- [ ] **Step 4: Abläufe in `TerminBereich`**
  - `aenderungErmitteln` zählt geänderte Verantwortliche als Angabe mit Reichweite: `aenderung.verantwortliche = verantwortlich.userIds`. Die Vorschau und Ausführung aus B7 tragen sie damit mit (AK 4, PC 3, 11).
  - «Nur dieser»: `aendereTerminAktion` läuft nur, wenn sich Termin-Felder geändert haben. `setzeVerantwortlicheAktion(t.id, wert, t.serie ? "nur_dieser" : undefined)` läuft nur, wenn sich die Verantwortlichen geändert haben. Die Aufrufe laufen nacheinander; scheitert der erste, bleibt der Dialog mit der Meldung offen.
  - Mit dem KI-Weg gleich: Die Anwendung prüft über die Serienversion, dass seit der Auswahl niemand die Serie geändert hat (AK 21).
  - `TerminBereich` erhält `mitglieder: TeamMitglied[]` und `ich: string` als Props. Die Seite lädt `getTeam(id)` (gecacht; das Layout ruft es ohnehin) und `supabase.auth.getUser()`.

- [ ] **Step 5: Anzeigen und Eingrenzen**
  - `TerminKarte` zeigt unter dem Kopf eine Zeile `<p className="flex items-center gap-1 type-body-small text-on-surface-mittel"><Users size={14} aria-hidden /><span className="sr-only">Verantwortlich: </span>{namen}</p>`.
  - `namen` ist `t.verantwortliche.map((v) => v.name ?? "Ehemaliges Mitglied").join(", ")` (AK 10, 12). Ohne Verantwortliche steht nichts (OoS 2: kein Befund).
  - `NurMeineFilter` ist ein `FilterChip`-artiger Link. Damit bleibt die Eingrenzung Teil der Adresse (für Teil F, PC 4):

```tsx
import Link from "next/link";
import { UserCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { chipBase, chipHoehen } from "@/components/ui/Chip";

/** Den Trainingsplan auf die eigenen Termine eingrenzen (#325 AK 11). Ein
 *  Link statt Zustand: Die Eingrenzung überlebt den Wechsel zwischen Liste
 *  und Monatsüberblick (#329 PC 4) und fällt beim erneuten Öffnen des Teams
 *  weg, weil dessen Adresse sie nicht trägt. */
export function NurMeineFilter({ aktiv, href }: { aktiv: boolean; href: string }) {
  return (
    <Link href={href} aria-pressed={aktiv} className={cn(chipBase, chipHoehen.normal, aktiv && "bg-elev-08 text-on-surface")}>
      <UserCheck size={16} aria-hidden /> Meine Termine
    </Link>
  );
}
```

(`chipBase`/`chipHoehen` sind in `Chip.tsx` modulintern. Sie mit `export` versehen und die Begründung im Styleguide-Abschnitt 09 festhalten: «Ein Filter-Chip als Link, wenn die Auswahl in der Adresse steht».)

  - `page.tsx` liest `searchParams.meine === "1"` und lädt `getTeamPlan(id, meine ? user.id : undefined)`. Den Cookie-Wrapper entsprechend erweitern. Den Chip rendert es mit `href={meine ? \`/team/${id}\` : \`/team/${id}?meine=1\`}`. PC 6 von Story 6 zählt ausgefallene Termine in der Eingrenzung mit; das ergibt sich von selbst.
  - Durchführen: `TerminKontext` erhält `verantwortliche: string[]` (Namen); `TerminKopf` zeigt sie mit `Users`-Icon (AK 10).

- [ ] **Step 6: Typecheck, Commit**

```bash
git add web/components web/lib/actions/termine.ts web/app
git commit -m "feat(kalender): Verantwortliche eintragen, anzeigen und eigene Termine eingrenzen (#325)"
```

### Task C5: End-to-End und PR

- [ ] Browser:
  1. Zweites Konto per Admin-API ins Team aufnehmen.
  2. Serie mit beiden als Verantwortliche festlegen.
  3. Einen Termin nur für sich besetzen → «Verantwortliche weichen ab» → «Der Serie folgen».
  4. «Meine Termine» filtert.
  5. Das zweite Konto aus dem Team entfernen: Anstehende Termine nennen es nicht mehr; vergangene nennen es mit Namen.
  6. KI: `team_mitglieder_abrufen`, `termin_verantwortliche_setzen` mit «alle» ohne `bestaetigt` → Regel, `team_plan_abrufen` mit `nur_meine`.
- [ ] PR «feat(kalender): Verantwortliche (#325)».

---

## Teil D — Termin ausfallen lassen und Ausfall zurücknehmen (Story #327, PR 4)

### Task D1: Migration

**Files:** Create `supabase/migrations/<zeitstempel>_termin_ausfall.sql`

- [ ] **Step 1: Migration**

```sql
-- ============================================================================
-- Team-Kalender (Epic #321), Story 6 (#327): Ein Termin fällt aus wie ein
-- abgesagter Kalendereintrag. Der Ausfall löst das Training (PC 1), trägt
-- einen freiwilligen Grund und ist keine Abweichung von der Serie (PC 8).
-- ============================================================================
set lock_timeout = '5s';

alter table training_termine
  add column ausgefallen boolean not null default false,
  add column ausfall_grund text,
  add constraint tt_ausfall_ohne_training check (not ausgefallen or training_id is null),
  add constraint tt_ausfall_grund check (
    ausfall_grund is null or (ausgefallen and char_length(ausfall_grund) <= 500));

-- AK 9: Einem ausgefallenen Termin lässt sich auf keinem Weg ein Training
-- zuordnen. Rumpf wie in termine_ohne_training, ergänzt um die Prüfung.
create or replace function termin_training_setzen(
  p_termin uuid,
  p_training uuid,
  p_verschieben boolean default false,
  p_erwartet jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_termin training_termine;
  v_alt training_termine;
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_termin from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(v_termin.team_id) then
    raise exception 'TERMIN_NICHT_GEFUNDEN';
  end if;
  if p_erwartet is not null
     and v_termin.training_id is distinct from (p_erwartet->>'termin_training')::uuid then
    raise exception 'TERMIN_BELEGUNG_GEAENDERT';
  end if;
  if p_training is null then
    update training_termine set training_id = null where id = p_termin;
    return jsonb_build_object('bisher', v_termin.training_id, 'frei', null);
  end if;
  if v_termin.ausgefallen then raise exception 'TERMIN_AUSGEFALLEN'; end if;

  select team_id into v_team from trainings where id = p_training for update;
  if not found then raise exception 'TRAINING_NICHT_GEFUNDEN'; end if;
  if v_team is distinct from v_termin.team_id then
    raise exception 'TERMIN_TRAINING_FREMDES_TEAM';
  end if;
  if v_termin.training_id = p_training then
    return jsonb_build_object('bisher', null, 'frei', null);
  end if;
  select * into v_alt from training_termine where training_id = p_training for update;
  if p_erwartet is not null
     and v_alt.id is distinct from (p_erwartet->>'training_termin')::uuid then
    raise exception 'TRAINING_EINPLANUNG_GEAENDERT';
  end if;
  if v_alt.id is not null then
    if not p_verschieben then raise exception 'TRAINING_SCHON_EINGEPLANT'; end if;
    if v_alt.datum < heute_am_trainingsort() then
      raise exception 'NUR_KOPIE_BEI_VERGANGENEM';
    end if;
    update training_termine set training_id = null where id = v_alt.id;
  end if;
  update training_termine set training_id = p_training where id = p_termin;
  return jsonb_build_object('bisher', v_termin.training_id, 'frei', v_alt.id);
end;
$$;

reset lock_timeout;
```

- [ ] **Step 2: Anwenden** — `npm run db:reset && npm run gen:types`
- [ ] **Step 3: Commit** — `git commit -m "feat(kalender): Ausfall eines Termins in der Datenebene (#327)"`

### Task D2: Regeln, Fachkern, Lesepfad

**Files:**
- Modify: `web/lib/termin.ts`
  - `TERMIN_MELDUNG.TERMIN_AUSGEFALLEN`
  - `TERMIN_TEXT.grundLang`
  - `ausfallProblem`
  - `NICHT_AUSGEFALLEN`
- Modify: `web/lib/kern/termine.ts`
  - `TERMIN_ROH` + `ausgefallen, ausfall_grund`
  - neu `lasseAusfallen`, `nimmAusfallZurueck`
  - `aendereTermin` beendet den Ausfall
  - `ordneTrainingZu` prüft vorab
- Modify: `web/lib/queries/termine-fuer.ts`
  - `ausgefallen`, `ausfallGrund`
  - `nochNichtVorbereitet`
- Test: `web/scripts/pruefe-kern.ts`, `web/scripts/pruefe-kern-db.ts`

**Interfaces:**
- Produces:
  - `lasseAusfallen(supabase, userId, e: { terminId; grund?: string|null; erwartetesTraining?: string|null }) → KernErgebnis<{ terminId; teamId; geloestesTraining: string|null }>`
  - `nimmAusfallZurueck(supabase, userId, { terminId }) → KernErgebnis<{ terminId; teamId }>`
  - `TerminZeile.ausgefallen: boolean`, `TerminZeile.ausfallGrund: string|null`

- [ ] **Step 1: Failing tests** — rein (`pruefe-kern.ts`):

```ts
pruefe("Ausfall: Grund mit den Regeln der Bemerkung; nicht vorbereitet schliesst Ausfälle aus (#327)", () => {
  assert.equal(ausfallProblem(null), null);
  assert.equal(ausfallProblem("Platz gesperrt"), null);
  assert.deepEqual(ausfallProblem("x".repeat(501)), { feld: "grund", text: TERMIN_TEXT.grundLang });
  const t = { id: "t", teamId: "x", datum: "2026-10-07", beginn: "18:00", ende: "19:30", ort: null, bemerkung: null,
    training: null, serie: null, serienTag: null, abweichungen: [], verantwortliche: [], ausgefallen: true, ausfallGrund: null };
  assert.equal(nochNichtVorbereitet(t, "2026-10-01"), false, "AK 8");
});
```

DB (`pruefe-kern-db.ts`):

```ts
  const { lasseAusfallen, nimmAusfallZurueck } = await import("../lib/kern/termine");
  await pruefe("Ausfall: markieren löst das Training, Grund, zurücknehmen, verlegen, Konflikt (#327)", async () => {
    const team = await serienTeam("Kern-DB-Ausfall");
    const tr = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Ausfall", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const t = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30", bemerkung: "Leibchen" }));
    wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t.terminId, trainingId: tr.id }));
    // AK 11: Wer den Termin ohne Training sah, wird abgewiesen.
    fehler(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, erwartetesTraining: null }), "konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);
    const r = wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Platz gesperrt", erwartetesTraining: tr.id }));
    assert.equal(r.geloestesTraining, tr.id, "PC 1");
    const zeile = async () => (await admin.from("training_termine").select("ausgefallen, ausfall_grund, training_id, bemerkung").eq("id", t.terminId).single()).data!;
    assert.deepEqual(await zeile(), { ausgefallen: true, ausfall_grund: "Platz gesperrt", training_id: null, bemerkung: "Leibchen" });
    // AK 9: kein Training auf einen ausgefallenen Termin.
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: t.terminId, trainingId: tr.id }), "regel", TERMIN_MELDUNG.TERMIN_AUSGEFALLEN);
    // AK 3: Grund ändern und leeren, ohne den Ausfall zurückzunehmen.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: null }));
    assert.equal((await zeile()).ausfall_grund, null);
    // PC 3: zurücknehmen → normal, ohne Training, ohne Grund.
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t.terminId }));
    assert.deepEqual(await zeile(), { ausgefallen: false, ausfall_grund: null, training_id: null, bemerkung: "Leibchen" });
    // PC 4/5: Einzeln auf heute oder später verlegt endet der Ausfall, auf gestern nicht.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Regen" }));
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, datum: tagCh(-1) }));
    assert.equal((await zeile()).ausgefallen, true);
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, datum: tagCh(4) }));
    assert.equal((await zeile()).ausgefallen, false);
  });
```

- [ ] **Step 2: Umsetzen**

`lib/termin.ts`:

```ts
// in TERMIN_TEXT:
  grundLang: `Der Grund darf höchstens ${BEMERKUNG_MAX} Zeichen lang sein.`,
// in TERMIN_MELDUNG:
  TERMIN_AUSGEFALLEN: "Einem ausgefallenen Termin lässt sich kein Training zuordnen. Nimm den Ausfall zuerst zurück.",
  NICHT_AUSGEFALLEN: "Dieser Termin ist nicht ausgefallen.",

/** Der Grund eines Ausfalls folgt den Regeln der Bemerkung (#327 AK 4). */
export function ausfallProblem(grund: string | null | undefined): { feld: "grund"; text: string } | null {
  return (leerZuNull(grund) ?? "").length > BEMERKUNG_MAX ? { feld: "grund", text: TERMIN_TEXT.grundLang } : null;
}
```

`lib/kern/termine.ts`:

```ts
/** Einen Termin als ausgefallen markieren oder den Grund eines ausgefallenen
 *  ändern (#327 AK 1–5, 11; PC 1, 2). Ein zugeordnetes Training wird gelöst
 *  und bleibt ohne Termin im Team-Bestand. */
export async function lasseAusfallen(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; grund?: string | null; erwartetesTraining?: string | null },
): Promise<KernErgebnis<{ terminId: string; teamId: string; geloestesTraining: string | null }>> {
  const p = ausfallProblem(e.grund);
  if (p) return fehlschlag("eingabe", p.text, { feld: p.feld });
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  const erwartet = e.erwartetesTraining !== undefined ? e.erwartetesTraining : t.training_id;
  const basis = supabase
    .from("training_termine")
    .update({ ausgefallen: true, ausfall_grund: leerZuNull(e.grund), training_id: null })
    .eq("id", t.id);
  const { data, error } = await (erwartet === null ? basis.is("training_id", null) : basis.eq("training_id", erwartet))
    .select("id")
    .maybeSingle();
  if (error) return ausDbFehler(error);
  if (!data) return warumNichtGeschrieben(supabase, t.id, e.erwartetesTraining === undefined);
  return ok({ terminId: t.id, teamId: t.team_id, geloestesTraining: erwartet });
}

/** Den Ausfall zurücknehmen (#327 AK 6, PC 3): wieder ein normaler Termin,
 *  ohne Training und ohne Grund. */
export async function nimmAusfallZurueck(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string },
): Promise<KernErgebnis<{ terminId: string; teamId: string }>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  if (!geladen.wert.ausgefallen) return fehlschlag("regel", TERMIN_MELDUNG.NICHT_AUSGEFALLEN, TERMIN_FELD);
  const { error } = await supabase
    .from("training_termine")
    .update({ ausgefallen: false, ausfall_grund: null })
    .eq("id", e.terminId);
  if (error) return ausDbFehler(error);
  return ok({ terminId: e.terminId, teamId: geladen.wert.team_id });
}
```

In `aendereTermin` nach dem Zusammenführen:

```ts
  // PO 6, PC 4: Ein einzeln auf heute oder später verlegter Termin findet
  // wieder statt. Ein Tausch der Serie verlegt nicht einzeln (PC 5).
  const ausfallEndet = t.ausgefallen && neu.datum !== t.datum && neu.datum >= heuteAmTrainingsort();
  … update({ ...neu, ...flags, ...(ausfallEndet ? { ausgefallen: false, ausfall_grund: null } : {}) })
```

`ordneTrainingZu` prüft direkt nach dem Laden des Termins, bevor eine Kopie entsteht: `if (t.ausgefallen) return fehlschlag("regel", TERMIN_MELDUNG.TERMIN_AUSGEFALLEN, TERMIN_FELD);`.

`termine-fuer.ts`: Select `ausgefallen, ausfall_grund`; `TerminZeile` erhält `ausgefallen: boolean; ausfallGrund: string | null;`; `nochNichtVorbereitet` wird zu `t.datum >= heute && t.training === null && !t.ausgefallen`.

- [ ] **Step 3: Tests, Commit** — `npm run check:kern && npm run check:kern-db` → grün.

```bash
git add web/lib web/scripts
git commit -m "feat(kalender): Termin ausfallen lassen und zurücknehmen im Fachkern (#327)"
```

### Task D3: KI-Werkzeuge

- [ ] `jeStory` erhält `"#327": ["termin_ausfallen_lassen", "termin_ausfall_zuruecknehmen"]`.

```ts
export const terminAusfallenLassen = werkzeug({
  name: "termin_ausfallen_lassen",
  titel: "Termin ausfallen lassen",
  beschreibung:
    "Markiert einen Termin als ausgefallen — wie ein abgesagter Kalendereintrag — oder ändert den " +
    "Grund eines schon ausgefallenen («grund»: null leert ihn). Trägt der Termin ein Training, wird " +
    "es gelöst und bleibt ohne Termin im Bestand («geloestes_training»). Ein ausgefallener Termin " +
    "gilt nicht als unvorbereitet und nimmt kein Training an. Einzeln auf heute oder später " +
    `verlegt, findet er wieder statt. ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId, grund: BEMERKUNG.nullable().optional().describe("Grund, frei, höchstens 500 Zeichen.") }),
  ausgabe: z.object({ termin_id: z.string(), geloestes_training: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await lasseAusfallen(zugang.supabase, zugang.userId, { terminId: e.termin_id, grund: e.grund }), (w) => ({
      termin_id: w.terminId,
      geloestes_training: w.geloestesTraining,
    })),
});

export const terminAusfallZuruecknehmen = werkzeug({
  name: "termin_ausfall_zuruecknehmen",
  titel: "Ausfall zurücknehmen",
  beschreibung:
    "Nimmt den Ausfall eines Termins zurück: Er ist danach wieder ein normaler Termin, ohne Training " +
    `und ohne Grund; ein früher gelöstes Training ordnet KiFu nicht wieder zu. ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId }),
  ausgabe: z.object({ termin_id: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await nimmAusfallZurueck(zugang.supabase, zugang.userId, { terminId: e.termin_id }), (w) => ({ termin_id: w.terminId })),
});
```

- `PlanEintrag`: `ausgefallen: z.boolean()`, `ausfall_grund: z.string().nullable()`.
- Auskunft-`termin`: `ausgefallen: z.boolean()`, `ausfall_grund: z.string().nullable()`. Bei einem Training immer `false`/`null`, weil ein ausgefallener Termin kein Training trägt; so steht es in jeder Auskunft (AK 13).
- Den Satz «ausgefallene Termine stehen mit «ausgefallen: true» und Grund im Plan» in die Beschreibung von `team_plan_abrufen` aufnehmen.
- `TERMIN_MODELL`: Den letzten Satz ersetzen durch «Ein Termin kann ausfallen (mit freiwilligem Grund); «hat stattgefunden» kennt KiFu nicht.» (PC 10).
- `umfang.ts`: `…, ihnen Trainings zuordnen, Verantwortliche eintragen und Ausfälle festhalten und zurücknehmen` (PC 11).
- Commit: `git commit -m "feat(ki): Ausfall über den KI-Assistenten (#327)"`

### Task D4: Oberfläche

**Files:**
- Create: `web/components/team/AusfallDialog.tsx`
- Modify: `TerminBereich.tsx`, `TrainingsPlan.tsx`, `TrainingWahlDialog.tsx`, `TerminWahlDialog.tsx`, `lib/actions/termine.ts`

- [ ] **Step 1: Actions** — `lasseAusfallenAktion(terminId, grund, erwartetesTraining)` und `nimmAusfallZurueckAktion(terminId)` nach dem Muster von `entferneTerminAktion`. `revalidiereTeam`, und für das gelöste Training `revalidiereTraining`.

- [ ] **Step 2: `AusfallDialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, TextArea } from "@/components/ui";
import { BEMERKUNG_MAX, ausfallProblem } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
import type { TerminZeile } from "@/lib/queries/termine";

/* Einen Termin ausfallen lassen oder den Grund ändern (#327 AK 1–3). Die
   Anwendung kündigt nicht an, dass das Training gelöst wird (OoS 2). */
export function AusfallDialog({
  termin,
  pending,
  onClose,
  onSpeichern,
}: {
  termin: TerminZeile | null;
  pending?: boolean;
  onClose: () => void;
  onSpeichern: (grund: string) => void;
}) {
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string>();
  useEffect(() => { setGrund(termin?.ausfallGrund ?? ""); setFehler(undefined); }, [termin]);
  return (
    <Dialog
      open={termin !== null}
      onClose={onClose}
      title={termin?.ausgefallen ? "Grund des Ausfalls" : "Termin ausfallen lassen"}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button
            variant="filled"
            disabled={pending}
            onClick={() => { const p = ausfallProblem(grund); setFehler(p?.text); if (!p) onSpeichern(grund); }}
          >
            {termin?.ausgefallen ? "Speichern" : "Ausfallen lassen"}
          </Button>
        </>
      }
    >
      <p className="mb-3">{termin ? datumKurz(termin.datum) : ""}</p>
      <TextArea label="Grund (optional)" rows={3} maxLength={BEMERKUNG_MAX} value={grund} onChange={(e) => setGrund(e.target.value)} error={fehler} />
    </Dialog>
  );
}
```

- [ ] **Step 3: Einbauen**
  - `TerminAktionen` erhält `ausfallen(t)` und `ausfallZuruecknehmen(t)`.
  - Snackbar-Texte: «Termin als ausgefallen markiert.», «Ausfall zurückgenommen.», «Grund gespeichert.» (PC 9).
  - Der Aufruf sendet `erwartetesTraining: t.training?.id ?? null`.
  - `TerminKarte`, wenn `t.ausgefallen`:
    - Anstelle des Trainings steht `<Badge tone="neutral"><CalendarOff size={12} strokeWidth={2.5} aria-hidden />Ausgefallen</Badge>` und darunter der Grund (AK 7).
    - Die Karte ist gedämpft (`opacity-60`), auch wenn sie ansteht.
    - Kein «Durchführen», kein «Training zuordnen».
    - Im Menü stehen «Grund ändern», «Ausfall zurücknehmen», «Termin ändern», «Termin entfernen» (AK 10).
  - Nicht ausgefallene Termine erhalten im Menü «Ausfallen lassen» (Icon `CalendarOff`).
  - `TrainingWahlDialog` öffnet für ausgefallene Termine nicht (Knopf fehlt).
  - `TerminWahlDialog` blendet ausgefallene Termine aus der Liste aus (AK 9: «auf keinem Weg»).
- [ ] **Step 4: Typecheck, Commit** — `git commit -m "feat(kalender): Ausfall in der Oberfläche (#327)"`

### Task D5: End-to-End und PR

- [ ] Browser:
  1. Einen Termin mit Training ausfallen lassen: Die Karte zeigt «Ausgefallen» mit Grund, das Training steht im Bestand ohne Plakette.
  2. Grund leeren und zurücknehmen.
  3. Einen vergangenen Termin ausfallen lassen (AK 5).
  4. Ein Serientermin, der ausgefallen ist, wird beim Tausch Di → Mi mitverlegt und bleibt ausgefallen (PC 5, 7).
  5. KI: `termin_ausfallen_lassen`, dann `training_zuordnen` → Regel `TERMIN_AUSGEFALLEN`.
- [ ] PR «feat(kalender): Ausfall (#327)».


---

## Teil E — Persönliches Training einem Termin zuordnen (Story #328, PR 5)

### Task E1: Fachkern — persönliche Trainings als Kopie zuordnen

**Files:**
- Modify: `web/lib/kern/termine.ts` (`ordneTrainingZu`)
- Modify: `web/lib/termin.ts` (`TERMIN_MELDUNG.PERSOENLICH_NUR_KOPIE`, `TERMIN_TRAINING_FREMDES_TEAM` neu gefasst)
- Test: `web/scripts/pruefe-kern-db.ts`

**Interfaces:**
- Produces: `ordneTrainingZu` akzeptiert eigene persönliche Trainings; `Zugeordnet.kopie` ist dann immer `true`.

- [ ] **Step 1: Failing DB-Test**

```ts
  await pruefe("Persönliches Training: nur als Kopie, Original unberührt, jede Zuordnung eine neue Kopie (#328)", async () => {
    const team = await serienTeam("Kern-DB-Persoenlich");
    const anderes = await serienTeam("Kern-DB-Persoenlich-Anderes");
    const t1 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" }));
    const t2 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(-2), beginn: "18:00", ende: "19:00" }));
    const p = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Meins", altersstufe: "juniorenfussball", stufen: ["D"] })).id;

    // AK 13: Verschieben ist für ein persönliches Training abgewiesen.
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: p, art: "verschieben" }), "regel", TERMIN_MELDUNG.PERSOENLICH_NUR_KOPIE);
    // AK 1, 8, PC 1, 3, 4: Kopie im Team, auch vergangen; jede Zuordnung eine neue.
    const k1 = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: p }));
    const k2 = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t2.terminId, trainingId: p }));
    assert.equal(k1.kopie && k2.kopie, true);
    assert.notEqual(k1.trainingId, k2.trainingId);
    const kz = (await admin.from("trainings").select("team_id, owner_id, name").eq("id", k1.trainingId).single()).data!;
    assert.deepEqual(kz, { team_id: team, owner_id: null, name: "Kern-DB-Meins" });
    const orig = (await admin.from("trainings").select("owner_id, team_id").eq("id", p).single()).data!;
    assert.deepEqual(orig, { owner_id: a.id, team_id: null }, "PC 3");
    // AK 4: Ein Training eines ANDEREN eigenen Teams geht nicht.
    const fremd = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Fremdteam", altersstufe: "kinderfussball", stufen: ["F"], teamId: anderes })).id;
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: fremd }), "regel", TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM);
    // AK 9: nicht auf einen ausgefallenen Termin — und es entsteht keine Kopie.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t1.terminId }));
    const vorher = (await admin.from("trainings").select("*", { count: "exact", head: true }).eq("team_id", team)).count;
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: p }), "regel", TERMIN_MELDUNG.TERMIN_AUSGEFALLEN);
    assert.equal((await admin.from("trainings").select("*", { count: "exact", head: true }).eq("team_id", team)).count, vorher);
    // Ein fremdes öffentliches Training erst übernehmen (Epic OoS 4).
    fehler(await ordneTrainingZu(b.supabase, b.id, { terminId: t2.terminId, trainingId: p }), "nicht_gefunden");
  });
```

- [ ] **Step 2: Umsetzen** — `lib/termin.ts`:

```ts
  TERMIN_TRAINING_FREMDES_TEAM:
    "Einem Termin lassen sich nur Trainings aus dem Bestand seines Teams oder deine persönlichen Trainings zuordnen.",
  PERSOENLICH_NUR_KOPIE: "Ein persönliches Training lässt sich einem Termin nur als Kopie zuordnen.",
```

In `ordneTrainingZu` die Prüfung nach dem Laden des Trainings ersetzen:

```ts
  const { ziel } = training.wert;
  // #328: Ein persönliches Training kommt als eigenständige Kopie ins Team
  // des Termins (PC 1–4). Verschieben gibt es dafür nicht (AK 13).
  if (ziel.art === "persoenlich") {
    if (e.art === "verschieben")
      return fehlschlag("regel", TERMIN_MELDUNG.PERSOENLICH_NUR_KOPIE, { feld: "art" });
    const kopie = await kopiereTraining(supabase, e.trainingId, { art: "team", teamId: t.team_id });
    if (!kopie.ok)
      // AK 10: Erfüllt es die Bedingungen eines Team-Trainings nicht, nennt die
      // Meldung der Kopie den Grund.
      return fehlschlag(kopie.art, kopie.error, {
        hinweis: kopie.nichtsEntstanden ? HINWEIS_NICHTS_ENTSTANDEN : hinweisRest(kopie.rest),
      });
    const erwartet: Erwartung = { termin_training: e.erwartet ? e.erwartet.terminTraining : t.training_id, training_termin: null };
    const r = await setze(supabase, t, kopie.neueId, false, erwartet, !e.erwartet, true);
    return r.ok ? r : mitAufgeraeumterKopie(supabase, r, kopie.neueId);
  }
  if (ziel.teamId !== t.team_id)
    return fehlschlag("regel", TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM, { feld: "training_id" });
```

(Die Ausfall-Prüfung aus D2 steht davor, direkt nach dem Laden des Termins. Die Konfliktprüfung AK 11 übernimmt `setze` über `termin_training`; ein gelöschtes Original meldet schon `ladeTrainingZumBearbeiten` mit «nicht gefunden».)

- [ ] **Step 3: Tests, Commit** — `npm run check:kern-db && npm run check:kern`

```bash
git add web/lib web/scripts
git commit -m "feat(kalender): persönliches Training als Kopie einem Termin zuordnen (#328)"
```

### Task E2: KI und Oberfläche

**Files:**
- Modify: `web/lib/mcp/werkzeuge/team.ts` (`training_zuordnen`-Beschreibung), `web/lib/mcp/umfang.ts`
- Modify: `web/components/team/TrainingWahlDialog.tsx` (Gruppe «Meine Trainings»)
- Modify: `web/app/team/[id]/page.tsx` (eigene Trainings mitladen)
- Create: `web/components/training/TerminZuordnenAusTraining.tsx`
- Modify: `web/components/training/TrainingAktionen.tsx` (Menüeintrag)
- Modify: `web/lib/actions/termine.ts` (`termineFuerZuordnungAktion`)

- [ ] **Step 1: KI** — In der Beschreibung von `training_zuordnen` ergänzen: «Auch ein eigenes persönliches Training (jeder Altersstufe, Entwurf oder öffentlich) lässt sich zuordnen: Es entsteht immer eine eigenständige Kopie im Team des Termins, die alle Mitglieder sehen und bearbeiten; das Original bleibt unverändert und ohne Verbindung. «art» darf dann nur «kopie» sein oder fehlen. Trainings eines anderen Teams lassen sich nicht zuordnen.» `umfang.ts`: «…, ihnen Trainings aus dem Team oder als Kopie deine persönlichen Trainings zuordnen, …» (PC 11). `jeStory` bekommt keinen Eintrag: Story 7 bringt kein neues Werkzeug.

- [ ] **Step 2: Am Termin wählen (AK 1, 3, 5, 6)** — `page.tsx` lädt zusätzlich `getTrainingPool({ mine: true })` (eigene Trainings, auch öffentliche und Entwürfe). `TerminBereich` bekommt sie als `persoenliche: TrainingListRow[]` und reicht sie an `TrainingWahlDialog` weiter. Im Dialog steht eine zweite Liste unter der Überschrift «Meine Trainings» (`<h3 className="type-title-small">`), die erste heisst «Aus dem Team-Bestand». Die Auswahl merkt sich die Quelle (`{ trainingId, quelle: "team" | "persoenlich" }`). Ist ein persönliches Training gewählt, fällt die Wahl Kopie/Verschieben weg, und der Dialog zeigt (AK 6):

```tsx
        <p className="mt-4">
          Es entsteht eine Kopie im Team. Spätere Änderungen an deinem Original wirken nicht auf sie,
          und alle Mitglieder des Teams sehen und bearbeiten sie.
        </p>
```

`onWahl` liefert `art: "kopie"` und `trainingTermin: null`. Die Snackbar nach Erfolg lautet «Kopie im Team angelegt und dem Termin zugeordnet.» (PC 9).

- [ ] **Step 3: Vom persönlichen Training aus (AK 2)** — In `TrainingAktionen` für `bearbeitungsziel?.art === "persoenlich"` und `teams.length > 0` einen Menüeintrag «Einem Team-Termin zuordnen» (Icon `CalendarPlus`) ergänzen. Er öffnet `TerminZuordnenAusTraining`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Select } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { TerminWahlDialog } from "@/components/team/TerminWahlDialog";
import { ordneTrainingZuAktion, termineFuerZuordnungAktion } from "@/lib/actions/termine";
import type { TeamUebersicht } from "@/lib/queries/teams";
import type { TerminZeile } from "@/lib/queries/termine";

/* Ein persönliches Training einem Termin eines eigenen Teams zuordnen
   (#328 AK 2). Erst das Team, dann der Termin; zugeordnet wird eine Kopie. */
export function TerminZuordnenAusTraining({
  open, trainingId, name, teams, onClose,
}: { open: boolean; trainingId: string; name: string; teams: readonly TeamUebersicht[]; onClose: () => void }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [teamId, setTeamId] = useState<string>("");
  const [daten, setDaten] = useState<{ termine: TerminZeile[]; heute: string } | null>(null);
  useEffect(() => { if (open) { setTeamId(teams.length === 1 ? teams[0].id : ""); setDaten(null); } }, [open, teams]);
  useEffect(() => {
    if (!teamId) return;
    startTransition(async () => {
      const r = await termineFuerZuordnungAktion(teamId);
      if (r.ok) setDaten({ termine: r.termine, heute: r.heute }); else melde(r.error);
    });
  }, [teamId, melde]);

  if (!open) return null;
  if (!daten)
    return (
      <Dialog open onClose={onClose} title="Einem Team-Termin zuordnen" actions={<Button variant="text" onClick={onClose}>Abbrechen</Button>}>
        <Select label="Team" value={teamId} onChange={setTeamId} options={teams.map((t) => ({ value: t.id, label: t.name }))} placeholder="Team wählen" />
      </Dialog>
    );
  return (
    <TerminWahlDialog
      training={{ id: trainingId, name, termin: null } as never}
      termine={daten.termine.filter((t) => !t.ausgefallen)}
      heute={daten.heute}
      pending={pending}
      hinweis="Es entsteht eine Kopie im Team. Spätere Änderungen an deinem Original wirken nicht auf sie, und alle Mitglieder des Teams sehen und bearbeiten sie."
      onClose={onClose}
      onWahl={({ termin }) =>
        startTransition(async () => {
          const r = await ordneTrainingZuAktion({
            terminId: termin.id, trainingId, art: "kopie",
            erwartet: { terminTraining: termin.training?.id ?? null, trainingTermin: null },
          });
          onClose();
          router.refresh();
          melde(r.ok ? "Kopie im Team angelegt und dem Termin zugeordnet." : r.error);
        })
      }
    />
  );
}
```

`TerminWahlDialog` erhält dafür die optionale Prop `hinweis?: string`, die über der Liste steht, und akzeptiert als `training` den schmalen Typ `{ id: string; name: string; termin: { id: string; datum: string } | null }` statt `TeamTrainingRow`. Den Prop-Typ entsprechend lockern; damit entfällt auch das `as never` oben.

Action:

```ts
export async function termineFuerZuordnungAktion(
  teamId: string,
): Promise<{ ok: true; termine: TerminZeile[]; heute: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await teamPlan(a.supabase, a.userId, { teamId });
  if (!r.ok) return { ok: false, error: r.meldung };
  return { ok: true, termine: [...r.wert.kommend, ...r.wert.vergangen], heute: r.wert.heute };
}
```

- [ ] **Step 4: Typecheck, E2E, Commit, PR**
  - Browser: Am Termin ein eigenes Junioren-Training aus «Meine Trainings» zuordnen. Der Hinweis erscheint, danach steht die Kopie im Team-Bestand, und das Original bleibt in «Meine Trainings» unverändert.
  - Vom eigenen Training aus «Einem Team-Termin zuordnen».
  - Commit `feat(kalender): persönliche Trainings am Termin und vom Training aus zuordnen (#328)`, PR «feat(kalender): persönliches Training zuordnen (#328)».

---

## Teil F — Monatsüberblick (Story #329, PR 6)

### Task F1: Reine Monatsrechnung und KI-Zeitraum

**Files:**
- Create: `web/lib/monat.ts`
- Modify: `web/lib/queries/termine-fuer.ts` (`getTeamPlanFuer` mit `von`/`bis`)
- Modify: `web/lib/kern/team.ts` (`teamPlan({ von, bis })` mit Prüfung)
- Modify: `web/lib/mcp/werkzeuge/team.ts` (`team_plan_abrufen` mit `von`, `bis`), `web/lib/mcp/umfang.ts`
- Test: `web/scripts/pruefe-kern.ts`, `web/scripts/pruefe-kern-db.ts`

**Interfaces:**
- Produces:
  - `monatVon(iso) → "YYYY-MM"`, `plusMonate(monat, n) → "YYYY-MM"`
  - `monatsRaster(monat) → { tag: string; imMonat: boolean }[][]` (Wochen Mo–So)
  - `monatsName(monat) → "Oktober 2026"`, `istMonat(s)`
  - `ZEITRAUM_TEXT`, `zeitraumProblem(von, bis) → { feld: "von"|"bis"; text } | null`

- [ ] **Step 1: Failing test**

```ts
pruefe("Monat: Raster Montag–Sonntag, Wechsel, Name (#329)", () => {
  const r = monatsRaster("2026-10");
  assert.equal(r[0][0].tag, "2026-09-28", "beginnt am Montag vor dem 1.");
  assert.equal(r[0][3].tag, "2026-10-01");
  assert.ok(r.every((w) => w.length === 7));
  assert.equal(r.at(-1)!.at(-1)!.tag, "2026-11-01");
  assert.equal(plusMonate("2026-12", 1), "2027-01");
  assert.equal(plusMonate("2026-01", -1), "2025-12");
  assert.equal(monatsName("2026-10"), "Oktober 2026");
  assert.equal(monatVon("2026-10-07"), "2026-10");
  assert.equal(istMonat("2026-13"), false);
});

pruefe("KI-Zeitraum: höchstens bis zum gleichen Kalendertag im Folgejahr (#329 AK 14, Review Focus 2)", () => {
  assert.equal(zeitraumProblem("2026-10-01", "2027-10-01"), null);
  assert.equal(zeitraumProblem("2028-02-29", "2029-02-28"), null);
  assert.deepEqual(zeitraumProblem("2028-02-29", "2029-03-01"), { feld: "bis", text: ZEITRAUM_TEXT.zuLang });
  assert.deepEqual(zeitraumProblem("2026-10-02", "2026-10-01"), { feld: "bis", text: ZEITRAUM_TEXT.bisVorVon });
  assert.deepEqual(zeitraumProblem("2026-02-30", "2026-03-01"), { feld: "von", text: TERMIN_TEXT.datum });
});
```

DB: im Szenario «Serie festlegen» ergänzen:

```ts
    const z = wert(await teamPlan(a.supabase, a.id, { teamId: team, von: "2030-01-06", bis: "2030-01-10" }));
    assert.deepEqual([...z.kommend, ...z.vergangen].map((x) => x.datum), ["2030-01-08", "2030-01-10"]);
    assert.equal(wert(await teamPlan(a.supabase, a.id, { teamId: team, von: "2031-06-01", bis: "2031-06-30" })).kommend.length, 0, "PC 7: leer");
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: "2030-01-01", bis: "2031-01-02" }), "eingabe", ZEITRAUM_TEXT.zuLang);
```

- [ ] **Step 2: `web/lib/monat.ts`**

```ts
// Der Monatsüberblick des Team-Kalenders (#329) und der Zeitraum des
// KI-Abrufs. REIN: importiert nur lib/serie.ts und lib/termin.ts.
import { maxEnddatum, plusTage, wochentagVon } from "@/lib/serie";
import { TERMIN_TEXT, istKalendertag } from "@/lib/termin";

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export const istMonat = (s: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const monatVon = (iso: string): string => iso.slice(0, 7);

export function plusMonate(monat: string, n: number): string {
  const [j, m] = monat.split("-").map(Number);
  const i = j * 12 + (m - 1) + n;
  return `${String(Math.floor(i / 12)).padStart(4, "0")}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export function monatsName(monat: string): string {
  const [j, m] = monat.split("-").map(Number);
  return `${MONATE[m - 1]} ${j}`;
}

/** Die Wochen eines Monats, Montag bis Sonntag, samt den Tagen des Vor- und
 *  Folgemonats, die die erste und letzte Woche füllen. */
export function monatsRaster(monat: string): { tag: string; imMonat: boolean }[][] {
  const erster = `${monat}-01`;
  const letzter = plusTage(`${plusMonate(monat, 1)}-01`, -1);
  const start = plusTage(erster, 1 - wochentagVon(erster));
  const ende = plusTage(letzter, 7 - wochentagVon(letzter));
  const wochen: { tag: string; imMonat: boolean }[][] = [];
  for (let d = start; d <= ende; d = plusTage(d, 7))
    wochen.push(Array.from({ length: 7 }, (_, i) => { const tag = plusTage(d, i); return { tag, imMonat: monatVon(tag) === monat }; }));
  return wochen;
}

export const ZEITRAUM_TEXT = {
  bisVorVon: "Der Bis-Tag darf nicht vor dem Von-Tag liegen.",
  zuLang: "Ein Zeitraum reicht höchstens bis zum gleichen Kalendertag im Folgejahr (nach einem 29. Februar bis zum 28. Februar).",
} as const;

/** Der Zeitraum des KI-Abrufs: beide Tage eingeschlossen, höchstens bis zum
 *  gleichen Kalendertag im Folgejahr — dieselbe Regel wie bei Serien (#329 AK 14). */
export function zeitraumProblem(von: string, bis: string): { feld: "von" | "bis"; text: string } | null {
  if (!istKalendertag(von)) return { feld: "von", text: TERMIN_TEXT.datum };
  if (!istKalendertag(bis)) return { feld: "bis", text: TERMIN_TEXT.datum };
  if (bis < von) return { feld: "bis", text: ZEITRAUM_TEXT.bisVorVon };
  if (bis > maxEnddatum(von)) return { feld: "bis", text: ZEITRAUM_TEXT.zuLang };
  return null;
}
```

- [ ] **Step 3: Zeitraum im Lesepfad und KI**
  - `getTeamPlanFuer(supabase, teamId, f: { nurMeine?: string; von?: string; bis?: string })` ergänzt `.gte("datum", f.von)` und `.lte("datum", f.bis)`, wenn gesetzt.
  - `teamPlan` prüft `zeitraumProblem`, wenn `von` oder `bis` gesetzt ist; beide sind dann Pflicht (`fehlschlag("eingabe", "Gib «von» und «bis» zusammen an.", { feld: "bis" })`).
  - `team_plan_abrufen` erhält `von: DATUM.optional()` und `bis: DATUM.optional()`, beide eingeschlossen. Beschreibung: «Mit «von» und «bis» (beide eingeschlossen, höchstens bis zum gleichen Kalendertag im Folgejahr) nur die Termine dieses Zeitraums, nach denselben Regeln für kommend und vergangen; ohne Termine eine leere Auskunft.»
  - `umfang.ts`: «… und die Termine eines Zeitraums abrufen» (PC 8).
- [ ] **Step 4: Tests, Commit** — `git commit -m "feat(kalender): Monatsrechnung und Zeitraum-Abruf (#329)"`

### Task F2: Oberfläche — Monatsüberblick

**Files:**
- Create: `web/components/ui/Monatsraster.tsx` (+ Styleguide-Demo, neuer Abschnitt «Monatsraster»)
- Create: `web/components/team/MonatsUeberblick.tsx`, `web/components/team/AnsichtWahl.tsx`, `web/components/team/TerminDetailDialog.tsx`
- Modify: `web/app/team/[id]/page.tsx` (Suchparameter `ansicht`, `monat`, `meine`), `TerminBereich.tsx` (`oeffnen(t)`)

**Interfaces:**
- Produces: `Monatsraster({ monat, heute, renderTag })`, `MonatsUeberblick({ monat, termine, heute, basisHref })`, `AnsichtWahl({ ansicht, hrefListe, hrefMonat })`, `TerminAktionen.oeffnen(t)`.

- [ ] **Step 1: `Monatsraster.tsx`** — generisch, darum in `components/ui`. Begründung für den Styleguide: «Ein Monat als Raster Montag bis Sonntag; der Inhalt eines Tages kommt vom Aufrufer.»

```tsx
import { cn } from "@/lib/cn";
import { monatsRaster } from "@/lib/monat";

const KOPF = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function Monatsraster({
  monat,
  heute,
  renderTag,
  leereWoche,
}: {
  monat: string;
  heute: string;
  renderTag: (tag: string) => React.ReactNode;
  /** Ist diese Woche leer? Dann trägt die Zeile eine Kennzeichnung (#329 AK 3). */
  leereWoche?: (tage: string[]) => boolean;
}) {
  const wochen = monatsRaster(monat);
  return (
    <div role="grid" aria-label="Monatsüberblick" className="overflow-x-auto">
      <div role="row" className="grid grid-cols-7 gap-px text-center type-body-small text-on-surface-mittel">
        {KOPF.map((k) => <div role="columnheader" key={k} className="py-1">{k}</div>)}
      </div>
      {wochen.map((w) => {
        const leer = leereWoche?.(w.map((d) => d.tag)) ?? false;
        return (
          <div role="row" key={w[0].tag} className={cn("grid grid-cols-7 gap-px", leer && "rounded-flaeche kontur border-dashed border-kante")} aria-label={leer ? "Woche ohne Termin" : undefined}>
            {w.map(({ tag, imMonat }) => (
              <div role="gridcell" key={tag} className={cn("min-h-24 min-w-0 bg-elev-01 p-1", !imMonat && "opacity-50", tag === heute && "kontur border-primary")}>
                <div className="type-body-small text-on-surface-mittel">{Number(tag.slice(8))}</div>
                {renderTag(tag)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: `TerminDetailDialog.tsx`** (AK 8) — ein Dialog, der die `TerminKarte` aus Teil A zeigt; dieselben Angaben und Aktionen wie in der Liste.

```tsx
"use client";

import { Dialog, Button } from "@/components/ui";
import { TerminKarte } from "./TrainingsPlan";
import type { TerminZeile } from "@/lib/queries/termine";

export function TerminDetailDialog({ termin, heute, onClose }: { termin: TerminZeile | null; heute: string; onClose: () => void }) {
  return (
    <Dialog open={termin !== null} onClose={onClose} title="Termin" actions={<Button variant="text" onClick={onClose}>Schliessen</Button>}>
      {termin && <ul><TerminKarte t={termin} heute={heute} /></ul>}
    </Dialog>
  );
}
```

`TerminBereich` hält `offen: TerminZeile | null`, rendert den Dialog und bietet `oeffnen: setOffen`. Jede Aktion aus der Karte schliesst `offen` vorab (`setOffen(null)` am Anfang von `bearbeiten`, `zuordnen`, `entfernen`, `ausfallen`), damit nicht zwei Dialoge übereinander liegen.

- [ ] **Step 3: `MonatsUeberblick.tsx`** (AK 1–7, 9, 10)

```tsx
"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { ButtonLink, IconButtonLink, Menu, Monatsraster } from "@/components/ui";
import { cn } from "@/lib/cn";
import { monatsName, monatVon, plusMonate } from "@/lib/monat";
import { useTerminAktionen } from "./TerminBereich";
import { nochNichtVorbereitet, type TerminZeile } from "@/lib/queries/termine-fuer";

/* Die Termine eines Teams Monat für Monat (#329). Jeder Termin eines Tages
   steht einzeln (AK 4) mit Beginn und Trainingsname oder seinem Zustand
   (AK 5–7); ein Klick öffnet ihn mit denselben Aktionen wie in der Liste. */
export function MonatsUeberblick({
  monat,
  termine,
  heute,
  hrefMonat,
}: {
  monat: string;
  termine: TerminZeile[];
  heute: string;
  /** Die Adresse eines anderen Monats — trägt die Eingrenzung mit (PC 4). */
  hrefMonat: (monat: string) => string;
}) {
  const a = useTerminAktionen();
  const [plusTag, setPlusTag] = useState<string | null>(null);
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const jeTag = new Map<string, TerminZeile[]>();
  for (const t of termine) jeTag.set(t.datum, [...(jeTag.get(t.datum) ?? []), t]);

  function eintrag(t: TerminZeile) {
    const zustand = t.ausgefallen ? "Ausgefallen" : t.training ? t.training.name : nochNichtVorbereitet(t, heute) ? "Noch kein Training" : "Ohne Training";
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => a.oeffnen(t)}
        className={cn(
          "focus-ring mt-1 block w-full truncate rounded-plakette px-1 text-left type-body-small",
          t.ausgefallen && "text-on-surface-tief line-through",
          !t.ausgefallen && nochNichtVorbereitet(t, heute) && "kontur border-error text-error",
          !t.ausgefallen && t.training && "bg-elev-08 text-on-surface",
          !t.ausgefallen && !t.training && !nochNichtVorbereitet(t, heute) && "text-on-surface-mittel",
        )}
      >
        {t.beginn ? `${t.beginn} ` : <span className="text-error">Zeit fehlt </span>}
        {zustand}
      </button>
    );
  }

  return (
    <section aria-label={monatsName(monat)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <IconButtonLink href={hrefMonat(plusMonate(monat, -1))} icon={ChevronLeft} label="Vorheriger Monat" />
        <h3 className="type-title-medium text-on-surface">{monatsName(monat)}</h3>
        <div className="flex items-center gap-1">
          {monat !== monatVon(heute) && <ButtonLink variant="text" href={hrefMonat(monatVon(heute))}>Heute</ButtonLink>}
          <IconButtonLink href={hrefMonat(plusMonate(monat, 1))} icon={ChevronRight} label="Nächster Monat" />
        </div>
      </div>
      <Monatsraster
        monat={monat}
        heute={heute}
        leereWoche={(tage) => tage.every((d) => !jeTag.has(d))}
        renderTag={(tag) => (
          <>
            {(jeTag.get(tag) ?? []).map(eintrag)}
            <button
              type="button"
              aria-label={`Am ${tag} festlegen`}
              onClick={(e) => { plusRef.current = e.currentTarget; setPlusTag(tag); }}
              className="focus-ring mt-1 rounded-full p-0.5 text-on-surface-tief hover:text-on-surface"
            >
              <Plus size={14} aria-hidden />
            </button>
          </>
        )}
      />
      <Menu
        open={plusTag !== null}
        onClose={() => setPlusTag(null)}
        triggerRef={plusRef}
        items={[
          { label: "Termin festlegen", onSelect: () => plusTag && a.neu(plusTag) },
          { label: "Terminserie festlegen", onSelect: () => plusTag && a.neueSerie(plusTag) },
        ]}
      />
    </section>
  );
}
```

(AK 9: Der gewählte Tag ist als Datum beziehungsweise Beginndatum vorbelegt. AK 10: Zuordnen läuft über `a.oeffnen(t)` → Karte → «Training zuordnen». `ButtonLink` gibt es in `Button.tsx`; `Menu` nimmt `{ open, onClose, items, triggerRef }` mit `MenuItemDef { label; icon?; onSelect? }`.)

- [ ] **Step 4: `AnsichtWahl.tsx` und die Seite** (AK 11, 12; PC 1–6)

```tsx
import Link from "next/link";
import { CalendarDays, List } from "lucide-react";
import { buttonClasses } from "@/components/ui";

/** Liste oder Monat — als Links, damit die Eingrenzung auf die eigenen
 *  Termine in der Adresse mitreist (PC 4). */
export function AnsichtWahl({ ansicht, hrefListe, hrefMonat }: { ansicht: "liste" | "monat"; hrefListe: string; hrefMonat: string }) {
  return (
    <nav aria-label="Ansicht" className="flex gap-1">
      <Link href={hrefListe} aria-current={ansicht === "liste" ? "page" : undefined} className={buttonClasses(ansicht === "liste" ? "tonal" : "text", "sm")}>
        <List size={16} aria-hidden /> Liste
      </Link>
      <Link href={hrefMonat} aria-current={ansicht === "monat" ? "page" : undefined} className={buttonClasses(ansicht === "monat" ? "tonal" : "text", "sm")}>
        <CalendarDays size={16} aria-hidden /> Monat
      </Link>
    </nav>
  );
}
```

`page.tsx`:
- Die Seite liest `searchParams: Promise<{ ansicht?: string; monat?: string; meine?: string }>`.
- Werte: `ansicht = sp.ansicht === "monat" ? "monat" : "liste"` (PC 1: die Liste bleibt Start), `monat = istMonat(sp.monat ?? "") ? sp.monat! : monatVon(heute)` (PC 2), `meine = sp.meine === "1"`.
- Die Adresse baut ein Helfer `href({ ansicht, monat, meine })`.
- Im Monat werden alle Termine gerendert. Das Raster zeigt nur die Tage des Monats und der Randwochen; dieselben Termine wie die Liste (PC 3).
- Nach einer Änderung lädt `router.refresh()` beide Ansichten neu (PC 5).
- Die Snackbar bestätigt auch, wenn das Ergebnis ausserhalb des Monats oder der Eingrenzung liegt (PC 6); das ergibt sich von selbst, weil `lauf` immer meldet.

- [ ] **Step 5: Typecheck, Styleguide, E2E, Commit, PR**
  - Browser:
    1. Liste → Monat → nächster Monat → «Heute».
    2. «Meine Termine» im Monat, zurück zur Liste: Die Eingrenzung bleibt; das Team neu aus der Teamübersicht öffnen: Die Eingrenzung ist weg.
    3. Einen Tag über «+» mit Serie belegen.
    4. Einen Termin öffnen und zuordnen.
    5. Eine leere Woche trägt die gestrichelte Kennzeichnung.
  - Mobilbreite prüfen (`resize_window` mobile): Das Raster scrollt waagrecht im eigenen Container, nicht die Seite.
  - Commit `feat(kalender): Monatsüberblick (#329)`, PR «feat(kalender): Monatsüberblick (#329)».

---

## Teil G — Trainingszeiten im eigenen Kalender abonnieren (Story #330, PR 7)

### Task G1: Migration — Abos, Feed-RPC, Erlöschen

**Files:**
- Create: `supabase/migrations/<zeitstempel>_kalender_abos.sql`
- Modify: `.github/workflows/sync-staging.yml` (`PUBLIC_TABLES` + Leeren nach dem Restore)

**Interfaces:**
- Produces:
  - Tabelle `kalender_abos(id, team_id, user_id, token, created_at)`, UNIQUE `(team_id, user_id)`
  - RPC `kalender_abo_holen(p_team) → text` (Token)
  - RPC `kalender_abo_termine(p_token text) → jsonb { gueltig, team?: {id, name}, termine?: [{id, datum, beginn, ende, ort, geaendert}] }` (anon)
  - Trigger `abo_erlischt`

- [ ] **Step 1: Migration**

```sql
-- ============================================================================
-- Team-Kalender (Epic #321), Story 9 (#330): persönliches Kalender-Abo je
-- Mitglied und Team. Der Link trägt ein Geheimnis; wer ihn hat, erhält Titel,
-- Zeit und Ort der Termine (Epic, bewusste Ausnahme), solange das Abo gilt.
-- ============================================================================
set lock_timeout = '5s';

create table kalender_abos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  -- Konto gelöscht → Abo weg (PC 9).
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 244 zufällige Bit aus zwei v4-UUIDs (CSPRNG von Postgres), 64 Hex-Zeichen:
  -- nicht erratbar (AK 11). Im Klartext gespeichert, weil der Link im Konto
  -- jederzeit wieder einsehbar ist (AK 5); lesen darf ihn nur sein Konto.
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)   -- AK 10: höchstens ein gültiger Link je Mitglied und Team
);

alter table kalender_abos enable row level security;
create policy ka_select on kalender_abos for select to authenticated using (user_id = auth.uid());
create policy ka_delete on kalender_abos for delete to authenticated using (user_id = auth.uid());
grant select, delete on kalender_abos to authenticated;
revoke insert, update, truncate on kalender_abos from anon, authenticated;
revoke all on kalender_abos from anon;

-- Holen: derselbe Link, solange das Abo gilt (AK 6); nach dem Erlöschen ein
-- neuer (AK 9).
create function kalender_abo_holen(p_team uuid) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  insert into kalender_abos (team_id, user_id) values (p_team, auth.uid())
    on conflict (team_id, user_id) do nothing;
  return (select token from kalender_abos where team_id = p_team and user_id = auth.uid());
end;
$$;
revoke all on function kalender_abo_holen(uuid) from public, anon;
grant execute on function kalender_abo_holen(uuid) to authenticated;

-- Der Feed (PC 1, 2, 5, 6, 9): anstehende Termine und die der 28 Tage vor
-- heute (Schweiz), ohne ausgefallene, nur Zeit und Ort. Aufrufbar ohne
-- Anmeldung — das Geheimnis IST die Berechtigung (AK 11).
create function kalender_abo_termine(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  a kalender_abos;
  v_team teams;
begin
  select * into a from kalender_abos k
   where k.token = p_token
     and exists (select 1 from team_members m where m.team_id = k.team_id and m.user_id = k.user_id);
  if not found then return jsonb_build_object('gueltig', false); end if;
  select * into v_team from teams where id = a.team_id;
  return jsonb_build_object(
    'gueltig', true,
    'team', jsonb_build_object('id', v_team.id, 'name', v_team.name),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'datum', t.datum,
               'beginn', to_char(t.beginn, 'HH24:MI'), 'ende', to_char(t.ende, 'HH24:MI'),
               'ort', t.ort, 'geaendert', t.updated_at)
             order by t.datum, t.beginn nulls last)
        from training_termine t
       where t.team_id = a.team_id and not t.ausgefallen
         and t.datum >= heute_am_trainingsort() - 28), '[]'::jsonb));
end;
$$;
revoke all on function kalender_abo_termine(text) from public;
grant execute on function kalender_abo_termine(text) to anon, authenticated;

-- Austritt, Entfernen, Auflösen, Konto löschen: Das Abo erlischt (PC 9) und
-- bleibt erloschen, auch bei erneuter Aufnahme (PC 10).
create function abo_erlischt() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from kalender_abos where team_id = old.team_id and user_id = old.user_id;
  return old;
end;
$$;
create trigger abo_erlischt after delete on team_members
  for each row execute function abo_erlischt();

reset lock_timeout;
```

- [ ] **Step 2: `sync-staging.yml`**
  - `kalender_abos` in `PUBLIC_TABLES` einsortieren. Es steht vor `ki_aufrufe`: `"exercise_favorites exercises kalender_abos ki_aufrufe …"`.
  - Im Restore-Block nach dem Einspielen und vor dem `bild_url`-Umschreiben einfügen:

```sql
      -- Abo-Links sind Geheimnisse der Prod-Konten (#330). Auf Staging gelten
      -- sie nicht; wer dort testet, holt sich einen neuen.
      delete from public.kalender_abos;
```

  - Der Kommentar im Kopf des Workflows (Liste der bewusst nicht übernommenen Inhalte) erhält die Zeile «`kalender_abos` wird kopiert und direkt danach geleert».

- [ ] **Step 3: Anwenden, Commit** — `npm run db:reset && npm run gen:types`; `git commit -m "feat(kalender): Kalender-Abos in der Datenebene (#330)"`

### Task G2: iCalendar erzeugen (rein)

**Files:**
- Create: `web/lib/ical.ts`
- Test: `web/scripts/pruefe-kern.ts`

**Interfaces:**
- Produces:
  - `type AboTermin = { id; datum; beginn: string|null; ende: string|null; ort: string|null; geaendert: string }`
  - `ABO_DAUER_MIN = 90`
  - `textEscape(v)`, `falten(zeile)`
  - `kalenderText({ kalenderName, titel, teamId, origin, termine, jetzt }) → string`
  - `aboDatei(token) → string` (`<token>.ics`), `aboPfad(token) → string`

- [ ] **Step 1: Failing test**

```ts
pruefe("Abo: Wanduhrzeit mit TZID, ganztägig ohne Beginn, 90 Minuten ohne Ende, über Mitternacht (#330 PC 2–4, Review Focus 1)", () => {
  const jetzt = new Date("2026-10-01T10:00:00Z");
  const text = kalenderText({
    kalenderName: "Training · FC Test",
    titel: "Training · FC Test",
    teamId: "team",
    origin: "https://ki-fu.ch",
    jetzt,
    termine: [
      { id: "a", datum: "2027-03-28", beginn: "02:30", ende: "04:00", ort: "Halle; Nord, 2", geaendert: "2026-09-30T08:00:00Z" },
      { id: "b", datum: "2026-10-07", beginn: "23:00", ende: null, ort: null, geaendert: "2026-09-30T08:00:00Z" },
      { id: "c", datum: "2026-10-08", beginn: null, ende: null, ort: null, geaendert: "2026-09-30T08:00:00Z" },
    ],
  });
  assert.ok(text.includes("BEGIN:VTIMEZONE\r\nTZID:Europe/Zurich"));
  assert.ok(text.includes("DTSTART;TZID=Europe/Zurich:20270328T023000"), "Wanduhrzeit, nicht UTC");
  assert.ok(text.includes("DTEND;TZID=Europe/Zurich:20261008T003000"), "23:00 + 90 Min. endet am Folgetag");
  assert.ok(text.includes("DTSTART;VALUE=DATE:20261008\r\nDTEND;VALUE=DATE:20261009"), "ganztägig");
  assert.ok(text.includes("LOCATION:Halle\; Nord\\, 2"), "Escaping");
  assert.ok(text.includes("UID:a@ki-fu.ch"));
  assert.ok(text.includes("URL:https://ki-fu.ch/team/team/termin/a"));
  assert.ok(!/DESCRIPTION:(?!https:\/\/ki-fu\.ch\/team\/team\/termin\/)/.test(text), "PC 2: nur der Verweis");
  assert.ok(text.split("\r\n").every((z) => new TextEncoder().encode(z).length <= 75), "gefaltet");
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
});

pruefe("Abo: Faltung zählt Oktette, nicht Zeichen", () => {
  const z = "SUMMARY:" + "ä".repeat(60);
  const f = falten(z).split("\r\n");
  assert.ok(f.every((l) => new TextEncoder().encode(l).length <= 75));
  assert.equal(f.map((l, i) => (i ? l.slice(1) : l)).join(""), z);
});
```

- [ ] **Step 2: `web/lib/ical.ts`**

```ts
// Das Kalender-Abo als iCalendar (RFC 5545) — Team-Kalender #330.
//
// Zeiten gehen als Wanduhrzeit mit TZID=Europe/Zurich hinaus, samt der
// Zeitzonen-Definition: So erscheint ein Termin im Kalenderprogramm zum selben
// Zeitpunkt wie in der Schweiz, auch wenn das Gerät eine andere Zeitzone nutzt
// (PC 4), und die Zeitumstellung verschiebt nichts. Je Termin gehen nur Titel,
// Beginn, Ende, Ort und der Verweis in die Anwendung hinaus (PC 2).
//
// REIN: importiert nur lib/serie.ts.
import { plusTage } from "@/lib/serie";

export type AboTermin = {
  id: string;
  datum: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  /** Zeitpunkt der letzten Änderung (timestamptz, ISO). */
  geaendert: string;
};

/** Ein Termin mit Beginn, aber ohne Ende dauert im Abo 90 Minuten (PC 3). */
export const ABO_DAUER_MIN = 90;

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Zurich",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** TEXT-Werte nach RFC 5545 3.3.11. */
export function textEscape(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zeilen höchstens 75 Oktette (RFC 5545 3.1); Fortsetzungen beginnen mit
 *  einem Leerzeichen. Gezählt wird UTF-8, geteilt nie mitten im Zeichen. */
export function falten(zeile: string): string {
  const enc = new TextEncoder();
  const teile: string[] = [];
  let aktuell = "";
  let laenge = 0;
  for (const zeichen of zeile) {
    const n = enc.encode(zeichen).length;
    const grenze = teile.length === 0 ? 75 : 74;
    if (laenge + n > grenze) {
      teile.push(aktuell);
      aktuell = "";
      laenge = 0;
    }
    aktuell += zeichen;
    laenge += n;
  }
  teile.push(aktuell);
  return teile.join("\r\n ");
}

const kompakt = (iso: string) => iso.replace(/-/g, "");
const lokal = (datum: string, hhmm: string) => `${kompakt(datum)}T${hhmm.replace(":", "")}00`;
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function plusMinuten(datum: string, hhmm: string, min: number): { datum: string; zeit: string } {
  const [h, m] = hhmm.split(":").map(Number);
  const gesamt = h * 60 + m + min;
  const rest = gesamt % 1440;
  return {
    datum: plusTage(datum, Math.floor(gesamt / 1440)),
    zeit: `${String(Math.floor(rest / 60)).padStart(2, "0")}:${String(rest % 60).padStart(2, "0")}`,
  };
}

/** Der Pfad des Feeds zu einem Abo-Token. */
export const aboDatei = (token: string) => `${token}.ics`;
export const aboPfad = (token: string) => `/api/kalender/${aboDatei(token)}`;

export function kalenderText(k: {
  kalenderName: string;
  /** «Training · Teamname» (PC 2). */
  titel: string;
  teamId: string;
  origin: string;
  termine: AboTermin[];
  jetzt: Date;
}): string {
  const z = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KiFu//Team-Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${textEscape(k.kalenderName)}`,
    "X-WR-TIMEZONE:Europe/Zurich",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
  ];
  for (const t of k.termine) {
    // PC 7, 8: Der Verweis führt über eine eigene Adresse, die Anmeldung,
    // Rückblick und «nicht mehr vorhanden» auflöst.
    const verweis = `${k.origin}/team/${k.teamId}/termin/${t.id}`;
    // PC 6: Die UID ist die Kennung des Termins — ein geänderter, verschobener
    // oder in eine neue Serie übergegangener Termin erscheint genau einmal.
    z.push("BEGIN:VEVENT", `UID:${t.id}@ki-fu.ch`, `DTSTAMP:${utc(k.jetzt.toISOString())}`, `LAST-MODIFIED:${utc(t.geaendert)}`);
    if (!t.beginn) {
      z.push(`DTSTART;VALUE=DATE:${kompakt(t.datum)}`, `DTEND;VALUE=DATE:${kompakt(plusTage(t.datum, 1))}`);
    } else {
      const ende = t.ende ? { datum: t.datum, zeit: t.ende } : plusMinuten(t.datum, t.beginn, ABO_DAUER_MIN);
      z.push(`DTSTART;TZID=Europe/Zurich:${lokal(t.datum, t.beginn)}`, `DTEND;TZID=Europe/Zurich:${lokal(ende.datum, ende.zeit)}`);
    }
    z.push(`SUMMARY:${textEscape(k.titel)}`);
    if (t.ort) z.push(`LOCATION:${textEscape(t.ort)}`);
    z.push(`URL:${verweis}`, `DESCRIPTION:${textEscape(verweis)}`, "END:VEVENT");
  }
  z.push("END:VCALENDAR");
  return z.map(falten).join("\r\n") + "\r\n";
}
```

- [ ] **Step 3: Tests, Commit** — `npm run check:kern` → grün; `git commit -m "feat(kalender): iCalendar für das Abo (#330)"`

### Task G3: Feed-Route, Verweis-Adresse, Anmelde-Rücksprung

**Files:**
- Create: `web/lib/supabase/anon.ts`
- Create: `web/app/api/kalender/[datei]/route.ts`
- Create: `web/app/team/[id]/termin/[terminId]/page.tsx`
- Modify: `web/middleware.ts` (Matcher schliesst `api/kalender` aus)
- Modify: `web/lib/supabase/middleware.ts` (`PROTECTED_PREFIXES` um `/team`, `/teams`)
- Modify: `web/app/team/[id]/page.tsx` + `TrainingsPlan.tsx` (`?termin=` hebt hervor, `?hinweis=termin_weg`)
- Test: `web/scripts/pruefe-kern-db.ts` (Feed über den echten Pfad der RPC)

- [ ] **Step 1: Failing DB-Test**

```ts
  await pruefe("Abo: derselbe Link, Feed ohne Ausgefallene, 28 Tage, erlischt beim Austritt, bleibt erloschen (#330)", async () => {
    const team = await serienTeam("Kern-DB-Abo");
    const anon = createClient(URL_, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const hol = async () => (await a.supabase.rpc("kalender_abo_holen", { p_team: team })).data as string;
    const token = await hol();
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal(await hol(), token, "AK 6");
    const alt = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(-29), beginn: "10:00", ende: "11:00" }));
    const rand = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(-28), beginn: "10:00", ende: "11:00" }));
    const aus = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(2), beginn: "10:00", ende: "11:00" }));
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: aus.terminId }));
    const feed = async (t: string) => (await anon.rpc("kalender_abo_termine", { p_token: t })).data as { gueltig: boolean; termine?: { id: string }[] };
    const f = await feed(token);
    assert.equal(f.gueltig, true);
    assert.deepEqual(f.termine!.map((x) => x.id), [rand.terminId], "PC 1, 5");
    assert.ok(!f.termine!.some((x) => x.id === alt.terminId));
    assert.equal((await feed("0".repeat(64))).gueltig, false, "AK 11");
    // Ein anderes Konto sieht das Abo nicht (RLS).
    assert.deepEqual((await b.supabase.from("kalender_abos").select("token")).data, []);
    // PC 9, 10: Austritt → erloschen, auch nach Wiederaufnahme.
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });   // damit das Team nicht aufgelöst wird
    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", a.id);
    await admin.from("team_members").insert({ team_id: team, user_id: a.id });
    assert.equal((await feed(token)).gueltig, false);
    assert.notEqual(await hol(), token, "AK 9: ein neuer Link");
  });
```

- [ ] **Step 2: Anon-Client**

```ts
// web/lib/supabase/anon.ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Ein Client OHNE Anmeldung — nur für den Kalender-Feed (#330). Das Abo-Token
 * ist die Berechtigung; die RPC `kalender_abo_termine` prüft es als
 * SECURITY DEFINER und gibt ausschliesslich Zeit und Ort heraus. Kein
 * Service-Role-Schlüssel ausserhalb von Seed und Aufräumen (CLAUDE.md).
 */
export function createAnonClient(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
```

- [ ] **Step 3: Route**

```ts
// web/app/api/kalender/[datei]/route.ts
import { createAnonClient } from "@/lib/supabase/anon";
import { kalenderText, type AboTermin } from "@/lib/ical";
import { oeffentlicherOriginAus } from "@/lib/origin";

/* Der Feed eines Kalender-Abos (#330). Jeder Abruf liefert den aktuellen Stand
   (PC 6). Ein ungültiger oder erloschener Link liefert einen leeren Kalender
   statt eines Fehlers: So entfernen Kalenderprogramme, die das tun, die
   Einträge beim nächsten Abruf (PC 9, OoS 8). */
export const dynamic = "force-dynamic";

const DATEI = /^([0-9a-f]{64})\.ics$/;

type Feed = { gueltig: boolean; team?: { id: string; name: string }; termine?: AboTermin[] };

export async function GET(req: Request, { params }: { params: Promise<{ datei: string }> }) {
  const { datei } = await params;
  const origin = oeffentlicherOriginAus(req);
  const m = DATEI.exec(datei);
  let feed: Feed = { gueltig: false };
  if (m) {
    const { data, error } = await createAnonClient().rpc("kalender_abo_termine", { p_token: m[1] });
    if (error) {
      console.error("[abo]", error.message);
      return new Response("Der Kalender ist gerade nicht erreichbar.", { status: 503, headers: { "Retry-After": "300" } });
    }
    feed = data as Feed;
  }
  const titel = feed.gueltig ? `Training · ${feed.team!.name}` : "KiFu";
  const text = kalenderText({
    kalenderName: feed.gueltig ? titel : "KiFu – Abo erloschen",
    titel,
    teamId: feed.team?.id ?? "",
    origin,
    termine: feed.gueltig ? feed.termine! : [],
    jetzt: new Date(),
  });
  return new Response(text, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="kifu.ics"',
    },
  });
}
```

`web/middleware.ts` Matcher: `"/((?!_next/static|_next/image|favicon.ico|api/mcp|api/kalender|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"`. Der Kommentar erhält: «`api/kalender` trägt ein Abo-Token statt einer Sitzung».

- [ ] **Step 4: Verweis und Rücksprung (PC 7, 8)** — `web/lib/supabase/middleware.ts`: `PROTECTED_PREFIXES` um `"/team"` und `"/teams"` ergänzen. Das deckt den Befund des Task-Chips «Anmelde-Rücksprung für Team- und Trainingsadressen» für den Team-Bereich ab. Vorher `git log --oneline -- web/lib/supabase/middleware.ts` prüfen, ob der Chip schon umgesetzt ist; dann nur noch den Test unten fahren.

```tsx
// web/app/team/[id]/termin/[terminId]/page.tsx
import { redirect } from "next/navigation";
import { getTeam } from "@/lib/queries/teams";
import { createClient } from "@/lib/supabase/server";

/* Der Verweis aus dem Kalenderprogramm (#330 PC 7, 8). Ohne Anmeldung führt
   die Middleware über den Login hierher zurück. Kein Mitglied → Teamübersicht;
   Termin weg → Trainingsplan mit Hinweis; sonst der Termin im Plan, auch im
   Rückblick. */
export default async function TerminVerweis({ params }: { params: Promise<{ id: string; terminId: string }> }) {
  const { id, terminId } = await params;
  if (!(await getTeam(id))) redirect("/teams");
  const supabase = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(terminId)
    ? await supabase.from("training_termine").select("id").eq("id", terminId).eq("team_id", id).maybeSingle()
    : { data: null };
  redirect(data ? `/team/${id}?termin=${terminId}` : `/team/${id}?hinweis=termin_weg`);
}
```

`app/team/[id]/page.tsx` liest `termin` und `hinweis`:
- Bei `hinweis === "termin_weg"` steht über der Liste `<Banner tone="hinweis">Diesen Termin gibt es nicht mehr.</Banner>`.
- `termin` geht als `hervorheben` an `TrainingsPlan`.
- Liegt der Termin im Vergangenen, öffnet die `Disclosure` (`key` enthält `hervorheben`, `defaultOpen` wird `true`).
- Die Karte erhält `id={t.id}`, `aria-current="true"` und `kontur border-primary`; ein `useEffect` ruft `document.getElementById(hervorheben)?.scrollIntoView({ block: "center" })`.

- [ ] **Step 5: Tests** — `npm run check:kern-db` → «Abo …» ✓. Dann per `curl` gegen den Dev-Server:

```bash
curl -s "http://localhost:3000/api/kalender/$(printf '0%.0s' {1..64}).ics" | head -12
```

Expected: `BEGIN:VCALENDAR` … `X-WR-CALNAME:KiFu – Abo erloschen`, Status 200.

- [ ] **Step 6: Commit** — `git commit -m "feat(kalender): Abo-Feed, Verweis in die Anwendung und Anmelde-Rücksprung (#330)"`

### Task G4: Oberfläche — Abo holen, im Konto einsehen und widerrufen

**Files:**
- Create: `web/lib/queries/abos.ts`, `web/lib/actions/abos.ts`
- Create: `web/components/team/AboDialog.tsx`, `web/components/team/AboKnopf.tsx`, `web/app/konto/AbosListe.tsx`
- Modify: `web/app/team/[id]/page.tsx` (Knopf «Kalender abonnieren»), `web/app/konto/page.tsx` (Karte «Kalender-Abos»)

**Interfaces:**
- Produces:
  - `getMeineAbos(): Promise<{ id: string; team: { id: string; name: string }; url: string; webcal: string }[] | null>`
  - `holeAboAktion(teamId) → { ok: true; url; webcal } | Fehler`
  - `widerrufeAboAktion(aboId) → { ok: true } | Fehler`

- [ ] **Step 1: Query und Actions**

```ts
// web/lib/queries/abos.ts
import { createClient } from "@/lib/supabase/server";
import { oeffentlicherOrigin } from "@/lib/origin";
import { aboPfad } from "@/lib/ical";

/** Die gültigen Abos des angemeldeten Kontos mit ihrem Team (#330 AK 4, 5).
 *  `null`: liess sich nicht laden. Die RLS zeigt nur eigene Abos. */
export async function getMeineAbos() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("kalender_abos").select("id, token, teams ( id, name )").order("created_at");
  if (error) return null;
  const origin = await oeffentlicherOrigin();
  return ((data ?? []) as unknown as { id: string; token: string; teams: { id: string; name: string } }[]).map((a) => ({
    id: a.id,
    team: a.teams,
    ...aboLinks(origin, a.token),
  }));
}

export function aboLinks(origin: string, token: string) {
  const url = `${origin}${aboPfad(token)}`;
  return { url, webcal: url.replace(/^https?:/, "webcal:") };
}
```

```ts
// web/lib/actions/abos.ts
"use server";

import { revalidatePath } from "next/cache";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";
import { oeffentlicherOrigin } from "@/lib/origin";
import { aboLinks } from "@/lib/queries/abos";
import { NICHT_GEFUNDEN } from "@/lib/kern/ergebnis";

export async function holeAboAktion(teamId: string): Promise<{ ok: true; url: string; webcal: string } | { ok: false; error: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const { data, error } = await a.supabase.rpc("kalender_abo_holen", { p_team: teamId });
  if (error || !data) return { ok: false, error: NICHT_GEFUNDEN.team };
  revalidatePath("/konto");
  return { ok: true, ...aboLinks(await oeffentlicherOrigin(), data as string) };
}

export async function widerrufeAboAktion(aboId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const { error } = await a.supabase.from("kalender_abos").delete().eq("id", aboId);
  if (error) return { ok: false, error: "Das Abo liess sich nicht widerrufen. Bitte versuche es noch einmal." };
  revalidatePath("/konto");
  return { ok: true };
}
```

- [ ] **Step 2: `AboDialog.tsx`** (AK 1–3, 5)

```tsx
"use client";

import { Copy, ExternalLink, ShieldAlert } from "lucide-react";
import { Button, ButtonLink, Dialog, TextField } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";

/* Der persönliche Abo-Link (#330). Er ist ein Geheimnis: Wer ihn hat, sieht
   Zeit und Ort der Termine (AK 3). Anleitung für die vier genannten
   Kalenderprogramme (AK 2). */
export function AboDialog({
  links,
  teamName,
  onClose,
}: {
  links: { url: string; webcal: string } | null;
  teamName: string;
  onClose: () => void;
}) {
  const melde = useSnackbar();
  async function kopieren() {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.url);
      melde("Abo-Link kopiert.");
    } catch {
      melde("Kopieren ging nicht — markiere den Link und kopiere ihn von Hand.");
    }
  }
  return (
    <Dialog open={links !== null} onClose={onClose} title={`Kalender abonnieren · ${teamName}`} actions={<Button variant="text" onClick={onClose}>Schliessen</Button>}>
      <p className="flex items-start gap-2">
        <ShieldAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-error" />
        Dieser Link ist persönlich. Gib ihn nicht weiter: Wer ihn hat, sieht Zeit und Ort der Trainings dieses Teams.
      </p>
      <div className="mt-4 flex items-end gap-2">
        <TextField label="Abo-Link" value={links?.url ?? ""} readOnly onFocus={(e) => e.currentTarget.select()} />
        <Button variant="tonal" onClick={kopieren}><Copy size={16} aria-hidden /> Kopieren</Button>
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 type-body-small">
        <li>
          <strong className="text-on-surface">Apple Kalender:</strong>{" "}
          <ButtonLink variant="text" size="sm" href={links?.webcal ?? "#"}><ExternalLink size={14} aria-hidden /> Direkt öffnen</ButtonLink>
          {" "}oder Ablage → Neues Kalenderabonnement → Link einfügen.
        </li>
        <li><strong className="text-on-surface">Google Kalender:</strong> Weitere Kalender → Per URL → Link einfügen.</li>
        <li><strong className="text-on-surface">Outlook:</strong> Kalender hinzufügen → Aus dem Internet abonnieren → Link einfügen.</li>
        <li><strong className="text-on-surface">Proton Calendar:</strong> Kalender hinzufügen → Über Link hinzufügen → Link einfügen.</li>
      </ul>
      <p className="mt-4 type-body-small text-on-surface-mittel">
        Unter «Konto» findest du deine Abos wieder und kannst sie widerrufen. Wie oft dein Kalenderprogramm nachsieht, bestimmt es selbst.
      </p>
    </Dialog>
  );
}
```

`AboKnopf.tsx` (Client) ruft `holeAboAktion(teamId)` im `startTransition` auf. Bei Erfolg öffnet es den `AboDialog` mit den Links, sonst meldet die Snackbar. `page.tsx` rendert `<AboKnopf teamId={id} teamName={team.name} />` rechts neben «Termin festlegen».

- [ ] **Step 3: Konto** — In `app/konto/page.tsx` nach der Karte «KI-Zugänge» eine `Card mb-4 p-6` «Kalender-Abos» einfügen. Sie enthält einen Einleitungssatz («Deine persönlichen Links, mit denen dein Kalenderprogramm die Trainingszeiten deiner Teams abonniert.») und `abos === null ? <Banner tone="fehler">Deine Abos liessen sich gerade nicht laden.</Banner> : <AbosListe abos={abos} />`. `getMeineAbos()` kommt in das bestehende `Promise.all`.

`AbosListe.tsx` spiegelt `KiZugaengeListe`:
- Leer: `<Leerzustand dicht icon={CalendarDays} titel="Noch keine Abos">Hole dir im Trainingsplan eines Teams den Link «Kalender abonnieren».</Leerzustand>`
- Jede Zeile trägt den Teamnamen und die Tooltip-Knöpfe «Link anzeigen» (öffnet den `AboDialog` mit den Links des Abos, AK 5) und «Abo widerrufen» (Icon `Unlink`).
- Widerrufen braucht eine Bestätigung (AK 8): `<Dialog title="Abo widerrufen?">`, Text «Der Link liefert danach keine Termine mehr. Einen neuen holst du dir jederzeit im Team.», Knopf `variant="danger"` «Widerrufen». Danach `router.refresh()` und die Meldung «Abo für «{team}» widerrufen.».

- [ ] **Step 4: E2E**
  1. Im Team «Kalender abonnieren» → Link kopieren, Warnung sichtbar.
  2. Erneut holen → derselbe Link (AK 6).
  3. `curl` des Links → VEVENTs mit `Training · <Team>`, Ort, Verweis.
  4. Im Konto erscheint das Abo; «Link anzeigen» zeigt denselben Link; widerrufen → `curl` liefert den leeren Kalender.
  5. Den Verweis ohne Anmeldung öffnen: Login, danach der hervorgehobene Termin (auch einer von vor zwei Wochen, im aufgeklappten Rückblick).
  6. Den Verweis eines entfernten Termins öffnen → Hinweis «Diesen Termin gibt es nicht mehr.».
  7. Ein Konto ohne Mitgliedschaft öffnet den Verweis → Teamübersicht.
  8. Ein echtes Programm abonniert den `webcal:`-Link, etwa Apple Kalender auf dem Mac des Users. Diese Abnahme macht der User auf Staging, weil der lokale Server von aussen nicht erreichbar ist. Das im PR vermerken.
- [ ] **Step 5: Commit, PR** — `feat(kalender): Kalender-Abo holen, einsehen und widerrufen (#330)`; PR «feat(kalender): Kalender-Abo (#330)».

---

## Task Z: Produktdoku und Release — bei JEDEM Prod-Release (Teil A, B, C …)

Pflicht laut CLAUDE.md und Memory «Produktdokumentation». Eine auf Prod sichtbare Änderung, die nicht in `docs/produkt/` steht, gilt als unfertig.

- [ ] **Step 1: Produktdoku nachführen** (Prosa, ohne Dateinamen und DB-Begriffe; «Stand»-Datum oben):
  - `docs/produkt/team-bereich.md`, Abschnitt «Termine und Trainingsplan»:
    - Teil A: Termine ohne Training, Beginn und Ende, «Noch kein Training», Zuordnen/Kopie/Verschieben, «eingeplant», der Termin bleibt beim Löschen des Trainings. Die Sätze zum Ansetzen, zu «kein Termin ohne Training» und «keine Dauer» streichen.
    - Teil B: Serien, Reichweite, Abweichungen, entfallende Termine. «Serientermine gibt es nicht» streichen.
    - Teil C: Verantwortliche, «Meine Termine». «hält nicht fest, wer im Einsatz war» streichen.
    - Teil D: Ausfall. «Einen Abgesagt-Zustand kennt die Anwendung nicht» streichen.
    - Teil F: Monatsüberblick.
    - Teil G: Kalender-Abo. «Kalender-Export gibt es nicht» streichen.
  - `team-bereich.md` «Was beim Ausscheiden passiert»: Das Austragen aus anstehenden Terminen (C) und das Erlöschen der Abos (G) ergänzen. «Bekannte Grenzen» neu fassen: Aus OoS von Epic und Stories nur das aufnehmen, was ein Trainer im Betrieb bemerkt, etwa keine Erinnerungen, keine Tages- oder Wochenansicht, keine Ferien-Ausnahmen, die Kalenderprogramme rufen in eigenem Takt ab.
  - `docs/produkt/konto-und-zugang.md`:
    - die Zustimmungsliste (L260–268) wortgleich zu `ZUGANG_DARF` nachführen
    - den Abschnitt «Assistent in Teams» (L227–249) auf die neuen Werkzeuge umstellen
    - den Satz L361–364 zu Serien und Absagen streichen oder berichtigen
    - bei Teil C «Konto löschen» um die Anonymisierung der Verantwortlichen ergänzen
    - bei Teil G einen Abschnitt «Kalender-Abos» ergänzen
  - `docs/produkt/trainings.md` L258–260: «ansetzen» → «einem weiteren Termin als Kopie zuordnen».
  - Die Stories #322–#330 bleiben Aufträge: nach dem Prod-Merge als erledigt schliessen (Closes-Keywords im Release-PR), nie nachkorrigieren (Memory «Stories sind Aufträge»).
- [ ] **Step 2: Release-PR develop → main** — erst nach **ausdrücklicher Freigabe des Users im Moment** (Memory «Prod nur mit Freigabe»). Der Body enthält die Closes-Keywords der Stories dieses Releases, etwa `Closes #322` und `Closes #323`. Nach dem Merge: das GitHub-Release mit `--target main` und Notes aus einer Datei anlegen, dazu die Versionsnummer in `web/package.json` (Muster PR #319).
- [ ] **Step 3: Nach dem Deploy**
  - Smoke-Test auf ki-fu.ch.
  - Bei Teil B zuerst die Staging-Zählung (B1 Step 1) wiederholen, falls seit der Zählung Zeit vergangen ist.
  - Bei Teil G `sync-staging` einmal laufen lassen, dann prüfen, dass `kalender_abos` auf Staging leer ist.
  - Memory `kalender-epic-321.md` nachführen: welcher Teil live ist und seit wann.
