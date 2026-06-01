# Übungspool — Epic: Kinderfussball-Übungsplattform

**Datum:** 2026-05-31
**Ebene:** Epic (Business) — mehrere Workflows und Rollen, mehrere Sprints
**Status:** Anforderungen abgestimmt (Discovery + perspektivenbasiertes Review durchlaufen)

## 1. Problem & Wert

Heute liegt der offizielle Kinderfussball-Übungsbestand als Manual (PDF/Print) vor. Im
Trainingsalltag ist er schlecht durchsuchbar — Trainer finden eine zum aktuellen
Trainingsteil und zur Gruppe passende Übung nicht schnell genug. Gleichzeitig fehlt
ihnen ein Ort, um eigene Übungen strukturiert neben dem Manual-Bestand zu sammeln und
wiederzufinden.

Die Plattform löst beides: Sie macht den Übungsbestand filterbar und erlaubt Trainern,
eigene Übungen gleichwertig zu erfassen und zu verwalten. Das öffentliche Teilen
eigener Übungen ist ein erwünschter, aber sekundärer Nebeneffekt.

## 2. Stakeholder & Personas

- **Anonymer Besucher** — schaut Übungen an und filtert, ohne Konto. Will schnell eine zum Trainingsteil und zur Gruppengrösse passende Übung finden.
- **Angemeldeter Trainer** — erstellt, bearbeitet und verwaltet eigene Übungen; steuert deren Sichtbarkeit. Will eine eigene, durchsuchbare Übungssammlung neben dem offiziellen Manual-Bestand.
- **Plattform-Betreiber** — pflegt den offiziellen Manual-Bestand (kuratiert, schreibgeschützt) als Qualitätsfundament.

## 3. Epic-Beschreibung

Als Trainer im Kinderfussball
will ich eine Plattform, auf der alle Übungen öffentlich durchsuch- und filterbar sind und auf der ich mit einem Konto eigene Übungen erstellen, bearbeiten und in ihrer Sichtbarkeit steuern kann,
damit ich im Training schnell eine passende Übung finde und meine eigene Übungssammlung neben dem offiziellen Manual-Bestand pflegen kann.

## 4. Erfolgskriterien (outcome-orientiert)

1. Übungen sind ohne Konto öffentlich durchsuchbar und nach Trainingsteil, Alterskategorie, Feldtyp, benötigter Spieleranzahl sowie über eine Freitextsuche filterbar.
2. Die Filterdimensionen Erscheinungsform und Thema stehen für Hauptteil- und Einleitungs-Übungen zur Verfügung und werden bei den übrigen Trainingsteilen nicht angeboten.
3. Der Alterskategorie-Filter erlaubt die Auswahl mehrerer Stufen und zeigt alle Übungen, die mindestens eine der gewählten Stufen abdecken.
4. Der Spieleranzahl-Filter bezieht sich auf die insgesamt für eine Übung benötigte Anzahl Kinder, sodass ein Trainer nach seiner verfügbaren Gruppengrösse einschränken kann.
5. Die offiziellen Manual-Übungen sind als kuratierter, schreibgeschützter Bestand erkennbar und von Nutzer-Übungen unterscheidbar.
6. Ein Konto ist Voraussetzung, um Übungen zu erstellen oder zu bearbeiten; das Ansehen und Filtern bleibt ohne Konto möglich.
7. Ein angemeldeter Trainer kann eigene Übungen mit demselben Feldsatz wie Manual-Übungen erfassen, sodass sie gleichwertig filterbar sind; Erscheinungsform und Thema werden nur bei den Trainingsteilen Hauptteil und Einleitung erfasst.
8. Eine neu erstellte Übung ist standardmässig privat (Entwurf), und der Ersteller kann sie jederzeit öffentlich schalten und die Sichtbarkeit zwischen öffentlich und privat umschalten.
9. Ein Trainer kann ausschliesslich seine eigenen Übungen bearbeiten und löschen; fremde und Manual-Übungen sind für ihn schreibgeschützt.
10. Das Löschen einer Übung und das Löschen des Kontos erfordern jeweils eine ausdrückliche Bestätigung des Nutzers.
11. Bei Konto-Löschung bleiben die öffentlichen Übungen des Nutzers anonymisiert und unveränderlich erhalten, während private Übungen gelöscht werden.
12. Die Detailansicht einer Hauptteil- oder Einleitungs-Übung mit Themenzuordnung zeigt die zugehörigen Themen-Informationen (Ziele, Metaphern, Fragen an die Kinder).

