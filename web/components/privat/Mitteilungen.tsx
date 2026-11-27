"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { Button, Dialog, SectionMessage, Switch } from "@/components/ui";
import { pushStandAktion, schaltePushAusAktion, schaltePushEinAktion } from "@/lib/actions/spieler-link";
import { erkenneGeraet } from "@/lib/app-ablegen";
import {
  MITTEILUNGEN_TEXT,
  SERVICE_WORKER_PFAD,
  gleicherSchluessel,
  pushBereich,
  schluesselBytes,
  type MitteilungenStand,
} from "@/lib/push";
import { istAbgelegt } from "./AppAblegen";

/* Mitteilungen aufs Mobile (#483) — die Karte oben in der Glocken-Ansicht des
   privaten Links: Schalter und Zustandszeile (AK 6), auf dem iPhone im
   Safari-Tab der Weg zur abgelegten App (AK 3), abgelehnt der Weg in die
   Einstellungen. Einschalten fragt zuerst im eigenen Dialog, was KiFu
   speichert, wer zustellt und wann es verschwindet (AK 2), erst dann der
   Browser (AK 1). Ausschalten gilt sofort, ohne Rückfrage (AK 7).

   Der Stand hängt am Gerät: Der Service Worker ist je Link registriert
   (Bereich `/abmelden/<link>`, wie das Manifest), seine Anmeldung beim
   Mitteilungsdienst ist das Abo. Den Stand ermittelt die Seite beim
   Einhängen nur am Gerät — er steuert auch das Angebot (#698) —, ob die
   Datenebene das Abo kennt, fragt sie erst, wenn die Glocken-Ansicht offen
   ist (`abgleich`): kein Aufruf des Servers bei jedem Besuch. Alles erst
   nach dem Einhängen: Der Server kennt das Gerät nicht.

   Wird die Erlaubnis nicht erteilt oder schaltet jemand aus, meldet
   `onAbgelehnt` das dem Angebot (#698 AK 2). */

/** Wartet, bis der Service Worker einer Registrierung aktiv ist. */
async function aktiv(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return;
  const sw = reg.installing ?? reg.waiting;
  if (!sw) return;
  await new Promise<void>((fertig) => {
    const pruefe = () => {
      if (sw.state === "activated") {
        sw.removeEventListener("statechange", pruefe);
        fertig();
      }
    };
    sw.addEventListener("statechange", pruefe);
    pruefe();
  });
}

