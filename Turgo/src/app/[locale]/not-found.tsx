import { getTranslations } from "next-intl/server";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFoundPage() {
  let title = "Page Not Found";
  let description =
    "The page you're looking for doesn't exist or has been moved.";
  let cta = "Go Home";

  try {
    const t = await getTranslations("errors.notFound");
    title = t("title");
    description = t("description");
    cta = t("cta");
  } catch {
    // Fallback to English defaults
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="mb-2 text-4xl font-bold">404</h1>
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="mb-8 max-w-md text-muted-foreground">{description}</p>
      <Button asChild size="lg">
        <Link href="/">
          <Home className="mr-2 h-4 w-4" />
          {cta}
        </Link>
      </Button>
    </div>
  );
}
