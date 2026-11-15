-- Validierung der Zuordnungs-Invarianten (Story 3 #579, Plan Phase A;
-- Architekturplan Vereine §3 «Warum die Validierung erst im letzten PR
-- entsteht», §3.3 b, §3.8, §6.5). Reine Katalogprüfung, ändert nichts:
-- - Die elf FKs aus 20261114100000_zuordnung_invarianten.sql gibt es, und sie
--   sind validiert (20261115140000_zuordnung_invarianten_validieren.sql).
-- - Nachlauf N1 ist nicht vorweggenommen: `verein_id` auf `teams` und
--   `spieler` bleibt nullable, die Pflicht-Constraints gibt es noch nicht
--   (Expand jetzt, Contract nach dem Release, AP §3.8). Mit N1 fällt dieser
--   Teil hier weg.
-- - Sonst ist in `public` nur ungeprüft, was schon vor dem Epic ungeprüft war:
--   die fünf Constraints von `training_exercises` (AP §6.5). Ausdrückliche
--   Liste, damit niemand nebenbei etwas validiert oder ungeprüft hinzufügt.

\set ON_ERROR_STOP on

begin read only;
do $$
declare
  c_fks constant text[] := array[
    'kader_spieler.ks_zuordnung', 'termin_abmeldungen.ta_zuordnung', 'spiel_meldungen.sm_zuordnung',
    'termin_abmeldungen.ta_termin_team', 'termin_statuswechsel.tsw_termin_team',
    'spiel_meldungen.sm_termin_team', 'termin_eingefroren.te_termin_team',
    'termin_kader.tk_termin_team', 'spiel_treffpunkte.stp_termin_team',
    'termin_teilnahmen.tn_eingefroren_team', 'spiel_teilnahmen.st_eingefroren_team'];
  c_vor_dem_epic constant text[] := array[
    'training_exercises.ex_feldtyp_nur_kifu', 'training_exercises.ex_uebungstyp_nur_junioren',
    'training_exercises.te_ablauf_je_einordnung', 'training_exercises.te_erscheinungsform_je_altersstufe',
    'training_exercises.te_kategorien_je_altersstufe'];
  x text;
begin
  -- Die elf FKs: vorhanden, Fremdschlüssel, validiert.
  select string_agg(f, ', ' order by f) into x from unnest(c_fks) f
   where not exists (select 1 from pg_constraint c
                      where c.connamespace = 'public'::regnamespace
                        and c.conrelid::regclass::text || '.' || c.conname = f
                        and c.contype = 'f' and c.convalidated);
  if x is not null then raise exception 'Zuordnungs-FKs fehlen oder sind nicht validiert: %', x; end if;

  -- N1 nicht vorweggenommen.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and column_name = 'verein_id'
                and table_name in ('teams', 'spieler') and is_nullable = 'NO') then
    raise exception 'verein_id ist schon NOT NULL (gehört zu N1, AP §3.8)';
  end if;
  select string_agg(conname, ', ' order by conname) into x from pg_constraint
   where connamespace = 'public'::regnamespace and conname in ('teams_verein_pflicht', 'spieler_verein_pflicht');
  if x is not null then raise exception 'Pflicht-Constraints aus N1 bestehen schon: %', x; end if;

  -- Ungeprüft ist genau, was es vor dem Epic schon war.
  select string_agg(n, ', ' order by n) into x from (
    (select c.conrelid::regclass::text || '.' || c.conname n from pg_constraint c
      where c.connamespace = 'public'::regnamespace and not c.convalidated
     except select unnest(c_vor_dem_epic))
    union all
    (select unnest(c_vor_dem_epic)
     except select c.conrelid::regclass::text || '.' || c.conname from pg_constraint c
      where c.connamespace = 'public'::regnamespace and not c.convalidated)) d;
  if x is not null then
    raise exception 'Ungeprüfte Constraints in public weichen von der Liste ab (neu ungeprüft oder validiert): %', x;
  end if;
end $$;
rollback;
