"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, CheckCircle, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    "form" | "sent" | "reset" | "success" | "invalid"
  >(token ? "reset" : "form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setStatus("sent"),
    onError: () => {
      // Still show "sent" to prevent email enumeration
      setStatus("sent");
    },
    onSettled: () => setLoading(false),
  });

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setStatus("success");
      toast.success(t("resetSuccess"));
    },
    onError: (err) => {
      setError(err.message);
      if (err.message.includes("expired")) {
        setStatus("invalid");
      }
      toast.error(err.message);
    },
    onSettled: () => setLoading(false),
  });

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    requestReset.mutate({ email });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError(null);
    resetPassword.mutate({ token: token!, password: newPassword });
  };

  // Success state after password reset
  if (status === "success") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold">{t("resetSuccess")}</h1>
            <p className="mb-6 text-muted-foreground">
              {t("resetSuccessDesc")}
            </p>
            <Button asChild size="lg">
              <Link href="/auth/signin">{t("backToSignIn")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sent confirmation state
  if (status === "sent") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold">{t("sent")}</h1>
            <p className="mb-6 text-muted-foreground">{t("sentDesc")}</p>
            <Button variant="outline" asChild>
              <Link href="/auth/signin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToSignIn")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid / expired token state
  if (status === "invalid") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold">{t("invalidToken")}</h1>
            <p className="mb-6 text-muted-foreground">{t("requestNew")}</p>
            <Button
              onClick={() => {
                setStatus("form");
                setError(null);
              }}
            >
              {t("submit")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reset password form (with token)
  if (status === "reset") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8">
            <div className="mb-6 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <KeyRound className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("newPassword")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "..." : t("resetSubmit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Request reset form
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <div className="mb-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : t("submit")}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button variant="link" asChild>
              <Link href="/auth/signin">
                <ArrowLeft className="mr-1 h-3 w-3" />
                {t("backToSignIn")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
