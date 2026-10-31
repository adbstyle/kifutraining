# KiFu – Produktwissen für die Einordnung von User-Feedback

Stand 2026-10-30 (Release 1.45.0). Zusammenfassung der Produktdokumentation unter `docs/produkt/`,
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
| **Erwartetes Verhalten** | Verhalten ist hier ausdrücklich als Absicht beschrieben. Antwort: erklären, wie es gedacht ist. | „Die Abmeldung meines Kindes ist verschwunden" → Termin wurde verlegt, Abmeldungen verfallen bei Verlegung. |
| **Wunsch zu einer bekannten Grenze** | Gewünscht wird etwas, das Abschnitt 12 als heute fehlend nennt. Ein Wunsch, kein Fehler; die genannte Grenze als Bezug angeben. | „Ich möchte an Trainings erinnert werden." → keine Benachrichtigungen. |
| **Neuer Wunsch** | Etwas Neues, das weder beschrieben noch als Grenze genannt ist. | „Ich möchte pro Übung ein Video hinterlegen." |
| **Wunsch, der schon erfüllt ist** | Die gewünschte Fähigkeit gibt es bereits. Antwort: zeigen, wo sie liegt. | „Ich hätte gern Alternativen für den Hauptteil." → Varianten des Hauptteils. |
| **Wunsch nach anderem Verhalten** | Die Fähigkeit gibt es, sie soll sich aber anders verhalten als bewusst entschieden (Abschnitt 10). | „Abmeldungen sollen bei einer Verlegung bestehen bleiben." |
| **Bedienproblem / Unklarheit** | Funktion existiert, Person findet sie nicht oder versteht sie falsch. | „Wo kann ich ein Training kopieren?" → drei Punkte → Übernehmen. |
| **Datenschutz / Sicherheit** | Jemand sieht Daten, die er nicht sehen dürfte, oder ein Link/eine Adresse wurde missbraucht. Immer hoch priorisieren. | „Ich sehe die E-Mail einer Person, die nicht in meinem Team ist." |

Meldungen können mehrere Kategorien treffen (z. B. Fehler + Wunsch). Nenne dann beide.

Bei einem Wunsch immer zuerst prüfen, ob es die Fähigkeit schon gibt – auch unter anderem Namen
(Glossar, Abschnitt 2) oder über den KI-Assistenten (Abschnitt 8). Viele Wünsche treffen eine
bekannte Grenze; dann diese wörtlich als Bezug nennen, damit gleiche Wünsche zusammenfinden.

### Rückfragen zu einem Wunsch (nur die passenden stellen)

- Welches Problem soll gelöst werden – was ist die Situation auf dem Platz oder im Team? (Das
  Problem ist wichtiger als die vorgeschlagene Lösung.)
- Wer braucht es: Trainer:in, verantwortliche Person, Eltern, Spieler:in, Verein?
- Wie oft kommt die Situation vor (jedes Training, jede Saison, selten)?
- Wie wird es heute gelöst (Umweg in KiFu, anderes Werkzeug, Zettel, Chat)?
- Welche Altersstufe, welches Gerät (Telefon auf dem Platz oder Rechner zu Hause)?
- Was wäre das Mindeste, das schon hilft?
- Betrifft der Wunsch Daten von Kindern oder Eltern? (Dann Datenschutz mitdenken: KiFu führt
  bewusst nur Vorname, Nachname, Jahrgang, J+S-Nummer und keine Kontaktdaten.)

### Rückfragen zur Reproduktion eines Fehlers (nur die passenden stellen)

**Immer:**
- Was genau getan (Schritte), was erwartet, was passiert? Wortlaut einer Fehlermeldung?
- Gerät und Bildschirm: Telefon / Tablet hoch / Tablet quer / Laptop / breiter Bildschirm? Browser?
  (Viele Ansichten verhalten sich je nach Breite anders – siehe Abschnitt 3.)
- Angemeldet oder ohne Konto? Über einen **privaten Link** (Eltern) oder als Trainer:in?
- Wann (Datum/Uhrzeit)? Viele Regeln hängen an Schweizer Zeit, Terminbeginn, Meldefrist.
- Prod (ki-fu.ch) oder Staging (staging.ki-fu.ch)?

