# Übungspool — Stories: Kinderfussball-Übungsplattform

**Datum:** 2026-06-01
**Bezug:** Zerlegung des Epics `2026-05-31-uebungspool-epic.md`
**Status:** In Erarbeitung (iterativ, Story für Story)

Dieses Dokument zerlegt das Epic in umsetzbare Stories. Jede Story liefert
End-to-End-Wert und ist grob abhängigkeitssortiert. Querschnittliche
Sicherheits- und Plattform-Anforderungen (server-seitiger Datenzugriff,
zeilenbasierte Zugriffskontrolle, Deutsch, mobil + Desktop, SEO der öffentlichen
Ansicht) gelten für alle Stories und sind im Epic als NFR dokumentiert; sie
werden hier nicht pro Story wiederholt.

Story-Übersicht:

1. Enabler — Datenmodell für Mehrbenutzerbetrieb & Seed (erledigt)
2. Enabler — Alterskategorie-Daten je Übung korrigieren
3. Business — Übungskatalog öffentlich durchsuchen & filtern
4. Business — Übungs-Detailansicht
5. Enabler/Business — Authentifizierung
6. Business — Eigene Übung erstellen
7. Business — Eigene Übung bearbeiten, Sichtbarkeit steuern & löschen
8. Business — Eigene Übungen verwalten
9. Business — Konto löschen

---

## Story 1 — Enabler: Datenmodell für Mehrbenutzerbetrieb & Seed

Status: erledigt (im Code umgesetzt, siehe `supabase/migrations/` und
`web/scripts/seed.ts`).

Als Entwicklungsteam
will ich ein Datenmodell, das Eigentümerschaft, Herkunft, Sichtbarkeit und
Zeitstempel je Übung trägt und den kuratierten Manual-Bestand schreibgeschützt
übernimmt,
damit Mehrbenutzerbetrieb mit getrennten eigenen und offiziellen Übungen
möglich wird.

Diese Story ist umgesetzt und wird hier nur als Nachweis kurz festgehalten:

1. Das Datenmodell trägt je Übung Herkunft (Manual oder Nutzer), Eigentümerschaft, Sichtbarkeit (öffentlich oder privat) sowie Erstell- und Änderungszeitpunkt.
2. Das SYSTEM hält die offiziellen Manual-Übungen ohne Eigentümer und für jeden Nutzer schreibgeschützt.
3. Das SYSTEM lässt Hauptteil-spezifische Felder ausschliesslich bei Übungen des Trainingsteils Hauptteil zu.
4. Das SYSTEM übernimmt die kuratierten Übungen, Themen und Feld-Diagramme wiederholbar und ohne nutzererstellte Daten zu überschreiben in den Betrieb.

Anmerkung: Der genehmigte `methodischer_fahrplan`-Feldumbau (2026-06-01) ist im
DB-Schema und Seed noch nicht eingearbeitet. Daraus ergibt sich eine
Abstimmung, die die Stories 6 und 7 betrifft (siehe dort).

---

## Story 2 — Enabler: Alterskategorie-Daten je Übung korrigieren

Als Entwicklungsteam
will ich je Manual-Übung nur die tatsächlich gültigen Alterskategorien erfassen,
damit der Alterskategorie-Filter die Übungen sinnvoll eingrenzt statt immer den
gesamten Bestand zu liefern.

Preconditions:
1. Der kuratierte Manual-Bestand ist als Datengrundlage vorhanden.
2. Die aktuell extrahierten Alterskategorie-Daten führen pauschal alle Stufen je Übung, ohne die im Manual hervorgehobenen tatsächlich gültigen Stufen abzubilden.

Acceptance Criteria:
1. Das TEAM gewinnt die tatsächlich gültigen Alterskategorien je Übung erneut aus den Feld-Diagrammen statt aus den Textbadges.
2. Das TEAM erfasst je Übung ausschliesslich die so gewonnenen, tatsächlich gültigen Alterskategorien.
3. Das SYSTEM stellt sicher, dass jede Übung mindestens eine Alterskategorie trägt.
4. Die korrigierten Alterskategorien sind im Betrieb verfügbar und stehen dem Filter zur Verfügung.

Postconditions:
1. Das SYSTEM liefert beim Filtern nach einer Alterskategorie nur Übungen, die diese Kategorie tatsächlich abdecken.

Out of Scope:
1. Eine nachträgliche redaktionelle Überarbeitung weiterer Übungsfelder über die Alterskategorien hinaus ist nicht Teil dieser Story.

