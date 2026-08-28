# Epic: Übungen nach Altersstufe trennen

Stand 2026-08-28. Requirements-Dokumentation, keine Architektur- oder Lösungsspezifikation.

Dieses Epic revidiert mehrere Entscheide des Epics «Juniorenfussball-Trainingsschema»
(`2026-08-14-juniorenfussball-epic.md`), das auf Staging liegt und nie auf Produktion
ausgeliefert wurde. Die betroffenen Stellen sind in Abschnitt 8 benannt.

## 1. Problem und Wert

Seit der Juniorenfussball dazugekommen ist, führt der Übungs-Editor beide Altersstufen
gleichzeitig: sieben Trainingsteile beider Lehrmittel in einer Liste, sieben Alterskategorien nebeneinander,
siebzehn Erscheinungsformen flach untereinander, dazu ein Übungstyp aus dem
Junioren-Manual auch an Kinderfussball-Übungen. Wer eine Übung erfasst, entscheidet
bei jedem Feld neu, was für seine Altersstufe gilt — und sieht dauerhaft Werte, die für ihn
keine Bedeutung haben.

Die beiden Lehrmittel sind aber keine Varianten voneinander. Sie beschreiben
verschiedene Trainingsschemata, verschiedene Didaktik und verschiedene
Klassifikationen. Eine Oberfläche, die sie vermischt, verlangt vom Trainer, diese
Trennung im Kopf zu leisten, statt sie ihm abzunehmen.

Der Wert liegt in der Entlastung: Wer sich zu Beginn für eine Altersstufe entscheidet, sieht
danach nur noch, was in dieser Altersstufe gilt. Die Felder, die Auswahlmöglichkeiten und
die Pflichtangaben folgen dem gewählten Lehrmittel.

Zweiter Wert: Die Trennung macht die Zugehörigkeit einer Übung explizit, statt sie aus
ihrem Trainingsteil abzuleiten. Damit wird auch für den Trainer sichtbar, was das System
ohnehin unterscheidet.

## 1a. Begriffe

Die Applikation führt bisher zwei Wörter für dieselbe Sache: der Trainings-Editor sagt
«Stufen», das Übungs-Formular und der Katalog sagen «Alterskategorie». Mit der neuen
Ebene bekäme «Stufe» eine zweite Bedeutung. Darum gilt künftig durchgängig:

| Begriff | Bedeutung | Werte |
|---|---|---|
| Altersstufe | Welchem Lehrmittel eine Übung oder ein Training folgt | Kinder, Junior:innen |
| Alterskategorie | Die Feinunterteilung innerhalb einer Altersstufe | G, F, E (Kinder) — D, C, B, A (Junior:innen) |
| Trainingsteil | Wo eine Übung im Trainingsschema ihrer Altersstufe liegt | Kinder: Auffangen, Einleitung, Hauptteil (mit Unterkategorie), Ausklang — Junior:innen: Einstieg, Hauptteil, Abschluss (mit Unterblöcken) |

«Kategorie» ist der Begriff des SFV: Das Manual Fussball Kinder spricht von
«Beispieltraining Kategorie G» und den «Kinderfussballkategorien G, F, E und FF12»,
das Manual Fussball Jugendliche von «folgende Kategorien». Der Kunstbegriff «Heimat»
aus dem Spike entfällt: Er war nur nötig, solange beide Lehrmittel in einem Feld
zusammenkamen.

## 2. Stakeholder

| Rolle | Bezug zum Vorhaben |
|---|---|
| Trainer:in Kinderfussball (G, F, E) | Erfasst Übungen nach dem Manual Fussball Kinder. Soll die Junioren-Begriffe nicht mehr sehen. |
| Trainer:in Juniorenfussball (D bis A) | Erfasst Übungen nach dem Manual Fussball Jugendliche. Soll die Kinderfussball-Didaktik nicht mehr sehen. |
| Trainer:in mit beiden Mannschaften | Führt Übungen in beiden Altersstufen. Braucht dieselbe Übungsidee in beiden, muss sie je Altersstufe eigenständig führen — eine Übung tritt in genau einer auf. |
| Product Owner | Entscheidet über die Trennschärfe und den Umgang mit dem Übungsbestand. |

