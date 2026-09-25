set lock_timeout = '5s';

-- ============================================================================
-- Epic #266: Material des Bestands einmalig aus dem Diagramm berechnen
-- ============================================================================
-- Übungen und Fassungen, die vor dem Epic entstanden sind, tragen eine leere
-- Material-Liste — auch wenn ihr Diagramm Material zeigt. Diese Migration
-- füllt sie EINMAL mit dem Vorschlag ihres eigenen Diagramms und setzt die
-- Basis auf denselben Vorschlag (PO-Entscheid 2026-09-25): So zeigt jede
-- bestehende Übung und jedes bestehende Training sein Material, ohne dass der
-- Trainer jede Kopie einzeln übernimmt.
--
-- Nur, wo die Liste leer ist: nichts bereits Übernommenes wird überschrieben.
-- Der Freitext (`material`) bleibt unangetastet und erscheint als Ergänzung.
--
-- Die Rechnung spiegelt `materialVorschlag` in web/lib/material.ts: jedes
-- Material-Symbol einzeln nach Art und wirksamer Farbe gezählt (ohne Farbe
-- die Standardfarbe des Symbols, bei nicht färbbarem Material keine), dazu je
-- Feldspieler ein Überziehleibchen seiner Farbe, sofern die Feldspieler in
-- mindestens zwei Farben eingeteilt sind. Die Reihenfolge ist egal: die
-- Anwendung liest jede Liste über `parseMaterialListe` in ihre Normalform.
-- Die Hilfsfunktion lebt nur für diesen Lauf und wird am Ende entfernt — ein
-- dauerhafter SQL-Zwilling liefe der TS-Regel sonst unbemerkt davon.
--
-- Forward-only: reine Datenfüllung neuer Spalten, keine Invariante verschärft.
-- Während des Laufs ruhen die Trigger, die nur Zeitstempel fortschreiben
-- (`exercises_set_updated_at`, `training_exercises_touch`) — eine berechnete
-- Liste ist keine Bearbeitung durch den Trainer —, und das Veröffentlichungs-
-- Gate, dessen Bedingungen das Material nicht berührt.

create function pg_temp.material_vorschlag(p_diagramm jsonb) returns jsonb
language sql
immutable
as $$
  -- Dieselbe Trust-Boundary wie `parseDiagramm`/`istElement`
  -- (web/lib/diagramm.ts): ein Diagramm ohne Versionsnummer gilt als keines,
  -- ein strukturell kaputtes Symbol fällt weg.
  with symbole as (
    select e->>'typ' as typ, e->>'farbe' as farbe
    from jsonb_array_elements(
      case when jsonb_typeof(p_diagramm->'version') = 'number'
            and jsonb_typeof(p_diagramm->'elemente') = 'array'
           then p_diagramm->'elemente' else '[]'::jsonb end
    ) as e
    where e->>'art' = 'symbol'
      and jsonb_typeof(e->'id') = 'string'
      and jsonb_typeof(e->'typ') = 'string'
      and jsonb_typeof(e->'x') = 'number'
      and jsonb_typeof(e->'y') = 'number'
      and (e->'rotation' is null
           or (jsonb_typeof(e->'rotation') = 'number'
               and (e->>'rotation')::numeric in (0, 45, 90, 135, 180, 225, 270, 315)))
      and (e->'pose' is null
           or e->>'pose' in ('stehen', 'stehen-hinten', 'laufen', 'laufen-hinten',
                             'dribbeln', 'passen', 'schiessen', 'graetschen'))
      and (e->'spiegeln' is null or jsonb_typeof(e->'spiegeln') = 'boolean')
  ),
  standard(typ, farbe) as (
    values ('pylone', 'orange'), ('teller', 'gelb'), ('stange', 'weiss'),
           ('reifen', 'blau'), ('leibchen', 'rot')
  ),
  farben(slug) as (
    values ('rot'), ('blau'), ('gelb'), ('gruen'), ('orange'), ('weiss'), ('schwarz')
  ),
  material as (
    select s.typ as art,
           case when st.typ is null then null
                when s.farbe in (select slug from farben) then s.farbe
                else st.farbe end as farbe
    from symbole s
    left join standard st on st.typ = s.typ
    where s.typ in ('tor', 'minitor', 'pylone', 'teller', 'stange', 'reifen', 'huerde',
                    'leibchen', 'fussball', 'handball', 'tennisball')
  ),
  spieler as (
    select case when farbe in (select slug from farben) then farbe else 'rot' end as farbe
    from symbole
    where typ = 'spieler'
  ),
  leibchen as (
    select 'leibchen' as art, farbe from spieler
    where (select count(distinct farbe) from spieler) >= 2
  ),
  alle as (
    select art, farbe from material
    union all
    select art, farbe from leibchen
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('art', art, 'farbe', farbe, 'menge', menge)),
    '[]'::jsonb
  )
  from (select art, farbe, count(*)::int as menge from alle group by art, farbe) as posten;
$$;

alter table exercises disable trigger exercises_set_updated_at;
update exercises
set material_liste = pg_temp.material_vorschlag(diagramm),
    material_basis = pg_temp.material_vorschlag(diagramm)
where material_liste = '[]'::jsonb
  and diagramm is not null
  and pg_temp.material_vorschlag(diagramm) <> '[]'::jsonb;
alter table exercises enable trigger exercises_set_updated_at;

alter table training_exercises disable trigger training_exercises_touch;
alter table training_exercises disable trigger training_exercises_oeffentlich_gate;
update training_exercises
set material_liste = pg_temp.material_vorschlag(diagramm),
    material_basis = pg_temp.material_vorschlag(diagramm)
where material_liste = '[]'::jsonb
  and diagramm is not null
  and pg_temp.material_vorschlag(diagramm) <> '[]'::jsonb;
alter table training_exercises enable trigger training_exercises_oeffentlich_gate;
alter table training_exercises enable trigger training_exercises_touch;

drop function pg_temp.material_vorschlag(jsonb);

reset lock_timeout;