Anmerkung: Die abgeschlossene Datenkorrektur ist Voraussetzung für die
Auslieferung des Alterskategorie-Filters in Story 3.

---

## Story 3 — Business: Übungskatalog öffentlich durchsuchen & filtern

Als anonymer Besucher
will ich alle öffentlichen Übungen durchsuchen und nach den für die
Trainingsplanung relevanten Dimensionen eingrenzen,
damit ich im Training schnell eine zum Trainingsteil und zur Gruppengrösse
passende Übung finde.

Preconditions:
1. Öffentlich sichtbare Übungen sind im Betrieb verfügbar (Manual-Bestand und öffentliche Nutzer-Übungen).
2. Für den Alterskategorie-Filter sind die je Übung korrigierten Alterskategorien verfügbar.

Acceptance Criteria:
1. Der Besucher sieht ohne Konto alle öffentlich sichtbaren Übungen in einer Übersicht.
2. Der Besucher kann die Übungen nach Trainingsteil eingrenzen.
3. Der Besucher kann beim Alterskategorie-Filter mehrere Stufen als Filterkriterium setzen.
4. Der Besucher sieht bei mehreren gewählten Alterskategorien alle Übungen, die mindestens eine der gewählten Stufen abdecken.
5. Der Besucher kann die Übungen nach Feldtyp eingrenzen.
6. Der Besucher kann seine verfügbare Gruppengrösse angeben und sieht daraufhin alle Übungen, die mit dieser Anzahl Kinder durchführbar sind.
7. Der Besucher kann die Übungen über eine Freitextsuche eingrenzen.
8. Der Besucher kann die Filterdimensionen Erscheinungsform und Thema jederzeit gleichberechtigt zu den übrigen Dimensionen nutzen; sie sind nicht an einen Trainingsteil gekoppelt. Übungen ohne Wert in diesen Dimensionen (z. B. Auffangen/Ausklang) erscheinen bei gesetztem Filter schlicht nicht in der Ergebnismenge.
9. Der Besucher kann mehrere Filter kombinieren und sieht die entsprechend eingegrenzte Ergebnismenge: Dimensionen sind mit UND verknüpft, mehrere Werte innerhalb einer Dimension mit ODER.
10. Der Besucher erkennt für jede Übung, ob sie zum kuratierten Manual-Bestand gehört oder von einem Nutzer stammt.
11. Der Besucher erhält eine verständliche Rückmeldung, wenn keine Übung die gewählten Filter erfüllt.
12. Der angemeldete Trainer sieht in derselben Übersicht zusätzlich seine eigenen privaten Übungen.
13. Das SYSTEM hält private Übungen für alle ausser ihrem Eigentümer verborgen.

Postconditions:
1. Das SYSTEM grenzt die angezeigten Übungen auf jene ein, die alle gesetzten Filter und die Freitextsuche erfüllen.

Out of Scope:
1. Eine Sortierung oder Priorisierung der Trefferliste nach Relevanz oder Beliebtheit ist nicht Teil dieser Story.
2. Das Speichern oder Teilen einer Filterkombination ist nicht Teil dieser Story.

Offene Fragen:
1. @UX Designer: Wie wird der kuratierte Manual-Bestand visuell von Nutzer-Übungen unterschieden, ohne die gemeinsame Durchsuchbarkeit zu beeinträchtigen?
2. @UX Designer: Wie wird eine leere Ergebnismenge dargestellt und dem Besucher der Weg zurück zu Treffern aufgezeigt?

---

## Story 4 — Business: Übungs-Detailansicht

Als anonymer Besucher
will ich eine einzelne Übung mit allen Details und ihrem Feld-Diagramm ansehen,
damit ich beurteilen kann, ob sie zu meinem Training passt, und sie am
Spielfeldrand umsetzen kann.

Preconditions:
1. Eine für den Betrachter sichtbare Übung ist im Betrieb verfügbar.

Acceptance Criteria:
1. Der Besucher kann eine einzelne Übung in einer Detailansicht öffnen.
2. Der Besucher sieht in der Detailansicht alle erfassten Felder der Übung.
3. Der Besucher sieht das Feld-Diagramm der Übung.
4. Der Besucher sieht eine Ersatzdarstellung, wenn die Übung kein Feld-Diagramm hat.
5. Der Besucher sieht bei einer Hauptteil- oder Einleitungs-Übung mit Themenzuordnung die zugehörigen Themen-Informationen Ziele, Metaphern und Fragen an die Kinder.
6. Der Besucher erkennt, ob die Übung zum kuratierten Manual-Bestand gehört oder von einem Nutzer stammt.
7. Der Besucher versteht anhand der Detailansicht, dass die Alterskategorien angeben, für welche Stufen die Übung in angepasster Komplexität geeignet ist.
8. Der Besucher sieht bei einer Manual-Übung eine Quellen- und Urheberangabe zum offiziellen Manual.

