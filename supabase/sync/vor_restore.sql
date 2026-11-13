-- Sync-Baustein vor dem Restore (sync-staging.yml, AP Vereine §6.2):
-- Leert alle Tabellen in `public`, die es in der Zieldatenbank gibt, die aber
-- nicht in PUBLIC_TABLES stehen (Staging-eigene Tabellen, solange `develop`
-- Prod vorauseilt). Ein einziges `truncate … cascade`; ist die Menge leer,
-- geschieht nichts. Die gelisteten Tabellen leert der Workflow selbst.
--
-- Erwartet die psql-Variable `public_tables` (Namen durch Leerzeichen
-- getrennt, wie PUBLIC_TABLES im Workflow) und läuft in der Restore-
-- Transaktion: psql ersetzt in `$$…$$` keine Variablen, darum reist die
-- Liste über `set_config(…, true)` (transaktionslokal). `\gset` hält das
-- Ergebnis aus dem Log (sonst stünde die ganze Liste darin); es wirkt auch,
-- wenn psql die Datei über stdin liest.
-- Wird mit N1 (Nachlauf Vereine) als Übergangs-Artefakt entfernt.

select set_config('sync.public_tables', :'public_tables', true) is not null as vor_restore_liste_gesetzt \gset

do $$
declare
  liste  text[] := string_to_array(btrim(current_setting('sync.public_tables')), ' ');
  ziele  text;
begin
  -- Schutz: eine leere Liste hiesse «alles ist Staging-eigen».
  if coalesce(cardinality(liste), 0) = 0 then
    raise exception 'vor_restore: psql-Variable public_tables ist leer';
  end if;

  select string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename collate "C")
    into ziele
    from pg_catalog.pg_tables
   where schemaname = 'public'
     and tablename <> all (liste);

  if ziele is not null then
    raise notice 'Staging-eigene Tabellen werden geleert: %', ziele;
    execute 'truncate ' || ziele || ' cascade';
  end if;
end $$;
