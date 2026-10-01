import { notFound } from "next/navigation";

/* Unbekannte Adressen fielen sonst auf die Fehlerseite der Wurzel, die keine
   Seitenleiste kennt. Jede bekannte Route ist spezifischer und gewinnt. */
export default function UnbekannteAdresse() {
  notFound();
}
