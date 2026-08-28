set lock_timeout = '5s';

-- ============================================================================
-- Stories 3, 4, 5a, 7 (Epic #71): Junioren-Schema in der Datenbank
-- ============================================================================
-- Der Schema-Wechsel ist der Migrationspfad des produktiven Bestands: heute
-- kennt die Applikation nur den Kinderfussball, und ein Teil der bestehenden
-- Trainings ist inhaltlich bereits Juniorenfussball. Diese Trainings heben die
-- Trainer:innen selbst von E auf D. Darum ist der Wechsel hier kein Randfall,
-- sondern der zentrale Übergang — und darum ist er verlustfrei gebaut.
--
-- Forward-only: alle Erweiterungen bestehender CHECKs sind schwächer als ihre
-- Vorgänger, jede bestehende Zeile erfüllt sie trivial. Die einzige NEUE
-- Invariante (Mischverbot) kommt als NOT VALID und wird in der Folgemigration
-- validiert.

-- ----------------------------------------------------------------------------
-- 1) Schema aus den Stufen
-- ----------------------------------------------------------------------------
-- SQL-Pendant zu web/lib/junioren.ts::schemaAusStufen — beide Definitionen
-- MÜSSEN inhaltlich identisch bleiben. Ohne Stufe gilt Kinderfussball
-- (Story 3 AC 2).
create or replace function training_schema(p_stufen text[])
returns text
language sql
immutable
as $$
  select case
    when p_stufen && array['D','C','B','A'] then 'junioren'
    else 'kifu'
  end;
$$;

-- Zu welchem Schema gehört eine Einordnung? Für die Konserven-Auswertung
-- beim Wechsel. `nacharbeit` und NULL gehören zu keinem Schema und liefern
-- NULL — sie fallen damit auf die Abbildungsregel zurück.
create or replace function training_schema_der_einordnung(p_einordnung text)
returns text
language sql
immutable
as $$
  select case
    when p_einordnung in ('auffangen','einleitung','hauptteil','ausklang')
      then 'kifu'
    when p_einordnung in ('jun-aufwaermen','jun-spielform-trainingsziel',
                          'jun-explosivitaet','jun-spielformen','jun-spiel',
                          'jun-ausklang')
      then 'junioren'
    else null
  end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Mischverbot (Story 3 AC 4)
-- ----------------------------------------------------------------------------
-- Ein Training trägt nie Alterskategorien beider Schemata. NOT VALID, weil es
-- eine neue Invariante auf einer bestehenden Tabelle ist (CLAUDE.md); der
-- Bestand erfüllt sie per Konstruktion — bis zur Vorgängermigration liess
-- training_valid_stufen nur {G,F,E} zu. Validiert wird in der Folgemigration.
-- Für Übungen gilt das Verbot bewusst NICHT: eine Übung kann beiden Schemata
-- dienen (Story 2, Anmerkung).
alter table trainings add constraint training_stufen_ein_schema check (
  stufen <@ array['G','F','E'] or stufen <@ array['D','C','B','A']
) not valid;

-- ----------------------------------------------------------------------------
-- 3) Konserve für den verlustfreien Rückwechsel
-- ----------------------------------------------------------------------------
-- Der Wechsel sichert je Fassung die verlassene Einordnung; der Rückwechsel
-- stellt sie wieder her. Ohne diese Konserve wäre der Weg zurück verlustbehaftet:
-- die Abbildungsregel führt «Fussball spielen lernen» und «Vielseitigkeit
-- erleben» beide nach jun-spielformen zusammen und ist damit nicht umkehrbar;
-- ebenso fielen die Auffangen-Zuordnungen dauerhaft in die Nacharbeit. Erst so
-- ist das Umstellen eines bestehenden Trainings gefahrlos ausprobierbar.
--
-- Nullable und ohne Wertebereichs-CHECK: das ist ein Gedächtnis, keine
-- Invariante. Ein unbekannter Altwert darf die Wiederherstellung höchstens
-- ausfallen lassen, nie ein Update abweisen.
alter table training_exercises
  add column einordnung_vorher text,
  add column hauptteilkategorie_vorher text;