Postconditions:
1. Das SYSTEM zeigt die Detailansicht einer privaten Übung ausschliesslich ihrem Eigentümer.

Out of Scope:
1. Das Verknüpfen oder Anzeigen ähnlicher oder verwandter Übungen in der Detailansicht ist nicht Teil dieser Story.

Offene Fragen:
1. @Product Owner / @Legal: Liegt eine Nutzungslizenz des SFV für die öffentliche Bereitstellung der Manual-Inhalte vor, und welche Quellen- bzw. Urheberangabe ist verpflichtend?

---

## Story 5 — Enabler/Business: Authentifizierung

Als Trainer
will ich mir ein Konto anlegen und mich an- und abmelden können,
damit ich eigene Übungen erstellen und verwalten kann und diese Aktionen nur mir
zugänglich sind.

Preconditions:
1. Der Nutzer ist nicht angemeldet.

Acceptance Criteria:
1. Der Trainer kann mit seiner E-Mail-Adresse ohne Passwort ein Konto anlegen.
2. Der Trainer kann sich mit seiner E-Mail-Adresse ohne Passwort anmelden.
3. Der Trainer kann sich abmelden.
4. Der Trainer kann schreibende und verwaltende Aktionen ausschliesslich im angemeldeten Zustand ausführen.
5. Das SYSTEM führt einen nicht angemeldeten Nutzer beim Aufruf einer geschützten Aktion zur Anmeldung.

Postconditions:
1. Das SYSTEM stellt nach erfolgreicher Anmeldung eine Sitzung bereit, die geschützte Aktionen erlaubt.
2. Das SYSTEM beendet die Sitzung, sobald der Trainer sich abmeldet.

Out of Scope:
1. Anmeldung über externe Identitätsanbieter ist nicht Teil dieser Story.
2. Passwortbasierte Anmeldung und Passwort-Zurücksetzen sind nicht Teil dieser Story.
3. Ein persönliches Profil mit über die Anmeldung hinausgehenden Angaben ist nicht Teil dieser Story.
4. Eine separate E-Mail-Verifikation über den passwortlosen Login hinaus ist nicht vorgesehen, da der zugesandte Anmeldelink bereits den Besitz der E-Mail-Adresse nachweist.

Offene Fragen:
1. @UX Designer: Wie sehen der Anmelde- und Registrierungs-Flow und die Rückmeldung an den Trainer während und nach der Anmeldung aus, insbesondere der Wartezustand nach dem Anfordern des Anmeldelinks und das Verhalten, wenn der Link auf einem anderen Gerät geöffnet wird?
2. @Product Owner: Wie lange bleibt eine Sitzung gültig, und wie wird der Trainer geführt, wenn seine Sitzung während einer Bearbeitung abläuft?

---

## Story 6 — Business: Eigene Übung erstellen

Als angemeldeter Trainer
will ich eine eigene Übung mit dem vollen Feldsatz und optionalem Feld-Diagramm
erfassen,
damit sie gleichwertig zu den Manual-Übungen durchsuch- und filterbar ist und ich
meine eigene Übungssammlung aufbaue.

Preconditions:
1. Der Trainer ist angemeldet.

Acceptance Criteria:
1. Der Trainer kann eine neue Übung mit demselben Feldsatz erfassen, mit dem auch Manual-Übungen beschrieben sind, sodass sie gleichwertig filterbar ist.
2. Der Trainer wählt für die Übung einen Trainingsteil.
3. Der Trainer muss mindestens den Namen, den Trainingsteil, den Übungsablauf und eine Alterskategorie angeben, um die Übung zu speichern.
4. Der Trainer erfasst den Übungsablauf bei den Trainingsteilen Einleitung und Hauptteil verpflichtend in den drei aufeinanderfolgenden Stufen Offen starten, Üben und Wett-eifern und bei den Trainingsteilen Auffangen und Ausklang als einfache Aufbaubeschreibung.
5. Der Trainer kann eine Hauptteil- oder Einleitungs-Übung einem der bestehenden Themen zuordnen und ihre Erscheinungsform angeben; beide Felder werden nur bei diesen beiden Trainingsteilen angeboten.
6. Der Trainer kann optional ein Feld-Diagramm als Bild hochladen.
7. Der Trainer erhält eine Rückmeldung, wenn das hochgeladene Bild das erlaubte Format oder die erlaubte Grösse überschreitet.
8. Die neu erstellte Übung ist standardmässig privat und für den Trainer ein Entwurf, bis er sie selbst öffentlich schaltet.
9. Das SYSTEM weist die neue Übung dem erstellenden Trainer als Eigentümer zu.
10. Das SYSTEM lässt mehrere Übungen mit demselben Namen nebeneinander bestehen.

