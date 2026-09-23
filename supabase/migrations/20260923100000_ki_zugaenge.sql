-- ============================================================================
-- KI-Zugänge (Story #142): eigener Name je Zugang und Aufruf-Begrenzung je
-- Konto. Die Zugänge selbst (Zustimmungen, Sitzungen, Widerruf) führt Supabase
-- Auth als OAuth-2.1-Server; hier liegt nur, was Supabase nicht kennt.
--
-- Forward-only und rein additiv (CLAUDE.md): zwei neue Tabellen, eine neue
-- Funktion, keine Änderung an Bestandszeilen — ein `NOT VALID` braucht es
-- darum nicht. Beide Tabellen stehen in `PUBLIC_TABLES` von sync-staging.yml.
-- ============================================================================

-- ── Eigener Name eines Zugangs (AK 3, PC 2) ─────────────────────────────────
-- Eine Zeile gibt es nur, wenn der Trainer beim Erlauben einen vom Client-Namen
-- abweichenden Namen vergeben hat; sonst zeigt das Konto den Client-Namen.
-- client_id bewusst OHNE Fremdschlüssel: auth.oauth_clients gehört GoTrue und
-- wird von dessen Migrationen verwaltet. Eine verwaiste Zeile (Client gelöscht)
-- ist harmlos — die Konto-Liste geht von den Zustimmungen aus, nicht von hier.
create table ki_zugang_namen (
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null,
  name       text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, client_id),
  -- TS-Zwilling: ZUGANGSNAME_MAX / zugangsnameProblem in web/lib/mcp/regeln.ts
  -- (check:ki-zugang liest diese Zeile wörtlich).
  constraint kzn_name_laenge check (name = btrim(name) and char_length(name) between 1 and 40)
);
alter table ki_zugang_namen enable row level security;
-- Einstufige Schreibvorgänge des Eigentümers — dafür braucht es keine RPC,
-- RLS mit eigenen Policies genügt (Blueprint #142, Entscheid 5).
create policy kzn_lesen    on ki_zugang_namen for select to authenticated using (user_id = auth.uid());
create policy kzn_anlegen  on ki_zugang_namen for insert to authenticated with check (user_id = auth.uid());
create policy kzn_aendern  on ki_zugang_namen for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy kzn_loeschen on ki_zugang_namen for delete to authenticated using (user_id = auth.uid());
-- Die Default-Privileges (Migration 20260614120000) geben neuen Tabellen volles
-- DML auch an `anon`: zurücknehmen, dann nur `authenticated` gezielt zulassen.
revoke all on table ki_zugang_namen from anon;
revoke all on table ki_zugang_namen from authenticated;
grant select, insert, update, delete on table ki_zugang_namen to authenticated;

-- ── Aufruf-Begrenzung je Konto (AK 12, PC 9, NFR 2/3) ───────────────────────
-- Minuten-Fenster; gezählt wird über die letzten 60 Minuten (gleitend). Das
-- Konto, nicht der Zugang, ist die Einheit: weitere Zugänge vervielfachen den
-- Spielraum nicht (NFR 3). Gezählt wird nur `tools/call` — `initialize` und
-- `tools/list` rufen diese Funktion gar nicht erst auf (lib/mcp/werkzeug.ts).
create table ki_aufrufe (
  user_id uuid not null references auth.users(id) on delete cascade,
  fenster timestamptz not null,
  anzahl  integer not null default 0 check (anzahl >= 0),
  primary key (user_id, fenster)
);
alter table ki_aufrufe enable row level security;
-- Bewusst ohne Policy UND ohne Grant: die Tabelle gehört allein der
-- definer-RPC unten (Muster `trainer_suchversuche`, 20260824200312). Sonst
-- könnte ein Zugang seinen eigenen Zähler direkt über PostgREST zurücksetzen.
revoke all on table ki_aufrufe from anon, authenticated;

-- Zählt einen Werkzeug-Aufruf des angemeldeten Kontos — oder weist ihn ab.
-- Antwort: {status:'ok', verbleibend} oder {status:'gebremst', grenze,
-- retry_after} (Sekunden, bis das älteste Fenster aus der Stunde fällt).
create function ki_aufruf_zaehlen() returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  -- TS-Zwilling: KI_AUFRUFE_JE_STUNDE in web/lib/mcp/regeln.ts (check:ki-zugang)
  v_grenze  constant integer := 600;
  v_jetzt   timestamptz := now();
  v_summe   integer;
  v_aeltest timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  -- Je Konto serialisieren, damit die Grenze auch bei parallelen Aufrufen
  -- mehrerer Zugänge exakt hält (sonst lesen zwei Aufrufe dieselbe Summe).
  perform pg_advisory_xact_lock(hashtextextended('ki_aufrufe:' || v_uid::text, 0));
  -- Aufräumen im selben Zug, nur die eigenen, abgelaufenen Fenster: so wächst
  -- die Tabelle je Konto nie über 60 Zeilen (anders als trainer_suchversuche).
  delete from ki_aufrufe where user_id = v_uid and fenster <= v_jetzt - interval '1 hour';

  select coalesce(sum(anzahl), 0), min(fenster) into v_summe, v_aeltest
    from ki_aufrufe where user_id = v_uid;

  if v_summe >= v_grenze then
    -- Abgewiesene Aufrufe zählen nicht mit: wer wartet, kommt nach Ablauf
    -- von retry_after sicher wieder durch.
    return jsonb_build_object(
      'status', 'gebremst',
      'grenze', v_grenze,
      'retry_after', greatest(1, ceil(extract(epoch from (v_aeltest + interval '1 hour' - v_jetzt)))::int));
  end if;

  insert into ki_aufrufe (user_id, fenster, anzahl)
       values (v_uid, date_trunc('minute', v_jetzt), 1)
  on conflict (user_id, fenster) do update set anzahl = ki_aufrufe.anzahl + 1;

  return jsonb_build_object('status', 'ok', 'verbleibend', v_grenze - v_summe - 1);
end;
$$;
revoke all on function ki_aufruf_zaehlen() from public, anon;
grant execute on function ki_aufruf_zaehlen() to authenticated;
