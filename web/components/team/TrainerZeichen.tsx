import { UserPen, UserRoundCheck, UserRoundX, Users } from "lucide-react";
import { fehlenText } from "@/lib/besetzung";
import { SecondaryLozenge, ZeichenZahl } from "@/components/ui";
import { dabeiZahl, eingeladenZahl, istDabei, istEingeladen, noetigeVon, trainerLuecke, trainerZahlSatz } from "@/lib/trainer";
import type { TerminZeile } from "@/lib/queries/termine-fuer";

/* Die Trainer:innen eines Termins auf einen Blick (Epic #518, Tafeln
   «Trainingsplan» und «Als Nächstes»): die Zahl «dabei/eingeladen», davor
   der eigene Stand als Zeichen — dabei, abgesagt oder nicht eingeladen. Wer
   verantwortlich ist, steht im Satz dazu (Vorlesehilfe und Überfahren). */
export function TrainerZahl({ t, ich, klein }: { t: TerminZeile; ich: string; klein?: boolean }) {
  const icon = istDabei(t.trainer, ich) ? UserRoundCheck : istEingeladen(t.trainer, ich) ? UserRoundX : Users;
  return (
    <ZeichenZahl icon={icon} label={trainerZahlSatz(t.trainer, ich, noetigeVon(t))} klein={klein}>
      {dabeiZahl(t.trainer)}/{eingeladenZahl(t.trainer)}
    </ZeichenZahl>
  );
}

/** Die Trainer-Lücke neben dem Status (#519 AK 18, #521 AK 8, 16): nur das
 *  Zeichen in einer Secondary Lozenge, der Satz für Vorlesehilfe und
 *  Überfahren. Zu wenige dabei rot, niemand verantwortlich gelb; fehlt
 *  beides, nur rot. */
export function TrainerLozenge({ t, heute }: { t: TerminZeile; heute: string }) {
  const luecke = trainerLuecke(t, heute);
  if (!luecke) return null;
  return luecke.art === "zuWenig" ? (
    <SecondaryLozenge appearance="danger" iconBefore={Users} label={fehlenText(luecke.fehlen)} />
  ) : (
    <SecondaryLozenge appearance="warning" iconBefore={UserPen} label="Niemand verantwortlich" />
  );
}
