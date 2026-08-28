# Story: Einzelne Übung drucken

Erfasst 2026-08-28. Ebene: User Story (Business).

Status: UMGESETZT 2026-08-28 — in Produktion seit dem Release #117.

Abweichung von einem früheren Entscheid: Am 2026-08-23 wurde festgelegt, dass Druck- und
Durchführen-Ansicht eines Trainings keine Herkunftsangabe tragen, weil der Druck
ausschliesslich enthalten soll, was für die Durchführung nötig ist. Für den Druck einer
einzelnen Übung entscheidet der Product Owner am 2026-08-28 anders: Ein Blatt, das eine
einzelne Übung aus der Bibliothek heraus trägt, weist deren Herkunft aus. Der Entscheid von
2026-08-23 bleibt für den Trainings-Druck unverändert gültig.

---

Einzelne Übung drucken

Als Trainer
möchte ich eine einzelne Übung aus der Übungsbibliothek ausdrucken
damit ich sie aufs Feld mitnehmen kann, ohne dafür ein ganzes Training anzulegen

Preconditions
1. Der USER zeigt eine Übung der Bibliothek im Detail an

Acceptance Criteria
1. Der USER kann eine einzelne Übung aus der Bibliothek drucken
2. Der USER kann jede Übung drucken, die er ansehen darf
3. Der USER kann eine Übung drucken, ohne angemeldet zu sein
4. Der USER erkennt auf dem Ausdruck Name, Trainingsteil, Alterskategorien, Erscheinungsform, Feldtyp, Anzahl Kinder, Material, Ablauf und Varianten der Übung
5. Der USER erkennt bei einer Übung des Hauptteils zusätzlich deren Hauptteilkategorie
6. Der USER erkennt auf dem Ausdruck das Bild oder das Diagramm der Übung
7. Der USER erkennt auf dem Ausdruck, ob die Übung aus dem Manual Kinderfussball des Schweizerischen Fussballverbands stammt oder von einem Trainer der Gemeinschaft

Postconditions
1. Das SYSTEM gibt die Übung als druckfertige Seite aus WENN der USER den Druck auslöst
2. Das SYSTEM lässt eine Angabe auf dem Ausdruck weg WENN die Übung dazu nichts erfasst hat
3. Das SYSTEM gibt anstelle von Bild und Diagramm eine leere Feld-Skizze aus WENN die Übung weder ein Bild noch ein Diagramm trägt
4. Das SYSTEM gibt den Inhalt der Übung vollständig aus, auch wenn er mehr als eine Seite belegt
5. Das SYSTEM zeigt auf dem Ausdruck keine Bedienelemente der Anwendung

Out of Scope
1. Eine Übung innerhalb eines Trainings ist nicht einzeln druckbar, weder unverändert noch als angepasste Fassung
2. Der USER kann nicht mehrere Übungen in einem Vorgang drucken
3. Die Anwendung erzeugt keine PDF-Datei zum Herunterladen; das Sichern als PDF übernimmt der Druckdialog des Geräts
4. Der Ausdruck trägt keine Dauer, weil eine Übung in der Bibliothek keine Zeitangabe hat
5. Der Ausdruck nennt bei einer Übung der Gemeinschaft keinen Trainernamen, sondern weist nur die Herkunft als solche aus

Non-Functional Requirements
1. Der Ausdruck ist auf A4 ohne Hilfsmittel lesbar, und Diagramme bleiben bei jeder Vergrösserung scharf
2. Der Ausdruck erscheint unabhängig vom eingestellten Bildschirm-Thema auf hellem Grund mit dunkler Schrift
3. Der Druck lässt sich auf Desktop und auf mobilen Geräten mit den Bordmitteln des jeweiligen Geräts auslösen

Offene Fragen
Keine. Alle in der Analyse und in der Validierung aufgeworfenen Fragen sind vom Product
Owner am 2026-08-28 beantwortet.
