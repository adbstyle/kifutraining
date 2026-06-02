# Trainingsplaner — User Stories

**Datum:** 2026-06-01
**Epic:** `2026-05-31-trainingsplaner-requirements-epic.md`
**Status:** In Ausarbeitung (Story für Story, je mit perspektivenbasiertem Review)

Diese Datei zerlegt das Trainingsplaner-Epic in umsetzbare Stories. Reihenfolge folgt
dem Story-Skelett des Epics (grob abhängigkeitssortiert).

## Querschnittliche Festlegungen

Diese Entscheidungen gelten für alle Stories dieses Epics:

1. Durchgängige Begriffswahl: Die vier Abschnitte eines Trainings heissen **Trainingsteil**
   (Auffangen, Einleitung, Hauptteil, Ausklang), konsistent mit dem kanonischen Vokabular.
   Der Begriff "Phase" wird vermieden.
2. Im Planer wählbare Übungen sind die für den Trainer sichtbaren Übungen: Manual-Übungen,
   eigene öffentliche und private sowie fremde öffentliche Übungen. Eigene private Übungen
   sind eingeschlossen.
3. Pläne werden über ihre technische Kennung referenziert; sprechende, lesbare Plan-Links
   sind nicht Teil des MVP.
4. Konto-Löschung: Öffentliche Pläne bleiben anonymisiert und unveränderlich erhalten,
   private Pläne werden gelöscht — symmetrisch zum Verhalten öffentlicher Übungen.

---

## Story 1 (Enabler) — Datenmodell für Trainingspläne

Als Entwicklungsteam
will ich ein Datenmodell, das einen Trainingsplan mit Eigentümerschaft, Sichtbarkeit, optionaler Alterskategorie, den vier geordneten Trainingsteilen, geordneten Verweisen auf Übungen je Trainingsteil und einer Dauer je zugeordneter Übung trägt,
damit die Business-Stories des Trainingsplaners auf einer konsistenten, abgesicherten Datengrundlage aufsetzen können.

**Preconditions**
1. Die Authentifizierung und die Nutzer-Identität sind im SYSTEM vorhanden, sodass ein Plan einem Eigentümer zugeordnet werden kann.
2. Die Übungs-Datenbank mit einer Trainingsteil-Zuordnung je Übung ist vorhanden, sodass Übungszuordnungen auf bestehende Übungen verweisen können.
3. Die Sichtbarkeitsregel für Übungen ist im SYSTEM vorhanden, sodass im Planer Manual-Übungen, eigene öffentliche und private sowie fremde öffentliche Übungen verfügbar sind.

**Acceptance Criteria**
1. Das SYSTEM speichert einen Trainingsplan mit Name, Eigentümer, Sichtbarkeit, optionaler Alterskategorie sowie Erstellungs- und Änderungszeitpunkt.
2. Das SYSTEM setzt die Sichtbarkeit eines neuen Plans standardmässig auf privat und lässt ausschliesslich die Werte privat und öffentlich zu.
3. Das SYSTEM lässt als Alterskategorie eines Plans höchstens eine einzelne Stufe aus G, F oder E zu.
4. Das SYSTEM ordnet jede Übung im Plan genau einem der vier Trainingsteile Auffangen, Einleitung, Hauptteil und Ausklang zu und hält deren Reihenfolge unveränderlich fix.
5. Das SYSTEM lässt eine Übung nur dann einem Trainingsteil im Plan zuordnen, wenn der Trainingsteil der Übung mit diesem übereinstimmt.
6. Das SYSTEM hält je Trainingsteil eine eindeutige Reihenfolge der zugeordneten Übungen fest.
7. Das SYSTEM erlaubt beliebig viele Übungen pro Trainingsteil ohne harte Obergrenze.
8. Das SYSTEM speichert je zugeordneter Übung eine optionale Dauer, die nicht negativ sein darf.
9. Das SYSTEM erfasst den Übungsnamen beim Hinzufügen einer Übung zum Plan.
10. Das SYSTEM behält eine Übungszuordnung im Plan, wenn die referenzierte Übung gelöscht oder für den Betrachter nicht mehr sichtbar ist, und greift dann auf den erfassten Übungsnamen als Platzhalter zurück.
11. Das SYSTEM löscht alle Übungszuordnungen eines Plans, wenn der Plan gelöscht wird.
12. Das SYSTEM gibt einen öffentlichen Plan samt seiner Übungszuordnungen auch ohne Anmeldung zum Lesen frei und einen privaten Plan ausschliesslich für seinen Eigentümer.
13. Das SYSTEM lässt schreibende Zugriffe auf einen Plan und seine Übungszuordnungen ausschliesslich durch dessen Eigentümer zu.

