"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Bot,
  Send,
  User,
  Search,
  MapPin,
  DollarSign,
  Bell,
  Target,
  TrendingDown,
  Shield,
  Check,
  Loader2,
  Sparkles,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

type BuyStep =
  | "greeting"
  | "describe_want"
  | "category"
  | "budget"
  | "location"
  | "condition"
  | "features"
  | "agent_config"
  | "summary"
  | "creating"
  | "done";

interface ChatMsg {
  id: string;
  role: "agent" | "user";
  content: string;
  timestamp: Date;
  actions?: { label: string; value: string }[];
}

const CONDITION_OPTIONS = [
  { value: "ANY", label: "Any condition", desc: "New or used" },
  { value: "NEW", label: "New only", desc: "Sealed / unused" },
  { value: "USED", label: "Used is fine", desc: "Good condition" },
];

const MONITOR_FREQ = [
  { value: "5", label: "Every 5 min", desc: "Never miss a deal" },
  { value: "15", label: "Every 15 min", desc: "Frequent checks" },
  { value: "60", label: "Hourly", desc: "Balanced" },
  { value: "1440", label: "Daily digest", desc: "Once a day" },
];

interface BuyingData {
  searchQuery: string;
  categoryId: string;
  categoryName: string;
  maxPrice: number;
  idealPrice: number;
  locationId: string;
  locationName: string;
  condition: string;
  features: string[];
  monitorFrequency: number;
  autoOffer: boolean;
  autoNegotiate: boolean;
  dealScoreThreshold: number;
}

interface BuyingAgentWizardProps {
  locale: string;
  categories?: { id: string; name: string; slug: string; children?: { id: string; name: string; slug: string }[] }[];
  locations?: { id: string; name: string; slug: string; children?: { id: string; name: string; slug: string }[] }[];
}

