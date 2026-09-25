set lock_timeout = '5s';

-- ============================================================================
-- Story #272 (Epic #266): Spielfeldgrösse in Metern beim freien Feld
-- ============================================================================
-- Bisher trug nur eine Junioren-Übung eine Spielfeldgrösse. Neu darf auch eine
-- Kinderfussball-Übung auf freiem Feld Länge und Breite tragen — Kleinfeld und
-- Grossfeld nicht (Out of Scope 1). Die Regel ersetzt `ex_/te_spielfeld_nur_
-- junioren` auf beiden Tabellen; die Prüfung an der Länge genügt weiterhin,
-- `…_spielfeld_paarweise` bindet die Breite daran.
--
-- Forward-only: Die neue Regel LOCKERT die alte (jede Zeile, die die alte
-- erfüllt, erfüllt auch die neue) — sie lässt sich darum sofort validiert
-- anlegen, ohne NOT VALID. Keine Spalte, keine Tabelle; PUBLIC_TABLES in
-- sync-staging.yml bleibt unverändert.
--
-- Der Name `…_spielfeld_je_feld` trägt den Namensrest, an dem
-- lib/training-bedingungen.ts die Meldung der Regel findet.

alter table exercises drop constraint ex_spielfeld_nur_junioren;
alter table exercises add constraint ex_spielfeld_je_feld check (
  spielfeld_laenge_m is null
  or altersstufe = 'juniorenfussball'
  or (altersstufe = 'kinderfussball' and feldtyp = 'freies_feld')
);
comment on constraint ex_spielfeld_je_feld on exercises is
  'Spiegel von traegtSpielfeldgroesse() in web/lib/altersstufe.ts.';

alter table training_exercises drop constraint te_spielfeld_nur_junioren;
alter table training_exercises add constraint te_spielfeld_je_feld check (
  spielfeld_laenge_m is null
  or altersstufe = 'juniorenfussball'
  or (altersstufe = 'kinderfussball' and feldtyp = 'freies_feld')
);
comment on constraint te_spielfeld_je_feld on training_exercises is
  'Spiegel von traegtSpielfeldgroesse() in web/lib/altersstufe.ts.';

comment on column exercises.spielfeld_laenge_m is
  'Länge des Spielfelds in Metern: im Juniorenfussball, im Kinderfussball beim freien Feld. Nur paarweise mit spielfeld_breite_m.';
comment on column exercises.spielfeld_breite_m is
  'Breite des Spielfelds in Metern: im Juniorenfussball, im Kinderfussball beim freien Feld. Nur paarweise mit spielfeld_laenge_m.';
comment on column training_exercises.spielfeld_laenge_m is
  'Länge des Spielfelds in Metern: im Juniorenfussball, im Kinderfussball beim freien Feld. Nur paarweise mit spielfeld_breite_m.';
comment on column training_exercises.spielfeld_breite_m is
  'Breite des Spielfelds in Metern: im Juniorenfussball, im Kinderfussball beim freien Feld. Nur paarweise mit spielfeld_laenge_m.';

reset lock_timeout;
