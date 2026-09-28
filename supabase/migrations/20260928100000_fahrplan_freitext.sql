set lock_timeout = '5s';

-- ============================================================================
-- Die drei Stufen des methodischen Fahrplans als Freitext wie die Varianten
-- ============================================================================
-- Offen starten, Üben und Wetteifern folgen jetzt denselben Regeln wie Ablauf
-- und Varianten (Story #282, `web/lib/freitext.ts`): Zeilenumbrüche bleiben,
-- eine Zeile mit «- »/«* » ist ein Aufzählungspunkt, eine mit «1. » ein
-- nummerierter.
--
-- Die Form des jsonb bleibt: `ueben` ist weiter ein Array — jetzt die Zeilen
-- des Freitexts statt der einzelnen Schritte. Bisher wurde JEDER Schritt als
-- Aufzählungspunkt gezeigt. Damit der Bestand danach aussieht wie vorher,
-- bekommt jeder Schritt, der noch kein Listenzeichen trägt, ein «- » (wie die
-- Varianten beim Wechsel auf Freitext). Offen starten und Wetteifern waren
-- schon Text und bleiben unverändert.
--
-- Deploy-Fenster: Das noch ausgelieferte Bundle liest dieselbe Form weiter;
-- es zeigt die Schritte nur mit dem vorangestellten «- » im Aufzählungspunkt,
-- bis der neue Code ausgeliefert ist. Kein Bruch, keine neue Invariante.
--
-- Beide Tabellen tragen den Fahrplan: die Fassung im Training ist eine
-- eigenständige Kopie der Übung (Epic #72).
--
-- Forward-only: reine Datenpflege. Die Datei ist WIEDERHOLBAR — die
-- Hilfsfunktion wird angelegt und am Ende wieder entfernt, und umgeformt wird
-- nur eine alte Schrittliste (siehe unten). Das braucht `sync-staging`:
-- Spiegelt es Prod-Daten nach Staging, bevor diese Migration auf Prod läuft,
-- kommen die Schritte ohne «- » an; dann diese Datei gegen Staging erneut
-- ausführen (siehe Kopf von .github/workflows/sync-staging.yml). Nicht später:
-- Ein Üben aus reinem Text ohne jedes Listenzeichen sieht aus wie eine alte
-- Schrittliste und würde zur Aufzählung.
-- ============================================================================

-- Umgeformt wird nur eine ALTE Schrittliste: keine Zeile trägt schon ein
-- Listenzeichen, keine ist leer. Ein Array mit einer Listen- oder Leerzeile
-- ist bereits Freitext und bleibt, wie es ist — ein zweiter Lauf ändert
-- darum nichts mehr.
create function fahrplan_ueben_als_aufzaehlung(p_fahrplan jsonb) returns jsonb
language sql immutable
as $$
  select case
    when jsonb_typeof(p_fahrplan->'ueben') = 'array'
     and not exists (
           select 1
             from jsonb_array_elements_text(p_fahrplan->'ueben') as t(zeile)
            where zeile ~ '^[ \t]*([-*]|[0-9]+\.)[ \t]+' or btrim(zeile) = '')
      then jsonb_set(
        p_fahrplan,
        '{ueben}',
        coalesce(
          (select jsonb_agg('- ' || zeile order by nr)
             from jsonb_array_elements_text(p_fahrplan->'ueben') with ordinality as t(zeile, nr)),
          '[]'::jsonb))
    else p_fahrplan
  end;
$$;

-- ── Suche ─────────────────────────────────────────────────────────────────
-- Die Listenzeichen der drei Stufen zählen bei der Suche nicht mit — wie bei
-- Ablauf und Varianten. Die Üben-Zeilen gehen dazu als ein Text mit
-- Zeilenumbrüchen durch `freitext_suchtext`, damit dessen Zeilenanfangs-Muster
-- jede Zeile trifft.
create or replace function exercises_search_refresh() returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_ueben text := '';
begin
  if new.methodischer_fahrplan is not null then
    select coalesce(string_agg(value, E'\n'), '')
      into v_ueben
      from jsonb_array_elements_text(
        coalesce(new.methodischer_fahrplan->'ueben', '[]'::jsonb)
      ) as value;
  end if;

  -- lower(unaccent(...)) -> akzent-/case-insensitiv; die App normalisiert
  -- den Suchbegriff genauso, bevor sie per ILIKE matcht.
  new.search_text := lower(unaccent(
       coalesce(new.name, '')                                              || ' ' ||
       freitext_suchtext(new.aufbau)                                       || ' ' ||
       freitext_suchtext(new.methodischer_fahrplan->>'offen_starten')      || ' ' ||
       freitext_suchtext(v_ueben)                                          || ' ' ||
       freitext_suchtext(new.methodischer_fahrplan->>'wetteifern')         || ' ' ||
       coalesce(array_to_string(new.material, ' '), '')                    || ' ' ||
       material_suchtext(new.material_liste)                               || ' ' ||
       freitext_suchtext(new.varianten_text)
  ));
  return new;
end;
$$;

-- ── Bestand überführen ────────────────────────────────────────────────────
-- Ohne Nebenwirkungen wie beim Wechsel der Varianten auf Freitext:
-- `updated_at` bleibt, Trainings werden nicht «berührt», die
-- Veröffentlichungs-Prüfung läuft nicht. Der Such-Trigger bleibt an und
-- bildet den Suchtext neu.
alter table exercises disable trigger exercises_set_updated_at;
update exercises
   set methodischer_fahrplan = fahrplan_ueben_als_aufzaehlung(methodischer_fahrplan)
 where jsonb_typeof(methodischer_fahrplan->'ueben') = 'array';
alter table exercises enable trigger exercises_set_updated_at;

alter table training_exercises disable trigger training_exercises_touch;
alter table training_exercises disable trigger training_exercises_oeffentlich_gate;
update training_exercises
   set methodischer_fahrplan = fahrplan_ueben_als_aufzaehlung(methodischer_fahrplan)
 where jsonb_typeof(methodischer_fahrplan->'ueben') = 'array';
alter table training_exercises enable trigger training_exercises_oeffentlich_gate;
alter table training_exercises enable trigger training_exercises_touch;

-- Die Hilfsfunktion war nur für die Überführung da.
drop function fahrplan_ueben_als_aufzaehlung(jsonb);

reset lock_timeout;
