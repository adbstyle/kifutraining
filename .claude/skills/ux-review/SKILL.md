---
name: ux-review
description: Prüft eine bestehende Oberfläche (laufende App, Screenshot, Komponente oder Diff) auf UX-/UI-Qualität. Erfasst zuerst das vorhandene Design-System des Projekts und bewertet dann Treue zum Bestand, Usability-Heuristiken, Accessibility und Interaktion – jedes Finding mit Beleg, Regel und Severity. Verwenden bei «UX-Review», «Design-Kritik», «prüf die Oberfläche», «passt das zum Styleguide», «Audit», auch bei vagem «Gedanken dazu?» zu einem Screen. Nicht zum Neu-Entwerfen von Oberflächen.
---

# UX-Review

Bewertet Wirksamkeit, nicht Geschmack. Die Frage ist nie «gefällt mir das?», sondern «hilft es der Person, ihr Ziel zu erreichen – und passt es zum Rest des Produkts?». Jedes Finding nennt Beleg, Regel und Auswirkung.

**Grundregel:** Der Bestand schlägt die Theorie. Wo das Projekt eine Entscheidung getroffen hat (Token, Komponente, Muster, Wortwahl), gilt sie, auch wenn ein Prinzip etwas anderes nahelegt. Prinzipien sind nur Massstab, wo der Bestand schweigt, oder wo er selbst gegen Nutzbarkeit verstösst (dann als Finding mit Begründung melden, nie still «korrigieren»).

Der Skill liefert einen Bericht, ändert keinen Code. Behebung erst auf Wunsch.

## Ablauf

### 1. Ziel und Kontext klären

Aus Anfrage und Projekt ableiten, nur fragen, was fehlt:

- **Ziel:** Seite, Route, Komponente, Screenshot oder Diff.
- **Wer/Was/Wo:** Zielgruppe, Hauptaufgabe, Ort im Ablauf (erster Besuch, Alltag, Fehlerfall).
- **Profil:** Aufgabenoberfläche (Daten, Formulare, tägliche Arbeit), Lese-/Doku-Fläche, Marketing/Überzeugung oder mobile App. Das Profil bestimmt die Gewichtung: Bei Aufgaben zählen Scanbarkeit, Konsistenz und Fehlervermeidung mehr als Ausdruck.
- **Fassung:** Skizze/Wireframe nicht nach Politur beurteilen, sondern nach Struktur.

Behauptungen der Anfrage sind Hypothesen. Was sich im Bild oder Code widerlegt, im Bericht festhalten.

### 2. Bestand erfassen (Pflicht, vor jeder Bewertung)

Das vorhandene System **entdecken, nicht annehmen**. In dieser Reihenfolge suchen, das Gefundene in 10–20 Zeilen als «Bestandsprofil» zusammenfassen und im Bericht oben ausweisen:

1. **Projektanweisungen:** `CLAUDE.md`, `AGENTS.md`, `README`, Hinweise zu UI/Styleguide, `DESIGN.md`, `PRODUCT.md`, Doku-Ordner zu Produkt/Design.
2. **Tokens:** CSS-Variablen, Tailwind-/Theme-Konfiguration, Token-Dateien, Theme-Provider (Farben, Abstandsskala, Typo-Skala, Radien, Schatten, Bewegung, Hell/Dunkel).
3. **Komponenten-Kit:** Ordner wie `components/ui`, Primitive/Bibliothek (z. B. shadcn, MUI, eigenes Kit), Varianten und Zustände je Komponente.
4. **Lebender Styleguide:** Route/Storybook/Katalog, falls vorhanden – er ist Referenz für Zustände und Muster.
5. **Sprache und Begriffe:** Wortwahl, Anrede, Schreibweisen aus UI-Texten und Doku.
6. **Muster im Code:** Wie lösen andere Seiten dasselbe Problem (Leerzustand, Fehler, Bestätigung, Laden, Löschen)? Zwei bis drei Vergleichsseiten ansehen.

Ergebnis ehrlich einstufen:

- **Stark:** dokumentiertes System + genutztes Kit → Abweichung ist ein Finding.
- **Implizit:** Muster nur im Code erkennbar → Konventionen daraus ableiten, als «abgeleitet» kennzeichnen.
- **Keins:** Prinzipien als Massstab, und «fehlendes System» als eigenes Finding, wenn Inkonsistenz die Nutzung beeinträchtigt.

Nie Tokens oder Regeln erfinden und dem Projekt zuschreiben.

### 3. Beobachten

Prüfen am **laufenden Interface**, nicht nur am Bild, wenn möglich (Browser/Playwright):

