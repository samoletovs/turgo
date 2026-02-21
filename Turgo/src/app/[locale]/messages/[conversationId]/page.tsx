import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ConversationPageClient } from "./conversation-client";

interface ConversationPageProps {
  params: Promise<{ locale: string; conversationId: string }>;
}

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const { locale, conversationId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  return (
    <ConversationPageClient
      conversationId={conversationId}
      locale={locale}
    />
  );
}
