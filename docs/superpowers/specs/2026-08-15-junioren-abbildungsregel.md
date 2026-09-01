# Entscheidungsdokument: Abbildungsregel Kinderfussball → Juniorenschema

Ergebnis des Spikes (Story 1) zum Epic «Juniorenfussball-Trainingsschema» (`2026-08-14-juniorenfussball-epic.md`). Erstellt 2026-08-15.

Quellen: `sources/junioren/Manual_Fussball_Jugendliche_d.pdf` (SFV/BASPO 2022, im Folgenden «Manual»), `sources/junioren/FVBJ_Broschuere_Erste_Schritte_7er-9er-Fussball.pdf` («Broschüre»), J+S-Lernbaustein «Der Einstieg» (tool.jugendundsport.ch) samt Übungsblättern in `sources/junioren/einstieg/`, `sources/Manual_Kinderfussball_D.pdf`, Bestandsanalyse der 75 Übungen in `data/uebungen/`.

## 1. Eingangsattribute der Abbildungsregel

Die Regel verwendet ausschliesslich die beiden Attribute, die im Bestand vollständig und trennscharf belegt sind. Alle anderen Übungsattribute (Erscheinungsform, Feldtyp, Material, Varianten, Anzahl Kinder) wurden als Eingangsgrössen geprüft und verworfen — Begründung in Abschnitt 6.

| Attribut | Wertebereich | Belegung im Bestand |
|---|---|---|
| `trainingsteil` | `auffangen`, `einleitung`, `hauptteil`, `ausklang` — Pflichtfeld, nie leer | 4 / 12 / 55 / 4 |
| `hauptteilkategorie` | `fussball-spielen-lernen`, `vielseitigkeit-erleben`, `fussball-spielen`, **nicht gesetzt** | 50 / 4 / 1 / 20 |

Die Invariante «Hauptteilkategorie genau bei Hauptteil» (Schema `allOf`, DB-Constraint `hauptteilkategorie_genau_bei_hauptteil`) schränkt den Eingaberaum ein: `hauptteilkategorie` ist gesetzt genau dann, wenn `trainingsteil = hauptteil`. Der theoretische Eingaberaum umfasst 4 × 4 = 16 Kombinationen; 10 davon sind durch die Invariante ausgeschlossen und werden von der Auffangzeile (Z7) abgedeckt, damit die Regel auch bei verletzter Invariante deterministisch bleibt.

Geltungsbereich: Die Abbildungsregel gilt für Übungen mit Kinderfussball-Heimat, also mit gesetztem Kinderfussball-Trainingsteil — heute alle 75 Bestandsübungen und alle Trainer-Übungen. Für Übungen mit Junioren-Heimat (Abschnitt 4) gilt stattdessen die dort definierte Rückabbildung.

## 2. Die Abbildungsregel

Zielwertebereich: die sechs befüllbaren Stellen des Juniorenschemas — Einstieg/Aufwärmen, Einstieg/Spielform zum Trainingsziel, Einstieg/Explosivität, Hauptteil/Spielformen und unterstützende Übungen, Hauptteil/Spiel, Abschluss/Ausklang — sowie der Sonderwert «ohne Entsprechung».

| Z | `trainingsteil` | `hauptteilkategorie` | Junioren-Einordnung |
|---|---|---|---|
| 1 | `auffangen` | nicht gesetzt | **ohne Entsprechung** |
| 2 | `einleitung` | nicht gesetzt | **Einstieg / Aufwärmen** |
| 3 | `hauptteil` | `fussball-spielen-lernen` | **Hauptteil / Spielformen und unterstützende Übungen** |
| 4 | `hauptteil` | `vielseitigkeit-erleben` | **Hauptteil / Spielformen und unterstützende Übungen** |
| 5 | `hauptteil` | `fussball-spielen` | **Hauptteil / Spiel** |
| 6 | `ausklang` | nicht gesetzt | **Abschluss / Ausklang** |
| 7 | jede andere Kombination | | **ohne Entsprechung** |

