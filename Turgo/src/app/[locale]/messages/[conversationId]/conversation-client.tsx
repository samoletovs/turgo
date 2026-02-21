"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationList } from "@/components/messaging/conversation-list";
import { ChatWindow } from "@/components/messaging/chat-window";

interface ConversationPageClientProps {
  conversationId: string;
  locale: string;
}

export function ConversationPageClient({
  conversationId,
  locale,
}: ConversationPageClientProps) {
  const router = useRouter();

  return (
    <div className="container mx-auto h-[calc(100vh-4rem)] max-w-6xl px-0 sm:px-4 sm:py-4">
      <div className="flex h-full overflow-hidden rounded-none sm:rounded-xl border bg-background shadow-sm">
        {/* Sidebar — conversation list (hidden on mobile when viewing a conversation) */}
        <div className="hidden md:flex md:w-80 lg:w-96 flex-col border-r">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <h2 className="text-lg font-bold">Messages</h2>
          </div>
          <ConversationList
            locale={locale}
            activeConversationId={conversationId}
            onSelectConversation={(id) =>
              router.push(`/${locale}/messages/${id}`)
            }
          />
        </div>

        {/* Chat window */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Mobile back button */}
          <div className="flex items-center gap-2 border-b px-2 py-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/${locale}/messages`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium">Back to messages</span>
          </div>

          <ChatWindow conversationId={conversationId} locale={locale} />
        </div>
      </div>
    </div>
  );
}
