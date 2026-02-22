"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Search,
  Bell,
  BellOff,
  Trash2,
  ExternalLink,
  Loader2,
  BookmarkX,
  Clock,
  Filter,
  Pencil,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRelativeTime } from "@/lib/utils";

interface SavedSearchesClientProps {
  locale: string;
}

export function SavedSearchesClient({ locale }: SavedSearchesClientProps) {
  const t = useTranslations("savedSearches");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const {
    data: searches,
    isLoading,
    refetch,
  } = trpc.search.mySavedSearches.useQuery();
  const deleteMutation = trpc.search.deleteSavedSearch.useMutation({
    onSuccess: () => {
      setDeleteId(null);
      refetch();
    },
  });
  const updateMutation = trpc.search.updateSavedSearch.useMutation({
    onSuccess: () => {
      setEditId(null);
      refetch();
    },
  });

  const toggleNotify = (id: string, currentValue: boolean) => {
    updateMutation.mutate({ id, notifyEmail: !currentValue });
  };

  const handleEditSave = () => {
    if (editId && editName.trim()) {
      updateMutation.mutate({ id: editId, name: editName.trim() });
    }
  };

  /** Build a readable summary from filters JSON */
  const getFiltersSummary = (filters: unknown): string => {
    if (!filters || typeof filters !== "object") return t("noFilters");
    const f = filters as Record<string, unknown>;
    const parts: string[] = [];
    if (f.query) parts.push(`"${f.query}"`);
    if (f.minPrice || f.maxPrice) {
      const min = f.minPrice ? `${f.minPrice}` : "0";
      const max = f.maxPrice ? `${f.maxPrice}` : "∞";
      parts.push(`${min}–${max} EUR`);
    }
    if (f.condition) parts.push(String(f.condition));
    if (f.categoryId) parts.push(t("categoryFilter"));
    if (f.locationId) parts.push(t("locationFilter"));
    return parts.length > 0 ? parts.join(" · ") : t("allListings");
  };

  /** Build search URL from filters */
  const buildSearchUrl = (filters: unknown): string => {
    if (!filters || typeof filters !== "object") return `/${locale}/search`;
    const f = filters as Record<string, string>;
    const params = new URLSearchParams();
    if (f.query) params.set("q", f.query);
    if (f.minPrice) params.set("minPrice", f.minPrice);
    if (f.maxPrice) params.set("maxPrice", f.maxPrice);
    if (f.condition) params.set("condition", f.condition);
    if (f.categoryId) params.set("category", f.categoryId);
    if (f.locationId) params.set("location", f.locationId);
    const qs = params.toString();
    return `/${locale}/search${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href={`/${locale}/search`}>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Search className="h-4 w-4" />
            {t("newSearch")}
          </Button>
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!searches || searches.length === 0) && (
        <Card>
          <CardContent className="py-16 text-center">
            <BookmarkX className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">{t("empty")}</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {t("emptyDesc")}
            </p>
            <Link href={`/${locale}/search`}>
              <Button size="sm">
                <Search className="mr-1 h-4 w-4" />
                {t("goSearch")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Saved searches list */}
      {!isLoading && searches && searches.length > 0 && (
        <div className="space-y-3">
          {searches.map((search) => (
            <Card
              key={search.id}
              className="transition-colors hover:bg-accent/30"
            >
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Search className="h-5 w-5 text-primary" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium">
                      {search.name}
                    </h3>
                    {search.notifyEmail ? (
                      <Badge variant="success" className="text-[10px] gap-1">
                        <Bell className="h-3 w-3" /> {t("notifyOn")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <BellOff className="h-3 w-3" /> {t("notifyOff")}
                      </Badge>
                    )}
                  </div>

                  {/* Filters summary */}
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Filter className="h-3 w-3" />
                    {getFiltersSummary(search.filters)}
                  </p>

                  {/* Last notified */}
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/60">
                    <Clock className="h-3 w-3" />
                    {search.lastNotifiedAt
                      ? `${t("lastNotified")}: ${formatRelativeTime(new Date(search.lastNotifiedAt))}`
                      : t("neverNotified")}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 shrink-0">
                  <Link href={buildSearchUrl(search.filters)}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                    >
                      <ExternalLink className="h-3 w-3" /> {t("run")}
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setEditId(search.id);
                      setEditName(search.name);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => toggleNotify(search.id, search.notifyEmail)}
                    disabled={updateMutation.isPending}
                  >
                    {search.notifyEmail ? (
                      <BellOff className="h-3 w-3" />
                    ) : (
                      <Bell className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-red-500 hover:text-red-600"
                    onClick={() => setDeleteId(search.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteId) deleteMutation.mutate({ id: deleteId });
              }}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit name dialog */}
      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>{t("editDesc")}</DialogDescription>
          </DialogHeader>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder={t("searchName")}
            maxLength={100}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={updateMutation.isPending || !editName.trim()}
              onClick={handleEditSave}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
