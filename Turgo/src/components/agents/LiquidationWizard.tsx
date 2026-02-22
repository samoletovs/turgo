"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatPrice } from "@/lib/utils";
import { UPLOAD } from "@/lib/constants";
import {
  Upload,
  Camera,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Package,
  Sparkles,
  Rocket,
  Trash2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface IdentifiedItem {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  description: string;
  suggestedPrice: number;
  confirmedPrice: number;
  category: string;
  selected: boolean;
}

type WizardStep =
  | "upload"
  | "analyzing"
  | "review"
  | "configure"
  | "publishing"
  | "done";

interface LiquidationWizardProps {
  locale: string;
  className?: string;
}

const STEP_LABELS = ["upload", "identify", "review", "launch"] as const;
const STEP_MAP: Record<WizardStep, number> = {
  upload: 0,
  analyzing: 1,
  review: 2,
  configure: 2,
  publishing: 3,
  done: 3,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LiquidationWizard({
  locale: _locale,
  className,
}: LiquidationWizardProps) {
  const t = useTranslations("liquidation");
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [items, setItems] = useState<IdentifiedItem[]>([]);
  const [deadline, setDeadline] = useState("ONE_WEEK");
  const [_isAnalyzing, setIsAnalyzing] = useState(false);
  const [_isPublishing, setIsPublishing] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);

  /* ---------- File handling ---------- */

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const accepted = Array.from(newFiles).filter(
      (f) =>
        UPLOAD.ALLOWED_TYPES.includes(
          f.type as (typeof UPLOAD.ALLOWED_TYPES)[number],
        ) && f.size <= UPLOAD.MAX_FILE_SIZE,
    );
    const newPreviews = accepted.map((f) => URL.createObjectURL(f));
    setFiles((prev) => [...prev, ...accepted]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  }, []);

  const removeFile = useCallback(
    (idx: number) => {
      URL.revokeObjectURL(previews[idx]);
      setFiles((prev) => prev.filter((_, i) => i !== idx));
      setPreviews((prev) => prev.filter((_, i) => i !== idx));
    },
    [previews],
  );

  /* ---------- AI analysis (mock) ---------- */

  const analyzePhotos = useCallback(async () => {
    setStep("analyzing");
    setIsAnalyzing(true);

    try {
      const res = await fetch("/api/listings/analyze-batch", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          files.forEach((f) => fd.append("photos", f));
          return fd;
        })(),
      });

      if (res.ok) {
        const data = await res.json();
        const identified: IdentifiedItem[] = (data.items ?? []).map(
          (item: Record<string, unknown>, idx: number) => ({
            id: `item-${idx}`,
            file: files[idx] ?? files[0],
            previewUrl: previews[idx] ?? previews[0],
            title: (item.title as string) ?? `Item ${idx + 1}`,
            description: (item.description as string) ?? "",
            suggestedPrice: (item.suggestedPrice as number) ?? 10,
            confirmedPrice: (item.suggestedPrice as number) ?? 10,
            category: (item.category as string) ?? "",
            selected: true,
          }),
        );
        setItems(identified);
      } else {
        // Fallback: create one item per photo
        setItems(
          files.map((f, idx) => ({
            id: `item-${idx}`,
            file: f,
            previewUrl: previews[idx],
            title: `Item ${idx + 1}`,
            description: "",
            suggestedPrice: 10,
            confirmedPrice: 10,
            category: "",
            selected: true,
          })),
        );
      }
    } catch {
      // Fallback on error
      setItems(
        files.map((f, idx) => ({
          id: `item-${idx}`,
          file: f,
          previewUrl: previews[idx],
          title: `Item ${idx + 1}`,
          description: "",
          suggestedPrice: 10,
          confirmedPrice: 10,
          category: "",
          selected: true,
        })),
      );
    } finally {
      setIsAnalyzing(false);
      setStep("review");
    }
  }, [files, previews]);

  /* ---------- Publishing ---------- */

  const publishAll = useCallback(async () => {
    setStep("publishing");
    setIsPublishing(true);
    const selected = items.filter((i) => i.selected);
    let published = 0;

    for (const item of selected) {
      try {
        const fd = new FormData();
        fd.append("title", item.title);
        fd.append("description", item.description);
        fd.append("price", String(item.confirmedPrice));
        fd.append("urgency", deadline);
        fd.append("photos", item.file);
        if (item.category) fd.append("category", item.category);

        const res = await fetch("/api/listings", { method: "POST", body: fd });
        if (res.ok) published++;
      } catch {
        // continue with next item
      }
    }

    setPublishedCount(published);
    setIsPublishing(false);
    setStep("done");
  }, [items, deadline]);

  /* ---------- Item editing ---------- */

  const updateItem = useCallback(
    (id: string, updates: Partial<IdentifiedItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...updates } : it)),
      );
    },
    [],
  );

  const toggleItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const selectedCount = items.filter((i) => i.selected).length;
  const totalValue = items
    .filter((i) => i.selected)
    .reduce((s, i) => s + i.confirmedPrice, 0);
  const currentStepIdx = STEP_MAP[step];

  return (
    <div className={cn("mx-auto max-w-3xl", className)}>
      {/* Progress bar */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEP_LABELS.map((label, idx) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                idx <= currentStepIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {idx < currentStepIdx ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 transition-colors sm:w-12",
                  idx < currentStepIdx ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* ──── Step: Upload ──── */}
      {step === "upload" && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <Package className="h-6 w-6" />
              {t("title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t("uploadDesc")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors hover:border-primary hover:bg-muted/50"
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t("dropPhotos")}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={UPLOAD.ALLOWED_TYPES.join(",")}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {/* Preview grid */}
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {previews.map((url, idx) => (
                  <div
                    key={idx}
                    className="group relative aspect-square overflow-hidden rounded-lg border"
                  >
                    <Image
                      src={url}
                      alt={`Photo ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                    <button
                      onClick={() => removeFile(idx)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed transition-colors hover:border-primary hover:bg-muted/50"
                >
                  <Camera className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Continue */}
            <Button
              className="w-full"
              size="lg"
              disabled={files.length === 0}
              onClick={analyzePhotos}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t("analyzeItems")} ({files.length})
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ──── Step: Analyzing ──── */}
      {step === "analyzing" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">{t("analyzingTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("analyzingDesc")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ──── Step: Review items ──── */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t("identifiedItems")} ({items.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              {selectedCount} {t("selected")} · {formatPrice(totalValue)}
            </p>
          </div>

          {items.map((item) => (
            <Card
              key={item.id}
              className={cn(
                "overflow-hidden transition-opacity",
                !item.selected && "opacity-50",
              )}
            >
              <div className="flex flex-col sm:flex-row">
                {/* Thumbnail */}
                <div className="relative h-32 w-full shrink-0 sm:h-auto sm:w-32">
                  <Image
                    src={item.previewUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>

                {/* Details */}
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={item.title}
                        onChange={(e) =>
                          updateItem(item.id, { title: e.target.value })
                        }
                        className="font-medium"
                        placeholder={t("itemTitle")}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t("suggestedPrice")}:
                        </span>
                        <Badge variant="outline">
                          {formatPrice(item.suggestedPrice)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">→</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.confirmedPrice}
                          onChange={(e) =>
                            updateItem(item.id, {
                              confirmedPrice: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 w-24 tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleItem(item.id)}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            item.selected
                              ? "text-green-500"
                              : "text-muted-foreground",
                          )}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}

          {/* Deadline selector */}
          <Card>
            <CardContent className="p-4">
              <label className="mb-2 block text-sm font-medium">
                {t("deadline")}
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "ONE_DAY", label: t("urgency.oneDay") },
                    { value: "THREE_DAYS", label: t("urgency.threeDays") },
                    { value: "ONE_WEEK", label: t("urgency.oneWeek") },
                    { value: "TWO_WEEKS", label: t("urgency.twoWeeks") },
                    { value: "ONE_MONTH", label: t("urgency.oneMonth") },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDeadline(opt.value)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      deadline === opt.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:border-primary hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("upload")}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("back")}
            </Button>
            <Button
              className="flex-1"
              size="lg"
              disabled={selectedCount === 0}
              onClick={publishAll}
            >
              <Rocket className="mr-2 h-4 w-4" />
              {t("publishAll")} ({selectedCount})
            </Button>
          </div>
        </div>
      )}

      {/* ──── Step: Publishing ──── */}
      {step === "publishing" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">{t("publishingTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("publishingDesc")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ──── Step: Done ──── */}
      {step === "done" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xl font-semibold">{t("doneTitle")}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("doneDesc", { count: publishedCount })}
            </p>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              {t("createMore")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
