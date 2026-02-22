"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Bot,
  User,
  Sparkles,
  ShoppingBag,
  Tag,
  HelpCircle,
  Search,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgentIntent } from "@/types";
import { useUiStore } from "@/stores/useUiStore";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: SuggestedAction[];
  intent?: AgentIntent;
}

interface SuggestedAction {
  label: string;
  action: string;
  url?: string;
}

const INTENT_ROUTES: Record<string, string> = {
  sell_start: "/sell",
  sell_upload: "/sell",
  sell_describe: "/sell",
  sell: "/sell",
  buy_start: "/search",
  buy_describe: "/search",
  buy: "/search",
  browse: "/search",
  browse_categories: "/",
  browse_featured: "/",
  search: "/search",
  support_account: "/profile",
  support_billing: "/pricing",
  support_listing: "/profile",
};

const INTENT_ICONS: Record<AgentIntent, React.ReactNode> = {
  sell: <Tag className="h-3 w-3" />,
  buy: <ShoppingBag className="h-3 w-3" />,
  support: <HelpCircle className="h-3 w-3" />,
  browse: <Search className="h-3 w-3" />,
  other: <Sparkles className="h-3 w-3" />,
};

export function ConciergeChat({ locale = "en" }: { locale?: string }) {
  const t = useTranslations("concierge");
  const router = useRouter();
  const { conciergeMinimized, setConciergeMinimized } = useUiStore();
  const [isOpen, setIsOpen] = useState(false);
  const isMinimized = conciergeMinimized;
  const setIsMinimized = setConciergeMinimized;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<AgentIntent | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Add greeting on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "greeting",
          role: "assistant",
          content: t("greeting"),
          timestamp: new Date(),
          actions: [
            { label: t("suggestions.0"), action: "sell" },
            { label: t("suggestions.1"), action: "buy" },
            { label: t("suggestions.2"), action: "browse" },
          ],
        },
      ]);
    }
  }, [isOpen, messages.length, t]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        // Build conversation history for context memory
        const conversationHistory = messages.slice(-10).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const response = await fetch("/api/concierge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content.trim(),
            locale,
            conversationHistory,
          }),
        });

        if (!response.ok) throw new Error("Failed to get response");

        const data = await response.json();
        const intent = data.intent as AgentIntent;

        // Update current intent for visual indicator
        if (intent && intent !== "other") {
          setCurrentIntent(intent);
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
          intent,
          actions: data.suggestedActions?.map(
            (a: { label: string; action: string; url?: string }) => ({
              label: a.label,
              action: a.action,
              url: a.url,
            }),
          ),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // If minimized, increment unread
        if (isMinimized) {
          setUnreadCount((c) => c + 1);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content:
              t("error") ||
              "Sorry, I'm having trouble right now. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, locale, messages, isMinimized, t],
  );

  const handleActionClick = (action: SuggestedAction) => {
    const route = INTENT_ROUTES[action.action];
    if (route) {
      router.push(`/${locale}${route}`);
      return;
    }
    if (action.url) {
      router.push(`/${locale}${action.url}`);
      return;
    }
    // Otherwise send as message to continue conversation
    sendMessage(action.label);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleRestore = () => {
    setIsMinimized(false);
    setUnreadCount(0);
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={handleOpen}
              size="lg"
              className="h-14 w-14 rounded-full shadow-xl hover:shadow-2xl relative"
            >
              <Sparkles className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized bar */}
      <AnimatePresence>
        {isOpen && isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <button
              onClick={handleRestore}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-xl hover:shadow-2xl transition-shadow"
            >
              <Bot className="h-5 w-5" />
              <span className="text-sm font-medium">{t("title")}</span>
              {unreadCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 flex h-[min(600px,80vh)] w-[min(400px,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t("title")}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    <p className="text-[10px] opacity-80">
                      Online{currentIntent ? ` • ${currentIntent} mode` : ""}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={handleMinimize}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => {
                    setIsOpen(false);
                    setIsMinimized(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Intent indicator */}
            {currentIntent && currentIntent !== "other" && (
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-1.5">
                <span className="text-muted-foreground">
                  {INTENT_ICONS[currentIntent]}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {currentIntent === "sell" &&
                    "Selling mode — I'll help you list your item"}
                  {currentIntent === "buy" &&
                    "Buying mode — I'll help you find what you need"}
                  {currentIntent === "support" &&
                    "Support mode — Let me help with your issue"}
                  {currentIntent === "browse" &&
                    "Browse mode — Exploring listings"}
                </span>
                <button
                  onClick={() => setCurrentIntent(null)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      message.role === "assistant"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <Bot className="h-3.5 w-3.5" />
                    ) : (
                      <User className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex max-w-[80%] flex-col gap-1">
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      {message.content}
                    </div>

                    {/* Intent badge */}
                    {message.intent && message.intent !== "other" && (
                      <div className="flex items-center gap-1 px-1">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary flex items-center gap-1">
                          {INTENT_ICONS[message.intent]}
                          {message.intent}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    {message.actions && message.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {message.actions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => handleActionClick(action)}
                            className="rounded-full border bg-background px-3 py-1 text-xs transition-colors hover:bg-accent hover:border-primary"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <div className="flex gap-1">
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick actions bar */}
            {messages.length <= 1 && (
              <div className="flex gap-1 border-t px-3 py-2 overflow-x-auto">
                {[
                  { label: "Sell an item", action: "sell", icon: Tag },
                  { label: "Find a deal", action: "buy", icon: ShoppingBag },
                  { label: "Browse", action: "browse", icon: Search },
                ].map((qa) => (
                  <button
                    key={qa.action}
                    onClick={() => sendMessage(qa.label)}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-accent hover:border-primary shrink-0"
                  >
                    <qa.icon className="h-3 w-3" />
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="border-t p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex gap-2"
              >
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("placeholder")}
                  disabled={isLoading}
                  className="rounded-full text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="shrink-0 rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
