"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Heart } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function FavoriteButton({ listingId, initialCount }: FavoriteButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();

  // Only query isFavorited if user is logged in
  const { data: favData } = trpc.favorite.isFavorited.useQuery(
    { listingId },
    { enabled: !!session?.user },
  );

  const [optimisticFav, setOptimisticFav] = useState(false);
  const [optimisticCount, setOptimisticCount] = useState(initialCount);

  // Sync once server data arrives
  useEffect(() => {
    if (favData) setOptimisticFav(favData.favorited);
  }, [favData]);

  const toggleMutation = trpc.favorite.toggle.useMutation({
    onMutate: () => {
      // Optimistic update
      setOptimisticFav((prev) => !prev);
      setOptimisticCount((prev) => (optimisticFav ? prev - 1 : prev + 1));
    },
    onError: () => {
      // Revert on failure
      setOptimisticFav((prev) => !prev);
      setOptimisticCount((prev) => (optimisticFav ? prev + 1 : prev - 1));
    },
  });

  const handleClick = useCallback(() => {
    if (!session?.user) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
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
      className={optimisticFav ? "text-red-500 border-red-200 hover:text-red-600" : ""}
    >
      <Heart
        className={`h-4 w-4 ${optimisticFav ? "fill-current" : ""}`}
      />
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

export function SendMessageButton({ listingId, sellerId, locale }: SendMessageButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (!session?.user) {
      router.push(
        `/${locale}/auth/signin?callbackUrl=${encodeURIComponent(`/${locale}/messages?listing=${listingId}`)}`
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
