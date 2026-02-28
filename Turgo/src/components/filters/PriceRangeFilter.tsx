"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PriceRangeFilterProps {
  minPrice?: string;
  maxPrice?: string;
  onApply: (min: string, max: string) => void;
}

/**
 * Controlled by a React `key` prop keyed on `${minPrice}-${maxPrice}`
 * so the component re-mounts when external filter values change,
 * eliminating the need for prevMinPrice/prevMaxPrice sync.
 */
export function PriceRangeFilter({
  minPrice,
  maxPrice,
  onApply,
}: PriceRangeFilterProps) {
  const tb = useTranslations("browse");
  const [min, setMin] = useState(minPrice || "");
  const [max, setMax] = useState(maxPrice || "");

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        placeholder={tb("min")}
        value={min}
        onChange={(e) => setMin(e.target.value)}
        className="h-8 text-sm"
        min={0}
      />
      <span className="text-muted-foreground text-xs">–</span>
      <Input
        type="number"
        placeholder={tb("max")}
        value={max}
        onChange={(e) => setMax(e.target.value)}
        className="h-8 text-sm"
        min={0}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8 shrink-0 px-2 text-xs"
        onClick={() => onApply(min, max)}
      >
        {tb("go")}
      </Button>
    </div>
  );
}
