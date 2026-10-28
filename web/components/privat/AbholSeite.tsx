"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ShieldAlert } from "lucide-react";
import { Button, ButtonLink, KopierFeld, SectionMessage, TextField } from "@/components/ui";
import { holeLinkAbAktion, type AbholAntwort } from "@/lib/actions/abholung";
import { ABHOLUNG_TEXT, ABHOL_SPERRE_MINUTEN, JAHRGANG_STELLEN, LINK_FEHLER, abholErhaltText, nurZiffern } from "@/lib/spieler";
import { GiltNicht } from "./GiltNicht";

const LEER = { vorname: "", nachname: "", jahrgang: "" };

/* Die Abholseite eines Teams (#438 AK 6–16): Eltern geben Vorname, Nachname
   und Jahrgang ein und erhalten den privaten Link der Spieler:in. Was KiFu
   speichert, steht vor dem Abholen (AK 7). Eine nicht passende Eingabe
   antwortet immer gleich (AK 13); nach zu vielen ist die Eingabe eine Weile
   gesperrt (AK 15, 16). Nach dem Erhalt geht es gleich mit der nächsten Spieler:in
   weiter (AK 12). Fürs Handy gebaut. */
export function AbholSeite({ token, team }: { token: string; team: string }) {
  const [form, setForm] = useState(LEER);
  const [zustand, setZustand] = useState<"eingabe" | Exclude<AbholAntwort["status"], "ok">>("eingabe");
  const [erhalt, setErhalt] = useState<{ url: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const erstesFeld = useRef<HTMLInputElement>(null);

  // Nach der Wartezeit lässt die Seite wieder eingeben; läuft die Sperre noch,
  // sagt es der Server beim nächsten Versuch.
  useEffect(() => {
    if (zustand !== "gesperrt") return;
    const t = setTimeout(() => setZustand("eingabe"), ABHOL_SPERRE_MINUTEN * 60_000);
    return () => clearTimeout(t);
  }, [zustand]);

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

  if (zustand === "ungueltig") return <GiltNicht titel={ABHOLUNG_TEXT.ungueltigTitel} text={ABHOLUNG_TEXT.ungueltig} />;

  const gesperrt = zustand === "gesperrt";
  const feld = (k: keyof typeof LEER) => ({
    value: form[k],
    disabled: gesperrt,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: k === "jahrgang" ? nurZiffern(e.target.value) : e.target.value })),
  });

  return (
    <div className="pb-6">
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
            <TextField label="Jahrgang" inputMode="numeric" maxLength={JAHRGANG_STELLEN} autoComplete="off" {...feld("jahrgang")} />
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
    </div>
  );
}

function Erhalt({ url, name, onWeiteres }: { url: string; name: string; onWeiteres: () => void }) {
  const text = abholErhaltText(name);
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="type-body-medium text-on-surface-mittel">{text.wozu}</p>
      <KopierFeld label="Privater Link" value={url} />
      <SectionMessage appearance="warning" icon={ShieldAlert}>
        {text.privat}
      </SectionMessage>
      <div className="mt-2 flex flex-col gap-2">
        <ButtonLink href={url} className="w-full">
          Link öffnen
        </ButtonLink>
        <Button variant="outlined" className="w-full" onClick={onWeiteres}>
          Weitere Spieler:in abholen
        </Button>
      </div>
    </div>
  );
}
