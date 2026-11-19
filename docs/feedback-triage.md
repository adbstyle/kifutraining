# KiFu – Produktwissen für die Einordnung von User-Feedback

Stand 2026-11-19 (Release 1.50.0). Zusammenfassung der Produktdokumentation unter `docs/produkt/`,
gedacht als Kontext für ein kleines Modell (z. B. Haiku), das Rückmeldungen von Nutzer:innen
einordnet. Rückmeldungen sind **Fehlermeldungen ebenso wie Feature-Wünsche**: Das Modell erkennt,
was die Person meint, gleicht es mit dem heutigen Stand ab und stellt die Rückfragen, mit denen sich
ein Fehler reproduzieren oder ein Wunsch verstehen lässt.

**Pflege:** Wird bei jedem Merge nach `main` zusammen mit `docs/produkt/` nachgeführt. Wo diese
Zusammenfassung und die Produktdokumentation auseinandergehen, gilt die Produktdokumentation.

**Grundregel:** Wo diese Zusammenfassung und die Anwendung auseinandergehen, gilt die Anwendung.
Beschreibt eine Meldung ein Verhalten, das hier als Absicht oder als „Bekannte Grenze" steht, ist es
**kein Fehler** – oft aber ein berechtigter Wunsch.

---

## 1. So ordnest du eine Rückmeldung ein

| Kategorie | Wann | Beispiel |
|---|---|---|
| **Fehler** | Die Anwendung tut etwas anderes als hier beschrieben (falsche Zahl, Absturz, Speichern scheitert ohne Grund, Daten fehlen, falsche Person sieht etwas). | „Spielerzahl zeigt 15/15, obwohl 3 abgemeldet sind." |
| **Erwartetes Verhalten** | Verhalten ist hier ausdrücklich als Absicht beschrieben. Antwort: erklären, wie es gedacht ist. | „Die Abmeldung meiner Tochter ist verschwunden" → Termin wurde verlegt, Abmeldungen verfallen bei Verlegung. |
| **Wunsch zu einer bekannten Grenze** | Gewünscht wird etwas, das Abschnitt 12 als heute fehlend nennt. Ein Wunsch, kein Fehler; die genannte Grenze als Bezug angeben. | „Ich möchte an Trainings erinnert werden." → keine Erinnerungen. |
| **Neuer Wunsch** | Etwas Neues, das weder beschrieben noch als Grenze genannt ist. | „Ich möchte pro Übung ein Video hinterlegen." |
| **Wunsch, der schon erfüllt ist** | Die gewünschte Fähigkeit gibt es bereits. Antwort: zeigen, wo sie liegt. | „Ich hätte gern Alternativen für den Hauptteil." → Varianten des Hauptteils. |
| **Wunsch nach anderem Verhalten** | Die Fähigkeit gibt es, sie soll sich aber anders verhalten als bewusst entschieden (Abschnitt 10). | „Abmeldungen sollen bei einer Verlegung bestehen bleiben." |
| **Bedienproblem / Unklarheit** | Funktion existiert, Person findet sie nicht oder versteht sie falsch. | „Wo kann ich ein Training kopieren?" → drei Punkte → Übernehmen. |
| **Datenschutz / Sicherheit** | Jemand sieht Daten, die er nicht sehen dürfte, oder ein Link/eine Adresse wurde missbraucht. Immer hoch priorisieren. | „Ich sehe die E-Mail einer Person, die nicht in meinem Team ist, und gehöre nicht zur Vereinsverwaltung." |

Meldungen können mehrere Kategorien treffen (z. B. Fehler + Wunsch). Nenne dann beide.

Bei einem Wunsch immer zuerst prüfen, ob es die Fähigkeit schon gibt – auch unter anderem Namen
(Glossar, Abschnitt 2) oder über den KI-Assistenten (Abschnitt 8). Viele Wünsche treffen eine
bekannte Grenze; dann diese wörtlich als Bezug nennen, damit gleiche Wünsche zusammenfinden.

### Rückfragen zu einem Wunsch (nur die passenden stellen)

- Welches Problem soll gelöst werden – was ist die Situation auf dem Platz oder im Team? (Das
  Problem ist wichtiger als die vorgeschlagene Lösung.)
- Wer braucht es: Trainer:in, verantwortliche Person, Vereinsverwaltung, Konto ohne Verein, Eltern, Spieler:in?
- Wie oft kommt die Situation vor (jedes Training, jede Saison, selten)?
- Wie wird es heute gelöst (Umweg in KiFu, anderes Werkzeug, Zettel, Chat)?
- Welche Altersstufe, welches Gerät (Telefon auf dem Platz oder Rechner zu Hause)?
- Was wäre das Mindeste, das schon hilft?
- Betrifft der Wunsch Daten von Spieler:innen oder Eltern? (Dann Datenschutz mitdenken: KiFu führt
  bewusst nur Vorname, Nachname, Jahrgang, J+S-Nummer und keine Kontaktdaten.)

### Rückfragen zur Reproduktion eines Fehlers (nur die passenden stellen)

**Immer:**
- Was genau getan (Schritte), was erwartet, was passiert? Wortlaut einer Fehlermeldung?
- Gerät und Bildschirm: Telefon / Tablet hoch / Tablet quer / Laptop / breiter Bildschirm? Browser?
  (Viele Ansichten verhalten sich je nach Breite anders – siehe Abschnitt 3.)
- Angemeldet oder ohne Konto? Über einen **privaten Link** (Eltern) oder als Trainer:in? Als Vereinsverwaltung, im Team oder im Bereich „Verein"? Konto ohne Verein (keinem Team, keiner Verwaltung angehörig)?
- Wann (Datum/Uhrzeit)? Viele Regeln hängen an Schweizer Zeit, Terminbeginn, Meldefrist.
- Prod (ki-fu.ch) oder Staging (staging.ki-fu.ch)?

**Je nach Bereich:**
- Übung: Altersstufe (Kinder-/Juniorenfussball)? Eigene, Manual- oder fremde Übung? Entwurf oder öffentlich? Mit Diagramm/Foto?
- Training: Altersstufe? Persönlich, Team-Training oder Termin-Training? Entwurf oder öffentlich? Mehrere Varianten des Hauptteils? Gruppen?
- Termin: Training oder Spiel? Einzeltermin oder Serientermin (welche Wahl: nur dieser / folgende / alle)? Schon begonnen? Ausgefallen? Verlegt? Kader am Termin?
- Team: Führt das Team eine Spielerliste? Kader? Selbstabholung an? Wie viele Mitglieder? Hat das Team überhaupt eine Trainer:in?
- Spieler:in: In wie vielen Teams? Ohne Team? Schnuppert sie? Gibt es im Verein einen Doppeleintrag aus der Zeit vor dem Verein?
- Verein: Vereinsverwaltung oder Trainer:in? Bereich „Verein" › Teams, Spieler:innen oder Verwaltung?
- Spiel: Meldefrist gesetzt / abgelaufen? Richtwert (Mindest-/Höchstzahl)? Anpfiff vorbei?
- KI-Assistent: Welcher Client (Claude Desktop, claude.ai, Claude Code)? Welches Werkzeug, welche Antwort?
- Mehrere Personen gleichzeitig am selben Training/Termin? (Siehe Abschnitt 11.)

---

## 2. Begriffe (Glossar)