**Je nach Bereich:**
- Übung: Altersstufe (Kinder-/Juniorenfussball)? Eigene, Manual- oder fremde Übung? Entwurf oder öffentlich? Mit Diagramm/Foto?
- Training: Altersstufe? Persönlich, Team-Training oder Termin-Training? Entwurf oder öffentlich? Mehrere Varianten des Hauptteils? Gruppen?
- Termin: Training oder Spiel? Einzeltermin oder Serientermin (welche Wahl: nur dieser / folgende / alle)? Schon begonnen? Ausgefallen? Verlegt? Kader am Termin?
- Team: Führt das Team eine Spielerliste? Kader? Selbstabholung an? Wie viele Mitglieder?
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
- **Gruppe** – Bezeichnung im Training (z. B. „Rot"), ohne Kinder. **Durchlauf** – Reihenfolge der Gruppen an einer Hauptteil-Übung. **Wechsel** – Position im Durchlauf = Zeitfenster.
- **Team** – Trainerteam; alle Mitglieder gleichberechtigt.
- **Team-Bestand** – Trainings, die dem Team gehören. **Termin-Training** – stille Kopie, die beim Zuordnen an einen Termin entsteht; lebt nur mit dem Termin, steht nicht im Bestand.
- **Termin** – Training oder Spiel im Teamkalender. **Terminserie** – wöchentlich wiederholte Trainingstermine (max. 1 Jahr).
- **Abweichung** – Angabe eines Serientermins, die „nur für diesen Termin" geändert wurde; zurück mit „Der Serie folgen".
- **Trainer:innen am Termin** – eingeladen / dabei / abgesagt / verantwortlich (max. eine Person). „Absagen/dabei" = Trainer:innen; „abmelden/angemeldet" = Spieler:innen.
- **Mindestbesetzung** – nötige Trainer:innen: feste Zahl oder Verhältnis (1 je n Spieler:innen).
- **Spielerliste** – Spieler:innen des Teams (Vorname, Nachname, Jahrgang, optional J+S-Nummer).
- **Kader** – benannte Teilmenge der Spielerliste (z. B. „Torhüterinnen"); Termine lassen sich auf Kader beschränken.
- **Probetraining / Probe-Modus** – Spieler:in auf Probe: an Trainings zuerst nicht angemeldet, meldet sich über den Link selbst an, höchstens für die Anzahl Probetrainings des Teams; Spiele gelten für sie nicht.
- **Info-Schreiben** – Text des Teams für Probe-Spieler:innen, steht oben in ihrem privaten Link.
- **Privater Link** – Link je Spieler:in, über den Eltern ohne Konto ab-/anmelden und Termine abonnieren.
- **Selbstabholung / Abholadresse** – Team-Adresse, über die Eltern mit Vorname+Nachname+Jahrgang den privaten Link selbst holen.
- **Bezogen** – der aktuelle private Link wurde über die Abholadresse herausgegeben (grüner Punkt).
- **Richtwert** (Spiel) – Mindest- und Höchstzahl. **Meldefrist** – bis wann Eltern für ein Spiel melden. **Treffpunkt** – je Anreiseart (vor Ort, öV, Auto, Velo, Car/Vereinsbus).
- **Nicht aufgeboten** – Kennzeichnung einer Spieler:in für ein Spiel durch Mitglieder.
- **Stand bei Beginn / beim Anpfiff** – eingefrorener Stand der Anmeldungen ab Terminbeginn. **Nachtrag** – „nicht erschienen" / „doch erschienen".
- **KI-Zugang / MCP** – ein KI-Assistent (z. B. Claude) verbunden über `https://ki-fu.ch/api/mcp`.
- **Snackbar / Zeile am unteren Rand** – kurze Rückmeldung zu einem Vorgang. **Hinweis (Section Message)** – bleibender Zustand im Seiteninhalt.

---

## 3. Oberfläche und Navigation

**Seitenleiste (links):** Marke (Zeichen F mit Punkt, Name KiFu) → Übungsbestand. Gruppen „Bibliothek" (Übungen, Trainings) und „Mein Bereich" (Meine Übungen, Meine Trainings, Teams mit aufklappbaren Teamnamen). Unten: „Fragen und Feedback" (nur angemeldet; öffnet diesen Dialog), „Darstellung" (nur angemeldet), Version (Klick → „Versionen"), Konto. Den Styleguide führt die Leiste nicht mehr. Ohne Anmeldung: „Anmelden" statt Konto, „Mein Bereich" fehlt.
- Breit/schmal nur per Knopf links vor den Brotkrumen; Wahl merkt sich der **Browser**, nicht das Konto.
- Telefon: Menüknopf oben öffnet die Leiste als Überlagerung; kein Verkleinern-Knopf.

**Hell und dunkel:** KiFu folgt der Einstellung des Geräts (ohne Angabe: hell), wechselt beim Umstellen des Geräts sofort mit. Angemeldet unter „Darstellung": „Wie das Gerät", „Hell", „Dunkel" — wirkt sofort, ohne Neuladen, Eingaben bleiben. Wahl gilt **pro Browser** (nicht pro Konto), auch abgemeldet auf Anmelde-, Registrier- und Passwortseiten. **Ohne Anmeldung** sind alle Seiten mit Leiste immer hell. Seiten hinter privatem Link folgen nur dem Gerät (keine Wahl). Druck immer hell.
- Neue Version: Plakette „Neu" an der Versionszeile (schmal: Punkt), bis „Versionen" angesehen wurde. Pro Browser gemerkt. Neue Version erscheint spätestens 1 h nach Veröffentlichung, beim nächsten Seitenwechsel.

**Seiten:** Brotkrumen zuoberst, rechts davon die Aktionen der Seite. Übersichten ohne sichtbare Überschrift (Name steht in der Brotkrume). Ab Laptop-Breite klebt die Kopfzeile; auf dem Telefon nur die Menüzeile.

**Geteilte Seiten (nur breiter Bildschirm):** Übung (links Inhalt, rechts Einordnung), Training (links Übungen, rechts Eigenschaften oder geöffnete Übung), Trainingsplan mit geöffnetem Termin. Jede Seite scrollt für sich; Spaltenbreite per Griff ziehbar (Doppelklick = Standard), gilt für Übung und Training gemeinsam, pro Gerät gespeichert. Schmal: alles untereinander, kein Ziehen.

**Bedienung:**
- Alle Bedienelemente 36 px hoch, auch auf dem Telefon (bekannt: kleiner als für Finger empfohlen).
- Felder ohne Rahmen im Ruhezustand; Name klein über dem Wert. Erklärungen hinter **ⓘ** (erscheint nur bei Maus-Hover; auf Touch-Geräten nie – ausser 3 Hinweise, die dort unter dem Feld stehen: feste Altersstufe eines Trainings, wen die erwartete Spielerzahl zählt, „0 Tore = keine").
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

**Fragen und Feedback:** Gespräch mit Haiku (Anthropic, USA) über Fehler, Wünsche und Fragen; Trainer:innen über die Seitenleiste, Eltern über eine am unteren Rand klebende Leiste auf der Seite hinter dem privaten Link. Desktop: Spalte rechts, bleibt beim Seitenwechsel offen; Telefon und privater Link: Vollbild. Gespeichert wird nur die bestätigte Zusammenfassung samt Gespräch (Trainer:innen mit Konto, Eltern nur mit Team); keine Antwort über KiFu, Löschung nach 12 Monaten; bei Konto-Löschung bleibt es ohne Kontobezug. Fällt die KI aus oder ist ihr Budget aufgebraucht: nur „Feedback ist gerade nicht möglich", kein anderer Weg.

**Plakettenfarben:** grau = benennt (Herkunft, Entwurf, Altersstufe), blau = gilt nach aussen, violett = Zusatz (mehrere Varianten, neue Version), orange = braucht Aufmerksamkeit (Termin ohne Training).

---

## 4. Konto und Zugang

- **Registrierung:** E-Mail + Passwort (min. 8 Zeichen, 2× eingeben). Danach immer derselbe Hinweis „Bestätigungslink unterwegs" – auch bei bereits registrierter Adresse (Absicht, verrät keine Konten). Konto nutzbar erst nach Klick auf den Mail-Link.
- **Anmelden:** Vor Bestätigung → Hinweis + Mail erneut anfordern. Falsche Adresse/Passwort → bewusst unbestimmte Meldung. Kein Magic-Link, kein Login über Google o. Ä.
- **Passwort vergessen:** immer gleiche Antwort; neues Passwort 2×; altes wird abgelehnt. Passwort ändern geht **nur** über diesen Mailweg.
- **Konto-Seite:** E-Mail, Abmelden, eigene Übungen, Anzeigename, KI-Zugänge, Kalender-Abos, Cookies, Konto löschen. Kein Profilbild, keine Adresse, kein Verein.
- **Anzeigename:** Sichtbar für andere (Urheber öffentlicher Trainings, Mitgliederlisten, Termine, Kalender-Abos anderer; als Verantwortliche:r auch für Eltern am privaten Link). Ohne eigenen Namen automatische Kennung „Trainer:in a1b2". Max. 40 Zeichen. Speichert beim Verlassen/Enter, Escape verwirft. **Einmal gesetzt nicht mehr entfernbar** (Absicht).
- **E-Mail-Adresse** sehen nur Mitglieder gemeinsamer Teams (Mitgliederliste, Trainer:innen-Auswahl). KI-Assistent bekommt sie nie.
- **Ohne Konto:** gesamter Übungsbestand und alle öffentlichen Trainings ansehen, suchen, filtern, durchführen, drucken. Nicht: anlegen, bearbeiten, favorisieren, übernehmen, Teams. Geschützte Adresse → Anmeldung → danach zurück zum Ziel. Ausnahmen ohne Konto: Kalender-Abo-Links, privater Link, Abholadresse.
- **Konto löschen** (unumkehrbar, Bestätigung): Favoriten, private Übungen, persönliche Trainings weg. Öffentliche Übungen/Trainings bleiben ohne Urheber. Teams mit weiteren Mitgliedern bleiben; war die Person letztes Mitglied → Team aufgelöst (inkl. Spielerliste, Links ungültig). Aus allen anstehenden Terminen ausgeladen; an vergangenen „Ehemaliges Mitglied". Kalender-Abos erlöschen (ohne Hinweis), KI-Zugänge entzogen.
- **Keine Rollen**: weder global noch im Team.

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

**Finden (Katalog):** Volltextsuche (Wortteile), Kreuz leert. Beide Altersstufen in einer Liste. Kachel: Bild, Name, Eckdaten (z. B. „F E · Fussball spielen lernen · Kleinfeld · 6–8 Sp.", max. 2 Zeilen). Filter: Trainingsteil (Kinder-Teile und Junioren-Blöcke getrennt, Kinder-Hauptteil als 3 Kategorien), Alterskategorie, Feldtyp, Erscheinungsform, Übungstyp, Zahl verfügbarer Kinder (zeigt Übungen, die mit mindestens so vielen gehen). Erst 24 Kacheln, „Weitere anzeigen" +24; Filteränderung beginnt wieder bei 24. Angemeldet zusätzlich: Meine Übungen, Favoriten (jede sichtbare Übung favorisierbar).
- Übungen ohne Erscheinungsform/Übungstyp/Feldtyp fallen bei entsprechenden Filtern raus (Absicht).

**Drucken:** jede sichtbare Übung, auch ohne Konto. Drucker-Symbol neben dem Herz → Druckdialog des Geräts (PDF über Druckdialog). Fuss nennt Herkunft (Manual SFV oder Community), nie Trainername; Entwurf wird vermerkt. Keine Dauer. Ohne Bild leere Feld-Skizze. Nur eine Übung pro Vorgang.

---

## 6. Trainings

**Altersstufe** wird beim Anlegen gewählt und ändert sich **nie** (auch nicht bei Aufstieg; gemischte Jahrgänge E+D nicht abbildbar).

**Aufbau (fest, nicht einstellbar):**
- Kinderfussball: Auffangen (ohne Zeit), Einleitung, Hauptteil (3 Kategorien in fester Reihenfolge), Ausklang. Keine Zeitrichtwerte.
- Juniorenfussball: Auffangen (ohne Zeit, freiwillig, nie angemahnt), Einstieg 20–30 (Aufwärmen 10–12, Spielform zum Trainingsziel 6–8, Explosivität 8–10), Hauptteil 45–65 (Spielformen 30–45, Spiel 15–20), Abschluss 5–10; total 90 min. Abweichung wird angezeigt, sperrt nie.

**Anlegen:** Name (max. 80), Altersstufe, ≥1 Alterskategorie (der gewählten Stufe; Kategorie gesperrt, bis Stufe gewählt), optional Ziel (max. 200). Letzte Kategorie nicht entfernbar.

**Aktionen** (Zeile der Brotkrumen, rechts): Durchführen, Drucken, Bearbeiten; hinter den drei Punkten: Übernehmen, Veröffentlichen/Auf Entwurf, Ins Team stellen, Einem Team-Termin zuordnen, Löschen (2. Bestätigung). Fremdes Training: keine drei Punkte. Team-Training: kein Veröffentlichen, kein Ins-Team-Stellen, kein Team-Termin-Zuordnen von hier. Termin-Training: „In den Team-Bestand kopieren".

**Name ändern:** direkt in der Überschrift, übernommen beim Verlassen (kein Enter nötig). Leer → alter Name zurück + Hinweis.

**Zusammenstellen:**
- Auswahl zeigt nur Übungen der Altersstufe und des Blocks (Kinder-Hauptteil: passend zur Kategorie). Junioren-Sonderfall: Explosivität zieht zusätzlich Übungen mit Erscheinungsform „Explosiv und dynamisch agieren" an, Aufwärmen jene mit „Den Körper stabil halten".
- Leere Auswahl: Anwendung sagt, ob Filter zu eng oder Bestand leer (dann Link zu „Übung erfassen").
- Klick auf Karte übernimmt; Zähler im Bild; dieselbe Übung mehrfach möglich.
- Je Teil eine Karte, Blöcke als abgesetzte Flächen (auch leere).
- Zeile: Vorschaubild, Name, Kategorien, Dauer. Pfeile verschieben **um einen Platz** (kein Drag & Drop). X entfernt nur diese Fassung.
- **Dauer** (nicht im Auffangen): ganze Minuten ≥0; Enter/Häkchen/Klick daneben speichert, Escape/Kreuz verwirft; leer = ohne Dauer. Summe läuft mit, Zahl der Übungen ohne Dauer wird genannt.
- Kategorie geändert → Anwendung nennt nicht mehr passende Übungen; Entscheid beim Trainer.
- Hinweise (sperren nie): Kinder – Teil mit ungewöhnlich vielen Übungen, leeres freies Spiel. Junioren – leere Spielform zum Trainingsziel / Explosivität / Spiel / Abschluss.

**Spalte rechts (nur breit):** ohne geöffnete Übung die Eigenschaften (Altersstufe, Kategorien, Ziel, Gesamtdauer, Materialliste, Team/Termin, Sichtbarkeit, Urheber). Ziel und Kategorien dort direkt editierbar (Jira-Stil). Klick auf eine Übungszeile öffnet das Detail in der Spalte (eigene Adresse). Bearbeiten in der Spalte, Sichern/Verwerfen/Schliessen kleben oben; „Sichern und weiter" gibt es nicht. Ungesicherte Änderung + anderer Vorgang → Rückfrage „weiter bearbeiten / verwerfen". Variantenwechsel schliesst die Übung. Schmal: eigene Bearbeitungsseite.

**Notiz je Übung:** direkt unter dem Namen, speichert beim Verlassen, max. 500 Zeichen. Erscheint auch in Durchführen und Druck. Gehört dem Training (reist mit Trainingskopie, nicht mit Fassungskopie).

**Gruppen:** nur Bezeichnungen (keine Kinder, keine Zahl), keine Obergrenze. Verwaltet in der Hauptteil-Karte (Leiste mit Personen-Zeichen). Chip zeigt Name + Zeit („Rot · 24 min", „–" ohne Dauer). Menü: bearbeiten, nach vorne/hinten, entfernen (Rückfrage, wenn zugewiesen). Name max. 40, nicht leer, eindeutig (Gross/klein egal).
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

**Trainingsübersicht:** öffentliche + eigene (inkl. Entwürfe), Schalter „nur eigene". Suche über Namen, Filter Alterskategorie. Ohne Suchbegriff zuletzt geändert oben. Marke mit Variantenzahl; Übungszahl/Dauer beziehen sich auf die erste Variante. **Team-Trainings erscheinen hier nie.**

---

## 7. Team-Bereich

**Teams:** Jede angemeldete Person kann eins anlegen. Mitglieder per E-Mail (nur bestätigte Konten, keine Zustimmung nötig); Suche max. 10 erfolglose pro Stunde. Alle gleichberechtigt (umbenennen, aufnehmen, entfernen, Trainings/Termine, Spielerliste, auflösen). Mitgliederliste mit Anzeigename + E-Mail.
- Drei Ansichten (Umschalter unter Brotkrumen): **Trainingsplan** (Start), **Trainings** (Bestand), **Team** (Name, Spielerliste, Kader, Mitglieder, Gefahrenzone). Eigene Adressen. Team, in dem man nicht ist → Teamübersicht (nicht unterscheidbar von „gibt es nicht").
- Teamname ändern: Feld, speichert beim Verlassen; leer → alter Name zurück.
- Bekannt: Aufnahme durch anderes Konto erscheint in der Leiste erst nach Neuladen/eigener Aktion.

**Trainings im Team:** gehören Person **oder** Team, nie beiden. Immer Kopie (Ins Team stellen, Zu sich übernehmen), vollständig (Ziel, Gruppen, Verteilung, Notizen, alle Varianten). Direkt im Team anlegen möglich. Team-Trainings nur im Team-Bereich; Leiste hält „Teams" hervorgehoben.

**Termine (Kalender):** Art „Training" oder „Spiel" (vorher wählen, danach unveränderbar). Training: Datum, Beginn, Ende (Pflicht, gleicher Tag), Ort (max. 100) samt Kartenlink, Bemerkung (max. 500, nur fürs Team), Hinweis für Eltern (max. 500, Eltern sehen ihn am Link und im Abo, ausser bei Ausfall), Felder, erwartete Spielerzahl, Trainer:innen, Mindestbesetzung, Kader. Vergangene Trainings erlaubt.
- **Kartenlink zum Ort** (z. B. geteilter Link aus Google Maps/Apple Karten): optional, nur mit Ort (ohne Ort gesperrt: „Gib zuerst einen Ort an."), muss mit https:// beginnen, max. 500 Zeichen. Ziel wird nicht geprüft (Team verantwortlich). **Ort geändert oder geleert ohne neuen Link → bisheriger Link fällt weg** (Dialog sagt es vorher). Im geöffneten Termin „Auf der Karte öffnen". An einem Serientermin weicht der Link mit dem Ort ab und folgt mit ihm wieder der Serie (eigener Link fällt dann weg).
- **Felder:** je Feld Länge+Breite 5–120 m (nur zusammen), Tore je Torart (Minitore, 5-m, 7-m), Untergrund (Naturrasen, Kunstrasen, Hartplatz, Halle, Unbekannt). Leer = unbekannt, **0 Tore = keine**.
- **Erwartete Spielerzahl** 1–200 (inkl. Torhüter:innen, ohne Trainer:innen) – nur ohne Spielerliste.
- Termin entfernen: Rückfrage nennt Training; Termin-Training wird mitgelöscht, altes Bestands-Training bleibt.
- Altdaten: Termine ohne Ende → 90 min; ganz ohne Zeit → 18:00–19:30.

**Trainings zuordnen:** nur über bestehenden Termin; max. 1 Training pro Termin. Am Termin (Training hinzufügen/ersetzen; Auswahl: Team-Bestand + „Meine Trainings") oder vom Training aus („Termin zuordnen" / „Einem Team-Termin zuordnen"; ausgefallene Termine nicht wählbar). **Immer stille Kopie** = Termin-Training, nicht im Bestand. Verliert es den Termin (lösen, ersetzen, Termin entfernen, Serienänderung) → **gelöscht**. Fremdes öffentliches Training erst nach Übernahme zuordenbar. Brotkrumen tragen Termindatum („Mi., 23.09.2026"). Altlast: vor 2026-10-06 direkt zugeordnete Trainings bleiben im Bestand (Plakette „Eingeplant").

**Terminserien:** „Wiederholender Termin" im selben Dialog; Wochentag(e), Beginn- und Enddatum (max. gleicher Kalendertag Folgejahr). Nur Trainings. Legt je Wochentag einen Termin ohne Training an; bestehende Termine bleiben daneben.
- Ändern: „Nur dieser Termin" (→ Abweichung), „Dieser und alle folgenden" (teilt die Serie), „Alle Termine der Serie" (inkl. vergangener). Datum nur „nur dieser"; Wochentage/Zeitraum nur „folgende/alle".
- Wochentag/Zeitraum verkleinert → Termine entfallen **inkl. solcher mit Training** (Rückfrage nennt nur Termine mit Training). Genau ein Wochentag getauscht → Termine wandern innerhalb der Woche. Entfernte Termine kommen nie zurück.
- „Der Serie folgen" wirkt sofort und schliesst den Dialog – andere ungespeicherte Änderungen im Dialog gehen verloren (bekannt).

**Trainer:innen am Termin:** Eingeladene gelten als dabei, bis sie absagen. Max. eine verantwortliche Person (wird automatisch eingeladen und dabei). Beim Erstellen vorgewählt: alle Mitglieder eingeladen, man selbst verantwortlich. Reiter „Trainer:innen": „2 von 3 dabei", Gruppen Dabei / Abgesagt (mit Zeit) / Nicht eingeladen; Schalter je Person; Menü „Verantwortung geben", „Ausladen". **Jedes Mitglied darf für alle absagen/zusagen.** Eigener Stand auch über Zeilenmenü („Absagen", „Wieder zusagen", „Ich helfe aus") und Schalter „Ich bin dabei" auf der Karte „Als Nächstes".
- Absagen änderbar bis Beginn/Anpfiff; an ausgefallenem Termin ruhend. Verantwortliche sagt ab → „Wer übernimmt?". Datum/Beginn geändert (noch nicht begonnen) → **Absagen verfallen** (bei Spiel nur Datum). Neue Mitglieder sind zu bestehenden Terminen **nicht** eingeladen.
- **Mindestbesetzung:** feste Zahl oder Verhältnis (1–99). Unterbesetzt (anstehend) → rote Plakette „1 Trainer:in fehlt"; ohne Verantwortliche:n gelbe „Niemand verantwortlich". Verhindert nichts.
- Eingrenzung: „Meine Termine" (dabei) oder „Eingeladen" (inkl. abgesagt); fällt beim erneuten Öffnen des Teams weg.
- Ausscheiden aus dem Team → aus allen anstehenden Terminen/Serien ausgeladen.

**Ausfälle:** Termin bleibt, Plakette „Ausgefallen", optionaler Grund (max. 500; Eltern sehen ihn am Link). Auch nachträglich. Training ruht (öffnen ja, durchführen nein). Abmeldungen/Absagen/Nachträge ruhen; **keine Spielerzahl** angezeigt. Rücknahme stellt alles her. Training: auf heute/später verlegt → findet wieder statt; Spiel: jede Verlegung → findet wieder statt. Kein Massen-Ausfall (z. B. Ferienwoche) möglich.

**Trainingsplan:** Anstehend (aufsteigend) oben, Rückblick (zusammengeklappt, neueste zuerst) unten. Grenze = **Tagesende Schweizer Zeit** (heutiger Termin bleibt den ganzen Tag oben, auch nach Ende).
- **„Als Nächstes"**-Karte: erster anstehender, nicht ausgefallener Termin. Status „Vorbereitet" (grün) / „Nicht vorbereitet" (gelb, nur hier). Zeile mit Spielerzahl („12/14"), Kader, Trainer:innen („dabei/eingeladen"), Platz. Schalter „Ich bin dabei" (gesperrt ab Beginn/bei Ausfall). Knöpfe Durchführen, Training öffnen bzw. Training hinzufügen, Spieler:innen, Trainer:innen.
- Übrige Termine nach Monaten (mit Jahr), je Tag eine Karte. Status-Wort: „Vorbereitet" grün, „Nicht vorbereitet" grau, „Fällt aus" grau; Spiel: Status zum Richtwert. Ohne Training anstehend: violett „+ Training hinzufügen". Vergangen ohne Training: „Kein Training eingetragen".
- Rechts klein: Spielerzahl (mit Liste „12/15", ab Beginn Anwesende, ausgefallen keine), Trainer:innen „2/3" mit eigenem Stand.
- **Mini-Monat** rechts (nur ab Tablet quer): folgt der Liste (Monat des obersten sichtbaren Termins); Pfeile/„Heute" wechseln nur den Monat. Punkte für farbige Status (max. 2 + „+n"). Klick auf Tag springt in die Liste. Kein Anlegen aus dem Monat. **Am Handy kein Monat.**
- **Geöffneter Termin**: rechts neben der Liste (schmal: ersetzt die Liste). Reiter **Termin / Training / Spieler:innen / Trainer:innen** (Spiel: Spiel / Spieler:innen / Trainer:innen). Eigene Adresse inkl. Reiter.
- Eigene Änderungen erscheinen sofort; **Änderungen anderer erst nach Neuladen**.

**Kalender-Abo (Mitglieder):** Menü neben „Termin erstellen" → persönlicher Link je Team (Warnung: persönlich, nicht weitergeben). Anleitung für Apple, Google (nur im Browser hinzufügen), Outlook, Proton. Liefert anstehende + letzte 28 Tage, **nur Termine, zu denen man eingeladen ist**; ausgefallene/entfernte fehlen. Titel „Training · Teamname" bzw. „Bezeichnung · Teamname", Präfix „Abgesagt · " / „Verantwortlich · ". Beschreibung: eigener Stand, wer dabei/abgesagt/verantwortlich, Lücke Mindestbesetzung, Kartenlink als „Karte: …". Keine Trainingsnamen, Bemerkung, Felder, Spieler:innen. Schweizer Zeit. Erlischt bei Widerruf, Austritt, Entfernung, Kontolöschung, Teamauflösung; bleibt erloschen (neuer Link nötig). Kalenderprogramm bestimmt Abrufhäufigkeit (Änderungen kommen verzögert – kein Fehler).

**Spielerliste:** Karte unter „Team". Vorname/Nachname je 1–60, Jahrgang 4-stellig, J+S-Nr. max. 20, **max. 200 Spieler:innen**. Eindeutig: Vorname+Nachname+Jahrgang (Gross/klein, Mehrfach-Leerzeichen, Bindestrich vs. Leerzeichen, Apostroph-Varianten egal; „Müller" ≠ „Mueller"). Dialog bleibt nach „Hinzufügen" offen.
- **CSV-Import:** Semikolon/Komma, UTF-8 oder Windows-Zeichensatz, Kopfzeile Pflicht (ClubCorner-Export). Nur Vorname, Nachname, Jahrgang, J+S-Nr. verlassen das Gerät. Spalten per Kopf erkannt. Aus Geburtsdatum nur 4-stelliges Jahr (2-stellig → Zeile ausgelassen). J+S nur Ziffern („k.A." = leer). Vorschau: neu / neue J+S / unverändert / ausgelassen mit Grund. Gleiche Angaben mehrfach → letzte Zeile gewinnt. Wer fehlt, bleibt. Ganz oder gar nicht. Keine Excel-Dateien. Namen bestehender werden nicht geändert (gekürzter Rufname → beim nächsten Import Duplikat).
- **Erste Aufnahme** → alle anstehenden Termine + Serien verlieren ihre erwartete Zahl; Spielerzahl kommt fortan aus der Liste. Liste wieder leer → Zahl unbekannt.
- Entfernen: Link ungültig, an vergangenen Terminen „Ehemalige Spieler:in".
- Begonnener Termin behält „Stand bei Beginn" (minutengenau, Schweizer Zeit).

**Kader:** max. 20 je Team, Name 1–30, eindeutig (Bindestrich/Apostroph unterscheiden hier!). Hinweis: Eltern sehen die Kader ihrer Spieler:in → nichts Heikles in den Namen. Zuteilung im Spieler-Dialog oder per Mehrfachauswahl („Kader zuteilen", Leiste unten). Termin/Serie mit Kadern gilt nur für deren Mitglieder; ohne Kader für alle. Kader schliessen nichts aus. Termin für niemanden → „0 von 0".
- Termin gilt durch Kader-Änderung nicht mehr für jemanden → Abmeldung/Meldung/Kennzeichnung **verfällt** (Rückfrage mit Zahl); gilt später wieder → angemeldet (Spiel: ohne Meldung).
- Mitglieder sehen immer alle Termine (Kader filtern nur Spieler:innen).

**Probetraining:** Karte unter „Team" zwischen Spielerliste und Kadern; ohne Einstellung „Noch kein Probetraining" + Link „Probetraining konfigurieren", sonst Anzahl, Info-Schreiben (3 Zeilen, „Ganz lesen"), wer im Probe-Modus ist. Dialog „Probetraining konfigurieren" bzw. „… bearbeiten": **Anzahl 1–20** (zählt besuchte + angemeldete Trainings, gilt fürs ganze Team, nicht entfernbar), **Info-Schreiben optional, ≤ 2000 Zeichen**, nur Text, Zeilenumbrüche bleiben, Webadressen im Link anklickbar, leer = entfernt.
- Ein-/Ausschalten nur im Dialog „Spieler:in ändern" (Checkbox „Im Probetraining"); nicht beim Hinzufügen/Import. Ohne Anzahl gesperrt. Einschalten lässt Abmeldungen kommender Trainings, Meldungen und Kennzeichnungen kommender Spiele **verfallen** (Knopf beim Einschalten „Probetraining einschalten"; verfällt etwas, Warnung mit Zahl). Ausschalten → an allen kommenden Trainings angemeldet, Spiele wieder sichtbar; erneutes Einschalten zählt ab null. Link bleibt derselbe.
- Plakette „Probe 1/4" in Spielerliste und Karte = **besuchte** von der Anzahl (nicht die angemeldeten).
- Besucht = nach dem Einschalten begonnenes Training, bei Beginn angemeldet oder „doch erschienen" nachgetragen (nicht „nicht erschienen"). Ausgefallenes zählt nicht, Anmeldung ruht bis Rücknahme.
- Eltern melden über den Link nur bis zur Anzahl an; **Mitglieder (und KI) dürfen darüber hinaus** anmelden, mit Hinweis „… ist damit über der Anzahl Probetrainings …". Anzahl senken lässt bestehende Anmeldungen stehen.
- Am Training zählt sie nur, wenn angemeldet; nicht angemeldet steht sie wie abgemeldet da, ohne eigene Kennzeichnung. In keinem Spiel.
- Verlegen oder Kader-Wegfall → ihre Anmeldung **verfällt** (Rückfrage nennt „Anmeldung einer Probe-Spieler:in"); gilt das Training wieder → nicht angemeldet.

**Ab- und Anmelden (Trainings):** Jede Spieler:in ist **standardmässig angemeldet**, bis abgemeldet. Kein „keine Rückmeldung". Bis Beginn, nie an ausgefallenem Termin. Durch Mitglieder (Reiter „Spieler:innen", Schalter) oder Eltern (privater Link). Wer gesetzt hat, wird nicht festgehalten; letzte gilt. Kein Grund.
- Zeitangabe links vom Schalter: seit wann der Status gilt („gerade eben", „vor 3 Stunden", „gestern", …); nur bei echtem Wechsel.
- **Datum oder Beginn geändert** (noch nicht begonnen) → **alle Abmeldungen verfallen**, alle wieder angemeldet (Rückfrage mit Zahl; Eltern sehen „Deine Abmeldung gilt nicht mehr"). Ende/Ort/Bemerkung/Hinweis für Eltern/Felder/Training ändern lässt sie stehen.
- Ab- oder Anmelden an inzwischen verlegtem/ausgefallenem/begonnenem Termin → abgewiesen mit aktuellem Stand („Der Termin wurde inzwischen verlegt …").
- **Nachtragen** ab Beginn (unbefristet, nur Mitglieder): „nicht erschienen" / „doch erschienen". Zahl wird „11 von 15 da". Eltern sehen Nachträge nie. Ohne Nachtrag = Stand bei Beginn gilt als Anwesenheit.

**Spiele:** Art „Spiel"; Bezeichnung Pflicht (max. 120); Anpfiff muss **in der Zukunft** liegen (kein Nachtragen vergangener Spiele, keine Verlegung in die Vergangenheit). Kein Training, keine Felder, keine erwartete Zahl, keine Serie. Optional: Ort, Bemerkung (nur fürs Team), Hinweis für Eltern (**für Eltern sichtbar**, ausser bei Ausfall; frühere Spiel-Bemerkungen sind seit #590 dorthin umgezogen), Kader, Mindestbesetzung, Mindest-/Höchstzahl (1–200, begrenzt Anmeldungen nicht), Meldefrist (vor Anpfiff, max. 1 Jahr, vergangene erlaubt), Treffpunkte (je Anreiseart max. 1, total max. 5; „vor Ort" ohne eigenen Ort).
- **Status** (Plan): „Zu wenig" rot (< Min), „Knapp" gelb (= Min), „Genügend" grün (bis Max), „Zu viel" rot (> Max). Ohne Richtwert oder ohne Spielerliste kein Status.
- **Melden:** Jede Spieler:in **zuerst ohne Meldung**; gezählt nur Angemeldete. Zurück auf „ohne Meldung" unmöglich. Mitglieder bis Anpfiff (auch nach Frist), Eltern bis Meldefrist (ohne Frist bis Anpfiff). Plaketten: „Ohne Meldung" gelb, „Angemeldet" grün, „Abgemeldet" rot, „Nicht aufgeboten" rot; nach Frist „Meldefrist verpasst" rot. Menü auf der Plakette.
- **Nicht aufbieten** (nur Mitglieder): Meldung bleibt darunter, zählt nicht als angemeldet; Eltern sehen die Kennzeichnung.
- Nach Meldefrist (mit Richtwert + Spielerliste): grosse Karte in der Liste mit Handlungshinweis („Es fehlen 2 bis zur Mindestzahl 9 …"). Erscheint erst beim nächsten Laden.
- Ab Anpfiff: Stand beim Anpfiff, Nachträge wie bei Trainings.
- **Verlegen:** Meldungen und Kennzeichnungen verfallen **nur bei Datumsänderung** (andere Uhrzeit am selben Tag lässt sie stehen). Meldefrist und Treffpunkte wandern mit (Abstand bleibt); kann dadurch abgelaufen sein. Nachträge verfallen beim Wiederöffnen immer.
- Ausfall: alles ruht; Eltern sehen nur Kopf mit Grund. Entfernen nennt Zahl der Meldungen.

**Privater Link (Eltern):** je Spieler:in genau einer; Mitglied holt ihn über Kettenglied in der Spielerliste. Anwendung verschickt nichts. „Link erneuern" → alter sofort ungültig, Abmeldungen bleiben, Kalender-Abo der Spieler:in erlischt.
- Seite: fürs Telefon, ohne Konto, ohne Leiste, keine Cookies, fester Titel ohne Namen. Teamname, Name der Spieler:in. „Heute" (begonnen, gesperrt) + anstehende Termine nach Monat. Trainingskarte: Status „Angemeldet"/„Abgemeldet"/„Fällt aus", Zeit, Ort, Kader, Spielerzahl („24/33", alle für die der Termin gilt), Verantwortliche:r, Schalter. Ort immer ganz (bricht um), auch nach Beginn; mit Kartenlink ist der Ort selbst der Link (violett, unterstrichen, Zeichen für extern; lang dann einzeilig mit „…"); bei Ausfall ohne Link. Ausfallgrund mit „Grund:". Hinweis für Eltern unter einer Linie am Fuss der Karte, ab vier Zeilen gekürzt mit „Ganz lesen"; auch abgemeldet und nach Beginn, nicht bei Ausfall. Verlegt → „Verlegt, vorher … Deine Abmeldung gilt nicht mehr."
- Spielkarte: Status inkl. „Ohne Meldung", „Nicht aufgeboten", „Meldefrist verpasst"; „Bitte melden bis …", „7/14 · gesucht 9 bis 12", Knöpfe Anmelden/Abmelden; nach Frist „Meldefrist abgelaufen · Änderung übers Team". Treffpunkte, Hinweis für Eltern. Nachträge und Status des Spiels sehen Eltern nicht.
- Zeigt **nicht**: andere Namen, fremde Kader, Termine anderer Kader, Trainingsinhalte, vergangene Termine.
- **Im Probe-Modus:** Kopf „… ist im Probetraining. Melde … an …", „Noch 2 von 4 Probetrainings möglich" mit Balken (besucht gefüllt, angemeldet umrandet), „x besucht · y angemeldet"; „Infos zum Probetraining" (Info-Schreiben, 4 Zeilen, „Ganz lesen", Links öffnen extern). Keine Spiele. Trainings zuerst „Nicht angemeldet" (grau, nicht gedämpft). Anzahl erreicht → „Alle 4 Probetrainings vergeben" (bei 1: „Das Probetraining ist vergeben"), Meldung über den Trainings, übrige Schalter gesperrt „Probetrainings vergeben"; abmelden geht immer. Verfallene Anmeldung: „… Deine Anmeldung gilt nicht mehr."
- Ungültig/unbekannt → neutrale Seite „Dieser Link gilt nicht mehr".
- **Kalender-Abo am Link:** Kalender-Zeichen hinter dem Namen. Titel mit ✅ zugesagt / ❔ vielleicht (Spiel ohne Meldung bis Frist; im Probe-Modus nicht angemeldetes Training) / ❌ abgesagt. Nur Anzeige, gemeldet wird über den Link. Kartenlink in der Beschreibung als „Karte: …". Kein Spielername, keine Frist, kein Richtwert. Erlischt bei Link-Erneuerung, Entfernung, Auflösung oder Widerruf durch Eltern (trifft alle mit derselben Adresse).

**Selbstabholung:** Schalter in der Spielerliste (Standard aus). An → Abholadresse zum Kopieren; nur teamintern teilen. Erneuern macht alte Adresse ungültig; Aus stoppt neue Abholungen. Bereits bezogene Links bleiben gültig.
- Abholseite: Vorname, Nachname, Jahrgang exakt (Umlaute/Akzente müssen stimmen; „ue" ≠ „ü"). Treffer → Link. Kein Treffer → immer „Dazu finden wir keinen Link. Prüf die Schreibweise oder frag beim Team nach."
- **Sperre:** 5 Fehlversuche in 15 min → 15 min Sperre für den **Internetanschluss** (alle Teams; trifft auch andere Eltern im selben WLAN).
- Bekannt: Wer die Adresse + Namen/Jahrgang kennt, kann fremde Kinder ab-/anmelden (vom Team bewusst getragen).

**Team verlassen / auflösen** („Gefahrenzone"): Verlassen kurz bestätigen. Auflösen bzw. Austritt als letztes Mitglied → Eingabe des **exakten Teamnamens** (Gross/klein zählt, Rand-Leerzeichen nicht). Zählt auf, was verschwindet. Prüfung beim Ausführen (inzwischen umbenannt → neuer Name verlangt). Unwiderruflich, keine Benachrichtigung, kein Export. Bei Austritt: Trainings bleiben im Team, Abo erlischt (ohne Hinweis).

---

## 8. KI-Assistent (MCP)

- Verbinden: Adresse `https://ki-fu.ch/api/mcp` im Client eintragen (Claude Desktop/claude.ai: Einstellungen → Connectors → Custom connector; Claude Code per Befehl). Browser öffnet Erlauben-Seite (vorher ggf. anmelden). Zugangsname max. 40. Kein Passwort/Schlüssel an den Assistenten.
- **Max. 5 Zugänge je Konto**, zusammen **600 Aufrufe/Stunde** (darüber Meldung mit Wartezeit). Widerruf unter „KI-Zugänge" wirkt sofort. Verfällt nie von selbst.
- Kann: Übungen suchen/abrufen; eigene Übungen anlegen, ändern, kopieren, öffentlich schalten, Diagramm setzen (als Ganzes) und Diagramm-Mängel abrufen; Trainings anlegen, Übungen zuordnen, überarbeiten (Name, Ziel, Kategorien, Dauer, Notiz, Reihenfolge eines ganzen Abschnitts in einem Zug, Entfernen), Gruppen/Durchlauf, Varianten, Hinweise abrufen, veröffentlichen/zurückziehen, übernehmen, löschen; Team-Trainings; Kalender (Termine, Serien, Spiele, Zuordnen, Trainer:innen, Ausfälle); Spielerliste, Kader, Probetraining (Anzahl, Info-Schreiben, Probe-Modus ein/aus), Ab-/Anmeldungen, Meldungen, Nachträge, private Links, Selbstabholung.
- Kann **nicht**: Favoriten, Teams gründen/umbenennen/auflösen, Mitglieder verwalten, Konto (Name, Passwort, Löschen), Kalender-Abos, Fotos hochladen, Übungen löschen, Übung in andere Altersstufe überführen, Übung aus Training in Bibliothek kopieren, einzelne Diagramm-Elemente ändern, Diagramm entfernen, Gruppenreihenfolge ändern, CSV-Import, E-Mail-Adressen sehen.
- Strenger als das Formular: Werte, die das Formular gar nicht anbietet, werden **abgelehnt** (mit Liste aller Verstösse), nicht still verworfen.
- Kartenlink zum Ort setzt er wie die App (nur mit Ort, https://, ≤ 500 Zeichen). Ändert er den Ort ohne neuen Link, fällt der bisherige weg – die Antwort sagt es ihm; ebenso, wenn ein Serientermin wieder der Serie folgt und seinen eigenen Link verliert.
- Fragt bei Löschen/Entfernen/Ersetzen nicht nach; Bestätigung im Aufruf nur bei Serienänderungen mit vergangenen Terminen und bei verfallenden Abmeldungen/Meldungen/Nachträgen.
- Bekannt: neue Fähigkeiten kennt ein verbundener Assistent erst nach Neuverbinden; offener Browser-Tab zeigt Änderungen des Assistenten erst nach Neuladen; Abbruch mitten im Kopieren kann eine unvollständige Kopie hinterlassen; die gemeldeten Diagramm-Mängel erscheinen in der App nirgends; Platz-/Spielerzahl-Passung beurteilt der Assistent selbst (Richtmasse SFV 2026/27: Kleinfeld G ~20×15, F ~25×20, E 25–30×20–25; Grossfeld F ~30×25, E 43–48×25–30 m).

---

## 9. Sichtbarkeit und Berechtigungen (Kurzmatrix)

| Wer | Sieht / darf |
|---|---|
| Ohne Konto | Übungsbestand, öffentliche Trainings (ansehen, drucken, durchführen), Versionen, Styleguide, Cookies |
| Angemeldet | + eigene Übungen/Trainings, Favoriten, Übernehmen, Teams |
| Team-Mitglied | alles im Team, gleichberechtigt; E-Mails der Mitglieder; alle Termine (unabhängig von Kadern) |
| Eltern (privater Link) | nur eigene Spieler:in: anstehende Termine ihrer Kader, eigener Status, Spielerzahl, Verantwortliche:r, Ort samt Kartenlink (Linkziel verantwortet das Team), Ausfallgrund, Hinweis für Eltern (Trainings und Spiele), Treffpunkte; nie die Bemerkung; keine anderen Namen, keine Trainingsinhalte |
| Mit Abholadresse | Link einer Spieler:in bei exaktem Vorname+Nachname+Jahrgang |
| KI-Assistent | wie Konto, eingeschränkt auf angebotene Werkzeuge; keine E-Mails |

Private Übungen/Trainings anderer sind nirgends sichtbar (auch nicht für den Assistenten). Fremde Übungen/Manual-Übungen sind nie direkt bearbeitbar.

---

## 10. „Sieht aus wie ein Fehler, ist aber Absicht"

- Registrierung sagt „Link unterwegs", obwohl Konto schon existiert.
- Anmeldefehler nennt nicht, ob Adresse oder Passwort falsch ist.
- Anzeigename lässt sich nicht mehr leeren.
- Abmeldungen/Absagen/Meldungen sind nach einer **Verlegung** weg (Training: Datum oder Beginn; Spiel: nur Datum).
- Abmeldung weg, weil der Termin durch eine **Kader-Änderung** nicht mehr für die Spieler:in gilt.
- Probe-Spieler:in an allen Trainings „nicht angemeldet" / sieht keine Spiele → Probe-Modus ist so gedacht; Abmeldungen und Meldungen verfielen beim Einschalten.
- Eltern können nicht mehr anmelden, Mitglieder schon → Anzahl Probetrainings erreicht; Mitglieder dürfen darüber hinaus.
- Plakette „Probe 0/4", obwohl angemeldet → zählt nur besuchte Trainings.
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
- Änderung an einem öffentlichen Training wird abgelehnt (würde Veröffentlichungsbedingung verletzen → erst auf Entwurf).
- Änderungen an einer Bibliotheks-Übung kommen nicht im Training an (und umgekehrt).
- Kopie einer Manual-Übung heisst gleich wie das Original; Kopie einer eigenen heisst „… (Kopie)".
- ⓘ-Hinweise fehlen auf Telefon/Tablet.
- Zeichenfläche fehlt auf dem Telefon; Mini-Monat fehlt auf dem Handy; rechte Spalte fehlt auf schmalen Bildschirmen.
- Meldung am unteren Rand verschwindet nach 6 s und lässt sich nicht erneut anzeigen.
- Abholseite sagt bei falscher Eingabe nie, was falsch ist; Sperre nach 5 Fehlversuchen trifft das ganze WLAN.
- Kalender-Abo zeigt Änderungen verzögert; zeigt nur Termine, zu denen man eingeladen ist.
- Kartenlink verschwunden, nachdem der Ort geändert wurde (Link gehört zum Ort).
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

---

## 11. Gleichzeitiges Arbeiten mehrerer Personen

- Kalender: Hat ein anderes Mitglied seit der eigenen Auswahl etwas Ergebnisrelevantes geändert (Termin entfernt, anderes Training, Ausfall, Serie), lehnt die Anwendung ab („Seit deiner Auswahl hat sich geändert …"), Dialog schliesst, Plan zeigt neuen Stand. Beim Termin-Ändern werden nur die tatsächlich geänderten Felder übernommen.
- Training/Übung/Notiz/Verteilung: **keine Konflikterkennung** – zuletzt gespeichert gewinnt (bekannte Grenze, kein Fehler).
- Offene Seiten aktualisieren sich nicht von selbst (auch Leiste, Brotkrumen, Termindatum erst beim nächsten Aufruf).

---

## 12. Bekannte Grenzen (kein Fehler – ggf. als Wunsch erfassen)

**Allgemein / Konto**
- Keine Rollen/Rechteabstufung; keine Einladung an Personen ohne Konto.
- Kein Profilbild; Anzeigename nicht zurücksetzbar; E-Mail vor Teammitgliedern nicht verbergbar.
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
- **Keinerlei Erinnerungen oder Benachrichtigungen** (kein E-Mail, kein Push): weder für Trainer:innen (neue/geänderte/ausgefallene Termine, Einladungen, Absagen, Mindestbesetzung) noch für Eltern (Verlegung, Ausfall, verfallene Abmeldung, fehlende Meldung, Meldefrist).

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

**Team / Kalender**
- Keine anderen Anlässe als Training/Spiel; keine teamübergreifende Ansicht; keine Doppelbelegungs-/Platzprüfung; keine Prüfung, ob Training zu Platz/Spielerzahl passt.
- Kartenlink nur auf Form geprüft (nicht, ob er auf den richtigen Platz zeigt); keine Karte/Vorschau in der App; kein Kartenlink für Treffpunkte; Ort samt Link nicht als Vorlage speicherbar.
- Serien nur wöchentlich, max. 1 Jahr, keine Ferien/Feiertage, kein Massen-Ausfall, keine Serienübersicht, Termin nicht aus Serie lösbar, entfernte Termine nicht wiederherstellbar.
- Neues Mitglied nicht auf einmal zu allen Terminen einladbar.
- Keine Tages-/Wochenansicht; Liste nicht durchsuchbar, nicht nach Zeitraum filterbar; kein Archiv.
- „Verantwortlich" ≠ J+S-Leitperson; keine Einsatz-Nachweise; Absage ohne Grund.
- Abo nicht auf eigene Termine/Trainings/Spiele eingrenzbar; Abruf-Frequenz bestimmt das Kalenderprogramm.
- Auflösen: kein Export, nicht wiederherstellbar, niemand wird informiert.

**Spielerliste / Kader / Anmeldungen**
- Nur Vorname, Nachname, Jahrgang, J+S – keine Kontakte, Geburtsdaten, Positionen; keine teamübergreifende Liste, kein Geschwister-Link.
- Kader nur mit Namen, ohne Saison, nicht teilbar; Kader beschränken nicht, was Mitglieder sehen.
- Import nur CSV mit Kopfzeile; keine Vorschau-Bearbeitung; Schreibvarianten nicht erkannt.
- Abmeldung ohne Grund, je Termin einzeln, Frist = Beginn (nicht einstellbar); nicht erkennbar, wer sich zu einem Training nicht geäussert hat.
- Nachtrag ohne Grund, kein entschuldigt/unentschuldigt, keine Teilanwesenheit, keine Präsenzauswertung, keine J+S-Übermittlung.
- Spiele: keine Resultate/Tabellen/Gegnerdaten, kein Import aus ClubCorner/Matchcenter, keine Serie, kein Nachtragen vergangener Spiele, keine Art „Turnier", Meldung nicht auf „ohne Meldung" zurücksetzbar, keine Fahrgemeinschaften, keine Rückkehrzeit, geänderte Treffpunkte nicht gekennzeichnet.
- Probetraining: Anzahl nur je Team (nicht je Spieler:in), nicht entfernbar; endet nicht von selbst; nicht beim Hinzufügen/Import; keine Eingrenzung der Liste auf Probe-Spieler:innen; keine eigene Kennzeichnung am Training; Info-Schreiben ohne Formatierung, nicht je Kader, nicht im Abo/bei der Selbstabholung; Kader-Wegfall ohne Hinweis am Link; keine Benachrichtigung.
- Link: Weitergabe nicht erkennbar; wer meldet (Eltern/Kind) nicht unterscheidbar; Sperren nur durch Erneuern, einzeln.
- Selbstabholung für alle oder keine; Sperre trifft Internetanschluss.

---

## 13. Feste Grenzwerte (zum Prüfen von Meldungen)

| Was | Grenze |
|---|---|
| Passwort | ≥ 8 Zeichen |
| Anzeigename, Gruppen-, Varianten-, KI-Zugangsname | ≤ 40 Zeichen |
| Trainingsname | ≤ 80 Zeichen |
| Ziel eines Trainings | ≤ 200 Zeichen |
| Notiz je Übung, Bemerkung, Hinweis für Eltern, Ausfallgrund | ≤ 500 Zeichen |
| Ort, Treffpunkt-Ort | ≤ 100 Zeichen |
| Kartenlink zum Ort | https://, ≤ 500 Zeichen |
| Spielbezeichnung | ≤ 120 Zeichen |
| Diagramm | ≤ 300 Elemente |
| Foto | Verkleinerung auf ≤ 2000 px (lange Kante) |
| Feld eines Termins | 5–120 m je Seite |
| Erwartete Spielerzahl, Richtwert Spiel | 1–200 |
| Mindestbesetzung | 1–99 |
| Spielerliste | ≤ 200 Spieler:innen; Vor-/Nachname 1–60; J+S ≤ 20 |
| Kader | ≤ 20 je Team; Name 1–30 |
| Probetraining | Anzahl 1–20 je Team; Info-Schreiben ≤ 2000 Zeichen |
| Treffpunkte | ≤ 5 (je Anreiseart 1) |
| Terminserie / Meldefrist / Treffpunkt-Abstand | ≤ 1 Jahr |
| KI-Zugänge | ≤ 5 je Konto, 600 Aufrufe/h gesamt |
| Mitglieder-Suche | 10 erfolglose/h |
| Abholseite | 5 Fehlversuche/15 min → 15 min Sperre je Anschluss |
| Katalog | 24 Kacheln je Seite |
| Meldung am unteren Rand | 6 s |
| Kalender-Abo Mitglieder | anstehend + letzte 28 Tage |
| Neue Version sichtbar | spätestens 1 h |
| Fragen und Feedback | 1000 Zeichen je Nachricht; 10 Nachrichten bis zur Zusammenfassung, danach 2 Korrekturen; 5 Gespräche je Konto bzw. privatem Link und Tag; Löschung nach 12 Monaten |
| Zeitzone aller Regeln | Schweizer Zeit |
