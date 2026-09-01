set lock_timeout = '5s';

-- ============================================================================
-- Story #133: Explosivitäts-Übungen tragen einen Übungstyp
-- ============================================================================
-- Der Übungstyp ist eine Angabe des Manuals Fussball Jugendliche. Am
-- 2026-08-30 hat der Product Owner ihn auf die vier Blöcke beschränkt, in
-- denen eine Spielform vorkommen kann — Begründung damals: die Typologie des
-- Manuals gliedere spielnahe taktische Trainingsformen, und Explosivität wie
-- Abschluss seien keine solchen.
--
-- Dieser Entscheid ist am 2026-09-01 für die EXPLOSIVITÄT aufgehoben: Sie
-- trägt den Übungstyp wie die übrigen Blöcke, optional wie überall. Für den
-- Abschluss (`jun-abschluss`) gilt der Entscheid vom 2026-08-30 unverändert
-- weiter; das Auffangen (`jun-auffangen`) steht ohnehin ganz ausserhalb des
-- Manuals (Story #128), und der Kinderfussball kennt den Übungstyp gar nicht.
--
-- Die Regel steht absichtlich doppelt — hier als CHECK, in
-- web/lib/altersstufe.ts als `traegtUebungstyp()`. Beide Seiten setzen
-- dieselbe Regel durch (NFR), und die `comment on constraint`-Zeilen unten
-- halten die Verlinkung fest.
--
-- Der erste Zweig `uebungstyp is null or …` bleibt unangetastet: Er ist es,
-- der bestehende Explosivitäts-Übungen und -Fassungen OHNE Übungstyp
-- unverändert gültig hält (PC 3). Es gibt keinen Backfill und keine
-- Nacharbeit — der bestehende Bestand bleibt, wie er ist.
--
-- Warum welcher Zweig wie validiert:
--
--   * an `exercises` INLINE (kein `not valid`). Die neue erlaubte Menge ist
--     eine echte OBERMENGE der alten — es kommt nur `jun-explosivitaet` dazu,
--     nichts fällt weg. Jede Bestandszeile, die den alten CHECK erfüllte,
--     erfüllt den neuen unverändert. Und der CHECK war an dieser Tabelle schon
--     bisher validiert (20260830102000), der Full-Table-Scan kann also nichts
--     Neues zutage fördern.
--
--   * an `training_exercises` wieder `not valid`. Dort wurde der CHECK NIE
--     validiert (Issue #45, seit 20260830102000 offen). Ein DROP + ADD ohne
--     `not valid` löst genau den Full-Table-Scan aus, den es dort nie gab, und
--     könnte an Altzeilen scheitern, die schon die HEUTIGE Regel verletzen —
--     etwa Fassungen aus der Zeit zwischen 20260828161807 (Übungstyp noch ohne
--     jede Blockbindung) und 20260830102000. Dass die Lockerung eine Obermenge
--     ist, rettet nur einen Constraint, der unvalidiert BLEIBT; einen neu
--     validierten rettet sie nicht. CI prüft gegen eine LEERE Wegwerf-DB und
--     beweist über den Prod-Bestand nichts.
--
-- Der Selbstprüfungs-Block der vorigen Migration (20260901090000,
-- Abschnitt 8c) verlangt, dass `ex_uebungstyp_nur_junioren` `jun-auffangen`
-- NICHT nennt. Er läuft nur einmal an seiner eigenen Position und kollidiert
-- mit dieser Migration nicht — hier kommt allein `jun-explosivitaet` dazu.

-- ----------------------------------------------------------------------------
-- 1) Übungstyp an der Bibliotheks-Übung: Explosivität kommt dazu
-- ----------------------------------------------------------------------------
-- Wortgleich die Fassung aus 20260830102000, um `jun-explosivitaet` erweitert.
alter table exercises drop constraint ex_uebungstyp_nur_junioren;
alter table exercises add constraint ex_uebungstyp_nur_junioren check (
  uebungstyp is null
  or (altersstufe = 'juniorenfussball'
      and trainingsteil in ('jun-aufwaermen','jun-spielform-trainingsziel',
                            'jun-explosivitaet','jun-spielformen','jun-spiel'))
);
comment on constraint ex_uebungstyp_nur_junioren on exercises is
  'Spiegel von traegtUebungstyp() in web/lib/altersstufe.ts.';

-- ----------------------------------------------------------------------------
-- 2) Übungstyp an der Fassung: dieselbe Regel, weiterhin unvalidiert
-- ----------------------------------------------------------------------------
-- Gleicher Constraint-Name wie an `exercises` (Namen sind in Postgres je
-- Relation eindeutig): es ist dieselbe Regel am gleichen Feld, und die
-- Applikation übersetzt sie über genau diesen Namen in eine Meldung
-- (`ALTERSSTUFE_CHECKS` in web/lib/training-bedingungen.ts).
alter table training_exercises drop constraint ex_uebungstyp_nur_junioren;
alter table training_exercises add constraint ex_uebungstyp_nur_junioren check (
  uebungstyp is null
  or (altersstufe = 'juniorenfussball'
      and trainingsteil in ('jun-aufwaermen','jun-spielform-trainingsziel',
                            'jun-explosivitaet','jun-spielformen','jun-spiel'))
) not valid;
comment on constraint ex_uebungstyp_nur_junioren on training_exercises is
  'Spiegel von traegtUebungstyp() in web/lib/altersstufe.ts.';

