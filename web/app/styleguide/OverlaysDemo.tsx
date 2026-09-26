"use client";

import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";

export function OverlaysDemo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const melde = useSnackbar();
  // Zwei Stellen, nicht eine: Meldet dieselbe Stelle zweimal, ersetzt die
  // zweite Meldung die erste — anstehen sieht man nur, wenn zwei melden.
  const meldeAndere = useSnackbar();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button variant="danger" onClick={() => setDialogOpen(true)}>
          Übung löschen…
        </Button>
        {/* Mit Aktion: Material erlaubt genau eine, etwa Rückgängig oder
            Erneut versuchen — nie ein blosses «OK», dafür gibt es das X. */}
        <Button
          variant="tonal"
          onClick={() =>
            melde("Übung in den Papierkorb verschoben.", {
              label: "Rückgängig",
              onAction: () => melde("Übung wiederhergestellt."),
            })
          }
        >
          Snackbar zeigen
        </Button>
        {/* Zwei Stellen auf einmal: Die zweite wartet, bis die erste weg ist,
            und ihre Zeit läuft erst ab dann. */}
        <Button
          variant="tonal"
          onClick={() => {
            melde("Termin geändert.");
            meldeAndere("Ein öffentliches Training braucht mindestens eine Übung im freien Spiel.");
          }}
        >
          Zwei nacheinander
        </Button>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Übung löschen?"
        actions={
          <>
            <Button variant="text" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={() => setDialogOpen(false)}>
              Löschen
            </Button>
          </>
        }
      >
        Diese Übung wird dauerhaft entfernt. Das kann nicht rückgängig gemacht
        werden.
      </Dialog>
    </div>
  );
}
