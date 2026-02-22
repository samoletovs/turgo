"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useTranslations } from "next-intl";

interface AgentStatusButtonProps {
  agentId: string;
  initialStatus: string;
}

export function AgentStatusButton({
  agentId,
  initialStatus,
}: AgentStatusButtonProps) {
  const [status, setStatus] = useState(initialStatus);
  const t = useTranslations("agent");

  const updateStatus = trpc.agent.updateStatus.useMutation({
    onMutate: () => {
      // Optimistic update
      setStatus((prev) => (prev === "ACTIVE" ? "PAUSED" : "ACTIVE"));
    },
    onError: () => {
      // Revert on error
      setStatus(initialStatus);
    },
  });

  const handleToggle = () => {
    const newStatus = status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    updateStatus.mutate({ agentId, status: newStatus });
  };

  return (
    <Button
      variant={status === "ACTIVE" ? "secondary" : "default"}
      size="sm"
      onClick={handleToggle}
      disabled={updateStatus.isPending}
    >
      {status === "ACTIVE" ? (
        <>
          <Pause className="mr-1 h-3 w-3" /> {t("pause")}
        </>
      ) : (
        <>
          <Play className="mr-1 h-3 w-3" /> {t("resume")}
        </>
      )}
    </Button>
  );
}
