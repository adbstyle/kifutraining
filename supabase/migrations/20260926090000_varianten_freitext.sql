set lock_timeout = '5s';

-- ============================================================================
-- Story #282: Varianten und Ablauf einer Übung als Freitext mit einfachen Listen
-- ============================================================================
-- Die Varianten einer Übung werden vom Listenfeld (text[], ein Eintrag pro
-- Zeile) zu einem zusammenhängenden Freitext wie der Ablauf (`aufbau`). Beide
-- Texte kennen fortan Aufzählungen («- » / «* ») und nummerierte Listen
-- («1. »); alles andere bleibt Text, Zeilenumbrüche bleiben erhalten. Die
-- Darstellung liest `web/lib/freitext.ts`.
--
-- Bestand (PC 3/4): jeder bisherige Eintrag wird zu einer Aufzählungszeile
-- «- Eintrag» — die Übung sieht danach aus wie vorher und lässt sich ohne
-- Nacharbeit weiterbearbeiten. Leere Liste wird zu null, wie ein fehlender
-- Ablauf. Einträge enthalten keine Zeilenumbrüche (das Formular hat pro Zeile
-- einen Eintrag gebildet), der Zusammenzug ist darum verlustfrei.
--
-- Beide Tabellen tragen die Spalte: die Fassung im Training ist eine
-- eigenständige Kopie der Übung (Epic #72) und nimmt sie über
-- FASSUNG_INHALT_FELDER (web/lib/fassung.ts) mit; `lege_variante_an` kopiert
-- per to_jsonb jede Spalte, unabhängig vom Typ.
--
-- Forward-only: Typwechsel mit verlustfreier Überführung, keine neue
-- Invariante (die Spalte wird lockerer — nullable statt «not null default»).
-- ============================================================================

alter table exercises alter column varianten drop default;
alter table exercises alter column varianten drop not null;
alter table exercises alter column varianten type text using
  case when cardinality(varianten) = 0 then null
       else '- ' || array_to_string(varianten, E'\n- ') end;

alter table training_exercises alter column varianten drop default;
alter table training_exercises alter column varianten drop not null;
alter table training_exercises alter column varianten type text using
  case when cardinality(varianten) = 0 then null
       else '- ' || array_to_string(varianten, E'\n- ') end;

-- Suchtext eines Freitexts ohne Listenzeichen (AK 9): Wer «1.» oder «-»
-- sucht, soll nicht jede Übung mit einer Liste finden. Das Flag «n» lässt
-- «^» an jedem Zeilenanfang greifen.
create or replace function freitext_suchtext(p_text text) returns text
language sql immutable
as $$
  select coalesce(
    regexp_replace(p_text, '^[ \t]*([-*]|[0-9]+\.)[ \t]+', '', 'gn'),
    '');
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
       freitext_suchtext(new.aufbau)                                  || ' ' ||
       coalesce(new.methodischer_fahrplan->>'offen_starten', '')      || ' ' ||
       v_ueben                                                        || ' ' ||
       coalesce(new.methodischer_fahrplan->>'wetteifern', '')         || ' ' ||
       coalesce(array_to_string(new.material, ' '), '')               || ' ' ||
       material_suchtext(new.material_liste)                          || ' ' ||
       freitext_suchtext(new.varianten)
  ));
  return new;
end;
$$;

-- Suchtext des Bestands neu bilden, ohne updated_at zu verändern: der
-- BEFORE-UPDATE-Such-Trigger rechnet search_text neu.
alter table exercises disable trigger exercises_set_updated_at;
update exercises set search_text = null;
alter table exercises enable trigger exercises_set_updated_at;

reset lock_timeout;