- Sollgrösse(n) der Zielgeräte, Hell/Dunkel, falls das Produkt beides hat.
- Zustände durchspielen: leer, laden, Fehler, lang/kurz, viele Einträge, Tastaturbedienung, Fokus. Fehlt ein Zustand im Testkonto (z. B. langer Text, viele Einträge), ihn mit eigenen Testdaten herstellen, nie mit fremden Daten, und danach zurücksetzen. Ein Befund aus einem Screenshot gilt erst als «sicher», wenn er live reproduziert ist.
- Messen statt schätzen, wo es geht: Kontrast per berechnetem Verhältnis, Zielgrössen per Bounding-Box, Fokus per `:focus-visible` und Outline, horizontales Scrollen per `scrollWidth`.
- **5-Sekunden-Scan** zuerst: Worum geht es? Was ist die Hauptaktion? Wo klicke ich zuerst? Was verwirrt?
- Nur Beobachtetes melden. Was nicht prüfbar war (kein Login, kein Zustand erreichbar), unter «Nicht geprüft» auflisten.

**Zugang zur laufenden App** – der Reihe nach versuchen, beim ersten Erfolg aufhören:

1. Läuft schon eine Vorschau oder ein Browser-Tab mit der Seite, diesen nutzen (der User ist dort oft angemeldet).
2. Projektanweisungen nach einem dokumentierten Testweg durchsuchen: Startbefehl des Dev-Servers, Testkonto, Seed, Anleitung zum Anlegen eines lokalen Users, Staging-Zugang. Nur Testkonten und Testdaten verwenden, die das Projekt selbst nennt; nie echte Zugangsdaten eintippen.
3. Ist der Weg dokumentiert, aber aufwendig (Datenbank hochfahren, Konto und Testdaten anlegen), vorher kurz fragen, ob sich der Aufwand lohnt – mit Schätzung.
4. Sonst mit dem arbeiten, was vorliegt (Screenshot, Code), und im Bericht oben ausweisen: **«Geprüft an: Screenshot + Code, nicht live»**. Befunde, die nur live sicher wären (Fokus, Tastatur, Zustände, Kontrast, Reflow), unter «Nicht geprüft» aufführen statt zu vermuten.

Bei Screenshot und Code ergänzen sich beide: Das Bild zeigt, was gerendert wird; der Code erklärt warum und gibt die Fundstelle. Widersprechen sie sich (Kommentar sagt X, Bild zeigt Y), ist das ein eigener Befund mit Konfidenz «zu prüfen».

### 4. Bewerten

Fünf Linsen, in dieser Reihenfolge. Jede Beobachtung einer Linse und einer **benannten Regel** zuordnen.

**A. Treue zum Bestand** (Gewicht je nach Bestandsprofil)
- Hartkodierte Werte statt Token (Farbe, Abstand, Schrift, Radius).
- Eigenbau statt vorhandener Komponente; Variante/Zustand fehlt gegenüber dem Kit.
- Muster weicht von vergleichbaren Seiten ab (gleiche Aufgabe, andere Lösung).
- Abweichende Begriffe, Anrede oder Schreibweisen.
- Neues Muster ohne Begründung und ohne Aufnahme in den Styleguide.

**B. Usability-Heuristiken** (Nielsen, 0–4 je Verstoss)
Sichtbarkeit des Systemstatus · Passung zur Realität · Kontrolle und Freiheit · Konsistenz und Standards · Fehlervermeidung · Erkennen statt Erinnern · Flexibilität und Effizienz · Minimalismus · Fehler erkennen und beheben · Hilfe.

**C. Wahrnehmung und Entscheidung** (als Prüffragen mit Warnsignal)
- *Hierarchie:* Ist das Wichtigste am auffälligsten? Konkurrieren mehrere Fixpunkte?
- *Nähe/Ähnlichkeit/Gruppierung:* Liegt Zusammengehöriges zusammen, sieht Gleiches gleich aus?
- *Hick/Miller:* Zu viele gleichrangige Optionen ohne Gruppierung oder Filter?
- *Fitts:* Zielflächen gross und nah genug (mind. 44×44 px bei Touch)?
- *Jakob:* Folgt das Muster bekannten Konventionen? Abweichung braucht Begründung.
- *Tesler/Postel:* Muss die Person arbeiten, die das System übernehmen könnte? Ist Eingabe nachsichtig?
- *Doherty:* Rückmeldung innerhalb ~400 ms?

**D. Accessibility** (WCAG 2.2 AA als Untergrenze)
Kontrast (Text 4.5:1, UI 3:1), sichtbarer Fokus, Tastaturbedienung, Reihenfolge, Labels statt nur Placeholder, Fehlertexte programmatisch verknüpft, Farbe nie alleiniger Träger, Zielgrössen, Reduzierte Bewegung, Zoom/Reflow.

**E. Inhalt und Text**
Verständlich, handlungsorientierte Beschriftungen («Training speichern» statt «OK»), Fehlermeldungen mit Ursache und Lösung, Leerzustände mit nächstem Schritt, Tonfall konsistent, inklusive Sprache gemäss Projektvorgabe.

**Zurückhaltung:** Keine Kosmetik-Kritik an frühen Entwürfen. Keine Findings ohne Auswirkung auf Aufgabe, Lesbarkeit oder Konsistenz. Geschmack («wirkt altbacken») gehört nicht in den Bericht, ausser als Auswirkung formuliert («Hierarchie flach, Hauptaktion nicht erkennbar»).