## 3. Fachlicher Ausgangspunkt

Heute leitet sich die Zugehörigkeit einer Übung aus ihrem Trainingsteil ab: Wer einen der
vier Kinderfussball-Trainingsteile wählt, ist im Kinderfussball; wer einen der drei
Einstiegs-Unterblöcke wählt, im Juniorenfussball. Die Attribute richten sich nicht
danach — Alterskategorien, Erscheinungsformen und Übungstyp stehen jeder Übung in
voller Breite offen.

Zwei Mechanismen des bestehenden Epics beruhen darauf, dass eine Übung beiden Altersstufen
dienen kann:

- Die abgenommene Abbildungsregel (`2026-08-15-junioren-abbildungsregel.md`) ordnet
  jede Kinderfussball-Übung einem Junioren-Block zu. Über sie sind heute 71 der 75
  Manual-Übungen in Junioren-Trainings verwendbar.
- Die Rückabbildung macht Übungen mit Junioren-Trainingsteil im Kinderfussball nutzbar.

Mit der Trennung entfällt beides als Verwendungs-Brücke. Der Juniorenfussball bezieht
seine Übungen ausschliesslich aus dem eigenen Bestand.

Attribute einer Übung, nach Zugehörigkeit geordnet (Ergebnis der Durchsicht mit dem
Product Owner):

| Attribut | Zugehörigkeit | Verhalten beim Stufenwechsel |
|---|---|---|
| Titel | stufenunabhängig | bleibt, gilt für beide Altersstufen gemeinsam |
| Bild oder Diagramm | stufenunabhängig | bleibt unverändert, samt Symbolik |
| Anzahl Kinder | stufenunabhängig | bleibt |
| Material | stufenunabhängig | bleibt |
| Varianten | stufenunabhängig | bleibt |
| Trainingsteil (mit Unterkategorie bzw. Unterblock) | stufenabhängig | wird in der Zielstufe neu gewählt |
| Hauptteilkategorie | stufenabhängig | nur Kinderfussball |
| Alterskategorien | stufenabhängig | nur die der jeweiligen Altersstufe |
| Erscheinungsformen | stufenabhängig | je Altersstufe das eigene Vokabular |
| Feldtyp | stufenabhängig | nur Kinderfussball |
| Übungstyp | stufenabhängig | nur Juniorenfussball |
| Ablaufbeschreibung | stufenabhängig, überführbar | Kinderfussball führt den methodischen Fahrplan, der Juniorenfussball eine Beschreibung |

Die Ablaufbeschreibung ist der einzige inhaltlich wertvolle Text, der beim Wechsel
sonst verloren ginge. Für sie greifen zwei Regeln in fester Rangfolge:

Hat die Übung die Zielstufe schon einmal bewohnt, kehrt sie zu dem Stand zurück, den
sie dort verlassen hat — samt Fahrplan mit allen drei Stufen. Betritt sie die Zielstufe
zum ersten Mal, wird überführt: vom Kinderfussball zum Juniorenfussball werden die drei
Fahrplan-Stufen zu einer Beschreibung zusammengeführt, in der Gegenrichtung wird die
Beschreibung zur Stufe «Offen starten», die beiden übrigen bleiben leer und sind
nachzutragen. Der Überführungs-Mechanismus existiert bereits für den Wechsel zwischen
Fahrplan und Aufbau-Text innerhalb des Kinderfussballs.

Dieselbe Rangfolge gilt für alle stufenabhängigen Attribute: Aufbewahrung schlägt
Überführung, Überführung schlägt Leeren.

## 4. Epic

Übungen nach Altersstufe trennen

Als Trainer:in
möchte ich zu Beginn entscheiden, ob ich eine Übung für den Kinderfussball oder für
den Juniorenfussball erfasse
damit ich danach nur noch die Felder und Auswahlmöglichkeiten dieses Lehrmittels vor
mir habe

### Preconditions

1. Beide Trainingsschemata sind im System abgebildet
2. Die Übungen des Juniorenfussball-Epics sind ausschliesslich auf Staging vorhanden;
   der Produktionsbestand kennt nur Kinderfussball-Übungen

