-- Sync-Baustein nach dem Restore (sync-staging.yml, AP Vereine §6.2):
-- Ruft `public.staging_nach_sync()` auf, sofern die Funktion existiert, sonst
-- geschieht nichts. Läuft in der Restore-Transaktion unter
-- `session_replication_role = replica`. Aufruf per `execute`, damit eine
-- fehlende Funktion keinen Fehler gibt. Namen voll qualifiziert: der Dump
-- setzt `search_path` auf leer.
-- Wird mit N1 (Nachlauf Vereine) als Übergangs-Artefakt entfernt.

do $$
begin
  if to_regprocedure('public.staging_nach_sync()') is not null then
    raise notice 'public.staging_nach_sync() wird aufgerufen';
    execute 'select public.staging_nach_sync()';
  end if;
end $$;