Postconditions:
1. Das SYSTEM speichert die neue Übung als dem Trainer gehörende, zunächst private Übung, WENN der Trainer die Erstellung bestätigt und alle Pflichtangaben valide sind.
2. Das SYSTEM macht eine Übung im öffentlichen Katalog auffindbar, sobald der Trainer sie öffentlich schaltet.

Out of Scope:
1. Das Erstellen eigener Themen mit Zielen, Metaphern und Fragen ist nicht Teil dieser Story; der Trainer kann seine Hauptteil-Übung nur einem bestehenden Thema zuordnen.
2. Ein Werkzeug zum Zeichnen von Feld-Diagrammen in der Anwendung ist nicht Teil dieser Story; vorgesehen ist nur der Upload eines Bildes.
3. Eine Moderation oder Freigabe der Übung vor der Veröffentlichung findet nicht statt.

Offene Fragen:
1. @UX Designer: Wie wird dem Trainer die erfolgreiche Erstellung einer Übung zurückgemeldet?

Anmerkung: Der hier beschriebene Feldsatz folgt der genehmigten
`methodischer_fahrplan`-Struktur. Deren Einarbeitung in DB-Schema und Seed ist
Voraussetzung für die Umsetzung dieser Story. Für nutzererstellte Einleitungs-
und Hauptteil-Übungen sind alle drei Fahrplan-Stufen Pflicht — anders als der
für den Altbestand zulässige Datenstand, in dem Üben und Wett-eifern leer sein
dürfen. Die zulässigen Bildformate (JPG, PNG, WebP) und die maximale Dateigrösse
(rund 5 MB) sind im Architektur-Plan festgelegt und gehören in die Detail-Spec.

---

## Story 7 — Business: Eigene Übung bearbeiten, Sichtbarkeit steuern & löschen

Als angemeldeter Trainer
will ich meine eigenen Übungen ändern, ihre Sichtbarkeit umschalten und sie
löschen können,
damit ich meine Sammlung aktuell halte und selbst steuere, was öffentlich ist.

Preconditions:
1. Der Trainer ist angemeldet und besitzt mindestens eine eigene Übung.

Acceptance Criteria:
1. Der Trainer kann die Felder einer eigenen Übung bearbeiten.
2. Der Trainer kann die Sichtbarkeit einer eigenen Übung jederzeit zwischen öffentlich und privat umschalten.
3. Der Trainer kann eine eigene Übung löschen.
4. Der Trainer muss die Löschung einer Übung ausdrücklich bestätigen.
5. Das SYSTEM lässt den Trainer ausschliesslich seine eigenen Nutzer-Übungen bearbeiten und löschen; fremde Übungen und Manual-Übungen sind für ihn schreibgeschützt.

Postconditions:
1. Das SYSTEM übernimmt die geänderten Felder, WENN der Trainer die Änderung bestätigt und alle Pflichtangaben valide sind.
2. Das SYSTEM löscht die Übung endgültig, WENN der Trainer die Löschung bestätigt hat.
3. Das SYSTEM entfernt ein zugehöriges Feld-Diagramm, WENN die Übung gelöscht wird.
4. Das SYSTEM blendet eine auf privat gestellte Übung aus der öffentlichen Ansicht aus, behält sie aber für den Eigentümer sichtbar.

Out of Scope:
1. Ein Wiederherstellen gelöschter Übungen ist nicht vorgesehen.
2. Eine Änderungshistorie oder Versionierung bearbeiteter Übungen ist nicht Teil dieser Story.

Offene Fragen:
1. @UX Designer: Wie wird dem Trainer das Ergebnis einer Bearbeitung, einer Sichtbarkeitsänderung und einer Löschung zurückgemeldet?
2. @UX Designer: Von wo aus löst der Trainer eine Sichtbarkeitsänderung aus (Detailansicht, Bearbeitungsmaske, Übersicht oder mehrere davon)?

---

## Story 8 — Business: Eigene Übungen verwalten

Als angemeldeter Trainer
will ich eine Übersicht ausschliesslich meiner eigenen Übungen mit ihrem
Sichtbarkeitsstatus sehen,
damit ich meine Sammlung im Blick behalte und gezielt einzelne Übungen anwählen
kann.

