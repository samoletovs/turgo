"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import type {
  SellingWizardStep,
  ChatMsg,
  ChatAction,
  SellingWizardData,
  CategoryItem,
  LocationItem,
  SellingStepContext,
} from "./types";
import { resolveName, URGENCY_OPTIONS, buildCategoryActions } from "./types";
import {
  handlePhotoUpload,
  handleGreetingInput,
  handleConfirmDetailsInput,
  removePhoto,
} from "./PhotoUploadStep";
import { handleCategoryInput, handleCategoryAction } from "./CategoryStep";
import { handlePricingInput } from "./PricingStep";
import { handleUrgencyInput, handleUrgencyAction } from "./UrgencyStep";
import {
  handleAgentConfigInput,
  buildSellingSummary,
  SELLING_STRATEGY_OPTIONS,
  handleStrategySelection,
} from "./AgentConfigStep";
import { handlePublishAction } from "./ReviewStep";

export function useSellingWizard({
  locale,
  categories,
  locations,
}: {
  locale: string;
  categories: CategoryItem[];
  locations: LocationItem[];
}) {
  const t = useTranslations("sell.chat");
  const _tAgent = useTranslations("agent");
  const utils = trpc.useUtils();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [currentStep, setCurrentStep] = useState<SellingWizardStep>("greeting");
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const greetedRef = useRef(false);

  const [data, setData] = useState<SellingWizardData>({
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
    sellingStrategyId: "SEALED_BID",
  });

  const updateData = useCallback(
    (updates: Partial<SellingWizardData>) =>
      setData((prev) => ({ ...prev, ...updates })),
    [],
  );

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addAgentMessage = useCallback(
    (content: string, actions?: ChatAction[], component?: ReactNode) => {
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
    },
    [],
  );

  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const thinkAndRespond = useCallback(
    async (message: string, actions?: ChatAction[], component?: ReactNode) => {
      setIsThinking(true);
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
      setIsThinking(false);
      addAgentMessage(message, actions, component);
    },
    [addAgentMessage],
  );

  // Initial greeting (ref guard prevents Strict Mode double-fire)
  useEffect(() => {
    if (!greetedRef.current && messages.length === 0) {
      greetedRef.current = true;
      addAgentMessage(t("greeting"), [
        { label: t("uploadPhotos"), value: "upload_photos" },
        { label: t("describeFirst"), value: "describe_first" },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build step context for handlers
  const ctx: SellingStepContext = {
    data,
    updateData,
    setCurrentStep,
    addAgentMessage,
    addUserMessage,
    thinkAndRespond,
    setIsThinking,
    setIsSubmitting,
    setMessages,
    locale,
    categories,
    locations,
    trpcUtils: utils,
    fileInputRef,
    t,
  };

  // Handle text input – dispatch to current step handler
  const handleSendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content) return;
    setInput("");
    addUserMessage(content);

    switch (currentStep) {
      case "greeting":
        await handleGreetingInput(content, ctx);
        break;
      case "confirm_details":
        await handleConfirmDetailsInput(content, ctx);
        break;
      case "category":
        await handleCategoryInput(content, ctx);
        break;
      case "pricing":
        await handlePricingInput(content, ctx);
        break;
      case "urgency":
        await handleUrgencyInput(content, ctx);
        break;
      case "agent_config":
        await handleAgentConfigInput(content, ctx);
        break;
      default:
        await thinkAndRespond(t("tellMore"));
    }
  };

  // Resolve a user-friendly label for action button clicks
  const resolveActionLabel = (value: string): string => {
    if (value === "upload_photos") return "I'll upload photos";
    if (value === "describe_first") return "I'll describe it first";
    if (value === "confirm_details") return "Looks good!";
    if (value === "edit_details" || value === "edit") return "I want to edit";
    if (value === "publish") return "Launch my agent!";
    if (value === "draft") return "Save as draft";
    if (value === "keep_my_price") return `Keep my €${data.price}`;
    if (value === "auto_both") return "Enable both";
    if (value === "auto_negotiate_only") return "Auto-negotiate only";
    if (value === "auto_boost_only") return "Auto-boost only";
    if (value === "auto_none") return "No automation";
    if (value.startsWith("strategy_")) {
      const s = SELLING_STRATEGY_OPTIONS.find(
        (o) => o.value === value.replace("strategy_", ""),
      );
      return s ? s.label : value;
    }
    if (value.startsWith("use_ai_price_")) {
      return `Use €${value.replace("use_ai_price_", "")}`;
    }
    if (value.startsWith("cat_")) {
      const catId = value.replace("cat_", "");
      const cat = categories.find((c) => c.id === catId);
      return cat ? resolveName(cat.name, locale, cat.slug) : value;
    }
    if (value.startsWith("urgency_")) {
      const u = URGENCY_OPTIONS.find(
        (o) => o.value === value.replace("urgency_", ""),
      );
      return u ? u.label : value;
    }
    if (value.startsWith("goto_")) return "View listing";
    return value;
  };

  // Show strategy selection prompt (only when autoNegotiate is enabled)
  const showStrategySelection = async (ctx: SellingStepContext) => {
    await ctx.thinkAndRespond(
      ctx.t("chooseSellingStrategy"),
      SELLING_STRATEGY_OPTIONS.map((s) => ({
        label: `${s.icon} ${s.label}`,
        value: `strategy_${s.value}`,
        desc: s.desc,
      })),
    );
  };

  // Handle action button clicks
  const handleAction = async (value: string) => {
    addUserMessage(resolveActionLabel(value));

    if (value === "upload_photos") {
      fileInputRef.current?.click();
      return;
    }

    if (value === "describe_first") {
      setCurrentStep("confirm_details");
      await thinkAndRespond(t("describePrompt"));
      return;
    }

    if (value.startsWith("cat_")) {
      await handleCategoryAction(value, ctx);
      return;
    }

    if (value.startsWith("urgency_")) {
      await handleUrgencyAction(value, ctx);
      return;
    }

    // AI price suggestion actions
    if (value.startsWith("use_ai_price_")) {
      const aiPrice = parseFloat(value.replace("use_ai_price_", ""));
      if (!isNaN(aiPrice) && aiPrice > 0) {
        updateData({ price: aiPrice });
      }
      setCurrentStep("urgency");
      await thinkAndRespond(
        t("priceUpdated", { price: String(aiPrice) }),
        URGENCY_OPTIONS.map((u) => ({
          label: `${u.label}`,
          value: `urgency_${u.value}`,
        })),
      );
      return;
    }

    if (value === "keep_my_price") {
      setCurrentStep("urgency");
      await thinkAndRespond(
        t("priceKept", { price: String(data.price) }),
        URGENCY_OPTIONS.map((u) => ({
          label: `${u.label}`,
          value: `urgency_${u.value}`,
        })),
      );
      return;
    }

    if (value === "confirm_details") {
      setCurrentStep("category");
      const itemText = `${data.title} ${data.description}`;
      await thinkAndRespond(
        t("whichCategory"),
        buildCategoryActions(categories, itemText, locale),
      );
      return;
    }

    // Automation toggle actions (auto-negotiate / auto-boost)
    if (value === "auto_both") {
      updateData({ autoNegotiate: true, autoBoost: true });
      await showStrategySelection(ctx);
      return;
    }
    if (value === "auto_negotiate_only") {
      updateData({ autoNegotiate: true, autoBoost: false });
      await showStrategySelection(ctx);
      return;
    }
    if (value === "auto_boost_only") {
      updateData({ autoNegotiate: false, autoBoost: true });
      buildSellingSummary(ctx);
      return;
    }
    if (value === "auto_none") {
      updateData({ autoNegotiate: false, autoBoost: false });
      buildSellingSummary(ctx);
      return;
    }

    // Strategy selection actions
    if (value.startsWith("strategy_")) {
      handleStrategySelection(value, ctx);
      buildSellingSummary(ctx);
      return;
    }

    if (value === "edit_details") {
      setCurrentStep("confirm_details");
      await thinkAndRespond(t("changePrompt"));
      return;
    }

    if (value === "publish" || value === "draft") {
      await handlePublishAction(value, ctx);
      return;
    }

    if (value.startsWith("goto_")) {
      window.location.href = `/${locale}${value.replace("goto_", "")}`;
      return;
    }

    if (value === "edit") {
      setCurrentStep("confirm_details");
      await thinkAndRespond(t("changePrompt"));
      return;
    }

    // Default: treat as text input
    await handleSendMessage(value);
  };

  return {
    messages,
    currentStep,
    input,
    setInput,
    isThinking,
    isSubmitting,
    data,
    messagesEndRef,
    inputRef,
    fileInputRef,
    handleSendMessage,
    handleAction,
    onPhotoUpload: (e: ChangeEvent<HTMLInputElement>) =>
      handlePhotoUpload(e, ctx),
    onRemovePhoto: (index: number) => removePhoto(index, ctx),
  };
}
