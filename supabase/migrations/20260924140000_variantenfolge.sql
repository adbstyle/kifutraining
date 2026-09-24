set lock_timeout = '5s';

-- ============================================================================
-- Story #263 (Epic #190): Reihenfolge der Varianten in einem Zug
-- ============================================================================
-- Der KI-Assistent setzt die Folge der Varianten des Hauptteils als Ganzes
-- (Vorbild `setze_uebungsfolge`). Die Oberfläche tauscht weiter Nachbarn
-- (`verschiebe_variante`) — zwei Bedienwege, zwei RPCs.
--
-- Zwei Schritte über negative Zwischenwerte: `tv_position_je_training` ist
-- eindeutig und nicht aufschiebbar; eine Permutation in EINEM Update kollidierte
-- zeilenweise. Einen CHECK `position >= 0` gibt es bewusst nicht
-- (hauptteil_varianten.sql, Kommentar an der Spalte).
--
-- Die Folge wird lückenlos 0..n-1 geschrieben: `entferne_variante` schliesst
-- Lücken nur beim Übergang 2 → 1.
--
-- Forward-only: keine Tabelle, keine Spalte, keine verschärfte Invariante.
-- `PUBLIC_TABLES` in sync-staging.yml bleibt unverändert.

create function setze_variantenfolge(p_training uuid, p_ids uuid[]) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[] := coalesce(p_ids, '{}');
  v_alle uuid[];
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Berechtigung als erste Anweisung, dieselbe Bedingung wie in den
  -- `tv_*`-Policies. `for update of t` serialisiert gegen `lege_variante_an`,
  -- `entferne_variante` und `verschiebe_variante` — alle sperren zuerst das
  -- Training, darum gibt es keine umgekehrte Sperrreihenfolge.
  perform 1
     from trainings t
    where t.id = p_training
      and (t.owner_id = v_uid or ist_team_mitglied(t.team_id))
      for update of t;
  if not found then
    raise exception 'training not found or not editable by caller';
  end if;

  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'VARIANTENFOLGE_DOPPELT';
  end if;

  select coalesce(array_agg(v.id), '{}') into v_alle
    from training_varianten v where v.training_id = p_training;

  -- Genau die Varianten des Trainings, jede einmal.
  if not (v_alle @> v_ids and v_ids @> v_alle) then
    raise exception 'VARIANTENFOLGE_UNVOLLSTAENDIG';
  end if;

  update training_varianten v set position = -u.i
    from unnest(v_ids) with ordinality as u(id, i)
   where v.id = u.id;

  update training_varianten v set position = u.i - 1
    from unnest(v_ids) with ordinality as u(id, i)
   where v.id = u.id;
end;
$$;

comment on function setze_variantenfolge(uuid, uuid[]) is
  'Setzt die Reihenfolge der Varianten des Hauptteils auf 0..n-1 (#263). Aufgerufen von setzeVariantenfolge() in web/lib/kern/varianten.ts; Marker-Texte in VARIANTENFOLGE_MELDUNG (web/lib/training-bedingungen.ts).';

revoke all on function setze_variantenfolge(uuid, uuid[]) from public, anon;
grant execute on function setze_variantenfolge(uuid, uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- Selbstprüfung
-- ----------------------------------------------------------------------------
-- Ein Wegwerf-Szenario entfällt wie in gruppen_ordnung.sql: Die RPC braucht
-- `auth.uid()`. Sie wird in web/scripts/pruefe-kern-db.ts geprüft.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'setze_variantenfolge' and p.prosecdef
  ) then
    raise exception 'setze_variantenfolge fehlt oder ist nicht security definer';
  end if;

  if has_function_privilege('anon', 'setze_variantenfolge(uuid, uuid[])', 'execute') then
    raise exception 'setze_variantenfolge darf fuer anon nicht ausfuehrbar sein';
  end if;

  -- Die Marker, die die Anwendung übersetzt, müssen im Rumpf stehen.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'setze_variantenfolge'
       and p.prosrc like '%VARIANTENFOLGE_DOPPELT%'
       and p.prosrc like '%VARIANTENFOLGE_UNVOLLSTAENDIG%'
  ) then
    raise exception 'setze_variantenfolge meldet die vereinbarten Marker nicht';
  end if;

  -- Die negativen Zwischenwerte brauchen eine Positionsspalte ohne Wertebereichs-CHECK.
  if exists (
    select 1 from pg_constraint c
     where c.conrelid = 'training_varianten'::regclass and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%position%'
  ) then
    raise exception 'training_varianten.position traegt einen CHECK — die Zwischenwerte scheitern';
  end if;
end $$;

reset lock_timeout;