-- ----------------------------------------------------------------------------
-- 3) Abschluss: bleibt ohne Übungstyp (Out of Scope 1)
-- ----------------------------------------------------------------------------
-- `jun-abschluss` steht bewusst NICHT in der Positivliste oben. Der Entscheid
-- vom 2026-08-30 gilt für ihn weiter; Story #133 hebt ihn nur für die
-- Explosivität auf.

-- ----------------------------------------------------------------------------
-- 4) Auffangen: bleibt ohne Übungstyp (Out of Scope 1)
-- ----------------------------------------------------------------------------
-- `jun-auffangen` steht ebenfalls nicht in der Liste — unverändert der Stand
-- aus 20260901090000 Abschnitt 3. Der Block ist sein eigener Trainingsteil vor
-- dem Einstieg und steht ausserhalb der Manual-Kategorien.

-- ----------------------------------------------------------------------------
-- 5) Kinderfussball: kennt den Übungstyp weiterhin gar nicht (Out of Scope 2)
-- ----------------------------------------------------------------------------
-- Der zweite Zweig verlangt unverändert `altersstufe = 'juniorenfussball'`.
-- Eine Kinderfussball-Übung darf den Übungstyp nur leer lassen.

-- ----------------------------------------------------------------------------
-- 6) Die Definitionen der drei Übungstypen: unberührt (Out of Scope 4)
-- ----------------------------------------------------------------------------
-- Der Wertebereich der Spalte selbst (`uebungstyp`-CHECK aus 20260828161807,
-- gespeist aus data/vokabular.yaml) wird hier nicht angefasst. Diese Migration
-- ändert nur, WO ein Übungstyp stehen darf, nicht WELCHE es gibt.

-- ----------------------------------------------------------------------------
-- 7) Selbstprüfung
-- ----------------------------------------------------------------------------
-- Drei Fragen an beide CHECKs: Kennen sie den neuen Block? Halten sie
-- Abschluss und Auffangen weiterhin draussen? Und ist keiner der vier
-- bisherigen Blöcke beim Umschreiben verlorengegangen? Ein Fund rollt die
-- ganze Datei zurück.
--
-- Gesucht wird jeweils nach dem Wert MIT seinen einfachen Anführungszeichen,
-- so wie `pg_get_constraintdef` ihn ausgibt (`'jun-spiel'::text`). Eine blosse
-- Teilzeichenketten-Suche wäre hier blind: `'jun-spiel'` steckt in
-- `'jun-spielformen'`, und ein versehentlich weggelassenes `jun-spiel` käme
-- ungesehen durch die eigene Prüfung.
do $$
declare
  v_funde text;
  v_anzahl int;
  -- Die vier Blöcke, die schon bisher einen Übungstyp trugen.
  v_bisher text[] := array[
    'jun-aufwaermen','jun-spielform-trainingsziel','jun-spielformen','jun-spiel'];
begin
  -- a) Beide Tabellen tragen den CHECK — sonst hat ein DROP + ADD nicht
  --    gegriffen und die Regel steht nur noch auf einer Seite.
  select count(*) into v_anzahl
    from pg_constraint c
   where c.conname = 'ex_uebungstyp_nur_junioren'
     and c.contype = 'c'
     and c.conrelid in ('exercises'::regclass, 'training_exercises'::regclass);
  if v_anzahl <> 2 then
    raise exception 'ex_uebungstyp_nur_junioren steht an % von 2 Tabellen', v_anzahl;
  end if;

  select string_agg(fund, ', ' order by fund) into v_funde from (
    -- b) Beide CHECKs müssen die Explosivität nennen (AC 1–3, PC 1/2).
    (select format('CHECK %I an %s nennt jun-explosivitaet nicht', c.conname, c.conrelid::regclass) as fund
       from pg_constraint c
      where c.conname = 'ex_uebungstyp_nur_junioren'
        and c.contype = 'c'
        and c.conrelid in ('exercises'::regclass, 'training_exercises'::regclass)
        and pg_get_constraintdef(c.oid) not like '%''jun-explosivitaet''%')
    union all
    -- c) Abschluss und Auffangen bleiben ausdrücklich aussen vor
    --    (Out of Scope 1; hält zugleich 20260901090000 Abschnitt 3 aufrecht).
    (select format('CHECK %I an %s lässt in %s einen Übungstyp zu',
                   c.conname, c.conrelid::regclass, block)
       from pg_constraint c
       cross join unnest(array['jun-abschluss','jun-auffangen']) as block
      where c.conname = 'ex_uebungstyp_nur_junioren'
        and c.contype = 'c'
        and c.conrelid in ('exercises'::regclass, 'training_exercises'::regclass)
        and pg_get_constraintdef(c.oid) like '%''' || block || '''%')
    union all
    -- d) Keiner der vier bisherigen Blöcke ist beim Umschreiben verlorengegangen.
    (select format('CHECK %I an %s nennt %s nicht mehr',
                   c.conname, c.conrelid::regclass, block)
       from pg_constraint c
       cross join unnest(v_bisher) as block
      where c.conname = 'ex_uebungstyp_nur_junioren'
        and c.contype = 'c'
        and c.conrelid in ('exercises'::regclass, 'training_exercises'::regclass)
        and pg_get_constraintdef(c.oid) not like '%''' || block || '''%')
  ) f;

  if v_funde is not null then
    raise exception 'Übungstyp in der Explosivität unvollständig: %', v_funde;
  end if;
end;
$$;

reset lock_timeout;