function unterstuetzt(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Die bestehende Anmeldung dieses Geräts für den Link, sonst `null`. */
async function anmeldungFuer(link: string): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(pushBereich(link));
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export type MitteilungenMeldung = { art: "error" | "information"; text: string } | null;

/** Zustand und Handlungen der Karte. `publicKey`: der öffentliche
 *  VAPID-Schlüssel der Umgebung, `null` ohne Mitteilungen. */
export function useMitteilungen({
  link,
  vorname,
  publicKey,
  abgleich,
  onAbgelehnt,
}: {
  link: string;
  vorname: string;
  publicKey: string | null;
  /** Den Stand mit der Datenebene abgleichen (Glocken-Ansicht offen). */
  abgleich: boolean;
  /** Die Erlaubnis wurde nicht erteilt oder die Mitteilungen ausgeschaltet. */
  onAbgelehnt?: () => void;
}) {
  const router = useRouter();
  const [stand, setStand] = useState<MitteilungenStand>("laedt");
  const [dialog, setDialog] = useState(false);
  const [pending, setPending] = useState(false);
  const [meldung, setMeldung] = useState<MitteilungenMeldung>(null);

  const pruefen = useCallback(async (mitServer: boolean) => {
    if (!publicKey) return setStand("nicht_moeglich");
    const geraet = erkenneGeraet(navigator.userAgent, navigator.maxTouchPoints);
    if (geraet.inApp || (!unterstuetzt() && geraet.system !== "ios")) return setStand("nicht_moeglich");
    if (geraet.system === "ios" && !istAbgelegt()) return setStand("ios_browser");
    if (!unterstuetzt()) return setStand("nicht_moeglich");
    if (Notification.permission === "denied") return setStand("abgelehnt");
    try {
      const anmeldung = await anmeldungFuer(link);
      if (!anmeldung) return setStand("aus");
      // Aus einer anderen Umgebung oder mit einem alten Schlüssel: taugt nicht mehr.
      if (!gleicherSchluessel(anmeldung.options.applicationServerKey, publicKey)) {
        await anmeldung.unsubscribe().catch(() => false);
        return setStand("aus");
      }
      if (!mitServer) return setStand("an");
      const r = await pushStandAktion(link, anmeldung.endpoint);
      if (r === "ungueltig") return router.refresh();
      setStand(r === "an" ? "an" : "aus");
    } catch {
      setStand("aus");
    }
  }, [link, publicKey, router]);

  useEffect(() => {
    void pruefen(abgleich);
  }, [pruefen, abgleich]);

  /** Der Schalter: ein öffnet den Dialog, aus schaltet sofort aus. */
  function schalten(an: boolean) {
    setMeldung(null);
    if (an) return setDialog(true);
    void ausschalten();
  }

  async function ausschalten() {
    setPending(true);
    try {
      const anmeldung = await anmeldungFuer(link).catch(() => null);
      // Zuerst bei KiFu, erst danach am Gerät: Meldet sich das Gerät zuerst ab
      // und scheitert KiFu, bleibt ein Abo ohne Gerät stehen und belegt einen
      // der Plätze (PUSH_MAX_GERAETE), ohne dass ein zweiter Versuch mit
      // derselben Adresse möglich wäre. So bleibt der Schalter an und lässt
      // sich noch einmal betätigen.
      if (anmeldung) {
        const r = await schaltePushAusAktion(link, anmeldung.endpoint);
        if (!r.ok && r.ungueltig) return router.refresh();
        if (!r.ok) return setMeldung({ art: "error", text: MITTEILUNGEN_TEXT.fehler });
        await anmeldung.unsubscribe().catch(() => false);
      }
      setStand("aus");
      onAbgelehnt?.();
    } catch (e) {
      console.error("[mitteilungen] ausschalten:", e);
      setMeldung({ art: "error", text: MITTEILUNGEN_TEXT.fehler });
    } finally {
      setPending(false);
    }
  }

  /** «Einschalten» im Dialog: zuerst die Abfrage des Browsers (sie braucht
   *  den Klick), dann Service Worker, Anmeldung und Datenebene.
   *
   *  Scheitert es, meldet sich das Gerät nur ab, wenn die Anmeldung in diesem
   *  Durchgang NEU entstand (`neu`). Eine wiederverwendete kann die
   *  Datenebene schon kennen; sie abzumelden liesse dort ein Abo ohne Gerät
   *  stehen (das Team sähe eine falsche Glocke). Dann prüft die Karte den
   *  Stand neu. */
  async function einschalten() {
    setDialog(false);
    setPending(true);
    let anmeldung: PushSubscription | null = null;
    let neu = false;
    /** Nach einem Fehlschlag: die neue Anmeldung zurücknehmen, sonst den Stand neu prüfen. */
    const zuruecknehmen = async () => {
      if (anmeldung && neu) {
        await anmeldung.unsubscribe().catch(() => false);
        setStand(unterstuetzt() && Notification.permission === "denied" ? "abgelehnt" : "aus");
      } else await pruefen(true);
    };
    try {
      if (!publicKey) return;
      const erlaubnis = await Notification.requestPermission();
      if (erlaubnis !== "granted") {
        onAbgelehnt?.();
        if (erlaubnis === "denied") return setStand("abgelehnt");
        return setMeldung({ art: "information", text: MITTEILUNGEN_TEXT.nichtErlaubt });
      }
      const reg = await navigator.serviceWorker.register(SERVICE_WORKER_PFAD, { scope: pushBereich(link) });
      await aktiv(reg);
      anmeldung = await reg.pushManager.getSubscription();
      if (anmeldung && !gleicherSchluessel(anmeldung.options.applicationServerKey, publicKey)) {
        await anmeldung.unsubscribe().catch(() => false);
        anmeldung = null;
      }
      if (!anmeldung) {
        anmeldung = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(publicKey) });
        neu = true;
      }
      const r = await schaltePushEinAktion(link, anmeldung.toJSON());
      if (r.ok) return setStand("an");
      if (r.ungueltig) return router.refresh();
      // Abgewiesen: Eine neue Anmeldung am Gerät bleibt nicht stehen.
      await zuruecknehmen();
      setMeldung({ art: "error", text: r.grenze ? MITTEILUNGEN_TEXT.grenze(vorname) : r.error });
    } catch (e) {
      console.error("[mitteilungen] einschalten:", e);
      await zuruecknehmen().catch(() => setStand("aus"));
      setMeldung({ art: "error", text: MITTEILUNGEN_TEXT.fehler });
    } finally {
      setPending(false);
    }
  }

  return { stand, dialog, pending, meldung, schalten, einschalten, schliesseDialog: () => setDialog(false) };
}