Die Regel ist lückenlos (Z7 fängt alles Übrige) und überlappungsfrei (die Bedingungen Z1–Z6 sind paarweise disjunkt, da `trainingsteil` skalar ist und `hauptteilkategorie` je Zeile eindeutig). Auf den Bestand angewandt: 12 Übungen → Aufwärmen, 54 → Spielformen und unterstützende Übungen, 1 → Spiel, 4 → Ausklang, 4 → ohne Entsprechung. Kein Bestandsfall erreicht Z7.

### Begründungen je Zeile

1. **Auffangen → ohne Entsprechung.** Vorgabe des Product Owners (2026-08-14). Fachlich gedeckt: Das Auffangen ist Betreuung vor dem Trainingsbeginn und zählt nicht zur Trainingszeit (DB-Regel «Auffangen ohne Dauer»); das Juniorenschema beginnt mit dem Einstieg, einen Vor-Trainings-Teil kennt es nicht.
2. **Einleitung → Einstieg/Aufwärmen.** Das Manual verwendet «Einleitung» und «Einstieg» synonym (Abbildung 17, S. 41: Doppel-Beschriftung EINLEITUNG/EINSTIEG). Inhaltlich deckungsgleich: Die Kinderfussball-Einleitung gibt jedem Kind einen Ball mit Technik-Fokus; die erste Einstiegsphase des Juniorenschemas ist ein allgemeines Aufwärmen mit Technik-Fokus und vielen Ballkontakten (Broschüre S. 5: «maximal 4–5 Spieler:innen pro Ball»). Die Zuordnung erfolgt in den Unterblock Aufwärmen, nicht pauschal in den Einstieg, weil die Explosivität ein eigenständiger Block mit anderem Inhalt ist.
3. **Fussball spielen lernen → Spielformen und unterstützende Übungen.** Direkte Begriffsbrücke in der Quelle selbst: Abbildung 19 (Manual S. 43) führt im Hauptteil unter «WAS?» wörtlich «Fussball spielen lernen» und «Fussball spielen» auf. «Fussball spielen lernen» sind die zielgerichteten Spiel- und Übungsformen — exakt der Block «Spielformen und unterstützende Übungen».
4. **Vielseitigkeit erleben → Spielformen und unterstützende Übungen.** Die vier polysportiven Übungen sind «unterstützende Übungen» im Wortsinn. Geprüfte Alternative: Einordnung in Einstieg/Aufwärmen (als koordinative Vorbereitung) — verworfen, weil die Übungen im Kinderfussball ausdrücklich Hauptteil-Inhalt sind und eine Verschiebung in den Einstieg die Trainingsteil-Semantik der Übung umdeuten würde.
5. **Fussball spielen → Hauptteil/Spiel.** Dieselbe Begriffsbrücke wie Z3 (Abbildung 19). Der Block «Spiel» ist laut Broschüre (S. 6) das freie Spiel von mindestens 15 Minuten am Ende des Hauptteils, möglichst ohne Vorgaben — funktional identisch mit der Kinderfussball-Kategorie «Fussball spielen». Vorgabe des Product Owners: Der Block kann Übungen tragen; bleibt er leer, erzeugt das Speichern einen Hinweis.
6. **Ausklang → Abschluss/Ausklang.** Das Manual verwendet «Ausklang» und «Abschluss» synonym (Abbildung 17); der Unterblock des Abschlusses heisst in Abbildung 19 selbst «Ausklang». Funktion identisch: beruhigendes Spiel, gemeinsamer Abschluss (Manual Kinderfussball S. 37: «Beende das Training gemeinsam mit einem – falls nötig – beruhigenden Spiel, einem Schlusswort…»; Manual Jugendliche: Cool-down, Mobilität, Austausch).

## 3. Erreichbarkeit der Unterblöcke

| Unterblock | Erreichbar über | Bestand |
|---|---|---|
| Einstieg / Aufwärmen | Ableitung (Z2) und direkte Junioren-Einordnung (Abschnitt 4) | 12 Übungen |
| Einstieg / Spielform zum Trainingsziel | **nur** direkte Junioren-Einordnung (Abschnitt 4) | 0 Übungen |
| Einstieg / Explosivität | **nur** direkte Junioren-Einordnung (Abschnitt 4) | 0 Übungen |
| Hauptteil / Spielformen und unterstützende Übungen | Ableitung (Z3, Z4) | 54 Übungen |
| Hauptteil / Spiel | Ableitung (Z5) | 1 Übung |
| Abschluss / Ausklang | Ableitung (Z6) | 4 Übungen |
| — (ohne Entsprechung) | Z1 | 4 Übungen |

