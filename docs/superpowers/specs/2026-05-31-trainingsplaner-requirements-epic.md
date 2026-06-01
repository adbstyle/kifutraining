# Epic: Trainingsplaner — strukturierte Trainingspläne zusammenstellen

**Datum:** 2026-05-31
**Ebene:** Epic (Business) — mehrere Workflows und Rollen, mehrere Sprints
**Status:** Anforderungen abgestimmt (Discovery + perspektivenbasiertes Review durchlaufen)

## 1. Problem & Wert

Heute kann ein Trainer einzelne Übungen finden und filtern, muss aber sein konkretes
Training (Auffangen, Einleitung, Hauptteil, Ausklang) im Kopf oder auf Papier
zusammenstellen. Es fehlt ein Ort, an dem er passende Übungen zu einem vollständigen,
nach den Trainingsteilen gegliederten Trainingsplan zusammenfügt, die Dauer im Blick
behält und den Plan am Spielfeldrand abruft.

Die Plattform löst das: Der Trainer stellt aus dem vorhandenen Übungsbestand einen
strukturierten Trainingsplan zusammen, plant die Dauer, ruft ihn mobil ab oder druckt
ihn und teilt ihn bei Bedarf öffentlich. Das Trainingsplan-Feature setzt auf der
bestehenden Übungs-Verwaltungsplattform auf und war dort bewusst ausgeklammert.

## 2. Stakeholder & Personas

- **Angemeldeter Trainer** — stellt Trainingspläne aus dem Übungsbestand zusammen, plant die Dauer, verwaltet seine Pläne und nutzt sie im Training. Will schnell ein vollständiges, gegliedertes Training planen und am Feld abrufen.
- **Anonymer Besucher** — entdeckt und sieht öffentlich geteilte Trainingspläne, ohne Konto. Will fertige Trainings als Inspiration finden und ansehen.
- **Plattform-Betreiber** — verantwortet, dass das Teilen von Plänen mit dem Sichtbarkeitsmodell der Übungen konsistent bleibt.

## 3. Epic-Beschreibung

Als Trainer im Kinderfussball
will ich aus dem vorhandenen Übungsbestand einen nach den vier Trainingsteilen gegliederten Trainingsplan zusammenstellen, die Dauer planen, ihn verwalten und im Training abrufen,
damit ich ein vollständiges Training vorbereiten und am Spielfeldrand strukturiert durchführen kann.

## 4. Erfolgskriterien (outcome-orientiert)

1. Ein angemeldeter Trainer kann mehrere Übungen zu einem benannten Trainingsplan zusammenstellen, der nach den vier Trainingsteilen Auffangen, Einleitung, Hauptteil und Ausklang in fester, unveränderlicher Reihenfolge gegliedert ist.
2. Pro Phase ist die Zuordnung einer oder mehrerer Übungen möglich, und für eine Phase stehen ausschliesslich Übungen des zur Phase passenden Trainingsteils zur Auswahl.
3. Für die Zusammenstellung stehen alle für den Trainer sichtbaren Übungen zur Verfügung: Manual-Übungen, eigene öffentliche und private sowie fremde öffentliche Übungen.
4. Bei der Übungsauswahl im Hauptteil kann der Trainer nach Erscheinungsform einschränken, sodass er thematisch zusammenpassende Übungen mit einem roten Faden findet.
5. Ein Trainingsplan kann optional einer Alterskategorie zugeordnet werden; ordnet der Trainer eine Übung zu, die diese Stufe nicht abdeckt, wird er darauf hingewiesen, kann die Übung aber trotzdem aufnehmen.
6. Je Übung im Plan ist eine Dauer erfassbar, und die Dauer je Phase sowie die Gesamtdauer des Plans sind ersichtlich.
7. Die Anzahl Übungen pro Phase ist nicht hart begrenzt; bei einer ungewöhnlich hohen Anzahl erhält der Trainer einen Hinweis, wird aber nicht blockiert.
8. Ein Trainingsplan ist standardmässig privat, und der Ersteller kann die Sichtbarkeit jederzeit zwischen privat und öffentlich umschalten.
9. Enthält ein Plan beim Öffentlich-Schalten eigene private Übungen, entscheidet der Trainer mit einer pauschalen Rückfrage, ob alle diese Übungen mitveröffentlicht werden; lehnt er ab, bleibt der Plan privat.
10. Ein Trainer kann ausschliesslich seine eigenen Pläne bearbeiten und löschen; fremde Pläne sind für ihn schreibgeschützt.
11. Das Löschen eines Trainingsplans erfordert eine ausdrückliche Bestätigung des Trainers.
12. Ein Trainer sieht eine Übersicht ausschliesslich seiner eigenen Pläne (privat wie öffentlich) und deren Sichtbarkeitsstatus.
13. Ein öffentlich geschalteter Trainingsplan ist auch ohne Konto mit allen Phasen und zugeordneten Übungen einsehbar.
14. Öffentlich geschaltete Trainingspläne sind im öffentlichen Bereich auffindbar und durchsuchbar.
15. Ein Trainingsplan ist in einer für den Spielfeldrand geeigneten mobilen Durchführungsansicht Phase für Phase mit Übungsdetails und Feld-Diagrammen abrufbar.
16. Ein Trainingsplan ist als druckbares Dokument exportierbar, das die Phasen mit ihren Übungen, Dauern und Feld-Diagrammen enthält.

