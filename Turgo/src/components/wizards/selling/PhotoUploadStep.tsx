import type { ChangeEvent } from "react";
import { X } from "lucide-react";
import type { SellingStepContext } from "./types";
import { resolveName, buildCategoryActions } from "./types";

// ──────────────────────────────────────────────
// PHOTO UPLOAD HANDLER
// ──────────────────────────────────────────────

export async function handlePhotoUpload(
  e: ChangeEvent<HTMLInputElement>,
  ctx: SellingStepContext,
) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  const previews = files.map((f) => URL.createObjectURL(f));
  ctx.updateData({
    photos: [...ctx.data.photos, ...files],
    photoPreviews: [...ctx.data.photoPreviews, ...previews],
  });

  ctx.addUserMessage(
    `Uploaded ${files.length} photo${files.length > 1 ? "s" : ""}`,
  );
  ctx.setCurrentStep("analyzing");

  // Simulate AI analysis
  ctx.setIsThinking(true);
  await new Promise((r) => setTimeout(r, 1500));
  ctx.setIsThinking(false);

  // Try to get AI analysis of photos
  try {
    const response = await fetch("/api/ai/generate-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Analyze listing photos for Turgo",
        locale: ctx.locale,
      }),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.title) {
        ctx.updateData({
          title: result.title,
          description: result.description || "",
          categoryId: result.suggestedCategoryId || "",
        });
      }

      ctx.setCurrentStep("confirm_details");
      ctx.addAgentMessage(
        `I can see you're selling: **${result.title || "an item"}**\n\n${
          result.description
            ? `Here's a description I drafted:\n\n"${result.description.slice(0, 200)}..."`
            : "Let me help you write a great description."
        }\n\nDoes this look right, or would you like to adjust?`,
        [
          { label: "✅ Looks good!", value: "confirm_details" },
          { label: "✏️ Let me adjust", value: "edit_details" },
        ],
      );
      return;
    }
  } catch {
    // Fallback
  }

  ctx.setCurrentStep("confirm_details");
  ctx.addAgentMessage(
    "Great photos! Now tell me — what exactly are you selling? Just describe it naturally.",
  );
}

// ──────────────────────────────────────────────
// REMOVE PHOTO
// ──────────────────────────────────────────────

export function removePhoto(index: number, ctx: SellingStepContext) {
  URL.revokeObjectURL(ctx.data.photoPreviews[index]);
  ctx.updateData({
    photos: ctx.data.photos.filter((_, i) => i !== index),
    photoPreviews: ctx.data.photoPreviews.filter((_, i) => i !== index),
  });
}

// ──────────────────────────────────────────────
// GREETING STEP INPUT
// ──────────────────────────────────────────────

export async function handleGreetingInput(
  content: string,
  ctx: SellingStepContext,
) {
  if (
    content.toLowerCase().includes("describe") ||
    content.toLowerCase().includes("no photo")
  ) {
    ctx.setCurrentStep("confirm_details");
    await ctx.thinkAndRespond(
      "Sure! Just describe what you're selling and I'll create a great listing for you.",
    );
  } else {
    ctx.setCurrentStep("confirm_details");
    await ctx.thinkAndRespond(
      `Got it! Let me work with that: "${content}"\n\nI'll generate a title and description. One moment...`,
    );
    // Generate via AI
    ctx.setIsThinking(true);
    try {
      const response = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content, locale: ctx.locale }),
      });
      if (response.ok) {
        const result = await response.json();
        ctx.updateData({
          title: result.title || content,
          description: result.description || "",
        });
        ctx.setIsThinking(false);
        ctx.addAgentMessage(
          `Here's what I came up with:\n\n**Title:** ${result.title || content}\n**Description:** ${(result.description || "").slice(0, 200)}...\n\nShall we continue with this, or would you like to make changes?`,
          [
            { label: "✅ Continue", value: "confirm_details" },
            { label: "✏️ Edit", value: "edit_details" },
          ],
        );
        return;
      }
    } catch {
      /* fallback */
    }
    ctx.setIsThinking(false);
    ctx.updateData({ title: content, description: "" });
    ctx.addAgentMessage(
      `I'll use "${content}" as the starting point. Could you give me more details about the item? Condition, brand, any notable details?`,
    );
  }
}

// ──────────────────────────────────────────────
// CONFIRM DETAILS STEP INPUT
// ──────────────────────────────────────────────

export async function handleConfirmDetailsInput(
  content: string,
  ctx: SellingStepContext,
) {
  if (ctx.data.title && ctx.data.description) {
    // They may be providing an edit
    ctx.updateData({ description: content });
  } else if (ctx.data.title) {
    ctx.updateData({ description: content });
  } else {
    ctx.updateData({ title: content });
    await ctx.thinkAndRespond("And a brief description?");
    return;
  }
  ctx.setCurrentStep("category");
  const itemText = `${ctx.data.title} ${ctx.data.description} ${content}`;
  await ctx.thinkAndRespond(
    "Now let's pick a category. Which of these best fits your item?",
    buildCategoryActions(ctx.categories, itemText, ctx.locale),
  );
}

// ──────────────────────────────────────────────
// PHOTO PREVIEW COMPONENT
// ──────────────────────────────────────────────

export function PhotoPreview({
  previews,
  onRemove,
}: {
  previews: string[];
  onRemove: (index: number) => void;
}) {
  if (previews.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {previews.map((preview, i) => (
        <div
          key={i}
          className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`Photo ${i + 1}`}
            className="h-full w-full object-cover"
          />
          <button
            onClick={() => onRemove(i)}
            className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="h-3 w-3 text-white" />
          </button>
        </div>
      ))}
    </div>
  );
}
