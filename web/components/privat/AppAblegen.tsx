"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";
import { Button, Dialog, SectionMessage } from "@/components/ui";
import {
  APP_ABLEGEN_SPEICHER,
  APP_ABLEGEN_TEXT,
  APP_ICONS,
  ablageFuer,
  erkenneGeraet,
  mitBesuch,
  mitGeschlossen,
  zeigeHinweis,
  type Geraet,
} from "@/lib/app-ablegen";

/* Die Seite des privaten Links als App ablegen (#650).

   Android-Browser melden mit `beforeinstallprompt`, dass sie die Seite selbst
   ablegen können; das Ereignis kommt einmal und früh, darum hört dieses Modul
   schon beim Laden darauf und hält es fest. `preventDefault` unterdrückt die
   eigene Leiste des Browsers — an ihrer Stelle stehen Hinweis und Knopf. Ohne
   das Ereignis (Firefox, Samsung Internet, iPhone) zeigt die Anleitung den
   Weg über das Menü bzw. «Teilen».

   Alles hängt am Gerät und am lokalen Speicher, darum erscheint nichts vor dem
   Einhängen: Der Server kennt beides nicht, das erste HTML bleibt ohne. */

type InstallEreignis = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

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

/** Lesen und Schreiben im lokalen Speicher; gesperrt (privates Surfen,
 *  Einstellungen) gilt es als leer und bleibt ungeschrieben. */
function liesSpeicher(): string | null {
  try {
    return window.localStorage.getItem(APP_ABLEGEN_SPEICHER);
  } catch {
    return null;
  }
}
function schreibeSpeicher(wert: string) {
  try {
    window.localStorage.setItem(APP_ABLEGEN_SPEICHER, wert);
  } catch {
    // Ohne Speicher zählt dieses Gerät keine Besuche: kein Hinweis, der Knopf bleibt.
  }
}

/** In der abgelegten App (AK 3): ohne Browser-Leiste. `navigator.standalone` meldet es auf dem iPhone. */
function istAbgelegt(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

type Lage = { geraet: Geraet; abgelegt: boolean; hinweis: boolean };

/** Der Zustand für Hinweis und Knopf eines Links; `schluessel` ist das Kürzel
 *  aus `linkSchluessel` (nie der Link selbst). Zählt beim Einhängen den Besuch. */
export function useAppAblegen(schluessel: string) {
  const [lage, setLage] = useState<Lage | null>(null);
  const [anleitung, setAnleitung] = useState(false);
  const installierbar = useSyncExternalStore(
    abonniere,
    () => installEreignis !== null,
    () => false,
  );

  useEffect(() => {
    const geraet = erkenneGeraet(navigator.userAgent, navigator.maxTouchPoints);
    const abgelegt = istAbgelegt();
    const jetzt = Date.now();
    // In der abgelegten App zählt kein Besuch: Dort gibt es nichts mehr abzulegen.
    let wert = liesSpeicher();
    if (!abgelegt) {
      wert = mitBesuch(wert, schluessel, jetzt);
      schreibeSpeicher(wert);
    }
    setLage({ geraet, abgelegt, hinweis: zeigeHinweis({ geraet, standalone: abgelegt, stand: ablageFuer(wert, schluessel), jetzt }) });
  }, [schluessel]);

  /** Der Hinweis ruht 7 Tage (AK 7). */
  function schliessen() {
    schreibeSpeicher(mitGeschlossen(liesSpeicher(), schluessel, Date.now()));
    setLage((l) => l && { ...l, hinweis: false });
  }

  /** Ablegen: Kann der Browser es selbst, fragt er; sonst die Anleitung. */
  async function ablegen() {
    const e = installEreignis;
    if (!e) return setAnleitung(true);
    // Das Ereignis gilt nur einmal.
    installEreignis = null;
    melde();
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === "accepted") schliessen();
  }

  return {
    /** `null` vor dem Einhängen. */
    lage,
    installierbar,
    anleitung,
    oeffneAnleitung: () => setAnleitung(true),
    schliesseAnleitung: () => setAnleitung(false),
    schliessen,
    ablegen,
  };
}

/** Der Hinweis über den Terminen (AK 2, 6–8): schliessbar; im Browser einer App
 *  nur der Weg in den Browser des Mobiles. */
export function AppAblegenHinweis({
  vorname,
  geraet,
  onSchliessen,
  onAktion,
}: {
  vorname: string;
  geraet: Geraet;
  onSchliessen: () => void;
  /** «So geht’s» (iPhone) bzw. «Als App ablegen» (Android). */
  onAktion: () => void;
}) {
  return (
    <SectionMessage
      icon={Smartphone}
      onSchliessen={onSchliessen}
      schliessenLabel={APP_ABLEGEN_TEXT.schliessen}
      actions={
        geraet.inApp ? undefined : (
          <Button type="button" variant="link" onClick={onAktion}>
            {geraet.system === "ios" ? APP_ABLEGEN_TEXT.soGehts : APP_ABLEGEN_TEXT.ablegen}
          </Button>
        )
      }
    >
      <strong className="block font-semibold">{APP_ABLEGEN_TEXT.hinweisTitel(vorname)}</strong>
      {geraet.inApp ? APP_ABLEGEN_TEXT.inApp : APP_ABLEGEN_TEXT.hinweisText(vorname)}
    </SectionMessage>
  );
}

/** Die Anleitung (AK 2, 8): drei Schritte für iPhone bzw. Android, darunter der
 *  Name, unter dem die App erscheint (AK 4). Im Browser einer App nur der Weg
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

/** Der ruhige Knopf unter den Terminen (Secondary, outlined): öffnet die
 *  Anleitung bzw. fragt den Browser, wenn er selbst ablegen kann. */
export function AppAblegenKnopf({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outlined" onClick={onClick} className="self-center">
      <Smartphone size={16} strokeWidth={2} aria-hidden />
      {APP_ABLEGEN_TEXT.knopf}
    </Button>
  );
}
