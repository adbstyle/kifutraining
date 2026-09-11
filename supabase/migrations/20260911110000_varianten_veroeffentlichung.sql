set lock_timeout = '5s';

-- ============================================================================
-- Story #204 (Epic #200 Hauptteil-Varianten): Bedingungen je Variante
-- ============================================================================
-- Ein öffentliches Training muss in JEDER seiner Varianten vollständig sein
-- (#204 AK 1). Wer eine Alternative übernimmt, soll nicht einen Hauptteil
-- bekommen, dem der Pflichtblock fehlt.
--
-- Die Trennlinie verläuft entlang der Varianten-Grenze und ist dieselbe wie
-- überall sonst im Epic: Was `einordnung_traegt_gruppen()` bejaht, gehört einer
-- Variante — im Kinderfussball das freie Spiel (`hauptteil`), im
-- Juniorenfussball die Spielformen. Alles davor und danach (Alterskategorie,
-- Einleitung, Aufwärmen, Spielform zum Trainingsziel, Explosivität) gilt für
-- das ganze Training und wird weiterhin genau einmal geprüft (#204 PC 2).
--
-- Die Meldung trägt die Variante mit: `'<bedingung> VARIANTE <uuid>'`. Die
-- Bedingung bleibt das ERSTE Wort, damit `bedingungAusFehler()` in
-- web/lib/training-bedingungen.ts unverändert liest; die ID dahinter holt sich
-- die Applikation mit `varianteAusFehler()` und macht daraus den Namen
-- (#204 AK 2/3).
--
-- Bestandsdaten: Bis zu dieser Migration führt jedes Training genau eine
-- Variante — die aus dem Backfill von 20260911100000. Für ein öffentliches
-- Training ist die neue Regel damit wortgleich die alte, keine Altzeile kann
-- durch die Verschärfung neu verletzt werden. Das gilt auch für den neuen Gate
-- auf `training_varianten`: Die zweite Variante entsteht frühestens nach
-- diesem Deploy, und sie entsteht als Kopie einer vollständigen (RPC
-- `lege_variante_an`).

-- ----------------------------------------------------------------------------
-- 1) Die Bedingungen: trainingsweit und je Variante
-- ----------------------------------------------------------------------------
-- Wortgleich mit der bisherigen Fassung (20260831120000), bis auf die
-- Hauptteil-Bedingung: Sie läuft neu über die Varianten. Die Reihenfolge der
-- Einträge bleibt dieselbe wie bisher (erst die trainingsweiten, dann die
-- Hauptteil-Bedingung) — `training_pruefe_oeffentlich` wirft den ersten, und
-- was ein Trainer zuerst zu hören bekommt, soll sich nicht ändern.
--
-- Die Varianten laufen in Anzeigereihenfolge (`position`, bei Gleichstand
-- `id`): Nennt der Gate nur die erste verletzte, ist es die, die auch die
-- Oberfläche zuerst zeigt.
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
  v_variante record;
  v_hauptteil_fehlt boolean;
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
  else
    -- Spiel und Abschluss fehlen bewusst: das Spiel ist als freies Spiel von
    -- der Pflicht ausgenommen, der Abschluss seit Story #127 (PO 2026-08-31);
    -- beide behalten nur den Hinweis im Editor. Die Spielformen stehen nicht
    -- in dieser Liste — sie liegen im Hauptteil und werden unten je Variante
    -- geprüft.
    foreach v_block in array array[
      'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet']
    loop
      if not exists (select 1 from training_exercises
                     where training_id = p_training_id and trainingsteil = v_block) then
        v_missing := array_append(v_missing, v_block);
      end if;
    end loop;
  end if;

  -- Die Hauptteil-Bedingung, je Variante (#204 AK 1). Im Kinderfussball ist es
  -- das freie Spiel — es liegt im Hauptteil und deckt «mindestens eine Übung im
  -- Hauptteil» zwingend mit ab; im Juniorenfussball sind es die Spielformen.
  for v_variante in
    select id from training_varianten
     where training_id = p_training_id
     order by position, id
  loop
    if v_altersstufe = 'kinderfussball' then
      v_hauptteil_fehlt := not exists (
        select 1 from training_exercises
         where training_id = p_training_id
           and variante_id = v_variante.id
           and hauptteilkategorie = 'fussball-spielen');
      v_block := 'freies_spiel';
    else
      v_hauptteil_fehlt := not exists (
        select 1 from training_exercises
         where training_id = p_training_id
           and variante_id = v_variante.id
           and trainingsteil = 'jun-spielformen');
      v_block := 'jun-spielformen';
    end if;

    if v_hauptteil_fehlt then
      -- Die Bedingung bleibt das erste Wort; die Variante hängt als eigenes
      -- Wortpaar dahinter (Zwilling: `varianteAusFehler()`).
      v_missing := array_append(v_missing, v_block || ' VARIANTE ' || v_variante.id::text);
    end if;
  end loop;

  return v_missing;
end;
$$;

comment on function training_fehlende_bedingungen(uuid) is
  'Spiegel von fehlendeBedingungenAus() in web/lib/training-bedingungen.ts. '
  'Die Hauptteil-Bedingung erscheint je Variante als "<bedingung> VARIANTE <uuid>".';

-- ----------------------------------------------------------------------------
-- 2) Der Gate wacht auch über die Varianten selbst
-- ----------------------------------------------------------------------------
-- Bisher lösten nur `trainings` (Sichtbarkeit, Alterskategorien) und
-- `training_exercises` die Prüfung aus. Eine Variante ist neu ein eigener Weg
-- unter die Schwelle: Eine leere zweite Variante am öffentlichen Training wäre
-- genau die Lücke, die #204 PC 1 schliesst, und eine entfernte Variante muss
-- die Prüfung ebenso auslösen (sie nimmt ihre Fassungen per Kaskade mit, aber
-- die Kaskade darf nicht das Einzige sein, worauf sich die Regel verlässt).
--
-- `deferrable initially deferred` wie die beiden bestehenden Gates und hier
-- zwingend: `lege_variante_an` fügt erst die Variante ein und kopiert danach
-- die Fassungen — beim INSERT allein ist sie leer, und eine sofortige Prüfung
-- wiese jede neue Variante am öffentlichen Training ab. Geprüft wird der Stand
-- beim Commit, und der ist die vollständige Kopie.
create function training_varianten_oeffentlich_gate() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Getrennt nach Operation, wie bei den Fassungen: in einem DELETE-Trigger ist
  -- `new` nicht belegt. Ein Umhängen zwischen zwei Trainings gibt es nicht,
  -- die Abfrage beider Seiten kostet aber nichts und hält die beiden Gates
  -- wortgleich.
  if tg_op <> 'DELETE' then
    perform training_pruefe_oeffentlich(new.training_id);
  end if;
  if tg_op <> 'INSERT' then
    perform training_pruefe_oeffentlich(old.training_id);
  end if;
  return null;
end;
$$;

create constraint trigger training_varianten_oeffentlich_gate
  after insert or update or delete on training_varianten
  deferrable initially deferred
  for each row execute function training_varianten_oeffentlich_gate();

-- ----------------------------------------------------------------------------
-- 3) Selbstprüfung: Trigger da, Funktion neu, Regel greift
-- ----------------------------------------------------------------------------
do $$
declare
  v_trigger int;
begin
  select count(*) into v_trigger
    from pg_trigger
   where tgrelid = 'training_varianten'::regclass
     and tgname = 'training_varianten_oeffentlich_gate'
     and tgdeferrable and tginitdeferred;
  if v_trigger <> 1 then
    raise exception 'training_varianten_oeffentlich_gate fehlt oder ist nicht aufgeschoben';
  end if;

  -- Der Rumpf der Bedingungs-Funktion muss die Varianten kennen: Bliebe die
  -- alte Fassung stehen (etwa weil eine spätere Migration sie zurückschreibt),
  -- prüfte der neue Trigger weiterhin nur trainingsweit und die ganze Story
  -- wäre still wirkungslos.
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'training_fehlende_bedingungen'
       and p.prosrc like '%training_varianten%') then
    raise exception 'training_fehlende_bedingungen prüft den Hauptteil nicht je Variante';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Selbstprüfung am Wegwerf-Szenario
