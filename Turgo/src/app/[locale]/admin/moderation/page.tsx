"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Flag,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
} from "lucide-react";

export default function ModerationPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"MODERATION" | "REJECTED" | "ACTIVE">("MODERATION");

  const { data, refetch, isLoading } = trpc.admin.moderationQueue.useQuery({
    status: statusFilter,
    page,
    limit: 20,
  });

  const moderate = trpc.admin.moderateAction.useMutation({
    onSuccess: () => {
      toast.success("Action completed");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Moderation Queue</h1>
        <p className="text-muted-foreground">
          Review and approve or reject listings
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["MODERATION", "REJECTED", "ACTIVE"] as const).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter(s); setPage(1); }}
          >
            {s === "MODERATION" ? "Pending" : s === "REJECTED" ? "Rejected" : "Approved"}
          </Button>
        ))}
        {data && (
          <Badge variant="secondary" className="ml-auto">
            {data.total} total
          </Badge>
        )}
      </div>

      {/* Listings */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No listings in this queue
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.items.map((listing) => (
            <Card key={listing.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {listing.images?.[0] && (
                    <img
                      src={listing.images[0].url}
                      alt=""
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{listing.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {listing.user.name || listing.user.email} &middot;{" "}
                      {(listing.category.name as Record<string, string>).en || listing.category.slug}
                    </p>
                    <p className="text-sm font-medium mt-1">
                      &euro;{listing.price.toFixed(2)}
                    </p>
                    {listing.location && (
                      <p className="text-xs text-muted-foreground">
                        {(listing.location.name as Record<string, string>).en}
                      </p>
                    )}
                  </div>
                </div>

                {statusFilter === "MODERATION" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        moderate.mutate({ listingId: listing.id, action: "APPROVE" })
                      }
                      disabled={moderate.isPending}
                      className="flex-1"
                    >
                      <CheckCircle className="mr-1.5 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        moderate.mutate({
                          listingId: listing.id,
                          action: "REJECT",
                          reason: "Does not meet guidelines",
                        })
                      }
                      disabled={moderate.isPending}
                      className="flex-1"
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        moderate.mutate({
                          listingId: listing.id,
                          action: "FLAG",
                          reason: "Needs further review",
                        })
                      }
                      disabled={moderate.isPending}
                    >
                      <Flag className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
