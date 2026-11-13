# Architekturplan: Vereine

**Stand: 11.11.2026, gerechnet auf develop (Release 1.46.0).** Eingearbeitet sind das Review vom 11.11.2026 (26 Befunde) und die UX-Entscheide des Boards «UX/UI-Konzept» (Bereich-Wechsler, Zähler 50/30 in der Leiste, Import per Icon-Knopf). Geprüft gegen `origin/develop` @ 5e44610. Gegenüber dem Release-Stand kommt dort nur #596 dazu (Eingrenzung der Termine auf dem privaten Link nach Trainings und Spielen, W`components/privat/ElternAnsicht.tsx`, W`lib/spieler.ts`); das berührt §7.7, nicht das Datenmodell. Die Umsetzung beginnt in einem eigenen Worktree auf `develop`.

**Grundlage:**
- **Wahrheit sind Epic #575 und die Stories #577–#585, #587–#589** (Stand 01.11.2026). Story 0 (#576, Spike Einladungsmail) und Story 10 (#586, Einladung an Personen ohne Konto) entfallen. Wo dieser Plan von einer Story abweicht, gilt die Story.
- Der Plan schreibt die Vorfassung vom 29.10.2026 fort (Entwurf B «robust» mit Ideen aus Entwurf A, Jury-Korrekturen, Prüfbefunde; Anhang: Prüfprotokoll, historisch).
- **Weiter gilt aus der Vorfassung:** Spieler:innen gehören dem Verein und kommen über `team_spieler` in Teams; zusammengesetzte Fremdschlüssel halten Team und Spieler:in im selben Verein; Termin-FKs `(termin_id, team_id)`; die Sperrordnung; `ist_team_mitglied` ohne Vereins-Klausel; Backfill «FC Wyler» ohne Zusammenführung; Testdaten unter der Grenze statt Umgehungs-Schalter.
- **Entfallen gegenüber der Vorfassung** (überholt durch die Stories, Einzelheiten §0): Invite-only, Zugangsantrag, Freigabe, Admin-Seite, Allowlist `PLATTFORM_ADMINS`, Gründungsrecht mit Fristen, Tabelle `einladungen`, Einladungsmail, Löschen unbestätigter Altkonten, Annahme einer Verwaltungs-Einladung, Probe je Verein, Namensschlüssel nur je Team, «Verwaltung wird beim Team-Anlegen standardmässig Mitglied», summierte Prädikate `Mitglied OR Verwaltung`, die Releases R0–R3.
- Die alte §0 (PO-Entscheide vom 29.10. mit der Adresse der künftigen Verwaltung im Klartext) ist ersetzt. **F1 ist damit erledigt:** Plan und Migrationen nennen keine Adresse einer Person. Der Backfill bestimmt das Konto der Plattform-Admin über seine `auth.users.id`, die Adrian selbst abliest (§6.3, §6.4).

**Selbst nachgeprüft (`origin/develop` @ 5e44610):**
- **`create_team` und `erstelleTeam`:**
  - `create_team` legt Team und erste Mitgliedschaft atomar an und prüft den Teamnamen auf 1–60 Zeichen (`20260824200312_team_rpcs.sql:9-27`).
  - Der Kommentar in W`lib/actions/teams.ts:25-27` begründet das mit «ein Team, das niemand mehr sieht». Mit Story 5 AK 17 entfällt die Mitgliedschaft beim Anlegen; das Team bleibt über die Vereinsansicht sichtbar (§4.3).
- **Aufnahme per E-Mail-Adresse mit Bremse:** `finde_trainer`, `add_team_member`, `trainer_per_email`, `such_bremse_aktiv`, Tabelle `trainer_suchversuche` (`20260824200312_team_rpcs.sql:30-141`). Dieselbe Bremse gilt künftig für die Aufnahme durch die Verwaltung (Story 5 AK 13) und in die Verwaltung.
- **E-Mail-Adressen im Team:** `team_mitglieder` liefert sie nur Mitgliedern (`20261014120000_team_mitglieder_email.sql`). Die Verwaltung sieht sie neu für alle Teams des Vereins, über eine eigene Vereins-RPC (§4.3).
- **Team ohne Mitglied löst sich heute auf:** Trigger `team_aufloesen_wenn_leer` (`20260824195749_team_datenmodell.sql:282-295`), genutzt von `entferne_team_mitglied` (`20261024100000_team_aufloesen_namensbestaetigung.sql:73-134`, Rückgabe `aufloesung_noetig` in `:121`) und vom Konto-Löschen. Der Trigger entfällt (Epic PO 8).
- **`deleteAccount` verschluckt RPC-Fehler:** `if (error) return;` (W`lib/actions/auth.ts:215-216`). Für die Abweisung der letzten Verwaltung und die Vereinsnamen-Prüfung (Story 5 AK 34, Story 11 AK 12, 14) muss der Grund zurückkommen.
- **Registrierung bleibt offen:** `register()` ruft `supabase.auth.signUp` (W`lib/actions/auth.ts:72`), `resendConfirmation` folgt in `:92`. Daran ändert dieses Epic nichts.
- **`spieler_vorher` und `spieler_aufnehmen`:**
  - `spieler_vorher` sperrt je Team und prüft `>= 200` nur bei INSERT (`20261016100000_spielerliste.sql:172-189`). Mit `team_id = NULL` sperrt er nichts (`hashtextextended(NULL)` ist strikt) und zählt 0.
  - `spieler_team_fest` liegt in `:191-201`.
  - `spieler_aufnehmen` sperrt das Team **vor** dem Insert (`:315`) und übersetzt `unique_violation` in `SPIELER_DOPPELT` (`:327-328`).
- **`spieler_importieren`:**
  - Der Zeilendeckel `> 1000` nutzt denselben Marker `SPIELERLISTE_VOLL` (`20261018100000_spieler_import.sql:37-38`).
  - Die Grenzprüfung `v_bestand + neu > 200` gilt auch bei `neu = 0` (`:91`).
  - Duplikate werden über `s.team_id = p_team` gesucht (`:63`). Der Team-Import entfällt (Story 9 AK 12); der Vereins-Import übernimmt Parser und Vorschau (§7.9).
- **Probe (`20261029110000_probetraining.sql`):**
  - `probe_stand` ist `language sql stable` **ohne** DEFINER (`:114-116`), `team_probe_staende` hat einen Grant an `authenticated` (`:150-151`). W`lib/kern/spieler.ts:75` ruft `team_probe_staende` mit dem Nutzer-Client auf.
  - `spieler_probe_folgen` und `spieler_probe_setzen` leiten das Team aus `spieler.team_id` ab (`:156`, `:182`).
  - `spieler_link_abmelden` sperrt `'spieler:'‖s.team_id` und liest erst danach die Probe (`:281-295`). `abmeldung_anwenden_training` sperrt das Termin-Team und dann die Termin-Zeile (`20261029100000_meldestand.sql:205-212`).
  - MCP-Werkzeuge heute: `probetraining_abrufen`, `probetraining_festlegen`, `spieler_probe_setzen`. Sie werden ohne Übergang umbenannt (Story 8 AK 3, OoS 3).
- **`feedback_link_team`** liefert `spieler.team_id` und ist zugleich die Gültigkeitsprüfung des Links (`20261028110000_feedback_link.sql:21-25`). Eine Spieler:in ohne Team hat einen gültigen Link (Story 7 AK 18); die Prüfung muss vom Team getrennt werden (§3.7).
- **Funktionsrechte:** Neue Funktionen sind ohne ausdrückliches `revoke` aufrufbar (EXECUTE für PUBLIC). Der bestehende Code widerruft deshalb ausdrücklich, z. B. `feedback_link_team … from public, anon, authenticated` (`:25`) und `alle_mitglieder` (`20260930223606_termin_verantwortliche.sql:92`).
- **Denormalisiertes `team_id` ohne Termin-FK:** `termin_kader` (`20261018130000_termin_kader.sql:41-47`), `spiel_treffpunkte` (`20261021220000_spiel_treffpunkte.sql:22-25`). `termin_teilnahmen` und `spiel_teilnahmen` tragen `team_id` ganz ohne FK, ihr `termin_id` zeigt auf `termin_eingefroren(termin_id)` (`spielerliste.sql:105-112`, `spiel_meldungen.sql:112-121`).
- **Seit der Vorfassung neu (1.45.0, 1.46.0):** Treffpunkt (#561) und Hinweis für Eltern (#590) fügen nur Spalten an `training_termine` und `termin_serien` an (`20261031120000_treffpunkt_training.sql:38-49`, `20261031100000_hinweis_eltern.sql:24-30`) und leiten in den Serien-RPCs das Team aus `termin_serien.team_id` ab. Neue Tabellen mit `team_id` gibt es nicht; der Termin-FK-Umfang (§3.3) bleibt.
- **Selbstabholung:** `abholung_sperren` und `abholung_abholen` mit Schlüssel je Anschluss (`20261016140000_selbstabholung.sql:61-70`, ab `:126`). `anschlussVon` fasst IPv6 auf das /64-Präfix (W`lib/abholung.ts:31`). `env.abholSchluessel()` ist ohne `ABHOL_SPERRE_SCHLUESSEL` null (W`lib/env.ts:24`).
- **Service-Role-Client:** Ausnahmen-Kommentar in W`lib/supabase/admin.ts:4-16`. Dieses Epic fügt **keine neue Art** von Ausnahme hinzu (keine Admin-Seite). `loescheVerein` und `deleteAccount` (Fall «einzige Person») nutzen die bestehende Ausnahme für den Bild-Nachlauf (`raeumeVerwaisteBilder`, wie W`lib/actions/teams.ts:185-189`); der Kommentar in `admin.ts` nennt sie als weitere Aufrufstellen.
- **OAuth-Token des KI-Clients** tragen einen `client_id`-Claim (W`lib/supabase/bearer.ts:12`, `:72`), Browser-Sitzungen nicht. Daran erkennen die Vereins-RPCs einen KI-Zugang (§4.1 `nur_in_der_anwendung`).
- **Middleware:** `PROTECTED_PREFIXES` = `/neu`, `/konto`, `/training/neu`, `/team`, `/teams` (W`lib/supabase/middleware.ts:10-19`). Der Bereich «Verein» kommt dazu (§7.1).
- **Eigene Übungen und Trainings** (für die Grenzen 50/30): `exercises.owner_id`; `trainings.owner_id` mit `team_id` für Team-Trainings; Übungen in Trainings sind Kopien in `training_exercises` und zählen nicht (W`lib/database.types.ts`).
- **MCP-Zustimmung:**
  - W`lib/mcp/umfang.ts:1-10`: Die Erlauben-Seite nennt den vollen Umfang; wer den Werkzeugsatz über diese Liste hinaus erweitert, muss die Liste ändern und damit die Frage nach erneuter Zustimmung stellen. Für dieses Epic hat der PO sie beantwortet: keine erneute Zustimmung (Story 8 PC 4, Story 13 PC 2).
  - `ZUGANG_DARF` nennt «die Spielerliste deiner Teams» (`:18`), `ZUGANG_DARF_NICHT` «die Verwaltung deiner Teams (gründen, umbenennen, Mitglieder aufnehmen oder entfernen)» (`:23`).
  - Web-Actions und MCP nutzen denselben Fachkern (W`lib/actions/spieler.ts:3-13` importiert aus W`lib/kern/spieler.ts`).
- **Web-Leser über `spieler.team_id`:** W`lib/kern/spieler.ts:117`, `:195`, W`lib/kern/abmeldungen.ts:86`, W`lib/kern/spiele.ts:135`.
- **Auflösungszahlen:** `getTeam` liest `teams` über die RLS (W`lib/queries/teams.ts:62-70`), `getTeamAufloesungsInfo` zählt Trainings und Termine mit dem Nutzer-Client (ab `:86`). Die Verwaltung braucht die Zahlen ohne Mitgliedschaft (Story 5 AK 25), also über eine DEFINER-RPC.
- **`pruefe-kern-db.ts`** spricht nur über `@supabase/supabase-js` (`:12`, kein pg-Treiber). Teams ohne Verein legt es an sechs Stellen direkt an (`:796`, `:1183`, `:1324`, `:1327`, `:1422`, `:1544`). #480-Tests erwarten `aufloesung_noetig` (`:3843`) und «Konto-Löschung löst ohne Namen auf» (`:3878`); beide kehren sich um (Team bleibt).
- **`sync-staging.yml`:** `PUBLIC_TABLES` steht in `:67`, bytewise sortiert; der Guard vergleicht ab `:114`. `truncate … cascade` läuft vor dem Restore, unter `replica`.
- Aus der Vorfassung weiter gültig und dort belegt: `teams` UPDATE-Grant tabellenweit, Spalten-Grants auf `spieler`, Rückschreiben in `termin_zeitpunkt_nachher`/`spiel_zeitpunkt_nachher`, `termin_teilnehmer` als INVOKER (per `drop`+`create` neu angelegt, `meldestand.sql:532-560`), `team_members.created_at` vorhanden.

Pfade ohne Ordner meinen `supabase/migrations/`. **W** = `web/`.

---

## 0. Entscheide (Stand 01.11.2026)

Massgeblich ist **Epic #575** mit seinen PO-Entscheiden 1–14 und den Stories. Diese Übersicht fasst sie technisch zusammen; sie ersetzt die PO-Entscheide vom 29.10. und die Empfehlungen der alten §11. Der übrige Plan ist darauf durchgerechnet.

**Stories und Plan**

| Story | Issue | Technischer Kern | Plan |
|---|---|---|---|
| 1 | #577 | `vereine`, `verein_verwaltung`, `teams.verein_id`, Backfill FC Wyler, Team anlegen nur Verwaltung, Grenzen 100/1000 beim Erfassen | §3.1, §3.10, §6.3 |
| 2 | #578 | Namensschlüssel eindeutig je Verein, Meldung nennt Teams | §3.3 |
| 3 | #579 | `team_spieler`, Zuordnen (einzeln, gesammelt), Herausnehmen, Löschen aus dem Verein nur durch die Verwaltung, Termin-FKs | §3.2, §3.3, §4.3 |
| 4 | #580 | Vereinsliste (Name, Jahrgang, Teams) für alle Vereinsmitglieder | §4.3, §7.6 |
| 5 | #581 | Bereich «Verein», Teams und Trainer:innen, Verwaltung aufnehmen/entfernen, Team bleibt ohne Mitglied | §3.6, §4.3, §7.4 |
| 6 | #582 | Spielerbestand: Spieler:innen ohne Team, J+S, Link, Löschen durch die Verwaltung | §3.7, §7.6 |
| 7 | #583 | Ein Link über alle Teams, Abo «Trainings und Spiele», Abholung über jedes Team | §7.7, §7.8, §7.9 |
| 8 | #584 | Schnuppertraining nur bei genau einer Zuordnung, Umbenennung samt KI-Werkzeugen | §3.3, §7.10 |
| 9 | #585 | CSV-Import nur Verwaltung, in den Bestand ohne Team, Abgleich über den Verein | §4.3, §7.9 |
| 11 | #587 | Verein gründen und löschen, höchstens ein Verein je Person | §3.4, §7.2, §7.3 |
| 12 | #588 | Konten ohne Verein: höchstens 50 eigene Übungen, 30 eigene Trainings | §3.5 |
| 13 | #589 | KI kennt Verein und weitere Teams, Herausnehmen mit Bestätigung, kein Löschen | §7.10 |

**Grundmodell**
- **Es gibt immer einen Verein.** `teams.verein_id` ist Pflicht und unveränderlich. Teamnamen sind je Verein eindeutig (gleiche Vergleichsregeln wie bei Spielernamen), Vereinsnamen nicht (1–60 Zeichen). Bestehende gleichnamige Teams bleiben (Story 5 PC 6).
- **Bestand:** Alle Prod-Teams kommen unter «FC Wyler». Erstes und zum Release einziges Verwaltungsmitglied ist das Konto der Plattform-Admin, bestimmt über seine `auth.users.id` (§6.3). Bestandskonten ohne Team, die in einem Verein arbeiten sollen, ordnet die PO vor dem Release selbst zu (Epic PO 10).
- **Spieler:innen gehören dem Verein** (`spieler.verein_id`) und kommen über `team_spieler` (n:m) in Teams. Dubletten aus dem Bestand bleiben getrennt, mit je eigenem Link; jeder Datensatz bekommt im Backfill genau eine Zuordnung zu seinem bisherigen Team.
- **Vereinsmitgliedschaft ist abgeleitet:** Mitglied eines Teams des Vereins oder der Verwaltung. **Eine Person gehört höchstens einem Verein an.** Die Datenbank erzwingt das bei jedem Insert in `team_members` und `verein_verwaltung` unter einer Sperre je Person; die Abweisung nennt den anderen Verein nie (Story 11 AK 7–9, §3.1).
- **Konto ohne Verein** ist ebenfalls abgeleitet: weder `team_members` noch `verein_verwaltung`. Es entsteht mit jeder Registrierung, beim Verlassen des letzten Teams bzw. der Verwaltung und beim Löschen des Vereins. Nie bestätigte Konten verfallen nicht.
- **Kein Preisplan** in diesem Epic; das Team bleibt die spätere abrechenbare Einheit.

**Zugang: Registrierung bleibt offen**
- Keine Änderung an `enable_signup`, an der Registrierung oder an den Auth-Templates. Keine Tabellen `zugangsantraege`, `zugang_bremse`, `einladungen`; keine Admin-Seite, keine Allowlist, kein `inviteUserByEmail`, kein Löschen von Altkonten.
- **Ins Team und in die Verwaltung kommt nur ein bestätigtes Konto, sofort per E-Mail-Adresse**, ohne Annahme durch die aufgenommene Person (Epic PO 3, 10). Wer aufnimmt, sieht vorher den Anzeigenamen und erfährt die Tragweite (Story 11 AK 16); es gilt die Bremse von `trainer_suchversuche`.
- **Verein gründen:** nur ein Konto ohne Verein; Name 1–60; die Bestätigung von Berechtigung und Datenverantwortung ist Pflicht in der Oberfläche, wird aber weder gespeichert noch geprüft (Story 11 AK 3, OoS 2). Die Person wird erste Verwaltung, der Verein hat noch kein Team (§3.4).
- **Plattform-Admin hat keine Sonderrolle:** weder in der DB noch in der Anwendung, keine Übersicht aller Vereine. Fällt die einzige Verwaltung eines Vereins weg, hilft die Betreiberin technisch (SQL ausserhalb der Anwendung), nicht über einen App-Pfad.

**Rollen nach Ort (Epic PO 13)**
- **Im Team** handelt jede Person als Mitglied, auch wenn sie der Verwaltung angehört: gleiche Rechte, gleiche Meldungen. **Im Bereich «Verein»** gibt es die Funktionen der Verwaltung. Kein Rollenschalter.
- **Technisch:** Jede schreibende RPC gehört zu genau einem Ort und prüft genau eine Rolle. Team-RPCs bekommen das Team ausdrücklich (`p_team`) und prüfen `ist_team_mitglied(p_team)` (bei Spieler:innen zusätzlich `spieler_im_team`). Vereins-RPCs prüfen `ist_verein_verwaltung(verein)`. **Es gibt kein Prädikat der Form `Mitglied OR Verwaltung`** für Handlungen; `darf_team_verwalten`, `darf_spieler_fuehren` und `darf_spieler_zuordnen` der Vorfassung entfallen (§4.1).
- **Lesekreise** (RLS-SELECT) folgen nur der Teammitgliedschaft; keine Policy hat eine Verwaltungsklausel (§4.2). Was die Verwaltung darüber hinaus liest, liefern DEFINER-RPCs des Bereichs «Verein». Welche Spalten und Aktionen eine Ansicht zeigt, bestimmt der Ort: Die Team-Spielerliste liest über `team_spieler` des Teams, der Bereich «Verein» über Vereins-RPCs.
- **Teaminhalte** (Termine, Trainings, Kader, Meldungen, Abo, Abholung) sieht und bearbeitet die Verwaltung nur als Mitglied. Sie kann sich jederzeit selbst aufnehmen. Ausgenommen ist der private Link: Er gehört zum Spielerbestand, nicht zu den Teaminhalten (Story 5 AK 10).
- **Team anlegen** nur Verwaltung, **ohne** Mitgliedschaft (Story 5 AK 17); **umbenennen und auflösen** nur Verwaltung, im Bereich «Verein». Trainer:innen nehmen im eigenen Team bestätigte Konten auf und entfernen Mitglieder, auch Verwaltungsmitglieder (Story 5 AK 16).
- **Team bleibt bestehen**, wenn das letzte Mitglied geht oder sein Konto löscht (`team_aufloesen_wenn_leer` entfällt ersatzlos).
- **Verwaltung:** mehrere gleichberechtigte Personen, unbegrenzt, mindestens eine; kein Anzeigename nötig. Das letzte Verwaltungsmitglied kann weder entfernt werden noch austreten noch sein Konto löschen, ausser es ist die einzige Person des Vereins: Dann löscht es sein Konto mit Eingabe des Vereinsnamens, und der Verein geht mit (Epic PO 3, 14).

**Spieler:innen**
- **Namensschlüssel (Vorname, Nachname, Jahrgang) eindeutig je Verein**, nach den heutigen Vergleichsregeln (`spieler_text_schluessel`). In der Datenbank erzwungen (Trigger-Prüfung unter Vereinssperre wie bei Teamnamen), damit gleichzeitige Eingaben genau eine gewinnen lassen; Altdubletten bleiben unberührt, solange ihr Schlüssel gleich bleibt (Story 2 AK 7, §3.3). Die Doppel-Prüfung kommt vor den Grenzen. Die Meldung nennt höchstens Name, Jahrgang und Teams bzw. «keinem Team zugeordnet», nie J+S oder Link; der Text ist in Anwendung und KI derselbe.
- **Zuordnen zu einem weiteren Team** nur Verwaltung, einzeln oder gesammelt in ein Team (ganz oder gar nicht, ohne Schnuppern). Abgewiesen: schon zugeordnet, gleicher Schlüssel im Team (Altdubletten), Teamgrenze; gleicher Schlüssel vor der Grenze.
- **Herausnehmen:** Mitglied aus dem eigenen Team, Verwaltung aus jedem Team. Die Spieler:in bleibt samt Link im Verein; künftige Abmeldungen, Spiel-Meldungen und Kaderzugehörigkeiten im Team verfallen, begonnene Termine behalten den Stand bei Beginn mit Namen.
- **Löschen aus dem Verein:** ausschliesslich die Verwaltung, im Bereich «Verein», immer (PO 01.11.2026, Story 3 AK 12, Epic PO 3, 4, 7). Mitglieder löschen nie, auch nicht, wenn alle Teams der Spieler:in eigene sind (Story 3 OoS 5); sie nehmen sie nur aus ihrem Team. Nach dem letzten Team bleibt die Spieler:in ohne Team im Spielerbestand. Spieler:innen ohne Team ändert, ordnet zu, löscht und verlinkt nur die Verwaltung; sie bleiben unbefristet.
- **Sichtbarkeit (Epic PO 5):** Name, Jahrgang und Teams aller Vereins-Spieler:innen sehen alle Vereinsmitglieder; J+S und Link die Mitglieder ihrer Teams und die Verwaltung; Meldungen nur die Mitglieder des Termin-Teams.
- **Schnuppertraining** (bisher Probetraining): nur bei genau einer Zuordnung; Status, Kontingent und Zählung je Team. Der Status wandert von `spieler.probe_seit` auf die Zuordnung, damit Herausnehmen und Auflösen ihn samt Zählung beenden (§3.3). Die Verwaltung wählt «zum Schnuppern» nur beim Zuordnen einer Spieler:in ohne Team; ein- und ausschalten nur Mitglieder. Sichtbar umbenannt werden Texte, Plakette, Link, KI-Werkzeuge und deren Beschreibungen (ohne Übergang); interne DB-Namen (`probe_*`, `team_probetraining`) bleiben, weil sie nirgends erscheinen (offene Frage F-Begriff in §11).
- **Privater Link:** einer je Spieler:in für alle Teams; gemischte Terminliste mit Teamname; Abo «Trainings und Spiele» über alle Teams, auch ohne Team gültig; Abholung über jedes Team mit eingeschalteter Selbstabholung liefert denselben Link; erneuern dürfen die Mitglieder ihrer Teams und die Verwaltung. Abholseite und Link nennen den **Verein als verantwortlich** und den neuen Empfängerkreis (Story 4 PC 4, Story 11 PC 2).
- **CSV-Import** nur Verwaltung, in den Bestand ohne Team, Abgleich über den ganzen Verein, nur die Vereinsgrenze; kein Team-Import mehr (auch nicht für Verwaltungsmitglieder im Team), kein KI-Import.

**Grenzen (bis zum Preisplan, ohne Ausnahme)**
- 30 Teams und 1000 Spieler:innen je Verein (Spieler:innen ohne Team eingeschlossen), 100 je Team (jede Zuordnung zählt, Schnuppernde und Altdubletten auch). Bestand darüber bleibt, nur Neues wird abgewiesen. Gesammeltes Zuordnen über die Teamgrenze und Import über die Vereinsgrenze werden ganz abgelehnt; ein Import ohne neue Spieler:innen ist auch über der Grenze erlaubt.
- Konten ohne Verein: höchstens 50 eigene Übungen und 30 eigene Trainings (`owner_id`; Entwürfe, veröffentlichte, Kopien und Übernahmen zählen; Team-Trainings, Varianten, Gruppen und Übungen in Trainings nicht). Abgewiesen werden Übung anlegen, kopieren, aus Training in die Bibliothek kopieren, Training anlegen und übernehmen, in App und KI; Übung in ein Training übernehmen bleibt frei. Die Grenzen gelten ab dem Moment, in dem das Konto keinem Verein angehört, und fallen sofort mit der Aufnahme, auch für laufende Sitzungen und KI-Zugänge. Erzwungen in der DB unter der Sperre je Person (§3.5).

**Verein löschen (Epic PO 14)**
- Nur die Verwaltung des eigenen Vereins, im Bereich «Verein», mit Eingabe des aktuellen Vereinsnamens (Gross-/Kleinschreibung zählt, Rand-Leerzeichen nicht), Recheck beim Ausführen. Alle Teams gehen wie beim Auflösen, dazu der ganze Spielerbestand samt Links, Abos und Abholadressen; alle Personen werden Konten ohne Verein und behalten ihre persönlichen Übungen und Trainings. Nicht wiederherstellbar.

**KI-Assistent (Story 13, Epic PO 12)**
- Nur zusätzliche Vereinsangaben: Verein der Teams, Namen weiterer Teams einer Spieler:in, Link-Auskunft über alle Teams, Hinweis für Konten ohne Team. Herausnehmen aus einem bestimmten eigenen Team zweistufig (Auskunft, Bestätigung, Recheck der Teammenge). **Kein Löschen über die KI** (Story 13 AK 5): Das bisherige Werkzeug `spieler_entfernen` entfällt ohne Nachfolger fürs Löschen; die Werkzeugbeschreibung nennt, dass nur die Vereinsverwaltung in der Anwendung löscht. Spieler:innen ausserhalb der eigenen Teams sind «nicht gefunden» (ausser in Abweisungstexten und an begonnenen Terminen). `ZUGANG_DARF`/`ZUGANG_DARF_NICHT` werden ergänzt, ohne erneute Zustimmung. Vereinsverwaltung nie per KI: Der Werkzeugsatz enthält keine, und die Datenbank weist jede Vereins-RPC mit einem KI-Token ab (`NUR_IN_DER_ANWENDUNG`, §4.1).

**Release**
- **Alle Stories gehen gemeinsam in einem Release nach Prod**, mit kurzem Wartungsfenster (Story 1 OoS 3, Epic Erfolgskriterium 10). Die Migrationen bleiben in technischer Reihenfolge getrennte Dateien (§6), aber es gibt keine Zwischenstände auf Prod und damit keine N-1-Pflicht zwischen ihnen.
- **Vereine zuerst:** #482, #504/#505 und #514 warten (Epic PO 12). #561 und #590 sind schon live (1.46.0) und im Plan berücksichtigt.

---

## 1. Zusammenfassung

**Verein, Team, Spieler:in**
- Jedes Team gehört genau einem Verein (`teams.verein_id`, Pflicht, unveränderlich, Teamname eindeutig je Verein).
- Den Bestand hängt ein wiederholbarer Backfill unter «FC Wyler»; Verwaltung wird das Konto der Plattform-Admin über seine feste `auth.users.id` (§6.3). Vor dem Release bestätigt der PO anhand der Teamliste, dass alle Prod-Teams zum FC Wyler gehören.
- Spieler:innen gehören dem Verein (`spieler.verein_id`) und kommen über `team_spieler` (n:m) in Teams. Zusammengesetzte Fremdschlüssel erzwingen, dass Team und Spieler:in im selben Verein liegen. Kader und Meldungen betreffen nur zugeordnete Spieler:innen, Termin-FKs `(termin_id, team_id)` halten Meldungen beim Team des Termins.
- Der Namensschlüssel ist **je Verein** eindeutig; Altdubletten bleiben getrennt und änderbar, solange ihr Schlüssel gleich bleibt.
- Spieler:innen ohne Team bleiben im Verein; verantwortlich ist die Verwaltung. Aus dem Verein löscht nur die Verwaltung; Mitglieder und der KI-Assistent nehmen nur aus einem Team (PO 01.11.2026).

**Rollen**
- Neu ist die **Vereinsverwaltung** (`verein_verwaltung`, mindestens eine Person, unbegrenzt). Aufnahme sofort per E-Mail-Adresse eines bestätigten Kontos, durch Gründen oder durch den Backfill.
- **Vereinsmitglied** ist abgeleitet (Team-Mitglied oder Verwaltung); **höchstens ein Verein je Person**, in der DB erzwungen.
- **Rollen nach Ort:** Team-RPCs prüfen nur `ist_team_mitglied`, Vereins-RPCs nur `ist_verein_verwaltung`; nie beides verknüpft. Wer beides ist, hat im Team die Rechte und Meldungen eines Mitglieds.
- `ist_team_mitglied` bleibt unverändert und bekommt nie eine Vereins-Klausel; `teams_select` wird nicht breiter. Was die Verwaltung über fremde Teams braucht (Trainer:innen mit E-Mail, Spielerzahl, Auflösungszahlen), liefern DEFINER-RPCs des Bereichs «Verein».
- Die Plattform-Admin hat keine eigene Rolle; sie ist gewöhnliche Verwaltung des FC Wyler.

**Zugang und Konten**
- Die Registrierung bleibt offen. Ein neues Konto ist ein **Konto ohne Verein**: eigene Übungen und Trainings, Bibliothek, KI; keine Teams, Spielerlisten, Kalender. Bis zum Preisplan höchstens 50 eigene Übungen und 30 eigene Trainings, in der DB unter der Sperre je Person geprüft.
- Ein Konto ohne Verein gründet selbst einen Verein und wird erste Verwaltung; es gibt weder Antrag noch Freigabe noch Einladungsmail.
- Aufnahme ins Team (Mitglied im eigenen Team, Verwaltung in jedes Vereinsteam) und in die Verwaltung nur für bestätigte Konten, sofort; gehört die Person einem anderen Verein an, scheitert es ohne Vereinsnamen.

**Lebenszyklus**
- Ein Team ohne Trainer:in besteht fort; ein Verein ohne Teams besteht fort; Spieler:innen ohne Team bleiben unbefristet.
- Ein Verein hat immer mindestens eine Verwaltung: Trigger unter Vereinssperre, FK `restrict` auf `auth.users`, Prüfung als erste Anweisung in `delete_account`. Einziger Ausweg ist das Löschen des Vereins (durch die Verwaltung oder mit dem Konto der einzigen Person).
- Verein löschen räumt Teams (wie Auflösen), Spielerbestand, Links, Abos und Abholadressen ab; alle Personen werden Konten ohne Verein.

**Weg auf Prod:** **ein Release** mit kurzem Wartungsfenster, forward-only. Die Migrationen laufen in technischer Reihenfolge nacheinander (Fundament mit Backfill → Lesepfade über `team_spieler` → Invarianten, Termin-FKs, Grenzen → Verein, Verwaltung, Bestand, Gründen und Löschen → Konten ohne Verein). Der Contract (`spieler.team_id` weg, `verein_id` NOT NULL) folgt als Nachlauf N1 nach dem Release (§3.8). Einzelheiten, Prüfabfragen und der Sync-Nachlauf in §6.

**Aus der Vorfassung übernommen und weiter nötig**
- **Sperrordnung:** Verein → Person → Teams aufsteigend → `spieler`-Zeile → Termin-Zeile, auch in `spieler_aufnehmen` (heute sperrt es zuerst das Team). Wer die Teammenge einer Spieler:in liest und sperrt (Ändern, Zuordnen, Schnuppern setzen, Löschen), nimmt vorher die Vereinssperre. Neu ist die Personensperre für «höchstens ein Verein» und die Grenzen 50/30 (§4.1).
- **Kein unsichtbares Team:** `teams_vorher` weist Teams ohne Verein ab; ein Team ohne Mitglied bleibt über den Bereich «Verein» sichtbar.
- **Import-Grenze:** Ein Abgleich ohne neue Zeilen ist auch über der Grenze erlaubt.

---

## 2. Zielbild, Begriffe, Rollen

```
Verein 1 ──< Team n                 teams.verein_id NOT NULL, unveränderlich; Name eindeutig je Verein; ≤ 30
Verein 1 ──< verein_verwaltung n    ≥ 1 Person, solange der Verein besteht; Aufnahme sofort per E-Mail-Adresse
Verein 1 ──< Spieler:in n           Stammdaten, J+S, ein privater Link; Namensschlüssel eindeutig je Verein; ≤ 1000
Team   n >──< Spieler:in            über team_spieler (≤ 100 je Team); Schnuppern auf der Zuordnung, nur bei genau einer
Team   1 ──< team_members           gleichberechtigte Trainer:innen (unverändert); Team darf ohne bestehen
Person ──  höchstens 1 Verein       über team_members ∪ verein_verwaltung (DB-Invariante)
Team   1 ──< Kader ──< kader_spieler          FK auf team_spieler
Team   1 ──< Termine/Spiele ──< Meldungen     FK auf team_spieler und (termin_id, team_id)
Konto ohne Verein                   abgeleitet; ≤ 50 eigene Übungen, ≤ 30 eigene Trainings
```

| Begriff | Bedeutung | Quelle der Wahrheit |
|---|---|---|
| **Verein** | Dach über Teams, Eigentümer der Spieler:innen, verantwortlich für deren Daten. Nur ein Name (1–60 Zeichen, nicht eindeutig). Besteht auch ohne Teams. | `vereine` |
| **Vereinsverwaltung** | Konten mit Verwaltungsrecht über einen Verein, gleichberechtigt, unbegrenzt, mindestens 1. Hinzu kommt man durch Gründen, durch Aufnahme per E-Mail-Adresse oder durch den Backfill. | `verein_verwaltung` |
| **Mitglied / Trainer:in** | Mitglied eines Teams, untereinander gleichberechtigt wie heute; im Team auch dann, wenn die Person der Verwaltung angehört | `team_members` |
| **Vereinsmitglied** | abgeleitet: Verwaltung oder Mitglied eines Teams des Vereins; höchstens ein Verein je Person. Nicht die Mitgliedschaft nach den Statuten. | `ist_verein_mitglied` |
| **Konto ohne Verein** | abgeleitet: weder Team-Mitglied noch Verwaltung. Eigene Übungen und Trainings mit Grenzen 50/30, Bibliothek, KI; darf einen Verein gründen. | fehlende Zeilen in `team_members` und `verein_verwaltung` |
| **Plattform-Admin** | die Betreiberin. Keine Rolle in DB oder Anwendung; im FC Wyler gewöhnliche Verwaltung. | – |
| **Bereich «Verein»** | Teil der Anwendung mit den Angaben des Vereins und den Funktionen der Verwaltung; einziger Ort für Verwaltungsrechte | W`app/(app)/verein` (§7.1) |
| **Spieler:in** | Stammdatensatz im Verein | `spieler` |
| **Spielerbestand** | alle Spieler:innen des Vereins, mit und ohne Team | `spieler where verein_id = …` |
| **Zuordnung** | Spieler:in ↔ Team; danach gelten für sie die Termine des Teams (mit Kadern erst als Kadermitglied) | `team_spieler` |
| **Spieler:in ohne Team** | im Verein, ohne Zuordnung; ändern, zuordnen, löschen, Link nur durch die Verwaltung | `spieler` ohne `team_spieler` |
| **Herausnehmen** | Zuordnung beenden; Spieler:in und Link bleiben im Verein | `delete from team_spieler` |
| **Löschen aus dem Verein** | Spieler:in samt Link und Meldungen endgültig entfernen; an vergangenen Terminen ehemalig ohne Namen; nur die Verwaltung im Bereich «Verein» | `delete from spieler` (`verein_spieler_entfernen`) |
| **Schnuppertraining** | bisher Probetraining. Angebot je Team (Anzahl, Info-Schreiben); Status, Kontingent und Zählung je Team; nur für Spieler:innen mit genau einer Zuordnung | `team_probetraining`, Status auf `team_spieler` (§3.3) |
| **Spielervertretung** | wer den privaten Link hat (Eltern oder die Spieler:in selbst); ohne Konto | `spieler.link_token` |

**Begriffsgrenzen:**
- «Termin-Einladung» aus #518 (eingeladen, dabei, abgesagt, verantwortlich; `termin_trainer`) bleibt unverändert. Die neue Domäne kennt **keine** Einladung: Personen werden «aufgenommen», nicht «eingeladen».
- «Probe» erscheint in Oberfläche, Link, Meldungstexten und KI nicht mehr, ausser in Texten, die ein Team selbst verfasst hat (Story 8 AK 2).
- «Mitglied» meint immer ein Team, «Vereinsmitglied» den abgeleiteten Verein; «Verwaltung» meint immer die Vereinsverwaltung.

**Rollen nach Ort**

Die Rechte einer Person ergeben sich aus dem Ort, an dem sie handelt, nicht aus der Summe ihrer Rollen:

| Ort | Rolle, die gilt | Prüfung in der RPC | Beispiel für eine Person, die Mitglied **und** Verwaltung ist |
|---|---|---|---|
| Team (W`/team/[id]/…`, MCP) | Mitglied | `ist_team_mitglied(p_team)`, bei Spieler:innen dazu `spieler_im_team(p_spieler, p_team)` | In der Team-Spielerliste kann sie eine Spieler:in nur aus dem Team nehmen, nicht löschen, wie jedes Mitglied; die Bestätigung nennt, dass nur die Verwaltung löscht, und gelöscht wird im Bereich «Verein» (Story 3 AK 12, 13). Der Import fehlt dort auch für sie (Story 9 AK 12). |
| Bereich «Verein» (W`/verein/…`) | Verwaltung, sonst Vereinsmitglied mit Lesezugriff | `ist_verein_verwaltung(p_verein)` bzw. `ist_verein_mitglied(p_verein)` | Sie sieht dort auch von ihren eigenen Teams nur Name, Trainer:innen und Spielerzahl und bearbeitet nur Zuordnungen (Story 5 AK 10). |
| Konto (W`/konto`, eigene Übungen und Trainings) | Person | `auth.uid()`; Grenzen 50/30 nur ohne Verein | Grenzen gelten für sie nicht, weil sie einem Verein angehört. |
| KI-Assistent | Mitglied der eigenen Teams | wie im Team; Vereins-RPCs sind für MCP nicht erreichbar | Keine Verwaltungsfunktion, auch nicht für Verwaltungsmitglieder (Story 13 OoS 1). |

**Rechte-Matrix** (✓ = darf; jede Spalte gilt nur an ihrem Ort, Spalten werden nie verknüpft)

| Handlung | Mitglied, im eigenen Team | Mitglied, im Bereich «Verein» | Verwaltung, im Bereich «Verein» | Konto ohne Verein |
|---|---|---|---|---|
| Teaminhalte (Termine, Trainings, Kader, Meldungen, Abo, Selbstabholung) | ✓ | – | – (nur als Mitglied im Team) | – |
| Bereich «Verein»: Vereinsname, Anzeigenamen der Verwaltung, Teamnamen | – | ✓ | ✓, dazu E-Mail der Verwaltung, je Team Trainer:innen mit E-Mail, Spielerzahl, «ohne Mitglied» | – |
| Mitgliederliste des Teams mit E-Mail, Kennzeichen «Verwaltung» | ✓ | – | ✓ für jedes Team (ohne Teaminhalte) | – |
| Team anlegen | – | – | ✓ ohne Mitgliedschaft (≤ 30, Name eindeutig) | – |
| Team umbenennen / auflösen (Teamname eingeben) | – (Hinweis auf die Verwaltung) | – | ✓, Auflösungszahlen ohne Mitgliedschaft | – |
| Sich selbst in ein Team aufnehmen | – | – | ✓ | – |
| Bestätigtes Konto ins Team aufnehmen / Mitglied entfernen | ✓ im eigenen Team, auch Verwaltungsmitglieder entfernen | – | ✓ in jedem Vereinsteam | – |
| Team verlassen | ✓, auch als letztes Mitglied ohne Teamnamen; Team bleibt | – | – | – |
| In die Verwaltung aufnehmen / entfernen / austreten | – | – | ✓, nie das letzte Mitglied | – |
| Vereinsname ändern | – | – | ✓ (1–60) | – |
| Verein löschen (Vereinsname eingeben) | – | – | ✓ eigener Verein | – |
| Verein gründen | – | – | – | ✓ |
| Vereinsliste: Name, Jahrgang, Teams, Suche, Eingrenzung | – | ✓ | ✓, dazu J+S, «ohne Team» | – |
| Spieler:in erfassen | ✓ ins eigene Team | – | ✓ ohne Team | – |
| Stammdaten und J+S ändern, Link abrufen und erneuern | ✓ wenn im eigenen Team | – | ✓ alle, auch ohne Team | – |
| Weitere Teams einer Spieler:in sehen | ✓ (Namen) | ✓ | ✓ | – |
| Einem Team zuordnen, einzeln oder gesammelt | – | – | ✓ (Team ≤ 100, ganz oder gar nicht) | – |
| Zum Schnuppern zuordnen | – | – | ✓ nur Spieler:in ohne Team, Team mit festgelegter Anzahl | – |
| Schnuppern ein- und ausschalten, Schnuppertraining festlegen | ✓ wenn genau diesem Team zugeordnet | – | – | – |
| Aus dem Team nehmen | ✓ eigenes Team | – | ✓ jedes Team | – |
| Aus dem Verein löschen | – (nur herausnehmen; Hinweis auf die Verwaltung) | – | ✓ immer, auch ohne Team | – |
| CSV-Import | – | – | ✓ in den Bestand ohne Team (≤ 1000) | – |
| Eigene Übungen und Trainings, Bibliothek | ✓ | ✓ | ✓ | ✓, höchstens 50 / 30 |
| Konto löschen | ✓ (Teams bleiben) | ✓ | nicht als letzte Verwaltung, ausser einzige Person: dann mit Vereinsname, Verein geht mit | ✓ |
| per KI-Assistent | wie im Team: Verein und weitere Teams lesen, herausnehmen mit Bestätigung; kein Löschen | – | **keine** Verwaltungsrechte per KI | eigene Übungen und Trainings mit Grenzen; Hinweis, dass Teams nur Mitgliedern offenstehen |

Für alle Spalten gilt: nur im eigenen Verein; Personen ausserhalb des Vereins sehen keine seiner Teams, Trainer:innen oder Spieler:innen, und keine Meldung nennt den Verein einer anderen Person (Epic Erfolgskriterium 9).

---

## 3. Datenmodell

Alle Migrationen dieses Abschnitts gehen mit **einem** Release nach Prod (§6). Auf `develop` kommen sie Story für Story, je Story genau die unten genannte Migration. Nach jedem einzelnen Merge ist Staging in sich stimmig: Es gibt keine unsichtbaren Teams und keine halbe Regel. Einzige Ausnahme ist der Contract (§3.8). Er folgt erst nach dem Prod-Release, weil er sonst den Sync von Prod nach Staging im Fenster «develop vor main» bräche (§6).

Die Tabelle steht in der **Merge-Folge auf `develop`** (§9). Die Zeitstempel entstehen beim jeweiligen Story-PR und steigen damit in dieser Folge; `db push` wendet die Dateien in dieser Reihenfolge an.

| Migration | Story | Abschnitt |
|---|---|---|
| `<ts>_vereine_fundament.sql` | 1 #577 | §3.1 |
| `<ts>_spieler_ueber_zuordnung.sql` | 1 #577 | §3.2 |
| `<ts>_spieler_eindeutig_verein.sql` | 2 #578 | §3.3 a |
| `<ts>_zuordnung_invarianten.sql` | 3 #579 | §3.3 b–e (FKs `not valid`) |
| `<ts>_vereine_bestand.sql` | 3 #579 | §3.7: Spalten, `sp_select`; dazu die RPCs zum Zuordnen und Herausnehmen (`verein_spieler_zuordnen`, `spieler_aus_team_nehmen`, `verein_spieler_aus_team_nehmen`, `spieler_teams`, `spieler_weitere_teams`), drop `spieler_entfernen(uuid)` ohne Nachfolger am Team-Ort (§4.4), `termin_teilnehmer`/`spiel_teilnehmer` als DEFINER mit `nicht_mehr_im_team` (§4.4) und die Grundfassung von `verein_spielerliste` (nur Verwaltung, §4.3) |
| `<ts>_vereine_verwaltung.sql` | 5 #581 | §3.6 |
| `<ts>_spielerbestand_verwaltung.sql` | 6 #582 | §4.3 «Spielerbestand am Verein-Ort»: `verein_spieler_anlegen`, `_aendern`, `_entfernen`, `_teams`, `_link_holen`, `_link_erneuern` |
| `<ts>_link_mehrere_teams.sql` | 7 #583 | nur RPCs (§4.4), keine Tabellenänderung; `feedback_link_gueltig`, drop `feedback_link_team` (§3.7) |
| `<ts>_schnuppertraining.sql` | 8 #584 | §3.3 f |
| `<ts>_verein_spielerliste.sql` | 4 #580 | §4.3: `verein_spielerliste` für alle Vereinsmitglieder, Suche und Eingrenzung auf dem Server (drop + create) |
| `<ts>_import_verein.sql` | 9 #585 | §3.7 |
| `<ts>_verein_gruenden_loeschen.sql` | 11 #587 | §3.4 |
| `<ts>_konten_ohne_verein.sql` | 12 #588 | §3.5 |
| `<ts>_zuordnung_invarianten_validieren.sql` | gehört fachlich zu 3 #579, **angelegt im letzten PR vor dem Release-PR** (§6.1 Schritt 1) | `validate constraint` je FK aus §3.3 b |
| Contract (Nachlauf N1) | nach dem Release | §3.8 |

**Warum die Validierung erst im letzten PR entsteht:** `deploy-staging.yml:42` und `deploy.yml:31` rufen `supabase db push` ohne `--include-all`. Läge auf Staging schon eine Datei mit spätem Zeitstempel, wiese `db push` jede spätere Story-Migration mit früherem Zeitstempel ab. Darum wird die Datei erst angelegt, wenn keine Story-Migration mehr folgt; so trägt sie den spätesten Zeitstempel des Release, ohne dass ein Zeitstempel vorgreift.

Story 13 bringt keine Migration (MCP und `umfang.ts`); `p_stand` kommt mit den RPCs aus Story 3, weil schon die Web-Dialoge ihn nutzen (§7.6).

Das Löschen aus dem Verein gibt es nur am Verein-Ort (`verein_spieler_entfernen`, Story 6). Story 3 entzieht es den Mitgliedern (Story 3 AK 12); das Löschen durch die Verwaltung (Story 3 AK 12, 14) wird mit Story 6 abgenommen. Zwischen den beiden Merges löscht auf `develop` niemand eine Spieler:in; auf Prod gibt es diesen Zwischenstand nicht.

**Story 3 vor Story 5:** Laut Epic (Abhängigkeitszeile) setzt Story 5 Story 3 voraus, nicht umgekehrt. Zuordnen und Herausnehmen durch die Verwaltung brauchen aber eine Oberfläche im Bereich «Verein». Story 3 bringt deshalb eine **Grundseite** `/verein/spieler` mit, nur für die Verwaltung: die Spieler:innen des Vereins mit Teams (aus der Grundfassung von `verein_spielerliste`), «Einem Team zuordnen», «Gesammelt zuordnen» und je Team «Aus dem Team nehmen». `/verein` leitet bis Story 5 auf `/verein/spieler` weiter, Mitglieder ohne Verwaltung auf `/teams`. Story 5 ergänzt Übersicht, `/verein/team/[teamId]` und `/verein/verwaltung`, Story 6 die Bestandsaktionen, Story 4 die Vereinsliste für alle Vereinsmitglieder mit Suche und Eingrenzung.

Grundregeln für jede Migration:
- **Reihenfolge ist bindend:** Tabellen → Spalten → Funktionen → Policies → Trigger → Grants → Backfill. Grund: `check_function_bodies`.
- **Grants stehen immer ausdrücklich in der Migration** (Lehre aus Seed-42501).
- **Jede neue Tabelle beginnt mit `revoke all … from anon, authenticated`.** Die Default-Privileges vergeben sonst volles DML (`20260614120000_api_role_grants.sql:24-28`). `service_role` behält DML; das brauchen Seed und Tests.
- **Jede neue Funktion ohne API-Zweck** (Helfer, Trigger-Funktionen, `verein_loeschen_kern`, `vereine_nachziehen`, `staging_nach_sync`) bekommt in derselben Migration `revoke all on function … from public, anon, authenticated`. «Kein Grant» allein schützt nicht, weil EXECUTE standardmässig an PUBLIC geht. Funktionen, die Policies aufrufen, behalten `grant execute … to authenticated`.
- **Signaturwechsel und Änderungen am Rückgabetyp** (auch eine zusätzliche Spalte in `returns table`, auch nur ein umbenannter Parameter): `drop function` + `create function` mit Default-Parametern **in derselben Migration**, danach `revoke all … from public, anon` und den Grant neu setzen. So entstehen keine PostgREST-Überladungen, und `create or replace` scheitert nicht an «cannot change return type».
- **Keine Grenze und keine Bestandsregel als CHECK oder NOT NULL**, solange Staging Daten aus einem Prod-Dump ohne die neuen Spalten per COPY lädt (§6). CHECK und NOT NULL greifen auch unter `session_replication_role = replica`, Trigger und FK-Prüfungen nicht.

**Sperrordnung** (verbindlich, Einzelheiten §4.1): Verein → Person → Teams aufsteigend nach UUID → `spieler`-Zeile (`for update`) → Termin-Zeile. Eine Stufe auszulassen ist erlaubt, die Reihenfolge umzukehren nicht. Jede löschende RPC nimmt Vereins- und Teamsperren **vor** dem DELETE, weil das DELETE selbst die Zeile sperrt und erst danach die Trigger laufen (§4.1). Die Personensperre ist neu: `sperre_person(p_user)` = `pg_advisory_xact_lock(hashtextextended('person:'‖id, 0))`, NULL verboten. Sie schützt «höchstens ein Verein je Person» (§3.1) und die Grenzen 50/30 (§3.5).

### 3.1 Fundament `<ts>_vereine_fundament.sql` (Story 1 #577)

```sql
create table vereine (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Zwilling: VEREIN_NAME_MAX, vereinsNameProblem() in web/lib/verein.ts
  constraint verein_name check (name = btrim(name) and char_length(name) between 1 and 60)
);
create trigger vereine_set_updated_at before update on vereine
  for each row execute function set_updated_at();

create table verein_verwaltung (
  verein_id uuid not null references vereine(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete restrict,   -- bewusst restrict (§8 L3)
  created_at timestamptz not null default now(),
  primary key (verein_id, user_id)
);
create index verein_verwaltung_user_idx on verein_verwaltung (user_id);

alter table teams add column verein_id uuid references vereine(id) on delete restrict;
create index teams_verein_idx on teams (verein_id);
alter table teams add constraint teams_id_verein_uk unique (id, verein_id);

alter table spieler add column verein_id uuid references vereine(id) on delete restrict;
create index spieler_verein_idx on spieler (verein_id);
alter table spieler add constraint spieler_id_verein_uk unique (id, verein_id);

create table team_spieler (
  team_id    uuid not null,
  spieler_id uuid not null,
  verein_id  uuid not null,
  probe_seit timestamptz,                 -- Schnuppern je Zuordnung (§3.3 f); DB-Name bleibt intern
  created_at timestamptz not null default now(),
  primary key (team_id, spieler_id),
  constraint tsp_team    foreign key (team_id, verein_id)    references teams  (id, verein_id) on delete cascade,
  constraint tsp_spieler foreign key (spieler_id, verein_id) references spieler(id, verein_id) on delete cascade
);
create index team_spieler_spieler_idx on team_spieler (spieler_id);

-- Funktionen (§4.1), dann:
alter table vereine           enable row level security;
alter table verein_verwaltung enable row level security;   -- keine Policy: nur RPC
alter table team_spieler      enable row level security;
create policy ve_select  on vereine      for select to authenticated using (ist_verein_mitglied(id));
create policy tsp_select on team_spieler for select to authenticated using (ist_team_mitglied(team_id));
revoke all on vereine, verein_verwaltung, team_spieler from anon, authenticated;
grant select on vereine, team_spieler to authenticated;            -- Schreiben nur per RPC
grant select (verein_id) on spieler to authenticated;              -- spieler hat nur Spalten-Grants
```

- `tsp_select` nur über die Teammitgliedschaft, ohne Verwaltungsklausel (Rollen nach Ort, PO 13; §4.2). Welche weiteren Teams eine Spieler:in hat (Story 3 AK 9) und die Teams aller Vereins-Spieler:innen (Story 4) liefern DEFINER-RPCs mit `ist_verein_mitglied` bzw. `ist_verein_verwaltung` (§4.3). Eine Policy, die `team_spieler` über die Zeilen anderer Teams derselben Spieler:in öffnet, wäre selbstbezüglich und braucht ohnehin einen DEFINER-Helfer.
- `verein_verwaltung` hat bewusst kein `eingesetzt_von`: Keine Story zeigt oder braucht es (Hygiene). Die Zahl der Verwaltungsmitglieder ist nicht begrenzt (Story 5 OoS 4).

**Invariante «höchstens ein Verein je Person»** (PO 2, Story 11 AK 7–9)

Eine Person gehört dem Verein an, dessen Verwaltung sie angehört oder in dessen Team sie Mitglied ist. Es gibt keine Tabelle «Vereinsmitgliedschaft», die Zugehörigkeit bleibt abgeleitet. Deshalb sichern zwei Trigger die Invariante unter Vereins- und Personensperre:
- Helfer `person_verein(p_user) returns uuid` (SQL stable DEFINER, revoke all): `verein_id` aus `verein_verwaltung` oder aus `team_members ⋈ teams`, sonst null. Bei gültiger Invariante gibt es höchstens einen Wert.
- Wer aufgenommen wird, liest die Zugehörigkeit erst **nach** der Personensperre. In READ COMMITTED sieht die nächste Anweisung damit die Aufnahme, die vor ihr committet hat. Zwei gleichzeitige Aufnahmen derselben Person in zwei Vereine serialisieren an der Personensperre, die zweite scheitert mit `ANDERER_VEREIN` (AK 9).
- Bestand: Nach dem Backfill (§6) liegen alle Teams im FC Wyler, die Invariante gilt also ab der ersten Zeile. Prüfabfrage §6.

**Trigger**

| Trigger | Tabelle | Inhalt |
|---|---|---|
| `teams_vorher` BEFORE INSERT | `teams` | `verein_id is null` → `VEREIN_FEHLT`. Dann `sperre_verein`, Grenze 30 → `VEREIN_TEAMS_VOLL`. Ab Story 1 entsteht kein Team ohne Verein mehr. Ein CHECK wäre hier falsch, weil er den Sync bräche (COPY unter `replica`). In Story 5 kommt die Namensprüfung dazu (§3.6). |
| `teams_verein_fest` BEFORE UPDATE OF `verein_id` | `teams` | erlaubt nur NULL → Wert (Backfill), sonst `VEREIN_FEST`. Ein Team wechselt nie den Verein (Epic OoS 4). |
| `verwaltung_vorher` BEFORE INSERT OR DELETE | `verein_verwaltung` | Zuerst `sperre_verein`. INSERT: `sperre_person(new.user_id)`, gehört die Person einem anderen Verein an → `ANDERER_VEREIN`. DELETE: Ist der Verein noch da (beim Kaskadieren aus `delete from vereine` ist er weg, gleiches Muster wie `spieler_vorher` in `spielerliste.sql:179`) und ist `old` die letzte Zeile → `LETZTE_VERWALTUNG`. Das gilt auch, wenn der Verein weder Teams noch Spieler:innen hat und die Person als einzige dazugehört (Story 5 AK 33, Story 11 AK 13). |
| `team_members_vorher` BEFORE INSERT | `team_members` | `sperre_verein(teams.verein_id)` (NULL → `VEREIN_FEHLT`), `sperre_person(new.user_id)`, gehört die Person einem anderen Verein an → `ANDERER_VEREIN`. Gilt für jeden Weg ins Team: `add_team_member`, die Selbstaufnahme der Verwaltung, `create_team` bis Story 5. Die Sperren nimmt der Trigger selbst, in der Reihenfolge Verein → Person; eine RPC, die vorher schon den Verein sperrt, verletzt sie nicht (Advisory-Locks sind reentrant). |

`ANDERER_VEREIN` nennt den anderen Verein nicht (PO 2, Story 11 AK 8). Austreten und Entfernen (DELETE auf `team_members`) nehmen keine Personensperre: Eine Aufnahme oder Anlage, die gleichzeitig noch mit der alten Zugehörigkeit durchgeht, ist gleichwertig mit einer, die kurz vorher geschah.

**Geänderte Funktionen in derselben Migration**
- `create_team(p_name text)`: **Signatur bleibt.** Erste Prüfung: Die aufrufende Person ist Verwaltung, sonst `TEAM_NUR_VERWALTUNG`. Den Verein muss niemand angeben, er folgt aus `person_verein(auth.uid())`. Mit der Invariante oben ist er eindeutig, und eine veraltete Oberfläche kann kein Team im falschen Verein anlegen. Insert mit `verein_id` (die Grenze prüft der Trigger).
  - In Story 1 legt `create_team` die Mitgliedschaft in `team_members` noch an (wie heute, `20260824200312_team_rpcs.sql:9-27`). So entsteht auf Staging kein Team, das niemand sieht, solange `team_aufloesen_wenn_leer` gilt und die Verwaltungssicht fehlt. In der Oberfläche legt in Story 1 niemand Teams an (Story 1 OoS 1).
  - In Story 5 fällt `create_team` weg; Teams legt dann `verein_team_anlegen` im Bereich «Verein» an, ohne Mitgliedschaft (§3.6, §4.3).
- `delete_account()`: Ab Story 1 gilt die Verwaltungsprüfung als erste Anweisung nach `auth.uid()`, weil der FK `restrict` sonst das spätere Löschen des Auth-Kontos scheitern liesse, nachdem die RPC Übungen und Trainings schon gelöscht hat. Es gibt **eine** Fassung, die in §3.4; Story 1 liefert sie ohne den Zweig der einzigen Person: drop `delete_account()` + create `delete_account()` mit Rückgabe `jsonb`; letzte Verwaltung → Status `letzte_verwaltung` (kein Marker), sonst die eigene Verwaltungszeile löschen und weiter wie heute. Die Action `deleteAccount` zeigt den Status **ab Story 1** an, statt ihn zu verschlucken (§7.3). Story 11 ersetzt die Funktion durch `delete_account(p_vereinsname text default null)` (drop + create) mit dem Zweig der einzigen Person.
- `meine_vereinslage()` (neu, `authenticated`, §4.3): `{verein: {id, name, ist_verwaltung, ist_teammitglied} | null, grenzen: … | null}`, für Seitenleiste, `/teams`, Bereich «Verein» und die Hinweise für Konten ohne Verein; `grenzen` füllt erst Story 12 (§3.5), bis dahin null.
- `vereine_nachziehen(p_verwaltung uuid default …)` und `staging_nach_sync()` (§6), beide ohne API-Recht. `vereine_nachziehen` füllt zusätzlich `team_spieler.probe_seit` aus `spieler.probe_seit`, weil der Prod-Dump vor dem Release die Zuordnung noch nicht kennt.

### 3.2 Spieler:innen über die Zuordnung `<ts>_spieler_ueber_zuordnung.sql` (Story 1 #577, Lesepfade ohne Verhaltensänderung)

Mengen und Prüfungen lesen `team_spieler` statt `spieler.team_id`. Die vollständige Liste steht in §4.4.
- Signaturen und Ausgaben bleiben gleich (`create or replace`, Kommentar «Rumpf wie in …; Menge über team_spieler»).
- **Nicht hier:** Dass `termin_teilnehmer` und `spiel_teilnehmer` DEFINER werden und die Spalte `nicht_mehr_im_team` bekommen, gehört zu Story 3 (`<ts>_vereine_bestand.sql`, §4.4). Erst dort gibt es Herausgenommene, und erst dort verengt sich `sp_select`. In dieser Migration ändern beide nur die Menge auf `team_spieler`.
- **Schnupper-Status auf die Zuordnung:** In derselben Migration `update team_spieler ts set probe_seit = s.probe_seit from spieler s where s.id = ts.spieler_id and s.probe_seit is not null`. Das ist eindeutig, weil heute jede Spieler:in genau ein Team hat. Alle Leser von `spieler.probe_seit` lesen danach `team_spieler.probe_seit` der Zuordnung zum Termin-Team: `training_grundstand`-Aufrufe (`meldestand.sql:61` `training_meldestand`, `:75` `training_abgemeldet`, `:234` `abmeldung_anwenden_training`, `:271` `termin_zeitpunkt_nachher`, `:304` `termin_abmeldungen_verfallend`), `probe_stand`/`team_probe_staende` (`probetraining.sql:114-151`), `termin_gilt_fuer` mit dem Spiel-Ausschluss (`probetraining.sql:62`), `termin_abmeldung_setzen` (`:260`), `spieler_link_abmelden` (`:288`), `termin_anmeldungen_verfallend` (`:325`), `termin_teilnehmer` (`:550`, `:554`) und `probe_info` in `spieler_link_ansicht` (`treffpunkt_training.sql:792`, neueste Fassung). Einziger Schreiber ist `spieler_probe_setzen` (`probetraining.sql:204` lesen, `:230` schreiben); er setzt ab hier `team_spieler.probe_seit` der Zuordnung zu `spieler.team_id` (Signatur bis Story 8 unverändert). Die Leser joinen `team_spieler` ohnehin schon für die Menge. `spieler.probe_seit` ist ab hier tot und fällt im Contract (§3.8). Der Grant `select (probe_seit) on spieler` (`meldestand.sql:28`) fällt mit.
- **Web im selben PR:** `ladeSpielerliste`, `anzahlSpieler` (W`lib/kern/spieler.ts:117`, `:195`), `terminSpielerVon` (W`lib/kern/abmeldungen.ts:86`), `spielSpielerVon` (W`lib/kern/spiele.ts:135`) und der Probe-Leser W`lib/kern/spieler.ts:75` zählen bzw. lesen über `team_spieler`.
- **Nachtragen herausgenommener Spieler:innen** (Story 3 AK 18): `termin_anwesenheit_setzen_training` (`nachtrag_anwesenheit.sql:59`) und `spiel_anwesenheit_setzen` (`spiel_nachtrag.sql:62`) prüfen heute `spieler.team_id = t.team_id`. Ersetzt wird das **nicht** durch `spieler_im_team`, sonst wiese der Nachtrag eine herausgenommene Spieler:in ab. Massgeblich ist, ob sie im festgehaltenen Stand steht: Die Vorprüfung lautet `spieler_im_team(p_spieler, t.team_id) or exists (select 1 from termin_teilnahmen where termin_id = p_termin and spieler_id = p_spieler)` bzw. `spiel_teilnahmen`, sonst wie heute `nicht_gefunden`; danach `update termin_teilnahmen … where spieler_id = p_spieler`, ohne Zeile `nicht_dabei` (`:80-85`). Der Teil `spieler_im_team` ist nötig, weil ein begonnener Termin erst in der Funktion festgehalten wird (träge); vorher stünde auch eine zugeordnete Spieler:in nicht in `termin_teilnahmen`. So bleibt die Story-1-Fassung gleichwertig (eine fremde Spieler:in bekommt weiter `nicht_gefunden`), und eine herausgenommene bleibt nachtragbar. Das korrigiert die Vorfassung (dort `spieler_im_team` allein), §4.4 übernimmt es.

### 3.3 Zuordnungs-Invarianten

#### a) Eindeutigkeit je Verein `<ts>_spieler_eindeutig_verein.sql` (Story 2 #578)

Vorname, Nachname und Jahrgang sind je Verein eindeutig, nach dem Schlüssel `spieler_text_schluessel` (`spielerliste.sql:52-59`, dieselbe Regel wie heute je Team). Bestehende Doppeleinträge bleiben getrennt und änderbar, solange ihr Schlüssel gleich bleibt (Story 2 AK 7, PC 1). Das erzwingt **eine Trigger-Prüfung unter Vereinssperre**, nach demselben Muster wie die Teamnamen (§3.6). Ein eindeutiger Index ginge wegen der Altdubletten nur mit einer Ausnahme-Markierung samt Pflege-Triggern; die Vereinssperre, unter der jeder Schreibweg ohnehin läuft, macht ihn überflüssig.

```sql
-- spieler_vorher (§3.3 c) prüft bei INSERT, der neue Zweig bei UPDATE OF vorname, nachname, jahrgang,
-- jeweils nach sperre_verein(verein_id):
--   if <INSERT oder der Schlüssel ändert sich> and exists (select 1 from spieler a
--        where a.verein_id = new.verein_id and a.id <> new.id
--          and spieler_text_schluessel(a.vorname)  = spieler_text_schluessel(new.vorname)
--          and spieler_text_schluessel(a.nachname) = spieler_text_schluessel(new.nachname)
--          and a.jahrgang = new.jahrgang)
--   then raise exception 'SPIELER_DOPPELT'; end if;
create index spieler_schluessel_verein on spieler
  (verein_id, spieler_text_schluessel(vorname), spieler_text_schluessel(nachname), jahrgang);  -- nicht eindeutig, nur für die Suche
drop index spieler_eindeutig;               -- je Team (spielerliste.sql:77-78); team_id stirbt mit Story 3
```

- **Nur beim Erfassen und bei einer Schlüsseländerung.** Eine Altdublette, deren Schlüssel gleich bleibt, ändert sich ohne Prüfung (AK 7). Ändert sich der Schlüssel, prüft der Trigger den neuen gegen alle **anderen** Datensätze des Vereins (AK 5). Es gibt keine Markierung, keinen Teilindex und keine Pflege-Trigger; Prod-Dumps im Sync brauchen nichts nachzuziehen.
- **Gleichzeitiges Erfassen oder Ändern** (AK 8): Jeder Weg, der `spieler` einfügt oder den Schlüssel ändert, nimmt vorher `sperre_verein` (RPCs und Trigger). Die Prüfung im Trigger ist eine eigene Anweisung einer VOLATILE-Funktion und sieht unter READ COMMITTED alles, was vor dem Erhalt der Sperre committet wurde. So gewinnt genau eine Eingabe, auch über Teams hinweg. Die RPCs prüfen vorab mit `spieler_doppelt`, damit die Meldung die Teams der bestehenden Spieler:in nennen kann; `SPIELER_DOPPELT` aus dem Trigger ist nur das Netz.
- **Doppel vor Grenzen** (AK 9): `spieler_vorher` prüft beim INSERT zuerst den Schlüssel und erst danach die Vereinsgrenze. `spieler_aufnehmen` prüft unter Verein- und Teamsperre zuerst `spieler_doppelt`, vor `spielerzahl_freigeben` und jedem Schreiben; die Grenzen 100/1000 kommen danach aus den Triggern (`team_spieler_vorher`, `spieler_vorher`), ohne eigenen Vorabtest in der RPC (berichtigt mit Story 2).
- Die Meldung nennt von der bestehenden Spieler:in höchstens Namen, Jahrgang und Teams bzw. «keinem Team zugeordnet» (Story 2 PC 3, Story 3 AK 19). Spieler:innen anderer Vereine kommen nie vor (PC 2), weil Prüfung und Vorabprüfung `verein_id` enthalten.
- **Import:** Eine Zeile mit mehreren Treffern im Verein ist «mehrfach im Verein geführt» (Story 9 AK 5); das ergibt sich aus der Trefferzahl, ohne Markierung.

#### b) Zuordnungs-FKs `<ts>_zuordnung_invarianten.sql` + `<ts>_zuordnung_invarianten_validieren.sql` (Story 3 #579)

```sql
-- Zuordnungs-FKs (Kader und Meldungen nur für Zugeordnete)
alter table kader_spieler      add constraint ks_zuordnung foreign key (team_id, spieler_id)
  references team_spieler (team_id, spieler_id) on delete cascade not valid;
alter table termin_abmeldungen add constraint ta_zuordnung foreign key (team_id, spieler_id)
  references team_spieler (team_id, spieler_id) on delete cascade not valid;
alter table spiel_meldungen    add constraint sm_zuordnung foreign key (team_id, spieler_id)
  references team_spieler (team_id, spieler_id) on delete cascade not valid;

-- Termin-FKs (E15): denormalisiertes team_id per Constraint gesichert
alter table training_termine   add constraint tt_id_team_uk unique (id, team_id);
alter table termin_eingefroren add constraint te_termin_team_uk unique (termin_id, team_id);
alter table termin_abmeldungen   add constraint ta_termin_team  foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
alter table termin_statuswechsel add constraint tsw_termin_team foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
alter table spiel_meldungen      add constraint sm_termin_team  foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
alter table termin_eingefroren   add constraint te_termin_team  foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
alter table termin_kader         add constraint tk_termin_team  foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
alter table spiel_treffpunkte    add constraint stp_termin_team foreign key (termin_id, team_id)
  references training_termine (id, team_id) on delete cascade not valid;
-- Historie: team_id an den festgehaltenen Termin gebunden (heute ganz ohne FK)
alter table termin_teilnahmen    add constraint tn_eingefroren_team foreign key (termin_id, team_id)
  references termin_eingefroren (termin_id, team_id) on delete cascade not valid;
alter table spiel_teilnahmen     add constraint st_eingefroren_team foreign key (termin_id, team_id)
  references termin_eingefroren (termin_id, team_id) on delete cascade not valid;
-- Folgemigration (nach den Waisen-Abfragen §6): validate constraint … je Constraint
```

- **`termin_statuswechsel` bekommt bewusst keinen Zuordnungs-FK.** Die Tabelle überlebt das Festhalten (`gewechselt_am` an vergangenen Terminen). Künftige Zeilen löscht `team_spieler_nachher`.
- `termin_teilnahmen` und `spiel_teilnahmen` bekommen keinen Zuordnungs-FK, denn sie sind Historie (`spieler_id … set null` = «ehemalig»). Ihr `team_id` sichert der FK auf `termin_eingefroren`. Die Kaskade ändert nichts, weil `termin_id` schon heute `on delete cascade` auf `termin_eingefroren` zeigt.
- FK-Prüfungen sind RI-Trigger und schweigen unter `session_replication_role = replica`. Der Sync bricht an ihnen nicht, anders als an CHECK und NOT NULL.
- Der Zuordnungs-FK kaskadiert beim Herausnehmen auch Zeilen an begonnenen Terminen. Das ist richtig, weil `team_spieler_vorher` den Stand vorher festhält: Abmeldungen und Anwesenheit begonnener Termine stehen dann in `termin_teilnahmen`/`spiel_teilnahmen` mit Namen (Story 3 PC 5, PC 8).

#### c) Trigger der Zuordnung und der Grenzen (Story 1 #577, Story 3 #579)

| Trigger | Tabelle | Inhalt |
|---|---|---|
| `spieler_vorher` BEFORE INSERT OR DELETE (neu gefasst, Story 1), ab Story 2 zusätzlich BEFORE UPDATE OF vorname, nachname, jahrgang | `spieler` | `verein_id is null` → `VEREIN_FEHLT`. `sperre_verein(verein_id)`. INSERT: zuerst gleicher Schlüssel im Verein → `SPIELER_DOPPELT` (ab Story 2, §3.3 a), dann Vereinsgrenze **1000** inklusive Spieler:innen ohne Team, Schnuppernder und Altdubletten → `VEREIN_VOLL`. UPDATE: nur wenn sich der Schlüssel ändert, gleicher Schlüssel bei einem anderen Datensatz des Vereins → `SPIELER_DOPPELT`. DELETE: alle noch bestehenden Teams der Spieler:in (`team_spieler`) mit `sperre_teams` sortiert sperren und für jedes `termine_einfrieren`, **bevor** die Kaskade läuft (Netz; die löschende RPC hat Verein und Teams schon vor dem DELETE gesperrt, §4.1). Die 200er-Prüfung über `team_id` (`spielerliste.sql:181`) fällt weg. |
| `team_spieler_vorher` BEFORE INSERT OR DELETE (ab Story 1 mit der Grenze 100, Story 1 AK 6, in `<ts>_spieler_ueber_zuordnung.sql`, also nach dem Backfill der Fundament-Migration; ab Story 3 vollständig) | `team_spieler` | Team weg (Auflösung, Verein löschen) → nichts tun. DELETE und die Spieler:in ist weg (Kaskade aus `spieler`) → nichts tun, `spieler_vorher` hat schon festgehalten. Sonst `sperre_teams([team])`, dann die `spieler`-Zeile `for update`, **bei INSERT wie bei DELETE** (wegen des Schnupperns, §3.3 f). Bei INSERT in dieser Reihenfolge (Story 3 AK 4–7): schon zugeordnet → `SCHON_ZUGEORDNET`; gleicher Schlüssel im Zielteam (nur noch bei Altdubletten möglich) → `SPIELER_DOPPELT`; Grenze **100** je Team, jede Zuordnung zählt → `SPIELERLISTE_VOLL`. Danach `termine_einfrieren(team)`. |
| `team_spieler_nachher` AFTER DELETE | `team_spieler` | Team und Spieler:in noch da (Herausnehmen): `termin_statuswechsel` künftiger Termine dieses Teams löschen und den Kader-Verfall prüfen (Muster `kader_nachher`). Kader- und Meldungszeilen nimmt die FK-Kaskade. **Löscht nie die Spieler:in** (Story 3 PC 4). |

- Die Grenzen prüfen nur INSERT-Pfade. Bestand über einer Grenze bleibt, Ändern und Entfernen bleiben möglich (Story 1 PC 2).
- **Spieler:innen ohne Team** entstehen ab Story 3 (Herausnehmen aus dem letzten Team). `spieler_vorher` sperrt deshalb über `verein_id`, nicht mehr über `team_id`. Heute sperrt er mit `team_id = NULL` nichts (`hashtextextended(NULL)` ist strikt) und zählt 0.

**Geänderte RPCs (gleiche Signatur, Story 1)**
- `spieler_aufnehmen` sperrt **zuerst den Verein**, dann das Team. Sonst entsteht die Reihenfolge Team → Verein (`spielerliste.sql:315`), während der Trigger Verein → Team sperrt. Sie schreibt `verein_id` aus dem Team und fügt die Zuordnung in `team_spieler` selbst ein. `spieler.team_id` schreibt sie bis Story 3 noch mit (dort noch NOT NULL), danach nicht mehr (§3.7).
- Das Freigeben der erwarteten Spielerzahl beim ersten Spieler wandert in den Helfer `spielerzahl_freigeben(p_team) returns int` (heute doppelt: `spielerliste.sql:316-322`, `spieler_import.sql:93-99`). Er prüft «Team hat noch keine Zuordnung» und dient `spieler_aufnehmen` und `verein_spieler_zuordnen`, aber nicht mehr dem Import (Story 9 PC 5). `ersetzt` bleibt in der Rückgabe. Ohne API-Recht (DEFINER-Helfer, der fremde Termine ändern würde).
- Der alte Team-Import `spieler_importieren(p_team, …)` wird in Story 1 nur auf die Grenzen angepasst (`v_bestand` zählt `team_spieler`, Teamgrenze 100 nur bei `neu > 0`, Sperre Verein → Team; der Zeilendeckel `> 1000` behält bis Story 9 `SPIELERLISTE_VOLL`, `IMPORT_ZU_GROSS` kommt mit `verein_spieler_importieren`). Er gilt bis Story 9 und fällt dann weg (§3.7).
- **Web und MCP im selben PR:** Die Marker `VEREIN_VOLL` und `VEREIN_TEAMS_VOLL` samt Klartext kommen in `TERMIN_MARKER`/`SPIELER_MELDUNG` (`IMPORT_ZU_GROSS` mit Story 9). Das MCP-Werkzeug `spieler_aufnehmen` bildet `VEREIN_VOLL` als Fehlerfall «regel» ab (Story 1 AK 6–7). `SPIELER_MODELL` (W`lib/mcp/werkzeuge/spieler.ts:29`, `:45-48`) nennt «höchstens 100 je Team, 1000 je Verein».

#### d) Herausnehmen (Story 3 #579)

Herausnehmen ist `delete from team_spieler where team_id = … and spieler_id = …`, nie ein Löschen der Spieler:in.
- Keine Vereinssperre nötig: Herausnehmen verkleinert die Teammenge nur. Die RPC nimmt **vor** dem DELETE die Teamsperre und die `spieler`-Zeile `for update` und vergleicht erst danach `p_stand` (§4.3). Der Trigger nimmt beide reentrant noch einmal (Netz). Ein gleichzeitiges Zuordnen in ein anderes Team hält dieselbe `spieler`-Zeile (§3.3 e) und wird so vor oder nach dem Vergleich serialisiert.
- Festhalten, Kaskade auf künftige Meldungen, Kader und Statuswechsel dieses Teams. Begonnene Termine behalten den Stand bei Beginn mit Namen (PC 5, PC 8). Die Rechte (Mitglied im eigenen Team, Verwaltung in jedem Team) prüft die RPC (§4.3).
- Eine später erneut zugeordnete Spieler:in bekommt eine neue Zeile ohne frühere Meldungen, Kader oder Schnupper-Status (PC 9).

#### e) Sammel-Zuordnen (Story 3 AK 20–22)

`verein_spieler_zuordnen(p_team, p_spieler uuid[], p_schnuppern boolean default false)` (§4.3) ordnet einzeln und gesammelt zu, ganz oder gar nicht:
1. Vereinssperre, dann Teamsperre, dann die `spieler`-Zeilen sortiert nach UUID `for update`.
2. Für **alle** gewählten Spieler:innen vorab prüfen: gleicher Verein, schon zugeordnet, gleicher Schlüssel im Team **oder innerhalb der Auswahl** (zwei Altdubletten in einem Zug), schnuppert in einem anderen Team (§3.3 f). Dazu `überschuss = bestand + anzahl − 100`.
3. Gibt es einen Befund, kommt nichts in die Tabelle. Die Rückgabe nennt alle betroffenen Spieler:innen je Grund und den Überschuss (AK 22). Sonst ein Insert je Spieler:in; der Trigger prüft dasselbe noch einmal und wirft im Wettlauf die Transaktion als Ganzes zurück.

Gleichzeitige Zuordnungen in dasselbe Team serialisieren an der Teamsperre (AK 8). Der Import prüft keine Teamgrenze, gesammeltes Zuordnen schon (PO 11).

#### f) Schnuppern in genau einem Team `<ts>_schnuppertraining.sql` (Story 8 #584)

Der Schnupper-Status liegt seit §3.2 auf der Zuordnung (`team_spieler.probe_seit`). Kontingent und Info-Schreiben bleiben je Team in `team_probetraining`. Die DB-Namen `probe_*` und `team_probetraining` bleiben intern; umbenannt werden Oberfläche, Link-Texte und KI-Werkzeuge (Story 8 AK 1–3, §7.10).

Invariante: Trägt eine Zuordnung `probe_seit`, hat die Spieler:in **genau diese eine** Zuordnung.
- `team_spieler_vorher` INSERT: Hat die Spieler:in schon eine Zuordnung mit `probe_seit is not null` → `SPIELER_SCHNUPPERT` (AK 12; die Rückgabe der RPC nennt das Team).
- Trigger `team_spieler_probe_vorher` BEFORE INSERT mit `probe_seit is not null` oder BEFORE UPDATE OF `probe_seit` (NULL → Wert): `sperre_verein`, die `spieler`-Zeile `for update`, dann eine weitere Zuordnung neben dieser → `SCHNUPPERN_MEHRERE_TEAMS` (AK 5–6). Das gilt auch für `spieler_probe_setzen` über den KI-Assistenten (AK 15) und ist zugleich das Netz für das Zuordnen zum Schnuppern.
- Zuordnen zum Schnuppern (`p_schnuppern = true`, nur eine Spieler:in, AK 8–10): Hat sie schon eine Zuordnung → `{grund: 'schnuppern_hat_team'}`; hat das Team keine Anzahl in `team_probetraining` → `{grund: 'schnuppern_anzahl_fehlt'}` (beide als jsonb-Status der RPC, §4.3; für die Anzahl gibt es kein Trigger-Netz, für die bestehende Zuordnung greift `team_spieler_probe_vorher`). Sonst Insert mit `probe_seit = now()`. Die Zählung beginnt damit ab der Zuordnung (AK 11).
- Gleichzeitiges Einschalten und Zuordnen zu einem weiteren Team (AK 14): Beide halten Vereinssperre und `spieler`-Zeile, das zweite sieht das erste.
- Herausnehmen und Auflösen beenden das Schnuppern samt Zählung von selbst, weil die Zeile mit ihrem `probe_seit` verschwindet (PC 1). Eine neue Zuordnung beginnt bei null (PC 2). Einen eigenen Rücksetz-Trigger braucht es nicht; `team_spieler_nachher` setzt darum kein `probe_seit` auf null (das tote `spieler.probe_seit` liest niemand mehr).
- Bestand: Heute hat jede Spieler:in genau ein Team, die Invariante gilt also nach dem Backfill in §3.2 (PC 3). Prüfabfrage §6.

Die Vorfassung (E4 b, Probe je Verein, Zählung über alle Teams) ist damit überholt.

### 3.4 Verein gründen und löschen `<ts>_verein_gruenden_loeschen.sql` (Story 11 #587)

Ersetzt den Zugangsweg der Vorfassung vollständig. Es gibt weder Antrag noch Freigabe, keine Gründungsfrist und keine Tabelle dazu.

**Gründen:** `verein_gruenden(p_name text, p_bestaetigt boolean)` (§4.3)
1. `auth.uid()`; `p_bestaetigt is not true` → `BESTAETIGUNG_FEHLT`. Die Bestätigung wird weder gespeichert noch geprüft (AK 3, OoS 2); der Parameter verhindert nur, dass ein Aufruf ohne sie einen Verein anlegt.
2. `sperre_person(uid)`; gehört die Person schon einem Verein an (`person_verein(uid)` gesetzt) → `SCHON_IM_VEREIN` (AK 4).
3. Name nach CHECK `verein_name` (1–60 Zeichen, nicht leer, nicht eindeutig, AK 2).
4. `insert into vereine` (neue id), dann `insert into verein_verwaltung (verein_id, user_id)`. Der Trigger `verwaltung_vorher` sperrt den neuen Verein und prüft erneut, dass die Person keinem anderen Verein angehört; ein `ANDERER_VEREIN` aus dem Trigger übersetzt die RPC ebenfalls in `SCHON_IM_VEREIN`. Die Transaktion rollt dabei auch den eben angelegten Verein zurück, es bleibt kein leerer Verein.
5. Der neue Verein hat kein Team (PC 1).

Zwei gleichzeitige Gründungen derselben Person serialisieren an der Personensperre, die zweite scheitert (AK 9). Gründen sperrt nur die Person (§4.1); die Vereinssperre, die der Trigger danach auf die neue UUID nimmt, kann niemand sonst halten, weil vor dem Commit niemand die id kennt.

**Löschen:** `verein_loeschen(p_verein, p_name)` (§4.3) und der interne Helfer `verein_loeschen_kern(p_verein) returns jsonb` (revoke all):
1. `nur_in_der_anwendung()`, dann `ist_verein_verwaltung(p_verein)` (AK 15). `sperre_verein`, dann `select name … for update`. Personensperren braucht es nicht: Eine gleichzeitige Aufnahme nimmt dieselbe Vereinssperre, und eine Prüfung der Kontogrenzen sieht den Verein unter READ COMMITTED ganz oder gar nicht.
2. Namensvergleich wie beim Auflösen eines Teams: `normalize(btrim(p_name), nfc) = normalize(name, nfc)`, Gross- und Kleinschreibung zählt (AK 10; Muster `team_aufloesen_namensbestaetigung.sql:166-169`). Sonst, auch bei leerem oder fehlendem Namen, jsonb-Status `vereinsname_falsch` mit dem aktuellen Namen, nichts gelöscht (AK 14). Das ist ein Status, kein Marker, wie `name_falsch` beim Auflösen. Die Zahlen für den Dialog liefert vorher `verein_ansicht` (AK 11).
3. `verein_loeschen_kern`:
   ```sql
   v_bilder := (select coalesce(jsonb_agg(b), '[]') from teams t, jsonb_array_elements(team_bilder(t.id)) b
                where t.verein_id = p_verein);
   delete from teams   where verein_id = p_verein;   -- kaskadiert alles, was das Auflösen löscht,
                                                     -- samt team_spieler, team_abholung, kalender_abos
   delete from spieler where verein_id = p_verein;   -- Links, spieler_abos; keine Teams mehr zum Festhalten
   delete from vereine where id = p_verein;          -- kaskadiert verein_verwaltung (Trigger lässt durch)
   return v_bilder;                                  -- die Action räumt den Storage wie beim Auflösen
   ```
   Die FKs `teams.verein_id` und `spieler.verein_id` mit `restrict` sind das Netz: Bliebe etwas zurück, scheiterte das letzte `delete` und rollte alles zurück.
4. Alle Personen sind danach Konten ohne Verein (PC 4). Ihre persönlichen Übungen und Trainings tragen keinen Vereinsbezug und bleiben; Team-Trainings gehen mit ihrem Team wie beim Auflösen.
5. Links, Abos und Abholadressen des Vereins sind danach ungültig und zeigen die Seite jedes ungültigen Links (PC 5); dafür braucht es keine eigene Spur.

Die Zahlen vor dem Löschen (Teams, Spieler:innen inklusive ohne Team, AK 11) liefert eine lesende RPC (§4.3).

**Konto löschen:** `delete_account(p_vereinsname text default null)`, drop `delete_account()` + create (Signaturwechsel, Quelle `20261025100000_trainer_einladen.sql:812-847`). Das ist die **einzige** Fassung; Story 1 liefert sie ohne den Zweig der einzigen Person (§3.1), §4.4 verweist hierher. Erste Anweisung nach `auth.uid()` ist `nur_in_der_anwendung()` (ein KI-Token löscht kein Konto, §4.1), danach:

```sql
v_verein := person_verein(v_uid);                    -- nur Kandidat für die Sperre; erst sperren, dann lesen
if v_verein is not null then
  perform sperre_verein(v_verein);
end if;
perform sperre_person(v_uid);                                   -- nach dem Verein (Sperrordnung §4.1)
if exists (select 1 from verein_verwaltung where user_id = v_uid and verein_id is distinct from v_verein) then
  raise exception 'VERWALTUNG_GEAENDERT';                       -- gleichzeitig in eine Verwaltung aufgenommen
end if;
if not exists (select 1 from verein_verwaltung where user_id = v_uid) then
  v_verein := null;                                             -- Teammitglied ohne Verwaltung
end if;
if v_verein is not null then
  if not exists (select 1 from verein_verwaltung where verein_id = v_verein and user_id <> v_uid) then
    if exists (select 1 from team_members m join teams t on t.id = m.team_id
                where t.verein_id = v_verein and m.user_id <> v_uid) then
      return jsonb_build_object('status', 'letzte_verwaltung');  -- Status, bevor irgendetwas gelöscht ist
    end if;
    if p_vereinsname is null then
      return jsonb_build_object('status', 'verein_bestaetigen');  -- mit Verein und Zahlen (§4.4)
    end if;
    if normalize(btrim(p_vereinsname), nfc)
       is distinct from (select normalize(name, nfc) from vereine where id = v_verein) then
      return jsonb_build_object('status', 'vereinsname_falsch');   -- Status, nichts gelöscht
    end if;
    perform verein_loeschen_kern(v_verein);                  -- einzige Person: Verein geht mit (AK 12)
  else
    delete from verein_verwaltung where verein_id = v_verein and user_id = v_uid;
  end if;
end if;
-- Rest unverändert (Termin-Einladungen, Favoriten, Übungen, Trainings)
```

- **Vorrang vor Story 5 AK 33:** Deren Wortlaut verbietet der letzten Verwaltung das Konto-Löschen ohne Ausnahme. Story 11 AK 12 und Epic PO 3 regeln den Sonderfall ausdrücklich: Gehört dem Verein sonst niemand an, löscht die einzige Person ihr Konto mit dem Vereinsnamen, und der Verein geht mit. Die spätere und speziellere Regel gilt; AK 33 bleibt für jeden Verein mit weiteren Personen unverändert (Status `letzte_verwaltung`), und austreten kann auch die einzige Person nicht (Story 11 AK 13).
- Ohne Namen antwortet `delete_account` mit `verein_bestaetigen`, mit falschem Namen mit `vereinsname_falsch`; verglichen wird wie überall `normalize(btrim(…), nfc)`.
- Die erneute Prüfung «wer dem Verein angehört» unter der Vereinssperre deckt AK 14 ab. Eine gleichzeitige Aufnahme einer weiteren Person nimmt dieselbe Sperre (`team_members_vorher`, `verwaltung_vorher`) und kommt entweder vorher (dann Status `letzte_verwaltung`) oder nachher (dann ist der Verein weg und der FK der Aufnahme scheitert).
- Teams, deren letztes Mitglied die Person ist, bleiben bestehen (Story 5 AK 29, §3.6). Die Mitgliedschaften gehen mit dem Auth-Konto per Kaskade.
- Bei der Kontolöschung über `verein_loeschen_kern` muss die Action die zurückgegebenen Bilder ebenfalls aufräumen; die RPC gibt sie deshalb zurück (Rückgabetyp `jsonb` statt `void`, auch darum drop + create).
- Wer das Auth-Konto am RPC vorbei löscht (Dashboard, Admin-API), scheitert als Verwaltung am FK `restrict` (§8 L3).

### 3.5 Konten ohne Verein: Bestandsgrenzen 50/30 `<ts>_konten_ohne_verein.sql` (Story 12 #588)

Ersetzt die Einladungen der Vorfassung. Ein Konto ohne Verein ist kein gespeicherter Zustand, sondern abgeleitet: `person_verein(uid) is null`, also weder in `verein_verwaltung` noch in `team_members`. Nach dem Backfill gibt es kein Team ohne Verein, darum genügt diese Bedingung.

**Was zählt** (AK 1)

| Art | Zählt | Zählt nicht |
|---|---|---|
| Übungen (`exercises`) | `owner_id = uid and source = 'user'`, jede Sichtbarkeit (Entwurf, veröffentlicht), selbst angelegt wie kopiert | SFV-Bestand (`source = 'manual'`, `owner_id null`), Fassungen in Trainings (`training_exercises`, Kopie-Paradigma #72) |
| Trainings (`trainings`) | `owner_id = uid` (also `owner_id is not null`), Entwurf wie veröffentlicht, angelegt wie kopiert oder übernommen | Team- und Termin-Trainings (`owner_id null`, `team_datenmodell.sql:51-52`), Varianten (`training_varianten`), Gruppen, Übungen im Training |

**Eine Zähl-Definition:** Der SQL-Helfer `konto_bestand(p_user) returns jsonb` (SQL stable DEFINER, revoke all) liefert `{uebungen, trainings}` genau nach dieser Tabelle. Der Trigger, `meine_vereinslage()` (§4.3) und die Prüfabfrage nach dem Rollout (§6.5) rufen ihn; die Prüfabfrage vorab (§6.4) läuft vor der Migration und schreibt dieselbe Definition aus.

**Trigger `konto_grenze_vorher` BEFORE INSERT, dazu BEFORE UPDATE OF `owner_id`** (falls eine Zeile in persönliches Eigentum wechselt, §4.4) auf `exercises` und auf `trainings` (eine DEFINER-Funktion, `tg_table_name` unterscheidet; DEFINER, weil `person_verein` Verwaltung und Mitgliedschaften liest):
1. Nicht zählende Zeile (siehe oben) → durchlassen. Das schliesst Seed (`service_role`, `owner_id null`), Team-Kopien (W`lib/kern/kopie.ts:120-133`) und die Selbstprüfungen alter Migrationen (`varianten_veroeffentlichung.sql:226`) aus.
2. `sperre_person(new.owner_id)`.
3. `person_verein(new.owner_id) is not null` → durchlassen. Die Grenze fällt damit ab der ersten Anweisung nach der Aufnahme, auch für laufende Sitzungen und KI-Zugänge, und gilt wieder ab dem Austritt (PC 2). Es gibt keinen Cache.
4. `konto_bestand(new.owner_id)`: `uebungen >= 50` bzw. `trainings >= 30` → `KONTO_UEBUNGEN_VOLL` bzw. `KONTO_TRAININGS_VOLL`. Die vorhandenen Indizes `exercises_owner_idx` (`init_schema.sql:102`) und `trainings_owner_idx` tragen die Zählung.

Der Trigger fängt jeden Weg ab, ohne dass eine Action einzeln nachgezogen werden muss: Übung anlegen (W`lib/kern/uebungen.ts:94`, W`lib/actions/exercises.ts:108`), Übung kopieren und aus einem Training in die Bibliothek kopieren (W`lib/fassung.ts:366`), Training anlegen (W`lib/kern/training.ts:109`), übernehmen und kopieren (`kopiereTraining` mit Ziel «persönlich»), alles auch über den KI-Assistenten (AK 2, 3). Das Übernehmen einer Übung in ein Training schreibt `training_exercises` und bleibt frei (AK 4). Veröffentlichen kopiert nicht (W`lib/kern/kopie.ts:7-8`) und bleibt frei (PC 1).

- **Gleichzeitige Vorgänge** (AK 8): Die Personensperre serialisiert jede zählende Einfügung derselben Person, aus Anwendung und KI gemischt. Jede Einfügung läuft in eigener Transaktion; die Sperre gilt bis zu ihrem Commit.
- **Gescheiterte Vorgänge** belegen keinen Platz (AK 8): Eine abgewiesene Einfügung legt nichts an. Die beiden Kopien bleiben, wie sie sind; ein neuer Kopier-RPC entfällt:
  - **Übung aus einem Training in die Bibliothek** (Action `kopiereInBibliothek`, W`lib/actions/fassung.ts:297`, über `legeUebungsKopieAn`, W`lib/fassung.ts:327-380`) ist schon heute **ein** Insert in `exercises`: Das Bild wird vorher kopiert, weil sein Pfad die neue ID trägt, und bei einem abgewiesenen Insert wieder entfernt. Der Trigger prüft genau diesen Insert.
  - **Training kopieren** (`kopiereTraining`, W`lib/kern/kopie.ts:154`) legt zuerst die Zeile in `trainings` an (nur sie zählt), danach Fassungen, Gruppen und Varianten, und räumt bei einem Fehler Zeile und Bildkopien wieder ab. In eine DB-Transaktion lässt sich das nicht fassen, weil die Bildkopien im Storage liegen und ihre Pfade vor den Inserts feststehen müssen (Kommentar `kopie.ts:148-153`, #197 OoS 6).
  - AK 8 gilt damit für den Endstand: Nach einer gescheiterten Kopie ist der Platz wieder frei. Hingenommen ist das kurze Fenster, in dem eine Kopie schon angelegt, aber noch nicht fertig oder abgeräumt ist; eine gleichzeitige Anlage bei 29 wird in diesem Fenster abgewiesen. Ebenso bleibt wie heute eine Teilkopie stehen, wenn der Prozess selbst abbricht (Zeitüberschreitung).
- **Bestand über der Grenze** bleibt. Geprüft wird nur INSERT, Ändern, Veröffentlichen, Entwurf und Löschen bleiben frei (PC 1). Kein CHECK.
- **Sperrordnung:** Der Trigger nimmt nur die Personensperre. Keine Funktion hält dabei eine Vereins- oder Teamsperre, die nach der Person käme.
- Den Stand für Übersichten und Dialoge (`grenzen: {uebungen: {bestand, max: 50}, trainings: {bestand, max: 30}}` aus `konto_bestand`, nur ohne Verein gesetzt, AK 5–7, PC 3) liefert `meine_vereinslage()` (§4.3). Die TS-Zwillinge `KONTO_UEBUNGEN_MAX = 50`, `KONTO_TRAININGS_MAX = 30` stehen in W`lib/konto-grenzen.ts` (neu) und nennen den Trigger.
- **Nie bestätigte Konten verfallen nicht** (Epic OoS 19): Es gibt keinen Aufräum-Job und kein Löschen unbestätigter Konten.

### 3.6 Verwaltung `<ts>_vereine_verwaltung.sql` (Story 5 #581)

```sql
drop function create_team(text);            -- ersetzt durch verein_team_anlegen (§4.3), ohne Mitgliedschaft
drop trigger team_aufloesen_wenn_leer on team_members;  drop function team_aufloesen_wenn_leer();
drop policy teams_update on teams;           -- und jede weitere Schreib-Policy auf teams
revoke insert, update, delete on teams from authenticated;   -- Schreiben nur noch per Verwaltungs-RPC
-- teams_vorher zusätzlich BEFORE UPDATE OF name (Namensprüfung, unten)
```

- **Team anlegen ohne Mitgliedschaft** (AK 17): `verein_team_anlegen` (§4.3, erste Prüfung `ist_verein_verwaltung`) fügt nur in `teams` ein, die Verwaltung wird nicht Mitglied. Die Jury-Korrektur der Vorfassung («standardmässig Mitglied») ist überholt. In ein Team kommt sie über die Selbstaufnahme (§4.3), wie jede andere Person über `team_members_vorher`.
- **`team_aufloesen_wenn_leer` fällt zusammen mit** der Verwaltungssicht auf Teams (`verein_ansicht`, Auflösungszahlen, §4.3), in derselben Migration. Damit bleibt kein Team ohne Trainer:in unsichtbar, auch nicht zwischen zwei Merges auf `develop` (AK 7, AK 28, PC 3; Quelle `team_datenmodell.sql:282-295`).
- **Schreiben an `teams` nur per RPC:** `teams_update` (`team_datenmodell.sql:154`) und die tabellenweiten Schreib-Grants fallen. Anlegen, Umbenennen und Auflösen laufen über die Verwaltungs-RPCs im Bereich «Verein» (`verein_team_anlegen`, `verein_team_aufloesen` und die Umbenennung, §4.3) mit `ist_verein_verwaltung` (AK 19, 24, 26). Das ersetzt den Spalten-Grant `update (name)` der Vorfassung, den es nur für ihren Zwischenzustand R1 brauchte.
- **Teamname eindeutig je Verein** (AK 20–22, AK 35, PO 11): `teams_vorher` prüft bei INSERT und bei UPDATE OF `name` unter `sperre_verein` den Schlüssel `spieler_text_schluessel(name)` gegen die anderen Teams desselben Vereins → `TEAMNAME_VERGEBEN` (nur Netz; die RPCs prüfen vorher mit `teamname_vergeben` und antworten mit `{status: 'abgewiesen', grund: 'name_vergeben', team}`, §4.3). Beim UPDATE nur, wenn sich der Schlüssel ändert: Eine andere Schreibweise des eigenen Namens bleibt erlaubt (AK 22), bestehende gleichnamige Teams behalten ihre Namen (PC 6). Ein eindeutiger Index ginge wegen dieser Bestandsteams nur mit einer Ausnahme-Markierung; die Prüfung unter Sperre genügt, dasselbe Muster gilt für Spielernamen (§3.3 a). Welches Team den Namen trägt (AK 21), liefert die RPC aus derselben Abfrage.
- **Verwaltung:** unbegrenzt viele, gleichberechtigt, mindestens eine (`verwaltung_vorher`). Aufnahme sofort per E-Mail-Adresse ohne Annahme (§4.3 `verein_verwaltung_aufnehmen`, mit der Bremse von `finde_trainer`), Entfernen und Austreten per DELETE. Team-Mitgliedschaften und Verwaltung sind voneinander unabhängig (PC 4).
- **Team ohne Mitglied** besteht fort, mit allen Inhalten, Links, Abos und Abholadresse (PC 3). Ein Team bleibt auch beim Löschen des Kontos seines letzten Mitglieds bestehen.
- **Auflösen** ist weiter `delete from teams` (heute in `loese_team_auf`, `team_aufloesen_namensbestaetigung.sql:171`; künftig in `verein_team_aufloesen`). Neu ist nur, dass die Spieler:innen bleiben: `team_spieler` geht per Kaskade, `spieler` nicht mehr (§3.7, PC 1).

### 3.7 Spieler:innen ohne Team, Spielerbestand und Import

**`<ts>_vereine_bestand.sql` (Story 3 #579; die Verwaltungs-RPCs aus Story 6 #582 stehen in §4)**

```sql
drop trigger spieler_team_fest on spieler;  drop function spieler_team_fest();   -- würfe beim set null
alter table spieler alter column team_id drop not null;
alter table spieler drop constraint spieler_team_id_fkey,
  add constraint spieler_team_id_fkey foreign key (team_id) references teams(id) on delete set null;

drop policy sp_select on spieler;
create policy sp_select on spieler for select to authenticated using (
  exists (select 1 from team_spieler ts
           where ts.spieler_id = spieler.id and ts.team_id in (select meine_team_ids())));
-- Spaltengrant ohne link_token bleibt
```

- **Ohne den FK-Wechsel löschte das Auflösen eines Teams seine Spieler:innen** (`spielerliste.sql:66`, `on delete cascade`). Er muss darum spätestens mit dem ersten Herausnehmen (Story 3) kommen.
- `spieler.team_id` ist ab hier tot: Keine RPC schreibt oder liest die Spalte mehr, ausser `vereine_nachziehen` für Zeilen aus einem Prod-Dump vor dem Release (§6). Sie fällt im Contract (§3.8).
- **`sp_select` nur für Mitglieder zugeordneter Teams.** Die Verwaltung liest den Spielerbestand ausschliesslich über DEFINER-RPCs mit `ist_verein_verwaltung` (`verein_spielerliste`, `verein_spieler_*`, §4.3), alle Trainer:innen des Vereins Name, Jahrgang und Teams über `verein_spielerliste` mit `ist_verein_mitglied`. Damit summiert keine Policy Mitglied und Verwaltung (Rollen nach Ort, PO 13). Kein Web- oder MCP-Leser schliesst aus «Zeile sichtbar» auf ein Recht im Bereich «Verein».
- **Spieler:innen ohne Team bleiben unbefristet** (Story 6 PC 1). Es gibt keinen Verfall und keinen Job. Ändern und Link abrufen oder erneuern prüfen die RPCs (§4.4): ohne Team nur die Verwaltung (Story 6 AK 14). Löschen darf ohnehin nur die Verwaltung (Story 3 AK 12).
- **Feedback über den Link** (mit Story 7, `<ts>_link_mehrere_teams.sql`): neue Prüfung `feedback_link_gueltig(p_token)` über `spieler.link_token` (gleiches Format-Muster). Die vier Gültigkeitsstellen (`feedback_link.sql:39`, `:51`, `:64`, `:77` in `feedback_link_ablegen`) prüfen `feedback_link_gueltig`. `feedback_link_ablegen` speichert heute das Team aus `feedback_link_team` in `feedback`; ab Story 7 kein Team mehr (Story 7 PC 6). Danach hat `feedback_link_team` keinen Leser und entfällt (drop). Sonst gälte ein gültiger Link einer Spieler:in ohne Team im Feedback als ungültig (Story 7 AK 18). Zwischen den Merges von Story 3 und Story 7 gilt das auf `develop` noch nicht; auf Prod gibt es den Zwischenstand nicht.

**`<ts>_import_verein.sql` (Story 9 #585)**

```sql
drop function spieler_importieren(uuid, jsonb, jsonb);       -- Team-Import (spieler_import.sql:23) entfällt
create function verein_spieler_importieren(p_verein uuid, p_zeilen jsonb, p_erwartet jsonb default null) …;
-- revoke all … from public, anon; grant execute … to authenticated
```

- Gleiches Muster wie heute: `p_erwartet null` = Vorschau, sonst Übernahme. Weicht der Stand ab, antwortet die Übernahme ohne Änderung mit dem Status `veraltet` samt neuer Vorschau (§4.3), und die Oberfläche zeigt sie (AK 9; heute der Marker `SPIELERLISTE_GEAENDERT`, `spieler_import.sql:85-89`). `p_erwartet` umfasst neu auch die Zeilen «mehrfach im Verein geführt».
- Erste Prüfung `ist_verein_verwaltung(p_verein)` (AK 11). `sperre_verein`.
- Abgleich über `spieler_text_schluessel` im **ganzen Verein**, auch Spieler:innen ohne Team und Schnuppernde (AK 2). Eine Zeile mit mehreren Treffern (Altdubletten) ändert keine J+S-Nummer und macht die Übernahme allein nicht möglich (AK 5).
- Neue Spieler:innen ohne Zuordnung (PC 1). Kein `team_spieler`, kein `spielerzahl_freigeben`, keine Termine (PC 5).
- Grenze nur des Vereins: `neu > 0 and bestand + neu > 1000` → `VEREIN_VOLL`, die Vorschau liefert `bestand`, die Oberfläche rechnet den Überschuss (AK 6–8). Zeilendeckel 1000 → `IMPORT_ZU_GROSS`.
- Eine Transaktion, ganz oder gar nicht (PC 4).
- Mit dem Drop weist die Datenbank jeden Team-Import ab, auch von Verwaltungsmitgliedern (AK 12). Der Import-Fix der Vorfassung (Teamgrenze bei `neu = 0`) wird damit gegenstandslos.

### 3.8 Contract als Nachlauf N1 (nach dem Release)

```sql
-- vorher grep-Wächter in check:kern grün (§6)
alter table spieler drop column team_id;                         -- war seit Story 3 tot
alter table spieler drop column probe_seit;                      -- seit §3.2 auf team_spieler
drop function vereine_nachziehen(uuid);  drop function staging_nach_sync();
alter table teams   add constraint teams_verein_pflicht   check (verein_id is not null) not valid;
alter table spieler add constraint spieler_verein_pflicht check (verein_id is not null) not valid;
-- Folgemigration: validate → set not null → drop constraint (beide Tabellen)
```

- **Contract-Schritt, nicht destruktiv im Sinn von «forward-only»:** N1 ist der zweite Schritt eines Expand/Contract. Beide Spalten liest und schreibt seit dem Release niemand mehr (grep-Wächter §5.5, Hilfsabfrage dort). Ihre Werte sind seit dem Release bewusst veraltet: Herausnehmen und Schnupper-Ende pflegen sie nicht, die gültigen Angaben stehen in `team_spieler`. Verloren geht also nichts, was ein Leser braucht. Eine Zusicherung über die Werte (etwa «jede Zeile mit `probe_seit` hat eine Zuordnung mit `probe_seit`») wäre aus demselben Grund falsch und entfällt; zugesichert wird vor dem Drop, dass der grep-Wächter und der psql-Testlauf grün sind.
- **Entscheid: Nachlauf N1, nicht im Release.** Dass §4 `spieler.team_id` nirgends mehr liest, würde den Drop im Release fachlich erlauben. Er scheitert am Betrieb: Vom ersten Vereine-Merge auf `develop` bis zum Prod-Release lädt der Sync einen Prod-Dump mit `spieler.team_id`, `spieler.probe_seit` und ohne `verein_id`. Fehlen die Spalten auf Staging oder gilt dort NOT NULL, bricht COPY, auch im Wartungsfenster selbst (Generalprobe direkt davor). Ein Drop nur in einer letzten Migration des Releases verschöbe das Problem bloss auf den letzten Story-Merge. Bis N1 halten `teams_vorher` und `spieler_vorher` (`VEREIN_FEHLT`) die Invariante, und die toten Spalten schreibt und liest niemand ausser `vereine_nachziehen`.
- **Wann:** frühestens 2 Wochen nach dem Prod-Release ohne Befund, als technischer PR ohne sichtbare Änderung (N1 in §6 und §9). Ab dann hat Prod das neue Schema, und der Sync bricht nicht mehr.
- **Im selben PR ausserhalb der Migration:**
  - `supabase/tests/vereine_nachziehen.sql` fällt weg. Nach dem Drop schlüge der Aufruf fehl, und schon das Anlegen der Testdaten über `spieler.team_id` bräche ab.
  - Die übrigen psql-Tests unter `supabase/tests/` legen Spieler:innen nur über `team_spieler` an.
  - `sync-staging.yml`: Der Aufruf «`select staging_nach_sync()`, sofern vorhanden» fällt weg.

### 3.9 Bestand: heute → neu

| Tabelle | Heute | Neu | Story |
|---|---|---|---|
| `teams` | ohne Elternschlüssel, UPDATE tabellenweit (`team_datenmodell.sql:383`), stirbt ohne Mitglieder | `verein_id` (bis Contract nullable, per Trigger Pflicht), `unique(id, verein_id)`, Name eindeutig je Verein (Prüfung), kein UPDATE-Grant; besteht ohne Mitglieder | 1, 5; Contract |
| `spieler` | `team_id NOT NULL … cascade`, `spieler_eindeutig` je Team, `probe_seit` | `verein_id`, Eindeutigkeit je Verein (Trigger-Prüfung unter Vereinssperre, Altdubletten bleiben); `team_id` nullable, `set null`, tot; `probe_seit` tot. Beide fallen im Contract. | 1, 2, 3; Contract |
| `vereine`, `verein_verwaltung`, `team_spieler` | – | neu; `team_spieler.probe_seit` trägt den Schnupper-Status | 1 |
| `team_members` | – | Trigger «höchstens ein Verein je Person»; ein Team darf ohne Mitglieder bestehen | 1, 5 |
| `kader_spieler`, `termin_abmeldungen`, `spiel_meldungen` | Teamgleichheit nur im RPC | FK auf `team_spieler` (Kaskade), Termin-FK | 3 |
| `termin_statuswechsel`, `termin_eingefroren`, `termin_kader`, `spiel_treffpunkte` | – | Termin-FK; kein Zuordnungs-FK. `termin_eingefroren` zusätzlich `unique (termin_id, team_id)` | 3 |
| `termin_teilnahmen`, `spiel_teilnahmen` | `spieler_id … set null`, `team_id` ohne FK | FK `(termin_id, team_id)` auf `termin_eingefroren`; Nachtrag für alle im festgehaltenen Stand, auch Herausgenommene | 1, 3 |
| `training_termine` | – | `unique (id, team_id)` | 3 |
| `team_probetraining` | Kontingent je Team | unverändert (heisst in der Oberfläche Schnuppertraining) | – |
| `team_abholung`, `abholung_sperren` | je Team | unverändert; Suche über `team_spieler` des Abholteams | – |
| `spieler_abos` | an `spieler` | unverändert; der Feed liefert mehrere Teams | – |
| `exercises`, `trainings` | unbegrenzt | Trigger `konto_grenze_vorher` (50/30 für Konten ohne Verein) | 12 |
| `kalender_abos`, `profiles`, `kader`, `termin_serien*`, `feedback*`, `training_exercises` | – | unverändert | – |
| `auth.users` | freie Registrierung | **unverändert** frei; keine Einladungen, kein Löschen unbestätigter Konten | – |

Nicht mehr vorgesehen (Vorfassung): `zugangsantraege`, `zugang_bremse`, `einladungen`, die Spalten `freigabe_bis`/`gueltig_bis`, der Trigger `einladungen_vorher`, die Dual-Write-Trigger `spieler_verein_vorher`/`spieler_team_spiegeln` und der Parameter `p_selbst_mitglied`. Die Dual-Write-Trigger dienten nur der Vorversion zwischen R1 und R3; mit einem Release und Wartungsfenster (§6) schreibt nur noch neuer Code, und die neuen RPCs setzen `verein_id` und `team_spieler` selbst.

### 3.10 Grenzen

| Grenze | Wert | SQL (Marker) | TS-Zwilling |
|---|---|---|---|
| Zuordnungen je Team | **100**, nur neue; jede Zuordnung zählt, Schnuppernde auch | `team_spieler_vorher` (`SPIELERLISTE_VOLL`); gesammelt vorab mit Überschuss | `SPIELER_MAX` W`lib/spieler.ts:25`, Kommentar `:17-18` nennt `team_spieler_vorher` |
| Spieler:innen je Verein | **1000**, inklusive ohne Team, Schnuppernde und Altdubletten | `spieler_vorher` INSERT unter `sperre_verein` (`VEREIN_VOLL`); Import vorab mit `neu > 0` | `VEREIN_SPIELER_MAX` W`lib/verein.ts` (neu) |
| Teams je Verein | **30** | `teams_vorher` (`VEREIN_TEAMS_VOLL`) | `VEREIN_TEAMS_MAX` |
| Übungen eines Kontos ohne Verein | **50** | `konto_grenze_vorher` (`KONTO_UEBUNGEN_VOLL`) | `KONTO_UEBUNGEN_MAX` W`lib/konto-grenzen.ts` (neu) |
| Trainings eines Kontos ohne Verein | **30** | `konto_grenze_vorher` (`KONTO_TRAININGS_VOLL`) | `KONTO_TRAININGS_MAX` |
| Vereine je Person | **1** (Invariante, keine Mengengrenze) | `verwaltung_vorher`, `team_members_vorher` (`ANDERER_VEREIN`, beim Gründen `SCHON_IM_VEREIN`) | – |
| Verwaltung je Verein | mindestens 1, **keine Obergrenze** | `verwaltung_vorher` (`LETZTE_VERWALTUNG`) | – |
| erfolglose Suchen nach Konten (Team und Verwaltung) | 10 je Stunde (unverändert) | `such_bremse_aktiv` (Status `gebremst`) | – |
| Vereinsname | 1–60 Zeichen, ohne Rand-Leerzeichen, nicht eindeutig | CHECK `verein_name` | `VEREIN_NAME_MAX`, `vereinsNameProblem()` |
| Teamname | eindeutig je Verein nach Schlüssel (Bestand ausgenommen) | `teams_vorher` (`TEAMNAME_VERGEBEN`) | – |
| Import-Zeilen je Aufruf | 1000 (unverändert) | `verein_spieler_importieren` (`IMPORT_ZU_GROSS`) | `IMPORT_ZEILEN_MAX` W`lib/spieler-import.ts:17`, **eigener Text** statt `zuGross` |

- Grenzen und Eindeutigkeit gelten bis zum Preisplan ohne Ausnahme (PO 11) und wirken nur auf INSERT-Pfade: Aufnehmen, Spieler:in ohne Team erfassen, Import mit neuen Zeilen, Zuordnen, Team anlegen, Übung oder Training anlegen bzw. kopieren. Ändern, Entfernen, Schnuppern, Link, Abholung, Veröffentlichen und Auflösen bleiben möglich.
- Keine Grenze ist ein CHECK. Bestand über einer Grenze bricht weder `db push` noch `VALIDATE` noch den Sync.
- Ein Import über die Vereinsgrenze und ein gesammeltes Zuordnen über die Teamgrenze werden ganz abgelehnt (PO 11). Der Import prüft keine Teamgrenze (Story 9 AK 8).
- Die «200» der erwarteten Spielerzahl ist **nicht** die Teamgrenze und bleibt (`termin_spielerzahl.sql:21`, `terminserie_platz.sql:28`, `spiele_art.sql:42-43`, W`lib/termin.ts:56`).
- Für Vereine selbst gibt es keine Gesamtgrenze. Jedes Konto kann höchstens einen Verein haben; dass eine Gründung die Grenzen 50/30 aufhebt, nimmt die Betreiberin bis zum Preisplan hin (PO 12, Story 12 OoS 1).

**Neue Marker aus diesem Abschnitt** (für §5.2): `VEREIN_FEHLT`, `VEREIN_FEST`, `VEREIN_VOLL`, `VEREIN_TEAMS_VOLL`, `TEAM_NUR_VERWALTUNG`, `LETZTE_VERWALTUNG`, `ANDERER_VEREIN`, `SCHON_IM_VEREIN`, `BESTAETIGUNG_FEHLT`, `TEAMNAME_VERGEBEN`, `SCHON_ZUGEORDNET`, `SPIELER_SCHNUPPERT`, `SCHNUPPERN_MEHRERE_TEAMS`, `SCHNUPPERN_NUR_EINZELN`, `KONTO_UEBUNGEN_VOLL`, `KONTO_TRAININGS_VOLL`, `IMPORT_ZU_GROSS`, `NUR_IN_DER_ANWENDUNG` (§4.1). Bestehend und weiter genutzt: `SPIELER_DOPPELT`, `SPIELERLISTE_VOLL`, `PROBE_ANZAHL_FEHLT` (nur noch in `spieler_probe_setzen`). Kein Marker steckt als Teilstring in einem anderen (Regel aus `check:kern`).

---

## 4. Rechte, RLS, RPCs

**Leitlinie: Rollen nach Ort (Epic PO 13).** Jede RPC gehört genau einem Ort und prüft genau ein Recht:
- **Team-Ort** (Team-Seiten, Spielerliste des Teams, KI-Assistent): Jede Team-RPC bekommt `p_team` ausdrücklich. Prüfung ausschliesslich über die Mitgliedschaft in diesem Team (`ist_team_mitglied(p_team)`, bei Spieler:innen zusätzlich `spieler_im_team(p_spieler, p_team)`). Wer auch der Verwaltung angehört, hat hier die Rechte und Meldungen eines Mitglieds, nicht mehr.
- **Verein-Ort** (Bereich «Verein»): RPCs mit Präfix `verein_`, Prüfung ausschliesslich über `ist_verein_verwaltung` bzw. für die Ansichten `ist_verein_mitglied`. Eine Verwaltung, die zugleich Mitglied ist, wird hier nicht zusätzlich als Mitglied behandelt.
- **Kein Prädikat und keine RPC verknüpft beides mit OR** (kein `darf_x = Mitglied OR Verwaltung`). Die Prädikate `darf_team_verwalten`, `darf_spieler_fuehren` und `darf_spieler_zuordnen` der Vorfassung entfallen ersatzlos.
- Gemeinsame Fachlogik liegt in Kern-Funktionen ohne API-Recht (`*_kern`, `revoke all … from public, anon, authenticated`). Die Einstiege der beiden Orte unterscheiden sich nur in der ersten Prüfung, den Ortsregeln (z. B. Löschen aus dem Verein nur am Verein-Ort, Rückfrage über `p_stand` nur am Team-Ort) und den Rückgabetexten.
- Der MCP-Server ruft nur Team-Ort-RPCs auf (Story 13, «Vereinsverwaltung nie per KI»). Ein grep-Wächter in `check:kern` stellt sicher, dass unter W`lib/mcp/` kein Aufruf `verein_*` vorkommt (§7.10). Weil das KI-Token ein gewöhnliches Nutzer-JWT ist und PostgREST jede RPC mit Grant an `authenticated` annimmt, weist zusätzlich die Datenbank selbst KI-Tokens am Verein-Ort ab (`nur_in_der_anwendung()`, §4.1).
- **Vereins-RPCs nehmen `p_verein` ausdrücklich**, obwohl eine Person höchstens einem Verein angehört. Grund: Hat die Person zwischen dem Laden der Seite und der Aktion den Verein gewechselt, scheitert die Aktion an der Rechteprüfung, statt still im neuen Verein zu wirken. Die Routen tragen die ID trotzdem nicht (§7): Die Seite liest sie aus `meine_vereinslage()` und gibt sie der Action mit. Nur `create_team(text)` leitet den Verein bis Story 5 ab, weil seine Signatur gleich bleibt.

Warum getrennte Einstiege statt eines Parameters `p_ort`: Sicherheitlich wären beide gleichwertig, denn wer beide Rollen hat, darf beide Einstiege rufen. Getrennte Einstiege machen die Ortsregel aber je RPC prüf- und testbar, halten den MCP-Wächter einfach und vermeiden Überladungen in PostgREST.

### 4.1 Prädikate und Helfer

| Funktion | Art | Grant | Inhalt |
|---|---|---|---|
| `ist_team_mitglied(p_team)` | **unverändert** | anon, authenticated | Gate aller Team-Inhalte und einziges Recht am Team-Ort, **nie** mit Vereins-Klausel |
| `meine_team_ids()` | SQL stable DEFINER | authenticated (Policy) | `team_id` aus `team_members` des Aufrufs (InitPlan in Policies) |
| `person_verein(p_user)` | SQL stable DEFINER | revoke all | Verein der Person: aus `verein_verwaltung`, sonst über `team_members ⋈ teams`. Skalare Unterabfrage über `distinct verein_id`; verletzt jemand die Invariante «höchstens ein Verein» (§3.1), bricht sie laut ab statt still einen zu wählen. |
| `mein_verein()` | SQL stable DEFINER | authenticated (Policy) | `person_verein(auth.uid())` |
| `ist_verein_verwaltung(p_verein)` | SQL stable DEFINER | authenticated | `p_verein is not null and exists(verein_verwaltung …)` |
| `ist_verein_mitglied(p_verein)` | SQL stable DEFINER | authenticated (Policy), **nicht** anon | `p_verein is not null and mein_verein() = p_verein` |
| `spieler_im_team(p_spieler, p_team)` | SQL DEFINER | revoke all | `exists team_spieler` |
| Team-Ort-Recht auf eine Spieler:in | – | – | kein eigenes Prädikat: `ist_team_mitglied(p_team) and spieler_im_team(p_spieler, p_team)` mit dem ausdrücklich übergebenen `p_team` (J+S, Link, Stammdaten, Schnuppern). Fehlt eines → `SPIELER_NICHT_GEFUNDEN`. |
| `spieler_teamnamen(p_spieler)` | SQL DEFINER | revoke all | `text[]` der Teamnamen, sortiert; Baustein aller Auskünfte (Doppelerfassung, Löschen, Link, KI). Gibt nie J+S oder Link heraus. |
| `spieler_doppelt(p_verein, p_vorname, p_nachname, p_jahrgang, p_ausser uuid default null)` | SQL DEFINER | revoke all | Treffer im Verein über `spieler_text_schluessel` (Index `spieler_schluessel_verein`, nicht eindeutig, §3.3 a). Liefert null oder `{teams[], team_ids[], ohne_team}` über alle Treffer (Altdubletten können mehrere sein), Teams nach Namen. `team_ids` bleibt intern: Daraus leitet `spieler_doppelt_status(p_doppelt, p_team)` (SQL, revoke all) `eigenes_team` ab und gibt nur die Namen weiter (Story 2 PC 3). Nur der eigene Verein (Story 2 PC 2). |
| `teamname_vergeben(p_verein, p_name, p_ausser uuid default null)` | SQL DEFINER | revoke all | Name eines anderen Teams im Verein mit gleichem `spieler_text_schluessel(name)` oder null (Story 5 AK 20–22; gleiche Vergleichsregeln wie bei Spieler:innen) |
| `sperre_verein(p_verein)` | plpgsql | revoke all | `pg_advisory_xact_lock(hashtextextended('verein:'‖id, 0))`, NULL verboten |
| `sperre_person(p_user)` | plpgsql | revoke all | `'person:'‖uid`, NULL verboten. Schützt die Invariante «höchstens ein Verein» (Story 11 AK 9) und die Kontogrenzen (Story 12 AK 8). |
| `sperre_teams(uuid[])` | plpgsql | revoke all | `'spieler:'‖team` (bestehender Schlüssel), sortiert nach UUID, NULL verboten |
| `spielerzahl_freigeben(p_team)` | plpgsql | revoke all | §3.3; dient `spieler_aufnehmen` und `verein_spieler_zuordnen` |
| `verein_loeschen_kern(p_verein)` | plpgsql | revoke all | §4.3; gemeinsam für `verein_loeschen` und `delete_account` |
| `feedback_link_gueltig(p_token)` | SQL DEFINER | revoke all | Gültigkeit über `spieler.link_token` (Formatprüfung wie heute), ohne Team (Story 7 AK 18) |
| `konto_grenze_vorher()` | Trigger, DEFINER | revoke all | §4.4, Kontogrenzen (Story 12) |
| `konto_bestand(p_user)` | SQL stable DEFINER | revoke all | `{uebungen, trainings}` nach §3.5: `exercises` mit `owner_id = p_user and source = 'user'`, `trainings` mit `owner_id = p_user`; einzige Zähl-Definition für Trigger, `meine_vereinslage()` und Prüfabfrage |
| `nur_in_der_anwendung()` | plpgsql stable, Fundament-Migration (Story 1) | revoke all | `if coalesce(auth.jwt() ? 'client_id', false) then raise exception 'NUR_IN_DER_ANWENDUNG'`. Erste Anweisung jeder RPC `verein_*`, von `verein_gruenden` und von `delete_account`, lesend wie schreibend: Ein OAuth-Token eines KI-Clients trägt den Claim `client_id` (W`lib/supabase/bearer.ts:12`), eine Browser-Sitzung nicht. So hängt «Vereinsverwaltung nie per KI» (Story 13 OoS 1, PC 1, Epic OoS 8) nicht allein am Werkzeugsatz. `meine_vereinslage()` ist ausgenommen, weil der KI-Hinweis für Konten ohne Team sie braucht (Story 13 AK 10). |

Entfallen gegenüber der Vorfassung: `darf_team_verwalten`, `darf_spieler_fuehren`, `darf_spieler_zuordnen` (Summierung), `meine_verwaltung_ids` (keine Policy braucht sie mehr), `kontextteam` (die Team-Ort-RPCs prüfen selbst, §4.2), `istPlattformAdmin` samt W`lib/plattform-admin.ts` (es gibt keine Admin-Rolle mehr), `spieler_alle_teams_eigen` (Mitglieder löschen nicht mehr, PO 01.11.2026, Story 3 AK 12). `vereine_nachziehen` und `staging_nach_sync` stehen in §6.

**Sperrordnung, verbindlich für alle RPCs und Trigger:**
1. Vereinssperre
2. Personensperre (die aufgenommene Person bzw. das Konto bei den Kontogrenzen)
3. Teamsperren aufsteigend nach UUID
4. die `spieler`-Zeile (`for update`)
5. die Termin-Zeile (`training_termine … for update`, wie heute in `abmeldung_anwenden_training`)

Regeln dazu:
- Wer die **Teammenge einer Spieler:in** liest, um sie zu sperren oder zu prüfen, nimmt **vorher** die Vereinssperre. Das gilt für Ändern (Namensschlüssel im Verein), Zuordnen, Schnuppern einschalten und Löschen. Sonst prüft eine gleichzeitige Zuordnung über eine veraltete Menge. Einzige Ausnahme ist der Recheck beim Herausnehmen (`p_stand`): Er vergleicht nach Teamsperre und `spieler`-Zeile `for update`; jeder Weg, der die Menge vergrössert, hält dieselbe Zeile (§3.3 d, e).
- **Löschende RPCs sperren vor dem DELETE.** Ein DELETE sperrt zuerst die Zeile, erst danach laufen BEFORE-DELETE-Trigger und FK-Kaskaden mit ihren Advisory-Sperren. Nähme erst der Trigger Verein und Teams, entstünde die Ordnung Zeile → Verein → Teams. Darum nimmt jede RPC, die `spieler`, `team_spieler`, `teams` oder `verein_verwaltung` löscht, vorher selbst alle Advisory-Sperren in der Ordnung (Verein, dann Teams aufsteigend, dann die `spieler`-Zeile `for update`). Die Trigger nehmen sie reentrant noch einmal, als Netz. Das Pflicht-Inventar prüft es je löschender RPC (§5.5).
- Ebenfalls zuerst die Vereinssperre: Erfassen (Team-Ort und Verein-Ort), Import, Team anlegen und umbenennen, Verwaltung ändern, Verein umbenennen und löschen, Konto löschen eines Verwaltungsmitglieds. So gilt die Eindeutigkeit von Spieler- und Teamnamen je Verein auch bei gleichzeitigen Eingaben aus verschiedenen Teams (Story 2 AK 8, Story 5 AK 35).
- Der Invarianten-Trigger auf `team_members` und `verein_verwaltung` (§3.1) nimmt selbst erst die Vereinssperre des Ziels, dann die Personensperre. Zwei gleichzeitige Aufnahmen derselben Person in zwei Vereine serialisieren auf der Personensperre; die zweite sieht danach den ersten Verein und scheitert (`ANDERER_VEREIN`).
- `verein_gruenden` sperrt nur die Person, denn den neuen Verein gibt es noch nicht. Die Vereinssperre, die der Verwaltungs-Trigger danach auf die neue UUID nimmt, kann niemand sonst halten; sie verletzt die Ordnung also nicht wirksam.
- `verein_loeschen` sperrt nur den Verein, keine Personen. Eine gleichzeitige Aufnahme nimmt dieselbe Vereinssperre; eine Prüfung der Kontogrenzen liest die Zugehörigkeit unter READ COMMITTED und sieht den Verein ganz oder gar nicht, einen halb gelöschten nie. Das Konto-Löschen sperrt wie beschrieben Verein, dann die eigene Person (§3.4).
- Herausnehmen braucht keine Vereinssperre (es verkleinert die Menge nur).
- Meldungen am Termin (Link und Trainer:in) sperren das Termin-Team. Die zusätzliche `spieler`-Zeilensperre der Vorfassung für Probe-Anmeldungen entfällt: Schnuppern gilt nur in genau einem Team (Story 8), das Kontingent ist also nie über mehrere Teamsperren verteilt.
- Advisory-Locks sind reentrant. Eine Stufe auszulassen ist erlaubt, die Reihenfolge umzukehren nicht. Das Pflicht-Inventar (§4.4) prüft auch, dass keine Funktion eine Termin-Zeile vor der `spieler`-Zeile sperrt.

Befund, der die Umstellung erzwingt (weiter gültig): `spieler_vorher` sperrt mit `team_id = NULL` nichts (`hashtextextended(NULL)` ist strikt) und zählt 0 (`20261016100000_spielerliste.sql:172-189`). Spieler:innen ohne Team dürfen erst entstehen, wenn `spieler_vorher` über die Vereinssperre zählt (§3.3). Da alles in einem Release kommt, ist das innerhalb der Migrationsfolge sicherzustellen (§6).

### 4.2 Policies

| Tabelle | SELECT | Schreiben |
|---|---|---|
| `vereine` | `ist_verein_mitglied(id)` (Vereinsname für alle Vereinsmitglieder, Story 1 AK 3) | nur RPC |
| `verein_verwaltung` | keine Policy, kein Grant | nur RPC |
| `team_spieler` | `ist_team_mitglied(team_id)` | nur RPC |
| `spieler` | `exists(team_spieler ts where ts.spieler_id = spieler.id and ts.team_id in (select meine_team_ids()))`; Spaltengrant ohne `link_token` bleibt, dazu `verein_id` | nur RPC |
| `teams` | **unverändert** `ist_team_mitglied(id)` | kein UPDATE-, INSERT- oder DELETE-Recht mehr; Name nur über `verein_team_umbenennen` |
| `exercises`, `trainings` | unverändert | unverändert; Kontogrenzen per Trigger (§4.4) |
| Termin-, Meldungs-, Kader-, Trainings-Tabellen, `team_members`, `kalender_abos`, Storage `team/<id>/` | unverändert, die Verwaltung sieht keine Team-Inhalte (Epic OoS 16) | unverändert |

**Keine Verwaltungsklausel in einer Policy.** Die Verwaltung liest Verein, Teams, Trainer:innen und den Spielerbestand ausschliesslich über die DEFINER-RPCs des Verein-Orts (`verein_ansicht`, `verein_team_ansicht`, `verein_spielerliste`). Damit entfällt der Befund der Vorfassung, dass die Verwaltung über `sp_select` Spieler-Zeilen ohne Team-Kontext sieht und jeder Leser das wissen muss.

**Weiter gültig: «Zeile sichtbar» heisst nicht «im Kontextteam».** Ein Mitglied der Teams A und B sieht die Zeile einer Spieler:in aus B auch, wenn es Team A anzeigt. Leser mit Team-Kontext gehen deshalb immer über `team_spieler` des Kontextteams, nie über `spieler.team_id`:
- W`lib/kern/spieler.ts:117` (`ladeSpielerliste`), `:177` (`spielerVon` liefert `teamId` aus der Zeile; künftig die Teamliste), `:195` (`anzahlSpieler`)
- W`lib/kern/abmeldungen.ts:86`, `:184` (liest Namen über `spieler.id` und braucht vorher `spieler_im_team(Termin-Team)`)
- W`lib/kern/spiele.ts:135`

Die weiteren Teams einer Spieler:in (Story 3 AK 9, Story 13 AK 2) liefert `spieler_weitere_teams(p_team)` (§4.3), weil `team_spieler` und `teams` fremder Teams für das Mitglied unsichtbar bleiben.

### 4.3 Neue RPCs

Alle sind `SECURITY DEFINER` mit `search_path = public, pg_temp`. Die Rechteprüfung ist die erste Anweisung (am Verein-Ort davor `nur_in_der_anwendung()`, §4.1), danach folgen die Sperren in der Sperrordnung. Listen kommen als `jsonb`, nie als `returns table`: PostgREST kappt Tabellenrückgaben bei `max_rows = 1000` (`supabase/config.toml:18`), und ein Verein darf 1000 Spieler:innen haben. Abweisungen, die eine Auskunft mit Teamnamen tragen, kommen als `jsonb` (`{status: 'abgewiesen', grund, …}`, Muster `termin_abmeldung_setzen`), damit Anwendung und KI denselben Text bauen (Story 2 AK 10, Story 8 AK 15). Grenzen bleiben Marker aus den Triggern (§3.10).

**Verein und Konto (Story 1, 11, 12)**

| RPC | Grant | Erste Prüfung | Wirkung / Status |
|---|---|---|---|
| `meine_vereinslage()` | authenticated | uid | `{verein: {id, name, ist_verwaltung, ist_teammitglied} \| null, grenzen: {uebungen: {bestand, max: 50}, trainings: {bestand, max: 30}} \| null}`. `grenzen` nur ohne Verein, `bestand` aus `konto_bestand(uid)` (§3.5; Story 12 AK 5, PC 3). Ersetzt `meine_vereine()` der Vorfassung; Seitenleiste, `/teams`, Übersichten und der KI-Hinweis (Story 13 AK 1, AK 10) lesen hieraus. |
| `konto_loeschen_info()` | authenticated | uid (nur das eigene Konto) | Für den Dialog «Konto löschen» (§7.3): `{fall, verein, teams_bleiben}` mit `fall ∈ {frei, letzte_verwaltung, einzige_person}`; `verein` (Name) für den Fall `einzige_person`, `teams_bleiben` = Teams, deren letztes Mitglied die Person ist (Story 5 AK 29). Nur lesend, darum keine Sperren; `delete_account` prüft beim Ausführen erneut (Story 11 AK 14). |
| `verein_gruenden(p_name, p_bestaetigt boolean)` | authenticated | uid, bestätigte eigene Adresse (`auth.users.email_confirmed_at`) | `p_bestaetigt` nicht true → `BESTAETIGUNG_FEHLT` (Story 11 AK 3; die Bestätigung wird nicht gespeichert, PC/OoS 2). `sperre_person(uid)`, `person_verein(uid)` gesetzt → `SCHON_IM_VEREIN` (AK 4). Den Namen prüft der CHECK `verein_name` (1–60, §3.1; AK 2). Insert `vereine` und `verein_verwaltung`. Rückgabe `{id}`. Kein Team (PC 1). |
| `verein_ansicht(p_verein)` | authenticated | `ist_verein_mitglied` | Für alle Vereinsmitglieder: Name, Verwaltung `[{anzeige_name, ich}]`; ohne Anzeigenamen ist `anzeige_name` null, und Personen ohne Verwaltung sehen an der Stelle nur die Rolle «Vereinsverwaltung», nie die E-Mail-Adresse (Story 5 AK 9, OoS 4). Teams `[{id, name, ist_mitglied}]` (Story 5 AK 1, 3, 8, 9). Nur bei `ist_verein_verwaltung` zusätzlich: E-Mail der Verwaltung (AK 6), je Team die Trainer:innen `{user_id, anzeige_name, email, ist_verwaltung}` (AK 4), `spieler_zahl` aus `team_spieler` wie für die Grenze 100 (AK 5), `ohne_mitglied` (AK 7), `spieler_ohne_team` (Zahl) und die Löschzahlen `{teams, spieler}` inklusive ohne Team (Story 11 AK 11). |
| `verein_umbenennen(p_verein, p_name)` | authenticated | `ist_verein_verwaltung` | Vereinssperre, CHECK 1–60 (Story 5 AK 23) |
| `verein_loeschen(p_verein, p_name)` | authenticated | `ist_verein_verwaltung` | Vereinssperre (keine Personensperren, §4.1), dann **erneut** Name und Recht prüfen (Story 11 AK 14). Name: `normalize(btrim(p_name), nfc) = normalize(name, nfc)`, Gross- und Kleinschreibung zählt (AK 10), sonst, auch leer oder null, `{status: 'vereinsname_falsch', name}`. Die Löschzahlen für den Dialog liefert vorher `verein_ansicht` (AK 11). Danach `verein_loeschen_kern`. Rückgabe `{status: 'geloescht', bilder}`. |
| `verein_loeschen_kern(p_verein)` | revoke all | Aufruf nur aus DEFINER-Pfaden unter Vereinssperre | `bilder := team_bilder(t)` für alle Teams (Storage räumt die Action wie bei `verein_team_aufloesen`), dann `delete from teams where verein_id = p` (kaskadiert alles, was beim Auflösen verschwindet, samt Abholadresse), dann `delete from spieler where verein_id = p` (Links, `spieler_abos`; ohne Teams friert `spieler_vorher` nichts mehr ein), dann `delete from vereine` (kaskadiert `verein_verwaltung`, der Trigger lässt durch, weil der Verein weg ist, §3.1). Alle Personen sind danach Konten ohne Verein, ihre eigenen Übungen und Trainings bleiben (PC 3, 4). |

**Teams und Personen am Verein-Ort (Story 5, 11)**

| RPC | Grant | Erste Prüfung | Wirkung / Status |
|---|---|---|---|
| `verein_team_anlegen(p_verein, p_name)` | authenticated | `ist_verein_verwaltung` | Ersetzt `create_team(text)`, das entfällt (drop). Vereinssperre, `teamname_vergeben` → `{status: 'abgewiesen', grund: 'name_vergeben', team}` (AK 20, 21), Grenze 30 im Trigger `teams_vorher` (`VEREIN_TEAMS_VOLL`, AK 18). **Keine** Mitgliedschaft (AK 17); niemand verliert das Team aus dem Blick, weil `verein_ansicht` es der Verwaltung zeigt. |
| `verein_team_umbenennen(p_team, p_name)` | authenticated | `ist_verein_verwaltung(verein des Teams)` | Ersetzt das direkte UPDATE (W`lib/actions/teams.ts:55-56`). Vereinssperre, `teamname_vergeben(…, p_ausser = p_team)`; eine andere Schreibweise des eigenen Namens geht durch (AK 22). |
| `verein_team_aufloesen(p_team, p_teamname)` | authenticated | `ist_verein_verwaltung(verein des Teams)` | Ersetzt `loese_team_auf` (drop). Rumpf wie `20261024100000_team_aufloesen_namensbestaetigung.sql:142-177` mit Namensprüfung (AK 24). Rückgabe zusätzlich `spieler_bleiben`. Spieler:innen bleiben im Verein (PC 1), Schnuppern im Team endet (§3.3 f). |
| `verein_team_ansicht(p_team)` | authenticated | `ist_verein_verwaltung(verein des Teams)` | Name, Trainer:innen mit E-Mail, `spieler_zahl`, die Spielerliste des Teams `[{id, vorname, nachname, jahrgang, schnuppert, teams[]}]` (für die Bestätigung beim Herausnehmen: Schnupper-Ende und «danach kein Team mehr», Story 3 AK 17, Story 8 AK 13) und die **Auflösungszahlen** (Trainings, Termine, Spiele, Kader) ohne Mitgliedschaft (AK 25). Ersetzt für die Auflösung `getTeamAufloesungsInfo` (W`lib/queries/teams.ts:86-111`), das mit dem Nutzer-Client zählt und für Nicht-Mitglieder 0 liefern würde. |
| `verein_finde_person(p_verein, p_email, p_team uuid default null)` | authenticated | `ist_verein_verwaltung` (bei `p_team` dessen Verein) | Vorschau wie `finde_trainer`: gleiche Bremse `such_bremse_aktiv` (AK 13), Status `gefunden` + `anzeige_name`, `nicht_gefunden`, `gebremst`, `bereits_mitglied` (Team) bzw. `bereits_verwaltung`, `anderer_verein` ohne Vereinsnamen und ohne Anzeigenamen (Story 11 AK 8). **Zählregel der Bremse** (gilt auch für `finde_trainer`): Als erfolgloser Versuch zählen `nicht_gefunden` und `anderer_verein`, weil beide nichts aufnehmen lassen und `anderer_verein` sonst ungebremst verriete, wer einem Verein angehört. `gefunden`, `bereits_mitglied` und `bereits_verwaltung` zählen nicht, wie heute. |
| `verein_team_aufnehmen(p_team, p_email)` | authenticated | `ist_verein_verwaltung(verein des Teams)` | wie `add_team_member`, sofort. Vereinssperre, Personensperre, `person_verein(ziel)` ∉ {null, Verein} → `anderer_verein`; Trigger ist Netz (`ANDERER_VEREIN`). |
| `verein_team_beitreten(p_team)` | authenticated | `ist_verein_verwaltung(verein des Teams)` | Selbstaufnahme mit einer Aktion (AK 12), ohne Bremse, `on conflict do nothing` |
| `verein_team_mitglied_entfernen(p_team, p_user)` | authenticated | `ist_verein_verwaltung(verein des Teams)` | entfernt jede Trainer:in (AK 14). Das Team bleibt, auch ohne Mitglied (PC 3). |
| `verein_verwaltung_aufnehmen(p_verein, p_email)` | authenticated | `ist_verein_verwaltung` | sofort, ohne Annahme (AK 30); Vorschau über `verein_finde_person`. Vereinssperre, Personensperre, `anderer_verein`. Keine Obergrenze (Story 5 OoS 4). |
| `verein_verwaltung_entfernen(p_verein, p_user)` | authenticated | `ist_verein_verwaltung` (auch sich selbst = austreten, AK 31, 32) | Vereinssperre. Letzte Person → `{status: 'letzte_verwaltung', einzige_person}` (AK 33, 34; Story 11 AK 13: auch als einzige Person kein Austritt, nur Hinweis auf «Verein löschen»). Trigger `verwaltung_vorher` ist Netz (`LETZTE_VERWALTUNG`). Team-Mitgliedschaften bleiben (PC 4). |

**Spielerbestand am Verein-Ort (Story 3, 4, 6, 8, 9)**

| RPC | Grant | Erste Prüfung | Wirkung |
|---|---|---|---|
| `verein_spielerliste(p_verein, p_suche text default null, p_teams uuid[] default null, p_ohne_team boolean default false, p_jahrgaenge int[] default null)` | authenticated | `ist_verein_mitglied` | Alle Spieler:innen des Vereins (auch schnuppernd und ohne Team) mit `id, vorname, nachname, jahrgang, teams[]`, geordnet nach Vorname, dann Nachname (Story 4 AK 1). `js` **nur** bei `ist_verein_verwaltung` (Story 4 AK 3, Story 6 AK 1); ein Mitglied ohne Verwaltung erhält auch für eigene Teams nur Name, Jahrgang und Teams. Suche `lower(unaccent(vorname ‖ ' ' ‖ nachname)) like '%' ‖ lower(unaccent(p_suche)) ‖ '%'` wie bei den Übungen (AK 6). Innerhalb einer Eingrenzung disjunktiv (eines der gewählten Teams oder ohne Team, einer der gewählten Jahrgänge), zwischen Suche und Eingrenzungen konjunktiv; `teams[]` immer vollständig (AK 7–9). Immer serverseitig über den ganzen Verein, bis 1000 ohne Seitenschnitt (AK 10); Rückgabe `jsonb` (Array), damit `max_rows` nichts kappt, auch nicht bei Bestand über 1000. Altdubletten als getrennte Zeilen (PC 2). |
| `verein_spieler_anlegen(p_verein, p_vorname, p_nachname, p_jahrgang, p_js)` | authenticated | `ist_verein_verwaltung` | Spieler:in ohne Team (Story 6 AK 3). Vereinssperre, **zuerst** `spieler_doppelt` → `{grund: 'doppelt', teams, ohne_team}` (AK 4), danach Grenze 1000 im Trigger (`VEREIN_VOLL`, AK 7). |
| `verein_spieler_aendern(p_spieler, …)` | authenticated | `ist_verein_verwaltung(spieler.verein_id)` | Vereinssperre, Zeile `for update`; weg → `SPIELER_NICHT_GEFUNDEN` (AK 15). Schlüssel geändert und `spieler_doppelt(…, p_ausser = p_spieler)` trifft → `doppelt` mit Teams (AK 5). Gleicher Schlüssel geht immer, auch bei Altdubletten (Story 2 AK 7). |
| `verein_spieler_entfernen(p_spieler)` | authenticated | `ist_verein_verwaltung(spieler.verein_id)` | immer erlaubt, auch ohne Team (AK 12). Einziger Weg, eine Spieler:in aus dem Verein zu löschen; am Team-Ort und per KI gibt es keinen (Story 3 AK 12, Story 13 AK 5). Vereinssperre, alle Teams sortiert sperren, Zeile `for update`, **danach** Delete (§4.1, löschende RPCs). |
| `verein_spieler_teams(p_spieler)` | authenticated | `ist_verein_verwaltung(spieler.verein_id)` | `{teams[], abholbar}` für Lösch-, Link- und Erneuern-Dialoge (Story 6 AK 10, 13; Story 7 AK 16). `abholbar` = ein Team der Spieler:in hat die Selbstabholung eingeschaltet. |
| `verein_spieler_link_holen(p_spieler)`, `verein_spieler_link_erneuern(p_spieler)` | authenticated | `ist_verein_verwaltung(spieler.verein_id)` | Kern wie `spieler_link_holen`/`spieler_link_erneuern`, auch ohne Team (AK 9, 11) |
| `verein_spieler_zuordnen(p_team, p_spieler uuid[], p_schnuppern boolean default false)` | authenticated | `ist_verein_verwaltung(verein des Teams)` und jede Spieler:in im selben Verein, sonst `SPIELER_NICHT_GEFUNDEN` | Einzeln und gesammelt in einem Einstieg (Story 3 AK 2, 20). Vereinssperre, Teamsperre. **Ganz oder gar nicht** (AK 21): zuerst alle Konflikte sammeln — `bereits` (schon im Team), `gleich` (gleicher Schlüssel im Team), `schnuppert` (`{spieler, team}`, Story 8 AK 12) —, danach `ueber_grenze` = `bestand + anzahl − 100` (AK 7, 22). Gibt es irgendeinen Konflikt, Rückgabe `{status: 'abgewiesen', …}` ohne Insert. Sonst `spielerzahl_freigeben`, Insert `team_spieler`; der Trigger (§3.3) ist Netz für Grenze und Eindeutigkeit (AK 8). `p_schnuppern`: nur mit genau einer Spieler:in (`SCHNUPPERN_NUR_EINZELN`, Story 8 OoS 6), die keinem Team zugeordnet ist (`{grund: 'schnuppern_hat_team'}`, AK 9) und nur bei festgelegter Anzahl im Team (`{grund: 'schnuppern_anzahl_fehlt'}`, AK 10); setzt `probe_seit = now()` (AK 11). Kein Kader (Story 3 PC 1). |
| `verein_spieler_aus_team_nehmen(p_team, p_spieler)` | authenticated | `ist_verein_verwaltung(verein des Teams)` und `spieler_im_team`, sonst `SPIELER_NICHT_GEFUNDEN` | Kern wie am Team-Ort (unten). Rückgabe `{ohne_team, schnuppern_beendet}` (Story 3 AK 17, Story 8 AK 13). |
| `verein_spieler_importieren(p_verein, p_zeilen jsonb, p_erwartet jsonb default null)` | authenticated | `ist_verein_verwaltung` | §7.9. Ersetzt `spieler_importieren(uuid, jsonb, jsonb)`, das entfällt (drop; Story 9 AK 12 auch für die Verwaltung). Zeilendeckel 1000 → `IMPORT_ZU_GROSS`. Ohne `p_erwartet` Vorschau: je Zeile `neu`, `bestehend` (genau ein Treffer im Verein; `js_aendert` und `teams[]`) oder `mehrfach` (mehrere Altdubletten-Treffer mit Teams, ändert nie J+S und zählt nicht als Änderung, AK 5); dazu `bestand` und `ueber_grenze` = Bestand + neu − 1000 nur bei `neu > 0` (AK 6, 7). Mit `p_erwartet` (enthält auch `bestand` der Vorschau): Vereinssperre, Vorschau neu rechnen; weicht sie ab oder ist die Vereinsgrenze seit der Vorschau erreicht → `{status: 'veraltet', vorschau, hinweis}` ohne Änderung, nicht der Marker `VEREIN_VOLL` (AK 9). Sonst in einer Transaktion Inserts ohne Team und J+S-Änderungen (PC 1–4). Keine Teamgrenze, kein `spielerzahl_freigeben` (AK 8, PC 5). |

Ein eigenes «verschieben» gibt es nicht: Zuordnen und danach Herausnehmen. Scheitert der zweite Schritt, steht die Spieler:in in beiden Teams, und nichts geht verloren.

**Spieler:innen am Team-Ort (Story 3, 7, 13)**

| RPC | Grant | Erste Prüfung | Wirkung |
|---|---|---|---|
| `spieler_weitere_teams(p_team)` | authenticated | `ist_team_mitglied(p_team)` | je Spieler:in des Teams die Namen ihrer **weiteren** Teams (Story 3 AK 9, Story 13 AK 2) |
| `spieler_teams(p_team, p_spieler)` | authenticated | `ist_team_mitglied(p_team)` und `spieler_im_team`, sonst `SPIELER_NICHT_GEFUNDEN` | `{teams: [{name, eigen}], abholbar, schnuppert, stand}` für Herausnehm-, Link- und Erneuern-Dialoge und die KI-Auskunft vor der Bestätigung (Story 3 AK 13, 16; Story 7 AK 13, 15, 16; Story 13 AK 4, 9). `stand` ist ein Wert über **alle** Teams der Spieler:in ohne IDs (Hash über die sortierten Team-IDs); so gehen keine fremden Team-IDs an Web oder KI (Story 13 AK 6). `alle_eigen` der Vorfassung entfällt, weil Mitglieder nicht mehr löschen. Ersetzt `spieler_link_folgen` der Vorfassung. |
| `spieler_aus_team_nehmen(p_team, p_spieler, p_stand text)` | authenticated | `ist_team_mitglied(p_team)` **und** `spieler_im_team`, sonst `SPIELER_NICHT_GEFUNDEN` (dieselbe Auskunft wie bei einer unbekannten Spieler:in, Story 13 AK 7) | Einziger Schreibweg des Mitglieds, eine Spieler:in loszuwerden; es löscht nie (Story 3 AK 12). **`p_stand` ist Pflicht** (kein Default): Am Team-Ort geht Herausnehmen nur nach der Auskunft, für Web-Dialog und KI gleich; null → `{status: 'stand_geaendert', teams, stand}` ohne Änderung. Ablauf: Teamsperre `p_team`, dann die `spieler`-Zeile `for update`, **dann** `p_stand` mit dem aktuellen `stand` (wie in `spieler_teams`) vergleichen; weicht er ab → `{status: 'stand_geaendert', teams, stand}` ohne Änderung (Story 13 AK 6). Ein gleichzeitiges Zuordnen hält dieselbe Zeile und kommt so ganz vor oder ganz nach dem Vergleich (§3.3 d). Sonst Delete `team_spieler`; die Folgen (künftige Meldungen und Kader verfallen, Schnuppern endet, begonnene Termine bleiben mit Namen) tragen die Trigger (§3.3, §4.4). Rückgabe `{ohne_team, letztes_eigenes_team, schnuppern_beendet}` (Story 3 AK 16, Story 13 AK 4). Keine Verfallszahl (Story 3 OoS 4). |

### 4.4 Geänderte RPCs und Funktionen

**Mengen über `team_spieler`, ohne Verhaltensänderung** (Rumpf sonst gleich; Stand der neuesten Fassungen bis Release 1.46.0, umgesetzt in `20261113110000_spieler_ueber_zuordnung.sql`; die Stellen aus `spiel_meldungen.sql` sind überholte Fassungen):
- **Mengen `s.team_id = t.team_id` → `team_spieler`:**
  - spielerliste: `serie_spielerzahl_regel`, `termin_spielerzahl_regel` (`spielstand` ist nur noch Hülle um `spielstand_training` und `spiel_stand`)
  - spiel_aufgebot: `spiel_einfrieren`, `spiele_einfrieren`, `spiel_pruefen`
  - spiel_nachtrag: `spiel_teilnehmer`, `spiel_anwesenheit_setzen`
  - meldestand: `spielstand_training`, `termin_einfrieren_training`, `termine_einfrieren_training`, `training_meldestand`, `abmeldung_anwenden_training`
  - probetraining: `spiel_stand`, `team_probe_staende`
  - weitere: `abholung_abholen` (`selbstabholung.sql:154`), `termin_anwesenheit_setzen_training`, `kader_zuteilung_aendern` (`kader.sql:203`)
  - Ohne `spieler.team_id`, an der Menge nichts zu ändern: `termin_abmeldungen_verfallend`, `termin_anmeldungen_verfallend`, `termin_abmeldung_setzen`, `termin_teilnehmer` (sie lesen nur `probe_seit`, §3.2), `kader_bereinigen_training`, `spiel_kader_bereinigen`, `kader_entfernen_folgen` (dort ist `s` die Serie)
- **Prüfungen `exists(spieler where id = p and team_id = t)` → `spieler_im_team(p, t)`:**
  - `abmeldung_anwenden_training` (`meldestand.sql:213`)
  - `spiel_pruefen` (`spiel_aufgebot.sql:210`)
  - `kader_zuteilung_aendern` (`kader.sql:207`)
- **Nachtragen an begonnenen Terminen, ausdrücklich nicht auf `spieler_im_team` umstellen** (Story 3 AK 18, PC 5): `termin_anwesenheit_setzen_training` (`nachtrag_anwesenheit.sql:59`) und `spiel_anwesenheit_setzen` (`spiel_nachtrag.sql:62`) prüfen heute `spieler.team_id`. Weil Nachtragen nur an begonnenen, also festgehaltenen Terminen geht, prüfen sie künftig den **festgehaltenen Stand des Termins**: `spieler_im_team(p, t) or exists(termin_teilnahmen where termin_id = p_termin and spieler_id = p)` bzw. `spiel_teilnahmen` (Begründung des ersten Teils §3.2). Eine herausgenommene Spieler:in bleibt so nachtrag- und korrigierbar, eine erst nach Beginn zugeordnete kommt nicht dazu (PC 8).
- **Rückschreiben beim Verlegen:** `termin_zeitpunkt_nachher` (`meldestand.sql:262-272`) und `spiel_zeitpunkt_nachher` (`spiel_aufgebot.sql:80-104`) filtern auf `spieler_im_team(p.spieler_id, new.team_id)`. Herausgenommene fallen so weg wie heute Ehemalige, statt das Verlegen mit 23503 abzubrechen.
- **`termin_teilnehmer` und `spiel_teilnehmer` werden DEFINER** (heute INVOKER, `probetraining.sql:533`), per drop + create mit neuem Grant, **in Story 3** (`<ts>_vereine_bestand.sql`; Vorbild `probetraining.sql:532-560`, `spiel_nachtrag.sql:161-162`):
  - erste Bedingung `ist_team_mitglied(Termin-Team)`
  - Namen aus `spieler`, solange die Spieler:in besteht (Story 3 PC 5)
  - additiv `nicht_mehr_im_team boolean`; `ehemalig` bleibt `spieler_id is null` (PC 11)
- **Pflicht-Inventar:** eine Liste, in §5.5.

**Fachlich geändert**

| RPC | Story | Änderung (Quelle heute) |
|---|---|---|
| `create_team(text)` | 1, 5 | entfällt (drop), ersetzt durch `verein_team_anlegen` (§4.3). Ab dem Release legt am Team-Ort niemand mehr ein Team an (Story 1 AK 4). Quelle `20260824200312_team_rpcs.sql:9-27`. |
| `loese_team_auf(p_team, p_teamname)` | 5 | entfällt (drop), ersetzt durch `verein_team_aufloesen`. Am Team-Ort kein Auflösen und kein Umbenennen mehr (AK 27). |
| `entferne_team_mitglied(p_team, p_user)` | 5 | drop `(uuid, uuid, text)` + create ohne `p_teamname`. Erste Prüfung `ist_team_mitglied(p_team)` (jedes Mitglied entfernt jedes Mitglied, auch eines aus der Verwaltung, AK 16) oder `p_user = auth.uid()`. Kein `aufloesung_noetig`: das letzte Mitglied geht ohne Teamnamen, das Team bleibt (AK 28). Quelle `20261024100000_team_aufloesen_namensbestaetigung.sql:73-134`. |
| `team_aufloesen_wenn_leer` | 5 | Trigger und Funktion entfallen (`20260824195749_team_datenmodell.sql:282-295`). Ein Team ohne Mitglied bleibt (PC 3); die Verwaltung sieht es über `verein_ansicht` (`ohne_mitglied`). |
| `finde_trainer`, `add_team_member` | 5, 11 | Prüfung bleibt Mitgliedschaft (`team_rpcs.sql:92`, `:124`). Neu: Personensperre (über den Invarianten-Trigger) und Status `anderer_verein` ohne Vereinsnamen (Story 11 AK 8); `anderer_verein` zählt für die Bremse als erfolgloser Versuch (Zählregel bei `verein_finde_person`, §4.3). Nur bestätigte Konten wie heute (`trainer_per_email`). |
| `team_mitglieder` | 5 | Prüfung unverändert (`20261014120000_team_mitglieder_email.sql:29`), Rückgabe additiv `ist_verwaltung` je Mitglied (AK 15). E-Mail weiterhin nur für das eigene Team. |
| `delete_account` | 1, 11 | Ablauf und Code **nur in §3.4** (eine Fassung). Story 1: drop `delete_account()` + create `delete_account()` mit Rückgabe `jsonb` (heute `void`): `{status: 'letzte_verwaltung'}` oder `{status: 'geloescht'}` (`bilder` erst mit Story 11, wenn `verein_loeschen_kern` dazukommt); die Action zeigt ihn ab Story 1 (W`lib/actions/auth.ts:215-216` verschluckt heute Fehler). Story 11: drop + create `delete_account(p_vereinsname text default null)` mit dem Zweig der einzigen Person (`verein_bestaetigen`, `vereinsname_falsch`, `verein_loeschen_kern`; Story 11 AK 12, 14). Teams, deren letztes Mitglied die Person ist, bleiben (Story 5 AK 29). Rückgabe `{status: 'geloescht', bilder}`. Quelle `20261025100000_trainer_einladen.sql:812-844`. |
| `spieler_aufnehmen(p_team, …)` | 1, 2 | Prüfung `ist_team_mitglied(p_team)` wie heute. **Vereinssperre zuerst**, dann Team (heute Team zuerst, `spielerliste.sql:315`). Dann `spieler_doppelt` **vor** den Grenzen (Story 2 AK 9): Treffer → `{status: 'abgewiesen', grund: 'doppelt', eigenes_team, teams, ohne_team}` (AK 3, 4; Story 3 AK 19). Danach Insert, Grenzen 100/1000 aus den Triggern mit getrennten Markern (Story 1 AK 6, 7). `spielerzahl_freigeben` statt Inline-Code (`:316-322`). Rückgabe von `raise 'SPIELER_DOPPELT'` (`:328`) auf `jsonb`-Status umgestellt. |
| `spieler_aendern(p_team, p_spieler, …)` | 2 | drop + create mit `p_team` und Rückgabe `jsonb` (heute `void`, `spielerliste.sql:335-351`). Prüfung `ist_team_mitglied(p_team)` und `spieler_im_team`, sonst `SPIELER_NICHT_GEFUNDEN`. Vereinssperre, Zeile `for update`, Schlüssel geändert und Treffer im Verein → `doppelt` mit Teams wie bei `spieler_aufnehmen` (AK 5, 6). Gleicher Schlüssel immer erlaubt (AK 7). Erfolg: `{status: 'geaendert'}`. |
| `spieler_entfernen(p_spieler)` | 3, 13 | **entfällt** (drop `(uuid)`, ohne Nachfolger am Team-Ort; PO 01.11.2026). Mitglieder löschen keine Spieler:innen aus dem Verein, auch nicht, wenn alle Teams eigene sind (Story 3 AK 12, OoS 5); auch wer der Verwaltung angehört, löscht am Team-Ort nicht (Rollen nach Ort). Am Team-Ort bleibt nur `spieler_aus_team_nehmen` (§4.3), am Verein-Ort löscht `verein_spieler_entfernen`. Quelle heute `spielerliste.sql:357-376`; das MCP-Werkzeug gleichen Namens entfällt ebenso (§7.10, Story 13 AK 5). |
| `spieler_link_holen(p_team, p_spieler)`, `spieler_link_erneuern(p_team, p_spieler)` | 3, 7 | drop + create mit `p_team`. Prüfung `ist_team_mitglied(p_team)` und `spieler_im_team` statt `ist_team_mitglied(spieler.team_id)` (`spieler_link.sql`, `selbstabholung.sql:30`). Das Erneuern setzt den Bezug für alle Teams zurück (Story 7 PC 4, die Markierung liegt an der Spieler:in). |
| `probe_stand(p_spieler)` | 8 | Signatur und INVOKER bleiben. Das Team kommt aus der **einzigen** Zuordnung statt aus `s.team_id` (`probetraining.sql:114-140`); Kontingent und Zählung bleiben je Team (Story 8 AK 5, PO 9). Die vereinsweite Zählung der Vorfassung (E4 b) und ihre DEFINER-Begründung entfallen. |
| `team_probe_staende(p_team)` | 8 | `s.team_id = p_team` → `team_spieler` (`:142-151`) |
| `spieler_probe_folgen(p_team, p_spieler)` | 8 | drop + create mit `p_team`. Prüfung `ist_team_mitglied(p_team)` und `spieler_im_team` statt `ist_team_mitglied(spieler.team_id)` (`:156-175`) |
| `spieler_probe_setzen(p_team, p_spieler, p_probe, p_bestaetigt)` | 8 | drop `(uuid, boolean, integer)` + create mit `p_team` (`:182-237`). Prüfung `ist_team_mitglied(p_team)` und `spieler_im_team`. Vereinssperre, Teammenge lesen; beim Einschalten eine weitere Zuordnung neben `p_team` → `SCHNUPPERN_MEHRERE_TEAMS` (AK 5, 6; gleicher Marker für die KI, AK 15). Dann Teamsperre `p_team`, festhalten, Zeile. `PROBE_ANZAHL_FEHLT` und `spiel_kader_bereinigen` über `p_team`. Gleichzeitiges Einschalten und Zuordnen serialisieren auf der Vereinssperre (AK 14). |
| `team_spieler_nachher` (Trigger, §3.3) | 8 | Setzt kein `probe_seit` auf null: `probe_seit` liegt auf `team_spieler` und verschwindet beim Herausnehmen und beim Auflösen mit der Zuordnung (Story 8 PC 1, Zählung ab null bei erneutem Schnuppern, PC 2; §3.3 f). |
| `team_spieler_vorher` (Trigger, §3.3) | 8 | INSERT einer Spieler:in mit `probe_seit is not null` → `SPIELER_SCHNUPPERT` (Netz zu Story 8 AK 12; die RPC antwortet vorher mit Auskunft). Invariante: `probe_seit is not null` ⇒ genau eine Zuordnung. |
| `spieler_link_abmelden`, `spieler_link_melden` | 7, 8 | Zuerst den Termin lesen und das **Termin-Team** sperren statt `s.team_id` (`probetraining.sql:285-289`, `spiel_meldungen.sql`), **danach** unter dieser Sperre `spieler_im_team(s.id, t.team_id)` prüfen, sonst `{status: 'abgewiesen', grund: 'gilt_nicht'}` (Story 7 AK 7), und `probe_seit` lesen. Ein gleichzeitiges Herausnehmen hält dieselbe Teamsperre (`team_spieler_vorher`); so meldet niemand für eine schon herausgenommene Spieler:in. Meldeweise, Frist und Kader folgen dem Termin-Team (AK 6). |
| `spieler_link_ansicht`, `spieler_abo_termine` | 4, 7, 11 | neueste Fassung `20261031120000_treffpunkt_training.sql:774`, `:882`. Termine aller Teams über `team_spieler`, Teamname je Termin, Teamliste, Vereinsname als verantwortlich; Einzelheiten §7.7, §7.8. Weiter `anon` über das Token. |
| `abholung_abholen` | 7 | Suche über `team_spieler` des Abholteams statt `spieler.team_id = v_team` (`selbstabholung.sql:150-155`); liefert denselben Link wie jedes andere Team (AK 11) |
| `feedback_link_beginnen`, `feedback_link_zaehlen`, `feedback_link_vermerken`, `feedback_link_ablegen` | 7 | prüfen `feedback_link_gueltig` statt `feedback_link_team(p_token) is null` (`20261028110000_feedback_link.sql:39`, `:51`, `:64`, `:77`). `feedback_link_ablegen` übergibt das Team heute an `feedback_ablegen_fuer` und speichert es in `feedback`; ab Story 7 ohne Team (null), sonst bliebe `feedback_link_team` nötig. `feedback_link_team` entfällt (drop): danach hat es keinen Leser mehr und gäbe für Spieler:innen ohne Team null zurück (AK 18). Gespeichert wird weder Spieler:in noch Link noch Team (PC 6). |
| `termin_gilt_fuer` und alle anderen Leser von `probe_seit` | 1 | Signatur und Regel bleiben; `probe_seit` kommt aus `team_spieler` der Zuordnung zum Termin-Team statt aus `spieler.probe_seit` (§3.2) |

**Kontogrenzen (Story 12)**

Übungen und Trainings entstehen heute per direktem Insert über die RLS (W`lib/kern/uebungen.ts:87`, W`lib/fassung.ts:344`, W`lib/kern/training.ts:101`, W`lib/kern/kopie.ts:195`). Die Grenze sitzt deshalb nicht in den Pfaden, sondern in einem Trigger, der Anwendung und KI gleich trifft (AK 2, 3):
- `konto_grenze_vorher` BEFORE INSERT auf `exercises` (Zeilen mit `owner_id` und `source = 'user'`) und `trainings` (Zeilen mit `owner_id`), dazu BEFORE UPDATE OF `owner_id`, falls eine Zeile in persönliches Eigentum wechselt. DEFINER, weil `person_verein` fremde Tabellen liest.
- Ablauf: `sperre_person(new.owner_id)`; hat die Person einen Verein, durchlassen (PC 2: gilt sofort, auch für laufende Sitzungen und KI-Zugänge, weil die Mitgliedschaft beim Insert gelesen wird). Sonst `konto_bestand(new.owner_id)` und bei `>= 50` → `KONTO_UEBUNGEN_VOLL %`, bei `>= 30` → `KONTO_TRAININGS_VOLL %` mit dem Bestand (AK 6, 7).
- Gezählt wird nach `konto_bestand` (§3.5): eigene Übungen (`source = 'user'`) und Trainings mit `owner_id = Person`, Entwürfe und veröffentlichte, angelegte und kopierte (AK 1). Nicht gezählt: SFV-Bestand, Team-Trainings (`owner_id null`), Fassungen in `training_exercises`, Varianten (`training_varianten`), Gruppen. Das Übernehmen einer Übung in ein Training schreibt nur `training_exercises` und bleibt frei (AK 4).
- Gleichzeitige Inserts serialisieren auf der Personensperre; ein abgewiesener Insert hinterlässt nichts (AK 8). Ändern, Veröffentlichen und Löschen sind keine Inserts und bleiben möglich (PC 1).
- TS-Zwillinge `KONTO_UEBUNGEN_MAX`, `KONTO_TRAININGS_MAX` (§3.5, §3.10); die Anzeige liest `meine_vereinslage()`.

---

## 5. Konsistenzregeln

Namen von Funktionen, Triggern, Markern und Status folgen §3 und §4. Weicht ein Name dort ab, gilt §3/§4.

### 5.1 TS↔SQL-Zwillinge

| TS (W) | SQL | Hinweis |
|---|---|---|
| `lib/verein.ts` (neu): `VEREIN_NAME_MAX = 60`, `vereinsNameProblem()`, `VEREIN_SPIELER_MAX = 1000`, `VEREIN_TEAMS_MAX = 30`, `VEREIN_MELDUNG` | CHECK `verein_name` (1–60, ohne Rand-Leerzeichen), Trigger `spieler_vorher`, `teams_vorher` | Jede Konstante nennt ihren SQL-Zwilling, wie in `lib/altersstufe.ts`. Der Vereinsname ist nicht eindeutig (Story 11 PC 4), dafür gibt es also keinen Zwilling. |
| `lib/verein.ts`: `vereinsNameStimmt(eingabe, name)` | `verein_loeschen`, `delete_account(p_vereinsname)` | Vergleich nach Story 11 AK 10: Gross/Klein zählt, Leerzeichen am Rand nicht. Die SQL-Seite vergleicht `normalize(btrim(p), nfc) = normalize(name, nfc)` (Muster `team_aufloesen_namensbestaetigung.sql:166-169`); der TS-Zwilling macht dasselbe mit `String.prototype.normalize("NFC")`. |
| Teamname je Verein eindeutig: kein TS-Schlüssel | `teams_vorher` über `spieler_text_schluessel(name)` | gleiche Normalform wie bei Spieler:innen (Story 5 AK 20). Wie heute bei `SPIELER_DOPPELT` (W`lib/spieler.ts:8-9`) entscheidet allein die Datenebene. |
| `lib/spieler.ts:25`: `SPIELER_MAX` **200 → 100** | `team_spieler_vorher` | Kommentar `:17-18` nennt den neuen Zwilling. `SPIELERLISTE_VOLL` bekommt einen eigenen Text (§5.3), der nicht mehr «fasst höchstens» sagt. |
| `lib/spieler-import.ts:273-276` `importZuGross` → `v.neu.length > 0 && v.bestand + v.neu.length > VEREIN_SPIELER_MAX` | `verein_spieler_importieren` | `v.bestand` = Spielerbestand des Vereins (Story 9 AK 6, 7); keine Teamgrenze mehr (AK 8) |
| `lib/spieler-import.ts:17,26`: eigener Text für `IMPORT_ZEILEN_MAX` | Marker `IMPORT_ZU_GROSS` | heute nutzt der Zeilendeckel `SPIELERLISTE_VOLL` (`spieler_import.sql:37-38`) |
| `lib/konto-grenzen.ts` (neu, §7.2): `KONTO_UEBUNGEN_MAX = 50`, `KONTO_TRAININGS_MAX = 30`, `KONTO_MELDUNG` | Trigger `konto_grenze_vorher` auf `exercises` und `trainings`; `meine_vereinslage()`; beide über `konto_bestand` | gezählt wird `exercises.owner_id = uid and source = 'user'` bzw. `trainings.owner_id = uid`. Team-Trainings haben `owner_id null` (`team_datenmodell.sql:51-52`) und zählen nicht (Story 12 AK 1). |
| `lib/probe.ts` (Name bleibt intern, §11 F-Begriff) | `team_spieler.probe_seit`, `probe_stand`, `team_probe_staende` (§3.2, §3.3 f) | Zählung und Kontingent je Team wie heute; neu ist nur «genau ein Team» (Story 8 AK 5). Alle Texte heissen «Schnuppern» (§5.3). |
| `lib/kader.ts` `giltFuerAnzahl` | `termin_gilt_fuer` | unverändert in der Regel; liest `probe_seit` jetzt aus der Zuordnung (§3.2) |

### 5.2 Marker und Status

**Grundsatz:** Ein Marker (Exception) ist für Regeln da, die keine Nutzdaten brauchen oder höchstens eine Zahl (`KONTO_UEBUNGEN_VOLL 50`, Muster `PROBE_VERFALLEN n n n`, W`lib/probe.ts:132-137`). Abweisungen mit Teamnamen kommen als jsonb-Status der RPC, zum Beispiel `{status: 'abgewiesen', grund: 'doppelt', teams, ohne_team}` aus `spieler_aufnehmen` (§4.4). So stören Teamnamen weder die `includes`-Suche (`weitereMeldung`, W`lib/training-bedingungen.ts:376`) noch die Teilstring-Regel. Kein Marker und kein Status nennt einen anderen Verein (Epic EK 9, Story 11 AK 8).

**Neue Marker** (Liste aus §3.10 und §4), je in einer Meldungsgruppe, die in `TERMIN_MARKER` (W`lib/training-bedingungen.ts:335-348`) eingereiht wird:

| Gruppe | Marker |
|---|---|
| `VEREIN_MELDUNG` | `VEREIN_FEHLT`, `VEREIN_FEST`, `VEREIN_VOLL`, `VEREIN_TEAMS_VOLL`, `TEAM_NUR_VERWALTUNG`, `TEAMNAME_VERGEBEN` (Netz), `LETZTE_VERWALTUNG` (Netz), `ANDERER_VEREIN` (Netz), `SCHON_IM_VEREIN`, `BESTAETIGUNG_FEHLT`, `NUR_IN_DER_ANWENDUNG` |
| `SPIELER_MELDUNG` (erweitert) | `SCHON_ZUGEORDNET`, `IMPORT_ZU_GROSS`; bestehend `SPIELER_DOPPELT` (Netz aus `spieler_vorher`), `SPIELERLISTE_VOLL` |
| `PROBE_MELDUNG` (Texte «Schnuppern») | `SPIELER_SCHNUPPERT`, `SCHNUPPERN_MEHRERE_TEAMS`, `SCHNUPPERN_NUR_EINZELN`; bestehend `PROBE_ANZAHL_FEHLT` (nur `spieler_probe_setzen`) |
| `KONTO_MELDUNG` (W`lib/konto-grenzen.ts`) | `KONTO_UEBUNGEN_VOLL`, `KONTO_TRAININGS_VOLL` |

- Beim Gründen heisst der Marker für «Person gehört schon einem Verein an» `SCHON_IM_VEREIN`. Einen ungültigen Vereinsnamen meldet der CHECK `verein_name`; einen eigenen Marker dafür gibt es nicht. Der CHECK-Name `"verein_name"` steht in einer `VEREIN_CHECKS`-Liste (Muster `TERMIN_CHECKS`, `:356-371`).
- **Teamname und Doppelerfassung** antworten aus der RPC mit dem jsonb-Status (`grund: 'name_vergeben'` mit dem Team bzw. `grund: 'doppelt'` mit den Teams, §4.3, §4.4). `TEAMNAME_VERGEBEN` (Trigger `teams_vorher`) und `SPIELER_DOPPELT` (Trigger `spieler_vorher`) bleiben nur als Netz für das Rennen, mit demselben Text ohne Namen.
- `SPIELERLISTE_VOLL` (Team, 100) und `VEREIN_VOLL` (Verein, 1000) bleiben getrennt; Story 1 AK 7 verlangt die Unterscheidung.
- `KONTO_*_VOLL` laufen über `fachlicheMeldung` (W`lib/training-bedingungen.ts:413-421`). Die Kette bedient auch Übungs- und Trainings-Actions und das MCP, damit gilt Story 12 AK 7 für App und KI aus einer Quelle.
- **Entfallen** gegenüber dem Plan vom 29.10.: `VEREIN_ANGEBEN` (höchstens ein Verein je Person), `VERWALTUNG_VOLL` (unbegrenzt), `EINLADUNGEN_VOLL`, `KEIN_GRUENDUNGSRECHT`, `MEHRERE_TEAMS`. Auch der Status `grund: 'fremde_teams'`, der `MEHRERE_TEAMS` ersetzt hatte, entfällt: Mitglieder löschen nicht mehr (PO 01.11.2026).
- **Teilstring-Regel** (`check:kern`, Kommentar W`lib/training-bedingungen.ts:331-334`): Kein neuer Marker steckt in einem anderen. Geprüft sind die heiklen Paare `VEREIN_VOLL`/`VEREIN_TEAMS_VOLL`, `SPIELER_SCHNUPPERT`/`SCHNUPPERN_*`, `TEAM_NUR_VERWALTUNG`/`LETZTE_VERWALTUNG` und `SCHON_ZUGEORDNET`/`SCHON_IM_VEREIN`. Ein blankes `MEHRERE_TEAMS` steckte in `SCHNUPPERN_MEHRERE_TEAMS`; deshalb gibt es keins. Gegen den Bestand prüft der bestehende Test.

**Status ohne Marker** (jsonb-Rückgaben, §4): `abgewiesen` mit `grund` ∈ {`doppelt`, `name_vergeben`, `bereits`, `gleich`, `schnuppert`, `ueber_grenze`, `schnuppern_hat_team`, `schnuppern_anzahl_fehlt`}; `stand_geaendert` (Recheck beim Herausnehmen, Story 13 AK 6); `veraltet` (Import-Vorschau überholt, Story 9 AK 9); `vereinsname_falsch`; `anderer_verein`; `letzte_verwaltung` und `verein_bestaetigen` (`delete_account`); `bereits_mitglied`, `bereits_verwaltung`, `gefunden`, `nicht_gefunden`, `gebremst` (Vorschau wie `finde_trainer`); `entfernt` (letztes Mitglied geht, Team bleibt); `geloescht`; `geaendert` (`spieler_aendern`, Story 2). Trigger-Marker und RPC-Status mit gleicher Bedeutung (`ANDERER_VEREIN`/`anderer_verein`, `LETZTE_VERWALTUNG`/`letzte_verwaltung`) haben in TS **einen** Text.

### 5.3 Texte (Auszug)

Massgeblich ist der Wortlaut in der jeweiligen Meldungsgruppe. Er gilt in App und KI gleich (Story 2 AK 10, Story 8 AK 15, Story 12 AK 7).

- `SPIELERLISTE_VOLL`: «Das Team hat schon 100 Spieler:innen. Weitere kommen erst dazu, wenn es weniger sind.» Das passt auch bei Bestand über 100 (Story 1 PC 2).
- `VEREIN_VOLL`: «Der Verein hat schon 1000 Spieler:innen. Weitere kommen erst dazu, wenn es weniger sind.»
- `VEREIN_TEAMS_VOLL`: «Der Verein hat schon 30 Teams. Ein weiteres kommt erst dazu, wenn es weniger sind.»
- `TEAM_NUR_VERWALTUNG`: «Neue Teams legt die Vereinsverwaltung an.» Ein Konto ohne Verein sieht stattdessen den Hinweis aus Story 11 AK 5. Das entscheidet die App nach `meine_vereinslage()`, nicht nach dem Marker.
- `grund: 'name_vergeben'` (Trigger-Netz `TEAMNAME_VERGEBEN`, gleicher Text): «Im Verein trägt schon das Team «‹Name›» diesen Namen.» Den Namen liefert der Status (Story 5 AK 21).
- `ANDERER_VEREIN` / `anderer_verein` (einziger Wortlaut, auch in §7.5; Story 11 AK 8, ohne Vereinsnamen): «Diese Person gehört schon einem Verein an. Aufnehmen lässt sie sich erst, wenn sie ihn verlassen hat.»
- `SCHON_IM_VEREIN`: «Du gehörst schon einem Verein an. Einen Verein gründen kann nur, wer keinem angehört.»
- `BESTAETIGUNG_FEHLT`: «Bestätige zuerst, dass du für den Verein handeln darfst und der Verein für die Daten seiner Spieler:innen verantwortlich ist.»
- `LETZTE_VERWALTUNG` / `letzte_verwaltung`: «Du bist das letzte Mitglied der Vereinsverwaltung. Nimm zuerst eine weitere Person in die Verwaltung auf. Du kannst den Verein auch im Bereich «Verein» löschen.» (Story 5 AK 34, Story 11 AK 13)
- `vereinsname_falsch`: «Der Name stimmt nicht mit dem Vereinsnamen überein. Verein und Konto bleiben unverändert.» Gehört dem Verein inzwischen eine weitere Person an, antwortet `delete_account` mit `letzte_verwaltung` (Story 11 AK 14).
- `abgewiesen`/`doppelt` mit Teams: «‹Vorname Nachname› (‹Jahrgang›) wird im Verein schon im Team «A» und «B» geführt. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.» Ohne Team: «… wird im Verein schon geführt, ist aber keinem Team zugeordnet. …» Im eigenen Team gilt der bisherige Text von `SPIELER_DOPPELT` (Story 2 AK 3). Name und Jahrgang sind die eingegebenen, bereinigt wie beim Speichern; Teams nach Namen («im Team «A»», «im Team «A», «B» und «C»»). Beim **Ändern** (Story 2 AK 6, PO 13.11.2026): «Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, im Team «A» und «B».»; steht die andere im eigenen Team, der Text von `SPIELER_DOPPELT`. Die Verwaltung bekommt den Schluss aus Story 6 AK 4. Nie J+S oder Link (Story 2 PC 3).
- Bestätigung «Aus dem Team nehmen» am Team-Ort (kein Marker, Text der Bestätigung in App und KI): «‹Vorname Nachname› wird dadurch nicht gelöscht und bleibt samt privatem Link im Verein. Aus dem Verein löscht sie nur die Vereinsverwaltung.» Beim letzten Team zusätzlich: «Danach ist sie keinem Team mehr zugeordnet; nur noch die Vereinsverwaltung ändert sie, ordnet sie einem Team zu oder löscht sie.» (Story 3 AK 13, 14, 16; Story 13 AK 4)
- `SCHNUPPERN_MEHRERE_TEAMS`: «Diese Spieler:in ist weiteren Teams zugeordnet und macht darum regulär in deinem Team mit.» (Story 8 AK 6)
- `SPIELER_SCHNUPPERT` bzw. `grund: 'schnuppert'`: «Diese Spieler:in schnuppert im Team «‹Name›». Dort beendet zuerst ein Mitglied das Schnuppern, oder sie wird aus dem Team genommen.» (Story 8 AK 12)
- `grund: 'schnuppern_hat_team'`: «Diese Spieler:in ist schon einem Team zugeordnet. Ordne sie ohne Schnuppern zu.» (Story 8 AK 9)
- `grund: 'schnuppern_anzahl_fehlt'` beim Zuordnen: «Das Team hat noch keine Anzahl Schnuppertrainings. Ein Mitglied des Teams legt sie zuerst fest.» (Story 8 AK 10)
- `KONTO_UEBUNGEN_VOLL`: «Du besitzt ‹n› von 50 Übungen. Lösche in der App eine Übung, um wieder Platz zu schaffen. In einem Verein gilt diese Grenze nicht.» Über die KI zusätzlich «Es ist nichts entstanden.», ohne Aufforderung zum Wiederholen (Story 12 AK 6, 7). `KONTO_TRAININGS_VOLL` lautet gleich, mit 30 Trainings.
- `IMPORT_ZU_GROSS`: «Eine Datei darf höchstens 1000 Zeilen haben.»
- `NUR_IN_DER_ANWENDUNG`: «Das geht nur in der Anwendung, nicht über einen KI-Assistenten.» Erscheint nur, wenn ein KI-Token eine Vereins-RPC direkt aufruft; kein Werkzeug tut das.

### 5.4 Trigger-Übersicht

Alle Trigger gehen mit dem einen Release nach Prod. Die Spalte «Story» nennt die Story, mit der der Trigger auf `develop` kommt. Was nur bis zum Nachlauf N1 lebt, steht unter «Fällt weg».

| Trigger | Tabelle | Story | Fällt weg |
|---|---|---|---|
| `teams_vorher` (`VEREIN_FEHLT`, Grenze 30, Teamname je Verein), `teams_verein_fest` | `teams` | 1, 5 | – |
| `team_members_vorher` (Personensperre, `ANDERER_VEREIN`) | `team_members` | 1 (Invariante), 11 | – |
| `verwaltung_vorher` (`ANDERER_VEREIN`, `LETZTE_VERWALTUNG`) | `verein_verwaltung` | 1 | – |
| `spieler_vorher` neu gefasst (`VEREIN_FEHLT`, Schlüssel je Verein vor Grenze 1000; ab Story 2 auch bei Schlüsseländerung) | `spieler` | 1, 2 | – (`VEREIN_FEHLT`-Zweig mit N1) |
| `team_spieler_vorher`, `team_spieler_nachher` | `team_spieler` | 1, 3 | – |
| `team_spieler_probe_vorher` (`SCHNUPPERN_MEHRERE_TEAMS`; INSERT mit `probe_seit`, UPDATE OF `probe_seit`) | `team_spieler` | 8 | – |
| `konto_grenze_vorher` (BEFORE INSERT, dazu UPDATE OF `owner_id`) | `exercises`, `trainings` | 12 | – |
| `team_aufloesen_wenn_leer` | `team_members` | – | Story 5 (`team_datenmodell.sql:282-295`) |
| `spieler_team_fest` | `spieler` | – | Story 3 (`team_id` wird nullable, §3.7) |

- **Personensperre** `sperre_person(uid)` serialisiert alles, was die Vereinszugehörigkeit einer Person liest oder ändert: Aufnahme ins Team oder in die Verwaltung, Gründen, Konto löschen und die Kontogrenzen. Verein löschen braucht sie nicht (§4.1). So gelten Story 11 AK 9 (nie zwei Vereine) sowie Story 12 AK 8 und PC 2 (die Grenze fällt im Moment der Aufnahme) ohne Zeitfenster.
- **Sperrordnung** (§4.1): Verein → Person → Teams aufsteigend → `spieler`-Zeile → Termin-Zeile.
- `konto_grenze_vorher` deckt die Pfade «Übung aus Training in die Bibliothek kopieren» und «Training übernehmen» als INSERT ab (Story 12 AK 2, 3). Das `UPDATE … set owner_id = null` beim Anonymisieren (`trainer_einladen.sql:837`, `:841`) wechselt auf kein Konto und fällt nicht darunter.

### 5.5 Wächter und Inventare

- **grep-Wächter in `check:kern`** (W`scripts/pruefe-kern.ts`) über `web/`, `supabase/tests/` und `.github/workflows/`, nicht über `supabase/migrations/` (die Geschichte darf die Namen behalten):
  - ab dem Release: kein `create_team(text)`, kein Import in ein Team (`spieler_importieren(`), kein «Probe»/«Probetraining» in Oberflächentexten, MCP-Beschreibungen und `ZUGANG_DARF` (W`lib/mcp/umfang.ts:12-19`), und unter W`lib/mcp/` kein Ausgabe- oder Eingabeschlüssel, kein Enum-Wert und kein `feld` mit «probe» (Inventar §7.10). Ausgenommen sind Texte, die ein Team verfasst hat, frühere Release-Texte und die internen `probe_*`-Namen (Story 8 AK 2, OoS 5; §11 F-Begriff).
  - **MCP ruft keine `verein_*`-RPC:** kein `"verein_` und kein Import aus W`lib/kern/verein*` unter W`lib/mcp/`. Das Netz dahinter ist `nur_in_der_anwendung()` in der Datenbank (§4.1); zusammen gilt Story 13 OoS 1 und PC 1 («Vereinsverwaltung nie per KI»), auch für Personen in der Verwaltung und auch bei einem direkten Aufruf mit dem KI-Token.
  - vor N1 zusätzlich: kein `spieler.team_id`, kein `.from("spieler")…eq("team_id"`, kein `spieler_eindeutig`, kein `vereine_nachziehen`, kein `staging_nach_sync`.
- **Ortsprüfung** (Rollen nach Ort, PO 13): Keine Funktion darf beide Rollen kennen. `check:kern` lädt keine DB. Die Prüfung läuft deshalb als psql-Test im CI-Lauf aus V0 (`supabase/tests/ortspruefung.sql`) auf den Funktionstexten:
  ```sql
  select p.proname from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prosrc ~ '\m(ist_team_mitglied|meine_team_ids)\M'
     and p.prosrc ~ '\mist_verein_verwaltung\M';
  -- erwartet leer, ohne Ausnahmeliste
  ```
  Geprüft wird bewusst nicht die Form der Verknüpfung (ein Regex über `or` übersähe `if/elsif` und Klammern), sondern dass keine Funktion beide Prädikate enthält. Eine Ausnahmeliste gibt es nicht: Auch J+S und Link prüfen je Ort genau eine Rolle (Team-RPC mit `p_team`, Bestands-RPC `verein_spieler_*`, §4.3, §4.4). Policies rufen `ist_verein_verwaltung` nie auf (§4.2). Funktionen, die beides nur **anzeigen** (`meine_vereinslage` mit `ist_verwaltung` und `ist_teammitglied`, `verein_ansicht` mit `ist_mitglied` je Team, `konto_loeschen_info`, `delete_account`), lesen `team_members` und `verein_verwaltung` direkt statt über die Prädikate.
- **Rennen deterministisch prüfen** (`supabase/tests/rennen.sql`, Lauf aus V0): `pruefe-kern-db.ts` kann über supabase-js nur `Promise.all`; das beweist keine Sperre und kann zufällig grün sein. Die Fälle «gleichzeitig, genau eines gelingt» laufen deshalb als psql-Test mit zwei Verbindungen über `dblink` (Extension nur in der Test-DB, angelegt im Test, nicht in einer Migration):
  1. Verbindung A: `begin`, erster Vorgang, Transaktion offen lassen (A hält die Sperre).
  2. Verbindung B: zweiter Vorgang per `dblink_send_query`.
  3. Warten, bis `pg_stat_activity` B mit `wait_event_type = 'Lock'` zeigt; so ist die Verschränkung erzwungen, nicht erhofft.
  4. A `commit`, dann `dblink_get_result` für B: Erwartet ist die Abweisung (Marker bzw. Status), danach genau ein Ergebnis in der Tabelle.

  Abgedeckt: Testfälle 6, 15, 16, 19, 22 (gleichzeitige Anlagen), 23, 29 und Story 5 AK 35 (§6.7). Das Muster gilt für jedes künftige Rennen.
- **Werkzeugsatz-Wächter** (W`scripts/pruefe-kern.ts:2082-2205`, Namen fest verdrahtet, u. a. `:2188`, `:2198-2199`): Er wird umgestellt auf `schnuppertraining_abrufen`, `schnuppertraining_festlegen`, `spieler_schnuppern_setzen` und den Ersatz von `spieler_entfernen` durch `spieler_aus_team_nehmen`; `spieler_entfernen` und `spieler_loeschen` prüft er als abwesend (kein Löschen per KI, Story 13 AK 5, §7.10). Einen Übergang mit alten Namen gibt es nicht (Story 8 OoS 3, Story 13 OoS 3).
- **`WERKZEUGE` ↔ `ZUGANG_DARF`:** Einen Abgleich gibt es heute nicht. Er wird nicht automatisiert, weil die Zusage Prosa ist. Die PR zu Story 13 listet jede geänderte Zeile von `ZUGANG_DARF`/`ZUGANG_DARF_NICHT`. Der Kopfkommentar `umfang.ts:3-8` verlangt bei einer Erweiterung die Frage nach erneuter Zustimmung. Für dieses Epic beantworten sie Story 8 PC 4 und Story 13 PC 2 («keine erneute Zustimmung»), und der Kommentar verweist darauf.
- **Pflicht-Inventar** (einzige Liste; in der PR zu Story 1 angelegt, in jeder Story-PR fortgeschrieben, §4.4 verweist hierher):
  1. alle INVOKER-Funktionen, die `spieler` joinen
  2. alle Stellen mit `s.team_id` als Sperr- oder Filterschlüssel (u. a. `spieler_link_abmelden`, `probetraining.sql:285-289`); Soll nach dem Release: keine Funktion liest `spieler.team_id` mehr (Voraussetzung für §3.8)
  3. alle Trigger, die aus `*_teilnahmen` zurückschreiben
  4. alle Funktionen, die Termin-Zeile und `spieler`-Zeile sperren, samt Reihenfolge (§4.1)
  5. alle Leser von `spieler.probe_seit` (§3.2)
  6. die Funktionen aus #561 und #590 in ihrer neuesten Fassung (`treffpunkt_training.sql`, `hinweis_eltern.sql`)
  7. **jede löschende RPC** (`spieler`, `team_spieler`, `teams`, `verein_verwaltung`) mit den Sperren, die sie **vor** dem DELETE nimmt (§4.1)
  8. jede RPC am Verein-Ort, `verein_gruenden` und `delete_account` mit `nur_in_der_anwendung()` als erster Anweisung
  9. Ortsprüfung (`ortspruefung.sql`) und MCP-Wächter grün

  Hilfsabfrage vor N1: `select proname from pg_proc where pronamespace = 'public'::regnamespace and prosrc ~ 'team_id' and prosrc ~ 'spieler'`. Postgres verfolgt keine Abhängigkeit von Funktionsrümpfen auf Spalten; ein vergessener Leser fiele erst zur Laufzeit auf.

  **Stand nach Story 2** (`20261113100000_vereine_fundament.sql`, `20261113110000_spieler_ueber_zuordnung.sql`, `20261113200000_spieler_eindeutig_verein.sql`; jede Story-PR schreibt die Tabelle fort):

  | # | Stand | offen bis |
  |---|---|---|
  | 1 | INVOKER mit `spieler`: `probe_stand`, `spiel_teilnehmer`, `termin_teilnehmer`. INVOKER, die `team_spieler` unter `tsp_select` lesen: dieselben und `training_meldestand`, `training_abgemeldet`, `spielstand_training`, `spiel_stand`, `team_probe_staende`, `termin_gilt_fuer`. Aus DEFINER-Pfaden laufen sie als Eigentümer. | `termin_teilnehmer`, `spiel_teilnehmer` DEFINER: Story 3 |
  | 2 | `spieler_aendern` hat seit Story 2 `p_team` (Mitgliedschaft und `spieler_im_team`, Verein aus dem Team). `spieler.team_id` als Schlüssel nur noch in: `spieler_entfernen`, `spieler_link_holen`, `spieler_link_erneuern`, `spieler_probe_folgen`, `spieler_probe_setzen` (Rechteprüfung ohne `p_team`), `spieler_link_abmelden` (Sperre, Termin-Team), `spieler_link_ansicht` (Termine, Teamname, `probe_info`), `feedback_link_team`; geschrieben von `spieler_aufnehmen`, `spieler_importieren`; bewusst `vereine_nachziehen`. | Story 3, 7, 8, 9; `vereine_nachziehen` N1 |
  | 3 | Rückschreiben aus `*_teilnahmen`: `termin_zeitpunkt_nachher` nur für Zugeordnete des Termin-Teams (Join `team_spieler`); `spiel_zeitpunkt_nachher` unverändert (`termin_gilt_fuer`). | `spiel_zeitpunkt_nachher` mit `spieler_im_team`: Story 3 |
  | 4 | Termin-Zeile `for update`: `abmeldung_anwenden_training`, `spiel_pruefen`, `spiel_anwesenheit_setzen`, `termin_anwesenheit_setzen_training`, jeweils nach der Teamsperre und ohne `spieler`-Zeile. `spieler`-Zeile `for update`: `team_spieler_vorher`, `spieler_entfernen`, `spieler_probe_setzen`, `spieler_aendern` (nach der Vereinssperre, Story 2), ohne Termin-Zeile. Keine Funktion sperrt Termin vor `spieler`. | – |
  | 5 | `spieler.probe_seit` liest nur noch `vereine_nachziehen` (und einmalig der Abgleich am Ende der zweiten Migration); alle Leser aus §3.2 lesen `team_spieler.probe_seit`, der einzige Schreiber `spieler_probe_setzen` schreibt dorthin. | Drop N1 |
  | 6 | #561/#590: `spieler_link_ansicht` aus `treffpunkt_training.sql` übernommen (nur `probe_info` geändert); `spieler_abo_termine` liest es und bleibt; `hinweis_eltern.sql` liest keine Spieler-Menge. | Story 7 |
  | 7 | Löschend: `spieler_entfernen` sperrt Verein, Teams, Zeile vor dem DELETE; `delete_account` sperrt Verein, Person vor dem DELETE der eigenen Verwaltungszeile; `loese_team_auf` und `team_aufloesen_wenn_leer` löschen Teams ohne Advisory-Sperre (Kaskade auf `spieler` und `team_spieler`, deren Trigger kehren zurück, weil das Team weg ist). | Story 3 (`spieler_entfernen` entfällt), Story 5 (Auflösen) |
  | 8 | `nur_in_der_anwendung()` erste Anweisung nach `auth.uid()`: `delete_account`. Noch keine RPC `verein_*`. | ab Story 3 |
  | 9 | `ortspruefung.sql` grün (lokal, 13.11.2026, auch nach Story 2); MCP-Wächter in `check:kern` (Web-Teil). Seit Story 2 prüft `check:kern`, dass `web/`, `supabase/tests/` und `.github/workflows/` den gefallenen Index `spieler_eindeutig` nicht mehr nennen. | jede Story |

### 5.6 Betriebsregeln

- **Prod-Schritte und lesende Prod-Abfragen nur mit ausdrücklicher Freigabe im Moment.** Dazu zählt auch jeder Sync, denn er liest Prod. Eine Aufzählung im Plan ist keine Freigabe.
- **Im Wartungsfenster schreibt kein Code:** Die Firewall-Regel sperrt das ganze Vercel-Projekt (Produktionsdomain, `*.vercel.app`-Aliase, Deployment-URLs, für die Dauer auch staging.ki-fu.ch) bis auf die eigene Adresse, bis `db push` und das neue Deployment fertig sind (§6.1). Ohne Dual-Write ist das Pflicht, nicht Kür.
- **Je Story genau die in §3 genannte Migration.** Nach jedem Merge auf `develop` ist Staging konsistent: keine unsichtbaren Teams, keine halbe Regel.
- **CI prüft Migrationen nur gegen eine leere DB.** Den Prod-Weg prüfen der psql-Test mit Altdaten (§6.3), der CI-Prod-Weg (§6.7) und die Generalprobe auf Staging (§6.2).
- **Gotchas für CLAUDE.md** (mit dem Release nachführen):
  - `ist_team_mitglied` ist nie vereinsbewusst. Team-Inhalte gibt es nur für Mitglieder, auch für die Verwaltung (Rollen nach Ort). Kein Prädikat summiert Mitglied **oder** Verwaltung (Ortsprüfung §5.5).
  - Verwaltungsfunktionen liegen im Bereich «Verein», getrennt von `/team/[id]`; das MCP ruft keine `verein_*`-RPC.
  - Neue Funktionen ohne API-Zweck: `revoke all … from public, anon, authenticated`.
  - `teams.verein_id` ist unveränderlich. Höchstens ein Verein je Person, jede Aufnahme läuft unter Personensperre.
  - Konten ohne Verein: 50 Übungen und 30 Trainings, durchgesetzt von `konto_grenze_vorher`. Testkonten mit vielen Übungen brauchen einen Verein (§6.7).
  - `probe_*` (intern) = Schnuppern (aussen).
  - Bis N1: `spieler.team_id` ist tot. Neue Spalten nie als NOT NULL/CHECK, solange der Sync Prod-Zeilen ohne sie lädt.

---

## 6. Migrationspfad auf Prod

### 6.1 Ein Release mit Wartungsfenster, danach der Nachlauf N1

Alle Stories gehen gemeinsam in **einem** Release nach `main` (Epic #575). Ein kurzes Wartungsfenster ist zulässig (Epic EK 10, Story 1 OoS 3). Die Releases R0–R3 aus dem Plan vom 29.10. entfallen und mit ihnen der Dual-Write, der Rückfall-Branch und die Notteilung R2a/R2b. Dazu kommen zwei Schritte ohne Epic-Story (§9):

| Schritt | Wann | Inhalt |
|---|---|---|
| **V0** Vorlauf | vor Story 1; geht nach `main` | `sync-staging.yml` (§6.2), `reset-staging.yml` (§6.2, Generalprobe), psql-Testlauf `supabase/tests/` in `pr-checks.yml` (darin `ortspruefung.sql`, `rennen.sql`, §5.5). V0 geht vor Story 1 als eigener kleiner Release nach `main` (ohne Schema- oder Anwendungsänderung): `workflow_dispatch` startet nur Workflows, deren Datei auf dem Default-Branch liegt, und `reset-staging.yml` ist neu. Der Sync läuft während der Entwicklung aus `develop` (`gh workflow run sync-staging.yml --ref develop`). `workflow_dispatch` nimmt die Workflow-Datei des gewählten Branches; so hält es auch `deploy-staging.yml:22-29`. |
| **Release** | Stories 1–9, 11–13 | alle Migrationen aus §3 in der Reihenfolge der Tabelle in §3 (= Merge-Folge, §9), Code, Doku |
| **N1** Nachlauf | frühestens zwei Wochen nach dem Release ohne Befund (§11 F1) | Contract §3.8: `spieler.team_id` und `spieler.probe_seit` weg, NOT NULL auf `teams.verein_id` und `spieler.verein_id` (`not valid` → `validate` → `set not null`), `vereine_nachziehen`, `staging_nach_sync` und der Sync-Aufruf weg. Ohne sichtbare Änderung, interner Release-Text. |

**Vor V0: sauberer Schnitt (P0).** Was auf `develop` schon fertig ist, geht zuerst als gewöhnlicher Release nach `main`; sonst käme es erst mit dem Vereine-Release nach Prod.

**Einfrieren von `develop`** (vom Merge von Story 1 bis zum Release): `develop` enthält nur Vereine-Arbeit, und `develop` → `main` gibt es in dieser Zeit nicht. Ein dringender Prod-Fehler geht als Hotfix von `main` (Branch von `main`, PR auf `main`, danach `main` nach `develop` zurückmergen). **Ein Hotfix enthält keine Migration:** Sie bekäme einen späteren Zeitstempel als die Vereine-Migrationen, und `db push` ohne `--include-all` wiese diese am Release-Tag ab. Ist eine Migration unvermeidlich, wird vor dem Merge entschieden, wie der Release damit umgeht. Reihenfolge, Gates und Muster im Einzelnen: `docs/superpowers/plans/2026-11-13-vereine-umsetzung.md`.

**Warum der Contract nicht ins Release kommt:** Bis Prod das neue Schema hat, lädt der Sync einen Prod-Dump mit `spieler.team_id` und ohne `verein_id`. NOT NULL und CHECK greifen auch unter `replica` und brächen das COPY (Workflow-Kopf `sync-staging.yml:35-53`). Die Invariante halten bis N1 `teams_vorher` und `spieler_vorher` mit `VEREIN_FEHLT`.

**Warum kein N-1, und warum dann ein echtes Fenster:** Die Dual-Write-Trigger entfallen (§3.9). Schriebe die Vorversion nach `db push` noch, entstünden Zeilen, die nur das alte Modell kennt. Das gilt etwa für `spieler_aufnehmen`, dessen Argumente gleich bleiben (§4.4). Der neue Code wiederum fände vor `db push` seine RPCs nicht. Darum darf im Fenster **gar kein Code schreiben**, weder alter noch neuer. Einen Wartungsmodus im Code gibt es nicht, und die laufende Vorversion kann keinen mehr bekommen. Gesperrt wird deshalb vor der App, mit einer **Custom Rule in der Vercel-Firewall des Projekts** (F7 entschieden): Bedingung «IP-Adresse ist nicht die eigene», Aktion «deny», **ohne Host-Bedingung**. Eine Regel nur für die Produktionsdomain liesse die `*.vercel.app`-Aliase und die Deployment-URLs des Production-Deployments offen, die mit derselben Prod-Umgebung laufen. Ohne Host-Bedingung sperrt sie für die Dauer des Fensters auch staging.ki-fu.ch; das ist unschädlich. Das trifft App, MCP-Endpunkt, Eltern-Links, Abo und Abholseite gleichermassen. **Probe vorab:** dieselbe Regel einmal mit der Host-Bedingung `staging.ki-fu.ch` aktivieren und von aussen prüfen, dass Staging und seine Deployment-URL «deny» liefern und die eigene Adresse durchkommt; danach entfernen. Die Regel ist eine Konfigurationsänderung und braucht die Freigabe im Moment, die Probe auch. Alte Signaturen wie `create_team(text)` (fällt mit Story 5), `spieler_entfernen(uuid)` und `spieler_probe_setzen(uuid, …)` fallen zusätzlich weg (drop + create, §4.4), statt umgedeutet zu werden; das ist das zweite Netz.

**Reihenfolge innerhalb des Release:** die Merge-Folge (Tabelle in §3). Was scheitern darf, ohne dass die App es braucht, steht am Ende: die `validate`-Migration der Termin- und Zuordnungs-FKs (`<ts>_zuordnung_invarianten_validieren.sql`). Sie entsteht erst im letzten PR vor dem Release-PR, damit ihr Zeitstempel keiner Story-Migration vorgreift (§3). Scheitert nur sie, ist der fachliche Stand vollständig, und die Validierung kommt als Vorwärts-Migration nach. `supabase db push` wendet jede Datei in einer eigenen Transaktion an. Ein Abbruch mittendrin lässt die früheren Dateien angewendet; deshalb gibt es Zusicherungen je Datei (§6.3) und die Generalprobe der ganzen Kette (§6.2). Deren Laufzeit bestimmt die Länge des Fensters.

**Ablauf am Release-Tag.** Jeder Schritt auf Prod und jeder Sync läuft nur mit ausdrücklicher Freigabe im Moment.

| # | Wer | Inhalt |
|---|---|---|
| −1 (vor dem Merge von Story 1) | Adrian, **Freigabe** | Nur die Zeile `verwaltung_konto` aus §6.4 auf Prod (eine Konto-ID, keine Personendaten). Die ID kommt als Default in `vereine_nachziehen` (§6.3) in die Fundament-Migration. Später ginge es nicht mehr: Eine auf Staging schon angewandte Migration wird nicht editiert. |
| 0 (Tage vorher) | Adrian, **Freigabe** | Übrige Prüfabfragen §6.4 auf Prod. Bestandskonten ohne Team, die in einem Verein arbeiten sollen, nimmt die PO selbst über «Trainer:in aufnehmen» in ein Team auf (PO 10, Story 12 PC 5). Firewall-Probe auf Staging (oben). |
| 1 | `develop` | Generalprobe grün (§6.2); sie zeigt auch, dass FC Wyler mit dieser Konto-ID genau eine Verwaltung bekommt (Staging hat nach dem Sync dieselben `auth.users`-IDs, §6.5 «Vereine ohne Verwaltung = 0»). Produktdoku, `feedback-triage.md` samt `gen:feedback-wissen`, Release-Text und Gotchas liegen bereit. Als **letzter** PR vor dem Release-PR: `<ts>_zuordnung_invarianten_validieren.sql` (§3) und `PUBLIC_TABLES` (`sync-staging.yml:67`) um `team_spieler verein_verwaltung vereine` ergänzen, bytewise sortiert. Früher ginge es nicht, weil der Guard die Liste mit Prod vergleicht (`:114-127`) und der Sync aus `develop` sonst abbräche. Ab diesem PR wird bis zum Release nicht mehr aus `develop` gesynct. **Reihenfolge:** zuerst dieser Abschluss-PR, danach die Generalprobe, damit sie auch die Validierung auf Prod-Daten prüft; ihr Sync läuft aus `main` und ist erlaubt. In der Generalprobe wird zudem die Migrationsliste von Prod mit `develop` verglichen (nur lesend, Freigabe): Eine Migration auf Prod, die `develop` nicht kennt oder die später datiert ist als eine Vereine-Migration, wird vor dem Fenster gelöst. |
| 2 | PO | Fenster in einer Randzeit ansetzen. Die PO informiert die Trainer:innen des FC Wyler selbst; die App verschickt keine Mails. |
| 3 | Adrian, **Freigabe** | Firewall-Regel «Wartung» (projektweit, oben) aktivieren und mit Aufrufen von aussen prüfen, dass Produktionsdomain und eine `*.vercel.app`-Adresse des Production-Deployments gesperrt sind |
| 4 | Merge `develop` → `main`, **Freigabe** | `deploy.yml` startet `db push`, Vercel baut parallel. Abwarten, bis **beides** fertig ist: `db push` grün und das neue Deployment auf der Produktionsdomain. |
| 5 | Adrian, **Freigabe** | Prüfabfragen §6.5 auf Prod, nur lesend; Rundgang mit dem eigenen Konto durch die Sperre (eigene Adresse ausgenommen): Bereich «Verein», FC Wyler, alle Teams, Verwaltung = eigenes Konto (Story 1 AK 1–3) |
| 6 | Adrian, **Freigabe** | Firewall-Regel entfernen; Fenster zu |
| 7 | Claude | GitHub-Release `--target main`, Text aus `docs/releases/` |

- Offene Tabs müssen nach dem Deploy neu laden (neue Action-IDs). Eine erneute Anmeldung erzwingt der Release nicht.
- Verbundene KI-Clients laden ihre Werkzeuge neu (Story 8 PC 5, Story 13 PC 3); alte Werkzeugnamen ergeben «unbekanntes Werkzeug».
- **Rückfall:** Einen Code-Rückfall gibt es nicht; die Vorversion kennt weder Spieler:innen ohne Team noch Mehrfachzuordnungen. Fehler werden vorwärts behoben. Einzige Ausnahme: Scheitert schon die erste Datei, ist das Schema unverändert, und ein Vercel-Rollback auf das vorige Deployment stellt den alten Stand her (nur mit Freigabe im Moment).
- **E16 (PO 12):** #482, #504/#505 und #514 kommen erst nach dem Release. #561 und #590 sind schon live (v1.46.0) und gehören ins Inventar §5.5.

### 6.2 Sync im Fenster und Generalprobe

**V0: `sync-staging.yml` auf `develop`**
1. Vor dem Restore leert der Lauf auch die public-Tabellen, die Staging hat und Prod nicht. Die Liste wird zur Laufzeit ermittelt (Staging minus `PUBLIC_TABLES`), also ohne zweite Pflegeliste. Ein zweites `truncate … cascade` **nach** dem Restore gibt es nicht; es risse über die FKs auf `vereine` den ganzen Bestand mit.
2. Nach dem Restore, noch in derselben Transaktion unter `replica`: `select staging_nach_sync()`, sofern die Funktion existiert (`to_regprocedure`). Sie ruft `vereine_nachziehen()` ohne Argument auf, solange `exists (select 1 from teams where verein_id is null)`.
3. Die Geheimnis-Nachbehandlung (`:196-208`) bleibt. Neue Geheimnisse bringt das Epic nicht mit, die Tabellen `einladungen` und `zugangsantraege` entfallen.
4. Der Guard vergleicht weiter mit Prod. Vor dem ersten Lauf aus `develop` einmal prüfen, dass Secrets und die Bestätigung `sync` auch vom Branch aus greifen (§11 F2).

- **Kein Sync aus `develop`** zwischen dem `PUBLIC_TABLES`-PR (§6.1 Schritt 1) und dem Release; der Sync aus `main` in der Generalprobe ist davon ausgenommen. Kein Sync im Fenster von N1 (NOT NULL, Drop).
- Nach dem Release stimmen Prod und `develop` überein, und der Sync läuft wieder normal, auch aus `main`. Mit N1 fallen Schritt 1 und 2 als Übergangs-Artefakte weg.

**Generalprobe des Prod-Wegs** (nach dem Abschluss-PR und vor dem Release-PR, mit Ankündigung, weil sie Staging-Daten und Testkonten ersetzt): Der Sync aus `develop` prüft nur den Nachlauf `vereine_nachziehen`, nicht die Migrationskette auf Prod-Daten. Die Generalprobe prüft genau den Prod-Weg:
1. Staging-Schema auf `main` zurücksetzen, **über CI**, nicht lokal: neuer Workflow `reset-staging.yml` (V0) mit `workflow_dispatch`, Eingabe-Bestätigung `reset` (Muster `sync-staging.yml`), Checkout von `main`, dann `supabase db reset --linked` gegen das Staging-Projekt mit den Secrets `SUPABASE_STAGING_*`. Er läuft nur gegen Staging; ein Prod-Ziel kennt er nicht. Ob der Reset Storage-Objekte oder Auth-Konfiguration anfasst (F6), klärt ein erster Lauf in V0 auf Staging, vor Story 1; die Auth-Konfiguration liegt ohnehin im Dashboard.
2. Sync aus `main` (**Freigabe**, liest Prod). Schema und `PUBLIC_TABLES` passen zu Prod, `staging_nach_sync` gibt es dort nicht.
3. `deploy-staging.yml` aus `develop` auslösen: Alle Release-Migrationen laufen in Reihenfolge auf Prod-Daten, die Laufzeit steht im Log.
4. `psql -f supabase/tests/prodweg/prodweg_pruefen.sql` (§6.5) gegen Staging, danach E2E auf staging.ki-fu.ch.

### 6.3 Backfill «FC Wyler» (Fundament-Migration, idempotent, nur ergänzend)

```sql
create function vereine_nachziehen(
  p_verwaltung uuid default '<auth.users.id des Kontos der Plattform-Admin (§6.1 Schritt −1, erledigt: steht in der Fundament-Migration)>'
) returns void
language plpgsql set search_path = public, pg_temp as $$
declare
  c_verein constant uuid := '<einmal erzeugte feste UUID>';   -- wiederholbar ohne Duplikat
begin
  if exists (select 1 from teams where verein_id is null) then
    insert into vereine (id, name) values (c_verein, 'FC Wyler') on conflict (id) do nothing;
    update teams set verein_id = c_verein where verein_id is null;     -- teams_verein_fest: NULL → Wert erlaubt
  end if;
  update spieler s set verein_id = t.verein_id     -- Altdubletten bleiben; die Eindeutigkeit prüft nur INSERT und Schlüsseländerung (§3.3 a)
    from teams t where t.id = s.team_id and s.verein_id is null;
  insert into team_spieler (team_id, spieler_id, verein_id, probe_seit)  -- Doppeleinträge bleiben getrennt
  select s.team_id, s.id, s.verein_id, s.probe_seit from spieler s where s.team_id is not null
  on conflict (team_id, spieler_id) do nothing;
  if p_verwaltung is not null
     and exists (select 1 from vereine where id = c_verein)
     and not exists (select 1 from verein_verwaltung where verein_id = c_verein)
     and exists (select 1 from auth.users where id = p_verwaltung and email_confirmed_at is not null) then
    insert into verein_verwaltung (verein_id, user_id) values (c_verein, p_verwaltung) on conflict do nothing;
  end if;
  -- Zusicherung: die Datei bricht ab statt einen halben Stand zu hinterlassen
  if exists (select 1 from spieler s where s.team_id is not null and not exists
               (select 1 from team_spieler ts where ts.spieler_id = s.id and ts.team_id = s.team_id)) then
    raise exception 'BACKFILL_UNVOLLSTAENDIG';
  end if;
end $$;
revoke all on function vereine_nachziehen(uuid) from public, anon, authenticated;
select vereine_nachziehen();
```

- **Warum die Konto-ID statt der Adresse oder ihres Hashs:** Die ID verrät nichts über die Adresse. Ein ungesalzener SHA-256 einer erratbaren Adresse liesse sich mit dem öffentlichen Repo bestätigen. Staging hat dank Sync von `auth.users` dieselbe ID.
- **Eine Fassung:** `vereine_nachziehen` bleibt ab Story 1 unverändert. Die Eindeutigkeit je Verein (Story 2) prüft ein Trigger nur bei INSERT und Schlüsseländerung (§3.3 a); das Setzen von `verein_id` ändert keinen Schlüssel, und im Sync läuft ohnehin alles unter `replica`.
- **Schnuppern:** `probe_seit` wandert auf die Zuordnung (§3.2). Das ist eindeutig, weil heute jede Spieler:in genau ein Team hat.
- **Warum ein Parameter:** Der Test übergibt die ID eines eigenen Testkontos; Migration und `staging_nach_sync` rufen ohne Argument auf.
- **Warum keine Ausnahme bei fehlendem Konto:** Ohne das Konto (lokal mit Bestand) entsteht FC Wyler ohne Verwaltung. Ein Abbruch legte jede lokale DB mit Teams still. Auf Prod schliessen es drei Schritte aus: Die Konto-ID steht vor dem Merge von Story 1 fest (§6.1 Schritt −1), die Generalprobe auf Staging (gleiche `auth.users`-IDs nach dem Sync) prüft mit `prodweg_pruefen.sql` «kein Verein ohne Verwaltung» (§6.5), und nach dem Release prüft Adrian Verwaltung = 1 (§6.5). Eine falsche ID fällt so in der Generalprobe auf, nicht erst im Fenster; eine fehlende schon vorher: Fiele der Default auf `00000000-…` zurück, scheiterte in `pr-checks.yml` der Job «Verwaltungskonto im Backfill eingesetzt» (die Konto-ID ist eingesetzt, erledigt am 13.11.2026). Einen Notweg in der App gibt es nicht (PO 3, Epic OoS 13); lokal hilft ein Insert per SQL.
- **Trigger auf Prod:** Der Backfill läuft vor den Grenztriggern (Reihenfolge Tabellen → … → Trigger → Backfill gilt je Datei; `team_spieler_vorher` mit Grenze 100 kommt mit Story 1, aber erst in der zweiten Datei `spieler_ueber_zuordnung` nach dem Backfill). Die Eindeutigkeitsprüfung aus Story 2 greift nur bei INSERT und Schlüsseländerung. Teams über 100, ein Verein über 1000 und Altdubletten kommen deshalb durch (Story 1 PC 2, 3, Story 2 PC 1). `team_members_vorher` und `verwaltung_vorher` sind erfüllt, weil es nur einen Verein gibt.
- **Trigger auf Staging:** Im Sync läuft alles unter `replica`.
- **CI** (leere DB): keine Teams, also kein Verein, keine Zuordnung, keine Verwaltung. Vollständiges No-op.

**psql-Test** `supabase/tests/vereine_nachziehen.sql` (aus V0; prüft Ergebnis und Idempotenz auf dem Staging-Weg; fällt mit N1):
1. `begin`, `set session_replication_role = replica`.
2. Daten: Teams und Spieler:innen ohne Verein, ein Team ohne Mitglieder, eine Dublette in zwei Teams, ein Team mit 150 Spieler:innen, eine schnuppernde Spieler:in, Kader, Meldungen und festgehaltene Termine, ein Testkonto in `auth.users` mit bestätigter Adresse.
3. Zweimal `select vereine_nachziehen('<ID des Testkontos>')`, dann einmal `select vereine_nachziehen(null)`.
4. Prüfungen: genau ein Verein, kein `verein_id is null`, `count(team_spieler) = count(spieler)`, die Dublette als zwei getrennte Zeilen mit je eigener Zuordnung, `probe_seit` auf der Zuordnung, Verwaltung genau 1.
5. `rollback`. Ein zweiter Block ohne Testkonto ergibt Verwaltung 0.

Einen Umgehungs-Schalter gibt es nicht.

### 6.4 Prüfabfragen vorab

Adrian führt sie im Supabase-SQL-Editor als `postgres` aus, nur lesend und mit Freigabe im Moment. Die Platzhalter-Adresse setzt er selbst ein; sie kommt weder ins Repo noch in einen Chat. Die Abfragen liefern nur Zahlen und eine Konto-ID, keine Personendaten.

```sql
begin read only;
with je_team as (select team_id, count(*) n from public.spieler group by team_id),
     schluessel as (
       select count(*) datensaetze from public.spieler
        group by public.spieler_text_schluessel(vorname), public.spieler_text_schluessel(nachname), jahrgang),
     teamnamen as (select count(*) n from public.teams group by public.spieler_text_schluessel(name)),
     ohne_team as (
       select u.id from auth.users u
        where u.email_confirmed_at is not null
          and not exists (select 1 from public.team_members m where m.user_id = u.id))
select
  (select count(*) from public.teams)                                          as teams_gesamt,          -- gegen 30
  (select count(*) from public.spieler)                                        as spieler_gesamt,        -- gegen 1000
  (select count(*) from je_team where n > 100)                                 as teams_ueber_100,
  (select coalesce(max(n), 0) from je_team)                                    as groesstes_team,
  (select count(*) from schluessel where datensaetze > 1)                      as dubletten_schluessel,
  (select coalesce(sum(datensaetze - 1), 0) from schluessel where datensaetze > 1) as ueberzaehlige_datensaetze,
  (select count(*) from teamnamen where n > 1)                                 as teamnamen_doppelt,
  (select count(*) from public.teams t where not exists
     (select 1 from public.team_members m where m.team_id = t.id))             as teams_ohne_mitglied,   -- erwartet 0
  (select count(distinct user_id) from public.team_members)                    as kuenftiger_lesekreis,
  (select count(*) from ohne_team)                                             as konten_ohne_verein,
  (select count(*) from ohne_team o where (select count(*) from public.exercises e
     where e.owner_id = o.id and e.source = 'user') > 50)                      as ohne_verein_ueber_50_uebungen,
  (select count(*) from ohne_team o where (select count(*) from public.trainings t
     where t.owner_id = o.id) > 30)                                            as ohne_verein_ueber_30_trainings,
  (select count(*) from public.spieler where probe_seit is not null)           as schnuppernde,
  (select id from auth.users
    where lower(email) = lower('<Adresse der Plattform-Admin>')
      and email_confirmed_at is not null)                                      as verwaltung_konto;      -- in §6.3 eintragen (erledigt)
rollback;
```

**Waisen vor den Termin- und Zuordnungs-FKs** (je FK aus §3.3 b analog, auch `termin_kader`, `spiel_treffpunkte`, `*_teilnahmen`; Soll überall 0):

```sql
begin read only;
select count(*) from public.termin_abmeldungen a where not exists
  (select 1 from public.spieler s where s.id = a.spieler_id and s.team_id = a.team_id);
select count(*) from public.termin_abmeldungen a where not exists
  (select 1 from public.training_termine t where t.id = a.termin_id and t.team_id = a.team_id);
select count(*) from public.termin_teilnahmen p where not exists
  (select 1 from public.termin_eingefroren f where f.termin_id = p.termin_id and f.team_id = p.team_id);
rollback;
```

**Teamliste** zur Kontrolle von Epic PC 4 und Story 1 PC 1: Teamname, Anlagedatum, Zahl der Trainer:innen und Spieler:innen (Abfrage wie im Plan vom 29.10.). Der PO bestätigt, dass jedes Team zum FC Wyler gehört.

Was die Zahlen bedeuten:
- `teams_ueber_100 > 0`, `spieler_gesamt ≥ 1000` oder `teams_gesamt ≥ 30`: Der Bestand bleibt, nur Neues wird abgewiesen (PO 11, «ohne Ausnahme»). Für FC Wyler hiesse das ab dem Release: keine neuen Spieler:innen bzw. Teams. Kein Hindernis für den Release, aber vorab Sache der PO.
- `dubletten_schluessel`: So viele Altdubletten bleiben getrennt (Story 2 PC 1). Der Import zeigt sie als «mehrfach im Verein geführt» (Story 9 AK 5).
- `teamnamen_doppelt > 0`: Die Teams behalten ihre Namen (Story 5 PC 6). Deshalb prüft ein Trigger und kein Unique-Index, der `db push` bräche.
- `teams_ohne_mitglied > 0`: heute nicht möglich (`team_aufloesen_wenn_leer`); wäre ein Befund vor dem Release.
- `konten_ohne_verein` und `ohne_verein_ueber_50_uebungen`/`_30_trainings` (PO 10; gezählt genau nach `konto_bestand`, §3.5, das es vor dem Release noch nicht gibt): So viele Konten arbeiten ab dem Release mit den Grenzen 50/30, und so viele davon liegen schon darüber und behalten ihren Bestand (Story 12 PC 1). Wen die PO in einem Verein sehen will, kennt sie selbst; die Abfrage zählt nur.
- `schnuppernde`: Heute steht jede in genau einem Team, Schnuppern bleibt also für alle gültig (Story 8 PC 3).
- `verwaltung_konto` leer: vor dem Merge von Story 1 klären (Story 1 PC 2, §6.1 Schritt −1).
- Waisen > 0: vor dem Release bereinigen (mit PO-Prüfung) oder die Validierung zurückstellen (§6.1, letzte Datei).

### 6.5 Prüfabfragen nach Rollout

`supabase/tests/prodweg/prodweg_pruefen.sql` (eigener Ordner, damit `run.sh` die Datei nicht im gewöhnlichen psql-Lauf ausführt) enthält diese Abfragen als DO-Block mit `raise exception` je Verstoss. Er läuft in der Generalprobe (§6.2), im CI-Prod-Weg (§6.7) und auf Staging nach jedem Sync. Auf Prod führt Adrian dieselben Abfragen nach dem Release lesend aus, mit Freigabe.

```sql
select count(*) from teams   where verein_id is null;                                      -- 0
select count(*) from spieler where verein_id is null;                                      -- 0
select count(*) from spieler s where s.team_id is not null and not exists
  (select 1 from team_spieler ts where ts.spieler_id = s.id and ts.team_id = s.team_id);    -- 0
select count(*) from team_spieler ts join spieler s on s.id = ts.spieler_id
 where s.verein_id <> ts.verein_id;                                                        -- 0
select count(*) from vereine v where not exists
  (select 1 from verein_verwaltung w where w.verein_id = v.id);                            -- 0
-- Invariante «höchstens ein Verein je Person» (Story 11 AK 7)
with zugehoerig as (
  select m.user_id, t.verein_id from team_members m join teams t on t.id = m.team_id
  union select user_id, verein_id from verein_verwaltung)
select user_id from zugehoerig group by user_id having count(distinct verein_id) > 1;      -- leer
-- Schnuppernde stehen in genau einem Team (Story 8 AK 5)
select count(*) from team_spieler ts where ts.probe_seit is not null and exists
  (select 1 from team_spieler a where a.spieler_id = ts.spieler_id and a.team_id <> ts.team_id); -- 0
-- Eindeutigkeit je Verein: mehrfach geführt sind nur die Altdubletten aus dem Bestand (§3.3 a)
select coalesce(sum(n - 1), 0) from (select count(*) n from spieler
 group by verein_id, spieler_text_schluessel(vorname), spieler_text_schluessel(nachname), jahrgang) g
 where n > 1;                                                                              -- <= ueberzaehlige_datensaetze aus §6.4
select ts.team_id, spieler_text_schluessel(s.vorname), spieler_text_schluessel(s.nachname), s.jahrgang
  from team_spieler ts join spieler s on s.id = ts.spieler_id
 group by 1, 2, 3, 4 having count(*) > 1;                                                  -- leer
select conname from pg_constraint
 where conrelid in ('teams'::regclass, 'spieler'::regclass, 'vereine'::regclass,
                    'verein_verwaltung'::regclass, 'team_spieler'::regclass)        -- ab Story 3 mit den FK-Tabellen aus §3.3 b
   and not convalidated;                                                                    -- leer (bis auf §6.1, letzte Datei)
-- Nicht schemaweit: training_exercises trägt schon vor dem Epic fünf `not valid`-Constraints.
-- Konten ohne Verein über der Grenze (Zählung über konto_bestand, §3.5); = Werte aus §6.4
select count(*) filter (where (b->>'uebungen')::int > 50), count(*) filter (where (b->>'trainings')::int > 30)
  from (select konto_bestand(u.id) b from auth.users u
         where u.email_confirmed_at is not null and person_verein(u.id) is null) k;
```

Nur auf Prod direkt nach dem Release zusätzlich: genau ein Verein «FC Wyler», genau eine Verwaltung (das Konto aus §6.4), `count(team_spieler)` = `spieler_gesamt` aus §6.4, sofern im Fenster niemand Spieler:innen erfasst hat. Massgeblich ist die Zusicherung in `vereine_nachziehen` (§6.3).

### 6.6 Umstellung: Vereinsgründung und Konten ohne Verein (ersetzt «Invite-only»)

Die Invite-only-Umschaltung aus dem Plan vom 29.10. entfällt ganz (PO 10). Es gibt keinen Dashboard-Schritt, kein `enable_signup = false`, kein Invite-Template, keine Änderung an `otp_expiry` oder am Mail-Rate-Limit, kein `/zugang`, keine Admin-Seite, keine Allowlist und kein Löschen unbestätigter Altkonten. `register()`, `resendConfirmation()`, `/auth/confirm` und `supabase/config.toml` bleiben unverändert.

Was mit dem Release für Konten gilt:
1. **Zugehörigkeit ist abgeleitet**, nicht gespeichert: Mitglied eines Teams oder der Verwaltung eines Vereins. Mit `vereine_nachziehen` gehören alle Personen mit Team-Mitgliedschaft dem FC Wyler an, die Plattform-Admin zusätzlich als Verwaltung.
2. **Alle anderen bestätigten Konten sind ab dem Release Konten ohne Verein.** Übungen, Trainings, Favoriten, KI-Zugänge und Feedback bleiben. Neue Übungen und Trainings über 50 bzw. 30 weist `konto_grenze_vorher` ab; ein grösserer Bestand bleibt (Story 12 PC 1). Kein Konto wird gesperrt.
3. **Neue Registrierungen** sind Konten ohne Verein. Sie gründen selbst einen Verein (`verein_gruenden`, §4.3) oder werden per E-Mail-Adresse aufgenommen. Die Bestätigung bei der Gründung wird nicht gespeichert (Story 11 OoS 2); die Datenebene prüft nur `p_bestaetigt` und «Person ohne Verein».
4. **Nie bestätigte Konten** verfallen nicht (Epic OoS 19). Sie können sich nicht anmelden und gelten nicht als Konto ohne Verein (Story 12 PC 1). Es ist nichts zu tun.
5. **KI-Zugänge** stimmen nicht erneut zu (Story 8 PC 4, Story 13 PC 2). Die Kontogrenzen greifen über die KI ab der ersten Anfrage nach dem Release, weil der Trigger jeden Schreibweg prüft und die Zugehörigkeit beim Insert liest (Story 12 PC 2).
6. **Abholseite und privater Link** nennen ab dem Release den Verein als verantwortlich (Story 11 PC 2). Das ist reine Ausgabe (§7.7), ohne Datenänderung.
7. **Kontrolle:** Eine Zugangszahl gibt es nicht mehr. Ob Vereine entstehen, zeigt die Messgrösse des Epics (Prod, lesend, mit Freigabe: `select count(*) from vereine`).

### 6.7 Tests und Seed

- `supabase/seed.sql` bleibt leer; `npm run seed` lädt nur Übungen.
- **psql-Tests unter `supabase/tests/`** (Lauf aus V0 in `pr-checks.yml`): `vereine_nachziehen.sql` (§6.3), `ortspruefung.sql` und `rennen.sql` (§5.5) und alles, was Daten unter `replica` oder zwei Verbindungen braucht. Alle mit «gleichzeitig» markierten Testfälle unten laufen in `rennen.sql`, nicht in `pruefe-kern-db.ts`. `pruefe-kern-db.ts` spricht nur über supabase-js (`:26-31`) und kann `session_replication_role` nicht setzen.
- **CI-Prod-Weg** (zusätzlicher Job in `pr-checks.yml`, nur bis zum Release): `supabase start`, `supabase db reset --version <letzte Migration auf origin/main>`, dann `psql -f supabase/tests/prodweg/prodweg_bestand.sql` (synthetischer Bestand im **alten** Schema wie in §6.3, dazu eine Dublette in zwei Teams, zwei Teams mit gleichem normalisiertem Namen und ein Konto ohne Team mit 60 Übungen), dann `supabase migration up` und `prodweg_pruefen.sql`. Der Bestand legt das Konto mit der Default-ID von `vereine_nachziehen` bestätigt an (der Job liest sie aus der Fundament-Migration), damit «Vereine ohne Verwaltung = 0» auch in CI gilt; zudem hält er die Ausgaben der Lesepfade im alten Schema fest, und `prodweg_pruefen.sql` vergleicht sie nach der Kette (Gleichwertigkeit, §3.2). Zusätzlich: Die Dublette bleibt nach der Story-2-Migration als zwei Zeilen bestehen und ist ohne Schlüsseländerung änderbar, eine dritte Erfassung mit demselben Schlüssel scheitert mit `SPIELER_DOPPELT`; das Konto ohne Team behält 60 Übungen, die 61. scheitert mit `KONTO_UEBUNGEN_VOLL`. Damit läuft die Kette in CI mit echten Triggern statt unter `replica`. Nach dem Release passt `prodweg_bestand.sql` nicht mehr zum Schema von `main`; ein Aufräum-PR auf `develop` entfernt Job und Datei.
- **W`scripts/pruefe-kern-db.ts`:**
  - **Teams:** Heute entstehen sie direkt per `admin.from("teams").insert` ohne Verein (u. a. `:796`, `:1183`, `:1324`, `:1327`, `:1422` und im Helfer `serienTeam` `:1543-1544`). Ab Story 1 käme `VEREIN_FEHLT`. Alle Fundstellen per `git grep 'from("teams").insert'` ermitteln, nicht per Zeilenliste.
  - **Ein Test-Verein je Lauf:** Ein Helfer `testVerein()` legt zu Beginn **einen** Verein «Kern-DB» mit eigener Verwaltung an; alle Team-Inserts nutzen ihn. Mehrere Vereine je Lauf scheiterten an «höchstens ein Verein je Person», sobald `a` oder `b` in Teams zweier Vereine käme (`ANDERER_VEREIN`). Für Tests über Vereinsgrenzen gibt es ein eigenes Konto in einem zweiten Verein.
  - **Konten mit vielen Übungen:** Die Datei legt rund 65 Übungen und Trainings an, vor allem mit Konto `a`. Gehört `a` dabei keinem Verein an, griffe die Grenze 50. Darum tritt `a` vor dem ersten Übungstest dem Test-Verein bei, und die Grenzen 50/30 prüft ein eigenes Konto ohne Verein.
  - **Grenze 200 → 100/1000** (`:4284-4300`): heute 199 Spieler:innen per Admin mit `team_id`, dann die 201. per Kern. Neu sind es 99 Spieler:innen (per Admin in `spieler` mit `verein_id` und in `team_spieler`), dann die 101. per Kern → `SPIELERLISTE_VOLL`. Die Vereinsgrenze prüfen 999 Spieler:innen ohne Team im Test-Verein, dann die 1001. → `VEREIN_VOLL`; aufgeräumt wird im selben Test. Admin-Inserts feuern die Trigger, also bleibt der Testbestand unter der Grenze. Einen Umgehungs-Schalter gibt es nicht.
  - **Schnupper-Tests** (`:5914-6141`) kennen «genau ein Team» nicht und bekommen die Fälle aus Story 8 dazu (Testfälle 17–19 unten).
  - **#480-Tests** (`aufloesung_noetig`, «Konto-Löschung löst ohne Namen auf») werden umgeschrieben: Das Team bleibt, Status `entfernt` (Story 5 AK 28, 29).
  - **Aufräumen** in der Reihenfolge Teams → Spieler:innen des Vereins → Vereine → Konten. Grund: `verein_verwaltung … restrict` auf `auth.users` blockiert sonst das Löschen der Testkonten.
- **MCP-Schicht:** `ausfuehren` ist nicht exportiert (W`lib/mcp/server.ts`), und die DB-Tests rufen nur den Kern. Fälle, die die MCP-Schicht entscheidet (Kontextteam, Auskunft vor Bestätigung, Recheck, Hinweis für Konten ohne Team), brauchen einen Ort. **Festgelegt:** Die Werkzeug-Handler werden einzeln exportiert und in `pruefe-kern-db.ts` mit einem Bearer-Client aufgerufen, wie die Kern-Funktionen (Story 13 AK 4, 6). Der HTTP-Weg gegen den lokalen MCP-Endpunkt mit OAuth-Token ist für CI zu schwer.
- **Pflicht-Testfälle** (zusätzlich zu §6.5; in Klammern die Story):
  1. *(psql/CI-Prod-Weg)* Ein Team mit 150 Bestand kann ändern und herausnehmen; die 151. Zuordnung scheitert (1 PC 2).
  2. Ein Teammitglied setzt `teams.verein_id` per PostgREST und wird abgewiesen (1).
  3. `create_team` (bis Story 5) durch ein Mitglied ohne Verwaltung → `TEAM_NUR_VERWALTUNG`; `verein_team_anlegen` durch die Verwaltung legt ein Team **ohne** Mitgliedschaft an (1 AK 4, 5 AK 17).
  4. **Vereins-Szenario:** Trainer:in A in Team 1 und Trainer:in B in Team 2 desselben Vereins, dazu eine Verwaltung ohne Team und ein Konto ohne Verein. A sieht in der Vereinsliste Name, Jahrgang und Teams aller, J+S nur für Team 1. B sieht die Inhalte von Team 1 nicht. Die Verwaltung sieht Team-Inhalte erst nach der Selbstaufnahme und handelt im Team dann als Mitglied, auch mit dessen Grenzen (nur herausnehmen, nicht löschen). Das Konto ohne Verein sieht keinen Verein (4, 5, 6, PO 13, EK 9).
  5. A erfasst eine Spieler:in, die B schon führt → `abgewiesen`/`doppelt` mit «Team 2», ohne J+S. Dieselbe Spieler:in in einem fremden Verein stört nicht (2 AK 4, PC 2).
  6. A und B erfassen gleichzeitig dieselbe Spieler:in: genau eine gelingt (2 AK 8).
  7. Ändern einer Altdublette mit gleichem Schlüssel gelingt; auf einen vergebenen Schlüssel scheitert es (2 AK 5, 7).
  8. Zuordnen nur durch die Verwaltung; A bekommt `SPIELER_NICHT_GEFUNDEN` bzw. kein Recht (3 AK 3).
  9. Sammel-Zuordnen von 5 Spieler:innen in ein Team mit 97: nichts wird zugeordnet, `ueber_grenze` = 2; mit einer schon zugeordneten ebenso, mit `bereits` (3 AK 21, 22).
  10. Herausnehmen aus Team 2: künftige Meldungen und Kader in Team 2 verfallen, vergangene bleiben mit Namen, die Spieler:in bleibt samt Link. Ein festgehaltener Termin, der in die Zukunft verlegt wird, schreibt ihr keine Meldung zurück (3 PC 4–6).
  11. **Anwesenheit nach dem Herausnehmen:** An einem begonnenen Termin von Team 2 trägt ein Mitglied die Anwesenheit der herausgenommenen Spieler:in nach und korrigiert sie; an einem noch nicht begonnenen Termin geht das nicht (3 AK 18). Das Nachtragen prüft gegen `termin_teilnahmen` des festgehaltenen Termins, nicht gegen `spieler_im_team` (`nachtrag_anwesenheit.sql:59`, `spiel_nachtrag.sql:62`); der Test sichert, dass die Umstellung der Lesepfade (§4.4) diese beiden Stellen nicht auf `spieler_im_team` zieht. Für Spiele gilt dasselbe.
  12. **Mitglied kann nicht löschen, weder App noch KI:** `spieler_entfernen` gibt es nicht mehr (Aufruf durch A → PostgREST «Funktion nicht gefunden»), auch nicht für eine Spieler:in, deren Teams alle Teams von A sind; `verein_spieler_entfernen` durch A ohne Verwaltung → kein Recht; der MCP-Werkzeugsatz enthält weder `spieler_entfernen` noch `spieler_loeschen`; die Team-Spielerliste zeigt keine Löschaktion. A nimmt die Spieler:in aus ihrem letzten Team; sie bleibt ohne Team im Bestand, und erst die Verwaltung löscht sie im Bereich «Verein» (3 AK 12, 13, 16, OoS 5; 6 AK 12; 13 AK 5).
  13. Team auflösen: Die Spieler:innen bleiben, Link und Feedback über den Link gelten (5 PC 1, 7 AK 18).
  14. Das letzte Mitglied verlässt das Team: Status `entfernt`, das Team bleibt samt Link und Abo (5 AK 28, PC 3).
  15. Aufnahme einer Person aus einem anderen Verein → `anderer_verein` ohne Vereinsnamen. Zwei gleichzeitige Aufnahmen derselben Person in zwei Vereine: genau eine gelingt (11 AK 8, 9).
  16. Die letzte Verwaltung tritt aus oder löscht ihr Konto → Status `letzte_verwaltung`, nichts ist gelöscht. Zwei Verwaltungen entfernen sich gleichzeitig: eine bleibt (5 AK 33, 35).
  17. Schnuppern einschalten bei zwei Teams → `SCHNUPPERN_MEHRERE_TEAMS` (App und Kern für die KI gleich); eine Schnuppernde zuordnen → `schnuppert` mit Team (8 AK 5, 12, 15).
  18. Zum Schnuppern zuordnen: mit Team → `schnuppern_hat_team`; ohne festgelegte Anzahl → `schnuppern_anzahl_fehlt`; gesammelt → `SCHNUPPERN_NUR_EINZELN`. Herausnehmen beendet das Schnuppern samt Zählung, erneutes Zuordnen zählt ab null (8 AK 9, 10, PC 1, 2).
  19. Schnuppern einschalten und gleichzeitig einem weiteren Team zuordnen: genau eines gelingt (8 AK 14).
  20. Verein löschen mit falschem Namen → `vereinsname_falsch`. Mit richtigem Namen sind Teams, Spieler:innen, Links, Abos und Abholadressen weg, und alle Personen sind Konten ohne Verein. Das Konto der einzigen Person löscht mit Vereinsname den Verein mit; tritt vorher eine Person bei → `letzte_verwaltung` (11 AK 10–14, PC 3, 4).
  21. Gründen: ohne Bestätigung → `BESTAETIGUNG_FEHLT`; als Vereinsmitglied → `SCHON_IM_VEREIN`; danach ist die Person einzige Verwaltung eines Vereins ohne Team (11 AK 1–4, PC 1).
  22. Konto ohne Verein mit 50 Übungen: Anlegen, Kopieren und «aus Training in die Bibliothek» scheitern, das Übernehmen einer Übung in ein Training gelingt. Zwei gleichzeitige Anlagen bei 49: genau eine gelingt (`rennen.sql`). Eine Trainings-Kopie, die nach dem Insert der Trainingszeile scheitert, ist danach abgeräumt, und der Platz ist wieder frei (12 AK 8, Endstand; das Fenster während des Abräumens ist hingenommen, §3.5). Nach der Aufnahme in ein Team gelingt die 51. sofort, nach dem Austritt nicht mehr. Team-Trainings und Varianten zählen nicht zur Grenze 30 (12 AK 1–4, 8, PC 2).
  23. Link einer Spieler:in in zwei Teams: Abmelden für Termine beider Teams gelingt, für Team 2 nach dem Herausnehmen nicht mehr. Abmelden und gleichzeitiges Herausnehmen aus Team 2: Entweder gelingt die Abmeldung vorher und verfällt mit dem Herausnehmen, oder sie wird mit `gilt_nicht` abgewiesen; nie bleibt eine Meldung ohne Zuordnung (7 AK 7). Die Abholung über beide Abholadressen liefert denselben Link (7 AK 6, 7, 11).
  24. Import der Verwaltung: Treffer im ganzen Verein, auch ohne Team und schnuppernd; Treffer auf Altdubletten ändern keine J+S; über 1000 übernimmt er nichts; geänderter Stand → Status `veraltet`, auch wenn die Vereinsgrenze erst seit der Vorschau erreicht ist (nicht `VEREIN_VOLL`). Ein Import in die Spielerliste eines Teams scheitert, auch für die Verwaltung (9 AK 2, 5, 6, 9, 12).
  25. *(MCP)* Die Verwaltung ohne Mitgliedschaft ändert per MCP eine Spieler:in → `nicht_gefunden`; dieselbe Änderung über die Web-Action im Bereich «Verein» gelingt. Herausnehmen per MCP erst nach Bestätigung; die Rückfrage nennt, dass die Spieler:in nicht gelöscht ist, bei einer Schnuppernden das Schnupper-Ende und enthält keine fremden Team-IDs, nur `stand`; eine geänderte Teammenge ergibt `stand_geaendert`. Die Werkzeugbeschreibung nennt, dass nur die Verwaltung in der Anwendung löscht (13 AK 4, 5, 6, 8). Geprüft über die exportierten Werkzeug-Handler.
  26. Helfer aus §4.1 mit «revoke all», `konto_grenze_vorher`, `vereine_nachziehen` und `staging_nach_sync` sind mit `authenticated` und `anon` nicht aufrufbar (42501).
  27. Ein Verwaltungsmitglied ohne Anzeigenamen: `verein_ansicht` liefert einem Mitglied ohne Verwaltung nur die Rolle, keine E-Mail-Adresse; der Verwaltung die E-Mail-Adresse (5 AK 6, AK 9, OoS 4).
  28. `verein_team_ansicht` liefert für eine schnuppernde Spieler:in und für eine Spieler:in mit nur diesem Team `schnuppert` bzw. `teams[]`, sodass die Bestätigung beim Herausnehmen beides vorher nennt (3 AK 17, 8 AK 13).
  29. *(rennen.sql)* Herausnehmen mit dem Stand aus der Auskunft, während die Verwaltung die Spieler:in gleichzeitig einem weiteren Team zuordnet: Läuft das Zuordnen zuerst, antwortet das Herausnehmen mit `stand_geaendert` und ändert nichts. `spieler_aus_team_nehmen` ohne `p_stand` → `stand_geaendert`, nichts geändert (13 AK 6).
  30. *(psql)* Unter `set local role authenticated` und `request.jwt.claims` mit `sub` und `client_id` (so sieht ein KI-Token für PostgREST aus) scheitern `verein_spieler_entfernen`, `verein_loeschen`, `verein_gruenden` und `delete_account` mit `NUR_IN_DER_ANWENDUNG`, nichts geändert. Dieselben Claims ohne `client_id` (Browser-Sitzung) lassen sie durch (13 OoS 1, PC 1; Epic OoS 8).
  31. Bremse: Zehn Vorschauen mit `anderer_verein` in einer Stunde lösen `gebremst` aus wie zehn mit `nicht_gefunden`; Vorschauen mit `gefunden` zählen nicht (5 AK 13).
  32. `verein_spielerliste` liefert bei 1001 Spieler:innen (Bestand über der Grenze, per Admin unter `replica` angelegt) alle 1001 Zeilen (4 AK 10, `max_rows`).

## 7. Anwendung

Leitlinien für alle Abschnitte:
- **Rollen nach Ort (PO 13).** Unter `/team/[id]/…` handelt jede Person als Mitglied, auch wenn sie der Verwaltung angehört. Die Seiten dort zeigen keine Verwaltungsfunktionen, und ihre Actions rufen nur RPCs mit Mitgliedsprüfung auf (`ist_team_mitglied`, `spieler_im_team`). Verwaltungsfunktionen gibt es nur unter `/verein/…` (Dateien unter W`app/(app)/verein/`). Deren Actions rufen nur die RPCs `verein_*` auf, die als erste Anweisung `ist_verein_verwaltung` prüfen (§4.3). Die Team-RPCs mit Spieler:innen bekommen `p_team` und prüfen die Mitgliedschaft (§4.4). Keine Policy hat eine Verwaltungsklausel; `sp_select` läuft nur über die Teammitgliedschaft (§4.2). Was die Verwaltung ausserhalb ihrer Teams sieht, liefern ausschliesslich DEFINER-RPCs `verein_*`. Lesend gilt für den Bereich «Verein» `ist_verein_mitglied`. Keine Action und kein RPC prüft `Mitglied OR Verwaltung`, keine Action wählt je nach Rolle den einen oder anderen Weg, und es gibt keinen Rollenschalter (§4.1).
- **Höchstens ein Verein je Person.** Die Routen tragen deshalb keine Vereins-ID. `meine_vereinslage()` (§4.3) liefert `verein` (`{id, name, ist_verwaltung, ist_teammitglied}` oder null) und `grenzen` (Bestandsgrenzen 50/30, nur ohne Verein, §7.2). Gecacht wird nur im Request, wie `getMeineTeamsImRequest` (W`lib/queries/teams.ts:34`). Eine fremde Vereins-ID kann so gar nicht erst in eine URL gelangen.
- **Styleguide zuerst** (CLAUDE.md): Neues kommt mit Begründung in W`app/(app)/styleguide`.
- **Wortwahl:** «aufnehmen», nie «einladen» (Abgrenzung zu #518, dort lädt man Trainer:innen zu Terminen ein). «Schnuppertraining», «schnuppert», «Schnuppern»; «Probe» erscheint nirgends mehr ausser in Texten, die ein Team selbst verfasst hat (Story 8 AK 2).

### 7.1 Routen und Navigation

| Route | Zweck | Schutz |
|---|---|---|
| `/verein` (neu) | Übersicht: Vereinsname, Verwaltung, Teams (§7.4). Konto ohne Verein → `redirect("/teams")`. | `PROTECTED_PREFIXES` |
| `/verein/spieler` (neu) | Spielerbestand bzw. Vereinsliste (§7.6), für alle Vereinsmitglieder; Aktionen und Import nur für die Verwaltung | dto. |
| `/verein/team/[teamId]` (neu) | Team führen, nur Verwaltung: Name, Trainer:innen, sich selbst aufnehmen, Spieler:innen zuordnen und herausnehmen, auflösen. Keine Verwaltung oder Team eines anderen Vereins → `redirect("/verein")`, ununterscheidbar. Getrennt von `/team/[id]`, dessen Layout die Mitgliedschaft verlangt (W`app/(app)/team/[id]/layout.tsx:28-29`); die Daten kommen aus `verein_team_ansicht`, nicht aus `getTeam` (RLS). | dto. |
| `/verein/verwaltung` (neu) | nur Verwaltung: Vereinsname, Verwaltungsmitglieder, austreten, Gefahrenzone «Verein löschen» | dto. |
| `/teams` | eigene Teams. Darüber der Einstieg für Konten ohne Verein und für die Verwaltung ohne Team (§7.2). `TeamErstellenButton` (W`app/(app)/teams/page.tsx:32`) entfällt. | wie heute |
| `/team/[id]/…` | wie heute, nur für Mitglieder. Kopf nennt den Verein (Story 1 AK 3) mit Verweis auf `/verein`. | wie heute |
| `/team/[id]/verwaltung` | ohne Umbenennen, Auflösen und Import (§7.4, §7.6) | wie heute |
| `/konto` | Konto löschen mit den Vereinsfällen (§7.3), Hinweis zur Sichtbarkeit der E-Mail-Adresse (§7.4) | wie heute |
| `/registrieren` | **bleibt offen**, unverändert | öffentlich |

- **Entfällt gegenüber dem Plan vom 29.10.:** `/zugang`, `/auth/einladung`, `/willkommen`, `/admin/zugang`, die Weiterleitung `/registrieren` → `/zugang` und der Seitenleisten-Eintrag «Zugänge».
- **`PROTECTED_PREFIXES`** (W`lib/supabase/middleware.ts:10-19`) bekommt `/verein`.
- **Seitenleiste mit Bereich-Wechsler** (kommt mit Story 5; UX-Entscheid, Board «UX/UI-Konzept», Artboard «Navigation»; heute W`components/layout/AppNavClient.tsx:55-88`, W`lib/navigation.ts:24-43`):
  - **Oben ein Wechsler**, der den Bereich wählt: eines der eigenen Teams (alphabetisch) oder «Verein ‹Name›». Ohne Avatare. Die Leiste darunter zeigt **nur die Einträge dieses Bereichs** und immer die Bibliotheken (Übungen, Trainings, Meine Übungen, Meine Trainings). Der bisherige Eintrag «Teams» mit allen Teams als Unterpunkten entfällt; die Teamwahl übernimmt der Wechsler.
  - **Einträge je Bereich:** Team: die Seiten des gewählten Teams (heute im Team-Layout `team/[id]/layout.tsx`). Verein: «Teams» (`/verein`), «Spieler:innen» (`/verein/spieler`) und, nur für die Verwaltung, «Verwaltung» (`/verein/verwaltung`). Ein `TabNav` im Bereich «Verein» gibt es deshalb nicht.
  - **Wer welche Bereiche sieht** (aus `meine_vereinslage()` und den eigenen Teams im selben Request): Mitglied mit Teams: die eigenen Teams und «Verein». Verwaltung ohne Team: nur «Verein». Konto ohne Verein: kein Wechsler, nur die Bibliotheken und der Einstieg `/teams` (§7.2). Rechte hängen daran keine (Rollen nach Ort); der Wechsler ist reine Navigation.
  - **Welcher Bereich aktiv ist,** folgt aus der Adresse: `/team/[id]/…` und Team-Trainings (`imTeamBereich`) → dieses Team; `/verein/…` → Verein. Auf Seiten ohne Bereich (Bibliotheken, `/teams`, `/konto`) bleibt der zuletzt gewählte, gemerkt im Cookie `bereich` (nur Navigation, kein Recht; ein fremder oder verwaister Wert fällt auf den ersten Bereich der Liste zurück). `aktiveBereiche` wird dafür neu geschnitten: `bereich: {art: 'team', id} | {art: 'verein'} | null` statt `teamsSeite`/`teamsBereich`, dazu ein Helfer `bereichAusPfad(pfad, imTeamBereich)` in W`lib/navigation.ts`.
  - **Zähler 50/30 in der Leiste** (mit Story 12): Für Konten ohne Verein steht bei den Bibliotheken die `BestandAnzeige` («12 von 50» bei den eigenen Übungen, «3 von 30» bei den eigenen Trainings), aus `meine_vereinslage().grenzen`, das die Leiste ohnehin liest (§7.2). Für Vereinsmitglieder erscheint er nie (Story 12 PC 3).
  - Nach Aufnahme, Austritt, Gründung und Löschen invalidiert `revalidiereVerein` das Root-Layout (§7.4), damit Wechsler und Zähler sofort stimmen.
- **Kit-Bausteine:** `Card`, `Tabelle`, `Verzeichnis`, `Lozenge` («ohne Trainer:in», «kein Team», «Vereinsverwaltung», «Schnuppern»), `Badge` (Zähler), `SectionMessage`, `Leerzustand`, `Gefahrenzone`, `VerfallBestaetigung`, `AuswahlListe`.
- **Neu im Styleguide, mit Begründung:**
  - `PersonAufnehmen`: ein Ablauf für Team und Verwaltung (§7.5).
  - `NamenBestaetigen`: das Feld zur Namenseingabe aus `TeamGefahrenzone`, herausgelöst für Team auflösen, Verein löschen und Konto löschen.
  - `BestandAnzeige`: «12 von 50» für Konten ohne Verein (§7.2), in der Leiste und an den Einstiegen.
  - `BereichWechsler`: Wahl zwischen den eigenen Teams und dem Verein oben in der Seitenleiste (oben). Begründung: Bisher gab es nur einen Bereich «Teams»; mit dem Verein kommt ein zweiter Bereich mit eigenen Einträgen dazu.
- **Umbenannt:** `ProbeKarte` → `SchnupperKarte`, `ProbeLozenge` → `SchnupperLozenge` (W`components/team/`), samt aller Texte in W`lib/probe.ts`. Der Schnupper-Status liegt neu auf `team_spieler` statt auf `spieler.probe_seit` (§3.2). Die Datenbank behält intern die Namen `probe_*` (Spalte, `team_probetraining`, RPCs). Umbenannt werden nur sichtbare Texte und die KI-Werkzeuge (§7.10).

### 7.2 Einstieg: Konto ohne Verein und Verein gründen

**`/teams` je nach Zustand** (`meine_vereinslage()` und `getMeineTeams()`):

| Zustand | Inhalt |
|---|---|
| Konto ohne Verein | `Leerzustand` statt «Noch kein Team» (W`app/(app)/teams/page.tsx:40-43`), Text nach Story 11 AK 5: einen Verein gründen oder sich von einem Team oder der Verwaltung eines Vereins über die eigene E-Mail-Adresse aufnehmen lassen. Knopf «Verein gründen». |
| Vereinsmitglied ohne Team, Verwaltung | Hinweis: «Als Vereinsverwaltung nimmst du dich im Bereich «Verein» selbst in ein Team auf.» Verweis auf `/verein`. |
| Vereinsmitglied ohne Team, keine Verwaltung | entsteht nur kurz (der Kontext verfällt mit dem letzten Team); wird wie «Konto ohne Verein» behandelt, weil `meine_vereinslage()` dann `verein: null` liefert |
| mit Teams | Karten wie heute. An der Stelle des bisherigen Knopfs steht der Hinweis «Neue Teams legt die Vereinsverwaltung an.» (Story 1 AK 5). Für die Verwaltung steht dort zusätzlich ein Verweis auf `/verein` (Navigation, kein Recht). |

**Dialog «Verein gründen»** (nur für Konten ohne Verein):
- Feld «Name des Vereins», 1–60 Zeichen. Zwilling: `VEREIN_NAME_MAX`, `vereinsNameProblem()` in W`lib/verein.ts` (neu) zum CHECK `verein_name` (§3.1). Leer, nur Leerzeichen oder über 60 Zeichen → Feldfehler (Story 11 AK 2).
- Zwei Pflicht-Checkboxen (Story 11 AK 3):
  1. «Ich bin berechtigt, für diesen Verein zu handeln.»
  2. «Der Verein ist für die Daten seiner Spieler:innen verantwortlich und Ansprechpartner der Spielervertretungen.»
- Ohne beide Häkchen ist «Gründen» gesperrt. Die Action prüft das erneut und übergibt `p_bestaetigt := true`. Das RPC weist `false` mit `BESTAETIGUNG_FEHLT` ab. Gespeichert wird die Bestätigung nirgends (Story 11 OoS 2).
- Action `gruendeVerein(name, bestaetigt)` in W`lib/actions/verein.ts` (neu) ruft `verein_gruenden(p_name, p_bestaetigt)` (§4.3) mit dem Nutzer-Client auf.
  - `SCHON_IM_VEREIN` (Story 11 AK 4, auch das Rennen aus AK 9): «Du gehörst inzwischen einem Verein an.» Danach lädt die Seite neu.
  - Erfolg: `revalidiereVerein`, dann `redirect("/verein")`.
- `/verein` eines Vereins ohne Team zeigt der Verwaltung den Leerzustand aus Story 11 AK 6: Teams anlegen und sich selbst und andere Personen in Teams aufnehmen.

**Bestandsgrenzen für Konten ohne Verein (Story 12)**
- **Lesen:** `meine_vereinslage()` (§3.5, §4.3) liefert neben `verein` das Feld `grenzen` (`uebungen`/`trainings` je `{bestand, max}`), gesetzt nur, wenn die Grenzen gelten. Durchgesetzt werden sie vom Trigger `konto_grenze_vorher` (§3.5). Gezählt wird nach `konto_bestand` (§3.5): eigene Übungen (`source = 'user'`) und Trainings mit `owner_id`, Entwürfe wie veröffentlichte, Kopien eingeschlossen. Team-Trainings, Varianten und Fassungen zählen nicht.
  - Gelesen wird je Request, nie über Requests hinweg gecacht. So fallen die Grenzen sofort, sobald die Person einem Team oder der Verwaltung angehört, und gelten sofort wieder, wenn sie keinem mehr angehört (Story 12 PC 2).
- **Zwillinge:** `KONTO_UEBUNGEN_MAX = 50`, `KONTO_TRAININGS_MAX = 30` in W`lib/konto-grenzen.ts` (neu), mit Verweis auf die Trigger aus §3.5.
- **Anzeige** `BestandAnzeige`, **nur** für Konten ohne Verein (Story 12 PC 3):
  - in der Seitenleiste bei den Bibliotheken (UX-Entscheid, §7.1)
  - in den Übersichten «Meine Übungen» (`/?mine=1`) und «Meine Trainings» (`/trainings?mine=1`)
  - an den Einstiegen der Oberfläche (aus W`app` und W`components`):
    - Übung anlegen: Knopf «Übung erstellen» (W`app/(app)/page.tsx:107`) und die Seite `/neu`
    - Training anlegen: Knopf «Training erstellen» (W`app/(app)/trainings/page.tsx:51`) und die Seite `/training/neu`
    - Übung kopieren: «Kopieren» im ⋮-Menü eigener Übungen (`OwnerActions`, W`components/exercise/OwnerActions.tsx:99`) und der Knopf «Kopieren» auf fremden Übungen (`UebungKopierenButton`, W`components/exercise/UebungKopierenButton.tsx:46`, auf `/uebung/[slug]`); Action `kopiereUebung` (W`lib/actions/exercises.ts:259`)
    - In die Bibliothek kopieren: `InBibliothekButton` «In meine Bibliothek kopieren» (W`components/training/InBibliothekButton.tsx:48`; in Trainingsansicht, `AnsichtFlaeche` und Editor); Action `kopiereInBibliothek` (W`lib/actions/fassung.ts:297`)
    - Training übernehmen: «Übernehmen» im Menü `TrainingAktionen` (W`components/training/TrainingAktionen.tsx:227`), Ziel «persönlich» (`kopiereTraining`, W`lib/kern/kopie.ts:154`)
- **Ab der Grenze** (auch bei Bestand darüber) sind diese Knöpfe und Menüeinträge gesperrt, mit einem Hinweis, dass nichts mehr frei ist (Tooltip bzw. `SectionMessage` vor jeder Eingabe auf `/neu` und `/training/neu`, Story 12 AK 5). Die Datenebene weist trotzdem ab, falls eine Oberfläche veraltet ist.
- **Abweisung durch die Datenebene:** Die Marker `KONTO_UEBUNGEN_VOLL` und `KONTO_TRAININGS_VOLL` (§5.2) übersetzt der Fachkern in den Text aus Story 12 AK 6: wie viele die Person besitzt, dass Löschen Platz schafft, dass die Grenzen in einem Verein nicht gelten. Gleiche Quelle für App und KI (§7.10).
- **Nicht geprüft:** das Übernehmen einer Übung in ein Training (`ordneUebungZu`, W`lib/kern/fassung.ts:146`, Story 12 AK 4). Es legt eine Fassung an und keine Übung, und der Trigger feuert dort nicht.
- **Alles andere bleibt möglich:** Ändern, Veröffentlichen, Auf-Entwurf-Setzen und Löschen (Story 12 PC 1). Die Grenzen sperren nur INSERT-Pfade.

### 7.3 Verein löschen und Konto löschen

**Verein löschen** (`/verein/verwaltung`, Gefahrenzone):
- Vorher sichtbar (Story 11 AK 11): Zahl der Teams, Zahl der Spieler:innen inklusive ohne Team, «lässt sich nicht rückgängig machen», dazu wie bei Team auflösen die Inhalte der Teams. Quelle ist `verein_ansicht` (Zahlen, §4.3), nicht die RLS.
- `NamenBestaetigen` mit dem aktuellen Vereinsnamen. Verglichen wird wie in SQL nach `normalize(btrim(…), nfc)`: Gross- und Kleinschreibung zählt, Leerzeichen am Rand nicht (Story 11 AK 10). Zwilling: `vereinsNameStimmt()` in W`lib/verein.ts`.
- Action `loescheVerein(name)` ruft `verein_loeschen(p_verein, p_name)` (§4.3) auf. Das RPC prüft unter Vereinssperre erneut Namen und Recht (Story 11 AK 14, AK 15).
  - Status `vereinsname_falsch` (Name inzwischen geändert): Dialog bleibt offen, zeigt den neuen Namen.
  - Status `geloescht` mit `bilder` (Fassungs-Bilder aller Team-Trainings, gleiches Muster wie `verein_team_aufloesen`). Die Action räumt sie über `raeumeVerwaisteBilder` mit dem Service-Role-Client nach (wie W`lib/actions/teams.ts:185-189`), denn mit dem Verein ist auch das Storage-Recht weg.
  - Danach `revalidiereVerein`, `redirect("/teams?verein_weg=1")` mit Flash «Der Verein ist gelöscht. Deine eigenen Übungen und Trainings bleiben.» (Story 11 PC 4).
- **Andere Personen** des gelöschten Vereins landen über die bestehenden Wege auf `/teams` (`team/[id]/layout.tsx:29`, `/verein` ohne Verein → `/teams`) und sehen dort den Einstieg für Konten ohne Verein.
- **Spielervertretungen** sehen an Link, Abo und Abholadresse dieselbe Seite wie bei jedem ungültigen Link (Story 11 PC 5). Das braucht keinen eigenen Code, weil Token und Abholzeilen mit dem Verein verschwinden.

**Konto löschen** (`/konto`, W`app/(app)/konto/KontoClient.tsx`, Action `deleteAccount` W`lib/actions/auth.ts:173`):
- Neues RPC `konto_loeschen_info()` (§4.3) liefert `{fall, verein, teams_bleiben}` mit `fall ∈ {frei, letzte_verwaltung, einzige_person}`.

| Fall | Dialog |
|---|---|
| `frei` | wie heute. Bei `teams_bleiben > 0` der Hinweis, dass Teams, deren letztes Mitglied man ist, bestehen bleiben (Story 5 AK 29). |
| `letzte_verwaltung` (dem Verein gehören weitere Personen an) | Löschen gesperrt. Text nach Story 5 AK 34 und Story 11 AK 13: zuerst eine weitere Person in die Verwaltung aufnehmen oder den Verein löschen, mit Verweis auf `/verein/verwaltung`. |
| `einzige_person` | `NamenBestaetigen` mit dem Vereinsnamen; Text: Der Verein wird samt allen Teams und Spieler:innen gelöscht (Story 11 AK 12). |

- Die Action übergibt `p_vereinsname` an `delete_account(p_vereinsname text default null)` (§4.4). Das RPC prüft erneut, wer dem Verein angehört, und den Namen (Story 11 AK 14).
- **Fehler werden angezeigt, ab Story 1** (dort mit `letzte_verwaltung`, ab Story 11 auch die Fälle der einzigen Person). Heute bricht die Action still ab (`if (error) return;`, W`lib/actions/auth.ts:215-216`). Neu liefert sie einen Zustand (`useActionState`) mit dem Klartext zu den Status `letzte_verwaltung` (auch wenn inzwischen eine weitere Person dazugekommen ist) und `vereinsname_falsch`. Das Konto bleibt dann unverändert (Story 5 PC 5).
- **Bilder:** `teamFassungsKandidaten` und `raeumeGeloeschteFassungsBilder` (W`lib/actions/auth.ts:157-168`, `:204`, `:234`) entfallen. Ein Team stirbt nicht mehr über die `auth.users`-Kaskade, weil `team_aufloesen_wenn_leer` wegfällt (§3.6). Im Fall `einzige_person` löscht `delete_account` den Verein im Daten-Teil und liefert `bilder` wie `verein_loeschen`. Die Action räumt sie nach erfolgreichem RPC und vor `deleteUser` auf.
- **Aus der Verwaltung austreten** (`/verein/verwaltung`): Für das letzte Verwaltungsmitglied ist der Knopf gesperrt, mit demselben Text wie oben. Das gilt auch, wenn es als einzige Person dem Verein angehört (Story 11 AK 13). Den Fall prüft das RPC (Status `letzte_verwaltung`, §4.3).

### 7.4 Vereinsverwaltung (Bereich «Verein»)

**`/verein` (Übersicht)** aus `verein_ansicht(p_verein)` (§4.3):

| Für | Inhalt |
|---|---|
| alle Vereinsmitglieder | Vereinsname; Anzeigenamen der Verwaltung, die eigene Person als «du» (Story 5 AK 1, AK 3); ein Verwaltungsmitglied ohne Anzeigenamen erscheint nur mit der Rolle «Vereinsverwaltung», nie mit E-Mail-Adresse (AK 9, OoS 4); alle Teams alphabetisch. Eigene Teams verweisen auf `/team/[id]`, andere zeigen nur den Namen (AK 8). |
| zusätzlich Verwaltung | E-Mail-Adressen der Verwaltung, auch ohne Anzeigenamen (AK 6); je Team die Trainer:innen mit E-Mail (AK 4), die Spielerzahl, gezählt wie die Grenze 100 (AK 5), Lozenge «ohne Trainer:in» (AK 7) und Verweis auf `/verein/team/[teamId]`. `SectionMessage`: Die Inhalte eines Teams sieht man nur als Mitglied im Team (AK 11). Knopf «Team anlegen». |

- **«Team anlegen»:** Dialog mit Name (Zwilling `teamNameProblem()`), Aufruf `verein_team_anlegen(p_verein, p_name)` (§4.3). Die anlegende Person wird **nicht** Mitglied (Story 5 AK 17); eine Checkbox «selbst Mitglied» gibt es nicht.
  - Bei 30 Teams ist der Knopf gesperrt, mit Hinweis (AK 18). `VEREIN_TEAMS_VOLL` deckt das Rennen ab.
  - Status `grund: 'name_vergeben'` nennt das Team, das den Namen trägt (AK 20, AK 21); `TEAMNAME_VERGEBEN` deckt nur das Rennen ab.

**`/verein/team/[teamId]`** aus `verein_team_ansicht(p_team)`:
- **Name** mit `TeamNameFeld`, gespeist über `verein_team_umbenennen` statt des direkten UPDATE (W`lib/actions/teams.ts:49-70`, Story 5 AK 19–22).
- **Trainer:innen** mit E-Mail, «Entfernen» bei jeder Person (AK 14, `verein_team_mitglied_entfernen`), «Person aufnehmen» über `PersonAufnehmen` (§7.5, AK 13) und «Mich in dieses Team aufnehmen» (AK 12, `verein_team_beitreten(p_team)`, §4.3).
- **Spieler:innen des Teams** mit Name und Jahrgang aus `verein_team_ansicht` (dazu `schnuppert` und `teams[]`), je Zeile «Aus dem Team nehmen» (`verein_spieler_aus_team_nehmen`, Bestätigung wie in §7.6, ohne den Hinweis für Mitglieder, dass nur die Verwaltung löscht; sie nennt schon vorher das Ende des Schnupperns und, wenn es das letzte Team ist, «danach keinem Team mehr zugeordnet», Story 3 AK 17, Story 8 AK 13), dazu «Spieler:innen zuordnen» (§7.6). Weitere Teaminhalte zeigt die Seite nicht (AK 10).
- **Gefahrenzone «Team auflösen»:** `NamenBestaetigen` mit dem Teamnamen. Die Zahlen (Trainings, Termine, Spiele, Kader) kommen aus `verein_team_ansicht`, dazu «X Spieler:innen bleiben im Verein» (AK 24, AK 25). Action `loeseTeamAufImVerein` ruft `verein_team_aufloesen` (§4.3); den Bilder-Nachlauf übernimmt sie aus `auswerten` (W`lib/actions/teams.ts:163-190`).
- `getTeamAufloesungsInfo` (W`lib/queries/teams.ts:86`) entfällt. Die Zahlen gibt es nur noch hier, denn auf der Team-Seite gibt es kein Auflösen mehr.

**`/verein/verwaltung`:**
- Vereinsname (Muster `TeamNameFeld`, 1–60 Zeichen, `verein_umbenennen`, Story 5 AK 23).
- Liste der Verwaltung mit E-Mail, «Entfernen» bei anderen (AK 31), «Austreten» bei sich selbst (AK 32), beides über `verein_verwaltung_entfernen`. Beim letzten Mitglied ist beides gesperrt (§7.3).
- «In die Verwaltung aufnehmen» über `PersonAufnehmen` (§7.5, AK 30).
- Gefahrenzone «Verein löschen» (§7.3).

**Team-Seiten nach Rollen nach Ort** (`/team/[id]/verwaltung`, W`app/(app)/team/[id]/verwaltung/page.tsx`):
- `TeamNameFeld` wird zur reinen Anzeige mit Hinweis «Umbenennen und Auflösen macht die Vereinsverwaltung im Bereich «Verein».» (Story 5 AK 27), auch für Mitglieder, die der Verwaltung angehören.
- **`MitgliederListe`:**
  - Lozenge «Vereinsverwaltung» bei Mitgliedern, die ihr angehören (AK 15; `team_mitglieder` additiv `ist_verwaltung`).
  - Aufnehmen über `PersonAufnehmen` (§7.5).
  - Entfernen jedes Mitglieds, auch eines Verwaltungsmitglieds (AK 16).
- **`TeamGefahrenzone`** behält nur «Team verlassen». Als letztes Mitglied geht das ohne Teamnamen, mit dem Text «Das Team bleibt bestehen; nur die Vereinsverwaltung löst es auf.» (AK 28).
  - Der Status `aufloesung_noetig` entfällt in W`lib/actions/teams.ts:150-158`, `:182-184`.
  - `loeseTeamAuf` (`:244`) wandert in die Vereins-Actions.

**Weitere Stellen:**
- **Konto:** Beim Anzeigenamen (W`app/(app)/konto/AnzeigenameForm.tsx`) steht, dass die Vereinsverwaltung die E-Mail-Adresse jeder Trainer:in des Vereins sieht (Story 5 PC 8).
- **Kern W`lib/kern/verein.ts`** (neu): `meineVereinslage`, `vereinAnsicht`, `vereinTeamAnsicht`, `gruendeVerein`, `benenneVereinUm`, `loescheVerein`, `legeTeamAn`, `benenneTeamUm`, `loeseTeamAuf`, `nimmInVerwaltungAuf`, `entferneAusVerwaltung`, `nimmMichInsTeam`, `vereinSpielerliste`, `legeSpielerImVereinAn`, `aendereImBestand`, `holeLinkImBestand`, `erneuereLinkImBestand`, `loescheImBestand`, `ordneZu`, `nimmAusTeam`, `pruefeBestandImport`, `importiereInBestand`. Die Actions laufen über W`lib/actions/adapter.ts`. Kein MCP-Werkzeug ruft diese Funktionen oder eine RPC `verein_*` auf; ein grep-Wächter in `check:kern` sichert das (§7.10).
- **Revalidieren:** W`lib/revalidate.ts` bekommt `revalidiereVerein()`. Es invalidiert `/verein` (Layout), `/teams`, die Team-Layouts aller Teams des Vereins und bei Mitgliedschaftsänderungen das Root-Layout (Seitenleiste). Aufgerufen wird es nach Stammdaten-, Zuordnungs-, Aufnahme- und Löschvorgängen.

### 7.5 Aufnahme ins Team und in die Verwaltung (ersetzt Einladungen)

Es gibt nur noch die sofortige Aufnahme eines bestätigten Kontos per E-Mail-Adresse, ins Team wie in die Verwaltung, ohne Annahme. Es gibt keine Einladung, keine Mail, kein `inviteUserByEmail` und keine neue Ausnahme in W`lib/supabase/admin.ts`.

**Ablauf `PersonAufnehmen`** (Team: `MitgliederListe` und `/verein/team/[teamId]`; Verwaltung: `/verein/verwaltung`):
1. **E-Mail-Adresse eingeben.** Die Vorschau läuft über `finde_trainer(p_team, p_email)` (Team, Mitgliedsprüfung) bzw. `verein_finde_person(p_verein, p_email, p_team)` (Verwaltung; mit `p_team` unter `/verein/team/[teamId]`, ohne für `/verein/verwaltung`, §4.3). Beide teilen die bestehende Bremse für erfolglose Versuche (Story 5 AK 13). Ergebnisse:
   - `gefunden` mit Anzeigename
   - `bereits_mitglied` bzw. `bereits_verwaltung`
   - `anderer_verein`: «Diese Person gehört schon einem Verein an. Aufnehmen lässt sie sich erst, wenn sie ihn verlassen hat.» Ohne Vereinsnamen, derselbe Wortlaut wie beim Trigger-Netz `ANDERER_VEREIN` (§5.3; Story 11 AK 8).
   - `nicht_gefunden`: «Zu dieser Adresse gibt es kein bestätigtes Konto. Die Person registriert sich zuerst selbst bei FutAssist.» Die Adresse tauschen die Beteiligten ausserhalb der Anwendung aus (PO 10).
   - `gebremst`
2. **Vor «Aufnehmen»** steht im Dialog die Tragweite nach Story 11 AK 16: Die Person gehört damit dem Verein an, kann solange keinem anderen Verein beitreten und keinen eigenen gründen, und die Verwaltung und die Mitglieder ihres Teams sehen ihre E-Mail-Adresse, damit das richtige Konto aufgenommen wird.
3. **«Aufnehmen»** ruft `add_team_member` (Team), `verein_team_aufnehmen` (Verwaltung in ein Team) bzw. `verein_verwaltung_aufnehmen` auf (§4.3, §4.4). Unter Vereinssperre prüfen beide erneut, ob die Person inzwischen einem anderen Verein angehört (`ANDERER_VEREIN`, gleicher Text, Story 11 AK 9), und setzen dann die Mitgliedschaft.
- **Sich selbst aufnehmen** (nur Verwaltung, `/verein/team/[teamId]`) braucht weder Vorschau noch Tragweite, denn die Person gehört dem Verein schon an.
- **Recht nach Ort:** In der `MitgliederListe` eines Teams nimmt jedes Mitglied auf, mit Mitgliedsprüfung. Unter `/verein/team/[teamId]` nimmt die Verwaltung in jedes Team ihres Vereins auf, mit Verwaltungsprüfung. Ein Verwaltungsmitglied, das zugleich Mitglied ist, nutzt im Team den Mitgliederweg.
- **Konto ohne Verein:** Nach der Aufnahme sieht es beim nächsten Request seine Teams bzw. den Bereich «Verein», und die Bestandsgrenzen fallen (§7.2).

### 7.6 Spielerbestand und Vereinsliste

**`/verein/spieler`** aus `verein_spielerliste(p_verein)` (§4.3):
- **Für alle Vereinsmitglieder** (Story 4):
  - Vorname, Nachname, Jahrgang und Teams als Lozenges, Lozenge «kein Team»; Schnuppernde sind eingeschlossen; geordnet nach Vorname, dann Nachname (AK 1).
  - Altdubletten erscheinen als getrennte Zeilen, ohne Kennzeichnung (PC 2, OoS 3).
- **Suchen und Eingrenzen auf dem Server:** Die Seite übergibt Suche und Filter an `verein_spielerliste` (`p_suche`, `p_teams`, `p_ohne_team`, `p_jahrgaenge`, §4.3); gesucht wird immer über den ganzen Verein, bis 1000 Zeilen ohne Seitenschnitt (AK 10):
  - Suche über einen Teil des Vor- oder Nachnamens mit `p_suche`, so tolerant wie die Übungssuche (lower und unaccent, Teilstring, AK 6, OoS 4)
  - Filter mit Mehrfachauswahl: Teams und «ohne Team» (AK 7), Jahrgänge (AK 8); innerhalb eines Filters ODER, zwischen Suche und Filtern UND (AK 9)
  - jede Zeile nennt weiterhin alle Teams der Spieler:in (AK 9)
  - zwei Leerzustände: Verein ohne Spieler:innen, keine Treffer (AK 11)
- **Mitglieder ohne Verwaltung** sehen nur diese vier Angaben, auch bei Spieler:innen der eigenen Teams. Das RPC liefert ihnen J+S und Link-Status gar nicht erst (AK 3). Dazu der Hinweis «Die Vereinsverwaltung ordnet Spieler:innen Teams zu.» (AK 5) und keine Aktionen (OoS 2).
- **Verwaltung** (Story 6, Story 3, Story 8):
  - zusätzlich die Spalte J+S (Story 6 AK 1)
  - je Zeile:
    - «Bearbeiten» (`verein_spieler_aendern`, AK 2)
    - «Link holen» (`verein_spieler_link_holen`) mit dem Hinweis für Spieler:innen ohne Team (AK 9, AK 10)
    - «Link erneuern» (`verein_spieler_link_erneuern`): Der Dialog nennt aus `verein_spieler_teams` die betroffenen Teams und ob die Eltern den neuen Link über eine Abholadresse holen können (Story 6 AK 11, Story 7 AK 15–16)
    - «Einem Team zuordnen»: Zielteam wählen, Aufruf `verein_spieler_zuordnen` mit einer Spieler:in; «zum Schnuppern» (`p_schnuppern = true`) nur bei einer Spieler:in ohne Team, mit dem Hinweis aus Story 8 AK 7 (Story 8 AK 8)
    - «Löschen» (`verein_spieler_entfernen`): Die Bestätigung nennt die Teams oder «keinem Team zugeordnet» und dass die Spieler:in samt privatem Link und Meldungen endgültig entfällt (Story 6 AK 12, AK 13; Story 3 AK 14)
  - über der Liste:
    - «Spieler:in erfassen» (ohne Team, `verein_spieler_anlegen`, Story 6 AK 3)
    - «Gesammelt zuordnen»: Mehrfachauswahl, dann Zielteam, dann `verein_spieler_zuordnen(p_team, p_spieler uuid[], p_schnuppern)` mit `p_schnuppern = false`, ganz oder gar nicht, ohne Schnuppern (Story 3 AK 20, AK 21; Story 8 OoS 6)
    - Import wie heute über einen Icon-Knopf «CSV importieren» in der Kopfzeile der Liste, der den Dialog öffnet (§7.9)
- **Abweisungen beim Zuordnen** (einzeln und gesammelt) nennen, was das Team schon oder mit gleichen Angaben führt, und um wie viele die Grenze 100 überschritten würde (Story 3 AK 6, AK 22). Beim Schnuppern kommen dazu (Story 8 AK 9, AK 10, AK 12):
  - schon einem Team zugeordnet → ohne Schnuppern zuordnen
  - keine Anzahl festgelegt → ein Mitglied legt sie zuerst fest
  - schnuppert in Team X → dort zuerst Schnuppern beenden oder herausnehmen
- **Erfassen und Ändern**, abgewiesen mit dem Status `doppelt` und den Teams der bestehenden Spieler:in oder «keinem Team zugeordnet»; beim Erfassen dazu der Hinweis auf den Zusatz im Vornamen (Story 6 AK 4, AK 5). Mit `VEREIN_VOLL` (AK 7). Eine inzwischen gelöschte Spieler:in → `SPIELER_NICHT_GEFUNDEN` mit Klartext (AK 15).

**Spielerliste des Teams** (W`components/team/SpielerListe.tsx`, Seite `/team/[id]/verwaltung`):
- **Nicht in diesem Plan: Filter** nach Name, Kader und Jahrgang mit dem DS-`FilterKnopf`. Sie kommen als eigenständige Story #601 nach dem Epic. Technisch reicht ein Filter im Browser über höchstens 100 Zeilen; ob `ladeSpielerliste` dafür die Kaderzugehörigkeit je Zeile schon liefert, klärt diese Story.
- Je Zeile die weiteren Teams als Lozenges «auch in D2» (Story 3 AK 9), aus `ladeSpielerliste` mit dem additiven Feld `weitereTeams`.
- **Erfassen** über `spieler_aufnehmen`, Ändern über `spieler_aendern(p_team, …)`, Link über `spieler_link_holen`/`spieler_link_erneuern(p_team, …)` (Erneuern-Dialog aus `spieler_teams`), alle nur mit Mitgliedsprüfung im übergebenen Team (Rollen nach Ort, §4.4). Der Status `doppelt` trägt die Teams der bestehenden Spieler:in (§4.4); `SPIELER_DOPPELT` bleibt nur Netz aus dem Trigger `spieler_vorher`. Der Kern wählt den Text:
  - im eigenen Team: steht schon auf der Liste, plus Hinweis auf den Zusatz im Vornamen (Story 2 AK 3)
  - nur in anderen Teams: deren Namen und «Zuordnung mit der Vereinsverwaltung klären» (Story 2 AK 4)
  - ohne Team: im Verein geführt, keinem Team zugeordnet, Zuordnung mit der Verwaltung klären (Story 3 AK 19)
  - **Ändern** analog (Story 2 AK 5–7). Grenzen erst danach, mit getrennten Texten für `SPIELERLISTE_VOLL` (100) und `VEREIN_VOLL` (1000) (Story 1 AK 7, Story 2 AK 9).
  - Einen Vorschlag beim Tippen oder «Diese Person zuordnen» gibt es in der Teamliste nicht. Zuordnen ist der Verwaltung im Bereich «Verein» vorbehalten.
- **Menü je Zeile:**
  - «Aus dem Team nehmen», bestätigt über `VerfallBestaetigung`, Aufruf `spieler_aus_team_nehmen(p_team, p_spieler, p_stand)`; der Dialog liest vorher `spieler_teams` und gibt dessen `stand` als `p_stand` mit, bei `stand_geaendert` zeigt er den neuen Stand. Der Text nennt:
    - Die Spieler:in bleibt samt Link im Verein (Story 3 AK 14).
    - Sie wird dadurch nicht gelöscht; aus dem Verein löscht sie nur die Vereinsverwaltung (AK 13).
    - Künftige Abmeldungen, Spiel-Meldungen und Kader in diesem Team verfallen (AK 15).
    - Beim letzten Team: danach ohne Team im Spielerbestand des Vereins; nur noch die Vereinsverwaltung ändert sie, ordnet sie einem Team zu oder löscht sie (AK 16).
    - Bei einer schnuppernden Spieler:in: Das Schnuppern endet samt Zählung (Story 8 AK 13).
  - **Kein Löschen:** Die Team-Spielerliste hat keine Aktion «Aus dem Verein löschen», für kein Mitglied und auch nicht, wenn alle Teams der Spieler:in eigene sind (Story 3 AK 12, OoS 5; PO 01.11.2026). Wer der Verwaltung angehört, löscht im Bereich «Verein» (Rollen nach Ort).
  - Ein «Verschieben» gibt es nicht.
- **Kein Import mehr** (Story 9 AK 12): `SpielerImport` fällt aus `SpielerListe.tsx:28`, `:495` heraus.
- **Herausgenommene an begonnenen Terminen** bleiben mit Namen und nachtragbar (Story 3 AK 18), über `termin_teilnehmer.nicht_mehr_im_team` (§4.4). Das Nachtragen prüft dort gegen den festgehaltenen Stand des Termins (`termin_teilnahmen` bzw. `spiel_teilnahmen`), nicht gegen `spieler_im_team`. Das gilt auch für `termin_anwesenheit_setzen` per KI (§7.10).
- **Schnuppern einschalten** (`SchnupperKarte`, `spieler_probe_setzen(p_team, …)`; Folgen über `spieler_probe_folgen(p_team, …)`):
  - Bei weiteren Teams gesperrt, mit dem Text aus Story 8 AK 6.
  - Beim Einschalten steht der Hinweis aus AK 7.
  - Die Einstellung des Schnuppertrainings nennt, für wen es gedacht ist (AK 4).

**Kern W`lib/kern/spieler.ts`:**
- `ladeSpielerliste` (`:110`) liest `team_spieler` ⋈ `spieler` (RLS: nur eigene Teams) und liefert additiv `weitereTeams` (Namen aus `spieler_weitere_teams`, DEFINER, §4.3). Ein Feld `darfLoeschen` gibt es nicht, weil Mitglieder nicht löschen.
- Alle Team-Funktionen des Kerns (`ladeSpieler` `:170`, `aendereSpieler`, Link, Schnuppern) verlangen ein `teamId` und geben es als `p_team` weiter; nie `spieler.team_id`. Die Verwaltung pflegt den Bestand nicht über diese Funktionen, sondern über W`lib/kern/verein.ts` und die RPCs `verein_*`. Damit muss der Team-Kern keine Spieler:in ohne Team kennen.
- `teamDesSpielers` entfällt.
- `entferneSpieler` (`:157`) wird zu `nimmAusTeam` (`spieler_aus_team_nehmen`). Ein Löschen hat der Team-Kern nicht mehr; das Löschen der Verwaltung liegt in W`lib/kern/verein.ts` (`verein_spieler_entfernen`).
- **Revalidierung** in W`lib/actions/spieler.ts` über alle `teamIds` und `revalidiereVerein`.

### 7.7 Eltern-Link (`spieler_link_ansicht`, JSON-Vertrag additiv)

```jsonc
{ "verein": "FC Wyler",                 // neu: verantwortlich für die Daten (Story 11 PC 2)
  "team": "D1",                          // bleibt: genau ein Team → Teamname, sonst Vereinsname
  "teams": ["D1", "E2"],                 // neu: alphabetisch, ohne interne IDs, auch ohne Termine (Story 7 AK 3)
  "spieler": {…},
  "probe": {…}, "probe_info": "…",       // bleiben; nur bei genau einem Team, Status aus team_spieler (Story 8, §3.2)
  "termine": [{ …, "team": "D1", "kader": [...] }] }   // je Termin neu: team
```

- **Termine** kommen aus allen zugeordneten Teams über `termin_gilt_fuer`. Kader nur je Termin-Team, fremde Kader nie.
  - Ordnung aus der Datenebene: heute begonnene zuerst, dann nach Beginn, bei gleichem Beginn nach Teamname. Die Seite gruppiert nach Monat (Story 7 AK 1, AK 2).
- **Ab- und Anmelden** folgt Meldeweise, Frist, Sperre ab Beginn und Kader des Termin-Teams (AK 6). Gilt der Termin nicht mehr für die Spieler:in, weil sie nicht mehr zugeordnet ist oder keinem Kader angehört, kommt der bestehende Grund `gilt_nicht` zurück. Sein Text in `ABMELDUNG_TEXT.giltNicht` (W`lib/spieler.ts:214`) nennt künftig beide Ursachen (AK 7).
- **Leerzustände:**
  - Teams ohne anstehende Termine (AK 4).
  - Ohne Team: `teams = []`, `termine = []`, Text «Termine erscheinen, sobald … einem Team zugeordnet ist» (AK 5). Abo-Knopf und «Fragen und Feedback» bleiben (AK 9, AK 18). Die Gültigkeit fürs Feedback prüft `feedback_link_gueltig` (§3.7).
- **Fragen und Feedback:** `DRINGEND` (W`components/privat/FeedbackLink.tsx:15`) wird zur Funktion: an die Trainer:innen, bei einer Spieler:in ohne Team an die Vereinsverwaltung (AK 19).
- **Ungültiger Link:** `LINK_TEXT.ungueltig` (W`lib/spieler.ts:328-329`) bekommt den Text aus Story 7 AK 17: den aktuellen Link über eine Abholadresse, bei den Trainer:innen oder bei der Vereinsverwaltung holen, ohne Team oder Spieler:in zu nennen.
  - Ungültig wird ein Link beim Löschen aus dem Verein, beim Erneuern und beim Löschen des Vereins.
  - Gültig bleibt er beim Herausnehmen und beim Auflösen eines Teams.
- **«Was KiFu speichert»** (`ABHOLUNG_TEXT.speichert`, W`lib/spieler.ts:432-434`, auf Abholseite und Link):
  - nennt den Verein mit Namen als verantwortlich (Story 11 PC 2)
  - nennt neu, wer was sieht (Story 4 PC 4): Name, Jahrgang und Teams alle Trainer:innen des Vereins; alle Angaben die Trainer:innen ihrer Teams; J+S und Link auch die Vereinsverwaltung; dazu die KI-Assistenten dieser Personen und wer den Link hat
  - nennt, dass die Angaben beim Herausnehmen aus einem Team im Verein bleiben und erst beim Löschen aus dem Verein verschwinden (Story 3 PC 12)
  - Eine Person als Verantwortliche nennt der Text nicht (Story 4 OoS 6).
- **Web:**
  - `LinkAnsicht` (W`lib/privater-link.ts:88-99`): `verein`, `teams`, `termine[].team`.
  - `ElternAnsicht` (W`components/privat/ElternAnsicht.tsx:49-56`, `:169`): Teamliste, Teamname je Termin, Leerzustände.
  - Abholseite: `abholung_ansicht` liefert additiv `verein` (W`lib/abholung.ts:19-23`), damit die Seite den Verein vor dem Abholen nennt.

### 7.8 Kalender

- **Spieler-Abo** (W`app/api/kalender/spieler/[datei]/route.ts:27-29`, W`lib/spieler-abo.ts:51`, `:75-86`, `:112`):
  - `spieler_abo_termine` liefert die Termine aller Teams mit `team` je Termin. `aboEintrag(t, t.team, …)` behält den Teamnamen im Titel (Story 7 AK 8).
  - `aboKalenderName` wird konstant «Trainings und Spiele», ohne Teamnamen (AK 10). Bereits abonnierte Kalender behalten allenfalls ihren Namen (OoS 6).
  - Ohne Team: gültiger, leerer Feed; dieselbe Adresse liefert später die Termine (AK 9, PC 3).
  - `probe` gilt nur für Termine des einen Teams, in dem die Spieler:in schnuppert (Status aus `team_spieler`, §3.2).
  - Am Schema ändert sich nichts. Jede bestehende Abo-Adresse liefert weiter (PC 5).
- **Trainer-Abo** (`kalender_abos`): unverändert je Team, gebunden an die Mitgliedschaft. Konten ohne Verein haben keines. Ein Vereins-Abo gehört nicht zum Epic.

### 7.9 CSV-Import (nur Verwaltung) und Selbstabholung

**Import in den Spielerbestand (Story 9)**
- **UI:** `SpielerImport` (W`components/team/SpielerImport.tsx`) zieht nach `/verein/spieler` und bekommt `vereinId` statt `teamId`. Bedienung wie heute (UX-Entscheid): ein Icon-Knopf «CSV importieren» öffnet den Dialog, schmal für die Dateiwahl, breit für die Vorschau. Nur die Verwaltung sieht den Knopf.
  - Lesen, Spalten erkennen, Zeilen prüfen und Zusammenfassen bleiben unverändert (W`lib/spieler-import.ts`).
  - Neu vor der Dateiwahl der allgemeine Hinweis aus AK 4: neue Spieler:innen kommen ohne Team, alle Trainer:innen sehen sie mit Name und Jahrgang, löschen lässt sich nur einzeln. Die **Zahl** der neuen Spieler:innen nennt die Vorschau unmittelbar vor der Übernahme (AK 4).
- **RPC** `verein_spieler_importieren(p_verein, p_zeilen, p_erwartet default null)` (§4.3). Erste Prüfung `ist_verein_verwaltung` (AK 11). Abgleich über den ganzen Verein nach dem Namensschlüssel der Doppelerfassung, auch gegen Spieler:innen ohne Team und Schnuppernde (AK 2).
  - **Vorschau:**
    - `neu`
    - `js`: bestehend, J+S ändert sich
    - `gleich`
    - `mehrfach`: die Zeile trifft mehrere Altdubletten; ändert nie J+S und macht allein nicht bestätigbar (AK 5)
    - je bestehender Treffer `teams[]` oder leer (AK 3)
  - **Grenze:** Vereinsgrenze nur bei `neu > 0`, dann `ueber = bestand + neu − 1000`, angezeigt vor der Übernahme (AK 6, AK 7). Keine Teamgrenze (AK 8).
  - **Übernahme** mit `p_erwartet {neu: [zeile], js: [zeile], bestand}`. Weicht der Stand ab oder ist die Vereinsgrenze seit der Vorschau erreicht → Status `veraltet` mit neuer Vorschau und Hinweis (§4.3), nicht der Marker `VEREIN_VOLL`; der Dialog zeigt die Vorschau mit Hinweis neu (AK 9). Muster wie heute `SPIELERLISTE_GEAENDERT` (W`lib/kern/spieler.ts:300-303`).
  - Alles oder nichts (PC 4). Keine Zuordnung, kein Schnuppern, keine Termine, `spielerzahl_freigeben` wird nicht aufgerufen (PC 5).
  - **Ergebnistext** nach AK 10: aufgenommen, J+S geändert, ohne Team, im Spielerbestand Teams zuordnen.
- **Abbau des Team-Imports:**
  - `spieler_importieren(p_team, …)` wird gedroppt (§4.4). Damit ist jeder Team-Import abgewiesen, auch für Verwaltungsmitglieder (AK 12).
  - `pruefeSpielerImportAktion` und `importiereSpielerAktion` (W`lib/actions/spieler.ts:63`, `:76`) sowie `pruefeSpielerImport` und `importiereSpieler` (W`lib/kern/spieler.ts:308`, `:324`) werden auf den Verein umgeschrieben.
  - `importZuGross` (W`lib/spieler-import.ts:274`) prüft die Vereinsgrenze (`VEREIN_SPIELER_MAX`) statt `SPIELER_MAX`.
  - Kein KI-Import (OoS 6).

**Selbstabholung (Story 7)**
- Bleibt je Team (`team_abholung`). `abholung_abholen` sucht unter den Zuordnungen des Abholteams (`team_spieler`) und liefert den einen Link der Spieler:in (AK 11). `link_bezogen` hängt an `spieler` und gilt damit in allen Teams (AK 14, PC 4). Spieler:innen ohne Team findet die Abholung nicht.
- **Texte:**
  - `abholErhaltText` (W`lib/spieler.ts:447`) bekommt den Satz, dass der Link die Termine aller Teams der Spieler:in zeigt, ohne diese zu nennen (AK 12).
  - `ABHOLUNG_TEXT.beschreibung`, `ABHOLUNG_TEXT.aus` und `LINK_TEXT.warnung` (W`lib/spieler.ts:318-322`, `:416-420`) nennen für Mitglieder, dass der Link die Termine aller Teams zeigt und eine ausgeschaltete Selbstabholung ihn nicht sperrt, wenn ein anderes Team sie eingeschaltet hat (AK 13).

### 7.10 MCP nach Story 13 (keine erneute Zustimmung)

**Grundlagen (IST-Befund):**
- **Die Grenze der KI ist im Team-Bereich der Werkzeugsatz, nicht die Datenbank.** Der Bearer-Client ruft dieselben RPCs und liest unter derselben RLS wie das Web (W`lib/mcp/server.ts:90-94`, `lib/mcp/werkzeug.ts:70-72`). Ausnahme ist der Verein-Ort: Dort weist die Datenbank jedes Token mit dem Claim `client_id` ab (`nur_in_der_anwendung()`, §4.1), auch wenn jemand die RPC mit dem KI-Token direkt aufruft.
- **«Sichtbar» heisst wieder «eigenes Team».** Keine Policy hat eine Verwaltungsklausel, `sp_select` läuft nur über die Teammitgliedschaft (§4.2). Die heutigen Lesewege (`ladeSpieler`, `ladeSpielerliste`, `anzahlSpieler`, W`lib/kern/spieler.ts:110`, `:170`, `:193`; `kern/zugriff.ts`) bleiben damit auch für die Verwaltung auf ihre Teams beschränkt. Was die Verwaltung darüber hinaus sieht, liefern nur die DEFINER-RPCs `verein_*`. Ein grep-Wächter in `check:kern` stellt sicher, dass kein Modul unter W`lib/mcp/` und kein von dort aufgerufener Kern eine RPC `verein_*` aufruft (§5.5). Die Ausnahme von Story 13 AK 8 (Spieler:innen ohne Team gelten als nicht gefunden) ergibt sich so ohne eigenen Filter.
- **`team_id` im Ergebnis ist nicht mehr eindeutig.** Bei mehreren oder fremden Teams hat das Pflichtfeld keine feste Bedeutung mehr (heute z. B. in `spieler_entfernen`, `spieler_aendern`, den Link-Werkzeugen). Die Team-RPCs verlangen `p_team` (§4.4). Die Werkzeuge mit `spieler_id` bekommen deshalb ein optionales `team_id`. Fehlt es, bestimmt die MCP-Schicht das älteste eigene Team mit der Spieler:in (`team_spieler ∩ meine_team_ids()`, nach `created_at, team_id`); ohne ein solches Team → `nicht_gefunden`. Das Ergebnis nennt dieses Team als `team_id` und additiv `team_ids` (nur eigene Teams). Fremde Teams erscheinen nur als Namen in `weitere_teams` und in Abweisungstexten.
- **Vereinslage im Kern.** Für den Hinweis an ein Konto ohne Team (AK 10) ruft `meineTeams` (W`lib/kern/team.ts:34`) zusätzlich `meine_vereinslage()` auf (§4.3). Das liefert Verein und `ist_verwaltung` auch ohne Teammitgliedschaft. `meine_vereinslage` ist keine `verein_*`-RPC und fällt deshalb nicht unter den Wächter.
- **Rückfrage über `stand`** (§4.3; die Vorfassung gab Team-Kennungen als `teams_gesehen` zurück): Der erste Aufruf ohne `stand` ändert nichts und liefert die Auskunft samt dem Stand-Wert aus `spieler_teams`, einem Hash über **alle** Teams der Spieler:in ohne Kennungen. An die KI gehen so keine fremden Team-IDs. Der zweite Aufruf gibt den Wert als `stand` zurück; das RPC (`p_stand`, Pflicht) vergleicht ihn nach Teamsperre und `spieler`-Zeile `for update` mit dem aktuellen Stand (§4.3). Weicht er ab, ändert es nichts und meldet `stand_geaendert` mit der neuen Auskunft (Story 13 AK 6). Das gleicht dem bestehenden Muster «erst Auskunft, dann bestätigen» von `spieler_probe_setzen` und den Kader-Werkzeugen (W`lib/mcp/werkzeuge/probe.ts:25`, `kader.ts:24-26`).

| Werkzeug (W`lib/mcp/werkzeuge/…`) | Änderung |
|---|---|
| `teams_abrufen` (`team.ts:225-250`) | additiv `verein: {name} \| null` (Story 13 AK 1) und `hinweis: string \| null`. Ohne Team (AK 10): Teams, Spielerlisten und Kalender stehen nur Mitgliedern offen, Vereinsfunktionen nur in der Anwendung; bei der Verwaltung zusätzlich der Vereinsname und die Selbstaufnahme im Bereich «Verein», sonst kein Verein. Die Beschreibung (`:229-234`, heute «… nur im Team-Bereich von KiFu») wird: «Teams legt die Vereinsverwaltung im Bereich «Verein» der Anwendung an; Teams und Mitglieder verwalten lässt sich über den KI-Client nicht.» |
| `spielerliste_abrufen` (`spieler.ts:89-117`) | additiv `verein` und je Spieler:in `weitere_teams: string[]`, nur Namen, aus `spieler_weitere_teams` (AK 2). Das Feld `probe` heisst `schnuppert` (Story 8 AK 1, OoS 3). |
| `spieler_aufnehmen`, `spieler_aendern` (`:121`, `:151`) | Status `doppelt` als «regel» mit demselben Text wie in der Anwendung (`SPIELER_DOPPELT` nur als Netz), höchstens Namen, Jahrgang und Teams (Story 2 AK 10, PC 3). Dieser Text ist die Ausnahme von «nicht gefunden» (AK 8). `SPIELERLISTE_VOLL` und `VEREIN_VOLL` als «regel». |
| `spieler_entfernen` (`:189`) | **entfällt** ohne Übergang (Story 13 OoS 3); ersetzt durch `spieler_aus_team_nehmen`. Ein Werkzeug zum Löschen aus dem Verein gibt es nicht, auch kein `spieler_loeschen` (Story 13 AK 5, PO 01.11.2026) |
| `spieler_aus_team_nehmen` (neu, RPC `spieler_aus_team_nehmen(p_team, p_spieler, p_stand)`) | Eingabe `team_id`, `spieler_id`, `stand?`. Ohne `stand` ändert es nichts und meldet die Fehlerart «rueckfrage» mit dem Bestätigungstext der Anwendung: bleibt im Verein, nicht gelöscht, bei einer Schnuppernden «das Schnuppern endet samt Zählung», und beim letzten eigenen Team mit ihr «danach über den Assistenten nicht mehr erreichbar» (AK 4; Story 8 AK 13). Dazu kommt der Wert für `stand`. Mit `stand` → Recheck, bei `stand_geaendert` keine Änderung und neue Auskunft (AK 6). Ein fremdes Team oder ein Team ohne die Spieler:in → `nicht_gefunden`, identisch zur unbekannten Spieler:in (AK 7). Verfallende Meldungen laufen wie heute über das Verfall-Muster. Die Werkzeugbeschreibung nennt: Das Werkzeug nimmt nur aus einem Team und löscht nicht; aus dem Verein löscht nur die Vereinsverwaltung in der Anwendung (AK 5). |
| `spieler_aendern`, `spieler_link_abrufen`, `spieler_link_erneuern` (`:601`, `:620`), Schnupper-Werkzeuge | optionales `team_id`, sonst das älteste eigene Team (siehe oben); die RPCs bekommen `p_team` und prüfen die Mitgliedschaft (§4.4). Ohne eigenes Team mit der Spieler:in → `nicht_gefunden`, auch für die Verwaltung und für Spieler:innen ohne Team (AK 8). Die Link-Werkzeuge liefern additiv `teams: string[]` (aus `spieler_teams`) und den Text aus AK 9. |
| `termin_spieler_abrufen` (`:236`), `termin_anwesenheit_setzen` (`:533`) | additiv `nicht_mehr_im_team`. Herausgenommene an begonnenen Terminen bleiben mit Namen (Ausnahme in AK 8) und nachtragbar. Die Prüfung stützt sich auf den festgehaltenen Stand des Termins, nicht auf `spieler_im_team` (Story 3 AK 18). |
| `probetraining_abrufen`, `probetraining_festlegen`, `spieler_probe_setzen` (`probe.ts:45`, `:64`, `:95`) | umbenannt in `schnuppertraining_abrufen`, `schnuppertraining_festlegen`, `spieler_schnuppern_setzen`, ohne Übergang (Story 8 AK 3, OoS 3). `PROBE_MODELL` wird `SCHNUPPER_MODELL` und nennt «nur bei genau einem Team». Die Verweise in `ABMELDE_MODELL` (`spieler.ts:206-226`) werden nachgezogen. Abweisung bei weiteren Teams mit dem Text der Anwendung (Story 8 AK 15). |
| `uebung_anlegen`, `uebung_kopieren` (`uebungen-bearbeiten.ts:59`, `:179`), `training_anlegen` (`trainings.ts:131`), `training_kopieren` (`trainings-bestand.ts:32`) | `KONTO_UEBUNGEN_VOLL` bzw. `KONTO_TRAININGS_VOLL` (beide in `TERMIN_MARKER`, W`lib/training-bedingungen.ts:335-347`, §5.2) als «regel» mit der Auskunft der Anwendung, «es ist nichts entstanden» und ohne Aufforderung zum Wiederholen (Story 12 AK 7). Der Text unterscheidet die Arten: Trainings kann auch die KI löschen (`training_loeschen`), Übungen nur die Person in der Anwendung. Die Übungs-Abweisung bietet deshalb kein Löschen über die KI an. |
| `kader_*`, `selbstabholung_*`, `abholadresse_erneuern`, `termin_*` | unverändert je Team |

- **Inventar «probe» in Ausgaben und Eingaben der MCP-Schicht** (Story 8 AK 1–2; Stand develop, ohne Übergang umbenannt):

  | Ort (W`lib/mcp/…`) | heute | neu |
  |---|---|---|
  | Werkzeugnamen (`werkzeuge/probe.ts:45`, `:64`, `:95`) | `probetraining_abrufen`, `probetraining_festlegen`, `spieler_probe_setzen` | `schnuppertraining_abrufen`, `schnuppertraining_festlegen`, `spieler_schnuppern_setzen` |
  | `spielerliste_abrufen`, Ausgabe je Spieler:in (`werkzeuge/spieler.ts:75`, `:113`) | Objekt `probe: {anzahl, besucht, …}` | `schnuppert: {anzahl, besucht, …}` |
  | `termin_spieler_abrufen`, Ausgabe je Spieler:in (Schema `werkzeuge/spieler.ts:304`, Spiele `:386`, Trainings `:410`) | `probe: boolean` | `schnuppert: boolean` |
  | `spieler_schnuppern_setzen`, Eingabe und Ausgabe (`werkzeuge/probe.ts:103`, `:112`, `:119`, `:122`) | `probe` | `schnuppern` (Eingabe), `schnuppert` (Ausgabe) |
  | Fehler-Detail (`lib/kern/probe.ts:36`) | `feld: "probe"` | `feld: "schnuppern"` |
  | Beschreibungen (`werkzeuge/probe.ts:4-12`, `:49`, `:98`; `werkzeuge/spieler.ts:210-211`; Importnamen in `server.ts:88`) | «Probe-Modus», «probe: true», Verweis auf `probetraining_abrufen` | «Schnuppern», neue Schlüssel und Werkzeugnamen |

  Enum-Werte mit «probe» gibt es in der MCP-Schicht heute keine; kommt einer dazu, gilt dieselbe Regel. Die Liste wird in der PR zu Story 8 per grep erneuert.
- **Kein Werkzeug** ordnet zu, importiert, löscht eine Spieler:in aus dem Verein, gründet, löscht einen Verein, legt Teams an oder nimmt Personen auf (Story 13 AK 5, OoS 1, OoS 2; Story 11 OoS 5).
- **`ZUGANG_DARF`** (W`lib/mcp/umfang.ts:12-19`): Der Spielerlisten-Eintrag nennt zusätzlich den Verein der Teams, die Namen weiterer Teams einer Spieler:in und das Herausnehmen aus einem Team. Das Löschen aus dem Verein steht **nicht** hier, sondern unter `ZUGANG_DARF_NICHT` (Story 13 PC 1). «Probetraining» wird «Schnuppertraining».
- **`ZUGANG_DARF_NICHT`** (`:21-25`): «die Verwaltung deiner Teams und deines Vereins (Verein gründen, umbenennen und löschen, Teams anlegen, umbenennen und auflösen, Personen in Teams oder in die Vereinsverwaltung aufnehmen oder daraus entfernen, Spieler:innen Teams zuordnen, Spieler:innen aus dem Verein löschen und Spielerlisten importieren)» (Story 13 PC 1).
- **Keine erneute Zustimmung** (Story 13 PC 2, Story 8 PC 4, Epic PO 12). Technisch gibt es dafür auch keinen Mechanismus: Supabase Auth kennt keine Scopes, und der Grant trägt keine Version (W`app/api/mcp/route.ts:45-46`, `lib/supabase/bearer.ts`). Die Regel im Kopf von `umfang.ts` (`:3-8`) verlangt heute bei jeder Erweiterung die Frage nach erneuter Zustimmung. Sie wird so gefasst, dass sie zum Entscheid passt: Ergänzungen im Rahmen des Kontos (Vereinsangaben, Herausnehmen mit Rückfrage) gelten ohne erneute Zustimmung, mit Verweis auf Story 13 PC 2. `ZUGANG_ERWEITERUNG` (`:27-28`) bleibt.
- **Beschreibungsbausteine nachführen.** Es gibt keine Server-`instructions`; das Modell steht nur in den Werkzeugbeschreibungen:
  - `SPIELER_MODELL` (`spieler.ts:45-54`): Spieler:in gehört dem Verein, kann mehreren Teams angehören, eindeutig je Verein, J+S und Link gelten für alle ihre Teams, 100 je Team und 1000 je Verein; über die KI nur aus einem Team nehmen, aus dem Verein löscht nur die Vereinsverwaltung in der Anwendung (Story 13 AK 5)
  - `LINK_MODELL` (`:579-590`) und `ABHOL_MODELL` (`:640-648`): ein Link für alle Teams
  - `ABMELDE_MODELL` (`:206-226`): Meldung gilt nur fürs Team des Termins
  - `PROBE_MODELL` (`probe.ts:17-29`) → `SCHNUPPER_MODELL`
  - `SPIELER_KENNUNG_FEHLER`: «nicht gefunden» schliesst Spieler:innen ausserhalb eigener Teams ein; Ausnahme sind die Abweisungstexte mit Teamnamen
  - die Texte zu `teams_abrufen` (siehe oben)
- **Werkzeugnamen** bleiben snake_case (`check:kern`). Die Umbenennung ohne Übergang betrifft:
  - die Wächter-Tabelle in W`scripts/pruefe-kern.ts` (um `:2188` `spieler_entfernen`, `:2198-2199` `probetraining_*`, `spieler_probe_setzen`): neue Namen eintragen und die alten als abwesend prüfen, dazu `spieler_loeschen` als abwesend (Story 13 AK 5)
  - den Wortlaut in `umfang.ts`
  - die Produktdoku (§7.11)
- **Prüfungen:** Die Kernprüfungen in W`scripts/pruefe-kern-db.ts` decken ab: Rückfrage, Recheck mit `stand_geaendert`, kein Löschen durch Mitglieder (weder RPC noch Werkzeug, §6.7 Testfall 12), «Verwaltung ohne Mitgliedschaft bekommt über den Team-Kern `nicht_gefunden`» und die Konto-Grenzen. Die MCP-Schicht selbst (Rückfrage samt Schnupper-Ende, `stand` ohne fremde Team-IDs, abgeleitetes `team_id`, Hinweis für Konten ohne Team) prüfen die exportierten Werkzeug-Handler in `pruefe-kern-db.ts` (§6.7, Story 13 AK 4, 6). Den Rest sichern der grep-Wächter gegen `verein_*` und die Wächter-Tabelle.

### 7.11 Doku zum Release nach `main` (Pflicht laut CLAUDE.md)

Alle Stories gehen in **einem** Release (§6.1). Die Doku wird deshalb in einem Zug nachgeführt. Die Verweise nennen Abschnitte, keine Zeilen, weil sich die Dateien bis zum Release noch bewegen.

- **`docs/produkt/verein.md` (neu):**
  - Bereich «Verein», Verein gründen und löschen, Rollen nach Ort, Verwaltung (aufnehmen, austreten, letzte Verwaltung)
  - Spielerbestand und Vereinsliste, Zuordnen einzeln und gesammelt, Import, Grenzen 30/1000/100
  - Bekannte Grenzen:
    - Altdubletten bleiben getrennt, mit je eigenem Link
    - höchstens ein Verein je Person
    - keine neue Verwaltung, wenn die einzige nicht erreichbar ist
    - Gründung und Bestätigung werden nicht geprüft
    - keine Übersicht aller Vereine
- **`team-bereich.md`:**
  - «Teams»: anlegen nur Verwaltung, Verein im Kopf, Team bleibt ohne Mitglieder
  - «Trainer:innen»: aufnehmen mit Tragweite, Lozenge «Vereinsverwaltung», E-Mail-Sichtbarkeit
  - «Spielerliste»: 100 je Team, Eindeutigkeit je Verein, weitere Teams, herausnehmen (kein Löschen; aus dem Verein löscht nur die Vereinsverwaltung), kein Import
  - «Probetraining» → «Schnuppertraining»: nur bei genau einem Team, Zuordnen zum Schnuppern
  - «Ab- und Anmelden», «Nachtragen, wer da war»: Herausgenommene
  - «Privater Link», «Kalender-Abo am privaten Link», «Selbstabholung»: mehrere Teams, Verein verantwortlich, Abo-Name
  - «Team verlassen und auflösen», «Was beim Ausscheiden passiert», «Bekannte Grenzen»: die Grenze «Kontolöschung löst auf» entfällt, die 200 wird 100
- **`konto-und-zugang.md`:**
  - «Registrieren und Anmelden»: Konto ohne Verein, Registrierung offen
  - neuer Abschnitt «Konto ohne Verein»: Grenzen 50/30, was zählt, Bestand darüber bleibt
  - «Der Anzeigename»: die Verwaltung sieht die E-Mail
  - «KI-Assistent verbinden»: `ZUGANG_DARF` und `ZUGANG_DARF_NICHT` wörtlich, neue und umbenannte Werkzeuge
  - «Konto löschen»: letzte Verwaltung, einzige Person, Teams bleiben
  - «Bekannte Grenzen»
- **`uebungen.md`** («Kopieren», «Bekannte Grenzen») und **`trainings.md`** («Was sich an einem Training tun lässt», «Bekannte Grenzen»): Grenzen für Konten ohne Verein.
- **`navigation.md`:** «Die Seitenleiste» (Bereich-Wechsler zwischen eigenen Teams und Verein, Leiste je Bereich, Zähler 50/30 für Konten ohne Verein), «Brotkrumen», «Seiten hinter einem privaten Link», «Fragen und Feedback» (Dringendes bei einer Spieler:in ohne Team).
- **`README.md`:** Übersicht der Bereiche.
- **`docs/feedback-triage.md`:**
  - Kopf mit Stand und Release
  - §2 Begriffe: Verein, Vereinsverwaltung, Vereinsmitglied, Konto ohne Verein, Spielerbestand, Schnuppertraining
  - §4, §5, §6: Grenzen 50/30
  - §7, §8: Werkzeugnamen
  - §9 Kurzmatrix nach Ort
  - §10: zum Beispiel «Verwaltung sieht Teaminhalte nicht», «Team besteht ohne Trainer:in», «Doppel im Verein abgewiesen»
  - §12, §13 Grenzwerte: 100, 1000, 30 Teams, 50, 30, Vereinsname 60
  - mit `npm run gen:feedback-wissen` im selben PR
- **Feedback-Dialog** (W`lib/feedback/prompt.ts`): Er kennt neu die Rollen Vereinsverwaltung und Konto ohne Verein, sagt «Vereinsverwaltung» statt «Vereinsleitung» und behandelt die neuen Grenzen als Absicht.
- **Release-Text** nach `docs/releases/`, mit allen Punkten, die die Stories dafür verlangen: Story 1 PC 4, 4 PC 5, 5 PC 9, 6 PC 3, 7 PC 7, 8 PC 5, 9 PC 6, 11 PC 6, 12 PC 4, 13 PC 3. Dazu der Hinweis, dass verbundene KI-Clients ihre Werkzeuge neu laden müssen.
- **CLAUDE.md-Gotchas** (§5.6). Die Stories #577–#585 und #587–#589 werden als erledigt markiert, nicht nachkorrigiert.

---

## 8. Lebenszyklus

Massgeblich sind Epic #575 (PO 1–14) und die Stories #577–#585, #587–#589. Funktions-, Trigger- und Markernamen wie in §3–§5; wo dieser Abschnitt einen Namen nennt und §3–§5 einen anderen, gilt §3–§5.

| # | Ereignis | Verhalten |
|---|---|---|
| L1 | **Konto entsteht** | Die Registrierung bleibt offen (`register()`/`signUp` unverändert, W`lib/actions/auth.ts:72`). Jedes neue Konto ist ein **Konto ohne Verein**: kein Team, keine Verwaltung, Bestandsgrenzen 50 Übungen / 30 Trainings (§3.5). Ein nie bestätigtes Konto verfällt nicht und wird nicht bereinigt (Epic OoS 19). |
| L2 | **Verein entsteht** | nur über `verein_gruenden(p_name, p_bestaetigt)` oder den Backfill FC Wyler (§6.3). Gründen darf ausschliesslich ein Konto ohne Verein: Personensperre, dann Prüfung «weder `team_members` noch `verein_verwaltung`». Ohne `p_bestaetigt = true` entsteht nichts; die Bestätigung wird **nicht** gespeichert (Story 11 OoS 2). Danach 0 Teams, die gründende Person ist erste Verwaltung, die Bestandsgrenzen für Konten ohne Verein fallen im selben Moment weg. |
| L3 | **Mindestens eine Verwaltung** | (a) `verwaltung_vorher` unter Vereinssperre weist das Entfernen und Austreten der letzten Verwaltung ab (`LETZTE_VERWALTUNG`), **auch** wenn der Verein weder Teams noch Spieler:innen hat und auch, wenn sie die einzige Person ist (Story 5 AK 33, Story 11 AK 13). (b) FK `verein_verwaltung.user_id … on delete restrict`, damit Dashboard und Admin-API scheitern statt still zu verwaisen. (c) `delete_account` prüft als erste Anweisung (L15). Eine Selbstübernahme gibt es nicht; ist die einzige Verwaltung unerreichbar, hilft die Betreiberin technisch (PO 3, Epic OoS 13). |
| L4 | **Aufnahme ins Team oder in die Verwaltung** | sofort per E-Mail-Adresse, nur bestätigte Konten (`finde_trainer`, Bremse `trainer_suchversuche` wie heute), ohne Annahme, auch in die Verwaltung. Vorher nennt die Oberfläche die Tragweite (Story 11 AK 16). Personensperre, dann Invariante «höchstens ein Verein je Person» (Trigger auf `team_members` und `verein_verwaltung`, §3.1); gehört die Person einem anderen Verein an → `ANDERER_VEREIN`, Meldung ohne Vereinsnamen (Story 11 AK 8). Ab der Aufnahme gelten die Bestandsgrenzen nicht mehr, auch für laufende Sitzungen und KI-Zugänge, weil der Grenz-Trigger die Zugehörigkeit bei jedem Insert liest (§3.5). |
| L5 | **Verwaltung verlassen oder entfernt** | durch eine andere Verwaltung oder selbst, nie als letzte (L3). Team-Mitgliedschaften bleiben (Story 5 PC 4). Wer danach weder Team noch Verwaltung hat, ist Konto ohne Verein; seine Grenzen gelten wieder, sein Bestand bleibt. |
| L6 | **Team anlegen** | nur die Verwaltung im Bereich «Verein», höchstens 30 je Verein, Teamname je Verein eindeutig (Schlüssel wie bei Spieler:innen; bestehende gleichnamige Teams bleiben, darum Prüfung unter Vereinssperre statt Unique-Index). Die anlegende Person wird **nicht** Mitglied (Story 5 AK 17); sie nimmt sich bei Bedarf selbst auf. |
| L7 | **Team ohne Trainer:in** | besteht fort, wenn das letzte Mitglied geht, entfernt wird oder sein Konto löscht, und wenn die Verwaltung es ohne Mitglied anlegt. `team_aufloesen_wenn_leer` fällt in der Migration von Story 5, zusammen mit der Verwaltungssicht (`verein_ansicht`), nie vorher. Eltern-Links, Abos und Abholadresse laufen weiter (Story 5 PC 3). Die Verwaltung erkennt es in `verein_ansicht` (Story 5 AK 7). |
| L8 | **Team umbenennen / auflösen** | nur die Verwaltung im Bereich «Verein», nicht im Team (PO 13). Auflösen mit exaktem Teamnamen. Die Kaskade nimmt Team-Inhalte, `team_spieler`, Trainer-Abos (`kalender_abos`) und `team_abholung` mit. Spieler:innen bleiben samt Link im Verein; ein Schnuppern in diesem Team endet samt Zählung, weil `probe_seit` mit der Zuordnung verschwindet (Story 8 PC 1). Die Bilder sammelt die RPC wie heute über `team_bilder` und gibt sie zurück; den Storage-Nachlauf macht die Action mit dem Service-Role-Client (`raeumeVerwaisteBilder`, W`lib/actions/teams.ts:189-193`). Die Zahlen im Dialog kommen aus `verein_team_ansicht`, auch ohne Mitgliedschaft. |
| L9 | **Spieler:in erfassen** | im Team (Mitglied) oder ohne Team (Verwaltung im Bestand). Reihenfolge unter der Vereinssperre: zuerst Eindeutigkeit des Namensschlüssels **im ganzen Verein** (auch Schnuppernde und Spieler:innen ohne Team), dann Teamgrenze 100 und Vereinsgrenze 1000 (Story 2 AK 9). Die Meldung nennt die Teams der bestehenden Spieler:in oder «keinem Team zugeordnet», nie J+S oder Link (Story 2 PC 3). Von zwei gleichzeitigen Eingaben gewinnt genau eine (Vereinssperre). |
| L10 | **Spieler:in ändern** | Mitglied im eigenen Team, Verwaltung im Bestand; Rechte nie summiert (§4.1). Ändert sich der Namensschlüssel, prüft die Vereinssperre gegen alle **anderen** Datensätze des Vereins. Ändert er sich nicht, ist die Änderung auch bei einer Altdublette erlaubt (Story 2 AK 7). Eine inzwischen gelöschte Spieler:in → Meldung (Story 6 AK 15). |
| L11 | **Zuordnen** | nur die Verwaltung, einzeln oder gesammelt (`verein_spieler_zuordnen(p_team, p_spieler uuid[], p_schnuppern boolean default false)`). Sperren: Verein → Zielteam → Zeilen. Je Spieler:in zuerst «schon zugeordnet» bzw. gleicher Schlüssel im Zielteam (betrifft Altdubletten), dann die Teamgrenze 100. Gesammelt gilt ganz oder gar nicht, mit Liste der Konflikte und dem Überhang (Story 3 AK 21–22). Eine schnuppernde Spieler:in lässt sich keinem weiteren Team zuordnen. «Zum Schnuppern» nur einzeln, nur für Spieler:innen ohne Team und nur, wenn das Team eine Anzahl festgelegt hat (Story 8 AK 8–10). Begonnene Termine bleiben beim Stand bei Beginn; anstehende Termine ohne Kader gelten sofort. Eine erneute Zuordnung ist eine neue (Story 3 PC 9). |
| L12 | **Aus dem Team nehmen** | Mitglied aus dem eigenen Team, Verwaltung aus jedem Team des Vereins. Festhalten (`termine_einfrieren`), dann Kaskade auf künftige Meldungen, Kader und Statuswechsel dieses Teams. Schnuppern endet samt Zählung. An begonnenen Terminen bleibt sie mit Namen, und Mitglieder können ihre Anwesenheit dort **weiter nachtragen** (Story 3 AK 18): Die Prüfung in `termin_anwesenheit_setzen_training` stützt sich bei begonnenen Terminen auf den festgehaltenen Stand (`termin_teilnahmen`), nicht auf `spieler_im_team` (heute `spieler … team_id = t.team_id`, `20261020100000_nachtrag_anwesenheit.sql:59`); für Spiele gilt dasselbe in `spiel_anwesenheit_setzen` (`spiel_teilnahmen`). Wird ein festgehaltener Termin in die Zukunft verlegt, bekommt sie dort keine Meldung zurück. Die Spieler:in wird **nie gelöscht**. Am Team-Ort ist das der einzige Weg des Mitglieds; nach dem letzten Team bleibt sie ohne Team im Spielerbestand (L13). |
| L13 | **Spieler:in ohne Team** | bleibt unbefristet (PO 7). Nur die Verwaltung ändert, ordnet zu, löscht, holt oder erneuert den Link (Story 6 AK 14, Story 3 AK 16). Alle Vereins-Trainer:innen sehen Name, Jahrgang und «kein Team» in der Vereinsliste. Der Link gilt ohne Termine, Feedback über den Link geht (`feedback_link_gueltig`), das Abo liefert einen leeren Feed unter derselben Adresse, die Abholung findet sie nicht. |
| L14 | **Aus dem Verein löschen** | Ausschliesslich die Verwaltung, im Bestand (`verein_spieler_entfernen`), immer, auch ohne Team. Mitglieder löschen nie, auch nicht, wenn alle Teams der Spieler:in eigene sind, weder in der Anwendung noch per KI (PO 01.11.2026; Story 3 AK 12, OoS 5; Story 13 AK 5); sie nehmen sie nur aus ihrem Team (L12). Sperren: Verein → alle Teams aufsteigend → Zeile; alle Teams festhalten. Kaskade wie heute: `*_teilnahmen` werden «ehemalig» ohne Namen in allen Teams, der Link wird ungültig, das Abo erlischt. |
| L15 | **Konto löschen** | `delete_account(p_vereinsname text default null)`, erste Anweisungen unter Vereins- und Personensperre: Ist die Person letzte Verwaltung und gehört dem Verein noch eine weitere Person an → Status `letzte_verwaltung`, nichts gelöscht. Ist sie die **einzige** Person des Vereins: ohne Namen → Status `verein_bestaetigen`, mit falschem Namen (Vergleich `normalize(btrim(…), nfc)`) → Status `vereinsname_falsch`, sonst erst der Verein (L16), dann das Konto (Story 11 AK 12, AK 14). Story 11 AK 12 und Epic PO 3 gehen hier dem Wortlaut von Story 5 AK 33 vor, weil sie den Sonderfall der einzigen Person ausdrücklich regeln (§3.4). Sonst wie heute; Team-Mitgliedschaften gehen per Kaskade, Teams bleiben (Story 5 AK 29). `teamFassungsKandidaten` und `raeumeGeloeschteFassungsBilder` (W`lib/actions/auth.ts`) entfallen, weil kein Team mehr mit dem Konto geht. `deleteAccount` zeigt RPC-Fehler, statt sie zu verschlucken (heute `if (error) return;`, W`lib/actions/auth.ts:215-216`). |
| L16 | **Verein löschen** | `verein_loeschen(p_verein, p_name)`, nur Verwaltung des eigenen Vereins. Vereinssperre, dann Recheck: Name exakt (Gross-/Kleinschreibung zählt, Rand-Leerzeichen nicht) und, beim Weg über `delete_account`, «niemand sonst im Verein» (Story 11 AK 14). Danach in dieser Reihenfolge: Bilder aller Teams sammeln (`team_bilder`), Teams löschen (Kaskade wie Auflösen), Spieler:innen löschen (Links, Abos), `delete from vereine` (nimmt `verein_verwaltung` mit; `verwaltung_vorher` lässt durch, weil der Verein weg ist). `teams.verein_id` und `spieler.verein_id` zeigen mit `restrict` auf `vereine`, darum die ausdrücklichen Deletes vorher. Alle Personen sind danach Konten ohne Verein (abgeleitet, keine Schreibaktion). Nicht umkehrbar, kein Export (Story 11 OoS 3). Links, Abos und Abholadressen zeigen die gewöhnliche Ungültig-Seite. |
| L17 | **Konto ohne Verein an der Grenze** | Ein Bestand über 50 bzw. 30 bleibt, lässt sich ändern, veröffentlichen, auf Entwurf setzen und löschen. Abgewiesen werden nur neue eigene Zeilen in `exercises` bzw. `trainings` (Trigger, App und KI gleich). Löschen schafft Platz; ein abgewiesener Vorgang belegt keinen (Story 12 AK 8). |
| L18 | **`teams.verein_id`** | unveränderlich: kein UPDATE-Recht mehr auf `teams` (§3.6) und Trigger `teams_verein_fest`. Ein Team wechselt nie den Verein. Deshalb wird die Teamliste vor dem Release geprüft (§6.4, Epic Precondition 4). |

---

## 9. Schnitt: Zuordnung zu den Epic-Stories

Story 0 (#576) und Story 10 (#586) entfallen. Alle Stories gehen gemeinsam in **einem** Release nach `main`, mit kurzem Wartungsfenster (§6). Die Migrationen bleiben je Story getrennt und laufen in der Reihenfolge der Zeitstempel; nach jedem Story-Merge auf `develop` ist Staging konsistent (§5.6). Der frühere Schnitt S0–S14 und die Releases R0–R3 sind überholt.

| Epic-Story | Migration(en) | Technischer Kern | Kern-AK für Test und Abnahme |
|---|---|---|---|
| V0 (technischer Vorlauf, keine Epic-Story) | – (`sync-staging.yml`, `supabase/tests/`, `pr-checks.yml`) | Staging-only-Tabellen **vor** dem Restore leeren, danach `staging_nach_sync()` aufrufen, sofern vorhanden. psql-Testlauf in CI. Zum Lauf im Fenster siehe F2. | Bei vorauseilendem `develop` stimmen nach einem Sync die Zeilenzahlen von `teams`/`spieler` mit Prod, die Prüfabfragen §6.5 ergeben 0. |
| 1 #577 FC Wyler als erster Verein | `vereine_fundament`, `spieler_ueber_zuordnung` | §3.1–§3.3: `vereine`, `verein_verwaltung`, `teams.verein_id`, `spieler.verein_id`, `team_spieler`, Personen-Invariante, Backfill mit Konto-ID der Plattform-Admin, `create_team` nur Verwaltung (mit Mitgliedschaft), `delete_account` mit Status `letzte_verwaltung` und Anzeige in der Action, Konto-ID vorab (§6.1 Schritt −1), Lesepfade (SQL und die vier Web-Leser) über `team_spieler`, `team_spieler_vorher` mit Grenze 100 (nach dem Backfill), Grenzen 100/1000 mit Zwillingen, Sperrordnung, Import-Fix. | Auf Staging nach Prod-Sync hängt jedes Team in FC Wyler, jede Spieler:in hat genau ihre bisherige Zuordnung (Dubletten getrennt), FC Wyler hat genau eine Verwaltung. CI-Backfill ist ein No-op. `teams.verein_id` per PostgREST nicht änderbar. `create_team` ohne Verwaltung → `TEAM_NUR_VERWALTUNG`. Die 101. Zuordnung und die 1001. Spieler:in scheitern mit unterscheidbarem Text, auch per MCP (AK 6–7). Bestand über 100 ändert und entfernt weiter (psql). Gleichwertigkeits-Gate grün. |
| 2 #578 Doppelerfassung verhindern | `spieler_eindeutig_verein` | Prüfung des Namensschlüssels über den Verein unter Vereinssperre in `spieler_aufnehmen`, `spieler_aendern` und im MCP-Pfad, **vor** den Grenzen; Netz im Trigger `spieler_vorher` bei INSERT und Schlüsseländerung, ohne eindeutigen Index (§3.3 a). Rückgabe der Teams der bestehenden Spieler:in für den Meldungstext. | Gleichnamige in zwei Teams → zweite abgewiesen, Meldung nennt das Team (AK 4). Altdublette ohne Schlüsseländerung änderbar (AK 7). Zwei gleichzeitige Erfassungen in zwei Teams: genau eine gelingt (AK 8, `rennen.sql`). Volles Team + Dublette → Dubletten-Meldung (AK 9). MCP gleicher Text (AK 10). Die Dublette aus `prodweg_bestand.sql` bleibt als zwei Zeilen bestehen (PC 1). |
| 3 #579 Zuordnen und Herausnehmen | `zuordnung_invarianten`, `vereine_bestand` (die Datei `_validieren` folgt erst im letzten PR vor dem Release, §3) | Zuordnungs- und Termin-FKs, `team_spieler_vorher`/`_nachher` vollständig, `spieler.team_id` nullable mit `set null` (`spieler_team_fest` fällt), `sp_select` nur über die Teammitgliedschaft, `verein_spieler_zuordnen` (einzeln und gesammelt), `spieler_aus_team_nehmen` mit `p_stand` aus `spieler_teams` (`stand_geaendert`), Drop `spieler_entfernen(uuid)` ohne Nachfolger am Team-Ort (L14), `termin_teilnehmer`/`spiel_teilnehmer` als DEFINER mit `nicht_mehr_im_team`, Anwesenheit nach L12, Rückschreiben beim Verlegen nur für Zugeordnete. Oberfläche: Grundseite `/verein/spieler` nur für die Verwaltung (§3, «Story 3 vor Story 5»). MCP: Das Werkzeug `spieler_entfernen` wird im selben PR durch `spieler_aus_team_nehmen` ersetzt, weil die RPC fällt; abgenommen wird es mit Story 13. | Gesammelt mit einer Spieler:in, die das Team schon führt → keine Zuordnung, Liste und Überhang (AK 21–22). Herausnehmen aus A lässt nur künftige A-Meldungen verfallen und löscht nie (PC 4–6). Anwesenheit einer Herausgenommenen an begonnenem A-Termin nachtragbar (AK 18). Mitglied kann nicht löschen, auch nicht bei lauter eigenen Teams; die Team-Spielerliste hat keine Löschaktion (AK 12, OoS 5). Die Bestätigung des Herausnehmens nennt «nicht gelöscht, nur die Verwaltung löscht» und beim letzten Team «ohne Team im Bestand, nur die Verwaltung ändert, ordnet zu, löscht» (AK 13, 16). Zwei gleichzeitige Zuordnungen an der Grenze: eine gelingt (AK 8). |
| 4 #580 Spieler:innen des Vereins überblicken | `verein_spielerliste` | DEFINER-RPC `verein_spielerliste(p_verein, p_suche, p_teams, p_ohne_team, p_jahrgaenge)`, erste Prüfung `ist_verein_mitglied`. Suche über `unaccent(lower(...))` wie `exercises.search_text` (`20260608120000_search_text_contains.sql`), serverseitig über alle bis 1000. Für Nicht-Verwaltung nur Vorname, Nachname, Jahrgang, Teams (Spaltenauswahl in der RPC, nicht in der Oberfläche). Texte auf Abholseite und Link. | Mitglied sieht bei eigener Spieler:in keine J+S (AK 3). Filter (Team₁ ∨ Team₂ ∨ ohne Team) ∧ (Jahrgang₁ ∨ Jahrgang₂) ∧ Suche bei 1000 Zeilen, jede Zeile nennt alle Teams (AK 9–10). Person ohne Vereinszugehörigkeit → ununterscheidbar «nicht gefunden» (AK 2, PC 3). |
| 5 #581 Verwaltung führt Teams und Trainer:innen | `vereine_verwaltung` | `verein_ansicht`, `verein_team_ansicht` (Auflösungszahlen), `verein_team_anlegen` ohne Mitgliedschaft (Drop `create_team`), Teamname eindeutig je Verein, `verein_team_umbenennen`, `verein_umbenennen`, `verein_team_aufloesen` (ersetzt `loese_team_auf`) und Umbenennen nur Verwaltung, `entferne_team_mitglied` ohne `aufloesung_noetig`, Drop `team_aufloesen_wenn_leer`, `verein_finde_person`/`verein_team_aufnehmen` für die Verwaltung in jedes Vereinsteam, `verein_verwaltung_aufnehmen`/`verein_verwaltung_entfernen`, `team_mitglieder` mit Kennzeichen «Verwaltung». | Verwaltung ohne Mitgliedschaft sieht dieselben Auflösungszahlen wie ein Mitglied (AK 25). Mitglied kann nicht mehr umbenennen oder auflösen (AK 26). Letztes Mitglied geht ohne Namen, Team bleibt (AK 28, PC 3). Zwei Verwaltungen treten gleichzeitig aus: eine bleibt (AK 35). 31. Team und gleicher Teamname gleichzeitig: je genau eines (AK 35). Verwaltung im Team hat keine Verwaltungsrechte über die Team-RPCs (PO 13). Verwaltungsmitglied ohne Anzeigenamen: Mitglieder sehen nur «Vereinsverwaltung», nie die E-Mail-Adresse (AK 9). |
| 6 #582 Verwaltung führt den Spielerbestand | `spielerbestand_verwaltung` | Bestands-RPCs mit erster Prüfung `ist_verein_verwaltung` (getrennt von den Team-RPCs, §4.1): Spieler:in ohne Team anlegen, ändern inkl. J+S, löschen (Sperren vor dem DELETE, §4.1), Link holen und erneuern; jede mit `nur_in_der_anwendung()`. | Verwaltung ohne Mitgliedschaft ändert J+S und erneuert den Link (AK 2, AK 11). Mitglied kann Spieler:in ohne Team weder ändern noch Link holen (AK 14). Anlegen ohne Team zählt zur Grenze 1000 (AK 6). Ändern einer gelöschten Spieler:in → Meldung (AK 15). |
| 7 #583 Link, Abo, Abholung über mehrere Teams | `link_mehrere_teams` | `spieler_link_ansicht` mit Terminen aller Zuordnungen samt Teamnamen und Teamliste, `spieler_abo_termine` über alle Teams, Kalendername «Trainings und Spiele», `abholung_abholen` über `team_spieler` des Abholteams, `spieler_link_abmelden`/`_melden` sperren zuerst das Termin-Team und prüfen danach `spieler_im_team(Termin-Team)`. «Bezogen» hängt an der Spieler:in und gilt so in allen Teams. `feedback_link_gueltig` statt `feedback_link_team` (drop, §3.7). | Abmelden für einen Termin eines nicht mehr zugeordneten Teams → abgewiesen (AK 7); auch im Rennen mit gleichzeitigem Herausnehmen bleibt keine Meldung ohne Zuordnung. Ohne Team: Link gültig, leer, Abo leerer Feed, Feedback geht (AK 5, 9, 18). Bestehende Links und Abo-Adressen liefern ohne Neubezug (PC 5). |
| 8 #584 Schnuppertraining in genau einem Team | `schnuppertraining` | `spieler_probe_setzen` nur bei genau einer Zuordnung (Vereinssperre), `team_spieler_vorher` weist Zuordnungen schnuppernder Spieler:innen ab, Herausnehmen und Auflösen beenden das Schnuppern, weil `probe_seit` mit der Zuordnung verschwindet, `verein_spieler_zuordnen` mit `p_schnuppern`. Begriff in Oberfläche, Link und KI; MCP-Werkzeuge umbenannt (`schnuppertraining_abrufen`, `schnuppertraining_festlegen`, `spieler_schnuppern_setzen`), kein Übergang. Interne DB-Namen bleiben `probe_*` (F-Begriff). | Gleichzeitig Schnuppern einschalten und weiteres Team zuordnen: genau eines (AK 14). Zuordnen zum Schnuppern bei Team ohne Anzahl → abgewiesen (AK 10). Bestehende Probetrainings laufen unverändert weiter (PC 3). MCP gleicher Text (AK 15). |
| 9 #585 CSV-Import in den Spielerbestand | `import_verein` | Neuer Import `verein_spieler_importieren(p_verein, p_zeilen, p_erwartet)`, erste Prüfung `ist_verein_verwaltung`, Abgleich über den ganzen Verein, Altdubletten-Treffer als «mehrfach» ohne J+S-Änderung, nur Vereinsgrenze (mit `neu > 0`), Vorschau-Prüfung über `p_erwartet` wie heute, alles in einer Transaktion. `spieler_importieren(p_team, …)` weist ab (auch für die Verwaltung); Import-Knopf in der Teamliste entfällt. | Import ohne neue Zeilen bei Bestand über 1000 geht (AK 7). Zeile mit zwei Altdubletten ändert keine (AK 5). Zwischen Vorschau und Übernahme gelöschte Spieler:in oder inzwischen erreichte Vereinsgrenze → nichts übernommen, Status `veraltet`, Vorschau neu (AK 9). Team-Import → abgewiesen (AK 12). |
| 11 #587 Verein gründen und löschen | `verein_gruenden_loeschen` | `verein_gruenden`, `verein_loeschen`, `delete_account(p_vereinsname)`, Meldungen `ANDERER_VEREIN` (Aufnahme) und `SCHON_IM_VEREIN` (Gründen), Vereinsname als Verantwortliche auf Abholseite und Link. | Konto in Team kann nicht gründen (AK 4). Gründen und Aufnahme in einen anderen Verein gleichzeitig: genau eines (AK 9). Verein löschen mit falscher Schreibweise → nichts (AK 10). Einzige Person löscht ihr Konto mit Vereinsnamen → Verein weg; tritt vorher eine zweite Person bei → nichts (AK 14). Nach dem Löschen sind alle Personen Konten ohne Verein (PC 4). |
| 12 #588 Konten ohne Verein | `konten_ohne_verein` | BEFORE-INSERT-Trigger auf `exercises` (`owner_id`, `source = 'user'`) und `trainings` (`owner_id is not null`; Team-Trainings haben `owner_id null`, `team_datenmodell.sql:51`): Personensperre, Zugehörigkeit lesen, sonst zählen über `konto_bestand`; Marker je Art. `meine_vereinslage()` für die Anzeige in der Leiste und an den Einstiegen. Die Kopierwege bleiben (kein Kopier-RPC, §3.5). Fassungen in `training_exercises` und Varianten zählen nicht. | 51. Übung über App und KI gleichzeitig: Bestand bleibt 50 (AK 8, `rennen.sql`). Übernehmen einer Übung in ein Training an der Grenze geht (AK 4). Aufnahme ins Team hebt die Grenze für eine laufende KI-Sitzung sofort auf (PC 2). Eine gescheiterte Trainings-Kopie ist danach abgeräumt, der Platz frei (AK 8, Endstand). |
| 13 #589 KI-Assistent und Vereine | – (MCP, `umfang.ts`) | `teams_abrufen` mit Verein, `spielerliste_abrufen` mit Namen weiterer Teams, `spieler_entfernen` ersetzt durch `spieler_aus_team_nehmen` (mit Team), kein Löschwerkzeug; Herausnehmen zweistufig: erster Aufruf liefert Auskunft (bei Schnuppernden mit dem Schnupper-Ende) und den Stand-Wert `stand` ohne Team-IDs, der bestätigende Aufruf übergibt ihn, die RPC prüft ihn nach Team- und Zeilensperre erneut (`p_stand` Pflicht). Vereins-RPCs weisen KI-Tokens in der Datenbank ab (`nur_in_der_anwendung()`). Kontextteam in der MCP-Schicht = übergebenes oder abgeleitetes `team_id` (§7.10). Werkzeug-Handler exportiert und in `pruefe-kern-db.ts` getestet. `ZUGANG_DARF`/`ZUGANG_DARF_NICHT` erweitert ohne erneute Zustimmung (PO 12). | Herausnehmen ohne Bestätigung ändert nichts; die Rückfrage nennt «bleibt im Verein, nicht gelöscht» (AK 4). Der Werkzeugsatz enthält kein Löschen, die Werkzeugbeschreibung nennt, dass nur die Verwaltung in der Anwendung löscht; `ZUGANG_DARF_NICHT` nennt «Spieler:innen aus dem Verein löschen» (AK 5, PC 1). Stand geändert zwischen Auskunft und Bestätigung → nichts geändert, neuer Stand (AK 6). Verwaltung ohne Mitgliedschaft → «nicht gefunden» per MCP, dieselbe Änderung im Bestand gelingt (AK 8). Die Rückfrage enthält keine fremde Team-ID (AK 6). |
| N1 (Nachlauf, keine Epic-Story) | `vereine_contract` (+ `_pflicht_validieren`) | §3.8: `spieler.team_id` und `spieler.probe_seit` weg, NOT NULL auf beiden `verein_id`, `vereine_nachziehen`/`staging_nach_sync` und der Sync-Aufruf weg. Ohne sichtbare Änderung; Zeitpunkt siehe F1. | grep-Wächter grün (auch über `supabase/tests/` und `.github/workflows/`), psql-Testlauf grün. |

**Merge-Reihenfolge auf `develop`** (folgt den Abhängigkeiten des Epics): P0 → V0 → 1 → 2 → 3 → 5 → 6 → 7 → 8 → 4 → 9 → 11 → 12 → 13 → Doku-PR → Abschluss-PR (`_validieren`, `PUBLIC_TABLES`, §6.1 Schritt 1) → Generalprobe. Ändert oder entfernt eine Story eine RPC, ziehen alle Aufrufer im selben PR nach, auch das MCP-Werkzeug. Die Tabelle in §3 steht in derselben Folge. Story 5 vor 11, weil die Gründung die Verwaltungssicht braucht; der Drop von `team_aufloesen_wenn_leer` liegt in Story 5, damit kein Team ohne Trainer:in unsichtbar wird.

- Jede Story läuft durch Code-Test, E2E und Commit.
- Produktdoku, Triage (`gen:feedback-wissen`), Release-Text und CLAUDE.md-Gotchas gehören in den Release-PR `develop` → `main` (§7.11). Die Release-Text-Postconditions aller Stories landen in **einem** Text.
- Vor dem Release ordnet die PO Bestandskonten ohne Team, die in einem Verein arbeiten sollen, selbst zu (PO 10); die Abfrage dazu steht in §6.4.

**E2E-Pfad (lokal mit Wegwerfkonten per Admin-API, danach Staging):**
1. Neues Konto registrieren und bestätigen: Es sieht den Hinweis «Verein gründen oder aufnehmen lassen» und die Anzeige 0/50 bzw. 0/30. Mit 50 vorbereiteten Übungen wird die 51. abgewiesen.
2. Verein gründen, ohne Bestätigung scheitern, mit Bestätigung gelingen; der Bereich «Verein» zeigt den Leerzustand. Die Grenzanzeige ist weg.
3. Zwei Teams anlegen, ohne Mitglied zu werden; ein dritter Name in anderer Schreibweise eines bestehenden wird abgewiesen.
4. Zweites Konto per Adresse in Team A aufnehmen (Hinweis zur Tragweite sichtbar), drittes Konto sofort in die Verwaltung.
5. Ein Konto eines anderen Vereins aufnehmen: abgewiesen, ohne Vereinsnamen.
6. Spieler:in in A erfassen; dieselbe Person als Mitglied von B erfassen: abgewiesen mit Teamname A.
7. Als Verwaltung nach B zuordnen; gesammelt drei Spieler:innen nach B, eine davon schon in B: nichts zugeordnet.
8. Eltern-Link: Termine aus A und B mit Teamnamen, Abmelden für einen B-Termin, Abo «Trainings und Spiele».
9. Als Mitglied von B die Spieler:in aus B nehmen: Link gültig, B-Termine verschwinden; Anwesenheit an einem begonnenen B-Termin bleibt nachtragbar.
10. Spieler:in ohne Team zum Schnuppern in A zuordnen; Zuordnen nach B abgewiesen.
11. CSV-Import im Bestand als Verwaltung; in der Teamliste gibt es keinen Import mehr.
12. Über den KI-Client herausnehmen (erst Auskunft, dann Bestätigung); der KI-Client bietet kein Löschen an und verweist auf die Vereinsverwaltung. Als Mitglied in der Teamliste gibt es keine Löschaktion; die Verwaltung löscht die Spieler:in ohne Team im Bereich «Verein».
13. Team B als Verwaltung auflösen: Spieler:innen bleiben, Links gelten.
14. Letzte Verwaltung tritt aus: abgewiesen. Verein mit Namen löschen: alle Personen sind Konten ohne Verein, der Link zeigt die Ungültig-Seite.
15. Ein-Personen-Verein: Konto mit Vereinsnamen löschen, der Verein ist weg.
16. Auf Staging nach Prod-Sync: alle Teams unter FC Wyler, die Plattform-Admin ist einzige Verwaltung.

---

## 10. Risiken

| # | Risiko | Gegenmassnahme |
|---|---|---|
| 1 | Der Backfill trifft auf Prod-Daten, die CI nie sieht | wiederholbares, nur ergänzendes `vereine_nachziehen`, psql-Test mit Altdaten unter `replica`, Generalprobe auf Staging nach Prod-Sync mit der ganzen Migrationskette (= Prod-Weg), Prüfabfragen §6.4/§6.5 |
| 2 | Alles geht in einem Release: viele Migrationen und viel Code in einem Deploy | Generalprobe auf Staging mit allen Migrationen in Reihenfolge, Staging konsistent nach jedem Story-Merge, Wartungsfenster (§6), Fehler werden vorwärts behoben, ein Vercel-Rollback nur, wenn schon die erste Datei scheitert (§6.1). Ein Feature-Schalter ist verworfen (§12). |
| 3 | Lesekreis wächst: Mit dem Release sehen alle Trainer:innen des FC Wyler Name, Jahrgang und Teams aller Spieler:innen, die Verwaltung auch J+S und Links | Folge aus PO 1/5. Release-Text, Abholseite und Link nennen es (Story 4 PC 4–5). Ein späteres Umhängen ist unmöglich (L18). |
| 3a | Ein Prod-Team gehört nicht zum FC Wyler und wird unumkehrbar angehängt | Epic Precondition 4; Teamliste vor dem Release prüfen (§6.4); kein Umhänge-Notweg auf Vorrat |
| 4 | Ein Verein verliert seine letzte Verwaltung | L3 dreifach, `deleteAccount` zeigt den Fehler, Prüfabfrage «Vereine ohne Verwaltung» (§6.5). Unerreichbare Verwaltung: Betreiberin hilft technisch (PO 3). |
| 5 | Jemand wird ohne Annahme Verwaltung und kann danach weder austreten noch sein Konto löschen, solange andere im Verein sind | bewusst hingenommen (PO 3, 10). Tragweite-Hinweis vor jeder Aufnahme (Story 11 AK 16); jede andere Verwaltung kann sie entfernen; als letzte kann sie den Verein löschen (Story 11 AK 13). |
| 6 | Sync im Fenster `develop` vor `main` bricht oder leert Staging | V0 (Truncate vor dem Restore, `staging_nach_sync()`), `PUBLIC_TABLES` im selben PR, kein Sync im Fenster von N1; Lauf im Fenster nach F2 |
| 7 | Vergessener Leser oder Sperrschlüssel über `spieler.team_id` | Gleichwertigkeits-Gate (SQL und Web), Pflicht-Inventar in der PR von Story 1, grep-Wächter vor N1 |
| 8 | Deadlocks und Wettrennen zwischen Personen-, Vereins-, Team-, Zeilen- und Terminsperren | eine Sperrordnung (§4.1): Verein → Person → Teams aufsteigend → `spieler`-Zeile → Termin-Zeile, Gründen sperrt nur die Person; Vereinssperre vor jedem Lesen der Teammenge oder des Vereins-Schlüssels; Testfälle zu Story 2 AK 8, Story 3 AK 8, Story 5 AK 35, Story 8 AK 14, Story 11 AK 9, Story 12 AK 8 |
| 9 | Eindeutigkeit je Verein kollidiert mit Altdubletten | Trigger-Prüfung unter Vereinssperre nur bei INSERT und Schlüsseländerung (§3.3 a), gegen **andere** Datensätze (L10); kein eindeutiger Index, also nichts, was am Bestand bricht; Zuordnen einer Altdublette in das Team ihres Zwillings scheitert (Story 3 AK 4); Import meldet «mehrfach» und ändert nichts (Story 9 AK 5) |
| 10 | Rollen vermischen sich: eine Verwaltung erhält im Team über Team-RPCs Verwaltungsrechte oder umgekehrt | Team-RPCs prüfen nur Mitgliedschaft, Bestands- und Vereins-RPCs nur Verwaltung, nie `OR` (§4.1); Testfälle beidseitig (Story 5 Kern-AK, Story 6 AK 14) |
| 11 | Die Verwaltung kommt per MCP an Spieler:innen fremder Teams oder an Vereinsfunktionen | Kontextteam-Pflicht in der MCP-Schicht (Story 13 AK 8); die Bestands-RPCs sind für MCP nicht verdrahtet; ruft jemand sie mit dem KI-Token direkt auf, weist die Datenbank ab (`nur_in_der_anwendung()`, Testfall 30) |
| 12 | Umbenannte bzw. ersetzte MCP-Werkzeuge brechen verbundene Clients (Schnuppertraining, `spieler_entfernen` → `spieler_aus_team_nehmen`) | bewusst ohne Übergang (Story 8 OoS 3, Story 13 OoS 3); Release-Text verlangt das Neuladen; alte Namen liefern «unbekanntes Werkzeug», nie eine falsche Wirkung |
| 13 | Die KI nimmt eine Spieler:in aus einem Team, deren Teams sich seit der Auskunft geändert haben | zweistufige Bestätigung mit übergebenem Stand, Recheck unter Sperre (Story 13 AK 6). Löschen kann die KI nicht (Story 13 AK 5). |
| 14 | Konten ohne Verein lassen die Grenzen per Vereinsgründung hinter sich | von der PO hingenommen (PO 12, Story 12 OoS 1); nicht beworben |
| 15 | Offene Registrierung plus Selbstgründung erzeugt Wegwerf-Vereine, und niemand überblickt sie | Grenzen je Verein (30/1000) und je Konto (50/30); keine Übersicht in der Anwendung (Epic OoS 9). Zählung nur per Prüfabfrage mit Freigabe (§6.6). Restrisiko: Datenwachstum bis zum Preisplan. |
| 16 | Verein löschen vernichtet irreversibel viele Daten; Laufzeit und Bilder | Name exakt, Zahlen vorher (Story 11 AK 11), Recheck unter Vereinssperre, Bild-Nachlauf mit dem Service-Role-Client wie beim Auflösen, Laufzeitmessung mit 30 Teams und 1000 Spieler:innen (F4) |
| 17 | Konto der einzigen Person wird gelöscht, während eine zweite Person aufgenommen wird | Personen- und Vereinssperre, Recheck in `delete_account` (Story 11 AK 14) |
| 18 | Eine Person landet durch gleichzeitige Aufnahmen bzw. Gründung in zwei Vereinen | Personensperre in beiden Triggern und in `verein_gruenden` (Story 11 AK 9) |
| 19 | Bestandskonten ohne Team verlieren mit dem Release Teamanlage und erhalten Grenzen | PO ordnet sie vor dem Release zu (PO 10); Abfrage «Konten ohne Team mit Bestand über 50/30» (§6.4); ihr Bestand bleibt (L17) |
| 20 | Anwesenheit Herausgenommener an begonnenen Terminen wird durch die neue Zuordnungsprüfung gesperrt | Prüfung bei begonnenen Terminen gegen den festgehaltenen Stand (L12), Testfall zu Story 3 AK 18 |
| 21 | VALIDATE scheitert an Altzeilen | eigene Migration, Waisen-Abfragen vorab (§6.4), notfalls Bereinigungs-Migration mit PO-Prüfung |
| 22 | Leistung von `sp_select`, `tsp_select` und `verein_spielerliste` | `meine_team_ids()` als InitPlan, Index `team_spieler_spieler_idx`, `explain analyze` mit 100 bzw. 1000 Zeilen auf Staging, Suche serverseitig |
| 23 | Parallele Epics fassen dieselben Funktionen neu | Vereine zuerst; #482, #504/#505 und #514 warten (PO 12); Rückfall-Migration erst kurz vor dem Release erzeugen |
| 24 | Zeitgleiche Termine einer Spieler:in in zwei Teams | bewusst ohne Prüfung (Epic OoS 12) |
| 25 | Adresse der Plattform-Admin im öffentlichen Repo | Migration und Plan nutzen nur die Konto-ID (§6.3) |
| 26 | Neue Helfer per PostgREST aufrufbar | Grundregel `revoke all … from public, anon, authenticated` (§3), Testfall «Helfer mit `anon` und `authenticated` nicht aufrufbar» |
| 27 | Jede Trainer:in erweitert durch Aufnehmen allein den Vereins-Lesekreis | hingenommen (PO 4); die Verwaltung sieht alle Trainer:innen samt Adresse (Story 5 AK 4); Doku in `verein.md` |
| 28 | `db push` bricht mittendrin ab; die früheren Migrationsdateien bleiben angewendet | jede Datei in eigener Transaktion mit Zusicherungen (§6.3), Generalprobe der ganzen Kette (§6.2); die `validate`-Migration gehört deshalb ans Ende (§6.1) |
| 29 | Trainer:innen erwarten das bisherige endgültige Entfernen; herausgenommene Spieler:innen sammeln sich ohne Team im Bestand | Entscheid der PO vom 01.11.2026 (Epic PO 7, Story 3 OoS 5): Die Bestätigung des Herausnehmens nennt «nicht gelöscht, nur die Verwaltung löscht» (Story 3 AK 13, 16), der KI-Assistent ebenso (Story 13 AK 4, 5), der Release-Text nennt es (Story 13 PC 3). Die Verwaltung findet sie über die Eingrenzung «ohne Team» und löscht im Bestand (§7.6, L14). |
| 30 | Ein Konto ohne Verein bei 29 Trainings legt ein Training an, während eine eigene Trainings-Kopie gerade scheitert und noch nicht abgeräumt ist | hingenommen (§3.5): Das Fenster dauert so lange wie das Abräumen; danach ist der Platz frei. Ein Kopier-RPC lohnt nicht, weil die Bildkopien ohnehin ausserhalb einer Transaktion liegen. |
| 31 | Wer einen Verein gründet, kann über die Personen-Vorschau Anzeigenamen bestätigter Konten zu bekannten Adressen abfragen | wie heute für jedes Teammitglied über `finde_trainer`; Treffer nennen nur den Anzeigenamen, die Bremse zählt `nicht_gefunden` und `anderer_verein` (§4.3), `anderer_verein` nennt weder Verein noch Namen |
| 32 | Eine Firewall-Regel nur für die Produktionsdomain liesse im Fenster die `*.vercel.app`-Adressen offen | Regel projektweit ohne Host-Bedingung, Probe auf staging.ki-fu.ch vor dem Release (§6.1) |

---

## 11. Offene Fragen

Fachlich ist das Epic ohne offene Fragen. Offen sind nur technische Punkte, die die Umsetzung vor dem jeweiligen Story-Merge klärt. Die Fragen F1–F13 der Vorfassung sind erledigt oder durch Epic #575 entschieden; die Nummern unten sind neu vergeben (alt F2: keine Ausnahme, PO 11; F3/F5: Team anlegen, umbenennen, auflösen nur Verwaltung; F4: Aufnahme immer sofort, auch in die Verwaltung; F6: Story 3 AK 12; F7: Schnuppern nur in genau einem Team; F8: Story 5 AK 4; F9: entfällt mit der Einladungsmail; F10: Story 11; F11: Epic Precondition 4 plus Prüfschritt §6.4; F12: Release-Text, PO 5; F13: hingenommen, PO 4).

| # | Frage | Empfehlung |
|---|---|---|
| F1 | Kommt der Contract (§3.8, N1) in das eine Release oder danach? | **Danach**, ohne sichtbare Änderung und frühestens zwei Wochen nach dem Release ohne Befund. NOT NULL auf `verein_id` bräche im Fenster `develop` vor `main` den Sync, weil der Restore Prod-Zeilen ohne `verein_id` per COPY einfügt und NOT NULL auch unter `replica` greift. Die Epic-Regel «ein Release» betrifft die Stories; N1 ist interne Bereinigung mit eigenem, internem Release-Text. Abzustimmen mit §6. |
| F2 | Wie läuft der Sync im Fenster, wenn V0 vorher nicht auf `main` liegen soll? | `sync-staging.yml` aus `develop` starten (`gh workflow run sync-staging.yml --ref develop`): `workflow_dispatch` nimmt die Workflow-Datei des gewählten Branches. Für den Sync bräuchte V0 damit keinen eigenen Prod-Release; V0 geht trotzdem vor Story 1 nach `main`, weil der neue `reset-staging.yml` sonst nicht startbar ist (§6.1). Der Guard vergleicht weiter mit Prod. Vor dem ersten Lauf auf Staging einmal prüfen, dass Secrets und Bestätigung `sync` auch vom Branch aus greifen. **Beantwortet am 13.11.2026:** Der Sync aus `develop` läuft (Lauf 43441659454, 3 min 16 s); Secrets und Bestätigung `sync` greifen vom Branch aus. |
| F-Begriff | Die DB-Namen bleiben im Epic intern `probe_*` (`team_probetraining`, `spieler.probe_seit`, `probe_stand`, Marker `PROBE_*`, `lib/probe.ts`); nach aussen heisst es «Schnuppertraining», auch bei den KI-Werkzeugnamen (Story 8 AK 1–3). Werden die DB-Namen später nachgezogen? | **Im Epic nicht.** Eine Umbenennung von Spalten und Funktionen bräuchte Expand/Contract über einen weiteren Release ohne Nutzen für Personen. Die Zuordnung «`probe_*` (intern) = Schnuppern (aussen)» kommt als Gotcha in CLAUDE.md und als Kommentar in die Kopfzeilen der betroffenen Dateien. Nachziehen nur, wenn ein späteres Epic diese Objekte ohnehin neu fasst; dann als eigene Expand/Contract-Folge. |
| F4 | Passt `verein_loeschen` mit 30 Teams und 1000 Spieler:innen in eine Transaktion unter dem `statement_timeout` der Rolle `authenticated`? | Vor dem Merge von Story 11 auf Staging mit synthetischem Vollbestand messen. Reicht es nicht, ein lokales `set local statement_timeout` in der DEFINER-Funktion statt einer Aufteilung in Schritte; ein halb gelöschter Verein ist ausgeschlossen. |
| F5 | Wie wird die zweistufige Bestätigung im MCP abgebildet (Story 13 AK 4, AK 6)? | Entschieden (§4.3, §7.10): Ein Werkzeug (`spieler_aus_team_nehmen`; Löschen gibt es per KI nicht) mit `stand` (Stand-Wert über alle Teams der Spieler:in aus `spieler_teams`, ohne Team-IDs). Ohne `stand` nur Auskunft aus `spieler_teams`, mit `stand` prüft die RPC (`p_stand`, Pflicht) nach Teamsperre und `spieler`-Zeile `for update` gegen den aktuellen Stand und antwortet bei Abweichung mit `stand_geaendert`. Kein serverseitiger Merkzustand zwischen den Aufrufen. |
| F6 | Übersteht ein `supabase db reset --linked` auf Staging Storage und Auth (Generalprobe §6.2)? | **In V0 klären, vor Story 1:** ein erster Lauf von `reset-staging.yml` auf Staging, danach Storage-Objekte und Auth-Konfiguration vergleichen. Fasst der Reset sie an, braucht die Generalprobe einen anderen Weg zurück auf den `main`-Stand; welchen, wird dann vor Story 1 entschieden. **Beantwortet am 13.11.2026:** Der Reset läuft in 49 s (Lauf 43441286569) und löscht alle Konten in `auth`; die Storage-Policies kommen mit den Migrationen zurück, die Auth-Einstellungen im Dashboard bleiben. Danach ist ein Sync nötig. |
| F7 | Ist die Sperre über die Vercel-Firewall der richtige Wartungsmechanismus im Fenster (§6.1)? | **Entschieden:** Custom Rule projektweit ohne Host-Bedingung, Ausnahme die eigene IP-Adresse, Aktion «deny». Probe vorab mit Host-Bedingung `staging.ki-fu.ch` (§6.1 Schritt 0). Beides braucht die Freigabe im Moment. |

---

## 12. Verworfene Alternativen

| Alternative | Grund |
|---|---|
| **Neu verworfen (Epic #575):** Invite-only: Registrierung schliessen (`enable_signup = false`, Dashboard-Schalter, `/registrieren` → `/zugang`) | PO 10: Die Registrierung bleibt offen; ein neues Konto ist ein Konto ohne Verein mit Bestandsgrenzen. |
| **Neu verworfen:** Zugangsantrag mit Admin-Freigabe, Allowlist `PLATTFORM_ADMINS`, Admin-Seite, `zugangsantraege`, `zugang_bremse`, Gründungsrecht mit Fristen | PO 10, Epic OoS 9: Jedes Konto ohne Verein gründet selbst, die Betreiberin entscheidet nichts und hat keine Übersicht. |
| **Neu verworfen:** Einladung an Personen ohne Konto, Einladungsmail per `inviteUserByEmail`, Invite-Template, `/auth/einladung`, `/willkommen`, Tabelle `einladungen`, Löschen unbestätigter Altkonten | PO 10, Epic OoS 18: Ins Team und in die Verwaltung kommt nur, wer ein Konto hat; die Adresse tauschen die Beteiligten ausserhalb aus. Damit entfällt auch das Übernahme-Risiko über unbestätigte Altkonten. |
| **Neu verworfen:** Einzelvarianten des Zugangs- und Einladungswegs (Hook `before_user_created`, eigener Mailversand, Einladungs-Token-Tabelle, Antrag per Upsert, globaler Antragsdeckel, Admin-Recht in der DB, `p_user`-Parameter für den Service-Role-Weg, kontolose Einladung als `team_members`-Zeile) | gegenstandslos mit dem Zugangs- und Einladungsweg |
| **Neu verworfen:** Verwaltung nur per angenommener Einladung (frühere L2a) | PO 3/10: Aufnahme sofort per Adresse; die Tragweite nennt die Oberfläche vorher (Story 11 AK 16). Risiko 5 ist hingenommen. |
| **Neu verworfen:** Dubletten im Verein zulässig, Namensschlüssel nur je Team, Vereinstreffer nur als Vorschlag | PO 6, Story 2: eindeutig je Verein. Damit ist auch «MCP-`spieler_aufnehmen` weist Vereinstreffer ab» kein verworfener Weg mehr, sondern Pflicht (Story 2 AK 10). |
| **Neu verworfen:** Probe je Verein (E4 b): Status in allen Teams, Zählung über alle Teams, DEFINER-Umbau von `probe_stand`/`team_probe_staende`, Zeilensperre bei Link-Anmeldungen | PO 9, Story 8: Schnuppern nur bei genau einem Team, Status, Kontingent und Zählung je Team. |
| **Neu verworfen:** summierte Rechte `darf_x = Mitglied OR Verwaltung` (`darf_team_verwalten`, `darf_spieler_fuehren`, `darf_spieler_zuordnen`) für Team-Inhalte und Team-Handlungen | PO 13: Rollen nach Ort; im Team gilt nur die Mitgliedschaft, im Bereich «Verein» nur die Verwaltung. Kein Rollenschalter (Epic OoS 17). |
| **Neu verworfen:** Verwaltung wird beim Team-Anlegen (standardmässig) Mitglied; `p_selbst_mitglied` | Story 5 AK 17. Unsichtbar wird das Team nicht, weil die Verwaltungssicht im selben Release kommt. |
| **Neu verworfen:** Trainer:innen ordnen zu, wenn sie führen und im Zielteam Mitglied sind (E12 a) | Story 3 AK 3: Zuordnen nur die Verwaltung. |
| **Neu verworfen (PO 01.11.2026):** Mitglieder löschen eine Spieler:in aus dem Verein, wenn alle ihre Teams eigene sind (Team-RPC `spieler_entfernen(p_team, p_spieler, p_stand)` mit `spieler_alle_teams_eigen`, Status `fremde_teams`, `alle_eigen` in `spieler_teams`, `darfLoeschen` in der Teamliste, KI-Werkzeug `spieler_loeschen`) | Epic PO 3, 4, 7, Story 3 AK 12 und OoS 5, Story 13 AK 5: Aus dem Verein löscht ausschliesslich die Verwaltung im Bereich «Verein»; Mitglieder und der KI-Assistent nehmen nur aus einem Team. |
| **Neu verworfen:** mehrere Vereine je Person, `create_team` mit `VEREIN_ANGEBEN` | PO 2, Epic OoS 1: höchstens ein Verein je Person (Invariante). |
| **Neu verworfen:** getrennte Prod-Releases R0/R1/R2/R3, Notteilung R2a/R2b | Epic: alle Stories in einem Release mit Wartungsfenster. Nur die interne Bereinigung N1 folgt (F1). |
| **Neu verworfen:** «neu im Verein»-Markierung (frühere F13) und Verwaltungs-Leseansicht ohne Mitgliedschaft | nicht in den Stories; Epic OoS 16. Die Verwaltung tritt selbst bei (Story 5 AK 12). |
| **Neu verworfen:** Bestätigung bei der Gründung speichern; Verfall nie bestätigter Konten | Story 11 OoS 2, Epic OoS 19 |
| Unique-Index **ohne** Ausnahme für Altdubletten für den Namensschlüssel je Verein bzw. für Teamnamen je Verein | Altdubletten und bestehende gleichnamige Teams bleiben (Story 2 PC 1, Story 5 PC 6); ein Unique-Index lässt sich nicht `not valid` anlegen. Beide: Prüfung im Trigger unter Vereinssperre. |
| **Verworfen im Review 11.11.2026:** eindeutiger Teilindex mit Spalte `altdublette`, Markierung der Vertreterin, Pflege-Trigger `spieler_dublette_vorher`/`_nachher` und Markierung im Sync | gleiches Ergebnis wie die Trigger-Prüfung unter Vereinssperre, die jeder Schreibweg ohnehin hält, aber mit Spalte, Index, zwei Triggern und einer Reihenfolgeregel im Sync (§3.3 a) |
| **Verworfen im Review:** Training kopieren als ein RPC in einer Transaktion | Die Bildkopien liegen im Storage und müssen vor den Inserts stehen (W`lib/kern/kopie.ts`, #197 OoS 6); ein RPC schlösse sie nicht ein. AK 8 gilt für den Endstand (§3.5). |
| **Verworfen im Review:** Personensperren beim Verein löschen | Unter READ COMMITTED sieht eine gleichzeitige Prüfung den Verein ganz oder gar nicht; Aufnahmen serialisieren schon an der Vereinssperre (§4.1). |
| **Verworfen im Review:** Ausnahmeliste in der Ortsprüfung und Regex über `… or …` | widersprach «kein Prädikat verknüpft beides» und übersah `if/elsif`; geprüft wird, dass keine Funktion beide Prädikate enthält (§5.5). |
| **Verworfen im Review:** «Vereinsverwaltung nie per KI» nur über Werkzeugsatz und grep-Wächter | Das KI-Token ist ein Nutzer-JWT mit Grant auf alle `verein_*`-RPCs; darum zusätzlich `nur_in_der_anwendung()` in der Datenbank (§4.1). |
| Eindeutiger Namensschlüssel mit stiller Zuordnung | Der Schlüssel identifiziert keine Person; Abweisen mit Hinweis statt Zuordnen (Story 2 AK 4). |
| Bestandsgrenzen 50/30 nur in App und MCP prüfen oder per RLS-`with check` | Wettrennen zwischen App und KI (Story 12 AK 8); eine Policy kann nicht serialisiert zählen. Ein Trigger mit Personensperre deckt alle Pfade. |
| Grenzen als CHECK oder Constraint | bräche `db push`, `VALIDATE` und den Sync an Beständen über der Grenze |
| Override-Spalten `vereine.spieler_max/teams_max` | PO 11: Grenzen ohne Ausnahme bis zum Preisplan |
| **Durch §0 verworfen:** unsichtbare 1:1-Vereine je Team (E1 a, E10, E13) | Es gibt immer einen sichtbaren Verein, der Bestand kommt nach FC Wyler. |
| **Durch §0 verworfen:** Vereine zusammenführen, `spieler_link_alias`, `spieler_zum_token`, deferrable FKs, Ausnahme-GUC in `teams_verein_fest` (E8, E11, R4) | keine Zusammenführung, Altdubletten bleiben getrennt (Epic OoS 2) |
| **Durch §0 verworfen:** Anfrage-Ablauf `spieler_anfragen` samt RPCs, `ANFRAGEN_MAX` | Epic OoS 3 |
| **Durch §0 verworfen:** R-V2 (letzte Zuordnung löscht die Spieler:in) und R-V1 (Verein ohne Teams verschwindet) | PO 7; ein frisch gegründeter Verein hat 0 Teams. |
| Schnupper-Status zusätzlich auf `spieler.probe_seit` spiegeln, `TEAM_ANGEBEN` | Der Status liegt nur auf der Zuordnung (`team_spieler.probe_seit`, §3.3 f); `spieler.probe_seit` ist tot und fällt mit N1 (§3.8). |
| `team_verein_vorher` legt für jedes neue Team einen eigenen Verein an (Entwurf A) | erzeugt Vereine je Team und macht Trainer:innen ohne Gründung zur Verwaltung, dauerhaft wegen unveränderlicher `verein_id` |
| `team_aufloesen_wenn_leer` vor der Verwaltungssicht droppen | Teams ohne Trainer:in wären bis zur Verwaltungssicht unsichtbar; der Drop liegt in Story 5 mit `verein_ansicht`. |
| `ist_team_mitglied` um eine Vereins-Klausel erweitern | griffe still in 134 Stellen ein und gäbe der Verwaltung Rechte auf Termine und Meldungen; widerspricht PO 13 |
| `teams_select` für Vereinsmitglieder verbreitern | `pruefeTeamMitglied`, Seitenleiste und `teams_abrufen` deuten Sichtbarkeit als Mitgliedschaft. |
| Selbstübernahme eines Vereins ohne Verwaltung | PO 3, Epic OoS 13 |
| `verein_verwaltung.user_id … on delete cascade` (Entwurf A) | Eine Löschung über Dashboard oder Admin-API liesse Vereine still ohne Verwaltung zurück. `delete_account` löst den Ein-Personen-Fall ausdrücklich (L15). |
| Kontextteam-Pflicht im gemeinsamen Fachkern | sperrte die Web-Verwaltung bei Spieler:innen ohne Team aus (Story 6 AK 14) |
| Umhänge-Notweg für Teams (`team_verein_umhaengen`) auf Vorrat | nur, wenn die Teamliste (§6.4) ein fremdes Team findet |
| `spieler_team_wechseln` als atomarer Vorgang | Beim Herausnehmen geht nichts verloren; Verschieben ist ohnehin nicht im Epic (Epic OoS 5). |
| NOT-VALID-CHECK auf `verein_id` im Release | gilt auch für COPY unter `replica` und bräche den Sync im Fenster; kommt mit N1 (F1). |
| Betriebsregel «nach dem Sync `vereine_nachziehen()` von Hand» statt V0 | Die Lesepfade laufen über `team_spieler`; ein vergessener Nachlauf leert alle Spielerlisten auf Staging. |
| Umgehungs-Schalter (`kifu.backfill`) für die Grenz-Trigger | Testdaten laufen unter `replica`; der Backfill läuft vor den Grenz-Triggern. |
| FK-Kaskade auf `termin_statuswechsel` | löscht Historie vergangener Termine |
| `truncate … cascade` der Staging-only-Tabellen nach dem Restore | reisst über die FKs auf `vereine` den gespiegelten Bestand mit |
| Feature-Schalter `VEREINE_AKTIV` | neue Flag-Infrastruktur ohne Vorbild; ein Release mit Wartungsfenster braucht keinen |
| Adress-Hash (SHA-256) als Backfill-Schlüssel | bei erratbarer Adresse mit dem öffentlichen Repo bestätigbar; die Konto-ID verrät nichts |
| Kader als Vereinsmerkmal, Vereins-Abo für Trainer:innen | nicht im Auftrag |

---

## Anhang: Prüfprotokoll (historisch)

Befunde zur Vorfassung vom 29.10.2026, damals am Code von `origin/develop` nachgeprüft. Der Anhang ist **historisch**: Er belegt, woher Regeln des Plans stammen; massgeblich sind Epic #575 und §0–§12. Gekürzt auf die Befunde, die weiter gelten, plus eine Sammelzeile für die überholten.

| Befund (Nr. der Vorfassung) | Stand 01.11.2026 | Beleg / heutige Fundstelle im Plan |
|---|---|---|
| 1, 26: Verwaltung im Backfill über Konto-ID statt Adresse oder Hash | gilt | `vereine_nachziehen(p_verwaltung uuid default …)`; Test mit eigenem Testkonto (§6.3) |
| 2: Web-Lesepfade auf `spieler.team_id` | gilt | W`lib/kern/spieler.ts:117`, `:195`, W`lib/kern/abmeldungen.ts:86`, W`lib/kern/spiele.ts:135`; Story 1, Gate (§6.5) |
| 5: `spieler_probe_folgen` leitet das Team aus `spieler.team_id` ab | gilt angepasst | `probetraining.sql:156-175`; Team aus der einzigen Zuordnung (Story 8) |
| 6: Kontextteam-Pflicht im Kern sperrt die Web-Verwaltung aus | gilt | W`lib/actions/spieler.ts:3-12`; Pflicht in der MCP-Schicht (Story 13, §7.10) |
| 7, 30: Team-Verwaltungsseite ohne Datenquelle, Auflösungszahlen 0 | gilt | W`lib/queries/teams.ts:62-70`, `:86-111`; `verein_team_ansicht` (Story 5 AK 25) |
| 8, 38: Wettrennen Ändern ↔ Zuordnen | gilt verschärft | Vereinssperre vor jedem Lesen der Teammenge und des Vereins-Schlüssels (§4.1, Story 2 AK 8) |
| 9: Test-Inventar, Aufräumreihenfolge | gilt | `pruefe-kern-db.ts`: Team-Inserts per `git grep`, Aufräumen Teams → Spieler:innen → Vereine → Konten (§6.7); #480-Tests mit Story 5 umschreiben |
| 11: neue Ausgabespalte → drop + create | gilt | Vorbild `probetraining.sql:532-560` (§3) |
| 15, 37: Test unter `replica`, 150er-Bestand nur per psql | gilt | `pruefe-kern-db.ts:26-31` spricht nur supabase-js (§6.3, §6.7) |
| 18: alle Prod-Teams unumkehrbar unter FC Wyler | gilt | Epic Precondition 4, Teamliste §6.4, Risiko 3a |
| 21: «kein Grant» schützt neue Funktionen nicht | gilt | Muster `feedback_link_team … from public, anon, authenticated` (§3) |
| 22: jede Trainer:in erweitert den Lesekreis | hingenommen | PO 4; Risiko 27, keine Markierung |
| 28: `feedback_link_team` null → «ungueltig» | gilt | `feedback_link.sql:21-24`, `:39`, `:51`, `:64`; `feedback_link_gueltig` (Story 7) |
| 29: Termin-FKs unvollständig | gilt | `termin_kader.sql:41-46`, `spiel_treffpunkte.sql:22-24`; FKs in Story 3 (§3.3, §6.4) |
| 36: Link-Oberfläche für die Verwaltung | gilt für den Link | Story 6 AK 9–11; Schnuppern nicht im Bestand (Story 6 OoS 2) |
| 41: Platzhalter `add_team_member_alt` | erledigt | keine Umbenennung (§3.8) |
| **neu** 42: Anwesenheit Herausgenommener an begonnenen Terminen | eingearbeitet | `termin_anwesenheit_setzen` prüft heute `spieler … team_id = t.team_id` (`20261020100000_nachtrag_anwesenheit.sql:59`); eine Umstellung auf `spieler_im_team` sperrte Story 3 AK 18. Prüfung gegen den festgehaltenen Stand (L12, Risiko 20). |
| **neu** 43: Verein löschen braucht den Bild-Nachlauf | eingearbeitet | Auflösen sammelt Bilder per `team_bilder` (`20261024100000_team_aufloesen_namensbestaetigung.sql:48-58`), den Storage räumt die Action (W`lib/actions/teams.ts:189-193`); gleiches Muster für alle Teams (L16) |
| **neu** 44: Bestandsgrenzen zählen über `owner_id` | eingearbeitet | `exercises.owner_id`, `trainings.owner_id`; Team-Trainings mit `owner_id null` (`team_datenmodell.sql:51-52`); Fassungen in `training_exercises` (`fassungen_datenmodell.sql:4`) zählen nicht (Story 12) |
| Überholt durch Epic #575: 3, 4, 27 (Probe-Zählung über alle Teams, DEFINER-Umbau), 10 (`p_selbst_mitglied`), 12, 13, 14, 16, 19, 20, 24, 25, 34, 35, 40 (Zugang, Einladungen, Invite-only, Altkonten, Mailkontingent), 17 (Verwaltung nur mit Annahme), 23 (MCP-Vereinsfelder bräuchten Zustimmung; PO 12 verzichtet), 31–33 (Doku-Stellen, neu in §7.11), 39 (Marker je Release) | entfällt | – |