Die Spielform zum Trainingsziel ist über den Bestand nicht erreichbar, weil das Kinderfussball-Modell keine Übungsart kennt, die einen Trainingsschwerpunkt einführt; sie wird über Trainer-Übungen mit direkter Junioren-Heimat befüllt.

Explosivität ist über den Bestand nicht erreichbar, und zwar strukturell, nicht zufällig: Kein Kinderfussball-Attribut trägt ein Signal für Explosivitäts-Inhalte (Beschleunigung, Richtungswechsel, Sprünge mit vollständiger Erholung), weil das Kinderfussball-Manual diese Trainingsform nicht kennt — Athletik ist dort kein eigener Trainingsinhalt. Die J+S-Übungsblätter in `sources/junioren/einstieg/` zeigen, dass Explosivitäts-Formen eigenständige Inhalte sind. Dasselbe gilt für reine Körperstabilitäts-/Präventionsübungen (die «Big 4» gemäss J+S-Lernbaustein: Fussgelenk, Knie, Hüfte, Hamstrings — das Manual nennt die Bereiche Fussgelenk, Knie, Ischios, Hüfte, S. 74–78); sie gehören laut Manual (S. 72) ins Aufwärmen integriert, weshalb sie keinen eigenen Unterblock brauchen, sondern über die direkte Einordnung in Aufwärmen abgedeckt werden.

## 4. Mechanismus: Junioren-Einordnung ohne Doppelpflege

Vorgabe des Product Owners: Aufwärmen und Explosivität müssen über Trainer-Übungen befüllbar sein, ohne dass eine Übung doppelt gepflegt wird.

Festgelegter Mechanismus — **jede Übung hat genau eine gepflegte Heimat**:

1. Übungen mit Kinderfussball-Heimat (heute alle 75 Manual-Übungen und alle Trainer-Übungen mit Trainingsteil): Die Junioren-Einordnung wird ausschliesslich über die Abbildungsregel (Abschnitt 2) abgeleitet. Nichts wird zusätzlich gepflegt.
2. Übungen mit Junioren-Heimat (neu): Eine Übung kann statt eines Kinderfussball-Trainingsteils direkt einen der drei Einstiegs-Unterblöcke Aufwärmen, Spielform zum Trainingsziel oder Explosivität als Heimat tragen. Das ist die minimale Modell-Ergänzung, die das Epic dem Spike zugesteht — und bewusst auf den Einstieg beschränkt: Für Spielformen, Spiel und Ausklang existiert der Kinderfussball-Pfad bereits, eine direkte Junioren-Heimat dort würde ohne Not Übungen erzeugen, die dem Kinderfussball entzogen sind.
3. Rückabbildung für Übungen mit Junioren-Heimat: Aufwärmen wird im Kinderfussball als Einleitung eingeordnet (die Zuordnung ist in beiden Richtungen verlustfrei, siehe Z2); die Spielform zum Trainingsziel wird ebenfalls als Einleitung eingeordnet, weil sie fachlich eine Spielform mit Technik- und Zielbezug im Einstieg ist; Explosivität ist im Kinderfussball ohne Entsprechung, weil dieser Trainingsinhalt dort nicht existiert.
4. Eine Übung trägt nie beide Heimaten. Damit ist Doppelpflege ausgeschlossen und es gibt keine Konfliktfälle zwischen gepflegter und abgeleiteter Einordnung.

Konsequenzen, die der Product Owner mit der Abnahme mitträgt:

- Eine Explosivitäts-Übung ist in Kinderfussball-Trainings nicht zuweisbar. Das ist eine bewusste Setzung, fachlich gedeckt: Explosivitätstraining ist laut den Quellen erst ab dem Juniorenfussball Trainingsinhalt.
- Eine Übung mit Heimat Aufwärmen ist dank Rückabbildung auch in Kinderfussball-Trainings (als Einleitung) verwendbar — der Epic-Entscheid «eine Übung kann beiden Schemata dienen» bleibt damit in beide Richtungen erfüllt, wo es fachlich Sinn ergibt.
- Der Übungs-Editor braucht künftig eine Wahl der Heimat (Kinderfussball-Trainingsteil oder Junioren-Einstiegs-Unterblock). Wie diese Wahl gestaltet wird, ist eine UX-Frage (Abschnitt 8).
- Die Alterskategorien einer Übung bleiben davon unabhängig; die Schnittmengen-Warnung im Training funktioniert unverändert.

