-- ============================================================================
-- Benachrichtigungen am privaten Link (Epic #641), Story 2 (#643): Ausfall
-- und Rücknahme eines Ausfalls mitteilen.
--
-- `termin_benachrichtigen` kennt zwei weitere Ereignisse (Prinzip 1):
-- - `ausfall`: Der Termin ist ausgefallen. Den Grund trägt
--   `benachrichtigung_inhalt` an einem ausgefallenen Termin schon mit (AK 3;
--   `null` ohne Grund).
-- - `ruecknahme`: Der Termin ist nicht (mehr) ausgefallen (AK 4); ohne Grund,
--   ohne Meldestand und ohne Treffpunkt (OoS 4).
-- Passt der Zustand nicht, bleibt es still (0, kein Fehler). Ob ein Ausfall
-- neu ist oder nur sein Grund wechselt (OoS 1: still), weiss allein der
-- Aufrufer — der Fachkern (`lasseAusfallen`) ruft nur beim Wechsel von «findet
-- statt» zu «fällt aus». Empfänger (PC 1, auch abgemeldete) und Tagesgrenze
-- (AK 1: heute oder später) bleiben die Bausteine aus #642.
--
-- Forward-only: nur `create or replace` derselben Signatur; Rechte bleiben.
-- ============================================================================
set lock_timeout = '5s';

create or replace function termin_benachrichtigen(p_termin uuid, p_ereignis text, p_wieder boolean default false)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
begin
  select * into t from training_termine where id = p_termin;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if p_ereignis is null or p_ereignis not in ('neues_spiel', 'ausfall', 'ruecknahme') then
    raise exception 'EREIGNIS_UNGUELTIG';
  end if;
  if not benachrichtigung_zaehlt(t.datum) then return 0; end if;
  if p_ereignis = 'neues_spiel' then
    -- #642: ein Spiel, das stattfindet, zu dem es noch keines gibt.
    if t.art <> 'spiel' or t.ausgefallen
       or exists (select 1 from spieler_benachrichtigungen b
                   where b.termin_id = t.id and b.ereignis = 'neues_spiel') then
      return 0;
    end if;
  elsif p_ereignis = 'ausfall' then
    -- #643 AK 3: Der Termin ist ausgefallen; der Grund steht im Inhalt.
    if not t.ausgefallen then return 0; end if;
  elsif p_ereignis = 'ruecknahme' then
    -- #643 AK 4: Der Termin findet wieder statt.
    if t.ausgefallen then return 0; end if;
  end if;
  return benachrichtigung_ablegen(gen_random_uuid(), p_ereignis, t.id, benachrichtigung_inhalt(t, p_wieder),
                                  array(select benachrichtigung_empfaenger(t.id)));
end;
$$;
revoke all on function termin_benachrichtigen(uuid, text, boolean) from public, anon;
grant execute on function termin_benachrichtigen(uuid, text, boolean) to authenticated;
