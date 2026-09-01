set lock_timeout = '5s';

-- ============================================================================
-- Story #128: Auffangen auch im Junioren-Training
-- ============================================================================
-- Das Manual Fussball Jugendliche beginnt eine Trainingseinheit mit dem
-- Einstieg; einen Teil davor kennt es nicht. Der Product Owner erweitert das
-- Schema am 2026-08-31 bewusst darüber hinaus: Auch Jugendliche treffen
-- gestaffelt ein, und diese Zeit soll planbar sein. Der neue erste Block heisst
-- `jun-auffangen` («Auffangen») und ist zugleich sein eigener Trainingsteil —
-- einblockig wie der Abschluss seit Story #127.
--
-- Er ist in jeder Hinsicht freiwillig: keine Veröffentlichungspflicht, kein
-- Leer-Hinweis, kein Zeitrichtwert. Und er zählt wie sein
-- Kinderfussball-Namensvetter nicht zur Trainingszeit — darum trägt er keine
-- Dauer. Erscheinungsform und Übungstyp gibt es dort ebenfalls nicht: Beide
-- sind Kategorien des Manuals, und das Auffangen steht ausserhalb davon.
--
-- Vier Regeln ändern sich, drei bleiben ausdrücklich unberührt (Abschnitte 5–7).
--
-- Auf `exercises` validieren die neuen CHECKs inline: Sie erweitern entweder
-- bloss einen Wertebereich (Abschnitt 1 — jede Altzeile erfüllt sie unverändert)
-- oder sie sprechen allein über einen Block, den es bis zu dieser Migration gar
-- nicht gab, weshalb kein Altbestand darunter fallen kann (Abschnitt 2). Auf
-- `training_exercises` bleiben sie NOT VALID — derselbe Stand wie bisher
-- (Issue #45), keine neue Aussage über Altzeilen.

-- ----------------------------------------------------------------------------
-- 1) Wertebereich der Einordnung: `jun-auffangen` als erster Junioren-Block
-- ----------------------------------------------------------------------------
-- Reine Erweiterung der erlaubten Menge. Der Kinderfussball-Zweig ist
-- wortgleich der bisherige.
alter table exercises drop constraint ex_trainingsteil_je_altersstufe;
alter table exercises add constraint ex_trainingsteil_je_altersstufe check (
  case altersstufe
    when 'kinderfussball'
      then trainingsteil in ('auffangen','einleitung','hauptteil','ausklang')
    else trainingsteil in (
      'jun-auffangen','jun-aufwaermen','jun-spielform-trainingsziel',
      'jun-explosivitaet','jun-spielformen','jun-spiel','jun-abschluss')
  end
);
comment on constraint ex_trainingsteil_je_altersstufe on exercises is
  'Spiegel von altersstufeDerEinordnung() in web/lib/altersstufe.ts.';

alter table training_exercises drop constraint te_trainingsteil_je_altersstufe;
alter table training_exercises add constraint te_trainingsteil_je_altersstufe check (
  case altersstufe
    when 'kinderfussball'
      then trainingsteil in ('auffangen','einleitung','hauptteil','ausklang')
    else trainingsteil in (
      'jun-auffangen','jun-aufwaermen','jun-spielform-trainingsziel',
      'jun-explosivitaet','jun-spielformen','jun-spiel','jun-abschluss')
  end
) not valid;
comment on constraint te_trainingsteil_je_altersstufe on training_exercises is
  'Spiegel von altersstufeDerEinordnung() in web/lib/altersstufe.ts.';

