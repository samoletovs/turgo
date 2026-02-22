"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import type {
  BuyingWizardStep,
  ChatMsg,
  ChatAction,
  BuyingWizardData,
  CategoryItem,
  LocationItem,
  BuyingStepContext,
} from "./types";
import { handleSearchInput } from "./SearchStep";
import { handleCategoryInput, handleCategoryAction } from "./CategoryStep";
import { handleBudgetInput } from "./BudgetStep";
import { handleLocationInput, handleLocationAction } from "./LocationStep";
import { handleConditionInput, handleConditionAction } from "./ConditionStep";
import { handleAgentConfigInput, buildBuyingSummary } from "./AgentConfigStep";

export function useBuyingWizard({
  locale,
  categories,
  locations,
}: {
  locale: string;
  categories: CategoryItem[];
  locations: LocationItem[];
}) {
  const _t = useTranslations("agent");

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [currentStep, setCurrentStep] = useState<BuyingWizardStep>("greeting");
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<BuyingWizardData>({
    searchQuery: "",
    categoryId: "",
    categoryName: "",
    maxPrice: 0,
    idealPrice: 0,
    locationId: "",
    locationName: "",
    condition: "ANY",
    features: [],
    monitorFrequency: 5,
    autoOffer: false,
    autoNegotiate: false,
    dealScoreThreshold: 70,
  });

  const updateData = useCallback(
    (updates: Partial<BuyingWizardData>) =>
      setData((prev) => ({ ...prev, ...updates })),
    [],
  );

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addAgentMessage = useCallback(
    (content: string, actions?: ChatAction[]) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}-${Math.random()}`,
          role: "agent",
          content,
          timestamp: new Date(),
          actions,
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
    async (message: string, actions?: ChatAction[]) => {
      setIsThinking(true);
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));
      setIsThinking(false);
      addAgentMessage(message, actions);
    },
    [addAgentMessage],
  );

  // Create buying agent mutation
  const createBuyingAgent = trpc.agent.createBuying.useMutation({
    onSuccess: (agent) => {
      setCurrentStep("done");
      addAgentMessage(
        "Your buying agent is live! Here's what happens next:\n\n" +
          "✅ Scanning marketplace every " +
          data.monitorFrequency +
          " minutes\n" +
          "✅ Scoring deals with 7-factor analysis\n" +
          "✅ Instant alerts for great matches (70+ score)\n" +
          "✅ Price drop tracking on top matches\n\n" +
          "I'll message you the moment I find something good. 🎯",
        [
          { label: "View my agent", value: `goto_/agents/${agent.id}` },
          { label: "View all agents", value: "goto_/agents" },
          { label: "Create another", value: "reset" },
        ],
      );
    },
    onError: (error) => {
      addAgentMessage(
        `Something went wrong: **${error.message}**\n\nPlease try again.`,
        [{ label: "🔄 Retry", value: "create_agent" }],
      );
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      addAgentMessage(
        "Hi! I'm your buying agent. I'll continuously scan the marketplace for exactly what you want and alert you the moment a great deal appears.\n\nWhat are you looking for?",
        [
          { label: "🚗 A vehicle", value: "want_vehicle" },
          { label: "🏠 An apartment", value: "want_apartment" },
          { label: "📱 Electronics", value: "want_electronics" },
          { label: "🔍 Something else", value: "want_other" },
        ],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build step context for handlers
  const ctx: BuyingStepContext = {
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
    createBuyingAgent,
  };

  // Handle text input – dispatch to current step handler
  const handleSendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content) return;
    setInput("");
    addUserMessage(content);

    switch (currentStep) {
      case "greeting":
      case "describe_want":
        await handleSearchInput(content, ctx);
        break;
      case "category":
        await handleCategoryInput(content, ctx);
        break;
      case "budget":
        await handleBudgetInput(content, ctx);
        break;
      case "location":
        await handleLocationInput(content, ctx);
        break;
      case "condition":
        await handleConditionInput(content, ctx);
        break;
      case "agent_config":
        await handleAgentConfigInput(content, ctx);
        break;
      default:
        await thinkAndRespond("I didn't catch that. Could you clarify?");
    }
  };

  // Handle action button clicks
  const handleAction = async (value: string) => {
    const labelMap: Record<string, string> = {
      want_vehicle: "I'm looking for a vehicle",
      want_apartment: "Looking for an apartment",
      want_electronics: "Looking for electronics",
      want_other: "I'll describe what I need",
      loc_any: "Anywhere is fine",
      create_agent: "Start monitoring!",
      edit: "Let me adjust",
    };

    addUserMessage(labelMap[value] || value);

    // Quick category shortcuts
    if (value.startsWith("want_")) {
      const wantMap: Record<string, string> = {
        want_vehicle: "vehicle",
        want_apartment: "apartment",
        want_electronics: "electronics",
      };
      const query = wantMap[value];
      if (query) {
        updateData({ searchQuery: query });
        setCurrentStep("describe_want");
        await thinkAndRespond(
          `What kind of ${query}? Give me some details — brand, model, features, year, etc.`,
        );
      } else {
        setCurrentStep("describe_want");
        await thinkAndRespond(
          "Describe what you're looking for. Be as specific as you can — it helps me find better matches.",
        );
      }
      return;
    }

    if (value.startsWith("cat_")) {
      await handleCategoryAction(value, ctx);
      return;
    }

    if (value.startsWith("loc_")) {
      await handleLocationAction(value, ctx);
      return;
    }

    if (value.startsWith("cond_")) {
      await handleConditionAction(value, ctx);
      return;
    }

    if (value.startsWith("freq_")) {
      updateData({
        monitorFrequency: parseInt(value.replace("freq_", ""), 10),
      });
      setCurrentStep("summary");
      await buildBuyingSummary(ctx);
      return;
    }

    if (value === "create_agent") {
      setCurrentStep("creating");
      setIsSubmitting(true);
      createBuyingAgent.mutate({
        searchCriteria: {
          keywords: data.searchQuery || undefined,
          categoryId: data.categoryId || undefined,
          locationId: data.locationId || undefined,
          maxPrice: data.maxPrice || undefined,
          condition:
            data.condition !== "ANY"
              ? (data.condition as "NEW" | "USED" | "REFURBISHED")
              : undefined,
        },
        maxBudget: data.maxPrice,
        targetPrice: data.idealPrice || undefined,
        autoNegotiate: data.autoNegotiate,
        maxAutoOfferPrice: data.autoOffer ? data.idealPrice : undefined,
        notifyPush: true,
        notifyEmail: true,
      });
      return;
    }

    if (value === "edit") {
      setCurrentStep("describe_want");
      await thinkAndRespond(
        "What would you like to change? You can update the search, budget, location, or monitoring frequency.",
      );
      return;
    }

    if (value.startsWith("goto_")) {
      window.location.href = `/${locale}${value.replace("goto_", "")}`;
      return;
    }

    if (value === "reset") {
      setMessages([]);
      setCurrentStep("greeting");
      setData({
        searchQuery: "",
        categoryId: "",
        categoryName: "",
        maxPrice: 0,
        idealPrice: 0,
        locationId: "",
        locationName: "",
        condition: "ANY",
        features: [],
        monitorFrequency: 5,
        autoOffer: false,
        autoNegotiate: false,
        dealScoreThreshold: 70,
      });
      // Re-trigger greeting
      setTimeout(() => {
        addAgentMessage("Welcome back! What are you looking for this time?", [
          { label: "🚗 A vehicle", value: "want_vehicle" },
          { label: "🏠 An apartment", value: "want_apartment" },
          { label: "📱 Electronics", value: "want_electronics" },
          { label: "🔍 Something else", value: "want_other" },
        ]);
      }, 100);
      return;
    }

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
    handleSendMessage,
    handleAction,
  };
}
