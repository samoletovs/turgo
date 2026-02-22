"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Heart, Flag } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";

// ─── ViewTracker ────────────────────────────────────────────
// Fires a single incrementView mutation on mount.
// Uses sessionStorage to prevent double-counting within the same tab session.

const VIEWED_KEY = "turgo_viewed_listings";

export function ViewTracker({ listingId }: { listingId: string }) {
  const incrementView = trpc.listing.incrementView.useMutation();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(VIEWED_KEY);
      const viewed: string[] = raw ? JSON.parse(raw) : [];
      if (viewed.includes(listingId)) return;

      incrementView.mutate({ id: listingId });
      viewed.push(listingId);
      sessionStorage.setItem(VIEWED_KEY, JSON.stringify(viewed));
    } catch {
      // sessionStorage unavailable (SSR, incognito quota, etc.) — still track
      incrementView.mutate({ id: listingId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  return null;
}

// ─── FavoriteButton ─────────────────────────────────────────
// Optimistic toggle with trpc.favorite.toggle + isFavorited query.

interface FavoriteButtonProps {
  listingId: string;
  initialCount: number;
}

export function FavoriteButton({
  listingId,
  initialCount,
}: FavoriteButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();

  // Only query isFavorited if user is logged in
  const { data: favData } = trpc.favorite.isFavorited.useQuery(
    { listingId },
    { enabled: !!session?.user },
  );

  // Track local toggle count for optimistic UI
  const [toggleCount, setToggleCount] = useState(0);
  const [_optimisticCount, setOptimisticCount] = useState(initialCount);

  // Derive favorited state: server data + local toggle flips
  const serverFav = favData?.favorited ?? false;
  const optimisticFav = toggleCount % 2 === 0 ? serverFav : !serverFav;

  const toggleMutation = trpc.favorite.toggle.useMutation({
    onMutate: () => {
      // Optimistic update
      setToggleCount((prev) => prev + 1);
      setOptimisticCount((prev) => (optimisticFav ? prev - 1 : prev + 1));
    },
    onError: () => {
      // Revert on failure
      setToggleCount((prev) => prev - 1);
      setOptimisticCount((prev) => (optimisticFav ? prev + 1 : prev - 1));
    },
  });

  const handleClick = useCallback(() => {
    if (!session?.user) {
      router.push(
        `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    toggleMutation.mutate({ listingId });
  }, [session, router, listingId, toggleMutation]);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleClick}
      aria-label={optimisticFav ? "Remove from favorites" : "Add to favorites"}
      className={
        optimisticFav ? "text-red-500 border-red-200 hover:text-red-600" : ""
      }
    >
      <Heart className={`h-4 w-4 ${optimisticFav ? "fill-current" : ""}`} />
    </Button>
  );
}

// ─── SendMessageButton ──────────────────────────────────────
// Navigates to /messages?listing={id} or redirects to sign-in.

interface SendMessageButtonProps {
  listingId: string;
  sellerId: string;
  locale: string;
}

export function SendMessageButton({
  listingId,
  sellerId,
  locale,
}: SendMessageButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (!session?.user) {
      router.push(
        `/${locale}/auth/signin?callbackUrl=${encodeURIComponent(`/${locale}/messages?listing=${listingId}`)}`,
      );
      return;
    }
    // Don't message yourself
    if (session.user.id === sellerId) return;
    router.push(`/${locale}/messages?listing=${listingId}`);
  }, [session, router, locale, listingId, sellerId]);

  return (
    <Button className="w-full" size="lg" onClick={handleClick}>
      <MessageCircle className="mr-2 h-4 w-4" />
      Send Message
    </Button>
  );
}

// ─── ReportButton ───────────────────────────────────────────
// Opens a dialog to report a listing with reason + optional details.

const REPORT_REASONS = [
  "SPAM",
  "FRAUD",
  "INAPPROPRIATE",
  "DUPLICATE",
  "WRONG_CATEGORY",
  "MISLEADING_PRICE",
  "PROHIBITED_ITEM",
  "OTHER",
] as const;

interface ReportButtonProps {
  listingId: string;
  locale: string;
}

export function ReportButton({ listingId, locale }: ReportButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const tListing = useTranslations("listing");
  const t = useTranslations("listing.reportDialog");

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const reportMutation = trpc.listing.report.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = useCallback(() => {
    if (!reason) return;
    reportMutation.mutate({
      listingId,
      reason: reason as (typeof REPORT_REASONS)[number],
      description: description.length >= 10 ? description : undefined,
    });
  }, [listingId, reason, description, reportMutation]);

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen && !session?.user) {
        router.push(
          `/${locale}/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      setOpen(isOpen);
      if (!isOpen) {
        // Reset state on close
        setReason("");
        setDescription("");
        setSubmitted(false);
      }
    },
    [session, router, locale],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag className="mr-1 h-4 w-4" />
          {tListing("report")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center">
            <p className="text-sm text-green-600 dark:text-green-400">
              {t("success")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("reason")}</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder={t("reasonPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`reasons.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("details")}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("detailsPlaceholder")}
                rows={4}
              />
            </div>

            {reportMutation.error && (
              <p className="text-sm text-destructive">
                {reportMutation.error.message}
              </p>
            )}
          </div>
        )}

        {!submitted && (
          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={!reason || reportMutation.isPending}
            >
              {reportMutation.isPending ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
