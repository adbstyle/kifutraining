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

- [ ] Erfassen ohne Team, Ändern, Löschen, Link abrufen und erneuern, alle am Verein-Ort und mit `nur_in_der_anwendung()`.
- [ ] **Aus Phase 5:** `verein_ansicht` um `spieler_ohne_team` ergänzen; der Kopf von `/verein` und `/verein/verwaltung` zeigt dann die Summe der Spieler:innen des Vereins.
- [ ] Mit diesem PR wird das Löschen aus Story 3 abgenommen (#579 AK 12, 14).
- [ ] Review Focus 4: dasselbe Konto mit beiden Rollen löscht im Bereich «Verein», aber nicht in der Team-Spielerliste.

**Testfälle:** 12 (Teil Verwaltung), 30 (Teil `verein_spieler_entfernen`).

### Phase 7 – #583 Link, Abo, Abholung über mehrere Teams

**AP:** §3.7 (Feedback über den Link), §4.4, §7.7, §7.8, §7.9. **Migration:** `link_mehrere_teams` (nur RPCs).

- [ ] Reihenfolge: `spieler_link_ansicht` und Abo über alle Zuordnungen → Ab- und Anmelden sperrt zuerst das Termin-Team → Abholung → `feedback_link_gueltig`.
- [ ] Zustände am Link nach dem Board: keine Termine, ohne Team, ungültig, Meldung für einen Termin, der nicht mehr gilt, «Fragen und Feedback» mit dem Verweis bei Dringendem.

**Testfälle:** 13, 23. Bestehende Links und Abo-Adressen liefern ohne Neubezug.

### Phase 8 – #584 Schnuppertraining

**AP:** §3.3 f, §4.4, §7.10 (Inventar «probe»). **Migration:** `schnuppertraining`.

- [ ] Regel «genau eine Zuordnung», Zuordnen zum Schnuppern, Abweisung der gesammelten Zuordnung nennt schnuppernde Spieler:innen (#584 AK 16).
- [ ] **Aus Phase 5:** «Schnuppern 1/4» in der Spielerliste von `/verein/team/[teamId]` und `schnuppern_beendet` in der Rückgabe von `verein_spieler_aus_team_nehmen` (#584 AK 13).
- [ ] Sichtbare Umbenennung in Oberfläche, Link und KI im selben PR; die MCP-Werkzeuge heissen neu, ohne Übergang. Interne Namen bleiben `probe_*`.
- [ ] grep-Wächter «kein Probe in Oberflächentexten und MCP» scharf stellen.

**Testfälle:** 17, 18, 19 (`rennen.sql`), 28.

### Phase 4 – #580 Spieler:innen des Vereins überblicken

**AP:** §4.3 (`verein_spielerliste`), §7.6. **Migration:** `verein_spielerliste` (drop + create).

- [ ] Liste für alle Vereinsmitglieder; Suche und Eingrenzung auf dem Server, Mehrfachauswahl bei Teams und Jahrgängen.
- [ ] **Aus Phase 5:** Der Leisteneintrag «Spieler:innen» im Bereich «Verein» und `/verein/spieler` gelten dann für alle Vereinsmitglieder (bis hierher nur für die Verwaltung, Kommentar in W`components/layout/AppNavClient.tsx`).
- [ ] Texte auf Abholseite und Link zum Empfängerkreis.

**Testfälle:** 4 (Teil Vereinsliste), 32.

### Phase 9 – #585 CSV-Import in den Spielerbestand

**AP:** §3.7, §4.3, §7.9. **Migration:** `import_verein`.

- [ ] Neuer Import am Verein-Ort; der Team-Import und sein Knopf fallen im selben PR.
- [ ] grep-Wächter «kein `spieler_importieren(`» scharf stellen.

**Testfälle:** 24.

### Phase 11 – #587 Verein gründen und löschen

**AP:** §3.4, §7.2, §7.3. **Migration:** `verein_gruenden_loeschen`.

- [ ] **Vor dem Merge:** Laufzeit von `verein_loeschen` mit 30 Teams und 1000 Spieler:innen auf Staging messen (AP §11 F4).
- [ ] Reihenfolge: Gründen → Verein löschen → `delete_account(p_vereinsname)` mit dem Zweig der einzigen Person → Einstieg auf `/teams` für Konten ohne Verein.
- [ ] Verein als verantwortlich auf Abholseite und Link.
- [ ] **Aus Phase 5:** `konto_loeschen_info` (bleibende Teams namentlich, `einzige_person`), das Feld `einzige_person` in `verein_verwaltung_entfernen`, die Löschzahlen in `verein_ansicht`, «Verein löschen» in der Gefahrenzone von `/verein/verwaltung`; den Wortlaut von `LETZTE_VERWALTUNG` («… im Bereich «Verein» löschen») gegen die fertige Oberfläche prüfen.

**Testfälle:** 15, 20, 21, 30 (übrige RPCs).

**Zwischenstand:** Konten ohne Verein haben noch keine Grenzen (bis Phase 12).

### Phase 12 – #588 Konten ohne Verein

**AP:** §3.5, §4.4 «Kontogrenzen», §7.2. **Migration:** `konten_ohne_verein`.

- [ ] In `pruefe-kern-db.ts` tritt das Konto mit vielen Übungen zuerst dem Test-Verein bei; die Grenzen prüft ein eigenes Konto ohne Verein.
- [ ] Trigger für 50/30; `meine_vereinslage()` füllt neu `grenzen`; Anzeige `BestandAnzeige` in Leiste, Übersichten und Dialogen; die Sperre der Teamfunktionen (#588 AK 9).
- [ ] MCP-Texte zu den Grenzen im selben PR.

**Testfälle:** 22.

### Phase 13 – #589 KI-Assistent und Vereine

**AP:** §7.10. **Migration:** keine.

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
- [ ] Review Focus 1: Migrationsliste von Prod mit `develop` vergleichen (`supabase migration list`, nur lesend, Freigabe). Liegt auf Prod eine Migration, die `develop` nicht kennt oder die später datiert ist als eine Vereine-Migration, wird das **vor** dem Fenster gelöst.
- [ ] Übrige Prüfabfragen aus AP §6.4 auf Prod (Freigabe): Teams über 100, Spieler:innen gesamt, Teams gesamt, Konten ohne Team.
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
