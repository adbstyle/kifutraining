// Minimaler Klassen-Joiner (kein clsx/tailwind-merge nötig im MVP).
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
