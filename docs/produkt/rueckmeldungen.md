# Rückmeldungen

Stand 2026-11-22 (Release 1.52.0). Wie die Anwendung dem Trainer sagt, was geschehen ist und was noch ansteht.

## Zwei Arten, etwas zu sagen

Die Anwendung unterscheidet, ob sie über einen Vorgang berichtet oder über einen Zustand. Ein
Vorgang ist etwas, das der Trainer eben ausgelöst hat: eine Übung kopiert, einen Termin
verschoben, ein Training veröffentlicht. Ein Zustand ist etwas, das er in einer Ansicht
vorfindet und das stehen bleibt, bis es erledigt ist: ein Formular, dessen Speichern
gescheitert ist, eine Übung, deren Feld-Diagramm anderes Material zeigt als erfasst.

Einen Zustand meldet ein Hinweis im Seiteninhalt, dort, wo er gilt. Er bleibt stehen, bis der
Trainer ihn beantwortet oder die Sache behoben ist. Der Hinweis steht wie in Jira auf einer leicht
getönten Fläche mit einem Zeichen links — rötlich, wenn etwas nicht ging, bläulich für alles
andere; verlangt er eine Antwort, stehen die Knöpfe dafür unter dem Text. Einen Vorgang meldet eine kurze Zeile am
unteren Bildschirmrand, die von selbst wieder geht.

## Die Zeile am unteren Rand

Jede Rückmeldung zu einem Vorgang erscheint an derselben Stelle, unten in der Mitte, egal wo
auf der Seite der Trainer geklickt hat. Steht dort gerade die Leiste für ausgewählte Einträge
(etwa „Kader zuteilen" in der Spielerliste), erscheint sie knapp darüber. Es steht immer nur eine da. Schliessen mehrere
Vorgänge kurz nacheinander ab, zeigt die Anwendung ihre Rückmeldungen der Reihe nach; jede
bekommt ihre volle Zeit erst, wenn sie erscheint, so läuft keine ungesehen ab. Eine neuere
Rückmeldung zur selben Sache ersetzt die ältere — gelingt der zweite Versuch, steht der
gescheiterte erste nicht mehr da —, und dieselbe Rückmeldung steht nie zweimal an.

Nach sechs Sekunden verschwindet die Zeile von selbst. Solange der Zeiger auf ihr liegt oder
sie mit der Tastatur angesteuert ist, wartet sie; über das Kreuz lässt sie sich jederzeit
sofort schliessen, und wer sie mit der Tastatur schliesst, steht danach wieder dort, wo er
vorher war. Ob ein Vorgang gescheitert ist, sagt ihr Text, nicht ihre Farbe. Eine einzige
Rückmeldung trägt einen Knopf für den nächsten Schritt: Nach einem Import in den Spielerbestand
eines Vereins führt „Zuordnen" zu den Spieler:innen ohne Team (siehe
[Verein](verein.md#import-aus-einer-datei)). Wer mit
einer Vorlesehilfe arbeitet, hört jede Rückmeldung, ohne dabei unterbrochen zu werden.

Die Zeile gehört zu der Ansicht, in der sie entstand: Wechselt der Trainer von sich aus auf
eine andere Seite, fällt sie weg. Führt der Vorgang selbst auf eine andere Seite — nach dem
Erstellen einer Übung, dem Löschen eines Trainings, dem Übernehmen einer Kopie —, erscheint
die Bestätigung dort. Sie erscheint ein einziges Mal: Wer die Seite danach neu lädt oder
über «Zurück» wiederkommt, sieht sie nicht noch einmal.

Scheitert ein Vorgang in einem Dialog, der danach offen bleibt, etwa beim Verlassen oder
Auflösen eines Teams, steht der Grund oben im Dialog selbst und nicht am Bildschirmrand, wo
der Dialog ihn verdecken würde. Ebenso meldet der Dialog mit dem privaten Link einer Spieler:in
in sich selbst, wenn der Link erneuert, als zugestellt markiert oder das zurückgenommen wurde;
war der Link inzwischen schon abgeholt, sagt er das, ohne es als Fehler zu werten.

Auf den Seiten hinter einem privaten Link, die Eltern ohne Konto öffnen, gibt es die Zeile nicht.
Scheitert dort das Umlegen eines Schalters, springt er zurück, und der Grund steht als Hinweis
an der Karte des Termins; auf der Abholseite steht jede Antwort als Hinweis über dem Knopf.

## Neue Version

Ist eine neue Version erschienen, die in diesem Browser noch nicht angesehen wurde, trägt der
Avatar auf der Konto-Karte unten in der Seitenleiste einen Punkt, und im Konto-Menü steht bei
«Was ist neu» die Plakette «Neu» statt der Versionsnummer. Beides bleibt stehen, bis die Seite
mit den Versionen geöffnet wurde. Das gilt auch ohne Anmeldung: Die Karte «Nicht angemeldet»
führt ebenso zu «Was ist neu». Im selben Menü steht für Angemeldete «Fragen und
Feedback», der Weg, der Anwendung selbst etwas zu melden (siehe [Navigation](navigation.md)).

## Bekannte Grenzen

Rückmeldungen lassen sich nicht nachträglich abrufen; wer eine verpasst oder weggeklickt hat,
findet sie nirgends wieder. Eine Rückmeldung über einen gescheiterten Vorgang bietet keinen
Knopf zum erneuten Versuch an; der Trainer löst den Vorgang wie zuvor noch einmal aus.