Steuerung für Trainer (welche bestehenden Angaben bestimmen die Einordnung):

| Gewünschte Einordnung im Junioren-Training | Was der Trainer an der Übung setzt |
|---|---|
| Einstieg / Aufwärmen | Trainingsteil Einleitung — oder direkte Junioren-Einordnung Aufwärmen |
| Einstieg / Spielform zum Trainingsziel | direkte Junioren-Einordnung Spielform zum Trainingsziel |
| Einstieg / Explosivität | direkte Junioren-Einordnung Explosivität |
| Hauptteil / Spielformen und unterstützende Übungen | Trainingsteil Hauptteil mit Kategorie Fussball spielen lernen oder Vielseitigkeit erleben |
| Hauptteil / Spiel | Trainingsteil Hauptteil mit Kategorie Fussball spielen |
| Abschluss / Ausklang | Trainingsteil Ausklang |

## 5. Zeitbandbreiten (Orientierungswerte, nicht bindend)

| Stelle | Bandbreite | Quelle |
|---|---|---|
| Einstieg gesamt | 20–30 Minuten | Manual Abb. 19, S. 43; Broschüre S. 5 und Abschnitt 5 |
| Einstieg, Unterblock Aufwärmen | 10–12 Minuten | J+S-Lernbaustein «Der Einstieg», Phase 1 |
| Einstieg, Unterblock Spielform zum Trainingsziel | 6–8 Minuten | J+S-Lernbaustein «Der Einstieg», Phase 2 |
| Einstieg, Unterblock Explosivität | 8–10 Minuten | J+S-Lernbaustein «Der Einstieg», Phase 3 |
| Einstieg, Phase Aktivierung und Körperstabilität | 10–12 Minuten | J+S-Lernbaustein «Der Einstieg» |
| Einstieg, Phase Spielform zum Trainingsziel | 6–8 Minuten | J+S-Lernbaustein «Der Einstieg» |
| Einstieg, Phase Explosivität | 8–10 Minuten | J+S-Lernbaustein «Der Einstieg» |
| Hauptteil, Spielformen und unterstützende Übungen | 30–45 Minuten | Manual Abb. 19 (der frühere Broschüren-Wert 45–65 wurde am 2026-08-16 revidiert, siehe Errata 3) |
| Hauptteil, Spiel | 15–20 Minuten, freies Spiel mindestens 15 | Manual Abb. 19; Broschüre S. 6 und Abschnitt 5 |
| Hauptteil gesamt | 45–65 Minuten | rechnerisch aus den Unterblock-Werten |
| Abschluss / Ausklang | 5–10 Minuten | Manual Abb. 19; Broschüre Abschnitt 5 |
| Gesamtdauer | 90 Minuten | Manual S. 43 (Tipp-Box); Broschüre Abschnitt 5 |

Hinweis: Die App bildet den Einstieg nach den drei J+S-Phasen ab (PO-Entscheid 2026-08-16), nicht nach der gröberen Zweiteilung der Abbildung 19. Begründung: Die Spielform zum Trainingsziel ist eine eigenständige Übungsart mit eigenem Zweck und eigener Zeitangabe; sie führt den Trainingsschwerpunkt ein und stellt den roten Faden zum Hauptteil her.

Konsistenz der Ebenen: Die Summe der drei Einstiegs-Unterblöcke ergibt rechnerisch 24–30 Minuten, die Manual-Bandbreite des Trainingsteils lautet 20–30 Minuten. Beide Ebenen gelten je für sich als Orientierung; das System verlangt keine Konsistenz zwischen den Ebenen, weil alle Werte unverbindliche Richtwerte sind. Die Summe der Trainingsteil-Bandbreiten (70–105 Minuten) umschliesst die Gesamtdauer von 90 Minuten.

## 6. Geprüfte und verworfene Alternativen