-- ----------------------------------------------------------------------------
-- 2) Erscheinungsform: im Auffangen keine (Story #128 AC 5, PC 2)
-- ----------------------------------------------------------------------------
-- Wortgleich mit der bisherigen Fassung (20260830102000), bis auf einen neuen
-- ersten Zweig. Er muss VOR dem Junioren-Zweig stehen, sonst finge dieser das
-- Auffangen ab und liesse den ganzen Junioren-Katalog zu. Die Bedingung nennt
-- nur den Trainingsteil: `jun-auffangen` gibt es nach Abschnitt 1 ausschliesslich
-- im Juniorenfussball.
alter table exercises drop constraint erscheinungsform_je_altersstufe;
alter table exercises add constraint erscheinungsform_je_altersstufe check (
  case
    when trainingsteil = 'jun-auffangen' then erscheinungsform = '{}'::text[]
    when altersstufe = 'juniorenfussball' then erscheinungsform <@ array[
      'spiel-variantenreich-aufbauen','torchancen-vorbereiten-abschliessen',
      'offensive-zweikaempfe-bestreiten','ballorientiert-kompakt-verteidigen',
      'defensive-zweikaempfe-bestreiten','schnell-umschalten',
      'explosiv-dynamisch-agieren','koerper-stabil-halten',
      'intensive-spielaktionen-ausfuehren','positiv-miteinander-umgehen',
      'mutig-selbstbewusst-handeln']
    when trainingsteil in ('hauptteil','einleitung') then erscheinungsform <@ array[
      'spiel-kreativ-gestalten','ball-entschlossen-erobern',
      'mutig-tore-erzielen','mutig-tore-verhindern',
      'flink-geschickt-bewegen','respektvoll-fair-spielen']
    else erscheinungsform = '{}'::text[]
  end
);
comment on constraint erscheinungsform_je_altersstufe on exercises is
  'Spiegel von erscheinungsformenFuer() und traegtErscheinungsform() in web/lib/altersstufe.ts.';

alter table training_exercises drop constraint te_erscheinungsform_je_altersstufe;
alter table training_exercises add constraint te_erscheinungsform_je_altersstufe check (
  case
    when trainingsteil = 'jun-auffangen' then erscheinungsform = '{}'::text[]
    when altersstufe = 'juniorenfussball' then erscheinungsform <@ array[
      'spiel-variantenreich-aufbauen','torchancen-vorbereiten-abschliessen',
      'offensive-zweikaempfe-bestreiten','ballorientiert-kompakt-verteidigen',
      'defensive-zweikaempfe-bestreiten','schnell-umschalten',
      'explosiv-dynamisch-agieren','koerper-stabil-halten',
      'intensive-spielaktionen-ausfuehren','positiv-miteinander-umgehen',
      'mutig-selbstbewusst-handeln']
    when trainingsteil in ('hauptteil','einleitung') then erscheinungsform <@ array[
      'spiel-kreativ-gestalten','ball-entschlossen-erobern',
      'mutig-tore-erzielen','mutig-tore-verhindern',
      'flink-geschickt-bewegen','respektvoll-fair-spielen']
    else erscheinungsform = '{}'::text[]
  end
) not valid;
comment on constraint te_erscheinungsform_je_altersstufe on training_exercises is
  'Spiegel von erscheinungsformenFuer() und traegtErscheinungsform() in web/lib/altersstufe.ts.';

-- ----------------------------------------------------------------------------
-- 3) Übungstyp: keine Änderung nötig (Story #128 AC 6, PC 3)
-- ----------------------------------------------------------------------------
-- `ex_uebungstyp_nur_junioren` (gleichnamig auf beiden Tabellen) ist eine
-- Positivliste: Erlaubt ist ein Übungstyp nur in den vier Blöcken, in denen
-- eine Spielform vorkommen kann. `jun-auffangen` steht nicht darin und trägt
-- damit ohne Zutun keinen — genau die gewollte Regel. Die Selbstprüfung unten
-- hält fest, dass das so bleibt.

-- ----------------------------------------------------------------------------
-- 4) Dauer: das Auffangen trägt in BEIDEN Altersstufen keine (AC 8, PC 4)
-- ----------------------------------------------------------------------------
-- Der CHECK stammt aus 20260610120000 (damals auf `plan_exercises`, mit der
-- Tabelle umbenannt) und kannte nur den Kinderfussball-Teil. Er wird um den
-- Junioren-Block erweitert und inline validiert: `jun-auffangen` gibt es vor
-- dieser Migration nicht, keine Altzeile kann ihn tragen.
alter table training_exercises drop constraint dauer_nicht_auffangen;
alter table training_exercises add constraint dauer_nicht_auffangen
  check (trainingsteil not in ('auffangen','jun-auffangen') or duration_min is null);
comment on constraint dauer_nicht_auffangen on training_exercises is
  'Spiegel von OHNE_DAUER_TEILE / teilTraegtDauer() in web/lib/training.ts.';

