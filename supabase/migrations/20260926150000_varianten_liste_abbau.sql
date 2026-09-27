-- ============================================================================
-- Story #286: Alte Varianten-Liste entfernen (Schritt 2 von 2 zu #282)
-- ============================================================================
-- Schritt 1 (20260926090000_varianten_freitext, Release 1.15.0) hat die
-- Varianten als Freitext in `varianten_text` eingeführt und die alte Liste
-- `varianten text[]` per Trigger mitgeführt, damit das noch ausgelieferte
-- Bundle im Deploy-Fenster weiterlief. Seit 1.15.0 auf Produktion liest und
-- schreibt kein Code mehr die Liste (Precondition 1) — der Abbau ist damit im
-- Deploy-Fenster ungefährlich.
--
-- Reihenfolge Trigger → Funktionen → Spalten: Postgres trackt nicht, welche
-- Spalten ein plpgsql-Rumpf liest. Fiele die Spalte zuerst, bliebe der Drop
-- stumm, und danach scheiterte JEDES Insert und Update auf beiden Tabellen mit
-- «record "new" has no field "varianten"».
--
-- Bleibt: `varianten_text` (nicht umbenannt, Out of Scope 1) und
-- `freitext_suchtext`, die der Such-Trigger weiter braucht. Den Suchtext
-- bildet `exercises_search_refresh` seit Schritt 1 schon allein aus
-- `varianten_text` — Anzeige und Suche bleiben unverändert (AK 3).
--
-- Kein Datenverlust (NFR 1): Seit Schritt 1 ist `varianten_text` in jeder
-- Zeile die führende Fassung; die Liste war nur noch ein daraus abgeleiteter
-- Spiegel ohne Listenzeichen und Formatierung.
--
-- Kein explizites begin/commit: die Supabase-CLI klammert je Datei.

-- `drop column` braucht ACCESS EXCLUSIVE. Ganz vorn, damit der Lauf bei einem
-- blockierenden Lock schnell scheitert statt jeden Lesezugriff aufzustauen.
-- Ohne `local` (siehe 20260826131338_herkunftsangaben_abbau); die letzte
-- Anweisung nimmt die Schranke zurück.
set lock_timeout = '5s';

-- ── Abgleich entfällt (AK 1) ──────────────────────────────────────────────
-- Ohne `cascade`: ein übersehener weiterer Verwender liesse die Migration
-- abbrechen, statt still mitgerissen zu werden.
drop trigger exercises_abgleich_varianten on exercises;
drop trigger te_abgleich_varianten on training_exercises;
drop function varianten_abgleichen();
drop function varianten_als_text(text[]);
drop function varianten_als_liste(text);

-- ── Die alte Liste fällt (AK 2, PC 1) ─────────────────────────────────────
alter table exercises drop column varianten;
alter table training_exercises drop column varianten;

-- Der Kommentar aus Schritt 1 kündigte den Wegfall an; er steht jetzt fest.
comment on column exercises.varianten_text is
  'Varianten als Freitext mit einfachen Listen (Story #282); Regeln in web/lib/freitext.ts.';

reset lock_timeout;