## 5. Story-Skelett (SPIDR-Zerlegung, vertikal)

Jede Story liefert End-to-End-Wert. Reihenfolge ist grob abhängigkeitssortiert.

1. **Enabler — Datenmodell für Mehrbenutzerbetrieb & Seed:** Das Datenmodell trägt Eigentümerschaft, Herkunft (Manual vs. Nutzer), Sichtbarkeit und Zeitstempel; die bestehenden Manual-Übungen sind als kuratierter, schreibgeschützter Bestand übernommen.
2. **Business — Übungskatalog öffentlich durchsuchen & filtern:** Anonyme Besucher sehen alle öffentlichen Übungen in einer Übersicht und grenzen sie über die Filterdimensionen und eine Freitextsuche ein, wobei Erscheinungsform und Thema nur im Kontext von Hauptteil- und Einleitungs-Übungen greifen.
3. **Business — Übungs-Detailansicht:** Besucher sehen alle Felder einer Übung inklusive Feld-Diagramm und – bei Hauptteil- und Einleitungs-Übungen mit Themenzuordnung – der zugehörigen Themen-Informationen.
4. **Enabler/Business — Authentifizierung:** Ein Trainer kann sich ein Konto anlegen, an- und abmelden; geschützte Aktionen sind nur angemeldet möglich.
5. **Business — Eigene Übung erstellen:** Ein angemeldeter Trainer erfasst eine neue Übung mit dem vollen Feldsatz und optionalem Feld-Diagramm-Upload; Erscheinungsform und Thema erscheinen nur bei den Trainingsteilen Hauptteil und Einleitung. Die Übung ist standardmässig privat (Entwurf).
6. **Business — Eigene Übung bearbeiten, Sichtbarkeit steuern & löschen:** Ein Trainer ändert oder entfernt seine eigenen Übungen und schaltet ihre Sichtbarkeit jederzeit um; das Löschen erfordert eine Bestätigung.
7. **Business — Eigene Übungen verwalten:** Ein Trainer sieht eine Übersicht ausschliesslich seiner eigenen Übungen (öffentlich wie privat) und ihren Sichtbarkeitsstatus.
8. **Business — Konto löschen:** Ein Trainer löscht sein Konto nach Bestätigung; öffentliche Übungen bleiben anonymisiert und unveränderlich erhalten, private werden entfernt.

Hinweis Datenabhängigkeit (siehe Preconditions/Offene Fragen): Story 2 liefert erst mit korrigierten Alterskategorie-Daten einen voll funktionsfähigen Kategorie-Filter.

## 6. Preconditions

1. Die strukturierte Übungs-Datenbank (Übungen, Themen-Metadaten, Feld-Diagramme, kontrolliertes Filter-Vokabular) ist als Datengrundlage vorhanden.
2. Für einen aussagekräftigen Alterskategorie-Filter liegen korrigierte Kategorie-Daten vor, die je Übung nur die tatsächlich gültigen Alterskategorien enthalten (nicht alle drei pauschal).

## 7. Non-Functional Requirements

1. Die Plattform ist auf eine Grössenordnung im niedrigen vierstelligen Übungsbestand und einige Dutzend gleichzeitige Nutzer ausgelegt; Filterung und Suche liefern in diesem Rahmen Ergebnisse in unter einer Sekunde.
2. Die öffentliche Ansicht ist ohne Konto vollständig nutzbar und für Suchmaschinen erschliessbar.
3. Schreibende Aktionen sind ausschliesslich für authentifizierte Nutzer möglich und serverseitig gegen Zugriff auf fremde Übungen abgesichert.
4. Die Plattform ist primär für die Nutzung in der Schweiz gedacht; die Oberfläche und Inhalte sind auf Deutsch.
5. Feld-Diagramme werden in einer für Übersicht und Detail angemessenen Qualität und Ladezeit ausgeliefert; Übungen ohne Diagramm werden mit einer Ersatzdarstellung gezeigt.
6. Die Oberfläche ist auf mobilen Geräten und am Desktop bedienbar, da Trainer Übungen auch am Spielfeldrand abrufen.