1. **Erscheinungsform als Eingangsattribut** — verworfen: nur bei Hauptteil-Übungen gesetzt (55/75), liefert für die Einleitung kein Signal; die sechs Kinderfussball-Erscheinungsformen sind kategorial andere Begriffe als die Junioren-Erscheinungsformen nach Spielphasen, eine Übersetzung wäre fachlich nicht haltbar.
2. **Feldtyp, Material, Anzahl Kinder als Eingangsattribute** — verworfen: zu dünn belegt (33/75, 8/75) bzw. ohne fachlichen Bezug zur Einordnung.
3. **Aufteilung der Einleitung auf Aufwärmen und Explosivität über ein neues Pflichtattribut** — verworfen: hätte Nachpflege aller 12 Bestandsübungen erfordert und wäre fachlich falsch, weil keine der 12 Einleitungs-Übungen Explosivitäts-Charakter hat.
4. **Auffangen → Einstieg/Aufwärmen** — verworfen durch PO-Entscheid; fachlich gestützt (Auffangen ist keine Trainingszeit).
5. **Kuratierter Junioren-Bestand aus den J+S-Blättern** — ausserhalb des Spike-Auftrags (Out of Scope Story 1), Bedarf wird nach dem Epic-Review neu beurteilt.

## 7. Belege

1. **Einheitlichkeit des Schemas für D bis A:** Das Manual Fussball Jugendliche adressiert die gesamte FTEM-Stufe Foundation 3 mit einem einzigen Trainingsschema (Abbildung 19) und differenziert nirgends nach den Kategorien D, C, B, A; die einzige Kategorien-Erwähnung im Dokument ist anekdotisch (S. 13). Altersunterschiede laufen über die Entwicklungsstufen (Tabelle 3, S. 13) und betreffen Didaktik, nicht Struktur. Beleg: Manual S. 43 «Halte dich in der Regel an den dreiteiligen Trainingsaufbau mit Einstieg, Hauptteil und Abschluss», Abbildung 19 und Tipp-Box «Gesamtdauer des Trainings von 90 Minuten» (ebenfalls S. 43).
2. **Begriffs-Synonymie:** Abbildung 17 (S. 41) beschriftet die Lektionsteile doppelt als EINLEITUNG/EINSTIEG und AUSKLANG/ABSCHLUSS.
3. **Scheiter-Prüfung (Story 1, AK 9):** Eine fachlich tragfähige Abbildungsregel liess sich definieren; das Vorhaben muss nicht umgelenkt werden. Die Regel kippt nur, wenn der Product Owner den Heimat-Mechanismus (Abschnitt 4) ablehnt — dann bleibt als Alternative die Nachpflege eines separaten Junioren-Attributs an jeder Übung (Doppelpflege, vom Epic ausgeschlossen) oder der Verzicht auf befüllbare Explosivität (von der PO-Vorgabe ausgeschlossen). Ein dritter Weg ist nicht ersichtlich.

## 8. Offene Punkte für die nachfolgenden Stories

1. @Product Owner / Epic-Review: Übergangszustand gemischter Alterskategorien, bevor die Schema-Regel existiert (bereits als Vorgehensentscheid im Epic vermerkt).
2. @UX Designer: Gestaltung der Heimat-Wahl im Übungs-Editor (Kinderfussball-Trainingsteil oder Junioren-Einordnung), inklusive Verständlichkeit für Trainer, die nur eine Welt kennen.
3. @UX Designer: Zeitbandbreiten-Orientierung — statische Referenzanzeige oder berechneter Abgleich gegen die Summe der Übungsdauern.
4. @UX Designer: Farbe und Kurzlabel je neuer Alterskategorie D, C, B, A.
5. @UX Designer: Darstellung von Übungen «ohne Entsprechung» beim Schema-Wechsel eines Trainings (Nacharbeits-Markierung).

## 9. Durch dieses Dokument überholte Aussagen im Repository

