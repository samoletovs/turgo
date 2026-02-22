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
import { resolveName } from "./types";
import {
  handlePhotoUpload,
  handleGreetingInput,
  handleConfirmDetailsInput,
  removePhoto,
} from "./PhotoUploadStep";
import { handleCategoryInput, handleCategoryAction } from "./CategoryStep";
import { handlePricingInput } from "./PricingStep";
import { handleUrgencyInput, handleUrgencyAction } from "./UrgencyStep";
import { handleAgentConfigInput } from "./AgentConfigStep";
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
  const _t = useTranslations("sell");
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

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      addAgentMessage(
        "Hey there! I'm your selling agent. Let's get your item listed and sold quickly.\n\nStart by uploading some photos of what you're selling — I'll analyze them and suggest the best title, description, and pricing strategy.",
        [
          { label: "📸 Upload photos", value: "upload_photos" },
          { label: "📝 I'll describe it first", value: "describe_first" },
        ],
      );
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
        await thinkAndRespond("Could you tell me more?");
    }
  };

  // Handle action button clicks
  const handleAction = async (value: string) => {
    addUserMessage(
      value === "upload_photos"
        ? "I'll upload photos"
        : value === "describe_first"
          ? "I'll describe it first"
          : value === "confirm_details"
            ? "Looks good!"
            : value === "edit_details"
              ? "I want to edit"
              : value === "publish"
                ? "Launch my agent!"
                : value === "draft"
                  ? "Save as draft"
                  : value,
    );

    if (value === "upload_photos") {
      fileInputRef.current?.click();
      return;
    }

    if (value === "describe_first") {
      setCurrentStep("confirm_details");
      await thinkAndRespond(
        "No problem! Just describe what you're selling — brand, condition, any notable features.",
      );
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

    if (value === "confirm_details") {
      setCurrentStep("category");
      await thinkAndRespond(
        "Which category fits best?",
        categories.slice(0, 6).map((c) => ({
          label: resolveName(c.name, locale, c.slug),
          value: `cat_${c.id}`,
        })),
      );
      return;
    }

    if (value === "edit_details") {
      setCurrentStep("confirm_details");
      await thinkAndRespond(
        "Sure! What would you like to change? You can adjust the title, description, or add more details.",
      );
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
      await thinkAndRespond(
        "What would you like to change? Title, price, urgency, or something else?",
      );
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