### Erfolgskriterien

1. Jede Übung gehört zu genau einer Altersstufe, und diese Zugehörigkeit ist beim Erfassen
   und Bearbeiten erkennbar
2. Die Felder, Auswahlmöglichkeiten und Pflichtangaben einer Übung folgen ausschliesslich
   dem Lehrmittel ihrer Altersstufe; Begriffe der anderen Altersstufe erscheinen nicht
3. Eine Übung lässt sich von einer Altersstufe in die andere überführen, ohne dass ihre
   stufenunabhängigen Angaben verloren gehen
4. Die Angaben der verlassenen Altersstufe bleiben erhalten, sodass eine Rückkehr den vorherigen
   Zustand wiederherstellt
5. Ein Junioren-Training bezieht seine Übungen ausschliesslich aus dem
   Juniorenfussball-Bestand, ein Kinderfussball-Training ausschliesslich aus dem
   Kinderfussball-Bestand
6. Ein bestehendes Kinderfussball-Training überlebt den Wechsel ins Juniorenschema mit
   seinen Übungen; deren stufenabhängige Angaben werden nach denselben Regeln überführt
   wie bei einer einzelnen Übung
7. Der bestehende Übungsbestand bleibt unverändert nutzbar und gilt als Kinderfussball
8. Eine Übung wechselt ihre Altersstufe nur durch ihre Eigentümerin; der kuratierte
   Bestand und fremde Übungen bleiben davon unberührt

### Out of Scope

1. Die Applikation führt keinen kuratierten Übungsbestand für den Juniorenfussball ein
2. Die Applikation gleicht die aufbewahrten stufenabhängigen Angaben nicht mit den
   aktuellen ab; wer die Ablaufbeschreibung in einer Altersstufe überarbeitet, verändert
   den aufbewahrten Stand der anderen nicht. Die stufenunabhängigen Angaben sind davon
   nicht betroffen — sie gehören der Übung als Ganzes und kennen keine zwei Stände
3. Die Applikation führt für den Juniorenfussball keine eigene Diagramm-Symbolik ein
4. Die Applikation trennt die Altersstufen nicht im Übungskatalog und nicht in der Suche;
   die Trennung betrifft das Erfassen und Bearbeiten
5. Die Applikation ändert die Bedingungen für die Veröffentlichung eines Trainings nicht
6. Die Applikation kennt keine Übung, die in beiden Altersstufen gleichzeitig steht.
   Wer dieselbe Übungsidee in beiden braucht, führt sie zweimal

## 5. Story-Zerlegung nach SPIDR

Vertikal geschnitten, jede Story liefert für sich einen nachvollziehbaren Zustand.
Reihenfolge ist die vorgeschlagene Umsetzungsreihenfolge.

| # | Story | SPIDR | Typ | Hängt ab von |
|---|---|---|---|---|
| 1 | Zugehörigkeit einer Übung zu einer Altersstufe führen und aus dem Bestand ableiten | Data | Enabler | — |
| 2 | Übung in der gewählten Altersstufe erfassen, mit den Feldern dieses Lehrmittels | Rules | Business | 1 |
| 3 | Junioren-Übung zweistufig einem der sechs Blöcke zuordnen | Data | Business | 1 |
| 4 | Übung von einer Altersstufe in die andere überführen | Paths | Business | 2, 3 |
| 5 | Angaben der verlassenen Altersstufe aufbewahren und bei Rückkehr wiederherstellen | Rules | Business | 4 |
| 6 | Übungs-Picker auf die Altersstufe des Trainings beschränken | Rules | Business | 1 |
| 7 | Fassungen eines Trainings beim Schema-Wechsel überführen und aufbewahren | Rules | Business | 4, 5 |

Story 1 ist ein Enabler: Sie macht die Zugehörigkeit zu einer geführten Angabe, ohne
dass sich für den Trainer etwas ändert. Erst Story 2 macht den Nutzen sichtbar.

