-- ============================================================================
-- Beginn und Ende sind an jedem Termin Pflicht (PO 2026-10-06, Epic #401).
-- Bisher durften übernommene Termine ohne sie sein (#322 PO 9); die Pflicht
-- für neue prüfte nur der Fachkern. Der Bestand wird ergänzt, danach gilt
-- die Pflicht auch in der Datenebene.
--
-- Ergänzt wird mit einer Trainingsdauer von 90 Minuten — dieselbe, die das
-- Kalender-Abo bisher für einen Termin ohne Ende annahm:
--   - ohne Beginn (und damit ohne Ende): 18:00–19:30
--   - mit Beginn, ohne Ende: Beginn + 90 Minuten, höchstens bis 23:59 —
--     das Ende liegt am selben Tag (`tt_ende_nach_beginn`).
-- Prod am 2026-10-06: 3 Termine ohne Beginn, 9 ohne Ende, keiner beginnt
-- nach 22:30. `updated_at` läuft mit: Ein Kalender-Abo übernimmt die
-- ergänzte Zeit beim nächsten Abruf.
-- ============================================================================
set lock_timeout = '5s';

update training_termine set beginn = time '18:00', ende = time '19:30' where beginn is null;

update training_termine
   set ende = case when beginn < time '22:30' then beginn + interval '90 minutes' else time '23:59' end
 where ende is null;

alter table training_termine
  alter column beginn set not null,
  alter column ende set not null;

-- Ein Ende setzt keinen Beginn mehr voraus — beide sind da.
alter table training_termine drop constraint tt_ende_nach_beginn;
alter table training_termine add constraint tt_ende_nach_beginn check (ende > beginn);

reset lock_timeout;
