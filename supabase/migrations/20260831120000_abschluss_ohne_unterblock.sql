set lock_timeout = '5s';

-- ============================================================================
-- Story #127: Abschluss im Juniorenschema ohne Unterblock
-- ============================================================================
-- Der Abschluss war der einzige Junioren-Trainingsteil mit genau einem
-- Unterblock: «Abschluss» und darunter «Ausklang», beide mit demselben
-- Richtwert — eine Verschachtelung ohne Inhalt. Der Product Owner entscheidet
-- am 2026-08-31: Ein Teil mit nur einem Block braucht keine Untergliederung,
-- und der Begriff «Ausklang» verschwindet im Juniorenfussball vollständig
-- (im Kinderfussball bleibt er als Trainingsteil unverändert). Der sechste
-- Junioren-Block heisst darum neu `jun-abschluss`.
--
-- Zwei Dinge passieren hier:
--   1. Umbenennung der gespeicherten Einordnung `jun-ausklang` → `jun-abschluss`
--      an Übungen und Fassungen, samt Nachzug der Wertebereichs-CHECKs.
--   2. Der Abschluss verliert seine Veröffentlichungspflicht — an ihre Stelle
--      tritt in der Applikation ein Hinweis (wie beim Spiel-Block).
--
-- Die neuen CHECKs sind auf BEIDEN Tabellen inline validiert — derselbe Stand
-- wie bisher: `ex_/te_trainingsteil_je_altersstufe` waren seit 20260830102000
-- validiert, das UPDATE in derselben Transaktion beweist, dass kein
-- `jun-ausklang` mehr existiert, und alle übrigen Zweige sind wortgleich die
-- Regel, die heute schon gilt.

-- ----------------------------------------------------------------------------
-- 1) Wertebereichs-CHECKs lösen, Daten umbenennen
-- ----------------------------------------------------------------------------
alter table exercises drop constraint ex_trainingsteil_je_altersstufe;
alter table training_exercises drop constraint te_trainingsteil_je_altersstufe;

-- Bulk-Update auf Fassungen: `touch` würde «Geändert» aller betroffenen
-- Trainings auf das Deploy-Datum springen lassen, und das Öffentlich-Gate
-- prüft bei JEDEM Write das ganze Training — beide haben bei einer reinen
-- Umbenennung nichts zu melden.
alter table training_exercises disable trigger training_exercises_touch;
alter table training_exercises disable trigger training_exercises_oeffentlich_gate;

update exercises          set trainingsteil = 'jun-abschluss' where trainingsteil = 'jun-ausklang';
update training_exercises set trainingsteil = 'jun-abschluss' where trainingsteil = 'jun-ausklang';

alter table training_exercises enable trigger training_exercises_touch;
alter table training_exercises enable trigger training_exercises_oeffentlich_gate;

-- ----------------------------------------------------------------------------
-- 2) Wertebereichs-CHECKs mit dem neuen Block-Namen
-- ----------------------------------------------------------------------------
alter table exercises add constraint ex_trainingsteil_je_altersstufe check (
  case altersstufe
    when 'kinderfussball'
      then trainingsteil in ('auffangen','einleitung','hauptteil','ausklang')
    else trainingsteil in (
      'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
      'jun-spielformen','jun-spiel','jun-abschluss')
  end
);
comment on constraint ex_trainingsteil_je_altersstufe on exercises is
  'Spiegel von altersstufeDerEinordnung() in web/lib/altersstufe.ts.';

alter table training_exercises add constraint te_trainingsteil_je_altersstufe check (
  case altersstufe
    when 'kinderfussball'
      then trainingsteil in ('auffangen','einleitung','hauptteil','ausklang')
    else trainingsteil in (
      'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
      'jun-spielformen','jun-spiel','jun-abschluss')
  end
);
comment on constraint te_trainingsteil_je_altersstufe on training_exercises is
  'Spiegel von altersstufeDerEinordnung() in web/lib/altersstufe.ts.';

-- ----------------------------------------------------------------------------
-- 3) Veröffentlichungs-Bedingungen: der Abschluss ist keine mehr
-- ----------------------------------------------------------------------------
-- Wortgleich mit der bisherigen Fassung (20260830103000), bis auf den
-- Junioren-Zweig: die Pflichtliste endet bei den Spielformen. Spiel und
-- Abschluss behalten in der Applikation nur den Hinweis.
create or replace function training_fehlende_bedingungen(p_training_id uuid)
returns text[]
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_stufen text[];
  v_altersstufe text;
  v_missing text[] := '{}';
  v_block text;
begin
  select stufen, altersstufe into v_stufen, v_altersstufe
    from trainings where id = p_training_id;
  if v_altersstufe is null then
    return v_missing; -- Training weg: nichts zu prüfen.
  end if;

  -- In beiden Altersstufen: mindestens eine Alterskategorie.
  if coalesce(array_length(v_stufen, 1), 0) = 0 then
    v_missing := array_append(v_missing, 'stufe');
  end if;

  if v_altersstufe = 'kinderfussball' then
    if not exists (select 1 from training_exercises
                   where training_id = p_training_id and trainingsteil = 'einleitung') then
      v_missing := array_append(v_missing, 'einleitung');
    end if;
    -- Das freie Spiel liegt im Hauptteil: diese Bedingung deckt «mindestens
    -- eine Übung im Hauptteil» zwingend mit ab.
    if not exists (select 1 from training_exercises
                   where training_id = p_training_id
                     and hauptteilkategorie = 'fussball-spielen') then
      v_missing := array_append(v_missing, 'freies_spiel');
    end if;
  else
    -- Spiel und Abschluss fehlen bewusst: das Spiel ist als freies Spiel von
    -- der Pflicht ausgenommen, der Abschluss seit Story #127 (PO 2026-08-31);
    -- beide behalten nur den Hinweis im Editor.
    foreach v_block in array array[
      'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
      'jun-spielformen']
    loop
      if not exists (select 1 from training_exercises
                     where training_id = p_training_id and trainingsteil = v_block) then
        v_missing := array_append(v_missing, v_block);
      end if;
    end loop;
  end if;

  return v_missing;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Selbstprüfung: kein «jun-ausklang» bleibt zurück
-- ----------------------------------------------------------------------------
-- Sucht in Daten, Constraint-Definitionen und im Rumpf der Bedingungs-Funktion.
-- Ein Fund rollt die ganze Datei zurück.
do $$
declare
  v_funde text;
begin
  select string_agg(fund, ', ' order by fund) into v_funde from (
    (select 'Übung mit Einordnung jun-ausklang' as fund
       from exercises where trainingsteil = 'jun-ausklang' limit 1)
    union all
    (select 'Fassung mit Einordnung jun-ausklang'
       from training_exercises where trainingsteil = 'jun-ausklang' limit 1)
    union all
    (select format('Constraint %I an %s', c.conname, c.conrelid::regclass)
       from pg_constraint c
       join pg_class rel on rel.oid = c.conrelid
       join pg_namespace nn on nn.oid = rel.relnamespace
      where nn.nspname = 'public'
        and pg_get_constraintdef(c.oid) like '%jun-ausklang%')
    union all
    (select format('Funktion %I', p.proname)
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'training_fehlende_bedingungen'
        and p.prosrc like '%jun-ausklang%')
  ) f;

  if v_funde is not null then
    raise exception 'Umbenennung jun-ausklang → jun-abschluss unvollständig, zurückgeblieben: %', v_funde;
  end if;
end;
$$;

reset lock_timeout;
