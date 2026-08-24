-- ============================================================================
-- Story 9 AK 7 (Epic #72): Verweis-Abbau — Fassungen sind die einzige Quelle
-- ============================================================================
-- Schritt 4 des vierschrittigen Verfahrens (Spike Gate 7), erst nach GRÜNEM
-- maschinellem Nachweis in Produktion (2026-08-24: 37/37 Zuordnungen stehen
-- für sich, 0 Mängel). Kein Nutzdatenverlust: alle Inhalte liegen seit der
-- Bestand-Überführung in den Fassungs-Spalten; der Übungs-Verweis wurde seither
-- nur noch als Lese-Brücke für das Auslieferungsfenster mitgeführt.

-- ----------------------------------------------------------------------------
-- 1) Phasen-Guard entfällt
-- ----------------------------------------------------------------------------
-- Seine letzte Aufgabe — die Kategorie ausserhalb des Hauptteils zu leeren —
-- erledigt die App an der einzigen Stelle, die die Einordnung ändert
-- (parseUebungsInhalt liefert die Kategorie nur für den Hauptteil, sonst NULL).
-- Als Backstop bleibt der validierte Biconditional-CHECK
-- training_ex_hkat_genau_bei_hauptteil bestehen.
drop trigger training_exercise_phase on training_exercises;
drop function training_exercise_phase_guard();

-- ----------------------------------------------------------------------------
-- 2) Der Name wird Pflicht
-- ----------------------------------------------------------------------------
-- `set not null` ist hier gefahrlos verschärft (CLAUDE.md: Backfill vor
-- Verschärfung): die Bestand-Überführung hat jede Zeile benannt, der Nachweis
-- hat es belegt, und das seit Teil B laufende Bundle schreibt Zuordnungen nur
-- noch als vollständige Fassungen mit Namen.
--
-- exercise_id und exercise_name_cache bleiben hier noch stehen: das alte
-- Bundle SELEKTIERT sie bis zum Vercel-Bundle-Swap — ein Drop in derselben
-- Migration bräche im Deploy-Fenster jede Trainings-Ansicht. Sie fallen in
-- der Folge-Migration, sobald kein Bundle sie mehr liest; ab diesem Release
-- schreibt und liest sie niemand mehr.
alter table training_exercises
  alter column name set not null;

-- ----------------------------------------------------------------------------
-- 3) publish_training bereinigen
-- ----------------------------------------------------------------------------
-- (a) Der Übergangs-Check «alle Zuordnungen überführt» ist mit NOT NULL auf
--     name konstruktiv erfüllt und entfällt.
-- (b) Der ignorierte Alt-Parameter p_include_private kann jetzt weg: das seit
--     Teil B laufende Bundle ruft die RPC einstellig auf — diese Aufrufform
--     passt dank DEFAULT auf die alte wie auf die neue Signatur, das Deploy-
--     Fenster ist also in beide Richtungen unkritisch.
drop function publish_training(uuid, boolean);

create function publish_training(p_training_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_missing text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from trainings where id = p_training_id and owner_id = v_uid
  ) then
    raise exception 'training not found or not owned by caller';
  end if;

  -- Vollständigkeit: mind. eine Stufe, Einleitung und Hauptteil belegt.
  if not exists (
    select 1 from trainings
    where id = p_training_id and coalesce(array_length(stufen, 1), 0) >= 1
  ) then
    v_missing := array_append(v_missing, 'stufe');
  end if;
  if not exists (
    select 1 from training_exercises
    where training_id = p_training_id and trainingsteil = 'einleitung'
  ) then
    v_missing := array_append(v_missing, 'einleitung');
  end if;
  if not exists (
    select 1 from training_exercises
    where training_id = p_training_id and trainingsteil = 'hauptteil'
  ) then
    v_missing := array_append(v_missing, 'hauptteil');
  end if;
  if array_length(v_missing, 1) >= 1 then
    return jsonb_build_object('status', 'incomplete', 'missing', to_jsonb(v_missing));
  end if;

  update trainings set visibility = 'public' where id = p_training_id;
  return jsonb_build_object('status', 'published');
end;
$$;

revoke all on function publish_training(uuid) from public, anon;
grant execute on function publish_training(uuid) to authenticated;
