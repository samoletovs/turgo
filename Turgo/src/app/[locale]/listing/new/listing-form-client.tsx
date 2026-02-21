"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  X,
  Camera,
  Bot,
  ArrowRight,
  Loader2,
  Check,
  ImagePlus,
  MapPin,
  Tag,
  DollarSign,
  FileText,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

// ─── Types ───────────────────────────────────────────────

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  children?: CategoryOption[];
}

interface LocationOption {
  id: string;
  name: string;
  slug: string;
  children?: LocationOption[];
}

interface ManualListingFormProps {
  locale: string;
  categories: CategoryOption[];
  locations: LocationOption[];
}

// ─── Component ───────────────────────────────────────────

export function ManualListingForm({
  locale,
  categories,
  locations,
}: ManualListingFormProps) {
  const _t = useTranslations("sell");
  const tListing = useTranslations("listing");
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency] = useState("EUR");
  const [negotiable, setNegotiable] = useState(true);
  const [condition, setCondition] = useState("USED");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [sublocationId, setSublocationId] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  // Derived
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedLocation = locations.find((l) => l.id === locationId);
  const effectiveCategoryId = subcategoryId || categoryId;
  const effectiveLocationId = sublocationId || locationId;

  // Get display name from i18n JSON
  const getName = useCallback(
    (name: string | Record<string, string>) => {
      if (typeof name === "object") {
        return name[locale] || name.en || Object.values(name)[0] || "";
      }
      return name;
    },
    [locale],
  );

  // Photo handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newPhotos = [...photos, ...files].slice(0, 15); // max 15
    const newPreviews = [
      ...photoPreviews,
      ...files.map((f) => URL.createObjectURL(f)),
    ].slice(0, 15);
    setPhotos(newPhotos);
    setPhotoPreviews(newPreviews);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Validate
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (title.trim().length < 5) errs.title = "Title must be at least 5 characters";
    if (description.trim().length < 20)
      errs.description = "Description must be at least 20 characters";
    if (!price || parseFloat(price) <= 0) errs.price = "Enter a valid price";
    if (!effectiveCategoryId) errs.category = "Select a category";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit
  const handleSubmit = async (status: "DRAFT" | "ACTIVE") => {
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("price", price);
      formData.append("currency", currency);
      formData.append("negotiable", String(negotiable));
      formData.append("condition", condition);
      formData.append("categoryId", effectiveCategoryId);
      if (effectiveLocationId) formData.append("locationId", effectiveLocationId);
      if (contactPhone) formData.append("contactPhone", contactPhone);
      if (contactEmail) formData.append("contactEmail", contactEmail);
      formData.append("status", status);

      photos.forEach((photo) => formData.append("photos", photo));

      const response = await fetch("/api/listings", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setSubmitStatus("success");
        setTimeout(() => {
          router.push(
            `/${locale}/listing/${result.slug || result.id}`,
          );
        }, 1000);
      } else {
        setSubmitStatus("error");
      }
    } catch {
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus === "success") {
    return (
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-md px-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Listing Created!</h1>
          <p className="mt-2 text-muted-foreground">
            Your listing has been created. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Create Listing Manually</h1>
          <p className="mt-1 text-muted-foreground">
            Fill in the details yourself, the old-fashioned way.
          </p>

          {/* AI agent alternative prompt */}
          <Card className="mt-4 border-primary/20 bg-primary/5">
            <CardContent className="flex items-center gap-3 p-3">
              <Bot className="h-5 w-5 shrink-0 text-primary" />
              <p className="flex-1 text-xs text-muted-foreground">
                <strong className="text-foreground">Tip:</strong> Our AI selling agent can
                create your listing from just a photo.{" "}
                <Link href="/sell" className="font-medium text-primary hover:underline">
                  Try the agent instead <ArrowRight className="inline h-3 w-3" />
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* ── Photos ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Photos</h2>
              <span className="text-xs text-muted-foreground">
                ({photos.length}/15)
              </span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {photoPreviews.map((src, i) => (
                <div
                  key={i}
                  className="group relative aspect-square overflow-hidden rounded-lg border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Photo ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {i === 0 && (
                    <Badge
                      variant="default"
                      className="absolute left-1 top-1 text-[9px] px-1"
                    >
                      Main
                    </Badge>
                  )}
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}

              {photos.length < 15 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Camera className="h-6 w-6" />
                </button>
              )}
            </div>
          </section>

          {/* ── Title & Description ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Details</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Canyon Spectral 29 Mountain Bike 2024"
                  maxLength={200}
                  className={cn("mt-1", errors.title && "border-red-500")}
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-red-500">{errors.title}</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {title.length}/200 characters
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your item in detail — condition, features, why you're selling..."
                  rows={6}
                  maxLength={5000}
                  className={cn("mt-1", errors.description && "border-red-500")}
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-500">{errors.description}</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {description.length}/5000 characters
                </p>
              </div>
            </div>
          </section>

          {/* ── Category ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Category *</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategoryId(""); }}>
                  <SelectTrigger className={cn("mt-1", errors.category && "border-red-500")}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {getName(cat.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="mt-1 text-xs text-red-500">{errors.category}</p>
                )}
              </div>

              {selectedCategory?.children && selectedCategory.children.length > 0 && (
                <div>
                  <Label>Subcategory</Label>
                  <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCategory.children.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {getName(sub.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </section>

          {/* ── Condition ── */}
          <section>
            <Label>Condition</Label>
            <div className="mt-2 flex gap-2">
              {(["NEW", "USED", "REFURBISHED"] as const).map((cond) => (
                <button
                  key={cond}
                  onClick={() => setCondition(cond)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-colors",
                    condition === cond
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {tListing(`conditions.${cond}`)}
                </button>
              ))}
            </div>
          </section>

          {/* ── Price ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Price</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="price">Price (EUR) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  className={cn("mt-1", errors.price && "border-red-500")}
                />
                {errors.price && (
                  <p className="mt-1 text-xs text-red-500">{errors.price}</p>
                )}
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={negotiable}
                    onChange={(e) => setNegotiable(e.target.checked)}
                    className="rounded border"
                  />
                  <span className="text-sm">Price is negotiable</span>
                </label>
              </div>
            </div>
          </section>

          {/* ── Location ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Location</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Country / Region</Label>
                <Select value={locationId} onValueChange={(v) => { setLocationId(v); setSublocationId(""); }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {getName(loc.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedLocation?.children && selectedLocation.children.length > 0 && (
                <div>
                  <Label>City / Area</Label>
                  <Select value={sublocationId} onValueChange={setSublocationId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedLocation.children.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {getName(sub.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </section>

          {/* ── Contact ── */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">Contact Information</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="contactPhone">Phone (optional)</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+371 20 123 456"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contactEmail">Email (optional)</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1"
                />
              </div>
            </div>
          </section>

          {/* ── Actions ── */}
          <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => handleSubmit("DRAFT")}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1 h-4 w-4" />
              )}
              Save as Draft
            </Button>

            <Button
              onClick={() => handleSubmit("ACTIVE")}
              disabled={isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Publish Listing
            </Button>
          </div>

          {submitStatus === "error" && (
            <p className="text-center text-sm text-red-500">
              Failed to create listing. Please try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