1. Architektur-Spec `2026-05-31-kifu-architektur-mvp.md` §7.1: «Die 4 Trainingsteile sind eine feste, unveränderliche Sequenz» und «Eine Übung = genau ein trainingsteil» — gelten künftig nur noch je Schema; die Übung hat genau eine Heimat, aber zwei mögliche Welten.
2. `CLAUDE.md` Überblick: Die Übungsdatenbank ist nicht mehr ausschliesslich «aus dem SFV-Manual Kinderfussball extrahiert».
3. Epic #20 / Story #23, Out of Scope 3: «Eine Untergliederung der übrigen Trainingsteile ist nicht vorgesehen» — für das Juniorenschema überholt (Einstieg wird untergliedert).
4. `schema/uebung.schema.json`, Titel «Kinderfussball Übung» — der Titel deckt Junioren-Übungen nicht mehr.

## 10. Errata und Nachträge (Errata 1–5 aus dem Epic-Review 2026-08-16)

1. Die Kategorien-Anekdote steht auf Manual-S. 12, nicht S. 13; die Körperstabilitäts-Bereiche stehen auf S. 75–77.
2. Die Inhalte der drei Einstiegsphasen stehen entgegen der früheren Aussage auch im Manual selbst (Abb. 19 WAS-Zeile: TA/TE/PE, AT-Prävention, AT-Explosivität; Reihenfolge S. 45 und S. 72); nur Phasennamen und Minutenwerte stammen aus dem J+S-Lernbaustein.
3. Zeitbandbreiten: Der Product Owner hat am 2026-08-16 den Broschüren-Wert 45–65 für Spielformen revidiert; es gelten die Manual-Werte 30–45 (Abb. 19), womit die Summen zur 90-Minuten-Gesamtdauer passen. Die Tabelle in Abschnitt 5 ist entsprechend zu lesen.
4. Ergänzung: Der dritte Athletik-Bereich Ermüdungsresistenz gehört laut Manual S. 72 über Spielformen in den Hauptteil und braucht keinen eigenen Unterblock.
5. Der Einstieg hat drei Unterblöcke statt zwei (PO-Entscheid 2026-08-16, im Story-Refinement zu Story 6): Aufwärmen, Spielform zum Trainingsziel, Explosivität. Die ursprüngliche Zweiteilung folgte Abbildung 19; die App bildet stattdessen die drei J+S-Phasen ab, weil die Spielform zum Trainingsziel eine eigenständige Übungsart ist. Die Abschnitte 2 bis 5 sind entsprechend nachgeführt.

6. Nachtrag der Umsetzung (2026-08-28): Für die Übertragung der Zuordnungen beim Schema-Wechsel gilt die Abbildungsregel nur noch als Fallback. Vorrang hat die konservierte Einordnung: Jede Fassung merkt sich beim Wechsel, wo sie im verlassenen Schema lag, und der Rückweg stellt das wieder her. Grund: Die Regel führt «Fussball spielen lernen» und «Vielseitigkeit erleben» beide nach Spielformen zusammen (Z3/Z4) und ist damit nicht umkehrbar; ebenso fielen die Auffangen-Zuordnungen (Z1) dauerhaft in die Nacharbeit. Da der Schema-Wechsel der Migrationspfad des produktiven Bestands ist — bestehende E-Trainings werden von ihren Trainer:innen auf D gehoben —, muss er gefahrlos ausprobierbar sein. Die Tabelle in Abschnitt 2 bleibt unverändert gültig für die Einordnung neuer Zuordnungen und für Trainings ohne Konserve.

