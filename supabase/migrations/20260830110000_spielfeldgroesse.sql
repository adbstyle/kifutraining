set lock_timeout = '5s';

-- ============================================================================
-- Story 3 (Epic Übungswelten): Spielfeldgrösse statt Feldtyp im Juniorenfussball
-- ============================================================================
-- Das Manual Fussball Jugendliche führt zu praktisch jeder Trainingsform eine
-- Spielfeldgrösse als eigene Angabe ausserhalb des Beschreibungstexts — «35 ×
-- 20 Meter» und ähnlich. Sie tritt dort an die Stelle des Feldtyps
-- (Kleinfeld/Grossfeld/Freies Feld), der eine Kategorie des Manuals Fussball
-- Kinder ist und seit der Migration `altersstufe_regeln` auf den
-- Kinderfussball beschränkt bleibt.
--
-- Zwei Masse in Metern, wie das Manual sie führt (PO 2026-08-30). Optional,
-- aber paarweise: wer sie angibt, gibt Länge UND Breite an — eine halbe Angabe
-- ist keine Spielfeldgrösse.
--
-- Beide Spalten sind neu und überall null; die Regeln dürfen darum auf beiden
-- Tabellen inline validieren, auch auf `training_exercises`. Ein Deploy kann an
-- keiner Altzeile scheitern, weil es zu diesen Spalten keine Altzeilen gibt.

-- ----------------------------------------------------------------------------
-- 1) Die Bibliotheks-Übung
-- ----------------------------------------------------------------------------
alter table exercises
  add column spielfeld_laenge_m int,
  add column spielfeld_breite_m int;

comment on column exercises.spielfeld_laenge_m is
  'Länge des Spielfelds in Metern (Manual Fussball Jugendliche). Nur im Juniorenfussball, nur paarweise mit spielfeld_breite_m.';
comment on column exercises.spielfeld_breite_m is
  'Breite des Spielfelds in Metern (Manual Fussball Jugendliche). Nur im Juniorenfussball, nur paarweise mit spielfeld_laenge_m.';

-- Paarweise: beide oder keine. Der Vergleich zweier IS-NULL-Prädikate ist
-- selbst nie null, der CHECK also immer entschieden.
alter table exercises add constraint ex_spielfeld_paarweise check (
  (spielfeld_laenge_m is null) = (spielfeld_breite_m is null)
);
comment on constraint ex_spielfeld_paarweise on exercises is
  'Spiegel der Spielfeld-Prüfung in parseUebungsInhalt (web/lib/uebung-form.ts).';

-- Bereich 5–120 Meter: unter 5 m ist es kein Spielfeld mehr, über 120 m endet
-- das grösste zulässige Fussballfeld. Kein Grössenverhältnis erzwungen — das
-- Manual kennt sowohl längliche als auch breite Felder.
alter table exercises add constraint ex_spielfeld_bereich check (
  (spielfeld_laenge_m is null or spielfeld_laenge_m between 5 and 120)
  and (spielfeld_breite_m is null or spielfeld_breite_m between 5 and 120)
);
comment on constraint ex_spielfeld_bereich on exercises is
  'Spiegel der Spielfeld-Prüfung in parseUebungsInhalt (web/lib/uebung-form.ts).';

-- Nur im Juniorenfussball — das Gegenstück zu `ex_feldtyp_nur_kifu`. Die
-- Prüfung an der Länge genügt: `ex_spielfeld_paarweise` bindet die Breite
-- daran.
alter table exercises add constraint ex_spielfeld_nur_junioren check (
  altersstufe = 'juniorenfussball' or spielfeld_laenge_m is null
);
comment on constraint ex_spielfeld_nur_junioren on exercises is
  'Spiegel von traegtSpielfeldgroesse() in web/lib/altersstufe.ts.';

-- ----------------------------------------------------------------------------
-- 2) Die Fassung im Training
-- ----------------------------------------------------------------------------
-- Eine Fassung ist eine eigenständige Kopie und trägt denselben Feldsatz wie
-- ihre Vorlage; sonst ginge die Spielfeldgrösse beim Übernehmen verloren.
alter table training_exercises
  add column spielfeld_laenge_m int,
  add column spielfeld_breite_m int;

comment on column training_exercises.spielfeld_laenge_m is
  'Länge des Spielfelds in Metern (Manual Fussball Jugendliche). Nur im Juniorenfussball, nur paarweise mit spielfeld_breite_m.';
comment on column training_exercises.spielfeld_breite_m is
  'Breite des Spielfelds in Metern (Manual Fussball Jugendliche). Nur im Juniorenfussball, nur paarweise mit spielfeld_laenge_m.';

alter table training_exercises add constraint te_spielfeld_paarweise check (
  (spielfeld_laenge_m is null) = (spielfeld_breite_m is null)
);
comment on constraint te_spielfeld_paarweise on training_exercises is
  'Spiegel der Spielfeld-Prüfung in parseUebungsInhalt (web/lib/uebung-form.ts).';

alter table training_exercises add constraint te_spielfeld_bereich check (
  (spielfeld_laenge_m is null or spielfeld_laenge_m between 5 and 120)
  and (spielfeld_breite_m is null or spielfeld_breite_m between 5 and 120)
);
comment on constraint te_spielfeld_bereich on training_exercises is
  'Spiegel der Spielfeld-Prüfung in parseUebungsInhalt (web/lib/uebung-form.ts).';

alter table training_exercises add constraint te_spielfeld_nur_junioren check (
  altersstufe = 'juniorenfussball' or spielfeld_laenge_m is null
);
comment on constraint te_spielfeld_nur_junioren on training_exercises is
  'Spiegel von traegtSpielfeldgroesse() in web/lib/altersstufe.ts.';

reset lock_timeout;
