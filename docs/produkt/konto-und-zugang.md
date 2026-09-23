# Konto und Zugang

Stand 2026-09-23. Wie man in die Anwendung hineinkommt und was ein Konto mit sich bringt.

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

Die Konto-Seite zeigt die eigene E-Mail-Adresse, führt zu den eigenen Übungen, lässt den
Anzeigenamen setzen, listet die verbundenen KI-Assistenten und bietet das Löschen des Kontos
an. Mehr Profilangaben gibt es nicht — kein Bild, keine Adresse, keine Vereinszugehörigkeit.

## Der Anzeigename

Der Anzeigename ist das Einzige, was andere von einer Person zu sehen bekommen; die
E-Mail-Adresse bleibt immer verborgen. Er steht als Urheber an veröffentlichten Trainings und
in den Mitgliederlisten der Teams. Wer keinen gewählt hat, erscheint nicht namenlos, sondern
unter einer automatisch vergebenen, je Konto verschiedenen Kennung — etwa „Trainer:in a1b2".

Ein einmal gesetzter Name lässt sich ersetzen, aber nicht mehr entfernen. Das ist Absicht: An
bereits veröffentlichten Trainings soll nicht plötzlich wieder eine Zufallskennung auftauchen.
Der Name ist auf vierzig Zeichen begrenzt.

## KI-Assistent verbinden

Ein KI-Assistent wie Claude lässt sich mit dem eigenen Konto verbinden. Er kann dann im
Gespräch im Übungsbestand suchen und einzelne Übungen mit allen Angaben abrufen — denselben
Bestand, den man auch selbst in der Anwendung sieht, mit denselben Filtern und denselben Werten
für Altersstufe, Trainingsteil und die übrigen Angaben. Private Übungen anderer bleiben auch
dem Assistenten verborgen.

Der Assistent kann ausserdem ein Kinderfussball-Training anlegen — mit Name, Alterskategorien
und auf Wunsch einem Ziel — und ihm Übungen zuordnen. Das Training entsteht als privater
Entwurf im eigenen Bestand und sieht in der Anwendung genauso aus, als hätte man es selbst
zusammengestellt. Dabei gelten dieselben Regeln wie in der Anwendung: Zu einem Trainingsteil
bietet der Assistent nur an, was dort hineinpasst, im Hauptteil passend zur gewählten
Hauptteilkategorie, und er erfährt, ob der Bestand für einen Teil gar nichts führt oder nur
die Suche zu eng war. Jede zugeordnete Übung kommt als eigene Kopie samt Bild und Diagramm ans
Ende ihres Teils; dieselbe Übung darf mehrfach vorkommen. Passt eine Übung nicht, nennt die
Anwendung dem Assistenten die verletzte Regel, damit er sich ohne Rückfrage korrigieren kann,
und die bisherigen Zuordnungen bleiben stehen. Junioren-Trainings legt der Assistent noch
nicht an.

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
gilt als nicht gefunden — ob es fehlt oder jemand anderem gehört, bleibt offen. Weitere
Fähigkeiten kommen nach und nach dazu; dieser Abschnitt wächst mit ihnen.

Verbunden wird in zwei Schritten. Zuerst trägt man in den Einstellungen des Assistenten die
Adresse `https://ki-fu.ch/api/mcp` ein; die Konto-Seite nennt sie ebenfalls. Der Assistent
öffnet daraufhin im Browser eine Seite der Anwendung, auf der man den Zugriff erlaubt oder
ablehnt. Wer dort nicht angemeldet ist, meldet sich zuerst an und kommt danach auf dieselbe
Seite zurück, wo er weiterhin ablehnen kann. Ein Passwort oder einen Schlüssel muss man dem
Assistenten nie geben.

Die Seite zum Erlauben nennt, welcher Assistent anfragt, mit welchem Konto man angemeldet ist
und wohin es danach zurückgeht. Sie zählt auf, was ein Zugang künftig insgesamt darf — also
auch das, was erst mit späteren Erweiterungen dazukommt und heute noch nicht geht: Übungen
suchen und abrufen, eigene Übungen samt Feld-Diagramm anlegen und ändern, Trainings anlegen,
überarbeiten, veröffentlichen, zurückziehen, übernehmen und löschen sowie Team-Trainings der
eigenen Teams führen und auf Termine ansetzen. Nie erreichbar sind die Favoriten, die
Verwaltung der Teams und das Konto selbst. Kommt eine dieser Fähigkeiten dazu, muss man nicht
erneut zustimmen. Weil jeder Assistent seinen Namen selbst angibt, warnt die Seite, nur zu
erlauben, wenn man das Verbinden eben selbst gestartet hat.

