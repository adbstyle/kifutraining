"use client";

import { Printer } from "lucide-react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

/* Löst den Browser-Druckdialog aus. Domänenfrei: der Trainings-Druck und der
   Druck einer einzelnen Übung nutzen ihn gleichermassen. Der Aufrufer blendet
   ihn im Druck selbst aus.

   Zwei Gestalten, weil die beiden Orte verschieden sind: Eine eigene
   Druckansicht ist nur zum Drucken da — dort trägt der Auslöser eine
   Beschriftung. Auf einer Inhaltsseite ist Drucken dagegen eine Aktion unter
   mehreren und reiht sich als Icon neben Favorisieren und Bearbeiten ein. */
export function PrintButton({
  variant = "label",
  size = "md",
}: {
  variant?: "label" | "icon";
  size?: "sm" | "md";
}) {
  if (variant === "icon") {
    return (
      <IconButton
        icon={Printer}
        label="Drucken"
        size={size}
        onClick={() => window.print()}
      />
    );
  }
  return (
    <Button variant="filled" size="sm" onClick={() => window.print()}>
      <Printer size={18} strokeWidth={2} aria-hidden />
      Drucken / als PDF speichern
    </Button>
  );
}
