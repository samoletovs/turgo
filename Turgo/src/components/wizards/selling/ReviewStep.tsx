import { motion } from "framer-motion";
import { MessageSquare, TrendingUp, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import type { SellingStepContext } from "./types";
import { trpcClient } from "@/lib/trpc/client";

// ──────────────────────────────────────────────
// PUBLISH / DRAFT ACTION HANDLER
// ──────────────────────────────────────────────

export async function handlePublishAction(
  value: string,
  ctx: SellingStepContext,
) {
  // Validate required fields before submission
  const missing: string[] = [];
  let finalDescription = ctx.data.description?.trim() || "";
  if (!ctx.data.title || ctx.data.title.trim().length < 5)
    missing.push("title (min 5 chars)");
  if (finalDescription.length < 20) {
    if (ctx.data.title) {
      const autoDesc = `${ctx.data.title}. ${ctx.data.categoryName ? `Category: ${ctx.data.categoryName}. ` : ""}Condition: ${ctx.data.condition}. Price: €${ctx.data.price}.`;
      finalDescription =
        autoDesc.length >= 20
          ? autoDesc
          : autoDesc + " Contact seller for more details.";
      ctx.updateData({ description: finalDescription });
    } else {
      missing.push("description (min 20 chars)");
    }
  }
  if (!ctx.data.price || ctx.data.price <= 0) missing.push("price");
  if (!ctx.data.categoryId) missing.push("category");

  if (missing.length > 0) {
    // Reset to confirm_details so typed text is handled by the details handler
    ctx.setCurrentStep("confirm_details");
    ctx.addAgentMessage(
      ctx.t("missingFields", {
        fields: missing.map((m) => `• Missing: **${m}**`).join("\n"),
      }),
      [{ label: ctx.t("fillDetails"), value: "edit" }],
    );
    return;
  }

  ctx.setCurrentStep("publishing");
  ctx.setIsSubmitting(true);
  try {
    // Upload photos via /api/upload (kept as REST for multipart)
    let imageUrls: { url: string; thumbnailUrl?: string }[] = [];
    if (ctx.data.photos.length > 0) {
      const uploadFormData = new FormData();
      ctx.data.photos.forEach((photo) => uploadFormData.append("files", photo));
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => null);
        throw new Error(err?.error || "Failed to upload images");
      }
      const uploadData = await uploadRes.json();
      imageUrls = (uploadData.uploaded || []).map(
        (u: { url: string; thumbnailUrl: string }) => ({
          url: u.url,
          thumbnailUrl: u.thumbnailUrl,
        }),
      );
    }

    // Create listing via tRPC
    const result = await trpcClient.listing.createFull.mutate({
      title: ctx.data.title.trim(),
      description: finalDescription,
      categoryId: ctx.data.categoryId,
      condition: ctx.data.condition as "NEW" | "USED" | "REFURBISHED",
      locationId: ctx.data.locationId || undefined,
      price: ctx.data.price,
      status: value === "draft" ? "DRAFT" : "ACTIVE",
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      agent:
        value === "publish"
          ? {
              enabled: true,
              autoRespond: ctx.data.autoRespond,
              autoNegotiate: ctx.data.autoNegotiate,
              autoBoost: ctx.data.autoBoost,
              sellingStrategyId: ctx.data.sellingStrategyId,
              urgency: ctx.data.urgency as
                | "ONE_DAY"
                | "THREE_DAYS"
                | "ONE_WEEK"
                | "TWO_WEEKS"
                | "ONE_MONTH"
                | "NO_RUSH",
              minPrice: ctx.data.minimumPrice,
            }
          : undefined,
    });

    ctx.setCurrentStep("done");
    ctx.addAgentMessage(
      value === "draft" ? ctx.t("draftSaved") : ctx.t("listingLive"),
      [
        {
          label: ctx.t("viewListing"),
          value: `goto_/listing/${result.slug || result.id}`,
        },
      ],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("UNAUTHORIZED")) {
      ctx.addAgentMessage(ctx.t("signInRequired"), [
        {
          label: ctx.t("signIn"),
          value: `goto_/auth/signin?callbackUrl=/${ctx.locale}/sell`,
        },
      ]);
    } else {
      const errorMsg = message || "Something went wrong";
      ctx.addAgentMessage(ctx.t("createError", { error: errorMsg }), [
        { label: ctx.t("retry"), value: value },
        { label: ctx.t("editDetails"), value: "edit" },
      ]);
    }
  } finally {
    ctx.setIsSubmitting(false);
  }
}

// ──────────────────────────────────────────────
// DONE STATE FEATURE CARDS
// ──────────────────────────────────────────────

export function DonePanel() {
  const t = useTranslations("sell.chat");
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 grid gap-4 sm:grid-cols-3"
    >
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-full bg-blue-500/10 p-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("doneAutoRespond")}</p>
            <p className="text-xs text-muted-foreground">
              {t("doneAutoRespondDesc")}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-full bg-green-500/10 p-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("doneSmartPricing")}</p>
            <p className="text-xs text-muted-foreground">
              {t("doneSmartPricingDesc")}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-full bg-purple-500/10 p-2">
            <Shield className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("doneAutoNegotiate")}</p>
            <p className="text-xs text-muted-foreground">
              {t("doneAutoNegotiateDesc")}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
