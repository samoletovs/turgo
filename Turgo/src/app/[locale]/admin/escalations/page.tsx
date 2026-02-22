"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Bot,
  Shield,
  MessageSquare,
  Cpu,
} from "lucide-react";

export default function EscalationsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "IN_REVIEW" | "RESOLVED" | "DISMISSED" | undefined>("PENDING");
  const [sourceFilter, setSourceFilter] = useState<"SELLING_AGENT" | "BUYING_AGENT" | "CONCIERGE" | "AUTO_MODERATION" | undefined>();
  const [resolveNote, setResolveNote] = useState("");

  const { data, refetch, isLoading } = trpc.admin.escalations.useQuery({
    status: statusFilter,
    source: sourceFilter,
    page,
    limit: 20,
  });

  const resolveMutation = trpc.admin.resolveEscalation.useMutation({
    onSuccess: () => { toast.success("Escalation resolved"); setResolveNote(""); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const sourceIcons: Record<string, typeof Bot> = {
    SELLING_AGENT: Bot,
    BUYING_AGENT: Bot,
    CONCIERGE: MessageSquare,
    AUTO_MODERATION: Shield,
  };

  const sourceColors: Record<string, string> = {
    SELLING_AGENT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    BUYING_AGENT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    CONCIERGE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    AUTO_MODERATION: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "success" | "outline"> = {
    PENDING: "destructive",
    IN_REVIEW: "default",
    RESOLVED: "success",
    DISMISSED: "secondary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Escalation Queue</h1>
        <p className="text-muted-foreground">
          Agent-flagged items that need human review
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {(["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s.replace("_", " ")}
            </Button>
          ))}
          <Button
            variant={!statusFilter ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter(undefined); setPage(1); }}
          >
            All
          </Button>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex gap-1">
          {(["SELLING_AGENT", "BUYING_AGENT", "CONCIERGE", "AUTO_MODERATION"] as const).map((s) => (
            <Button
              key={s}
              variant={sourceFilter === s ? "secondary" : "ghost"}
              size="sm"
              onClick={() => { setSourceFilter(sourceFilter === s ? undefined : s); setPage(1); }}
            >
              {s.replace("_", " ")}
            </Button>
          ))}
        </div>
        {data && <Badge variant="secondary" className="ml-auto">{data.total} total</Badge>}
      </div>

      {/* Escalation List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="animate-pulse space-y-3"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-1/2" /></div></CardContent></Card>
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>No escalations found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.items.map((item) => {
            const SourceIcon = sourceIcons[item.source] || Cpu;
            return (
              <Card key={item.id} className={item.status === "PENDING" ? "border-l-4 border-l-amber-500" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-lg p-2 ${sourceColors[item.source] || "bg-muted"}`}>
                      <SourceIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{item.title}</h3>
                        <Badge variant={statusColors[item.status]}>{item.status.replace("_", " ")}</Badge>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sourceColors[item.source]}`}>
                          {item.source.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Created {new Date(item.createdAt).toLocaleString()}
                        {item.assignedTo && ` — Assigned to ${item.assignedTo}`}
                        {item.resolvedNote && ` — Note: ${item.resolvedNote}`}
                      </p>
                    </div>

                    {(item.status === "PENDING" || item.status === "IN_REVIEW") && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() =>
                              resolveMutation.mutate({
                                id: item.id,
                                action: "RESOLVED",
                                note: resolveNote || undefined,
                              })
                            }
                            disabled={resolveMutation.isPending}
                          >
                            <CheckCircle className="mr-1 h-3.5 w-3.5" /> Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              resolveMutation.mutate({
                                id: item.id,
                                action: "DISMISSED",
                                note: resolveNote || undefined,
                              })
                            }
                            disabled={resolveMutation.isPending}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" /> Dismiss
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
