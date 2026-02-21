"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Globe,
  Bell,
  Palette,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [exporting, setExporting] = useState(false);

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    agentUpdates: true,
    newMessages: true,
    priceAlerts: true,
    marketing: false,
  });

  const tabs = [
    { id: "profile", label: t("profile.title"), icon: User },
    { id: "locale", label: t("locale.title"), icon: Globe },
    { id: "notifications", label: t("notifications.title"), icon: Bell },
    { id: "appearance", label: t("appearance.title"), icon: Palette },
    { id: "data", label: t("data.title"), icon: Shield },
  ];

  const handleSaveProfile = () => {
    toast.success(t("profile.saved"));
  };

  const handleExportData = async () => {
    setExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    toast.success(t("data.exported"));
    setExporting(false);
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
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("profile.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("profile.name")}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("profile.email")}</Label>
                  <Input id="email" value={user.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("profile.phone")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">{t("profile.bio")}</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button onClick={handleSaveProfile}>
                  {t("profile.save")}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === "locale" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("locale.title")}</CardTitle>
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

          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("notifications.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    className="flex items-center justify-between gap-4 py-2"
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
                      checked={notifications[key]}
                      onChange={(e) =>
                        setNotifications((n) => ({
                          ...n,
                          [key]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded"
                    />
                  </label>
                ))}
              </CardContent>
            </Card>
          )}

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

          {activeTab === "data" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("data.export")}</CardTitle>
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
                    {exporting ? t("data.exporting") : t("data.exportBtn")}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">
                    {t("data.delete")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {t("data.deleteDesc")}
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="destructive">{t("data.deleteBtn")}</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("data.delete")}</DialogTitle>
                        <DialogDescription>
                          {t("data.deleteConfirm")}
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="destructive">
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
