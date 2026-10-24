-- ============================================================================
-- Kalender-Abo für Spielervertretungen (Epic #506), Story 3 (#509): Die
-- Spielervertretung widerruft das Abo ihrer Spieler:in selbst über den
-- privaten Link.
--
-- Widerrufen löscht die Abo-Adresse: Sie liefert ab dem nächsten Abruf
-- keine Termine mehr, für alle, die sie nutzen (PC 1), und lebt nie wieder
-- auf (PC 2). Link, Meldungen und Abmeldungen bleiben (PC 3). Danach holt
-- `spieler_abo_holen` über denselben Link eine neue (AK 4).
-- ============================================================================
set lock_timeout = '5s';

-- 'ok', auch wenn kein Abo bestand; 'ungueltig' für einen ungültigen Link —
-- wie die übrigen `spieler_link_*`.
create function spieler_abo_widerrufen(p_link text) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spieler uuid;
begin
  select id into v_spieler from spieler where link_token = p_link;
  if not found then return 'ungueltig'; end if;
  delete from spieler_abos where spieler_id = v_spieler;
  return 'ok';
end;
$$;
revoke all on function spieler_abo_widerrufen(text) from public;
grant execute on function spieler_abo_widerrufen(text) to anon, authenticated;

reset lock_timeout;
