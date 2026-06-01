import { kategorien } from "@/lib/vocab";

// Schweizer Juniorenstufen — nur die offiziellen Stufennamen als Tooltip/Hint.
export const kategorieStufe: Record<keyof typeof kategorien, string> = {
  G: "G-Junior:innen",
  F: "F-Junior:innen",
  E: "E-Junior:innen",
};
