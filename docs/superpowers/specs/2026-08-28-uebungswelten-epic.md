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
| Altersstufe | Welchem Lehrmittel eine Übung oder ein Training folgt | Kinderfussball, Juniorenfussball |
| Alterskategorie | Die Feinunterteilung innerhalb einer Altersstufe | G, F, E (Kinderfussball) — D, C, B, A (Juniorenfussball) |
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
| Hauptteilkategorie | stufenabhängig | nur Kinderfussball. Abbildung 19 des Junioren-Manuals führt zwar zwei der drei Begriffe wörtlich, doch der Juniorenfussball gliedert seinen Hauptteil bereits in die Blöcke Spielformen und unterstützende Übungen sowie Spiel; eine zweite Gliederungsebene wäre doppelt |
| Alterskategorien | stufenabhängig | nur die der jeweiligen Altersstufe |
| Erscheinungsformen | stufenabhängig | je Altersstufe das eigene Vokabular |
| Feldtyp | stufenabhängig | nur Kinderfussball |
| Spielfeldgrösse | stufenabhängig | nur Juniorenfussball, das Pendant zum Feldtyp |
| Übungstyp | stufenabhängig | nur Juniorenfussball |
| Ablaufbeschreibung | stufenabhängig, überführbar | Kinderfussball führt den methodischen Fahrplan, der Juniorenfussball eine Beschreibung |

Die Ablaufbeschreibung ist der einzige inhaltlich wertvolle Text, der beim Wechsel
sonst verloren ginge. Sie wird deshalb überführt: vom Kinderfussball zum
Juniorenfussball werden die drei Fahrplan-Stufen zu einer Beschreibung zusammengeführt,
in der Gegenrichtung wird die Beschreibung zur Stufe «Offen starten», die beiden übrigen
bleiben leer und sind nachzutragen. Der Überführungs-Mechanismus existiert bereits für
den Wechsel zwischen Fahrplan und Aufbau-Text innerhalb des Kinderfussballs.

Für alle übrigen stufenabhängigen Attribute gilt: Überführung schlägt Leeren, und wo es
keine Entsprechung gibt, wählt der Trainer in der Zielstufe neu. Aufbewahrt wird nichts
— die verlassene Altersstufe behält keinen Stand (Refinement-Entscheid 2026-08-30). Der
Anwendungsfall des Wechsels ist die einmalige Korrektur einer falsch gewählten
Altersstufe, nicht das Hin und Her.

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
4. Eine Übung, die der falschen Altersstufe zugeordnet wurde, lässt sich richtigstellen,
   ohne dass ihre stufenunabhängigen Angaben und ihr Diagramm neu zu erfassen sind
5. Ein Junioren-Training bezieht seine Übungen ausschliesslich aus dem
   Juniorenfussball-Bestand, ein Kinderfussball-Training ausschliesslich aus dem
   Kinderfussball-Bestand
6. Ein Training gehört lebenslang der Altersstufe, in der es angelegt wurde
7. Der bestehende Übungsbestand bleibt unverändert nutzbar und gilt als Kinderfussball
8. Eine Übung wechselt ihre Altersstufe nur durch ihre Eigentümerin; der kuratierte
   Bestand und fremde Übungen bleiben davon unberührt

### Out of Scope

1. Die Applikation führt keinen kuratierten Übungsbestand für den Juniorenfussball ein
2. Die Applikation bewahrt die Angaben der verlassenen Altersstufe nicht auf; wer eine
   Übung zurückwechselt, beginnt dort von vorn
3. Die Applikation führt für den Juniorenfussball keine eigene Diagramm-Symbolik ein
4. Die Applikation trennt die Altersstufen nicht im Übungskatalog und nicht in der Suche;
   die Trennung betrifft das Erfassen und Bearbeiten
5. Die Applikation ändert die Bedingungen für die Veröffentlichung eines Trainings nicht,
   abgesehen von der Bedingung «keine offene Nacharbeit», die mit der Nacharbeit selbst
   entfällt
6. Die Applikation kennt keine Übung, die in beiden Altersstufen gleichzeitig steht.
   Wer dieselbe Übungsidee in beiden braucht, führt sie zweimal

## 5. Story-Zerlegung nach SPIDR

Vertikal geschnitten, jede Story liefert für sich einen nachvollziehbaren Zustand.
Reihenfolge ist die vorgeschlagene Umsetzungsreihenfolge.

Der Schnitt ist im Refinement vom 2026-08-30 überarbeitet worden. Massgebend ist
`2026-08-28-uebungswelten-stories.md`; die dortige Übersicht und die ausgearbeiteten
Stories gelten, nicht mehr diese Tabelle.

