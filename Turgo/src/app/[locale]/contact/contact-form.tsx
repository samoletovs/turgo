"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Please select a subject"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000),
});

type ContactFormData = z.infer<typeof contactSchema>;

export function ContactForm() {
  const t = useTranslations("contact");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });

  const contactMutation = trpc.notification.submitContact.useMutation();

  const onSubmit = async (data: ContactFormData) => {
    setSubmitting(true);
    try {
      await contactMutation.mutateAsync(data);
      setSubmitted(true);
      toast.success(t("form.success"));
      reset();
    } catch {
      toast.error(t("form.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Send className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{t("form.successTitle")}</h3>
        <p className="text-muted-foreground">{t("form.successDesc")}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setSubmitted(false)}
        >
          {t("form.sendAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{t("form.name")}</Label>
          <Input
            id="name"
            placeholder={t("form.namePlaceholder")}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("form.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("form.emailPlaceholder")}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">{t("form.subject")}</Label>
        <Select onValueChange={(v) => setValue("subject", v)}>
          <SelectTrigger>
            <SelectValue placeholder={t("form.subjectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">
              {t("form.subjects.general")}
            </SelectItem>
            <SelectItem value="support">
              {t("form.subjects.support")}
            </SelectItem>
            <SelectItem value="billing">
              {t("form.subjects.billing")}
            </SelectItem>
            <SelectItem value="partnership">
              {t("form.subjects.partnership")}
            </SelectItem>
            <SelectItem value="press">{t("form.subjects.press")}</SelectItem>
            <SelectItem value="feedback">
              {t("form.subjects.feedback")}
            </SelectItem>
          </SelectContent>
        </Select>
        {errors.subject && (
          <p className="text-xs text-destructive">{errors.subject.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">{t("form.message")}</Label>
        <Textarea
          id="message"
          rows={5}
          placeholder={t("form.messagePlaceholder")}
          {...register("message")}
        />
        {errors.message && (
          <p className="text-xs text-destructive">{errors.message.message}</p>
        )}
      </div>

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("form.sending")}
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {t("form.send")}
          </>
        )}
      </Button>
    </form>
  );
}
