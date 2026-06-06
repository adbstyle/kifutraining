-- Attribut „spielform" vollständig entfernen.
-- Best-effort-Feld ohne Constraint/Filter/RPC-Abhängigkeit; der einzige
-- abgeleitete Nutzen (anzahl_kinder aus „N:M") ist längst eigenständig
-- in anzahl_kinder persistiert. Wird daher nicht mehr erhoben noch geführt.
alter table exercises drop column if exists spielform;
