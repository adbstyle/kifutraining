# Navigation

Stand 2026-10-06. Wie man sich in der Anwendung bewegt und wie sie sich bedienen lässt.

## Die Seitenleiste

Die Hauptnavigation steht als Leiste am linken Rand. Oben steht die Marke — ein Fussball mit
dem Namen KiFu —, die zum Übungsbestand führt. Darunter folgen zwei Gruppen. Unter
„Bibliothek" stehen „Übungen" und „Trainings", der ganze Bestand. Unter „Mein Bereich" stehen
„Meine Übungen" und „Meine Trainings", also derselbe Bestand, eingegrenzt auf das Eigene, und
„Teams". Unter „Teams" sind die eigenen Teams als Unterpunkte aufgeführt. Ein Klick auf
„Teams" führt in die Teamübersicht, der Pfeil daneben klappt die Teamnamen auf und zu. Ein
neues, umbenanntes oder aufgelöstes Team erscheint dort ohne Neuladen.

Hervorgehoben ist, wo man gerade steht. Ein geöffnetes Team-Training hält „Teams" hervor,
wie im Team-Bereich beschrieben.

Über dem Konto steht die Version, die gerade läuft. Ein Klick darauf öffnet „Versionen" (siehe
unten); in der schmalen Leiste bleibt ihr Zeichen, die Nummer zeigt der Hinweis daneben.

Ganz unten steht das Konto: Initialen, Anzeigename und E-Mail-Adresse. Ein Klick darauf führt
ins Konto, wo auch das Abmelden zu finden ist. Ohne Anmeldung steht an dieser Stelle
„Anmelden", und die Gruppe „Mein Bereich" fehlt.

## Breit oder schmal

Die Leiste lässt sich verkleinern. Dann zeigt sie nur noch die Zeichen der Einträge. Den
Namen eines Eintrags zeigt ein Hinweis daneben, sobald man ihn mit dem Zeiger überfährt oder
mit der Tastatur ansteuert. Umgeschaltet wird nur von Hand, über den Knopf links vor den
Brotkrumen. Beim Überfahren öffnet sich die schmale Leiste nicht von selbst. Die Wahl merkt
sich der Browser und behält sie beim nächsten Besuch.

## Versionen

Die Seite „Versionen" zeigt, was jede Version von KiFu gebracht hat, die neueste zuerst — alle
seit 1.0.0. Zu jeder steht ihr Titel, die Versionsnummer, der Tag der Veröffentlichung und
der Text, wie er im öffentlichen Repository auf GitHub steht: unverändert, mit Gliederung,
Hervorhebungen und Links, auch mit technischen Abschnitten und Issue-Nummern. Ein Verweis
führt zur Veröffentlichung auf GitHub. Die Seite ist ohne Anmeldung zugänglich und hat eine
eigene Adresse, die sich weitergeben lässt.

Eine neue oder geänderte Version auf GitHub erscheint spätestens nach einer Stunde. Ist GitHub
gerade nicht erreichbar, zeigt die Seite den zuletzt bekannten Stand mit einem Hinweis, dass er
womöglich nicht aktuell ist; die Versionsnummer in der Leiste steht trotzdem.

## Brotkrumen

Jede Seite zeigt zuoberst ihren Pfad als Brotkrumen, auch die Einstiegsseiten: der
Übungsbestand etwa „Übungen", eine Übung „Übungen › Hauptteil › ‹Name›". Davor steht der
Knopf zum Verkleinern der Leiste. Die Zeile steht auf einer Höhe mit der Marke oben in der
Leiste. In derselben Zeile stehen rechts die Aktionen der Seite: auf den Übersichten von
Übungen, Trainings und Teams der Knopf zum Erstellen, auf Trainingsseiten die Aktionen am
Training. Eine sichtbare Überschrift tragen die Übersichten nicht, ihren Namen nennt die
Brotkrume; für Screenreader steht er unsichtbar als Überschrift der Seite. Im Druck
erscheint die Leiste nie; die Brotkrumen nur beim Drucken der Trainingsansicht aus dem
Browser, damit auf dem Papier steht, wo das Training liegt.

## Seitenaufbau

Jede Seite beginnt links neben der Leiste, nichts steht zentriert in der Mitte. Übersichten —
Übungen, Trainings, Teams und der Bereich eines Teams — nutzen die ganze Breite des Fensters;
die Kacheln reihen sich so dicht, wie Platz ist, auf einem breiten Bildschirm also in mehr
Spalten. Formulare und Seiten zum Lesen behalten eine angenehme Lesebreite und stehen ebenfalls
links; geteilte Seiten — eine Übung, ein Training — nutzen auf einem breiten Bildschirm die ganze
Fläche (siehe unten). Auch die Durchführung steht links.

