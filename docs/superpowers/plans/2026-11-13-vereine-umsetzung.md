# Vereine (Epic #575) – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Epic Vereine (#575, Stories #577–#585 und #587–#589) in der richtigen Reihenfolge nach `develop` und in einem einzigen Release nach Produktion bringen.

**Architecture:** Jedes Team gehört einem Verein, Spieler:innen gehören dem Verein und kommen über eine Zuordnung in Teams. Rechte gelten nach Ort: im Team als Mitglied, im Bereich «Verein» als Vereinsverwaltung. Die Stories landen einzeln auf `develop`, jede mit genau ihrer Migration; Produktion bekommt alles zusammen in einem Wartungsfenster.

**Tech Stack:** Next.js 15 (Server Actions, server-only Supabase-Clients), Supabase/Postgres (RLS, `SECURITY DEFINER`-RPCs, Trigger), MCP-Server unter `web/lib/mcp`, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-29-vereine-architekturplan.md` (im Folgenden «AP»). Fachlich massgeblich sind Epic #575 und die Stories; wo Story und AP auseinandergehen, gilt die Story.

**Was dieser Plan festlegt und was nicht:** Er legt die **Reihenfolge**, die **Gates** zwischen den Schritten und die **verbindlichen Muster** fest. Die Lösung (Tabellen, Signaturen, Texte, Testfälle) steht im AP; dieser Plan verweist mit §-Nummern darauf und schreibt sie nicht ab. Wer einen Schritt umsetzt, liest die genannten AP-Abschnitte und die Story.

---

## Global Constraints: verbindliche Muster

Jeder Schritt dieses Plans hält diese Muster ein. Sie stammen aus dem AP (Verweis in Klammern) und aus `CLAUDE.md`.

### Architektur

1. **Rollen nach Ort** (AP §4, §7): Jede schreibende RPC gehört zu genau einem Ort und prüft genau eine Rolle.
   - Team-Ort: RPC bekommt `p_team`, prüft `ist_team_mitglied(p_team)`, bei Spieler:innen zusätzlich `spieler_im_team`.
   - Verein-Ort: RPC heisst `verein_*`, bekommt `p_verein`, prüft `ist_verein_verwaltung` (Ansichten: `ist_verein_mitglied`).
   - Kein Prädikat und keine RPC verknüpft Mitglied **oder** Verwaltung. Gemeinsame Logik liegt in `*_kern`-Funktionen ohne API-Recht.
   - Seiten unter `/team/[id]/…` zeigen keine Verwaltungsfunktionen; Verwaltungsfunktionen liegen nur unter `/verein/…`.
2. **Zugriff nur über RLS und DEFINER-RPCs** (AP §4.2): Die Rechteprüfung ist die erste Anweisung jeder RPC. Keine Policy hat eine Verwaltungsklausel; was die Verwaltung ausserhalb ihrer Teams sieht, liefern nur `verein_*`-RPCs. Supabase bleibt server-only.
3. **Vereinsverwaltung nie per KI** (AP §4.1, §5.5): Jede `verein_*`-RPC, `verein_gruenden` und `delete_account` rufen als erste Anweisung `nur_in_der_anwendung()` auf. Unter `web/lib/mcp/` steht kein Aufruf einer `verein_*`-RPC.
4. **Sperrordnung** (AP §3, §4.1): Verein → Person → Teams aufsteigend nach UUID → `spieler`-Zeile → Termin-Zeile. Stufen auslassen ist erlaubt, umkehren nicht. Jede löschende RPC nimmt ihre Sperren vor dem DELETE.
5. **Regeln sitzen in der Datenbank** (AP §3.10, §5.1): Grenzen (30/100/1000, 50/30), Eindeutigkeit und «höchstens ein Verein je Person» erzwingen Trigger. Jede TS-Konstante nennt ihren SQL-Zwilling.
6. **Abweisungen** (AP §5.2): Marker (Exception) nur für Regeln ohne Nutzdaten; Abweisungen mit Namen kommen als `jsonb`-Status. Keine Meldung nennt den Verein einer anderen Person. Listen kommen als `jsonb` zurück (`max_rows`).
7. **Zugehörigkeit ist abgeleitet** (AP §0): Vereinsmitglied ist, wer einem Team oder der Verwaltung angehört; es gibt kein Rollenfeld und keine Plattform-Admin-Rolle.
8. **Expand jetzt, Contract nach dem Release** (AP §3.8, §6.1): Bis zum Nachlauf N1 keine neue Regel als `CHECK` oder `NOT NULL`, kein Drop von `spieler.team_id` oder `spieler.probe_seit`. Forward-only: keine destruktive Migration, keine Prod-Resets.

### Engineering

1. **Je Story genau die Migration aus AP §3.** Innerhalb der Datei gilt die Reihenfolge Tabellen → Spalten → Funktionen → Policies → Trigger → Grants → Backfill. Grants stehen ausdrücklich in der Migration; neue Tabellen beginnen mit `revoke all … from anon, authenticated`; Funktionen ohne API-Zweck bekommen `revoke all … from public, anon, authenticated`. Signatur- oder Rückgabewechsel: `drop function` + `create function` in derselben Migration.
2. **Zeitstempel folgen der Merge-Folge.** `db push` läuft ohne `--include-all` und weist eine Migration ab, deren Zeitstempel vor einer schon angewandten liegt. Vor jedem Merge prüfen: Die Migration des PR trägt den spätesten Zeitstempel auf `develop`; sonst umbenennen.
3. **Aufrufer ziehen im selben PR nach.** Ändert oder entfernt eine Story eine RPC, passt derselbe PR alle Aufrufer an: Kern (`web/lib/kern`), Actions, MCP-Werkzeug und die Wächter-Tabelle in `web/scripts/pruefe-kern.ts`. Nach jedem Merge ist `develop` lauffähig und Staging in sich stimmig (AP §5.6).
4. **Test zuerst, am richtigen Ort** (AP §5.5, §6.7):
   - Fachregeln über den Kern: `web/scripts/pruefe-kern-db.ts` (`npm run check:kern-db`).
   - Alles mit zwei Verbindungen oder Altdaten: psql-Tests unter `supabase/tests/` (`rennen.sql` mit `dblink`, `vereine_nachziehen.sql`, `ortspruefung.sql`).
   - Prod-Weg der Migrationskette: CI-Job «Prod-Weg» mit `prodweg_bestand.sql` und `prodweg_pruefen.sql`.
   - Namens- und Ortsregeln: grep-Wächter in `npm run check:kern`.
   - Oberfläche: E2E lokal mit Wegwerfkonten (AP §9, E2E-Pfad), danach auf Staging.
5. **Pflicht-Inventar fortschreiben** (AP §5.5): Die Liste entsteht im PR zu Story 1; jeder Story-PR führt sie nach.
6. **Oberfläche:** Styleguide zuerst (`web/app/(app)/styleguide`, `web/components/ui`); Neues begründen und dort ergänzen. Wortwahl: «aufnehmen» (nie «einladen»), «Schnuppertraining», «Spieler:in». Nach Aufnahme, Austritt, Gründung und Löschen `revalidiereVerein()`.
7. **Arbeitsweise** (`CLAUDE.md`): ein Worktree je Story mit Basis `develop`; Commit je Story nach Code-Test und E2E; PR auf `develop`, sofort `/code-review`; kein Auto-Merge; Prod-Schritte und jeder Sync nur mit Freigabe im Moment; Sprache Deutsch.

---

## Review Focus

Diese fünf Fälle nennt der AP nicht als Testfall. Jeder ist einer Phase zugeordnet und hat dort einen Prüfschritt.

1. **Migration auf Prod während des Einfrierens.** Ein Hotfix mit Migration bekäme einen späteren Zeitstempel als die Vereine-Migrationen; `db push` wiese sie am Release-Tag ab. Erwartet: Der Release scheitert nicht daran. → Regel in «Einfrieren», Prüfschritt in Phase G und R.
2. **Alte Clients am Release-Tag.** Offene Browser-Tabs und verbundene KI-Clients kennen die neuen Actions und Werkzeugnamen nicht. Erwartet: eine verständliche Meldung, kein stiller Fehler und keine falsche Wirkung. → Prüfschritt in Phase 13 und R.
3. **Sync mitten im Epic.** Jeder Sync ersetzt die Staging-Daten: selbst gegründete Test-Vereine und das Testkonto sind weg, alle Teams hängen wieder unter «FC Wyler». Erwartet: Staging ist danach benutzbar, ohne Handarbeit an der Datenbank. → Prüfschritt in Phase 1, Regel in «Ablauf je Story-PR».
4. **Eine Person mit beiden Rollen.** Wer der Verwaltung angehört und Mitglied eines Teams ist, darf im Team nichts mehr als ein Mitglied und sieht dort keine Verwaltungsaktionen. Die Ortsprüfung deckt nur die Datenbank. → E2E-Schritt in Phase 5 und 6.
5. **Abbruch mitten in der Migrationskette am Release-Tag.** `db push` wendet jede Datei einzeln an; ein Abbruch lässt die früheren angewandt. Erwartet: Die Sperre bleibt, der Fehler wird vorwärts behoben, niemand schreibt in den halben Stand. → Ablauf in Phase R.

---

## Reihenfolge im Überblick

```
P0  Sauberer Schnitt        offenen Stand von develop nach main bringen
V0  Vorlauf                 Sync, Reset, psql-Testlauf; danach nach main
──  Einfrieren beginnt mit dem Merge von Story 1 ─────────────────────────
K   Konto-ID                eine Abfrage auf Prod, vor dem Merge von Story 1
1   #577 FC Wyler als erster Verein
2   #578 Doppelerfassung verhindern
3   #579 Zuordnen und Herausnehmen
5   #581 Verwaltung führt Teams und Trainer:innen
6   #582 Verwaltung führt den Spielerbestand
7   #583 Link, Abo, Abholung über mehrere Teams
8   #584 Schnuppertraining
4   #580 Spieler:innen des Vereins überblicken
9   #585 CSV-Import in den Spielerbestand
11  #587 Verein gründen und löschen
12  #588 Konten ohne Verein
13  #589 KI-Assistent und Vereine
D   Doku und Feedback-Wissen
A   Abschluss-PR            Validierung, PUBLIC_TABLES
G   Generalprobe            Prod-Weg auf Staging
R   Release                 Wartungsfenster, develop → main
──  Einfrieren endet ─────────────────────────────────────────────────────
C   Aufräumen               CI-Job «Prod-Weg» entfernen
N1  Nachlauf                Contract, frühestens zwei Wochen nach R
```

### Warum diese Reihenfolge

| Schritt | kommt nach | Grund |
|---|---|---|
| V0 | P0 | V0 geht nach `main`; vorher muss dort alles liegen, was ohnehin fertig ist. |
| 1 | V0, K | Der Backfill braucht die Konto-ID als Default; eine auf Staging angewandte Migration wird nicht mehr editiert (AP §6.1, Schritt −1). Der Sync muss mit vorauseilendem `develop` umgehen können. |
| 2 | 1 | Eindeutigkeit je Verein braucht `spieler.verein_id`. |
| 3 | 2 | Zuordnen prüft den Namensschlüssel; das Herausnehmen ersetzt das Entfernen. |
| 5 | 3 | Epic: Story 5 setzt Story 3 voraus. Der Drop von `team_aufloesen_wenn_leer` liegt hier, damit kein Team ohne Trainer:in unsichtbar wird. |
| 6 | 3, 5 | Löschen und Bestand am Verein-Ort brauchen den Bereich «Verein». Zwischen 3 und 6 löscht auf `develop` niemand eine Spieler:in. |
| 7 | 3, 6 | Ein Link über alle Zuordnungen; die Verwaltung ruft ihn seit Story 6 ab. |
| 8 | 3 | Der Schnupper-Status liegt auf der Zuordnung. |
| 4 | 5, 6 | Die Vereinsliste für alle zeigt, was Story 5 und 6 einführen. |
| 9 | 4 | Der Import gleicht mit dem ganzen Bestand ab und ersetzt den Team-Import. |
| 11 | 5 | Gründen braucht die Verwaltungssicht; vorher gibt es nur den FC Wyler. |
| 12 | 11 | Die Grenzen 50/30 fallen mit Aufnahme oder Gründung. |
| 13 | 5, 7 | Die KI nennt Verein, weitere Teams und den Link über alle Teams. Sie kommt zuletzt, weil dann alle Werkzeuge ihren endgültigen Stand haben. |
| A | 13, D | Die Validierungs-Migration muss den spätesten Zeitstempel tragen (AP §3). |
| G | A | Die Generalprobe soll die ganze Kette prüfen, auch die Validierung. |
| N1 | R + 2 Wochen | NOT NULL und Drops brächen vorher den Sync (AP §3.8). |

### Einfrieren (vom Merge von Story 1 bis zum Release)

- [ ] `develop` enthält ab Story 1 nur noch Vereine-Arbeit. Nichts anderes wird nach `develop` gemergt; #601, #598, #599, #482, #504/#505 und #514 warten.
- [ ] `develop` → `main` gibt es in dieser Zeit nicht.
- [ ] Ein dringender Prod-Fehler geht als Hotfix: Branch von `main`, PR auf `main`, danach `main` nach `develop` zurückmergen.
- [ ] **Ein Hotfix enthält keine Migration.** Ist eine unvermeidlich, wird vor dem Merge entschieden, wie der Release damit umgeht (Review Focus 1); der Entscheid steht dann im Hotfix-PR.
- [ ] Stories werden nacheinander umgesetzt. Sie teilen sich `pruefe-kern-db.ts`, `web/lib/kern/spieler.ts` und die Spielerlisten-Komponenten; parallele Branches kosten mehr, als sie sparen.

---

## Ablauf je Story-PR

Jede Phase 1–13 läuft nach dieser Schablone. Die Phasen unten nennen nur, was davon abweicht oder dazukommt.

- [ ] **1. Eingang:** Vorgänger-PR ist auf `develop` gemergt, `deploy-staging` war grün. Worktree mit Basis `develop` anlegen.
- [ ] **2. Lesen:** Story-Issue und die AP-Abschnitte der Phase.
- [ ] **3. Tests zuerst:** die Testfälle der Phase (AP §6.7, Nummern unten) dort anlegen, wo sie hingehören (Muster «Test zuerst»), und scheitern sehen.
- [ ] **4. Migration:** die Datei(en) der Phase aus AP §3; danach `npm run gen:types`.
- [ ] **5. Zwillinge und Texte:** TS-Konstanten, Marker und Meldungstexte (AP §5.1–§5.3).
- [ ] **6. Kern, Actions, MCP:** alle Aufrufer geänderter RPCs im selben PR (Muster 3).
- [ ] **7. Oberfläche:** zuerst die Bausteine im Styleguide, dann die Seiten. Vorlage ist das Board «UX/UI-Konzept».
- [ ] **8. Wächter und Inventar:** `check:kern`-Wächter und Pflicht-Inventar nachführen.
- [ ] **9. Prüfen lokal:** `npm run typecheck`, `npm run check:kern`, `npm run check:kern-db`, psql-Tests, dann die E2E-Schritte der Phase mit Wegwerfkonten.
- [ ] **10. Zeitstempel prüfen** (Muster 2), Commit, PR auf `develop`, `/code-review`, Befunde beheben.
- [ ] **11. Merge**, sobald die CI grün gemeldet ist. `deploy-staging` abwarten.
- [ ] **12. Staging prüfen:** die Kern-AK der Phase auf staging.ki-fu.ch. Nach einem Sync zuerst das Testkonto neu anlegen und in ein Team des FC Wyler aufnehmen.
- [ ] **13. Ausgang:** Kern-AK erfüllt, Zwischenstand wie unten beschrieben, nichts sonst gebrochen.

---

## Phasen

### P0 – Sauberer Schnitt

**Ziel:** `main` enthält alles, was auf `develop` schon fertig ist. Heute liegt dort #596 (Eingrenzung am privaten Link) unveröffentlicht.

- [x] Produktdoku, `feedback-triage.md` und Release-Text für den offenen Stand nachführen.
- [x] Release `develop` → `main` wie gewohnt, mit GitHub-Release.

**Ausgang:** `git log origin/main..origin/develop` zeigt nur noch Doku zu Vereine.

### V0 – Vorlauf (AP §6.1, §6.2, §5.5)

**Ziel:** Staging lässt sich syncen, obwohl `develop` vorauseilt; der Prod-Weg lässt sich proben; psql-Tests laufen in der CI.

Reihenfolge:
- [x] psql-Testlauf in `pr-checks.yml` für `supabase/tests/*.sql`, mit `ortspruefung.sql` und einem Selbsttest des `dblink`-Musters in `rennen.sql`.
- [x] `sync-staging.yml`: Staging-eigene Tabellen vor dem Restore leeren; nach dem Restore `staging_nach_sync()` aufrufen, sofern vorhanden.
- [x] `reset-staging.yml` neu: `workflow_dispatch` mit Bestätigung `reset`, nur gegen Staging.
- [x] PR auf `develop`, dann **Release nach `main`**. Grund: GitHub löst `workflow_dispatch` nur aus, wenn die Workflow-Datei auf dem Default-Branch liegt; `reset-staging.yml` wäre sonst nicht startbar. V0 ändert weder Schema noch Anwendung.
- [x] Probelauf 1 (Reset, liest nichts aus Prod): `reset-staging.yml` von `main`, am 13.11.2026 Lauf 43441286569, grün in 49 s; alle 111 Migrationen von `main` wurden neu eingespielt, Storage-Policies und `pg_cron` kamen ohne Rechtefehler zurück, die Auth-Einstellungen im Dashboard blieben bestehen (AP §11 F6).
- [x] Probelauf 2 (Sync, Freigabe, liest Prod): `sync-staging.yml` mit `--ref develop`, am 13.11.2026 Lauf 43441659454, grün in 3 min 16 s; Secrets und Bestätigung greifen vom Branch aus (AP §11 F2). Reihenfolge Reset, dann Sync: so genügt ein einziger Zugriff auf Prod statt zwei.

**Ausgang:** erfüllt am 13.11.2026. F2 und F6 sind beantwortet; der Reset löscht alle Konten in `auth`, nach dem Sync gelten die Konten aus Prod, und das Staging-Testkonto muss neu angelegt werden. Der Weg der Generalprobe bleibt wie geplant.

### K – Konto-ID (AP §6.1 Schritt −1, §6.4)

- [x] Mit Freigabe im Moment: nur die Zeile `verwaltung_konto` aus AP §6.4 auf Prod abfragen. Das Ergebnis ist eine Konto-ID, keine Personendaten.
- [x] Die ID geht als Default in `vereine_nachziehen` der Fundament-Migration. Eine E-Mail-Adresse steht nirgends im Repo.

**Ausgang:** Die ID liegt vor, bevor der PR zu Story 1 gemergt wird.

**Erledigt** am 13.11.2026: Die Konto-ID steht als Default in `vereine_nachziehen`; der Job «Verwaltungskonto im Backfill eingesetzt» wacht weiter gegen einen Rückfall auf den Platzhalter.

### Phase 1 – #577 FC Wyler als erster Verein

**AP:** §3.1, §3.2, §3.3 (Grundfassung der Trigger), §3.10, §6.3, §6.7, §7.2. **Migrationen:** `vereine_fundament`, `spieler_ueber_zuordnung`.

Zusätzlich zur Schablone, in dieser Reihenfolge:
- [ ] CI-Job «Prod-Weg» mit `prodweg_bestand.sql` (Bestand im alten Schema) und `prodweg_pruefen.sql` anlegen; dazu `vereine_nachziehen.sql`.
- [ ] Fundament-Migration mit Backfill, `meine_vereinslage()` und `nur_in_der_anwendung()`, danach die zweite Datei mit den Lesepfaden über `team_spieler` und der Teamgrenze 100. Die Grenze kommt bewusst erst in der zweiten Datei, nach dem Backfill.
- [ ] `pruefe-kern-db.ts` auf **einen** Test-Verein je Lauf umstellen (`testVerein()`), alle Team-Inserts per `git grep` finden, Aufräumen in der Reihenfolge Teams → Spieler:innen → Vereine → Konten.
- [ ] Die vier Web-Leser auf `team_spieler` umstellen, ohne Verhaltensänderung (Gleichwertigkeits-Gate).
- [ ] `create_team` nur für die Verwaltung; `delete_account` mit Status `letzte_verwaltung`, den die Action anzeigt.
- [ ] Oberfläche: Vereinsname im Kopf des Teams, Hinweis an Stelle von «Team anlegen».
- [ ] Pflicht-Inventar anlegen.

**Testfälle (AP §6.7):** 1, 2, 3 (erster Teil), 26.

**Zwischenstand auf `develop`:** Es gibt den Verein, aber noch keinen Bereich «Verein». Teams legt nur das Verwaltungskonto an und wird dabei Mitglied (gilt bis Phase 5). Der Team-Import bleibt bis Phase 9, mit den neuen Grenzen.

**Ausgang, zusätzlich:**
- [ ] Sync aus `develop` (Freigabe). Danach hängen alle Teams unter «FC Wyler», jede Spieler:in hat genau ihre bisherige Zuordnung, der Verein hat genau eine Verwaltung; die Prüfabfragen aus AP §6.5 ergeben 0.
- [ ] Review Focus 3: Testkonto nach dem Sync neu anlegen und aufnehmen; Staging ist ohne Eingriff in die Datenbank benutzbar. Den Weg dafür im PR festhalten.

### Phase 2 – #578 Doppelerfassung verhindern

**AP:** §3.3 a, §4.4 (`spieler_aufnehmen`, `spieler_aendern`). **Migration:** `spieler_eindeutig_verein`.

- [ ] Prüfung des Namensschlüssels vor den Grenzen; Abweisung als `jsonb`-Status mit den Teams.
- [ ] `spieler_aendern` bekommt `p_team`; Web-Action und MCP-Werkzeug ziehen nach.

**Testfälle:** 5, 6 (`rennen.sql`), 7. **Zwischenstand:** keiner.

### Phase 3 – #579 Zuordnen und Herausnehmen

**AP:** §3.3 b–e, §3.7, §4.3 (Zuordnen, Herausnehmen), §4.4, §7.6. **Migrationen:** `zuordnung_invarianten` (FKs `not valid`), `vereine_bestand`. Die Datei `_validieren` gehört **nicht** hierher (Phase A).

Zusätzlich, in dieser Reihenfolge:
- [ ] Invarianten und Trigger vollständig; `spieler.team_id` wird nullable und bleibt bis Phase 7/8 als «erstes Team» gepflegt, an einer Stelle (`team_spieler_nachher`), nicht mehr von den RPCs (AP §3.7, berichtigt mit Story 3).
- [ ] RPCs zum Zuordnen (einzeln und gesammelt) und Herausnehmen mit `p_stand`; `spieler_entfernen(uuid)` fällt.
- [ ] **MCP im selben PR:** Das Werkzeug `spieler_entfernen` wird durch `spieler_aus_team_nehmen` ersetzt, weil die RPC wegfällt (Muster 3). Die Abnahme der KI-Texte bleibt bei Phase 13.
- [ ] `termin_teilnehmer` und `spiel_teilnehmer` mit `nicht_mehr_im_team`; Nachtragen an begonnenen Terminen prüft weiter gegen den festgehaltenen Stand.
- [ ] Erwartete Spielerzahl: Die erste Zuordnung in ein Team ohne Spieler:innen wirkt wie das erste Erfassen; die Verwaltung erfährt die Zahl der Termine (#579 AK 23, PC 13).
- [ ] Oberfläche: Team-Spielerliste mit «Aus dem Team nehmen» und weiteren Teams; Grundseite `/verein/spieler` nur für die Verwaltung, erreichbar über einen Verweis auf `/teams`.

**Testfälle:** 8, 9, 10, 11, 12 (Teil Mitglied), 29.

**Aus dem Review von Story 1:** `rennen.sql` braucht einen eigenen Fall für die Teamsperre in `team_spieler_vorher` (der heutige Fall beweist nur die Vereinssperre). `ladeSpielerliste` muss `kader_spieler` auf das Kontextteam eingrenzen (`web/lib/kern/spieler.ts`, Kader-Embed), sobald eine Spieler:in in mehreren Teams steht.

**Nicht in Phase 3:** Herausnehmen durch die Verwaltung (`verein_spieler_aus_team_nehmen`, AK 11, 17 → Phase 5), Löschen aus dem Verein (Phase 6), Suche und Lesesicht für Mitglieder auf `/verein/spieler` (Phase 4), Schnuppern zuordnen (`p_schnuppern`, Phase 8), die Datei `_validieren` (Phase A).

**Zwischenstand auf `develop`:** Niemand löscht eine Spieler:in (bis Phase 6). Ein aufgelöstes Team lässt seine Spieler:innen ohne dieses Team im Verein. `/verein` leitet auf `/verein/spieler`, Mitglieder ohne Verwaltung auf `/teams` (bis Phase 5). Der private Link zeigt bei mehreren Teams nur die Termine des ersten Teams, eine Spieler:in ohne Team hat einen Link ohne Team, und Feedback über ihren Link gilt als ungültig (bis Phase 7). Link abrufen und erneuern sowie Schnuppern schalten gehen nur im ersten Team; in den weiteren Teams zeigt die Team-Spielerliste darum keinen Link-Knopf (bis Phase 7/8). Ein Mitglied eines weiteren Teams sieht in der `spieler`-Zeile `team_id` = die ID des ersten Teams (hingenommen bis Phase 7/8). Das Einschalten des Schnupperns weist schon jetzt ab, wer mehr als einem Team zugeordnet ist (`SCHNUPPERN_MEHRERE_TEAMS`, AP §5.3, aus Phase 8 vorgezogen); die Team-Spielerliste zeigt dann statt der Checkbox den Satz.

### Phase 5 – #581 Verwaltung führt Teams und Trainer:innen

**AP:** §3.6, §4.3 (Verwaltung), §7.1, §7.4, §7.5. **Migration:** `vereine_verwaltung`.

Zusätzlich:
- [x] Bereich «Verein» vollständig: Übersicht, `/verein/team/[teamId]`, `/verein/verwaltung`.
- [x] `create_team` und `loese_team_auf` fallen; Team anlegen ohne Mitgliedschaft; `team_aufloesen_wenn_leer` fällt.
- [x] **Bereich-Wechsler** in der Seitenleiste kommt hier, weil der Bereich «Verein» ab jetzt für alle Vereinsmitglieder besteht. Die Verwaltung sehen Trainer:innen im Kopf von «Verein › Teams».
- [x] Bausteine `PersonAufnehmen` und `NamenBestaetigen` zuerst in den Styleguide.
- [x] Review Focus 4: E2E mit einem Konto, das Verwaltung **und** Mitglied ist. Im Team erscheinen keine Verwaltungsaktionen, und die Team-RPCs geben ihm nicht mehr als einem Mitglied. (Datenebene belegt in `vereine_verwaltung.sql`; im Browser bestanden.)
- [x] **Aus dem Review von Story 3:** `termin_kader_setzen` (`supabase/migrations/20261018130000_termin_kader.sql`, letzte Fassung) und `termin_der_serie_folgen` (`supabase/migrations/20261031120000_treffpunkt_training.sql`, letzte Fassung) sperren zuerst die Termin-Zeile und nehmen erst danach über `kader_vorher` die Teamsperre, umgekehrt zur Sperrordnung Verein → Person → Teams → `spieler`-Zeile → Termin. Zusammen mit dem Auflösen eines Teams, dem Austritt des letzten Mitglieds oder der Konto-Löschung kann das einen Deadlock geben (40P01, ein Aufruf bricht ab, keine falschen Daten). Bewusst hingenommen bis hierher; hier beide Funktionen auf «Team vor Termin» umstellen und mit einem Rennen-Fall belegen.

**Testfälle:** 3 (zweiter Teil), 4 (Teil Teams), 14, 16, 27, 31.

**Aus dem Review von Story 1:** Der Text `LETZTE_VERWALTUNG` (`web/lib/verein.ts`) verweist auf den Bereich «Verein», den es erst mit dieser Phase gibt; hier prüfen, dass der Verweis dann stimmt. **Stand nach Story 5:** Den Bereich gibt es; der Satz verspricht aber «Verein löschen», das erst Phase 11 bringt. Der Wortlaut bleibt (Entscheid A1.5), Phase 11 prüft ihn.

**Umgesetzt** (Branch `feature/vereine-verwaltung-581`): Migration `20261114200000_vereine_verwaltung.sql` (auch `terminserie_aendern` auf «Team vor Termin»), Herausnehmen durch die Verwaltung (`verein_spieler_aus_team_nehmen` über `spieler_aus_team_nehmen_kern`), `anderer_verein` an allen fünf Suchwegen samt Zählregel der Bremse. Alle lokalen Prüfungen grün; der Browser-Lauf folgt.

**Verschoben aus Phase 5:** `spieler_ohne_team` in `verein_ansicht` und die Summe der Spieler:innen im Kopf (Phase 6); `konto_loeschen_info`, `einzige_person`, die Löschzahlen, «Verein löschen» und die Prüfung des Wortlauts `LETZTE_VERWALTUNG` (Phase 11); «Spieler:innen» im Bereich «Verein» für alle Mitglieder (Phase 4, bis dahin nur Verwaltung); «Schnuppern 1/4» und `schnuppern_beendet` beim Herausnehmen (Phase 8).

**Zwischenstand:** Einen neuen Verein kann noch niemand gründen (bis Phase 11). `/verein/spieler` und der Leisteneintrag «Spieler:innen» gibt es nur für die Verwaltung (bis Phase 4). Der Bereich «Verein» zeigt keine Summe der Spieler:innen des Vereins (bis Phase 6). Der Dialog «Konto löschen» nennt die bleibenden Teams als festen Satz, nicht namentlich (bis Phase 11).

### Phase 6 – #582 Verwaltung führt den Spielerbestand

**AP:** §4.3 «Spielerbestand am Verein-Ort», §7.6. **Migration:** `spielerbestand_verwaltung`.

- [x] Erfassen ohne Team, Ändern, Löschen, Link abrufen und erneuern, alle am Verein-Ort und mit `nur_in_der_anwendung()`.
- [x] **Aus Phase 5:** `verein_ansicht` um `spieler_ohne_team` ergänzen; der Kopf von `/verein` und `/verein/verwaltung` zeigt dann die Summe der Spieler:innen des Vereins. (Dazu `spieler_zahl`; beide nur für die Verwaltung.)
- [x] Mit diesem PR wird das Löschen aus Story 3 abgenommen (#579 AK 12, 14).
- [x] Review Focus 4: dasselbe Konto mit beiden Rollen löscht im Bereich «Verein», aber nicht in der Team-Spielerliste. (Kern belegt in `pruefe-kern-db.ts`; der Browser-Lauf folgt.)

**Testfälle:** 12 (Teil Verwaltung), 30 (Teil `verein_spieler_entfernen`).

**Umgesetzt** (Branch `feature/vereine-spielerbestand-582`): Migration `20261114210000_spielerbestand_verwaltung.sql` mit dem Baustein `verwaltung_spieler_sperren`; Spieler-adressierte `verein_*`-RPCs antworten ununterscheidbar mit `SPIELER_NICHT_GEFUNDEN`; `verein_spieler_zuordnen` prüft Recht und Team unter der Vereinssperre. `/verein/spieler` mit Erfassen, Ändern, privatem Link und Löschen; die vier Felder und der Link-Dialog sind gemeinsame Bausteine von Team-Ort und Verein-Ort. `pruefe-kern-db.ts` löscht über den echten Verwaltungsweg. Am Team-Ort zeigt der Ändern-Dialog «Spieler:in nicht gefunden.», wenn die Verwaltung inzwischen gelöscht hat. Alle lokalen Prüfungen grün; der Browser-Lauf folgt.

**Verschoben aus Phase 6:** `abholbar` in `verein_spieler_teams` sowie Teams und Abholadresse im Erneuern-Dialog (Phase 7); Kopfzahlen von `/verein/spieler` aus `verein_ansicht` statt aus der Liste, sobald Suche und Filter Teilmengen liefern, und `js`/`link_bezogen` beim Umbau von `verein_spielerliste` erhalten (Phase 4); «Zum Schnuppern» und «Schnuppern n/4» in der Vereinsliste (Phase 8).

**Zwischenstand:** Der Erneuern-Dialog am Verein-Ort nennt weder Teams noch Abholadresse (bis Phase 7). Suche und Filter auf `/verein/spieler` fehlen (bis Phase 4).

### Phase 7 – #583 Link, Abo, Abholung über mehrere Teams

**AP:** §3.7 (Feedback über den Link), §4.4, §7.7, §7.8, §7.9. **Migration:** `link_mehrere_teams` (nur RPCs).

- [x] Reihenfolge: `spieler_link_ansicht` und Abo über alle Zuordnungen → Ab- und Anmelden sperrt zuerst das Termin-Team → Abholung → `feedback_link_gueltig`.
- [x] Zustände am Link nach dem Board: keine Termine, ohne Team, ungültig, Meldung für einen Termin, der nicht mehr gilt, «Fragen und Feedback» mit dem Verweis bei Dringendem.

- [x] **Aus Phase 6:** `verein_spieler_teams` um `abholbar` ergänzen; der Erneuern-Dialog am Verein-Ort (`components/verein/VereinSpielerLinkDialog.tsx`) nennt dann die betroffenen Teams und ob die Eltern den neuen Link über eine Abholadresse holen (#582 AK 11, #583 AK 15–16).
- [x] **Aus dem Review zu Phase 6 (Rennen beim Umbau beheben, je mit Rennen-Fall in `supabase/tests/rennen.sql`):**
  - `abholung_abholen` (Stand `20261113110000_spieler_ueber_zuordnung.sql`) liest die Spieler:in ohne Sperre und setzt danach `link_bezogen`. Erneuert jemand genau dazwischen (`spieler_link_erneuern`, `verein_spieler_link_erneuern`), bekommt die Familie den toten Link, und der neue gilt als bezogen. Vorschlag: `update spieler set link_bezogen = true where id = s.id and link_token = s.link_token returning …`; trifft das Update keine Zeile → `{status: 'ungueltig'}` (bzw. neu lesen). Rennen-Fall: Erneuern gegen Abholen, beide Richtungen; danach ist der ausgegebene Link der gültige, und `link_bezogen` gilt nur für ihn.
  - `spieler_link_abmelden` sperrt zuerst das erste Team (`spieler.team_id`, Beratungssperre `spieler:<team>`) und danach in `abmeldung_anwenden_training` das Team des Termins, also nicht aufsteigend. Mit mehreren Teams ist gegen `verein_spieler_entfernen` (Verein → alle Teams aufsteigend über `sperre_teams`) ein Deadlock (40P01) möglich. Beim Umbau auf mehrere Teams nur das Termin-Team sperren (bzw. alle nötigen Teams in einem `sperre_teams`-Aufruf). Rennen-Fall: Abmelden über den Link zu einem Termin des zweiten Teams gegen Löschen, beide Richtungen, kein 40P01.

**Testfälle:** 13, 23. Bestehende Links und Abo-Adressen liefern ohne Neubezug.

**Umgesetzt** (Branch `feature/vereine-link-mehrere-teams-583`): Migration `20261114220000_link_mehrere_teams.sql` (nur Funktionen und Rechte): Link und Abo über alle Teams mit `team` je Termin und `teams`, `gilt_nicht` ohne `stand`, Link holen und erneuern je Team (`p_team`), `abholbar` je Team in `spieler_teams` und `verein_spieler_teams`, Abholen gegen Erneuern in einer Anweisung, `feedback_link_gueltig` und `ohne_team`, `feedback_link_team` gefallen. Beide Rennen mit Fällen in `rennen.sql`, neu `link_mehrere_teams.sql`, Prod-Weg mit Abo und Token-Vergleich (PC 5). Web: Eltern-Seite, Abo «Trainings und Spiele», Abholseite, Link-Knopf in jedem Team, Erneuern mit Bestätigung an beiden Orten, «Fragen und Feedback» ohne Team; der KI-Weg leitet das Team über `eigenesTeamVon` ab. `check:kern-db` prüft die Naht über Kern und Web-Leser; der Systemprompt-Teil «ohne Team» liegt prüfbar in `lib/feedback/lage.ts` (`check:feedback`). Alle lokalen Prüfungen grün; der Browser-Lauf folgt.

**Verschoben aus Phase 7:** `probe`/`probe_info` auf dem Link bei mehreren Teams und der letzte Leser von `spieler.team_id` (`spieler_probe_*`, im Web `ladeSpieler` für Schnuppern und MCP `spieler_aendern`) (Phase 8); `verein` auf Link und Abholseite (die Datenebene liefert ihn am Link schon, der Web-Typ nimmt ihn erst dann auf) und «Vereinsverwaltung des ‹Verein›» im Verweis bei Dringendem (Phase 11); `team_id` als Eingabe der Link-Werkzeuge, `teams[]` in deren Antworten und die Modelltexte (`LINK_MODELL` nennt noch «Teamname» und «Termine des Teams») (Phase 13).

**Zwischenstand:** Für eine Spieler:in in mehreren Teams zeigt der Link keinen Schnupper-Stand (bis Phase 8). Link und Abholseite nennen den Verein nicht (bis Phase 11). Die KI-Werkzeuge zum Link nehmen kein Team entgegen und beschreiben den Link noch für ein Team (bis Phase 13).

**Lokal:** Die Abholseite braucht `ABHOL_SPERRE_SCHLUESSEL` in der Umgebung des Dev-Servers (siehe `web/.env.example`); ohne ihn scheitert das Abholen.

### Phase 8 – #584 Schnuppertraining

**AP:** §3.3 f, §4.4, §7.10 (Inventar «probe»). **Migration:** `schnuppertraining`.

- [x] Regel «genau eine Zuordnung», Zuordnen zum Schnuppern, Abweisung der gesammelten Zuordnung nennt schnuppernde Spieler:innen (#584 AK 16).
- [x] **Aus Phase 5:** «Schnuppern 1/4» in der Spielerliste von `/verein/team/[teamId]` und `schnuppern_beendet` in der Rückgabe von `verein_spieler_aus_team_nehmen` (#584 AK 13).
- [x] **Aus Phase 6:** «Zum Schnuppern» beim Zuordnen und «Schnuppern n/4» in der Vereinsliste `/verein/spieler`.
- [x] **Aus Phase 7:** `probe`/`probe_info` auf dem Link für eine Spieler:in in mehreren Teams (heute nur bei genau einem Team); `spieler_probe_*` und im Web `ladeSpieler` (Schnuppern, MCP `spieler_aendern`, das daraus nur die J+S-Nummer liest) lösen sich von `spieler.team_id`, danach liest nur noch `vereine_nachziehen` die Spalte.
  - [x] Geklärt: Regel «genau eine Zuordnung» (Zuordnen lässt eine Schnuppernde in kein zweites Team, Netz `SPIELER_SCHNUPPERT`); `probe`/`probe_info` kommen von der schnuppernden Zuordnung, also dem Team, nach dem auch das Abmelden über den Link urteilt. Ursprüngliche Frage: Eine Spieler:in, die in Team T schnuppert und einem zweiten Team angehört, bekommt auf dem Link heute `probe: null`, während das Abmelden über den Link für T-Termine weiter die Schnupper-Regeln prüft (`probe_voll`). Beim Umbau den Link-Stand und die Abweisung angleichen — und entscheiden, ob Zuordnen eine Schnuppernde überhaupt in ein zweites Team lässt (Regel «genau eine Zuordnung»).
- [x] Sichtbare Umbenennung in Oberfläche, Link und KI im selben PR; die MCP-Werkzeuge heissen neu, ohne Übergang. Interne Namen bleiben `probe_*`.
- [x] grep-Wächter «kein Probe in Oberflächentexten und MCP» scharf stellen.

**Testfälle:** 17, 18, 19 (`rennen.sql`), 28.

**Umgesetzt** (Branch `feature/vereine-schnuppertraining-584`): Migration `20261114230000_schnuppertraining.sql` (nur Funktionen, ein Trigger, Rechte): `spieler_probe_setzen`/`spieler_probe_folgen` mit `p_team` und Sperren Verein → Team → Zeile, Regel «genau ein Team» als Netz in `team_spieler_vorher` (ein Trigger statt zwei, `SPIELER_SCHNUPPERT` vor `SCHNUPPERN_MEHRERE_TEAMS`), `verein_spieler_zuordnen` mit `p_schnuppern` (`SCHNUPPERN_NUR_EINZELN`, `schnuppern_hat_team`, `schnuppern_anzahl_fehlt`), `schnuppern_beendet` an beiden Orten, `schnuppert` in `spieler_teams` samt Stand, Zähler `schnuppern` in `verein_team_ansicht` und `verein_spielerliste` (Helfer `team_probe_zaehler`), Link-Stand von der schnuppernden Zuordnung, Spaltenrechte `team_id`/`probe_seit` auf `spieler` für `authenticated` widerrufen. Tests: neu `schnuppertraining.sql`, Rennen in `rennen.sql`, Prod-Weg (`team_probetraining` zeilengleich). Web: Texte «Schnuppertraining», `SchnupperKarte`, ein Plaketten-Baustein `SchnupperLozenge` (W`components/spieler`), Team-Ort mit `p_team`, Verein-Ort mit «Zum Schnuppern zuordnen» und Zählern, KI-Werkzeuge `schnuppertraining_abrufen`, `schnuppertraining_festlegen`, `spieler_schnuppern_setzen`, Wächter «kein Probe in Oberflächentexten und KI» in `check:kern`. `check:kern-db` prüft die Naht über Kern, Nutzer-Client und den registrierten Werkzeugsatz. Browser-Lauf (12 Prüfpunkte, auch der KI-Assistent) bis auf einen Layout-Befund ohne Abweichung. Nach den Reviews: Ausschalten löscht kommende Meldungen nur in `p_team` (Altlast), ein verschwundenes Team antwortet `SPIELER_NICHT_GEFUNDEN`, `team_spieler_vorher` weist UPDATE von `team_id`/`spieler_id`/`verein_id` ab (`ZUORDNUNG_UNVERAENDERLICH`), Rennen gegen Auflösen und Löschen aus dem Verein; Snackbar nennt ein unangekündigtes Ende des Schnupperns am Verein-Ort; `spielerliste_abrufen` nennt den Stand `schnuppern`; Wächter nimmt interne Namen unter W`lib/mcp/` nur als Namen eines Datenbank-Aufrufs aus; Plakette bricht schmal unter den Namen um.

**Verschoben aus Phase 8:** `team_id` als Eingabe der Schnupper-Werkzeuge und die übrigen Modelltexte (Phase 13); `schnuppern` in `verein_spielerliste` beim Umbau nicht verlieren (Phase 4); Release-Text mit dem Hinweis, dass verbundene KI-Clients ihre Werkzeuge neu laden (die drei Schnupper-Werkzeuge heissen neu), samt Produktdoku und Feedback-Wissen (Phase D); Spalten `spieler.team_id` und `spieler.probe_seit` fallen (N1; kein API-Client liest sie mehr).

### Phase 4 – #580 Spieler:innen des Vereins überblicken

**AP:** §4.3 (`verein_spielerliste`), §7.6. **Migration:** `verein_spielerliste` (drop + create).

- [x] Liste für alle Vereinsmitglieder; Suche und Eingrenzung auf dem Server, Mehrfachauswahl bei Teams und Jahrgängen.
- [x] **Aus Phase 5:** Der Leisteneintrag «Spieler:innen» im Bereich «Verein» und `/verein/spieler` gelten dann für alle Vereinsmitglieder (bis hierher nur für die Verwaltung, Kommentar in W`components/layout/AppNavClient.tsx`).
- [x] **Aus Phase 6:** Der Kopf von `/verein/spieler` rechnet «‹n› Spieler:innen · ‹m› ohne Team» heute aus der Liste (`components/verein/VereinSpielerListe.tsx`); liefern Suche und Filter Teilmengen, kommen die Zahlen aus `verein_ansicht` (`spieler_zahl`, `spieler_ohne_team`). Umgesetzt anders: `verein_spielerliste` liefert die Zahlen selbst ungefiltert (`gesamt`, `ohne_team`), für beide Rollen. Beim Umbau von `verein_spielerliste` bleiben `js` und `link_bezogen` für die Verwaltung erhalten (Spalten J+S und «Privater Link»).
- [x] **Aus Phase 8:** Beim Umbau von `verein_spielerliste` bleibt `schnuppern: {team_id, anzahl, besucht} | null` je Spieler:in erhalten (Plakette «Schnuppern n/m» in der Teams-Spalte).
- [x] Texte auf Abholseite und Link zum Empfängerkreis.

**Testfälle:** 4 (Teil Vereinsliste), 32.

**Umgesetzt** (Branch `feature/vereine-ueberblick-580`): Migration `20261115100000_verein_spielerliste.sql` (nur diese Funktion samt Rechten, drop + create): Zugang für jedes Vereinsmitglied, Mitglieder bekommen je Spieler:in nur Vorname, Nachname, Jahrgang und Teams, die Verwaltung wie bisher dazu J+S, Link-Stand, Schnuppern und `anzahl` je Team; Suche als Teilstring über `lower(unaccent(…))` mit `strpos` (`%`, `_`, `\` gewöhnlich), Eingabe bereinigt wie die Namen; Eingrenzung Teams ODER ohne Team, Jahrgänge, Suche, alles UND; fremde Team-IDs treffen still nie; Kopf ungefiltert (`teams`, `jahrgaenge`, `gesamt`, `ohne_team`). Tests: neu `verein_spielerliste.sql` (Testfall 32 mit 1001), bestehende auf die neue Signatur, Prod-Weg liest als Mitglied. Web: `/verein/spieler` für alle Mitglieder mit Filterleiste aus Kit-Bausteinen, Zustand in der Adresse, Anzeige in Schritten von 50, lesende Sicht für Mitglieder, Leerzustände, Leisteneintrag für alle; Satz «wer die Angaben sieht» auf Abholseite und privatem Link. Naht: die Verwaltungssicht nur, wenn Lage und Antwort sie tragen, die Mitgliedersicht nur mit den vier Angaben; Suche aus der Adresse bereinigt wie die Datenebene, ungekappt; Reihenfolge allein im Kern (deutsch), Gleichstand nach der Datenebene. `check:kern-db` prüft Form je Rolle, Zugang, Suche, Eingrenzung, Kopf, Adresse bis zur Datenebene und 1000 Spieler:innen über PostgREST. Nach den Reviews: Die Funktion nennt die eigene Rolle (`verwaltung`), Kern und Seite entscheiden die Form bzw. Sicht allein daran (passt die Form nicht, technischer Fehler); null-Elemente in `p_teams`/`p_jahrgaenge` fallen weg; unbekannte Eingrenzung in der Adresse leitet einmal auf die bereinigte Adresse weiter; das Suchfeld erkennt das Echo mit der Bereinigung der Seite und lässt sich davon nie überschreiben, nur von einem echten Wert von aussen (gemeinsamer Hook, auch Katalog und Trainings); offene Dialoge schliessen beim Wechsel der Eingrenzung; «‹x› von ‹y› angezeigt» bei gesetzter Eingrenzung immer; schmaler Kopf bricht nur zwischen den Teilen.

**Verschoben aus Phase 4:** der Import-Knopf in der Kopfzeile der Liste (Phase 9); «Verantwortlich ist der Verein» im selben Textblock wie «wer die Angaben sieht» (Phase 11); die Liste ist nicht über die KI abrufbar (OoS 5; Phase 13); Laufzeit mit 100 und 1000 Zeilen auf Staging messen sowie das Schema von `unaccent` und die Collation auf Prod prüfen (G).

### Phase 9 – #585 CSV-Import in den Spielerbestand

**AP:** §3.7, §4.3, §7.9. **Migration:** `import_verein`.

- [x] Neuer Import am Verein-Ort; der Team-Import und sein Knopf fallen im selben PR.
- [x] **Aus Phase 4:** der Knopf «CSV importieren» in der Kopfzeile der Vereinsliste `/verein/spieler` (nur Verwaltung, AP §7.6).
- [x] grep-Wächter «kein `spieler_importieren(`» scharf stellen.

**Testfälle:** 24.

**Umgesetzt** (Branch `feature/vereine-csv-import-585`): Migration `20261115110000_import_verein.sql` (nur Funktionen und Rechte): `spieler_importieren` gelöscht, neu `verein_spieler_importieren(p_verein, p_zeilen, p_erwartet default null)` mit `nur_in_der_anwendung()` als erster Anweisung, Vorschau ohne Sperre, Übernahme unter `verwaltung_sperren`; Einordnung mengenweise über den ganzen Verein (neu, `js`, `gleich`, `mehrfach` ab zwei Treffern, letzte Zeile gewinnt, Teams je Bestehende), Grenze nur bei Neuen als `ueber`, alles oder nichts, ohne Zuordnung, Schnuppern, Termine und erwartete Spielerzahl. Tests: neu `import_verein.sql` (AK 1–12, PC 1–5, Leistungsfall mit erzwungen schlechtem Plan), Rennen in `rennen.sql`, Ortsprüfung, Prod-Weg mit Altdublette; die Aufrufe des alten Imports in den übrigen Tests ersetzt. Web: Kern `pruefeVereinImport`/`importiereInVerein` (W`lib/kern/verein.ts`), zwei Actions (Revalidierung Verein, bei geänderter J+S alle Teams), Dialog W`components/verein/VereinSpielerImport.tsx` (umgezogen) im Kopf der Verwaltungsliste, bedingt gemountet, schliesst beim Wechsel der Eingrenzung; Vorschau-Gruppen neu / J+S ändert sich / unverändert / mehrfach im Verein geführt, je Bestehende ihre Teams oder «ohne Team», Satz zu den Neuen, Grenze mit Zahl und gesperrtem Knopf, Hinweisband bei `veraltet`, Snackbar mit der Aktion «Zuordnen» (Eingrenzung «Ohne Team», `?team=ohne`). Die Team-Spielerliste verliert Knopf, Dialog und den Satz zur CSV-Datei. Wächter in `check:kern`: kein `spieler_importieren` (auch in `supabase/tests` und Workflows), keine Team-Import-Namen, Dialog nur in der Verwaltungsliste, RPC nur im Verein-Kern. Naht: Der Kern prüft die Form jeder Antwort (`vorschauAus`/`ausgangAus` geben bei fremder Form `null`, dann technischer Fehler, wie die Vereinsliste aus Story 4). `check:kern-db` prüft über Kern und Nutzer-Client: Vorschau-Form und Einordnung über den ganzen Verein (ohne Team, schnuppernd, Altdublette als `mehrfach`, Schreibvarianten, letzte Zeile), J+S-Regeln, Ergebnis ohne Zuordnung, `veraltet` mit `grund 'bestand'` (eine unbeteiligte Erfassung stört nicht) und `grund 'grenze'`, Import ohne Neue bei 1000, Rollen (Mitglied, fremde Verwaltung, unbekannter Verein), Eingaben und Zeilendeckel samt Marker, AK 12 (alter Aufruf PGRST202, auch für die Verwaltung) und 1000 Neue eines Jahrgangs über PostgREST.

**Entscheide und Präzisierungen Story 9** (Zettel, im AP §3.7 nachgeführt):
- Ein Import, nur am Verein-Ort, nur für die Verwaltung, in den Bestand ohne Team; der Team-Import fällt ganz (Funktion, Kern, Action, Knopf, Leerzustands-Satz, Marker `SPIELERLISTE_GEAENDERT`, Ergebnisteil `ersetzt`), ohne Hinweis an der alten Stelle (OoS 2), ohne KI-Werkzeug (OoS 6).
- Grenze: Bei `ueber > 0` schreibt die Übernahme nichts und antwortet `veraltet` mit `grund 'grenze'` und neuer Vorschau (AP §3.7 nannte `VEREIN_VOLL`, das nur noch Netz im Trigger ist). Ohne Neue geht ein Import auch über 1000.
- Stand-Abgleich mit `p_erwartet = {neu: [zeile], js: [{zeile, alt}], mehrfach: [zeile]}` (ohne `bestand`; nach Review trägt `js` die alte Nummer der Vorschau, eine inzwischen geänderte J+S-Nummer ergibt `veraltet` statt eines stillen Überschreibens, die frühere Form mit blossen Zeilennummern gilt als abweichend); fehlende Listen zählen als leer; weichen Einordnung und Grenze beide ab, gewinnt `grund 'bestand'`; eine Übernahme ohne Neue und ohne J+S-Änderung geht als `{uebernommen, 0, 0}` durch (die Oberfläche bietet sie nicht an).
- J+S: Die Datenebene nimmt 1–20 Zeichen (länger gilt wie leer), «nur Ziffern» prüft das Web; eine Zeile ohne gültige J+S ändert die bestehende nicht.
- Marker `IMPORT_ZU_GROSS` (kein Array oder mehr als 1000 Zeilen), geprüft nach der Rolle; die Dateigrösse (1 MB) hat einen eigenen Satz. Elemente ohne Objektform und fehlende, nicht ganze, nicht positive oder doppelte `zeile` weist die Datenebene technisch ab (SQLSTATE 22023, kein Marker; nach Review).
- Oberfläche (nach Review): Der Hinweis aus AK 4 steht in der Vorschau, nicht vor der Dateiwahl; der Knopf ist ein Icon-Knopf mit der Beschriftung «Spieler:innen aus Datei importieren». Während der Übernahme sind die Spaltenwähler gesperrt, überholte Antworten (Dateiwahl, Vorschau, Übernahme) werden verworfen; ein Fehler sperrt «Übernehmen» nicht, eine gescheiterte Vorschau lässt sich erneut versuchen. Der Kern prüft die Zeilennummern der Antwort (`importZeilenStimmen`) und die Form der Action-Eingaben. Ergebnistext: «… aufgenommen. Die Neuen sind keinem Team zugeordnet; einem Team ordnest du sie im Spielerbestand zu.» (Einzahl: «Die neue Spieler:in ist keinem Team zugeordnet; …») Die Grenze in der Vorschau sagt nicht mehr «Nichts übernommen.» (das sagt nach einer Übernahme das Band).
- Leistung: Der Import setzt für sein INSERT die transaktionslokale Einstellung `kifu.import_verein`; `spieler_vorher` überspringt dann nur `spieler_doppelt`, nur für Zeilen dieses Vereins. Begründung: Der Import hat die Dubletten unter der Vereinssperre schon mengenweise bestimmt, und je Zeile wäre die Prüfung bei schlechtem Plan quadratisch (Befund Story 4, Commit `8190097`). 1000 neue Zeilen eines Jahrgangs über PostgREST mit erzwungen schlechtem Plan: 6725 ms vorher, 122 ms nachher (`check:kern-db` lokal: 88 ms). Auslösbar nur in dieser Funktion (PostgREST setzt keine Einstellungen; Katalogprüfung in `import_verein.sql`).

**Pflicht-Inventar «Stand nach Story 9»:**
- Datenebene: `spieler_importieren(uuid, jsonb, jsonb)` existiert nicht mehr; `verein_spieler_importieren` (nur `authenticated`) und die internen Helfer `import_zeilennummern` und `import_js_paare` (kein API-Recht) sind neu; `spieler_vorher` neu gefasst (Ausnahme `kifu.import_verein`, sonst wie Story 2).
- Web: Import nur im Verein-Kern und in W`lib/actions/verein.ts`; W`lib/kern/spieler.ts` und W`lib/actions/spieler.ts` haben keinen Import mehr; `SPIELERLISTE_GEAENDERT`, `importZuGross`, `importGrenzText`, `SpielerImport` gibt es nicht mehr; `IMPORT_ZU_GROSS` steht in `SPIELER_MELDUNG`.
- Tests: kein Aufruf des alten Imports in `supabase/tests` und im Web ausser dem Beleg in W`scripts/pruefe-kern-db.ts`, dass er scheitert.
- Prüfläufe am Ende der Zusammenführung: `typecheck`, `check:kern` (155), `check:kern-db` (186), `check:ki-zugang` (60), `check:feedback`, 13 psql-Tests, Prod-Weg grün; die Migration trägt den spätesten Zeitstempel gegenüber `origin/develop`.

**Verschoben aus Phase 9:** Produktdoku (`docs/produkt/team-bereich.md`, künftig `verein.md`: Import nur noch am Verein-Ort, nur für die Verwaltung, in den Bestand ohne Team; kein Import in einer Team-Spielerliste), `docs/feedback-triage.md` samt `gen:feedback-wissen` und der Release-Text mit dem Hinweis aus PC 6 (Phase D); Laufzeit des Imports von 1000 neuen Zeilen eines Jahrgangs auf Staging (G).

### Phase 11 – #587 Verein gründen und löschen

**AP:** §3.4, §7.2, §7.3. **Migration:** `verein_gruenden_loeschen`.

- [x] ~~**Vor dem Merge:** Laufzeit von `verein_loeschen` mit 30 Teams und 1000 Spieler:innen auf Staging messen (AP §11 F4).~~ Nach G verschoben: lokal rund 0,28 s über PostgREST bei 8 s Grenze, auf nicht analysiertem Bestand (Begründung unten).
- [x] Reihenfolge: Gründen → Verein löschen → `delete_account(p_vereinsname)` mit dem Zweig der einzigen Person → Einstieg auf `/teams` für Konten ohne Verein.
- [x] **Aus Phase 4:** «Verantwortlich ist der Verein» im selben Textblock wie der Satz «wer die Angaben sieht» (`angabenSehenText`, W`lib/spieler.ts`) auf Abholseite und Link.
- [x] Verein als verantwortlich auf Abholseite und Link; dazu `verein` in den Web-Typ `LinkAnsicht` aufnehmen (`spieler_link_ansicht` liefert ihn seit Phase 7; `abholung_ansicht` lieferte ihn entgegen der ersten Fassung dieses Punkts nicht und bekommt ihn in dieser Migration additiv) und «Vereinsverwaltung des ‹Verein›» im Verweis bei Dringendem (`feedbackDringend`; nach dem Fix-Lauf ohne Artikel: «Vereinsverwaltung von «‹Verein›»»).
- [x] **Aus Phase 5:** `konto_loeschen_info` (ohne Teamnamen, siehe Präzisierungen), ~~das Feld `einzige_person` in `verein_verwaltung_entfernen`~~ (entfällt), die Löschzahlen in `verein_ansicht` (`personen`), «Verein löschen» in der Gefahrenzone von `/verein/verwaltung`; den Wortlaut von `LETZTE_VERWALTUNG` («… im Bereich «Verein» löschen») gegen die fertige Oberfläche geprüft: Er stimmt jetzt.

**Testfälle:** 15, 20, 21, 30 (übrige RPCs).

**Umgesetzt** (Branch `feature/vereine-gruenden-loeschen-587`): Migration `20261115120000_verein_gruenden_loeschen.sql` (nur Funktionen und Rechte): `verein_gruenden`, `verein_loeschen`, `konto_loeschen_info`, `delete_account(p_vereinsname text default null)` (drop `delete_account()`), `verein_ansicht` mit `personen`, `abholung_ansicht` mit `verein`, `verein_team_aufloesen` mit dem neuen Namensvergleich; interne Helfer `namen_stimmen`, `verein_personenzahl`, `konto_loeschen_fall`, `verein_loeschen_kern` (revoke all). Tests: neu `verein_gruenden_loeschen.sql` (Gründen, Namensvergleich samt Team auflösen, Löschen über alle Tabellen und den Katalog, Konto in allen Fällen, Testfall 30, Laufzeit), Rennen in `rennen.sql` (AK 9, 14, Termin-RPCs gegen Löschen), Ortsprüfung, Prod-Weg. Web: Kern `gruendeVerein`, `loescheVerein`, `ladeKontoLoeschenInfo`, `loescheKonto` (W`lib/kern/verein.ts`) mit Formprüfung der Antworten (W`lib/verein-antwort.ts`: `gruendungAus`, `vereinLoeschAusgangAus`, `kontoLoeschAusgangAus`, `kontoInfoAus`; fremde Form ergibt einen technischen Fehler mit eigenem Satz `VEREIN_UNSTIMMIG`), Actions `gruendeVereinAktion`, `loescheVereinAktion` (W`lib/actions/verein.ts`) und `deleteAccount(vereinsname)` (W`lib/actions/auth.ts`), Einstieg `OhneVereinStart` und Dialog `VereinGruenden` auf `/teams`, `VereinLoeschen` in der Gefahrenzone, Konto-Dialog mit drei Fällen (W`app/(app)/konto/KontoClient.tsx`), Verein als verantwortlich auf Link, Abholseite (Eingabe und Erhalt) und im Verweis bei Dringendem. Naht (Zusammenführung): Feld für Feld in beide Richtungen ohne Abweichung; `check:kern-db` prüft über Kern und Nutzer-Clients Gründen (Rollen, Bestätigung, Namensregeln samt 23514 `verein_name`, schon im Verein, nicht eindeutig, AK 8), Löschen (nur eigene Verwaltung, Name falsch und überholt, danach nichts mehr da, Link/Abos/Abholadresse wie ein unbekanntes Geheimnis, Personen ohne Verein gründen neu oder werden aufgenommen, zweiter Verein unberührt, eigenes Training bleibt, Bilder), Konto-Vorschau in drei Fällen und `delete_account` in allen vier Antworten samt «mit Namen, aber nicht mehr einzige Person», `personen` nur für die Verwaltung, Verein in Link- und Abholansicht, und dass `namen_stimmen` und `namenStimmen` für Tabulator, geschütztes Leerzeichen, Zeilenumbruch, NFC/NFD, Gross/Klein und von JS nicht getrimmte Zeichen gleich entscheiden.

**Fix-Lauf nach dem Review** (gleicher Branch, Migration noch nicht angewandt und darum editiert):
- Namensvergleich trimmt beide Seiten: `namen_stimmen` über den neuen Helfer `namen_ohne_rand` (revoke all), `namenStimmen` mit `name.trim()`. Ein gespeicherter Name mit geschütztem Leerzeichen oder Tabulator am Rand (Bestand, direkter Aufruf; `verein_name` und der Teamname-CHECK prüfen nur `btrim`) lässt sich so bestätigen; vorher wäre ein solcher Verein unlöschbar gewesen und die einzige Person hätte ihr Konto nie löschen können. `verein_gruenden` und `verein_umbenennen` (create or replace, Rumpf sonst wie Story 5) speichern den Namen ohne diesen Rand; kein neuer CHECK. Tests: psql (Verein löschen, Konto der einzigen Person, Team auflösen mit Rand; Gründen und Umbenennen speichern ohne Rand), Zwilling in `check:kern-db` mit Rand im gespeicherten Namen.
- 40P01 der Termin-RPCs (Review, zuerst unbelegt): nachgestellt in `rennen.sql`. A hielt die Termin-Zeile wie der erste Schritt von `termin_entfernen` bzw. `termin_training_setzen` (Lösen), B rief `verein_loeschen`; die Kaskade nimmt erst die Trainings (FK `training_termine_training_id_fkey` set null auf die Termin-Zeile), A danach über den Trigger `termin_training_aufraeumen` das Termin-Training: «deadlock detected … while deleting tuple in relation training_termine» in beiden Fällen. Behoben, weil schlank: beide RPCs lesen die Team-ID ungesperrt, nehmen `sperre_teams` und erst dann die Termin-Zeile (Team → Termin wie `termin_kader_setzen`), per create or replace, Rumpf sonst Zeile für Zeile wie die letzte Fassung. `verein_team_aufloesen` ist damit ebenso abgedeckt. Rennen-Fälle t1–t4 (Entfernen/Lösen gegen Löschen in beiden Reihenfolgen, Teamsperre vor der Termin-Zeile mit `for update nowait`). Schlusskorrektur: `terminserie_entfernen` (Rechen-Helfer `terminserie_entfernen_rechnen`, auch für die Vorschau) sperrte die Termin-Zeilen der Serie ebenso ohne Teamsperre und löschte danach Termine samt Termin-Trainings; gleich behoben (Team-ID ungesperrt lesen, Mitgliedschaft prüfen, `sperre_teams`, Rumpf sonst wie `20260930211328_terminserien_aendern.sql`), Rennen-Fälle t5 (gegen Löschen; vor dem Fix wartete B nicht an der Teamsperre) und t5b (Teamsperre vor der Termin-Zeile). Massstab für «kein Zyklus»: Nach der Termin-Zeile wartet kein Weg mehr auf etwas, das die Löschkaskade (`verein_loeschen`, `verein_team_aufloesen`) vorher hält. Das gilt für die behobenen Wege, aber nicht allgemein: Es gibt Wege, die Termin-Zeilen ohne Teamsperre sperren oder schreiben (unten, offene Punkte).
- Oberfläche: Vereinsname ohne Artikel in allen neuen Sätzen (AP §5.3); bei 0 Teams und 0 Spieler:innen kein Doppelpunkt ins Leere (Konto-Dialog) bzw. «Der Verein hat keine Teams und keine Spieler:innen.» (Dialog «Verein löschen»); Team-Zeile in beiden Dialogen gleich. Konto-Dialog lädt nach jeder Antwort ohne Löschen die Lage neu (`router.refresh()`), die frische Lage entscheidet den Fall (Schlusskorrektur: die stehen gebliebene Meldung bleibt nur, wenn sie zum frischen Fall passt, und nie doppelt zu den Sätzen der letzten Verwaltung; `meldungBleibt` in W`app/(app)/konto/KontoClient.tsx`), Name und Zahlen gehen über Antwortfolgen nicht verloren; neuer Satz für «mit Namen, aber nicht mehr einzige Person»; der Teilzustand revalidiert Verein und Mitgliedschaften vor der Rückgabe. Flash auf `VEREIN_NAME_MAX` gekürzt; `ladeAbholAnsicht` und `ladeLinkAnsicht` prüfen `verein` (und `team`) und behandeln eine Antwort ohne sie als ungültig; `TeamAufloesen` sperrt die Eingabe während der Anfrage; der Kopf der Karte «Vereinsverwaltung» bricht bei 390 px um (kein horizontaler Überlauf).

**Entscheide und Präzisierungen Story 11** (Zettel, im AP §3.4, §4.1, §4.3, §7.3, §8, §11 nachgeführt):
- Gründen: nur ein Konto ohne Verein; Sperren Verein (neue UUID) → Person, dann die Prüfung; keine Prüfung von `email_confirmed_at`; Rückgabe `{status: 'gegruendet', id, name}`; ungültiger Name scheitert am CHECK `verein_name` (23514), das Web prüft vorab.
- Löschen: Sperrordnung `verwaltung_sperren` → `sperre_teams` (alle Teams des Vereins aufsteigend) → Name unter den Sperren prüfen → Teams, Spieler:innen, Verein. Die Teamsperren vor dem ersten Schreiben verhindern 40P01 gegen Termin-RPCs am Team-Ort, sofern diese selbst die Teamsperre vor der Termin-Zeile nehmen (seit dem Fix-Lauf auch `termin_entfernen` und `termin_training_setzen`). Rückgabe `{status: 'geloescht', name, bilder}` bzw. `{status: 'vereinsname_falsch', name}`.
- Der AP-Rückfall aus F4 (`set local statement_timeout` in der Funktion) ist gestrichen: Er verlängert das laufende Statement nicht. Messung lokal (Test `verein_gruenden_loeschen.sql`): 30 Teams, 1000 Spieler:innen, 1500 Termine, 18000 Teilnahmen, 150 Team-Trainings auf nicht analysiertem Bestand, rund 0,28 s über PostgREST.
- Namensvergleich: Der Zwilling heisst `namenStimmen` (W`components/ui/NamenBestaetigen.tsx`) und `namen_stimmen` (SQL), nicht `vereinsNameStimmt`; der Rand umfasst alle Zeichen, die JS `trim()` entfernt (nicht nur das Leerzeichen wie `btrim`), dazu NFC. `verein_team_aufloesen` (Story 5) vergleicht seit dieser Migration ebenso (vorher `btrim`: Tabulator oder geschütztes Leerzeichen am Rand gaben im Web den Knopf frei, die Datenebene antwortete `name_falsch`). Andere Namensbestätigungen gibt es nicht mehr (`loese_team_auf` und der Namenszweig von `entferne_team_mitglied` sind seit Story 5 weg).
- `konto_loeschen_info` liefert immer `{fall, verein, teams, spieler}` (bei `frei` `verein` null, Zahlen 0) und nennt keine Teamnamen; `verein_verwaltung_entfernen` bekommt kein Feld `einzige_person` (AK 13 hat für beide Fälle denselben Text).
- `delete_account(p_vereinsname)`: Kommt ein Name mit, die Person ist aber nicht mehr die einzige (weitere Person im Team oder in der Verwaltung), antwortet sie `letzte_verwaltung` und löscht nichts. Die Action zeigt dann den eigenen Satz «… Verein und Konto bleiben unverändert …».
- `verein_ansicht.personen` (nur für die Verwaltung): verschiedene Konten in Verwaltung und Teams. `abholung_ansicht` liefert `verein` neu (nicht seit Phase 7, wie dieser Plan zuerst annahm).
- Action `deleteAccount`: RPC → Bilder räumen → `deleteUser` (Admin-API) → `signOut` (best effort). Scheitert `deleteUser` nach dem RPC, bleibt ein Teilzustand (Daten und gegebenenfalls der Verein gelöscht, Konto besteht) mit eigenem Satz; ein zweiter Versuch läuft als Konto ohne Verein durch.
- Begründung für das Verschieben der Staging-Messung nach G: lokal 0,28 s bei 8 s Grenze, also mit grossem Abstand; die Staging-Messung braucht einen synthetischen Vollbestand auf Staging und gehört mit den übrigen Laufzeitmessungen in die Generalprobe.

**Pflicht-Inventar «Stand nach Story 11»:**
- Datenebene: `delete_account()` ohne Argument existiert nicht mehr (sonst PGRST203); neu mit API-Recht (nur `authenticated`, erste Anweisung `nur_in_der_anwendung()`): `verein_gruenden(text, boolean)`, `verein_loeschen(uuid, text)`, `konto_loeschen_info()`, `delete_account(text)`; neu ohne API-Recht: `namen_ohne_rand`, `namen_stimmen`, `verein_personenzahl`, `konto_loeschen_fall`, `verein_loeschen_kern`; geändert: `verein_ansicht` (additiv `personen`), `abholung_ansicht` (additiv `verein`, weiter auch `anon`), `verein_team_aufloesen` (Vergleich `namen_stimmen`, Rumpf sonst wie Story 5), `verein_umbenennen` (`namen_ohne_rand` statt `btrim`), `termin_entfernen` und `termin_training_setzen` (Teamsperre vor der Termin-Zeile). Kein `set local statement_timeout`, keine Tabelle, kein CHECK, kein NOT NULL. Ortsprüfung deckt die neuen `verein_*` ab.
- Web: `verein_loeschen`, `konto_loeschen_info` und `delete_account` ruft nur W`lib/kern/verein.ts` auf (Wächter in `check:kern`); der Namensvergleich steht nur in W`components/ui/NamenBestaetigen.tsx` und trimmt beide Seiten; der Wächter, der «Verantwortlich» am Link verbot, ist umgekehrt; Web-Typen `LinkAnsicht` und `AbholAnsicht` tragen `verein`; die Verwaltungsseite wirft, wenn `verein_ansicht` kein `personen` liefert.
- Tests: Laufzeit und Rennen in den psql-Tests; `check:kern-db` prüft Gründen, Löschen, Konto, Link/Abholansicht und den Zwilling über den echten Weg.
- Prüfläufe am Ende der Zusammenführung: `typecheck`, `check:kern` (163), `check:kern-db` (190, zweimal), `check:ki-zugang` (60), `check:feedback`, 14 psql-Tests, Prod-Weg grün; die Migration trägt den spätesten Zeitstempel gegenüber `origin/develop`.

**Offen aus Phase 11 (Deadlock-Analyse, nicht behoben, besteht schon vor den Vereinen; Folge jeweils: Postgres bricht eine Seite mit 40P01 ab, nichts geht verloren, der Kern meldet das über `ausDbFehler` als `konflikt` mit `wiederholbar: true` und «Gleichzeitig hat sich an derselben Stelle etwas geändert. Es genügt, es noch einmal zu versuchen.»; Einordnung als Folgepunkt für Phase C):**
- (a) Ein Training direkt löschen (`loescheTrainingMitBildern`, DELETE ohne Teamsperre: Trainingszeile, dann über den FK die Termin-Zeile) gegen `termin_entfernen` bzw. gegen die Löschkaskade; seit #322 unverändert, nicht nachgestellt.
- (b) Termin ändern und Ausfall (setzen, zurücknehmen) laufen über die RLS (`UPDATE training_termine`, W`lib/kern/termine.ts` um `:834`, `:1049`, `:1077`) ohne Teamsperre: Der Trigger `termin_zeitpunkt_nachher` fügt nach der Termin-Zeile Zeilen in `termin_abmeldungen` ein, deren FK-Prüfung (`ta_zuordnung` auf `team_spieler`, die Zuordnung zum Team) gegen ein gleichzeitiges «Verein löschen» oder «Team auflösen» warten kann, während die Kaskade auf die Termin-Zeile wartet.
- (c) `termin_trainer_aendern`, `termin_trainer_absage_setzen`, `termin_verantwortliche_setzen` sperren die Termin-Zeile ohne Teamsperre, schreiben danach aber nur Kindzeilen des Termins (unkritisch: kein Warten auf etwas, das die Kaskade vorher hält, ausser der Termin-Zeile selbst).

**Verschoben aus Phase 11:** Grenzen für Konten ohne Verein (Phase 12); KI-Assistent, kein Werkzeug gründet oder löscht (Phase 13); Bestandstexte früherer Stories mit Artikel vor dem Vereinsnamen neutral fassen (Liste in Phase D); Produktdoku (`verein.md`, `konto-und-zugang.md`: Gründen, Verein löschen, Konto löschen in drei Fällen, Verein als verantwortlich an Link und Abholseite; Feedback bleibt nach dem Löschen eines Teams oder Vereins ohne Team-Bezug erhalten), `docs/feedback-triage.md` samt `gen:feedback-wissen` und der Release-Text zu PC 6 (Phase D); Laufzeit von «Verein löschen» mit 30 Teams und 1000 Spieler:innen auf Staging (G).

**Zwischenstand:** Konten ohne Verein haben noch keine Grenzen (bis Phase 12).

### Phase 12 – #588 Konten ohne Verein

**AP:** §3.5, §4.4 «Kontogrenzen», §7.2. **Migration:** `konten_ohne_verein`.

- [x] In `pruefe-kern-db.ts` tritt das Konto mit vielen Übungen zuerst dem Test-Verein bei; die Grenzen prüft ein eigenes Konto ohne Verein. (Konto `a` steht ab dem Start im Anker-Team «Kern-DB-Anker»; Begründung unten.)
- [x] Trigger für 50/30; `meine_vereinslage()` füllt neu `grenzen`; Anzeige `BestandAnzeige` in ~~Leiste,~~ Übersichten und Dialogen (keine Leisten-Anzeige, Begründung unten); die Sperre der Teamfunktionen (#588 AK 9; bestand schon, nur Tests).
- [x] MCP-Texte zu den Grenzen im selben PR (die vier Einfüge-Werkzeuge; die übrigen KI-Texte Phase 13).

**Testfälle:** 22.

**Umgesetzt** (Branch `feature/vereine-konten-ohne-verein-588`): Migration `20261115130000_konten_ohne_verein.sql` (nur Funktionen, Trigger und Rechte; kein CHECK, kein NOT NULL, kein Backfill, kein Index): `konto_grenze(text)` (50/30, einzige Stelle der Werte in der DB), `konto_anzahl(uuid, text)` (einzige Zähldefinition: `exercises` mit `owner_id` und `source = 'user'`, `trainings` mit `owner_id`), `konto_bestand(uuid)` (`{uebungen, trainings}` für die Prüfabfrage), Triggerfunktion `konto_grenze_vorher()` (DEFINER) mit den Triggern `konto_grenze_neu` (BEFORE INSERT) und `konto_grenze_besitz` (BEFORE UPDATE OF `owner_id`) je auf `exercises` und `trainings`, `meine_vereinslage()` mit `grenzen` (create or replace, gleiche Signatur). Marker `KONTO_UEBUNGEN_VOLL <bestand>` / `KONTO_TRAININGS_VOLL <bestand>` (P0001). Tests: neu `konten_ohne_verein.sql` (Zählung, Grenze, Bestand über der Grenze, Konto mit Verein, Wege der Rollen, kein Abfluss, Besitzwechsel, `grenzen` je Lage, AK 9, Grants), Rennen in `rennen.sql` (zwei Anlagen bei 49/29, Anlage gegen Aufnahme in beiden Reihenfolgen, Sperre nur fürs eigene Konto), `vereine_fundament.sql` (`grenzen`), Prod-Weg (Konto ohne Team mit 60 Übungen und 31 Trainings: Bestand bleibt, ändern/löschen geht, Neues wird abgewiesen). Web: W`lib/konto-grenzen.ts` (Zwillinge `KONTO_UEBUNGEN_MAX`/`KONTO_TRAININGS_MAX`, Marker-Regex, Sätze, `kontoGrenzenAus`), Übersetzung an einer Stelle in `fachlicheMeldung` (`weitereMeldung`) samt Hinweis «Es ist nichts entstanden.» in `ausDbFehler` (art `regel`, nicht wiederholbar), Vereinslage mit `grenzen` (W`lib/queries/verein.ts` `getMeineGrenzen`), Kern `ladeKontoGrenzen` (W`lib/kern/konto.ts`) und Action `ladeBestandAktion` (W`lib/actions/konto-bestand.ts`), Baustein `BestandAnzeige` (Zeile und Meldung, im Styleguide), Dialogstufe W`components/konto/BestandStufe.tsx` vor Kopieren, Übernehmen und «In die Bibliothek», Stand in «Meine Übungen»/«Meine Trainings», Meldung statt der Maske auf `/neu` und `/training/neu` an der Grenze, Revalidierung samt Wächter, KI-Werkzeugbeschreibungen der vier Einfüge-Werkzeuge; `check:ki-zugang` läuft neu mit `tsx --conditions=react-server` (die CI ruft `npm run check:ki-zugang`, die Bedingung greift). Naht (Zusammenführung): Marker, Form von `grenzen`, `max` und Zähldefinition in beide Richtungen ohne Abweichung (Einzelheiten unter «Entscheide und Präzisierungen»); `check:kern-db` prüft vier neue Fälle über den echten Weg (Einfüge-Funktionen an der Grenze samt KI, Bestand über der Grenze mit Aufnahme und Austritt, AK 9).

**Entscheide und Präzisierungen Story 12** (Zettel, im AP §3.5, §4.1, §4.4, §5.3, §6.7, §7.1, §7.2, §7.10 nachgeführt):
- Konto ohne Verein = weder Mitglied eines Teams noch in der Verwaltung eines Vereins (`person_verein(..) is null`). AK 9 heisst «nicht für Konten ohne Team-Zugehörigkeit»: Die Verwaltung ohne Team behält den Bereich «Verein» (Rechte-Matrix); AK 9 war schon durchgesetzt und bekommt nur Tests (psql und `check:kern-db`, Kern und KI-Werkzeuge).
- Gezählt wird je Art jede Zeile mit `owner_id = Konto` (Übungen nur `source = 'user'`): Entwürfe wie veröffentlichte, angelegte wie kopierte oder übernommene. Team-Trainings, Termin-Kopien, Manual-Übungen, anonymisierte Zeilen, Varianten, Gruppen und Übungen im Training zählen nicht. Die einzige Zähldefinition ist `konto_anzahl`; `konto_bestand`, der Trigger und `meine_vereinslage` rufen sie (der AP nannte `konto_bestand` als die eine Definition).
- Trigger: `konto_grenze_neu` (INSERT) und `konto_grenze_besitz` (UPDATE OF `owner_id`, nur bei geändertem, nicht leerem Wert) je Tabelle, mit WHEN-Klauseln nur für zählende Zeilen (Seed, Team- und Termin-Kopien, `delete_account`, FK SET NULL, Updates ohne Besitzwechsel erreichen die Funktion nicht). Reihenfolge: Postgres feuert BEFORE-Trigger nach Namen; auf `trainings` laufen sie vor `trainings_search` und `trainings_stufe_pflicht` (die Grenze kommt vor `STUFE_FEHLT`), auf `exercises` nach `exercises_search`. Der Kern prüft Eingaben vorher (fehlende Alterskategorie ist dort `eingabe`), darum sieht die Oberfläche die Reihenfolge nur bei direktem Schreiben.
- Ablauf der Funktion: angemeldet und fremde `owner_id` → ohne Zählung, Sperre und Meldung zurück (der BEFORE-Trigger läuft vor der WITH-CHECK-Prüfung der RLS; die weist danach ab, kein Abfluss von Bestand oder Vereinslage); sonst `sperre_person(owner_id)` in eigener Anweisung, danach in eigenen Anweisungen Vereinslage und Bestand; mit Verein durchlassen, sonst ab Bestand ≥ Grenze abweisen. Ohne `auth.uid()` (Service-Rolle, postgres) gilt die Grenze wie für das Konto selbst.
- Kein neuer Index: Die Zählung läuft über `exercises_owner_idx` und `trainings_owner_idx`. Gemessen lokal (DB-Lauf, rund 30 000 Zeilen in `exercises`): die Zählung über `exercises_owner_idx` 0,03 ms bei 50 und 0,6 ms bei 5000 eigenen Übungen; ein zählender Insert ohne Verein bei 49 Übungen 0,27 ms, mit Verein 0,21 ms, ohne Trigger 0,12 ms (je Mittel aus 200).
- Regel für künftige RPCs: Kein security-definer-RPC legt zählende Zeilen (eigene Übung, eigenes Training, Besitzwechsel) für ein anderes Konto als `auth.uid()` an; sonst liefe die Grenze für das fremde Konto, und die Meldung trüge dessen Bestand. Sperrregel: kein zählender Insert oder Besitzwechsel nach einer Vereins-, Team- oder Terminsperre (sonst Zyklus mit der Personensperre); heute tut es keiner.
- Hingenommen: Besitzwechsel gegen `delete_account` desselben Kontos ist geordnet (beide nehmen die Personensperre); ein Besitzwechsel auf ein Konto, das gerade gelöscht wird, scheitert nach der Sperre am FK. Hingenommen (AP §3.5) bleibt das Fenster, in dem eine Trainingskopie einen Platz belegt, bevor sie fertig ist oder abgeräumt wird.
- Marker mit Bestand (`KONTO_UEBUNGEN_VOLL 62`), Muster `PROBE_VERFALLEN`; das Web liest die Zahl per Regex. Über der Grenze sagt der Satz «Du besitzt 62 Übungen, höchstens 50 sind erlaubt.», nie «62 von 50». Schluss jeder Abweisung «In der Anwendung schaffst du durch Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.»
- KI: ein Wortlaut für beide Arten, derselbe Satz wie in der Anwendung, dazu `hinweis` «Es ist nichts entstanden.», `art: "regel"`, nicht wiederholbar, ohne Verweis auf ein Lösch-Werkzeug (Übungen löscht der Assistent nie, Trainings nur auf ausdrücklichen Wunsch). Der Satz «gefahrlos wiederholen» von `training_kopieren` gilt bei der Grenze nicht (Beschreibung differenziert, `kopiereTrainingNach` reicht den Hinweis der Datenebene durch).
- Oberfläche: «Board vor AP» beim Sperren: «Übung erstellen» und «Training erstellen» bleiben bedienbar; `/neu` und `/training/neu` zeigen an der Grenze die Meldung statt der Maske. Kopieren, Übernehmen und «In die Bibliothek» bekommen für Konten ohne Verein eine Dialogstufe mit frisch gelesenem Stand (an der Grenze nur «Schliessen», eine Abweisung der Datenebene bleibt im Dialog stehen); für Konten mit Verein bleibt es ein Klick (die Stufe fragt den Stand vorher, ohne Dialog). Die Anzeige entscheidet nie.
- Keine Anzeige in der Seitenleiste: Der Eintrag hat keinen Platz für eine Plakette (neues Feld in `Seitenleiste`), und das Layout rendert bei Navigation im Client nicht neu; der Zähler veraltete nach jeder Anlage per KI oder durch eine andere Person. Die Zahl steht darum in den Übersichten, auf den Anlegen-Seiten und in der Dialogstufe; ein Wächter in `check:kern` hält die Grenzen aus dem Layout heraus. Kein Fortschrittsbalken.
- Konto `a` in `check:kern-db`: Es gehört ab dem Start über das Anker-Team «Kern-DB-Anker» (ohne Termine, ohne Spieler:innen, nicht in `teams`, fällt erst beim Aufräumen mit dem Verein) dauernd dem Test-Verein an. Gemessen besitzt `a` im Lauf höchstens 18 eigene Trainings und 33 eigene Übungen, und ohne den Anker liefen heute alle Prüfungen durch; der Anker hält die übrigen Prüfungen unabhängig von ihrer Reihenfolge und von künftigen Fällen. Keine Prüfung braucht `a` als Konto ohne Verein (alle laufen mit dem Anker grün, auch die mit Austritt und Konto löschen), Admin-Inserts mit `owner_id` von `a` sind damit keiner Grenze unterworfen. Die Grenzen prüfen eigene Wegwerf-Konten; ein Bestand über der Grenze entsteht über die API so wie im Betrieb (im Team per Admin anlegen, dann Austritt), weil PostgREST `session_replication_role` nicht setzen kann.
- Bekannte Fussnote: Die psql-Tests wechseln mit `pg_temp.als(..)` die Rolle; zurück zu postgres ohne Anmeldung geht nur über `pg_temp.zurueck()` (`reset role` allein lässt die Claims und damit `auth.uid()` stehen, und der Trigger hielte das für einen Aufruf des Kontos).

**Naht (Zusammenführung):**
- Marker: Die DB wirft `KONTO_UEBUNGEN_VOLL <n>` bzw. `KONTO_TRAININGS_VOLL <n>` mit `raise exception` (SQLSTATE P0001); PostgREST liefert ihn unverändert in `message`, `code` ist `P0001` (in `check:kern-db` roh geprüft). Der Regex `KONTO_*_VOLL (\d+)` liest Art und Zahl; `fachlicheMeldung` erreicht `createExercise` (über `fehlerMeldung`), `legeUebungAn`, `legeTrainingAn`, `legeUebungsKopieAn` (Kopieren und «In die Bibliothek») und `kopiereTraining` (über `ausDbFehler`), und die Abräum-Pfade ändern den Text nicht: `legeUebungsKopieAn` entfernt die Bildkopie und reicht Meldung, Art und Hinweis durch, `kopiereTraining` scheitert schon am Insert der Trainingszeile («nichts entstanden», Hinweis der Datenebene statt «gefahrlos wiederholen»). Eine fremde `owner_id` ergibt die RLS-Abweisung ohne Marker.
- `grenzen`: Form `{uebungen: {bestand, max}, trainings: {bestand, max}}` bzw. `null` gleich in DB und `kontoGrenzenAus` (ganze Zahlen ≥ 0, `max` > 0); `bestand` über `max` wird angenommen; `max` gleich `KONTO_*_MAX` (geprüft über Nutzer-Client und `ladeKontoGrenzen`). Das Web setzt `grenzen` zusätzlich nur ohne `verein` (`grenzen: v ? null : grenzen`).
- Zähldefinition ↔ Übersichten: «Meine Übungen» filtert `owner_id = uid` (Manual-Übungen haben nach `manual_has_no_owner` nie einen Besitzer, `source = 'user'` ist damit gleichwertig), «Meine Trainings» `owner_id = uid` und `team_id is null` (nach `tr_ein_eigentuemer` gleichwertig zu `owner_id = uid`). Ohne Filter stimmen Anzeige und Listenlänge überein; mit Filter oder Suche ist die Liste kürzer, die Anzeige nennt bewusst den ganzen Bestand (aus `grenzen`, nie aus der Liste). Die Übungsübersicht schneidet ab 24 Treffern in Seiten («Mehr anzeigen»); auch dann nennt die Anzeige den ganzen Bestand. Keine Abweichung, nichts geändert.
- Reihenfolge der Abweisungen: siehe oben (Grenze vor `STUFE_FEHLT` in der DB, Eingaben prüft der Kern vorher); an der Grenze zeigt die Oberfläche die Meldung, bevor jemand etwas eingibt.
- Bereinigt: `bestandKurz` (Plakette der Seitenleiste) war ohne Aufrufer und fiel mit seinem Test weg.

**Pflicht-Inventar «Stand nach Story 12»:**
- Datenebene: neu ohne API-Recht (revoke all): `konto_grenze(text)`, `konto_anzahl(uuid, text)`, `konto_bestand(uuid)`, `konto_grenze_vorher()`; neue Trigger `konto_grenze_neu` und `konto_grenze_besitz` auf `exercises` und `trainings` (der Prod-Weg prüft, dass sie bestehen und eingeschaltet sind); geändert `meine_vereinslage()` (additiv `grenzen`, nur `authenticated`). Kein CHECK, kein NOT NULL, keine Tabelle, kein Index. `PUBLIC_TABLES` unverändert.
- Web: Die Grenzwerte stehen nur in W`lib/konto-grenzen.ts` (Wächter: kein festes 50/30 in Anzeige, Stufe und Action), die Marker übersetzt nur `weitereMeldung`; die Anzeige liest nur `meine_vereinslage().grenzen` (nie die Listenlänge), steht nie im Layout und nie für Konten mit Verein; Actions, die Bestand oder Zugehörigkeit ändern, revalidieren (Wächter); `check:ki-zugang` läuft mit `--conditions=react-server`.
- Tests: psql (`konten_ohne_verein.sql`, Rennen, Prod-Weg), `check:kern` und `check:ki-zugang` (Sätze, Marker, Werkzeugtexte, Fake-Client), `check:kern-db` (vier Fälle über Kern, Nutzer-Client und KI-Werkzeuge; `a` im Anker-Team).
- Prüfläufe am Ende der Zusammenführung (nach `db reset` und `npm run seed` wie die CI): `typecheck`, `check:kern` (173), `check:kern-db` (194, zweimal), `check:ki-zugang` (64), `check:feedback`, 15 psql-Tests, Prod-Weg grün; die Migration trägt den spätesten Zeitstempel gegenüber `origin/develop`.

**Fix-Lauf Story 12** (nach dem Review, ohne Verhaltensänderung der Datenebene):
- Doppelklick: Die Dialogstufe liess den Auslöser nach dem Erfolg frei, bevor die Zielseite stand (auch für Konten mit Verein schlechter als `origin/develop`). Jetzt läuft die Aktion in einer Transition, `laeuft` folgt `isPending`; der Auslöser sperrt mit `aria-disabled` und Guard, behält den Fokus und bekommt ihn nach dem Dialog zurück (`OverflowMenu` mit `gesperrt`).
- Konten mit Verein: Die Seite gibt die Lage mit (`KontoGrenzenLage` auf Übung, Training, Editor); ohne Grenzen kein Aufruf von `ladeBestandAktion`, der Ablauf ist wieder der von `origin/develop`.
- Abweisung einheitlich: strukturiertes Merkmal `grenze: {art, bestand}` (KernFehler, aus `ausDbFehler`; reist über Übungskopie, Trainingskopie und die Actions; der KI-Weg lässt es weg). `istKontoGrenzeMeldung` (Erkennung am Text) entfällt. Dialog: nur «Schliessen» mit Link; `/neu` und `/training/neu`: Meldung mit Link statt der veralteten Zeile, Angaben bleiben.
- Satz über der Grenze: «Lösche ‹n› Übungen, um Platz für eine neue zu schaffen.» bzw. «… Trainings, … für ein neues …» mit n = Bestand − Grenze + 1; genau an der Grenze wie bisher.
- Ein Formfehler in `grenzen` ergibt `grenzen: null` plus Protokoll, nicht einen Fehler der Vereinslage (sonst fiel `/verein` auf die Fehlerseite).
- `training_kopieren`: «gefahrlos wiederholen» nur noch bei `technisch` und `konflikt` (`nichtsEntstanden(art)`, jetzt in `lib/kern/kopie.ts` für Übungen und Trainings); bei `regel`, `nicht_gefunden`, `keine_rechte` «Es ist keine Kopie entstanden.» Werkzeugbeschreibung angeglichen.
- Datenebene nur Kommentare und Tests: zweite REGEL im Kopf der Migration, der Satz zu `nur_in_der_anwendung` bei `meine_vereinslage` wieder da; psql: Sammel-Insert über die Grenze (nichts eingefügt) und Upsert auf eine eigene Zeile an der Grenze (abgewiesen) als dokumentiertes Verhalten.
- **Regeln für künftigen Code:** kein DEFINER-Weg legt zählende Zeilen für ein fremdes Konto an oder überträgt ihm Besitz; keine Upserts auf zählende Zeilen; psql-Tests setzen Rolle UND Claims zurück (`pg_temp.zurueck()`).
- Prüfläufe nach dem Fix-Lauf (nach `db reset` und `npm run seed`): `typecheck`, `check:kern` (175), `check:kern-db` (194, zweimal), `check:ki-zugang` (64), `check:feedback`, 15 psql-Tests, Prod-Weg grün; im Browser Doppelklick auf Kopieren, Übernehmen und «In die Bibliothek» (auch mit verzögerter Antwort und verzögerter Zielseite) mit und ohne Verein je genau eine Kopie, mit Verein ein einziger Action-Aufruf.

**Verschoben aus Phase 12:** übrige KI-Texte (Hinweis für Konten ohne Team, `teams_abrufen`, `team_id`; Phase 13); Produktdoku, `docs/feedback-triage.md` samt `gen:feedback-wissen` und der Release-Text zu PC 4 (Phase D, «Aus Phase 12»); Zählabfrage auf Staging und Prod, wie viele Konten ohne Verein an oder über der Grenze liegen (G).

**Zwischenstand:** Konten ohne Verein haben ihre Grenzen; der KI-Assistent kennt Vereine noch nicht (bis Phase 13).

### Phase 13 – #589 KI-Assistent und Vereine

**AP:** §7.10. **Migration:** keine.

- [ ] **Aus Phase 12:** die übrigen KI-Texte zu Konten ohne Verein: der Hinweis für Konten ohne Team (AK 9 ist durchgesetzt, das Modell erfährt aber nicht, warum Team-Werkzeuge nichts liefern), `teams_abrufen` und `team_id`. Die Texte der vier Einfüge-Werkzeuge zu den Grenzen (`uebung_anlegen`, `uebung_kopieren`, `training_anlegen`, `training_kopieren`) sind seit Phase 12 da.
- [ ] **Aus Phase 7:** optionales `team_id` als Eingabe von `spieler_link_abrufen`/`spieler_link_erneuern` (der Kern nimmt es schon, ohne leitet er über `eigenesTeamVon` ab), `teams[]` in deren Antworten, `LINK_MODELL` auf den Link über alle Teams berichtigen.
- [ ] **Aus Phase 8:** optionales `team_id` als Eingabe von `spieler_schnuppern_setzen` (der Kern nimmt es schon, ohne leitet er über `eigenesTeamVon` ab) und die übrigen Modelltexte (die Beschreibung von `spieler_schnuppern_setzen` nennt noch «im ältesten ihrer Teams, dem du angehörst»).
- [ ] **Aus Phase 4:** Die Vereinsliste (`verein_spielerliste`) bleibt über die KI nicht abrufbar (#580 OoS 5); kein MCP-Werkzeug liest sie (Wächter «MCP ruft keine `verein_*`-RPC»).
- [ ] Vereinsangaben in `teams_abrufen` und `spielerliste_abrufen`, optionales `team_id` mit Ableitung, Rückfrage beim Herausnehmen mit `stand`, Hinweis für Konten ohne Team.
- [ ] Werkzeugtext von `teams_abrufen` (W`lib/mcp/werkzeuge/team.ts`) berichtigen: «… das Übrige geht nur im Team-Bereich von KiFu» schliesst Umbenennen und Auflösen ein und ist seit Phase 5 (#581) falsch; beides macht nur die Vereinsverwaltung im Bereich «Verein» (in Phase 5 bewusst nicht geändert, MCP-Werkzeuge gehören zu dieser Phase).
- [ ] `ZUGANG_DARF` und `ZUGANG_DARF_NICHT`; der PR listet jede geänderte Zeile.
- [ ] Werkzeug-Handler exportieren und in `pruefe-kern-db.ts` prüfen.
- [ ] Review Focus 2: Ein Aufruf mit altem Werkzeugnamen ergibt «unbekanntes Werkzeug» und ändert nichts; das im echten KI-Client gegen Staging prüfen.

**Testfälle:** 25.

**Ausgang, zusätzlich:** der ganze E2E-Pfad aus AP §9 (Schritte 1–15) einmal durchgehend, lokal und auf Staging.

### D – Doku und Feedback-Wissen (AP §7.11, §5.6)

Ein PR auf `develop`, ohne Migration:
- [ ] `docs/produkt/verein.md` neu; `team-bereich.md`, `konto-und-zugang.md`, `uebungen.md`, `trainings.md`, `navigation.md`, `README.md` nachführen.
- [ ] `docs/feedback-triage.md` nachführen, `npm run gen:feedback-wissen`.
- [ ] Feedback-Dialog (`web/lib/feedback/prompt.ts`): Rollen Vereinsverwaltung und Konto ohne Verein, «Vereinsverwaltung» statt «Vereinsleitung», die neuen Grenzen als Absicht.
- [ ] Release-Text nach `docs/releases/` mit allen Punkten, die die Stories verlangen (Liste in AP §7.11), dazu «KI-Clients laden ihre Werkzeuge neu».
- [ ] **Aus Phase 8:** Im Release-Text der Hinweis, dass verbundene KI-Clients ihre Werkzeuge neu laden (die Schnupper-Werkzeuge heissen `schnuppertraining_abrufen`, `schnuppertraining_festlegen`, `spieler_schnuppern_setzen`, ohne Übergang); Produktdoku und `docs/feedback-triage.md` mit «Schnuppertraining» statt «Probetraining» und der Regel «genau ein Team» (W`lib/feedback/wissen.ts` ist bis dahin vom Wächter ausgenommen). Bis dahin sagen der Feedback-Dialog (W`lib/feedback/wissen.ts` aus `docs/feedback-triage.md`) und `docs/produkt/` noch «Probetraining». Die Seite `/versionen` behält die alten Release-Texte mit «Probetraining» (so gewollt, frühere Release-Texte bleiben).
- [ ] **Aus Phase 9:** Produktdoku (`team-bereich.md` bzw. `verein.md`): Der CSV-Import steht nur noch am Verein-Ort `/verein/spieler`, nur für die Verwaltung; neue Spieler:innen kommen ohne Team, bestehende erkennt er im ganzen Verein (auch ohne Team, schnuppernd), mehrfach Geführte ändert er nie, über 1000 übernimmt er nur ohne Neue; in der Spielerliste eines Teams gibt es keinen Import mehr. Dazu `docs/feedback-triage.md` (Grenzwerte: 1000 Zeilen, 1 MB, Vereinsgrenze; «Sieht aus wie ein Fehler»: veralteter Stand übernimmt nichts) und `gen:feedback-wissen`; im Release-Text der Punkt aus PC 6 (Story #585): nur noch die Vereinsverwaltung importiert, in den Bestand ohne Team mit Abgleich über den ganzen Verein, ordnet danach einzeln oder gesammelt Teams zu; Trainer:innen haben keinen Import mehr, erfassen Spieler:innen aber weiterhin einzeln.
- [ ] **Aus Phase 4:** In der Produktdoku zur Vereinsliste festhalten, wie die Suche vergleicht: Sie ignoriert Gross-/Kleinschreibung und Akzente und behandelt dabei «ß» wie «ss», «æ» wie «ae» und «œ» wie «oe» («Strasse» findet «Straße» und umgekehrt), kennt aber keine Umschreibung «ue» für «ü» («Mueller» findet «Müller» nicht).
- [ ] **Aus Phase 11:** Produktdoku (`verein.md`, `konto-und-zugang.md`, `team-bereich.md`): Verein gründen (zwei Bestätigungen, Name 1–60, nicht eindeutig, erste Verwaltung ohne Team), Einstieg für Konten ohne Verein, Verein löschen (Zahlen vorher, Name exakt, alles weg, Personen werden Konten ohne Verein, eigene Übungen und Trainings bleiben, Links/Abos/Abholadressen ungültig), Konto löschen in drei Fällen (frei, letzte Verwaltung, einzige Person mit Vereinsnamen), der Verein als verantwortlich an Link und Abholseite; `docs/feedback-triage.md` (u. a. «Sieht aus wie ein Fehler»: Name mit anderer Gross-/Kleinschreibung löscht nichts; inzwischen umbenannt) und `gen:feedback-wissen`; Release-Text mit dem Punkt aus PC 6 (Story #587).
- [ ] **Aus dem Fix-Lauf Story 11:** Bestandstexte mit Artikel vor dem Vereinsnamen neutral fassen wie die Sätze von Story 11 (AP §5.3 «Vereinsname ohne Artikel»): W`app/(app)/verein/verwaltung/page.tsx` (`<h1>` «Verwaltung des ‹Name›», Untertitel «Was den ganzen ‹Name› betrifft») und W`app/(app)/verein/spieler/page.tsx` (`<h1>` «Spieler:innen des ‹Name›»), W`lib/verein.ts` `spielerErfassenAbgewiesenText` («wird im ‹Verein› schon … geführt», zwei Sätze) und `spielerErfassenEinleitung` («kommt ohne Team in den ‹Verein›»), W`lib/spieler-import.ts` (zwei Sätze «… in den ‹Verein›»), W`lib/spieler.ts` `herausnehmenSaetze` («im ‹Verein›», auch im KI-Weg), W`components/verein/VereinTeamVerwaltung.tsx` («bleibt samt privatem Link im ‹Verein›»), die Bestätigungen «… verwaltet den ‹Verein› danach nicht mehr» und «Du verwaltest den ‹Verein› danach nicht mehr» (W`components/verein/VereinVerwaltung.tsx`), die Bestätigung beim Aufnehmen «Sie gehört damit zum ‹Verein›» (W`components/verein/VereinVerwaltung.tsx`, W`components/verein/VereinTeamVerwaltung.tsx`, W`components/team/MitgliederListe.tsx`, Styleguide-Demo); dazu die Fundstellen in Tests und AP. In der Produktdoku festhalten: Feedback (`feedback.team_id`, FK set null) bleibt nach dem Löschen eines Teams oder Vereins ohne Team-Bezug erhalten.
- [ ] **Aus dem Fix-Lauf Story 12:** Der Platz-Satz hat bewusst zwei Fassungen: bei der Abweisung (Datenebene, auch KI) «In der Anwendung schaffst du durch Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.», auf Seite und Dialog vor der Eingabe «Ohne Verein besitzt du höchstens … Lösche …, um Platz zu schaffen. In einem Verein gilt die Grenze nicht.» So belassen; die Produktdoku zitiert beide.
- [ ] **Aus Phase 12:** Produktdoku (`uebungen.md`, `trainings.md`, `konto-und-zugang.md`, `navigation.md`): höchstens 50 eigene Übungen und 30 eigene Trainings für Konten ohne Verein (was zählt, was nicht; Bestand über der Grenze bleibt und bleibt änderbar; in einem Verein gilt keine Grenze, ab der Aufnahme sofort; Anzeige in «Meine Übungen»/«Meine Trainings», auf den Anlegen-Seiten und in der Stufe vor Kopieren, Übernehmen und «In die Bibliothek»; keine Anzeige in der Seitenleiste; in ein Training übernehmen bleibt frei; der KI-Assistent bekommt dieselbe Auskunft). Dazu `docs/feedback-triage.md` (Grenzwerte 50/30; «Sieht aus wie ein Fehler»: Anzeige «62 Übungen (höchstens 50)» und Abweisung trotz Löschen einer Übung, solange der Bestand über der Grenze liegt; die Anzeige in der Übersicht nennt den ganzen Bestand, auch wenn ein Filter die Liste kürzt) und `gen:feedback-wissen`; Release-Text mit dem Punkt aus PC 4 (Story #588).
- [ ] `CLAUDE.md`-Gotchas (AP §5.6).

### A – Abschluss-PR (AP §3, §6.1 Schritt 1)

- [ ] `<ts>_zuordnung_invarianten_validieren.sql` anlegen; sie trägt den spätesten Zeitstempel des Release.
- [ ] `PUBLIC_TABLES` in `sync-staging.yml` um `team_spieler verein_verwaltung vereine` ergänzen, bytewise sortiert.
- [ ] Ab diesem Merge gibt es **keinen Sync aus `develop`** mehr bis zum Release.

### G – Generalprobe (AP §6.2, §6.5)

Mit Ankündigung, weil sie Staging-Daten und Testkonten ersetzt. Jeder Schritt, der Prod liest, braucht die Freigabe im Moment.

- [ ] `reset-staging.yml`: Staging-Schema auf `main`.
- [ ] Sync aus `main`.
- [ ] `deploy-staging.yml` aus `develop`: Die ganze Kette läuft auf Prod-Daten, samt Validierung. Laufzeit notieren; sie bestimmt die Länge des Fensters.
- [ ] `supabase/tests/prodweg_pruefen.sql` gegen Staging, danach E2E-Schritt 16 und ein Rundgang.
- [ ] **Aus Phase 4:** Laufzeit von `verein_spielerliste` mit 100 und 1000 Zeilen auf Staging messen (`explain analyze`, AP §10 Risiko 22); auf Prod (nur lesend, Freigabe) prüfen, in welchem Schema `unaccent` liegt (der `search_path` der Funktion nennt `public, extensions`) und welche Collation die Datenbank hat.
- [ ] **Aus Phase 9:** Laufzeit von `verein_spieler_importieren` auf Staging messen: Vorschau und Übernahme von 1000 neuen Zeilen eines Jahrgangs in einen leeren Verein über die Anwendung (Datei `tausend.csv`-artig), dazu eine Vorschau über einen vollen Verein; Grenze 8 s `statement_timeout`, lokal unter 150 ms.
- [ ] **Aus Phase 11:** Laufzeit von `verein_loeschen` (und `delete_account` der einzigen Person) mit 30 Teams und 1000 Spieler:innen auf Staging messen, über die Anwendung bzw. PostgREST (Rolle `authenticated`, Grenze 8 s `statement_timeout`); lokal rund 0,28 s auf nicht analysiertem Bestand. Der Plan-Punkt stand zuerst «vor dem Merge» in Phase 11 und ist wegen des grossen Abstands zur Grenze hierher verschoben (AP §11 F4).
- [ ] Review Focus 1: Migrationsliste von Prod mit `develop` vergleichen (`supabase migration list`, nur lesend, Freigabe). Liegt auf Prod eine Migration, die `develop` nicht kennt oder die später datiert ist als eine Vereine-Migration, wird das **vor** dem Fenster gelöst.
- [ ] Übrige Prüfabfragen aus AP §6.4 auf Prod (Freigabe): Teams über 100, Spieler:innen gesamt, Teams gesamt, Konten ohne Team.
- [ ] **Aus Phase 11:** Teams mit einem Namen nur aus Unicode-Leerraum (der Teamname-CHECK prüft nur `btrim`) auf Staging und Prod zählen (Freigabe, nur Zählwert): `select count(*) from teams where namen_ohne_rand(name) = ''`. Solche Teams lassen sich über die Namensbestätigung nicht auflösen (`namen_stimmen` verlangt einen nicht leeren Namen); ist der Wert nicht 0, entscheidet der PO über Umbenennen vor dem Release.
- [ ] **Aus dem Fix-Lauf Story 12:** zur Zählabfrage unten der Zählwächter «Konten in mehr als einem Verein» (Freigabe, nur Aggregat): `select count(*) from (select user_id from (select tm.user_id, t.verein_id from team_members tm join teams t on t.id = tm.team_id union select user_id, verein_id from verein_verwaltung) x group by user_id having count(distinct verein_id) > 1) y`. Erwartet 0; sonst entscheidet der PO, bevor das Verhalten bei Konten in zwei Vereinen (bewusst nicht geändert) Folgen hat.
- [ ] **Aus Phase 12:** Zählabfrage auf Staging und Prod (Freigabe, nur Aggregat, `begin read only; … rollback;`): wie viele bestätigte Konten ohne Verein es gibt und wie viele davon an oder über der Grenze liegen (Übungen ≥ 50 bzw. > 50, Trainings ≥ 30 bzw. > 30, gesperrt für Neues, Höchstwerte). Abfrage aus der DB-Erkundung Story 12, Punkt 7 (vor der Fundament-Migration ohne die `verein_verwaltung`-Bedingung; danach gleichwertig über `konto_bestand(u.id)`); sie entspricht `konten_ohne_verein` und `ohne_verein_ueber_50_uebungen`/`_30_trainings` aus AP §6.4.
- [ ] Firewall-Probe auf Staging (AP §6.1).

**Ausgang:** Generalprobe grün. Findet sie einen Fehler, kommt die Korrektur als neue Migration mit späterem Zeitstempel, und die Generalprobe läuft noch einmal.

### R – Release (AP §6.1, Ablauf am Release-Tag)

Jeder Schritt auf Prod nur mit Freigabe im Moment.

- [ ] PO: Bestandskonten ohne Team, die in einem Verein arbeiten sollen, in ein Team aufnehmen; Fenster ansetzen und die Trainer:innen informieren.
- [ ] Firewall-Regel «Wartung» aktivieren und von aussen prüfen.
- [ ] PR `develop` → `main` mergen; warten, bis `db push` grün **und** das neue Deployment auf der Produktionsdomain ist.
- [ ] Review Focus 5: Bricht `db push` ab, bleibt die Sperre. Der Fehler wird als neue Migration behoben und erneut ausgerollt. Nur wenn schon die erste Datei scheitert, ist ein Vercel-Rollback eine Option.
- [ ] Prüfabfragen aus AP §6.5 auf Prod, nur lesend; Rundgang mit dem eigenen Konto durch die Sperre.
- [ ] Review Focus 2: in einem vorher geöffneten Tab eine Aktion auslösen und in einem verbundenen KI-Client ein altes Werkzeug aufrufen; beides endet mit einer Meldung, ohne Wirkung.
- [ ] Review Focus 2, Story 2: Ein altes Bundle oder ein verbundener KI-Client liest während des Einspielens eine Abweisung `{status: 'abgewiesen'}` von `spieler_aufnehmen` als Erfolg (meldet «aufgenommen», obwohl nichts gespeichert ist) und scheitert bei `spieler_aendern` an der alten Signatur. Darum die Schreibwege erst freigeben, wenn die Migrationen **und** der Vercel-Deploy durch sind.
- [ ] Review Focus 2, Story 3: Die zusammengesetzten Fremdschlüssel aus `zuordnung_invarianten` machen zwei eingebettete Abfragen eines alten Bundles mehrdeutig (PostgREST PGRST201: Trainingsplan, Reiter «Spieler:innen» am Termin), bis das neue Bundle deployt ist. Gleicher Prüfschritt wie bei Story 2: Schreibwege und Seiten erst freigeben, wenn die Migrationen **und** der Vercel-Deploy durch sind.
- [ ] Review Focus 2, Story 7: Zwischen Migration und neuem Web-Bundle scheitert das alte Bundle an `spieler_link_holen`/`spieler_link_erneuern` mit einem Argument (Link-Knopf am Team-Ort und im KI-Weg), und für Spieler:innen in mehreren Teams zeigt es den Vereinsnamen als Team (Feld `team` der Link-Ansicht). Darum nur im Wartungsfenster; Link-Seite und Link-Knopf erst nach Migration **und** Vercel-Deploy prüfen.
- [ ] Review Focus 2, Story 8: Zwischen Migration und neuem Web-Bundle scheitert das alte Bundle an `spieler_probe_setzen`/`spieler_probe_folgen` mit der alten Signatur (ohne `p_team`), liest die widerrufenen Spalten `spieler.team_id`/`spieler.probe_seit` (42501) und kennt `schnuppern` in `verein_team_ansicht` nicht (statt `schnuppert`). Darum nur im Wartungsfenster; Schnuppern am Team-Ort und `/verein/team/[teamId]` erst nach Migration **und** Vercel-Deploy prüfen.
- [ ] Review Focus 2, Story 11: Das alte Bundle ruft `delete_account` ohne Argument; das trifft die neue Funktion (Default `null`). Den Status `verein_bestaetigen` der einzigen Person kennt es nicht und meldet einen Fehler, ohne `deleteUser` (nichts gelöscht). `verein` in Link- und Abholansicht liest es nicht. Konto löschen und Abholseite erst nach Migration **und** Vercel-Deploy prüfen. Umgekehrt (neues Bundle vor der Migration): `konto_loeschen_info` fehlt, die Konto-Seite zeigt statt des Knopfs die Fehlermeldung (`VEREIN_UNSTIMMIG.info`), nichts wird gelöscht; Gründen, Verein löschen und der Verein auf Link und Abholseite scheitern ebenso ohne Wirkung (Link und Abholseite gelten dann als ungültig).
- [ ] Firewall-Regel entfernen.
- [ ] GitHub-Release mit `--target main`, Text aus `docs/releases/`. Stories #577–#585 und #587–#589 als erledigt markieren.

### C – Aufräumen

C folgt unmittelbar auf R: Sobald `main` die Vereine-Migrationen trägt, setzt der Job «Prod-Weg» auf dem neuen Schema auf und wird rot.

- [ ] PR auf `develop`: CI-Job «Prod-Weg» samt `prodweg_bestand.sql` entfernen (passt nicht mehr zum Schema von `main`).
- [ ] Der Sync läuft wieder normal, auch aus `main`.
- [ ] Danach, als eigener Schritt: Supabase-CLI auf Version 3 heben (#604). Bis dahin bleibt sie auf 2.122.1 festgelegt.

### N1 – Nachlauf (AP §3.8)

Frühestens zwei Wochen nach R ohne Befund.

- [ ] Hilfsabfrage aus AP §5.5: Keine Funktion liest mehr `spieler.team_id`; grep-Wächter «vor N1» grün.
- [ ] Contract-Migration und Folgemigration (validate → set not null), `vereine_nachziehen.sql` und der Aufruf im Sync fallen.
- [ ] **Aus Phase 8:** Die Spalten `spieler.team_id` und `spieler.probe_seit` fallen; seit Phase 8 hat `authenticated` kein Leserecht mehr darauf, und ausser `vereine_nachziehen` liest sie keine Funktion.
- [ ] Kein Sync im Fenster von N1. Eigener, interner Release-Text.

---

## Präzisierungen gegenüber dem Architekturplan

Diese Punkte legt der Plan fest, weil der AP sie offen lässt oder die Reihenfolge es verlangt. Die PO hat sie am 13.11.2026 bestätigt; der AP ist an den betroffenen Stellen nachgeführt (§6.1, §6.2, §7.1, §7.11, §9, §11 F2).

1. **P0 vor allem anderen.** Auf `develop` liegt #596 unveröffentlicht. Ohne P0 käme es erst mit dem Vereine-Release nach Prod.
2. **V0 geht nach `main`.** Der AP lässt V0 nur auf `develop` (§6.1). `reset-staging.yml` ist aber neu, und `workflow_dispatch` startet nur Workflows, die auf dem Default-Branch liegen.
3. **Hotfix-Weg und «keine Migration im Hotfix».** Der AP nennt keinen Weg für Prod-Fehler während des Einfrierens.
4. **Abschluss-PR vor der Generalprobe.** Der AP nennt beide in einem Schritt (§6.1 Schritt 1), ohne Reihenfolge. So prüft die Generalprobe auch die Validierung. «Kein Sync mehr» heisst genauer: kein Sync aus `develop`; der Sync aus `main` in der Generalprobe ist erlaubt.
5. **MCP-Werkzeugtausch in Phase 3.** Der AP ordnet ihn Story 13 zu; ohne den Tausch riefe das Werkzeug zwischen Phase 3 und 13 eine gelöschte RPC auf.
6. **Bereich-Wechsler in Phase 5, Zähler 50/30 in Phase 12.** Der AP beschreibt beide in §7.1, ohne Story.
7. **Feedback-Dialog in Phase D.** Der AP führt nur `feedback-triage.md` nach, nicht die Rollen im Dialog.
8. **Migrationsliste von Prod in Phase G prüfen.** Steht im AP nicht.
