# Konto und Zugang

Stand 2026-11-22 (Release 1.52.0). Wie man in die Anwendung hineinkommt und was ein Konto mit sich bringt.

## Registrieren und Anmelden

Der Zugang läuft über E-Mail-Adresse und Passwort; einen Anmeldelink per Mail oder eine
Anmeldung über fremde Dienste gibt es nicht. Bei der Registrierung braucht es die Adresse, ein
Passwort von mindestens acht Zeichen und dessen Wiederholung. Danach erscheint immer derselbe
Hinweis, dass ein Bestätigungslink unterwegs sei — auch dann, wenn die Adresse längst
registriert ist. So verrät die Anwendung nicht, wer bei ihr ein Konto hat. Nutzbar wird das
Konto erst, wenn der Link in der Mail angeklickt wurde.

Wer sich vor der Bestätigung anzumelden versucht, wird darauf hingewiesen und kann die Mail
gleich noch einmal anfordern. Stimmt Adresse oder Passwort nicht, bleibt die Meldung bewusst
unbestimmt und nennt beides zusammen.

Ein vergessenes Passwort setzt man über die eigene Adresse zurück. Auch hier antwortet die
Anwendung immer gleich, ob das Konto existiert oder nicht. Der Link führt auf eine Seite, auf
der ein neues Passwort zweimal einzugeben ist; das alte Passwort wird dabei abgelehnt. Einen
Weg, das Passwort im laufenden Betrieb ohne diesen Mailversand zu wechseln, gibt es nicht.

## Was im Konto steht

Das Konto öffnet man über „Konto und Einstellungen" im Konto-Menü an der Konto-Karte unten in
der Seitenleiste (siehe [Navigation](navigation.md)). Es heisst „Dein Konto" und ist in drei
Reiter gegliedert, jeder mit eigener Adresse, damit sich jedes Thema für sich anzeigen und
verlinken lässt; Zurück im Browser führt zum vorigen Reiter:

- **Profil** (`/konto`) zeigt die eigene E-Mail-Adresse zum Lesen, mit dem Hinweis, dass man sich
  damit anmeldet und dass die Mitglieder der eigenen Teams und die Vereinsverwaltung sie sehen,
  lässt den Anzeigenamen setzen und sagt unter „Passwort", dass ein neues Passwort über einen Link
  per E-Mail gesetzt wird; „Passwort vergessen?" führt dorthin.
- **Verbindungen** (`/konto/verbindungen`) führt, was von aussen am Konto hängt: die
  „KI-Assistenten" (siehe unten) und die „Kalender-Abos".
