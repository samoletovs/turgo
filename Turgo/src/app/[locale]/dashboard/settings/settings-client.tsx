"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  Globe,
  Bell,
  Palette,
  Shield,
  Upload,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeSelect } from "@/components/theme-toggle";
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS } from "@/lib/constants";
import { useRouter, usePathname } from "@/i18n/navigation";
import { toast } from "sonner";

// ── Zod Schemas ──

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().max(20).optional().or(z.literal("")),
  bio: z.string().max(500).optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const notificationsSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  agentUpdates: z.boolean(),
  newMessages: z.boolean(),
  priceAlerts: z.boolean(),
  marketing: z.boolean(),
});

type NotificationsFormData = z.infer<typeof notificationsSchema>;

const privacySchema = z.object({
  marketingOptIn: z.boolean(),
});

type PrivacyFormData = z.infer<typeof privacySchema>;

interface SettingsClientProps {
  locale: string;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function SettingsClient({ locale, user }: SettingsClientProps) {
  const t = useTranslations("settings");
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("profile");
  const [exporting, setExporting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.image || null,
  );

  // ── Profile Form ──
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name || "",
      phone: "",
      bio: "",
    },
  });

  // ── Notifications Form ──
  const notificationsForm = useForm<NotificationsFormData>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      email: true,
      push: true,
      agentUpdates: true,
      newMessages: true,
      priceAlerts: true,
      marketing: false,
    },
  });

  // ── Privacy Form ──
  const privacyForm = useForm<PrivacyFormData>({
    resolver: zodResolver(privacySchema),
    defaultValues: { marketingOptIn: false },
  });

  const tabs = [
    { id: "profile", label: t("profile.title"), icon: User },
    { id: "locale", label: t("locale.title"), icon: Globe },
    { id: "notifications", label: t("notifications.title"), icon: Bell },
    { id: "appearance", label: t("appearance.title"), icon: Palette },
    { id: "data", label: t("data.title"), icon: Shield },
  ];

  const handleSaveProfile = profileForm.handleSubmit(() => {
    toast.success(t("profile.saved"));
  });

  const handleSaveNotifications = notificationsForm.handleSubmit(() => {
    toast.success(t("notifications.saved"));
  });

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
      toast.success(t("profile.avatarUpdated"));
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      // Simulate export
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const exportData = {
        user: { name: user.name, email: user.email },
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "turgo-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("data.exported"));
    } catch {
      toast.error(t("data.exportError"));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmText !== "DELETE") return;
    toast.success(t("data.deleteSuccess"));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar tabs */}
        <nav className="flex lg:w-56 lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {/* ── Profile Tab ── */}
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("profile.title")}</CardTitle>
                <CardDescription>{t("profile.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 rounded-full bg-muted overflow-hidden">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                        />
                        <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
                          <Upload className="h-4 w-4" />
                          {t("profile.changeAvatar")}
                        </span>
                      </label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("profile.avatarHint")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">{t("profile.name")}</Label>
                    <Input id="name" {...profileForm.register("name")} />
                    {profileForm.formState.errors.name && (
                      <p className="text-xs text-destructive">
                        {profileForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t("profile.email")}</Label>
                    <Input id="email" value={user.email || ""} disabled />
                    <p className="text-xs text-muted-foreground">
                      {t("profile.emailHint")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("profile.phone")}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+371 20 000 000"
                      {...profileForm.register("phone")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">{t("profile.bio")}</Label>
                    <Textarea
                      id="bio"
                      rows={3}
                      placeholder={t("profile.bioPlaceholder")}
                      {...profileForm.register("bio")}
                    />
                    {profileForm.formState.errors.bio && (
                      <p className="text-xs text-destructive">
                        {profileForm.formState.errors.bio.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit">{t("profile.save")}</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Locale Tab ── */}
          {activeTab === "locale" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("locale.title")}</CardTitle>
                <CardDescription>{t("locale.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("locale.language")}</Label>
                  <Select
                    value={locale}
                    onValueChange={(newLocale) =>
                      router.replace(pathname, { locale: newLocale })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCALES.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {LOCALE_FLAGS[loc]} {LOCALE_LABELS[loc]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("locale.country")}</Label>
                  <Select defaultValue="LV">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LV">🇱🇻 Latvia</SelectItem>
                      <SelectItem value="LT">🇱🇹 Lithuania</SelectItem>
                      <SelectItem value="EE">🇪🇪 Estonia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("locale.currency")}</Label>
                  <Select defaultValue="EUR">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">€ EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Notifications Tab ── */}
          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("notifications.title")}</CardTitle>
                <CardDescription>
                  {t("notifications.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveNotifications} className="space-y-1">
                  {(
                    [
                      "email",
                      "push",
                      "agentUpdates",
                      "newMessages",
                      "priceAlerts",
                      "marketing",
                    ] as const
                  ).map((key) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-4 rounded-lg px-2 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {t(`notifications.${key}`)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(`notifications.${key}Desc`)}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        {...notificationsForm.register(key)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                    </label>
                  ))}
                  <div className="pt-4">
                    <Button type="submit" size="sm">
                      {t("notifications.saveBtn")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Appearance Tab ── */}
          {activeTab === "appearance" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("appearance.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("appearance.theme")}</Label>
                  <ThemeSelect />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Data & Privacy Tab ── */}
          {activeTab === "data" && (
            <div className="space-y-6">
              {/* Marketing opt-in */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("data.privacy")}</CardTitle>
                  <CardDescription>{t("data.privacyDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">
                        {t("data.marketingOptIn")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("data.marketingOptInDesc")}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      {...privacyForm.register("marketingOptIn")}
                      className="h-4 w-4 rounded accent-primary"
                    />
                  </label>
                </CardContent>
              </Card>

              {/* Export Data */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    {t("data.export")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {t("data.exportDesc")}
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleExportData}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("data.exporting")}
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        {t("data.exportBtn")}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Delete Account */}
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 className="h-5 w-5" />
                    {t("data.delete")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {t("data.deleteDesc")}
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("data.deleteBtn")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("data.delete")}</DialogTitle>
                        <DialogDescription>
                          {t("data.deleteConfirm")}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <Label>{t("data.deleteTypeConfirm")}</Label>
                        <Input
                          placeholder="DELETE"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          variant="destructive"
                          disabled={deleteConfirmText !== "DELETE"}
                          onClick={handleDeleteAccount}
                        >
                          {t("data.deleteConfirmBtn")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
