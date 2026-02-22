"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { User, Calendar, Star, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";

// ─── StarRating ─────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          <Star
            className={`${sizeClass} ${
              star <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── ReviewForm ─────────────────────────────────────────────

function ReviewForm({
  revieweeId,
  onSuccess,
}: {
  revieweeId: string;
  onSuccess: () => void;
}) {
  const t = useTranslations("review");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const createReview = trpc.review.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      onSuccess();
    },
  });

  const handleSubmit = useCallback(() => {
    if (rating === 0) return;
    createReview.mutate({
      revieweeId,
      rating,
      comment: comment.trim() || undefined,
    });
  }, [revieweeId, rating, comment, createReview]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setRating(0);
      setComment("");
      setSubmitted(false);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{t("writeReview")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("writeReview")}</DialogTitle>
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
              <Label>{t("rating")}</Label>
              <div className="flex items-center gap-3">
                <StarRating value={rating} onChange={setRating} />
                {rating > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {t(`stars.${rating}` as "stars.1")}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("comment")}</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("commentPlaceholder")}
                rows={4}
              />
            </div>

            {createReview.error && (
              <p className="text-sm text-destructive">
                {createReview.error.message}
              </p>
            )}
          </div>
        )}

        {!submitted && (
          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || createReview.isPending}
            >
              {createReview.isPending ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── PublicProfilePage ──────────────────────────────────────

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const locale = params.locale as string;
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("publicProfile");
  const tr = useTranslations("review");

  const profileQuery = trpc.user.getPublicProfile.useQuery({ userId });
  const reviewsQuery = trpc.review.getForUser.useQuery({ userId });

  const isOwnProfile = session?.user?.id === userId;

  if (profileQuery.isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!profileQuery.data) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <User className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
        <h1 className="text-xl font-bold">{t("noUser")}</h1>
      </div>
    );
  }

  const user = profileQuery.data;
  const reviews = reviewsQuery.data;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 text-center">
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name || "User"}
                  width={96}
                  height={96}
                  className="mx-auto rounded-full"
                />
              ) : (
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <h2 className="mt-4 text-xl font-bold">{user.name || "User"}</h2>
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {t("memberSince", {
                  date: new Date(user.createdAt).toLocaleDateString(),
                })}
              </p>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
                <div className="flex flex-col items-center gap-1">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <span className="text-lg font-bold">
                    {user._count.listings}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("listings")}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Star className="h-5 w-5 text-muted-foreground" />
                  <span className="text-lg font-bold">
                    {user._count.reviewsReceived}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("reviews")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {reviews && reviews.totalReviews > 0 && (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="flex items-center justify-center gap-2">
                  <StarRating
                    value={Math.round(reviews.averageRating)}
                    readonly
                    size="sm"
                  />
                  <span className="text-sm font-medium">
                    {reviews.averageRating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tr("totalReviews", { count: reviews.totalReviews })}
                </p>
              </CardContent>
            </Card>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/${locale}/search?userId=${userId}`)}
          >
            {t("viewListings")}
          </Button>
        </div>

        {/* Reviews */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{tr("title")}</h1>
            {session?.user && !isOwnProfile && (
              <ReviewForm
                revieweeId={userId}
                onSuccess={() => {
                  reviewsQuery.refetch();
                  profileQuery.refetch();
                }}
              />
            )}
          </div>

          {!reviews || reviews.reviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Star className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">
                  {tr("noReviews")}
                </h3>
                <p className="text-muted-foreground">{tr("noReviewsDesc")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reviews.reviews.map(
                (review: (typeof reviews.reviews)[number]) => (
                  <Card key={review.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        {review.reviewer.avatar ? (
                          <Image
                            src={review.reviewer.avatar}
                            alt={review.reviewer.name || "Reviewer"}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">
                              {review.reviewer.name || "User"}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <StarRating
                            value={review.rating}
                            readonly
                            size="sm"
                          />
                          {review.comment && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
