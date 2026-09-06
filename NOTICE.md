# Grundlagen, Fremdlizenzen und Namensnennungen

Dieses Werk steht unter [CC BY-SA 4.0](LICENSE). Diese Datei nennt, worauf es
aufbaut und was es von Dritten verwendet.

## Fachliche Grundlagen

Die Übungen in `data/uebungen/`, die Diagramme in `data/diagramme/` und die
Trainingsstruktur der Anwendung beruhen auf Material des **Schweizerischen
Fussballverbands (SFV)** und von **Jugend+Sport (J+S, Bundesamt für Sport
BASPO)**:

| Grundlage | Herausgeber | Was daraus stammt |
|---|---|---|
| Manual Kinderfussball | SFV | die 75 Übungen des kuratierten Bestands (Aufbau, Regeln, Ablauf, Alterskategorien G/F/E), das Trainingsschema Auffangen – Einleitung – Hauptteil – Ausklang, die Hauptteilkategorien und Erscheinungsformen |
| Manual Fussball Jugendliche | SFV / BASPO | Trainingsschema Einstieg – Hauptteil – Abschluss, Blöcke und Erscheinungsformen des Juniorenfussballs (D/C/B/A) |
| Lernbaustein «Der Einstieg» | J+S (tool.jugendundsport.ch) | Phasen und Richtwerte der Einstiegsphase im Juniorenfussball |

Die Manuals selbst sind **nicht** Teil dieses Repositories und stehen nicht
unter CC BY-SA. Übungstexte und Diagramme sind eigene Formulierung bzw. eigene
Zeichnung in eigener Symbolsprache; jede Übung nennt in `quelle` die Seite des
Manuals, auf die sie zurückgeht. Die Namensnennung bedeutet keine Billigung
durch SFV oder BASPO.

## Fremdsoftware in der Web-App (`web/`)

Direkte Abhängigkeiten laut `web/package.json`. Die vollständigen Lizenztexte
liegen in den jeweiligen Paketen unter `node_modules/`.

| Paket | Lizenz | Urheber / Projekt |
|---|---|---|
| next | MIT | Vercel, Inc. — https://nextjs.org |
| react, react-dom | MIT | Meta Platforms, Inc. — https://react.dev |
| @supabase/supabase-js, @supabase/ssr | MIT | Supabase, Inc. — https://supabase.com |
| tailwindcss, @tailwindcss/postcss | MIT | Tailwind Labs, Inc. — https://tailwindcss.com |
| postcss | MIT | Andrey Sitnik — https://postcss.org |
| lucide-react | ISC | Lucide Contributors — https://lucide.dev |
| browser-image-compression | MIT | Donald Chan — https://github.com/Donaldcwl/browser-image-compression |
| **heic-to** | **LGPL-3.0** | hoppergee — https://github.com/hoppergee/heic-to (nutzt libheif, LGPL-3.0) |
| js-yaml, @types/js-yaml | MIT | Vitaly Puzrin / DefinitelyTyped |
| server-only | MIT | Vercel, Inc. |
| typescript | Apache-2.0 | Microsoft Corporation — https://www.typescriptlang.org |
| tsx | MIT | Hiroki Osame — https://github.com/privatenumber/tsx |
| @types/node, @types/react, @types/react-dom | MIT | DefinitelyTyped |

**Hinweis zu heic-to (LGPL-3.0):** Die Bibliothek wird unverändert als
npm-Paket eingebunden und im Browser nur bei Bedarf geladen (HEIC-Fotos von
iPhones). Wer die App weiterverbreitet, muss den LGPL-Text mitliefern und die
Bibliothek austauschbar halten; der Quellcode ist unter dem genannten Link
verfügbar.

### Schriften

Über `next/font/google` eingebunden und beim Build mit ausgeliefert, alle
unter der **SIL Open Font License 1.1** (OFL):

| Schrift | Urheber |
|---|---|
| Anton | Vernon Adams |
| Source Serif 4 | Frank Grießhammer, Adobe Systems |
| Space Mono | Colophon Foundry |

## Fremdsoftware in der Übungs-Datenbank (Repo-Root)

| Paket | Lizenz | Projekt |
|---|---|---|
| PyYAML | MIT | https://pyyaml.org |
| jsonschema | MIT | https://github.com/python-jsonschema/jsonschema |
| pytest | MIT | https://pytest.org |

## Werkzeuge, die nur lokal genutzt werden

Nicht Teil des Repositories, aber Voraussetzung für einzelne Skripte:
**poppler** (`pdftotext`, `pdftoppm`; GPL-2.0-or-later) für
`scripts/extract.py` und `scripts/extract_kategorien.py`; **Supabase CLI**
(MIT) und **Vercel** für Betrieb und Deployment.
