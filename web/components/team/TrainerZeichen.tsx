import { UserPen, UserRoundCheck, UserRoundX, Users } from "lucide-react";
import { SecondaryLozenge, ZeichenZahl } from "@/components/ui";
import { dabeiZahl, istDabei, istEingeladen, ohneVerantwortliche, trainerZahlSatz } from "@/lib/trainer";
import type { TerminZeile } from "@/lib/queries/termine-fuer";

/* Die Trainer:innen eines Termins auf einen Blick (Epic #518, Tafeln
   «Trainingsplan» und «Als Nächstes»): die Zahl «dabei/eingeladen», davor
   der eigene Stand als Zeichen — dabei, abgesagt oder nicht eingeladen. Wer
   verantwortlich ist, steht im Satz dazu (Vorlesehilfe und Überfahren). */
export function TrainerZahl({ t, ich, klein }: { t: TerminZeile; ich: string; klein?: boolean }) {
  const icon = istDabei(t.trainer, ich) ? UserRoundCheck : istEingeladen(t.trainer, ich) ? UserRoundX : Users;
  return (
    <ZeichenZahl icon={icon} label={trainerZahlSatz(t.trainer, ich)} klein={klein}>
      {dabeiZahl(t.trainer)}/{t.trainer.length}
    </ZeichenZahl>
  );
}

/** Die Trainer-Lücke neben dem Status (#519 AK 18): nur das Zeichen in einer
 *  Secondary Lozenge, der Satz für Vorlesehilfe und Überfahren. */
export function TrainerLozenge({ t, heute }: { t: TerminZeile; heute: string }) {
  if (!ohneVerantwortliche(t, heute)) return null;
  return <SecondaryLozenge appearance="warning" iconBefore={UserPen} label="Niemand verantwortlich" />;
}