Story 3 ist nötig, weil mit der Trennung keine Kinderfussball-Übung mehr in die
Junioren-Blöcke fliesst: Spielformen, Spiel und Ausklang müssen aus eigenen Übungen
befüllbar werden. Die Zuordnung erfolgt in zwei Schritten — erst der Trainingsteil,
dann der Block darin —, wie es der Kinderfussball beim Hauptteil bereits vormacht.

## 6. Nicht-funktionale Anforderungen

1. Ein Trainer erkennt beim Erfassen und Bearbeiten ohne Rückfrage, in welcher Altersstufe er
   sich befindet
2. Die Umwandlung einer Übung ist für den Trainer in ihren Folgen absehbar, bevor er sie
   auslöst
3. Die Attribute beider Welten stammen aus derselben kontrollierten Vokabularquelle wie
   bisher
4. Der bestehende Kinderfussball-Bestand erfährt keinen Eingriff und keine Nachpflege

## 7. Getroffene Entscheide

| Frage | Entscheid |
|---|---|
| Trennschärfe | Eine Übung gehört zu genau einer Altersstufe; Werte der anderen sind nicht zuweisbar |
| Verwendung über Altersstufen hinweg | Keine. Eine Kinderfussball-Übung erscheint in Junioren-Trainings nicht mehr und umgekehrt |
| Herkunft der Altersstufe | Ergibt sich aus dem Schema: Kinderfussball mit seinen vier Trainingsteilen und Unterkategorien, Juniorenfussball mit seinem eigenen Schema |
| Stufenunabhängige Attribute | Titel, Bild und Diagramm, Anzahl Kinder, Material, Varianten. Sie gelten für beide Altersstufen gemeinsam — es bleibt eine Übung, nicht zwei |
| Stufenabhängige Attribute | Trainingsteil, Hauptteilkategorie, Alterskategorien, Erscheinungsformen, Feldtyp, Übungstyp, Ablaufbeschreibung |
| Feldtyp | Nur Kinderfussball. Das Junioren-Manual nennt bei seinen Trainingsformen Spielfeldgrössen in Metern statt Feldtypen |
| Übungstyp | Nur Juniorenfussball. Der Begriff stammt aus dem Manual Fussball Jugendliche; das Kinderfussball-Manual kennt ihn nicht |
| Ablaufbeschreibung | Kinderfussball führt den methodischen Fahrplan, der Juniorenfussball eine Beschreibung. Beim Wechsel zum Juniorenfussball werden die Stufen zusammengeführt; zurück wird die Beschreibung zur Stufe «Offen starten», die übrigen bleiben leer |
| Umgang mit den Daten der verlassenen Altersstufe | Sie bleiben erhalten und eingefroren. Eine Rückkehr stellt sie unverändert wieder her; Arbeit in der neuen Altersstufe bleibt dort und wirkt nicht zurück |
| Sichtbarkeit der aufbewahrten Angaben | Keine. Die Aufbewahrung wirkt im Hintergrund und zeigt sich erst bei der Rückkehr |
| Diagramm | Bleibt beim Stufenwechsel unverändert, samt Kinderfussball-Symbolik |
| Ort der Altersstufen-Wahl | Erfassen und Bearbeiten einer Übung. Katalog und Suche bleiben unverändert |
| Bestehender Übungsbestand | Bleibt wie er ist und gilt als Kinderfussball; keine Nachpflege |
| Wer überführen darf | Die Trainerin überführt ausschliesslich Übungen, die ihr gehören. Der kuratierte Manual-Bestand und fremde Community-Übungen bleiben unberührt; wer eine davon in der anderen Altersstufe braucht, übernimmt sie zuerst in den eigenen Bestand |
| Trainings-Schemawechsel, Zuordnung | Die Abbildungsregel ordnet jede Fassung automatisch ihrem Zielblock zu. Was dort keine Entsprechung hat — etwa Auffangen-Übungen — landet im bestehenden Nacharbeits-Bereich |
| Wahl des Junioren-Trainingsteils | Zweistufig wie im Kinderfussball: erst Einstieg, Hauptteil oder Abschluss, dann der Block darin. Die Blocknamen sind lang, und die Zugehörigkeit zum Trainingsteil bleibt so sichtbar |
| Aufbau des Junioren-Bestands | Kein geseedeter Grundbestand und keine gesenkte Veröffentlichungs-Hürde. Wer ein Junioren-Training veröffentlichen will, legt zuerst die nötigen Übungen an — das ist die natürliche Reihenfolge, kein Mangel |
| Rückrichtung ohne aufbewahrten Stand | Eine Junioren-Übung aus dem Block «Spielformen und unterstützende Übungen» wird beim erstmaligen Wechsel zu Kinder als «Fussball spielen lernen» vorgeschlagen — die Begriffsbrücke, die das Junioren-Manual selbst zieht |
| Trainings-Schemawechsel | Dieselbe Überführung und dieselbe Aufbewahrung wie bei einer einzelnen Übung; ein Training behält beim Wechsel seine Übungen |
| Migrationslage | Kein Migrationsproblem: Das Juniorenfussball-Epic liegt nur auf Staging und wurde nie auf Produktion ausgeliefert |

