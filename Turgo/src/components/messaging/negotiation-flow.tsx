"use client";

import { cn, formatPrice } from "@/lib/utils";
import { motion } from "framer-motion";
import { Bot, TrendingDown, TrendingUp, Check, X, ArrowRight } from "lucide-react";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

interface NegotiationMessage {
  id: string;
  messageType: string;
  isOwn: boolean;
  isAgentMessage: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
}

interface NegotiationFlowProps {
  messages: NegotiationMessage[];
  listingPrice: number;
  currency: string;
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────

export function NegotiationFlow({
  messages,
  listingPrice,
  currency,
}: NegotiationFlowProps) {
  if (messages.length === 0) return null;

  const lastMessage = messages[messages.length - 1];
  const isAccepted = lastMessage.messageType === "ACCEPTANCE";
  const isRejected = lastMessage.messageType === "REJECTION";
  const isResolved = isAccepted || isRejected;

  // Build negotiation timeline
  const steps = messages.map((msg) => {
    const offerPrice = (msg.metadata?.offerPrice as number) ?? 0;
    const counterPrice = (msg.metadata?.counterPrice as number) ?? 0;
    const displayPrice = msg.messageType === "COUNTER_OFFER" ? counterPrice : offerPrice;

    return {
      id: msg.id,
      type: msg.messageType,
      price: displayPrice,
      isOwn: msg.isOwn,
      isAgent: msg.isAgentMessage,
      time: new Date(msg.createdAt),
    };
  });

  // Calculate overall negotiation progress
  const firstOffer = steps.find((s) => s.type === "OFFER")?.price ?? 0;
  const lastOffer =
    steps
      .filter((s) => s.type === "OFFER" || s.type === "COUNTER_OFFER")
      .pop()?.price ?? 0;
  const priceMovement = lastOffer - firstOffer;
  const priceMovementPercent =
    firstOffer > 0 ? ((lastOffer - firstOffer) / firstOffer) * 100 : 0;

  return (
    <div className="border-b bg-muted/30 px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Negotiation</span>
          {isAccepted && (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
              <Check className="h-3 w-3" /> Deal agreed
            </span>
          )}
          {isRejected && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
              <X className="h-3 w-3" /> Declined
            </span>
          )}
          {!isResolved && (
            <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
              In progress · Round {steps.length}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Listed at {formatPrice(listingPrice, currency)}
        </span>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center"
          >
            <div
              className={cn(
                "flex flex-col items-center rounded-lg px-3 py-1.5 text-center min-w-[80px]",
                step.type === "OFFER" && "bg-blue-50 dark:bg-blue-950",
                step.type === "COUNTER_OFFER" &&
                  "bg-orange-50 dark:bg-orange-950",
                step.type === "ACCEPTANCE" && "bg-green-50 dark:bg-green-950",
                step.type === "REJECTION" && "bg-red-50 dark:bg-red-950"
              )}
            >
              <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                {step.isAgent && <Bot className="h-2.5 w-2.5" />}
                <span>{step.isOwn ? "You" : "Them"}</span>
              </div>
              <span
                className={cn(
                  "text-sm font-bold",
                  step.type === "ACCEPTANCE" && "text-green-600",
                  step.type === "REJECTION" && "text-red-600"
                )}
              >
                {step.type === "ACCEPTANCE"
                  ? "✅ Deal"
                  : step.type === "REJECTION"
                    ? "❌"
                    : formatPrice(step.price, currency)}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {step.type === "OFFER"
                  ? "Offer"
                  : step.type === "COUNTER_OFFER"
                    ? "Counter"
                    : step.type === "ACCEPTANCE"
                      ? "Accepted"
                      : "Declined"}
              </span>
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className="h-3 w-3 mx-0.5 text-muted-foreground shrink-0" />
            )}
          </motion.div>
        ))}
      </div>

      {/* Price movement summary */}
      {steps.length > 1 && !isResolved && (
        <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
          {priceMovement >= 0 ? (
            <TrendingUp className="h-3 w-3 text-green-600" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-600" />
          )}
          <span>
            Price moved {priceMovement >= 0 ? "up" : "down"}{" "}
            {formatPrice(Math.abs(priceMovement), currency)} (
            {Math.abs(priceMovementPercent).toFixed(1)}%) over {steps.length}{" "}
            rounds
          </span>
        </div>
      )}
    </div>
  );
}