### 5. Findings formulieren

Je Finding vier Teile, damit es prüfbar und umsetzbar ist:

- **Beleg:** Ort und Beobachtung, präzise (Element, Route/Datei, Zustand, ggf. gemessener Wert).
- **Regel:** Benannte Heuristik/Gesetz/WCAG-Kriterium oder Bestandsregel (Token, Komponente, Vergleichsseite).
- **Auswirkung:** Was passiert für wen?
- **Empfehlung:** Konkrete Änderung, bevorzugt mit vorhandenem Token oder Kit-Baustein.

**Severity:**

| Stufe | Bedeutung |
|---|---|
| **S4 Blocker** | Verhindert Aufgabe, Datenverlust, schliesst Personen aus (z. B. nicht bedienbar per Tastatur). Vor Release. |
| **S3 Gross** | Erhebliche Verwirrung oder Abbruchrisiko. Hohe Priorität. |
| **S2 Klein** | Spürbare Reibung oder Inkonsistenz, Umgehung möglich. Nächste Iteration. |
| **S1 Politur** | Kaum Auswirkung. Backlog. |

Bei Unsicherheit **Konfidenz** angeben (sicher / wahrscheinlich / zu prüfen). Eine Vermutung nie als Befund ausgeben.

**Art** jedes Findings angeben – sie bestimmt, wer handelt:

- **Fehler:** Die Umsetzung verfehlt ihr eigenes Ziel oder den Bestand (abgeschnittene Zeile, fehlender Fokus, Token ignoriert). Lässt sich ohne Rückfrage beheben.
- **Entscheid:** Die Umsetzung ist in sich stimmig, aber eine andere Wahl würde besser dienen (Reihenfolge der Bereiche, Begriff, was zuerst steht). Braucht die Person, die das Produkt verantwortet. Mit Optionen und deren Abwägung formulieren, nie als «falsch».
- **Bestandslücke:** Das System selbst schweigt oder widerspricht sich (zwei Muster für dasselbe). Behebung gehört in Styleguide oder Kit, nicht nur auf diese Seite.

Vor einem «Entscheid» prüfen, ob er schon getroffen wurde: Produktdoku, Specs, Issues, Code-Kommentare mit Begründung. Ist er dokumentiert, kein Finding daraus machen – höchstens als Frage, wenn neue Belege dagegen sprechen, mit Verweis auf die Quelle.

Ist die Doku dicht, steckt der Wert in den Nahtstellen: Zwei Entscheide, die einzeln dokumentiert sind, aber dieselbe Aufgabe verschieden lösen (zwei Zurück-Muster, zwei Kartenvarianten mit anderer Typografie), sind eine **Bestandslücke**, auch wenn jeder für sich «richtig» ist.

**Zwei Durchgänge trennen:** Zuerst alle Probleme erkennen, erst dann Empfehlungen formulieren. Das verhindert vorschnelle Lösungen und doppelte Findings.

### 6. Bericht

Der Bericht ist die Antwort, kurz und nach Gewicht geordnet:

1. **Kontext:** Ziel, Profil, Annahmen, Prüfgrundlage («live» oder «Screenshot + Code, nicht live») (2–4 Zeilen).
2. **Bestandsprofil:** Was gefunden wurde, wie stark (stark/implizit/keins), Quellen.
3. **Gesamteindruck:** 2–3 Sätze, wichtigste Stärke und wichtigstes Problem.
4. **Findings**, absteigend nach Severity, je mit Art · Beleg · Regel · Auswirkung · Empfehlung. Gleichartige Funde bündeln statt wiederholen.
5. **Prioritätstabelle:** `#`, Severity, Art, Linse, Finding, Fix, Aufwand (klein/mittel/gross).
6. **Schnelle Gewinne:** 3–5 Punkte mit hoher Wirkung, kleinem Aufwand.
7. **Beizubehalten:** 1–5 Dinge, die gut sind und nicht angefasst werden sollen (auch gute Bestandstreue).
8. **Nicht geprüft:** Zustände, Geräte, Rollen, die nicht erreicht wurden.

Tiefe passt sich der Anfrage an: «Gedanken dazu?» → Kurzfassung mit den fünf wichtigsten Findings; förmliches Audit → voller Bericht.

Am Ende genau eine Anschlussfrage: Welche Fehler sollen behoben werden (Nummern), und wie fallen die offenen Entscheide aus?

## Verboten

- Bewerten, bevor der Bestand erfasst ist.
- Regeln, Tokens oder Komponenten erfinden oder dem Projekt zuschreiben.
- Findings ohne Beleg oder ohne benannte Regel.
- Geschmacksurteile ohne Auswirkung.
- Still Code ändern oder «korrigieren». Bei Widerspruch zwischen Bestand und Prinzip entscheidet die Person.
- Prüfergebnis behaupten, das nicht beobachtet wurde.
- Einen Entscheid als Fehler ausgeben, oder einen dokumentierten Entscheid erneut als Finding melden.
- Echte Zugangsdaten eingeben, um an die laufende App zu kommen.