## 5. Story-Skelett (SPIDR-Zerlegung, vertikal)

Jede Story liefert End-to-End-Wert. Reihenfolge ist grob abhängigkeitssortiert.

1. **Enabler — Datenmodell für Trainingspläne:** Das Datenmodell trägt einen Plan mit Eigentümerschaft, Sichtbarkeit, Zeitstempeln, optionaler Alterskategorie, den vier geordneten Phasen, geordneten Verweisen auf Übungen je Phase und einer Dauer je zugeordneter Übung.
2. **Business — Trainingsplan erstellen & Übungen zuordnen:** Ein Trainer legt einen benannten Plan an und ordnet je Phase passende Übungen aus dem für ihn sichtbaren Bestand zu; pro Phase stehen nur Übungen des passenden Trainingsteils zur Auswahl, im Hauptteil zusätzlich nach Erscheinungsform einschränkbar. Optional wählt er eine Alterskategorie und wird bei abweichenden Übungen hingewiesen. Der Plan ist standardmässig privat.
3. **Business — Dauer planen & Summen sehen:** Ein Trainer erfasst je Übung eine Dauer; Dauer je Phase und Gesamtdauer des Plans sind jederzeit ersichtlich.
4. **Business — Trainingsplan bearbeiten, umsortieren & löschen:** Ein Trainer ändert die Zusammenstellung, sortiert Übungen innerhalb einer Phase um (die Reihenfolge der vier Phasen bleibt fix), entfernt Übungen oder löscht den ganzen Plan; das Löschen erfordert eine Bestätigung.
5. **Business — Eigene Pläne verwalten:** Ein Trainer sieht eine Übersicht ausschliesslich seiner eigenen Pläne mit ihrem Sichtbarkeitsstatus.
6. **Business — Sichtbarkeit steuern & teilen:** Ein Trainer schaltet einen Plan zwischen privat und öffentlich; enthält der Plan eigene private Übungen, entscheidet er mit einer pauschalen Rückfrage über deren Mitveröffentlichung.
7. **Business — Öffentlichen Plan ansehen:** Ein Besucher sieht einen öffentlich geschalteten Plan mit allen Phasen und Übungen, auch ohne Konto.
8. **Business — Öffentliche Pläne entdecken & durchsuchen:** Ein Besucher findet öffentlich geteilte Pläne über einen durchsuchbaren öffentlichen Bereich.
9. **Business — Mobile Durchführungsansicht:** Ein Trainer ruft den Plan am Spielfeldrand Phase für Phase mit Übungsdetails und Feld-Diagrammen ab.
10. **Business — Druck-/PDF-Export:** Ein Trainer exportiert den Plan als druckbares Dokument mit Phasen, Übungen, Dauern und Feld-Diagrammen zum Mitnehmen aufs Feld.

