import { redirect } from "next/navigation";

export default function LegalPrivacyRedirect({
  params: _params,
}: {
  params: Promise<{ locale: string }>;
}) {
  redirect("../privacy");
}
