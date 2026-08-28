"use client";

import { Printer } from "lucide-react";
import { Button } from "./Button";

/* Löst den Browser-Druckdialog aus. Domänenfrei: der Trainings-Druck und der
   Druck einer einzelnen Übung nutzen ihn gleichermassen. Der Aufrufer blendet
   ihn im Druck selbst aus. */
export function PrintButton() {
  return (
    <Button variant="filled" size="sm" onClick={() => window.print()}>
      <Printer size={18} strokeWidth={2} aria-hidden />
      Drucken / als PDF speichern
    </Button>
  );
}