**Postconditions**
1. Das SYSTEM bewahrt die Struktur eines Plans vollständig, auch wenn eine referenzierte Übung gelöscht oder für den Betrachter nicht mehr sichtbar ist, weil Trainingsteil, Reihenfolge, Dauer und der zwischengespeicherte Übungsname der Zuordnung erhalten bleiben.
2. Das SYSTEM bewahrt die öffentlichen Pläne eines Kontos anonymisiert und unveränderlich auf und löscht dessen private Pläne, WENN das Konto gelöscht wird.

**Out of Scope**
1. Anpassungen am Datenmodell der Übungen selbst sind nicht Teil dieses Enablers; das Plan-Datenmodell verweist auf bestehende Übungen, ändert deren Struktur aber nicht.
2. Die Berechnung und Aggregation von Trainingsteil- und Gesamtdauer ist nicht Teil des Datenmodells; gespeichert wird nur die Dauer je einzelner Zuordnung.
3. Sprechende, lesbare Verweise auf Pläne sind nicht enthalten; ein Plan wird über seine technische Kennung referenziert.
4. Ein Schutz vor gleichzeitigem Bearbeiten desselben Plans durch dieselbe Person in mehreren Sitzungen (Versionskonflikt-Erkennung) ist nicht enthalten.

**Non-Functional Requirements**
1. Das Lesen eines Plans samt aller Übungszuordnungen über die vier Trainingsteile sowie das Speichern einer einzelnen Zuordnung antworten für die vorgesehene Grössenordnung in unter einer Sekunde.
2. Schreibende Zugriffe auf Pläne und Übungszuordnungen sind serverseitig durchgesetzt und nicht allein auf Anwendungsebene abgesichert.

**Mögliche Lösungsansätze** (Kontext, keine Empfehlung)
1. Das Plan-Datenmodell ist in den bestehenden Migrationen weitgehend angelegt (Tabellen für Plan und Übungszuordnung, RLS-Policies, Trainingsteil-Integritätsprüfung, Transaktions-RPCs). Diese Story dokumentiert die Anforderungen an das Modell und dient als Abnahmegrundlage. Offene Anpassung gegenüber dem aktuellen Stand: anonymisiertes Erhalten öffentlicher Pläne bei Konto-Löschung (heute Löschung via Kaskade).

---

## Story 2 (Business) — Trainingsplan erstellen & Übungen zuordnen

Als Trainer
will ich einen benannten Trainingsplan anlegen und ihm je Trainingsteil passende Übungen aus dem für mich sichtbaren Bestand zuordnen,
damit ich ein vollständiges, nach den Trainingsteilen gegliedertes Training zusammenstellen kann.

**Preconditions**
1. Das Plan-Datenmodell für Trainingspläne ist im SYSTEM vorhanden.
2. Die Übungs-Datenbank enthält Übungen mit Trainingsteil-Zuordnung, sodass je Trainingsteil passende Übungen ausgewählt werden können.
3. Übungen aller vier Trainingsteile können eine Erscheinungsform tragen, sodass die Auswahl in jedem Trainingsteil nach Erscheinungsform eingrenzbar ist.
4. Die Alterskategorie-Daten der Übungen sind differenziert erfasst und nicht pauschal alle Stufen, sodass der Abweichungs-Hinweis aussagekräftig ist.

**Acceptance Criteria**
1. Der USER kann einen neuen Trainingsplan anlegen.
2. Der USER muss beim Anlegen einen Namen vergeben.
3. Der USER kann dem Plan optional eine Alterskategorie zuordnen.
4. Der USER kann jedem der vier Trainingsteile eine oder mehrere Übungen zuordnen.
5. Der USER sieht zur Zuordnung in einem Trainingsteil ausschliesslich Übungen, deren Trainingsteil dem gewählten entspricht.
6. Der USER kann zur Zuordnung alle für ihn sichtbaren Übungen heranziehen: Manual-Übungen, eigene öffentliche und private sowie öffentliche Übungen anderer Trainer.
7. Der USER kann die zur Auswahl stehenden Übungen nach Erscheinungsform eingrenzen, soweit die Übungen eine Erscheinungsform tragen.
8. Der USER erhält einen Hinweis, wenn der Plan eine Alterskategorie trägt und er eine Übung zuordnet, deren Stufen diese Alterskategorie nicht enthalten, und kann die Übung trotzdem aufnehmen.
9. Der USER erhält einen Hinweis, wenn er einem Trainingsteil ungewöhnlich viele Übungen zuordnet, und wird nicht blockiert.
10. Der USER kann einen Plan anlegen und behalten, auch wenn einzelne oder alle Trainingsteile noch keine Übung enthalten.