| # | Story | SPIDR | Typ | Hängt ab von |
|---|---|---|---|---|
| 1 | Altersstufe als geführte Angabe an Übung und Training | Data | Enabler | — |
| 2 | Kinderfussball-Übung ohne Junioren-Begriffe erfassen | Rules | Business | 1 |
| 3 | Junioren-Übung nach dem eigenen Lehrmittel erfassen | Rules | Business | 1 |
| 4 | Übung in die andere Altersstufe überführen | Paths | Business | 2, 3 |
| 5 | Training in einer Altersstufe anlegen, die lebenslang gilt | Rules | Business | 1 |
| 6 | Übungs-Picker auf die Altersstufe des Trainings beschränken | Rules | Business | 1, 5 |
| 7 | Kuratierte oder fremde Übung direkt in den eigenen Bestand übernehmen | Paths | Business | — |

Story 1 ist ein Enabler: Sie macht die Zugehörigkeit zu einer geführten Angabe, ohne
dass sich für den Trainer etwas ändert. Erst die Stories 2 und 3 machen den Nutzen
sichtbar.

Die Stories 2 und 3 sind nach Altersstufe getrennt statt nach Feldart, damit jede für
sich prüfbar bleibt. Story 3 trägt dabei die zweistufige Wahl über alle sechs
Junioren-Blöcke: Mit der Trennung fliesst keine Kinderfussball-Übung mehr in die
Junioren-Blöcke, also müssen Spielformen, Spiel und Ausklang aus eigenen Übungen
befüllbar werden.

## 6. Nicht-funktionale Anforderungen

1. Ein Trainer erkennt beim Erfassen und Bearbeiten ohne Rückfrage, in welcher Altersstufe er
   sich befindet
2. Die Umwandlung einer Übung ist für den Trainer in ihren Folgen absehbar, bevor er sie
   auslöst
3. Die Attribute beider Welten stammen aus derselben kontrollierten Vokabularquelle wie
   bisher
4. Der bestehende Kinderfussball-Bestand bleibt ohne Nachpflege durch den Trainer nutzbar.
   Eingegriffen wird einzig dort, wo eine Übung heute einen Wert der anderen Altersstufe
   trägt; auf Produktion gibt es solche Werte nicht
5. Die Zugehörigkeit einer Übung und eines Trainings zu ihrer Altersstufe hält auch dann,
   wenn eine Änderung die Oberfläche umgeht

## 7. Getroffene Entscheide

| Frage | Entscheid |
|---|---|
| Trennschärfe | Eine Übung gehört zu genau einer Altersstufe; Werte der anderen sind nicht zuweisbar |
| Verwendung über Altersstufen hinweg | Keine. Eine Kinderfussball-Übung erscheint in Junioren-Trainings nicht mehr und umgekehrt |
| Herkunft der Altersstufe | Ergibt sich aus dem Schema: Kinderfussball mit seinen vier Trainingsteilen und Unterkategorien, Juniorenfussball mit seinem eigenen Schema |
| Stufenunabhängige Attribute | Titel, Bild und Diagramm, Anzahl Kinder, Material, Varianten. Sie gelten für beide Altersstufen gemeinsam — es bleibt eine Übung, nicht zwei |
| Stufenabhängige Attribute | Trainingsteil, Hauptteilkategorie, Alterskategorien, Erscheinungsformen, Feldtyp, Übungstyp, Ablaufbeschreibung |
| Feldtyp | Nur Kinderfussball. Das Junioren-Manual nennt bei seinen Trainingsformen Spielfeldgrössen in Metern statt Feldtypen; die Junioren-Übung führt diese Spielfeldgrösse als eigene Angabe (2026-08-30) |
| Übungstyp | Nur Juniorenfussball. Der Begriff stammt aus dem Manual Fussball Jugendliche; das Kinderfussball-Manual kennt ihn nicht |
| Ablaufbeschreibung | Kinderfussball führt den methodischen Fahrplan, der Juniorenfussball eine Beschreibung. Beim Wechsel zum Juniorenfussball werden die Stufen zusammengeführt; zurück wird die Beschreibung zur Stufe «Offen starten», die übrigen bleiben leer |
| Umgang mit den Daten der verlassenen Altersstufe | Sie werden verworfen. Aufbewahrt wird nichts, eine Rückkehr beginnt von vorn. Der Wechsel dient der einmaligen Korrektur einer falsch gewählten Altersstufe (2026-08-30, ersetzt den Entscheid, sie eingefroren zu erhalten) |
| Diagramm | Bleibt beim Stufenwechsel unverändert, samt Kinderfussball-Symbolik |
| Ort der Altersstufen-Wahl | Erfassen und Bearbeiten einer Übung. Katalog und Suche bleiben unverändert |
| Bestehender Übungsbestand | Bleibt wie er ist und gilt als Kinderfussball; keine Nachpflege |
| Wer überführen darf | Die Trainerin überführt ausschliesslich Übungen, die ihr gehören. Der kuratierte Manual-Bestand und fremde Community-Übungen bleiben unberührt; wer eine davon in der anderen Altersstufe braucht, übernimmt sie zuerst in den eigenen Bestand |
| Altersstufe eines Trainings | Wird beim Anlegen gewählt und steht danach fest. Die Alterskategorien sind auf die Werte dieser Altersstufe beschränkt und bestimmen die Altersstufe nicht mehr (2026-08-30) |
| Wahl des Junioren-Trainingsteils | Zweistufig wie im Kinderfussball: erst Einstieg, Hauptteil oder Abschluss, dann der Block darin. Die Blocknamen sind lang, und die Zugehörigkeit zum Trainingsteil bleibt so sichtbar |
| Aufbau des Junioren-Bestands | Kein geseedeter Grundbestand und keine gesenkte Veröffentlichungs-Hürde. Wer ein Junioren-Training veröffentlichen will, legt zuerst die nötigen Übungen an — das ist die natürliche Reihenfolge, kein Mangel |
| Rückrichtung der Abbildungsregel | Aufwärmen und Spielform zum Trainingsziel werden zur Einleitung, Spielformen und unterstützende Übungen zu «Fussball spielen lernen» — die Begriffsbrücke, die das Junioren-Manual selbst zieht —, Spiel zu «Fussball spielen», Ausklang zu Ausklang. Explosivität hat keine Entsprechung; dort wählt der Trainer selbst (vervollständigt 2026-08-30) |
| Altersstufen-Wechsel eines Trainings | Wird gar nicht angeboten. Wer für die andere Altersstufe plant, legt ein neues Training an. Übungsbestand, Trainingsteile und Gliederung sind verschieden, fachlich ist ohnehin nichts übernehmbar (2026-08-30) |
| Nacharbeit und automatische Umordnung im Training | Werden ersatzlos zurückgebaut. Ohne Altersstufen-Wechsel haben sie keinen Anwendungsfall mehr (2026-08-30) |
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