- **KiFu** – Name der Anwendung (ki-fu.ch). Trainings für Kinder- und Juniorenfussball, nach den SFV-Manuals.
- **Altersstufe** – Kinderfussball (Alterskategorien **G, F, E**) oder Juniorenfussball (**D, C, B, A**). Jede Übung und jedes Training gehört genau einer an. Mengen überschneiden sich nicht.
- **Alterskategorie** – G/F/E bzw. D/C/B/A; als farbige Einzelbuchstaben dargestellt, immer aufsteigend G→A.
- **Trainingsteil** – Kinderfussball: Auffangen, Einleitung, Hauptteil, Ausklang. Juniorenfussball: Auffangen, Einstieg, Hauptteil, Abschluss.
- **Hauptteilkategorie** (nur Kinderfussball-Hauptteil) – „Fussball spielen lernen", „Vielseitigkeit erleben", „Fussball spielen" (= freies Spiel).
- **Block** (nur Juniorenfussball) – sieben Blöcke: Auffangen; Einstieg = Aufwärmen, Spielform zum Trainingsziel, Explosivität; Hauptteil = „Spielformen und unterstützende Übungen", „Spiel"; Abschluss.
- **Methodischer Fahrplan** (nur Kinderfussball) – Ablauf in drei Stufen: Offen starten, Üben, Wetteifern. Nicht in Auffangen, Ausklang und freiem Spiel (dort Freitext).
- **Erscheinungsform** – Einordnungsmerkmal einer Übung (Filter). Kinderfussball: Einleitung/Hauptteil; Junioren: alle Blöcke ausser Auffangen.
- **Feldtyp** (Kinderfussball) – Kleinfeld, Grossfeld, freies Feld (freies Feld optional mit Metern). **Spielfeldgrösse** (Junioren) – Länge × Breite in Metern, optional, nur beide zusammen.
- **Übungstyp** (Junioren) – Basisspielform, Spielform, isolierte Form; optional.
- **Herkunft / Plaketten** – „Kifu-Manual" (75 kuratierte Kinderfussball-Übungen, für niemanden änderbar), „Community" (öffentliche Trainer-Übung), „Entwurf" (eigene private).
- **Fassung** – Jede Übung in einem Training ist eine eigenständige Kopie (keine Verknüpfung zur Bibliothek).
- **Variante** – alternativer Inhalt des **Hauptteils** eines Trainings (z. B. „21 Kinder", „bei Regen"). Immer der ganze Hauptteil.
- **Gruppe** – Bezeichnung im Training (z. B. „Rot"), ohne Spieler:innen. **Durchlauf** – Reihenfolge der Gruppen an einer Hauptteil-Übung. **Wechsel** – Position im Durchlauf = Zeitfenster.
- **Verein** – Dach über Teams und Spieler:innen; nur ein Name (1–60 Zeichen, nicht eindeutig). Jedes Team gehört genau einem Verein, für immer. Die Teams aus der Zeit vor den Vereinen kamen gemeinsam in einen ersten Verein. Vereinsnamen stehen ohne Artikel nach „Verein": „im Verein «FC Muster»".
- **Vereinsverwaltung** – Personen, die im Bereich „Verein" Teams, Trainer:innen, Spielerbestand und den Verein führen; gleichberechtigt, mindestens eine. Kann zugleich Trainer:in sein, hat im Team aber keine weiteren Rechte. Wer „Vereinsleitung" oder „Vorstand" schreibt, meint meist sie.
- **Vereinsmitglied** – wer einem Team des Vereins oder seiner Verwaltung angehört; höchstens ein Verein je Person. Kein Rollenfeld, keine Plattform-Admin-Rolle.
- **Konto ohne Verein** – Konto, das weder einem Team noch einer Vereinsverwaltung angehört (jede Neuregistrierung). Eigene Übungen und Trainings (höchstens 50/30), Bibliothek, KI-Assistent, Verein gründen; keine Teams, Spielerlisten, Kalender.
- **Rollen nach Ort** – Was eine Person darf, folgt aus dem Ort: im Team als Trainer:in, im Bereich „Verein" als Vereinsverwaltung, nie als Summe.
- **Bereich-Wechsler** – oben in der Seitenleiste: eigene Teams oder der Verein.
- **Spielerbestand / Vereinsliste** – alle Spieler:innen des Vereins unter Verein › Spieler:innen, mit und ohne Team. Verwaltung: Bestand mit Aktionen; übrige Trainer:innen: Vereinsliste nur lesend (Name, Jahrgang, Teams).
- **Zuordnen / Aus dem Team nehmen** – eine Spieler:in einem weiteren Team zuordnen (nur Verwaltung) bzw. die Zuordnung beenden (Trainer:innen des Teams, Verwaltung); Herausnehmen löscht nicht.
- **Spieler:in ohne Team** – im Verein geführt, keinem Team zugeordnet; nur die Verwaltung ändert, ordnet zu oder löscht sie.
- **Team** – Trainerteam im Verein; alle Mitglieder gleichberechtigt. Besteht auch ohne Trainer:in weiter.
- **Team-Bestand** – Trainings, die dem Team gehören. **Termin-Training** – stille Kopie, die beim Zuordnen an einen Termin entsteht; lebt nur mit dem Termin, steht nicht im Bestand.
- **Termin** – Training oder Spiel im Teamkalender. **Terminserie** – wöchentlich wiederholte Trainingstermine (max. 1 Jahr).
- **Abweichung** – Angabe eines Serientermins, die „nur für diesen Termin" geändert wurde; zurück mit „Der Serie folgen".
- **Trainer:innen am Termin** – eingeladen / dabei / abgesagt / verantwortlich (max. eine Person). „Absagen/dabei" = Trainer:innen; „abmelden/angemeldet" = Spieler:innen.
- **Mindestbesetzung** – nötige Trainer:innen: feste Zahl oder Verhältnis (1 je n Spieler:innen).
- **Spielerliste** – die dem Team zugeordneten Spieler:innen (Vorname, Nachname, Jahrgang, optional J+S-Nummer). Spieler:innen gehören dem Verein, nicht dem Team.
- **Kader** – benannte Teilmenge der Spielerliste (z. B. „Torhüterinnen"); Termine lassen sich auf Kader beschränken.
- **Schnuppertraining / schnuppert** – für Spieler:innen, die den Verein ausprobieren, nur bei genau einem Team: an Trainings zuerst nicht angemeldet, meldet sich über den Link selbst an, höchstens für die Anzahl Schnuppertrainings des Teams; Spiele gelten für sie nicht. Plakette „Schnuppern 1/4". Alte Release-Texte unter „Versionen" nennen es noch mit dem früheren Namen.
- **Info-Schreiben** – Text des Teams für schnuppernde Spieler:innen, ohne Formatierung; steht am privaten Link zugeklappt auf der Seite „Infos" (ⓘ neben dem Namen).
- **Infos zum Team** – ein gegliederter Text je Team für die Eltern (Regelbetrieb, Abmelden, Ausrüstung), mit Stand-Datum; am privaten Link auf der Seite „Infos", nicht beim Schnuppern.
- **Privater Link** – ein Link je Spieler:in im ganzen Verein, zeigt die Termine aller ihrer Teams; Eltern melden darüber ohne Konto ab/an und abonnieren Termine.
- **Benachrichtigung** – Eintrag am privaten Link (Glocke) zu einem neuen Spiel, Ausfall, Rücknahme eines Ausfalls, Verlegung oder Wegfall eines Termins; das Mitglied entscheidet beim Speichern (Kästchen „Spielervertretungen benachrichtigen", vorbelegt an). Nur am Link, kein Push, keine E-Mail.
- **Selbstabholung / Abholadresse** – Team-Adresse, über die Eltern mit Vorname+Nachname+Jahrgang den privaten Link (für alle Teams der Spieler:in) selbst holen.
- **Bezogen** – der aktuelle private Link wurde über die Abholadresse herausgegeben (grüner Punkt).
- **Richtwert** (Spiel) – Mindest- und Höchstzahl. **Meldefrist** – bis wann Eltern für ein Spiel melden. **Treffpunkte** (Spiel) – je Anreiseart (vor Ort, öV, Auto, Velo, Car/Vereinsbus). **Treffpunkt** (Training) – höchstens einer, Uhrzeit + Ort, ohne Anreiseart.
- **Nicht aufgeboten** – Kennzeichnung einer Spieler:in für ein Spiel durch Mitglieder.
- **Stand bei Beginn / beim Anpfiff** – eingefrorener Stand der Anmeldungen ab Terminbeginn. **Nachtrag** – „nicht erschienen" / „doch erschienen".
- **KI-Zugang / MCP** – ein KI-Assistent (z. B. Claude) verbunden über `https://ki-fu.ch/api/mcp`.
- **Snackbar / Zeile am unteren Rand** – kurze Rückmeldung zu einem Vorgang. **Hinweis (Section Message)** – bleibender Zustand im Seiteninhalt.

---

## 3. Oberfläche und Navigation

**Seitenleiste (links):** Marke (Zeichen F mit Punkt, Name KiFu) → Übungsbestand. Angemeldet darunter der **Bereich-Wechsler**: eigene Teams (Untertitel „Trainer:in", alphabetisch) oder der Verein („Teams und Spieler:innen des Vereins"); nur ein Bereich → Anzeige ohne Liste. Darunter nur die Einträge des gewählten Bereichs: Team → „Trainingsplan", „Trainings", „Team"; Verein → „Teams", „Spieler:innen", nur für die Verwaltung „Verwaltung". Trainer:in sieht ihre Teams + Verein; Verwaltung ohne Team nur den Verein; **Konto ohne Verein** hat keinen Wechsler, sondern die Gruppe „Start" mit „Teams" (Einstieg). Der Wechsler ist nur Navigation, keine Rechte. Offener Bereich folgt der Seite; auf Seiten ohne Bereich (Bibliotheken, Teamübersicht, Konto) bleibt der zuletzt gewählte (pro Browser). Dann Gruppen „Bibliothek" (Übungen, Trainings) und „Meine Bibliothek" (Meine Übungen, Meine Trainings). Unten: „Fragen und Feedback" (nur angemeldet; öffnet diesen Dialog), „Darstellung" (nur angemeldet), Version (Klick → „Versionen"), Konto. Den Styleguide führt die Leiste nicht mehr. Ohne Anmeldung: „Anmelden" statt Konto, Wechsler und „Meine Bibliothek" fehlen. Die Grenzen 50/30 stehen nicht in der Leiste.
- Breit/schmal nur per Knopf links vor den Brotkrumen; Wahl merkt sich der **Browser**, nicht das Konto.
- Telefon: Menüknopf oben öffnet die Leiste als Überlagerung; kein Verkleinern-Knopf.

**Hell und dunkel:** KiFu folgt der Einstellung des Geräts (ohne Angabe: hell), wechselt beim Umstellen des Geräts sofort mit. Angemeldet unter „Darstellung": „Wie das Gerät", „Hell", „Dunkel" — wirkt sofort, ohne Neuladen, Eingaben bleiben. Wahl gilt **pro Browser** (nicht pro Konto), auch abgemeldet auf Anmelde-, Registrier- und Passwortseiten. **Ohne Anmeldung** sind alle Seiten mit Leiste immer hell. Seiten hinter privatem Link folgen nur dem Gerät (keine Wahl). Druck immer hell.
- Neue Version: Plakette „Neu" an der Versionszeile (schmal: Punkt), bis „Versionen" angesehen wurde. Pro Browser gemerkt. Neue Version erscheint spätestens 1 h nach Veröffentlichung, beim nächsten Seitenwechsel.

**Seiten:** Brotkrumen zuoberst, rechts davon die Aktionen der Seite. Übersichten ohne sichtbare Überschrift (Name steht in der Brotkrume). Ab Laptop-Breite klebt die Kopfzeile; auf dem Telefon nur die Menüzeile.

**Geteilte Seiten (nur breiter Bildschirm):** Übung (links Inhalt, rechts Einordnung), Training (links Übungen, rechts Eigenschaften oder geöffnete Übung), Trainingsplan mit geöffnetem Termin. Jede Seite scrollt für sich; Spaltenbreite per Griff ziehbar (Doppelklick = Standard), gilt für Übung und Training gemeinsam, pro Gerät gespeichert. Schmal: alles untereinander, kein Ziehen.

**Bedienung:**
- Alle Bedienelemente 36 px hoch, auch auf dem Telefon (bekannt: kleiner als für Finger empfohlen).
- Felder ohne Rahmen im Ruhezustand; Name klein über dem Wert. Maus-Hover hellt Name, Feld und Hinweis/Fehler darunter gemeinsam auf; Klick auf den Hinweis führt ins Feld. Erklärungen hinter **ⓘ** direkt nach dem Namen (erscheint nur bei Maus-Hover; auf Touch-Geräten nie – ausser 3 Hinweise, die dort unter dem Feld stehen: feste Altersstufe eines Trainings, wen die erwartete Spielerzahl zählt, „0 Tore = keine").
- Fehler beim Speichern rot unter dem Feld. Felder, die beim Verlassen speichern, fallen bei Fehler auf den gespeicherten Wert zurück + Meldung am unteren Rand.
- **Schalter** = sofort wirksame Ja/Nein-Angabe (Trainer:in dabei, Spieler:in angemeldet, Selbstabholung). Kästchen = Formular, das erst gespeichert wird. Spieler:innen-Schalter und Selbstabholung sind bewusst ruhig: grauer Knopf, an rechts mit Haken, aus links mit Kreuz (Trainer:in dabei: violetter Knopf). Am privaten Link steht an einem ausgefallenen Termin kein Schalter.
- Filter als Knöpfe mit Zähler; Mehrfachwahl; gleiche Art = ODER, verschiedene Arten = UND.
- Wiederholbare Einträge (Felder eines Termins, Material) über eine Zeile, die wie ein leeres Feld aussieht („Feld hinzufügen (optional)").

**Rückmeldungen:**
- Vorgang → kurze Zeile unten Mitte, verschwindet nach **6 Sekunden** (wartet bei Hover/Fokus), immer nur eine, der Reihe nach. Neuere Meldung zur selben Sache ersetzt ältere. Nicht nachträglich abrufbar, kein „Erneut versuchen"-Knopf.
- Seitenwechsel durch den Vorgang selbst → Bestätigung auf der neuen Seite, nur einmal (nicht nach Neuladen/Zurück).
- Fehler in einem offen bleibenden Dialog → Grund oben im Dialog.
- Zustand → Hinweis im Seiteninhalt (rötlich = ging nicht, bläulich = sonst), bleibt bis erledigt.
- Seiten hinter privatem Link: keine Zeile am Rand; Schalter springt zurück, Grund steht an der Terminkarte.

**Weitere Seiten:** „Versionen" (Release-Texte von GitHub, 30 neueste sofort, ältere auf Knopf; ohne Anmeldung; Cache bis 1 h; bei GitHub-Ausfall letzter Stand + Hinweis). „Styleguide" (Designsystem, ohne Anmeldung, nur direkt unter ki-fu.ch/styleguide, nicht in der Leiste). „Cookies" (was im Browser liegt + Besucherstatistik Vercel Web Analytics; ohne Anmeldung erreichbar). Falsche Adresse → Hinweisseite mit Weg zu den Übungen. Anmelde-Seiten ohne Leiste.

**Fragen und Feedback:** Gespräch mit Haiku (Anthropic, USA) über Fehler, Wünsche und Fragen; Trainer:innen über die Seitenleiste, Eltern über eine am unteren Rand klebende Leiste auf der Seite hinter dem privaten Link. Desktop: Spalte rechts, bleibt beim Seitenwechsel offen; Telefon und privater Link: Vollbild. Gespeichert wird nur die bestätigte Zusammenfassung samt Gespräch (Trainer:innen mit Konto; am privaten Link ohne Spieler:in, Team oder Link, auch für eine Spieler:in ohne Team); Eltern verweist der Dialog bei Dringendem an die Trainer:innen, bei einer Spieler:in ohne Team an die Vereinsverwaltung (mit Vereinsnamen); bei Verhalten von Personen im Verein an Vereinsverwaltung oder Swiss Sport Integrity (kein Feedback). Keine Antwort über KiFu, Löschung nach 12 Monaten; bei Konto-Löschung bleibt es ohne Kontobezug, bei gelöschtem Team oder Verein ohne Teambezug. Fällt die KI aus oder ist ihr Budget aufgebraucht: nur „Feedback ist gerade nicht möglich", kein anderer Weg.

**Plakettenfarben:** grau = benennt (Herkunft, Entwurf, Altersstufe), blau = gilt nach aussen, violett = Zusatz (mehrere Varianten, neue Version), orange = braucht Aufmerksamkeit (Termin ohne Training).

---

## 4. Konto und Zugang

- **Registrierung:** E-Mail + Passwort (min. 8 Zeichen, 2× eingeben). Danach immer derselbe Hinweis „Bestätigungslink unterwegs" – auch bei bereits registrierter Adresse (Absicht, verrät keine Konten). Konto nutzbar erst nach Klick auf den Mail-Link.
- **Anmelden:** Vor Bestätigung → Hinweis + Mail erneut anfordern. Falsche Adresse/Passwort → bewusst unbestimmte Meldung. Kein Magic-Link, kein Login über Google o. Ä.
- **Passwort vergessen:** immer gleiche Antwort; neues Passwort 2×; altes wird abgelehnt. Passwort ändern geht **nur** über diesen Mailweg.
- **Konto-Seite:** E-Mail, Abmelden, eigene Übungen, Anzeigename, KI-Zugänge, Kalender-Abos, Cookies, Konto löschen. Kein Profilbild, keine Adresse, keine Vereinszugehörigkeit als Profilangabe.
- **Anzeigename:** Sichtbar für andere (Urheber öffentlicher Trainings, Mitgliederlisten, Termine, Kalender-Abos anderer; als Verantwortliche:r auch für Eltern am privaten Link). Ohne eigenen Namen automatische Kennung „Trainer:in a1b2". Max. 40 Zeichen. Speichert beim Verlassen/Enter, Escape verwirft. **Einmal gesetzt nicht mehr entfernbar** (Absicht).
- **E-Mail-Adresse** sehen Mitglieder gemeinsamer Teams (Mitgliederliste, Trainer:innen-Auswahl) und die Vereinsverwaltung (bei jeder Trainer:in des Vereins und bei der Verwaltung). Übrige Vereinsmitglieder sehen von der Verwaltung nur den Anzeigenamen. KI-Assistent bekommt sie nie. Wer sie sieht, sagt das ⓘ beim Anzeigenamen.
- **Konto ohne Verein:** jede Neuregistrierung, und wieder, wer das letzte Team verlässt (ohne Verwaltung) oder dessen Verein gelöscht wird. Bibliothek, eigene Übungen/Trainings, KI-Assistent; keine Teams/Spielerlisten/Kalender. Unter „Teams" der Einstieg „Willkommen bei KiFu": „Verein gründen" oder „In einen Verein aufgenommen werden" (eigene Adresse zum Kopieren, die man Trainer:innen/Verwaltung selbst gibt; keine Anfrage, keine Einladung per Mail). **Höchstens 50 eigene Übungen und 30 eigene Trainings** (Details Abschnitt 5/6); entfällt sofort mit der Aufnahme in ein Team oder eine Verwaltung, gilt wieder ohne Verein; Bestand darüber bleibt und bleibt änderbar.
- **Ohne Konto:** gesamter Übungsbestand und alle öffentlichen Trainings ansehen, suchen, filtern, durchführen, drucken. Nicht: anlegen, bearbeiten, favorisieren, übernehmen, Teams. Geschützte Adresse → Anmeldung → danach zurück zum Ziel. Ausnahmen ohne Konto: Kalender-Abo-Links, privater Link, Abholadresse.
- **Konto löschen** (unumkehrbar, Bestätigung): Favoriten, private Übungen, persönliche Trainings weg. Öffentliche Übungen/Trainings bleiben ohne Urheber. **Teams bleiben** samt allem; letzte Trainer:in weg → Team besteht ohne Trainer:in, bis die Verwaltung jemanden aufnimmt oder auflöst. Aus allen anstehenden Terminen ausgeladen; an vergangenen „Ehemaliges Mitglied". Kalender-Abos erlöschen (ohne Hinweis), KI-Zugänge entzogen. Drei Fälle: **frei** (ohne Verein, nur Trainer:in, oder weitere Personen in der Verwaltung) → „Konto endgültig löschen"; **letzte Verwaltung** bei weiteren Vereinsmitgliedern → „Konto lässt sich noch nicht löschen" (erst jemanden in die Verwaltung aufnehmen oder Verein löschen, „Zur Verwaltung"); **einzige Person im Verein** → „Konto und Verein löschen" mit Aufzählung und exaktem Vereinsnamen. Geprüft beim Ausführen erneut (inzwischen jemand dazugekommen/umbenannt → nichts gelöscht, Hinweis).
- **Rollen:** nur zwei, nach Ort – Trainer:in eines Teams und Vereinsverwaltung. Im Team alle gleichberechtigt; keine weitere Abstufung (keine nur lesende Rolle).

---

## 5. Übungen

**Zwei Herkünfte:** 75 kuratierte Kinderfussball-Übungen („Kifu-Manual", nicht änderbar, nur per Neuladen des Bestands aktualisiert) + Übungen der Trainer:innen (Entwurf/privat → öffentlich „Community", jederzeit umschaltbar). **Für Juniorenfussball gibt es keinen kuratierten Bestand** – Start ist leer.

**Erfassen:** Altersstufe zuerst; sie bestimmt Felder, Pflichtangaben und Wortschatz. Maske einspaltig: Einordnung → Feld-Diagramm → Beschreibung (Ablauf, Varianten) → Material → Foto. Ein Speichern sichert alles inkl. Diagramm.
- Kinderfussball: Trainingsteil (Hauptteil mit Pflicht-Hauptteilkategorie, im selben Feld). Fahrplan oder Freitext je nach Teil. Feldtyp optional (einmal gewählt nicht mehr leerbar, nur wechselbar; „kein Feldtyp" gibt es nicht). Meter nur beim freien Feld.
- Juniorenfussball: Block (sieben). Beschreibung **in jedem Block Pflicht**, kein Fahrplan, keine Hauptteilkategorie, kein Feldtyp. Spielfeldgrösse und Übungstyp optional.
- Gemeinsam: Name, ≥1 Alterskategorie, Anzahl Spieler:innen (min/max, Selbstauskunft), Material, Varianten, Bild (Diagramm und/oder Foto).
- Umhängen in einen Teil ohne bestimmte Felder → Hinweis, welche Angaben entfallen werden.
- **Ungesicherte Änderungen**: Verlassen (Link, Leiste, Zurück, Neuladen, Schliessen) fragt nach. Kein Zwischenspeichern, kein Auto-Entwurf – Browserabsturz = ungespeicherte Zeichnung weg (bekannt).
- **Textformat** in Ablauf/Fahrplan/Varianten: Zeilenumbrüche bleiben; Zeile mit „- " / „* " = Aufzählung, „1. " = nummeriert. Sonst keine Formatierung. Bekannt: „2. Halbzeit" am Zeilenanfang wird ungewollt zum Listenpunkt.

**Übungsseite:** links Name, Bild/Diagramm, Ablauf, Varianten; rechts Einordnung (Altersstufe, Kategorien, Teil/Block, Hauptteilkategorie, Feldtyp/Spielfeldgrösse, Spieler:innen, Übungstyp, Erscheinungsformen, Material, Herkunft). Nur die Eigentümerin sieht „Nicht erfasst" bei fehlender Erscheinungsform/Übungstyp/Feldtyp/Meter (nie im Druck, nie Pflicht). Einordnung auf der Seite nur lesbar, geändert wird in der Maske.

**Material:** gezählte Liste (Tore, Minitore, Pylonen, Teller, Stangen, Reifen, Hürden, Leibchen, 3 Balltypen, je Menge + ggf. Farbe) + freie Ergänzung (Pfeife etc., nicht gezählt). Mit Diagramm schlägt das Formular die Liste vor (jedes Symbol gezählt; Leibchen je Feldspieler, sobald ≥2 Spielerfarben; Torwart/Trainer zählen nie). Übernahme nur auf Wunsch. Ändert sich das Diagramm so, dass der Vorschlag anders ausfällt → Hinweis mit „übernehmen / beibehalten". Verschobene Figuren und eigene Anpassungen lösen keinen Hinweis aus.
- Bekannt: zählt was gezeichnet ist, nicht wofür (4 Pylonen als Tor = 4 Pylonen); Manual-Übungen schlagen fast immer Leibchen in 2 Farben vor.

**Feld-Diagramme:** Tore, Material, Personen (Posen/Blickrichtungen), Bälle, Bewegungspfade (Laufweg, Dribbling, Pass), freie Formen, Text. Setzen, verschieben, drehen, einfärben, skalieren, Mehrfachauswahl, kopieren, löschen, Rückgängig.
- Gezeichnet **nur in der Übungsmaske** (Erfassen, Bearbeiten, Übung im Training). Keine eigene Zeichenseite mehr (alte Adressen leiten in die Maske).
- **Zum Zeichnen braucht es mehr als Telefonbreite**; auf dem Telefon Hinweis statt Fläche. Für Maus/Tastatur gebaut, **nicht für Touch** (bekannt).
- Speicherprüfung: nur bekannte Elemente/Farben/Posen/Drehungen, jedes Element auf der Fläche, **max. 300 Elemente**, eindeutige Kennung. Sonst Meldung mit Art/Zahl der Problem-Elemente (z. B. „?"-Platzhalter aus alter Zeichnung). Unveränderte alte Zeichnung wird nicht neu beanstandet.
- Kreuzende Pfeile: der später gezeichnete läuft durch, der frühere ist ausgespart. Reihenfolge nicht änderbar (bekannt). Pfeile in Manual-Farbe oder per Palette einfärbbar.
- Dunkel: dunkler Rasen, helle Pfeile. Hell: blasser Rasen mit Kante, schwarze Pfeile, kräftige dunkle Farben, «weiss» erscheint als Graphit. Druck: weisser Grund, schwarze Pfeile, dunklere Farben (Absicht).
- Diagramm als **Vorlage** kopieren: eigene + alle Manual-Diagramme (keine fremden Trainer-Diagramme), Ersetzen nach Rückfrage, per Rückgängig umkehrbar, wirksam erst beim Speichern.
- **Foto:** „Foto wählen", gängige Formate inkl. HEIC; Verkleinerung im Browser auf max. 2000 px. Bei Diagramm + Foto zeigt die Übung das Diagramm.

**Überführen in die andere Altersstufe:** nur eigene Übungen. Dialog fragt neuen Teil/Block, ggf. Hauptteilkategorie, neue Alterskategorien. Wirksam erst mit Speichern. Mit kommen Name, Bild, Diagramm, Spieler:innen, Material, Varianten, Ablauftext, Meter. Weg fallen Erscheinungsformen, Übungstyp, Feldtyp ohne Meter. Fassungen in Trainings bleiben unberührt.

**Kopieren:** jede sichtbare Übung → private, unabhängige Kopie mit Bild/Diagramm, gleiche Altersstufe. Eigene Übung → Name + „(Kopie)" (jedes Mal, nicht durchgezählt); Manual/fremde → Name unverändert. Favorit wird nicht mitkopiert. Eigene über Drei-Punkte-Menü, fremde/Manual über Kopieren-Symbol. **Nicht aus der Übungsliste.** Aus einem Training: Fassung „In meine Bibliothek kopieren" (ohne Notiz/Gruppen; unvollständige erst nach Ergänzung).

**Konto ohne Verein: höchstens 50 eigene Übungen.** Zählen: alle eigenen (Entwurf/öffentlich, erfasst/kopiert, aus Training in die Bibliothek kopiert). Nicht: Manual, fremde, Fassungen in Trainings (in ein Training übernehmen bleibt frei). Anzeige oben in „Meine Übungen" („12 von 50 Übungen", ab Grenze Plakette „Nichts mehr frei", darüber „62 Übungen (höchstens 50)"; immer ganzer Bestand, auch bei Filter). „Neue Übung" an der Grenze: statt Maske „Nichts mehr frei: 50 von 50 Übungen" + „Ohne Verein besitzt du höchstens 50 Übungen. Lösche eine, um Platz zu schaffen. In einem Verein gilt die Grenze nicht." (darüber: „Lösche 13 Übungen, um Platz für eine neue zu schaffen."). Kopieren und „In meine Bibliothek kopieren" über einen Dialog mit frischem Stand. Bestehendes bleibt änderbar/löschbar. In einem Verein: keine Grenze, keine Anzeige, kein Dialog.

**Finden (Katalog):** Volltextsuche (Wortteile), Kreuz leert. Beide Altersstufen in einer Liste. Kachel: Bild, Name, Eckdaten (z. B. „F E · Fussball spielen lernen · Kleinfeld · 6–8 Sp.", max. 2 Zeilen). Filter: Trainingsteil (Kinder-Teile und Junioren-Blöcke getrennt, Kinder-Hauptteil als 3 Kategorien), Alterskategorie, Feldtyp, Erscheinungsform, Übungstyp, „Verfügbare Kinder" (Zahl; zeigt Übungen, die mit mindestens so vielen Spieler:innen gehen). Erst 24 Kacheln, „Weitere anzeigen" +24; Filteränderung beginnt wieder bei 24. Angemeldet zusätzlich: Meine Übungen, Favoriten (jede sichtbare Übung favorisierbar).
- Übungen ohne Erscheinungsform/Übungstyp/Feldtyp fallen bei entsprechenden Filtern raus (Absicht).

**Drucken:** jede sichtbare Übung, auch ohne Konto. Drucker-Symbol neben dem Herz → Druckdialog des Geräts (PDF über Druckdialog). Fuss nennt Herkunft (Manual SFV oder Community), nie Trainername; Entwurf wird vermerkt. Keine Dauer. Ohne Bild leere Feld-Skizze. Nur eine Übung pro Vorgang.

---

## 6. Trainings

**Altersstufe** wird beim Anlegen gewählt und ändert sich **nie** (auch nicht bei Aufstieg; gemischte Jahrgänge E+D nicht abbildbar).

**Aufbau (fest, nicht einstellbar):**
- Kinderfussball: Auffangen (ohne Zeit), Einleitung, Hauptteil (3 Kategorien in fester Reihenfolge), Ausklang. Keine Zeitrichtwerte.
- Juniorenfussball: Auffangen (ohne Zeit, freiwillig, nie angemahnt), Einstieg 20–30 (Aufwärmen 10–12, Spielform zum Trainingsziel 6–8, Explosivität 8–10), Hauptteil 45–65 (Spielformen 30–45, Spiel 15–20), Abschluss 5–10; total 90 min. Abweichung wird angezeigt, sperrt nie.

**Anlegen:** Name (max. 80), Altersstufe, ≥1 Alterskategorie (der gewählten Stufe; Kategorie gesperrt, bis Stufe gewählt), optional Ziel (max. 200). Letzte Kategorie nicht entfernbar.

**Aktionen** (Zeile der Brotkrumen, rechts): Durchführen, Drucken, Bearbeiten; hinter den drei Punkten: Übernehmen, Veröffentlichen/Auf Entwurf, Ins Team stellen, Einem Team-Termin zuordnen, Löschen (2. Bestätigung). Fremdes Training: keine drei Punkte. Team-Training: kein Veröffentlichen, kein Ins-Team-Stellen; im Bestand dafür „Zu mir übernehmen" und „Einem Team-Termin zuordnen" (Team vorgewählt, nur dessen Termine), in Ansicht, Bearbeiten und Detail des Bestands. Löschen eines Bestands-Trainings: „Es verschwindet damit für das ganze Team. Persönliche Kopien … bleiben bestehen." Termin-Training: „In den Team-Bestand kopieren".

**Name ändern:** direkt in der Überschrift, übernommen beim Verlassen (kein Enter nötig). Leer → alter Name zurück + Hinweis.

**Zusammenstellen:**
- Auswahl zeigt nur Übungen der Altersstufe und des Blocks (Kinder-Hauptteil: passend zur Kategorie). Junioren-Sonderfall: Explosivität zieht zusätzlich Übungen mit Erscheinungsform „Explosiv und dynamisch agieren" an, Aufwärmen jene mit „Den Körper stabil halten".
- Leere Auswahl: Anwendung sagt, ob Filter zu eng oder Bestand leer (dann Link zu „Übung erfassen").
- Klick auf Karte übernimmt; Zähler im Bild; dieselbe Übung mehrfach möglich.
- Je Teil eine Karte, Blöcke als abgesetzte Flächen (auch leere).
- Zeile: Vorschaubild, Name, Kategorien, Dauer. Pfeile verschieben **um einen Platz** (kein Drag & Drop). X entfernt nur diese Fassung.
- **Dauer** (nicht im Auffangen): ganze Minuten ≥0; Enter/Häkchen/Klick daneben speichert, Escape/Kreuz verwirft; leer = ohne Dauer. Summe läuft mit, Zahl der Übungen ohne Dauer wird genannt.
- Kategorie geändert → Anwendung nennt nicht mehr passende Übungen; Entscheid beim Trainer.
- Hinweise (sperren nie): Kinderfussball – Teil mit ungewöhnlich vielen Übungen, leeres freies Spiel. Junioren – leere Spielform zum Trainingsziel / Explosivität / Spiel / Abschluss.

**Spalte rechts (nur breit):** ohne geöffnete Übung die Eigenschaften (Altersstufe, Kategorien, Ziel, Gesamtdauer, Materialliste, Team/Termin, Sichtbarkeit, Urheber). Ziel und Kategorien dort direkt editierbar (Jira-Stil). Klick auf eine Übungszeile öffnet das Detail in der Spalte (eigene Adresse). Bearbeiten in der Spalte, Sichern/Verwerfen/Schliessen kleben oben; „Sichern und weiter" gibt es nicht. Ungesicherte Änderung + anderer Vorgang → Rückfrage „weiter bearbeiten / verwerfen". Variantenwechsel schliesst die Übung. Schmal: eigene Bearbeitungsseite.

**Notiz je Übung:** direkt unter dem Namen, speichert beim Verlassen, max. 500 Zeichen. Erscheint auch in Durchführen und Druck. Gehört dem Training (reist mit Trainingskopie, nicht mit Fassungskopie).

**Gruppen:** nur Bezeichnungen (keine Spieler:innen, keine Zahl), keine Obergrenze. Verwaltet in der Hauptteil-Karte (Leiste mit Personen-Zeichen). Chip zeigt Name + Zeit („Rot · 24 min", „–" ohne Dauer). Menü: bearbeiten, nach vorne/hinten, entfernen (Rückfrage, wenn zugewiesen). Name max. 40, nicht leer, eindeutig (Gross/klein egal).
- **Durchlauf** je Hauptteil-Übung: Kette von Gruppen-Chips; ohne Gruppe „Alle gemeinsam". Position = Wechsel (Junioren: über beide Hauptteil-Blöcke).
- Meldungen am Fuss der Hauptteil-Karte (sperren nichts): Gruppe im selben Wechsel an zwei Übungen (Chip rot), ungleich lange Übungen im selben Wechsel.
- Übung aus dem Hauptteil wegverschoben → Zuweisungen fallen **still** weg.
- Bekannt: Teil-/Gesamtdauer summieren nacheinander → bei parallelen Gruppen zu lang.

**Varianten des Hauptteils:** „Variante hinzufügen" = Kopie der angezeigten (Übungen, Dauern, Notizen, Verteilung). Beim ersten Mal 2 Bezeichnungen. Name max. 40, eindeutig. Chip geteilt: links anzeigen, Chevron Menü (anzeigen, bearbeiten, nach vorne/hinten, entfernen). Beim Öffnen gilt **immer die vorderste** Variante (nicht die zuletzt gesehene); Adresse trägt die angezeigte Variante. Entfernen fragt, wenn Übungen drin oder vorletzte (dann wird die letzte aufgelöst → heisst wieder „Hauptteil"). Zeitsummen, Gruppenzeiten, Meldungen gelten der angezeigten Variante.
- Bekannt: keine Einzelübung zwischen Varianten verschiebbar; Druck immer nur eine Variante; Ablehnung an öffentlichem Training nennt nicht die betroffene Variante.

**Fassungen:** Jede Übung im Training ist vollständige, unabhängige Kopie. Änderungen in Training und Bibliothek wirken nie gegenseitig. Herkunft wird nicht festgehalten (Manual-Plakette im Training nicht sichtbar).

**Durchführen & Drucken:** für jedes sichtbare Training, auch fremde. Durchführen: Teil für Teil, Bildschirm bleibt wach, Ziel oben, je Übung Diagramm, Feld, Spieler:innen, Material, Dauer, Ablauf, Varianten, Übungstyp (keine Erscheinungsform). Leere Blöcke ausgeblendet. Aus dem Teamplan geöffnet: Termin-Kopf (Datum, Zeit, Ort, Verantwortlich, dabei/abgesagt, Spielerzahl, Felder, Hinweis für Eltern, Bemerkung). Durchlauf + Notiz unter dem Übungstitel als Text. Variante per Chip wechseln.
- **Materialliste des Trainings** = höchster **gleichzeitiger** Bedarf (nicht Summe); parallele Gruppen im selben Wechsel zählen zusammen; Varianten mit ihrem Maximum. Freie Ergänzungen einzeln, nicht zusammengezählt (bekannt: „Pfeife" kann doppelt stehen).

**Veröffentlichen:** Entwurf ↔ öffentlich, keine Kopie, bleibt bearbeitbar; Anzeigename als Urheber; Tragweite bestätigen. **Bedingungen gelten dauerhaft** (auch bei späteren Änderungen):
- beide: ≥1 Alterskategorie;
- Kinderfussball: ≥1 Übung in Einleitung und im freien Spiel („Fussball spielen");
- Juniorenfussball: ≥1 Übung in Aufwärmen, Spielform zum Trainingsziel, Explosivität, Spielformen;
- bei Varianten: Hauptteil-Bedingung in **jeder** Variante.
- Änderung, die darunter bringt → abgewiesen mit Hinweis „zuerst auf Entwurf setzen".
- Team-Trainings nicht veröffentlichbar (erst zu sich übernehmen). Private Bibliotheks-Übung bleibt privat, ihre Fassung im öffentlichen Training ist aber lesbar.
- Übernehmen eines öffentlichen Trainings: jede angemeldete Person, auch Urheber → private Kopie inkl. Ziel.
- Bekannt: keine Historie, niemand wird benachrichtigt.

**Konto ohne Verein: höchstens 30 eigene Trainings.** Zählen: alle persönlichen (Entwurf/öffentlich, angelegt/übernommen, persönliche Kopie eines Team-Trainings). Nicht: Team- und Termin-Trainings, Varianten, Gruppen, Übungen. Anzeige in „Meine Trainings" („3 von 30 Trainings", „Nichts mehr frei", „34 Trainings (höchstens 30)"); „Neues Training" an der Grenze mit Meldung „Nichts mehr frei: 30 von 30 Trainings"; „Übernehmen" über Dialog mit Stand. Bestehendes bleibt bearbeitbar/löschbar. In einem Verein keine Grenze.

**Trainingsübersicht:** öffentliche + eigene (inkl. Entwürfe), Schalter „nur eigene". **Tabelle** (keine Kacheln mehr): Name (+ Marke „2 Varianten"; hat Vorrang und allen freien Platz), Sichtbarkeit/Urheber (Entwurf/Öffentlich immer ganz; langer Urheber gekürzt, beim Überfahren ganz; schmal „von …" ungekürzt in 2. Zeile), Übungen, Dauer („Keine Dauer"), Geändert. **Seit 1.50.0 keine Altersstufe und keine Kategorien in der Zeile** (nur im Detail/Ansicht). Übungszahl/Dauer = vorderste Variante. Sortierbar nach Name, Übungen, Dauer, Geändert (Spaltenkopf; schmal eigener Knopf), steht in der Adresse und bleibt bei Suche/Filter; alte Links mit Sortierung nach Altersstufe → Grundordnung (zuletzt geändert oben). Ohne Wahl: zuletzt geändert oben, **auch mit Suchbegriff** (Suche grenzt nur ein, keine Relevanz-Ordnung). Gleichstand → Änderungsdatum; ohne Dauer immer am Ende. Klick auf Zeile → **Detail daneben** (schmal: ersetzt Tabelle): Reiter Übungen/Eigenschaften, Varianten umschaltbar, Aktionen wie in der Ansicht, nichts direkt änderbar. Unzugängliches Training in der Adresse → „Dieses Training ist nicht verfügbar." Detail schliesst, wenn das Training herausgefiltert oder gelöscht wird. **Team-Trainings erscheinen hier nie.**

---

## 7. Team-Bereich und Verein

**Verein (Bereich „Verein"):** Jedes Team gehört genau einem Verein; Spieler:innen gehören dem Verein und sind einem, mehreren oder keinem Team zugeordnet. Eine Person gehört höchstens einem Verein an; Meldungen nennen nie den Verein einer anderen Person („Diese Person gehört schon einem Verein an. Aufnehmen lässt sie sich erst, wenn sie ihn verlassen hat."). Einträge „Teams", „Spieler:innen", nur Verwaltung „Verwaltung". Erste Brotkrume jeder Teamseite nennt den Verein.
- **Teams-Übersicht** (alle Vereinsmitglieder): Vereinsname, „3 Teams · höchstens 30 Teams", Verwaltung mit Anzeigename (ohne Namen nur „Vereinsverwaltung", nie Adresse), alle Teams alphabetisch; eigene mit Plakette „Mein Team". Verwaltung zusätzlich: Spielerzahl, je Team Trainer:innen mit E-Mail, Plakette „ohne Trainer:in", Spielerzahl, eigene Team-Seite im Verein; Hinweis, dass sie Team-Inhalte nur als Trainer:in sieht („Mich aufnehmen").
- **Verwaltung** (nur Verwaltung): Karte „Verein" mit Name, „Teams 3 von 30", „Spieler:innen 144 von 1000", „Umbenennen"; Verwaltung mit Anzeigename, E-Mail und ihren Teams; „Person aufnehmen" (wie Trainer:in aufnehmen, zwei Schritte); Kreuz entfernt eine andere Person (bleibt Trainer:in ihrer Teams); Gefahrenzone „Aus der Verwaltung austreten" (eigene Teams bleiben) und „Verein löschen". **Letzte Verwaltung kann nicht austreten** (Knopf gesperrt: „Du bist das letzte Mitglied der Vereinsverwaltung. Nimm zuerst eine weitere Person in die Verwaltung auf. Du kannst den Verein auch im Bereich «Verein» löschen.").
- **Teams führen (nur Verwaltung):** „Team anlegen" (Name im Verein eindeutig – Gross/klein, Leerzeichen, Bindestrich/Leerzeichen, Apostrophe egal –, ≤ 60 Zeichen; man wird dabei nicht Trainer:in); voll bei 30 Teams. Team-Seite im Verein: Hinweis „Du verwaltest dieses Team, ohne selbst Trainer:in zu sein. …" + „Mich aufnehmen" bzw. „Zum Team"; Teamangaben („18 von 100", „Umbenennen"), Trainerteam (E-Mail, Plakette „Vereinsverwaltung", „Trainer:in aufnehmen", Kreuz für jede Person), Spieler:innen des Teams (Kreuz = herausnehmen; zuordnen nur unter Verein › Spieler:innen), Gefahrenzone „Team auflösen". Keine Termine, Trainings, Kader.
- **Team auflösen** (nur Verwaltung): exakter Teamname (Gross/klein zählt, Rand-Leerzeichen nicht), Aufzählung mit Anzahl (Team-Trainings, Trainingstermine samt Abmeldungen/Anwesenheiten, Spiele samt Meldungen, Zuordnungen, Kader). Persönliche Trainings bleiben. Spieler:innen bleiben samt Link im Verein (evtl. ohne Team). Trainer:innen mit offenem Team (Absicht, kein Fehler): nur Team verlassen/Mitglied entfernen im offenen Tab leitet in die Teamübersicht mit „Dieses Team besteht nicht mehr - die Vereinsverwaltung hat es aufgelöst."; andere Aktionen bleiben auf der Seite und melden je nach Aktion „Team nicht gefunden. Du kannst nur in Teams arbeiten, in denen du Mitglied bist." (z. B. Spieler:in hinzufügen), „Termin nicht gefunden.", „Kader nicht gefunden." oder (Trainer:in aufnehmen) „Du bist nicht mehr Mitglied dieses Teams."; Neuladen oder Wechsel in eine andere Ansicht des Teams führt ohne Hinweis in die Teamübersicht. Abos der Trainer:innen erlöschen.
- **Spielerbestand / Vereinsliste** (Verein › Spieler:innen): alle Spieler:innen mit und ohne Team, auch Schnuppernde; Kopf „144 Spieler:innen · 2 ohne Team · höchstens 1000 je Verein"; je 50 mit „Weitere anzeigen". Suche „Spieler:innen durchsuchen" (Teil von Vor-/Nachname; Gross/klein und Akzente egal, „ß"=„ss", „æ"=„ae", „œ"=„oe"; aber „Mueller" findet „Müller" nicht), Auswahl „Team" (inkl. „Ohne Team") und „Jahrgang" (je Mehrfachwahl, ODER innerhalb, UND zwischen), „Zurücksetzen"; Suche steht in der Adresse; „12 von 37 angezeigt". **Trainer:innen ohne Verwaltung** sehen nur Vorname, Nachname, Jahrgang, Teams (bzw. „ohne Team"), keine J+S, keinen Link, keinen Schnupper-Stand, keine Aktionen („Spieler:innen ordnet die Vereinsverwaltung einem Team zu."). **Verwaltung** zusätzlich J+S, Link „bezogen"/„offen", „Schnuppern 1/4"; Menü „Ändern", „Privater Link", „Einem Team zuordnen", „Löschen"; oben „Spieler:in erfassen" (kommt ohne Team in den Verein) und Import.
- **Zuordnen** (nur Verwaltung): Wahl des Teams („18 von 100", volle gedämpft), bisherige Teams bleiben. Gesammelt per Kästchen + schwebende Leiste, **ganz oder gar nicht**: schon im Team, gleiche Angaben im Team, schnuppert anderswo oder über 100 → niemand zugeordnet, Liste unter „Keine Spieler:in zugeordnet" („Mit allen gewählten wären es 103 von 100, 3 zu viel."). „Zum Schnuppern zuordnen" nur bei genau einer gewählten Spieler:in ohne Team und nur, wenn das Team eine Anzahl Schnuppertrainings hat. Erste Spieler:in eines Teams → erwartete Spielerzahl anstehender Termine fällt weg (Meldung nennt Zahl).
- **Löschen** (nur Verwaltung, nur hier, nur einzeln): „… aus dem Verein löschen" nennt Teams, dass Link und alle Meldungen entfallen, an vergangenen Terminen ohne Namen. Gelöscht → jeder Dialog „Spieler:in nicht gefunden.".
- **Doppelerfassung:** Vorname+Nachname+Jahrgang im **ganzen Verein** eindeutig (Gross/klein, Leerzeichen, Bindestrich/Leerzeichen, Apostrophe egal; Umlaute/Akzente nicht: „Müller" ≠ „Mueller"; J+S zählt nicht). Erfassen/Ändern einer schon geführten Spieler:in → abgewiesen mit Ort: im eigenen Team „Diese Spieler:in steht schon auf der Liste. Unterscheide zwei Gleichnamige mit einem Zusatz im Vornamen."; in anderen Teams „Noah Keller (2015) wird im Verein schon im Team «Da» geführt. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung."; ohne Team „… im Verein geführt, ist aber keinem Team zugeordnet …". Trainer:innen holen eine bestehende Spieler:in nie selbst ins Team. **Altdubletten** aus der Zeit vor dem Verein bleiben als getrennte Zeilen mit je eigenem Link, nicht zusammenführbar.
- **Import aus Datei** (nur Verwaltung, nur im Spielerbestand; **im Team gibt es keinen Import mehr**): CSV mit Semikolon/Komma, UTF-8 oder Windows-Zeichensatz, Kopfzeile (ClubCorner-Export), ≤ 1000 Zeilen, ≤ 1 MB; nur Vorname, Nachname, Jahrgang, J+S verlassen das Gerät. Spalten per Kopf erkannt, änderbar. Aus Geburtsdatum nur 4-stelliges Jahr (2-stellig → ausgelassen); J+S nur Ziffern („k.A." = leer). Neue kommen **ohne Team**; Bestehende erkennt er im ganzen Verein (auch ohne Team, schnuppernd). Vorschau: „Neu im Verein", „Neue J+S-Nummer", „Mehrfach im Verein geführt" (dort ändert er nie etwas), „Ausgelassen oder ohne J+S-Nummer", „Unverändert". Letzte gleiche Zeile gewinnt; leere J+S löscht nichts; wer fehlt, bleibt. Ganz oder gar nicht. Über 1000 im Verein → nichts übernommen (ohne Neue, nur J+S-Änderungen, geht es). Bestand seit der Vorschau geändert → „Seit der Vorschau hat sich der Spielerbestand geändert. Nichts übernommen. Prüfe die neue Vorschau." Danach Meldung mit Aktion „Zuordnen" (Liste „Ohne Team").
- **Verein gründen** (nur Konto ohne Verein, Einstieg unter „Teams"): „Name des Vereins" (1–60, später änderbar, nicht eindeutig) + zwei Bestätigungen (berechtigt zu handeln; Verein verantwortlich für die Daten), nicht gespeichert, nicht geprüft. Man wird erste Verwaltung, ohne Team. Inzwischen anderswo aufgenommen → „Du gehörst schon einem Verein an. Einen Verein gründen kann nur, wer keinem angehört."
- **Verein löschen** (jede Verwaltung, Verein › Verwaltung): Aufzählung mit Anzahl (Teams mit Terminen und Team-Trainings, Spieler:innen samt Links, Abos, Abholadressen, davon ohne Team; Personen, die zu Konten ohne Verein werden); Knopf erst bei **exaktem Vereinsnamen** (Gross/klein zählt, Rand-Leerzeichen nicht); inzwischen umbenannt → nichts gelöscht, neuer Name verlangt. Alles weg; Links, Eltern-Abos und Abholadressen zeigen danach die Seite „Dieser Link gilt nicht mehr"; Trainer-Abos erlöschen. Konten bleiben mit eigenen Übungen und persönlichen Trainings (dann Grenzen 50/30). Feedback bleibt ohne Teambezug. Die löschende Person landet mit Meldung auf dem Einstieg, die übrigen beim nächsten Schritt ohne Meldung.
- **Grenzen:** Verein ≤ 30 Teams und ≤ 1000 Spieler:innen (mitgezählt ohne Team, Schnuppernde, Doppeleinträge), Team ≤ 100 Spieler:innen (Schnuppernde mitgezählt). Wirken nur auf Neues (Team anlegen, erfassen, Import mit Neuen, zuordnen); Bestand darüber bleibt („1012 (höchstens 1000 Spieler:innen)"). Meldungen: „Das Team hat schon 100 Spieler:innen. Weitere kommen erst dazu, wenn es weniger sind." bzw. „Der Verein hat schon 1000 Spieler:innen. …", „Der Verein hat schon 30 Teams. …". Keine Grenze für Zahl der Vereine oder der Verwaltung.

**Teams:** Angelegt, umbenannt und aufgelöst nur von der **Vereinsverwaltung** im Bereich „Verein"; selbst gründen kann ein Team niemand (Teamübersicht: „Neue Teams legt die Vereinsverwaltung an."). Trainer:innen per E-Mail aufnehmen („Trainer:in aufnehmen", zwei Schritte: Suchen, dann Aufnehmen; nur bestätigte Konten ohne anderen Verein, keine Zustimmung nötig; die Person gehört damit zum Verein). Suche max. 10 erfolglose pro Stunde (gemeinsam mit der Suche in der Verwaltung). Alle Mitglieder gleichberechtigt (Trainings/Termine, Spielerliste, Mitglieder aufnehmen und entfernen, auch solche der Verwaltung); wer auch Verwaltung ist, hat im Team keine weiteren Rechte. Mitgliederliste mit Anzeigename + E-Mail, Plakette „Vereinsverwaltung". Karte „Teamangaben" mit Name und Verein (Umbenennen/Auflösen macht die Verwaltung). **Team besteht ohne Trainer:in weiter.**
- Drei Seiten (in der Leiste unter dem gewählten Team): **Trainingsplan** (Start), **Trainings** (Bestand), **Team** (Teamangaben, Infos zum Team, Spielerliste, Schnuppertraining, Kader, Mitglieder, Gefahrenzone „Team verlassen"). Eigene Adressen. Team, in dem man nicht ist (auch als Verwaltung) → Teamübersicht (nicht unterscheidbar von „gibt es nicht").
- **Trainings (Bestand)** seit 1.50.0 wie die Trainingsübersicht: Tabelle mit Zahl, Suche „Nach Trainingsnamen suchen", Filter Alterskategorie, Spalten Name (+ „N Varianten"), Übungen, Dauer, Geändert; **keine** Spalte Sichtbarkeit/Urheber, kein „Meine Trainings", keine Kategorien, kein Termin, keine Plakette „Eingeplant". Sortierung wie Übersicht, ohne Wahl zuletzt geändert oben (auch mit Suche), steht in der Adresse. Zeilenklick öffnet **nicht** mehr die Bearbeitung, sondern das Detail daneben (schmal: ersetzt Bestand); Aktionen: Bearbeiten, Durchführen, Drucken; drei Punkte: Zu mir übernehmen, Einem Team-Termin zuordnen, Löschen. Leer ohne Filter: „Noch kein Training im Team"; leer mit Filter: „Keine Trainings gefunden". Löschen aus dem Detail → zurück in den Bestand mit Suche/Filter/Sortierung + „Training gelöscht." (auch Altfall mit Termin).
- Wer keinem Team angehört: Teamübersicht zeigt als Konto ohne Verein den Einstieg, als Verwaltung den Hinweis, sich im Bereich „Verein" selbst aufzunehmen.
- Bekannt: Aufnahme durch anderes Konto (Team oder Verwaltung) erscheint im Wechsler erst nach Neuladen/eigener Aktion; ebenso verschwindet ein aufgelöstes Team.

**Trainings im Team:** gehören Person **oder** Team, nie beiden. Immer Kopie (Ins Team stellen, Zu sich übernehmen), vollständig (Ziel, Gruppen, Verteilung, Notizen, alle Varianten). Direkt im Team anlegen möglich. Team-Trainings nur im Team-Bereich; Leiste hält „Teams" hervorgehoben.

**Termine (Kalender):** Art „Training" oder „Spiel" (vorher wählen, danach unveränderbar). Training: Datum, Beginn, Ende (Pflicht, gleicher Tag), Ort (max. 100) samt Kartenlink, Treffpunkt, Bemerkung (max. 500, nur fürs Team), Hinweis für Eltern (max. 500, Eltern sehen ihn am Link und im Abo, ausser bei Ausfall), Felder, erwartete Spielerzahl, Trainer:innen, Mindestbesetzung, Kader. Vergangene Trainings erlaubt.
- **Kartenlink zum Ort** (z. B. geteilter Link aus Google Maps/Apple Karten): optional, nur mit Ort (ohne Ort gesperrt: „Gib zuerst einen Ort an."), muss mit https:// beginnen, max. 500 Zeichen. Ziel wird nicht geprüft (Team verantwortlich). **Ort geändert oder geleert ohne neuen Link → bisheriger Link fällt weg** (Dialog sagt es vorher). Im geöffneten Termin „Auf der Karte öffnen". An einem Serientermin weicht der Link mit dem Ort ab und folgt mit ihm wieder der Serie (eigener Link fällt dann weg).
- **Treffpunkt (Training):** optional, höchstens einer, Uhrzeit + Ort (beide Pflicht: „Bitte für den Treffpunkt Uhrzeit und Ort angeben."; Ort max. 100). Am Trainingstag, **nicht nach dem Beginn** (gleich erlaubt): „Der Treffpunkt liegt nach dem Beginn. Wähle eine Uhrzeit bis 18:00." Dialog: Feldgruppe „Treffpunkt" (Uhrzeit, Ort, ✕ entfernt), ohne Treffpunkt „Treffpunkt hinzufügen (optional)"; unter der Uhrzeit „15 Minuten vor Beginn"; ⓘ: Eltern sehen ihn am Link und im Abo, beim Verlegen bleibt der Abstand. Gespeichert als **Abstand zum Beginn**: Verlegen oder neue Serienzeit → wandert mit (im Dialog sichtbar); geänderter Ort des Termins lässt ihn stehen. Kein Kartenlink, keine Anreiseart. Anzeige: Karte „Als Nächstes" (Zeile „Treffpunkt  17:45  Ort") und Eckdaten des geöffneten Termins (auch nach Beginn/bei Ausfall); **nicht** in der Terminliste-Zeile und nicht in „Durchführen". Nicht im Mitglieder-Abo.
  - **Läge er nach einer Zeitänderung am Vortag → entfällt er** an denselben Terminen, für die die Änderung gilt. Oberfläche fragt vorher (einzeln: Dialog „Treffpunkt entfällt"; Serie: Bestätigung nennt die betroffenen anstehenden Termine; auch bei „Zeit folgt der Serie"). KI fragt nicht, nennt die Termine im Ergebnis.
- **Felder:** je Feld Länge+Breite 5–120 m (nur zusammen), Tore je Torart (Minitore, 5-m, 7-m), Untergrund (Naturrasen, Kunstrasen, Hartplatz, Halle, Unbekannt). Leer = unbekannt, **0 Tore = keine**.
- **Erwartete Spielerzahl** 1–200 (inkl. Torhüter:innen, ohne Trainer:innen) – nur ohne Spielerliste.
- Termin entfernen: Rückfrage nennt Training; Termin-Training wird mitgelöscht, altes Bestands-Training bleibt.
- Altdaten: Termine ohne Ende → 90 min; ganz ohne Zeit → 18:00–19:30.

**Trainings zuordnen:** nur über bestehenden Termin; max. 1 Training pro Termin. Am Termin (Training hinzufügen/ersetzen; Auswahl: Team-Bestand + „Meine Trainings") oder vom Training aus („Einem Team-Termin zuordnen" hinter den drei Punkten, am Bestands-Training mit vorgewähltem Team; ausgefallene Termine nicht wählbar). **Immer stille Kopie** = Termin-Training, nicht im Bestand. Verliert es den Termin (lösen, ersetzen, Termin entfernen, Serienänderung) → **gelöscht**. Fremdes öffentliches Training erst nach Übernahme zuordenbar. Brotkrumen tragen Termindatum („Mi., 23.09.2026"). Altlast: vor 2026-10-06 direkt zugeordnete Trainings bleiben im Bestand; ihr Termindatum steht seit 1.50.0 nur noch im Detail (Eigenschaften „Termin"), keine Plakette mehr.

**Terminserien:** „Wiederholender Termin" im selben Dialog; Wochentag(e), Beginn- und Enddatum (max. gleicher Kalendertag Folgejahr). Nur Trainings. Legt je Wochentag einen Termin ohne Training an; bestehende Termine bleiben daneben. Ändern/Entfernen mit Verlegung oder Wegfall ab heute → eine zusammengefasste Benachrichtigung je Spieler:in (siehe „Spielervertretungen benachrichtigen").
- Ändern: „Nur dieser Termin" (→ Abweichung), „Dieser und alle folgenden" (teilt die Serie), „Alle Termine der Serie" (inkl. vergangener). Datum nur „nur dieser"; Wochentage/Zeitraum nur „folgende/alle".
- Serie gibt ihren Treffpunkt allen Terminen mit; Dialog „Termin ändern" nennt ihn unter „Terminserie" („Treffpunkt: 17:45 · Ort"). Treffpunkt (Uhrzeit+Ort = eine Angabe) kann an einem Serientermin abweichen, auch **bewusst ohne**; zurück mit „Der Serie folgen". Abweichende Termine behalten ihn bei Serienänderungen.
- Wochentag/Zeitraum verkleinert → Termine entfallen **inkl. solcher mit Training** (Rückfrage nennt nur Termine mit Training). Genau ein Wochentag getauscht → Termine wandern innerhalb der Woche. Entfernte Termine kommen nie zurück.
- „Der Serie folgen" wirkt sofort und schliesst den Dialog – andere ungespeicherte Änderungen im Dialog gehen verloren (bekannt).

**Trainer:innen am Termin:** Eingeladene gelten als dabei, bis sie absagen. Max. eine verantwortliche Person (wird automatisch eingeladen und dabei). Beim Erstellen vorgewählt: alle Mitglieder eingeladen, man selbst verantwortlich. Reiter „Trainer:innen": „2 von 3 dabei", Gruppen Dabei / Abgesagt (mit Zeit) / Nicht eingeladen; Schalter je Person; Menü „Verantwortung geben", „Ausladen". **Jedes Mitglied darf für alle absagen/zusagen.** Eigener Stand auch über Zeilenmenü („Absagen", „Wieder zusagen", „Ich helfe aus") und Schalter „Ich bin dabei" auf der Karte „Als Nächstes".
- Absagen änderbar bis Beginn/Anpfiff; an ausgefallenem Termin ruhend. Verantwortliche sagt ab → „Wer übernimmt?". Datum/Beginn geändert (noch nicht begonnen) → **Absagen verfallen** (bei Spiel nur Datum). Neue Mitglieder sind zu bestehenden Terminen **nicht** eingeladen.
- **Mindestbesetzung:** feste Zahl oder Verhältnis (1–99). Unterbesetzt (anstehend) → rote Plakette „1 Trainer:in fehlt"; ohne Verantwortliche:n gelbe „Niemand verantwortlich". Verhindert nichts.
- Eingrenzung: „Meine Termine" (dabei) oder „Eingeladen" (inkl. abgesagt); fällt beim erneuten Öffnen des Teams weg.
- Ausscheiden aus dem Team → aus allen anstehenden Terminen/Serien ausgeladen.

**Ausfälle:** Termin bleibt, Plakette „Ausgefallen", optionaler Grund (max. 500; Eltern sehen ihn am Link). Auch nachträglich. Training ruht (öffnen ja, durchführen nein). Abmeldungen/Absagen/Nachträge ruhen; **keine Spielerzahl** angezeigt. Rücknahme stellt alles her. Training: auf heute/später verlegt → findet wieder statt; Spiel: jede Verlegung → findet wieder statt. Kein Massen-Ausfall (z. B. Ferienwoche) möglich.

**Spielervertretungen benachrichtigen:** Kästchen „Spielervertretungen benachrichtigen" (bei jedem Öffnen an) erscheint nur: Termin erstellen nur bei Spiel; Ausfallen lassen nur heute/später, nie beim Grund ändern; Ausfall zurücknehmen ab heute jetzt im Dialog „Ausfall zurücknehmen" (vergangen weiter ein Klick, still); Termin ändern nur wenn Datum/Zeit/Ort (Serie: auch Wochentage/Zeitraum) sich mitteilbar ändern, auch „Der Serie folgen" bei Zeit/Ort; Entfernen in der Rückfrage (Serie nur, wenn jemand betroffen ist). Serie ändern mit Wegfall: ein Entscheid im Termin-Dialog für beides. Unter dem Kästchen je Vorgang ein Satz, was die Eltern sehen. Empfänger: alle, für die der Termin jetzt gilt (Kader beachtet), auch abgemeldete; je Spieler:in eine Benachrichtigung je Vorgang, Serie zusammengefasst. Still bleiben: neue Trainings/Serien, Grund ändern, Treffpunkt, Hinweis für Eltern, Bemerkung, Kader, Trainer:innen, Meldefrist, Kartenlink allein, Termine vor heute, ein ausgefallener Termin, der ausgefallen bleibt. Scheitert nur die Benachrichtigung: Meldung + „Gespeichert, aber die Benachrichtigung ist nicht entstanden." Mitglieder sehen nicht, was benachrichtigt oder gesehen wurde.

**Trainingsplan:** Anstehend (aufsteigend) oben, Rückblick (zusammengeklappt, neueste zuerst) unten. Grenze = **Tagesende Schweizer Zeit** (heutiger Termin bleibt den ganzen Tag oben, auch nach Ende).
- **„Als Nächstes"**-Karte: erster anstehender, nicht ausgefallener Termin. Status „Vorbereitet" (grün) / „Nicht vorbereitet" (gelb, nur hier). Zeile mit Spielerzahl („12/14"), Kader, Trainer:innen („dabei/eingeladen"), Platz. Treffpunkt eines Trainings als Zeile „Treffpunkt  17:45  Ort". Schalter „Ich bin dabei" (gesperrt ab Beginn/bei Ausfall). Knöpfe Durchführen, Training öffnen bzw. Training hinzufügen, Spieler:innen, Trainer:innen.
- Übrige Termine nach Monaten (mit Jahr), je Tag eine Karte. Status-Wort: „Vorbereitet" grün, „Nicht vorbereitet" grau, „Fällt aus" grau; Spiel: Status zum Richtwert. Ohne Training anstehend: violett „+ Training hinzufügen". Vergangen ohne Training: „Kein Training eingetragen".
- Rechts klein: Spielerzahl (mit Liste „12/15", ab Beginn Anwesende, ausgefallen keine), Trainer:innen „2/3" mit eigenem Stand.
- **Mini-Monat** rechts (nur ab Tablet quer): folgt der Liste (Monat des obersten sichtbaren Termins); Pfeile/„Heute" wechseln nur den Monat. Punkte für farbige Status (max. 2 + „+n"). Klick auf Tag springt in die Liste. Kein Anlegen aus dem Monat. **Am Handy kein Monat.**
- **Geöffneter Termin**: rechts neben der Liste (schmal: ersetzt die Liste). Reiter **Termin / Training / Spieler:innen / Trainer:innen** (Spiel: Spiel / Spieler:innen / Trainer:innen). Eigene Adresse inkl. Reiter.
- Eigene Änderungen erscheinen sofort; **Änderungen anderer erst nach Neuladen**.

**Kalender-Abo (Mitglieder):** Menü neben „Termin erstellen" → persönlicher Link je Team (Warnung: persönlich, nicht weitergeben). Anleitung für Apple, Google (nur im Browser hinzufügen), Outlook, Proton. Liefert anstehende + letzte 28 Tage, **nur Termine, zu denen man eingeladen ist**; ausgefallene/entfernte fehlen. Titel „Training · Teamname" bzw. „Bezeichnung · Teamname", Präfix „Abgesagt · " / „Verantwortlich · ". Beschreibung: eigener Stand, wer dabei/abgesagt/verantwortlich, Lücke Mindestbesetzung, Kartenlink als „Karte zum Ort: …". Keine Trainingsnamen, Bemerkung, Felder, Spieler:innen, kein Treffpunkt. Schweizer Zeit. Erlischt bei Widerruf, Austritt, Entfernung, Kontolöschung, Teamauflösung, Löschen des Vereins; bleibt erloschen (neuer Link nötig). Kalenderprogramm bestimmt Abrufhäufigkeit (Änderungen kommen verzögert – kein Fehler).

**Spielerliste:** Karte unter „Team" („15 · 9 Links bezogen"). Vorname/Nachname je 1–60, Jahrgang 4-stellig, J+S-Nr. max. 20, **max. 100 Spieler:innen je Team** (und 1000 im Verein). Eindeutig im **ganzen Verein** (siehe Doppelerfassung oben). Dialog „Spieler:in hinzufügen" bleibt nach „Hinzufügen" offen; neu Hinzugefügte kommen in den Verein und sind diesem Team zugeordnet. Zeile: Name, Jahrgang, J+S, Kader, „Auch in" (weitere Teams), Link, „Ändern", „Aus dem Team nehmen". Änderung an Name/Jahrgang/J+S gilt sofort in allen Teams der Spieler:in (deren Trainer:innen erfahren es nicht).
- **Kein CSV-Import im Team** mehr (nur Verwaltung im Spielerbestand); Hinzufügen einzeln geht weiter.
- **Kein Löschen im Team** (für niemanden, auch nicht für die Verwaltung im Team). **„Aus dem Team nehmen"**: Rückfrage nennt, was bleibt (Spieler:in samt Link im Verein und in weiteren Teams; letztes Team → danach ohne Team, nur noch Verwaltung) und was verfällt (künftige Abmeldungen, Spiel-Meldungen, Kader in diesem Team; Schnuppern samt Zählung). An begonnenen Terminen bleibt sie mit Namen und „nicht mehr im Team", Nachtrag geht weiter; an anstehenden zählt sie nicht. Lage seit dem Öffnen geändert → nichts herausgenommen, Hinweis neu lesen.
- **Erste Spieler:in** (Hinzufügen oder Zuordnen durch die Verwaltung) → alle anstehenden Termine + Serien verlieren ihre erwartete Zahl; Spielerzahl kommt fortan aus der Liste. Liste wieder leer → Zahl unbekannt.
- Aus dem Verein gelöscht: Link ungültig, an vergangenen Terminen „Ehemalige Spieler:in" ohne Namen.
- Begonnener Termin behält „Stand bei Beginn" (minutengenau, Schweizer Zeit).

**Kader:** max. 20 je Team, Name 1–30, eindeutig (Bindestrich/Apostroph unterscheiden hier!). Hinweis: Eltern sehen die Kader ihrer Spieler:in → nichts Heikles in den Namen. Zuteilung im Spieler-Dialog oder per Mehrfachauswahl („Kader zuteilen", Leiste unten). Termin/Serie mit Kadern gilt nur für deren Mitglieder; ohne Kader für alle. Kader schliessen nichts aus. Termin für niemanden → „0 von 0".
- Termin gilt durch Kader-Änderung nicht mehr für jemanden → Abmeldung/Meldung/Kennzeichnung **verfällt** (Rückfrage mit Zahl); gilt später wieder → angemeldet (Spiel: ohne Meldung).
- Mitglieder sehen immer alle Termine (Kader filtern nur Spieler:innen).

**Infos zum Team:** Karte unter „Team" direkt nach „Teamangaben"; Untertitel „Für die Eltern am privaten Link, nicht beim Schnuppern · Stand 12.11.2026". Leer: „Noch keine Infos zum Team" + „Infos verfassen"; sonst Text gegliedert, ca. 5 Zeilen, „Ganz lesen", Stift „Infos zum Team bearbeiten". Dialog: Satz, wer es liest; „Schreiben"/„Vorschau"; Leiste Zwischentitel/Fett/Aufzählung/Nummerierung (setzt Kürzel „## ", „**…**", „- ", „1. "; nochmals drücken entfernt); auch „# ", „### ", „* " von Hand. Webadressen anklickbar; Kursiv, Links mit Text, Tabellen, Bilder, HTML bleiben Zeichen. **≤ 10'000 Zeichen samt Kürzeln**, Zähler „1'234 / 10'000"; zu lang → „Die Infos zum Team dürfen samt Gliederung höchstens 10'000 Zeichen lang sein.", alte Fassung bleibt. Leer speichern = entfernt. „Zuletzt geändert am …" im Dialog. **Stand** = Tag der letzten Textänderung (Speichern ohne Änderung lässt ihn stehen). Jedes Mitglied darf (Verwaltung nur als Mitglied). KI: `team_infos_abrufen`, `team_infos_festlegen` (immer ganzer Text, leer entfernt).

**Schnuppertraining:** Karte unter „Team" zwischen Spielerliste und Kadern („Für Spieler:innen, die den Verein ausprobieren. …"); ohne Einstellung „Noch kein Schnuppertraining" + Link „Schnuppertraining konfigurieren", sonst „2 Spieler:innen schnuppern", Anzahl, Info-Schreiben (3 Zeilen, „Ganz lesen"), wer schnuppert. Dialog „Schnuppertraining bearbeiten": **Anzahl 1–20** (zählt besuchte + angemeldete Trainings, gilt fürs ganze Team, nicht entfernbar), **Info-Schreiben optional, ≤ 2000 Zeichen**, nur Text, Zeilenumbrüche bleiben, Webadressen im Link anklickbar (am Link auf der Seite „Infos", zugeklappt), leer = entfernt.
- **Nur bei genau einem Team.** Ein-/Ausschalten nur im Dialog „Spieler:in ändern" (Checkbox „Schnuppert"); nicht beim Hinzufügen. Ohne Anzahl gesperrt. Weitere Teams → statt Checkbox „Diese Spieler:in ist weiteren Teams zugeordnet und macht darum regulär in deinem Team mit." Vor dem Einschalten: „Solange die Spieler:in schnuppert, lässt sie sich keinem weiteren Team zuordnen." Einschalten („Schnuppern einschalten") lässt Abmeldungen kommender Trainings, Meldungen und Kennzeichnungen kommender Spiele **verfallen** (Warnung mit Zahl). Ausschalten → an allen kommenden Trainings angemeldet, Spiele wieder sichtbar; erneutes Einschalten zählt ab null. Link bleibt derselbe.
- Verwaltung kann eine Spieler:in ohne Team **zum Schnuppern zuordnen** (nur einzeln, Team braucht Anzahl). Schnuppernde lässt sich keinem weiteren Team zuordnen, bis das Schnuppern endet oder sie herausgenommen wird (Herausnehmen beendet es samt Zählung).
- Plakette „Schnuppern 1/4" in Spielerliste und Karte = **besuchte** von der Anzahl (nicht die angemeldeten).
- Besucht = nach dem Einschalten begonnenes Training, bei Beginn angemeldet oder „doch erschienen" nachgetragen (nicht „nicht erschienen"). Ausgefallenes zählt nicht, Anmeldung ruht bis Rücknahme.
- Eltern melden über den Link nur bis zur Anzahl an; **Mitglieder (und KI) dürfen darüber hinaus** anmelden, mit Hinweis „… ist damit über der Anzahl Schnuppertrainings …". Anzahl senken lässt bestehende Anmeldungen stehen.
- Am Training zählt sie nur, wenn angemeldet; nicht angemeldet steht sie wie abgemeldet da, ohne eigene Kennzeichnung. In keinem Spiel.
- Verlegen oder Kader-Wegfall → ihre Anmeldung **verfällt** (Rückfrage nennt „Anmeldung einer schnuppernden Spieler:in"); gilt das Training wieder → nicht angemeldet.

**Ab- und Anmelden (Trainings):** Jede Spieler:in ist **standardmässig angemeldet**, bis abgemeldet. Kein „keine Rückmeldung". Bis Beginn, nie an ausgefallenem Termin. Durch Mitglieder (Reiter „Spieler:innen", Schalter) oder Eltern (privater Link). Wer gesetzt hat, wird nicht festgehalten; letzte gilt. Kein Grund.
- Liste in Gruppen „Angemeldet" / „Abgemeldet" (nicht angemeldete Schnuppernde bei den Abgemeldeten), ab Beginn „Da" / „Nicht da"; mit Anzahl, leere ausgeblendet, Zahl folgt der Kader-Eingrenzung. Umgelegte Zeile springt sofort in die andere Gruppe.
- Zeitangabe links vom Schalter: seit wann der Status gilt („gerade eben", „vor 3 Stunden", „gestern", …); nur bei echtem Wechsel.
- **Datum oder Beginn geändert** (noch nicht begonnen) → **alle Abmeldungen verfallen**, alle wieder angemeldet (Rückfrage mit Zahl; Eltern sehen „Deine Abmeldung gilt nicht mehr"). Ende/Ort/Treffpunkt/Bemerkung/Hinweis für Eltern/Felder/Training ändern lässt sie stehen (reine Treffpunktänderung = keine Verlegung).
- Ab- oder Anmelden an inzwischen verlegtem/ausgefallenem/begonnenem Termin → abgewiesen mit aktuellem Stand („Der Termin wurde inzwischen verlegt …").
- **Nachtragen** ab Beginn (unbefristet, nur Mitglieder): „nicht erschienen" / „doch erschienen". Zahl wird „11 von 15 da". Eltern sehen Nachträge nie. Ohne Nachtrag = Stand bei Beginn gilt als Anwesenheit.

**Spiele:** Art „Spiel"; Bezeichnung Pflicht (max. 120); Anpfiff muss **in der Zukunft** liegen (kein Nachtragen vergangener Spiele, keine Verlegung in die Vergangenheit). Kein Training, keine Felder, keine erwartete Zahl, keine Serie. Optional: Ort, Bemerkung (nur fürs Team), Hinweis für Eltern (**für Eltern sichtbar**, ausser bei Ausfall; frühere Spiel-Bemerkungen sind seit #590 dorthin umgezogen), Kader, Mindestbesetzung, Mindest-/Höchstzahl (1–200, begrenzt Anmeldungen nicht), Meldefrist (vor Anpfiff, max. 1 Jahr, vergangene erlaubt), Treffpunkte (je Anreiseart max. 1, total max. 5; „vor Ort" ohne eigenen Ort). Beim Erfassen eines Spiels Kästchen „Spielervertretungen benachrichtigen" (siehe oben).
- **Status** (Plan): „Zu wenig" rot (< Min), „Knapp" gelb (= Min), „Genügend" grün (bis Max), „Zu viel" rot (> Max). Ohne Richtwert oder ohne Spielerliste kein Status.
- **Melden:** Jede Spieler:in **zuerst ohne Meldung**; gezählt nur Angemeldete. Zurück auf „ohne Meldung" unmöglich. Mitglieder bis Anpfiff (auch nach Frist), Eltern bis Meldefrist (ohne Frist bis Anpfiff). Plaketten: „Ohne Meldung" gelb, „Angemeldet" grün, „Abgemeldet" rot, „Nicht aufgeboten" rot; nach Frist „Meldefrist verpasst" rot. Menü auf der Plakette. Liste in Gruppen Angemeldet · Ohne Meldung (nach Frist „Meldefrist verpasst") · Abgemeldet · Nicht aufgeboten, mit Anzahl, leere ausgeblendet; ab Anpfiff „Da" / „Nicht da". Zeile springt beim Wechsel sofort in die neue Gruppe.
- **Nicht aufbieten** (nur Mitglieder): Meldung bleibt darunter, zählt nicht als angemeldet; Eltern sehen die Kennzeichnung.
- Nach Meldefrist (mit Richtwert + Spielerliste): grosse Karte in der Liste mit Handlungshinweis („Es fehlen 2 bis zur Mindestzahl 9 …"). Erscheint erst beim nächsten Laden.
- Ab Anpfiff: Stand beim Anpfiff, Nachträge wie bei Trainings.
- **Verlegen:** Meldungen und Kennzeichnungen verfallen **nur bei Datumsänderung** (andere Uhrzeit am selben Tag lässt sie stehen). Meldefrist und Treffpunkte wandern mit (Abstand bleibt); kann dadurch abgelaufen sein. Nachträge verfallen beim Wiederöffnen immer.
- Ausfall: alles ruht; Eltern sehen nur Kopf mit Grund. Entfernen nennt Zahl der Meldungen.

**Privater Link (Eltern):** je Spieler:in genau einer **im ganzen Verein**, zeigt die Termine **aller ihrer Teams**. Mitglied jedes dieser Teams holt ihn über Kettenglied in der Spielerliste (Dialog nennt die Teams), die Verwaltung im Spielerbestand. Anwendung verschickt nichts. „Link erneuern" fragt nach (nennt die Teams, für die der bisherige endet) → alter sofort ungültig **für alle Teams**, Abmeldungen bleiben, Kalender-Abo und alle Benachrichtigungen der Spieler:in enden (Dialog nennt beides). Bleibt gültig beim Herausnehmen und beim Auflösen eines Teams.
- Seite: fürs Telefon, ohne Konto, ohne Leiste, einziges Cookie = gesehene Benachrichtigungen, fester Titel ohne Namen. Kopf „Termine für" + Name, dahinter ⓘ „Infos und Erklärungen", Kalender-Zeichen und Glocke, darunter Teams als Plaketten; **keine Erklärsätze mehr im Kopf und nichts mehr unter den Terminen**. Jede Karte nennt ihr Team.
- **Seite „Infos"** (ⓘ → Link-Adresse + „/infos", „Zurück zu den Terminen", unten „Fragen und Feedback"): Abschnitte **alle zugeklappt**, auch beim ersten Öffnen. Mit Team, nicht schnuppernd: „So meldest du Mia" (Meldesatz), je Team mit Infos „Infos zum Team <Team>" mit „Stand …", Text ganz und gegliedert, Teams in Plakettenreihenfolge; Team ohne Infos → kein Abschnitt, kein Hinweis. Schnuppernd: „So schnuppert Mia" + „Infos zum Schnuppertraining" (Info-Schreiben ganz), keine Infos zum Team. Immer zuletzt „Wer deine Angaben sieht" (verantwortlich ist der Verein mit Namen; Name/Jahrgang/Teams alle Trainer:innen des Vereins, alles die Trainer:innen ihrer Teams, J+S und Link auch die Verwaltung, dazu deren KI-Assistenten und wer den Link hat). Ohne Team nur dieser Abschnitt. Ungültiger Link → „Dieser Link gilt nicht mehr".
- **Ohne Team:** Link gültig, zeigt keine Teams und keine Termine, sagt, dass Termine nach einer Zuordnung erscheinen und die Vereinsverwaltung hilft; Abo und Feedback bleiben. Nach dem Herausnehmen verschwinden die Termine dieses Teams (auch ein heute begonnener); Meldung an einem Termin, der nicht mehr gilt → „Nicht gespeichert" mit Art und Tag. „Heute" (begonnen, gesperrt) + anstehende Termine nach Monat. Trainingskarte: Status „Angemeldet"/„Abgemeldet"/„Fällt aus", Zeit, Ort, Kader, Spielerzahl („24/33", alle für die der Termin gilt), Verantwortliche:r, Schalter. Ort immer ganz (bricht um), auch nach Beginn; mit Kartenlink ist der Ort selbst der Link (violett, unterstrichen, Zeichen für extern; lang dann einzeilig mit „…"); bei Ausfall ohne Link. Ausfallgrund mit „Grund:". Treffpunkt eines Trainings als Zeile „Treffpunkt  17:45  Ort" – nicht bei Abmeldung, Ausfall und ab Beginn; nicht angemeldete schnuppernde Spieler:in sieht ihn. Hinweis für Eltern unter einer Linie am Fuss der Karte, ab vier Zeilen gekürzt mit „Ganz lesen"; auch abgemeldet und nach Beginn, nicht bei Ausfall. Verlegt → „Verlegt, vorher … Deine Abmeldung gilt nicht mehr."
- Spielkarte: Status inkl. „Ohne Meldung", „Nicht aufgeboten", „Meldefrist verpasst"; „Bitte melden bis …", „7/14 · gesucht 9 bis 12", Knöpfe Anmelden/Abmelden; nach Frist „Meldefrist abgelaufen · Änderung übers Team". Treffpunkte, Hinweis für Eltern. Nachträge und Status des Spiels sehen Eltern nicht.
- **Eingrenzen:** Filter-Chips „Trainings" und „Spiele" über der Liste; höchstens einer gilt, nochmals tippen hebt auf (kein Chip „Alle"). Ausgefallene und heute begonnene stehen unter ihrer Art. Leer → „Keine anstehenden Spiele"/„… Trainings". Bleibt beim Melden, aber neu öffnen/neu laden zeigt wieder alle (nicht gemerkt). Nicht bei schnuppernden Spieler:innen, nicht ohne Termine. Kalender-Abo immer mit allen Terminen. Kein schrittweises Nachladen: alle anstehenden Termine auf einmal.
- Zeigt **nicht**: andere Namen, fremde Kader, Termine anderer Kader, Trainingsinhalte, vergangene Termine.
- **Schnuppert sie:** Kopf zeigt nur „Noch 2 von 4 Schnuppertrainings möglich" mit Balken (besucht gefüllt, angemeldet umrandet), „x besucht · y angemeldet"; Erklärsatz („Mia schnuppert. …") und Info-Schreiben stehen auf der Seite „Infos". Keine Spiele. Trainings zuerst „Nicht angemeldet" (grau, nicht gedämpft). Anzahl erreicht → „Alle 4 Schnuppertrainings vergeben" (bei 1: „Das Schnuppertraining ist vergeben"), Meldung über den Trainings, übrige Schalter gesperrt „Schnuppertrainings vergeben"; abmelden geht immer. Verfallene Anmeldung: „… Deine Anmeldung gilt nicht mehr."
- Erneuert, unbekannt, Spieler:in aus dem Verein gelöscht oder Verein gelöscht → neutrale Seite „Dieser Link gilt nicht mehr" (ohne Team/Spieler:in; „Den aktuellen erhältst du über eine Abholadresse, bei den Trainer:innen oder bei der Vereinsverwaltung.").
- **Kalender-Abo am Link:** Kalender-Zeichen hinter dem Namen. Kalender heisst **„Trainings und Spiele"** (ohne Teamnamen; früher abonnierte behalten im Kalenderprogramm allenfalls ihren alten Namen), enthält die Termine aller Teams, jeder Eintrag nennt sein Team; ohne Team leer. Titel mit ✅ zugesagt / ❔ vielleicht (Spiel ohne Meldung bis Frist; schnuppernd nicht angemeldetes Training) / ❌ abgesagt. Nur Anzeige, gemeldet wird über den Link. Beschreibung: Status, Treffpunkt eines Trainings („Treffpunkt" + „17:45 · Ort", gleiche Bedingungen wie am Link), Hinweis für Eltern, Kartenlink als „Karte zum Ort: …" (führt zum Ort, nicht zum Treffpunkt). Eintrag beginnt zum Beginn, nicht zum Treffpunkt. Kein Spielername, keine Frist, kein Richtwert. Erlischt bei Link-Erneuerung, Löschen der Spieler:in oder des Vereins, oder Widerruf durch Eltern (trifft alle mit derselben Adresse); Herausnehmen und Auflösen eines Teams lassen es bestehen.
- **Benachrichtigungen:** Glocke hinter dem Namen (nach ⓘ und Kalender-Zeichen), Zahl = auf diesem Gerät noch nicht angezeigte (ab 10 „9+", 0 = keine Zahl). Tipp → Ansicht „Benachrichtigungen" statt Chips/Liste (Adresse ?ansicht=benachrichtigungen; Zurück-Taste/„Zurück zu den Terminen"/Glocke schliesst; Neuladen bleibt dort). Gruppen „Neu" (Plakette „Neu") und „Früher", neueste zuerst; leer „Noch keine Benachrichtigungen". Eintrag: „Neues Spiel", „Fällt aus" (rot, mit „Grund: …"), „Findet wieder statt", „Verlegt" (ggf. „Findet wieder statt."), „Fällt weg" (rot), Serie „Trainings geändert" bzw. nur Wegfall „Trainings fallen weg"/„Training fällt weg" (rot); Titel „Training · Team" oder „Spielbezeichnung · Team", Tag+Zeit, Ort, „Erhalten heute/gestern/am 3. Nov.". Serie: „Ab …", „Neu jeweils Dienstag · 18:00–19:30 · Halle", „Es fallen 3 Trainings am Mittwoch weg (2.–16. Dez.)." Momentaufnahme, kein Meldestand. „Zum Termin" nur bei Einzelereignis und solange der Termin am Link steht (hebt Eingrenzung auf), sonst „Steht nicht mehr in deinen Terminen"; Serie nie. Unten: „KiFu bewahrt Benachrichtigungen 90 Tage auf. Welche du schon gesehen hast, merkt sich nur dieses Gerät." Höchstens 200 neueste. Bleiben auch bei geändertem/entferntem/vergangenem Termin und nach Herausnehmen; enden bei Link erneuern, Spieler:in aus Verein löschen, Verein löschen. Erstes Öffnen eines Links auf einem Gerät: alles Bisherige gilt als gesehen.

**Selbstabholung:** Schalter in der Spielerliste (Standard aus). An → Abholadresse zum Kopieren; nur teamintern teilen. Erneuern macht alte Adresse ungültig; Aus stoppt neue Abholungen über dieses Team. Bereits bezogene Links bleiben gültig. Der Link gilt für alle Teams: Über die Abholadresse **jedes** ihrer Teams mit eingeschalteter Selbstabholung kommen Eltern zum selben Link (ein Team, das sie ausschaltet, sperrt ihn nicht).
- Abholseite: findet Spieler:innen dieses Teams; Vorname, Nachname, Jahrgang exakt (Umlaute/Akzente müssen stimmen; „ue" ≠ „ü"). Nennt unter „Was KiFu speichert" die Angaben, dass KiFu Benachrichtigungen zu ihren Terminen 90 Tage aufbewahrt und nur sieht, wer den Link hat, den Verein als verantwortlich und wer was sieht. Treffer → Link (zeigt Termine aller Teams). Kein Treffer → immer „Dazu finden wir keinen Link. Prüf die Schreibweise oder frag beim Team nach."
- **Sperre:** 5 Fehlversuche in 15 min → 15 min Sperre für den **Internetanschluss** (alle Teams; trifft auch andere Eltern im selben WLAN).
- Bekannt: Wer die Adresse + Namen/Jahrgang kennt, kann fremde Spieler:innen ab-/anmelden, für alle ihre Teams (vom Team bewusst getragen).

**Team verlassen** („Gefahrenzone"): kurz bestätigen, **ohne Teamnamen**, auch als letzte Person. Das Team bleibt samt Trainings, Terminen, Spielerliste bestehen (als letzte Person: ohne Trainer:in, bis die Verwaltung jemanden aufnimmt oder es auflöst). Persönliche Trainings bleiben; Abo erlischt (ohne Hinweis). Wer danach in keinem Team und nicht in der Verwaltung ist → Konto ohne Verein. **Auflösen und Umbenennen gibt es im Team nicht** (auch nicht für die Verwaltung im Team), nur im Bereich „Verein".

---

## 8. KI-Assistent (MCP)

- Verbinden: Adresse `https://ki-fu.ch/api/mcp` im Client eintragen (Claude Desktop/claude.ai: Einstellungen → Connectors → Custom connector; Claude Code per Befehl). Browser öffnet Erlauben-Seite (vorher ggf. anmelden). Zugangsname max. 40. Kein Passwort/Schlüssel an den Assistenten.
- **Max. 5 Zugänge je Konto**, zusammen **600 Aufrufe/Stunde** (darüber Meldung mit Wartezeit). Widerruf unter „KI-Zugänge" wirkt sofort. Verfällt nie von selbst.
- Kann: Übungen suchen/abrufen; eigene Übungen anlegen, ändern, kopieren, öffentlich schalten, Diagramm setzen (als Ganzes) und Diagramm-Mängel abrufen; Trainings anlegen, Übungen zuordnen, überarbeiten (Name, Ziel, Kategorien, Dauer, Notiz, Reihenfolge eines ganzen Abschnitts in einem Zug, Entfernen), Gruppen/Durchlauf, Varianten, Hinweise abrufen, veröffentlichen/zurückziehen, übernehmen, löschen; Team-Trainings; Kalender (Termine, Serien samt Treffpunkt eines Trainings, Spiele, Zuordnen, Trainer:innen, Ausfälle); Spielerliste der eigenen Teams (mit Verein des Teams und Namen weiterer Teams je Spieler:in), Spieler:innen aufnehmen/ändern, Kader, Schnuppertraining (`schnuppertraining_abrufen`, `schnuppertraining_festlegen`, `spieler_schnuppern_setzen`; einschalten nur bei genau einem Team), Infos zum Team (`team_infos_abrufen`, `team_infos_festlegen`; immer ganzer Text, leer entfernt, ≤ 10'000 Zeichen; ohne neue Zustimmung); Ab-/Anmeldungen, Meldungen, Nachträge, private Links, Selbstabholung. `teams_abrufen` nennt die Teams mit Verein; ohne Team leer, mit Erklärung warum (der Verwaltung zusätzlich, wie sie sich in der App selbst aufnimmt).
- **Herausnehmen** mit `spieler_aus_team_nehmen` nur zweistufig: erster Aufruf ändert nichts und liefert die Sätze der App-Rückfrage (beim letzten eigenen Team zusätzlich: danach über den Assistenten nicht mehr erreichbar); erst der zweite nimmt heraus; Lage inzwischen geändert → nichts, neue Rückfrage. **Löschen kann er keine Spieler:in.**
- **`spieler_link_erneuern`** nur zweistufig: ohne `bestaetigt: true` ändert es nichts und nennt die Teams, für die der bisherige Link endet; erst mit Bestätigung erneuert er. Link-Antworten nennen alle Teams der Spieler:in.
- Umbenannt mit Release 1.48.0, ohne Übergang: das frühere Werkzeug zum Entfernen einer Spieler:in heisst `spieler_aus_team_nehmen` (und löscht nicht mehr), die drei Schnupper-Werkzeuge tragen den neuen Begriff. Verbundene Clients müssen ihre Werkzeuge neu laden; ein alter Name ergibt „unbekanntes Werkzeug" und ändert nichts.
- Spieler:innen ausserhalb der eigenen Teams (auch ohne Team) gelten für ihn als **nicht gefunden**; die Vereinsliste liest er nicht.
- **Benachrichtigen:** Parameter `benachrichtigen` (Standard true) an `termin_festlegen` (nur Spiel), `termin_aendern` (einzeln und Serie), `termin_entfernen`, `termin_der_serie_folgen` (nur Zeit/Ort), `termin_ausfallen_lassen` (nicht beim Grund ändern), `termin_ausfall_zuruecknehmen`. Gleiche Regeln wie das Kästchen; ohne Angabe wird benachrichtigt, auch von Clients mit alten Werkzeugen. Antwort `benachrichtigt` (Anzahl oder null), bei Fehlschlag `hinweis` „Gespeichert, aber die Benachrichtigung ist nicht entstanden." Keine neue Zustimmung nötig. Liest keine Benachrichtigungen.
- Für ein Konto ohne Verein dieselben Grenzen 50/30 wie in der App (Übung anlegen/kopieren, Training anlegen/übernehmen): nichts entsteht, Antwort nennt den Bestand („Du besitzt 50 von 50 Übungen. In der Anwendung schaffst du durch Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.") und dass nichts entstanden ist.
- Kann **nicht**: Favoriten, **Teams und Verein verwalten** (Teams anlegen/umbenennen/auflösen, Personen in Teams oder Verwaltung aufnehmen/entfernen, Spieler:innen Teams zuordnen, aus dem Verein löschen, importieren, Verein gründen/umbenennen/löschen – auch nicht für die Verwaltung, nur in der App), zum Schnuppern zuordnen, Konto (Name, Passwort, Löschen), Kalender-Abos, Fotos hochladen, Übungen löschen, Übung in andere Altersstufe überführen, Übung aus Training in Bibliothek kopieren, einzelne Diagramm-Elemente ändern, Diagramm entfernen, Gruppenreihenfolge ändern, E-Mail-Adressen sehen.
- Strenger als das Formular: Werte, die das Formular gar nicht anbietet, werden **abgelehnt** (mit Liste aller Verstösse), nicht still verworfen.
- Kartenlink zum Ort setzt er wie die App (nur mit Ort, https://, ≤ 500 Zeichen). Ändert er den Ort ohne neuen Link, fällt der bisherige weg – die Antwort sagt es ihm; ebenso, wenn ein Serientermin wieder der Serie folgt und seinen eigenen Link verliert.
- Treffpunkt eines Trainings (`treffpunkt` {uhrzeit, ort}, null entfernt) nach denselben Regeln und mit denselben Meldungen wie die App. Läge er nach einer Zeitänderung am Vortag, entfällt er **ohne Rückfrage**; das Ergebnis nennt die Daten (`treffpunkt_entfallen`).
- Fragt bei Löschen/Entfernen/Ersetzen nicht nach; Bestätigung im Aufruf nur beim Herausnehmen, beim Erneuern eines Links, bei Serienänderungen mit vergangenen Terminen und bei verfallenden Abmeldungen/Meldungen/Nachträgen (ob er die Person wirklich gefragt hat, prüft KiFu nicht).
- Bekannt: neue Fähigkeiten kennt ein verbundener Assistent erst nach Neuverbinden; offener Browser-Tab zeigt Änderungen des Assistenten erst nach Neuladen; Abbruch mitten im Kopieren kann eine unvollständige Kopie hinterlassen; die gemeldeten Diagramm-Mängel erscheinen in der App nirgends; Platz-/Spielerzahl-Passung beurteilt der Assistent selbst (Richtmasse SFV 2026/27: Kleinfeld G ~20×15, F ~25×20, E 25–30×20–25; Grossfeld F ~30×25, E 43–48×25–30 m).

---

## 9. Sichtbarkeit und Berechtigungen (Kurzmatrix)

| Wer | Sieht / darf |
|---|---|
| Ohne Konto | Übungsbestand, öffentliche Trainings (ansehen, drucken, durchführen), Versionen, Styleguide, Cookies |
| Konto ohne Verein | + eigene Übungen/Trainings (≤ 50/30), Favoriten, Übernehmen, KI-Assistent, Verein gründen; keine Teams |
| Trainer:in (Team-Mitglied) | im Team: alles, gleichberechtigt (Termine, Trainings, Spielerliste, Mitglieder aufnehmen/entfernen); E-Mails der Mitglieder; alle Termine (unabhängig von Kadern). Nicht: Team umbenennen/auflösen, Spieler:in löschen, Import, bestehende Spieler:in ins Team holen |
| Vereinsmitglied (jede Trainer:in) | im Bereich „Verein": Vereinsname, Verwaltung (nur Anzeigename), alle Teams, Vereinsliste (Name, Jahrgang, Teams aller Spieler:innen); ändert dort nichts. J+S, Link und Meldungen nur der eigenen Teams |
| Vereinsverwaltung | im Bereich „Verein": Teams anlegen/umbenennen/auflösen, Trainer:innen und Verwaltung aufnehmen/entfernen, Spielerbestand (erfassen, ändern, zuordnen, herausnehmen, löschen, Link abrufen/erneuern, Import), Verein umbenennen/löschen; E-Mails aller Trainer:innen. Team-Inhalte (Termine, Trainings, Spiele, Kader, Abmeldungen) nur als Trainer:in im Team; dort keine weiteren Rechte |
| Eltern (privater Link) | nur eigene Spieler:in: anstehende Termine aller ihrer Teams (für ihre Kader), Verein als verantwortlich, eigener Status, Spielerzahl, Verantwortliche:r, Ort samt Kartenlink (Linkziel verantwortet das Team), Ausfallgrund, Hinweis für Eltern (Trainings und Spiele), Treffpunkte (Spiele) bzw. Treffpunkt (Trainings), Benachrichtigungen (Glocke); Seite „Infos": wie man meldet, Infos zum Team jedes Teams mit Infos (nicht beim Schnuppern), Info-Schreiben (nur beim Schnuppern), wer die Angaben sieht; nie die Bemerkung; keine anderen Namen, keine Trainingsinhalte |
| Mit Abholadresse | Link einer Spieler:in bei exaktem Vorname+Nachname+Jahrgang |
| KI-Assistent | wie Trainer:in der eigenen Teams (auch für die Verwaltung), eingeschränkt auf angebotene Werkzeuge; nie Verwaltung, keine Vereinsliste, keine E-Mails |

Private Übungen/Trainings anderer sind nirgends sichtbar (auch nicht für den Assistenten). Fremde Übungen/Manual-Übungen sind nie direkt bearbeitbar.

---

## 10. „Sieht aus wie ein Fehler, ist aber Absicht"

- Registrierung sagt „Link unterwegs", obwohl Konto schon existiert.
- Anmeldefehler nennt nicht, ob Adresse oder Passwort falsch ist.
- Anzeigename lässt sich nicht mehr leeren.
- Abmeldungen/Absagen/Meldungen sind nach einer **Verlegung** weg (Training: Datum oder Beginn; Spiel: nur Datum).
- Abmeldung weg, weil der Termin durch eine **Kader-Änderung** nicht mehr für die Spieler:in gilt.
- Schnuppernde Spieler:in an allen Trainings „nicht angemeldet" / sieht keine Spiele → Schnuppern ist so gedacht; Abmeldungen und Meldungen verfielen beim Einschalten.
- Eltern können nicht mehr anmelden, Mitglieder schon → Anzahl Schnuppertrainings erreicht; Mitglieder dürfen darüber hinaus.
- Plakette „Schnuppern 0/4", obwohl angemeldet → zählt nur besuchte Trainings.
- Schnuppern lässt sich nicht einschalten → Spieler:in ist weiteren Teams zugeordnet (Schnuppern nur bei genau einem Team) oder das Team hat keine Anzahl. Schnuppernde lässt sich keinem weiteren Team zuordnen.
- Erwartete Spielerzahl verschwunden → Team hat eine Spielerliste angelegt.
- Ausgefallener Termin zeigt keine Spielerzahl.
- Spieler:innen bei Trainings sind automatisch angemeldet; bei Spielen „ohne Meldung".
- Eltern können nach der Meldefrist nicht mehr melden; Mitglieder schon.
- Eltern sehen Nachträge/Anwesenheit nicht und keinen Spiel-Status (nur Zahl).
- Eltern sehen die Bemerkung eines Termins nicht (auch nicht am Spiel) → sie ist fürs Team; was Eltern wissen sollen, gehört in den „Hinweis für Eltern". An einem ausgefallenen Termin fehlt auch der Hinweis, dort steht der Grund.
- Spielerzahl „0 von 0" → Termin gilt wegen Kadern für niemanden.
- Training öffnet immer die erste Variante, nicht die zuletzt gesehene.
- Termin-Training wurde gelöscht, nachdem es vom Termin gelöst/ersetzt oder der Termin entfernt wurde.
- Ein Training/Team-Training erscheint nicht in der allgemeinen Trainingsübersicht (Team-Trainings leben nur im Team).
- Ein Termin-Training steht nicht im Team-Bestand.
- Suche in der Trainingsübersicht ordnet nicht nach Treffergüte → Absicht seit 1.49.0: zuletzt geändert oben bzw. gewählte Sortierung.
- Trainingsübersicht und (seit 1.50.0) Team-Bestand zeigen keine Kacheln mehr, sondern eine Tabelle; eine Umschaltung zurück gibt es nicht.
- Altersstufe/Alterskategorien fehlen in der Zeile der Trainingsübersicht bzw. des Team-Bestands → Absicht seit 1.50.0; stehen im Detail (Eigenschaften) und in der Ansicht. Sortieren nach Altersstufe gibt es nicht mehr; ein alter Link damit zeigt zuletzt geändert oben.
- Urheber in der Übersicht abgeschnitten → Absicht (Name hat Vorrang); beim Überfahren ganz, im Detail ganz.
- Team-Trainings: Klick öffnet nicht mehr die Bearbeitung, Knöpfe an der Kachel fehlen, „Aus dem Team entfernen" fehlt → seit 1.50.0 Tabelle mit Detail; Termin zuordnen, Zu mir übernehmen, Löschen hinter den drei Punkten im Detail (auch in Ansicht/Bearbeiten).
- Plakette „Eingeplant" im Team-Bestand verschwunden → Absicht; Datum im Detail unter Eigenschaften.
- Spieler:in steht nach dem Umlegen/Melden an anderer Stelle → sie ist in die Gruppe ihres neuen Status gesprungen.
- Gruppe fehlt im Reiter „Spieler:innen" → leere Gruppen sind ausgeblendet. Meldefrist, Beginn und Änderungen anderer erscheinen erst nach dem Neuladen.
- Änderung an einem öffentlichen Training wird abgelehnt (würde Veröffentlichungsbedingung verletzen → erst auf Entwurf).
- Änderungen an einer Bibliotheks-Übung kommen nicht im Training an (und umgekehrt).
- Kopie einer Manual-Übung heisst gleich wie das Original; Kopie einer eigenen heisst „… (Kopie)".
- ⓘ-Hinweise fehlen auf Telefon/Tablet.
- Zeichenfläche fehlt auf dem Telefon; Mini-Monat fehlt auf dem Handy; rechte Spalte fehlt auf schmalen Bildschirmen.
- Meldung am unteren Rand verschwindet nach 6 s und lässt sich nicht erneut anzeigen.
- Abholseite sagt bei falscher Eingabe nie, was falsch ist; Sperre nach 5 Fehlversuchen trifft das ganze WLAN.
- Kalender-Abo zeigt Änderungen verzögert; zeigt nur Termine, zu denen man eingeladen ist.
- Kartenlink verschwunden, nachdem der Ort geändert wurde (Link gehört zum Ort).
- Treffpunkt eines Trainings hat sich beim Verlegen mitverschoben → Absicht, er behält seinen Abstand zum Beginn. Treffpunkt verschwunden nach Zeitänderung → er läge am Vortag und entfiel (Rückfrage nannte es).
- Eltern sehen den Treffpunkt nicht → Spieler:in abgemeldet, Training ausgefallen oder begonnen; die Bemerkung sehen sie nie.
- Neues Teammitglied ist zu bestehenden Terminen nicht eingeladen.
- Ein „Erledigt"-Zustand für vergangene Termine existiert nicht („Kein Training eingetragen" heisst nicht „hat nicht stattgefunden").
- Durchführen zeigt keine Erscheinungsform; Druck einer Übung zeigt keine Dauer.
- Übungen ohne Erscheinungsform/Feldtyp/Übungstyp tauchen bei diesen Filtern nicht auf.
- Zeile beginnend mit „2. " / „- " wird zum Listenpunkt.
- KiFu ist plötzlich hell/dunkel → folgt der Einstellung des Geräts (auch Wechsel nach Tageszeit), ausser es wurde unter „Darstellung" gewählt.
- Abgemeldet ist KiFu hell, obwohl „Dunkel" gewählt → ohne Anmeldung sind die Seiten mit Leiste immer hell; die Anmeldeseiten zeigen die Wahl.
- „Darstellung" fehlt in der Leiste → nicht angemeldet, oder älterer Browser (Safari vor 17.5), der fest hell zeigt.
- Diagramm: weisse Leibchen erscheinen im Hellen grau (Graphit) → Absicht, sonst auf hellem Rasen unsichtbar.
- Kein Schalter an einem ausgefallenen Termin am privaten Link → Absicht; Plakette „Fällt aus" und Grund sagen es.
- Am privaten Link ist die Eingrenzung „Trainings"/„Spiele" nach dem Neuladen weg → Absicht, die Wahl gilt nur, solange die Seite offen ist.
- Am privaten Link fehlen der Satz „… ist für jedes Training zuerst angemeldet …", das Info-Schreiben über den Terminen oder der Hinweis, wer die Daten sieht → Absicht seit 1.50.0: alles hinter dem ⓘ neben dem Namen auf der Seite „Infos".
- Seite „Infos": alle Abschnitte zugeklappt, auch beim ersten Öffnen → Absicht.
- Eltern sehen die Infos zum Team eines Teams nicht → das Team führt keine (dann kein Abschnitt, kein Hinweis) oder die Spieler:in schnuppert.
- Stand-Datum der Infos ändert sich nach dem Speichern nicht → Text war unverändert; Stand = Tag der letzten Textänderung.
- Sternchen, Rauten oder Bindestriche zählen zu den 10'000 Zeichen → Absicht, Grenze gilt samt Gliederung.
- [Text](Adresse), _kursiv_ oder HTML erscheinen als Zeichen in den Infos → Absicht, nur Zwischentitel, Aufzählung, Nummerierung, Fett und erkannte Webadressen.
- Mehrere „#" ergeben keine kleineren Zwischentitel → Absicht, eine Grösse.
- Glocke zeigt beim ersten Öffnen eines Links auf einem Gerät keine Zahl, obwohl Benachrichtigungen da sind → Erstanzeige, alles Bisherige gilt als gesehen.
- Auf dem Handy „Neu", am Computer nicht (oder umgekehrt) → gesehen gilt je Gerät und Browser (Cookie), nicht je Person.
- Browser ohne Cookies/Privatmodus: Glocke zeigt nie eine Zahl.
- Kein Kästchen „Spielervertretungen benachrichtigen" → Training (statt Spiel) erfasst, Termin vor heute, Termin ausgefallen und bleibt es (nur eine Verlegung, durch die er wieder stattfindet, zeigt das Kästchen), nur Grund/Treffpunkt/Hinweis/Kader/Kartenlink geändert, oder Serie ohne betroffene Spieler:innen.
- Keine Benachrichtigung trotz Kästchen → Termin vor heute, Termin war ausgefallen (bleibt ausgefallen), Spieler:in erst später dazugekommen, oder Spieler:in nicht im Kader des Termins.
- Benachrichtigung zeigt alten Ort/alte Zeit → Momentaufnahme beim Vorgang; massgeblich ist die Terminkarte.
- „Zum Termin" fehlt → Termin entfernt, vergangen oder gilt nicht mehr für die Spieler:in; bei Serienänderungen gibt es nie „Zum Termin".
- Nach „Link erneuern" sind alle Benachrichtigungen weg → Absicht (Link kam oft in falsche Hände).
- Abgemeldete Spieler:in erhält Benachrichtigung zum Ausfall/zur Verlegung → Absicht, Meldestand spielt keine Rolle.
- Neue Benachrichtigung erscheint nicht bei offener Seite → erst nach Neuladen.
- Nach über einer Woche Pause ist auf einem iPhone nichts als „Neu" markiert → unbelegt (Verdacht: Safari kürzt das Cookie); als möglichen Fehler aufnehmen, Gerät/Browser und Abstand der Besuche erfragen.
- Ein Team selbst anlegen geht nicht → neue Teams legt nur die Vereinsverwaltung an; Umbenennen und Auflösen ebenso, nur im Bereich „Verein".
- Konto ohne Verein sieht unter „Teams" keine Teams, nur „Willkommen bei KiFu" → Teams, Spielerlisten, Kalender gibt es nur in einem Verein; gründen oder aufnehmen lassen.
- Abweisung „Du besitzt 50 von 50 Übungen …" / „Nichts mehr frei" → Grenze für Konten ohne Verein (50 Übungen, 30 Trainings). Anzeige „62 Übungen (höchstens 50)" und weiter abgewiesen, obwohl eine gelöscht → Bestand liegt noch über der Grenze. Anzeige nennt den ganzen Bestand, auch wenn ein Filter die Liste kürzt. In ein Training übernehmen geht immer.
- Vereinsverwaltung sieht Termine/Trainings/Kader eines Teams nicht → Rollen nach Ort; sie nimmt sich mit „Mich aufnehmen" ins Team auf. Auch im Team hat sie nicht mehr Rechte als ein Mitglied (kein Löschen dort).
- Team hat keine Trainer:in mehr und besteht weiter → Absicht; die Verwaltung nimmt jemanden auf oder löst es auf. Team verlassen verlangt keinen Teamnamen.
- Erfassen wird abgewiesen („… wird im Verein schon im Team «…» geführt" / „… keinem Team zugeordnet") → Doppelerfassung verhindert; die Verwaltung ordnet die bestehende zu. Zwei echte Gleichnamige: Zusatz im Vornamen. Zwei gleiche Einträge in der Vereinsliste → Altdublette aus der Zeit vor dem Verein.
- Team voll bei 100 Spieler:innen, Verein bei 1000 bzw. 30 Teams; ein Bestand darüber bleibt, nur Neues wird abgewiesen.
- In der Spielerliste fehlen „Löschen" und der Import → Absicht: Trainer:innen nehmen aus dem Team, löschen und importieren tut nur die Verwaltung im Bereich „Verein".
- Herausgenommene Spieler:in steht an einem begonnenen Termin weiter („nicht mehr im Team") → Absicht, Anwesenheit bleibt nachtragbar.
- „Aus dem Team nehmen" tut nichts und zeigt die Rückfrage neu → Lage hat sich seit dem Öffnen geändert.
- Import übernimmt nichts: „Seit der Vorschau hat sich der Spielerbestand geändert …" → neue Vorschau prüfen und erneut übernehmen (auch nach Verbindungsabbruch, wenn der erste Versuch schon ankam). Mehrfach im Verein Geführte ändert er nie.
- Spieler:in ohne Team: Link gültig, aber leer („Termine erscheinen, sobald …") → Absicht. Eltern einer Spieler:in ohne Team verweist der Feedback-Dialog an die Vereinsverwaltung.
- Link plötzlich ungültig → erneuert, Spieler:in aus dem Verein gelöscht oder Verein gelöscht. Herausnehmen und Team auflösen machen ihn **nicht** ungültig.
- Link zeigt Termine eines anderen Teams → Spieler:in ist mehreren Teams zugeordnet; ein Link für alle Teams. Ebenso führt die Abholadresse eines Teams zu allen Terminen.
- Eltern-Abo heisst plötzlich „Trainings und Spiele" bzw. alter Name bleibt → neuer Name seit 1.48.0; früher abonnierte behalten ihn allenfalls.
- KI-Assistent findet eine Spieler:in nicht → sie steht in keinem eigenen Team (auch ohne Team); Vereinsliste und Löschen nicht über die KI.
- KI: `spieler_link_erneuern` erneuert nicht → ohne Bestätigung nennt es nur die Teams; erst mit `bestaetigt: true`. Altes Werkzeug „unbekannt" → Werkzeuge umbenannt, Client neu laden.
- KI verwaltet weder Teams noch Verein, auch nicht für die Verwaltung → Absicht, nur in der App.
- Verein löschen bzw. „Konto und Verein löschen" ist gesperrt → Vereinsname nicht exakt (Gross/klein) oder inzwischen umbenannt (Dialog nennt den neuen). Konto lässt sich nicht löschen → letzte Verwaltung bei weiteren Vereinsmitgliedern.
- Letzte Verwaltung kann nicht austreten → Absicht; erst weitere Person aufnehmen oder Verein löschen.
- Aufnahme abgewiesen „Diese Person gehört schon einem Verein an …" ohne Vereinsnamen → Absicht (höchstens ein Verein je Person, Datenschutz).
- Verein gründen: „Du gehörst schon einem Verein an …" → inzwischen aufgenommen worden; nur Konten ohne Verein gründen.
- Zwei Vereine mit gleichem Namen → erlaubt, Namen sind nicht eindeutig.

---

## 11. Gleichzeitiges Arbeiten mehrerer Personen

- Kalender: Hat ein anderes Mitglied seit der eigenen Auswahl etwas Ergebnisrelevantes geändert (Termin entfernt, anderes Training, Ausfall, Serie), lehnt die Anwendung ab („Seit deiner Auswahl hat sich geändert …"), Dialog schliesst, Plan zeigt neuen Stand. Beim Termin-Ändern werden nur die tatsächlich geänderten Felder übernommen.
- Training/Übung/Notiz/Verteilung: **keine Konflikterkennung** – zuletzt gespeichert gewinnt (bekannte Grenze, kein Fehler).
- Offene Seiten aktualisieren sich nicht von selbst (auch Leiste, Brotkrumen, Termindatum erst beim nächsten Aufruf).
- Verein löschen oder Team auflösen, während jemand im Team einen Termin ändert, ausfallen lässt oder ein Training löscht → einer der Vorgänge kann abbrechen („noch einmal versuchen"), nichts geht verloren.
- Spielerbestand: Zuordnen, Herausnehmen und Import prüfen beim Ausführen den aktuellen Stand; hat sich etwas geändert, geschieht nichts und die Anwendung zeigt den neuen Stand.

---

## 12. Bekannte Grenzen (kein Fehler – ggf. als Wunsch erfassen)

**Allgemein / Konto**
- Nur zwei Rollen (Trainer:in, Vereinsverwaltung), keine Abstufung (keine nur lesende Rolle, kein Vorstand); keine Einladung an Personen ohne Konto, keine Anfrage an einen Verein, keine Annahme durch Aufgenommene.
- Kein Profilbild; Anzeigename nicht zurücksetzbar; E-Mail vor Teammitgliedern und Vereinsverwaltung nicht verbergbar.
- Konto ohne Verein: höchstens 50 eigene Übungen und 30 eigene Trainings, keine Erweiterung; Stand nicht in der Seitenleiste.
- Keine vollständige Datenschutzerklärung, kein Impressum; Besucherstatistik nicht abwählbar.
- Einstellungen (Leistenbreite, Spaltenbreite, Darstellung, „Versionen gesehen") pro Browser, nicht pro Konto.
- Darstellung: ohne Anmeldung nicht wählbar; ältere Browser (Safari vor 17.5, iOS 16/frühes iOS 17) immer hell, ohne Wahl; privater Link nur nach Gerät.
- Touch: 36-px-Bedienflächen, keine ⓘ-Hinweise, Diagramm nicht per Touch.

**Fragen und Feedback**
- Erklärungen der KI können falsch sein; sie fragt gelegentlich zwei Dinge in einem Satz.
- Gespräch nur im offenen Fenster: Neuladen, Verlassen oder Schliessen verwirft es.
- Kein anderer Weg als dieser Dialog, auch nicht bei Ausfall der KI; ohne Anmeldung und ohne privaten Link kein Feedback (also keins zu Anmeldeproblemen).
- Kein Löschen vor Ablauf der 12 Monate; keine Antwort und keine Rückmeldung zum Stand.

**Benachrichtigungen**
- **Keine Erinnerungen** (Termine, Meldefristen, fehlende Meldungen) und **keine Benachrichtigung von Mitgliedern** (neue/geänderte/ausgefallene Termine, Einladungen, Absagen, Mindestbesetzung, Aufnahme/Entfernung, aufgelöstes Team, gelöschter Verein). **Kein Push, keine E-Mail.** Spielervertretungen erhalten Benachrichtigungen **nur am privaten Link** und nur zu neuem Spiel, Ausfall, Rücknahme, Verlegung (Datum/Zeit/Ort) und Wegfall – nicht zu neuen Trainings/Serien, Treffpunkt, Hinweis für Eltern, Kader, Trainer:innen, Meldefrist, verfallener Abmeldung/Meldung, Herausnehmen/Zuordnen, Team auflösen, Verein löschen. Nicht im Kalender-Abo; nicht löschbar/abbestellbar; Mitglieder sehen nicht, was benachrichtigt/gesehen wurde; Geschwister ohne gemeinsame Benachrichtigungen; entfernter Termin steht nicht als entfallen in der Liste; Benachrichtigung nennt nie den früheren Zeitpunkt, Treffpunkt oder Meldefolgen; gesehen gilt je Gerät/Browser, offene Seite holt neue nicht von selbst.

**Verein**
- Höchstens ein Verein je Person (auch keine Aushilfe in einem zweiten); Vereine nicht zusammenführbar, Team nicht in anderen Verein verschiebbar; Vereinsnamen nicht eindeutig; nur ein Name (keine Adresse, kein Logo, keine Kontaktperson); keine Übersicht aller Vereine.
- Ist die einzige Verwaltung nicht erreichbar, gibt es keinen Weg zu einer neuen Verwaltung (keine Plattform-Admin-Rolle).
- Gründung und Bestätigungen werden nicht geprüft und nicht gespeichert.
- Vereinsliste für alle Trainer:innen (Name, Jahrgang, Teams) nicht einschränkbar.
- Grenzen 30 Teams / 1000 Spieler:innen / 100 je Team ohne Ausnahme, keine Erweiterung.
- Löschen nur einzeln, kein Import-Rückgängig, kein Verschieben zwischen Teams (zuordnen + herausnehmen), gesammelt nicht zum Schnuppern; Altdubletten nicht zusammenführbar.
- Kein Export vor Auflösen/Löschen; gelöschter Verein, aufgelöstes Team, gelöschte Spieler:in nicht wiederherstellbar.
- Teams mehrerer Teams nirgends gemeinsam (kein Vereinskalender, kein gemeinsames Abo, auch nicht für die Verwaltung); nur der private Link einer Spieler:in führt ihre Teams zusammen.
- Team ohne Trainer:in: Erinnerung nur durch Plakette „ohne Trainer:in" in der Vereinsübersicht.
- Team mit Namen nur aus unsichtbarem Leerraum lässt sich über die Namensbestätigung nicht auflösen.

**Übungen**
- Kein kuratierter Junioren-Bestand; keine Übung in beiden Altersstufen.
- Fremde/Manual-Übungen nur über Kopie änderbar; keine Herkunftsanzeige, kein Abgleich mit Original, keine Massenkopie.
- Diagramm: Pfeilreihenfolge fix, kein Massstab, Spielfeldgrösse nie aus Diagramm, keine Junioren-Symbolik.
- Kein Zwischenspeichern ungesicherter Übungen/Zeichnungen.
- Einordnung nur in der Maske änderbar; Feldtyp/Übungstyp nicht leerbar.

**Trainings**
- Keine Beschreibung/Soll-Dauer am Training; Zeitrichtwerte nur Junioren und nie erzwungen.
- Materialliste ohne Aufbau-Logik, freie Ergänzungen nicht zusammengezählt.
- Dauern summieren nacheinander (parallele Gruppen → zu lange Summe).
- Kein Gruppen-Auszug, kein Wechsel-Timer, Gruppen-Infos nur beim Zusammenstellen.
- Reihenfolge nur schrittweise (kein Drag & Drop).
- Varianten nur für den Hauptteil; keine Einzelübung zwischen Varianten verschieben; keine Variantenauswahl am Termin; Druck je Variante.
- Keine Historie öffentlicher Stände.
- Übung aus Bibliothek vor dem Übernehmen nur als Karte sichtbar.
- Übersicht/Team-Bestand: Zeile ohne Altersstufe/Kategorien, keine Sortierung nach Altersstufe; gekürzter Urheber auf Touch-Geräten in breiter Ansicht (Tablet) nur im Detail ganz lesbar. Team-Bestand: keine Spalte „angelegt von" (Anwendung speichert bei Team-Trainings keine Person), keine Eingrenzung auf eigene, kein Termin in der Zeile; gleichnamige Kopien nur am Änderungsdatum unterscheidbar.

**Team / Kalender**
- Keine anderen Anlässe als Training/Spiel; keine teamübergreifende Ansicht; keine Doppelbelegungs-/Platzprüfung; keine Prüfung, ob Training zu Platz/Spielerzahl passt.
- Kartenlink nur auf Form geprüft (nicht, ob er auf den richtigen Platz zeigt); keine Karte/Vorschau in der App; kein Kartenlink für Treffpunkte (Spiel wie Training); Ort samt Link nicht als Vorlage speicherbar.
- Serien nur wöchentlich, max. 1 Jahr, keine Ferien/Feiertage, kein Massen-Ausfall, keine Serienübersicht, Termin nicht aus Serie lösbar, entfernte Termine nicht wiederherstellbar.
- Treffpunkt eines Trainings: höchstens einer, ohne Anreiseart, gilt für alle Kader gleich, wandert beim Kopieren/Zuordnen eines Trainings nicht mit, Änderung für Eltern nicht gekennzeichnet; einmal entfallen, kommt er nicht zurück.
- Neues Mitglied nicht auf einmal zu allen Terminen einladbar.
- Keine Tages-/Wochenansicht; Liste nicht durchsuchbar, nicht nach Zeitraum filterbar; kein Archiv.
- „Verantwortlich" ≠ J+S-Leitperson; keine Einsatz-Nachweise; Absage ohne Grund.
- Abo nicht auf eigene Termine/Trainings/Spiele eingrenzbar; Abruf-Frequenz bestimmt das Kalenderprogramm.
- Auflösen (nur Verwaltung): kein Export, nicht wiederherstellbar, niemand wird informiert.

**Spielerliste / Kader / Anmeldungen**
- Nur Vorname, Nachname, Jahrgang, J+S – keine Kontakte, Geburtsdaten, Positionen; kein Geschwister-Link. Trainer:innen holen eine bestehende Spieler:in nicht selbst ins Team (nur die Verwaltung ordnet zu), kein Vorschlag beim Tippen.
- Kader nur mit Namen, ohne Saison, nicht teilbar; Kader beschränken nicht, was Mitglieder sehen.
- Import nur durch die Verwaltung, nur CSV mit Kopfzeile, nicht über die KI; keine Vorschau-Bearbeitung/Abwahl; Schreibvarianten und umschriebene Umlaute nicht erkannt; Namen bestehender nie geändert (gekürzter Rufname → beim nächsten Import zweiter Eintrag); Spaltenzuordnung heisst „Geburtsdatum" auch für einen Jahrgang.
- Abmeldung ohne Grund, je Termin einzeln, Frist = Beginn (nicht einstellbar); nicht erkennbar, wer sich zu einem Training nicht geäussert hat.
- Nachtrag ohne Grund, kein entschuldigt/unentschuldigt, keine Teilanwesenheit, keine Präsenzauswertung, keine J+S-Übermittlung.
- Spiele: keine Resultate/Tabellen/Gegnerdaten, kein Import aus ClubCorner/Matchcenter, keine Serie, kein Nachtragen vergangener Spiele, keine Art „Turnier", Meldung nicht auf „ohne Meldung" zurücksetzbar, keine Fahrgemeinschaften, keine Rückkehrzeit, geänderte Treffpunkte nicht gekennzeichnet.
- Schnuppertraining: nur bei genau einem Team, kein Schnuppern für den ganzen Verein; Anzahl nur je Team (nicht je Spieler:in), nicht entfernbar; endet nicht von selbst; nicht beim Hinzufügen; keine Eingrenzung der Liste auf Schnuppernde; keine eigene Kennzeichnung am Training; Info-Schreiben ohne Formatierung, nicht je Kader, nicht im Abo/bei der Selbstabholung; Kader-Wegfall ohne Hinweis am Link; keine Benachrichtigung zum Schnuppern selbst (Ein-/Ausschalten, Anzahl erreicht) – Benachrichtigungen zu ihren Trainings erhalten Schnuppernde wie alle, zu Spielen nicht.
- Infos zum Team: ein Text je Team (nicht je Kader/Spieler:in), keine Platzhalter, keine Bilder/Tabellen/Anhänge/Links mit eigenem Text, eine Titelgrösse; keine Vereins-Infos für alle Teams; keine Benachrichtigung bei Änderungen, keine Markierung geänderter Stellen; gleichzeitiges Bearbeiten nicht erkannt, keine früheren Fassungen; keine Prüfung auf heikle Angaben (Team verantwortet); nicht im Kalender-Abo, nicht auf der Abholseite, nicht beim Schnuppern.
- Link: Weitergabe nicht erkennbar; wer meldet (Eltern oder Spieler:in) nicht unterscheidbar; Sperren nur durch Erneuern, einzeln (gilt dann für alle Teams). Ein Link je Spieler:in für alle Teams, nicht je Team. Die Seite „Infos" hinter dem Link nennt, wer die Angaben sieht; was gespeichert ist, nur die Abholseite.
- Selbstabholung für alle oder keine; ein Team, das sie ausschaltet, sperrt den Link nicht, wenn ein anderes Team sie an hat; Sperre trifft Internetanschluss.

---

## 13. Feste Grenzwerte (zum Prüfen von Meldungen)

| Was | Grenze |
|---|---|
| Passwort | ≥ 8 Zeichen |
| Anzeigename, Gruppen-, Varianten-, KI-Zugangsname | ≤ 40 Zeichen |
| Trainingsname | ≤ 80 Zeichen |
| Ziel eines Trainings | ≤ 200 Zeichen |
| Notiz je Übung, Bemerkung, Hinweis für Eltern, Ausfallgrund | ≤ 500 Zeichen |
| Ort, Treffpunkt-Ort (Spiel und Training) | ≤ 100 Zeichen |
| Kartenlink zum Ort | https://, ≤ 500 Zeichen |
| Spielbezeichnung | ≤ 120 Zeichen |
| Diagramm | ≤ 300 Elemente |
| Foto | Verkleinerung auf ≤ 2000 px (lange Kante) |
| Feld eines Termins | 5–120 m je Seite |
| Erwartete Spielerzahl, Richtwert Spiel | 1–200 |
| Mindestbesetzung | 1–99 |
| Spielerliste | ≤ 100 Spieler:innen je Team; Vor-/Nachname 1–60; J+S ≤ 20 |
| Verein | ≤ 30 Teams; ≤ 1000 Spieler:innen (inkl. ohne Team, Schnuppernde, Doppeleinträge); Name 1–60, nicht eindeutig |
| Teamname | ≤ 60 Zeichen, im Verein eindeutig |
| Konto ohne Verein | ≤ 50 eigene Übungen, ≤ 30 eigene Trainings |
| Import (nur Verwaltung) | ≤ 1000 Zeilen, ≤ 1 MB, CSV |
| Vereinsliste | 50 je Schritt („Weitere anzeigen") |
| Kader | ≤ 20 je Team; Name 1–30 |
| Schnuppertraining | Anzahl 1–20 je Team; Info-Schreiben ≤ 2000 Zeichen; nur bei genau einem Team |
| Infos zum Team | ≤ 10'000 Zeichen samt Gliederungszeichen, eine Fassung je Team |
| Benachrichtigungen am Link | 90 Tage aufbewahrt, höchstens 200 neueste angezeigt; Zähler ab 10 „9+" |
| Gesehen-Stand (Cookie) | je Gerät/Browser, 1 Jahr, ≤ 20 Links je Gerät |
| Treffpunkte | Spiel ≤ 5 (je Anreiseart 1); Training ≤ 1, am Trainingstag, nicht nach dem Beginn |
| Terminserie / Meldefrist / Treffpunkt-Abstand (Spiel) | ≤ 1 Jahr |
| KI-Zugänge | ≤ 5 je Konto, 600 Aufrufe/h gesamt |
| Personensuche (Team und Verwaltung gemeinsam) | 10 erfolglose/h |
| Abholseite | 5 Fehlversuche/15 min → 15 min Sperre je Anschluss |
| Katalog | 24 Kacheln je Seite |
| Meldung am unteren Rand | 6 s |
| Kalender-Abo Mitglieder | anstehend + letzte 28 Tage |
| Neue Version sichtbar | spätestens 1 h |
| Fragen und Feedback | 1000 Zeichen je Nachricht; 10 Nachrichten bis zur Zusammenfassung, danach 2 Korrekturen; 5 Gespräche je Konto bzw. privatem Link und Tag; Löschung nach 12 Monaten |
| Zeitzone aller Regeln | Schweizer Zeit |
