"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { ConversationList } from "@/components/messaging/conversation-list";
import { ChatWindow } from "@/components/messaging/chat-window";

interface MessagesPageClientProps {
  locale: string;
}

export function MessagesPageClient({ locale }: MessagesPageClientProps) {
  const router = useRouter();
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);

  return (
    <div className="container mx-auto h-[calc(100vh-4rem)] max-w-6xl px-0 sm:px-4 sm:py-4">
      <div className="flex h-full overflow-hidden rounded-none sm:rounded-xl border bg-background shadow-sm">
        {/* Conversation list */}
        <div
          className={`${
            selectedConversation ? "hidden md:flex" : "flex"
          } w-full md:w-80 lg:w-96 flex-col border-r`}
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <h1 className="text-lg font-bold">Messages</h1>
          </div>
          <ConversationList
            locale={locale}
            activeConversationId={selectedConversation ?? undefined}
            onSelectConversation={(id) => {
              // On desktop, show inline; on mobile, navigate
              if (window.innerWidth >= 768) {
                setSelectedConversation(id);
              } else {
                router.push(`/${locale}/messages/${id}`);
              }
            }}
          />
        </div>

        {/* Chat area */}
        <div
          className={`${
            selectedConversation ? "flex" : "hidden md:flex"
          } flex-1 flex-col min-w-0`}
        >
          {selectedConversation ? (
            <ChatWindow
              conversationId={selectedConversation}
              locale={locale}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-muted-foreground">
              <div>
                <MessageCircle className="mx-auto mb-3 h-12 w-12" />
                <h3 className="text-lg font-medium">Select a conversation</h3>
                <p className="text-sm mt-1">
                  Choose a conversation from the list to start chatting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
