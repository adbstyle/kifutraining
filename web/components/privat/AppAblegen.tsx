"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { APP_ABLEGEN_TEXT, APP_ICONS, erkenneGeraet, type Geraet } from "@/lib/app-ablegen";

/* Die Seite des privaten Links als App ablegen (#650, #698).

   Android-Browser melden mit `beforeinstallprompt`, dass sie die Seite selbst
   ablegen können; das Ereignis kommt einmal und früh, darum hört dieses Modul
   schon beim Laden darauf und hält es fest. `preventDefault` unterdrückt die
   eigene Leiste des Browsers — an ihrer Stelle stehen das Angebot und der
   Eintrag in der Glocken-Ansicht. Ohne das Ereignis (Firefox, Samsung
   Internet, iPhone) zeigt die Anleitung den Weg über das Menü bzw. «Teilen».

   Alles hängt am Gerät, darum steht nichts vor dem Einhängen fest: Der Server
   kennt es nicht, das erste HTML bleibt ohne. */

type InstallEreignis = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

let installEreignis: InstallEreignis | null = null;
const hoerer = new Set<() => void>();
const melde = () => hoerer.forEach((f) => f());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEreignis = e as InstallEreignis;
    melde();
  });
  window.addEventListener("appinstalled", () => {
    installEreignis = null;
    melde();
  });
}
const abonniere = (f: () => void) => {
  hoerer.add(f);
  return () => {
    hoerer.delete(f);
  };
};

/** In der abgelegten App: ohne Browser-Leiste. `navigator.standalone` meldet es auf dem iPhone. */
export function istAbgelegt(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export type AblageLage = { geraet: Geraet; abgelegt: boolean };

/** Gerät, Ablage und der Weg zum Ablegen. */
export function useAppAblegen() {
  const [lage, setLage] = useState<AblageLage | null>(null);
  const [anleitung, setAnleitung] = useState(false);
  const installierbar = useSyncExternalStore(
    abonniere,
    () => installEreignis !== null,
    () => false,
  );

  useEffect(() => {
    setLage({ geraet: erkenneGeraet(navigator.userAgent, navigator.maxTouchPoints), abgelegt: istAbgelegt() });
  }, []);

  /** Ablegen: Kann der Browser es selbst, fragt er; sonst die Anleitung. */
  async function ablegen() {
    const e = installEreignis;
    if (!e) return setAnleitung(true);
    // Das Ereignis gilt nur einmal.
    installEreignis = null;
    melde();
    await e.prompt();
    await e.userChoice;
  }

  return {
    /** `null` vor dem Einhängen. */
    lage,
    /** Der Browser kann selbst ablegen (Android, Chrome am Computer). */
    installierbar,
    anleitung,
    oeffneAnleitung: () => setAnleitung(true),
    schliesseAnleitung: () => setAnleitung(false),
    ablegen,
  };
}

/** Die Anleitung: drei Schritte für iPhone bzw. Android, darunter der Name,
 *  unter dem die App erscheint (#650 AK 4). Im Browser einer App nur der Weg
 *  in den Browser. */
export function AppAblegenAnleitung({
  open,
  onClose,
  geraet,
  name,
}: {
  open: boolean;
  onClose: () => void;
  geraet: Geraet;
  /** «Vorname · Verein» */
  name: string;
}) {
  const schritte = geraet.system === "android" ? APP_ABLEGEN_TEXT.android : APP_ABLEGEN_TEXT.ios;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={APP_ABLEGEN_TEXT.anleitungTitel}
      actions={
        <Button variant="outlined" onClick={onClose} autoFocus>
          {APP_ABLEGEN_TEXT.schliessenKnopf}
        </Button>
      }
    >
      {geraet.inApp ? (
        <p>{APP_ABLEGEN_TEXT.inApp}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <ol className="list-decimal space-y-2 pl-5">
            {schritte.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <AppVorschau name={name} />
        </div>
      )}
    </Dialog>
  );
}

/** So erscheint die App auf dem Home-Bildschirm: Symbol und Name. */
function AppVorschau({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span>{APP_ABLEGEN_TEXT.vorschau}</span>
      <div className="kontur flex items-center gap-3 rounded-flaeche border-linie p-3">
        {/* Dasselbe Bild wie im Manifest; schmückend, der Name steht daneben. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={APP_ICONS[0].src} alt="" width={48} height={48} className="size-12 rounded-dialog" />
        <span className="type-title-small text-on-surface">{name}</span>
      </div>
    </div>
  );
}

/** Der Eintrag in der Glocken-Ansicht (#698 AK 7): auf Telefon und Tablet
 *  jederzeit ablegen, auch ohne Mitteilungen. Rein darstellend. */
export function AppAblegenEintrag({ vorname, onAblegen }: { vorname: string; onAblegen: () => void }) {
  return (
    <section aria-label={APP_ABLEGEN_TEXT.eintragTitel} className="flex items-center gap-3 rounded-flaeche bg-elev-01 px-3 py-3">
      <Smartphone size={20} strokeWidth={2} aria-hidden className="shrink-0 text-on-surface-mittel" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="type-title-small text-on-surface">{APP_ABLEGEN_TEXT.eintragTitel}</h3>
        <p className="type-body-small text-on-surface-mittel">{APP_ABLEGEN_TEXT.eintragText(vorname)}</p>
      </div>
      <Button type="button" variant="outlined" onClick={onAblegen}>
        {APP_ABLEGEN_TEXT.ablegen}
      </Button>
    </section>
  );
}
