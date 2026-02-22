"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AgentStatus =
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "NEEDS_ATTENTION";

interface AgentStatusBadgeProps {
  status: AgentStatus;
  className?: string;
}

const statusConfig: Record<
  AgentStatus,
  {
    variant: "default" | "secondary" | "destructive" | "outline" | "success";
    classes: string;
  }
> = {
  ACTIVE: {
    variant: "success",
    classes:
      "animate-pulse bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  },
  PAUSED: {
    variant: "secondary",
    classes:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  },
  COMPLETED: {
    variant: "default",
    classes: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  },
  CANCELLED: {
    variant: "outline",
    classes: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  NEEDS_ATTENTION: {
    variant: "destructive",
    classes:
      "animate-pulse bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  },
};

export function AgentStatusBadge({ status, className }: AgentStatusBadgeProps) {
  const t = useTranslations("agent.statuses");

  const config = statusConfig[status];
  const label =
    status === "NEEDS_ATTENTION"
      ? "Attention"
      : t(status as "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED");

  return (
    <Badge variant={config.variant} className={cn(config.classes, className)}>
      <span
        className={cn(
          "mr-1.5 inline-block h-2 w-2 rounded-full",
          status === "ACTIVE" && "bg-green-500 dark:bg-green-400",
          status === "PAUSED" && "bg-yellow-500 dark:bg-yellow-400",
          status === "COMPLETED" && "bg-blue-500 dark:bg-blue-400",
          status === "CANCELLED" && "bg-gray-400 dark:bg-gray-500",
          status === "NEEDS_ATTENTION" && "bg-red-500 dark:bg-red-400",
        )}
      />
      {label}
    </Badge>
  );
}
