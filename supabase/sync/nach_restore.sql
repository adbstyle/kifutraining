-- Sync-Baustein nach dem Restore (sync-staging.yml, AP Vereine §6.2):
-- Ruft `public.staging_nach_sync()` auf, sofern die Funktion existiert, sonst
-- geschieht nichts. Läuft in der Restore-Transaktion unter
-- `session_replication_role = replica`. Aufruf per `execute`, damit eine
-- fehlende Funktion keinen Fehler gibt. Namen voll qualifiziert: der Dump
-- setzt `search_path` auf leer.
-- Wird mit N1 (Nachlauf Vereine) als Übergangs-Artefakt entfernt.
--
-- Vertrag für eine künftige `public.staging_nach_sync()`:
-- - Funktion, keine Prozedur (Aufruf per `select`), `returns void`.
-- - Eigenes `set search_path = ''` und nur voll qualifizierte Namen
--   (`public.…`, `pg_catalog.…`): nach dem Dump ist `search_path` leer.
-- - Meldungen mit `raise warning`, nicht `notice`: der Dump setzt
--   `client_min_messages = warning`, ein `notice` erschiene nicht im Log.

do $$
begin
  if to_regprocedure('public.staging_nach_sync()') is not null then
    raise warning 'public.staging_nach_sync() wird aufgerufen';
    execute 'select public.staging_nach_sync()';
  end if;
end $$;