Ab Laptop-Breite bleibt die Kopfzeile mit den Brotkrumen und den Aktionen der Seite beim
Scrollen oben stehen. Einzig die Durchführung lässt sie mitlaufen; dort kleben stattdessen die
Überschriften der Blöcke oben. Auf einem Telefon klebt nur die Zeile mit dem Menüknopf — die
Brotkrumen brechen dort um und nähmen sonst zu viel vom Bildschirm.

Die Seite einer Übung und ihre Bearbeitungsmaske sind auf einem breiten Bildschirm geteilt: links der
Inhalt, rechts die Einordnung. Beide füllen dann die ganze Breite und Höhe des Fensters, und
jede Seite der Teilung scrollt für sich — wer im Ablauf liest, behält die Einordnung im Blick,
und in der Maske bleibt das Speichern unten stehen. Die Einordnung wächst mit dem Fenster etwas
mit; zwischen beiden liegt eine Trennlinie, an der sich die Breite der Einordnung ziehen lässt,
mit der Maus oder per Pfeiltaste. Ein Doppelklick stellt die übliche Breite wieder her. Die
gewählte Breite gilt für alle geteilten Seiten und bleibt auf dem Gerät gespeichert. Ist das
Fenster dafür zu schmal, scrollt die Seite als Ganzes, der Inhalt behält seine Lesebreite, und
die Einordnung steht auf der Übungsseite nach dem Inhalt, in der Maske davor.

