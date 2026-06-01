"use client";

import { useRef, useState } from "react";
import { Button, Dialog, Snackbar } from "@/components/ui";

export function OverlaysDemo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showSnack() {
    setSnackOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSnackOpen(false), 4000);
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
      </div>

      <Snackbar
        open={snackOpen}
        message="Übung in den Papierkorb verschoben."
        actionLabel="Rückgängig"
        onAction={() => setSnackOpen(false)}
        onClose={() => setSnackOpen(false)}
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
