-- ============================================================================
-- KI-geführtes Feedback (Epic #541), Story 3 (#545): Jedes Feedback wird
-- 12 Monate nach seinem Eingang gelöscht, ohne Zutun des Betreibers (PC 1,
-- NFR 1).
--
-- Der erste geplante Job in KiFu: pg_cron läuft in der Datenbank selbst, auf
-- Production wie Staging, und braucht weder Vercel noch ein Geheimnis
-- (PO 2026-10-28). Einmal täglich in der Nacht; ein Feedback bleibt so
-- höchstens 12 Monate und einen Tag.
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;

-- Löscht, was älter als 12 Monate ist, und meldet, wie viel. Nur der Job ruft
-- sie auf; als Funktion steht die Regel an einem Ort und lässt sich testen.
create function feedback_frist_loeschen() returns integer
language sql security definer
set search_path = public, pg_temp
as $$
  with weg as (delete from feedback where eingegangen_am < now() - interval '12 months' returning 1)
  select count(*)::int from weg
$$;
revoke all on function feedback_frist_loeschen() from public, anon, authenticated;

-- Täglich um 03:17 UTC. Gleicher Name ersetzt einen bestehenden Job.
select cron.schedule('feedback-frist', '17 3 * * *', $$select public.feedback_frist_loeschen()$$);
