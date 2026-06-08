-- ============================================================================
-- "Über alles"-Suche: Volltext (tsvector/FTS) -> Teilstring-Suche (ILIKE)
-- ============================================================================
-- Die FTS matchte nur ganze Lexeme, und der deutsche Stemmer zerlegt keine
-- Komposita: "Hand" fand "Handball" nicht. Variante 3: eine zusammengesetzte
-- Plain-Text-Spalte `search_text`, gegen die die App per ILIKE '%begriff%'
-- sucht (echtes Teilstring-Matching). `varianten` wird neu mitberücksichtigt
-- (war bisher gar nicht durchsuchbar).
--
-- pg_trgm ist bereits aktiv (init_schema); ein GIN-Trigram-Index auf
-- search_text hält die Substring-Suche skalierbar und ersetzt den bisherigen
-- name-only-Trigram-Index. Stemming/Ranking entfallen bewusst.
--
-- Akzent-/Umlaut-Insensitivität: search_text wird via unaccent() + lower()
-- normalisiert gespeichert ("Hütchen" -> "hutchen", "fußball" -> "fussball").
-- Sonst würde ILIKE eine Eingabe ohne Umlaut ("hutchen") nicht mehr finden —
-- die alte FTS faltete Umlaute über den Stemmer, das darf nicht regredieren.
-- Die App normalisiert den Suchbegriff identisch (lib/queries/exercises.ts).
create extension if not exists unaccent;

-- 1) Neue Plain-Text-Suchspalte
alter table exercises add column search_text text;

-- 2) Trigger-Funktion baut search_text statt search_tsv
-- search_path gepinnt, damit unaccent() zur Trigger-Laufzeit auflösbar ist —
-- lokal liegt die Extension in `public`, auf Supabase-Prod in `extensions`.
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
       coalesce(array_to_string(new.varianten, ' '), '')
  ));
  return new;
end;
$$;

-- 3) Bestand backfillen, ohne updated_at zu verändern: der BEFORE-UPDATE-
--    Such-Trigger recomputet search_text; den updated_at-Trigger derweil aus.
alter table exercises disable trigger exercises_set_updated_at;
update exercises set search_text = null;
alter table exercises enable trigger exercises_set_updated_at;

-- 4) Alte FTS-Artefakte entfernen (vollständig ersetzt)
drop index if exists exercises_search_idx;     -- GIN auf search_tsv
drop index if exists exercises_name_trgm_idx;  -- durch search_text-Index abgedeckt
alter table exercises drop column search_tsv;

-- 5) Trigram-Index für die ILIKE-Substring-Suche
create index exercises_search_text_trgm_idx
  on exercises using gin (search_text gin_trgm_ops);
