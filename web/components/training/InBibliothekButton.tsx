"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Tooltip } from "@/components/ui";
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
      <button
        type="button"
        aria-label={`${name} in meine Bibliothek kopieren`}
        onClick={kopieren}
        disabled={pending}
        className="state focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-mittel disabled:opacity-40"
      >
        <Copy size={16} strokeWidth={2.5} aria-hidden />
      </button>
    </Tooltip>
  );
}
