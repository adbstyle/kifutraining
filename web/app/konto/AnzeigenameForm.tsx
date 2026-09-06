"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, TextField, Snackbar } from "@/components/ui";
import { setzeAnzeigename } from "@/lib/actions/profil";

/* Anzeigenamen setzen oder ändern (Team-Epic Story 2). Der Name ist die
   einzige Personenangabe, die andere zu sehen bekommen — der Hinweis darunter
   sagt das ausdrücklich, weil er auch an öffentlichen Vorlagen steht. */
export function AnzeigenameForm({
  aktuell,
  /** Selbst gewählt oder noch der automatisch vergebene? */
  eigen,
}: {
  aktuell: string;
  eigen: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [wert, setWert] = useState(eigen ? aktuell : "");
  const [fehler, setFehler] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);

  function speichern() {
    setFehler(undefined);
    startTransition(async () => {
      const res = await setzeAnzeigename(wert);
      if (res.ok) {
        setWert(res.anzeigeName);
        setNotice("Anzeigename gespeichert.");
        router.refresh();
      } else {
        setFehler(res.error);
      }
    });
  }

  return (
    <>
      <p className="type-body-medium text-on-surface-variant">
        {eigen ? (
          // Ohne Satzzeichen nach dem Namen: er darf selbst auf einen Punkt
          // enden («Sina M.») und ergäbe sonst zwei.
          <>
            Dein Anzeigename: <strong className="text-on-surface">{aktuell}</strong>
          </>
        ) : (
          <>
            Du hast noch keinen Anzeigenamen gewählt. Bis dahin erscheinst du als{" "}
            <strong className="text-on-surface">{aktuell}</strong>
          </>
        )}
      </p>
      <p className="type-body-small mt-1 text-on-surface-variant">
        Für Team-Mitglieder und an deinen veröffentlichten Vorlagen öffentlich
        sichtbar. Deine E-Mail-Adresse sieht niemand.
      </p>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          speichern();
        }}
      >
        <TextField
          label="Anzeigename"
          className="flex-1"
          value={wert}
          maxLength={40}
          onChange={(e) => setWert(e.target.value)}
          error={!!fehler}
          supportingText={fehler}
        />
        <Button type="submit" variant="tonal" disabled={pending} className="sm:mt-1.5">
          <Check size={18} strokeWidth={2} aria-hidden />
          Speichern
        </Button>
      </form>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
