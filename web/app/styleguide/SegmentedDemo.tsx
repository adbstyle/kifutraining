"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui";
import { trainingsteil } from "@/lib/vocab";
import type { TrainingsteilSlug } from "@/lib/vocab";

const teilOptions = (
  Object.entries(trainingsteil) as [TrainingsteilSlug, string][]
).map(([value, label]) => ({ value, label }));

/* Zeigt die SegmentedControl als Baustein (Einfachauswahl, tab-artig). */
export function SegmentedDemo() {
  const [teil, setTeil] = useState<TrainingsteilSlug>("hauptteil");
  return (
    <SegmentedControl
      ariaLabel="Trainingsteil"
      options={teilOptions}
      value={teil}
      onChange={setTeil}
    />
  );
}
