import { motion } from "framer-motion";
import { MessageSquare, TrendingUp, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SellingStepContext } from "./types";

// ──────────────────────────────────────────────
// PUBLISH / DRAFT ACTION HANDLER
// ──────────────────────────────────────────────

export async function handlePublishAction(
  value: string,
  ctx: SellingStepContext,
) {
  // Validate required fields before submission
  const missing: string[] = [];
  if (!ctx.data.title || ctx.data.title.trim().length < 5)
    missing.push("title (min 5 chars)");
  if (!ctx.data.description || ctx.data.description.trim().length < 20) {
    // Auto-generate a minimal description if user didn't provide enough
    if (ctx.data.title && ctx.data.description.length < 20) {
      const autoDesc = `${ctx.data.title}. ${ctx.data.categoryName ? `Category: ${ctx.data.categoryName}. ` : ""}Condition: ${ctx.data.condition}. Price: €${ctx.data.price}.`;
      ctx.updateData({
        description:
          autoDesc.length >= 20
            ? autoDesc
            : autoDesc + " Contact seller for more details.",
      });
    } else {
      missing.push("description (min 20 chars)");
    }
  }
  if (!ctx.data.price || ctx.data.price <= 0) missing.push("price");
  if (!ctx.data.categoryId) missing.push("category");

  if (missing.length > 0) {
    ctx.addAgentMessage(
      `I need a few more details before I can create this listing:\n\n${missing.map((m) => `• Missing: **${m}**`).join("\n")}\n\nLet me walk you through the missing steps.`,
      [{ label: "📝 Fill in details", value: "edit" }],
    );
    return;
  }

  ctx.setCurrentStep("publishing");
  ctx.setIsSubmitting(true);
  try {
    const formData = new FormData();
    formData.append("title", ctx.data.title.trim());
    formData.append("description", ctx.data.description.trim());
    formData.append("categoryId", ctx.data.categoryId);
    formData.append("condition", ctx.data.condition);
    if (ctx.data.locationId) formData.append("locationId", ctx.data.locationId);
    formData.append("price", String(ctx.data.price));
    formData.append("status", value === "draft" ? "DRAFT" : "ACTIVE");

    if (value === "publish") {
      formData.append("agent[enabled]", "true");
      formData.append("agent[autoRespond]", String(ctx.data.autoRespond));
      formData.append("agent[autoNegotiate]", String(ctx.data.autoNegotiate));
      formData.append("agent[autoBoost]", String(ctx.data.autoBoost));
      formData.append("agent[urgency]", ctx.data.urgency);
      formData.append("agent[minPrice]", String(ctx.data.minimumPrice));
    }

    ctx.data.photos.forEach((photo) => formData.append("photos", photo));

    const response = await fetch("/api/listings", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      ctx.setCurrentStep("done");
      ctx.addAgentMessage(
        value === "draft"
          ? `Your listing has been saved as a **draft**! You can find it in your profile and publish it when you're ready.`
          : `Your listing is live and I'm on the job! Here's what I'll be doing:\n\n✅ Monitoring views and engagement\n✅ Responding to buyer questions\n✅ Adjusting price based on market data\n✅ Sending you daily summaries\n\nI'll message you when there's important activity. Good luck! 🎉`,
        [
          {
            label: "View my listing",
            value: `goto_/listing/${result.slug || result.id}`,
          },
        ],
      );
    } else if (response.status === 401) {
      ctx.addAgentMessage(
        `You need to be **signed in** to create a listing. Please sign in and try again.`,
        [
          {
            label: "🔑 Sign in",
            value: `goto_/auth/signin?callbackUrl=/${ctx.locale}/sell`,
          },
        ],
      );
    } else {
      const errorData = await response.json().catch(() => null);
      const errorMsg = errorData?.error || `Server error (${response.status})`;
      ctx.addAgentMessage(
        `There was an issue creating the listing: **${errorMsg}**\n\nPlease try again or edit details.`,
        [
          { label: "🔄 Retry", value: value },
          { label: "📝 Edit details", value: "edit" },
        ],
      );
    }
  } catch {
    ctx.addAgentMessage(
      "Something went wrong — couldn't reach the server. Please check your connection and try again.",
      [{ label: "🔄 Retry", value: value }],
    );
  } finally {
    ctx.setIsSubmitting(false);
  }
}

// ──────────────────────────────────────────────
// DONE STATE FEATURE CARDS
// ──────────────────────────────────────────────

export function DonePanel() {
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
            <p className="text-sm font-medium">Auto-Respond</p>
            <p className="text-xs text-muted-foreground">
              AI answers buyer questions 24/7
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
            <p className="text-sm font-medium">Smart Pricing</p>
            <p className="text-xs text-muted-foreground">
              Dynamic price optimization
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
            <p className="text-sm font-medium">Auto-Negotiate</p>
            <p className="text-xs text-muted-foreground">
              Handles offers within your rules
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