Ein Training ist beim Zusammenstellen und in der Ansicht ebenso geteilt: links die Übungen,
rechts die Eigenschaften des Trainings oder die geöffnete Übung (siehe
[Trainings](trainings.md#übungen-und-eigenschaften-nebeneinander)). Die Spalte gibt es dort nur
auf einem breiten Bildschirm; schmaler und auf Papier fehlt sie, und die Seite steht wie gewohnt
untereinander. Einzig eine Übung, deren Bearbeitung ungesicherte Änderungen trägt, bleibt dann
unter den Übungen stehen.

## Bedienung

Die Oberfläche ist knapp gehalten. Überschriften stehen in gewöhnlicher Schreibung, nicht in
Grossbuchstaben; klein und in Grossbuchstaben bleiben nur kurze Beschriftungen. Plaketten stehen
wie in Jira in gewöhnlicher Schreibung auf einer zart getönten Fläche. Ihre Farbe sagt, ob sie
bloss etwas benennt — Herkunft, Entwurf, Altersstufe (grau) —, nach aussen gilt (blau), etwas
Zusätzliches meldet wie mehrere Varianten (violett) oder Aufmerksamkeit braucht wie ein Termin
ohne Training (orange). Die Alterskategorien stehen als einzelne Buchstaben, jede in einer festen
Farbe aus derselben Palette; bei ihnen zählt der Buchstabe, nicht die Bedeutung der Farbe.
Alles, was sich bedienen lässt — Knöpfe, Felder, Filter, Einträge der Seitenleiste, Zeilen in
Menüs und Listen, die Werkzeuge der Zeichenfläche —, ist gleich hoch, 36 Pixel, auf dem Rechner
wie auf dem Telefon und auch in der Durchführen-Ansicht. Knöpfe, die nur ein Zeichen tragen,
haben wie alle Knöpfe und Felder abgerundete Ecken; ganz rund sind nur die Chips, die man an-
und wieder abwählt.

Ein Formular liest sich als Liste aus Namen und Werten. Jede Angabe steht als eigenes Feld in
einer eigenen Zeile, auch wo zwei Angaben zusammengehören wie Länge und Breite oder Mindest- und
Höchstanzahl. Ein Feld zeigt ruhend weder Rahmen noch Fläche: Über dem Wert steht klein sein
Name. Ein leeres Feld zeigt nur seinen Namen, gedämpft an der Stelle des Werts. Klickt man
hinein, springt der Name darüber und das Feld trägt einen farbigen Rahmen. Fährt man mit der Maus
über eine Angabe, hellt sie auf. Den Pfeil einer Auswahl zeigt das Feld nur, solange man darin
arbeitet; ruhend steht dort nur der gewählte Wert. Eine Auswahl, die man auch leer lassen darf,
bietet keinen Eintrag „kein …" an — leer heisst nicht angegeben. Ein leeres Datums- oder
Zeitfeld zeigt ebenso nur seinen Namen, mit einem Kalender- oder Uhrzeichen davor, statt einer
Eingabemaske; erst ein Klick bringt die Auswahl von Datum oder Zeit. Ist ein Feld beim Speichern
fehlerhaft, steht sein Name oben und nicht zusätzlich im Feld. Wo sich in einem Formular Einträge
wiederholen — Felder eines Termins, Material einer Übung —, steht zum Hinzufügen kein Knopf,
sondern eine Zeile, die aussieht wie ein leeres Feld, etwa „Feld hinzufügen (optional)"; ein
Klick fügt einen Eintrag an. Die Bedienteile des Browsers selbst, etwa das Auswahlfenster für ein
Datum, erscheinen dunkel wie die Anwendung.

Was ein Feld nur erklärt, steht nicht dauernd darunter, sondern hinter einem kleinen ⓘ rechts im
Feld. Es erscheint erst, wenn man mit der Maus über die Angabe fährt; ein Klick darauf öffnet den
Hinweis. Mit der Tastatur lässt es sich ansteuern, und eine Sprachausgabe liest den Hinweis mit
dem Feld vor. Fehler dagegen stehen beim Speichern eines Formulars sichtbar rot unter dem Feld;
ein Feld, das schon beim Verlassen speichert, fällt bei einem Fehler auf den gespeicherten Wert
zurück und meldet ihn am Bildschirmrand. Die Meldungen kommen von der Anwendung selbst und sind
deutsch — die eigenen, englischen Meldungen des Browsers erscheinen nicht. Ebenso ist die Wahl einer Datei ein eigener Knopf mit deutscher Beschriftung.

Filter stehen über den Übersichten in einer Zeile als Knöpfe: Jeder nennt, wonach er filtert,
und zählt, wie viele Werte gewählt sind; welche, zeigt ein Klick, der darunter eine Liste mit
Kästchen zum An- und Abwählen öffnet. Ein Filter, der eingrenzt, ist farbig umrandet. Die Wahl
wirkt sofort und die Liste bleibt offen; Escape oder ein Klick daneben schliesst sie. Die Zahl der
verfügbaren Kinder trägt man an derselben Stelle als Zahl ein. Sie wirkt wie die Suche daneben
nach einer kurzen Tipppause.

## Auf schmalen Bildschirmen

Auf einem Telefon oder einem schmalen Fenster steht oben eine Kopfzeile mit dem Menüknopf.
Er öffnet die Leiste von links über dem Inhalt. Dort zeigt sie immer alle Namen.
Schliessen lässt sie sich über das Kreuz, einen Klick daneben, die Escape-Taste oder die
Wahl eines Eintrags; auch jeder Seitenwechsel schliesst sie. Solange sie offen ist, bleibt die
Tastatur in ihr. Den Knopf zum Verkleinern gibt es dort nicht.

## Seiten, die es nicht gibt

Eine falsche Adresse oder ein entfernter Inhalt zeigt eine Hinweisseite mit Leiste und
Brotkrumen und einem Weg zurück zu den Übungen.

## Anmelde-Seiten

Die Seiten zum Anmelden, Registrieren und Zurücksetzen des Passworts kommen ohne Leiste aus,
ebenso die Bestätigung beim Verbinden eines KI-Assistenten.

## Bekannte Grenzen

Wird jemand von einem anderen Konto in ein Team aufgenommen, erscheint das Team in der Leiste
erst beim nächsten Neuladen oder nach der nächsten eigenen Aktion. Breit oder schmal merkt
sich jeder Browser für sich, nicht das Konto — ebenso die gezogene Breite der Spalte auf den
geteilten Seiten; sie gilt für Übung und Training gemeinsam. Die Teilung gibt es nur auf breiten Bildschirmen; auf einem Tablet im
Hochformat oder einem Telefon steht alles untereinander, und die Breite lässt sich dort nicht
ziehen.

„Versionen" zeigt die Texte so, wie sie veröffentlicht wurden; ältere enthalten Technisches,
Issue-Nummern und Aussagen, die inzwischen überholt sind. Issue-Nummern sind dort kein Link,
Bilder in einem Release-Text erscheinen nicht. Kurz nach einem Release kann die Version in der
Leiste schon neuer sein als der neueste Eintrag unter „Versionen" oder umgekehrt.

Auf Geräten ohne Maus, also auf Telefon und Tablet, erscheint das ⓘ eines Feldes nie; die
Hinweise dahinter bleiben dort nur der Sprachausgabe zugänglich. Ausgenommen sind die wenigen
Hinweise, die man vor der Eingabe kennen muss — dass die Altersstufe eines Trainings danach
feststeht, wen die erwartete Spielerzahl eines Termins zählt und dass 0 Tore keine heisst —:
Sie stehen dort unter dem Feld. Die Bedienflächen sind dort
ebenfalls 36 Pixel hoch und damit kleiner als die sonst für Finger empfohlene Grösse.
