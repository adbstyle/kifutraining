"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/* Löst den Browser-Druckdialog aus (Story #18 AC2: Drucken bzw. als PDF
   speichern). Im Druck selbst ausgeblendet. */
export function PrintButton() {
  return (
    <Button variant="filled" size="sm" onClick={() => window.print()}>
      <Printer size={18} strokeWidth={2} aria-hidden />
      Drucken / als PDF speichern
    </Button>
  );
}
