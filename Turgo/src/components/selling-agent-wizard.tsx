"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Bot,
  Camera,
  Zap,
  Clock,
  MessageSquare,
  TrendingUp,
  Check,
  X,
  Send,
  User,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

type WizardStep =
  | "greeting"
  | "photos"
  | "analyzing"
  | "confirm_details"
  | "category"
  | "pricing"
  | "urgency"
  | "agent_config"
  | "summary"
  | "publishing"
  | "done";

interface ChatMsg {
  id: string;
  role: "agent" | "user";
  content: string;
  timestamp: Date;
  component?: React.ReactNode;
  actions?: { label: string; value: string }[];
}

const URGENCY_OPTIONS = [
  { value: "ONE_DAY", label: "Sell today", icon: Zap, color: "text-red-500", desc: "Aggressive pricing, max exposure" },
  { value: "THREE_DAYS", label: "Within 3 days", icon: Clock, color: "text-orange-500", desc: "Fast but flexible" },
  { value: "ONE_WEEK", label: "This week", icon: Clock, color: "text-yellow-500", desc: "Balanced approach" },
  { value: "TWO_WEEKS", label: "Within 2 weeks", icon: Clock, color: "text-blue-500", desc: "Patient pricing" },
  { value: "ONE_MONTH", label: "This month", icon: Clock, color: "text-green-500", desc: "Maximize price" },
  { value: "NO_RUSH", label: "No rush", icon: Clock, color: "text-gray-500", desc: "Hold for best offer" },
];

interface WizardData {
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  condition: string;
  locationId: string;
  price: number;
  aiSuggestedPrice: number | null;
  photos: File[];
  photoPreviews: string[];
  urgency: string;
  minimumPrice: number;
  autoRespond: boolean;
  autoNegotiate: boolean;
  autoBoost: boolean;
}

type JsonName = string | Record<string, string>;

interface SellingAgentWizardProps {
  locale: string;
  categories?: { id: string; name: JsonName; slug: string; children?: { id: string; name: JsonName; slug: string }[] }[];
  locations?: { id: string; name: JsonName; slug: string; children?: { id: string; name: JsonName; slug: string }[] }[];
}

/** Skeleton shown while AI pricing is being fetched */
function PricingSkeleton() {
  return (
    <div className="mt-2 space-y-2 rounded-lg border bg-background/50 p-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-xs text-muted-foreground">Analyzing market data...</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted-foreground/20" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted-foreground/20" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted-foreground/20" />
      </div>
    </div>
  );
}

