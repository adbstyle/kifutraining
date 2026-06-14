-- Epic #58 / Spike #59: Diagramme wiederverwenden.
--
-- KiFu-Manual-Übungen sollen eine kleine Auswahl gezeichneter Diagramme als
-- Vorlage und aktives Anzeige-Bild tragen (Epic #58 hebt Epic #47 Out-of-Scope 1
-- für diese Auswahl auf). Der CHECK `manual_ohne_diagramm` verbietet das heute
-- kategorisch und wird ersatzlos entfernt.
--
-- Read-only der Manual-Übungen bleibt unangetastet: die RLS-Policies
-- ex_update/ex_delete verlangen weiterhin source = 'user'. Manual-Diagramme
-- entstehen ausschliesslich über den Seed (Service-Role). Loosening eines
-- CHECKs, daher ohne NOT VALID/Backfill sicher.
alter table public.exercises
  drop constraint manual_ohne_diagramm;

comment on column public.exercises.diagramm is
  'Element-genau editierbares Spielfeld-Diagramm (Epic #47); auf User-Übungen vom Trainer gezeichnet, auf KiFu-Manual-Übungen als Vorlage geseedet (Epic #58).';
