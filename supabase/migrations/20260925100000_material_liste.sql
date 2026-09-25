set lock_timeout = '5s';

-- ============================================================================
-- Story #267 (Epic #266): Material einer Übung aus dem Diagramm übernehmen
-- ============================================================================
-- Das Material einer Übung wird zweigeteilt geführt:
--
--   material_liste  jsonb  Material, das sich im Feld-Diagramm zeichnen lässt,
--                          nach Art, Farbe und Menge: [{art, farbe, menge}].
--                          Nur diese Liste wird gezählt und verrechnet.
--   material        text[] (bestehend) die freie Ergänzung — alles, was das
--                          Diagramm nicht kennt. Der Freitext aus der Zeit vor
--                          der Liste bleibt dort unverändert stehen (PC 2):
--                          keine Datenmigration.
--   material_basis  jsonb  der Material-Vorschlag des Diagramms im Moment der
--                          letzten Übernahme; null = nie übernommen. Weicht der
--                          heutige Vorschlag davon ab, hat eine Diagrammänderung
--                          das Material verändert (Story #269).
--
-- Beide Tabellen tragen die Spalten: die Fassung im Training ist eine
-- eigenständige Kopie der Übung (Epic #72) und nimmt sie über
-- FASSUNG_INHALT_FELDER (web/lib/fassung.ts) mit; `lege_variante_an` kopiert
-- per to_jsonb ohnehin jede Spalte.
--
-- Die innere Struktur prüft die Anwendung (parseMaterialListe in
-- web/lib/material.ts), wie beim Diagramm; die Datenbank sichert nur, dass die
-- Liste eine Liste ist.
--
-- Forward-only: neue Spalten mit Default, keine verschärfte Invariante auf
-- Bestandszeilen (die CHECKs gelten für den Default bereits). Keine neue
-- Tabelle — PUBLIC_TABLES in sync-staging.yml bleibt unverändert.

alter table exercises
  add column material_liste jsonb not null default '[]'::jsonb,
  add column material_basis jsonb,
  add constraint ex_material_liste_array check (jsonb_typeof(material_liste) = 'array'),
  add constraint ex_material_basis_array
    check (material_basis is null or jsonb_typeof(material_basis) = 'array');

alter table training_exercises
  add column material_liste jsonb not null default '[]'::jsonb,
  add column material_basis jsonb,
  add constraint te_material_liste_array check (jsonb_typeof(material_liste) = 'array'),
  add constraint te_material_basis_array
    check (material_basis is null or jsonb_typeof(material_basis) = 'array');

comment on column exercises.material is
  'Freie Ergänzung zum Material: was das Feld-Diagramm nicht kennt (Epic #266).';
comment on column exercises.material_liste is
  'Material aus dem Diagramm-Vorrat nach Art, Farbe, Menge: [{art, farbe, menge}] (Story #267).';
comment on column exercises.material_basis is
  'Material-Vorschlag des Diagramms bei der letzten Übernahme; null = nie übernommen (Story #269).';

-- ── Suche: die Übung ist auch über ihre Material-Liste auffindbar (PC 5) ────
-- Die Bezeichnungen spiegeln MATERIAL_KATALOG und FARBE_LABEL in
-- web/lib/material.ts; `npm run check:material` hält beide gleich. Einzahl und
-- Mehrzahl stehen beide drin, damit «Pylone» wie «Pylonen» trifft.
create function material_suchtext(p_liste jsonb) returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(string_agg(
    case p->>'art'
      when 'tor'        then 'Tor Tore'
      when 'minitor'    then 'Minitor Minitore'
      when 'pylone'     then 'Pylone Pylonen'
      when 'teller'     then 'Markierungsteller'
      when 'stange'     then 'Stange Stangen'
      when 'reifen'     then 'Reifen'
      when 'huerde'     then 'Hürde Hürden'
      when 'leibchen'   then 'Überziehleibchen'
      when 'fussball'   then 'Fussball Fussbälle'
      when 'handball'   then 'Handball Handbälle'
      when 'tennisball' then 'Tennisball Tennisbälle'
      else ''
    end
    || ' ' ||
    case p->>'farbe'
      when 'rot'     then 'rot'
      when 'blau'    then 'blau'
      when 'gelb'    then 'gelb'
      when 'gruen'   then 'grün'
      when 'orange'  then 'orange'
      when 'weiss'   then 'weiss'
      when 'schwarz' then 'schwarz'
      else ''
    end,
    ' '), '')
  from jsonb_array_elements(
    case when jsonb_typeof(p_liste) = 'array' then p_liste else '[]'::jsonb end
  ) as p;
$$;

create or replace function exercises_search_refresh() returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_ueben text := '';
begin
  -- ueben-Schritte aus dem Fahrplan-jsonb zu einem Text zusammenfassen
  if new.methodischer_fahrplan is not null then
    select coalesce(string_agg(value, ' '), '')
      into v_ueben
      from jsonb_array_elements_text(
        coalesce(new.methodischer_fahrplan->'ueben', '[]'::jsonb)
      ) as value;
  end if;

  -- lower(unaccent(...)) -> akzent-/case-insensitive; die App normalisiert
  -- den Suchbegriff genauso, bevor sie per ILIKE matcht.
  new.search_text := lower(unaccent(
       coalesce(new.name, '')                                         || ' ' ||
       coalesce(new.aufbau, '')                                       || ' ' ||
       coalesce(new.methodischer_fahrplan->>'offen_starten', '')      || ' ' ||
       v_ueben                                                        || ' ' ||
       coalesce(new.methodischer_fahrplan->>'wetteifern', '')         || ' ' ||
       coalesce(array_to_string(new.material, ' '), '')               || ' ' ||
       material_suchtext(new.material_liste)                          || ' ' ||
       coalesce(array_to_string(new.varianten, ' '), '')
  ));
  return new;
end;
$$;

-- Kein Backfill nötig: jede Bestandszeile trägt eine leere Liste, ihr
-- search_text ist unverändert richtig.

reset lock_timeout;