comment on column training_exercises.einordnung_vorher is
  'Einordnung im zuletzt verlassenen Schema; macht den Schema-Wechsel umkehrbar. NULL, sobald die Trainerin die Fassung von Hand umhängt.';

-- ----------------------------------------------------------------------------
-- 4) Einordnungs-Wertebereich der Zuordnung (Story 4 AC 3, Story 5a AC 4)
-- ----------------------------------------------------------------------------
-- Die sechs befüllbaren Junioren-Blöcke kommen hinzu, dazu `nacharbeit` für
-- Zuordnungen ohne Entsprechung im neuen Schema (Story 3 PC 3). `nacharbeit`
-- ist schema-neutral: der Zustand kann in beiden Wechselrichtungen entstehen
-- und blockiert nur die Veröffentlichung, nie das Speichern.
--
-- Die Positions-Eindeutigkeit trägt automatisch mit: der partielle Index
-- training_ex_pos_nonhauptteil greift für alles ausser 'hauptteil', also auch
-- für jeden Junioren-Block. Ebenso hält der Biconditional-CHECK
-- training_ex_hkat_genau_bei_hauptteil — Junioren-Blöcke tragen nie eine
-- Hauptteilkategorie. Den früheren phase_guard-Trigger, der sie ausserhalb des
-- Hauptteils zwangsweise leerte, gibt es seit dem Verweis-Abbau nicht mehr:
-- jeder Schreibpfad setzt sie selbst auf NULL.
alter table training_exercises drop constraint training_exercises_trainingsteil_check;
alter table training_exercises add constraint training_exercises_trainingsteil_check
  check (trainingsteil in (
    'auffangen','einleitung','hauptteil','ausklang',
    'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
    'jun-spielformen','jun-spiel','jun-ausklang',
    'nacharbeit'
  ));

-- ----------------------------------------------------------------------------
-- 5) Schema-Konsistenz (Epic-Erfolgskriterium 1)
-- ----------------------------------------------------------------------------
-- Die Einordnung jeder Zuordnung passt zum Schema ihres Trainings. Zwei
-- Trigger, weil die Regel zwei Tabellen verbindet: einer auf der Zuordnung,
-- einer auf den Stufen des Trainings.
create function training_exercise_schema_gate() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_schema text;
begin
  -- Schema-neutral: die Nacharbeit ist der Zustand ZWISCHEN den Schemata.
  if new.trainingsteil = 'nacharbeit' then
    return new;
  end if;
  select training_schema(stufen) into v_schema
    from trainings where id = new.training_id;
  if v_schema is null then
    return new; -- Training existiert nicht mehr; die FK-Kaskade räumt auf.
  end if;
  if v_schema is distinct from training_schema_der_einordnung(new.trainingsteil) then
    raise exception 'SCHEMA_KONFLIKT: Einordnung % passt nicht zum Schema % des Trainings',
      new.trainingsteil, v_schema;
  end if;
  return new;
end;
$$;

create trigger te_schema_gate
  before insert or update of trainingsteil on training_exercises
  for each row execute function training_exercise_schema_gate();

-- Die Gegenrichtung: ändern sich die Stufen, muss das Training am Ende der
-- Transaktion zu seinen Zuordnungen passen. DEFERRED, weil der Wechsel genau
-- dazwischen liegt — er setzt erst die Stufen, dann die Zuordnungen, und
-- beides muss erlaubt sein, solange es beim Commit stimmt. Ohne diesen Trigger
-- hinge die Invariante allein an der Applikation.
create function trainings_schema_gate() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_schema text := training_schema(new.stufen);
  v_fremd text;
begin
  select te.trainingsteil into v_fremd
    from training_exercises te
    where te.training_id = new.id
      and te.trainingsteil <> 'nacharbeit'
      and training_schema_der_einordnung(te.trainingsteil) is distinct from v_schema
    limit 1;
  if v_fremd is not null then
    raise exception 'SCHEMA_KONFLIKT: Zuordnung % passt nicht zum Schema % des Trainings',
      v_fremd, v_schema;
  end if;
  return null;
end;
$$;

create constraint trigger trainings_schema_gate
  after update of stufen on trainings
  deferrable initially deferred
  for each row execute function trainings_schema_gate();

