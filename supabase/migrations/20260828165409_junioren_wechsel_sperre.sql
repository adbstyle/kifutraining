set lock_timeout = '5s';

-- ============================================================================
-- Story 3 (Epic #71): Schema-Wechsel gegen Nebenläufigkeit sichern
-- ============================================================================
-- set_training_stufen las die Stufen bisher ohne Sperre. Zwei überlappende
-- Aufrufe — Doppelklick, zweiter Tab, ein Retry — sahen darum beide dasselbe
-- Ausgangsschema. Der zweite lief nach dem Commit des ersten los, fand die
-- Zuordnungen bereits übertragen, die Konserve schema-fremd und traf in der
-- Abbildungsregel keinen Fall mehr: sämtliche Fassungen wären in der
-- Nacharbeit gelandet UND die Konserve mit den bereits übertragenen Werten
-- überschrieben worden — der Rückweg damit verloren.
--
-- `for update` serialisiert die Wechsel eines Trainings. Der zweite Aufruf
-- wartet, liest danach den neuen Stand und stellt fest, dass das Zielschema
-- schon gilt: er fällt in den Zweig ohne Wechsel und setzt nur die Stufen.
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

  -- Berechtigung und Ausgangsstand in einem Schritt, mit Zeilensperre bis zum
  -- Transaktionsende. Team-Trainings haben owner_id NULL und gehören ihrem
  -- Team — derselbe Kreis wie in der tr_update-Policy.
  select stufen, visibility into v_alt, v_visibility
    from trainings
    where id = p_training_id
      and (owner_id = v_uid
           or (team_id is not null and ist_team_mitglied(team_id)))
    for update;
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
            else 'nacharbeit'  -- Auffangen (Z1) und Übriges (Z7)
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
            else 'nacharbeit'  -- Explosivität hat im Kinderfussball keine Entsprechung
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

-- Die Bedingungsfunktion folgt dem Muster der übrigen: nur Angemeldete rufen
-- sie auf. Sie ist SECURITY INVOKER und RLS-geschützt, aber PUBLIC braucht sie
-- nicht (Konsistenz mit set_training_stufen und move_training_exercise).
revoke all on function training_fehlende_bedingungen(uuid) from public;
grant execute on function training_fehlende_bedingungen(uuid) to authenticated;
