"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { IconButton, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { kopiereInBibliothek } from "@/lib/actions/fassung";

/**
 * „In meine Bibliothek kopieren" an einer Übung im Training (Story 7).
 *
 * Es entsteht eine eigene, zunächst private Vorlage — eine Kopie, die mit der
 * Übung im Training nicht verbunden bleibt. Mehrfaches Kopieren ist erlaubt
 * und erzeugt jedes Mal eine weitere Vorlage.
 */
export function InBibliothekButton({
  fassungId,
  name,
}: {
  fassungId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const melde = useSnackbar();

  function kopieren() {
    startTransition(async () => {
      const res = await kopiereInBibliothek(fassungId);
      if (res.ok) {
        melde(`„${name}" ist als private Vorlage in deiner Bibliothek.`);
        router.refresh();
      } else {
        melde(res.error);
      }
    });
  }

  return (
    <Tooltip label="In meine Bibliothek kopieren">
      <IconButton
        icon={Copy}
        label={`${name} in meine Bibliothek kopieren`}
        onClick={kopieren}
        disabled={pending}
      />
    </Tooltip>
  );
}
