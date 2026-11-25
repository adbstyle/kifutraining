-- Aushelfen mit einem Schritt im Trainingsplan (#691).
--
-- Wer nicht eingeladen ist, lädt sich mit dem Schalter in der Terminzeile
-- selbst ein und ist damit dabei (Epic #518, Begriff «Aushelfen»). Bisher lief
-- das über `termin_trainer_aendern`, das bewusst auch an begonnenen und
-- vergangenen Terminen einlädt (#518 PO 7; so legt auch das Festlegen eines
-- vergangenen Termins seine Eingeladenen an). Aushelfen ist dagegen eine
-- Zusage wie das Wiederzusagen und folgt deren Frist: nur bis zum Beginn bzw.
-- Anpfiff und nie an einem ausgefallenen Termin (#520 AK 3). Darum eine eigene,
-- schmale RPC — `termin_trainer_aendern` bleibt unverändert.
--
-- An einem Serientermin weicht der Termin danach bei den Eingeladenen von der
-- Serie ab, wie beim Einladen über den Termin (PO 2026-11-24: still wie heute).
-- Wer schon eingeladen ist, ändert nichts (auch nicht eine Absage: dafür gibt
-- es `termin_trainer_absage_setzen`).

set lock_timeout = '5s';

create function termin_aushelfen(p_termin uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_neu integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if t.ausgefallen then raise exception 'AUSHELFEN_AUSGEFALLEN'; end if;
  if termin_begonnen(t.datum, t.beginn) then raise exception 'AUSHELFEN_BEGONNEN'; end if;

  insert into termin_trainer (termin_id, user_id)
  values (t.id, auth.uid())
  on conflict (termin_id, user_id) do nothing;
  get diagnostics v_neu = row_count;

  if v_neu > 0 and t.serie_id is not null then
    update training_termine set eingeladene_abweichend = true
     where id = t.id and not eingeladene_abweichend;
  end if;
  return jsonb_build_object('team', t.team_id);
end;
$$;
revoke all on function termin_aushelfen(uuid) from public, anon;
grant execute on function termin_aushelfen(uuid) to authenticated;

reset lock_timeout;
