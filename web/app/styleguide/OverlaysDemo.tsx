"use client";

import { useRef, useState } from "react";
import { Button, Dialog, Snackbar } from "@/components/ui";

export function OverlaysDemo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [fixedSnackOpen, setFixedSnackOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fixedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showSnack() {
    setSnackOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSnackOpen(false), 4000);
  }

  function showFixedSnack() {
    setFixedSnackOpen(true);
    if (fixedTimer.current) clearTimeout(fixedTimer.current);
    fixedTimer.current = setTimeout(() => setFixedSnackOpen(false), 4000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button variant="danger" onClick={() => setDialogOpen(true)}>
          Übung löschen…
        </Button>
        <Button variant="tonal" onClick={showSnack}>
          Snackbar zeigen
        </Button>
        <Button variant="tonal" onClick={showFixedSnack}>
          Snackbar am Rand zeigen
        </Button>
      </div>

      {/* placement="inline" (Voreinstellung): die Meldung hängt dort, wo sie im
          Markup steht. Passt, solange der auslösende Knopf daneben liegt. */}
      <Snackbar
        open={snackOpen}
        message="Übung in den Papierkorb verschoben."
        actionLabel="Rückgängig"
        onAction={() => setSnackOpen(false)}
        onClose={() => setSnackOpen(false)}
      />

      {/* placement="fixed": am unteren Rand des Sichtfelds. Für lange Seiten, auf
          denen die Aktion weit oben oder mitten im Inhalt sitzt — im Fluss stünde
          die Meldung unter allem und niemand sähe sie. */}
      <Snackbar
        open={fixedSnackOpen}
        message="Ein öffentliches Training braucht mindestens eine Übung im freien Spiel."
        onClose={() => setFixedSnackOpen(false)}
        placement="fixed"
      />

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