## 8a. Im Refinement revidierte Entscheide dieses Epics

Alle gefallen am 2026-08-30 im Refinement mit dem Product Owner.

1. Erfolgskriterium 6 lautete: «Ein bestehendes Kinderfussball-Training überlebt den
   Wechsel ins Juniorenschema mit seinen Übungen; deren stufenabhängige Angaben werden
   nach denselben Regeln überführt wie bei einer einzelnen Übung.» Es ist aufgehoben. Ein
   Training wechselt seine Altersstufe nicht mehr; es gehört lebenslang der Altersstufe,
   in der es angelegt wurde.
2. Die Story-Zerlegung in Abschnitt 5 ist überarbeitet. Die Story «Fassungen eines
   Trainings beim Schema-Wechsel überführen und aufbewahren» entfällt ersatzlos. Neu
   hinzugekommen sind die Wahl der Altersstufe am Training und die direkte Übernahme
   einer kuratierten oder fremden Übung in den eigenen Bestand.
3. Der Entscheid «Die Ablaufbeschreibung des Juniorenfussballs ist eine Beschreibung»
   gilt für alle sechs Junioren-Blöcke. Die Blöcke Aufwärmen und Spielform zum
   Trainingsziel tragen damit keinen methodischen Fahrplan mehr; der Fahrplan bleibt dem
   Kinderfussball vorbehalten.
4. Nacharbeit, automatische Umordnung nach der Abbildungsregel und die Einordnungs-Konserve
   an der Fassung werden zurückgebaut. Damit entfällt auch die Veröffentlichungsbedingung
   «keine offene Nacharbeit».
5. Erfolgskriterium 4 lautete: «Die Angaben der verlassenen Altersstufe bleiben erhalten,
   sodass eine Rückkehr den vorherigen Zustand wiederherstellt.» Es ist aufgehoben. Der
   Wechsel überführt, bewahrt aber nichts auf; die Story zum Aufbewahren und
   Wiederherstellen entfällt. Der Anwendungsfall ist die einmalige Richtigstellung einer
   falsch gewählten Altersstufe — auf Produktion tragen Übungen die Kategorie E, die
   fachlich zum Juniorenfussball gehören.

## 9. Offene Fragen

1. @UX Designer: Wie bleibt beim Einordnen einer Junioren-Übung erkennbar, zu welchem
   Trainingsteil ein Block gehört?

Alle übrigen Fragen sind am 2026-08-30 im Refinement erledigt; die Entscheide stehen in
`2026-08-28-uebungswelten-stories.md`. Insbesondere: Die Umwandlung zeigt keine Vorschau
der Folgen, die Spielfeldgrösse wird als Länge und Breite in Metern erfasst, und die
Altersstufen-Wahl ist als offenes Bedienelement vorgegeben — kein aufklappendes Menü, in
der Art der Trainingsteil-Wahl des Kinderfussballs. Die früheren Fragen zur Rückkehr in
eine verlassene Altersstufe und zum wiederholten Wechsel sind gegenstandslos, weil nichts
mehr aufbewahrt wird; die Teilfrage zum Wechsel eines ganzen Trainings ebenso, weil ein
Training die Altersstufe nicht mehr wechselt.
