set lock_timeout = '5s';

-- ============================================================================
-- Story #282: Varianten und Ablauf einer Übung als Freitext mit einfachen Listen
-- Schritt 1 von 2 (Expand) — sicher für den Code, der noch läuft
-- ============================================================================
-- Die Varianten einer Übung werden vom Listenfeld (`varianten text[]`, ein
-- Eintrag pro Zeile) zu einem zusammenhängenden Freitext wie der Ablauf. Der
-- Freitext kommt in eine NEUE Spalte `varianten_text`; die alte bleibt
-- vorerst stehen. Grund: `db push` und der Vercel-Build laufen parallel. Ein
-- Typwechsel an Ort und Stelle liesse das noch ausgelieferte Bundle eine
-- Liste erwarten, wo schon Text steht — die Übungsseite bräche, und ein
-- Speichern schriebe ein Array-Literal in den Text.
--
-- Bis Schritt 2 gleicht ein Trigger beide Spalten ab, in beide Richtungen:
--   - schreibt jemand nur die Liste (altes Bundle), entsteht der Text daraus
--   - schreibt jemand den Text (neuer Code), entsteht die Liste daraus — ohne
--     Listenzeichen, eine Zeile pro Eintrag, damit das alte Bundle etwas
--     Lesbares zeigt
-- Schritt 2 (eigene Migration, sobald dieser Code auf Prod läuft) entfernt
-- Trigger, Hilfsfunktionen und die alte Spalte.
--
-- Bestand (PC 3/4): jeder bisherige Eintrag wird zu einer Aufzählungszeile
-- «- Eintrag» — die Übung sieht danach aus wie vorher und lässt sich ohne
-- Nacharbeit weiterbearbeiten. Leere Liste wird zu null, wie ein fehlender
-- Ablauf.
--
-- Beide Tabellen tragen die Spalte: die Fassung im Training ist eine
-- eigenständige Kopie der Übung (Epic #72) und nimmt sie über
-- FASSUNG_INHALT_FELDER (web/lib/fassung.ts) mit; `lege_variante_an` kopiert
-- per to_jsonb jede Spalte.
--
-- Forward-only: neue nullable Spalte ohne Invariante, die alte bleibt
-- unverändert.
-- ============================================================================

alter table exercises add column varianten_text text;
alter table training_exercises add column varianten_text text;

comment on column exercises.varianten_text is
  'Varianten als Freitext mit einfachen Listen (Story #282); Regeln in web/lib/freitext.ts. Ersetzt `varianten` (text[]), die in Schritt 2 wegfällt.';
comment on column training_exercises.varianten_text is
  'Varianten der Fassung als Freitext mit einfachen Listen (Story #282); wie exercises.varianten_text.';

-- Suchtext eines Freitexts ohne Listenzeichen (AK 9): Wer «1.» oder «-»
-- sucht, soll nicht jede Übung mit einer Liste finden. Das Flag «n» lässt
-- «^» an jedem Zeilenanfang greifen. Zwilling: web/lib/freitext.ts.
create or replace function freitext_suchtext(p_text text) returns text
language sql immutable
as $$
  select coalesce(
    regexp_replace(p_text, '^[ \t]*([-*]|[0-9]+\.)[ \t]+', '', 'gn'),
    '');
$$;

-- ── Abgleich bis Schritt 2 ────────────────────────────────────────────────
-- Liste → Text: jeder Eintrag eine Aufzählungszeile, leere Einträge fallen
-- weg; ohne Eintrag null.
create function varianten_als_text(p_liste text[]) returns text
language sql immutable
as $$
  select '- ' || string_agg(btrim(t.eintrag, E' \t\r'), E'\n- ' order by t.n)
    from unnest(p_liste) with ordinality as t(eintrag, n)
   where btrim(t.eintrag, E' \t\r') <> '';
$$;

-- Text → Liste: jede nicht leere Zeile ein Eintrag, ohne Listenzeichen.
create function varianten_als_liste(p_text text) returns text[]
language sql immutable
as $$
  select coalesce(array_agg(z.eintrag order by z.n), '{}')
    from (
      select btrim(regexp_replace(t.zeile, '^[ \t]*([-*]|[0-9]+\.)[ \t]+', ''), E' \t\r') as eintrag, t.n
        from unnest(string_to_array(coalesce(p_text, ''), E'\n')) with ordinality as t(zeile, n)
    ) z
   where z.eintrag <> '';
$$;

create function varianten_abgleichen() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.varianten_text is not null then
      if cardinality(new.varianten) = 0 then
        new.varianten := varianten_als_liste(new.varianten_text);
      end if;
    else
      new.varianten_text := varianten_als_text(new.varianten);
    end if;
  elsif new.varianten_text is distinct from old.varianten_text then
    new.varianten := varianten_als_liste(new.varianten_text);
  elsif new.varianten is distinct from old.varianten then
    new.varianten_text := varianten_als_text(new.varianten);
  end if;
  return new;
end;
$$;

-- BEFORE-Trigger feuern in Namensreihenfolge: «exercises_abgleich_…» läuft
-- vor «exercises_search», der Suchtext sieht also schon den abgeglichenen Text.
create trigger exercises_abgleich_varianten
  before insert or update on exercises
  for each row execute function varianten_abgleichen();
create trigger te_abgleich_varianten
  before insert or update on training_exercises
  for each row execute function varianten_abgleichen();

-- ── Suche ─────────────────────────────────────────────────────────────────
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
       freitext_suchtext(new.varianten_text)
  ));
  return new;
end;
$$;

-- ── Bestand überführen ────────────────────────────────────────────────────
-- Ohne Nebenwirkungen: die Überführung ändert keinen Inhalt. `updated_at`
-- bleibt, Trainings werden nicht «berührt», und die Veröffentlichungs-Prüfung
-- läuft nicht — ein veröffentlichtes Altbestand-Training, das eine heutige
-- Bedingung verfehlt, darf die Migration nicht aufhalten. Der Such-Trigger
-- bleibt an und bildet den Suchtext neu.
alter table exercises disable trigger exercises_set_updated_at;
update exercises set varianten_text = varianten_als_text(varianten);
alter table exercises enable trigger exercises_set_updated_at;

alter table training_exercises disable trigger training_exercises_touch;
alter table training_exercises disable trigger training_exercises_oeffentlich_gate;
update training_exercises set varianten_text = varianten_als_text(varianten)
 where cardinality(varianten) > 0;
alter table training_exercises enable trigger training_exercises_oeffentlich_gate;
alter table training_exercises enable trigger training_exercises_touch;

reset lock_timeout;