## 8. Out of Scope

1. Das Zusammenstellen mehrerer Übungen zu einem Trainingsplan oder einer Session ist nicht Teil dieses Epics.
2. Ein Werkzeug zum Zeichnen eigener Feld-Diagramme in der Anwendung ist nicht enthalten; bei eigenen Übungen ist nur ein optionaler Bild-Upload vorgesehen.
3. Das Erstellen eigener Themen mit Zielen, Metaphern und Fragen ist nicht enthalten; Nutzer können ihre Hauptteil- oder Einleitungs-Übung nur einem der bestehenden Themen zuordnen.
4. Eine Moderation oder Freigabe von Nutzer-Übungen vor der Veröffentlichung findet nicht statt; jeder angemeldete Nutzer kann öffentlich sichtbare Inhalte publizieren.
5. Eine Vereins- oder Rollenverwaltung über das Eigentümer-Modell hinaus ist nicht enthalten.
6. Eine mehrsprachige Oberfläche (FR/IT/EN) ist nicht enthalten.

## 9. Offene Fragen

1. @Product Owner: Die extrahierten Alterskategorie-Daten enthalten aktuell für jede Übung alle drei Kategorien, obwohl im Manual nur die kontrastreich dargestellten gelten. Wie sollen die korrekten Kategorien je Übung gewonnen werden (erneute Extraktion aus den Diagrammen, manuelle Nacherfassung), und ist das eine Voraussetzung für das Filter-Release?
2. @Architect: Welche Identifikator-Strategie gilt für Nutzer-Übungen, da das bisherige sprechende Slug-Schema bei mehreren Nutzern kollidieren kann?
3. @Architect: Wie werden Herkunft (Manual vs. Nutzer), Eigentümerschaft und die Anonymisierung bei Konto-Löschung gemeinsam im Datenmodell abgebildet, da das bisherige Pflicht-Quellenfeld (Datei + Seite) für Nutzer-Übungen nicht passt?
4. @Architect: Welche Rahmenbedingungen gelten für den Bild-Upload (maximale Dateigrösse, erlaubte Formate) und wie werden verwaiste Bild-Dateien bei Lösch- und Anonymisierungsvorgängen behandelt?
5. @UX Designer: Wie wird der kuratierte Manual-Bestand visuell von Nutzer-Übungen unterschieden, ohne die gemeinsame Durchsuchbarkeit zu beeinträchtigen?
6. @UX Designer: Wie sehen der Login-/Registrierungs-Flow, die Rückmeldung nach schreibenden Aktionen und die Darstellung leerer Filterergebnisse bzw. einer noch leeren eigenen Übungssammlung aus?
7. @UX Designer: Soll die Übungssuche einer Kontext-Hierarchie folgen (zuerst Trainingsteil wählen, dann nach Thema/Erscheinungsform/Kategorie verfeinern), die der Trainingsplanungs-Logik entspricht?
8. @Product Owner: Sollen private Übungen eines Nutzers in seiner eigenen Filter-/Suchansicht mitberücksichtigt werden, während sie in der öffentlichen Ansicht ausgeblendet bleiben?

## 10. Mögliche Lösungsansätze (Kontext, keine Empfehlung)

1. Architektur-Entscheid bereits getroffen: Next.js + Supabase (Postgres/Auth/Storage) auf Vercel; öffentliche Leserechte, Login für schreibende Aktionen; Manual-Übungen ohne Eigentümer und schreibgeschützt; Seed der Manual-Daten aus den versionierten Dateien. Siehe `2026-05-31-kifu-architektur-mvp.md`.
