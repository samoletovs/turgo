import { redirect } from "next/navigation";

export default function LegalTermsRedirect({
  params: _params,
}: {
  params: Promise<{ locale: string }>;
}) {
  redirect("../terms");
}
