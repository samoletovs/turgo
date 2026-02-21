"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export default function VerifyEmailPage() {
  const t = useTranslations("verifyEmail");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState<"pending" | "success" | "expired">(
    token ? "success" : "pending"
  );
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setResending(false);
  };

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
            <h1 className="mb-2 text-2xl font-bold">{t("success")}</h1>
            <p className="mb-6 text-muted-foreground">{t("successDesc")}</p>
            <Button asChild size="lg">
              <Link href="/dashboard">{t("continue")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold">{t("title")}</h1>
          {email && (
            <p className="mb-2 text-sm">
              {t("sent")}{" "}
              <strong className="text-foreground">{email}</strong>
            </p>
          )}
          <p className="mb-6 text-sm text-muted-foreground">{t("check")}</p>
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={resending}
            className="w-full"
          >
            {resending ? "..." : t("resend")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
