-- ============================================================================
-- Kalender-Abo für Spielervertretungen (Epic #506), Story 1 (#507): Über den
-- privaten Link holt die Spielervertretung eine Abo-Adresse, über die ihr
-- Kalenderprogramm die Termine ihrer Spieler:in abruft.
--
-- Die Abo-Adresse trägt ein eigenes Geheimnis (244 Bit wie Link und
-- Mitglieder-Abo): Sie berechtigt nur zum Lesen, und aus ihr lässt sich der
-- private Link nicht ermitteln (AK 9, 10). Je Spieler:in gibt es höchstens
-- eine gültige (AK 8) — erneutes Holen liefert dieselbe (AK 5).
--
-- Das Abo folgt dem privaten Link (PO-Entscheid 3): Der Feed fragt
-- `spieler_link_ansicht` selbst und lässt nur die ausgefallenen Termine weg
-- (PC 1) — dieselben Termine, derselbe Stand, auch an der Tagesgrenze, bei
-- begonnenen Terminen und nach Kader-Änderungen, ohne zweite Regel.
--
-- Es erlischt (PC 7): Erneuern des Links löscht es (Trigger), Entfernen der
-- Spieler:in und Auflösen des Teams nehmen es per Cascade mit. Ein
-- erloschenes Abo lebt nie wieder auf (PC 8).
--
-- Mitglieder und KI-Assistent sehen nicht, ob ein Abo besteht (OoS 7): Die
-- Tabelle hat für die API-Rollen kein Recht; alles läuft über die
-- SECURITY-DEFINER-Funktionen mit dem Link bzw. der Abo-Adresse.
-- ============================================================================
set lock_timeout = '5s';

create table spieler_abos (
  id uuid primary key default gen_random_uuid(),
  spieler_id uuid not null unique references spieler (id) on delete cascade,
  token text not null unique default neues_geheimnis(),
  created_at timestamptz not null default now()
);

alter table spieler_abos enable row level security;
revoke all on spieler_abos from anon, authenticated;

-- PC 7: Ein erneuerter Link lässt das Abo erlöschen — gleich über welchen
-- Weg (Oberfläche, KI-Assistent). Der Abgleich nach Staging läuft ohne
-- Trigger und leert die Tabelle darum selbst (sync-staging.yml).
create function spieler_abo_erloeschen() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from spieler_abos where spieler_id = new.id;
  return null;
end;
$$;
revoke all on function spieler_abo_erloeschen() from public, anon, authenticated;

create trigger spieler_link_erneuert
  after update of link_token on spieler
  for each row when (old.link_token is distinct from new.link_token)
  execute function spieler_abo_erloeschen();

-- ── Holen (AK 1, 5, 8) ──────────────────────────────────────────────────────

-- Die Abo-Adresse zum privaten Link — dieselbe, solange sie gilt. Ein
-- ungültiger Link liefert `null`. `for key share` hält Erneuern und Entfernen
-- an, bis das Abo steht; danach löscht es der Trigger bzw. der Cascade.
-- Einfügen und Lesen in einem Schritt: `do update` liefert auch die
-- bestehende Zeile zurück, ein gleichzeitiger Widerruf kann nicht dazwischen.
create function spieler_abo_holen(p_link text) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spieler uuid;
  v_token text;
begin
  select id into v_spieler from spieler where link_token = p_link for key share;
  if not found then return null; end if;
  insert into spieler_abos (spieler_id) values (v_spieler)
    on conflict (spieler_id) do update set spieler_id = excluded.spieler_id
    returning token into v_token;
  return v_token;
end;
$$;
revoke all on function spieler_abo_holen(text) from public;
grant execute on function spieler_abo_holen(text) to anon, authenticated;

-- ── Feed (PC 1–4, 6) ────────────────────────────────────────────────────────

-- Was das Kalenderprogramm abruft: der Teamname (PC 6) und die Termine, die
-- der private Link im selben Moment zeigt, ohne ausgefallene (PC 1) — je
-- Termin nur, was ins Abo gehört (PC 2; #508 PC 2). Kein Name der
-- Spieler:in und nichts, das den Link verrät. `abo` ist die Kennung der
-- Zeile (kein Geheimnis): Sie macht die UID je Abo eindeutig.
create function spieler_abo_termine(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  a spieler_abos;
  v jsonb;
begin
  select * into a from spieler_abos where token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  v := spieler_link_ansicht((select link_token from spieler where id = a.spieler_id));
  if not coalesce((v ->> 'gueltig')::boolean, false) then return jsonb_build_object('gueltig', false); end if;
  return jsonb_build_object(
    'gueltig', true,
    'abo', a.id,
    'team', v -> 'team',
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e -> 'id', 'datum', e -> 'datum', 'beginn', e -> 'beginn', 'ende', e -> 'ende',
               'ort', e -> 'ort', 'art', e -> 'art', 'bezeichnung', e -> 'bezeichnung',
               'begonnen', e -> 'begonnen', 'abgemeldet', e -> 'abgemeldet',
               'meldung', e -> 'meldung', 'frist_abgelaufen', e -> 'frist_abgelaufen',
               'nicht_aufgeboten', e -> 'nicht_aufgeboten',
               'bemerkung', e -> 'bemerkung', 'treffpunkte', e -> 'treffpunkte')
             order by x.n)
        from jsonb_array_elements(v -> 'termine') with ordinality as x(e, n)
       where not (e ->> 'ausgefallen')::boolean), '[]'::jsonb));
end;
$$;
revoke all on function spieler_abo_termine(text) from public;
grant execute on function spieler_abo_termine(text) to anon, authenticated;

reset lock_timeout;