Beim Erlauben kann man dem Zugang einen eigenen Namen geben, etwa „Claude auf dem Laptop",
höchstens vierzig Zeichen. Vorgeschlagen ist der Name, den der Assistent selbst nennt; wer ihn
stehen lässt, sieht den Zugang später unter diesem Namen. Nach dem Erlauben geht es ohne
weiteres Zutun zurück zum Assistenten, der damit verbunden ist.

Ein Konto kann höchstens fünf Zugänge gleichzeitig haben. Ist die Grenze erreicht, sagt die
Seite das und führt zum Konto, wo man zuerst einen bestehenden Zugang widerruft; ablehnen geht
weiterhin. Ein Assistent, der schon verbunden ist und sich neu anmeldet, zählt nicht doppelt.
Zusammen dürfen alle Zugänge eines Kontos höchstens 600 Aufrufe je Stunde auslösen; darüber
bekommt der Assistent den Grund und die Wartezeit genannt. Weitere Zugänge erhöhen diese Zahl
nicht.

Unter „KI-Zugänge" auf der Konto-Seite stehen alle Zugänge mit ihrem Namen und dem Tag der
Erlaubnis, bei einem eigenen Namen zusätzlich der Name des Assistenten. Jeder Zugang lässt sich
einzeln widerrufen; das wirkt sofort, auch auf eine noch laufende Sitzung, und die übrigen
Zugänge bleiben bestehen. Von selbst verfällt ein Zugang nicht.

## Ohne Konto

Der gesamte Übungsbestand und alle öffentlichen Trainings sind ohne Anmeldung
zugänglich — ansehen, durchsuchen, filtern, durchführen und drucken inbegriffen. Verwehrt
bleibt alles Eigene: Übungen und Trainings anlegen oder bearbeiten, favorisieren, Trainings
übernehmen, Teams. Der Menüpunkt für Teams erscheint gar nicht erst, und wer eine geschützte
Adresse direkt aufruft, landet bei der Anmeldung und wird danach dorthin zurückgeführt, wo er
hinwollte.

## Konto löschen

Das Löschen ist unumkehrbar und verlangt eine ausdrückliche Bestätigung. Es folgt einer
einfachen Regel: Was privat war, verschwindet; was veröffentlicht war, bleibt der Allgemeinheit
erhalten, verliert aber jeden Bezug zur Person.

Konkret werden die Favoriten entfernt, die privaten Übungen samt ihren Feld-Diagrammen
gelöscht und die persönlichen Trainings mitsamt den Bildern ihrer Übungsfassungen. Öffentliche
Übungen und öffentliche Trainings bleiben bestehen, künftig ohne Urheberangabe.

Bei Teams entscheidet die Mitgliederzahl: Ist noch jemand anderes im Team, bleibt es samt allen
Trainings und Terminen unangetastet, und nur die gelöschte Person verschwindet aus der
Mitgliederliste. War sie die letzte, löst sich das Team auf — mit seinen Trainings, Terminen
und Bildern.

Alle KI-Zugänge werden entzogen; ein verbundener Assistent kommt danach nicht mehr ins Konto.

## Bekannte Grenzen

Es gibt keine Rollen und keine Rechteabstufung, weder anwendungsweit noch innerhalb eines
Teams; alle Mitglieder eines Teams dürfen dasselbe. Eine Einladung an jemanden ohne Konto ist
nicht möglich — ins Team kommt nur, wer bereits registriert und bestätigt ist. Ein Profilbild
ist nicht vorgesehen, und der Anzeigename lässt sich nicht mehr auf die automatische Kennung
zurücksetzen.

Ein KI-Zugang reicht so weit wie das Konto selbst; begrenzt wird er allein durch die
Fähigkeiten, die die Anwendung dem Assistenten anbietet, nicht durch eine abgestufte
Berechtigung. Den Namen, unter dem sich ein Assistent meldet, prüft niemand. Wer sich mitten im
Verbinden erst registriert, muss das Verbinden nach der Bestätigung der Adresse neu starten.
Wann und wie oft ein Zugang benutzt wurde, ist nicht einsehbar, und der Name eines Zugangs
lässt sich nach dem Erlauben nicht mehr ändern. Die Grenze von fünf Zugängen gilt nur auf dem
Weg über die Erlauben-Seite der Anwendung; ein Zugang, der an ihr vorbei zustande käme, würde
nicht mitgezählt. Ändert jemand dasselbe Training gleichzeitig in der Anwendung, merkt das
niemand; ein bereits offener Browser-Tab zeigt eine Änderung des Assistenten erst nach dem
Neuladen.