- **Daten und Konto** (`/konto/daten`) zählt unter „In deinem Browser" auf, was KiFu im Browser
  ablegt — dieselbe Liste wie die Seite „Cookies", zu der „Alles zu Cookies" mit den Einzelheiten
  führt (siehe [Navigation](navigation.md#cookies)) —, und bietet darunter das Löschen des Kontos
  an. Die Seite „Cookies" trägt für Angemeldete die Brotkrume „Konto › Daten und Konto › Cookies".

Abmelden lässt sich nur im Konto-Menü der Seitenleiste, nicht im Konto selbst; sind auf der
offenen Seite Angaben ungesichert, fragt die Anwendung vorher nach. Mehr Profilangaben gibt es
nicht — kein Bild, keine Postadresse, keine Vereinszugehörigkeit.

## KiFu als App

Wer ein Konto hat, legt KiFu auf dem Mobile als App auf den Home-Bildschirm, auf dem iPhone über
„Teilen" und „Zum Home-Bildschirm", auf einem Android-Telefon über das Menü des Browsers, „Zum
Startbildschirm hinzufügen" oder „App installieren"; Chrome bietet es auch am Computer an. Das geht
von jeder Seite der Anwendung und von der Anmeldung aus. Die App heisst „KiFu", trägt die Bildmarke
und öffnet ohne die Leiste des Browsers bei den Teams; ohne Anmeldung führt sie zuerst zur Anmeldung
und danach dorthin. Wer sich in der App einmal anmeldet, bleibt darin so lange angemeldet wie im
Browser. Die ganze Anwendung lässt sich darin bedienen, auch Übungen, Trainings und Konto. Eine
Anleitung oder einen Hinweis zum Ablegen zeigt die Anwendung für Personen mit Konto nicht; das gibt
es nur am privaten Link einer Spieler:in (siehe [Team-Bereich](team-bereich.md#als-app-ablegen)).
Die Leiste des Mobiles färbt die App im Grund des Erscheinungsbilds, das das Gerät eingestellt hat.

## Der Anzeigename

Der Anzeigename ist das, was andere von einer Person zu sehen bekommen. Die E-Mail-Adresse
sehen die Mitglieder der eigenen Teams, in der Mitgliederliste und bei der Wahl der
Trainer:innen eines Termins, und die Vereinsverwaltung bei jeder Trainer:in des Vereins und bei
den Personen der Verwaltung; allen anderen bleibt sie verborgen. Den übrigen Mitgliedern des
Vereins zeigt der Bereich „Verein" von der Verwaltung nur den Anzeigenamen. Der Name steht als Urheber
an veröffentlichten Trainings, in den Mitgliederlisten der Teams, an den Terminen, zu denen man
eingeladen ist, und in den Kalender-Abos der anderen Eingeladenen. Ist man für einen Termin
verantwortlich, sehen ihn auch die Eltern und Spieler:innen am privaten Link; das sagt der
Hinweis beim Feld. Wer keinen gewählt hat, erscheint nicht namenlos, sondern unter einer
automatisch vergebenen, je Konto verschiedenen Kennung — etwa „Trainer:in a1b2".

Gesetzt wird er im Konto in einem einzigen Feld. Es zeigt den aktuellen Namen, auch die
automatische Kennung, solange kein eigener gewählt ist, und speichert beim Verlassen oder mit der
Eingabetaste — nur wenn sich etwas geändert hat; Escape nimmt die Eingabe zurück. Ein leeres
Feld oder ein abgewiesener Name fällt auf den gespeicherten zurück, und die Anwendung sagt am
Bildschirmrand, warum. Wer den Namen und wer die E-Mail-Adresse sieht, sagt der Hinweis hinter
dem ⓘ.

Ein einmal gesetzter Name lässt sich ersetzen, aber nicht mehr entfernen. Das ist Absicht: An
bereits veröffentlichten Trainings soll nicht plötzlich wieder eine Zufallskennung auftauchen.
Der Name ist auf vierzig Zeichen begrenzt.

## Konto ohne Verein

Wer sich registriert, hat zunächst ein Konto ohne Verein: Es gehört weder einem Team noch einer
Vereinsverwaltung an. Damit stehen die Bibliothek, eigene Übungen und Trainings und ein
KI-Assistent offen; Teams, Spielerlisten und Kalender gibt es erst in einem Verein. Unter „Teams"
findet ein solches Konto den Einstieg, um einen Verein zu gründen oder sich mit der eigenen
E-Mail-Adresse in einen aufnehmen zu lassen (siehe [Verein](verein.md#einstieg-für-konten-ohne-verein)).
Ein Konto ohne Verein besitzt höchstens 50 eigene Übungen und 30 eigene Trainings (siehe
[Übungen](uebungen.md#konten-ohne-verein) und [Trainings](trainings.md#konten-ohne-verein)). Die
Grenzen fallen weg, sobald die Person einem Team oder einer Vereinsverwaltung angehört, und gelten
wieder, sobald sie keinem mehr angehört — etwa nach dem Verlassen des letzten Teams oder wenn der
Verein gelöscht wird; was sie dann schon besitzt, bleibt und bleibt änderbar.

## KI-Assistent verbinden

Ein KI-Assistent wie Claude lässt sich mit dem eigenen Konto verbinden. Er kann dann im
Gespräch im Übungsbestand suchen und einzelne Übungen mit allen Angaben abrufen — denselben
Bestand, den man auch selbst in der Anwendung sieht, mit denselben Filtern und denselben Werten
für Altersstufe, Trainingsteil und die übrigen Angaben. Private Übungen anderer bleiben auch
dem Assistenten verborgen.

Eigene Übungen beider Altersstufen legt der Assistent ebenfalls an. Für ein Konto ohne Verein gilt
dabei dieselbe Grenze wie in der Anwendung, beim Anlegen wie beim Kopieren von Übungen und beim
Anlegen und Übernehmen von Trainings: Ist sie erreicht, entsteht nichts, und der Assistent bekommt
denselben Bestand genannt, etwa „Du besitzt 50 von 50 Übungen. In der Anwendung schaffst du durch
Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.", und dass nichts
entstanden ist; ein zweiter Versuch ändert daran nichts. Er erfährt dafür, welche
Angaben eine Übung der gewählten Altersstufe führt, welche davon je nach Einordnung und
Hauptteilkategorie Pflicht sind und welche Werte zulässig sind, und setzt dieselben Angaben wie
das Formular — ohne Foto; ein Feld-Diagramm kann er gleich mitgeben (siehe unten). Die Übung
entsteht als privater Entwurf unter den eigenen Übungen, und der Assistent bekommt die Adresse,
unter der sie sich in der Anwendung öffnen lässt. Es gelten dieselben Regeln wie im Formular, nur die Reaktion ist strenger: Wo das
Formular einen Wert gar nicht erst anbietet — eine Hauptteilkategorie ausserhalb des
Hauptteils, eine Erscheinungsform des anderen Manuals, eine Spielfeldgrösse auf dem Kleinfeld —,
fiele er dort still weg; beim Assistenten lehnt die Anwendung ab. Sie nennt dann jede verletzte
Angabe einzeln samt den zulässigen Werten, auch jede fehlende Pflichtangabe, und legt nichts
an; der Assistent korrigiert und schickt die ganze Übung noch einmal. Ist die Einordnung
ungültig oder fehlt im Hauptteil die Hauptteilkategorie, kann der nächste Versuch weitere
Verstösse nennen, die davon abhingen. Die Anzahl Spieler:innen
und die Mengen der Materialliste nimmt sie nur als ganze Zahlen an. Für jede Übung gelten die
Regeln ihrer Altersstufe: Eine Übung des Juniorenfussballs trägt in jedem Block eine Beschreibung
als Pflicht, keinen methodischen Fahrplan, keine Hauptteilkategorie und keinen Feldtyp;
Spielfeldgrösse und, in den Blöcken, die ihn kennen, der Übungstyp sind freiwillig. Den
Übungstyp nimmt sie im Kinderfussball gar nicht an, und eine Angabe der anderen Altersstufe
nennt sie wie jede andere verletzte Regel.

Ebenso ändert der Assistent eine eigene Übung beider Altersstufen. Er nennt nur, was sich
ändern soll; alles andere bleibt, wie es ist, und eine freiwillige Angabe entfernt er
ausdrücklich. Geprüft wird danach die ganze Übung mit denselben Regeln wie beim Anlegen; verletzt
sie eine, bleibt sie unverändert, und die Anwendung nennt jede verletzte Angabe. Wechselt die
Einordnung, löscht die Anwendung gespeicherte Angaben, die die neue Einordnung nicht kennt,
nicht still — sie nennt sie, und der Assistent entfernt sie ausdrücklich. Die Altersstufe
einer Übung wechselt er dabei nie — wie bei Trainings; das Überführen in die andere Altersstufe
gibt es nur in der Anwendung. Das Foto ändert er nicht, und eine Übung, die schon
in einem Training steht, behält dort ihre Fassung. Übungen aus dem Manual und die anderer
Trainer ändert er nicht; er erfährt, dass sie nicht die eigenen sind. Eine eigene Übung
schaltet der Assistent auch öffentlich und zieht sie wieder zurück, ohne
nachzufragen. Vorher weiss er, was das bedeutet: Die Übung wird mit allen Angaben, Bild und
Diagramm für alle sichtbar und trägt die Plakette „Community", einen Trainernamen zeigt sie
nicht. Zurückgezogen verschwindet sie aus dem öffentlichen Bestand; was andere schon in ihre
Trainings oder ihren Bestand übernommen haben, bleibt bestehen.

Jede Übung, die das Konto sieht — aus dem Manual, die öffentliche eines anderen Trainers oder
eine eigene —, kopiert der Assistent auch in den eigenen Bestand, nach denselben Regeln wie
„Übung kopieren" in der Anwendung: Es entsteht ein privater Entwurf mit allen Angaben, eigener
Kopie von Bild und Feld-Diagramm und derselben Altersstufe, ohne Verbindung zur Quelle. Nur die
Kopie einer eigenen Übung trägt den Zusatz „(Kopie)"; die einer Manual- oder fremden Übung
behält ihren Namen. Der Assistent bekommt die Adresse der Kopie und kann sie danach ändern wie
jede eigene Übung. Scheitert das Kopieren, bleibt nichts zurück.

Das Feld-Diagramm einer eigenen Übung beider Altersstufen setzt der Assistent ebenfalls, oder er
ersetzt ein vorhandenes als Ganzes; beim Anlegen kann er es gleich mitgeben, dann aber ohne
gezählte Materialliste — die zählt die Anwendung selbst, eine freie Ergänzung ist weiterhin
möglich. Welche Elemente, Farben, Drehungen und Posen ein Diagramm führen kann, wie gross die
Zeichenfläche ist und wo die Figuren ihre Hände haben, erfährt er vorher. Die Anwendung nimmt ein
Diagramm nur an, wenn es dieselben Grenzen einhält wie ein in der Maske gezeichnetes (siehe [Übungen](uebungen.md#feld-diagramme)); sonst lehnt sie ab, nennt
jedes betroffene Element samt Grund und speichert nichts. Beim Anlegen stehen diese Gründe in
derselben Rückmeldung wie die zu den übrigen Angaben, und die Übung entsteht nicht. Mit dem
Diagramm ersetzt die Anwendung die gezählte Materialliste durch die aus dem Diagramm gezählte und
nennt sie dem Assistenten; die freie Ergänzung bleibt. Hatte die Übung kein Bild, wird das
Diagramm ihr Bild; ein vorhandenes Foto bleibt das angezeigte Bild. In der Anwendung liegt das
Diagramm danach wie jedes andere zum Weiterzeichnen bereit, und die Fassungen der Übung in
Trainings bleiben unverändert.

Mit dem Ergebnis des Setzens — auch beim Anlegen — meldet die Anwendung dem Assistenten jeden
inhaltlichen Mangel einzeln, mit dem betroffenen Element und wie er sich beheben lässt: etwa ein
Leibchen neben einer Figur, aber nicht an deren Hand, ein Tor an der Feldkante, das vom Feld weg
öffnet, ein Symbol, dessen Rahmen über den Rand ragt, einen leeren Text oder eine Angabe, die das
Element nicht vorsieht. Ein Mangel hindert nichts: Das Diagramm ist gespeichert, und der
Assistent setzt es korrigiert neu. Die Mängel des Diagramms einer eigenen Übung ruft er
ausserdem jederzeit ab, auch eines, das in der Anwendung gezeichnet wurde; ein älteres Diagramm
nennt dabei auch, was die Anwendung heute nicht mehr annähme.

Der Assistent kann ausserdem Trainings beider Altersstufen anlegen — mit Name, Altersstufe,
Alterskategorien und auf Wunsch einem Ziel — und ihnen Übungen zuordnen. Das Training entsteht
als privater Entwurf im eigenen Bestand und sieht in der Anwendung genauso aus, als hätte man es
selbst zusammengestellt. Die Altersstufe steht danach fest; eine Alterskategorie der anderen
Altersstufe lehnt die Anwendung ab und nennt die zulässigen. Dabei gelten dieselben Regeln wie in
der Anwendung: Zu einem Trainingsteil oder Block bietet der Assistent nur an, was dort
hineinpasst, im Kinderfussball-Hauptteil passend zur gewählten Hauptteilkategorie, und er
erfährt, ob der Bestand dafür gar nichts führt oder nur die Suche zu eng war. Jede zugeordnete
Übung kommt als eigene Kopie samt Bild und Diagramm ans Ende ihres Teils bzw. Blocks; dieselbe
Übung darf mehrfach vorkommen. Eine Übung der anderen Altersstufe nimmt kein Training an. Passt
eine Übung nicht, nennt die Anwendung dem Assistenten die verletzte Regel, damit er sich ohne
Rückfrage korrigieren kann, und die bisherigen Zuordnungen bleiben stehen.

Welche Teile und Blöcke eine Altersstufe kennt, muss der Assistent nicht selbst wissen: Er ruft
das Schema ab — im Kinderfussball die vier Trainingsteile mit den drei Hauptteilkategorien, im
Juniorenfussball Auffangen, Einstieg, Hauptteil und Abschluss mit ihren sieben Blöcken, jeweils
in ihrer Reihenfolge, dazu, wo eine Dauer erfasst wird, wo Gruppen durchlaufen, welche Blöcke
ein öffentliches Training braucht und welche leer einen Hinweis tragen. Im Juniorenfussball gibt
es keine Hauptteilkategorie, und der Assistent ordnet eine Übung genau dem Block zu, den er
wählt. Das Aufwärmen und die Explosivität bieten wie in der Anwendung auch Übungen an, die deren
Inhalt als Erscheinungsform tragen, gleich wo sie eingeordnet sind. Spielfeldgrösse und Übungstyp
einer Junioren-Übung kommen aus der Vorlage mit. Zu jedem Teil und Block nennt die Anwendung den
Zeitrichtwert des Manuals und, sobald eine Dauer erfasst ist, die Abweichung davon, dazu die
vorgesehenen 90 Minuten; das ist Orientierung, keine Bedingung. Das Auffangen trägt in beiden
Altersstufen weder Dauer noch Richtwert. Weil es für den Juniorenfussball keinen kuratierten
Übungsbestand gibt, sind dort anfangs oft nur die eigenen Übungen sichtbar; bleibt ein Block
leer, erfährt der Assistent das benannt, statt dass er ausweicht.

Bestehende Trainings kann der Assistent überarbeiten, gleich welcher Altersstufe. Er sucht die
eigenen Trainings oder die öffentlichen der Community nach Namen und Alterskategorie und ruft
ein Training vollständig ab: alle Angaben, alle Teile und Blöcke wie im Editor, auch die
leeren, den Hauptteil einmal je Variante, und jede Übung mit Inhalt, Dauer, Notiz und den
Gruppen ihres Durchlaufs. Ändern kann er Name, Ziel und Alterskategorien — mindestens eine
bleibt; Übungen, die danach zu keiner Kategorie mehr passen, bleiben im Training und werden ihm
genannt. Er setzt und entfernt die Dauer einer Übung (nicht im Auffangen), hält Notizen fest
oder leert sie und entfernt Übungen; dabei erfährt er, welche Gruppen ihren Durchlauf tragen
und ob eine Notiz mitfällt. Anders als die Anwendung, die eine Übung jeweils um einen Platz
verschiebt, legt der Assistent die Reihenfolge eines ganzen Abschnitts in einem Zug fest. Ein
Abschnitt ist ein Trainingsteil bzw. Block, im Kinderfussball-Hauptteil zusätzlich eine
Hauptteilkategorie und im Hauptteil beider Altersstufen eine Variante. Der Assistent muss dafür
alle Übungen des Abschnitts nennen, sonst ändert sich nichts und er erfährt, welche fehlen oder
nicht dazugehören. Den Inhalt einer Übung, ihren Trainingsteil oder die Altersstufe eines
Trainings ändert er nicht. Ein Training, das jemand anderem gehört und öffentlich ist, darf er
lesen, aber nicht ändern, und bekommt genau das gesagt; ein Training, das er nicht sehen darf,
gilt als nicht gefunden — ob es fehlt oder jemand anderem gehört, bleibt offen.

Auch Gruppen und ihren Durchlauf durch den Hauptteil führt der Assistent. Er legt Gruppen an,
benennt sie um und entfernt sie — mit denselben Regeln wie in der Anwendung: nicht leer,
höchstens vierzig Zeichen, im Training nur einmal vergeben. Neue Gruppen stehen hinter den
bestehenden; die Reihenfolge der Gruppen ändert er nicht. Für jede Übung des Hauptteils legt er
fest, welche Gruppen sie in welcher Abfolge durchlaufen, und ersetzt dabei den bisherigen
Durchlauf ganz; ein leerer Durchlauf heisst wie in der Anwendung, dass alle gemeinsam üben. Eine
Gruppe eines anderen Trainings, dieselbe Gruppe zweimal oder eine Übung ausserhalb des
Hauptteils lehnt die Anwendung ab und nennt die Regel. Den Durchlauf des ganzen Hauptteils ruft
er je Variante auf einmal ab: jeden Wechsel mit der Belegung der Übungen und je Gruppe die
zugewiesene Zeit; im Juniorenfussball zählen die Wechsel über beide Hauptteil-Blöcke durch. Er
sieht auch, an wie vielen Übungen eine Gruppe steht — eine Gruppe entfernt er ohne Rückfrage,
und sie verschwindet dabei aus jedem Durchlauf.

Auch die Varianten des Hauptteils führt der Assistent. Er legt eine weitere an — wie in der
Anwendung stets als Kopie einer bestehenden, samt Übungen, Notizen, Bildern, Diagrammen und
Gruppen im Durchlauf; nennt er keine, kopiert er die vorderste. Beim Anlegen der zweiten kann er
die bisherige mitbenennen; bis dahin trägt sie unsichtbar den Namen „Variante 1", und benennt er
sie nicht, steht dieser Name danach sichtbar da. Er benennt
Varianten um, nach denselben Regeln wie Gruppen, und entfernt sie ohne Rückfrage samt ihren
Übungen; bleibt dabei eine einzige übrig, wird sie wie in der Anwendung aufgelöst. Die letzte
Variante lässt sich nicht entfernen. Anders als die Anwendung, die eine Variante jeweils um einen
Platz verschiebt, legt er ihre Reihenfolge in einem Zug fest und nennt dafür alle; die vorderste
gilt beim Öffnen. Führt ein Training mehrere Varianten, sagt der Assistent beim Zuordnen einer
Übung im Hauptteil und beim Ordnen eines Hauptteil-Abschnitts, welche er meint; ohne diese Angabe
lehnt die Anwendung ab und nennt die Varianten.

Zu jedem Training, das er lesen kann, ruft der Assistent auf einmal alle fachlichen Hinweise ab,
die die Anwendung dazu zeigt, im selben Wortlaut: was zum Veröffentlichen noch fehlt (nur beim
eigenen persönlichen Training, weil nur dort veröffentlicht wird), eine Gruppe, die im selben
Wechsel an mehreren Übungen steht, ungleich lange Übungen eines Wechsels, Abweichungen vom
Zeitrichtwert an Teil, Block und Gesamtdauer samt Richtung (nur im Juniorenfussball), leere
Blöcke, die einen Hinweis tragen, ungewöhnlich viele Übungen in einem Trainingsteil (nur im
Kinderfussball), Übungen ohne erfasste Dauer und Übungen, die keine Alterskategorie des
Trainings abdecken. Jeder Hinweis nennt seine Stelle — Trainingsteil, Block oder
Hauptteilkategorie, bei mehreren Varianten die Variante, dazu die betroffenen Übungen, die Gruppe
und die Wechsel —, damit der Assistent ihn ohne Rückfrage beheben kann. Hinweise sind keine
Fehler: Nur die Veröffentlichungsbedingungen sperren etwas, und zwar das Veröffentlichen; alles
andere ist Orientierung. Das Abrufen ändert am Training nichts.

Ein eigenes persönliches Training kann der Assistent veröffentlichen und wieder auf Entwurf
setzen. Er fragt dafür nicht nach, gibt aber vorher Auskunft: Die Hinweise zeigen, ob alle
Bedingungen erfüllt sind, und er weiss, dass das Training danach für alle sichtbar ist und der
eigene Anzeigename als Urheber daran steht; nach dem Veröffentlichen nennt er diesen Namen.
Es gelten dieselben Bedingungen wie in der Anwendung. Fehlt etwas, lehnt die Anwendung ab und
nennt jede fehlende Bedingung einzeln; ergänzt wird nichts von selbst. Es entsteht keine Kopie:
Das Training bleibt bearbeitbar, und solange es öffentlich ist, weist die Anwendung auch beim
Assistenten jede Änderung ab, die es unter die Bedingungen brächte. Auf Entwurf gesetzt,
verschwindet es aus dem öffentlichen Bestand; bereits übernommene Kopien anderer bleiben
bestehen. Ein Team-Training lässt sich nicht veröffentlichen, ein fremdes Training weder
veröffentlichen noch zurückziehen.

Der Assistent kann ausserdem ein Training übernehmen: ein öffentliches der Community, das er
über die Suche im öffentlichen Bestand findet und vorher vollständig abrufen kann, oder ein
eigenes, das so eine zweite, unabhängige Fassung bekommt. Wie beim Übernehmen in der Anwendung
entsteht eine private Kopie im persönlichen Bestand, in derselben Altersstufe und samt Ziel,
Übungen, Bildern, Diagrammen, Varianten, Gruppen, Durchlauf und Notizen; die Quelle bleibt
unberührt, und dasselbe Training lässt sich beliebig oft übernehmen. Scheitert das Kopieren mit
einer Meldung, räumt die Anwendung weg, was schon entstanden war, und sagt dem Assistenten,
dass nichts entstanden ist und er es gefahrlos wiederholen kann — oder, falls auch das Aufräumen
scheiterte, welche unvollständige Kopie stehen blieb. Ein eigenes Training oder eines der
eigenen Teams kann der Assistent auch löschen. Er fragt dafür nicht nach, weiss aber vorher, wie
viele Übungen es trägt und ob es öffentlich ist, und nennt danach, was mitging. Das Training
verschwindet samt Übungen und Bildern, ein öffentliches zugleich aus dem öffentlichen Bestand;
Kopien, die andere übernommen haben, bleiben. War ein Team-Training einem Termin zugeordnet,
bleibt der Termin ohne Training im Kalender des Teams, und der Assistent erfährt, welcher. Ein
fremdes Training lässt sich nicht löschen.

Auch in den eigenen Teams arbeitet der Assistent. Er nennt die Teams, in denen man Mitglied ist,
mit Namen, Mitgliederzahl und dem Namen ihres Vereins. Gehört man keinem Team an, ist die Liste
leer, und er erfährt warum: Teams, Spielerlisten und Kalender stehen nur Mitgliedern eines Teams
offen; der Vereinsverwaltung sagt er dazu, wie sie sich in der Anwendung selbst in ein Team
aufnimmt. Er nennt die Mitglieder eines Teams mit ihrem Anzeigenamen und einer
Kennung — nie mit der E-Mail-Adresse —, wobei er erfährt, welches davon man selbst ist. Er sucht
im Trainingsbestand eines Teams wie im eigenen — Termin-Trainings stehen nicht darin, die nennt
der Kalender —; ein älteres Bestands-Training, das einem Termin zugeordnet ist, nennt dabei
diesen Termin samt Zeit, Ort, Trainer:innen, Feldern und erwarteter Spielerzahl. Ein Training legt er auf Wunsch
direkt im Team an, stellt ein eigenes Training als Kopie ins Team oder übernimmt ein
Team-Training als Kopie in den persönlichen Bestand; das Original bleibt jeweils, wie es ist,
und ein Termin geht nie mit. Team-Trainings überarbeitet er mit denselben Möglichkeiten wie
persönliche; veröffentlichen lassen sie sich nicht.

Den Kalender eines Teams führt der Assistent nach denselben Regeln wie der
[Team-Bereich](team-bereich.md#der-kalender-des-teams). Er ruft ihn ab, bereits getrennt in
Anstehendes und Vergangenes; die Grenze liegt wie im Team-Bereich am heutigen Tag in der
Schweiz, die Einheit von heute zählt noch zum Anstehenden, und der Assistent muss nicht selbst
rechnen. Auf Wunsch beschränkt er die Auskunft auf einen Zeitraum, dessen Von- und Bis-Tag
beide mitzählen und der höchstens bis zum gleichen Kalendertag im Folgejahr reicht, und auf die
Termine, an denen man dabei ist, oder auf alle, zu denen man eingeladen ist; ein Zeitraum ohne Termine ergibt eine leere
Auskunft. Jeder Termin nennt Datum, Beginn, Ende, Ort samt Kartenlink, Bemerkung und Hinweis am privaten Link, bei einem Training den
Treffpunkt mit Uhrzeit und Ort, die Felder des Platzes je
mit Grösse, Toren je Torart und Untergrund, die erwartete Spielerzahl, sein Training oder dass er
keines trägt, seine Trainer:innen — wer eingeladen, wer dabei ist, wer wann abgesagt hat und wer
verantwortlich ist —, die Mindestbesetzung und wie viele sie verlangt, ob er ausgefallen ist und
aus welchem Grund, und bei
einem Serientermin die Serie und die Angaben, in denen er von ihr abweicht — Felder,
Spielerzahl und Treffpunkt eingeschlossen. Zu jeder Serie erfährt er Wochentage, Zeitraum, Zeit, Ort samt Kartenlink,
Treffpunkt, Bemerkung, Hinweis am privaten Link, Trainer:innen, Mindestbesetzung, Felder und erwartete Spielerzahl. Dabei unterscheidet er bei jeder
Angabe zu Platz und Spielerzahl, ob sie unbekannt ist oder ob ausdrücklich nichts da ist: Ein
Termin ohne Felder hat einen unbekannten Platz, eine leere Grösse, Toranzahl oder
Untergrundangabe gilt als unbekannt, ebenso eine nicht erfasste Spielerzahl; 0 Tore einer
Torart heisst dagegen, dass keine dastehen. Jeder Termin sagt zudem, ob er ein Training oder ein
Spiel ist; ein Spiel nennt seine Bezeichnung, Mindest- und Höchstzahl, die Meldefrist, die
Treffpunkte und, wurde es verlegt, den zuletzt gültigen Zeitpunkt davor. Ein anstehendes
Training ohne Inhalt, das nicht ausgefallen ist, gilt auch für ihn als noch nicht vorbereitet, ein
Spiel nie.

Er legt einzelne Termine fest — Datum, Beginn und Ende sind auch hier Pflicht, Felder und erwartete
Spielerzahl wie in der Anwendung freiwillig, und jeder neue Termin nennt, ob er ein Training oder
ein Spiel ist. Ein Spiel legt er wie in der Anwendung mit Bezeichnung und einem Anpfiff fest, der
noch bevorsteht, auf Wunsch mit Mindest- und Höchstzahl, Meldefrist und Treffpunkten, die er stets
als ganze Liste angibt; Felder und erwartete Spielerzahl weist die Anwendung an einem Spiel ab. Dazu
kommen wöchentliche Terminserien, immer aus Trainings, mit Wochentagen, Zeitraum, Zeit, Ort samt Kartenlink,
Treffpunkt, Bemerkung, Hinweis am privaten Link, Trainer:innen, Mindestbesetzung, Feldern und erwarteter Spielerzahl; eine erwartete Zahl weist die
Anwendung wie dort ab, solange das Team eine Spielerliste führt, ausser an einem Termin, der schon
begonnen hat. Den Kartenlink gibt er wie in der Anwendung nur mit einem Ort an, mit https:// und
höchstens 500 Zeichen; ändert er den Ort ohne neuen Link, fällt der bisherige weg, und die Antwort
sagt ihm das, ebenso wenn ein Termin, der wieder der Serie folgt, seinen eigenen Link verliert.
Dass Spieler:innen und Eltern den Hinweis am privaten Link sehen und die Bemerkung nicht, sagen ihm die Werkzeuge wie
die Hinweise in der Anwendung; einen Hinweis entfernt er wie dort, an einem einzelnen Serientermin
mit derselben Wirkung: Der Termin weicht ab und ist bewusst ohne.
Einem Training und einer Serie gibt er wie in der Anwendung einen Treffpunkt aus Uhrzeit und Ort,
am Tag des Trainings und nicht nach dem Beginn, den Ort höchstens 100 Zeichen lang; er ändert ihn und
entfernt ihn, an einem einzelnen Serientermin ebenfalls als bewusst ohne. Die Werkzeuge sagen ihm wie
der Hinweis hinter dem ⓘ, dass Spieler:innen und Eltern den Treffpunkt sehen und dass er beim Verlegen seinen
Abstand zum Beginn behält; einem Spiel gibt er statt dessen Treffpunkte je Anreiseart. Läge der
Treffpunkt nach einer Zeitänderung am Vortag, entfällt er an denselben Terminen wie in der
Anwendung, aber ohne Rückfrage; die Antwort nennt die Daten dieser Termine. Er ändert und entfernt Termine; bei einem Serientermin muss er sagen, ob es nur für
diesen, für diesen und alle folgenden oder für alle Termine der Serie gilt, sonst lehnt die
Anwendung ab. Felder gibt er dabei stets als ganze Liste an, die die bisherige ersetzt; Felder und
Spielerzahl entfernt er auch wieder, an einem einzelnen Serientermin mit derselben Wirkung wie in
der Anwendung: Der Termin weicht dann ab und gilt als unbekannt. Eine abweichende Angabe lässt er
wieder der Serie folgen, Felder, Spielerzahl, Hinweis am privaten Link und Treffpunkt eingeschlossen, das Datum ausgenommen. Er ordnet
Terminen Trainings zu — aus dem Bestand des Teams, das Training eines anderen Termins oder ein
eigenes persönliches Training jeder Altersstufe —, ersetzt und löst sie. Wie in der Anwendung
bekommt der Termin dabei immer still eine eigene Kopie, ein Termin-Training, das nicht in den
Bestand kommt und mit seinem Termin lebt: Löst er es, ersetzt es oder entfällt der Termin, wird es
gelöscht. Er lädt Trainer:innen ein und aus, gibt die Verantwortung weiter, sagt für Trainer:innen ab und
wieder zu — eine Verantwortliche nur, wenn er sagt, wer übernimmt, oder sonst niemand dabei ist
—, ohne Angabe beim Festlegen mit allen Mitgliedern eingeladen und sich selbst verantwortlich,
lässt Termine ausfallen, setzt,
ändert oder leert den Grund und nimmt einen Ausfall zurück. Ein Training ohne bestehenden Termin auf
ein Datum zu setzen, gibt es auch beim Assistenten nicht mehr; er legt zuerst den Termin fest und
ordnet das Training dann zu.

Auch die Spielerliste eines Teams führt der Assistent nach den Regeln des
[Team-Bereichs](team-bereich.md#spielerliste). Er liest sie mit Vorname, Nachname, Jahrgang,
J+S-Nummer und den Stand des privaten Links jeder Spieler:in — „abgeholt", „zugestellt" oder „offen" —, dazu den Verein des Teams, je
Spieler:in die Namen ihrer weiteren Teams und ob nach dem letzten bekannten Stand mindestens ein
Gerät Mitteilungen aufs Mobile für sie eingeschaltet hat — nur ja oder nein, ohne Zusicherung, dass
sie ankommen; Geräte und Adressen erfährt er nie, und neu zustimmen muss dafür niemand; die Liste des ganzen Vereins liest er nicht. Er nimmt
Spieler:innen auf und ändert sie. Mit „spieler_aus_team_nehmen" nimmt er eine Spieler:in aus einem
der eigenen Teams, aber erst nach einer Rückfrage: Der erste Aufruf ändert nichts und liefert
dieselben Sätze wie die Bestätigung in der Anwendung — sie bleibt samt Link im Verein und in ihren
weiteren Teams, was im Team verfällt, beim letzten Team, dass sie danach keinem Team mehr
angehört —, beim letzten der eigenen Teams mit ihr dazu, dass sie danach über den Assistenten
nicht mehr erreichbar ist; erst der zweite Aufruf nimmt sie heraus. Hat sich die Lage inzwischen
geändert, geschieht nichts, und er fragt neu. Löschen kann er keine Spieler:in; das macht nur die
Vereinsverwaltung in der Anwendung. Beim ersten Aufnehmen erfährt er, wie viele anstehende Termine ihre erwartete Zahl
verloren. Jeder Termin, den er nennt, trägt neben der erwarteten Zahl die Spielerzahl, mit der
geplant wird, samt Quelle: aus der Spielerliste mit den Angemeldeten — ab Beginn den Anwesenden
— und allen auf der Liste, erwartet oder unbekannt — unbekannt auch an einem ausgefallenen
Termin. Für einen einzelnen Termin erfährt er, wer angemeldet und wer abgemeldet ist und seit
wann — Datum und Uhrzeit des letzten Wechsels, auch an vergangenen Terminen —, ob es schon der
Stand bei Beginn ist und ab Beginn, wer nicht erschienen oder doch erschienen ist und wie viele
da waren. Er meldet ab und wieder an und trägt ab Beginn nach, ob eine Spieler:in da war, und
nennt dafür Datum und Beginn, wie er den Termin zuletzt gelesen hat; wurde er inzwischen
verlegt, weist die Anwendung mit dem neuen Stand ab.

Das Schnuppertraining führt der Assistent nach denselben Regeln (siehe
[Team-Bereich](team-bereich.md#schnuppertraining)): Mit „schnuppertraining_abrufen" und
„schnuppertraining_festlegen" liest er die Anzahl Schnuppertrainings und das Info-Schreiben eines
Teams und legt beides fest oder ändert es — ein leeres Info-Schreiben entfernt es, ohne Angabe
bleibt es stehen —, und mit „spieler_schnuppern_setzen" schaltet er das Schnuppern einer
Spieler:in ein und aus. Einschalten geht nur, solange sie genau einem Team angehört. Lässt das
Einschalten Abmeldungen, Meldungen oder Kennzeichnungen verfallen, kommt zuerst eine Rückfrage mit
ihrer Zahl, und er muss das Einschalten ausdrücklich bestätigen. In der Spielerliste erfährt er je
schnuppernder Spieler:in die Anzahl, wie viele Schnuppertrainings sie besucht hat, für wie viele
sie angemeldet ist und wie viele über den Link noch möglich sind, am Termin, wer schnuppert.
Meldet er eine schnuppernde Spieler:in über die Anzahl hinaus an, erhält er denselben Hinweis wie
die Oberfläche. Zum Schnuppern einem Team zuordnen kann er niemanden.

Die Infos zum Team (siehe [Team-Bereich](team-bereich.md#infos-zum-team)) liest der Assistent mit
„team_infos_abrufen" samt dem Tag der letzten Textänderung und verfasst, ändert oder entfernt sie
mit „team_infos_festlegen". Er übergibt dabei immer den ganzen Text — für eine Änderung liest er
ihn zuerst —, und ein leerer Text entfernt die Infos. Er gliedert mit denselben Zeichen wie die
Leiste in der Anwendung, und es gilt dieselbe Grenze von 10'000 Zeichen samt Gliederung mit
demselben Hinweis. Spieler:innen und Eltern sehen die neue Fassung beim nächsten Öffnen ihres Links; frühere
Fassungen bleiben auch hier nicht erhalten.

An einem Spiel erfährt der Assistent für jede Spieler:in ihre Meldung oder dass sie noch ohne
Meldung ist, ob sie als nicht aufgeboten gekennzeichnet ist und ob sie die Meldefrist verpasst
hat, dazu die Zahl der Angemeldeten, der noch ohne Meldung, der mit verpasster Meldefrist und der
nicht Aufgebotenen sowie Mindest- und Höchstzahl und die Meldefrist. Wie die Zahl zum Richtwert
steht, sagt ihm die Anwendung nicht; das beurteilt er selbst. Er meldet Spieler:innen für Spiele
an und ab — wie ein Mitglied bis zum Anpfiff, auch nach der Meldefrist —, kennzeichnet sie als
nicht aufgeboten und hebt das auf und trägt ab dem Anpfiff nach, wer nicht oder doch erschienen
ist, jeweils mit Datum und Anpfiff, wie er das Spiel zuletzt gelesen hat. Er holt den privaten
Link einer Spieler:in und erneuert ihn in zwei Schritten: Der erste Aufruf von
„spieler_link_erneuern" ändert nichts und nennt die Teams, für die der bisherige Link endet und der
neue gilt, und dass die Mitteilungen aufs Mobile enden; erst mit der ausdrücklichen Bestätigung erneuert er. Mit „spieler_link_zugestellt" markiert er den Link als zugestellt oder nimmt die Markierung zurück, wenn jemand ihn ausserhalb von KiFu weitergegeben hat — ohne Rückfrage und nur, solange er nicht abgeholt ist; ein abgeholter Link bleibt unverändert, und der Assistent erfährt das. Den Stand erfährt er mit der Spielerliste und beim Holen des Links; ein erneuerter Link ist wieder offen, und wer ihn über die Abholadresse holt, hat ihn abgeholt. Er sieht, ob die Selbstabholung eingeschaltet ist, schaltet sie
ein und aus und holt und erneuert die Abholadresse. Vor- und Nachnamen, Jahrgänge und
J+S-Nummern der Spieler:innen, wann sie sich ab- und angemeldet haben, ihre Meldungen zu Spielen,
wer nicht aufgeboten und wer nicht oder doch erschienen ist, ihre privaten Links und die
Abholadresse gelangen damit zum Anbieter
des verbundenen Assistenten.

Damit er den Platzbedarf einer Übung mit den Feldern eines Termins vergleichen kann, erfährt der
Assistent mit den zulässigen Werten auch die Richtmasse von Kleinfeld und Grossfeld je
Alterskategorie des Kinderfussballs, festgelegt nach den SFV-Ausführungsbestimmungen Kinder- und
Jugendfussball 2026/27: Kleinfeld in G ca. 20 × 15 m, in F ca. 25 × 20 m und in E 25–30 ×
20–25 m, Grossfeld in F ca. 30 × 25 m und in E 43–48 × 25–30 m. Die Bestimmungen kennen in G kein
Grossfeld; dort gilt das Richtmass von F. Er erfährt dazu, dass Kleinfeld und Grossfeld nach den
Toren einer Übung eingestuft sind und nicht nach ihrer Fläche, dass ein grosses Tor einer
Kinderfussball-Übung ein 5-m-Tor (5 × 2 m) meint und dass ein freies Feld ohne Meterangabe keine
bekannte Grösse hat. Der Juniorenfussball kennt weder Feldtyp noch diese Zuordnung; dort ist die
freiwillige Spielfeldgrösse der Platzbedarf einer Übung. Ob ein Training zu Platz und
Spielerzahl eines Termins passt, beurteilt der Assistent aus diesen Angaben selbst.

Es gelten dieselben Regeln wie in der Anwendung, und abgewiesen wird mit denselben Sätzen.
Nachfragen muss der Assistent meist nicht: Er entfernt, ersetzt, löst und lässt ausfallen ohne
Bestätigung, ebenso entfernt er Kader und erneuert die Abholadresse. Ausgenommen sind das
Herausnehmen von Spieler:innen und das Erneuern eines privaten Links (siehe oben) und Änderungen und Entfernungen einer Serie für folgende oder alle Termine, die vergangene Termine
erfassen oder entfallen lassen: Die führt die Anwendung erst aus, wenn der Aufruf das ausdrücklich
bestätigt, und nennt vorher, wie viele vergangene Termine es trifft. Ebenso verlangt sie eine
Bestätigung, wenn eine Änderung von Datum oder Beginn Abmeldungen verfallen lässt — am einzelnen
Termin, über die Serie oder wenn die Zeit wieder der Serie folgt —, und nennt vorher, wie viele;
nach einer Änderung erfährt der Assistent, wie viele verfallen sind. Bei einem Spiel verlangt sie
die Bestätigung, wenn ein anderes Datum Meldungen oder Kennzeichnungen als nicht aufgeboten
verfallen lässt, wenn eine Verlegung Nachträge verfallen lässt oder die Meldefrist ins Abgelaufene
rückt, und beim Entfernen eines Spiels, das Meldungen oder Kennzeichnungen trägt.
Beim Erfassen eines Spiels, beim Ausfallen lassen und
Zurücknehmen eines Ausfalls, beim Ändern von Datum, Zeit oder Ort eines Termins oder einer Serie,
wenn Zeit oder Ort wieder der Serie folgen, und beim Entfernen benachrichtigt der Assistent die
Spielervertretungen am privaten Link — wo eingeschaltet, auch als Mitteilung aufs Mobile — nach
denselben Regeln wie das Kästchen in der Anwendung, ohne
gegenteilige Angabe immer; abwählen muss es der Aufruf ausdrücklich. Danach erfährt er, wie viele
Spieler:innen eine Benachrichtigung erhielten, und, falls sie nicht entstanden ist, den Satz
„Gespeichert, aber die Benachrichtigung ist nicht entstanden." Was abgelegt ist und ob es gesehen
wurde, erfährt er nicht. Nach jedem Schritt
erfährt der Assistent, was geschehen ist — welche entfallenen Termine ein Training trugen und ob es
mit ihnen gelöscht wurde oder im Bestand blieb, welches Termin-Training beim Zuordnen entstand,
welches Training ein ersetztes oder gelöstes war und ob es gelöscht wurde und, falls eine
gescheiterte Kopie nicht ganz aufgeräumt werden konnte, was davon stehen blieb. Ein Team, in dem man
nicht Mitglied ist, gilt als nicht gefunden. Kalender-Abos — die der Mitglieder wie die am privaten
Link einer Spieler:in — holt, zeigt und widerruft der Assistent nicht. Verwalten kann er weder Teams
noch den Verein, auch nicht für eine Person der Vereinsverwaltung: Teams anlegen, umbenennen und
auflösen, Personen aufnehmen oder entfernen, Spieler:innen Teams zuordnen, aus dem Verein löschen
oder importieren und den Verein gründen, umbenennen oder löschen geht nur in der Anwendung. Damit legt
der Assistent Trainings beider Altersstufen an und führt sie samt dem Kalender der Teams weitgehend
wie die Anwendung; was ihm fehlt, steht unter den bekannten Grenzen.

Verbunden wird in zwei Schritten. Zuerst trägt man die Adresse `https://ki-fu.ch/api/mcp` in
den Assistenten ein; der Reiter „Verbindungen" im Konto nennt sie unter „KI-Assistenten" ebenfalls
und zeigt, eingeklappt, die zwei gängigen Wege: In
Claude Desktop oder auf claude.ai unter Einstellungen → Connectors als «Custom connector», in
Claude Code im Terminal mit dem dort genannten Befehl. Jeder andere Assistent, der Werkzeuge über
MCP einbindet, geht gleich. Der Assistent öffnet daraufhin im Browser eine Seite der Anwendung,
auf der man den Zugriff erlaubt oder ablehnt. Wer dort nicht angemeldet ist, meldet sich zuerst an und kommt danach auf dieselbe
Seite zurück, wo er weiterhin ablehnen kann. Ein Passwort oder einen Schlüssel muss man dem
Assistenten nie geben.

Die Seite zum Erlauben nennt, welcher Assistent anfragt, mit welchem Konto man angemeldet ist und
wohin es danach zurückgeht. Sie zählt auf, was ein Zugang künftig insgesamt darf — also auch das,
was erst mit späteren Erweiterungen dazukommt und heute noch nicht geht —, im Wortlaut der Seite:
„Übungen suchen und abrufen - den ganzen Bestand, den du auch in KiFu siehst"; „eigene Übungen samt
Feld-Diagramm anlegen, kopieren, ändern, öffentlich schalten und zurückziehen"; „Trainings anlegen,
überarbeiten, veröffentlichen, zurückziehen, übernehmen und löschen"; „Team-Trainings deiner Teams
führen und im Kalender deiner Teams Termine und Terminserien samt Platz, Treffpunkt, erwarteter
Spielerzahl, Kadern und Mindestbesetzung sowie Spiele mit Bezeichnung, Richtwert, Meldefrist und Treffpunkten festlegen, ändern und
entfernen, ihnen als Kopie Trainings aus dem Team oder deine persönlichen Trainings zuordnen und sie
wieder lösen, Trainer:innen einladen, ausladen, absagen und wieder zusagen und bestimmen, wer
verantwortlich ist, Ausfälle festhalten und zurücknehmen sowie die Termine eines Zeitraums
abrufen; bei neuen Spielen, Ausfällen und ihrer Rücknahme, Verlegungen und beim Entfernen jeweils
entscheiden, ob die Spielervertretungen am privaten Link benachrichtigt werden"; „die Anzeigenamen der Mitglieder deiner Teams lesen (ohne
E-Mail-Adressen)"; „die Spielerliste deiner Teams (Vorname, Nachname, Jahrgang, J+S-Nummer) einsehen
und führen, dazu den Verein deiner Teams und die Namen weiterer Teams einer Spieler:in sehen,
Spieler:innen aus einem deiner Teams nehmen (sie bleiben im Verein), Kader anlegen, umbenennen und
entfernen und ihnen Spieler:innen zuteilen, Spieler:innen ins Schnuppertraining nehmen und die
Anzahl Schnuppertrainings samt Info-Schreiben festlegen, die Infos zum Team für Spieler:innen und Eltern verfassen,
ändern und entfernen, Spieler:innen für Termine ab- und wieder anmelden, für Spiele an- oder abmelden und als nicht aufgeboten
kennzeichnen und sehen, wer angemeldet ist, wer an Spielen noch ohne Meldung ist und seit wann, ab
Beginn eines Trainings oder Spiels nachtragen, wer nicht oder doch erschienen ist, den privaten Link
einer Spieler:in holen, erneuern und als zugestellt markieren, die Selbstabholung ein- und ausschalten, die Abholadresse holen
und erneuern und sehen, welche Links abgeholt oder zugestellt sind". Nie erreichbar sind „deine Favoriten", „die
Verwaltung deiner Teams und deines Vereins (Verein gründen, umbenennen und löschen, Teams anlegen,
umbenennen und auflösen, Personen in Teams oder in die Vereinsverwaltung aufnehmen oder daraus
entfernen, Spieler:innen Teams zuordnen, Spieler:innen aus dem Verein löschen und Spielerlisten
importieren)" und „dein Konto selbst (Anzeigename, Passwort, Löschen)". Kommt eine dieser
Fähigkeiten dazu, muss man nicht erneut zustimmen; auch wer seinen Zugang erlaubt hat, bevor der
Kalender, Platz, Spielerzahl und Treffpunkt der Termine, die Spielerliste samt Abmeldungen, Links und
Selbstabholung, die Kader, die Spiele, das Schnuppertraining (früher Probetraining), der Verein
mit den weiteren Teams einer Spieler:in, die Infos zum Team, das Benachrichtigen der
Spielervertretungen oder das Markieren zugestellter Links dazukamen, führt ihn ohne neue Zustimmung. Weil jeder Assistent seinen Namen selbst angibt, warnt
die Seite, nur zu erlauben, wenn man das Verbinden eben selbst gestartet hat.

Beim Erlauben kann man dem Zugang einen eigenen Namen geben, etwa „Claude auf dem Laptop",
höchstens vierzig Zeichen. Vorgeschlagen ist der Name, den der Assistent selbst nennt; wer ihn
stehen lässt, sieht den Zugang später unter diesem Namen. Nach dem Erlauben geht es ohne
weiteres Zutun zurück zum Assistenten, der damit verbunden ist.

Ein Konto kann höchstens fünf Zugänge gleichzeitig haben. Ist die Grenze erreicht, sagt die
Seite das — „Widerrufe zuerst einen davon im Konto unter «Verbindungen» und starte das Verbinden
dann neu." — und führt mit „Zu den Verbindungen" in den gleichnamigen Reiter des Kontos, wo man
zuerst einen bestehenden Zugang widerruft; ablehnen geht weiterhin. Ein Assistent, der schon verbunden ist und sich neu anmeldet, zählt nicht doppelt.
Zusammen dürfen alle Zugänge eines Kontos höchstens 600 Aufrufe je Stunde auslösen; darüber
bekommt der Assistent den Grund und die Wartezeit genannt. Weitere Zugänge erhöhen diese Zahl
nicht.

Unter „KI-Assistenten" im Reiter „Verbindungen" des Kontos stehen, mit ihrer Zahl („2 von 5"),
alle Zugänge mit ihrem Namen und dem Tag der Erlaubnis, bei einem eigenen Namen zusätzlich der
Name des Assistenten. Jeder Zugang lässt sich einzeln widerrufen; das wirkt sofort, auch auf eine
noch laufende Sitzung, und die übrigen Zugänge bleiben bestehen. Von selbst verfällt ein Zugang
nicht. Gefragt, mit welchem Konto er verbunden ist, nennt der Assistent den Anzeigenamen und die
Adresse dieses Reiters, auf dem sich der Zugang widerrufen lässt.

## Kalender-Abos

Unter „Kalender-Abos" im Reiter „Verbindungen" des Kontos stehen alle gültigen Abos mit dem
Namen ihres Teams. Geholt wird ein Abo im Trainingsplan des Teams; was es liefert und wie es ins
Kalenderprogramm kommt, beschreibt der [Team-Bereich](team-bereich.md#kalender-abo). Der Dialog
des Abos verweist dafür auf „Konto › Verbindungen". Hier lässt sich der Link
jedes gültigen Abos jederzeit wieder anzeigen und kopieren — im selben Dialog wie im Team und mit
derselben Warnung, dass er persönlich ist. Ohne Abo steht ein Hinweis, wo man eines holt.

Jedes Abo lässt sich einzeln widerrufen, nach einer Bestätigung, die sagt, dass der Link danach
keine Termine mehr liefert und dass man sich im Team jederzeit einen neuen holen kann. Von
selbst erlischt ein Abo, wenn man das Team verlässt, daraus entfernt wird, das Konto löscht, die
Vereinsverwaltung das Team auflöst oder den Verein löscht. Ein erloschener Link liefert ab dem nächsten Abruf keine Termine mehr
und wird nie wieder gültig, auch nicht nach einer erneuten Aufnahme ins Team; der neue Link ist
ein anderer. Über einen KI-Assistenten lassen sich Abos weder holen noch einsehen noch
widerrufen.

## Ohne Konto

Der gesamte Übungsbestand und alle öffentlichen Trainings sind ohne Anmeldung
zugänglich — ansehen, durchsuchen, filtern, durchführen und drucken inbegriffen. Verwehrt
bleibt alles Eigene: Übungen und Trainings anlegen oder bearbeiten, favorisieren, Trainings
übernehmen, Teams. Die Chips „Meine Übungen" und „Meine Trainings" erscheinen gar nicht erst;
an der Stelle der Konto-Karte steht unten in der Seitenleiste „Nicht angemeldet", und ihr Menü
bietet nur „Anmelden", „Konto erstellen" und „Was ist neu". Wer eine geschützte Adresse direkt aufruft, landet bei der Anmeldung und wird danach dorthin
zurückgeführt, wo er hinwollte. Eine Ausnahme ist das Kalender-Abo: Das Kalenderprogramm ruft die Termine ohne
Anmeldung ab, denn der Link selbst ist die Berechtigung; der Verweis in einem Kalendereintrag
führt dagegen über die Anmeldung in den Trainingsplan. Ebenso ohne Konto gehen der private Link
einer Spieler:in, über den ihre Eltern oder sie selbst sie für Termine ab- und anmelden und ihre
Termine abonnieren, und die
Abholadresse eines Teams, über die Spieler:innen und Eltern diesen Link abholen (siehe
[Team-Bereich](team-bereich.md#privater-link)). Wer sie öffnet, wird weder angemeldet noch zum
Mitglied; im Browser bleibt vom privaten Link nur, welche Benachrichtigungen das Gerät gesehen hat,
wie oft es den Link besucht und wann es den Hinweis zum Ablegen als App geschlossen hat und, wer
Mitteilungen aufs Mobile einschaltet, das kleine Programm des Browsers, das sie zeigt (siehe
[Navigation](navigation.md#cookies)); von der Abholadresse bleibt nichts. Erreichbar ist nur, was zu
dieser einen Spieler:in bzw. zur Abholung gehört. Die Seite des privaten Links lässt sich als
eigene App ablegen (siehe [Team-Bereich](team-bereich.md#als-app-ablegen)).

## Konto löschen

Das Löschen ist unumkehrbar und verlangt eine ausdrückliche Bestätigung. Es folgt einer
einfachen Regel: Was privat war, verschwindet; was veröffentlicht war, bleibt der Allgemeinheit
erhalten, verliert aber jeden Bezug zur Person.

Konkret werden die Favoriten entfernt, die privaten Übungen samt ihren Feld-Diagrammen
gelöscht und die persönlichen Trainings mitsamt den Bildern ihrer Übungsfassungen. Öffentliche
Übungen und öffentliche Trainings bleiben bestehen, künftig ohne Urheberangabe.

Teams bleiben samt allen Trainings, Terminen und Spielerlisten unangetastet; die gelöschte
Person verschwindet nur aus der Mitgliederliste. War sie die letzte Trainer:in, bleibt das Team
ohne Trainer:in bestehen, bis die Vereinsverwaltung jemanden aufnimmt oder es auflöst.

Wie das Löschen ausgeht, hängt von der Lage im Verein ab; der Dialog kennt drei Fälle:

- **Frei.** Wer keinem Verein angehört, nur Trainer:in ist oder in der Verwaltung weitere
  Personen neben sich hat, löscht das Konto mit „Konto endgültig löschen". Der Dialog nennt dazu,
  dass Teams, in denen man die letzte Trainer:in ist, ohne Trainer:in bestehen bleiben, und „Gehörst
  du einem Verein an, bleibt er bestehen."
- **Letzte Verwaltung.** Ist man die letzte Person der Vereinsverwaltung und gehören dem Verein
  weitere Personen an, lässt sich das Konto noch nicht löschen. Der Dialog „Konto lässt sich noch
  nicht löschen" sagt, dass man die letzte Person in der Verwaltung ist und weitere dem Verein
  angehören, und nennt den Weg: zuerst jemanden in die Verwaltung aufnehmen oder den Verein unter
  Verein › Verwaltung löschen; „Zur Verwaltung" führt dorthin.
- **Einzige Person.** Gehört ausser einem selbst niemand dem Verein an, weder in der
  Verwaltung noch in einem seiner Teams, geht der Verein mit dem Konto. Der Dialog „Konto und Verein löschen"
  zählt auf, was mit dem Verein gelöscht wird — die Teams mit Terminen und Team-Trainings, die
  Spieler:innen samt Links, Abos und Abholadressen, je mit Anzahl —, sagt, dass sich das nicht
  rückgängig machen lässt, und verlangt den Vereinsnamen, genau mit Gross- und Kleinschreibung,
  bevor „Konto und Verein löschen" frei wird (siehe [Verein](verein.md#verein-löschen)).

Geprüft wird beim Ausführen erneut. Hat sich im Verein inzwischen etwas geändert — ist etwa eine
weitere Person dazugekommen, der Verein umbenannt oder man inzwischen die einzige Person —, löscht
die Anwendung nichts, sagt, was sich geändert hat, und verlangt gegebenenfalls den aktuellen
Vereinsnamen; Konto und Verein bleiben dann unverändert. Scheitert das Löschen, sagt der Dialog es,
und ein zweiter Versuch ist möglich. Sind die Daten schon gelöscht, lässt sich aber das Konto
selbst nicht entfernen, sagt er auch das; ein zweiter Versuch löscht dann das Konto.

Aus allen anstehenden Terminen und Terminserien wird die Person ausgeladen.
An vergangenen Terminen bleibt ihr Eintrag ohne Namen als „Ehemaliges Mitglied" stehen, auch in
Teams, die sie schon früher verlassen hatte. Ihre Kalender-Abos erlöschen; ein Hinweis darauf
steht nicht in der Bestätigung.

Alle KI-Zugänge werden entzogen; ein verbundener Assistent kommt danach nicht mehr ins Konto.

Abgegebenes Feedback (siehe [Navigation](navigation.md#fragen-und-feedback)) bleibt bestehen,
verliert aber den Bezug zum Konto; nach 12 Monaten wird es wie jedes Feedback gelöscht. Ebenso
bleibt Feedback bestehen, wenn ein Team oder Verein gelöscht wird, verliert dann aber den Bezug zum
Team.

## Bekannte Grenzen

Rollen gibt es nur zwei: Trainer:in eines Teams und Vereinsverwaltung (siehe
[Verein](verein.md#rollen-nach-ort)); innerhalb eines Teams dürfen alle Mitglieder dasselbe, und
eine weitere Abstufung, etwa eine nur lesende Rolle, gibt es nicht. Eine Person gehört höchstens
einem Verein an. Eine Einladung an jemanden ohne Konto ist nicht möglich — ins Team oder in die
Verwaltung kommt nur, wer bereits registriert und bestätigt ist. Ein Profilbild
ist nicht vorgesehen, und der Anzeigename lässt sich nicht mehr auf die automatische Kennung
zurücksetzen. Die eigene E-Mail-Adresse lässt sich vor den Mitgliedern der eigenen Teams und vor der
Vereinsverwaltung nicht verbergen, und wer beim Aufnehmen eine falsche, aber registrierte Adresse trifft, zeigt dieser
Person die Adressen aller Mitglieder, bis er sie wieder entfernt. Ob und wann ein Kalenderprogramm ein Abo zuletzt abgerufen hat, ist nicht
einsehbar, und einem Abo lässt sich kein eigener Name geben.

KiFu als App erhält keine Mitteilungen aufs Mobile — die gibt es nur für die Spielervertretungen am
privaten Link —, zeigt ohne Internetverbindung nichts an und steht in keinem App-Store. Links aus
E-Mails von KiFu, etwa zum Bestätigen der Adresse oder zum Zurücksetzen des Passworts, öffnen sich im
Browser, nicht in der abgelegten App. Die Farbe der Leiste des Mobiles folgt der Einstellung des
Geräts, nicht der unter „Darstellung" gewählten.

Ein KI-Zugang reicht so weit wie das Konto selbst; begrenzt wird er allein durch die
Fähigkeiten, die die Anwendung dem Assistenten anbietet, nicht durch eine abgestufte
Berechtigung. Den Namen, unter dem sich ein Assistent meldet, prüft niemand. Kommen mit einer
neuen Version Fähigkeiten dazu oder ändern sich welche, kennt ein bereits verbundener Assistent
sie erst, wenn er sich neu verbindet; die Anwendung meldet solche Änderungen nicht. Wer sich mitten im
Verbinden erst registriert, muss das Verbinden nach der Bestätigung der Adresse neu starten.
Wann und wie oft ein Zugang benutzt wurde, ist nicht einsehbar; was über ihn geschah, wird nicht
gesondert festgehalten, und der Name eines Zugangs lässt sich nach dem Erlauben nicht mehr
ändern. Die Grenze von fünf Zugängen gilt nur auf dem Weg über die Erlauben-Seite der
Anwendung; ein Zugang, der an ihr vorbei zustande käme, würde nicht mitgezählt. Ändert jemand
dasselbe Training oder dieselbe Übung gleichzeitig in der Anwendung, merkt das niemand; ein bereits offener
Browser-Tab zeigt eine Änderung des Assistenten erst nach dem Neuladen. Im Training ist eine
Änderung des Assistenten nicht von einer eigenen zu unterscheiden.

Einem Training ordnet der Assistent nur zu, was der Bestand hergibt; eine Übung, die dort
fehlt, legt er zuerst als eigene an, und den Inhalt einer zugeordneten Übung ändert er nicht.
Eigene Übungen legt, ändert und kopiert er je Vorgang genau eine, nie als unvollständigen
Entwurf; löschen kann er sie nicht. Eine Übung aus einem Training kopiert er nicht in den
eigenen Bestand — das geht nur in der Anwendung. Ein Feld-Diagramm setzt er nur als Ganzes
und nur an eigenen Übungen: Einzelne Elemente ändert er nicht, und entfernen kann er ein
Diagramm nicht. Das Diagramm sieht er nicht als Bild. Die gemeldeten Mängel betreffen einzelne
Elemente; ob das Diagramm die Übung fachlich richtig abbildet, beurteilt die Anwendung nicht, und
in der Anwendung selbst erscheinen diese Mängel nirgends. Fotos lädt er nicht hoch. Eine leere Variante legt der Assistent so wenig an wie die Anwendung, und eine
einzelne Übung kopiert oder verschiebt er nicht von einer Variante in eine andere. Anders als
der Dialog der Anwendung erzwingt der Weg über den Assistenten beim Anlegen der zweiten Variante
keinen neuen Namen für die bisherige. Die Reihenfolge
der Gruppen untereinander ändert er nicht. Die Favoriten erreicht er nicht, Teams und den Verein verwaltet er nicht, Spieler:innen
löscht oder importiert er nicht, Spieler:innen ohne Team und die Vereinsliste erreicht er nicht, und Kalender-Abos holt oder widerruft er nicht. Eine Übung überführt er nicht in die andere Altersstufe, und die Altersstufe eines Trainings wechselt er so
wenig wie die Anwendung. Für den Juniorenfussball gibt es keinen kuratierten Übungsbestand; ein
Block, zu dem der sichtbare Bestand nichts führt, bleibt leer und wird gemeldet. Die
Zeitrichtwerte erzwingt die Anwendung weder beim Speichern noch beim Veröffentlichen. Was im
Gespräch zur Sprache kommt — etwa ein Problem der Mannschaft —, hält das Training nicht fest.
Die Zahl der Spieler:innen steht am Termin — als erwartete Spielerzahl oder aus der Spielerliste —,
nicht am Training oder an einer Variante, und Spieler:innen lassen sich keiner Gruppe des
Trainings zuteilen; ob eine Übung oder ein Training zu ihr oder zum Platz des Termins passt,
prüft die Anwendung auch beim Assistenten nicht und meldet keine Unstimmigkeit — das Urteil
liegt bei ihm. Für eine Übung auf freiem Feld ohne Meterangabe und eine Junioren-Übung ohne
Spielfeldgrösse bleibt der Platzbedarf seine Einschätzung, und die Richtmasse von Klein- und
Grossfeld sind Richtwerte, keine Masse der einzelnen Übung. Einen eigenen KI-Assistenten bringt die Anwendung nicht
mit; man verbindet den, den man selbst nutzt.

Bricht ein Übernehmen durch den Assistenten ab, ohne dass die Anwendung einen Fehler bemerkt —
etwa durch eine Zeitüberschreitung oder einen Absturz mitten im Kopieren —, kann eine
unvollständige Kopie als eigenes Training stehen bleiben; sie ist nicht als unfertig erkennbar
und wird nicht nachträglich aufgeräumt. Ebenso kann die Kopie vollständig entstanden sein, ohne
dass der Assistent davon erfährt. Bleibt die Rückmeldung aus, prüft der Assistent darum vor einem
zweiten Versuch den eigenen Bestand bzw. den des Teams. Dasselbe gilt für das Zuordnen eines
Trainings als Kopie zu einem Termin, auch eines persönlichen. Bricht das Kopieren einer Übung
auf diese Weise ab, kann eine kopierte Bilddatei ohne Übung liegen bleiben; zu sehen ist sie
nirgends.

Im Kalender fragt der Assistent vor dem Entfernen eines Termins, dem Löschen eines Trainings mit
Termin, dem Zuordnen, Ersetzen und Lösen nicht nach. Fallen durch eine Serienänderung anstehende
Termine mit Training weg, erfährt er das erst danach; nur wenn vergangene Termine erfasst sind oder
entfallen, Abmeldungen, Meldungen zu Spielen, Kennzeichnungen oder Nachträge verfallen — durch eine
Verlegung oder eine Änderung an Kadern —, die Meldefrist eines Spiels ins Abgelaufene rückt oder ein
Spiel mit Meldungen oder Kennzeichnungen entfernt wird, verlangt die Anwendung eine Bestätigung im
Aufruf und nennt vorher, was es trifft. Ob ein Termin stattgefunden hat, kennt die Anwendung auch
über den Assistenten nicht, und wer dabei war, nur aus dem Stand bei Beginn und den Nachträgen; ob
jemand die Anwesenheit geprüft hat, erfährt er nicht. Beim Entfernen von Kadern, beim Erneuern der
Abholadresse und beim Schalten der Selbstabholung verlangt die Anwendung keine Bestätigung; ob er
vorher nachfragt, liegt bei ihm. Beim Herausnehmen einer Spieler:in und beim Erneuern eines Links
verlangt sie eine, prüft aber nicht, ob er die Person wirklich gefragt hat. Die Liste aller
Spieler:innen mit ihren Abmeldungen für mehrere Termine auf einmal liest er nicht; wer an einem
Termin kommt, ruft er Termin für Termin ab.
