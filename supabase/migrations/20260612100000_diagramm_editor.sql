-- Epic #47 / Spike #48: Diagramm-Editor — strukturierte Diagramm-Persistenz.
--
-- `diagramm` hält die element-genau editierbare Struktur (Decision Record
-- docs/superpowers/specs/2026-06-12-diagramm-editor-spike.md, Gate 1).
-- `bild_quelle` bestimmt das aktive Anzeige-Bild, wenn Foto UND Diagramm
-- existieren (#56). `bild_url` bleibt ausschliesslich der Foto-Pfad.

alter table public.exercises
  add column diagramm jsonb,
  add column bild_quelle text check (bild_quelle in ('foto', 'diagramm'));

-- Manual-Übungen sind read-only und behalten ihr statisches Original-Bild
-- (Epic #47 Out of Scope 1): sie tragen nie ein Editor-Diagramm.
alter table public.exercises
  add constraint manual_ohne_diagramm
    check (source <> 'manual' or (diagramm is null and bild_quelle is null));

comment on column public.exercises.diagramm is
  'Element-genau editierbares Spielfeld-Diagramm (Epic #47); Struktur siehe Decision Record Spike #48.';
comment on column public.exercises.bild_quelle is
  'Aktives Anzeige-Bild bei parallelem Foto+Diagramm: foto|diagramm; null = Diagramm bevorzugt, sonst Foto.';