## 6. Preconditions

1. Die Übungs-Datenbank mit den vier Trainingsteilen, vollständigen Übungsdetails, Erscheinungsform-Zuordnung und Feld-Diagrammen ist als Datengrundlage verfügbar.
2. Die Authentifizierung sowie das Eigentümer- und Sichtbarkeitsmodell für Nutzerinhalte (öffentlich/privat, eigene Inhalte) sind im System vorhanden.

## 7. Non-Functional Requirements

1. Die mobile Durchführungsansicht ist am Spielfeldrand schnell aufrufbar und gut lesbar bedienbar, da der Trainer sie während des Trainings nutzt.
2. Pläne und ihre Übungszuordnungen laden und speichern für die vorgesehene Grössenordnung in unter einer Sekunde, und die Suche über öffentliche Pläne antwortet in unter einer Sekunde.
3. Schreibende Aktionen an Plänen sind ausschliesslich für authentifizierte Nutzer möglich und serverseitig gegen Zugriff auf fremde Pläne abgesichert.
4. Der Druck-/PDF-Export ist klar nach Phasen, Übungen und Dauer gegliedert und auf gängigen Papierformaten lesbar.
5. Oberfläche und Inhalte sind auf Deutsch; die Bedienung ist auf mobilen Geräten und am Desktop möglich.

## 8. Out of Scope

1. Das Erstellen oder Bearbeiten einzelner Übungen ist nicht Teil dieses Epics; ein Plan verweist auf bestehende Übungen, ändert deren Inhalt aber nicht.
2. Eine automatische Vorschlags- oder Generierungsfunktion für komplette Trainingspläne ist nicht enthalten; der Trainer stellt manuell zusammen.
3. Eine Kalender- oder Terminplanung, die Pläne konkreten Trainingsterminen zuordnet, ist nicht enthalten.
4. Ein gezieltes Teilen mit einzelnen Trainern oder Teams über die Stufen öffentlich und privat hinaus ist nicht enthalten.
5. Eine Offline-Nutzung der Pläne ohne aktive Verbindung ist nicht enthalten.

## 9. Offene Fragen

1. @Architect: Wo wird die Dauer je zugeordneter Übung im Datenmodell verankert, da dieselbe Übung in verschiedenen Plänen unterschiedliche Dauern haben kann und die Übung selbst kein Dauer-Feld besitzt?
2. @Architect: Wie wird ein öffentlicher Plan behandelt, wenn eine enthaltene fremde öffentliche Übung später vom Eigentümer auf privat gestellt oder gelöscht wird (Platzhalter anzeigen, Übung entfernen, Inhalts-Schnappschuss)?
3. @Architect: Welche Identifikator-Strategie gilt für Trainingspläne, damit sprechende und kollisionsfreie Verweise für geteilte Links möglich sind?
4. @Product Owner: Soll die Gesamtdauer perspektivisch über die reine Summenanzeige hinaus gegen eine Ziel-Trainingsdauer mit Phasen-Richtanteilen geprüft werden (Rückmeldung bei deutlicher Abweichung)?
5. @Product Owner: Werden eigene private Übungen in der Auswahlansicht des Planers mitgeführt? Diese Frage ist im Übungs-Epic noch offen und ist Voraussetzung dafür, dass private Übungen überhaupt in Pläne aufgenommen werden können.

## 10. Mögliche Lösungsansätze (Kontext, keine Empfehlung)

1. Der Architektur-Entscheid zur Plattform (Next.js + Supabase, öffentliches Lesen, Login für schreibende Aktionen, Eigentümer-/Sichtbarkeitsmodell) ist bereits getroffen und nennt den Trainingsplaner als mögliche spätere Phase. Siehe `2026-05-31-kifu-architektur-mvp.md` und `2026-05-31-uebungspool-epic.md`.
