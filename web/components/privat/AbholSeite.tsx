"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, Link2Off, ShieldAlert } from "lucide-react";
import { Button, ButtonLink, IconButton, SectionMessage, TextField } from "@/components/ui";
import { holeLinkAbAktion } from "@/lib/actions/abholung";
import { ABHOLUNG_TEXT, LINK_FEHLER, abholErhaltText } from "@/lib/spieler";

const KOPIERT_MS = 2500;
const LEER = { vorname: "", nachname: "", jahrgang: "" };

/* Die Abholseite eines Teams (#438 AK 6–16): Eltern geben Vorname, Nachname
   und Jahrgang ein und erhalten den privaten Link ihres Kindes. Was KiFu
   speichert, steht vor dem Abholen (AK 7). Eine nicht passende Eingabe
   antwortet immer gleich (AK 13); nach zu vielen ist die Eingabe eine Weile
   gesperrt (AK 15, 16). Nach dem Erhalt geht es gleich mit dem nächsten Kind
   weiter (AK 12). Fürs Handy gebaut. */
export function AbholSeite({ token, team }: { token: string; team: string }) {
  const [form, setForm] = useState(LEER);
  const [zustand, setZustand] = useState<"eingabe" | "passt_nicht" | "gesperrt" | "fehlt" | "fehler" | "ungueltig">("eingabe");
  const [erhalt, setErhalt] = useState<{ url: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const erstesFeld = useRef<HTMLInputElement>(null);

  function abholen() {
    if (pending || zustand === "gesperrt") return;
    startTransition(async () => {
      const r = await holeLinkAbAktion(token, form);
      if (r.status === "ok") {
        setErhalt({ url: r.url, name: r.name });
        setZustand("eingabe");
        return;
      }
      setZustand(r.status);
    });
  }

  function weiteres() {
    setErhalt(null);
    setForm(LEER);
    setZustand("eingabe");
    requestAnimationFrame(() => erstesFeld.current?.focus());
  }

  if (zustand === "ungueltig") return <AbholungGiltNicht />;

  const gesperrt = zustand === "gesperrt";
  const feld = (k: keyof typeof LEER) => ({
    value: form[k],
    disabled: gesperrt,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: k === "jahrgang" ? e.target.value.replace(/\D/g, "") : e.target.value })),
  });

  return (
    <>
      <header className="flex flex-col gap-0.5 border-b border-linie px-4 pb-4 pt-6">
        <p className="type-body-small text-on-surface-mittel">{team}</p>
        <h1 className="type-headline-small text-on-surface">{erhalt ? `Link für ${erhalt.name}` : ABHOLUNG_TEXT.titel}</h1>
      </header>
      {erhalt ? (
        <Erhalt url={erhalt.url} name={erhalt.name} onWeiteres={weiteres} />
      ) : (
        <form
          className="flex flex-col gap-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            abholen();
          }}
        >
          <p className="type-body-medium text-on-surface-mittel">{ABHOLUNG_TEXT.einleitung}</p>
          <div className="flex flex-col gap-3">
            <TextField ref={erstesFeld} label="Vorname" autoComplete="off" autoFocus {...feld("vorname")} />
            <TextField label="Nachname" autoComplete="off" {...feld("nachname")} />
            <TextField label="Jahrgang" inputMode="numeric" maxLength={4} autoComplete="off" {...feld("jahrgang")} />
          </div>
          {zustand === "passt_nicht" && <SectionMessage appearance="error">{ABHOLUNG_TEXT.passtNicht}</SectionMessage>}
          {zustand === "fehlt" && <SectionMessage appearance="error">{ABHOLUNG_TEXT.fehlt}</SectionMessage>}
          {zustand === "fehler" && <SectionMessage appearance="error">{LINK_FEHLER}</SectionMessage>}
          {gesperrt && (
            <SectionMessage appearance="warning" role="alert">
              <strong className="block font-semibold">{ABHOLUNG_TEXT.gesperrtTitel}</strong>
              {ABHOLUNG_TEXT.gesperrt}
            </SectionMessage>
          )}
          <Button type="submit" className="w-full" disabled={pending || gesperrt}>
            Link abholen
          </Button>
          <SectionMessage>
            <strong className="block font-semibold">{ABHOLUNG_TEXT.speichertTitel}</strong>
            {ABHOLUNG_TEXT.speichert}
          </SectionMessage>
        </form>
      )}
    </>
  );
}

function Erhalt({ url, name, onWeiteres }: { url: string; name: string; onWeiteres: () => void }) {
  const feld = useRef<HTMLInputElement>(null);
  const [kopiert, setKopiert] = useState(false);
  const [fehler, setFehler] = useState(false);
  const text = abholErhaltText(name);

  useEffect(() => {
    if (!kopiert) return;
    const t = setTimeout(() => setKopiert(false), KOPIERT_MS);
    return () => clearTimeout(t);
  }, [kopiert]);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(url);
      setFehler(false);
      setKopiert(true);
    } catch {
      setFehler(true);
      feld.current?.focus();
      feld.current?.select();
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="type-body-medium text-on-surface-mittel">{text.wozu}</p>
      {fehler && <SectionMessage appearance="error">Kopieren ging nicht - markiere den Link und kopiere ihn von Hand.</SectionMessage>}
      <div className="flex items-center gap-1">
        <TextField
          ref={feld}
          className="min-w-0 flex-1"
          label="Privater Link"
          value={url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <IconButton icon={kopiert ? Check : Copy} label="Link kopieren" onClick={kopieren} />
        <span className="sr-only" role="status">
          {kopiert ? "Link kopiert." : ""}
        </span>
      </div>
      <SectionMessage appearance="warning" icon={ShieldAlert}>
        {text.privat}
      </SectionMessage>
      <div className="mt-2 flex flex-col gap-2">
        <ButtonLink href={url} className="w-full">
          Link öffnen
        </ButtonLink>
        <Button variant="outlined" className="w-full" onClick={onWeiteres}>
          Weiteres Kind abholen
        </Button>
      </div>
    </div>
  );
}

/* Ausgeschaltet, erneuert oder nie vergeben — alle gleich (AK 17, 18). */
export function AbholungGiltNicht() {
  return (
    <div className="flex min-h-[70vh] flex-col justify-center gap-4 px-6 py-8">
      <Link2Off size={48} strokeWidth={1.6} className="text-on-surface-mittel" aria-hidden />
      <h1 className="type-headline-small text-on-surface">{ABHOLUNG_TEXT.ungueltigTitel}</h1>
      <p className="type-body-large text-on-surface-mittel">{ABHOLUNG_TEXT.ungueltig}</p>
    </div>
  );
}