export function BuyingAgentWizard({
  locale,
  categories = [],
  locations = [],
}: BuyingAgentWizardProps) {
  const t = useTranslations("agent");

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [currentStep, setCurrentStep] = useState<BuyStep>("greeting");
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<BuyingData>({
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
    (updates: Partial<BuyingData>) => setData((prev) => ({ ...prev, ...updates })),
    [],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const addAgentMessage = (content: string, actions?: { label: string; value: string }[]) => {
    setMessages((prev) => [
      ...prev,
      { id: `agent-${Date.now()}-${Math.random()}`, role: "agent", content, timestamp: new Date(), actions },
    ]);
  };

  const addUserMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content, timestamp: new Date() },
    ]);
  };

  const thinkAndRespond = async (message: string, actions?: { label: string; value: string }[]) => {
    setIsThinking(true);
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));
    setIsThinking(false);
    addAgentMessage(message, actions);
  };

  // Handle text input
  const handleSendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content) return;
    setInput("");
    addUserMessage(content);

    switch (currentStep) {
      case "greeting":
      case "describe_want":
        updateData({ searchQuery: content });
        setCurrentStep("category");
        await thinkAndRespond(
          `Got it — searching for: "${content}"\n\nWhich category should I focus on?`,
          categories.slice(0, 6).map((c) => {
            const name = typeof c.name === "object" ? (c.name as Record<string, string>)[locale] || (c.name as Record<string, string>).en || c.slug : c.name as string;
            return { label: name, value: `cat_${c.id}` };
          }),
        );
        break;

      case "category": {
        const matchedCat = categories.find((c) => {
          const name = typeof c.name === "object" ? (c.name as Record<string, string>)[locale] || (c.name as Record<string, string>).en || "" : c.name as string;
          return name.toLowerCase().includes(content.toLowerCase());
        });
        if (matchedCat) {
          const catName = typeof matchedCat.name === "object" ? (matchedCat.name as Record<string, string>)[locale] || (matchedCat.name as Record<string, string>).en || matchedCat.slug : matchedCat.name as string;
          updateData({ categoryId: matchedCat.id, categoryName: catName });
        }
        setCurrentStep("budget");
        await thinkAndRespond("What's your budget? Tell me:\n\n1. **Maximum** you'd pay\n2. **Ideal** price you'd love to pay\n\nFor example: \"max 500, ideal 350\"");
        break;
      }

      case "budget": {
        const numbers = content.match(/\d+/g)?.map(Number) || [];
        if (numbers.length >= 2) {
          updateData({ maxPrice: Math.max(...numbers), idealPrice: Math.min(...numbers) });
        } else if (numbers.length === 1) {
          updateData({ maxPrice: numbers[0], idealPrice: Math.round(numbers[0] * 0.7) });
        }
        setCurrentStep("location");
        await thinkAndRespond(
          `Budget set: up to **€${data.maxPrice || numbers[0] || 0}**\n\nAny location preference?`,
          [
            ...locations.slice(0, 4).map((l) => ({
              label: typeof l.name === "object" ? (l.name as Record<string, string>)[locale] || (l.name as Record<string, string>).en || l.slug : l.name as string,
              value: `loc_${l.id}`,
            })),
            { label: "🌍 Anywhere", value: "loc_any" },
          ],
        );
        break;
      }

      case "location":
        setCurrentStep("condition");
        await thinkAndRespond(
          "What condition are you okay with?",
          CONDITION_OPTIONS.map((c) => ({ label: `${c.label} — ${c.desc}`, value: `cond_${c.value}` })),
        );
        break;

      case "condition":
        setCurrentStep("agent_config");
        await thinkAndRespond(
          "How often should I check for new listings?\n\nThe more frequently I check, the faster you'll know about new deals.",
          MONITOR_FREQ.map((f) => ({ label: `${f.label} — ${f.desc}`, value: `freq_${f.value}` })),
        );
        break;

      case "agent_config":
        setCurrentStep("summary");
        buildSummary();
        break;

      default:
        await thinkAndRespond("I didn't catch that. Could you clarify?");
    }
  };

  const buildSummary = async () => {
    await thinkAndRespond(
      `Here's my monitoring plan:\n\n🔍 **Looking for:** ${data.searchQuery || "Your item"}\n📂 **Category:** ${data.categoryName || "All"}\n💰 **Budget:** €${data.idealPrice}–€${data.maxPrice}\n📍 **Location:** ${data.locationName || "Anywhere"}\n📊 **Condition:** ${data.condition === "ANY" ? "Any" : data.condition}\n⏱️ **Checking:** Every ${data.monitorFrequency} min\n\n**I will:**\n• Scan every new listing matching your criteria\n• Score each deal (0–100) based on 7 factors\n• Alert you instantly for deals scoring 70+\n• Track price drops on matching listings\n\nShall I start monitoring?`,
      [
        { label: "🚀 Start monitoring!", value: "create_agent" },
        { label: "📝 Adjust criteria", value: "edit" },
      ],
    );
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
        await thinkAndRespond(`What kind of ${query}? Give me some details — brand, model, features, year, etc.`);
      } else {
        setCurrentStep("describe_want");
        await thinkAndRespond("Describe what you're looking for. Be as specific as you can — it helps me find better matches.");
      }
      return;
    }

    if (value.startsWith("cat_")) {
      const catId = value.replace("cat_", "");
      const cat = categories.find((c) => c.id === catId);
      const catName = cat
        ? typeof cat.name === "object" ? (cat.name as Record<string, string>)[locale] || (cat.name as Record<string, string>).en || cat.slug : cat.name as string
        : "";
      updateData({ categoryId: catId, categoryName: catName });
      setCurrentStep("budget");
      await thinkAndRespond("What's your budget?\n\nTell me the **maximum** you'd spend, and optionally your **ideal** price.\n\nExample: \"max 500, ideal 350\"");
      return;
    }

    if (value.startsWith("loc_")) {
      if (value === "loc_any") {
        updateData({ locationName: "Anywhere" });
      } else {
        const locId = value.replace("loc_", "");
        const loc = locations.find((l) => l.id === locId);
        const locName = loc
          ? typeof loc.name === "object" ? (loc.name as Record<string, string>)[locale] || (loc.name as Record<string, string>).en || loc.slug : loc.name as string
          : "";
        updateData({ locationId: locId, locationName: locName });
      }
      setCurrentStep("condition");
      await thinkAndRespond(
        "What condition are you okay with?",
        CONDITION_OPTIONS.map((c) => ({ label: `${c.label} — ${c.desc}`, value: `cond_${c.value}` })),
      );
      return;
    }

    if (value.startsWith("cond_")) {
      updateData({ condition: value.replace("cond_", "") });
      setCurrentStep("agent_config");
      await thinkAndRespond(
        "How often should I check for new listings?",
        MONITOR_FREQ.map((f) => ({ label: `${f.label} — ${f.desc}`, value: `freq_${f.value}` })),
      );
      return;
    }

    if (value.startsWith("freq_")) {
      updateData({ monitorFrequency: parseInt(value.replace("freq_", ""), 10) });
      setCurrentStep("summary");
      buildSummary();
      return;
    }

    if (value === "create_agent") {
      setCurrentStep("creating");
      setIsSubmitting(true);
      try {
        const response = await fetch("/api/trpc/agent.createBuying", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            json: {
              searchQuery: data.searchQuery,
              categoryId: data.categoryId || undefined,
              locationId: data.locationId || undefined,
              maxPrice: data.maxPrice,
              idealPrice: data.idealPrice,
              condition: data.condition,
              monitorFrequency: data.monitorFrequency,
              autoOffer: data.autoOffer,
              autoNegotiate: data.autoNegotiate,
              dealScoreThreshold: data.dealScoreThreshold,
            },
          }),
        });

        if (response.ok) {
          setCurrentStep("done");
          addAgentMessage(
            "Your buying agent is live! Here's what happens next:\n\n✅ Scanning marketplace every " +
            data.monitorFrequency +
            " minutes\n✅ Scoring deals with 7-factor analysis\n✅ Instant alerts for great matches (70+ score)\n✅ Price drop tracking on top matches\n\nI'll message you the moment I find something good. 🎯",
            [
              { label: "View my agents", value: "goto_/agents" },
              { label: "Create another", value: "reset" },
            ],
          );
        } else {
          addAgentMessage("Something went wrong creating the agent. Let me try again.", [
            { label: "🔄 Retry", value: "create_agent" },
          ]);
        }
      } catch {
        addAgentMessage("Connection error. Please try again.", [
          { label: "🔄 Retry", value: "create_agent" },
        ]);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (value === "edit") {
      setCurrentStep("describe_want");
      await thinkAndRespond("What would you like to change? You can update the search, budget, location, or monitoring frequency.");
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
        addAgentMessage(
          "Welcome back! What are you looking for this time?",
          [
            { label: "🚗 A vehicle", value: "want_vehicle" },
            { label: "🏠 An apartment", value: "want_apartment" },
            { label: "📱 Electronics", value: "want_electronics" },
            { label: "🔍 Something else", value: "want_other" },
          ],
        );
      }, 100);
      return;
    }

    await handleSendMessage(value);
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-2 px-2">
        {(["search", "budget", "location", "config", "launch"] as const).map((label, i) => {
          const stepMap: Record<string, number> = {
            greeting: 0, describe_want: 0,
            category: 1, budget: 1,
            location: 2, condition: 2,
            features: 3, agent_config: 3,
            summary: 4, creating: 4, done: 4,
          };
          const current = stepMap[currentStep] ?? 0;
          const isActive = i === current;
          const isCompleted = i < current;
          return (
            <div key={label} className="flex items-center flex-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-all ${
                  isActive ? "border-primary bg-primary text-primary-foreground"
                  : isCompleted ? "border-primary bg-primary/10 text-primary"
                  : "border-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < 4 && <div className={`mx-1 h-0.5 flex-1 ${i < current ? "bg-primary" : "bg-muted"}`} />}
            </div>
          );
        })}
      </div>

      {/* Chat */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex h-[min(500px,60vh)] flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 border-b px-4 py-3 bg-blue-500/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                <Search className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Buying Agent</p>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[11px] text-muted-foreground">
                    {currentStep === "done" ? "Monitoring marketplace for you" : "Setting up your search agent"}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      msg.role === "agent" ? "bg-blue-500/10 text-blue-500" : "bg-muted"
                    }`}
                  >
                    {msg.role === "agent" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex max-w-[85%] flex-col gap-1.5">
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-blue-500 text-white rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      {msg.content.split("**").map((part, i) =>
                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
                      )}
                    </div>
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.actions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => handleAction(action.value)}
                            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:border-blue-500"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(isThinking || isSubmitting) && (
                <div className="flex gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "300ms" }} />
                      </div>
                      {isSubmitting && <span className="text-xs text-muted-foreground ml-2">Creating your agent...</span>}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-3">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="flex gap-2"
              >
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    currentStep === "budget" ? "e.g. max 500, ideal 350"
                    : currentStep === "describe_want" ? "Describe what you want..."
                    : "Type a message..."
                  }
                  disabled={isThinking || isSubmitting || currentStep === "done"}
                  className="rounded-full text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isThinking || isSubmitting}
                  className="shrink-0 rounded-full bg-blue-500 hover:bg-blue-600"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent features after done */}
      {currentStep === "done" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 grid gap-4 sm:grid-cols-3"
        >
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-full bg-blue-500/10 p-2">
                <Eye className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium">24/7 Monitoring</p>
                <p className="text-xs text-muted-foreground">Continuous marketplace scanning</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-full bg-green-500/10 p-2">
                <Target className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Deal Scoring</p>
                <p className="text-xs text-muted-foreground">7-factor analysis (0–100)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-full bg-purple-500/10 p-2">
                <TrendingDown className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Price Tracking</p>
                <p className="text-xs text-muted-foreground">Alerts on price drops</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
