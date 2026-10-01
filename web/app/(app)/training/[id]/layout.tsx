import { getTrainingNavKontext } from "@/lib/queries/trainings";
import { TeamBereichMelder } from "@/components/layout/TeamKontext";

/* Alles unter `/training/[id]` — Ansicht, Editor, Durchführen, Druck, Fassung,
   Feld-Diagramm — meldet der Hauptnavigation, ob dieses Training einem Team
   gehört (#156). Hier statt in den sechs Seiten, weil es an der Adresse hängt
   und nicht daran, was die einzelne Seite zeigt.

   Warum überhaupt, obwohl `AppNav` dasselbe serverseitig nachschlägt: Das
   Root-Layout mit der Navigation wird bei einer Client-Navigation nicht neu
   gerendert, dieses Layout schon. Die Begründung steht bei `TeamKontext`.

   Angemeldet kostet das keine zusätzliche Abfrage: `getTrainingNavKontext` ist
   `cache()`-gebunden und `AppNav` fragt beim harten Laden dieselbe Adresse ab.
   Ohne Konto fragt `AppNav` gar nicht — dann ist es die eine schmale Abfrage
   hier, und die RLS liefert für ein Team-Training ohnehin `null`. */
export default async function TrainingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kontext = await getTrainingNavKontext(id);
  return (
    <>
      <TeamBereichMelder imTeamBereich={!!kontext?.team} />
      {children}
    </>
  );
}