export function SellingAgentWizard({
  locale,
  categories = [],
  locations: _locations = [],
}: SellingAgentWizardProps) {
  const _t = useTranslations("sell");
  const _tAgent = useTranslations("agent");
  const utils = trpc.useUtils();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [currentStep, setCurrentStep] = useState<WizardStep>("greeting");
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<WizardData>({
    title: "",
    description: "",
    categoryId: "",
    categoryName: "",
    condition: "USED",
    locationId: "",
    price: 0,
    aiSuggestedPrice: null,
    photos: [],
    photoPreviews: [],
    urgency: "ONE_WEEK",
    minimumPrice: 0,
    autoRespond: true,
    autoNegotiate: false,
    autoBoost: false,
  });

  const updateData = useCallback(
    (updates: Partial<WizardData>) => setData((prev) => ({ ...prev, ...updates })),
    []
  );

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      addAgentMessage(
        "Hey there! I'm your selling agent. Let's get your item listed and sold quickly.\n\nStart by uploading some photos of what you're selling — I'll analyze them and suggest the best title, description, and pricing strategy.",
        [
          { label: "📸 Upload photos", value: "upload_photos" },
          { label: "📝 I'll describe it first", value: "describe_first" },
        ]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addAgentMessage = (content: string, actions?: { label: string; value: string }[], component?: React.ReactNode) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `agent-${Date.now()}-${Math.random()}`,
        role: "agent",
        content,
        timestamp: new Date(),
        actions,
        component,
      },
    ]);
  };

  const addUserMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      },
    ]);
  };

  // Step transition with AI thinking
  const thinkAndRespond = async (message: string, actions?: { label: string; value: string }[], component?: React.ReactNode) => {
    setIsThinking(true);
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
    setIsThinking(false);
    addAgentMessage(message, actions, component);
  };

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const previews = files.map((f) => URL.createObjectURL(f));
    updateData({ photos: [...data.photos, ...files], photoPreviews: [...data.photoPreviews, ...previews] });

    addUserMessage(`Uploaded ${files.length} photo${files.length > 1 ? "s" : ""}`);
    setCurrentStep("analyzing");

    // Simulate AI analysis
    setIsThinking(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsThinking(false);

    // Try to get AI analysis of photos
    try {
      const response = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Analyze listing photos for Turgo`, locale }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.title) updateData({ title: result.title, description: result.description || "", categoryId: result.suggestedCategoryId || "" });

        setCurrentStep("confirm_details");
        addAgentMessage(
          `I can see you're selling: **${result.title || "an item"}**\n\n${result.description ? `Here's a description I drafted:\n\n"${result.description.slice(0, 200)}..."` : "Let me help you write a great description."}\n\nDoes this look right, or would you like to adjust?`,
          [
            { label: "✅ Looks good!", value: "confirm_details" },
            { label: "✏️ Let me adjust", value: "edit_details" },
          ]
        );
        return;
      }
    } catch {
      // Fallback
    }

    setCurrentStep("confirm_details");
    addAgentMessage(
      "Great photos! Now tell me — what exactly are you selling? Just describe it naturally.",
    );
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(data.photoPreviews[index]);
    updateData({
      photos: data.photos.filter((_, i) => i !== index),
      photoPreviews: data.photoPreviews.filter((_, i) => i !== index),
    });
  };

  // Handle user text input
  const handleSendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content) return;
    setInput("");
    addUserMessage(content);

    switch (currentStep) {
      case "greeting":
        if (content.toLowerCase().includes("describe") || content.toLowerCase().includes("no photo")) {
          setCurrentStep("confirm_details");
          await thinkAndRespond("Sure! Just describe what you're selling and I'll create a great listing for you.");
        } else {
          setCurrentStep("confirm_details");
          await thinkAndRespond(
            `Got it! Let me work with that: "${content}"\n\nI'll generate a title and description. One moment...`,
          );
          // Generate via AI
          setIsThinking(true);
          try {
            const response = await fetch("/api/ai/generate-description", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: content, locale }),
            });
            if (response.ok) {
              const result = await response.json();
              updateData({ title: result.title || content, description: result.description || "" });
              setIsThinking(false);
              addAgentMessage(
                `Here's what I came up with:\n\n**Title:** ${result.title || content}\n**Description:** ${(result.description || "").slice(0, 200)}...\n\nShall we continue with this, or would you like to make changes?`,
                [
                  { label: "✅ Continue", value: "confirm_details" },
                  { label: "✏️ Edit", value: "edit_details" },
                ]
              );
              return;
            }
          } catch { /* fallback */ }
          setIsThinking(false);
          updateData({ title: content, description: "" });
          addAgentMessage(
            `I'll use "${content}" as the starting point. Could you give me more details about the item? Condition, brand, any notable details?`,
          );
        }
        break;

      case "confirm_details":
        // User is providing/editing details
        if (data.title && data.description) {
          // They may be providing an edit
          updateData({ description: content });
        } else if (data.title) {
          updateData({ description: content });
        } else {
          updateData({ title: content });
          await thinkAndRespond("And a brief description?");
          return;
        }
        setCurrentStep("category");
        await thinkAndRespond(
          "Now let's pick a category. Which of these best fits your item?",
          categories.slice(0, 6).map((c) => ({
            label: typeof c.name === "object" ? (c.name as Record<string, string>)[locale] || (c.name as Record<string, string>).en || c.slug : c.name as string,
            value: `cat_${c.id}`,
          }))
        );
        break;

      case "category":
        // User typed a category
        const matchedCat = categories.find(
          (c) => {
            const name = typeof c.name === "object" ? (c.name as Record<string, string>)[locale] || (c.name as Record<string, string>).en || "" : c.name as string;
            return name.toLowerCase().includes(content.toLowerCase());
          }
        );
        if (matchedCat) {
          const catName = typeof matchedCat.name === "object" ? (matchedCat.name as Record<string, string>)[locale] || (matchedCat.name as Record<string, string>).en || matchedCat.slug : matchedCat.name as string;
          updateData({ categoryId: matchedCat.id, categoryName: catName });
        }
        setCurrentStep("pricing");
        await thinkAndRespond(
          "What price are you thinking? I'll analyze the market and suggest an optimal starting price.\n\nJust type a number (in EUR).",
        );
        break;

      case "pricing":
        const priceNum = parseFloat(content.replace(/[€,\s]/g, ""));
        if (!isNaN(priceNum) && priceNum > 0) {
          updateData({ price: priceNum });

          // Show pricing analysis skeleton while AI works
          const skeletonMsgId = `pricing-skeleton-${Date.now()}`;
          setMessages((prev) => [
            ...prev,
            {
              id: skeletonMsgId,
              role: "agent" as const,
              content: `Your price: **€${priceNum}**\nAnalyzing market data...`,
              timestamp: new Date(),
              component: <PricingSkeleton />,
            },
          ]);
          setIsThinking(true);

          let suggested: number | null = null;
          let reasoning = "";
          let confidence = 0;
          let comparableListings = 0;
          let aiSuccess = false;

          try {
            const result = await utils.ai.suggestPrice.fetch({
              categoryId: data.categoryId,
              title: data.title || content,
              condition: data.condition,
              ...(data.locationId ? { locationId: data.locationId } : {}),
            });

            if (result.suggestedPrice > 0) {
              suggested = result.suggestedPrice;
              reasoning = result.reasoning;
              confidence = result.confidence;
              comparableListings = result.comparableListings;
              aiSuccess = true;
            }
          } catch {
            // AI call failed — will use fallback
          }

          // Remove skeleton message
          setMessages((prev) => prev.filter((m) => m.id !== skeletonMsgId));
          setIsThinking(false);

          setCurrentStep("urgency");

          if (aiSuccess && suggested !== null) {
            updateData({ aiSuggestedPrice: suggested });
            const confidenceLabel =
              confidence >= 0.8 ? "High" : confidence >= 0.5 ? "Medium" : "Low";
            addAgentMessage(
              `Your price: **€${priceNum}**\nMarket analysis suggests: **€${suggested}** (${confidenceLabel} confidence)${reasoning ? `\n\n💡 ${reasoning}` : ""}${comparableListings ? `\n📊 Based on ${comparableListings} comparable listings` : ""}\n\nNow, how quickly do you want to sell? This affects my pricing strategy:`,
              URGENCY_OPTIONS.map((u) => ({ label: `${u.label}`, value: `urgency_${u.value}` }))
            );
          } else {
            updateData({ aiSuggestedPrice: null });
            addAgentMessage(
              `Your price: **€${priceNum}**\n⚠️ AI pricing unavailable — I'll use your entered price.\n\nHow quickly do you want to sell? This affects my pricing strategy:`,
              URGENCY_OPTIONS.map((u) => ({ label: `${u.label}`, value: `urgency_${u.value}` }))
            );
          }
        } else {
          await thinkAndRespond("I need a valid price in euros. Just type a number like 150 or 29.99");
        }
        break;

      case "urgency":
        // Try to match urgency from text
        const urgencyMatch = URGENCY_OPTIONS.find((u) =>
          content.toLowerCase().includes(u.label.toLowerCase().replace("within ", ""))
        );
        if (urgencyMatch) {
          updateData({ urgency: urgencyMatch.value });
        }
        setCurrentStep("agent_config");
        await thinkAndRespond(
          `I'll base my pricing strategy on that timeline.\n\nNow, what's the absolute **minimum price** you'd accept? I won't go below this, even under deadline pressure.\n\nType a number (EUR), or say "no minimum" if price is flexible.`,
        );
        break;

      case "agent_config":
        if (content.toLowerCase().includes("no min")) {
          updateData({ minimumPrice: Math.round(data.price * 0.5) });
        } else {
          const minNum = parseFloat(content.replace(/[€,\s]/g, ""));
          if (!isNaN(minNum) && minNum > 0) {
            updateData({ minimumPrice: minNum });
          } else {
            updateData({ minimumPrice: Math.round(data.price * 0.7) });
          }
        }
        setCurrentStep("summary");
        const minP = data.minimumPrice || Math.round(data.price * 0.7);
        await thinkAndRespond(
          `Here's my plan:\n\n🏷️ **${data.title || "Your item"}**\n💰 Starting at **€${data.price}** → minimum **€${minP}**\n⏱️ ${URGENCY_OPTIONS.find((u) => u.value === data.urgency)?.label || "1 week"}\n\n**My strategy:**\n• Start at your price to test the market\n• Auto-respond to buyer questions 24/7\n• Dynamically adjust price based on engagement\n• Alert you when offers come in\n\nReady to go live?`,
          [
            { label: "🚀 Launch agent!", value: "publish" },
            { label: "📝 Save as draft", value: "draft" },
            { label: "🔙 Change something", value: "edit" },
          ]
        );
        break;

      default:
        await thinkAndRespond("Could you tell me more?");
    }
  };

  // Handle action button clicks
  const handleAction = async (value: string) => {
    addUserMessage(
      value === "upload_photos" ? "I'll upload photos" :
      value === "describe_first" ? "I'll describe it first" :
      value === "confirm_details" ? "Looks good!" :
      value === "edit_details" ? "I want to edit" :
      value === "publish" ? "Launch my agent!" :
      value === "draft" ? "Save as draft" :
      value
    );

    if (value === "upload_photos") {
      fileInputRef.current?.click();
      return;
    }

    if (value === "describe_first") {
      setCurrentStep("confirm_details");
      await thinkAndRespond("No problem! Just describe what you're selling — brand, condition, any notable features.");
      return;
    }

    if (value.startsWith("cat_")) {
      const catId = value.replace("cat_", "");
      const cat = categories.find((c) => c.id === catId);
      const catName = cat ? (typeof cat.name === "object" ? (cat.name as Record<string, string>)[locale] || (cat.name as Record<string, string>).en || cat.slug : cat.name as string) : "";
      updateData({ categoryId: catId, categoryName: catName });
      setCurrentStep("pricing");
      await thinkAndRespond(
        `${catName} — great choice!\n\nWhat price did you have in mind? I'll compare against market data and suggest an optimal starting price.\n\nJust type a number (EUR).`,
      );
      return;
    }

    if (value.startsWith("urgency_")) {
      const urgencyVal = value.replace("urgency_", "");
      const urgency = URGENCY_OPTIONS.find((u) => u.value === urgencyVal);
      updateData({ urgency: urgencyVal });
      setCurrentStep("agent_config");
      await thinkAndRespond(
        `**${urgency?.label}** — ${urgency?.desc}.\n\nNow, what's the absolute **minimum price** you'd accept? I'll never go below this.\n\nType a number (EUR).`,
      );
      return;
    }

    if (value === "confirm_details") {
      setCurrentStep("category");
      await thinkAndRespond(
        "Which category fits best?",
        categories.slice(0, 6).map((c) => ({
          label: typeof c.name === "object" ? (c.name as Record<string, string>)[locale] || (c.name as Record<string, string>).en || c.slug : c.name as string,
          value: `cat_${c.id}`,
        }))
      );
      return;
    }

    if (value === "edit_details") {
      setCurrentStep("confirm_details");
      await thinkAndRespond("Sure! What would you like to change? You can adjust the title, description, or add more details.");
      return;
    }

    if (value === "publish" || value === "draft") {
      // Validate required fields before submission
      const missing: string[] = [];
      if (!data.title || data.title.trim().length < 5) missing.push("title (min 5 chars)");
      if (!data.description || data.description.trim().length < 20) {
        // Auto-generate a minimal description if user didn't provide enough
        if (data.title && data.description.length < 20) {
          const autoDesc = `${data.title}. ${data.categoryName ? `Category: ${data.categoryName}. ` : ""}Condition: ${data.condition}. Price: €${data.price}.`;
          updateData({ description: autoDesc.length >= 20 ? autoDesc : autoDesc + " Contact seller for more details." });
        } else {
          missing.push("description (min 20 chars)");
        }
      }
      if (!data.price || data.price <= 0) missing.push("price");
      if (!data.categoryId) missing.push("category");

      if (missing.length > 0) {
        addAgentMessage(
          `I need a few more details before I can create this listing:\n\n${missing.map((m) => `• Missing: **${m}**`).join("\n")}\n\nLet me walk you through the missing steps.`,
          [{ label: "📝 Fill in details", value: "edit" }]
        );
        return;
      }

      setCurrentStep("publishing");
      setIsSubmitting(true);
      try {
        const formData = new FormData();
        formData.append("title", data.title.trim());
        formData.append("description", data.description.trim());
        formData.append("categoryId", data.categoryId);
        formData.append("condition", data.condition);
        if (data.locationId) formData.append("locationId", data.locationId);
        formData.append("price", String(data.price));
        formData.append("status", value === "draft" ? "DRAFT" : "ACTIVE");

        if (value === "publish") {
          formData.append("agent[enabled]", "true");
          formData.append("agent[autoRespond]", String(data.autoRespond));
          formData.append("agent[autoNegotiate]", String(data.autoNegotiate));
          formData.append("agent[autoBoost]", String(data.autoBoost));
          formData.append("agent[urgency]", data.urgency);
          formData.append("agent[minPrice]", String(data.minimumPrice));
        }

        data.photos.forEach((photo) => formData.append("photos", photo));

        const response = await fetch("/api/listings", { method: "POST", body: formData });

        if (response.ok) {
          const result = await response.json();
          setCurrentStep("done");
          addAgentMessage(
            value === "draft"
              ? `Your listing has been saved as a **draft**! You can find it in your profile and publish it when you're ready.`
              : `Your listing is live and I'm on the job! Here's what I'll be doing:\n\n✅ Monitoring views and engagement\n✅ Responding to buyer questions\n✅ Adjusting price based on market data\n✅ Sending you daily summaries\n\nI'll message you when there's important activity. Good luck! 🎉`,
            [{ label: "View my listing", value: `goto_/listing/${result.slug || result.id}` }]
          );
        } else if (response.status === 401) {
          addAgentMessage(
            `You need to be **signed in** to create a listing. Please sign in and try again.`,
            [{ label: "🔑 Sign in", value: `goto_/auth/signin?callbackUrl=/${locale}/sell` }]
          );
        } else {
          const errorData = await response.json().catch(() => null);
          const errorMsg = errorData?.error || `Server error (${response.status})`;
          addAgentMessage(`There was an issue creating the listing: **${errorMsg}**\n\nPlease try again or edit details.`, [
            { label: "🔄 Retry", value: value },
            { label: "📝 Edit details", value: "edit" },
          ]);
        }
      } catch {
        addAgentMessage("Something went wrong — couldn't reach the server. Please check your connection and try again.", [
          { label: "🔄 Retry", value: value },
        ]);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (value.startsWith("goto_")) {
      window.location.href = `/${locale}${value.replace("goto_", "")}`;
      return;
    }

    if (value === "edit") {
      setCurrentStep("confirm_details");
      await thinkAndRespond("What would you like to change? Title, price, urgency, or something else?");
      return;
    }

    // Default: treat as text input
    await handleSendMessage(value);
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress indicator */}
      <div className="mb-6 flex items-center gap-2 px-2">
        {(["photos", "details", "pricing", "agent", "launch"] as const).map((label, i) => {
          const stepMap: Record<string, number> = {
            greeting: 0, photos: 0, analyzing: 0,
            confirm_details: 1, category: 1,
            pricing: 2, urgency: 2,
            agent_config: 3, summary: 3,
            publishing: 4, done: 4,
          };
          const current = stepMap[currentStep] ?? 0;
          const isActive = i === current;
          const isCompleted = i < current;
          return (
            <div key={label} className="flex items-center flex-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-all ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCompleted
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < 4 && (
                <div className={`mx-1 h-0.5 flex-1 ${i < current ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Chat messages */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex h-[min(500px,60vh)] flex-col">
            {/* Agent header */}
            <div className="flex items-center gap-3 border-b px-4 py-3 bg-primary/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Selling Agent</p>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[11px] text-muted-foreground">
                    {currentStep === "done" ? "Agent active — monitoring your listing" : "Helping you create the perfect listing"}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      msg.role === "agent" ? "bg-primary/10 text-primary" : "bg-muted"
                    }`}
                  >
                    {msg.role === "agent" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex max-w-[85%] flex-col gap-1.5">
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      {msg.content.split("**").map((part, i) =>
                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                      )}
                    </div>

                    {/* Inline component */}
                    {msg.component}

                    {/* Action buttons */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.actions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => handleAction(action.value)}
                            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:border-primary"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Photo previews inline */}
              {data.photoPreviews.length > 0 && currentStep === "analyzing" && (
                <div className="flex gap-2 overflow-x-auto py-2">
                  {data.photoPreviews.map((preview, i) => (
                    <div key={i} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Thinking indicator */}
              {(isThinking || isSubmitting) && (
                <div className="flex gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "300ms" }} />
                      </div>
                      {isSubmitting && <span className="text-xs text-muted-foreground ml-2">Publishing your listing...</span>}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t p-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                </Button>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    currentStep === "pricing" ? "Enter price in EUR..."
                    : currentStep === "agent_config" ? "Minimum price in EUR..."
                    : "Type a message..."
                  }
                  disabled={isThinking || isSubmitting || currentStep === "done"}
                  className="rounded-full text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isThinking || isSubmitting}
                  className="shrink-0 rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy explanation */}
      {currentStep === "done" && (
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
                <p className="text-xs text-muted-foreground">AI answers buyer questions 24/7</p>
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
                <p className="text-xs text-muted-foreground">Dynamic price optimization</p>
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
                <p className="text-xs text-muted-foreground">Handles offers within your rules</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
