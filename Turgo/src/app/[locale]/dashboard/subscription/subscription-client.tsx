"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, RotateCcw, XCircle } from "lucide-react";

interface SubscriptionActionsProps {
  hasSubscription: boolean;
  isCancelPending: boolean;
  hasStripeCustomer: boolean;
}

export function SubscriptionActions({
  hasSubscription,
  isCancelPending,
  hasStripeCustomer,
}: SubscriptionActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handlePortal() {
    setLoading("portal");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = await response.json();
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } catch (error) {
      console.error("Portal error:", error);
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel your subscription? You'll retain access until the end of the billing period.")) {
      return;
    }
    setLoading("cancel");
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error("Cancel error:", error);
    } finally {
      setLoading(null);
    }
  }

  async function handleResume() {
    setLoading("resume");
    try {
      const response = await fetch("/api/billing/resume", { method: "POST" });
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error("Resume error:", error);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-3">
      {hasStripeCustomer && (
        <Button
          variant="outline"
          onClick={handlePortal}
          disabled={loading !== null}
          className="gap-1"
        >
          {loading === "portal" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          Manage Billing
        </Button>
      )}

      {hasSubscription && !isCancelPending && (
        <Button
          variant="ghost"
          onClick={handleCancel}
          disabled={loading !== null}
          className="gap-1 text-destructive hover:text-destructive"
        >
          {loading === "cancel" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Cancel
        </Button>
      )}

      {isCancelPending && (
        <Button
          variant="default"
          onClick={handleResume}
          disabled={loading !== null}
          className="gap-1"
        >
          {loading === "resume" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Resume Subscription
        </Button>
      )}
    </div>
  );
}