**Postconditions**
1. Das SYSTEM speichert den neuen Plan als privat und weist ihn dem USER als Eigentümer zu, WENN der USER den Plan anlegt.
2. Das SYSTEM speichert jede Übungszuordnung im jeweiligen Trainingsteil unmittelbar, WENN der USER sie vornimmt.

**Out of Scope**
1. Das Erfassen einer Dauer je Übung sowie die Anzeige von Trainingsteil- und Gesamtdauer sind nicht Teil dieser Story.
2. Das Umsortieren von Übungen innerhalb eines Trainingsteils sowie das Bearbeiten und Löschen bestehender Pläne sind nicht Teil dieser Story.
3. Das Veröffentlichen oder Teilen des Plans ist nicht Teil dieser Story; ein neu angelegter Plan ist privat. Die Bedingung, dass ein öffentlicher Plan alle vier Trainingsteile belegt haben muss, wird beim Veröffentlichen geprüft, nicht beim Erstellen.
4. Anpassungen am Übungs-Datenmodell und an den Übungs-Daten (Erscheinungsform für alle Trainingsteile, Korrektur der Alterskategorien) sind nicht Teil dieser Story; sie werden in der Übungspool-Domäne umgesetzt.

**Non-Functional Requirements**
1. Die Übungsauswahl im Planer antwortet bei Eingrenzung nach Trainingsteil und Erscheinungsform für die vorgesehene Grössenordnung in unter einer Sekunde.
2. Das Anlegen eines Plans und das Zuordnen von Übungen sind auf mobilen Geräten und am Desktop bedienbar; Oberfläche und Inhalte sind auf Deutsch.

**Mögliche Lösungsansätze** (Kontext, keine Empfehlung)
1. Schwellenwerte für den Anzahl-Hinweis (Spec-Detail, trainingsteil-spezifisch, bewusst nicht im AK fixiert; Vorschlag, anpassbar): Auffangen, Einleitung und Ausklang ab mehr als 3 Übungen; Hauptteil ab mehr als 5 Übungen.
2. Der Erscheinungsform-Filter wirkt als reine Einschränkung der Auswahl (roter Faden), nicht als erzwungene Konsistenzregel über die zugeordneten Übungen.

---

## Story 3 (Business) — Dauer planen & Summen sehen

Als Trainer
will ich je zugeordneter Übung eine Dauer erfassen und die Dauer je Trainingsteil sowie die Gesamtdauer des Plans jederzeit sehen,
damit ich die Zeit meines Trainings im Blick behalte und realistisch plane.

**Preconditions**
1. Der USER bearbeitet einen eigenen Plan, dem bereits Übungen zugeordnet sind.

**Acceptance Criteria**
1. Der USER kann je zugeordneter Übung eine Dauer in 5-Minuten-Schritten erfassen.
2. Der USER kann eine erfasste Dauer ändern oder entfernen.
3. Der USER sieht beim Bearbeiten des Plans jederzeit die summierte Dauer je Trainingsteil.
4. Der USER sieht beim Bearbeiten des Plans jederzeit die Gesamtdauer des Plans über alle Trainingsteile.
5. Der USER erkennt, wie viele Übungen einer Summe keine erfasste Dauer haben.

**Postconditions**
1. Das SYSTEM speichert die erfasste oder geänderte Dauer unmittelbar bei der jeweiligen Übungszuordnung, WENN der USER sie eingibt, ändert oder entfernt.
2. Das SYSTEM bildet die Summe je Trainingsteil und die Gesamtdauer ausschliesslich aus den erfassten Dauern; Übungen ohne erfasste Dauer erhöhen die Summe nicht.

