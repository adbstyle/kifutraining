# Story: Einordnungsangaben unter den Ablauf stellen

Erfasst 2026-08-31. Ebene: User Story (Business).

Auslöser ist eine Beobachtung des Product Owners an der Übungsseite auf Staging: Übungstyp
und Erscheinungsform stehen dort zwischen Bild und Übungsablauf und damit vor dem, weswegen
der Trainer die Seite überhaupt öffnet. Beide Angaben dienen dem Einordnen und Filtern; wer
eine Übung im Detail liest, will wissen, was gemacht wird und wie sie funktioniert.

Bewusst nicht mitgezogen wird die Hauptteilkategorie, obwohl sie fachlich ebenfalls reine
Klassifikation ist und keinen Bezug zum Feldaufbau hat. Der Product Owner entscheidet am
2026-08-31, nur die beiden genannten Angaben zu verschieben; die Einordnung steht danach an
zwei Stellen der Seite. Ebenso überstimmt ist der Einwand, die Erscheinungsform sei als
Trainingsziel («Das Spiel kreativ gestalten», «Ballorientiert, kompakt und
situationsangepasst verteidigen») eine Coaching-Angabe und gehöre darum nach oben: Die
Übungsseite dient der Vorbereitung, nicht dem Spickzettel auf dem Platz.

---

Einordnungsangaben unter den Ablauf stellen

Als Trainer
möchte ich auf der Übungsseite zuerst lesen, was gemacht wird und wie die Übung funktioniert
damit ich beim Vorbereiten und auf dem Platz nicht zuerst an Angaben vorbeimuss, die der Einordnung dienen

Preconditions
1. Der USER zeigt eine Übung an, entweder in der Bibliothek oder als Teil eines Trainings

Acceptance Criteria
1. Der USER liest den Übungsablauf und die Varianten, bevor er auf Übungstyp und Erscheinungsform trifft
2. Der USER findet Übungstyp und Erscheinungsform beisammen an einer Stelle
3. Der USER findet Übungstyp und Erscheinungsform auf dem Ausdruck einer Übung an derselben Stelle wie am Bildschirm
4. Der USER liest beim Durchführen eines Trainings den Übungsablauf einer Übung, bevor er auf deren Übungstyp trifft
5. Der USER findet den Übungstyp auf dem Trainings-Ausdruck an derselben Stelle wie beim Durchführen

Postconditions
1. Das SYSTEM gibt Übungstyp und Erscheinungsform unterhalb der Varianten aus WENN die Übung Varianten führt
2. Das SYSTEM gibt Übungstyp und Erscheinungsform unterhalb des Übungsablaufs aus WENN die Übung keine Varianten führt
3. Das SYSTEM gibt den Übungstyp einer Übung im Training unterhalb von deren Übungsablauf aus
4. Das SYSTEM lässt eine der beiden Angaben weg WENN die Übung dazu nichts erfasst hat
5. Das SYSTEM gibt an der neuen Stelle nichts aus WENN die Übung weder einen Übungstyp noch eine Erscheinungsform trägt

Out of Scope
1. Anzahl Kinder und Material behalten ihren Platz oberhalb des Übungsablaufs, weil der Trainer sie für den Aufbau braucht
2. Feldtyp, Spielfeldgrösse und Hauptteilkategorie behalten ihren heutigen Platz
3. Die Alterskategorien behalten ihren heutigen Platz am Kopf der Übungsseite
4. Die Erfassungs- und Bearbeitungsmaske behält ihre Feldreihenfolge
5. Filter und Suche im Übungspool bleiben unverändert
6. Die Übungskarte im Übungspool zeigt weiterhin weder Übungstyp noch Erscheinungsform
7. Die Erscheinungsform bleibt in den Trainings-Ansichten weiterhin unsichtbar

Non-Functional Requirements
1. Ein Ausdruck belegt nach der Umstellung nicht mehr Blätter als vorher, weder bei einer einzelnen Übung noch bei einem Training

Offene Fragen
Keine. Alle in der Analyse und in der Validierung aufgeworfenen Fragen sind vom Product
Owner am 2026-08-31 beantwortet.