## 8. Durch dieses Epic revidierte Entscheide

Alle betreffen das Epic «Juniorenfussball-Trainingsschema», das auf Staging liegt.

1. Erfolgskriterium 6 («Eine Übung ist in Trainings beider Schemata verwendbar») ist
   aufgehoben. Eine Übung dient genau einer Altersstufe.
2. Die Abbildungsregel (`2026-08-15-junioren-abbildungsregel.md`) verliert ihre Rolle als
   Verwendungs-Brücke zwischen den Schemata. Als Vorschlags-Regel beim Überführen einer
   Übung bleibt sie fachlich gültig.
3. Story 2, Anmerkung («Eine Übung darf Alterskategorien beider Schemata gleichzeitig
   tragen») ist aufgehoben.
4. Story 5b beschränkt die Junioren-Trainingsteile auf die drei Einstiegs-Unterblöcke. Mit der
   Trennung müssen alle sechs Blöcke als Trainingsteil wählbar sein.
5. Story 9 («Übungstyp für alle Übungen beider Schemata») ist auf den Juniorenfussball
   eingeschränkt.
6. Story 12 («Beide Vokabulare stehen allen erscheinungsform-berechtigten Übungen
   offen») ist aufgehoben. Die Begründung von damals — die spielphasenbezogenen
   Junioren-Werte wären an Hauptteil-Übungen sonst nie zuweisbar — entfällt, weil
   Junioren-Übungen künftig einen eigenen Trainingsteil im Hauptteil haben.
7. Der Sonderfall «Explosivitäts-Übungen sind in Kinderfussball-Trainings nicht
   zuweisbar» ist gegenstandslos: Das gilt nun für alle Junioren-Übungen.

## 9. Offene Fragen

1. @UX Designer: Wie erfährt der Trainer vor der Umwandlung, was mit seinen Angaben
   geschieht — welche bleiben, welche werden überführt, welche fallen weg? Und wie
   erfährt er es beim Wechsel eines ganzen Trainings, wo mehrere Übungen betroffen sind?
2. @UX Designer: Wie wird die Altersstufen-Wahl beim Erfassen dargestellt, und wie beim
   Bearbeiten einer bestehenden Übung, wo sie eine Umwandlung auslöst?
3. @Product Owner: Eine Trainerin überarbeitet eine Übung in der Junioren-Altersstufe,
   wechselt zurück und sieht den alten Kinderfussball-Stand — ohne Hinweis, dass ihre
   Überarbeitung in der anderen Altersstufe weiterlebt. Ist diese Überraschung tragbar,
   oder braucht es doch einen Hinweis?
4. @Product Owner: Was geschieht mit den aufbewahrten Angaben bei einem wiederholten
   Wechsel hin und zurück? Wird beim zweiten Eintreffen in einer Altersstufe der Stand
   des ersten Aufenthalts wiederhergestellt, oder gilt dann der zuletzt verlassene?
5. @Product Owner: Auf Staging existieren bereits Junioren-Trainings, die über die
   Abbildungsregel Kinderfussball-Übungen nutzen, sowie Übungen mit Werten beider
   Altersstufen. Dürfen diese Testdaten verworfen werden?