/** Die Karte (AK 3, 6, 7): Schalter, Zustandszeile und je nach Lage ein
 *  Hinweis. Rein darstellend — der Styleguide zeigt sie in jedem Stand. */
export function MitteilungenKarte({
  vorname,
  stand,
  pending = false,
  meldung = null,
  onSchalten,
  onSoGehts,
}: {
  vorname: string;
  stand: MitteilungenStand;
  pending?: boolean;
  meldung?: MitteilungenMeldung;
  onSchalten: (an: boolean) => void;
  /** iPhone im Safari-Tab: öffnet die Anleitung zum Ablegen. */
  onSoGehts?: () => void;
}) {
  const zeile = useId();
  const schaltbar = stand === "an" || stand === "aus";
  return (
    <section aria-labelledby={`${zeile}-titel`} className="flex flex-col gap-3 rounded-flaeche bg-elev-01 px-3 py-3">
      <div className="flex items-start gap-3">
        <BellRing size={20} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-on-surface-mittel" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 id={`${zeile}-titel`} className="type-title-small text-on-surface">
            {MITTEILUNGEN_TEXT.titel}
          </h3>
          <p id={zeile} className="type-body-small text-on-surface-mittel" aria-live="polite">
            {MITTEILUNGEN_TEXT.stand[stand]}
          </p>
        </div>
        <Switch
          checked={stand === "an"}
          disabled={!schaltbar || pending}
          onChange={(e) => onSchalten(e.target.checked)}
          aria-label={MITTEILUNGEN_TEXT.schalter(vorname)}
          aria-describedby={zeile}
        />
      </div>
      {stand === "ios_browser" && (
        <SectionMessage
          actions={
            onSoGehts && (
              <Button type="button" variant="link" onClick={onSoGehts}>
                {MITTEILUNGEN_TEXT.soGehts}
              </Button>
            )
          }
        >
          {MITTEILUNGEN_TEXT.iosHinweis(vorname)}
        </SectionMessage>
      )}
      {stand === "abgelehnt" && <SectionMessage>{MITTEILUNGEN_TEXT.abgelehntHinweis}</SectionMessage>}
      {meldung && <SectionMessage appearance={meldung.art}>{meldung.text}</SectionMessage>}
    </section>
  );
}

/** Vor dem Einschalten (AK 2): was KiFu speichert, wer zustellt, wann es
 *  verschwindet. «Einschalten» führt zur Abfrage des Browsers. */
export function MitteilungenDialog({
  open,
  vorname,
  onAbbrechen,
  onEinschalten,
}: {
  open: boolean;
  vorname: string;
  onAbbrechen: () => void;
  onEinschalten: () => void;
}) {
  const abschnitt = (titel: string, text: string) => (
    <div className="flex flex-col gap-1">
      <h3 className="type-title-small text-on-surface">{titel}</h3>
      <p>{text}</p>
    </div>
  );
  return (
    <Dialog
      open={open}
      onClose={onAbbrechen}
      title={MITTEILUNGEN_TEXT.dialogTitel(vorname)}
      actions={
        <>
          <Button variant="outlined" onClick={onAbbrechen}>
            {MITTEILUNGEN_TEXT.abbrechen}
          </Button>
          <Button variant="filled" onClick={onEinschalten}>
            {MITTEILUNGEN_TEXT.einschalten}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>{MITTEILUNGEN_TEXT.dialogEinleitung(vorname)}</p>
        {abschnitt(MITTEILUNGEN_TEXT.speichertTitel, MITTEILUNGEN_TEXT.speichert)}
        {abschnitt(MITTEILUNGEN_TEXT.zustellerTitel, MITTEILUNGEN_TEXT.zusteller)}
        {abschnitt(MITTEILUNGEN_TEXT.verschwindetTitel, MITTEILUNGEN_TEXT.verschwindet(vorname))}
      </div>
    </Dialog>
  );
}
