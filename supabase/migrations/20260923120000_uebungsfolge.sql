set lock_timeout = '5s';

-- ============================================================================
-- Story #193 (Epic #190): Reihenfolge eines Abschnitts in einem Zug
-- ============================================================================
-- Der KI-Assistent soll die Übungen eines Trainingsteils bzw. Blocks in einem
-- Aufruf neu ordnen (#193 AK 9, Spike #191 AK 7.4). Die Oberfläche kennt dafür
-- kein Pendant — sie verschiebt nur um eine Position (`move_training_exercise`).
-- Vorbild ist die Gruppen-Durchlauffolge (`setze_gruppenfolge`), die als
-- Ganzes ersetzt wird.
--
-- Ein ABSCHNITT ist das, worin eine Position eindeutig ist: Einordnung, im
-- Kinderfussball-Hauptteil zusätzlich die Hauptteilkategorie, im Hauptteil
-- beider Altersstufen zusätzlich die Variante (#201). Genau das sind die
-- Schlüssel der Indizes `training_ex_pos_*`.
--
-- Zwei Schritte über negative Zwischenwerte: Die Positions-Indizes sind
-- PARTIELLE Unique-Indizes und damit nicht aufschiebbar — eine Permutation in
-- EINEM Update kollidierte zeilenweise. Erst alle Zeilen auf -1..-n, dann auf
-- 0..n-1 (dasselbe Vorgehen wie `move_training_exercise` mit -1; einen CHECK
-- `position >= 0` gibt es bewusst nicht).
--
-- Forward-only: keine Tabelle, keine Spalte, keine verschärfte Invariante.
-- `PUBLIC_TABLES` in sync-staging.yml bleibt unverändert.

create function setze_uebungsfolge(
  p_training uuid,
  p_einordnung text,
  p_hauptteilkategorie text,
  p_variante uuid,
  p_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[] := coalesce(p_ids, '{}');
  v_abschnitt uuid[];
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Berechtigung als erste Anweisung, dieselbe Bedingung wie in den
  -- `tr_*`-Policies. `for update of t` serialisiert gegen weitere Folgen am
  -- selben Training. Ein gleichzeitiger Insert (Zuordnen) wartet; eine
  -- gleichzeitige Zeilen-Sperre in umgekehrter Reihenfolge (etwa
  -- `move_training_exercise`, das das Training nicht sperrt) kann als
  -- Deadlock enden — Postgres rollt dann eine Seite zurück, der Aufrufer
  -- wiederholt (`ausDbFehler`: 40P01 → konflikt).
  perform 1
     from trainings t
    where t.id = p_training
      and (t.owner_id = v_uid or ist_team_mitglied(t.team_id))
      for update of t;
  if not found then
    raise exception 'training not found or not editable by caller';
  end if;

  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'UEBUNGSFOLGE_DOPPELT';
  end if;

  select coalesce(array_agg(te.id), '{}')
    into v_abschnitt
    from training_exercises te
   where te.training_id = p_training
     and te.trainingsteil = p_einordnung
     and te.hauptteilkategorie is not distinct from p_hauptteilkategorie
     and te.variante_id is not distinct from p_variante;

  if cardinality(v_abschnitt) = 0 then
    raise exception 'UEBUNGSFOLGE_ABSCHNITT_LEER';
  end if;
  -- Genau die Übungen des Abschnitts, jede einmal: fehlt eine, gehörte ihr
  -- Platz niemandem; ist eine fremd, landete sie in einem Abschnitt, in den
  -- sie nicht gehört.
  if not (v_abschnitt @> v_ids and v_ids @> v_abschnitt) then
    raise exception 'UEBUNGSFOLGE_UNVOLLSTAENDIG';
  end if;

  update training_exercises te
     set position = -u.i
    from unnest(v_ids) with ordinality as u(id, i)
   where te.id = u.id;

  update training_exercises te
     set position = u.i - 1
    from unnest(v_ids) with ordinality as u(id, i)
   where te.id = u.id;
end;
$$;

comment on function setze_uebungsfolge(uuid, text, text, uuid, uuid[]) is
  'Setzt die Reihenfolge eines Abschnitts (Einordnung, Hauptteilkategorie, Variante) auf 0..n-1 (#193 AK 9). Aufgerufen von setzeUebungsfolge() in web/lib/kern/fassung.ts; Marker-Texte in fachlicheMeldung() in web/lib/training-bedingungen.ts.';

revoke all on function setze_uebungsfolge(uuid, text, text, uuid, uuid[]) from public, anon;
grant execute on function setze_uebungsfolge(uuid, text, text, uuid, uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- Selbstprüfung
-- ----------------------------------------------------------------------------
-- Die Funktion muss existieren und `security definer` sein — ohne das liefe
-- das zweite Update an der RLS vorbei ins Leere. Und `anon` darf sie nicht
-- aufrufen.
do $$
begin
  if not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'setze_uebungsfolge'
       and p.prosecdef
  ) then
    raise exception 'setze_uebungsfolge fehlt oder ist nicht security definer';
  end if;

  if has_function_privilege('anon', 'setze_uebungsfolge(uuid, text, text, uuid, uuid[])', 'execute') then
    raise exception 'setze_uebungsfolge darf fuer anon nicht ausfuehrbar sein';
  end if;
end $$;

reset lock_timeout;