-- ----------------------------------------------------------------------------
-- Die eigentliche Zusage der Story lässt sich nicht am Katalog ablesen: Eine
-- leere zweite Variante an einem öffentlichen Training muss abgewiesen werden
-- (#204 AK 3 / PC 1). Darum baut dieser Block das Szenario wirklich auf und
-- räumt es wieder ab.
--
-- Ohne Nutzerkontext möglich, weil `owner_id` nullable ist und die Prüfung an
-- der Sichtbarkeit hängt, nicht an der Person; die Policies umgeht der
-- Migrations-Superuser ohnehin. Der Gate ist aufgeschoben, `set constraints
-- all immediate` holt ihn in die Subtransaktion — sonst schlüge er erst beim
-- Commit der ganzen Migration an.
--
-- Das Szenario läuft in einer Subtransaktion (`begin … exception`): Schlägt der
-- Gate wie erwartet an, ist der Zwischenstand damit sauber zurückgerollt.
do $$
declare
  v_training uuid;
  v_erste uuid;
  v_abgewiesen text;
begin
  insert into trainings (name, altersstufe, stufen, visibility)
  values ('__pruefung_204__', 'kinderfussball', array['G'], 'private')
  returning id into v_training;

  select id into v_erste from training_varianten where training_id = v_training;

  -- Einleitung und freies Spiel: damit ist das Training in seiner einen
  -- Variante vollständig und lässt sich veröffentlichen.
  -- `methodischer_fahrplan` bzw. `aufbau` sind nicht Zierde, sondern von
  -- `te_ablauf_je_einordnung` verlangt (der CHECK ist NOT VALID, greift aber
  -- bei jeder neuen Zeile).
  insert into training_exercises (training_id, trainingsteil, position, name,
                                  altersstufe, methodischer_fahrplan)
  values (v_training, 'einleitung', 0, '__pruefung_204_einleitung__',
          'kinderfussball', '{}'::jsonb);
  insert into training_exercises (training_id, trainingsteil, hauptteilkategorie,
                                  variante_id, position, name, altersstufe, aufbau)
  values (v_training, 'hauptteil', 'fussball-spielen', v_erste, 0,
          '__pruefung_204_spiel__', 'kinderfussball', 'Wegwerf-Szenario');

  update trainings set visibility = 'public' where id = v_training;
  set constraints all immediate;

  begin
    insert into training_varianten (training_id, name, position)
    values (v_training, '__leer__', 1);
    set constraints all immediate;
  exception when others then
    v_abgewiesen := sqlerrm;
  end;

  if v_abgewiesen is null then
    raise exception 'Eine leere zweite Variante wurde am öffentlichen Training zugelassen';
  end if;
  if v_abgewiesen not like 'TRAINING_UNVOLLSTAENDIG: freies_spiel VARIANTE %' then
    raise exception 'Unerwartete Abweisung der leeren Variante: %', v_abgewiesen;
  end if;

  -- Aufräumen. Die Kaskade nimmt Varianten und Fassungen mit; die Gates prüfen
  -- gegen ein Training, das es dann nicht mehr gibt, und geben still auf.
  set constraints all deferred;
  delete from trainings where id = v_training;
end;
$$;

reset lock_timeout;