-- ----------------------------------------------------------------------------
-- 5) Ablaufform: keine Änderung nötig (Story #128 AC 4)
-- ----------------------------------------------------------------------------
-- `ablauf_je_einordnung` und `te_ablauf_je_einordnung` verzweigen im
-- Juniorenfussball blockunabhängig: kein methodischer Fahrplan, `aufbau`
-- zwingend nicht leer. Das gilt für den neuen Block ohne Zutun — eine
-- Junioren-Übung im Auffangen trägt wie jede andere einen zusammenhängenden
-- Beschreibungstext, und zwar als Pflicht.

-- ----------------------------------------------------------------------------
-- 6) Veröffentlichungs-Bedingungen: keine Änderung (AC 10)
-- ----------------------------------------------------------------------------
-- `training_fehlende_bedingungen` zählt im Junioren-Zweig vier Pflicht-Blöcke
-- auf. Das Auffangen kommt bewusst NICHT dazu: Ein Training ohne Auffangen ist
-- der Normalfall, kein Mangel. Auch einen Leer-Hinweis erhält es nicht
-- (Out of Scope 3) — der lebt ohnehin allein in der Applikation.

-- ----------------------------------------------------------------------------
-- 7) Fahrplan-Vollständigkeit: keine Änderung
-- ----------------------------------------------------------------------------
-- `fahrplan_vollstaendig` greift nur bei `trainingsteil in
-- ('einleitung','hauptteil')` — Kinderfussball-Werte. Für eine Junioren-Zeile
-- gilt unverändert der ELSE-Zweig.

-- ----------------------------------------------------------------------------
-- 8) Selbstprüfung
-- ----------------------------------------------------------------------------
-- Zwei Fragen: Kennen die vier geänderten CHECKs den neuen Block? Und verbietet
-- ihn kein anderer versehentlich? Die zweite Frage beantwortet ein Scan über
-- alle CHECKs der beiden Tabellen: Wer eine Liste von Junioren-Blöcken
-- aufzählt, aber `jun-auffangen` auslässt, schliesst ihn aus — erlaubt ist das
-- nur dort, wo es Absicht ist (Abschnitt 3). Ein Fund rollt die ganze Datei
-- zurück.
do $$
declare
  v_funde text;
  -- Ausdrücklich gewollte Auslassungen (Abschnitt 3).
  v_gewollt text[] := array['ex_uebungstyp_nur_junioren'];
begin
  select string_agg(fund, ', ' order by fund) into v_funde from (
    -- a) Die vier geänderten CHECKs müssen den neuen Block nennen.
    (select format('CHECK %I an %s nennt jun-auffangen nicht', c.conname, c.conrelid::regclass) as fund
       from pg_constraint c
      where c.conname in (
              'ex_trainingsteil_je_altersstufe','te_trainingsteil_je_altersstufe',
              'erscheinungsform_je_altersstufe','te_erscheinungsform_je_altersstufe',
              'dauer_nicht_auffangen')
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) not like '%jun-auffangen%')
    union all
    -- b) Kein weiterer CHECK der beiden Tabellen zählt Junioren-Blöcke auf,
    --    ohne den neuen mitzunehmen.
    (select format('CHECK %I an %s schliesst jun-auffangen aus', c.conname, c.conrelid::regclass)
       from pg_constraint c
      where c.contype = 'c'
        and c.conrelid in ('exercises'::regclass, 'training_exercises'::regclass)
        and not (c.conname = any (v_gewollt))
        and pg_get_constraintdef(c.oid) like '%jun-aufwaermen%'
        and pg_get_constraintdef(c.oid) not like '%jun-auffangen%')
    union all
    -- c) Der Übungstyp bleibt dem Auffangen verwehrt (Abschnitt 3).
    (select format('CHECK %I an %s lässt im Auffangen einen Übungstyp zu', c.conname, c.conrelid::regclass)
       from pg_constraint c
      where c.conname = 'ex_uebungstyp_nur_junioren'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%jun-auffangen%')
    union all
    -- d) Das Auffangen ist keine Veröffentlichungs-Bedingung (Abschnitt 6).
    (select format('Funktion %I nennt jun-auffangen', p.proname)
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'training_fehlende_bedingungen'
        and p.prosrc like '%jun-auffangen%')
  ) f;

  if v_funde is not null then
    raise exception 'Einführung von jun-auffangen unvollständig: %', v_funde;
  end if;
end;
$$;

reset lock_timeout;