**Out of Scope**
1. Ein Abgleich der Dauer gegen eine Ziel-Trainingsdauer oder Richtanteile je Trainingsteil ist nicht enthalten; die Dauer wird nur als Summe angezeigt.
2. Das Umsortieren oder Entfernen von Übungen sowie das Löschen des Plans sind nicht Teil dieser Story.
3. Die Anzeige der Dauer in der mobilen Durchführungsansicht und im Druck-Export ist nicht Teil dieser Story.
4. Eine Plausibilitäts- oder Schwellenwertprüfung einzelner Dauerwerte ist nicht enthalten; die erfasste Dauer wird nicht bewertet.

**Non-Functional Requirements**
1. Die angezeigten Summen spiegeln eine erfasste oder geänderte Dauer ohne wahrnehmbare Verzögerung wider.
2. Die Dauererfassung und die Summenanzeige sind auf mobilen Geräten und am Desktop bedienbar; Inhalte sind auf Deutsch.

**Mögliche Lösungsansätze** (Kontext, keine Empfehlung)
1. Die Dauer wird je Übungszuordnung gespeichert, nicht an der Übung selbst, sodass dieselbe Übung in verschiedenen Plänen unterschiedliche Dauern tragen kann.
2. Die 5-Minuten-Schritte sind eine Eingabe-Granularität; das Datenmodell speichert die Dauer in Minuten.

---

## Story 4 (Business) — Trainingsplan bearbeiten, umsortieren & löschen

Als Trainer
will ich einen eigenen Trainingsplan nachträglich bearbeiten, die Übungen innerhalb eines Trainingsteils umsortieren und entfernen sowie den ganzen Plan löschen,
damit ich meine Planung aktuell halten und nicht mehr benötigte Pläne aufräumen kann.

**Preconditions**
1. Der USER ist Eigentümer des Plans, den er bearbeiten oder löschen will.

**Acceptance Criteria**
1. Der USER kann den Namen eines eigenen Plans ändern; ein leerer Name ist nicht zulässig.
2. Der USER kann die Alterskategorie eines eigenen Plans setzen, ändern oder entfernen.
3. Der USER erhält beim Setzen oder Ändern der Alterskategorie einen Hinweis, welche bereits zugeordneten Übungen die neue Stufe nicht abdecken, und kann diese Übungen im Plan behalten oder entfernen.
4. Der USER kann die Reihenfolge der Übungen innerhalb eines Trainingsteils nach eigenem Ermessen festlegen.
5. Der USER kann eine zugeordnete Übung aus einem Trainingsteil entfernen.
6. Der USER kann einen eigenen Plan vollständig löschen.
7. Der USER muss das Löschen des gesamten Plans ausdrücklich bestätigen.
8. Der USER kann ausschliesslich eigene Pläne bearbeiten und löschen; fremde Pläne sind für ihn schreibgeschützt.

**Postconditions**
1. Das SYSTEM speichert jede Änderung an Name, Alterskategorie, Reihenfolge und Zusammenstellung unmittelbar, WENN der USER sie vornimmt.
2. Das SYSTEM setzt einen öffentlichen Plan automatisch auf privat und weist den USER darauf hin, WENN der USER die letzte Übung eines Trainingsteils aus diesem Plan entfernt.
3. Das SYSTEM entfernt den Plan und alle seine Übungszuordnungen endgültig, WENN der USER das Löschen des Plans bestätigt.

**Out of Scope**
1. Das bewusste Umschalten der Sichtbarkeit zwischen privat und öffentlich ist nicht Teil dieser Story; das automatische Zurücksetzen auf privat bei Unvollständigkeit ist hier als Schutzregel enthalten.
2. Das Verschieben einer Übung von einem Trainingsteil in einen anderen ist nicht möglich, da eine Übung genau einem Trainingsteil angehört.
3. Das erstmalige Zusammenstellen und Hinzufügen von Übungen ist Bestandteil der Plan-Erstellung und wird hier nicht erneut beschrieben.
4. Konflikte bei gleichzeitigem Bearbeiten desselben Plans in mehreren Sitzungen sind nicht Teil dieser Story.
5. Das Verhalten beim Löschen einer Übung, die in einem Plan verwendet wird, ist nicht Teil dieser Story; es wird in der Übungspool-Domäne geregelt, sodass verwendete Übungen erhalten bleiben und Pläne inhaltlich intakt bleiben.

**Non-Functional Requirements**
1. Bearbeiten, Umsortieren und Löschen sind auf mobilen Geräten und am Desktop bedienbar; Inhalte sind auf Deutsch.
2. Schreibende Änderungen an einem Plan sind serverseitig gegen Zugriff durch andere als den Eigentümer abgesichert.
