"use client";

import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MobileFilterTriggerProps {
  activeCount: number;
  onClick: () => void;
}

export function MobileFilterTrigger({
  activeCount,
  onClick,
}: MobileFilterTriggerProps) {
  const tb = useTranslations("browse");
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 lg:hidden"
      onClick={onClick}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      {tb("filters")}
      {activeCount > 0 && (
        <Badge variant="default" className="text-[10px] px-1 ml-1">
          {activeCount}
        </Badge>
      )}
    </Button>
  );
}