Preconditions:
1. Der Trainer ist angemeldet.

Acceptance Criteria:
1. Der Trainer sieht eine Übersicht ausschliesslich seiner eigenen Übungen, sowohl öffentliche als auch private.
2. Der Trainer erkennt zu jeder eigenen Übung ihren Sichtbarkeitsstatus.
3. Der Trainer kann aus der Übersicht eine einzelne eigene Übung zur Ansicht oder Bearbeitung anwählen.
4. Der Trainer erhält eine verständliche Rückmeldung, wenn seine Sammlung noch keine Übung enthält.

Postconditions:
1. Das SYSTEM zeigt in dieser Übersicht keine fremden und keine Manual-Übungen.

Out of Scope:
1. Das Merken oder Sammeln von Manual- oder fremden Übungen in der eigenen Übersicht ist nicht Teil dieser Story.

Offene Fragen:
1. @UX Designer: Wie wird eine noch leere eigene Übungssammlung dargestellt und der Trainer zum Erstellen der ersten Übung geführt?
2. @UX Designer: Über welchen Einstieg gelangt der angemeldete Trainer zu seiner eigenen Übersicht?

---

## Story 9 — Business: Konto löschen

Als angemeldeter Trainer
will ich mein Konto löschen können,
damit ich die Plattform endgültig verlassen kann, ohne dass meine öffentlich
geteilten Übungen für andere verloren gehen.

Preconditions:
1. Der Trainer ist angemeldet.

Acceptance Criteria:
1. Der Trainer kann die Löschung seines Kontos auslösen.
2. Der Trainer muss die Löschung seines Kontos ausdrücklich bestätigen.
3. Der Trainer ist über die Konsequenzen informiert, bevor er die Löschung abschliesst: dass seine öffentlichen Übungen anonymisiert erhalten bleiben und seine privaten Übungen gelöscht werden.

Postconditions:
1. Das SYSTEM löscht das Konto des Trainers, WENN er die Löschung bestätigt hat.
2. Das SYSTEM behält die öffentlichen Übungen des Trainers anonymisiert und unveränderlich, WENN das Konto gelöscht wird.
3. Das SYSTEM löscht die privaten Übungen des Trainers samt zugehörigen Feld-Diagrammen, WENN das Konto gelöscht wird.

Out of Scope:
1. Ein Wiederherstellen des Kontos oder der gelöschten privaten Übungen nach der Löschung ist nicht vorgesehen.
2. Ein Export oder Download der eigenen Übungen vor der Konto-Löschung ist nicht Teil dieser Story.

Anmerkung: "Anonymisiert" bedeutet, dass die erhaltene öffentliche Übung ihre
Verknüpfung zum gelöschten Konto verliert. Da die Plattform keine
Autoren-Identität öffentlich anzeigt, ist damit keine weitergehende Bereinigung
der Übungsinhalte verbunden.

---

## Auswirkungen auf Epic & implementierten Stand (Impact-Analyse)

Aus der Diskussion ergeben sich Abweichungen gegenüber dem abgestimmten Epic
`2026-05-31-uebungspool-epic.md` und dem bereits implementierten
Datenmodell. Diese sind vor der Umsetzung anzugleichen:

1. Erscheinungsform und Thema gelten nun für Hauptteil- UND Einleitungs-Übungen (Stories 3, 4, 6). Das Epic-Erfolgskriterium 2 beschränkt diese Dimensionen auf den Hauptteil und muss angepasst werden. Die implementierte Datenbank-Bedingung, die diese Felder nur beim Hauptteil zulässt, sowie die Themen-Daten und die Alterskategorie-Datenkorrektur müssen Einleitungs-Übungen einbeziehen.
2. Neue Nutzer-Übungen sind standardmässig privat statt öffentlich (Story 6). Das Epic-Erfolgskriterium 8 sieht standardmässige öffentliche Sichtbarkeit vor und muss angepasst werden. Der implementierte Datenbank-Standardwert für die Sichtbarkeit neuer Übungen muss von öffentlich auf privat geändert werden.
3. Bei nutzererstellten Einleitungs- und Hauptteil-Übungen sind alle drei Fahrplan-Stufen Pflicht (Story 6). Das ist strenger als der für den Altbestand zulässige Datenstand und betrifft nur die Erfassungs-Validierung, nicht die Migration des Manual-Bestands.
4. Für Manual-Übungen wird eine Quellen- und Urheberangabe zur Anforderung (Story 4); die formale Lizenzklärung mit dem SFV ist offen.
