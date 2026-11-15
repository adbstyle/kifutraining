"use client";

import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { IconButton, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { useBestandStufe } from "@/components/konto/BestandStufe";
import { kopiereInBibliothek } from "@/lib/actions/fassung";

/**
 * „In meine Bibliothek kopieren" an einer Übung im Training (Story 7).
 *
 * Breit steht es im Detail der geöffneten Übung und nicht an der Zeile
 * (PO 2026-10-05), wie das Bearbeiten: Übernommen wird, was man gesehen hat —
 * nicht blind nach Name und Bild. Schmal, wo es keine Spalte gibt, bleibt es an der Zeile
 * (`className="xl:hidden"`).
 *
 * Es entsteht eine eigene, zunächst private Vorlage — eine Kopie, die mit der
 * Übung im Training nicht verbunden bleibt. Mehrfaches Kopieren ist erlaubt
 * und erzeugt jedes Mal eine weitere Vorlage.
 */
export function InBibliothekButton({
  fassungId,
  name,
  className,
}: {
  fassungId: string;
  name: string;
  className?: string;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  // Für ein Konto ohne Verein erst der frisch gelesene Stand (#588); sonst wie bisher ein Klick.
  const { starte, laeuft, dialog } = useBestandStufe({
    art: "uebungen",
    titel: "In meine Bibliothek kopieren",
    aktion: "Kopieren",
    hinweis: "Die Übung kommt als private Vorlage in deine Bibliothek.",
    ausfuehren: async () => {
      const res = await kopiereInBibliothek(fassungId);
      if (!res.ok) return res.error;
      melde(`„${name}" ist als private Vorlage in deiner Bibliothek.`);
      router.refresh();
      return null;
    },
  });

  return (
    <>
      <Tooltip label="In meine Bibliothek kopieren" className={className}>
        <IconButton
          icon={Copy}
          label={`${name} in meine Bibliothek kopieren`}
          onClick={starte}
          disabled={laeuft}
        />
      </Tooltip>
      {dialog}
    </>
  );
}
