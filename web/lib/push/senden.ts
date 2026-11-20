import "server-only";
import webpush from "web-push";
import { PUSH_TIMEOUT_MS, PUSH_TTL_SEKUNDEN, type Mitteilung } from "@/lib/push";
import type { PushSender } from "@/lib/kern/push";

/* Der echte Sender (#483) mit web-push: Die Mitteilung geht nach RFC 8291
   verschlüsselt an den Mitteilungsdienst des Geräts — er sieht weder Text
   noch Link. TTL 24 h (danach verwirft der Dienst sie), Dringlichkeit normal,
   je Gerät höchstens 5 s Wartezeit. Der Fachkern (`arbeitePushAb`) bekommt
   ihn eingesetzt; die Prüfung check:kern-db setzt einen Stub ein. */
export function webPushSender(vapid: { publicKey: string; privateKey: string; subject: string }): PushSender {
  return async (abo, mitteilung: Mitteilung) => {
    try {
      const r = await webpush.sendNotification(
        { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
        JSON.stringify(mitteilung),
        {
          TTL: PUSH_TTL_SEKUNDEN,
          urgency: "normal",
          timeout: PUSH_TIMEOUT_MS,
          vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        },
      );
      return r.statusCode;
    } catch (e) {
      // WebPushError trägt den Status des Diensts; Netz- und Zeitfehler keinen.
      const status = (e as { statusCode?: unknown }).statusCode;
      return typeof status === "number" ? status : null;
    }
  };
}
