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
import { resolveName } from "./types";
import { handleSearchInput } from "./SearchStep";
import { handleCategoryInput, handleCategoryAction } from "./CategoryStep";
import { handleBudgetInput } from "./BudgetStep";
import { handleLocationInput, handleLocationAction } from "./LocationStep";
import { handleConditionInput, handleConditionAction } from "./ConditionStep";
import { handleAgentConfigInput, buildBuyingSummary } from "./AgentConfigStep";
import {
  BUYING_STRATEGY_OPTIONS,
  handleBuyingStrategyAction,
} from "./StrategyStep";
import {
  showBuyingAgentProposal,
  handleBuyingProposalAction,
} from "./AgentProposalStep";

export function useBuyingWizard({
  locale,
  categories,
  locations,
}: {
  locale: string;
  categories: CategoryItem[];
  locations: LocationItem[];
}) {
  const t = useTranslations("buy.chat");
  const utils = trpc.useUtils();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [currentStep, setCurrentStep] = useState<BuyingWizardStep>("greeting");
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const greetedRef = useRef(false);

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
    buyingStrategyId: "TIME_ESCALATION",
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
        t("agentLive", { frequency: String(data.monitorFrequency) }),
        [
          { label: t("viewAgent"), value: `goto_/agents/${agent.id}` },
          { label: t("viewAllAgents"), value: "goto_/agents" },
          { label: t("createAnother"), value: "reset" },
        ],
      );
    },
    onError: (error) => {
      addAgentMessage(t("createError", { error: error.message }), [
        { label: t("retryCreate"), value: "create_agent" },
      ]);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Initial greeting (ref guard prevents Strict Mode double-fire)
  useEffect(() => {
    if (!greetedRef.current && messages.length === 0) {
      greetedRef.current = true;
      addAgentMessage(t("greeting"), [
        { label: t("wantVehicle"), value: "want_vehicle" },
        { label: t("wantApartment"), value: "want_apartment" },
        { label: t("wantElectronics"), value: "want_electronics" },
        { label: t("wantOther"), value: "want_other" },
      ]);
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
    trpcUtils: utils,
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
      case "strategy":
      case "agent_proposal":
        // These steps are action-button driven, not text-input driven
        await thinkAndRespond(t("unclearInput"));
        break;
      default:
        await thinkAndRespond(t("unclearInput"));
    }
  };

  // Resolve a user-friendly label for action button clicks
  const resolveActionLabel = (value: string): string => {
    const staticMap: Record<string, string> = {
      want_vehicle: "I'm looking for a vehicle",
      want_apartment: "Looking for an apartment",
      want_electronics: "Looking for electronics",
      want_other: "I'll describe what I need",
      loc_any: "Anywhere is fine",
      create_agent: "Start monitoring!",
      edit: "Let me adjust",
      reset: "Create another",
      auto_all: "Enable all automation",
      auto_monitor_only: "Monitor only",
      no_agent: "No agent needed",
    };
    if (staticMap[value]) return staticMap[value];
    if (value.startsWith("cat_")) {
      const catId = value.replace("cat_", "");
      const cat = categories.find((c) => c.id === catId);
      return cat ? resolveName(cat.name, locale, cat.slug) : value;
    }
    if (value.startsWith("loc_")) {
      const locId = value.replace("loc_", "");
      const loc = locations.find((l) => l.id === locId);
      return loc ? resolveName(loc.name, locale, loc.slug) : value;
    }
    if (value.startsWith("cond_")) {
      const condMap: Record<string, string> = {
        ANY: "Any condition",
        NEW: "New only",
        USED: "Used is fine",
      };
      return condMap[value.replace("cond_", "")] || value;
    }
    if (value.startsWith("freq_")) {
      const freqMap: Record<string, string> = {
        "5": "Every 5 min",
        "15": "Every 15 min",
        "60": "Hourly",
        "1440": "Daily digest",
      };
      return freqMap[value.replace("freq_", "")] || value;
    }
    if (value.startsWith("strategy_")) {
      const sid = value.replace("strategy_", "");
      const opt = BUYING_STRATEGY_OPTIONS.find((o) => o.value === sid);
      return opt ? t(opt.i18nKey).split(" — ")[0] : value;
    }
    if (value.startsWith("goto_")) return "View agent";
    return value;
  };

  // Handle action button clicks
  const handleAction = async (value: string) => {
    addUserMessage(resolveActionLabel(value));

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
        const detailsKey = `${query}Details` as
          | "vehicleDetails"
          | "apartmentDetails"
          | "electronicsDetails";
        await thinkAndRespond(t(detailsKey));
      } else {
        setCurrentStep("describe_want");
        await thinkAndRespond(t("otherDetails"));
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
      // After frequency is set, always advance to strategy selection
      ctx.setCurrentStep("strategy");
      await thinkAndRespond(
        t("chooseBuyingStrategy"),
        BUYING_STRATEGY_OPTIONS.map((o) => ({
          label: t(o.i18nKey),
          value: `strategy_${o.value}`,
        })),
      );
      return;
    }

    // Strategy selection → show agent proposal
    if (value.startsWith("strategy_")) {
      const strategyId = value.replace("strategy_", "") as
        | "TIME_ESCALATION"
        | "MAX_BID"
        | "SNIPER"
        | "ACCEPT_LISTED"
        | "EARLY_BIRD";
      handleBuyingStrategyAction(value, ctx);
      await showBuyingAgentProposal(ctx, strategyId);
      return;
    }

    // Agent proposal actions — user picks automation level
    if (
      value === "auto_all" ||
      value === "auto_monitor_only" ||
      value === "no_agent"
    ) {
      const { skipAgent } = handleBuyingProposalAction(value, ctx);
      if (skipAgent) {
        await thinkAndRespond(t("skipAgentConfirm"), [
          { label: t("adjustCriteria"), value: "edit" },
        ]);
      } else {
        setCurrentStep("summary");
        await buildBuyingSummary(ctx);
      }
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
        buyingStrategyId: data.buyingStrategyId,
      });
      return;
    }

    if (value === "edit") {
      setCurrentStep("describe_want");
      await thinkAndRespond(t("editPrompt"));
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
        buyingStrategyId: "TIME_ESCALATION",
      });
      // Re-trigger greeting
      setTimeout(() => {
        addAgentMessage(t("welcomeBack"), [
          { label: t("wantVehicle"), value: "want_vehicle" },
          { label: t("wantApartment"), value: "want_apartment" },
          { label: t("wantElectronics"), value: "want_electronics" },
          { label: t("wantOther"), value: "want_other" },
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