7. Der Abschluss hat keinen Unterblock mehr (PO-Entscheid 2026-08-31, Story #127): Ein Teil mit nur einem Block braucht keine Untergliederung. Der sechste Junioren-Block heisst neu `jun-abschluss`/«Abschluss»; der Begriff «Ausklang» verschwindet im Juniorenfussball vollständig (im Kinderfussball bleibt er als Trainingsteil bestehen). «Abschluss / Ausklang» in den Abschnitten 2 bis 5 ist entsprechend als «Abschluss» zu lesen. Zugleich verliert der Abschluss seine Veröffentlichungspflicht und behält nur den Leer-Hinweis. Die Abbildungsregel selbst bleibt gültig (Z6: `ausklang` → Abschluss).

8. **Z1 revidiert: Das Auffangen hat neu eine Entsprechung** (PO-Entscheid 2026-08-31, Story #128). Das Juniorenschema der Anwendung erhält einen ersten Trainingsteil «Auffangen» mit dem einzigen Block `jun-auffangen` — die Zeit, in der die Jugendlichen gestaffelt eintreffen. Damit gilt in beiden Richtungen: `auffangen` ↔ `jun-auffangen` (in der Rückrichtung ohne Hauptteilkategorie). Der Zielwertebereich in Abschnitt 2 umfasst entsprechend sieben statt sechs befüllbare Stellen, und Z1 lautet nicht mehr «ohne Entsprechung»; die Zeilen Z2–Z7 bleiben unverändert, und die Regel bleibt lückenlos und überlappungsfrei. Auch die Erreichbarkeitstabelle in Abschnitt 3 gewinnt eine Zeile: Auffangen ist über Z1 und über die direkte Junioren-Einordnung erreichbar.

   Begründung: Der frühere Ausschluss stützte sich darauf, dass das Manual Fussball Jugendliche keinen Vor-Trainings-Teil kennt. Das trifft weiterhin zu — der neue Teil ist eine bewusste Erweiterung über das Manual hinaus, aus dem eigenen Bedarf des Product Owners als Junioren-Trainer. Er bleibt in jeder Hinsicht freiwillig: keine Veröffentlichungspflicht, kein Leer-Hinweis, kein Zeitrichtwert, und wie im Kinderfussball trägt er keine Dauer, weil er nicht zur Trainingszeit zählt. Erscheinungsform und Übungstyp gibt es dort ebenfalls nicht: Beide sind Kategorien des Manuals. Der in Errata 6 genannte Grund, Auffangen-Zuordnungen fielen beim Schema-Wechsel in die Nacharbeit, entfällt damit ersatzlos.

9. **Abschnitt 3 revidiert: Die Explosivität ist über den Junioren-Bestand erreichbar** (PO-Entscheid 2026-09-01, Story #134). Die dortige Aussage, Explosivität sei über den Bestand strukturell nicht erreichbar, bleibt für die KINDERFUSSBALL-Herkunft richtig und unverändert — kein Kinderfussball-Attribut trägt ein Signal für Explosivitäts-Inhalte. Für den Junioren-Bestand gilt sie nicht mehr: Der Übungs-Picker eines Blocks schlägt neu zusätzlich vor, was die Erscheinungsform dieses Blocks trägt. Das Manual ordnet im Bereich Athletik drei Erscheinungsformen je einem Trainingsinhalt zu; zwei davon haben einen Block und wirken darum als zusätzliche Vorschlagsquelle: «Explosiv und dynamisch agieren» → Explosivität, «Den Körper stabil halten» → Aufwärmen (letzteres deckt sich mit der Feststellung in Abschnitt 3 und Errata 4, dass die Körperstabilität laut Manual S. 72 ins Aufwärmen integriert gehört). Die dritte, «Viele intensive Spielaktionen bis ans Spielende ausführen», bleibt ohne Wirkung, weil das Schema für die Ermüdungsresistenz keinen Block führt (Errata 4).

   Abgrenzung: Das ist keine Änderung der Abbildungsregel. Sie wirkt nur INNERHALB des Juniorenfussballs und nur in Richtung Block; über die Stufengrenze wird weiterhin nichts zugeordnet, und die Aussage in Abschnitt 8, eine Explosivitäts-Übung sei in Kinderfussball-Trainings nicht zuweisbar, bleibt in Kraft. Ebenso unberührt bleibt die Erreichbarkeitstabelle in Abschnitt 3, soweit sie von der Kinderfussball-Herkunft spricht.

## 11. Abnahme

Abbildungsregel erstmals abgenommen durch Product Owner am 2026-08-15 (damals mit zwei Einstiegs-Unterblöcken). Geänderte Fassung erneut abgenommen am 2026-08-16: Der Einstieg hat drei Unterblöcke gemäss den J+S-Phasen (Aufwärmen, Spielform zum Trainingsziel, Explosivität), die direkte Junioren-Heimat umfasst alle drei, die Spielform zum Trainingsziel wird rückwärts als Einleitung eingeordnet, und die Zeitwerte je Unterblock lauten 10–12, 6–8 und 8–10 Minuten. Unverändert bestätigt: Explosivitäts-Übungen sind in Kinderfussball-Trainings nicht zuweisbar.
