"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  X,
  Pencil,
  Loader2,
  Check,
  MapPin,
  Tag,
  DollarSign,
  FileText,
  Save,
  ArrowLeft,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface ListingImage {
  id: string;
  url: string;
  isPrimary: boolean;
}

interface CategoryOption {
  id: string;
  name: string | Record<string, string>;
  slug: string;
  children?: CategoryOption[];
}

interface LocationOption {
  id: string;
  name: string | Record<string, string>;
  slug: string;
  children?: LocationOption[];
}

interface ListingData {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  negotiable: boolean;
  condition: string;
  categoryId: string;
  subcategoryId: string;
  locationId: string;
  sublocationId: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  status: string;
  images: ListingImage[];
}

interface EditListingClientProps {
  locale: string;
  listing: ListingData;
  categories: CategoryOption[];
  locations: LocationOption[];
}

export function EditListingClient({
  locale,
  listing,
  categories,
  locations,
}: EditListingClientProps) {
  const t = useTranslations("editListing");
  const tListing = useTranslations("listing");
  const router = useRouter();

  // Form state populated from listing
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [price, setPrice] = useState(String(listing.price));
  const [negotiable, setNegotiable] = useState(listing.negotiable);
  const [condition, setCondition] = useState(listing.condition);
  const [categoryId, setCategoryId] = useState(listing.categoryId);
  const [subcategoryId, setSubcategoryId] = useState(listing.subcategoryId);
  const [locationId, setLocationId] = useState(listing.locationId);
  const [sublocationId, setSublocationId] = useState(listing.sublocationId);
  const [contactPhone, setContactPhone] = useState(listing.contactPhone);
  const [contactEmail, setContactEmail] = useState(listing.contactEmail);

  // Parse existing address into structured parts
  const parseAddress = (addr: string) => {
    const parts = addr.split(",").map((s) => s.trim());
    const countries = ["Latvia", "Lithuania", "Estonia"];
    const country = parts.find((p) => countries.includes(p)) || "Latvia";
    const remaining = parts.filter((p) => !countries.includes(p));
    // Last non-country part is city, rest is street
    const city = remaining.length > 0 ? remaining[remaining.length - 1] : "";
    const street =
      remaining.length > 1 ? remaining.slice(0, -1).join(", ") : "";
    return { country, city, street };
  };
  const parsed = parseAddress(listing.address);
  const [addressCountry, setAddressCountry] = useState(parsed.country);
  const [addressCity, setAddressCity] = useState(parsed.city);
  const [addressStreet, setAddressStreet] = useState(parsed.street);

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  // Derived
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedLocation = locations.find((l) => l.id === locationId);
  const effectiveCategoryId = subcategoryId || categoryId;

  const getName = useCallback(
    (name: string | Record<string, string> | unknown) => {
      if (typeof name === "object" && name !== null) {
        const map = name as Record<string, string>;
        return map[locale] || map.en || Object.values(map)[0] || "";
      }
      return String(name ?? "");
    },
    [locale],
  );

  // tRPC mutation
  const updateMutation = trpc.listing.update.useMutation({
    onSuccess: () => {
      setSubmitStatus("success");
      setTimeout(() => {
        router.push(`/${locale}/listing/${listing.slug}`);
      }, 1000);
    },
    onError: (err) => {
      setSubmitStatus("error");
      setErrors({ submit: err.message });
    },
  });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (title.trim().length < 5) errs.title = t("errorTitleMin");
    if (description.trim().length < 20) errs.description = t("errorDescMin");
    if (!price || parseFloat(price) <= 0) errs.price = t("errorPrice");
    if (!effectiveCategoryId) errs.category = t("errorCategory");
    if (
      categoryId &&
      !subcategoryId &&
      selectedCategory?.children &&
      selectedCategory.children.length > 0
    )
      errs.category = t("errorSubcategory");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    updateMutation.mutate({
      id: listing.id,
      data: {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        currency: listing.currency,
        negotiable,
        condition: condition as "NEW" | "USED" | "REFURBISHED",
        categoryId: effectiveCategoryId,
        locationId: sublocationId || locationId || undefined,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        address:
          [addressStreet, addressCity, addressCountry]
            .filter(Boolean)
            .join(", ") || undefined,
      },
    });
  };

  if (submitStatus === "success") {
    return (
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-md px-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold">{t("updated")}</h1>
          <p className="mt-2 text-muted-foreground">{t("updatedDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/${locale}/listing/${listing.slug}`}>
            <Button variant="ghost" size="sm" className="mb-2 gap-1 text-xs">
              <ArrowLeft className="h-3 w-3" /> {t("backToListing")}
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          <Badge variant="secondary" className="mt-2">
            {listing.status}
          </Badge>
        </div>

        {/* Existing images preview */}
        {listing.images.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold">{t("currentPhotos")}</h2>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {listing.images.map((img, i) => (
                <div
                  key={img.id}
                  className="relative aspect-square overflow-hidden rounded-lg border"
                >
                  <Image
                    src={img.url}
                    alt={`Photo ${i + 1}`}
                    fill
                    unoptimized={img.url.startsWith("http")}
                    className="object-cover"
                    sizes="100px"
                  />
                  {img.isPrimary && (
                    <Badge
                      variant="default"
                      className="absolute left-1 top-1 text-[9px] px-1"
                    >
                      Main
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="space-y-8">
          {/* ── Title & Description ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{t("details")}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">{t("titleLabel")} *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className={cn("mt-1", errors.title && "border-red-500")}
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-red-500">{errors.title}</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {title.length}/200
                </p>
              </div>

              <div>
                <Label htmlFor="description">{t("descriptionLabel")} *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  maxLength={5000}
                  className={cn("mt-1", errors.description && "border-red-500")}
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.description}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {description.length}/5000
                </p>
              </div>
            </div>
          </section>

          {/* ── Category ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{t("category")} *</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("categoryLabel")}</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => {
                    setCategoryId(v);
                    setSubcategoryId("");
                  }}
                >
                  <SelectTrigger
                    className={cn("mt-1", errors.category && "border-red-500")}
                  >
                    <SelectValue placeholder={t("selectCategory")} />
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

              {selectedCategory?.children &&
                selectedCategory.children.length > 0 && (
                  <div>
                    <Label>{t("subcategory")}</Label>
                    <Select
                      value={subcategoryId}
                      onValueChange={setSubcategoryId}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t("selectSubcategory")} />
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
            <Label>{t("conditionLabel")}</Label>
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
              <h2 className="text-sm font-semibold">{t("price")}</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="price">
                  {t("priceLabel")} ({listing.currency}) *
                </Label>
                <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
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
                  <span className="text-sm">{t("negotiable")}</span>
                </label>
              </div>
            </div>
          </section>

          {/* ── Location ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{t("location")}</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("region")}</Label>
                <Select
                  value={locationId}
                  onValueChange={(v) => {
                    setLocationId(v);
                    setSublocationId("");
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("selectLocation")} />
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

              {selectedLocation?.children &&
                selectedLocation.children.length > 0 && (
                  <div>
                    <Label>{t("area")}</Label>
                    <Select
                      value={sublocationId}
                      onValueChange={setSublocationId}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t("selectArea")} />
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

          {/* ── Address ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{t("addressLabel")}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("addressCountry")}</Label>
                <Select
                  value={addressCountry}
                  onValueChange={setAddressCountry}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("selectCountry")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Latvia">Latvia</SelectItem>
                    <SelectItem value="Lithuania">Lithuania</SelectItem>
                    <SelectItem value="Estonia">Estonia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("addressCityLabel")}</Label>
                <Input
                  value={addressCity}
                  onChange={(e) => setAddressCity(e.target.value)}
                  placeholder="e.g., Rīga"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="mt-3">
              <Label>{t("addressField")}</Label>
              <Input
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                placeholder="e.g., Brīvības iela 100, LV-1001"
                className="mt-1"
              />
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("addressHint")}
              </p>
            </div>
          </section>

          {/* ── Contact ── */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">{t("contact")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="contactPhone">{t("phone")}</Label>
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
                <Label htmlFor="contactEmail">{t("email")}</Label>
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
            <Link href={`/${locale}/listing/${listing.slug}`}>
              <Button variant="outline" className="gap-1.5">
                <X className="h-4 w-4" />
                {t("cancel")}
              </Button>
            </Link>

            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              className="gap-1.5"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("saveChanges")}
            </Button>
          </div>

          {errors.submit && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 text-center">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {errors.submit}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