-- ----------------------------------------------------------------------------
-- 6) Veröffentlichungs-Bedingungen je Schema (Story 7 AC 1/2/4)
-- ----------------------------------------------------------------------------
-- Eine Funktion als einzige Quelle: die oeffentlich-Gates und die
-- Vorabmeldung der Applikation nennen dieselbe Regel.
--
-- Kinderfussball-Zweig: unverändert wie bisher (Story 7 Out of Scope 1).
-- Junioren-Zweig: die drei Einstiegs-Unterblöcke, die Spielformen und der
-- Ausklang müssen belegt sein; der Spiel-Block ist als freies Spiel bewusst
-- ausgenommen. Eine eigene Stufen-Bedingung braucht dieser Zweig nicht — ein
-- Junioren-Training trägt per Schema-Definition mindestens eine Junioren-
-- Kategorie. Belegt heisst: mindestens eine Zuordnung; Nacharbeit zählt nie.
create or replace function training_fehlende_bedingungen(p_training_id uuid)
returns text[]
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_stufen text[];
  v_schema text;
  v_missing text[] := '{}';
  v_block text;
begin
  select stufen, training_schema(stufen) into v_stufen, v_schema
    from trainings where id = p_training_id;
  if v_schema is null then
    return v_missing; -- Training weg: nichts zu prüfen.
  end if;

  if v_schema = 'kifu' then
    if coalesce(array_length(v_stufen, 1), 0) = 0 then
      v_missing := array_append(v_missing, 'stufe');
    end if;
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
    foreach v_block in array array[
      'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
      'jun-spielformen','jun-ausklang']
    loop
      if not exists (select 1 from training_exercises
                     where training_id = p_training_id and trainingsteil = v_block) then
        v_missing := array_append(v_missing, v_block);
      end if;
    end loop;
  end if;

  -- Schema-übergreifend: offene Nacharbeit blockiert die Veröffentlichung
  -- (Story 7 AC 1). Der frühere Übergangs-Check «alle Zuordnungen überführt»
  -- entfällt — training_exercises.name ist seit dem Verweis-Abbau NOT NULL.
  if exists (select 1 from training_exercises
             where training_id = p_training_id and trainingsteil = 'nacharbeit') then
    v_missing := array_append(v_missing, 'nacharbeit');
  end if;

  return v_missing;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) Stufen setzen, mit Übertragung beim Schema-Wechsel (Story 3)
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER mit Berechtigungsprüfung als erster Anweisung. Team-
-- Trainings haben owner_id NULL und gehören ihrem Team — der Kreis ist
-- derselbe wie in der tr_update-Policy.
create or replace function set_training_stufen(
  p_training_id uuid,
  p_stufen text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_alt text[];
  v_visibility text;
  v_schema_alt text;
  v_schema_neu text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select stufen, visibility into v_alt, v_visibility
    from trainings
    where id = p_training_id
      and (owner_id = v_uid
           or (team_id is not null and ist_team_mitglied(team_id)));
  if not found then
    raise exception 'training not found or not editable by caller';
  end if;

  if not (p_stufen <@ array['G','F','E'] or p_stufen <@ array['D','C','B','A']) then
    raise exception 'SCHEMA_KONFLIKT: Alterskategorien beider Schemata lassen sich in einem Training nicht mischen';
  end if;

  v_schema_alt := training_schema(v_alt);
  v_schema_neu := training_schema(p_stufen);

  if v_schema_alt = v_schema_neu then
    update trainings set stufen = p_stufen where id = p_training_id;
    return jsonb_build_object('status', 'ok', 'wechsel', false);
  end if;

  -- Ein öffentliches Training wechselt das Schema nicht: nach dem Wechsel
  -- erfüllt es die Bedingungen des neuen Schemas praktisch nie — Spielform zum
  -- Trainingsziel und Explosivität sind aus dem Manual-Bestand gar nicht
  -- befüllbar. Statt es still zurückzuziehen, verlangt die Applikation
  -- denselben bewussten Schritt wie bei jeder anderen Änderung, die ein
  -- öffentliches Training unter die Bedingungen brächte.
  if v_visibility = 'public' then
    raise exception 'SCHEMA_WECHSEL_OEFFENTLICH';
  end if;

  update trainings set stufen = p_stufen where id = p_training_id;

  -- Zielbestimmung je Fassung in zwei Stufen, damit die Positionsvergabe auf
  -- dem TATSÄCHLICHEN Ziel rechnet und nicht auf der Abbildungsregel allein.
  with ziel as (
    select
      te.id,
      te.trainingsteil      as alt_teil,
      te.hauptteilkategorie as alt_hkat,
      te.position           as alt_pos,
      case
        -- Vorrang hat die Konserve: die tatsächlich verlassene Einordnung,
        -- sofern sie ins Zielschema gehört. Das macht den Rückweg verlustfrei.
        when training_schema_der_einordnung(te.einordnung_vorher) = v_schema_neu
          then te.einordnung_vorher
        -- Sonst die Abbildungsregel, Richtung Kinderfussball → Junioren.
        when v_schema_neu = 'junioren' then
          case
            when te.trainingsteil = 'einleitung' then 'jun-aufwaermen'
            when te.trainingsteil = 'hauptteil'
                 and te.hauptteilkategorie in ('fussball-spielen-lernen',
                                               'vielseitigkeit-erleben')
              then 'jun-spielformen'
            when te.trainingsteil = 'hauptteil'
                 and te.hauptteilkategorie = 'fussball-spielen'
              then 'jun-spiel'
            when te.trainingsteil = 'ausklang' then 'jun-ausklang'
            else 'nacharbeit'
          end
        -- Und Richtung Junioren → Kinderfussball.
        else
          case
            when te.trainingsteil in ('jun-aufwaermen',
                                      'jun-spielform-trainingsziel')
              then 'einleitung'
            when te.trainingsteil in ('jun-spielformen','jun-spiel')
              then 'hauptteil'
            when te.trainingsteil = 'jun-ausklang' then 'ausklang'
            else 'nacharbeit'
          end
      end as neu_teil,
      case
        when training_schema_der_einordnung(te.einordnung_vorher) = v_schema_neu
          then te.hauptteilkategorie_vorher
        when v_schema_neu = 'kifu' and te.trainingsteil = 'jun-spielformen'
          then 'fussball-spielen-lernen'
        when v_schema_neu = 'kifu' and te.trainingsteil = 'jun-spiel'
          then 'fussball-spielen'
        else null
      end as neu_hkat
    from training_exercises te
    where te.training_id = p_training_id
  ),
  nummeriert as (
    select z.*,
      row_number() over (
        -- Ziel-Positionsraum: ausserhalb des Hauptteils zählt der Teil
        -- (Index training_ex_pos_nonhauptteil), im Hauptteil die Kategorie
        -- (Index training_ex_pos_hauptteil). Beide getrennt zu partitionieren
        -- ist die sichere Obermenge.
        partition by z.neu_teil, coalesce(z.neu_hkat, '')
        order by array_position(array[
            'auffangen','einleitung','hauptteil','ausklang',
            'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
            'jun-spielformen','jun-spiel','jun-ausklang','nacharbeit'
          ], z.alt_teil),
          z.alt_hkat nulls first,
          z.alt_pos
      ) as neu_pos
    from ziel z
  )
  update training_exercises te
  set trainingsteil = n.neu_teil,
      hauptteilkategorie = n.neu_hkat,
      -- Die Konserve für den Rückweg: die JETZT verlassene Einordnung.
      einordnung_vorher = n.alt_teil,
      hauptteilkategorie_vorher = n.alt_hkat,
      -- Negative Zwischenpositionen halten die Umsortierung kollisionsfrei
      -- (Muster von move_training_exercise): nach diesem UPDATE ist jede Zeile
      -- des Trainings negativ, positive und negative kollidieren nie.
      position = -n.neu_pos
  from nummeriert n
  where te.id = n.id;

  update training_exercises
  set position = -position
  where training_id = p_training_id and position < 0;

  return jsonb_build_object('status', 'ok', 'wechsel', true);
end;
$$;

revoke all on function set_training_stufen(uuid, text[]) from public;
grant execute on function set_training_stufen(uuid, text[]) to authenticated;
