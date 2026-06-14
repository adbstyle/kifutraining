-- API-Rollen-Grants explizit setzen (anon / authenticated / service_role).
--
-- Hintergrund: Alle Tabellen werden in den Migrationen als Rolle `postgres`
-- erstellt. Ältere Supabase-Postgres-Images gewährten den API-Rollen über die
-- postgres-Default-Privileges automatisch volles DML — neuere Images gewähren
-- darüber nur noch strukturelle Rechte (TRUNCATE/REFERENCES/TRIGGER), kein
-- SELECT/INSERT/UPDATE/DELETE. Auf einer frisch migrierten DB (CI-Wegwerf-DB,
-- frisches Prod) scheitert dadurch jeder Tabellenzugriff der API-Rollen mit
-- 42501 „permission denied for table …" — u. a. der Manual-Seed (service_role).
--
-- RLS bleibt die Zugriffskontrolle: alle public-Tabellen haben RLS aktiv, die
-- Grants stellen nur die Tabellen-Sichtbarkeit wieder her (Zeilen-Filter via
-- Policies unverändert). Idempotent: auf bestehenden DBs sind die Rechte bereits
-- vorhanden, das erneute GRANT ist folgenlos.

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

-- Künftige, als `postgres` erstellte Objekte automatisch abdecken, damit das
-- Problem nicht bei der nächsten Tabelle erneut auftritt.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
